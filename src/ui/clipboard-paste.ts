import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Matches pi-tui's NativeClipboard read methods. Undefined means unavailable,
// null means empty.
export interface PasteClipboard {
	getImage(): Promise<Uint8Array | null | undefined>;
	getText(): Promise<string | null | undefined>;
}

export interface PasteTarget {
	insertTextAtCursor(text: string): void;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const RIFF_HEADER_BYTES = 8;

// pi-tui exports getNativeClipboard from 0.86.0. The 0.84.1 floor lacks it, so
// resolve it at runtime; a static named import would fail to load there.
export async function loadNativeClipboard(): Promise<
	PasteClipboard | undefined
> {
	const piTui: object = await import("@earendil-works/pi-tui");
	const getNativeClipboard: unknown = Reflect.get(piTui, "getNativeClipboard");
	if (typeof getNativeClipboard !== "function") {
		return;
	}
	const clipboard: unknown = getNativeClipboard();
	return isPasteClipboard(clipboard) ? clipboard : undefined;
}

function isPasteClipboard(value: unknown): value is PasteClipboard {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof Reflect.get(value, "getImage") === "function" &&
		typeof Reflect.get(value, "getText") === "function"
	);
}

// Same flow as pi's main editor (interactive-mode handleClipboardPaste): save a
// clipboard image to a temp file and insert its path; otherwise insert
// clipboard text. Clipboard errors are ignored, as in pi.
export async function pasteFromClipboard(
	target: PasteTarget,
	clipboard: PasteClipboard | undefined,
	tempDir = tmpdir()
): Promise<void> {
	if (!clipboard) {
		return;
	}
	try {
		const image = await clipboard.getImage();
		const extension = image ? imageExtension(image) : undefined;
		if (image && extension) {
			const filePath = join(
				tempDir,
				`pi-clipboard-${randomUUID()}.${extension}`
			);
			await writeFile(filePath, image);
			target.insertTextAtCursor(filePath);
			return;
		}
		const text = await clipboard.getText();
		if (text) {
			target.insertTextAtCursor(text);
		}
	} catch {
		// Ignore clipboard errors (for example, missing permission), as pi does.
	}
}

// pi converts other formats (for example Windows BMP) to PNG through a private
// helper. pi-ask cannot, so it treats them as "no image" and pastes text.
function imageExtension(bytes: Uint8Array): string | undefined {
	if (startsWith(bytes, PNG_SIGNATURE)) {
		return "png";
	}
	if (startsWith(bytes, JPEG_SIGNATURE)) {
		return "jpg";
	}
	if (
		startsWithAscii(bytes, 0, "GIF87a") ||
		startsWithAscii(bytes, 0, "GIF89a")
	) {
		return "gif";
	}
	if (
		startsWithAscii(bytes, 0, "RIFF") &&
		startsWithAscii(bytes, RIFF_HEADER_BYTES, "WEBP")
	) {
		return "webp";
	}
	return;
}

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
	return prefix.every((byte, index) => bytes[index] === byte);
}

function startsWithAscii(
	bytes: Uint8Array,
	offset: number,
	text: string
): boolean {
	return [...text].every(
		(char, index) => bytes[offset + index] === char.charCodeAt(0)
	);
}

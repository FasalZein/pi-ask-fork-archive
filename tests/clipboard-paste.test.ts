import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { DEFAULT_ASK_CONFIG } from "../src/config/defaults.ts";
import { getAskConfigStore } from "../src/config/store.ts";
import {
	loadNativeClipboard,
	type PasteClipboard,
	pasteFromClipboard,
} from "../src/ui/clipboard-paste.ts";
import { runAskFlow } from "../src/ui/controller.ts";

const PNG_BYTES = Uint8Array.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);
const JPEG_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 9, 9]);
const CTRL_V = "\x16";

function fakeClipboard(
	image: Uint8Array | null | undefined,
	text: string | null | undefined = null
): PasteClipboard {
	return {
		getImage: async () => image,
		getText: async () => text,
	};
}

function recorder() {
	const inserted: string[] = [];
	return {
		inserted,
		insertTextAtCursor(text: string) {
			inserted.push(text);
		},
	};
}

async function withTempDir(run: (dir: string) => Promise<void>) {
	const dir = await mkdtemp(join(tmpdir(), "pi-ask-paste-"));
	try {
		await run(dir);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

test("clipboard image is saved as a pi-clipboard temp file and its path is inserted", async () => {
	await withTempDir(async (dir) => {
		for (const [bytes, extension] of [
			[PNG_BYTES, "png"],
			[JPEG_BYTES, "jpg"],
		] as const) {
			const target = recorder();
			await pasteFromClipboard(target, fakeClipboard(bytes, "ignored"), dir);
			assert.equal(target.inserted.length, 1);
			const filePath = target.inserted[0] ?? "";
			assert.equal(join(dir, basename(filePath)), filePath);
			assert.match(
				basename(filePath),
				new RegExp(`^pi-clipboard-[0-9a-f-]{36}\\.${extension}$`, "u")
			);
			assert.deepEqual(new Uint8Array(await readFile(filePath)), bytes);
		}
	});
});

test("without a clipboard image, clipboard text is inserted and no file is written", async () => {
	await withTempDir(async (dir) => {
		for (const image of [null, new Uint8Array(), Uint8Array.from([1, 2, 3])]) {
			const target = recorder();
			await pasteFromClipboard(target, fakeClipboard(image, "hello"), dir);
			assert.deepEqual(target.inserted, ["hello"]);
		}
		const empty = recorder();
		await pasteFromClipboard(empty, fakeClipboard(null, null), dir);
		assert.deepEqual(empty.inserted, []);
		assert.deepEqual(await readdir(dir), []);
	});
});

test("missing or failing clipboard helper inserts nothing and does not throw", async () => {
	const missing = recorder();
	await pasteFromClipboard(missing, undefined);
	assert.deepEqual(missing.inserted, []);

	const failing = recorder();
	await pasteFromClipboard(failing, {
		getImage: () => Promise.reject(new Error("no permission")),
		getText: async () => "text",
	});
	assert.deepEqual(failing.inserted, []);
});

test("loadNativeClipboard resolves without throwing on the installed pi-tui", async () => {
	const clipboard = await loadNativeClipboard();
	assert.ok(
		clipboard === undefined ||
			(typeof clipboard.getImage === "function" &&
				typeof clipboard.getText === "function")
	);
});

const theme = {
	fg: (_: string, value: string) => value,
	bg: (_: string, value: string) => value,
	bold: (value: string) => value,
};

interface Component {
	handleInput(data: string): void;
}

async function openNoteFlow(loadClipboard: () => Promise<PasteClipboard>) {
	getAskConfigStore().setConfig(DEFAULT_ASK_CONFIG);
	let component: Component | undefined;
	const keybindings = {
		matches: (data: string, id: string) =>
			id === "app.clipboard.pasteImage" && data === CTRL_V,
	};
	const flow = runAskFlow(
		{
			cwd: process.cwd(),
			mode: "tui",
			ui: {
				custom(factory: (...args: unknown[]) => unknown) {
					return new Promise((resolve) => {
						component = factory(
							{
								terminal: { rows: 30, columns: 100 },
								requestRender() {
									// Rendering is not under test.
								},
							},
							theme,
							keybindings,
							resolve
						) as Component;
					});
				},
			},
		} as never,
		{
			title: "Demo",
			questions: [
				{
					id: "q",
					prompt: "Choose",
					options: [{ value: "a", label: "A" }],
				},
			],
		},
		{
			exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }),
			loadClipboard,
		}
	);
	await new Promise((resolve) => setImmediate(resolve));
	assert.ok(component);
	component.handleInput("n");
	return { component, flow };
}

async function settle() {
	for (let index = 0; index < 5; index++) {
		await new Promise((resolve) => setImmediate(resolve));
	}
}

async function submitNote(component: Component, flow: Promise<unknown>) {
	component.handleInput("\r");
	component.handleInput("\r");
	component.handleInput("\r");
	const result = await flow;
	return JSON.stringify(result);
}

test("pasteImage key in the ask note editor inserts clipboard text at the cursor", async () => {
	const { component, flow } = await openNoteFlow(async () =>
		fakeClipboard(null, "PASTED")
	);
	component.handleInput("a");
	component.handleInput("b");
	component.handleInput("\x1b[D");
	component.handleInput(CTRL_V);
	await settle();
	const result = await submitNote(component, flow);
	assert.ok(result.includes("aPASTEDb"));
});

test("bracketed paste in the ask note editor is unchanged and does not read the clipboard", async () => {
	let reads = 0;
	const { component, flow } = await openNoteFlow(() => {
		reads++;
		return Promise.resolve(fakeClipboard(null, "CLIPBOARD"));
	});
	component.handleInput("\x1b[200~terminal text\x1b[201~");
	await settle();
	const result = await submitNote(component, flow);
	assert.equal(reads, 0);
	assert.ok(result.includes("terminal text"));
	assert.ok(!result.includes("CLIPBOARD"));
});

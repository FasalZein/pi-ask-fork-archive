import { accessSync, constants as fsConstants } from "node:fs";
import { delimiter, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	type AutocompleteItem,
	type AutocompleteProvider,
	CombinedAutocompleteProvider,
} from "@earendil-works/pi-tui";
import { getSkillCommands, type SkillCommands } from "../skill-references.ts";

export const SKILL_COMPLETION_PREFIX = /(^|\s)(\/(?:skill:)?[a-zA-Z0-9._-]*)$/;
const WHITESPACE_START = /^\s/;
const SKILL_API_CHANNEL = "pi-better-skills/v1/request";
type SkillEvents = Pick<ExtensionAPI["events"], "emit">;
let skillEvents: SkillEvents | undefined;

export function setSkillAutocompleteEvents(events: SkillEvents): void {
	skillEvents = events;
}

function isSuggestionReply(value: unknown): value is {
	version: 1;
	operation: "suggest";
	items: AutocompleteItem[];
} {
	if (!value || typeof value !== "object") {
		return false;
	}
	if (
		!("version" in value) ||
		value.version !== 1 ||
		!("operation" in value) ||
		value.operation !== "suggest" ||
		!("items" in value) ||
		!Array.isArray(value.items)
	) {
		return false;
	}
	return value.items.every(
		(item: unknown) =>
			item !== null &&
			typeof item === "object" &&
			"value" in item &&
			typeof item.value === "string" &&
			item.value.startsWith("skill:") &&
			"label" in item &&
			typeof item.label === "string"
	);
}

function hasSkillApi(events: SkillEvents | undefined): boolean {
	let available = false;
	events?.emit(SKILL_API_CHANNEL, {
		version: 1,
		operation: "probe",
		reply: (value: unknown) => {
			if (
				value &&
				typeof value === "object" &&
				"version" in value &&
				value.version === 1 &&
				"operation" in value &&
				value.operation === "probe" &&
				"available" in value &&
				value.available === true
			) {
				available = true;
			}
		},
	});
	return available;
}

function requestSkillSuggestions(
	events: SkillEvents,
	query: string
): AutocompleteItem[] | undefined {
	let items: AutocompleteItem[] | undefined;
	events.emit(SKILL_API_CHANNEL, {
		version: 1,
		operation: "suggest",
		query,
		reply: (value: unknown) => {
			if (isSuggestionReply(value)) {
				items = value.items;
			}
		},
	});
	return items;
}

const FD_BINARY_NAMES =
	process.platform === "win32"
		? ["fd.exe", "fdfind.exe", "fd", "fdfind"]
		: ["fd", "fdfind"];

/**
 * pi resolves fd internally for its main editor, but that resolver is not part of
 * the public extension API. Custom editors therefore need to supply the fd path
 * themselves when reusing CombinedAutocompleteProvider for `@` file mentions.
 */
export function createAskAutocompleteProvider(
	cwd: string,
	commands: SkillCommands = [],
	events: SkillEvents | undefined = skillEvents
): AutocompleteProvider {
	const fileProvider = new CombinedAutocompleteProvider(
		[],
		cwd,
		findAutocompleteBinary(FD_BINARY_NAMES)
	);
	const skillProvider = new CombinedAutocompleteProvider(
		getSkillCommands(commands).map(({ name, description }) => ({
			name,
			description,
		})),
		cwd
	);
	const useSkillApi = hasSkillApi(events);
	return {
		triggerCharacters: ["@"],
		getSuggestions(lines, cursorLine, cursorCol, options) {
			const before = (lines[cursorLine] ?? "").slice(0, cursorCol);
			const token = SKILL_COMPLETION_PREFIX.exec(before)?.[2];
			if (token && !(options.force && !token.startsWith("/skill:"))) {
				return getSkillSuggestions(
					token,
					skillProvider,
					options.signal,
					useSkillApi ? events : undefined
				);
			}
			return fileProvider.getSuggestions(lines, cursorLine, cursorCol, options);
		},
		applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
			if (
				!(
					SKILL_COMPLETION_PREFIX.test(prefix) &&
					item.value.startsWith("skill:")
				)
			) {
				return fileProvider.applyCompletion(
					lines,
					cursorLine,
					cursorCol,
					item,
					prefix
				);
			}
			const line = lines[cursorLine] ?? "";
			const after = line.slice(cursorCol);
			const insertion = `/${item.value}${WHITESPACE_START.test(after) ? "" : " "}`;
			const updated = [...lines];
			updated[cursorLine] =
				line.slice(0, cursorCol - prefix.length) + insertion + after;
			return {
				lines: updated,
				cursorLine,
				cursorCol: cursorCol - prefix.length + insertion.length,
			};
		},
		shouldTriggerFileCompletion: (lines, line, col) =>
			fileProvider.shouldTriggerFileCompletion(lines, line, col),
	};
}

async function getSkillSuggestions(
	token: string,
	provider: CombinedAutocompleteProvider,
	signal: AbortSignal,
	events: SkillEvents | undefined
) {
	if (events) {
		const items = requestSkillSuggestions(events, token.slice(1));
		if (items) {
			return items.length > 0 ? { items, prefix: token } : null;
		}
	}
	const suggestions = await provider.getSuggestions([token], 0, token.length, {
		signal,
		force: false,
	});
	return suggestions ? { ...suggestions, prefix: token } : null;
}

function findAutocompleteBinary(binaryNames: readonly string[]): string | null {
	const pathValue = process.env.PATH;
	if (!pathValue) {
		return null;
	}

	const directories = pathValue.split(delimiter).filter(Boolean);
	for (const binaryName of binaryNames) {
		const executablePath = directories
			.map((directory) => join(directory, binaryName))
			.find(isExecutableFile);
		if (executablePath) {
			return executablePath;
		}
	}

	return null;
}

function isExecutableFile(path: string): boolean {
	try {
		accessSync(path, fsConstants.X_OK);
		return true;
	} catch {
		return false;
	}
}

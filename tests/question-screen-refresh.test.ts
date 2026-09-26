import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ASK_CONFIG } from "../src/config/defaults.ts";
import { createInitialState } from "../src/state/create.ts";
import { applyNumberShortcut, moveOption } from "../src/state/transitions.ts";
import { renderAskScreen } from "../src/ui/render.ts";

const theme = {
	fg: (_color: string, text: string) => text,
	bg: (_color: string, text: string) => text,
	bold: (text: string) => text,
} as never;
const editor = { getText: () => "", render: () => [] } as never;

const storage = {
	title: "Demo: project setup",
	questions: [
		{
			id: "storage",
			prompt: "Which storage engine should the service use?",
			options: [
				{
					value: "postgres",
					label: "PostgreSQL",
					recommended: true,
					description:
						"Relational, strong consistency; the team already runs it in production.",
				},
				{
					value: "sqlite",
					label: "SQLite",
					description: "Embedded, zero ops; fine below one writer.",
				},
			],
		},
	],
};

for (const width of [60, 100, 140]) {
	test(`question layout follows the approved capture at ${width} columns`, () => {
		const state = createInitialState(storage);
		const lines = renderAskScreen({
			config: DEFAULT_ASK_CONFIG,
			state,
			theme,
			width,
			editor,
		});
		assert.equal(state.answers.storage, undefined);
		assert(lines.includes(" Which storage engine should the service use?"));
		assert(lines.includes(" ▶ 1. PostgreSQL"));
		assert(lines.includes("   2. SQLite"));
		const description =
			width === 60
				? [
						"      (recommended) | Relational, strong consistency; the",
						"      team already runs it in production.",
					]
				: [
						"      (recommended) | Relational, strong consistency; the team already runs it in production.",
					];
		const labelIndex = lines.indexOf(" ▶ 1. PostgreSQL");
		assert.deepEqual(
			lines.slice(labelIndex + 1, labelIndex + 1 + description.length),
			description
		);
		const footers: Record<number, string[]> = {
			60: [" Enter confirm · N/Shift+N note · Esc dismiss · ? settings"],
			100: [
				" 1-9 pick · Tab question · Enter confirm · N/Shift+N note · T type · Esc dismiss · ? settings",
			],
			140: [
				" ↑↓ move · 1-9 pick · Tab question · Enter confirm · N/Shift+N note · T type · Esc dismiss · ? settings",
			],
		};
		const footer = footers[width];
		assert.deepEqual(lines.slice(-footer.length - 1, -1), footer);
		assert(lines.every((line) => [...line].length <= width));
	});
}

test("multi selection shows checked rows without preselecting the recommended option", () => {
	const questions = [
		{
			id: "features",
			prompt: "Pick features",
			type: "multi" as const,
			options: [
				{ value: "auth", label: "Authentication" },
				{ value: "sso", label: "SSO", recommended: true },
			],
		},
	];
	let state = createInitialState({ questions });
	state = applyNumberShortcut(state, 1);
	const lines = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme,
		width: 100,
		editor,
	});
	assert(lines.includes(" Pick any · 1 of 2 selected"));
	assert(lines.includes(" ▶ 1. [✓] Authentication"));
	assert(lines.includes("   2. [ ] SSO"));
	assert(lines.includes("      (recommended)"));
	assert.deepEqual(
		state.answers.features?.selected.map((option) => option.value),
		["auth"]
	);
});

test("multi question shows checked count and selected option in a short viewport", () => {
	const questions = [
		{
			id: "features",
			prompt: "Which features belong in the first release?",
			type: "multi" as const,
			options: Array.from({ length: 16 }, (_, index) => ({
				value: String(index + 1),
				label: index === 11 ? "SSO" : `Feature ${index + 1}`,
				recommended: index === 11,
			})),
		},
	];
	let state = createInitialState({ title: "Demo: project setup", questions });
	for (const number of [1, 5, 8]) {
		state = applyNumberShortcut(state, number);
	}
	for (let index = 0; index < 4; index++) {
		state = moveOption(state, 1);
	}
	const viewport = {
		rows: 18,
		scrollTop: 0,
		reviewScrollTop: 0,
		reviewPageRows: 0,
		optionStarts: [],
		bodyRows: 0,
	};
	const lines = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme,
		width: 100,
		editor,
		viewport,
	});
	assert.equal(lines.length, 18);
	assert(lines.includes(" Pick any · 3 of 16 selected"));
	assert(lines.includes(" ▶ 12. [ ] SSO"));
	assert(
		lines.some((line) => line.includes("[✓] Feature")) ||
			lines.some((line) => line.includes("more options above"))
	);
	// The multi footer is 102 columns without the arrow hint, so 100 columns also drops the toggle hint.
	assert(
		lines.includes(
			" Tab question · Enter continue · N/Shift+N note · T type · Esc dismiss · ? settings"
		)
	);
	assert(lines.at(-2)?.includes("settings"));
});

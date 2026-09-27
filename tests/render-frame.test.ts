import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ASK_CONFIG } from "../src/config/defaults.ts";
import { createInitialState } from "../src/state/create.ts";
import {
	applyNumberShortcut,
	enterInputMode,
	enterQuestionNoteMode,
} from "../src/state/transitions.ts";
import { type AskViewport, renderAskScreen } from "../src/ui/render.ts";

function mockEditor() {
	return {
		getText() {
			return "";
		},
		render() {
			return [];
		},
	} as never;
}

function plainTheme() {
	return {
		fg(_color: string, text: string) {
			return text;
		},
		bg(_color: string, text: string) {
			return text;
		},
		bold(text: string) {
			return text;
		},
	} as never;
}
test("wide header keeps all tabs and framing arrows on the tab row", () => {
	const state = createInitialState({
		title: "Demo",
		questions: [
			{
				id: "q1",
				label: "One",
				prompt: "One",
				options: [{ value: "a", label: "A" }],
			},
			{
				id: "q2",
				label: "Two",
				prompt: "Two",
				options: [{ value: "a", label: "A" }],
			},
		],
	});

	const lines = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme: plainTheme(),
		width: 120,
		editor: mockEditor(),
	});

	assert.equal(lines[3], " ←  ○ One   ○ Two   ☰ Review  →");
});

test("narrow tab strip keeps active middle tab visible", () => {
	const state = createInitialState({
		title: "Demo",
		questions: [
			{
				id: "q1",
				label: "One",
				prompt: "One",
				options: [{ value: "a", label: "A" }],
			},
			{
				id: "q2",
				label: "Two",
				prompt: "Two",
				options: [{ value: "a", label: "A" }],
			},
			{
				id: "q3",
				label: "Three",
				prompt: "Three",
				options: [{ value: "a", label: "A" }],
			},
			{
				id: "q4",
				label: "Four",
				prompt: "Four",
				options: [{ value: "a", label: "A" }],
			},
			{
				id: "q5",
				label: "Five",
				prompt: "Five",
				options: [{ value: "a", label: "A" }],
			},
		],
	});
	state.activeTabIndex = 2;

	const lines = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme: plainTheme(),
		width: 28,
		editor: mockEditor(),
	});

	assert.equal(lines[3], " ←  ○ Three   ○ Four  →");
});

test("narrow tab strip keeps submit tab visible when active", () => {
	const state = createInitialState({
		title: "Demo",
		questions: [
			{
				id: "q1",
				label: "One",
				prompt: "One",
				options: [{ value: "a", label: "A" }],
			},
			{
				id: "q2",
				label: "Two",
				prompt: "Two",
				options: [{ value: "a", label: "A" }],
			},
			{
				id: "q3",
				label: "Three",
				prompt: "Three",
				options: [{ value: "a", label: "A" }],
			},
		],
	});
	state.activeTabIndex = state.questions.length;
	state.view = { kind: "submit" };

	const lines = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme: plainTheme(),
		width: 24,
		editor: mockEditor(),
	});

	assert.equal(lines[3], " ←  ☰ Review  →");
});

test("tab strip avoids truncation at narrow boundary widths", () => {
	const state = createInitialState({
		title: "Demo",
		questions: [
			{
				id: "q1",
				label: "One",
				prompt: "One",
				options: [{ value: "a", label: "A" }],
			},
			{
				id: "q2",
				label: "Two",
				prompt: "Two",
				options: [{ value: "a", label: "A" }],
			},
			{
				id: "q3",
				label: "Three",
				prompt: "Three",
				options: [{ value: "a", label: "A" }],
			},
			{
				id: "q4",
				label: "Four",
				prompt: "Four",
				options: [{ value: "a", label: "A" }],
			},
			{
				id: "q5",
				label: "Five",
				prompt: "Five",
				options: [{ value: "a", label: "A" }],
			},
		],
	});
	state.activeTabIndex = 2;

	const expectedByWidth = new Map([
		[28, " ←  ○ Three   ○ Four  →"],
		[29, " ←  ○ Three   ○ Four  →"],
		[30, " ←  ○ Three   ○ Four  →"],
		[31, " ←  ○ Two   ○ Three   ○ Four  →"],
		[32, " ←  ○ Two   ○ Three   ○ Four  →"],
	]);

	for (const [width, expected] of expectedByWidth) {
		const lines = renderAskScreen({
			config: DEFAULT_ASK_CONFIG,
			state,
			theme: plainTheme(),
			width,
			editor: mockEditor(),
		});
		assert.equal(lines[3], expected);
	}
});

test("answered tabs show the filled marker and success color; review stays success", () => {
	let state = createInitialState({
		title: "Demo",
		questions: ["One", "Two"].map((label) => ({
			id: label,
			label,
			prompt: label,
			options: [{ value: "a", label: "A" }],
		})),
	});
	state = applyNumberShortcut(state, 1);
	const theme = {
		fg(color: string, text: string) {
			return `<${color}>${text}</>`;
		},
		bg(color: string, text: string) {
			return `[${color}:${text}]`;
		},
		bold(text: string) {
			return text;
		},
	} as never;
	const lines = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme,
		width: 200,
		editor: mockEditor(),
	});
	assert.equal(
		lines[3],
		" <dim>← </><success> ● One </> [selectedBg:<text> ○ Two </>] <success> ☰ Review </><dim> →</>"
	);
});

test("only the active tab gets a filled background", () => {
	const state = createInitialState({
		title: "Demo",
		questions: ["One", "Two"].map((label) => ({
			id: label,
			label,
			prompt: label,
			options: [{ value: "a", label: "A" }],
		})),
	});
	const theme = {
		fg(_color: string, text: string) {
			return text;
		},
		bold(text: string) {
			return text;
		},
		bg(_color: string, text: string) {
			return `{${text}}`;
		},
	} as never;
	const question = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme,
		width: 80,
		editor: mockEditor(),
	});
	assert.equal(question[3], " ← { ○ One }  ○ Two   ☰ Review  →");
	state.activeTabIndex = 2;
	state.view = { kind: "submit" };
	const review = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme,
		width: 80,
		editor: mockEditor(),
	});
	assert.equal(review[3], " ←  ○ One   ○ Two  { ☰ Review } →");
	assert.equal(review.join("\n").includes("of 2 answered"), false);
});

test("narrow footers drop optional hints and wrap only the essential ones", () => {
	const state = createInitialState({
		questions: [
			{
				id: "q1",
				label: "Features",
				prompt: "Pick features",
				type: "multi",
				options: [{ value: "a", label: "A" }],
			},
		],
	});

	const lines = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme: plainTheme(),
		width: 26,
		editor: mockEditor(),
	});

	// Optional hints are dropped first; only the essential set wraps.
	assert.deepEqual(lines.slice(-4, -1), [
		" Enter continue",
		" N/Shift+N note",
		" Esc dismiss · ? settings",
	]);
});

test("very narrow footers keep every essential hint", () => {
	const state = createInitialState({
		questions: [
			{
				id: "q1",
				label: "One",
				prompt: "One",
				options: [{ value: "a", label: "A" }],
			},
		],
	});

	const lines = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme: plainTheme(),
		width: 22,
		editor: mockEditor(),
	});

	assert.deepEqual(lines.slice(-5, -1), [
		" Enter confirm",
		" N/Shift+N note",
		" Esc dismiss",
		" ? settings",
	]);
});

test("footer hints can be hidden without affecting frame rendering", () => {
	const state = createInitialState({
		questions: [
			{
				id: "q1",
				label: "One",
				prompt: "One",
				options: [{ value: "a", label: "A" }],
			},
		],
	});
	const config = {
		...DEFAULT_ASK_CONFIG,
		behaviour: {
			...DEFAULT_ASK_CONFIG.behaviour,
			showFooterHints: false,
		},
	};

	const lines = renderAskScreen({
		config,
		state,
		theme: plainTheme(),
		width: 22,
		editor: mockEditor(),
	});

	assert.equal(lines.at(-1), "──────────────────────");
	assert.equal(lines.join("\n").includes("? settings"), false);
	assert.equal(lines.join("\n").includes("Enter confirm"), false);
});

// Border tokens are part of the pi-native chrome contract.
test("frame rules use pi's border token without recoloring the title", () => {
	const state = createInitialState({
		title: "Demo",
		questions: [
			{ id: "q", prompt: "Pick", options: [{ value: "a", label: "A" }] },
		],
	});
	const calls: [string, string][] = [];
	const theme = {
		fg(color: string, text: string) {
			calls.push([color, text]);
			return text;
		},
		bg(_color: string, text: string) {
			return text;
		},
		bold(text: string) {
			return text;
		},
	} as never;
	const lines = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme,
		width: 40,
		editor: mockEditor(),
	});
	assert.equal(lines[0], "─".repeat(40));
	assert.equal(lines.at(-1), "─".repeat(40));
	assert.equal(calls.filter(([, text]) => text === "─".repeat(40)).length, 2);
	assert.ok(
		calls
			.filter(([, text]) => text === "─".repeat(40))
			.every(([color]) => color === "border")
	);
	assert.ok(
		calls.some(([color, text]) => color === "accent" && text.includes("Demo"))
	);
});

function footerLine(
	state: ReturnType<typeof createInitialState>,
	width: number
) {
	const lines = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme: plainTheme(),
		width,
		editor: mockEditor(),
	});
	// The footer sits between the blank separator and the closing rule.
	const rule = lines.length - 1;
	const blank = lines.lastIndexOf("", rule);
	return lines.slice(blank + 1, rule);
}

function footerState(type?: "multi") {
	return createInitialState({
		questions: [
			{
				id: "q1",
				label: "One",
				prompt: "One",
				...(type ? { type } : {}),
				options: [{ value: "a", label: "A" }],
			},
		],
	});
}

test("footer keeps the full hint list when it fits one line", () => {
	assert.deepEqual(footerLine(footerState(), 120), [
		" ↑↓ move · 1-9 pick · Tab question · Enter confirm · N/Shift+N note · T type · Esc dismiss · ? settings",
	]);
});

test("footer drops move, then pick, then type, then tab to stay on one line", () => {
	assert.deepEqual(footerLine(footerState(), 100), [
		" 1-9 pick · Tab question · Enter confirm · N/Shift+N note · T type · Esc dismiss · ? settings",
	]);
	assert.deepEqual(footerLine(footerState(), 90), [
		" Tab question · Enter confirm · N/Shift+N note · T type · Esc dismiss · ? settings",
	]);
	assert.deepEqual(footerLine(footerState(), 80), [
		" Tab question · Enter confirm · N/Shift+N note · Esc dismiss · ? settings",
	]);
	assert.deepEqual(footerLine(footerState(), 70), [
		" Enter confirm · N/Shift+N note · Esc dismiss · ? settings",
	]);
});

test("footer is one line at 100 and 80 columns in every context", () => {
	const multi = footerState("multi");
	let submit = footerState();
	submit = { ...submit, activeTabIndex: 1, view: { kind: "submit" } };
	const input = enterInputMode(footerState(), "q1");
	const note = enterQuestionNoteMode(footerState(), "q1");
	for (const state of [footerState(), multi, submit, input, note]) {
		for (const width of [100, 80]) {
			assert.equal(
				footerLine(state, width).length,
				1,
				`${state.view.kind} at ${width}`
			);
		}
	}
});

function previewScreen(
	width: number,
	rows: number | undefined,
	preview: string
) {
	const state = createInitialState({
		questions: [
			{
				id: "q1",
				prompt: "Choose a plan",
				type: "preview",
				options: [{ value: "a", label: "Plan A", preview }],
			},
		],
	});
	const viewport: AskViewport | undefined =
		rows === undefined
			? undefined
			: {
					rows,
					bodyRows: 0,
					optionStarts: [],
					reviewPageRows: 0,
					reviewScrollTop: 0,
					scrollTop: 0,
				};
	const lines = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme: plainTheme(),
		width,
		editor: mockEditor(),
		viewport,
	});
	const box = viewport?.mousePreview;
	return { lines, boxRows: box ? box.end - box.start : undefined };
}

for (const [layout, width, freeRows] of [
	["wide", 100, 22],
	["stacked", 50, 18],
] as const) {
	test(`${layout} tall preview shows all 40 lines without scroll hint`, () => {
		const { lines, boxRows } = previewScreen(
			width,
			70,
			Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join("\n")
		);
		assert.equal(boxRows, 44);
		assert(lines.some((line) => line.includes("line 40")));
		assert(!lines.some((line) => line.includes("above · ↓")));
	});

	test(`${layout} short preview does not pad to the terminal height`, () => {
		const { lines, boxRows } = previewScreen(width, 70, "one line");
		assert.equal(boxRows, 5);
		assert(lines.some((line) => line.includes("one line")));
	});

	test(`${layout} overflowing preview fills free rows and scrolls`, () => {
		const { lines, boxRows } = previewScreen(
			width,
			30,
			Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join("\n")
		);
		assert.equal(boxRows, freeRows);
		assert(
			lines.some(
				(line) => line.includes("↑ 0 above · ↓") && line.includes("more")
			)
		);
		assert(lines.some((line) => line.includes("Plan A")));
		assert(lines.some((line) => line.includes("Type your own")));
		assert.equal(lines.length, 30);
	});

	test(`${layout} short terminal retains preview minimum`, () => {
		const { boxRows } = previewScreen(
			width,
			15,
			Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join("\n")
		);
		assert.equal(boxRows, layout === "wide" ? 7 : 6);
	});
}

test("preview without viewport retains the 14-row fallback", () => {
	const { lines } = previewScreen(
		100,
		undefined,
		Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join("\n")
	);
	assert.equal(lines.filter((line) => line.includes("│")).length, 12);
	assert(lines.some((line) => line.includes("above · ↓")));
});

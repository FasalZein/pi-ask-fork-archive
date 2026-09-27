import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ASK_CONFIG } from "../src/config/defaults.ts";
import { createInitialState } from "../src/state/create.ts";
import { moveOption, moveTab } from "../src/state/transitions.ts";
import { getInputCommand } from "../src/ui/input.ts";
import { renderAskScreen } from "../src/ui/render.ts";

const theme = {
	fg: (_: string, value: string) => value,
	bg: (_: string, value: string) => value,
	bold: (value: string) => value,
} as never;
const editor = { getText: () => "", render: () => [] } as never;
const ABOVE_OPTIONS = /↑ \d+ more options above/;
const BELOW_ANSWERS = /↓ \d+ more below/;
const params = {
	title: "Demo",
	questions: [
		{
			id: "q",
			prompt: "Choose",
			options: Array.from({ length: 16 }, (_, index) => ({
				value: `${index + 1}`,
				label: `Option ${index + 1}`,
			})),
		},
	],
};

test("18-row ask keeps framing and focused option, with counts for hidden options", () => {
	let state = createInitialState(params);
	const viewport = {
		rows: 18,
		scrollTop: 0,
		reviewScrollTop: 0,
		reviewPageRows: 0,
		optionStarts: [] as number[],
		bodyRows: 0,
	};
	const initial = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme,
		width: 80,
		editor,
		viewport,
	});
	assert.equal(initial.length, 18);
	assert.ok(initial[0]?.includes("─"));
	assert.ok(initial[3]?.includes("Review"));
	assert.ok(initial.at(-2)?.includes("settings"));
	assert.ok(initial.at(-1)?.includes("─"));
	assert.ok(initial.join("\n").includes("↓ 11 more options below"));
	for (let index = 0; index < 11; index++) {
		state = moveOption(state, 1);
	}
	const lines = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme,
		width: 80,
		editor,
		viewport,
	});
	assert.equal(lines.length, 18);
	assert.ok(lines.join("\n").includes("▶ 12. Option 12"));
	assert.ok(lines.join("\n").includes("↑ 6 more options above"));
	assert.ok(lines.join("\n").includes("↓ 5 more options below"));
	assert.ok(lines.at(-2)?.includes("settings"));
});

test("a wrapped focused option remains fully visible", () => {
	const questions = [
		{
			id: "q",
			prompt: "Choose",
			options: Array.from({ length: 12 }, (_, index) => ({
				value: String(index),
				label: `Option ${index + 1}`,
				description: `Description ${index + 1}: ${"detail ".repeat(12)}`,
			})),
		},
	];
	let state = createInitialState({ questions });
	for (let index = 0; index < 8; index++) {
		state = moveOption(state, 1);
	}
	const viewport = {
		rows: 18,
		scrollTop: 0,
		reviewScrollTop: 0,
		reviewPageRows: 0,
		optionStarts: [] as number[],
		bodyRows: 0,
	};
	const lines = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme,
		width: 45,
		editor,
		viewport,
	});
	assert.equal(lines.length, 18);
	assert.ok(lines.join("\n").includes("▶ 9. Option 9"));
	assert.ok(lines.join("\n").includes("Description 9"));
	assert.ok(lines.at(-2)?.includes("settings"));
});

test("review body stays within 18 rows while its selected action stays visible", () => {
	const questions = Array.from({ length: 12 }, (_, index) => ({
		id: `q${index}`,
		prompt: `Question ${index}`,
		options: [{ value: "yes", label: "Yes" }],
	}));
	let state = createInitialState({ title: "Demo", questions });
	for (const _question of questions) {
		state = moveTab(state, 1);
	}
	const viewport = {
		rows: 18,
		scrollTop: 0,
		reviewScrollTop: 0,
		reviewPageRows: 0,
		optionStarts: [] as number[],
		bodyRows: 0,
	};
	const lines = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme,
		width: 80,
		editor,
		viewport,
	});
	assert.equal(lines.length, 18);
	assert.ok(lines.join("\n").includes(" ▶ 1. Submit"));
	assert.match(lines.join("\n"), BELOW_ANSWERS);
	assert.ok(lines.at(-2)?.includes("settings"));
});

test("review page shows later answers without losing the focused action", () => {
	const questions = Array.from({ length: 12 }, (_, index) => ({
		id: `q${index + 1}`,
		prompt: `Question ${index + 1}`,
		options: [{ value: "yes", label: "Yes" }],
	}));
	let state = createInitialState({ title: "Demo", questions });
	for (const _question of questions) {
		state = moveTab(state, 1);
	}
	const viewport = {
		rows: 18,
		scrollTop: 0,
		reviewScrollTop: 0,
		reviewPageRows: 0,
		optionStarts: [] as number[],
		bodyRows: 0,
	};
	const first = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme,
		width: 80,
		editor,
		viewport,
	});
	assert.ok(first.join("\n").includes("Q1"));
	viewport.reviewScrollTop = 100;
	const later = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme,
		width: 80,
		editor,
		viewport,
	});
	assert.equal(later.length, 18);
	assert.ok(later.join("\n").includes("Q12"));
	assert.ok(later.join("\n").includes(" ▶ 1. Submit"));
	assert.ok(later.join("\n").includes("more above"));
});

test("stacked review keeps focused actions visible while its answers scroll", () => {
	const questions = Array.from({ length: 12 }, (_, index) => ({
		id: `q${index + 1}`,
		prompt: `Question ${index + 1}`,
		options: [{ value: "yes", label: "Yes" }],
	}));
	let state = createInitialState({ title: "Demo", questions });
	for (const _question of questions) {
		state = moveTab(state, 1);
	}
	const viewport = {
		rows: 18,
		scrollTop: 0,
		reviewScrollTop: 0,
		reviewPageRows: 0,
		optionStarts: [] as number[],
		bodyRows: 0,
	};
	renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme,
		width: 45,
		editor,
		viewport,
	});
	viewport.reviewScrollTop = 100;
	const lines = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme,
		width: 45,
		editor,
		viewport,
	});
	assert.equal(lines.length, 18);
	assert.ok(lines.some((line) => line.includes(" Q12")));
	assert.ok(lines.join("\n").includes(" ▶ 1. Submit"));
	assert.ok(lines.join("\n").includes("more above"));
	assert.ok(lines.at(-2)?.includes("settings"));
});

test("page and preview bindings can be remapped, without changing dismiss", () => {
	const state = createInitialState(params);
	assert.deepEqual(getInputCommand(state, DEFAULT_ASK_CONFIG, "\x1b[1;2B"), {
		kind: "page",
		delta: 1,
	});
	assert.deepEqual(getInputCommand(state, DEFAULT_ASK_CONFIG, "\x1b[6~"), {
		kind: "page",
		delta: 1,
	});
	const config = {
		...DEFAULT_ASK_CONFIG,
		keymaps: {
			...DEFAULT_ASK_CONFIG.keymaps,
			main: { ...DEFAULT_ASK_CONFIG.keymaps.main, pageDown: ["ctrl+j"] },
		},
	};
	assert.deepEqual(getInputCommand(state, config, "\n"), {
		kind: "page",
		delta: 1,
	});
	assert.deepEqual(getInputCommand(state, config, "]"), {
		kind: "previewScroll",
		delta: 1,
	});
	assert.deepEqual(getInputCommand(state, config, "\u0003"), {
		kind: "dismiss",
	});
});

test("flow component pages by visible row height and accepts pi move aliases without pi cancel", async () => {
	const { runAskFlow } = await import("../src/ui/controller.ts");
	const { getAskConfigStore } = await import("../src/config/store.ts");
	getAskConfigStore().setConfig({
		...DEFAULT_ASK_CONFIG,
		keymaps: {
			...DEFAULT_ASK_CONFIG.keymaps,
			main: { ...DEFAULT_ASK_CONFIG.keymaps.main, pageDown: ["ctrl+j"] },
		},
	});
	let component:
		| { render(width: number): string[]; handleInput(data: string): void }
		| undefined;
	const flow = runAskFlow(
		{
			cwd: process.cwd(),
			mode: "tui",
			ui: {
				custom(factory: (...args: unknown[]) => unknown) {
					return new Promise((resolve) => {
						component = factory(
							{
								terminal: { rows: 18, columns: 80 },
								requestRender() {
									// The fake does not schedule terminal paints.
								},
							},
							theme,
							{
								matches(data: string, action: string) {
									return (
										(data === "j" && action === "tui.select.down") ||
										(data === "k" && action === "tui.select.confirm") ||
										(data === "z" && action === "tui.select.cancel")
									);
								},
							},
							resolve
						) as typeof component;
					});
				},
			},
		} as never,
		params,
		{ exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }) }
	);
	await new Promise((resolve) => setImmediate(resolve));
	assert.ok(component);
	component.render(80);
	component.handleInput("j");
	assert.ok(component.render(80).join("\n").includes("▶ 2. Option 2"));
	component.handleInput("z");
	assert.ok(component.render(80).join("\n").includes("▶ 2. Option 2"));
	component.handleInput("\n");
	const page = component.render(80).join("\n");
	// The one-line footer leaves one more visible option row, so the page lands one option later.
	assert.ok(page.includes("▶ 8. Option 8"));
	assert.match(page, ABOVE_OPTIONS);
	assert.ok(page.includes("Ctrl+J"));
	component.handleInput("k");
	assert.ok(component.render(80).join("\n").includes("Review answers"));
	component.handleInput("\u0003");
	component.handleInput("\u0003");
	const result = await flow;
	assert.equal(result.cancelled, true);
	getAskConfigStore().setConfig(DEFAULT_ASK_CONFIG);
});

test("long preview has its own bounded window and scroll offset", () => {
	const state = createInitialState({
		questions: [
			{
				id: "q",
				type: "preview",
				prompt: "Preview?",
				options: [
					{
						value: "a",
						label: "A",
						preview: Array.from(
							{ length: 30 },
							(_, index) => `line ${index + 1}`
						).join("\n"),
					},
				],
			},
		],
	});
	const first = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme,
		width: 80,
		editor,
		previewScrollTop: 0,
	}).join("\n");
	const next = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme,
		width: 80,
		editor,
		previewScrollTop: 1,
	}).join("\n");
	assert.ok(first.includes("line 1"));
	assert.ok(!first.includes("line 30"));
	assert.ok(next.includes("line 2"));
	assert.ok(!next.includes("line 1 "));
	assert.ok(next.includes("above"));
	assert.ok(next.includes("more"));
	const config = {
		...DEFAULT_ASK_CONFIG,
		keymaps: {
			...DEFAULT_ASK_CONFIG.keymaps,
			main: {
				...DEFAULT_ASK_CONFIG.keymaps.main,
				previewUp: ["ctrl+h"],
				previewDown: ["ctrl+l"],
			},
		},
	};
	const remapped = renderAskScreen({
		config,
		state,
		theme,
		width: 80,
		editor,
	}).join("\n");
	assert.ok(remapped.includes("Ctrl+H"));
	assert.ok(remapped.includes("Ctrl+L"));
	const viewport = {
		rows: 18,
		scrollTop: 0,
		reviewScrollTop: 0,
		reviewPageRows: 0,
		optionStarts: [] as number[],
		bodyRows: 0,
	};
	const short = renderAskScreen({
		config,
		state,
		theme,
		width: 80,
		editor,
		viewport,
		previewScrollTop: 100,
	});
	assert.equal(short.length, 18);
	assert.ok(short.join("\n").includes("▶ 1. A"));
	assert.ok(short.join("\n").includes("line 30"));
	assert.ok(short.join("\n").includes("Ctrl+H"));
	assert.ok(short.at(-2)?.includes("settings"));
});

test("review page key scrolls answers but leaves Submit visible", async () => {
	const { runAskFlow } = await import("../src/ui/controller.ts");
	const { getAskConfigStore } = await import("../src/config/store.ts");
	getAskConfigStore().setConfig(DEFAULT_ASK_CONFIG);
	const questions = Array.from({ length: 12 }, (_, index) => ({
		id: `q${index + 1}`,
		prompt: `Question ${index + 1}`,
		options: [{ value: "yes", label: "Yes" }],
	}));
	let component:
		| { render(width: number): string[]; handleInput(data: string): void }
		| undefined;
	const flow = runAskFlow(
		{
			cwd: process.cwd(),
			mode: "tui",
			ui: {
				custom(factory: (...args: unknown[]) => unknown) {
					return new Promise((resolve) => {
						component = factory(
							{
								terminal: { rows: 18, columns: 80 },
								requestRender() {
									// The fake does not schedule terminal paints.
								},
							},
							theme,
							{},
							resolve
						) as typeof component;
					});
				},
			},
		} as never,
		{ title: "Demo", questions },
		{ exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }) }
	);
	await new Promise((resolve) => setImmediate(resolve));
	assert.ok(component);
	for (const _question of questions) {
		component.handleInput("\t");
	}
	let lines = component.render(80);
	assert.ok(lines.join("\n").includes(" ▶ 1. Submit"));
	for (let index = 0; index < 20; index++) {
		component.handleInput("\x1b[6~");
	}
	lines = component.render(80);
	assert.equal(lines.length, 18);
	assert.ok(lines.some((line) => line.includes(" Q12")));
	assert.ok(lines.join("\n").includes(" ▶ 1. Submit"));
	assert.ok(lines.join("\n").includes("more above"));
	component.handleInput("\u0003");
	assert.equal((await flow).cancelled, true);
});

test("preview scroll keys move preview text without changing the focused option", async () => {
	const { runAskFlow } = await import("../src/ui/controller.ts");
	const { getAskConfigStore } = await import("../src/config/store.ts");
	getAskConfigStore().setConfig(DEFAULT_ASK_CONFIG);
	const questions = [
		{
			id: "q",
			type: "preview" as const,
			prompt: "Preview?",
			options: [
				{
					value: "a",
					label: "A",
					preview: Array.from(
						{ length: 30 },
						(_, index) => `line ${index + 1}`
					).join("\n"),
				},
			],
		},
	];
	let component:
		| { render(width: number): string[]; handleInput(data: string): void }
		| undefined;
	const flow = runAskFlow(
		{
			cwd: process.cwd(),
			mode: "tui",
			ui: {
				custom(factory: (...args: unknown[]) => unknown) {
					return new Promise((resolve) => {
						component = factory(
							{
								terminal: { rows: 24, columns: 80 },
								requestRender() {
									/* Fake terminal has no paint loop. */
								},
							},
							theme,
							{},
							resolve
						) as typeof component;
					});
				},
			},
		} as never,
		{ questions },
		{ exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }) }
	);
	await new Promise((resolve) => setImmediate(resolve));
	assert.ok(component);
	const first = component.render(80).join("\n");
	assert.ok(first.includes("line 1"));
	component.handleInput("]");
	const next = component.render(80).join("\n");
	assert.ok(next.includes("line 2"));
	assert.ok(!next.includes("line 1 "));
	assert.ok(next.includes("▶ 1. A"));
	component.handleInput("[");
	assert.ok(component.render(80).join("\n").includes("line 1"));
	for (let index = 0; index < 100; index++) {
		component.handleInput("]");
	}
	const end = component.render(80).join("\n");
	assert.ok(end.includes("line 30"));
	assert.ok(!end.includes("line 21 "));
	component.handleInput("[");
	assert.ok(component.render(80).join("\n").includes("line 23"));
	component.handleInput("\u0003");
	assert.equal((await flow).cancelled, true);
});

test("review with wrapped shortcut hint keeps all actions inside short viewport", () => {
	const questions = Array.from({ length: 12 }, (_, index) => ({
		id: `q${index + 1}`,
		label: `Question ${index + 1}`,
		prompt: "Choose",
		options: [{ value: "yes", label: "Yes" }],
	}));
	let state = createInitialState({ title: "Demo", questions });
	for (const _question of questions) {
		state = moveTab(state, 1);
	}
	const viewport = {
		rows: 18,
		scrollTop: 0,
		reviewScrollTop: 0,
		reviewPageRows: 0,
		optionStarts: [] as number[],
		bodyRows: 0,
	};
	const lines = renderAskScreen({
		config: DEFAULT_ASK_CONFIG,
		state,
		theme,
		width: 45,
		editor,
		viewport,
		reviewShortcutHint: "Press 1, 2, or 3 twice to confirm a review action.",
	});
	assert.equal(lines.length, 18);
	assert(lines.some((line) => line.includes("3. Cancel")));
	assert(lines.some((line) => line.includes("action.")));
	assert(lines.at(-1)?.includes("─"));
});

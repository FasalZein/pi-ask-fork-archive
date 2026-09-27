import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Editor } from "@earendil-works/pi-tui";
import { DEFAULT_ASK_CONFIG } from "../src/config/defaults.ts";
import { getAskConfigStore } from "../src/config/store.ts";
import { createInitialState } from "../src/state/create.ts";
import {
	applyNumberShortcut,
	enterQuestionNoteMode,
} from "../src/state/transitions.ts";
import { runAskFlow } from "../src/ui/controller.ts";
import { getInputCommand } from "../src/ui/input.ts";

const unusedExec: ExtensionAPI["exec"] = async () => ({
	stdout: "",
	stderr: "",
	code: 0,
	killed: false,
});

function inputState() {
	let state = createInitialState({
		questions: [
			{
				id: "q1",
				prompt: "Question?",
				options: [{ value: "a", label: "A" }],
			},
		],
	});
	state = applyNumberShortcut(state, 2);
	return state;
}

test("empty typing mode uses arrows and tab for navigation", () => {
	const input = inputState();

	assert.deepEqual(getInputCommand(input, DEFAULT_ASK_CONFIG, "\x1b[A", ""), {
		kind: "editMoveOption",
		delta: -1,
	});
	assert.deepEqual(getInputCommand(input, DEFAULT_ASK_CONFIG, "\x1b[B", ""), {
		kind: "editMoveOption",
		delta: 1,
	});
	assert.deepEqual(getInputCommand(input, DEFAULT_ASK_CONFIG, "\x1b[C", ""), {
		kind: "editMoveTab",
		delta: 1,
	});
	assert.deepEqual(getInputCommand(input, DEFAULT_ASK_CONFIG, "\x1b[D", ""), {
		kind: "editMoveTab",
		delta: -1,
	});
	assert.deepEqual(getInputCommand(input, DEFAULT_ASK_CONFIG, "\t", ""), {
		kind: "editMoveTab",
		delta: 1,
	});
	assert.deepEqual(getInputCommand(input, DEFAULT_ASK_CONFIG, "\x1b[Z", ""), {
		kind: "editMoveTab",
		delta: -1,
	});
});

test("non-empty typing mode keeps arrows and tab in editor", () => {
	const input = inputState();

	assert.deepEqual(getInputCommand(input, DEFAULT_ASK_CONFIG, "\x1b[A", "x"), {
		kind: "delegateToEditor",
	});
	assert.deepEqual(getInputCommand(input, DEFAULT_ASK_CONFIG, "\x1b[B", "x"), {
		kind: "delegateToEditor",
	});
	assert.deepEqual(getInputCommand(input, DEFAULT_ASK_CONFIG, "\x1b[C", "x"), {
		kind: "delegateToEditor",
	});
	assert.deepEqual(getInputCommand(input, DEFAULT_ASK_CONFIG, "\x1b[D", "x"), {
		kind: "delegateToEditor",
	});
	assert.deepEqual(getInputCommand(input, DEFAULT_ASK_CONFIG, "\t", "x"), {
		kind: "delegateToEditor",
	});
	assert.deepEqual(getInputCommand(input, DEFAULT_ASK_CONFIG, "\x1b[Z", "x"), {
		kind: "delegateToEditor",
	});
});

test("empty note editing mode uses arrows and tab for navigation", () => {
	const state = enterQuestionNoteMode(
		createInitialState({
			questions: [
				{
					id: "q1",
					prompt: "Question?",
					options: [{ value: "a", label: "A" }],
				},
			],
		}),
		"q1"
	);

	assert.deepEqual(getInputCommand(state, DEFAULT_ASK_CONFIG, "\x1b[A", ""), {
		kind: "editMoveOption",
		delta: -1,
	});
	assert.deepEqual(getInputCommand(state, DEFAULT_ASK_CONFIG, "\x1b[B", ""), {
		kind: "editMoveOption",
		delta: 1,
	});
	assert.deepEqual(getInputCommand(state, DEFAULT_ASK_CONFIG, "\x1b[C", ""), {
		kind: "editMoveTab",
		delta: 1,
	});
	assert.deepEqual(getInputCommand(state, DEFAULT_ASK_CONFIG, "\x1b[D", ""), {
		kind: "editMoveTab",
		delta: -1,
	});
	assert.deepEqual(getInputCommand(state, DEFAULT_ASK_CONFIG, "\t", ""), {
		kind: "editMoveTab",
		delta: 1,
	});
});

test("non-empty note editing mode keeps arrows and tab in editor", () => {
	const state = enterQuestionNoteMode(
		createInitialState({
			questions: [
				{
					id: "q1",
					prompt: "Question?",
					options: [{ value: "a", label: "A" }],
				},
			],
		}),
		"q1"
	);

	assert.deepEqual(getInputCommand(state, DEFAULT_ASK_CONFIG, "\x1b[A", "x"), {
		kind: "delegateToEditor",
	});
	assert.deepEqual(getInputCommand(state, DEFAULT_ASK_CONFIG, "\x1b[B", "x"), {
		kind: "delegateToEditor",
	});
	assert.deepEqual(getInputCommand(state, DEFAULT_ASK_CONFIG, "\x1b[C", "x"), {
		kind: "delegateToEditor",
	});
	assert.deepEqual(getInputCommand(state, DEFAULT_ASK_CONFIG, "\x1b[D", "x"), {
		kind: "delegateToEditor",
	});
	assert.deepEqual(getInputCommand(state, DEFAULT_ASK_CONFIG, "\t", "x"), {
		kind: "delegateToEditor",
	});
});

test("ctrl+c dismisses the flow from both navigation and editing modes", () => {
	const navigation = createInitialState({
		questions: [
			{
				id: "q1",
				prompt: "Question?",
				options: [{ value: "a", label: "A" }],
			},
		],
	});
	const input = inputState();
	const note = enterQuestionNoteMode(navigation, "q1");

	assert.deepEqual(getInputCommand(navigation, DEFAULT_ASK_CONFIG, "\u0003"), {
		kind: "dismiss",
	});
	assert.deepEqual(getInputCommand(input, DEFAULT_ASK_CONFIG, "\u0003"), {
		kind: "dismiss",
	});
	assert.deepEqual(getInputCommand(note, DEFAULT_ASK_CONFIG, "\u0003"), {
		kind: "dismiss",
	});
});

test("question mark opens ask settings outside non-empty editors", () => {
	const navigation = createInitialState({
		questions: [
			{
				id: "q1",
				prompt: "Question?",
				options: [{ value: "a", label: "A" }],
			},
		],
	});
	const input = inputState();

	assert.deepEqual(getInputCommand(navigation, DEFAULT_ASK_CONFIG, "?"), {
		kind: "showSettings",
	});
	assert.deepEqual(getInputCommand(input, DEFAULT_ASK_CONFIG, "?", ""), {
		kind: "showSettings",
	});
	assert.deepEqual(getInputCommand(input, DEFAULT_ASK_CONFIG, "?", "x"), {
		kind: "delegateToEditor",
	});
});

test("question type shortcut uses configured main keymap", () => {
	const state = createInitialState({
		questions: [
			{
				id: "q1",
				prompt: "Question?",
				options: [{ value: "a", label: "A" }],
			},
		],
	});
	const config = {
		...DEFAULT_ASK_CONFIG,
		keymaps: {
			...DEFAULT_ASK_CONFIG.keymaps,
			main: {
				...DEFAULT_ASK_CONFIG.keymaps.main,
				changeQuestionType: ["ctrl+t"],
			},
		},
	};

	assert.deepEqual(getInputCommand(state, DEFAULT_ASK_CONFIG, "t"), {
		kind: "changeQuestionType",
	});
	assert.deepEqual(getInputCommand(state, config, "\u0014"), {
		kind: "changeQuestionType",
	});
});

test("note shortcuts use n for option notes and Shift+N for question notes", () => {
	const navigation = createInitialState({
		questions: [
			{
				id: "q1",
				prompt: "Question?",
				options: [{ value: "a", label: "A" }],
			},
		],
	});

	assert.deepEqual(getInputCommand(navigation, DEFAULT_ASK_CONFIG, "n"), {
		kind: "openOptionNote",
	});
	assert.deepEqual(getInputCommand(navigation, DEFAULT_ASK_CONFIG, "N"), {
		kind: "openQuestionNote",
	});
});

test("custom configured editor submit shortcut is used at runtime", () => {
	const input = inputState();
	const config = {
		...DEFAULT_ASK_CONFIG,
		keymaps: {
			...DEFAULT_ASK_CONFIG.keymaps,
			editor: {
				...DEFAULT_ASK_CONFIG.keymaps.editor,
				submit: ["ctrl+k"],
			},
		},
	};

	assert.deepEqual(getInputCommand(input, config, "\u000b", "answer"), {
		kind: "editSubmit",
	});
	assert.deepEqual(getInputCommand(input, config, "\r", "answer"), {
		kind: "delegateToEditor",
	});
});

test("custom editor submit key controls actual editor submission", async () => {
	const config = {
		...DEFAULT_ASK_CONFIG,
		notifications: {
			...DEFAULT_ASK_CONFIG.notifications,
			enabled: false,
		},
		keymaps: {
			...DEFAULT_ASK_CONFIG.keymaps,
			editor: {
				...DEFAULT_ASK_CONFIG.keymaps.editor,
				submit: ["ctrl+k"],
			},
		},
	};
	getAskConfigStore().setConfig(config);
	let component: { handleInput(data: string): void } | undefined;
	const resultPromise = runAskFlow(
		{
			cwd: process.cwd(),
			mode: "tui",
			ui: {
				custom(callback: (...args: unknown[]) => unknown) {
					return new Promise((resolve) => {
						const tui = {
							requestRender() {
								// Rendering is not needed for this controller input test.
							},
						};
						component = callback(
							tui,
							plainTheme(),
							{},
							resolve
						) as typeof component;
					});
				},
			},
		} as never,
		{
			questions: [
				{
					id: "q1",
					prompt: "Question?",
					options: [{ value: "a", label: "A" }],
				},
			],
		},
		{ exec: unusedExec }
	);

	await new Promise((resolve) => setImmediate(resolve));
	component?.handleInput("2");
	component?.handleInput("x");
	component?.handleInput("\r");
	component?.handleInput("\u000b");
	component?.handleInput("\r");
	const result = await resultPromise;

	assert.equal(result.answers.q1?.customText, "x");
	getAskConfigStore().setConfig(DEFAULT_ASK_CONFIG);
});

function plainTheme() {
	return {
		bg(_color: string, text: string) {
			return text;
		},
		fg(_color: string, text: string) {
			return text;
		},
	};
}

test("ask flow forwards focus and invalidation to its editor", async () => {
	getAskConfigStore().setConfig({
		...DEFAULT_ASK_CONFIG,
		notifications: {
			...DEFAULT_ASK_CONFIG.notifications,
			enabled: false,
		},
	});
	const originalInvalidate = Editor.prototype.invalidate;
	let invalidateCalls = 0;
	Editor.prototype.invalidate = function patchedInvalidate(this: Editor) {
		invalidateCalls += 1;
		return originalInvalidate.call(this);
	};
	let component:
		| {
				focused: boolean;
				handleInput(data: string): void;
				invalidate(): void;
		  }
		| undefined;

	try {
		const resultPromise = runAskFlow(
			{
				cwd: process.cwd(),
				mode: "tui",
				ui: {
					custom(callback: (...args: unknown[]) => unknown) {
						return new Promise((resolve) => {
							component = callback(
								{
									requestRender() {
										// Rendering is not needed for this controller test.
									},
								},
								plainTheme(),
								{},
								resolve
							) as typeof component;
						});
					},
				},
			} as never,
			{
				questions: [
					{
						id: "q1",
						prompt: "Question?",
						options: [{ value: "a", label: "A" }],
					},
				],
			},
			{ exec: unusedExec }
		);

		await new Promise((resolve) => setImmediate(resolve));
		assert(component);
		component.focused = true;
		assert.equal(component.focused, true);
		component.focused = false;
		assert.equal(component.focused, false);
		component.invalidate();
		assert.equal(invalidateCalls, 1);
		component.handleInput("\x1b");
		const result = await resultPromise;
		assert.equal(result.cancelled, true);
		assert.equal(result.cancelReason, "user");
	} finally {
		Editor.prototype.invalidate = originalInvalidate;
		getAskConfigStore().setConfig(DEFAULT_ASK_CONFIG);
	}
});

test("custom configured note shortcuts are used at runtime", () => {
	const navigation = createInitialState({
		questions: [
			{
				id: "q1",
				prompt: "Question?",
				options: [{ value: "a", label: "A" }],
			},
		],
	});
	const config = {
		...DEFAULT_ASK_CONFIG,
		keymaps: {
			...DEFAULT_ASK_CONFIG.keymaps,
			main: {
				...DEFAULT_ASK_CONFIG.keymaps.main,
				optionNote: ["x"],
				questionNote: ["shift+x"],
			},
		},
	};

	assert.deepEqual(getInputCommand(navigation, config, "x"), {
		kind: "openOptionNote",
	});
	assert.deepEqual(getInputCommand(navigation, config, "X"), {
		kind: "openQuestionNote",
	});
});

test("review arrows move only between actions and number shortcuts keep action semantics", async () => {
	getAskConfigStore().setConfig({
		...DEFAULT_ASK_CONFIG,
		behaviour: {
			...DEFAULT_ASK_CONFIG.behaviour,
			doublePressReviewShortcuts: true,
		},
		notifications: { ...DEFAULT_ASK_CONFIG.notifications, enabled: false },
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
								terminal: { rows: 24, columns: 80 },
								requestRender() {
									// The test calls render directly.
								},
							},
							plainTheme(),
							{},
							resolve
						) as typeof component;
					});
				},
			},
		} as never,
		{
			questions: [
				{
					id: "first",
					label: "First",
					prompt: "First?",
					options: [{ value: "a", label: "A" }],
				},
				{
					id: "last",
					label: "Last",
					prompt: "Last?",
					options: [{ value: "b", label: "B" }],
				},
			],
		},
		{ exec: unusedExec }
	);
	try {
		await new Promise((resolve) => setImmediate(resolve));
		assert(component);
		component.handleInput("\t");
		component.handleInput("\t");
		component.handleInput("\x1b[A");
		assert(component.render(80).join("\n").includes(" ▶ 1. Submit"));
		component.handleInput("\x1b[B");
		const review = component.render(80).join("\n");
		assert(review.includes(" ▶ 2. Elaborate"));
		// Only the focused action carries the pointer; question rows are not focusable here.
		assert.equal(review.split("▶").length - 1, 1);
		component.handleInput("2");
		assert(
			component.render(80).join("\n").includes("Press 2 again to Elaborate")
		);
		component.handleInput("2");
		const result = await flow;
		assert.equal(result.mode, "elaborate");
	} finally {
		getAskConfigStore().setConfig(DEFAULT_ASK_CONFIG);
	}
});

test("ask editor uses pi's muted border theme when custom answer is open", async () => {
	getAskConfigStore().setConfig({
		...DEFAULT_ASK_CONFIG,
		notifications: { ...DEFAULT_ASK_CONFIG.notifications, enabled: false },
	});
	const colors: string[] = [];
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
								terminal: { rows: 30, columns: 80 },
								requestRender() {
									// This fake does not schedule terminal paints.
								},
							},
							{
								fg(color: string, text: string) {
									colors.push(color);
									return text;
								},
								bg(_color: string, text: string) {
									return text;
								},
								bold(text: string) {
									return text;
								},
							},
							{},
							resolve
						) as typeof component;
					});
				},
			},
		} as never,
		{
			questions: [
				{ id: "q", prompt: "Pick", options: [{ value: "a", label: "A" }] },
			],
		},
		{ exec: unusedExec }
	);
	await new Promise((resolve) => setImmediate(resolve));
	assert.ok(component);
	component.handleInput("2");
	component.render(80);
	assert.ok(colors.includes("borderMuted"));
	component.handleInput("\u0003");
	await flow;
});

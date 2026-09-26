import assert from "node:assert/strict";
import test from "node:test";
import { UI_DIMENSIONS } from "../src/constants/ui.ts";
import { createInitialState } from "../src/state/create.ts";
import {
	applyNumberShortcut,
	enterOptionNoteMode,
	enterQuestionNoteMode,
	saveNote,
} from "../src/state/transitions.ts";
import { renderSubmitScreen } from "../src/ui/render-submit.ts";

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

test("submit screen renders the compact action labels without extra prompt copy", () => {
	const state = createInitialState({
		questions: [
			{
				id: "q1",
				label: "Single",
				prompt: "Pick one primary demo style.",
				options: [{ value: "code", label: "Code demo" }],
			},
		],
	});

	const lines: string[] = [];
	renderSubmitScreen(
		lines,
		state,
		plainTheme(),
		UI_DIMENSIONS.submitWideMinWidth + 16
	);

	assert.equal(lines[0], " ▶ 1. Submit      Review answers");
	assert.equal(lines[1], "   2. Elaborate  ");
	assert.equal(lines[2], "   3. Cancel      Single");
	assert(!lines.join("\n").includes("Submit answers?"));
	assert(!lines.join("\n").includes("Submit answers"));
});

test("submit screen keeps review and actions grouped side by side on wide screens", () => {
	const state = createInitialState({
		questions: [
			{
				id: "q1",
				label: "Color",
				prompt: "Pick one color.",
				options: [{ value: "blue", label: "Blue" }],
			},
		],
	});

	const lines: string[] = [];
	renderSubmitScreen(
		lines,
		state,
		plainTheme(),
		UI_DIMENSIONS.submitWideMinWidth + 16
	);

	assert.deepEqual(lines, [
		" ▶ 1. Submit      Review answers",
		"   2. Elaborate  ",
		"   3. Cancel      Color",
		"                    → unanswered",
	]);
});

test("submit screen stacks review above actions on narrow screens", () => {
	const state = createInitialState({
		questions: [
			{
				id: "q1",
				label: "Color",
				prompt: "Pick one color.",
				options: [{ value: "blue", label: "Blue" }],
			},
		],
	});

	const lines: string[] = [];
	renderSubmitScreen(
		lines,
		state,
		plainTheme(),
		UI_DIMENSIONS.submitWideMinWidth - 14
	);

	assert.deepEqual(lines, [
		" Review answers",
		"",
		" Color",
		"   → unanswered",
		"",
		" ▶ 1. Submit",
		"   2. Elaborate",
		"   3. Cancel",
	]);
});

test("submit screen can show a review shortcut hint below the actions", () => {
	const state = createInitialState({
		questions: [
			{
				id: "q1",
				label: "Color",
				prompt: "Pick one color.",
				options: [{ value: "blue", label: "Blue" }],
			},
		],
	});

	const lines: string[] = [];
	renderSubmitScreen(
		lines,
		state,
		plainTheme(),
		UI_DIMENSIONS.submitWideMinWidth - 14,
		"Press 1, 2, or 3 twice to confirm a review action."
	);

	assert.equal(
		lines.includes(" Press 1, 2, or 3 twice to confirm a review"),
		true
	);
	assert.equal(lines.includes(" action."), true);
});

test("submit screen shows notes only for answered questions in submit mode", () => {
	let state = createInitialState({
		questions: [
			{
				id: "q1",
				label: "Single",
				prompt: "Pick one primary demo style.",
				options: [{ value: "code", label: "Code demo" }],
			},
			{
				id: "q2",
				label: "Multi",
				prompt: "Pick any extra things to include.",
				options: [{ value: "extra", label: "Extra" }],
			},
		],
	});

	state = enterQuestionNoteMode(state, "q1");
	state = saveNote(state, "Question note");
	state = applyNumberShortcut(state, 1);
	state = enterOptionNoteMode(state, "q1", "code");
	state = saveNote(state, "Option note");
	state = enterQuestionNoteMode(state, "q2");
	state = saveNote(state, "Second note");

	const lines: string[] = [];
	renderSubmitScreen(
		lines,
		state,
		plainTheme(),
		UI_DIMENSIONS.submitWideMinWidth + 76
	);

	const firstQuestionIndex = lines.findIndex((line) => line.includes("Single"));
	const firstQuestionNoteIndex = lines.findIndex((line) =>
		line.includes("Question note")
	);
	const firstAnswerIndex = lines.findIndex((line) =>
		line.includes("→ Code demo")
	);
	const optionNoteIndex = lines.findIndex((line) =>
		line.includes("Option note")
	);
	const secondQuestionIndex = lines.findIndex((line) => line.includes("Multi"));

	assert.notEqual(firstQuestionIndex, -1);
	assert.notEqual(firstQuestionNoteIndex, -1);
	assert.notEqual(firstAnswerIndex, -1);
	assert.notEqual(optionNoteIndex, -1);
	assert.notEqual(secondQuestionIndex, -1);
	assert(firstQuestionNoteIndex < firstAnswerIndex);
	assert(optionNoteIndex > firstAnswerIndex);
	assert(lines[firstQuestionNoteIndex]?.startsWith("     "));
	assert(lines[optionNoteIndex]?.startsWith("     "));
	assert.equal(lines[secondQuestionIndex - 1]?.trim(), "");
	assert(lines.some((line) => line.includes("Note:")));
	assert(!lines.some((line) => line.includes("Second note")));
	assert(!lines.some((line) => line.includes("Question note:")));
	assert(!lines.some((line) => line.includes("Code demo note:")));
	assert(!lines.some((line) => line.includes("Pick one primary demo style.")));
	assert(
		!lines.some((line) => line.includes("Pick any extra things to include."))
	);
});

test("submit screen shows all notes when elaborate action is selected", () => {
	let state = createInitialState({
		questions: [
			{
				id: "q1",
				label: "Single",
				prompt: "Pick one primary demo style.",
				options: [
					{ value: "code", label: "Code demo" },
					{ value: "slides", label: "Slides demo" },
				],
			},
			{
				id: "q2",
				label: "Multi",
				prompt: "Pick any extra things to include.",
				options: [{ value: "extra", label: "Extra" }],
			},
		],
	});

	state = enterQuestionNoteMode(state, "q1");
	state = saveNote(state, "Question note");
	state = applyNumberShortcut(state, 1);
	state = enterOptionNoteMode(state, "q1", "code");
	state = saveNote(state, "Selected option note");
	state = enterOptionNoteMode(state, "q1", "slides");
	state = saveNote(state, "Unselected option note");
	state = enterQuestionNoteMode(state, "q2");
	state = saveNote(state, "Second note");
	state = { ...state, activeSubmitActionIndex: 1 };

	const lines: string[] = [];
	renderSubmitScreen(
		lines,
		state,
		plainTheme(),
		UI_DIMENSIONS.submitWideMinWidth + 16
	);

	assert(lines.some((line) => line.includes("Question note")));
	assert(lines.some((line) => line.includes("Selected option note")));
	assert(lines.some((line) => line.includes("Unselected option note")));
	assert(lines.some((line) => line.includes("Slides demo Note:")));
	assert(lines.some((line) => line.includes("Second note")));
});

test("submit screen renders multi-select option notes under their related answers", () => {
	let state = createInitialState({
		questions: [
			{
				id: "q1",
				label: "Multi",
				prompt: "Pick extras",
				type: "multi",
				options: [
					{ value: "follow-up", label: "Follow-up action" },
					{ value: "docs", label: "Docs demo" },
				],
			},
		],
	});

	state = applyNumberShortcut(state, 1);
	state = applyNumberShortcut(state, 2);
	state = enterOptionNoteMode(state, "q1", "follow-up");
	state = saveNote(state, "First note");
	state = enterOptionNoteMode(state, "q1", "docs");
	state = saveNote(state, "Second note");

	const lines: string[] = [];
	renderSubmitScreen(
		lines,
		state,
		plainTheme(),
		UI_DIMENSIONS.submitWideMinWidth + 76
	);

	const firstAnswerIndex = lines.findIndex((line) =>
		line.includes("→ Follow-up action")
	);
	const firstNoteIndex = lines.findIndex((line) => line.includes("First note"));
	const secondAnswerIndex = lines.findIndex((line) =>
		line.includes("→ Docs demo")
	);
	const secondNoteIndex = lines.findIndex((line) =>
		line.includes("Second note")
	);

	assert.notEqual(firstAnswerIndex, -1);
	assert.notEqual(firstNoteIndex, -1);
	assert.notEqual(secondAnswerIndex, -1);
	assert.notEqual(secondNoteIndex, -1);
	assert(firstAnswerIndex < firstNoteIndex);
	assert(firstNoteIndex < secondAnswerIndex);
	assert(secondAnswerIndex < secondNoteIndex);
});

test("submit action column keeps all three actions on consecutive rows at the wide breakpoint", () => {
	const state = createInitialState({
		questions: [
			{
				id: "q1",
				label: "Color",
				prompt: "Pick one color.",
				options: [{ value: "blue", label: "Blue" }],
			},
		],
	});

	const lines: string[] = [];
	renderSubmitScreen(
		lines,
		state,
		plainTheme(),
		UI_DIMENSIONS.submitWideMinWidth
	);

	assert.equal(lines[0], " ▶ 1. Submit      Review answers");
	assert.equal(lines[1], "   2. Elaborate  ");
	assert.equal(lines[2], "   3. Cancel      Color");
	assert.equal(lines[3], "                    → unanswered");
});

test("note-only questions stay unanswered while Elaborate shows their notes", () => {
	let state = createInitialState({
		questions: [
			{
				id: "q1",
				label: "Name",
				prompt: "Name?",
				options: [{ value: "a", label: "A" }],
			},
		],
	});
	state = enterQuestionNoteMode(state, "q1");
	state = saveNote(state, "Need examples");
	state = { ...state, activeSubmitActionIndex: 1 };
	const lines: string[] = [];
	renderSubmitScreen(lines, state, plainTheme(), 80);
	assert.deepEqual(lines, [
		"   1. Submit      Review answers",
		" ▶ 2. Elaborate  ",
		"   3. Cancel      Name",
		"                      Note: Need examples",
		"                    → unanswered",
	]);
});

// Colors match upstream v1.2.0 output for the same state: accent title and
// focused action, success answers, a Note: label before muted note text, and a
// dim unanswered marker.
test("review colors answers, notes, and unanswered questions as upstream", () => {
	let state = createInitialState({
		questions: [
			{
				id: "ui",
				label: "UI",
				prompt: "Which UI work first?",
				options: [{ value: "fix", label: "Fix the two bugs" }],
			},
			{
				id: "live",
				label: "Live pi",
				prompt: "Run a live pi check?",
				options: [{ value: "yes", label: "Yes" }],
			},
		],
	});
	state = enterQuestionNoteMode(state, "ui");
	state = saveNote(state, "Prefer the new look");
	state = applyNumberShortcut(state, 1);
	const theme = {
		fg(color: string, text: string) {
			return `<${color}>${text}</>`;
		},
		bg(_color: string, text: string) {
			return text;
		},
		bold(text: string) {
			return text;
		},
	} as never;
	const lines: string[] = [];
	renderSubmitScreen(lines, state, theme, 60);
	assert.deepEqual(lines, [
		" <accent>Review answers</>",
		"",
		" <text>UI</>",
		"     <syntaxString>Note:</> <muted>Prefer the new look</>",
		"   <success>→ Fix the two bugs</>",
		"",
		" <text>Live pi</>",
		"   <dim>→ unanswered</>",
		"",
		" ▶ <accent>1. Submit</>",
		"   <text>2. Elaborate</>",
		"   <text>3. Cancel</>",
	]);
});

test("short terminals scroll review answers under a fixed title and keep actions", () => {
	const questions = Array.from({ length: 12 }, (_, index) => ({
		id: `q${index + 1}`,
		label: `Question ${index + 1}`,
		prompt: "Choose",
		options: [{ value: "yes", label: "Yes" }],
	}));
	let state = createInitialState({ questions });
	state = {
		...state,
		activeTabIndex: questions.length,
		view: { kind: "submit" },
	};
	const reviewWindow = { reviewPageRows: 0, reviewScrollTop: 0 };
	const lines: string[] = [];
	renderSubmitScreen(
		lines,
		state,
		plainTheme(),
		UI_DIMENSIONS.submitWideMinWidth + 16,
		undefined,
		undefined,
		reviewWindow,
		10
	);
	assert.deepEqual(lines, [
		" ▶ 1. Submit      Review answers",
		"   2. Elaborate  ",
		"   3. Cancel      Question 1",
		"                    → unanswered",
		"                 ",
		"                  Question 2",
		"                    → unanswered",
		"                 ",
		"                  Question 3",
		"                  ↓ 9 more below · Shift+↓",
	]);
	assert.equal(reviewWindow.reviewPageRows, 7);

	reviewWindow.reviewScrollTop = 100;
	const scrolled: string[] = [];
	renderSubmitScreen(
		scrolled,
		state,
		plainTheme(),
		UI_DIMENSIONS.submitWideMinWidth + 16,
		undefined,
		undefined,
		reviewWindow,
		10
	);
	assert.equal(scrolled[0], " ▶ 1. Submit      Review answers");
	assert.equal(scrolled[1], "   2. Elaborate   ↑ 10 more above · Shift+↑");
	assert.equal(scrolled.at(-3), "                  Question 12");
	assert.equal(scrolled.length, 10);
});

import { truncateToWidth } from "@earendil-works/pi-tui";
import { UI_TEXT } from "../constants/ui.ts";
import type { AskState } from "../types.ts";
import {
	mergeColumns,
	pushSavedNote,
	pushWrappedText,
} from "./render-helpers.ts";
import type { Theme } from "./render-types.ts";
import {
	buildReviewScreenModel,
	type ReviewQuestionModel,
	type ReviewScreenModel,
} from "./view-models/review.ts";

/** Scroll state for the review answers on short terminals. */
interface ReviewWindow {
	mouseReview?: { start: number; end: number; maxTop: number };
	reviewPageRows: number;
	reviewScrollTop: number;
}
type RowCallback = (index: number, start: number, end: number) => void;
interface PageKeys {
	down: string;
	up: string;
}
interface ReviewColumn {
	/** Row range of the scrollable answers inside the column, if they scroll. */
	answers?: { start: number; end: number; maxTop: number };
	lines: string[];
}

// The "more above" indicator reuses the blank row under the title.
const INDICATOR_ROWS = 2;
// Title, both indicators, and at least one answer row.
const MIN_REVIEW_ROWS = 4;

export function renderSubmitScreen(
	lines: string[],
	state: AskState,
	theme: Theme,
	width: number,
	reviewShortcutHint?: string,
	onActionRow?: RowCallback,
	reviewWindow?: ReviewWindow,
	availableRows = Number.POSITIVE_INFINITY,
	pageKeys: PageKeys = { up: "Shift+↑", down: "Shift+↓" }
) {
	const model = buildReviewScreenModel(state, width);
	const hintLines = renderReviewShortcutHint(reviewShortcutHint, theme, width);
	const offset = lines.length;
	const wide = model.layout === "wide";
	const actionWidth = wide ? model.actionColumnWidth : width;
	const actionLines = renderSubmitActions(model, theme, actionWidth);
	const { room, separator } = planReviewRoom({
		availableRows,
		hintLines,
		reservedRows: wide ? 0 : actionLines.length,
		separator: !wide,
		windowed: reviewWindow !== undefined,
	});

	const review = renderReviewColumn(
		model,
		theme,
		wide ? Math.max(1, width - actionWidth - 2) : width,
		wide ? Math.max(room, actionLines.length) : room,
		reviewWindow,
		pageKeys
	);
	if (wide) {
		lines.push(...mergeColumns(actionLines, review.lines, actionWidth, width));
		reportActionRows(model, offset, onActionRow);
	} else {
		lines.push(...review.lines, ...(separator ? [""] : []));
		reportActionRows(model, lines.length, onActionRow);
		lines.push(...actionLines);
	}
	reportReviewRegion(reviewWindow, review, offset);
	lines.push(...hintLines);
}

/**
 * Rows left for the review answers. Stacked layouts spend one separator row
 * between the answers and actions. On very short terminals, the blank spacer
 * rows go to the answers first; `hintLines` loses its leading blank in place.
 */
function planReviewRoom(args: {
	availableRows: number;
	hintLines: string[];
	reservedRows: number;
	separator: boolean;
	windowed: boolean;
}): { room: number; separator: boolean } {
	const { hintLines, windowed } = args;
	let separator = args.separator;
	let room =
		args.availableRows -
		hintLines.length -
		args.reservedRows -
		(separator ? 1 : 0);
	if (windowed && room < MIN_REVIEW_ROWS && hintLines[0] === "") {
		hintLines.shift();
		room++;
	}
	if (windowed && room < MIN_REVIEW_ROWS && separator) {
		separator = false;
		room++;
	}
	return { room, separator };
}

function reportActionRows(
	model: ReviewScreenModel,
	offset: number,
	onActionRow?: RowCallback
) {
	// Action labels are short and never wrap, so each action owns one row.
	for (const index of model.actions.keys()) {
		onActionRow?.(index, offset + index, offset + index + 1);
	}
}

function reportReviewRegion(
	reviewWindow: ReviewWindow | undefined,
	review: ReviewColumn,
	offset: number
) {
	if (reviewWindow && review.answers) {
		reviewWindow.mouseReview = {
			start: offset + review.answers.start,
			end: offset + review.answers.end,
			maxTop: review.answers.maxTop,
		};
	}
}

function renderReviewColumn(
	model: ReviewScreenModel,
	theme: Theme,
	width: number,
	maxRows: number,
	reviewWindow: ReviewWindow | undefined,
	pageKeys: PageKeys
): ReviewColumn {
	const title: string[] = [];
	pushWrappedText(title, UI_TEXT.reviewTitle, width, theme, "accent", " ", " ");
	const answers: string[] = [];
	const starts: number[] = [];
	for (const [index, question] of model.questions.entries()) {
		starts.push(answers.length);
		renderReviewQuestion(answers, question, theme, width);
		if (index < model.questions.length - 1) {
			answers.push("");
		}
	}

	if (!reviewWindow || title.length + 1 + answers.length <= maxRows) {
		if (reviewWindow) {
			reviewWindow.reviewScrollTop = 0;
			reviewWindow.reviewPageRows = answers.length;
		}
		return { lines: [...title, "", ...answers] };
	}

	// Scroll the answers between two indicator rows under a fixed title. The
	// title, then the indicators, give way when the terminal is too short.
	const titleLines = maxRows >= title.length + MIN_REVIEW_ROWS - 1 ? title : [];
	const indicators = maxRows - titleLines.length >= 3;
	const rows = Math.max(
		1,
		maxRows - titleLines.length - (indicators ? INDICATOR_ROWS : 0)
	);
	const maxTop = Math.max(0, answers.length - rows);
	const top = Math.max(0, Math.min(reviewWindow.reviewScrollTop, maxTop));
	reviewWindow.reviewScrollTop = top;
	reviewWindow.reviewPageRows = rows;
	const above = starts.filter((start) => start < top).length;
	const below = starts.filter((start) => start >= top + rows).length;
	const indicator = (text: string) =>
		indicators ? [truncateToWidth(theme.fg("dim", text), width)] : [];
	const start = titleLines.length + (indicators ? 1 : 0);
	return {
		answers: { start, end: start + rows, maxTop },
		lines: [
			...titleLines,
			...indicator(above ? ` ↑ ${above} more above · ${pageKeys.up}` : ""),
			...answers.slice(top, top + rows),
			...indicator(below ? ` ↓ ${below} more below · ${pageKeys.down}` : ""),
		],
	};
}

function renderReviewQuestion(
	lines: string[],
	question: ReviewQuestionModel,
	theme: Theme,
	width: number
) {
	pushWrappedText(lines, question.label, width, theme, "text", " ", " ");
	// A note-only question stays unanswered, but Elaborate still shows its note.
	if (question.note) {
		pushSavedNote({
			lines,
			note: question.note,
			width,
			theme,
			indent: "     ",
		});
	}
	if (question.unanswered) {
		lines.push(
			truncateToWidth(`   ${theme.fg("dim", UI_TEXT.unanswered)}`, width)
		);
		return;
	}

	for (const selection of question.selections ?? []) {
		pushWrappedText(
			lines,
			`→ ${selection.label}`,
			width,
			theme,
			"success",
			"   ",
			"     "
		);
		if (selection.note) {
			pushSavedNote({
				lines,
				note: selection.note,
				width,
				theme,
				indent: "     ",
			});
		}
	}

	if (question.answerText) {
		pushWrappedText(
			lines,
			`→ ${question.answerText}`,
			width,
			theme,
			question.isCustomOnly ? "text" : "success",
			"   ",
			"     "
		);
	}

	for (const optionNote of question.extraOptionNotes ?? []) {
		pushSavedNote({
			lines,
			note: optionNote.note,
			width,
			theme,
			indent: "     ",
			label: optionNote.label,
		});
	}
}

function renderSubmitActions(
	model: ReviewScreenModel,
	theme: Theme,
	width: number
): string[] {
	const lines: string[] = [];
	for (const [index, action] of model.actions.entries()) {
		const prefix = action.selected ? UI_TEXT.cursor : UI_TEXT.cursorBlank;
		pushWrappedText(
			lines,
			`${index + 1}. ${action.label}`,
			width,
			theme,
			action.selected ? "accent" : "text",
			prefix,
			prefix
		);
	}
	return lines;
}

function renderReviewShortcutHint(
	hint: string | undefined,
	theme: Theme,
	width: number
): string[] {
	const lines: string[] = [];
	if (hint) {
		lines.push("");
		pushWrappedText(lines, hint, width, theme, "dim", " ", " ");
	}
	return lines;
}

import type { AskConfig } from "../config/schema.ts";
import { formatKeybindingLabel } from "../constants/keymaps.ts";
import {
	getCurrentQuestion,
	getRenderableOptions,
	isSubmitTab,
} from "../state/selectors.ts";
import type { AskState } from "../types.ts";

import { renderFrameFooter, renderFrameHeader } from "./render-frame.ts";
import { renderQuestionScreen } from "./render-question.ts";
import { renderSubmitScreen } from "./render-submit.ts";
import type { QuestionRenderContext, Theme } from "./render-types.ts";

const UP_SUFFIX = /Up$/;
const DOWN_SUFFIX = /Down$/;

export interface AskViewport {
	bodyRows: number;
	followFocus?: boolean;
	/** Mouse hit regions in component-local coordinates, refreshed by render. */
	mouseList?: { start: number; end: number; maxTop: number };
	mousePreview?: { x: number; start: number; end: number; maxTop: number };
	mouseReview?: { start: number; end: number; maxTop: number };
	/** Filled from rendered option/action row positions for page-key navigation. */
	optionStarts: number[];
	reviewPageRows: number;
	reviewScrollTop: number;
	rows: number;
	scrollTop: number;
}

export function renderAskScreen(args: {
	config: AskConfig;
	footerNotice?: string;
	reviewShortcutHint?: string;
	state: AskState;
	theme: Theme;
	width: number;
	editor: QuestionRenderContext["editor"];
	viewport?: AskViewport;
	previewScrollTop?: number;
	onPreviewScrollTop?: (top: number) => void;
}): string[] {
	const { config, footerNotice, reviewShortcutHint, state, theme, width } =
		args;
	const pageKeys = pagingLabels(config);
	const header: string[] = [];
	const body: string[] = [];
	const footer = renderAskFooter(config, footerNotice, state, theme, width);
	const starts: number[] = [];
	let focusStart = 0;
	let focusEnd = 1;
	const trackRow = (index: number, start: number, end: number) => {
		starts[index] = start;
		if (
			index ===
			(isSubmitTab(state)
				? state.activeSubmitActionIndex
				: state.activeOptionIndex)
		) {
			focusStart = start;
			focusEnd = end;
		}
	};
	renderFrameHeader({ lines: header, state, theme, width });
	if (args.viewport) {
		args.viewport.mouseList = undefined;
		args.viewport.mouseReview = undefined;
		args.viewport.mousePreview = undefined;
	}
	if (isSubmitTab(state)) {
		renderSubmitScreen(
			body,
			state,
			theme,
			width,
			reviewShortcutHint,
			trackRow,
			args.viewport,
			args.viewport
				? Math.max(1, args.viewport.rows - header.length - footer.length)
				: undefined,
			pageKeys
		);
	} else {
		renderQuestionBody(
			args,
			body,
			header.length + footer.length,
			trackRow,
			starts
		);
		if (args.viewport && starts.length > 0) {
			// Keep the prompt and multi-selection count visible while options page.
			const introRows = starts[0];
			movePreviewRegion(args.viewport, -introRows);
			header.push(...body.splice(0, introRows));
			for (let index = 0; index < starts.length; index++) {
				starts[index] -= introRows;
			}
			focusStart -= introRows;
			focusEnd -= introRows;
		}
	}

	return windowAskBody({
		viewport: args.viewport,
		header,
		body,
		footer,
		theme,
		state,
		starts,
		pageKeys,
		focusStart,
		focusEnd,
	});
}

function renderQuestionBody(
	args: Parameters<typeof renderAskScreen>[0],
	body: string[],
	frameRows: number,
	trackRow: (index: number, start: number, end: number) => void,
	starts: number[]
) {
	const { state, config, theme, width, editor } = args;
	const question = getCurrentQuestion(state);
	if (!question) {
		return;
	}
	const options = getRenderableOptions(question);

	let previewBoxRows = 0;
	let previewEffectiveTop = 0;
	let previewMaxTop = 0;
	const renderQuestion = (previewMaxRows = 14) =>
		renderQuestionScreen({
			lines: body,
			state,
			question,
			options,
			theme,
			width,
			editor,
			onOptionRow: trackRow,
			previewScrollTop: args.previewScrollTop,
			previewScrollHint: `${formatKeybindingLabel(config.keymaps.main.previewUp[0] ?? "[")} ${formatKeybindingLabel(config.keymaps.main.previewDown[0] ?? "]")}`,
			previewMaxRows,
			onPreviewBox: (rows, x, start) => {
				previewBoxRows = rows;
				if (args.viewport) {
					args.viewport.mousePreview = {
						x,
						start,
						end: start + rows,
						maxTop: previewMaxTop,
					};
				}
			},
			onPreviewScrollTop: (top, maxTop) => {
				previewEffectiveTop = top;
				previewMaxTop = maxTop;
			},
		});
	// Render at terminal height first so short content stays short. Then fit the
	// actual box against the frame and the other question rows.
	let previewMaxRows = args.viewport?.rows ?? 14;
	renderQuestion(previewMaxRows);
	if (args.viewport && previewBoxRows > 0) {
		const available = args.viewport.rows - frameRows;
		// Wrapped scroll hints can add a row after the first reduction.
		while (body.length > available && previewMaxRows > 6) {
			previewMaxRows = Math.max(6, previewMaxRows - (body.length - available));
			body.length = 0;
			starts.length = 0;
			renderQuestion(previewMaxRows);
		}
	}
	args.onPreviewScrollTop?.(previewEffectiveTop);
}

function renderAskFooter(
	config: AskConfig,
	footerNotice: string | undefined,
	state: AskState,
	theme: Theme,
	width: number
): string[] {
	const lines: string[] = [];
	renderFrameFooter({ config, footerNotice, lines, state, theme, width });
	return lines;
}

function windowAskBody(args: {
	viewport?: AskViewport;
	header: string[];
	body: string[];
	footer: string[];
	theme: Theme;
	state: AskState;
	starts: number[];
	pageKeys: { up: string; down: string };
	focusStart: number;
	focusEnd: number;
}): string[] {
	const {
		viewport,
		header,
		body,
		footer,
		theme,
		state,
		starts,
		pageKeys,
		focusStart,
		focusEnd,
	} = args;
	if (!viewport) {
		return [...header, ...body, ...footer];
	}
	viewport.optionStarts = starts;
	moveReviewRegion(viewport, header.length);
	const available = Math.max(1, viewport.rows - header.length - footer.length);
	viewport.bodyRows = available;
	if (body.length <= available) {
		viewport.scrollTop = 0;
		setListRegion(viewport, state, header.length, body.length, 0);
		movePreviewRegion(viewport, header.length);
		return [...header, ...body, ...footer];
	}
	// Reserve both indicator rows so the body and fixed footer never move as focus changes.
	const pageSize = Math.max(1, available - 2);
	const maxTop = Math.max(0, body.length - pageSize);
	// The review pane's own hit region is only valid when the body is not paged.
	viewport.mouseReview = undefined;
	const top = getQuestionWindowTop(
		viewport,
		focusStart,
		focusEnd,
		pageSize,
		maxTop
	);
	viewport.scrollTop = top;
	viewport.bodyRows = pageSize;
	setListRegion(viewport, state, header.length + 1, pageSize, maxTop);
	movePreviewRegion(viewport, header.length + 1 - top);
	const above = starts.filter((start) => start < top).length;
	const below = starts.filter((start) => start >= top + pageSize).length;
	const noun = isSubmitTab(state) ? "actions" : "options";
	const up = above ? `   ↑ ${above} more ${noun} above · ${pageKeys.up}` : "";
	const down = below
		? `   ↓ ${below} more ${noun} below · ${pageKeys.down}`
		: "";
	return [
		...header,
		theme.fg("dim", up),
		...body.slice(top, top + pageSize),
		theme.fg("dim", down),
		...footer,
	];
}

function setListRegion(
	viewport: AskViewport,
	state: AskState,
	start: number,
	rows: number,
	maxTop: number
) {
	if (!isSubmitTab(state)) {
		viewport.mouseList = { start, end: start + rows, maxTop };
	}
}

function movePreviewRegion(viewport: AskViewport, offset: number) {
	if (viewport.mousePreview) {
		viewport.mousePreview.start += offset;
		viewport.mousePreview.end += offset;
	}
}

function moveReviewRegion(viewport: AskViewport, offset: number) {
	if (viewport.mouseReview) {
		viewport.mouseReview.start += offset;
		viewport.mouseReview.end += offset;
	}
}

function getQuestionWindowTop(
	viewport: AskViewport,
	focusStart: number,
	focusEnd: number,
	pageSize: number,
	maxTop: number
): number {
	let top = Math.max(0, Math.min(viewport.scrollTop, maxTop));
	// Wheel scrolling suspends focus-follow until the next key press.
	if (viewport.followFocus === false) {
		return top;
	}
	if (focusEnd - focusStart > pageSize || focusStart < top) {
		top = focusStart;
	} else if (focusEnd > top + pageSize) {
		top = Math.min(maxTop, focusEnd - pageSize);
	}
	return top;
}

function pageKeyLabel(key: string): string {
	return formatKeybindingLabel(key)
		.replace(UP_SUFFIX, "↑")
		.replace(DOWN_SUFFIX, "↓");
}

function pagingLabels(config: AskConfig) {
	return {
		up: pageKeyLabel(config.keymaps.main.pageUp[0] ?? "shift+up"),
		down: pageKeyLabel(config.keymaps.main.pageDown[0] ?? "shift+down"),
	};
}

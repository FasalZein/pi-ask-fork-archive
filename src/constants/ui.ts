export const UI_DIMENSIONS = {
	boxMinWidth: 10,
	callLabelTruncateWidth: 50,
	editorContentPadding: 5,
	editorIndentedPadding: 7,
	editorMinWidth: 8,
	previewWideMinWidth: 90,
	previewMinRightWidth: 24,
	previewLeftMinWidth: 22,
	previewLeftMaxWidth: 34,
	previewLeftRatio: 0.34,
	submitWideMinWidth: 64,
	submitMinReviewWidth: 24,
} as const;

export const UI_TEXT = {
	// One focus pointer for option rows and review actions; unfocused rows pad to the same width.
	cursor: " ▶ ",
	cursorBlank: "   ",
	recommendedMarker: "(recommended)",
	questionNoteTitle: "Note:",
	reviewTitle: "Review answers",
	unanswered: "→ unanswered",
	editorPlaceholderInput: "Type answer...",
	editorPlaceholderNote: "Add a note...",
} as const;

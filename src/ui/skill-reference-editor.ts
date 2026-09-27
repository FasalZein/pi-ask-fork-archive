import { Editor, matchesKey } from "@earendil-works/pi-tui";
import { SKILL_COMPLETION_PREFIX } from "./autocomplete.ts";

const AT_FILE_TOKEN = /@(?:"[^"]*|[^\s"']*)$/u;

// pi-tui only opens slash completion at the start of the first line. Ask notes
// and custom answers need the same menu after prose and on later lines.
export class SkillReferenceEditor extends Editor {
	private tabRequestedCompletion = false;

	override handleInput(data: string): void {
		const menuOpen = this.isShowingAutocomplete();
		if (matchesKey(data, "tab") && !menuOpen) {
			this.tabRequestedCompletion = true;
		}
		if (matchesKey(data, "enter") && menuOpen && !this.tabRequestedCompletion) {
			const { line, col } = this.getCursor();
			const before = (this.getLines()[line] ?? "").slice(0, col);
			if (!AT_FILE_TOKEN.test(before)) {
				// pi-tui applies menu selections on Enter before submitting. Cancel
				// automatic menus through the public API to keep the typed text.
				this.setText(this.getText());
			}
		}
		const previousText = this.getText();
		super.handleInput(data);
		if (this.getText() === previousText) {
			return;
		}
		this.tabRequestedCompletion = false;
		const { line, col } = this.getCursor();
		const before = (this.getLines()[line] ?? "").slice(0, col);
		if (!SKILL_COMPLETION_PREFIX.test(before)) {
			return;
		}
		// Private in pi-tui 0.84.1-0.87.1: no public request-menu API exists.
		// If a later pi-tui renames it, skip the mid-line menu instead of throwing
		// on every keystroke; line-start completion still works through pi-tui.
		const trigger: unknown = Reflect.get(this, "tryTriggerAutocomplete");
		if (typeof trigger === "function") {
			trigger.call(this);
		}
	}
}

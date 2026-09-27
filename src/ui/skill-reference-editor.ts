import { Editor, matchesKey } from "@earendil-works/pi-tui";
import { SKILL_COMPLETION_PREFIX } from "./autocomplete.ts";

// pi-tui only opens slash completion at the start of the first line. Ask notes
// and custom answers need the same menu after prose and on later lines.
export class SkillReferenceEditor extends Editor {
	override handleInput(data: string): void {
		if (matchesKey(data, "enter") && this.isShowingAutocomplete()) {
			const { line, col } = this.getCursor();
			const before = (this.getLines()[line] ?? "").slice(0, col);
			const token = SKILL_COMPLETION_PREFIX.exec(before)?.[2];
			if (token && !token.startsWith("/skill:")) {
				// pi-tui applies slash selections on Enter before submitting. Preserve
				// literal text instead; setText cancels the menu through its public API.
				this.setText(this.getText());
			}
		}
		const previousText = this.getText();
		super.handleInput(data);
		if (this.getText() === previousText) {
			return;
		}
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

import {
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { DEFAULT_ASK_CONFIG, normalizeAskConfig } from "../config/defaults.ts";
import type { AskConfig } from "../config/schema.ts";
import type { AskConfigNotice } from "../config/store.ts";
import {
	getAskContextBindings,
	matchesBinding,
	renderSettingsFooterKeymaps,
} from "../constants/keymaps.ts";
import { UI_TEXT } from "../constants/ui.ts";

interface Theme {
	bg(color: string, text: string): string;
	fg(color: string, text: string): string;
}

interface TuiLike {
	requestRender(): void;
	terminal: { rows: number };
}

interface AskSettingsListOptions {
	configPath: string;
	notice?: AskConfigNotice;
	onClose: () => void;
	onSave: (config: AskConfig) => Promise<AskConfig>;
	savedConfig: AskConfig;
	tui: TuiLike;
}

const DESCRIPTION_LINE_COUNT = 3;
// Rows start with one column of padding, then the cursor slot.
const ROW_INDENT = "   ";
const COMPACT_WIDTH = 40;
const MIN_ROWS_WITH_CUES = 3;
const RESET_CONFIRMATION_MS = 2000;
const OVERLAY_HEIGHT_FRACTION = 0.9;

type SettingSection = "Actions" | "Defaults for future asks" | "Live settings";
type ToggleSettingKey = keyof AskConfig["behaviour"] | "notifications.enabled";

interface BaseSetting {
	description: string;
	label: string;
	section: SettingSection;
}

interface ActionSetting extends BaseSetting {
	key: "resetConfig";
	type: "action";
}

interface ToggleSetting extends BaseSetting {
	key: ToggleSettingKey;
	type: "toggle";
}

type Setting = ActionSetting | ToggleSetting;

const SETTINGS = [
	{
		description:
			"Auto-submit completed ask flows when no question or option notes were added.",
		key: "autoSubmitWhenAnsweredWithoutNotes",
		section: "Live settings",
		label: "Auto-submit when answered without notes",
		type: "toggle",
	},
	{
		description:
			"Require a second cancel or dismiss action before discarding answered or drafted ask content.",
		key: "confirmDismissWhenDirty",
		section: "Live settings",
		label: "Confirm dismiss when dirty",
		type: "toggle",
	},
	{
		description:
			"Require pressing 1, 2, or 3 twice on the review tab before triggering Submit, Elaborate, or Cancel.",
		key: "doublePressReviewShortcuts",
		section: "Live settings",
		label: "Double-press review shortcuts",
		type: "toggle",
	},
	{
		description:
			"Emit one external notification when the ask flow opens and waits for input.",
		key: "notifications.enabled",
		section: "Live settings",
		label: "Notifications",
		type: "toggle",
	},
	{
		description: "Show footer keymap hints at the bottom of the ask flow.",
		key: "showFooterHints",
		section: "Live settings",
		label: "Show footer hints",
		type: "toggle",
	},
	{
		description:
			"Default new and replayed ask flows to render single-select questions as multi-select. This is not hot-applied to the current flow; use the type hotkey there.",
		key: "presentSingleAsMulti",
		section: "Defaults for future asks",
		label: "Present single-select as multi-select",
		type: "toggle",
	},
	{
		description:
			"Reset behaviour, keymaps, notifications, and extraction settings to defaults. Press twice quickly to confirm.",
		key: "resetConfig",
		section: "Actions",
		label: "Reset config to defaults",
		type: "action",
	},
] as const satisfies readonly Setting[];

type SettingKey = ToggleSettingKey;

/** Absolute line indexes of one rendered setting row. */
interface SettingLines {
	first: number;
	last: number;
}

export class AskSettingsList {
	private closed = false;
	private config: AskConfig;
	private error?: string;
	private focusIndex = 0;
	private resetConfirmUntil = 0;
	private notice?: AskConfigNotice;
	private readonly configPath: string;
	private readonly onClose: () => void;
	private readonly onSave: (config: AskConfig) => Promise<AskConfig>;
	private readonly theme: Theme;
	private readonly tui: TuiLike;
	private windowStart = 0;

	constructor(theme: Theme, options: AskSettingsListOptions) {
		this.theme = theme;
		this.config = options.savedConfig;
		this.configPath = options.configPath;
		this.notice = options.notice;
		this.onClose = options.onClose;
		this.onSave = options.onSave;
		this.tui = options.tui;
	}

	handleInput(data: string): void {
		const bindings = getAskContextBindings(this.config, "settingsModal");
		if (matchesBinding(data, bindings.close)) {
			this.close();
			return;
		}
		if (matchesBinding(data, bindings.previousOption)) {
			this.moveFocus(-1);
			return;
		}
		if (matchesBinding(data, bindings.nextOption)) {
			this.moveFocus(1);
			return;
		}
		if (matchesBinding(data, bindings.toggle)) {
			this.activateSelectedSetting();
		}
	}

	render(width: number): string[] {
		const innerWidth = Math.max(24, width - 2);
		const lines = [
			this.topBorder(innerWidth),
			this.line(
				center(this.theme.fg("accent", "@fasalzein/pi-ask"), innerWidth),
				innerWidth
			),
			this.line("", innerWidth),
		];

		this.appendWrapped(
			lines,
			this.theme.fg(
				"muted",
				"Edit this config file to customize keymaps, notifications, and extraction settings:"
			),
			innerWidth
		);
		this.appendWrapped(
			lines,
			this.theme.fg("accent", this.configPath),
			innerWidth,
			{
				center: true,
			}
		);

		lines.push(this.line("", innerWidth));
		const settingLines = this.appendSettings(lines, innerWidth);

		this.appendSelectedDescription(lines, innerWidth);
		const noticeStart = lines.length;
		this.appendNotice(lines, innerWidth);

		lines.push(this.line("", innerWidth));
		const footerStart = lines.length;
		this.appendFooter(lines, innerWidth);
		lines.push(this.bottomBorder(innerWidth));

		return this.windowLines(
			lines,
			noticeStart,
			footerStart,
			settingLines,
			innerWidth
		).map((line) => truncateToWidth(line, width));
	}

	private appendSettings(lines: string[], innerWidth: number): SettingLines[] {
		let previousSection: SettingSection | undefined;
		const settingLines: SettingLines[] = [];
		for (const [index, setting] of SETTINGS.entries()) {
			if (setting.section !== previousSection) {
				this.appendSection(lines, setting.section, previousSection, innerWidth);
				previousSection = setting.section;
			}
			const first = lines.length;
			for (const settingLine of this.renderSetting(
				setting,
				index,
				innerWidth
			)) {
				lines.push(this.line(settingLine, innerWidth));
			}
			settingLines.push({ first, last: lines.length - 1 });
			if (innerWidth < COMPACT_WIDTH && index < SETTINGS.length - 1) {
				lines.push(this.line("", innerWidth));
			}
		}

		return settingLines;
	}

	private appendSection(
		lines: string[],
		section: SettingSection,
		previousSection: SettingSection | undefined,
		innerWidth: number
	): void {
		if (previousSection) {
			lines.push(this.line("", innerWidth));
		}
		lines.push(this.line(this.theme.fg("accent", ` ${section}`), innerWidth));
	}

	private windowLines(
		lines: string[],
		noticeStart: number,
		footerStart: number,
		settingLines: SettingLines[],
		innerWidth: number
	): string[] {
		// Pi clips overlays from the top. Window here so focus and close keys survive.
		const rows = this.tui.terminal.rows;
		const maxRows = Math.max(
			1,
			Math.min(Math.floor(rows * OVERLAY_HEIGHT_FRACTION), rows - 2)
		);
		if (lines.length <= maxRows) {
			this.windowStart = 0;
			return lines;
		}

		const body = lines.slice(1, noticeStart);
		const footer = [
			...lines.slice(noticeStart, footerStart - 1),
			...lines.slice(footerStart, -1),
		];
		const bodyHeight = Math.max(1, maxRows - footer.length - 2);
		// Body indexes are one less than line indexes (the top border is excluded).
		const settings = settingLines.map(({ first, last }) => ({
			first: first - 1,
			last: last - 1,
		}));
		const focused = settings[this.focusIndex] ?? { first: 0, last: 0 };
		const window = new SettingsWindow(settings, body.length, bodyHeight);
		this.windowStart = window.fit(this.windowStart, focused);

		const { above, below, contentEnd, contentStart } = window.at(
			this.windowStart
		);
		const cue = (text: string) =>
			this.line(this.theme.fg("dim", `${ROW_INDENT}${text}`), innerWidth);
		return [
			lines[0] ?? "",
			...(contentStart > this.windowStart
				? [cue(`↑ ${above} more above`)]
				: []),
			...body.slice(contentStart, contentEnd),
			...(contentEnd < this.windowStart + bodyHeight
				? [cue(`↓ ${below} more below`)]
				: []),
			...footer,
			this.bottomBorder(innerWidth),
		];
	}

	invalidate(): void {
		// State-driven component; nothing cached across theme changes.
	}

	dispose(): void {
		this.close();
	}

	private appendFooter(lines: string[], innerWidth: number): void {
		if (innerWidth < COMPACT_WIDTH) {
			const footer = renderSettingsFooterKeymaps(this.config);
			for (const line of wrapTextWithAnsi(footer, innerWidth - 2)) {
				lines.push(this.line(this.theme.fg("dim", ` ${line}`), innerWidth));
			}
			return;
		}
		this.appendWrapped(
			lines,
			this.theme.fg("dim", renderSettingsFooterKeymaps(this.config)),
			innerWidth
		);
	}

	private appendSelectedDescription(lines: string[], innerWidth: number): void {
		const selectedSetting = SETTINGS[this.focusIndex];
		if (!selectedSetting) {
			return;
		}
		lines.push(this.line("", innerWidth));
		const wrapWidth = innerWidth - 2;
		const descriptionLines = wrapTextWithAnsi(
			this.theme.fg("muted", selectedSetting.description),
			wrapWidth
		).slice(0, DESCRIPTION_LINE_COUNT);
		// Reserve the longest description at this width so the overlay height stays fixed as focus moves.
		const reservedLines = Math.min(
			DESCRIPTION_LINE_COUNT,
			Math.max(
				...SETTINGS.map(
					(setting) => wrapTextWithAnsi(setting.description, wrapWidth).length
				)
			)
		);
		for (const line of descriptionLines) {
			lines.push(this.line(` ${line}`, innerWidth));
		}
		for (let index = descriptionLines.length; index < reservedLines; index++) {
			lines.push(this.line("", innerWidth));
		}
	}

	private appendNotice(lines: string[], innerWidth: number): void {
		if (this.notice) {
			lines.push(this.line("", innerWidth));
			this.appendWrapped(
				lines,
				this.theme.fg(
					this.notice.kind === "success" ? "accent" : "warning",
					this.notice.text
				),
				innerWidth
			);
		}
		if (this.error) {
			lines.push(this.line("", innerWidth));
			this.appendWrapped(lines, this.theme.fg("error", this.error), innerWidth);
		}
	}

	private appendWrapped(
		lines: string[],
		content: string,
		innerWidth: number,
		options: { center?: boolean } = {}
	): void {
		for (const line of wrapTextWithAnsi(content, innerWidth - 2)) {
			const contentLine = options.center
				? center(line, innerWidth)
				: ` ${line}`;
			lines.push(this.line(contentLine, innerWidth));
		}
	}

	private renderSetting(
		setting: Setting,
		index: number,
		innerWidth: number
	): string[] {
		const selected = index === this.focusIndex;
		const prefix = selected
			? this.theme.fg("accent", UI_TEXT.cursor)
			: ROW_INDENT;
		const continuationPrefix = ROW_INDENT;
		if (setting.type === "action") {
			return [center(this.renderSettingValue(setting, selected), innerWidth)];
		}
		const value = this.renderSettingValue(setting, selected);
		const valueWidth = visibleWidth(value);
		const labelWidth = Math.max(
			1,
			innerWidth - visibleWidth(prefix) - valueWidth - 2
		);
		const labelLines = wrapTextWithAnsi(setting.label, labelWidth);
		const firstLabelLine = labelLines[0] ?? "";
		const gap = " ".repeat(
			Math.max(1, labelWidth - visibleWidth(firstLabelLine) + 1)
		);
		const firstLine = `${prefix}${firstLabelLine}${gap}${value}`;
		const continuationLines = labelLines
			.slice(1)
			.map((line) => `${continuationPrefix}${line}`);
		return [firstLine, ...continuationLines];
	}

	private renderSettingValue(setting: Setting, selected: boolean): string {
		if (setting.type === "action") {
			return this.renderValue(
				this.isResetConfirmationActive() ? "confirm reset" : "reset all",
				selected
			);
		}
		return this.renderValue(this.getSettingValue(setting.key), selected);
	}

	private renderValue(value: boolean | string, selected: boolean): string {
		const valueText = formatSettingValue(value);
		const styledValue = selected
			? this.theme.bg("selectedBg", this.theme.fg("accent", valueText))
			: this.theme.fg("muted", valueText);
		return `${this.theme.fg("dim", "[")}${styledValue}${this.theme.fg("dim", "]")}`;
	}

	private getSettingValue(key: SettingKey): boolean {
		return key === "notifications.enabled"
			? this.config.notifications.enabled
			: this.config.behaviour[key];
	}

	private moveFocus(delta: 1 | -1): void {
		this.resetConfirmUntil = 0;
		this.focusIndex =
			(this.focusIndex + delta + SETTINGS.length) % SETTINGS.length;
		this.tui.requestRender();
	}

	private activateSelectedSetting(): void {
		const setting = SETTINGS[this.focusIndex];
		if (!setting) {
			return;
		}
		if (setting.type === "action") {
			this.resetConfigWithConfirmation();
			return;
		}
		this.resetConfirmUntil = 0;
		this.saveSetting(setting.key, !this.getSettingValue(setting.key));
		this.tui.requestRender();
	}

	private resetConfigWithConfirmation(): void {
		if (!this.isResetConfirmationActive()) {
			this.resetConfirmUntil = Date.now() + RESET_CONFIRMATION_MS;
			this.tui.requestRender();
			return;
		}
		this.resetConfirmUntil = 0;
		this.saveConfig(normalizeAskConfig(DEFAULT_ASK_CONFIG));
	}

	private isResetConfirmationActive(): boolean {
		return Date.now() <= this.resetConfirmUntil;
	}

	private saveSetting(key: SettingKey, enabled: boolean): void {
		const nextConfig =
			key === "notifications.enabled"
				? {
						...this.config,
						notifications: {
							...this.config.notifications,
							enabled,
						},
					}
				: {
						...this.config,
						behaviour: {
							...this.config.behaviour,
							[key]: enabled,
						},
					};
		this.saveConfig(nextConfig);
	}

	private saveConfig(nextConfig: AskConfig): void {
		this.error = undefined;
		const previousConfig = this.config;
		this.config = nextConfig;
		this.onSave(nextConfig)
			.then((savedConfig) => {
				this.config = savedConfig;
				this.notice = undefined;
				this.tui.requestRender();
			})
			.catch((error: unknown) => {
				this.config = previousConfig;
				this.error = error instanceof Error ? error.message : String(error);
				this.tui.requestRender();
			});
	}

	private topBorder(innerWidth: number): string {
		return this.theme.fg("muted", `╭${"─".repeat(innerWidth)}╮`);
	}

	private bottomBorder(innerWidth: number): string {
		return this.theme.fg("muted", `╰${"─".repeat(innerWidth)}╯`);
	}

	private line(content: string, innerWidth: number): string {
		const clipped = truncateToWidth(content, innerWidth, "…");
		return `${this.theme.fg("muted", "│")}${padToWidth(clipped, innerWidth)}${this.theme.fg("muted", "│")}`;
	}

	private close(): void {
		if (this.closed) {
			return;
		}
		this.closed = true;
		this.onClose();
	}
}

interface WindowView {
	/** Settings whose first line is hidden above the content rows. */
	above: number;
	/** Settings whose last line is hidden below the content rows. */
	below: number;
	contentEnd: number;
	contentStart: number;
}

/**
 * Scrolls the settings body on short terminals. A cue row replaces the first or
 * last window row when settings are hidden in that direction.
 */
class SettingsWindow {
	private readonly bodyHeight: number;
	private readonly bodyLength: number;
	private readonly settings: SettingLines[];

	constructor(
		settings: SettingLines[],
		bodyLength: number,
		bodyHeight: number
	) {
		this.settings = settings;
		this.bodyLength = bodyLength;
		this.bodyHeight = bodyHeight;
	}

	at(start: number): WindowView {
		const end = start + this.bodyHeight;
		// Cue rows need room for at least one content row between them.
		const cuesFit = this.bodyHeight >= MIN_ROWS_WITH_CUES;
		const hasAbove =
			cuesFit && this.settings.some(({ first }) => first < start);
		const hasBelow = cuesFit && this.settings.some(({ last }) => last >= end);
		const contentStart = hasAbove ? start + 1 : start;
		const contentEnd = hasBelow ? end - 1 : end;
		return {
			above: this.settings.filter(({ first }) => first < contentStart).length,
			below: this.settings.filter(({ last }) => last >= contentEnd).length,
			contentEnd,
			contentStart,
		};
	}

	/** Returns the window start nearest to `start` that shows the focused setting. */
	fit(start: number, focused: SettingLines): number {
		// Keep the header visible while no setting is hidden above.
		if (this.shows(0, focused)) {
			return 0;
		}
		// The body is short, so test every start and keep the nearest one.
		const maxStart = Math.max(0, this.bodyLength - this.bodyHeight);
		let best = Math.max(0, Math.min(start, maxStart));
		let bestDistance = Number.POSITIVE_INFINITY;
		for (let candidate = 0; candidate <= maxStart; candidate++) {
			const distance = Math.abs(candidate - start);
			if (distance < bestDistance && this.shows(candidate, focused)) {
				best = candidate;
				bestDistance = distance;
			}
		}
		return best;
	}

	private shows(start: number, focused: SettingLines): boolean {
		const view = this.at(start);
		return focused.first >= view.contentStart && focused.last < view.contentEnd;
	}
}

function formatSettingValue(value: boolean | string): string {
	if (typeof value === "string") {
		return value;
	}
	return value ? "on" : "off";
}

function center(text: string, width: number): string {
	const padding = Math.max(0, width - visibleWidth(text));
	const left = Math.floor(padding / 2);
	const right = padding - left;
	return `${" ".repeat(left)}${text}${" ".repeat(right)}`;
}

function padToWidth(text: string, width: number): string {
	return `${text}${" ".repeat(Math.max(0, width - visibleWidth(text)))}`;
}

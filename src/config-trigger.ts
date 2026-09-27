// The event prompt is expanded user text. Pi handles typed extension commands before this event.
const CONFIG_TERMS =
	/(?:\/ask-settings(?![\w-])|\bpi-ask settings?\b|\bkeymap\b|\bkeybinding\b)/i;

export function matchesConfigPrompt(prompt: string): boolean {
	return CONFIG_TERMS.test(prompt);
}

// Projection includes only messages in the current model context. Hosts before 0.87
// expose that context through buildSessionContext instead.
interface ContextMessages {
	messages: readonly { role: string; customType?: string }[];
}

interface ContextSessionManager {
	// The 0.87 read-only type omits this method, but older hosts expose it.
	buildSessionContext?: () => ContextMessages;
	buildSessionProjection?: () => ContextMessages;
	getBranch: () => unknown;
}

export function hasActiveConfigMessage(
	sessionManager: ContextSessionManager
): boolean {
	const context =
		typeof sessionManager.buildSessionProjection === "function"
			? sessionManager.buildSessionProjection()
			: sessionManager.buildSessionContext?.();
	if (!context) {
		throw new Error("pi-ask requires a session context method");
	}
	return context.messages.some(
		(message) =>
			message.role === "custom" && message.customType === "pi_ask_config"
	);
}

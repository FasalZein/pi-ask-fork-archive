import { spawn } from "node:child_process";
import { join } from "node:path";
import { headlessTextMetrics, tokenUsage } from "./metrics.ts";

/** Print/JSON matches a background child: -p, restricted tools, no project context. */
export async function executePrint({
	root,
	model,
	mode,
	behavior,
	run,
	timeoutMs,
	upstreamEntry,
}) {
	const env = { ...process.env };
	const child = spawn(
		"pi",
		[
			"-p",
			"--mode",
			"json",
			"--no-session",
			"--no-extensions",
			"--no-skills",
			"--no-prompt-templates",
			"--no-themes",
			"--no-context-files",
			"--tools",
			"read,ask_user",
			"-e",
			mode === "upstream" ? upstreamEntry : join(root, "src/index.ts"),
			"--model",
			model,
			"--",
			behavior.prompt,
		],
		{ cwd: root, env, stdio: ["ignore", "pipe", "pipe"] }
	);
	let stdout = "";
	let stderr = "";
	child.stdout.setEncoding("utf8").on("data", (chunk) => {
		stdout += chunk;
	});
	child.stderr.setEncoding("utf8").on("data", (chunk) => {
		stderr += chunk;
	});
	let timer;
	try {
		const status = await Promise.race([
			new Promise((resolve, reject) => {
				child.once("error", reject);
				child.once("close", (code, signal) => resolve({ code, signal }));
			}),
			new Promise((_, reject) => {
				timer = setTimeout(() => {
					child.kill("SIGKILL");
					reject(new Error(`Print timeout after ${timeoutMs}ms`));
				}, timeoutMs);
			}),
		]);
		if (status.code !== 0) {
			throw new Error(
				`Print exit=${status.code} signal=${status.signal} stderr=${stderr.slice(-3000)}`
			);
		}
		const events = stdout.trim().split("\n").map(JSON.parse);
		if (!events.some((event) => event.type === "agent_end")) {
			throw new Error(`Print output has no agent_end: ${stderr.slice(-3000)}`);
		}
		return printRecord({ events, model, mode, behavior, run });
	} finally {
		clearTimeout(timer);
		if (child.exitCode === null && child.signalCode === null) {
			child.kill("SIGKILL");
		}
		await new Promise((resolve) => {
			if (child.exitCode !== null || child.signalCode !== null) {
				resolve();
			} else {
				child.once("close", resolve);
			}
		});
	}
}

function printRecord({ events, model, mode, behavior, run }) {
	const calls = events
		.filter((event) => event.type === "tool_execution_start")
		.map((event) => ({ name: event.toolName, args: event.args }));
	const asks = calls.filter((call) => call.name === "ask_user");
	const results = events.filter(
		(event) =>
			event.type === "tool_execution_end" && event.toolName === "ask_user"
	);
	const assistantText = events
		.filter(
			(event) =>
				event.type === "message_end" && event.message?.role === "assistant"
		)
		.flatMap(
			(event) =>
				event.message.content
					?.filter((part) => part.type === "text")
					.map((part) => part.text) ?? []
		)
		.join("\n");
	const needsUserInput = results.some((event) =>
		event.result?.content?.some(
			(part) =>
				part.type === "text" &&
				part.text.includes(
					"Needs user input: ask_user requires interactive TUI mode."
				)
		)
	);
	return {
		model,
		mode,
		case: behavior.id,
		run,
		prompt: behavior.prompt,
		asked: asks.length > 0,
		questionCount: asks.reduce(
			(sum, call) => sum + (call.args?.questions?.length ?? 0),
			0
		),
		askCalls: asks.length,
		needsUserInput,
		// Classifications are observations of final text, not proof that the owner approved a choice.
		...headlessTextMetrics(assistantText),
		toolCalls: calls,
		assistantText,
		askResults: results.map((event) => event.result),
		tokenUsage: tokenUsage(events),
	};
}

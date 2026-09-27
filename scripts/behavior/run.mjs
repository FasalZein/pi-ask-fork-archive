#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import {
	cp,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cases } from "./cases.mjs";
import { interviewMetrics, tokenUsage } from "./metrics.ts";
import { executePrint } from "./print.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const base = "9router/cbcn/deepseek-v4.1-flash";
const reportOnly = [
	"anthropic/claude-opus-5-5",
	"openai-codex/gpt-6-sol",
	"zai/glm-5.3",
	"9router/cbcn/kimi-k3-1",
	"grok-cli/grok-4.7",
];
const args = process.argv.slice(2);
function option(flag, fallback) {
	const index = args.indexOf(flag);
	if (index < 0) {
		return fallback;
	}
	if (!args[index + 1] || args[index + 1].startsWith("--")) {
		throw new Error(`${flag} requires a value`);
	}
	return args[index + 1];
}
const models = option("--models", [base, ...reportOnly].join(",")).split(",");
const modes = option("--modes", "upstream,fork").split(",");
const selected = option("--case", "all");
const repeats = option("--repeats", "default");
const outputDir =
	process.env.PI_ASK_BEHAVIOR_DIR ??
	join(homedir(), ".pi/artifacts/pi-ask/behavior");
const timeoutMs = Number(process.env.PI_ASK_BEHAVIOR_TIMEOUT_MS ?? 120_000);
if (
	models.some((m) => !(m.includes("/") && m.split("/")[1])) ||
	modes.some((m) => !["upstream", "fork"].includes(m)) ||
	!Number.isSafeInteger(timeoutMs) ||
	timeoutMs <= 0 ||
	(repeats !== "default" &&
		(!Number.isSafeInteger(Number(repeats)) || Number(repeats) <= 0)) ||
	(selected !== "all" && !cases.some((c) => c.id === selected)) ||
	args.some(
		(arg, i) =>
			i % 2 === 0 &&
			!["--models", "--modes", "--case", "--repeats"].includes(arg)
	) ||
	args.length % 2
) {
	throw new Error("Invalid arguments. See scripts/behavior/README.md");
}
// Declared before the batch loop: records built inside it read this constant.
const configDoc = /docs\/configuration\.md/;
const planMarker = /(?:^|\n)PLAN:/i;
await mkdir(outputDir, { recursive: true });
const upstreamCopy = modes.includes("upstream")
	? await copyUpstream()
	: undefined;
const upstreamEntry = upstreamCopy
	? join(upstreamCopy, "src/index.ts")
	: undefined;
const batch = `${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}`;
batchRuns: for (const model of models) {
	for (const mode of modes) {
		for (const behavior of cases.filter(
			(c) => selected === "all" || c.id === selected
		)) {
			const count =
				repeats === "default" ? defaultRuns(model) : Number(repeats);
			for (let run = 1; run <= count; run++) {
				const name = `${batch}-${model.replaceAll("/", "_")}-${mode}-${behavior.id}-${run}`;
				const path = join(outputDir, `${name}.json`);
				try {
					const record = await (behavior.kind === "print"
						? executePrint
						: execute)({
						root,
						model,
						mode,
						behavior,
						run,
						timeoutMs,
						upstreamEntry,
					});
					await writeFile(path, `${JSON.stringify(record, null, 2)}\n`);
					console.log(
						`${path}: asked=${record.asked} questions=${record.questionCount} followUp=${record.followUp}`
					);
				} catch (error) {
					await writeFile(
						path,
						`${JSON.stringify({ model, mode, case: behavior.id, run, infrastructureError: String(error) }, null, 2)}\n`
					);
					console.error(`${path}: ${error}`);
					// Stop on infrastructure failure to avoid charging for a broken batch.
					process.exitCode = 1;
					break batchRuns;
				}
			}
		}
	}
}

if (upstreamCopy) {
	await rm(upstreamCopy, { recursive: true, force: true });
}

async function copyUpstream() {
	// Install the pinned upstream package into a temp prefix, so the baseline never depends on pi's settings.
	const install = await mkdtemp(join(tmpdir(), "pi-ask-upstream-install-"));
	let manifest;
	try {
		execFileSync(
			"npm",
			[
				"install",
				"--prefix",
				install,
				"--no-save",
				"--ignore-scripts",
				"--no-audit",
				"--no-fund",
				"--omit=dev",
				"--omit=peer",
				"@eko24ive/pi-ask@1.2.0",
			],
			{ stdio: "ignore", timeout: 120_000 }
		);
		manifest = join(install, "node_modules/@eko24ive/pi-ask/package.json");
	} catch (error) {
		await rm(install, { recursive: true, force: true });
		throw error;
	}
	const packageInfo = JSON.parse(readFileSync(manifest, "utf8"));
	if (packageInfo.version !== "1.2.0") {
		throw new Error(`Expected upstream 1.2.0, found ${packageInfo.version}`);
	}
	const destination = await mkdtemp(join(tmpdir(), "pi-ask-upstream-"));
	try {
		await cp(dirname(manifest), destination, { recursive: true });
		await symlink(
			join(root, "node_modules"),
			join(destination, "node_modules"),
			"dir"
		);
		return destination;
	} catch (error) {
		await rm(destination, { recursive: true, force: true });
		throw error;
	} finally {
		await rm(install, { recursive: true, force: true });
	}
}

function defaultRuns(model) {
	return model === base ? 3 : 1;
}

async function execute({ model, mode, behavior, run, timeoutMs }) {
	const scratch = await mkdtemp(join(tmpdir(), "pi-ask-behavior-"));
	const tracePath = join(scratch, "bridge.jsonl");
	const [provider, ...idParts] = model.split("/");
	const modelId = idParts.join("/");
	const startedAt = Date.now();
	const child = spawnRpc(model, mode, behavior.id, tracePath);
	let stderr = "";
	const events = [];
	let buffer = "";
	let finished = false;
	const exit = new Promise((resolveExit, reject) => {
		child.once("error", reject);
		child.once("close", (code, signal) => resolveExit({ code, signal }));
	});
	let timer;
	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (text) => {
		stderr += text;
	});
	child.stdout.setEncoding("utf8");
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: RPC framing and command lifecycle share one stream callback.
	child.stdout.on("data", (chunk) => {
		buffer += chunk;
		let newline = buffer.indexOf("\n");
		while (newline !== -1) {
			const line = buffer.slice(0, newline);
			buffer = buffer.slice(newline + 1);
			if (line.trim()) {
				try {
					const event = JSON.parse(line);
					event.receivedAt = Date.now();
					events.push(event);
					if (
						event.type === "response" &&
						event.command === "set_model" &&
						event.success
					) {
						child.stdin.write(
							`${JSON.stringify({ id: "prompt", type: "prompt", message: behavior.prompt })}\n`
						);
					}
					if (event.type === "agent_end") {
						finished = true;
						child.stdin.end();
					}
				} catch (error) {
					stderr += `\nInvalid RPC JSON: ${error}: ${line}`;
				}
			}
			newline = buffer.indexOf("\n");
		}
	});
	try {
		child.stdin.write(
			`${JSON.stringify({ id: "model", type: "set_model", provider, modelId })}\n`
		);
		const status = await Promise.race([
			exit,
			new Promise((_, reject) => {
				timer = setTimeout(() => {
					child.kill("SIGKILL");
					reject(new Error(`RPC timeout after ${timeoutMs}ms`));
				}, timeoutMs);
			}),
		]);
		checkRpcStatus(events, status, finished, buffer, stderr);
		return await buildRecord({
			events,
			tracePath,
			model,
			mode,
			behavior,
			run,
			stderr,
			startedAt,
		});
	} finally {
		clearTimeout(timer);
		if (child.exitCode === null && child.signalCode === null) {
			child.kill("SIGKILL");
		}
		await exit.catch(() => {
			/* Child spawn failure is reported by the caller. */
		});
		await rm(scratch, { recursive: true, force: true });
	}
}

function checkRpcStatus(events, status, finished, buffer, stderr) {
	const rejected = events.find(
		(event) => event.type === "response" && !event.success
	);
	if (rejected) {
		throw new Error(`RPC ${rejected.command}: ${rejected.error}`);
	}
	if (
		status.code !== 0 ||
		!finished ||
		buffer.trim() ||
		stderr.includes("Invalid RPC JSON")
	) {
		throw new Error(
			`RPC exit=${status.code} signal=${status.signal} agentEnd=${finished} stderr=${stderr.slice(-3000)}`
		);
	}
}

function spawnRpc(model, mode, caseId, tracePath) {
	const env = { ...process.env };
	env.PI_ASK_BEHAVIOR_TRACE = tracePath;
	if (upstreamEntry) {
		env.PI_ASK_BEHAVIOR_UPSTREAM_ENTRY = upstreamEntry;
	}
	env.PI_ASK_BEHAVIOR_CASE = caseId;
	return spawn(
		"pi",
		[
			"--mode",
			"rpc",
			"--no-session",
			"--no-extensions",
			"--no-skills",
			"--no-prompt-templates",
			"--no-themes",
			"--no-context-files",
			"--tools",
			"read,ask_user",
			"-e",
			mode === "upstream"
				? join(root, "scripts/behavior/upstream-rpc.ts")
				: join(root, "src/index.ts"),
			"-e",
			join(root, "scripts/behavior/bridge.ts"),
			"--model",
			model,
		],
		{
			cwd: root,
			env,
			stdio: ["pipe", "pipe", "pipe"],
		}
	);
}

function buildInterviewMetrics(asks, events, startedAt) {
	const planEvent = events.find(
		(e) =>
			e.type === "message_end" &&
			e.message?.role === "assistant" &&
			e.message.content?.some(
				(part) => part.type === "text" && planMarker.test(part.text)
			)
	);
	return {
		...interviewMetrics(
			asks,
			startedAt,
			planEvent?.receivedAt ?? startedAt,
			Boolean(planEvent)
		),
		runDurationMs:
			(events.findLast((e) => e.type === "agent_end")?.receivedAt ??
				startedAt) - startedAt,
	};
}

function followUpKind(asks, behavior, text) {
	if (asks.length > 1) {
		return asks.slice(1).some((c) => c.args?.questions?.length >= 2)
			? "bundled"
			: "separate";
	}
	return behavior.id === "narrowing" && text.includes("?")
		? "plain_text"
		: "none";
}

async function readBridgeTrace(tracePath) {
	const traceText = await readFile(tracePath, "utf8").catch((error) => {
		if (error.code === "ENOENT") {
			return "";
		}
		throw error;
	});
	const trace = traceText.trim()
		? traceText.trim().split("\n").map(JSON.parse)
		: [];
	const started = trace.filter((e) => e.kind === "started").length;
	const completed = trace.filter((e) => e.kind === "completed").length;
	const submitted = trace.filter(
		(e) => e.kind === "submit-result" && e.event.ok
	).length;
	if (
		trace.some((e) => e.kind === "submit-result" && !e.event.ok) ||
		started !== completed ||
		started !== submitted
	) {
		throw new Error(`Bridge failure: ${traceText}`);
	}
	return trace;
}

async function buildRecord({
	events,
	tracePath,
	model,
	mode,
	behavior,
	run,
	stderr,
	startedAt,
}) {
	const errors = events.filter(
		(e) =>
			(e.type === "response" && !e.success) ||
			e.type === "agent_error" ||
			e.type === "error" ||
			(e.type === "message_end" &&
				e.message?.role === "assistant" &&
				e.message?.stopReason === "error")
	);
	if (errors.length) {
		throw new Error(
			`RPC error: ${JSON.stringify(errors).slice(0, 3000)} stderr=${stderr.slice(-1000)}`
		);
	}
	const trace = await readBridgeTrace(tracePath);
	const calls = events
		.filter((e) => e.type === "tool_execution_start")
		.map((e) => ({ name: e.toolName, args: e.args }));
	const text = events
		.filter((e) => e.type === "message_end" && e.message?.role === "assistant")
		.flatMap(
			(e) =>
				e.message.content
					?.filter((p) => p.type === "text")
					.map((p) => p.text) ?? []
		)
		.join("\n");
	const asks = calls.filter((c) => c.name === "ask_user");
	if (asks.length > 0 && !trace.some((event) => event.kind === "started")) {
		throw new Error("Bridge failure: ask_user ran without a started event");
	}
	const questions = asks.flatMap((c) => c.args?.questions ?? []);
	return {
		model,
		mode,
		case: behavior.id,
		run,
		prompt: behavior.prompt,
		asked: asks.length > 0,
		questionCount: questions.length,
		questionTypes: questions.map((q) => q.type ?? "single"),
		recommendations: questions.flatMap((q) =>
			(q.options ?? [])
				.filter((o) => o.recommended)
				.map((o) => ({
					questionId: q.id,
					value: o.value,
					reason: o.description ?? null,
				}))
		),
		validationErrors: events
			.filter(
				(e) =>
					e.type === "tool_execution_end" &&
					e.toolName === "ask_user" &&
					(e.isError || e.result?.details?.cancelReason === "invalid_input")
			)
			.map((e) => e.result),
		followUp: followUpKind(asks, behavior, text),
		configurationDocRead: calls.some(
			(c) => c.name === "read" && configDoc.test(c.args?.path ?? "")
		),
		toolCalls: calls,
		assistantText: text,
		bridgeTrace: trace,
		tokenUsage: tokenUsage(events),
		...(behavior.id === "interview"
			? { interview: buildInterviewMetrics(asks, events, startedAt) }
			: {}),
	};
}

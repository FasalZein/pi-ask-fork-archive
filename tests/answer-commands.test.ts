import assert from "node:assert/strict";
import { dirname } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { registerAnswerCommands } from "../src/answer-commands.ts";

function registerCommands() {
	const commands = new Map<
		string,
		{ handler: (args: string, ctx: any) => Promise<void> }
	>();
	registerAnswerCommands({
		registerCommand(
			name: string,
			command: { handler: (args: string, ctx: any) => Promise<void> }
		) {
			commands.set(name, command);
		},
	} as never);
	return commands;
}

test("answer commands do not open custom UI outside TUI mode", async () => {
	const commands = registerCommands();
	const notifications: Array<{ message: string; type: string }> = [];
	let customOpened = false;
	const ctx = {
		mode: "rpc",
		ui: {
			custom() {
				customOpened = true;
			},
			notify(message: string, type: string) {
				notifications.push({ message, type });
			},
		},
	};

	await commands.get("answer")?.handler("", ctx);
	await commands.get("answer:again")?.handler("", ctx);
	await commands.get("ask:replay")?.handler("", ctx);

	assert.equal(customOpened, false);
	assert.deepEqual(notifications, [
		{ message: "/answer requires interactive TUI mode.", type: "error" },
		{ message: "Ask replay requires interactive TUI mode.", type: "error" },
		{ message: "Ask replay requires interactive TUI mode.", type: "error" },
	]);
});

test("/answer replay loads the skill in its user message", async () => {
	const { DEFAULT_ASK_CONFIG } = await import("../src/config/defaults.ts");
	const { getAskConfigStore } = await import("../src/config/store.ts");
	const { createRemoteAskRuntime, PI_ASK_STARTED_EVENT, PI_ASK_SUBMIT_EVENT } =
		await import("../src/remote-ask.ts");
	const configStore = getAskConfigStore();
	configStore.setConfig({
		...DEFAULT_ASK_CONFIG,
		notifications: { ...DEFAULT_ASK_CONFIG.notifications, enabled: false },
	});
	const handlers = new Map<string, Array<(data: unknown) => void>>();
	const bus = {
		on(channel: string, callback: (data: unknown) => void) {
			const list = handlers.get(channel) ?? [];
			list.push(callback);
			handlers.set(channel, list);
			return () => {
				handlers.set(
					channel,
					list.filter((handler) => handler !== callback)
				);
			};
		},
		emit(channel: string, data: unknown) {
			for (const handler of handlers.get(channel) ?? []) {
				handler(data);
			}
		},
	};
	const remote = createRemoteAskRuntime(bus as never);
	const commands = new Map<
		string,
		{ handler: (args: string, ctx: any) => Promise<void> }
	>();
	let sent = "";
	let idle = true;
	const requests: string[][] = [];
	registerAnswerCommands(
		{
			events: bus,
			registerCommand(
				name: string,
				command: { handler: (args: string, ctx: any) => Promise<void> }
			) {
				commands.set(name, command);
			},
			getCommands() {
				return [
					{
						name: "skill:tdd",
						source: "skill",
						sourceInfo: {
							path: fileURLToPath(
								new URL("./fixtures/skill/SKILL.md", import.meta.url)
							),
							source: "test",
							scope: "user",
							origin: "top-level",
						},
					},
				];
			},
			sendUserMessage(text: string) {
				sent = text;
			},
			exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }),
		} as never,
		remote
	);
	bus.on(PI_ASK_STARTED_EVENT, (data) => {
		const started = data as { flowId: string };
		bus.emit(PI_ASK_SUBMIT_EVENT, {
			version: 1,
			requestId: "answer-1",
			flowId: started.flowId,
			response: {
				kind: "answer",
				answers: { goal: { values: ["speed"], note: "Use /skill:tdd" } },
			},
		});
	});
	const params = {
		questions: [
			{
				id: "goal",
				label: "Goal",
				prompt: "What matters?",
				options: [{ value: "speed", label: "Speed" }],
			},
		],
	};
	const ctx = {
		cwd: process.cwd(),
		mode: "tui",
		isIdle: () => idle,
		sessionManager: {
			getBranch: () => [
				{
					type: "custom",
					customType: "ask:payload",
					data: {
						version: 1,
						source: "answer-extraction",
						sourceEntryId: "a",
						timestamp: 1,
						params,
					},
				},
			],
		},
		ui: {
			notify() {
				/* This test observes delivery. */
			},
			setWorkingVisible() {
				/* This test does not render a working row. */
			},
			custom(callback: (...args: any[]) => unknown) {
				return new Promise((resolve) => {
					callback(
						{
							requestRender() {
								/* This test does not render the screen. */
							},
						},
						{
							bg: (_color: string, text: string) => text,
							fg: (_color: string, text: string) => text,
						},
						{},
						resolve
					);
				});
			},
		},
	};
	try {
		await commands.get("answer:again")?.handler("", ctx);
		assert.equal(
			sent,
			`Goal: Speed\nGoal note: Use /skill:tdd\n\n<skill name="tdd" location="${fileURLToPath(new URL("./fixtures/skill/SKILL.md", import.meta.url))}">\nReferences are relative to ${dirname(fileURLToPath(new URL("./fixtures/skill/SKILL.md", import.meta.url)))}.\n\n# Test first\nStart with a failing test.\n</skill>`
		);
		bus.on("pi-better-skills:request", (request: unknown) => {
			const r = request as {
				operation: string;
				names?: string[];
				reply: (value: unknown) => void;
			};
			if (r.operation === "probe") {
				r.reply({
					version: 1,
					operation: "probe",
					available: true,
					versions: [1],
				});
			}
			if (r.operation === "deliver") {
				requests.push(r.names ?? []);
				r.reply({
					version: 1,
					operation: "deliver",
					outcomes: [{ name: "tdd", status: "already-resident" }],
				});
			}
		});
		await commands.get("answer:again")?.handler("", ctx);
		assert.deepEqual(requests, [["tdd"]]);
		assert.equal(sent, "Goal: Speed\nGoal note: Use /skill:tdd");
		idle = false;
		await commands.get("answer:again")?.handler("", ctx);
		assert.deepEqual(requests, [["tdd"]]);
		assert.equal(sent.split('<skill name="tdd"').length - 1, 1);
	} finally {
		remote.disposeAll();
		configStore.setConfig(DEFAULT_ASK_CONFIG);
	}
});

test("replay shortcut uses the command replay path including the missing notice", async () => {
	const { DEFAULT_ASK_CONFIG } = await import("../src/config/defaults.ts");
	const { getAskConfigStore } = await import("../src/config/store.ts");
	const { registerReplayShortcut } = await import("../src/answer-commands.ts");
	const store = getAskConfigStore();
	const notifications: Array<{ message: string; type: string }> = [];
	const shortcuts = new Map<string, (ctx: any) => Promise<void>>();
	const pi = {
		registerShortcut(
			key: string,
			options: { handler: (ctx: any) => Promise<void> }
		) {
			shortcuts.set(key, options.handler);
		},
	};
	const ctx = {
		mode: "tui",
		sessionManager: { getBranch: () => [] },
		ui: {
			notify(message: string, type: string) {
				notifications.push({ message, type });
			},
		},
	};
	try {
		store.setConfig(DEFAULT_ASK_CONFIG);
		await registerReplayShortcut(pi as never);
		assert.deepEqual([...shortcuts.keys()], ["ctrl+shift+r"]);
		await shortcuts.get("ctrl+shift+r")?.(ctx);
		assert.deepEqual(notifications, [
			{
				message: "No previous ask_user form found on this branch.",
				type: "info",
			},
		]);
		shortcuts.clear();
		store.setConfig({ ...DEFAULT_ASK_CONFIG, shortcuts: { replay: "alt+f7" } });
		await registerReplayShortcut(pi as never);
		assert.deepEqual([...shortcuts.keys()], ["alt+f7"]);
		shortcuts.clear();
		store.setConfig({ ...DEFAULT_ASK_CONFIG, shortcuts: { replay: null } });
		await registerReplayShortcut(pi as never);
		assert.equal(shortcuts.size, 0);
	} finally {
		store.setConfig(DEFAULT_ASK_CONFIG);
	}
});

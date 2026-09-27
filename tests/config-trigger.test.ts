import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { matchesConfigPrompt } from "../src/config-trigger.ts";

const CONFIG_DOC_REFERENCE = /first read .*docs\/configuration\.md/;

for (const term of [
	"/ask-settings",
	"pi-ask settings",
	"pi-ask setting",
	"keymap",
	"keybinding",
]) {
	test(`config trigger matches ${term} in any letter case`, () => {
		assert.equal(matchesConfigPrompt(`Please update ${term}`), true);
		assert.equal(
			matchesConfigPrompt(`Please update ${term.toUpperCase()}`),
			true
		);
		assert.equal(
			matchesConfigPrompt(`Please update ${term.toLowerCase()}`),
			true
		);
	});
}

test("ordinary ask terms do not trigger configuration advice", () => {
	for (const term of [
		"ask_user",
		"/answer",
		"pi-ask",
		"ask settings",
		"ask-user",
		"/ask:replay",
		"keymapping",
		"pi-ask settingslist",
	]) {
		assert.equal(matchesConfigPrompt(`Please update ${term}`), false, term);
	}
});

test("unrelated prompts do not trigger configuration advice", () => {
	assert.equal(matchesConfigPrompt("hi"), false);
	assert.equal(
		matchesConfigPrompt("Refactor the database query for speed"),
		false
	);
});

// A separate process exercises the registered handler as pi does.
const probe = `
import askExtension from "./src/index.ts";
const handlers = new Map();
askExtension({
  on(name, handler) { handlers.set(name, handler); },
  registerTool() {}, registerShortcut() {}, registerCommand() {}, registerEntryRenderer() {},
  events: { on() {}, emit() {} },
});
const beforeStart = handlers.get("before_agent_start");
const visible = [];
const context = { messages: [] };
const sessionManager = {
  getBranch() { return []; },
  buildSessionContext() { return context; },
};
const run = () => beforeStart({ prompt: "Change the ask_user keymap", systemPrompt: "base" }, { sessionManager });
const first = await run();
context.messages.push({ role: "custom", ...first.message });
const repeated = await run();
context.messages.length = 0;
const afterCompaction = await run();
const quiet = await beforeStart({ prompt: "Refactor the query", systemPrompt: "base" }, { sessionManager });
const newerContext = { messages: [{ role: "custom", customType: "pi_ask_config" }] };
const projectionManager = {
  getBranch() { return []; },
  buildSessionProjection() { return newerContext; },
  buildSessionContext() { throw Error("projection should take precedence"); },
};
const projected = await beforeStart({ prompt: "ask_user keybinding", systemPrompt: "base" }, { sessionManager: projectionManager });
console.log(JSON.stringify({ first, repeated, afterCompaction, quiet, projected }));
`;

test("registered handler never replaces the system prompt and sends conditional advice", () => {
	const env = { ...process.env };
	env.PI_ASK_PROMPT_MODE = "full";
	const result = spawnSync(
		process.execPath,
		["--input-type=module", "--eval", probe],
		{
			cwd: new URL("..", import.meta.url),
			env,
			encoding: "utf8",
		}
	);
	assert.equal(result.status, 0, result.stderr);
	const { first, repeated, afterCompaction, quiet, projected } = JSON.parse(
		result.stdout
	);
	for (const result of [first, repeated, afterCompaction, quiet, projected]) {
		assert.equal("systemPrompt" in result, false);
	}
	assert.equal(first.message.customType, "pi_ask_config");
	assert.equal(first.message.display, false);
	assert.match(first.message.content, CONFIG_DOC_REFERENCE);
	assert.deepEqual(repeated, {});
	assert.deepEqual(afterCompaction, first);
	assert.deepEqual(quiet, {});
	assert.deepEqual(projected, {});
});

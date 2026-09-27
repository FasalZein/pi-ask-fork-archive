import assert from "node:assert/strict";
import test from "node:test";
import { createEventBus } from "@earendil-works/pi-coding-agent";
import { createAskAutocompleteProvider } from "../src/ui/autocomplete.ts";

const SKILL_MENU_ITEM = /skill:tdd/;
const skills = [
	{
		name: "skill:tdd",
		description: "Test first",
		source: "skill" as const,
		sourceInfo: {
			path: "/skills/tdd/SKILL.md",
			source: "test",
			scope: "user" as const,
			origin: "top-level" as const,
		},
	},
	{
		name: "skill:other",
		source: "skill" as const,
		sourceInfo: {
			path: "/skills/other/SKILL.md",
			source: "test",
			scope: "user" as const,
			origin: "top-level" as const,
		},
	},
];

test("ask autocomplete explicitly triggers on file mention marker", () => {
	const provider = createAskAutocompleteProvider(process.cwd());

	assert.deepEqual(provider.triggerCharacters, ["@"]);
});

test("bare slash lists registered skills at the start and after a space, not mid-word", async () => {
	const provider = createAskAutocompleteProvider(process.cwd(), skills);
	for (const [lines, line, col] of [
		[["/"], 0, 1],
		[["Please /"], 0, 8],
		[["First line", "Please /"], 1, 8],
	] as const) {
		const suggestions = await provider.getSuggestions([...lines], line, col, {
			signal: new AbortController().signal,
		});
		assert.deepEqual(
			suggestions?.items.map((item) => item.value),
			["skill:tdd", "skill:other"]
		);
		assert.equal(suggestions?.prefix, "/");
	}
	const noSkill = await provider.getSuggestions(["word/"], 0, 5, {
		signal: new AbortController().signal,
	});
	assert.equal(noSkill, null);
});

test("@ file mentions retain pi's file completion", async () => {
	const provider = createAskAutocompleteProvider(process.cwd(), skills);
	const suggestions = await provider.getSuggestions(
		["See @package.json"],
		0,
		17,
		{
			signal: new AbortController().signal,
		}
	);
	assert.ok(suggestions);
	assert.equal(suggestions.prefix, "@package.json");
	assert.ok(suggestions.items.length > 0);
});

test("ask editor offers pi skill commands after /skill: mid-note and completes at the cursor", async () => {
	const provider = createAskAutocompleteProvider(process.cwd(), [
		{
			name: "skill:tdd",
			description: "Test first",
			source: "skill",
			sourceInfo: {
				path: "/skills/tdd/SKILL.md",
				source: "test",
				scope: "user",
				origin: "top-level",
			},
		},
		{
			name: "skill:other",
			source: "extension",
			sourceInfo: {
				path: "/other",
				source: "test",
				scope: "user",
				origin: "top-level",
			},
		},
	]);
	const lines = ["Please use /skill:td after this"];
	const col = "Please use /skill:td".length;
	const suggestions = await provider.getSuggestions(lines, 0, col, {
		signal: new AbortController().signal,
	});
	assert.deepEqual(suggestions?.items, [
		{ value: "skill:tdd", label: "skill:tdd", description: "Test first" },
	]);
	assert.ok(suggestions);
	assert.deepEqual(
		provider.applyCompletion(
			lines,
			0,
			col,
			suggestions.items[0],
			suggestions.prefix
		),
		{
			lines: ["Please use /skill:tdd after this"],
			cursorLine: 0,
			cursorCol: "Please use /skill:tdd".length,
		}
	);
});

test("better-skills ranking is used when available; absent API retains pi ranking", async () => {
	const events = createEventBus();
	const absent = createAskAutocompleteProvider(process.cwd(), skills, events);
	const options = { signal: new AbortController().signal };
	assert.deepEqual(
		(await absent.getSuggestions(["/"], 0, 1, options))?.items.map(
			(item) => item.value
		),
		["skill:tdd", "skill:other"]
	);
	const queries: string[] = [];
	events.on("pi-better-skills/v1/request", (request: unknown) => {
		const message = request as {
			operation: string;
			query?: string;
			reply: (value: unknown) => void;
		};
		if (message.operation === "probe") {
			message.reply({ version: 1, operation: "probe", available: true });
		} else if (message.operation === "suggest") {
			queries.push(message.query ?? "missing");
			message.reply({
				version: 1,
				operation: "suggest",
				items: [
					{ value: "skill:other", label: "skill:other" },
					{ value: "skill:tdd", label: "skill:tdd" },
				],
			});
		}
	});
	const provider = createAskAutocompleteProvider(process.cwd(), skills, events);
	const suggestions = await provider.getSuggestions(["/"], 0, 1, options);
	assert.deepEqual(queries, [""]);
	assert.deepEqual(
		suggestions?.items.map((item) => item.value),
		["skill:other", "skill:tdd"]
	);
	const matched = await provider.getSuggestions(
		["Use /skill:td"],
		0,
		13,
		options
	);
	assert.equal(queries.at(-1), "skill:td");
	assert.deepEqual(
		matched?.items.map((item) => item.value),
		["skill:other", "skill:tdd"]
	);
});

test("skill menu opens after prose and on a later line in the embedded editor", async () => {
	const { SkillReferenceEditor } = await import(
		"../src/ui/skill-reference-editor.ts"
	);
	const identity = (text: string) => text;
	const editor = new SkillReferenceEditor(
		{
			requestRender() {
				/* No screen redraw is needed for the test. */
			},
			terminal: { rows: 40 },
		} as never,
		{
			borderColor: identity,
			selectList: {
				description: identity,
				noMatch: identity,
				scrollInfo: identity,
				selectedPrefix: identity,
				selectedText: identity,
			},
		}
	);
	editor.setAutocompleteProvider(
		createAskAutocompleteProvider(process.cwd(), [
			{
				name: "skill:tdd",
				source: "skill",
				sourceInfo: {
					path: "/skills/tdd/SKILL.md",
					source: "test",
					scope: "user",
					origin: "top-level",
				},
			},
		])
	);
	for (const initial of ["", "Use ", "First line\nUse "]) {
		editor.setText(initial);
		for (const char of "/") {
			editor.handleInput(char);
		}
		await new Promise((resolve) => setTimeout(resolve, 20));
		assert.match(editor.render(80).join("\n"), SKILL_MENU_ITEM);
		editor.handleInput("\t");
		assert.equal(editor.getText(), `${initial}/skill:tdd `);
	}
});

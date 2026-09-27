import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createEventBus } from "@earendil-works/pi-coding-agent";
import { successfulResponse } from "../src/ask-tool-helpers.ts";
import type { AskResult } from "../src/types.ts";

const skillPath = fileURLToPath(
	new URL("./fixtures/skill/SKILL.md", import.meta.url)
);

const reviewPath = fileURLToPath(
	new URL("./fixtures/review/SKILL.md", import.meta.url)
);

const commands = [
	{
		name: "skill:tdd",
		source: "skill",
		description: "Test first",
		sourceInfo: { path: skillPath },
	},
	{
		name: "skill:review",
		source: "skill",
		sourceInfo: { path: reviewPath },
	},
	{
		name: "skill:other",
		source: "extension",
		sourceInfo: { path: "/wrong/SKILL.md" },
	},
] as never;

function submitted(note: string, customText = ""): AskResult {
	return {
		cancelled: false,
		mode: "submit",
		questions: [{ id: "q", label: "Goal", prompt: "Choose", type: "single" }],
		answers: {
			q: {
				values: ["custom"],
				labels: [customText || "Speed"],
				indices: [],
				...(customText ? { customText } : {}),
				note,
			},
		},
	};
}

const reviewBlock = `<skill name="review" location="${reviewPath}">\nReferences are relative to ${fileURLToPath(new URL("./fixtures/review/", import.meta.url)).replace(/\/$/, "")}.\n\n# Review\nCheck the result.\n</skill>`;

const skillBlock = `<skill name="tdd" location="${skillPath}">\nReferences are relative to ${fileURLToPath(new URL("./fixtures/skill/", import.meta.url)).replace(/\/$/, "")}.\n\n# Test first\nStart with a failing test.\n</skill>`;

test("submitted notes and custom answers load each known skill once", () => {
	const result = submitted(
		"Use /skill:tdd then /skill:review and /skill:tdd",
		"Follow /skill:review"
	);
	const response = successfulResponse(result, commands, createEventBus());
	assert.equal(
		response.content[0].text,
		`Goal: Follow /skill:review\nGoal note: Use /skill:tdd then /skill:review and /skill:tdd\n\n${reviewBlock}\n\n${skillBlock}`
	);
	assert.deepEqual(response.details.resolvedSkills, [
		{ name: "review", path: reviewPath },
		{ name: "tdd", path: skillPath },
	]);
});

test("unknown and non-skill tokens leave the result byte-identical", () => {
	for (const note of [
		"No reference",
		"Use /skill:missing",
		"Use /skill:other",
		"url/x/skill:tdd",
	]) {
		const result = submitted(note);
		assert.deepEqual(successfulResponse(result, commands), {
			content: [{ type: "text", text: `Goal: Speed\nGoal note: ${note}` }],
			details: result,
		});
	}
});

test("sentence punctuation does not hide a known skill", () => {
	const response = successfulResponse(
		submitted("Use /skill:tdd. Then compare."),
		commands
	);
	assert.equal(
		response.content[0].text,
		`Goal: Speed\nGoal note: Use /skill:tdd. Then compare.\n\n${skillBlock}`
	);
});

test("elaboration notes add skill paths without altering the recorded note", () => {
	const result: AskResult = {
		...submitted(""),
		mode: "elaborate",
		elaboration: {
			instruction: "",
			nextAction: "clarify_then_reask",
			items: [
				{
					target: { kind: "question" },
					question: {
						id: "q",
						label: "Goal",
						prompt: "Choose",
						type: "single",
						options: [],
					},
					answered: false,
					note: "Explain /skill:tdd",
				},
			],
		},
	};
	const response = successfulResponse(result, commands);
	assert.equal(
		response.content[0].text,
		`User asked to elaborate on question "Choose" with note "Explain /skill:tdd"\nFirst answer the user's note directly using the question and option context; re-ask only the affected question if a choice is still needed.\n\n${skillBlock}`
	);
	assert.deepEqual(response.details.resolvedSkills, [
		{ name: "tdd", path: skillPath },
	]);
	assert.equal(
		response.details.elaboration?.items[0].note,
		"Explain /skill:tdd"
	);
});

for (const status of ["delivered", "already-resident"] as const) {
	test(`provider ${status} does not inject a second body`, () => {
		const events = createEventBus();
		const deliveries: string[][] = [];
		events.on("pi-better-skills/v1/request", (request: unknown) => {
			const r = request as {
				operation: string;
				names?: string[];
				reply: (value: unknown) => void;
			};
			if (r.operation === "probe") {
				r.reply({ version: 1, operation: "probe", available: true });
			}
			if (r.operation === "deliver") {
				deliveries.push(r.names ?? []);
				r.reply({
					version: 1,
					operation: "deliver",
					outcomes: [{ name: "tdd", status }],
				});
			}
		});
		const response = successfulResponse(
			submitted("Use /skill:tdd"),
			commands,
			events
		);
		assert.deepEqual(deliveries, [["tdd"]]);
		assert.equal(
			response.content[0].text,
			"Goal: Speed\nGoal note: Use /skill:tdd"
		);
	});
}

test("no skill token sends no delivery request", () => {
	const events = createEventBus();
	let count = 0;
	events.on("pi-better-skills/v1/request", () => {
		count++;
	});
	successfulResponse(submitted("No reference"), commands, events);
	assert.equal(count, 0);
});

test("missing skill file does not lose the submitted answer", () => {
	const missing = [
		{
			name: "skill:missing-file",
			source: "skill",
			sourceInfo: { path: "/missing/SKILL.md" },
		},
	] as never;
	const result = submitted("Use /skill:missing-file");
	const response = successfulResponse(result, missing);
	assert.equal(
		response.content[0].text,
		"Goal: Speed\nGoal note: Use /skill:missing-file"
	);
	assert.deepEqual(response.details.resolvedSkills, [
		{ name: "missing-file", path: "/missing/SKILL.md" },
	]);
});

for (const outcomes of [[{ name: "tdd", status: "unknown" }], []] as const) {
	test(`provider ${outcomes.length ? "unknown" : "missing"} outcome falls back to block`, () => {
		const events = createEventBus();
		events.on("pi-better-skills/v1/request", (request: unknown) => {
			const r = request as {
				operation: string;
				reply: (value: unknown) => void;
			};
			if (r.operation === "probe") {
				r.reply({ version: 1, operation: "probe", available: true });
			}
			if (r.operation === "deliver") {
				r.reply({ version: 1, operation: "deliver", outcomes });
			}
		});
		assert.equal(
			successfulResponse(submitted("Use /skill:tdd"), commands, events)
				.content[0].text,
			`Goal: Speed\nGoal note: Use /skill:tdd\n\n${skillBlock}`
		);
	});
}

test("provider outcomes load only skills it could not deliver", () => {
	const events = createEventBus();
	const deliveries: string[][] = [];
	events.on("pi-better-skills/v1/request", (request: unknown) => {
		const r = request as {
			operation: string;
			names?: string[];
			reply: (value: unknown) => void;
		};
		if (r.operation === "probe") {
			r.reply({ version: 1, operation: "probe", available: true });
		}
		if (r.operation === "deliver") {
			deliveries.push(r.names ?? []);
			r.reply({
				version: 1,
				operation: "deliver",
				outcomes: [
					{ name: "review", status: "already-resident" },
					{ name: "tdd", status: "unknown" },
				],
			});
		}
	});
	const response = successfulResponse(
		submitted("Use /skill:review and /skill:tdd"),
		commands,
		events
	);
	assert.deepEqual(deliveries, [["review", "tdd"]]);
	assert.equal(
		response.content[0].text,
		`Goal: Speed\nGoal note: Use /skill:review and /skill:tdd\n\n${skillBlock}`
	);
});

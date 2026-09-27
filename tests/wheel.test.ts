import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ASK_CONFIG } from "../src/config/defaults.ts";
import { getAskConfigStore } from "../src/config/store.ts";
import { runAskFlow } from "../src/ui/controller.ts";

const theme = {
	fg: (_: string, value: string) => value,
	bg: (_: string, value: string) => value,
	bold: (value: string) => value,
};

interface WheelEvent {
	type: "wheel" | "click";
	wheelDelta?: number;
	x: number;
	y: number;
}
interface Component {
	handleInput(data: string): void;
	handleMouse(event: WheelEvent): { handled: true } | undefined;
	render(width: number): string[];
}

async function openFlow(
	questions: Array<{
		id: string;
		prompt: string;
		type?: "preview";
		options: Array<{ value: string; label: string; preview?: string }>;
	}>,
	rows = 18
) {
	getAskConfigStore().setConfig(DEFAULT_ASK_CONFIG);
	let component: Component | undefined;
	const flow = runAskFlow(
		{
			cwd: process.cwd(),
			mode: "tui",
			ui: {
				custom(factory: (...args: unknown[]) => unknown) {
					return new Promise((resolve) => {
						component = factory(
							{
								terminal: { rows, columns: 100 },
								requestRender() {
									// The fake renders only when the test requests it.
								},
							},
							theme,
							{},
							resolve
						) as Component;
					});
				},
			},
		} as never,
		{ title: "Demo", questions },
		{ exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }) }
	);
	await new Promise((resolve) => setImmediate(resolve));
	assert.ok(component);
	return { component, flow };
}

function wheel(component: Component, x: number, y: number, delta: number) {
	return component.handleMouse({ type: "wheel", x, y, wheelDelta: delta });
}

const options = Array.from({ length: 16 }, (_, index) => ({
	value: String(index + 1),
	label: `Option ${index + 1}`,
}));

test("wheel over option rows scrolls without moving selection; next key follows focus", async () => {
	const { component, flow } = await openFlow([
		{ id: "q", prompt: "Choose", options },
	]);
	const initial = component.render(100);
	const row = initial.findIndex((line) => line.includes("▶ 1. Option 1"));
	assert.ok(row > 0);
	assert.deepEqual(wheel(component, 2, row, 3), { handled: true });
	const scrolled = component.render(100).join("\n");
	assert.ok(scrolled.includes("Option 4"));
	assert.ok(!scrolled.includes("▶ 1. Option 1"));
	assert.equal(wheel(component, 2, 0, 1), undefined);
	assert.deepEqual(wheel(component, 2, row, -100), { handled: true });
	assert.equal(wheel(component, 2, row, -1), undefined);
	component.handleInput("\x1b[B");
	assert.ok(component.render(100).join("\n").includes("▶ 2. Option 2"));
	component.handleInput("\u0003");
	await flow;
});

test("wheel over preview scrolls only preview; exhausted preview passes through", async () => {
	const { component, flow } = await openFlow(
		[
			{
				id: "q",
				prompt: "Preview?",
				type: "preview",
				options: [
					{
						value: "a",
						label: "A",
						preview: Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join(
							"\n"
						),
					},
					...options.map((option) => ({ ...option, preview: option.label })),
				],
			},
		],
		24
	);
	const initial = component.render(100);
	const previewRow = initial.findIndex((line) => line.includes("line 1"));
	assert.ok(previewRow > 0);
	assert.deepEqual(wheel(component, 65, previewRow, 2), { handled: true });
	let lines = component.render(100).join("\n");
	assert.ok(lines.includes("line 3"));
	assert.ok(lines.includes("▶ 1. A"));
	for (let i = 0; i < 40; i++) {
		wheel(component, 65, previewRow, 2);
	}
	assert.equal(wheel(component, 65, previewRow, 2), undefined);
	lines = component.render(100).join("\n");
	assert.ok(lines.includes("line 30"));
	component.handleInput("\u0003");
	await flow;
});

test("stacked preview uses its visible box while a short list passes through", async () => {
	const { component, flow } = await openFlow(
		[
			{
				id: "q",
				prompt: "Preview?",
				type: "preview",
				options: [
					{
						value: "a",
						label: "A",
						preview: Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join(
							"\n"
						),
					},
				],
			},
		],
		30
	);
	const initial = component.render(70);
	const previewRow = initial.findIndex((line) => line.includes("line 1"));
	assert.ok(previewRow > 0);
	assert.deepEqual(wheel(component, 2, previewRow, 1), { handled: true });
	assert.ok(component.render(70).join("\n").includes("line 2"));
	assert.equal(wheel(component, 2, 0, 1), undefined);
	component.handleInput("\u0003");
	await flow;
});

test("review wheel moves answers without moving action; no overflow passes through", async () => {
	const questions = Array.from({ length: 12 }, (_, index) => ({
		id: `q${index + 1}`,
		prompt: `Question ${index + 1}`,
		options: [{ value: "yes", label: "Yes" }],
	}));
	const { component, flow } = await openFlow(questions);
	for (const _ of questions) {
		component.handleInput("\t");
	}
	const initial = component.render(100);
	const row = initial.findIndex((line) => line.trimEnd().endsWith(" Q1"));
	assert.ok(row > 0);
	assert.deepEqual(wheel(component, 5, row, 3), { handled: true });
	const scrolled = component.render(100).join("\n");
	assert.ok(scrolled.includes("Q4"));
	assert.ok(scrolled.includes(" ▶ 1. Submit"));
	assert.equal(wheel(component, 5, 0, 1), undefined);
	for (let i = 0; i < 30; i++) {
		wheel(component, 5, row, 2);
	}
	assert.equal(wheel(component, 5, row, 1), undefined);
	component.handleInput("\u0003");
	await flow;
	const short = await openFlow(questions.slice(0, 1));
	short.component.handleInput("\t");
	short.component.render(100);
	assert.equal(wheel(short.component, 5, 7, 1), undefined);
	short.component.handleInput("\u0003");
	await short.flow;
});

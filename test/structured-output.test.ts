import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { createStructuredOutputExtension } from "../extensions/structured-output.ts";
import { existsSync, readFileSync } from "node:fs";

describe("structured-output", () => {
	const cleanups: (() => void)[] = [];

	after(() => {
		for (const c of cleanups) {
			try {
				c();
			} catch {
				/* cleanup */
			}
		}
	});

	it("generates a temp .ts extension file that exists on disk", async () => {
		const ext = await createStructuredOutputExtension({
			type: "object",
			properties: {
				status: { type: "string", enum: ["green", "red"] },
				command: { type: "string" },
				exitCode: { type: "number" },
				output: { type: "string" },
			},
			required: ["status", "command", "exitCode", "output"],
		});
		cleanups.push(ext.cleanup);

		assert.ok(existsSync(ext.path), "temp extension file should exist");
		assert.ok(ext.path.endsWith(".ts"), "should be a .ts file");
	});

	it("generated file exports a default function that registers emit_result tool", async () => {
		const ext = await createStructuredOutputExtension({
			type: "object",
			properties: { score: { type: "number" } },
			required: ["score"],
		});
		cleanups.push(ext.cleanup);

		const source = readFileSync(ext.path, "utf-8");
		assert.ok(
			source.includes("emit_result"),
			"should register emit_result tool",
		);
		assert.ok(
			source.includes("export default"),
			"should export default function",
		);
		assert.ok(source.includes("registerTool"), "should call registerTool");
	});

	it("embeds the JSON schema into the generated source", async () => {
		const schema = {
			type: "object",
			properties: {
				commitHash: { type: "string" },
				pushed: { type: "boolean" },
			},
			required: ["commitHash", "pushed"],
		};
		const ext = await createStructuredOutputExtension(schema);
		cleanups.push(ext.cleanup);

		const source = readFileSync(ext.path, "utf-8");
		assert.ok(
			source.includes("commitHash"),
			"schema property should be in source",
		);
		assert.ok(source.includes("pushed"), "schema property should be in source");
	});

	it("cleanup removes the temp file and directory", async () => {
		const ext = await createStructuredOutputExtension({
			type: "object",
			properties: { x: { type: "number" } },
			required: ["x"],
		});

		assert.ok(existsSync(ext.path), "file exists before cleanup");
		ext.cleanup();
		assert.ok(!existsSync(ext.path), "file removed after cleanup");
		// Directory should also be removed
		const dir = ext.path.substring(0, ext.path.lastIndexOf("/"));
		assert.ok(!existsSync(dir), "directory removed after cleanup");
	});
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	PHASE_SCHEMAS,
	buildDispatchPrompt,
	loadAgentType,
} from "../extensions/loop-dispatch.ts";

describe("loop agents-mode dispatch", () => {
	it("defines schemas for all 5 phases", () => {
		assert.ok(PHASE_SCHEMAS["plan"], "plan schema exists");
		assert.ok(PHASE_SCHEMAS["build"], "build schema exists");
		assert.ok(PHASE_SCHEMAS["review"], "review schema exists");
		assert.ok(PHASE_SCHEMAS["verify"], "verify schema exists");
		assert.ok(PHASE_SCHEMAS["ship"], "ship schema exists");
	});

	it("plan schema has planPath, contract, openDecisions", () => {
		const props = PHASE_SCHEMAS["plan"].properties as Record<string, unknown>;
		assert.ok(props["planPath"], "has planPath");
		assert.ok(props["contract"], "has contract");
		assert.ok(props["openDecisions"], "has openDecisions");
	});

	it("build schema has status enum green/red, command, exitCode, output", () => {
		const props = PHASE_SCHEMAS["build"].properties as Record<string, unknown>;
		const status = props["status"] as { enum?: string[] };
		assert.ok(status.enum?.includes("green"), "status includes green");
		assert.ok(status.enum?.includes("red"), "status includes red");
		assert.ok(props["command"], "has command");
		assert.ok(props["exitCode"], "has exitCode");
		assert.ok(props["output"], "has output");
	});

	it("verify schema has score, converged, honestyHits, evidence", () => {
		const props = PHASE_SCHEMAS["verify"].properties as Record<string, unknown>;
		assert.ok(props["score"], "has score");
		assert.ok(props["converged"], "has converged");
		assert.ok(props["honestyHits"], "has honestyHits");
		assert.ok(props["evidence"], "has evidence");
	});

	it("ship schema has commitHash, pushed, prUrl", () => {
		const props = PHASE_SCHEMAS["ship"].properties as Record<string, unknown>;
		assert.ok(props["commitHash"], "has commitHash");
		assert.ok(props["pushed"], "has pushed");
		assert.ok(props["prUrl"], "has prUrl");
	});

	it("buildDispatchPrompt includes the user request and plan path", () => {
		const prompt = buildDispatchPrompt({
			phase: "build",
			request: "add a health check endpoint",
			planPath: ".loop-plan.md",
			workflowUuid: "wf-123",
			iteration: 1,
		});
		assert.ok(
			prompt.includes("add a health check endpoint"),
			"includes user request",
		);
		assert.ok(prompt.includes(".loop-plan.md"), "includes plan path");
	});

	it("buildDispatchPrompt does NOT include skill content (moved to --append-system-prompt)", () => {
		const prompt = buildDispatchPrompt({
			phase: "build",
			request: "build the API",
			planPath: ".loop-plan.md",
			workflowUuid: "wf-123",
			iteration: 1,
			skillContent:
				"--- tdd skill ---\nWrite the failing test first.\n--- end tdd skill ---\n",
		});
		// Skill content is now passed via --append-system-prompt in loop.ts so the
		// workflow gate can detect skill markers in the system prompt. It must NOT
		// appear in the dispatch message (would duplicate tokens).
		assert.ok(
			!prompt.includes("Write the failing test first"),
			"skill content must not be in dispatch prompt (moved to system prompt)",
		);
	});

	it("loadAgentType reads the .md file and returns frontmatter + body", () => {
		const agent = loadAgentType("build-agent");
		assert.ok(agent, "agent type loaded");
		assert.equal(agent?.name, "build-agent");
		assert.ok(agent?.body.includes("TDD"), "body includes TDD mention");
		assert.ok(agent?.tools.includes("bash"), "tools include bash");
	});

	it("loadAgentType returns null for nonexistent agent", () => {
		const agent = loadAgentType("nonexistent-agent");
		assert.equal(agent, null);
	});
});

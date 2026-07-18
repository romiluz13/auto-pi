import { test } from "node:test";
import assert from "node:assert/strict";
import {
	isTestFile,
	isSourceFile,
	isSkillActive,
	shouldGateWrite,
	shouldGateCommit,
	shouldGatePush,
	wasTestRun,
	type SkillCheckContext,
} from "../extensions/workflow-gate-logic.ts";

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeCtx(opts: {
	skills?: string[];
	systemPrompt?: string;
	testCommands?: string[];
}): SkillCheckContext {
	const skills = opts.skills ?? [];
	const testCommands = opts.testCommands ?? [];
	const branch: Array<Record<string, unknown>> = [];

	for (const s of skills) {
		branch.push({ customType: "skill-loaded", details: { skillName: s } });
	}
	for (const cmd of testCommands) {
		branch.push({ input: { command: cmd } });
	}

	return {
		sessionManager: { getBranch: () => branch },
		getSystemPrompt: opts.systemPrompt
			? () => opts.systemPrompt!
			: undefined,
	};
}

// ─── isTestFile ────────────────────────────────────────────────────────────

test("isTestFile: identifies common test file patterns", () => {
	assert.ok(isTestFile("foo.test.ts"));
	assert.ok(isTestFile("foo.spec.tsx"));
	assert.ok(isTestFile("foo.test.js"));
	assert.ok(isTestFile("test_foo.py"));
	assert.ok(isTestFile("foo_test.py"));
	assert.ok(isTestFile("foo_test.go"));
	assert.ok(isTestFile("foo_test.rs"));
	assert.ok(isTestFile("test/foo.ts"));
	assert.ok(isTestFile("tests/foo.ts"));
	assert.ok(isTestFile("__tests__/foo.ts"));
	assert.ok(isTestFile("src/spec/foo.ts"));
});

test("isTestFile: does not match source files", () => {
	assert.ok(!isTestFile("foo.ts"));
	assert.ok(!isTestFile("src/index.ts"));
	assert.ok(!isTestFile("lib/foo.py"));
	assert.ok(!isTestFile("components/Button.tsx"));
});

// ─── isSourceFile ──────────────────────────────────────────────────────────

test("isSourceFile: identifies source code files", () => {
	assert.ok(isSourceFile("foo.ts"));
	assert.ok(isSourceFile("src/index.ts"));
	assert.ok(isSourceFile("lib/foo.py"));
	assert.ok(isSourceFile("components/Button.tsx"));
	assert.ok(isSourceFile("main.go"));
	assert.ok(isSourceFile("lib.rs"));
	assert.ok(isSourceFile("App.java"));
});

test("isSourceFile: excludes test files", () => {
	assert.ok(!isSourceFile("foo.test.ts"));
	assert.ok(!isSourceFile("test/foo.ts"));
	assert.ok(!isSourceFile("tests/bar.spec.js"));
});

test("isSourceFile: excludes docs and config", () => {
	assert.ok(!isSourceFile("README.md"));
	assert.ok(!isSourceFile("package.json"));
	assert.ok(!isSourceFile("tsconfig.json"));
	assert.ok(!isSourceFile(".eslintrc.yaml"));
	assert.ok(!isSourceFile("install.sh"));
	assert.ok(!isSourceFile("pyproject.toml"));
});

// ─── isSkillActive ─────────────────────────────────────────────────────────

test("isSkillActive: detects skill-loaded message in session", () => {
	const ctx = makeCtx({ skills: ["tdd"] });
	assert.ok(isSkillActive(ctx, "tdd"));
});

test("isSkillActive: detects skill in system prompt (continuation turn)", () => {
	const ctx = makeCtx({
		systemPrompt: "some prompt\n--- tdd skill (mechanically injected by skill-injector) ---\nbody\n--- end tdd skill ---\n",
	});
	assert.ok(isSkillActive(ctx, "tdd"));
});

test("isSkillActive: returns false when skill is absent", () => {
	const ctx = makeCtx({ skills: ["brainstorming"] });
	assert.ok(!isSkillActive(ctx, "tdd"));
});

test("isSkillActive: returns false on empty session", () => {
	const ctx = makeCtx({});
	assert.ok(!isSkillActive(ctx, "tdd"));
});

// ─── shouldGateWrite (TDD enforcement) ─────────────────────────────────────

test("shouldGateWrite: blocks source file without tdd skill", () => {
	const ctx = makeCtx({});
	const result = shouldGateWrite("src/index.ts", ctx, false);
	assert.equal(result.block, true);
	assert.ok(result.reason?.includes("build skill"));
});

test("shouldGateWrite: allows source file with tdd skill in session", () => {
	const ctx = makeCtx({ skills: ["tdd"] });
	const result = shouldGateWrite("src/index.ts", ctx, false);
	assert.equal(result.block, false);
});

test("shouldGateWrite: allows source file with tdd skill in system prompt", () => {
	const ctx = makeCtx({
		systemPrompt: "--- tdd skill (mechanically injected ---",
	});
	const result = shouldGateWrite("src/index.ts", ctx, false);
	assert.equal(result.block, false);
});

test("shouldGateWrite: always allows test files (TDD = write tests first)", () => {
	const ctx = makeCtx({});
	const result = shouldGateWrite("foo.test.ts", ctx, false);
	assert.equal(result.block, false);
});

test("shouldGateWrite: always allows docs and config", () => {
	const ctx = makeCtx({});
	assert.equal(shouldGateWrite("README.md", ctx, false).block, false);
	assert.equal(shouldGateWrite("package.json", ctx, false).block, false);
});

test("shouldGateWrite: skip-gate overrides everything", () => {
	const ctx = makeCtx({});
	const result = shouldGateWrite("src/index.ts", ctx, true);
	assert.equal(result.block, false);
});

// ─── shouldGateCommit (review + verification enforcement) ──────────────────

test("shouldGateCommit: blocks without verification AND without tests", () => {
	const ctx = makeCtx({});
	const result = shouldGateCommit(ctx, false, false);
	assert.equal(result.block, true);
	assert.ok(result.reason?.includes("verification"));
});

test("shouldGateCommit: blocks without review skill even if tests ran", () => {
	const ctx = makeCtx({ skills: ["verification-before-completion"], testCommands: ["npm test"] });
	const result = shouldGateCommit(ctx, false, true);
	assert.equal(result.block, true);
	assert.ok(result.reason?.includes("code-review"));
});

test("shouldGateCommit: allows when both verification and review are active", () => {
	const ctx = makeCtx({ skills: ["verification-before-completion", "code-review"] });
	const result = shouldGateCommit(ctx, false, false);
	assert.equal(result.block, false);
});

test("shouldGateCommit: allows when review active and tests ran (verification heuristic)", () => {
	const ctx = makeCtx({ skills: ["code-review"], testCommands: ["npm test"] });
	const result = shouldGateCommit(ctx, false, true);
	// No verification skill but tests ran — verification gate passes,
	// review gate passes. Both gates open.
	assert.equal(result.block, false);
});

test("shouldGateCommit: skip-gate overrides", () => {
	const ctx = makeCtx({});
	const result = shouldGateCommit(ctx, true, false);
	assert.equal(result.block, false);
});

// ─── shouldGatePush ────────────────────────────────────────────────────────

test("shouldGatePush: blocks without commit skill", () => {
	const ctx = makeCtx({});
	const result = shouldGatePush(ctx, false);
	assert.equal(result.block, true);
	assert.ok(result.reason?.includes("commit skill"));
});

test("shouldGatePush: allows with commit skill", () => {
	const ctx = makeCtx({ skills: ["commit"] });
	const result = shouldGatePush(ctx, false);
	assert.equal(result.block, false);
});

test("shouldGatePush: skip-gate overrides", () => {
	const ctx = makeCtx({});
	const result = shouldGatePush(ctx, true);
	assert.equal(result.block, false);
});

// ─── wasTestRun ────────────────────────────────────────────────────────────

test("wasTestRun: detects npm test", () => {
	const ctx = makeCtx({ testCommands: ["npm test"] });
	assert.ok(wasTestRun(ctx));
});

test("wasTestRun: detects node --test", () => {
	const ctx = makeCtx({ testCommands: ["node --test test/"] });
	assert.ok(wasTestRun(ctx));
});

test("wasTestRun: detects pytest", () => {
	const ctx = makeCtx({ testCommands: ["pytest -xvs"] });
	assert.ok(wasTestRun(ctx));
});

test("wasTestRun: returns false when no test command ran", () => {
	const ctx = makeCtx({ testCommands: ["git status"] });
	assert.ok(!wasTestRun(ctx));
});

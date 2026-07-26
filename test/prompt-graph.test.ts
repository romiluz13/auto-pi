import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const REPO_ROOT = process.cwd();
const PROMPTS_DIR = join(REPO_ROOT, "prompts");
const REPO_SKILLS_DIR = join(REPO_ROOT, "skills");
const LIVE_SKILLS_DIR = join(homedir(), ".agents", "skills");

const PROMPT_NAMES = readdirSync(PROMPTS_DIR)
	.filter((f) => f.endsWith(".md"))
	.map((f) => f.replace(/\.md$/, ""));

function readPrompt(name: string): string {
	return readFileSync(join(PROMPTS_DIR, `${name}.md`), "utf-8");
}

function skillPin(prompt: string): string | null {
	const match = prompt.match(/^skill:\s*(\S+)/m);
	return match ? match[1] : null;
}

function skillExists(name: string): boolean {
	return (
		existsSync(join(REPO_SKILLS_DIR, name, "SKILL.md")) ||
		existsSync(join(LIVE_SKILLS_DIR, name, "SKILL.md"))
	);
}

// ─── Every prompt has exactly one valid skill: target ────────────────────────

test("every prompt has exactly one skill: frontmatter pin", () => {
	for (const name of PROMPT_NAMES) {
		const content = readPrompt(name);
		const pin = skillPin(content);
		assert.ok(pin, `prompt ${name}.md has no skill: pin`);
	}
});

test("every prompt's skill: target exists in the skill library", () => {
	for (const name of PROMPT_NAMES) {
		const content = readPrompt(name);
		const pin = skillPin(content);
		assert.ok(pin, `prompt ${name}.md has no skill: pin`);
		assert.ok(
			skillExists(pin),
			`prompt ${name}.md pins skill "${pin}" but no SKILL.md exists`,
		);
	}
});

// ─── The 4 workflow prompts pin their workflow skills ─────────────────────────

test("/plan pins planning-workflow", () => {
	assert.equal(skillPin(readPrompt("plan")), "planning-workflow");
});

test("/build pins build-workflow", () => {
	assert.equal(skillPin(readPrompt("build")), "build-workflow");
});

test("/review pins review-workflow", () => {
	assert.equal(skillPin(readPrompt("review")), "review-workflow");
});

test("/ship pins ship-workflow", () => {
	assert.equal(skillPin(readPrompt("ship")), "ship-workflow");
});

// ─── The 3 direct-pin prompts pin their specialist (no wrapper needed) ───────

test("/debug pins diagnosing-bugs directly (no wrapper)", () => {
	assert.equal(skillPin(readPrompt("debug")), "diagnosing-bugs");
});

test("/research pins research directly (no wrapper)", () => {
	assert.equal(skillPin(readPrompt("research")), "research");
});

test("/setup-audit pins setup-maintenance directly (no wrapper)", () => {
	assert.equal(skillPin(readPrompt("setup-audit")), "setup-maintenance");
});

// ─── The 4 workflow skills exist ──────────────────────────────────────────────

test("the 4 workflow skills exist in the repo", () => {
	for (const skill of ["planning-workflow", "build-workflow", "review-workflow", "ship-workflow"]) {
		assert.ok(
			existsSync(join(REPO_SKILLS_DIR, skill, "SKILL.md")),
			`workflow skill ${skill} not found in repo skills/`,
		);
	}
});

// ─── No prompt instructs the user to type internal skill commands ────────────

test("no prompt says 'Next: type /skill:' (internal commands are not user-facing)", () => {
	for (const name of PROMPT_NAMES) {
		const content = readPrompt(name);
		assert.ok(
			!/Next:\s*type\s*`?\/skill:/i.test(content),
			`prompt ${name}.md instructs the user to type an internal /skill: command`,
		);
	}
});

test("no prompt says 'invoke /skill:' (the workflow owns routing, not the prompt)", () => {
	for (const name of PROMPT_NAMES) {
		const content = readPrompt(name);
		assert.ok(
			!/invoke\s*`?\/skill:/i.test(content),
			`prompt ${name}.md instructs the agent to invoke an internal /skill: command`,
		);
	}
});

test("no prompt says 'Want me to invoke it?' (the agent can't run slash commands)", () => {
	for (const name of PROMPT_NAMES) {
		const content = readPrompt(name);
		assert.ok(
			!/Want me to invoke/i.test(content),
			`prompt ${name}.md says "Want me to invoke it?"`,
		);
	}
});

// ─── The planning workflow orchestrates (no upfront pile-up) ─────────────────

test("planning-workflow reads specialists one at a time (no upfront pile-up)", () => {
	const content = readFileSync(join(REPO_SKILLS_DIR, "planning-workflow", "SKILL.md"), "utf-8");
	// The workflow should instruct reading each specialist in its phase, not all at once.
	assert.ok(/Read.*brainstorming.*SKILL.md/i.test(content), "planning-workflow should read brainstorming");
	assert.ok(/Read.*to-spec.*SKILL.md/i.test(content), "planning-workflow should read to-spec");
	assert.ok(/Read.*to-tickets.*SKILL.md/i.test(content), "planning-workflow should read to-tickets");
	// Should NOT inject all specialist content upfront — it reads them one at a time per phase.
	assert.ok(/Reread this workflow skill/i.test(content), "planning-workflow should instruct rereading itself between phases");
});

test("planning-workflow does not advance before design approval", () => {
	const content = readFileSync(join(REPO_SKILLS_DIR, "planning-workflow", "SKILL.md"), "utf-8");
	assert.ok(/Do NOT advance before explicit design approval/i.test(content), "planning-workflow should not advance before design approval");
});

test("planning-workflow cannot finish spec without a reference", () => {
	const content = readFileSync(join(REPO_SKILLS_DIR, "planning-workflow", "SKILL.md"), "utf-8");
	assert.ok(/Do NOT advance without a spec reference/i.test(content), "planning-workflow should require a spec reference");
});

test("planning-workflow cannot finish tickets without ticket refs + frontier", () => {
	const content = readFileSync(join(REPO_SKILLS_DIR, "planning-workflow", "SKILL.md"), "utf-8");
	assert.ok(/Do NOT advance without published ticket references/i.test(content), "planning-workflow should require ticket references + frontier");
});

test("planning-workflow branches to wayfinder for foggy (not brainstorming+spec by default)", () => {
	const content = readFileSync(join(REPO_SKILLS_DIR, "planning-workflow", "SKILL.md"), "utf-8");
	assert.ok(/foggy/i.test(content), "planning-workflow should have a foggy branch");
	assert.ok(/wayfinder/i.test(content), "planning-workflow should route foggy to wayfinder");
});

// ─── The ship workflow requires evidence at each phase ───────────────────────

test("ship-workflow requires verification evidence", () => {
	const content = readFileSync(join(REPO_SKILLS_DIR, "ship-workflow", "SKILL.md"), "utf-8");
	assert.ok(/Do NOT advance without verification evidence/i.test(content), "ship-workflow should require verification evidence");
});

test("ship-workflow never commits secrets or pushes main", () => {
	const content = readFileSync(join(REPO_SKILLS_DIR, "ship-workflow", "SKILL.md"), "utf-8");
	assert.ok(/Never commit.*secrets/i.test(content), "ship-workflow should never commit secrets");
	assert.ok(/Do NOT push to main/i.test(content), "ship-workflow should not push to main");
});

// ─── The build workflow returns from diagnosis to TDD ────────────────────────

test("build-workflow returns from diagnosis to tdd on RED", () => {
	const content = readFileSync(join(REPO_SKILLS_DIR, "build-workflow", "SKILL.md"), "utf-8");
	assert.ok(/diagnose/i.test(content), "build-workflow should have a diagnose phase");
	assert.ok(/tdd/i.test(content), "build-workflow should return to tdd after diagnosis");
});

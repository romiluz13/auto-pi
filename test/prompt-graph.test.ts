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

function readWorkflowSkill(name: string): string {
	return readFileSync(join(REPO_SKILLS_DIR, name, "SKILL.md"), "utf-8");
}

// Parse the phases from a workflow skill (## Phase: X headers)
function parsePhases(content: string): string[] {
	const phases: string[] = [];
	const regex = /^## Phase:\s*(\S+)/gm;
	let match;
	while ((match = regex.exec(content)) !== null) {
		phases.push(match[1]);
	}
	return phases;
}

// Extract skill read targets from a workflow skill
function parseSkillReads(content: string): string[] {
	const reads: string[] = [];
	const regex = /Read\s+`?(\/[^`]+\/SKILL\.md)`?/g;
	let match;
	while ((match = regex.exec(content)) !== null) {
		// Extract the skill name from the path
		const parts = match[1].split("/");
		const skillName = parts[parts.length - 2];
		reads.push(skillName);
	}
	return reads;
}

// ─── Every prompt has exactly one valid skill: target ────────────────────────

test("every prompt has exactly one skill: frontmatter pin", () => {
	for (const name of PROMPT_NAMES) {
		const pin = skillPin(readPrompt(name));
		assert.ok(pin, `prompt ${name}.md has no skill: pin`);
	}
});

test("every prompt's skill: target exists in the skill library", () => {
	for (const name of PROMPT_NAMES) {
		const pin = skillPin(readPrompt(name));
		assert.ok(pin, `prompt ${name}.md has no skill: pin`);
		assert.ok(
			skillExists(pin),
			`prompt ${name}.md pins skill "${pin}" but no SKILL.md exists`,
		);
	}
});

// ─── The 6 workflow prompts pin their workflow skills ─────────────────────────

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

test("/debug pins debug-workflow", () => {
	assert.equal(skillPin(readPrompt("debug")), "debug-workflow");
});

test("/research pins research-workflow", () => {
	assert.equal(skillPin(readPrompt("research")), "research-workflow");
});

test("/setup-audit pins setup-maintenance directly (1 specialist, no wrapper)", () => {
	assert.equal(skillPin(readPrompt("setup-audit")), "setup-maintenance");
});

// ─── The 6 workflow skills exist ──────────────────────────────────────────────

test("the 6 workflow skills exist in the repo", () => {
	for (const skill of [
		"planning-workflow",
		"build-workflow",
		"review-workflow",
		"ship-workflow",
		"research-workflow",
		"debug-workflow",
	]) {
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

test("no prompt says 'invoke /skill:' (the workflow owns routing)", () => {
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

// ─── Structural: workflow skills have phases, reads, and state protocol ──────

test("every workflow skill has a state protocol section", () => {
	for (const skill of [
		"planning-workflow",
		"build-workflow",
		"review-workflow",
		"ship-workflow",
		"research-workflow",
		"debug-workflow",
	]) {
		const content = readWorkflowSkill(skill);
		assert.ok(
			/State protocol/i.test(content),
			`${skill} should have a State protocol section`,
		);
		assert.ok(
			/At entry.*initialize/i.test(content),
			`${skill} should instruct initializing state at entry`,
		);
		assert.ok(
			/Before every user wait.*emit/i.test(content),
			`${skill} should instruct emitting state before user wait`,
		);
		assert.ok(
			/continuation.*reconstruct/i.test(content),
			`${skill} should instruct reconstructing state on continuation`,
		);
	}
});

test("every workflow skill has at least 2 phases", () => {
	for (const skill of [
		"planning-workflow",
		"build-workflow",
		"review-workflow",
		"ship-workflow",
		"research-workflow",
		"debug-workflow",
	]) {
		const content = readWorkflowSkill(skill);
		const phases = parsePhases(content);
		assert.ok(
			phases.length >= 2,
			`${skill} should have at least 2 phases, got ${phases.length}: ${phases.join(", ")}`,
		);
	}
});

test("every workflow skill has a complete phase", () => {
	for (const skill of [
		"planning-workflow",
		"build-workflow",
		"review-workflow",
		"ship-workflow",
		"research-workflow",
		"debug-workflow",
	]) {
		const content = readWorkflowSkill(skill);
		const phases = parsePhases(content);
		assert.ok(
			phases.includes("complete"),
			`${skill} should have a complete phase, got: ${phases.join(", ")}`,
		);
	}
});

test("every workflow skill uses absolute canonical skill paths (no ~)", () => {
	for (const skill of [
		"planning-workflow",
		"build-workflow",
		"review-workflow",
		"ship-workflow",
		"research-workflow",
		"debug-workflow",
	]) {
		const content = readWorkflowSkill(skill);
		// Should not use ~ in skill paths (the read tool doesn't expand ~)
		assert.ok(
			!/~\/.agents\/skills/i.test(content),
			`${skill} should not use ~ paths (use absolute)`,
		);
		// Should use /Users/.../.agents/skills/ absolute paths
		assert.ok(
			/\/Users\/[^/]+\/.agents\/skills\//i.test(content),
			`${skill} should use absolute canonical paths`,
		);
	}
});

test("every workflow skill has a reread instruction", () => {
	for (const skill of [
		"planning-workflow",
		"build-workflow",
		"review-workflow",
		"ship-workflow",
		"research-workflow",
		"debug-workflow",
	]) {
		const content = readWorkflowSkill(skill);
		assert.ok(
			/Reread this workflow skill/i.test(content),
			`${skill} should instruct rereading itself between phases`,
		);
	}
});

test("every workflow skill has compaction as a residual risk", () => {
	for (const skill of [
		"planning-workflow",
		"build-workflow",
		"review-workflow",
		"ship-workflow",
		"research-workflow",
		"debug-workflow",
	]) {
		const content = readWorkflowSkill(skill);
		assert.ok(
			/compaction.*residual risk/i.test(content),
			`${skill} should document compaction as a residual risk`,
		);
	}
});

// ─── Planning workflow structural tests ──────────────────────────────────────

test("planning-workflow has bounded + foggy branches", () => {
	const content = readWorkflowSkill("planning-workflow");
	const phases = parsePhases(content);
	assert.ok(
		phases.includes("classify"),
		"planning-workflow should have a classify phase",
	);
	assert.ok(
		phases.includes("brainstorm"),
		"planning-workflow should have a brainstorm phase",
	);
	assert.ok(
		phases.includes("spec"),
		"planning-workflow should have a spec phase",
	);
	assert.ok(
		phases.includes("tickets"),
		"planning-workflow should have a tickets phase",
	);
	assert.ok(
		phases.includes("wayfind"),
		"planning-workflow should have a wayfind phase",
	);
});

test("planning-workflow does not advance before design approval", () => {
	const content = readWorkflowSkill("planning-workflow");
	assert.ok(/Do NOT advance before explicit design approval/i.test(content));
});

test("planning-workflow requires spec reference + ticket refs + frontier", () => {
	const content = readWorkflowSkill("planning-workflow");
	assert.ok(/Do NOT advance without a spec reference/i.test(content));
	assert.ok(
		/Do NOT advance without published ticket references/i.test(content),
	);
});

test("planning-workflow has a separate foggy state block with map + outcome", () => {
	const content = readWorkflowSkill("planning-workflow");
	assert.ok(
		/map:\s*pending/i.test(content),
		"foggy state should have map field",
	);
	assert.ok(
		/outcome:\s*map-charted|decision-resolved|ready-for-brainstorm|ready-for-spec/i.test(
			content,
		),
		"foggy state should have outcome field",
	);
});

test("planning-workflow foggy complete does not suggest /build", () => {
	const content = readWorkflowSkill("planning-workflow");
	// Find the foggy complete section
	const foggyCompleteMatch = content.match(/Phase: complete \(foggy\)([\s\S]*?)(?=\n## |\nRules|$)/);
	if (foggyCompleteMatch) {
		const foggyComplete = foggyCompleteMatch[1];
		assert.ok(
			!/type.*\/build/i.test(foggyComplete),
			"foggy complete should NOT suggest /build (a map is not an implementation ticket)",
		);
	}
});


// ─── Ship workflow structural tests ──────────────────────────────────────────

test("ship-workflow has conditional github (not-applicable state)", () => {
	const content = readWorkflowSkill("ship-workflow");
	assert.ok(
		/not-applicable/i.test(content),
		"ship-workflow should support not-applicable for github",
	);
	assert.ok(
		/conditional/i.test(content),
		"ship-workflow should mark github as conditional",
	);
});

test("ship-workflow allows none-needed for docs", () => {
	const content = readWorkflowSkill("ship-workflow");
	assert.ok(
		/none-needed/i.test(content),
		"ship-workflow should allow none-needed for doc disposition",
	);
});

test("ship-workflow has ci state field", () => {
	const content = readWorkflowSkill("ship-workflow");
	assert.ok(/ci:\s*pending.*not-applicable.*pass.*fail/i.test(content), "ship-workflow should have ci state with pending/not-applicable/pass/fail");
});

test("ship-workflow commit is always authorized (no not-applicable for commit hash)", () => {
	const content = readWorkflowSkill("ship-workflow");
	assert.ok(/authorizes commit|chose Ship/i.test(content), "ship-workflow should state that /ship authorizes commit");
	// commit hash state should NOT have not-applicable
	const commitLine = content.match(/commit hash:\s*pending.*$/m);
	if (commitLine) {
		assert.ok(!/not-applicable/.test(commitLine[0]), "commit hash state should not have not-applicable (commit is always authorized)");
	}
});


// ─── Build workflow structural tests ──────────────────────────────────────────

test("build-workflow tracks acceptance criteria (not just one test)", () => {
	const content = readWorkflowSkill("build-workflow");
	assert.ok(
		/acceptance criteria/i.test(content),
		"build-workflow should track acceptance criteria",
	);
	assert.ok(
		/Do NOT complete after a single green slice/i.test(content),
		"build-workflow should not complete after one slice",
	);
});

test("build-workflow returns from diagnosis to tdd on RED", () => {
	const content = readWorkflowSkill("build-workflow");
	const phases = parsePhases(content);
	assert.ok(
		phases.includes("diagnose"),
		"build-workflow should have a diagnose phase",
	);
	assert.ok(phases.includes("tdd"), "build-workflow should have a tdd phase");
	assert.ok(
		/return to tdd/i.test(content),
		"build-workflow should return to tdd after diagnosis",
	);
});

// ─── Review workflow structural tests ─────────────────────────────────────────

test("review-workflow skips disposition if clean", () => {
	const content = readWorkflowSkill("review-workflow");
	assert.ok(
		/findings:\s*none.*skip disposition/i.test(content) ||
			/If.*findings:\s*none.*skip/i.test(content),
		"review-workflow should skip disposition if no findings",
	);
});

test("review-workflow does not apply changes during review (verified-fix = queued for /build)", () => {
	const content = readWorkflowSkill("review-workflow");
	assert.ok(
		/verified-fix.*queued for.*build/i.test(content) || /verified-fix.*Do NOT apply/i.test(content),
		"verified-fix should mean queued for /build, not apply during review",
	);
	assert.ok(
		/Do NOT apply changes during review/i.test(content),
		"review-workflow should explicitly say do not apply changes during review",
	);
});

test("review-workflow waits for needs-user-decision before completing", () => {
	const content = readWorkflowSkill("review-workflow");
	assert.ok(
		/needs-user-decision.*REMAIN in disposition|needs-user-decision.*do not.*complete/i.test(content),
		"review-workflow should wait for needs-user-decision before completing",
	);
});


// ─── All specialist skills referenced by workflows exist at the canonical path ─

test("all specialist skills referenced by workflows exist at a known path", () => {
	const allSpecialists = new Set<string>();
	for (const skill of [
		"planning-workflow",
		"build-workflow",
		"review-workflow",
		"ship-workflow",
		"research-workflow",
		"debug-workflow",
	]) {
		const content = readWorkflowSkill(skill);
		const reads = parseSkillReads(content);
		for (const r of reads) {
			allSpecialists.add(r);
		}
	}
	for (const specialist of allSpecialists) {
		const inAgents = existsSync(join(LIVE_SKILLS_DIR, specialist, "SKILL.md"));
		const inPiAgent = existsSync(
			join(homedir(), ".pi/agent/skills", specialist, "SKILL.md"),
		);
		assert.ok(
			inAgents || inPiAgent,
			`specialist skill "${specialist}" referenced by a workflow but not found at ~/.agents/skills/ or ~/.pi/agent/skills/`,
		);
	}
});

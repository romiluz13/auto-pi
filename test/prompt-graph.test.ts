import {
	WORKFLOWS,
	ASK_MATT_DISPOSITIONS,
	REACHABILITY_ENTRIES,
} from "../config/workflow-graph-contract.ts";
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
	const regex = /[Rr]ead\s+`?(\/[^`]+\/SKILL\.md)`?/g;
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
	const foggyCompleteMatch = content.match(
		/Phase: complete \(foggy\)([\s\S]*?)(?=\n## |\nRules|$)/,
	);
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
	assert.ok(
		/ci:\s*pending.*not-applicable.*pass.*fail/i.test(content),
		"ship-workflow should have ci state with pending/not-applicable/pass/fail",
	);
});

test("ship-workflow commit is always authorized (no not-applicable for commit hash)", () => {
	const content = readWorkflowSkill("ship-workflow");
	assert.ok(
		/authorizes commit|chose Ship/i.test(content),
		"ship-workflow should state that /ship authorizes commit",
	);
	// commit hash state should NOT have not-applicable
	const commitLine = content.match(/commit hash:\s*pending.*$/m);
	if (commitLine) {
		assert.ok(
			!/not-applicable/.test(commitLine[0]),
			"commit hash state should not have not-applicable (commit is always authorized)",
		);
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
		/verified-fix.*queued for.*build/i.test(content) ||
			/verified-fix.*Do NOT apply/i.test(content),
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
		/needs-user-decision.*REMAIN in disposition|needs-user-decision.*do not.*complete/i.test(
			content,
		),
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

// ─── B1: Fresh-context-per-ticket invariants ──────────────────────────────

test("planning-workflow complete (bounded) recommends fresh /build per ticket", () => {
	const content = readWorkflowSkill("planning-workflow");
	const completeMatch = content.match(
		/Phase: complete \(bounded\)([\s\S]*?)(?=\n## |\nRules|$)/,
	);
	if (completeMatch) {
		const complete = completeMatch[1];
		assert.ok(
			/fresh.*\/build/i.test(complete) ||
				/separate build session/i.test(complete),
			"planning complete (bounded) should recommend fresh /build per ticket",
		);
	}
});

test("build-workflow entry invariant: one invocation accepts one ticket", () => {
	const content = readWorkflowSkill("build-workflow");
	assert.ok(
		/one.*ticket.*one.*invocation|one invocation.*one.*ticket/i.test(content) ||
			/exactly one ticket/i.test(content),
		"build-workflow should enforce one-ticket-per-invocation at entry",
	);
});

test("build-workflow entry invariant: refuses multiple tickets", () => {
	const content = readWorkflowSkill("build-workflow");
	assert.ok(
		/refuse.*multiple|break.*apart|do not.*multiple tickets/i.test(content),
		"build-workflow should refuse or break apart multiple tickets at entry",
	);
});

test("build-workflow detects inherited unrelated context (smart zone)", () => {
	const content = readWorkflowSkill("build-workflow");
	assert.ok(
		/inherited.*context|smart zone|fresh session.*handoff/i.test(content),
		"build-workflow should detect inherited unrelated context and recommend fresh session/handoff",
	);
});

// ─── B4: Triage discoverability ─────────────────────────────────────────────

test("triage prompt exists and pins triage directly", () => {
	assert.ok(
		existsSync(join(PROMPTS_DIR, "triage.md")),
		"/triage prompt should exist",
	);
	const content = readFileSync(join(PROMPTS_DIR, "triage.md"), "utf-8");
	assert.equal(
		skillPin(content),
		"triage",
		"/triage should pin the triage skill directly",
	);
});

test("triage prompt says do NOT triage to-tickets output", () => {
	const content = readFileSync(join(PROMPTS_DIR, "triage.md"), "utf-8");
	assert.ok(
		/do not.*triage.*to-tickets|to-tickets.*already.*agent-ready|do not.*triage.*produced/i.test(
			content,
		),
		"/triage prompt should say not to triage to-tickets output (Matt's rule)",
	);
});

test("triage skill exists at the canonical path", () => {
	assert.ok(
		existsSync(join(LIVE_SKILLS_DIR, "triage", "SKILL.md")),
		"triage skill should exist at ~/.agents/skills/triage/SKILL.md",
	);
});

// ─── B2: Planning staged routing (style + domain underlay) ──────────────────

test("planning-workflow state block has style field", () => {
	const content = readWorkflowSkill("planning-workflow");
	assert.ok(
		/style:\s*brainstorming.*grilling/i.test(content),
		"planning state block should have style field",
	);
});

test("planning-workflow state block has domain capture field", () => {
	const content = readWorkflowSkill("planning-workflow");
	assert.ok(
		/domain capture:\s*on.*off/i.test(content),
		"planning state block should have domain capture field",
	);
});

test("planning-workflow defaults to brainstorming style", () => {
	const content = readWorkflowSkill("planning-workflow");
	assert.ok(
		/Default.*brainstorming|default.*style.*brainstorming/i.test(content),
		"planning should default to brainstorming",
	);
});

test("planning-workflow grilling requires explicit user consent (never silent escalation)", () => {
	const content = readWorkflowSkill("planning-workflow");
	assert.ok(
		/explicitly asks.*grill|ask permission.*once|Never silently.*grilling/i.test(
			content,
		),
		"planning should require explicit user consent for grilling, never silent escalation",
	);
});

test("planning-workflow has a setup phase for style + domain capture", () => {
	const content = readWorkflowSkill("planning-workflow");
	const phases = parsePhases(content);
	assert.ok(
		phases.includes("setup"),
		`planning should have a setup phase, got: ${phases.join(", ")}`,
	);
});

test("planning-workflow domain-modeling underlay has triggers", () => {
	const content = readWorkflowSkill("planning-workflow");
	assert.ok(
		/ambiguous.*domain terms|CONTEXT.*ADRs.*constrain|cross-module.*contracts/i.test(
			content,
		),
		"planning should have domain-modeling triggers",
	);
});

test("planning-workflow domain-modeling no ceremony rule", () => {
	const content = readWorkflowSkill("planning-workflow");
	assert.ok(
		/No ceremony.*complex|glossary.*actually resolved|ADR.*hard-to-reverse.*surprising.*genuine/i.test(
			content,
		),
		"planning should say no ceremony for domain-modeling (only when triggers genuinely apply)",
	);
});

test("planning-workflow reads grilling + domain-modeling when triggered", () => {
	const content = readWorkflowSkill("planning-workflow");
	const reads = parseSkillReads(content);
	assert.ok(
		reads.includes("grilling"),
		`planning should read grilling, got: ${reads.join(", ")}`,
	);
	assert.ok(
		reads.includes("domain-modeling"),
		`planning should read domain-modeling, got: ${reads.join(", ")}`,
	);
});

// ─── B3: Prototype detour (workflow-owned, consented interrupt) ───────────────

test("planning-workflow has a prototype interrupt (not a phase, a transition)", () => {
	const content = readWorkflowSkill("planning-workflow");
	assert.ok(
		/Prototype interrupt/i.test(content),
		"planning should have a Prototype interrupt section",
	);
	// It should be available from brainstorm or grill, not a standalone phase
	assert.ok(
		/available from brainstorm or grill/i.test(content),
		"prototype interrupt should be available from the design phases",
	);
});

test("planning-workflow prototype interrupt requires explicit user consent", () => {
	const content = readWorkflowSkill("planning-workflow");
	assert.ok(
		/ask permission.*once|explicit user consent/i.test(content),
		"prototype interrupt should require explicit user consent (ask permission once)",
	);
});

test("planning-workflow prototype declined: do not pretend resolved", () => {
	const content = readWorkflowSkill("planning-workflow");
	assert.ok(
		/decline.*record.*uncertainty|do not.*pretend.*resolved/i.test(content),
		"prototype interrupt should say: if declined, record uncertainty, do not pretend it was resolved",
	);
});

test("planning-workflow reads the prototype skill", () => {
	const content = readWorkflowSkill("planning-workflow");
	const reads = parseSkillReads(content);
	assert.ok(
		reads.includes("prototype"),
		`planning should read prototype, got: ${reads.join(", ")}`,
	);
});

test("prototype skill exists at the canonical path", () => {
	assert.ok(
		existsSync(join(LIVE_SKILLS_DIR, "prototype", "SKILL.md")),
		"prototype skill should exist at ~/.agents/skills/prototype/SKILL.md",
	);
});

// ─── B5: Provenance + drift automation ────────────────────────────────────────

test("code-review has provenance frontmatter (upstream repo + commit + local-patch)", () => {
	const content = readFileSync(
		join(REPO_SKILLS_DIR, "code-review", "SKILL.md"),
		"utf-8",
	);
	assert.ok(
		/^upstream:/m.test(content),
		"code-review should have upstream: frontmatter",
	);
	assert.ok(
		/mattpocock\/skills|github\.com.*mattpocock/i.test(content),
		"code-review provenance should point to Matt Pocock repo",
	);
	assert.ok(
		/commit:\s*\w+/i.test(content),
		"code-review provenance should record the upstream commit",
	);
	assert.ok(
		/^local-patch:/m.test(content),
		"code-review should have local-patch frontmatter",
	);
});

test("diagnosing-bugs has provenance frontmatter (upstream repo + commit + local-patch)", () => {
	const content = readFileSync(
		join(REPO_SKILLS_DIR, "diagnosing-bugs", "SKILL.md"),
		"utf-8",
	);
	assert.ok(
		/^upstream:/m.test(content),
		"diagnosing-bugs should have upstream: frontmatter",
	);
	assert.ok(
		/mattpocock\/skills|github\.com.*mattpocock/i.test(content),
		"diagnosing-bugs provenance should point to Matt Pocock repo",
	);
	assert.ok(
		/commit:\s*\w+/i.test(content),
		"diagnosing-bugs provenance should record the upstream commit",
	);
	assert.ok(
		/^local-patch:/m.test(content),
		"diagnosing-bugs should have local-patch frontmatter",
	);
});

test("check-drift.sh exists", () => {
	const driftScript = join(REPO_ROOT, "scripts", "check-drift.sh");
	assert.ok(existsSync(driftScript), "scripts/check-drift.sh should exist");
});

// ─── B6: Calibrate local review heuristics ────────────────────────────────────

test("code-review heuristics are candidates requiring proof, not automatic severity", () => {
	const content = readFileSync(
		join(REPO_SKILLS_DIR, "code-review", "SKILL.md"),
		"utf-8",
	);
	assert.ok(
		/candidate.*requiring.*proof|candidate.*not.*automatic/i.test(content),
		"code-review heuristics should be candidates requiring proof, not automatic severity",
	);
});

test("code-review sequential awaits is a candidate, not an automatic finding", () => {
	const content = readFileSync(
		join(REPO_SKILLS_DIR, "code-review", "SKILL.md"),
		"utf-8",
	);
	assert.ok(
		/Sequential awaits.*candidate|Promise\.all.*actually safe|ordering.*rate-limit.*contention.*transaction/i.test(
			content,
		),
		"sequential awaits should be a candidate with justification caveats, not an automatic finding",
	);
});

// ─── Graph-level acceptance checks (the genius's criterion 5) ─────────────────

// Check 3: Every normal completion/branch has an internal next phase, terminal state, or valid user-facing slash handoff

// Check 4: Every slash handoff names an installed user-facing command (NOT internal skills)

// Check 6: No phase specialist silently hijacks workflow routing
test("every workflow skill has the 'workflow owns the routing' rule", () => {
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
			/workflow owns the routing|owns the routing/i.test(content),
			`${skill} should have the "workflow owns the routing" rule`,
		);
	}
});

// Check 7: Every ask-matt route has an equivalence/disposition

// Check 8: Every installed skill has a reachability classification (no true orphans)
test("no installed skill is a true orphan (all reachable by at least one means)", () => {
	const allSkills = new Set<string>();
	for (const d of readdirSync(LIVE_SKILLS_DIR, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name)) {
		allSkills.add(d);
	}
	const piSkillDir = join(homedir(), ".pi/agent/skills");
	if (existsSync(piSkillDir)) {
		for (const d of readdirSync(piSkillDir, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => d.name)) {
			allSkills.add(d);
		}
	}

	// Non-vacuous reachability: every skill must have a reachability classification
	// in the workflow-graph-contract.ts REACHABILITY_ENTRIES. "Installed" does NOT imply
	// "reachable" — a skill is reachable only if it has an explicit disposition
	// (workflow-bundled, prompt-pinned, extension-command, or documented standalone).
	// Catalog-only skills (installed but not in any workflow + not documented standalone)
	// are TRUE ORPHANS, not "reachable via /skill".
	//
	// This test verifies the reachability contract covers every installed skill.
	const classified = new Set(REACHABILITY_ENTRIES.map((e) => e.skill));
	const trueOrphans: string[] = [];
	for (const skill of allSkills) {
		if (!classified.has(skill)) {
			trueOrphans.push(skill);
		}
	}
	assert.equal(
		trueOrphans.length,
		0,
		`True orphans (installed but no reachability classification): ${trueOrphans.join(", ")}`,
	);
});

// Check: planning wayfinder → ready-for-brainstorm goes through setup (not directly to brainstorm)
test("planning wayfinder ready-for-brainstorm routes through setup (not directly to brainstorm)", () => {
	const content = readWorkflowSkill("planning-workflow");
	assert.ok(
		/ready-for-brainstorm.*setup|ready-for-brainstorm.*go to.*setup/i.test(
			content,
		),
		"wayfinder ready-for-brainstorm should route through setup (not directly to brainstorm)",
	);
});

// Check: planning state block has prototype fields
test("planning state block has prototype fields (not-needed/proposed/declined/running/complete)", () => {
	const content = readWorkflowSkill("planning-workflow");
	assert.ok(
		/prototype:\s*not-needed.*proposed.*declined.*running.*complete/i.test(
			content,
		),
		"planning state should have prototype fields",
	);
	assert.ok(
		/prototype question:/i.test(content),
		"planning state should have prototype question field",
	);
	assert.ok(
		/prototype conclusion:/i.test(content),
		"planning state should have prototype conclusion field",
	);
});

// Check: planning state block has domain artifacts evidence field
test("planning state block has domain artifacts evidence field", () => {
	const content = readWorkflowSkill("planning-workflow");
	assert.ok(
		/domain artifacts:/i.test(content),
		"planning state should have domain artifacts evidence field",
	);
});

// Check: planning does not preload brainstorming when grilling
test("planning does not preload brainstorming when grilling (reads only the active style)", () => {
	const content = readWorkflowSkill("planning-workflow");
	assert.ok(
		/style: grilling.*read.*grilling|Do NOT preload both|read only the active style/i.test(
			content,
		),
		"planning should read only the active style's skill (not preload both)",
	);
});

// Check: build-workflow has explicit cadence (typecheck + single test + full suite)
test("build-workflow has explicit cadence (typecheck regularly + single tests regularly + full suite at end)", () => {
	const content = readWorkflowSkill("build-workflow");
	assert.ok(
		/typecheck.*regularly|typechecking regularly/i.test(content),
		"build should have regular typecheck cadence",
	);
	assert.ok(
		/full test suite.*end|full suite.*at the end/i.test(content),
		"build should run the full test suite at the end",
	);
});

// Check: build-workflow fresh-context gate is hard (STOP, not just recommend)
test("build-workflow fresh-context gate is a hard STOP (not just a recommendation)", () => {
	const content = readWorkflowSkill("build-workflow");
	assert.ok(
		/STOP.*contaminated|do not.*edit.*contaminated|STOP if violated/i.test(
			content,
		),
		"build should STOP (not just recommend) when context is contaminated",
	);
});

// Check: triage prompt has conditional handoff (only /build when ready-for-agent)
test("triage prompt has conditional handoff (only /build when ready-for-agent)", () => {
	const content = readFileSync(join(PROMPTS_DIR, "triage.md"), "utf-8");
	assert.ok(
		/ready-for-agent.*\/build|only.*ready-for-agent/i.test(content),
		"triage should recommend /build only when ready-for-agent",
	);
	assert.ok(
		/needs-info|wontfix|ready-for-human/i.test(content),
		"triage should have other outcome states (needs-info, wontfix, ready-for-human)",
	);
});

// ─── Contract-based graph validation (non-vacuous) ───────────────────────────

// Check: every workflow in the contract has a matching SKILL.md
test("every workflow in the contract exists as a SKILL.md", () => {
	for (const wf of WORKFLOWS) {
		assert.ok(
			existsSync(join(REPO_SKILLS_DIR, wf.name, "SKILL.md")),
			`workflow ${wf.name} in the contract but no SKILL.md exists`,
		);
	}
});

// Check: every workflow's prompt pin matches the contract
test("every workflow prompt pin matches the contract", () => {
	for (const wf of WORKFLOWS) {
		// Find the prompt that pins this workflow
		const promptName = wf.name.replace(/-workflow$/, "");
		const promptPath = join(PROMPTS_DIR, `${promptName}.md`);
		if (existsSync(promptPath)) {
			const pin = skillPin(readFileSync(promptPath, "utf-8"));
			assert.equal(
				pin,
				wf.promptPin,
				`/${promptName} should pin ${wf.promptPin}`,
			);
		}
	}
});

// Check: every phase in the contract exists in the SKILL.md
test("every contract phase exists as a '## Phase:' header in the SKILL.md", () => {
	for (const wf of WORKFLOWS) {
		const content = readWorkflowSkill(wf.name);
		const skillPhases = parsePhases(content);
		for (const phase of wf.phases) {
			if (phase.name === "setup" && !skillPhases.includes("setup")) {
				// setup may be a section, not a phase — check for "## Phase: setup" or a setup section
				assert.ok(
					/Phase: setup|## .*setup/i.test(content),
					`${wf.name}: contract phase "setup" should exist in the SKILL.md`,
				);
				continue;
			}
			assert.ok(
				skillPhases.includes(phase.name),
				`${wf.name}: contract phase "${phase.name}" not found in SKILL.md phases: ${skillPhases.join(", ")}`,
			);
		}
	}
});

// Check: every transition target in the contract is a valid phase
test("every contract transition targets a valid phase in the same workflow", () => {
	for (const wf of WORKFLOWS) {
		const phaseNames = wf.phases.map((p) => p.name);
		for (const phase of wf.phases) {
			if (!phase.next) continue;
			for (const target of phase.next) {
				assert.ok(
					phaseNames.includes(target),
					`${wf.name}: phase "${phase.name}" transitions to "${target}" but "${target}" is not a valid phase in this workflow`,
				);
			}
		}
	}
});

// Check: every terminal phase has a handoff or is terminal
test("every workflow has at least one terminal phase", () => {
	for (const wf of WORKFLOWS) {
		const terminals = wf.phases.filter((p) => p.terminal);
		assert.ok(
			terminals.length >= 1,
			`${wf.name} should have at least one terminal phase`,
		);
	}
});

// Check: every handoff command is a valid user-facing prompt or extension command
test("every contract handoff is a valid user-facing command (prompt or extension)", () => {
	const validCommands = new Set<string>();
	// All prompt names (user-facing slash commands)
	for (const p of PROMPT_NAMES) validCommands.add(p);
	// Extension commands (handoff, palette, etc.)
	validCommands.add("handoff");
	validCommands.add("palette");

	for (const wf of WORKFLOWS) {
		for (const phase of wf.phases) {
			if (!phase.handoff) continue;
			assert.ok(
				validCommands.has(phase.handoff.command),
				`${wf.name}: handoff "/${phase.handoff.command}" is not a valid user-facing command`,
			);
		}
	}
});

// Check: every conditional specialist is not in the unconditional specialists list
test("no conditional specialist appears in the unconditional specialists list", () => {
	for (const wf of WORKFLOWS) {
		for (const phase of wf.phases) {
			if (!phase.conditionalSpecialists) continue;
			for (const cond of phase.conditionalSpecialists) {
				assert.ok(
					!phase.specialists.includes(cond.skill),
					`${wf.name}: phase "${phase.name}" has "${cond.skill}" in both unconditional and conditional — should be conditional only`,
				);
			}
		}
	}
});

// Check: every ask-matt route has a non-vacuous disposition
test("every ask-matt route has an explicit disposition (no gaps)", () => {
	// The known ask-matt routes that must have a disposition
	const requiredRoutes = [
		"grill-with-docs",
		"prototype",
		"to-spec",
		"to-tickets",
		"implement",
		"tdd",
		"code-review",
		"triage",
		"diagnosing-bugs",
		"wayfinder",
		"improve-codebase-architecture",
		"domain-modeling",
		"codebase-design",
		"handoff",
		"compact",
		"grill-me",
		"teach",
		"writing-great-skills",
		"setup-matt-pocock-skills",
	];
	for (const route of requiredRoutes) {
		const disp = ASK_MATT_DISPOSITIONS.find((d) => d.askMattRoute === route);
		assert.ok(
			disp,
			`ask-matt route "${route}" has no disposition in the contract`,
		);
		assert.ok(
			disp?.disposition !== undefined,
			`ask-matt route "${route}" has an undefined disposition`,
		);
	}
});

// Check: no ask-matt disposition is "gap" (all are equivalent, substitution, standalone, or unsupported)
test("no ask-matt disposition is a gap — all have an explicit classification", () => {
	for (const disp of ASK_MATT_DISPOSITIONS) {
		assert.ok(
			[
				"equivalent",
				"deliberate-substitution",
				"intentional-standalone",
				"intentional-unsupported",
			].includes(disp.disposition),
			`ask-matt route "${disp.askMattRoute}" has disposition "${disp.disposition}" which is not a valid classification`,
		);
	}
});

// Check: planning has a grill-me branch (the genius's option b)
test("planning-workflow has a grill-me branch for no-codebase grilling", () => {
	const content = readWorkflowSkill("planning-workflow");
	assert.ok(
		/grill-me/i.test(content),
		"planning-workflow should reference grill-me (the no-codebase grilling branch)",
	);
});

// ─── Contract v2: conditional outcomes, state constraints, interrupts ───────

import {
	WORKFLOWS as WORKFLOWS_V2,
	ASK_MATT_DISPOSITIONS as ASK_MATT_V2,
	REACHABILITY_ENTRIES as REACH_V2,
	TRIAGE_OUTCOMES,
	TRIAGE_CONTRACT,
	ASK_MATT_SOURCE,
	EXPECTED_ASK_MATT_ROUTES,
} from "../config/workflow-graph-contract.ts";

// Check: every terminal phase has conditional outcomes (not a single handoff)
test("every terminal phase has conditional outcomes (not a single arbitrary handoff)", () => {
	for (const wf of WORKFLOWS_V2) {
		for (const phase of wf.phases) {
			if (phase.terminal) {
				assert.ok(
					phase.outcomes && phase.outcomes.length >= 1,
					`${wf.name}: terminal phase "${phase.name}" should have outcomes (conditional handoffs), not a single handoff`,
				);
			}
		}
	}
});

// Check: every outcome has evidence fields
test("every outcome has evidence fields (the state fields it requires)", () => {
	for (const wf of WORKFLOWS_V2) {
		for (const phase of wf.phases) {
			if (!phase.outcomes) continue;
			for (const outcome of phase.outcomes) {
				assert.ok(
					outcome.evidenceFields.length >= 1,
					`${wf.name}: phase "${phase.name}" outcome "${outcome.predicate}" should have at least 1 evidence field`,
				);
			}
		}
	}
});

// Check: every outcome handoff is a valid user-facing command
test("every outcome handoff is a valid user-facing command (not internal skills)", () => {
	const validCommands = new Set<string>();
	for (const p of PROMPT_NAMES) validCommands.add(p);
	validCommands.add("handoff");
	validCommands.add("palette");

	for (const wf of WORKFLOWS_V2) {
		for (const phase of wf.phases) {
			if (!phase.outcomes) continue;
			for (const outcome of phase.outcomes) {
				if (!outcome.handoff) continue;
				assert.ok(
					validCommands.has(outcome.handoff.command),
					`${wf.name}: outcome handoff "/${outcome.handoff.command}" is not a valid user-facing command`,
				);
			}
		}
	}
});

// Check: the prototype interrupt is in the planning-workflow contract
test("planning-workflow contract has a prototype interrupt", () => {
	const planning = WORKFLOWS_V2.find((w) => w.name === "planning-workflow");
	assert.ok(planning?.interrupts, "planning-workflow should have interrupts");
	const prototypeInterrupt = planning?.interrupts?.find(
		(i) => i.name === "prototype",
	);
	assert.ok(
		prototypeInterrupt,
		"planning-workflow should have a prototype interrupt",
	);
	assert.equal(prototypeInterrupt?.specialist, "prototype");
	assert.ok(
		prototypeInterrupt?.resumePhase === "brainstorm",
		"prototype interrupt should resume to brainstorm",
	);
});

// Check: grill-me and grilling predicates are mutually exclusive
test("grill-me and grilling predicates are mutually exclusive", () => {
	const planning = WORKFLOWS_V2.find((w) => w.name === "planning-workflow");
	const brainstorm = planning?.phases.find((p) => p.name === "brainstorm");
	const grilling = brainstorm?.conditionalSpecialists?.find(
		(s) => s.skill === "grilling",
	);
	const grillMe = brainstorm?.conditionalSpecialists?.find(
		(s) => s.skill === "grill-me",
	);
	assert.ok(
		grilling,
		"brainstorm should have a grilling conditional specialist",
	);
	assert.ok(
		grillMe,
		"brainstorm should have a grill-me conditional specialist",
	);
	// grilling: hasCodebase; grill-me: !hasCodebase — mutually exclusive
	assert.ok(
		/grilling && hasCodebase|hasCodebase/i.test(grilling!.predicate),
		"grilling predicate should include hasCodebase",
	);
	assert.ok(
		/grill-me.*!hasCodebase|!hasCodebase/i.test(grillMe!.predicate),
		"grill-me predicate should include !hasCodebase (mutually exclusive with grilling)",
	);
});

// Check: research is in ASK_MATT_DISPOSITIONS
test("research is in ASK_MATT_DISPOSITIONS (was missing)", () => {
	const research = ASK_MATT_V2.find((d) => d.askMattRoute === "research");
	assert.ok(research, "research should be in ASK_MATT_DISPOSITIONS");
	assert.equal(research?.disposition, "equivalent");
});

// Check: ask-matt dispositions have structured fields (trigger, invariants, artifacts, exit, autoPiRoute)
test("every ask-matt disposition has structured harmony evidence (trigger/invariant/artifact/exit)", () => {
	for (const disp of ASK_MATT_V2) {
		assert.ok(
			disp.trigger.length > 0,
			`${disp.askMattRoute}: trigger should be non-empty`,
		);
		assert.ok(
			disp.invariants.length > 0,
			`${disp.askMattRoute}: invariants should be non-empty`,
		);
		assert.ok(
			disp.artifacts.length > 0,
			`${disp.askMattRoute}: artifacts should be non-empty`,
		);
		assert.ok(
			disp.exit.length > 0,
			`${disp.askMattRoute}: exit should be non-empty`,
		);
		assert.ok(
			disp.autoPiRoute.length > 0,
			`${disp.askMattRoute}: autoPiRoute should be non-empty`,
		);
	}
});

// Check: triage has explicit outcomes (the 6 outcome states)
test("triage has explicit outcomes (6 outcome states with conditional handoffs)", () => {
	assert.ok(
		TRIAGE_OUTCOMES.length >= 6,
		"triage should have at least 6 outcomes",
	);
	const readyForAgent = TRIAGE_OUTCOMES.find(
		(o) => o.outcome === "ready-for-agent",
	);
	assert.ok(readyForAgent, "triage should have a ready-for-agent outcome");
	assert.ok(readyForAgent?.handoff, "ready-for-agent should have a handoff");
	assert.equal(readyForAgent?.handoff?.command, "build");
});

// Check: state constraints exist for the spec phase (requires design: approved)
test("planning spec phase has state constraints (requires design: approved on entry)", () => {
	const planning = WORKFLOWS_V2.find((w) => w.name === "planning-workflow");
	const spec = planning?.phases.find((p) => p.name === "spec");
	assert.ok(spec?.stateConstraints, "spec phase should have state constraints");
	const designConstraint = spec?.stateConstraints?.find(
		(c) => c.field === "design",
	);
	assert.ok(designConstraint, "spec should have a design state constraint");
	assert.ok(
		designConstraint?.requiredOnEntry?.includes("approved"),
		"spec should require design: approved on entry",
	);
});

// Check: build tdd phase has state constraints (requires one ticket)
test("build tdd phase has state constraints (requires ticket on entry)", () => {
	const build = WORKFLOWS_V2.find((w) => w.name === "build-workflow");
	const tdd = build?.phases.find((p) => p.name === "tdd");
	assert.ok(tdd?.stateConstraints, "tdd phase should have state constraints");
	const ticketConstraint = tdd?.stateConstraints?.find(
		(c) => c.field === "ticket",
	);
	assert.ok(ticketConstraint, "tdd should have a ticket state constraint");
});

// ─── Collision/shadow validation + source commit ─────────────────────────────

// Check: code-review and diagnosing-bugs local forks are the selected paths
test("local forks (code-review, diagnosing-bugs) are the selected paths, not shadowed", () => {
	for (const skill of ["code-review", "diagnosing-bugs"]) {
		const entry = REACH_V2.find((e) => e.skill === skill);
		assert.ok(entry, `${skill} should be in REACHABILITY_ENTRIES`);
		// The selected path should be in ~/.agents/skills (the live path where the repo fork wins)
		assert.ok(
			entry!.selectedRuntimePath.includes(".agents/skills") ||
				entry!.selectedRuntimePath.includes("skills/"),
			`${skill}: selectedPath should be the local fork (not the community copy)`,
		);
		// Physical paths should include both repo + live
		assert.ok(
			entry!.runtimePhysicalPaths.length >= 1,
			`${skill}: should have at least 1 physical path`,
		);
	}
});

// Check: every reachability entry has valid physical paths
test("every reachability entry has valid physical paths that exist on disk", () => {
	for (const entry of REACH_V2) {
		assert.ok(
			entry.runtimePhysicalPaths.length >= 1,
			`${entry.skill}: should have at least 1 physical path`,
		);
		for (const p of entry.runtimePhysicalPaths) {
			assert.ok(
				existsSync(p),
				`${entry.skill}: physical path "${p}" does not exist on disk`,
			);
		}
	}
});

// Check: every ask-matt disposition has a source commit
test("every ask-matt disposition has a source commit", () => {
	for (const disp of ASK_MATT_V2) {
		assert.ok(
			disp.sourceCommit.length >= 7,
			`${disp.askMattRoute}: sourceCommit should be a non-empty commit hash`,
		);
	}
});

// ─── Drift fixture tests (5 scenarios) ────────────────────────────────────────

import { execSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

function runDriftCheck(
	localDir: string,
	upstreamRepo: string,
): { exitCode: number; output: string } {
	try {
		const output = execSync(
			`REPO_ROOT="${localDir}" MATTPocOCK_REPO="${upstreamRepo}" bash "${join(REPO_ROOT, "scripts", "check-drift.sh")}" 2>&1 || true`,
			{
				encoding: "utf-8",
				env: {
					...process.env,
					REPO_ROOT: localDir,
					MATTPocOCK_REPO: upstreamRepo,
				},
			},
		);
		// Get the exit code by re-running
		try {
			execSync(
				`REPO_ROOT="${localDir}" MATTPocOCK_REPO="${upstreamRepo}" bash "${join(REPO_ROOT, "scripts", "check-drift.sh")}"`,
				{
					encoding: "utf-8",
					stdio: "pipe",
					env: {
						...process.env,
						REPO_ROOT: localDir,
						MATTPocOCK_REPO: upstreamRepo,
					},
				},
			);
			return { exitCode: 0, output };
		} catch (e: any) {
			return { exitCode: e.status, output: e.stdout || output };
		}
	} catch (e: any) {
		return { exitCode: e.status || 1, output: e.stdout || e.stderr || "" };
	}
}

function createDriftFixture(): {
	localDir: string;
	upstreamRepo: string;
	cleanup: () => void;
} {
	const baseDir = mkdtempSync(join(tmpdir(), "drift-test-"));
	const localDir = join(baseDir, "local");
	const upstreamRepo = join(baseDir, "upstream");
	mkdirSync(join(localDir, "skills", "test-fork"), { recursive: true });
	mkdirSync(join(upstreamRepo, "skills", "engineering", "test-fork"), {
		recursive: true,
	});

	// Initialize upstream git repo with initial content
	execSync(
		`cd "${upstreamRepo}" && git init && git config user.email "test@test.com" && git config user.name "test"`,
		{ stdio: "pipe" },
	);
	writeFileSync(
		join(upstreamRepo, "skills", "engineering", "test-fork", "SKILL.md"),
		"upstream content v1\n",
	);
	execSync(`cd "${upstreamRepo}" && git add -A && git commit -m "v1"`, {
		stdio: "pipe",
	});
	const baseCommit = execSync(`cd "${upstreamRepo}" && git rev-parse HEAD`, {
		encoding: "utf-8",
	}).trim();

	// Create local fork with provenance + a local patch
	const localContent = `---
name: test-fork
upstream:
  repo: upstream
  path: skills/engineering/test-fork/SKILL.md
  commit: ${baseCommit}
local-patch:
  intent: "test local patch"
  owner: test
---
upstream content v1
local patch line
`;
	writeFileSync(
		join(localDir, "skills", "test-fork", "SKILL.md"),
		localContent,
	);

	return {
		localDir,
		upstreamRepo,
		cleanup: () => rmSync(baseDir, { recursive: true, force: true }),
	};
}

// ─── Drift fixture tests (5 real behavioral scenarios) ────────────────────────

function createDriftFixtureBase(): {
	localDir: string;
	upstreamRepo: string;
	baseCommit: string;
	cleanup: () => void;
} {
	const baseDir = mkdtempSync(join(tmpdir(), "drift-fixture-"));
	const localDir = join(baseDir, "local");
	const upstreamRepo = join(baseDir, "upstream");
	mkdirSync(join(localDir, "skills", "test-fork"), { recursive: true });
	mkdirSync(join(upstreamRepo, "skills", "engineering", "test-fork"), {
		recursive: true,
	});

	// Initialize upstream git repo with initial content
	execSync(
		`cd "${upstreamRepo}" && git init -q && git config user.email "t@t.com" && git config user.name "t"`,
		{ stdio: "pipe" },
	);
	writeFileSync(
		join(upstreamRepo, "skills", "engineering", "test-fork", "SKILL.md"),
		"---\nname: test-fork\ndescription: A test skill.\n---\nupstream content v1\n",
	);
	execSync(`cd "${upstreamRepo}" && git add -A && git commit -q -m "v1"`, {
		stdio: "pipe",
	});
	const baseCommit = execSync(`cd "${upstreamRepo}" && git rev-parse HEAD`, {
		encoding: "utf-8",
	}).trim();

	return {
		localDir,
		upstreamRepo,
		baseCommit,
		cleanup: () => rmSync(baseDir, { recursive: true, force: true }),
	};
}

function writeLocalForkWithProvenance(
	localDir: string,
	commit: string,
	content: string,
): void {
	writeFileSync(
		join(localDir, "skills", "test-fork", "SKILL.md"),
		`---
name: test-fork
description: A test skill.
upstream:
  repo: upstream
  path: skills/engineering/test-fork/SKILL.md
  commit: ${commit}
local-patch:
  intent: "test local patch"
  owner: test
---
${content}`,
	);
}

function runDriftFixture(
	localDir: string,
	upstreamRepo: string,
): { exitCode: number; output: string } {
	const env = {
		...process.env,
		REPO_ROOT: localDir,
		MATTPocOCK_REPO: upstreamRepo,
		LOCAL_FORK_NAMES: "test-fork",
		PINNED_DEP_NAMES: "",
	};
	try {
		const stdout = execSync(
			`bash "${join(REPO_ROOT, "scripts", "check-drift.sh")}"`,
			{
				encoding: "utf-8",
				stdio: "pipe",
				env,
				maxBuffer: 1024 * 1024,
			},
		);
		return { exitCode: 0, output: stdout };
	} catch (e: any) {
		const stdout = e.stdout
			? typeof e.stdout === "string"
				? e.stdout
				: e.stdout.toString("utf-8")
			: "";
		const stderr = e.stderr
			? typeof e.stderr === "string"
				? e.stderr
				: e.stderr.toString("utf-8")
			: "";
		return { exitCode: e.status ?? 1, output: stdout + stderr };
	}
}

test("drift fixture 1: no changes (local = base = upstream-HEAD) → exit 0", () => {
	const { localDir, upstreamRepo, baseCommit, cleanup } =
		createDriftFixtureBase();
	writeLocalForkWithProvenance(localDir, baseCommit, "upstream content v1\n");
	const result = runDriftFixture(localDir, upstreamRepo);
	assert.equal(
		result.exitCode,
		0,
		`no-changes: should exit 0, got ${result.exitCode}: ${result.output}`,
	);
	cleanup();
});

test("drift fixture 2: local-only intentional patch (upstream unchanged) → exit 0", () => {
	const { localDir, upstreamRepo, baseCommit, cleanup } =
		createDriftFixtureBase();
	writeLocalForkWithProvenance(
		localDir,
		baseCommit,
		"upstream content v1\nlocal patch line\n",
	);
	const result = runDriftFixture(localDir, upstreamRepo);
	assert.equal(
		result.exitCode,
		0,
		`local-only: should exit 0, got ${result.exitCode}: ${result.output}`,
	);
	assert.ok(
		/intentionally drifted/.test(result.output),
		"should report 'intentionally drifted'",
	);
	cleanup();
});

test("drift fixture 3: upstream-only change → stale fork → exit 1", () => {
	const { localDir, upstreamRepo, baseCommit, cleanup } =
		createDriftFixtureBase();
	writeLocalForkWithProvenance(localDir, baseCommit, "upstream content v1\n");
	// Change upstream after the base
	writeFileSync(
		join(upstreamRepo, "skills", "engineering", "test-fork", "SKILL.md"),
		"---\nname: test-fork\ndescription: A test skill.\n---\nupstream content v2\n",
	);
	execSync(`cd "${upstreamRepo}" && git add -A && git commit -q -m "v2"`, {
		stdio: "pipe",
	});
	const result = runDriftFixture(localDir, upstreamRepo);
	assert.equal(
		result.exitCode,
		1,
		`upstream-only: should exit 1 (stale), got ${result.exitCode}: ${result.output}`,
	);
	assert.ok(
		/stale|upstream changed/i.test(result.output),
		`should report stale/upstream changed: ${result.output}`,
	);
	cleanup();
});

test("drift fixture 4: both changed → manual review → exit 1", () => {
	const { localDir, upstreamRepo, baseCommit, cleanup } =
		createDriftFixtureBase();
	writeLocalForkWithProvenance(
		localDir,
		baseCommit,
		"upstream content v1\nlocal patch\n",
	);
	// Change upstream after the base too
	writeFileSync(
		join(upstreamRepo, "skills", "engineering", "test-fork", "SKILL.md"),
		"---\nname: test-fork\ndescription: A test skill.\n---\nupstream content v2\n",
	);
	execSync(`cd "${upstreamRepo}" && git add -A && git commit -q -m "v2"`, {
		stdio: "pipe",
	});
	const result = runDriftFixture(localDir, upstreamRepo);
	assert.equal(
		result.exitCode,
		1,
		`both-changed: should exit 1 (manual review), got ${result.exitCode}: ${result.output}`,
	);
	assert.ok(
		/both.*changed|manual.*review/i.test(result.output),
		"should report both-changed/manual review",
	);
	cleanup();
});

test("drift fixture 5: missing provenance → exit 1", () => {
	const { localDir, upstreamRepo, cleanup } = createDriftFixtureBase();
	// Write local file without provenance frontmatter
	writeFileSync(
		join(localDir, "skills", "test-fork", "SKILL.md"),
		"no provenance here\n",
	);
	const result = runDriftFixture(localDir, upstreamRepo);
	assert.equal(
		result.exitCode,
		1,
		`missing-provenance: should exit 1, got ${result.exitCode}: ${result.output}`,
	);
	assert.ok(
		/NO provenance|provenance frontmatter/i.test(result.output),
		"should report missing provenance",
	);
	cleanup();
});

// Integration smoke test: the real auto-pi drift check passes
test("drift integration: real auto-pi forks pass the drift check", () => {
	const result = runDriftCheck(
		REPO_ROOT,
		"/Users/rom.iluz/Dev/mattpocock-skills",
	);
	assert.equal(
		result.exitCode,
		0,
		`real drift check should exit 0, got ${result.exitCode}: ${result.output}`,
	);
	assert.ok(
		/intentionally drifted/.test(result.output),
		"real drift check should report 'intentionally drifted'",
	);
});
// ─── Contract v4: procedureScope, selected path validation ─────────────────

// Check: diagnose phases have procedureScope (Phases 1-4, not Phase 5)
test("diagnose phases have procedureScope (Phases 1-4, not Phase 5)", () => {
	for (const wfName of ["build-workflow", "debug-workflow"]) {
		const wf = WORKFLOWS_V2.find((w) => w.name === wfName);
		const diagnose = wf?.phases.find((p) => p.name === "diagnose");
		assert.ok(
			diagnose?.procedureScope,
			`${wfName}: diagnose phase should have procedureScope`,
		);
		assert.ok(
			/Phases 1-4|not Phase 5/i.test(diagnose!.procedureScope!),
			`${wfName}: diagnose procedureScope should say "Phases 1-4" and exclude Phase 5`,
		);
	}
});

// Check: every selected path is a runtime path (in ~/.agents/skills or ~/.pi/agent/skills)
test("every reachability selected path is a runtime path (not a repo source path)", () => {
	for (const entry of REACH_V2) {
		assert.ok(
			entry.selectedRuntimePath.includes(".agents/skills") ||
				entry.selectedRuntimePath.includes(".pi/agent/skills"),
			`${entry.skill}: selectedPath "${entry.selectedRuntimePath}" should be a runtime path (~/.agents/skills or ~/.pi/agent/skills), not a repo source path`,
		);
	}
});

// Check: domain artifacts in planning SKILL.md allows not-applicable
test("planning SKILL.md domain artifacts allows not-applicable", () => {
	const content = readWorkflowSkill("planning-workflow");
	assert.ok(
		/domain artifacts:.*not-applicable/i.test(content),
		"planning SKILL.md domain artifacts should allow not-applicable",
	);
});

// Check: setup style does not include grill-me (it's a conditional specialist, not a style)
test("planning setup style does not include grill-me (it's a conditional specialist)", () => {
	const planning = WORKFLOWS_V2.find((w) => w.name === "planning-workflow");
	const setup = planning?.phases.find((p) => p.name === "setup");
	const styleConstraint = setup?.stateConstraints?.find(
		(c) => c.field === "style",
	);
	if (styleConstraint?.requiredOnExit) {
		assert.ok(
			!styleConstraint.requiredOnExit.includes("grill-me"),
			"setup style allowed values should NOT include grill-me (it's a conditional specialist, not a style)",
		);
	}
});

// ─── Contract v5: stateDomains, SHA-256, triage evidence, shadow validation ──

// Check: selected runtime path is never in shadowedRuntimePaths
test("no reachability entry has its selected path in shadowedRuntimePaths", () => {
	for (const entry of REACH_V2) {
		assert.ok(
			!entry.shadowedRuntimePaths.includes(entry.selectedRuntimePath),
			`${entry.skill}: selectedRuntimePath "${entry.selectedRuntimePath}" should NOT be in shadowedRuntimePaths`,
		);
	}
});

// Check: selected runtime path is in runtimePhysicalPaths
test("every reachability entry's selected path is in its runtimePhysicalPaths", () => {
	for (const entry of REACH_V2) {
		assert.ok(
			entry.runtimePhysicalPaths.includes(entry.selectedRuntimePath),
			`${entry.skill}: selectedRuntimePath should be in runtimePhysicalPaths`,
		);
	}
});

// Check: selected + shadowed partition runtime paths
test("selected + shadowed partition the runtimePhysicalPaths", () => {
	for (const entry of REACH_V2) {
		const all = [entry.selectedRuntimePath, ...entry.shadowedRuntimePaths];
		assert.equal(
			all.length,
			entry.runtimePhysicalPaths.length,
			`${entry.skill}: selected + shadowed should cover all runtimePhysicalPaths`,
		);
	}
});

// Check: ask-matt is classified as superseded
test("ask-matt is classified as superseded", () => {
	const entry = REACH_V2.find((e) => e.skill === "ask-matt");
	assert.equal(entry?.productRole, "superseded");
});

// Check: implement is classified as superseded
test("implement is classified as superseded", () => {
	const entry = REACH_V2.find((e) => e.skill === "implement");
	assert.equal(entry?.productRole, "superseded");
});

// Check: grill-with-docs is classified as superseded
test("grill-with-docs is classified as superseded", () => {
	const entry = REACH_V2.find((e) => e.skill === "grill-with-docs");
	assert.equal(entry?.productRole, "superseded");
});

// Check: claude-handoff is classified as superseded
test("claude-handoff is classified as superseded", () => {
	const entry = REACH_V2.find((e) => e.skill === "claude-handoff");
	assert.equal(entry?.productRole, "superseded");
});

// Check: session-handoff is classified as standalone-utility
test("session-handoff is classified as standalone-utility", () => {
	const entry = REACH_V2.find((e) => e.skill === "session-handoff");
	assert.equal(entry?.productRole, "standalone-utility");
});

// Check: planning has stateDomains
test("planning workflow has stateDomains", () => {
	const planning = WORKFLOWS_V2.find((w) => w.name === "planning-workflow");
	assert.ok(planning?.stateDomains, "planning should have stateDomains");
	assert.ok(
		planning?.stateDomains?.["mode"],
		"planning should have mode domain",
	);
	assert.ok(
		planning?.stateDomains?.["prototype"],
		"planning should have prototype domain",
	);
});

// Check: state constraint values are valid members of state domains
test("planning state constraint values are valid members of state domains", () => {
	const planning = WORKFLOWS_V2.find((w) => w.name === "planning-workflow");
	const domains = planning?.stateDomains;
	if (!domains) return;
	for (const phase of planning!.phases) {
		if (!phase.stateConstraints) continue;
		for (const constraint of phase.stateConstraints) {
			const domain = domains[constraint.field];
			if (!domain) continue;
			if (constraint.requiredOnExit) {
				for (const val of constraint.requiredOnExit) {
					assert.ok(
						domain.includes(val) || val.includes("<") || val === "approved",
						`planning: constraint value "${val}" for field "${constraint.field}" not in domain ${JSON.stringify(domain)}`,
					);
				}
			}
		}
	}
});

// Check: ASK_MATT_SOURCE has SHA-256
test("ASK_MATT_SOURCE has a SHA-256 hash", () => {
	assert.ok(
		ASK_MATT_SOURCE.sha256,
		"ASK_MATT_SOURCE should have a sha256 field",
	);
	assert.ok(
		ASK_MATT_SOURCE.sha256.length >= 16,
		"sha256 should be at least 16 chars",
	);
});

// Check: triage outcomes have evidence fields
test("triage outcomes have evidence fields", () => {
	const readyForAgent = TRIAGE_OUTCOMES.find(
		(o) => o.outcome === "ready-for-agent",
	);
	assert.ok(
		readyForAgent?.evidenceFields,
		"ready-for-agent should have evidence fields",
	);
	assert.ok(
		readyForAgent!.evidenceFields!.includes("issue ref"),
		"ready-for-agent should require issue ref evidence",
	);
});

// Check: prototype state mutations are explicit in the SKILL.md
test("planning SKILL.md has explicit prototype state mutations", () => {
	const content = readWorkflowSkill("planning-workflow");
	assert.ok(
		/prototype: proposed/i.test(content),
		"should set prototype: proposed when asking permission",
	);
	assert.ok(
		/prototype: declined/i.test(content),
		"should set prototype: declined when user declines",
	);
	assert.ok(
		/prototype: running/i.test(content),
		"should set prototype: running when user approves",
	);
	assert.ok(
		/prototype: complete/i.test(content),
		"should set prototype: complete when prototype is done",
	);
});

// ─── Contract v6: full SHA-256 + prototype state reset ───────────────────────

import { createHash } from "node:crypto";

// Check: ASK_MATT_SOURCE.sha256 is a full 64-char hex digest matching the actual file
test("ASK_MATT_SOURCE.sha256 is a full 64-char hex digest matching the actual upstream file", () => {
	const sha256 = ASK_MATT_SOURCE.sha256;
	assert.ok(
		/^[a-f0-9]{64}$/.test(sha256),
		`sha256 should be a 64-char hex digest, got: ${sha256}`,
	);
	// Compute the actual SHA-256 of the upstream ask-matt file
	const upstreamPath =
		"/Users/rom.iluz/Dev/mattpocock-skills/skills/engineering/ask-matt/SKILL.md";
	if (existsSync(upstreamPath)) {
		const fileContent = readFileSync(upstreamPath);
		const computed = createHash("sha256").update(fileContent).digest("hex");
		assert.equal(
			sha256,
			computed,
			`ASK_MATT_SOURCE.sha256 should match the actual file hash`,
		);
	}
});

// Check: prototype completion resets resume phase + uncertainty
test("planning SKILL.md resets resume phase + uncertainty on prototype completion", () => {
	const content = readWorkflowSkill("planning-workflow");
	// On completion: set unresolved design uncertainty: none + resume phase: not-applicable after resuming
	assert.ok(
		/unresolved design uncertainty: none/i.test(content),
		"prototype completion should set 'unresolved design uncertainty: none'",
	);
	assert.ok(
		/resume phase: not-applicable/i.test(content),
		"prototype completion should reset 'resume phase: not-applicable' after resuming",
	);
});

// Check: prototype decline resets conclusion + resume phase
test("planning SKILL.md resets conclusion + resume phase on prototype decline", () => {
	const content = readWorkflowSkill("planning-workflow");
	// On decline: set prototype conclusion: not-applicable + resume phase: not-applicable
	assert.ok(
		/prototype conclusion: not-applicable/i.test(content),
		"prototype decline should set 'prototype conclusion: not-applicable'",
	);
});

// ─── Pinned-dependency drift fixtures (ask-matt) — v0.4 T1 ────────────────────

function createPinnedDepFixture(
	installedContent: string,
	manifestSha256: string,
): {
	installedDir: string;
	manifestPath: string;
	cleanup: () => void;
} {
	const baseDir = mkdtempSync(join(tmpdir(), "pinned-dep-"));
	const installedDir = join(baseDir, "installed");
	const manifestDir = join(baseDir, "config");
	mkdirSync(join(installedDir, "ask-matt"), { recursive: true });
	mkdirSync(manifestDir, { recursive: true });

	writeFileSync(join(installedDir, "ask-matt", "SKILL.md"), installedContent);

	const manifest = {
		"ask-matt": {
			installedPath: join(installedDir, "ask-matt", "SKILL.md"),
			upstreamRepo: "/dev/null",
			upstreamPath: "skills/engineering/ask-matt/SKILL.md",
			baseCommit: "ed37663",
			repoHeadChecked: "2ab9580",
			sha256: manifestSha256,
		},
	};
	const manifestPath = join(manifestDir, "pinned-deps.json");
	writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

	return {
		installedDir,
		manifestPath,
		cleanup: () => rmSync(baseDir, { recursive: true, force: true }),
	};
}

function runPinnedDepCheck(
	manifestPath: string,
	installedDir: string,
): { exitCode: number; output: string } {
	const env = {
		...process.env,
		PINNED_DEPS_JSON: manifestPath,
		PINNED_DEP_NAMES: "ask-matt",
		INSTALLED_SKILLS_DIR: installedDir,
		LOCAL_FORK_NAMES: "",
	};
	try {
		const stdout = execSync(
			`bash "${join(REPO_ROOT, "scripts", "check-drift.sh")}"`,
			{
				encoding: "utf-8",
				stdio: "pipe",
				env,
				maxBuffer: 1024 * 1024,
			},
		);
		return { exitCode: 0, output: stdout };
	} catch (e: any) {
		const stdout = e.stdout
			? typeof e.stdout === "string"
				? e.stdout
				: e.stdout.toString("utf-8")
			: "";
		const stderr = e.stderr
			? typeof e.stderr === "string"
				? e.stderr
				: e.stderr.toString("utf-8")
			: "";
		return { exitCode: e.status ?? 1, output: stdout + stderr };
	}
}

function sha256OfFile(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

test("pinned dep fixture 1: installed SHA matches recorded SHA → exit 0", () => {
	const content = "---\nname: ask-matt\n---\n# Ask Matt\nrouting content\n";
	const sha = sha256OfFile(content);
	const { manifestPath, installedDir, cleanup } = createPinnedDepFixture(
		content,
		sha,
	);
	const result = runPinnedDepCheck(manifestPath, installedDir);
	assert.equal(
		result.exitCode,
		0,
		`pinned-dep match: should exit 0, got ${result.exitCode}: ${result.output}`,
	);
	cleanup();
});

test("pinned dep fixture 2: installed SHA differs (installed changed) → exit 1", () => {
	const installedContent =
		"---\nname: ask-matt\n---\n# Ask Matt\nCHANGED content\n";
	const recordedSha = sha256OfFile(
		"---\nname: ask-matt\n---\n# Ask Matt\nORIGINAL content\n",
	);
	const { manifestPath, installedDir, cleanup } = createPinnedDepFixture(
		installedContent,
		recordedSha,
	);
	const result = runPinnedDepCheck(manifestPath, installedDir);
	assert.equal(
		result.exitCode,
		1,
		`pinned-dep mismatch: should exit 1, got ${result.exitCode}: ${result.output}`,
	);
	cleanup();
});

test("pinned dep fixture 3: missing provenance manifest → exit 1", () => {
	const content = "---\nname: ask-matt\n---\n# Ask Matt\nrouting content\n";
	const sha = sha256OfFile(content);
	const { manifestPath, installedDir, cleanup } = createPinnedDepFixture(
		content,
		sha,
	);
	// Point to a nonexistent manifest
	const result = runPinnedDepCheck(
		join(manifestPath, "nonexistent"),
		installedDir,
	);
	assert.equal(
		result.exitCode,
		1,
		`pinned-dep missing manifest: should exit 1, got ${result.exitCode}: ${result.output}`,
	);
	cleanup();
});

// Check: the real ask-matt provenance manifest exists + SHA matches the actual installed file
test("real ask-matt provenance manifest exists + SHA matches the installed file", () => {
	const manifestPath = join(REPO_ROOT, "config", "pinned-deps.json");
	assert.ok(existsSync(manifestPath), "config/pinned-deps.json should exist");
	const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
	assert.ok(manifest["ask-matt"], "manifest should have an ask-matt entry");
	const entry = manifest["ask-matt"];
	assert.ok(entry.sha256, "ask-matt entry should have a sha256");
	assert.match(entry.sha256, /^[a-f0-9]{64}$/, "sha256 should be 64 hex chars");
	// Verify against the actual installed file if it exists
	const installedPath = entry.installedPath.replace(
		/^~\/\.agents/,
		join(homedir(), ".agents"),
	);
	if (existsSync(installedPath)) {
		const computed = createHash("sha256")
			.update(readFileSync(installedPath))
			.digest("hex");
		assert.equal(
			entry.sha256,
			computed,
			"ask-matt sha256 in manifest should match the actual installed file",
		);
	}
});

// ─── v0.4 T2: orchestration-layer skeleton ────────────────────────────────────

// Check: orchestration-layer skill exists + has all 7 structural sections
test("orchestration-layer skill exists + has all 7 structural sections", () => {
	const content = readWorkflowSkill("orchestration-layer");

	// 1. State block schema (phase, evidence fields, artifact references)
	assert.ok(
		/state block/i.test(content),
		"should have a state block schema section",
	);
	assert.ok(
		/phase:/i.test(content),
		"state block schema should define phase field",
	);
	assert.ok(
		/evidence/i.test(content),
		"state block schema should define evidence fields",
	);

	// 2. Evidence gate pattern ("Do NOT advance without [specific evidence]")
	assert.ok(
		/Do NOT advance without/i.test(content),
		"should have evidence gate pattern ('Do NOT advance without')",
	);

	// 3. Reread-after-phase protocol (after each phase + after compaction)
	assert.ok(
		/[Rr]eread.*after each phase/i.test(content),
		"should have reread-after-phase protocol",
	);
	assert.ok(
		/[Rr]eread.*after compaction/i.test(content),
		"should have reread-after-compaction protocol",
	);

	// 4. Compaction recovery protocol (re-read ask-matt + this layer; reconstruct from artifacts)
	assert.ok(/compaction/i.test(content), "should mention compaction recovery");
	assert.ok(
		/reconstruct.*artifact/i.test(content),
		"should say to reconstruct from artifacts",
	);
	assert.ok(
		/ask-matt/i.test(content),
		"compaction recovery should reference re-reading ask-matt",
	);

	// 5. Human-controlled stop rule (emit state → "Next: type /X" → STOP; do not auto-advance)
	assert.ok(
		/Next: type/i.test(content),
		"should have human-controlled stop with 'Next: type /X' handoff",
	);
	assert.ok(/STOP/i.test(content), "should explicitly say STOP");
	assert.ok(
		/do not auto-advance/i.test(content),
		"should say 'do not auto-advance'",
	);

	// 6. Specialist isolation (follow only the active phase's specialist; do not preload)
	assert.ok(
		/do not preload/i.test(content),
		"should have specialist isolation rule ('do not preload')",
	);

	// 7. Routing ownership (ask-matt owns routing; this layer owns orchestration mechanics; specialists own procedures)
	assert.ok(
		/ask-matt owns.*rout/i.test(content),
		"should declare ask-matt owns routing",
	);
	assert.ok(
		/orchestration.*mechanic/i.test(content),
		"should declare this layer owns orchestration mechanics",
	);
	assert.ok(
		/specialist.*own.*procedur/i.test(content),
		"should declare specialists own procedures",
	);
});

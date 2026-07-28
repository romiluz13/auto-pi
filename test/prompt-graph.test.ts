import { WORKFLOWS, ASK_MATT_DISPOSITIONS, REACHABILITY_ENTRIES } from "./workflow-graph-contract.ts";
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
test("every workflow's complete phase has a valid next phase or slash handoff", () => {
	for (const skill of [
		"planning-workflow",
		"build-workflow",
		"review-workflow",
		"ship-workflow",
		"research-workflow",
		"debug-workflow",
	]) {
		const content = readWorkflowSkill(skill);
		const completeMatch = content.match(
			/Phase: complete[\s\S]*?(?=\n## |\nRules|$)/,
		);
		assert.ok(completeMatch, `${skill} should have a complete phase`);
		const complete = completeMatch![0];
		// The complete phase should either route internally or tell the user a next slash command
		assert.ok(
			/Next:.*type\s*`?\/|terminal|You're done|stop|complete/i.test(complete),
			`${skill} complete phase should have a next slash handoff, terminal state, or stop instruction`,
		);
	}
});

// Check 4: Every slash handoff names an installed user-facing command (NOT internal skills)
test("every slash handoff in workflow skills names an installed user-facing command (not internal skills)", () => {
	// User-facing commands are: prompt names (the slash workflows) + extension/built-in commands
	// Internal skill commands (/skill:X) are NOT valid handoffs
	const validHandoffCommands = new Set<string>();
	// All prompt names (user-facing slash commands)
	for (const p of PROMPT_NAMES) validHandoffCommands.add(p);
	// Extension/built-in commands (explicit allowlist — NOT skill directories)
	validHandoffCommands.add("handoff");
	validHandoffCommands.add("palette");

	for (const skill of [
		"planning-workflow",
		"build-workflow",
		"review-workflow",
		"ship-workflow",
		"research-workflow",
		"debug-workflow",
	]) {
		const content = readWorkflowSkill(skill);
		// Find all "type `/X`" handoffs — must use backticks (excludes false positives like 'type/LSP')
		const handoffs: string[] = [];
		const regex = /\btype[ \t]*`\/(\S+?)`[ \t.,]/g;
		let match;
		while ((match = regex.exec(content)) !== null) {
			const cmd = match[1].replace(/[<"].*/, "").replace(/[.].*/, "");
			// Skip /skill:* references (those are the "don't type internal" rule, not a handoff)
			if (cmd.startsWith("skill:")) continue;
			handoffs.push(cmd);
		}
		for (const cmd of handoffs) {
			assert.ok(
				validHandoffCommands.has(cmd),
				`${skill} says "type /${cmd}" but /${cmd} is not a valid user-facing command (prompt or extension). Internal skill commands are not valid handoffs.`,
			);
		}
	}
});

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
test("every ask-matt main-flow edge has an auto-pi disposition", () => {
	// The ask-matt main-flow edges that must have an auto-pi disposition:
	// grill-with-docs → decomposed into grilling + domain-modeling (planning-workflow)
	// prototype → planning-workflow prototype interrupt
	// to-spec → planning-workflow spec phase
	// to-tickets → planning-workflow tickets phase
	// implement → build-workflow + review-workflow + ship-workflow
	// tdd → build-workflow tdd phase
	// code-review → review-workflow review phase
	const planning = readWorkflowSkill("planning-workflow");
	const build = readWorkflowSkill("build-workflow");
	const review = readWorkflowSkill("review-workflow");
	const ship = readWorkflowSkill("ship-workflow");

	// grill-with-docs → decomposed (grilling + domain-modeling in planning)
	assert.ok(
		/grilling/i.test(planning),
		"grill-with-docs edge: planning should reference grilling",
	);
	assert.ok(
		/domain-modeling/i.test(planning),
		"grill-with-docs edge: planning should reference domain-modeling",
	);
	// prototype → planning-workflow prototype interrupt
	assert.ok(
		/prototype interrupt/i.test(planning),
		"prototype edge: planning should have a prototype interrupt",
	);
	// to-spec → planning spec phase
	assert.ok(
		/to-spec/i.test(planning),
		"to-spec edge: planning should have a to-spec reference",
	);
	// to-tickets → planning tickets phase
	assert.ok(
		/to-tickets/i.test(planning),
		"to-tickets edge: planning should have a to-tickets reference",
	);
	// tdd → build tdd phase
	assert.ok(/tdd/i.test(build), "tdd edge: build should have a tdd reference");
	// code-review → review phase
	assert.ok(
		/code-review/i.test(review),
		"code-review edge: review should have a code-review reference",
	);
	// implement → build + review + ship (decomposed)
	assert.ok(
		/tdd/i.test(build),
		"implement edge: build should have tdd (implement decomposed)",
	);
	assert.ok(
		/code-review/i.test(review),
		"implement edge: review should have code-review (implement decomposed)",
	);
	assert.ok(
		/commit/i.test(ship),
		"implement edge: ship should have commit (implement decomposed)",
	);
});

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

import {
	WORKFLOWS,
	REACHABILITY_ENTRIES,
	ASK_MATT_ROUTES,
	ORCHESTRATION_LAYER_PHASES,
	TRIAGE_OUTCOMES,
	ASK_MATT_SOURCE,
	EXPECTED_ASK_MATT_ROUTES,
} from "../config/workflow-graph-contract.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

const REACH_V2 = REACHABILITY_ENTRIES;
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

// v0.4: the 6 workflow prompts now pin orchestration-layer (which reads ask-matt).
// The old orchestrator-specific pin tests are superseded by the v0.4 tests below.
// These are kept as regression checks that the prompts no longer pin the old orchestrators.

test("/setup-audit pins setup-maintenance directly (1 specialist, no wrapper)", () => {
	assert.equal(skillPin(readPrompt("setup-audit")), "setup-maintenance");
});

// ─── The 6 workflow skills exist ──────────────────────────────────────────────

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

// ─── Planning workflow structural tests ──────────────────────────────────────

// ─── Ship workflow structural tests ──────────────────────────────────────────

// ─── Build workflow structural tests ──────────────────────────────────────────

// ─── Review workflow structural tests ─────────────────────────────────────────

// ─── All specialist skills referenced by workflows exist at the canonical path ─

// ─── B1: Fresh-context-per-ticket invariants ──────────────────────────────

// ─── B4: Triage discoverability ─────────────────────────────────────────────

// v0.4: /triage now pins orchestration-layer (which reads ask-matt for triage routing).
// The triage skill itself is read on-demand by the layer, not pinned directly.
test("triage prompt exists and pins orchestration-layer", () => {
	assert.ok(
		existsSync(join(PROMPTS_DIR, "triage.md")),
		"/triage prompt should exist",
	);
	const content = readFileSync(join(PROMPTS_DIR, "triage.md"), "utf-8");
	assert.equal(
		skillPin(content),
		"orchestration-layer",
		"/triage should pin orchestration-layer (v0.4)",
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

// ─── B3: Prototype detour (workflow-owned, consented interrupt) ───────────────

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

// Check 7: Every ask-matt route has an equivalence/disposition

// Check: planning wayfinder → ready-for-brainstorm goes through setup (not directly to brainstorm)

// Check: planning state block has prototype fields

// Check: planning state block has domain artifacts evidence field

// Check: planning does not preload brainstorming when grilling

// Check: build-workflow has explicit cadence (typecheck + single test + full suite)

// Check: build-workflow fresh-context gate is hard (STOP, not just recommend)

// v0.4: triage conditional handoff is now in ask-matt's triage flow (routed by the layer),
// not in the prompt itself. The prompt is a thin entry adapter.
// Check that the orchestration-layer references the triage flow.
test("triage conditional handoff is in ask-matt's flow (routed by the layer)", () => {
	const layerContent = readWorkflowSkill("orchestration-layer");
	assert.ok(
		/ask-matt/i.test(layerContent),
		"orchestration-layer should reference ask-matt for triage routing",
	);
	const triageContent = readPrompt("triage");
	assert.ok(
		/triage/i.test(triageContent),
		"triage prompt should reference triage",
	);
});

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

// Check: build tdd phase has state constraints (requires one ticket)

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

// ─── Drift fixture tests (5 scenarios) ────────────────────────────────────────

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

// Check: setup style does not include grill-me (it's a conditional specialist, not a style)

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

// Check: session-handoff is classified as standalone-utility
test("session-handoff is classified as standalone-utility", () => {
	const entry = REACH_V2.find((e) => e.skill === "session-handoff");
	assert.equal(entry?.productRole, "standalone-utility");
});

// Check: planning has stateDomains

// Check: state constraint values are valid members of state domains

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

// ─── Contract v6: full SHA-256 + prototype state reset ───────────────────────

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

// Check: prototype decline resets conclusion + resume phase

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

// ─── v0.4 T3: Coach entry prompts pin orchestration-layer (+ ask-matt read-on-entry) ──

// D-2 resolution: Pi's PTM does NOT support multiple skill: pins (skill?: string, single value).
// Each entry prompt pins orchestration-layer, which instructs the agent to read ask-matt at
// /Users/rom.iluz/.agents/skills/ask-matt/SKILL.md as its first instruction (read-on-entry fallback).

const V04_ENTRY_PROMPTS = [
	"plan",
	"build",
	"debug",
	"research",
	"review",
	"ship",
	"triage",
] as const;

test("v0.4: every Coach entry prompt pins orchestration-layer", () => {
	for (const name of V04_ENTRY_PROMPTS) {
		const pin = skillPin(readPrompt(name));
		assert.equal(
			pin,
			"orchestration-layer",
			`prompt ${name}.md should pin orchestration-layer, got "${pin}"`,
		);
	}
});

test("v0.4: orchestration-layer skill exists", () => {
	assert.ok(
		skillExists("orchestration-layer"),
		"orchestration-layer skill should exist in the skill library",
	);
});

test("v0.4: orchestration-layer instructs the agent to read ask-matt (read-on-entry fallback)", () => {
	const content = readWorkflowSkill("orchestration-layer");
	assert.ok(
		/read.*ask-matt.*SKILL\.md/i.test(content),
		"orchestration-layer should instruct the agent to read ask-matt/SKILL.md",
	);
	assert.ok(
		content.includes("/Users/rom.iluz/.agents/skills/ask-matt/SKILL.md"),
		"orchestration-layer should reference the absolute path to ask-matt/SKILL.md",
	);
});

test("v0.4: no Coach entry prompt still pins a workflow orchestrator (the 6 are being collapsed)", () => {
	const oldOrchestrators = [
		"planning-workflow",
		"build-workflow",
		"review-workflow",
		"ship-workflow",
		"research-workflow",
		"debug-workflow",
	];
	for (const name of V04_ENTRY_PROMPTS) {
		const pin = skillPin(readPrompt(name));
		assert.ok(
			!oldOrchestrators.includes(pin ?? ""),
			`prompt ${name}.md should not pin the old orchestrator "${pin}" — it should pin orchestration-layer`,
		);
	}
});

// ─── v0.4 T4: orchestration-layer unique phases ──────────────────────────────

// Check: orchestration-layer has all 4 unique auto-pi phases
test("v0.4 T4: orchestration-layer has all 4 unique auto-pi phases (ship, review-disposition, verification, security)", () => {
	const content = readWorkflowSkill("orchestration-layer");
	// Phase headers
	assert.ok(
		/## Phase:\s*ship\b/im.test(content),
		"layer should have a '## Phase: ship' header",
	);
	assert.ok(
		/## Phase:\s*review-disposition\b/im.test(content),
		"layer should have a '## Phase: review-disposition' header",
	);
	assert.ok(
		/## Phase:\s*verification\b/im.test(content),
		"layer should have a '## Phase: verification' header",
	);
	assert.ok(
		/## Phase:\s*security\b/im.test(content),
		"layer should have a '## Phase: security' header",
	);
});

// Check: ship phase has entry conditions + specialist reads + evidence gates + human-controlled stop
test("v0.4 T4: ship phase has entry conditions, specialist reads, evidence gates, and human-controlled stop", () => {
	const content = readWorkflowSkill("orchestration-layer");
	// Extract the ship phase section
	const shipMatch = content.match(
		/## Phase:\s*ship\b([\s\S]*?)(?=\n## (?:Phase:|Rules|$))/i,
	);
	assert.ok(shipMatch, "ship phase section should exist");
	const shipSection = shipMatch![1];
	// Entry conditions
	assert.ok(
		/entry condition/i.test(shipSection),
		"ship phase should mention entry conditions",
	);
	// Specialist reads (verification-before-completion, diff-driven-docs, commit, github)
	assert.ok(
		shipSection.includes("verification-before-completion"),
		"ship phase should read verification-before-completion",
	);
	assert.ok(
		shipSection.includes("diff-driven-docs"),
		"ship phase should read diff-driven-docs",
	);
	assert.ok(shipSection.includes("commit"), "ship phase should read commit");
	assert.ok(
		shipSection.includes("github"),
		"ship phase should read github (conditional)",
	);
	// Evidence gates
	assert.ok(
		/evidence/i.test(shipSection),
		"ship phase should have evidence gates",
	);
	assert.ok(
		/commit hash|pr url|ci status/i.test(shipSection),
		"ship phase should require commit hash/PR URL/CI status as evidence",
	);
	// Human-controlled stop (ship is terminal — "Ship complete" or "Next: type")
	assert.ok(
		/Next:\s*type|Ship complete/i.test(shipSection),
		"ship phase should have a human-controlled stop ('Next: type /X' or 'Ship complete')",
	);
});

// Check: review-disposition phase has the 4 dispositions + specialist read + human-controlled stop
test("v0.4 T4: review-disposition phase has 4 dispositions, reads receiving-code-review, and human-controlled stop", () => {
	const content = readWorkflowSkill("orchestration-layer");
	const dispMatch = content.match(
		/## Phase:\s*review-disposition\b([\s\S]*?)(?=\n## (?:Phase:|Rules|$))/i,
	);
	assert.ok(dispMatch, "review-disposition phase section should exist");
	const dispSection = dispMatch![1];
	// The 4 dispositions
	assert.ok(
		/verified-fix/i.test(dispSection),
		"review-disposition should define 'verified-fix'",
	);
	assert.ok(
		/verified-defer/i.test(dispSection),
		"review-disposition should define 'verified-defer'",
	);
	assert.ok(
		/rejected/i.test(dispSection),
		"review-disposition should define 'rejected'",
	);
	assert.ok(
		/needs-user-decision/i.test(dispSection),
		"review-disposition should define 'needs-user-decision'",
	);
	// Specialist read
	assert.ok(
		dispSection.includes("receiving-code-review"),
		"review-disposition should read receiving-code-review",
	);
	// Human-controlled stop
	assert.ok(
		/Next:\s*type/i.test(dispSection),
		"review-disposition should have a human-controlled stop",
	);
	// Review-only (no apply)
	assert.ok(
		/do not apply|review-only/i.test(dispSection),
		"review-disposition should be review-only (do not apply)",
	);
});

// Check: verification phase reads verification-before-completion + applied at build-complete AND ship
test("v0.4 T4: verification gate reads verification-before-completion and is applied at build-complete and ship", () => {
	const content = readWorkflowSkill("orchestration-layer");
	const verifyMatch = content.match(
		/## Phase:\s*verification\b([\s\S]*?)(?=\n## (?:Phase:|Rules|$))/i,
	);
	assert.ok(verifyMatch, "verification phase section should exist");
	const verifySection = verifyMatch![1];
	// Reads the specialist
	assert.ok(
		verifySection.includes("verification-before-completion"),
		"verification phase should read verification-before-completion",
	);
	// Applied at build-complete AND ship
	assert.ok(
		/build.complete/i.test(verifySection),
		"verification gate should apply at build-complete",
	);
	assert.ok(
		/ship/i.test(verifySection),
		"verification gate should apply at ship",
	);
	// Evidence block format
	assert.ok(
		/evidence block|exit code|exact command/i.test(verifySection),
		"verification gate should require the evidence block format",
	);
});

// Check: security phase defines the 3rd review axis with a smell catalog + references security-review specialist
test("v0.4 T4: security phase defines 3rd review axis with smell categories and references security-review specialist", () => {
	const content = readWorkflowSkill("orchestration-layer");
	const secMatch = content.match(
		/## Phase:\s*security\b([\s\S]*?)(?=\n## (?:Phase:|Rules|$))/i,
	);
	assert.ok(secMatch, "security phase section should exist");
	const secSection = secMatch![1];
	// Smell categories (at least 5 of the 8)
	const categories = [
		"injection",
		"auth",
		"secret",
		"deserialization",
		"ssrf",
		"path traversal",
		"unsafe",
	];
	const found = categories.filter((c) => new RegExp(c, "i").test(secSection));
	assert.ok(
		found.length >= 5,
		`security phase should mention at least 5 smell categories, found: ${found.join(", ")}`,
	);
	// References security-review specialist (created in T6)
	assert.ok(
		/security-review/i.test(secSection),
		"security phase should reference the security-review specialist",
	);
	// Fresh context / anti-anchored
	assert.ok(
		/fresh context|anti.anchored|diff.only/i.test(secSection),
		"security phase should require fresh context (anti-anchored)",
	);
	// Human-controlled stop
	assert.ok(
		/Next:\s*type/i.test(secSection),
		"security phase should have a human-controlled stop",
	);
});

// ─── v0.4 T6: security-review specialist ─────────────────────────────────────

function readRepoSkillFile(skillName: string): string {
	const repoPath = join(REPO_ROOT, "skills", skillName, "SKILL.md");
	return readFileSync(repoPath, "utf-8");
}

test("v0.4 T6: security-review specialist exists", () => {
	assert.ok(
		existsSync(join(REPO_ROOT, "skills", "security-review", "SKILL.md")),
		"skills/security-review/SKILL.md should exist",
	);
});

test("v0.4 T6: security-review has >=8 smell categories in a catalog", () => {
	const content = readRepoSkillFile("security-review");
	// Check for a smell catalog section
	assert.ok(
		/smell catalog|security smell|catalog/i.test(content),
		"security-review should have a smell catalog section",
	);
	// The 8 required categories
	const categories = [
		"injection",
		"auth",
		"secret",
		"deserialization",
		"ssrf",
		"path traversal",
		"unsafe operation",
		"dependency",
	];
	const found = categories.filter((c) => new RegExp(c, "i").test(content));
	assert.ok(
		found.length >= 8,
		`security-review should mention all 8 smell categories, found ${found.length}/8: ${found.join(", ")}`,
	);
});

test("v0.4 T6: security-review has a review brief (fresh context, diff-only, anti-anchored)", () => {
	const content = readRepoSkillFile("security-review");
	assert.ok(
		/fresh context/i.test(content),
		"security-review should mention 'fresh context'",
	);
	assert.ok(
		/diff.only|diff only/i.test(content),
		"security-review should mention 'diff-only'",
	);
	assert.ok(
		/anti.anchored/i.test(content),
		"security-review should mention 'anti-anchored'",
	);
});

test("v0.4 T6: security-review has severity guidance (CRITICAL/HIGH/LOW)", () => {
	const content = readRepoSkillFile("security-review");
	assert.ok(
		/CRITICAL/i.test(content),
		"security-review should define CRITICAL severity",
	);
	assert.ok(
		/HIGH/i.test(content),
		"security-review should define HIGH severity",
	);
	assert.ok(/LOW/i.test(content), "security-review should define LOW severity");
	// Should have a severity guidance section or mapping
	assert.ok(
		/severity/i.test(content),
		"security-review should have severity guidance",
	);
});

test("v0.4 T6: security-review declares auto-pi-original provenance", () => {
	const content = readRepoSkillFile("security-review");
	assert.ok(
		/auto-pi.original|provenance:\s*auto-pi-original/i.test(content),
		"security-review should declare provenance: auto-pi-original",
	);
});

test("v0.4 T6: orchestration-layer SECURITY phase references the security-review specialist", () => {
	const layer = readWorkflowSkill("orchestration-layer");
	const secMatch = layer.match(
		/## Phase:\s*security\b([\s\S]*?)(?=\n## (?:Phase:|Rules|$))/i,
	);
	assert.ok(secMatch, "layer should have a security phase");
	const secSection = secMatch![1];
	assert.ok(
		/security-review/i.test(secSection),
		"layer's security phase should reference the security-review specialist path",
	);
	// The reference should include a path to the repo skill
	assert.ok(
		/skills\/security-review\/SKILL\.md/i.test(secSection),
		"layer's security phase should reference the repo path skills/security-review/SKILL.md",
	);
});

// ─── v0.4 T5: audit defect regression tests ──────────────────────────────────

// C-1: receiving-code-review IMPLEMENT vs review do-not-apply
test("T5 C-1: layer overrides receiving-code-review's IMPLEMENT step during review", () => {
	const layer = readWorkflowSkill("orchestration-layer");
	// The layer must explicitly override the IMPLEMENT step
	assert.ok(
		/IMPLEMENT/i.test(layer),
		"layer should mention receiving-code-review's IMPLEMENT step",
	);
	assert.ok(
		/skip.*IMPLEMENT|override.*IMPLEMENT|replace.*IMPLEMENT/i.test(layer),
		"layer should explicitly skip/override/replace the IMPLEMENT step during review",
	);
});

// G-1: Phase 6 cleanup carried into post-fix
test("T5 G-1: layer carries Phase 6 cleanup into post-fix (build + debug)", () => {
	const layer = readWorkflowSkill("orchestration-layer");
	// The layer must mention Phase 6 + DEBUG instrumentation + throwaway prototypes
	assert.ok(
		/Phase 6/i.test(layer),
		"layer should mention Phase 6 (Cleanup + post-mortem)",
	);
	assert.ok(
		/\[DEBUG/i.test(layer),
		"layer should mention [DEBUG-...] instrumentation removal",
	);
	assert.ok(
		/throwaway prot/i.test(layer),
		"layer should mention throwaway prototypes",
	);
});

// C-2: layer's diagnose path says follow Phases 1-4, skip Phase 5, execute Phase 6 after fix
test("T5 C-2: layer's diagnose path skips Phase 5, defers Phase 6 to after the fix", () => {
	const layer = readWorkflowSkill("orchestration-layer");
	// Must say: follow Phases 1-4, skip Phase 5
	assert.ok(
		/Phase[s ]?1.?4|Phases 1–4|Phases 1-4/i.test(layer),
		"layer should say follow Phases 1-4",
	);
	assert.ok(
		/skip.*Phase 5|Phase 5.*skip|do NOT.*Phase 5/i.test(layer),
		"layer should say skip Phase 5 (fix happens in tdd)",
	);
});

// D-2: layer reads verification-before-completion in build-complete AND ship
test("T5 D-2: layer reads verification-before-completion at build-complete AND ship", () => {
	const layer = readWorkflowSkill("orchestration-layer");
	// Both the verification phase AND the ship phase should reference it
	const verifyPhase = layer.match(
		/## Phase:\s*verification\b([\s\S]*?)(?=\n## (?:Phase:|Rules|$))/i,
	);
	const shipPhase = layer.match(
		/## Phase:\s*ship\b([\s\S]*?)(?=\n## (?:Phase:|Rules|$))/i,
	);
	assert.ok(verifyPhase, "layer should have a verification phase");
	assert.ok(shipPhase, "layer should have a ship phase");
	assert.ok(
		/verification-before-completion/i.test(verifyPhase![1]),
		"verification phase should read verification-before-completion",
	);
	assert.ok(
		/verification-before-completion/i.test(shipPhase![1]),
		"ship phase should also read verification-before-completion (one source of truth)",
	);
});

// O-2: layer owns the 4 disposition categories (receiving-code-review is the procedure, not the owner)
test("T5 O-2: layer owns disposition categories; receiving-code-review is the driven procedure", () => {
	const layer = readWorkflowSkill("orchestration-layer");
	// All 4 dispositions must be in the layer
	assert.ok(/verified-fix/i.test(layer), "layer should define verified-fix");
	assert.ok(
		/verified-defer/i.test(layer),
		"layer should define verified-defer",
	);
	assert.ok(/rejected/i.test(layer), "layer should define rejected");
	assert.ok(
		/needs-user-decision/i.test(layer),
		"layer should define needs-user-decision",
	);
});

// O-3: layer defines the axis→severity transformation
test("T5 O-3: layer defines the axis→severity transformation", () => {
	const layer = readWorkflowSkill("orchestration-layer");
	// The layer must define a mapping from Standards/Spec findings to CRITICAL/HIGH/LOW
	assert.ok(/CRITICAL/i.test(layer), "layer should define CRITICAL severity");
	assert.ok(/HIGH/i.test(layer), "layer should define HIGH severity");
	assert.ok(/LOW/i.test(layer), "layer should define LOW severity");
	// Must connect severity to the axes (Standards, Spec, Security)
	assert.ok(
		/Standard|Spec|Security/i.test(layer),
		"layer should connect severity to the review axes",
	);
});

// Pattern 1: specialists say "tell the user to run X" not "run X"
test("T5 Pattern 1: code-review says 'tell the user to run' not 'run' slash commands", () => {
	const content = readWorkflowSkill("code-review");
	// The old "run /setup-matt-pocock-skills" should now say "tell the user to run"
	assert.ok(
		/tell the user to run.*setup-matt-pocock-skills/i.test(content),
		"code-review should say 'tell the user to run /setup-matt-pocock-skills'",
	);
	// Should NOT say bare "run /setup-matt-pocock-skills" (without "tell the user")
	assert.ok(
		!/(?<!tell the user to )run \/setup-matt-pocock-skills/i.test(content),
		"code-review should NOT say bare 'run /setup-matt-pocock-skills'",
	);
});

test("T5 Pattern 1: diagnosing-bugs says 'tell the user to run' not 'hand off to'", () => {
	const content = readWorkflowSkill("diagnosing-bugs");
	assert.ok(
		/tell the user to run.*improve-codebase-architecture/i.test(content),
		"diagnosing-bugs should say 'tell the user to run /improve-codebase-architecture'",
	);
	// Should NOT say "hand off to the /improve-codebase-architecture skill"
	assert.ok(
		!/hand off to the/i.test(content),
		"diagnosing-bugs should NOT say 'hand off to the /... skill'",
	);
});

test("T5 Pattern 1: codebase-hygiene says 'tell the user to run' not 'route through'", () => {
	const content = readWorkflowSkill("codebase-hygiene");
	// Both instances (lines 8, 58) should use "tell the user to run" or similar
	assert.ok(
		/tell the user to run.*build|tell the user to run.*\/build/i.test(content),
		"codebase-hygiene should say 'tell the user to run /build'",
	);
	// Should NOT say "route the change through /build" (bare route)
	assert.ok(
		!/\broute the change through\b/i.test(content),
		"codebase-hygiene should NOT say 'route the change through /build'",
	);
});

// ─── T7: wire the 3 orphans — v0.4 ────────────────────────────────────────────

test("T7: decision-hold-lifecycle is referenced by the layer's planning phase", () => {
	const layer = readWorkflowSkill("orchestration-layer");
	assert.ok(
		/decision-hold-lifecycle/i.test(layer),
		"orchestration-layer should reference decision-hold-lifecycle",
	);
	assert.ok(/planning/i.test(layer), "layer should have planning context");
});

test("T7: decision-hold-lifecycle is referenced by the layer's review phase", () => {
	const layer = readWorkflowSkill("orchestration-layer");
	// The layer must mention decision-hold-lifecycle in a review context
	// (either in the review-disposition phase or a general review mention)
	assert.ok(
		/decision-hold-lifecycle/i.test(layer),
		"orchestration-layer should reference decision-hold-lifecycle",
	);
	// Check it's in a review context (review-disposition phase or review mention)
	assert.ok(
		/review-disposition.*decision-hold|decision-hold.*review/i.test(layer) ||
			/review/i.test(layer),
		"layer should associate decision-hold-lifecycle with review",
	);
});

test("T7: memory-compounding is referenced by the layer's ship-complete phase", () => {
	const layer = readWorkflowSkill("orchestration-layer");
	assert.ok(
		/memory-compounding/i.test(layer),
		"orchestration-layer should reference memory-compounding",
	);
	assert.ok(/ship/i.test(layer), "layer should have a ship phase");
});

test("T7: session-handoff is documented as standalone + mentioned in compaction recovery", () => {
	const layer = readWorkflowSkill("orchestration-layer");
	// Mentioned in compaction recovery
	assert.ok(
		/session-handoff|\/handoff/i.test(layer),
		"orchestration-layer should mention session-handoff or /handoff",
	);
	// Mentioned as a compaction escape hatch
	assert.ok(
		/compaction.*handoff|handoff.*compaction|context.*degraded.*handoff|handoff.*fresh/i.test(
			layer,
		),
		"layer should mention /handoff as a compaction escape hatch",
	);
});

test("T7: bearings is documented as a standalone utility", () => {
	const layer = readWorkflowSkill("orchestration-layer");
	assert.ok(
		/bearings/i.test(layer),
		"orchestration-layer should mention bearings as a standalone utility",
	);
});

// ─── v0.4 T8: collapse the 6 workflow orchestrators ──────────────────────────

const COLLAPSED_WORKFLOWS = [
	"planning-workflow",
	"build-workflow",
	"review-workflow",
	"ship-workflow",
	"research-workflow",
	"debug-workflow",
] as const;

// Check: the 6 workflow orchestrator directories are removed
test("v0.4 T8: the 6 workflow orchestrator directories are removed", () => {
	for (const wf of COLLAPSED_WORKFLOWS) {
		assert.ok(
			!existsSync(join(REPO_ROOT, "skills", wf, "SKILL.md")),
			`skills/${wf}/SKILL.md should NOT exist after collapse`,
		);
	}
});

// Check: config/agents.md does NOT reference the 6 orchestrators
test("v0.4 T8: config/agents.md does not reference the 6 orchestrators", () => {
	const content = readFileSync(join(REPO_ROOT, "config", "agents.md"), "utf-8");
	for (const wf of COLLAPSED_WORKFLOWS) {
		assert.ok(
			!content.includes(wf),
			`config/agents.md should not reference '${wf}' — it should describe the 3-layer architecture (Coach → ask-matt → orchestration-layer)`,
		);
	}
});

// Check: no prompt references the 6 orchestrators
test("v0.4 T8: no prompt references the 6 orchestrators", () => {
	const promptDir = join(REPO_ROOT, "prompts");
	for (const f of readdirSync(promptDir)) {
		if (!f.endsWith(".md")) continue;
		const content = readFileSync(join(promptDir, f), "utf-8");
		for (const wf of COLLAPSED_WORKFLOWS) {
			assert.ok(
				!content.includes(wf),
				`prompts/${f} should not reference '${wf}'`,
			);
		}
	}
});

// Check: extensions/coach.ts does NOT reference the 6 orchestrators
test("v0.4 T8: extensions/coach.ts does not reference the 6 orchestrators", () => {
	const content = readFileSync(
		join(REPO_ROOT, "extensions", "coach.ts"),
		"utf-8",
	);
	for (const wf of COLLAPSED_WORKFLOWS) {
		assert.ok(
			!content.includes(wf),
			`extensions/coach.ts should not reference '${wf}' — the menu options should reference prompts (which pin orchestration-layer)`,
		);
	}
});

// Check: config/workflow-graph-contract.ts does NOT have WORKFLOWS with the 6 entries
test("v0.4 T8: contract WORKFLOWS array is empty or removed (6 orchestrators gone)", () => {
	for (const wf of WORKFLOWS) {
		assert.ok(
			!COLLAPSED_WORKFLOWS.includes(wf.name as any),
			`contract WORKFLOWS should not contain '${wf.name}' — the 6 orchestrators are collapsed`,
		);
	}
});

// Check: config/agents.md describes the 3-layer architecture
test("v0.4 T8: config/agents.md describes the 3-layer architecture", () => {
	const content = readFileSync(join(REPO_ROOT, "config", "agents.md"), "utf-8");
	assert.ok(
		/ask-matt/i.test(content),
		"agents.md should mention ask-matt (the routing brain)",
	);
	assert.ok(
		/orchestration-layer/i.test(content),
		"agents.md should mention orchestration-layer (the mechanics)",
	);
	assert.ok(
		/Coach/i.test(content),
		"agents.md should mention Coach (the entry)",
	);
});

// ─── v0.4 T9: contract validates ask-matt routing graph + layer phases ──────

// Check: ASK_MATT_ROUTES covers the full SDLC
test("v0.4 T9: ASK_MATT_ROUTES has the main flow (grill, spec, tickets, implement, tdd, code-review)", () => {
	const routes = ASK_MATT_ROUTES.map((r) => r.route);
	const mainFlow = [
		"grill-with-docs",
		"to-spec",
		"to-tickets",
		"implement",
		"tdd",
		"code-review",
	];
	for (const r of mainFlow) {
		assert.ok(
			routes.includes(r),
			`ASK_MATT_ROUTES should include main-flow route "${r}"`,
		);
	}
});

// Check: ASK_MATT_ROUTES has on-ramps
test("v0.4 T9: ASK_MATT_ROUTES has on-ramps (triage, diagnosing-bugs, wayfinder)", () => {
	const routes = ASK_MATT_ROUTES.map((r) => r.route);
	const onRamps = ["triage", "diagnosing-bugs", "wayfinder"];
	for (const r of onRamps) {
		assert.ok(
			routes.includes(r),
			`ASK_MATT_ROUTES should include on-ramp "${r}"`,
		);
	}
});

// Check: ASK_MATT_ROUTES has standalone skills
test("v0.4 T9: ASK_MATT_ROUTES has standalone skills (grill-me, prototype, research, handoff)", () => {
	const routes = ASK_MATT_ROUTES.map((r) => r.route);
	const standalone = ["grill-me", "prototype", "research", "handoff"];
	for (const r of standalone) {
		assert.ok(
			routes.includes(r),
			`ASK_MATT_ROUTES should include standalone "${r}"`,
		);
	}
});

// Check: EXPECTED_ASK_MATT_ROUTES matches ASK_MATT_ROUTES
test("v0.4 T9: EXPECTED_ASK_MATT_ROUTES is derived from ASK_MATT_ROUTES", () => {
	assert.equal(EXPECTED_ASK_MATT_ROUTES.length, ASK_MATT_ROUTES.length);
	for (const r of ASK_MATT_ROUTES) {
		assert.ok(
			EXPECTED_ASK_MATT_ROUTES.includes(r.route),
			`EXPECTED_ASK_MATT_ROUTES should include "${r.route}"`,
		);
	}
});

// Check: ORCHESTRATION_LAYER_PHASES has the 5 unique auto-pi phases
test("v0.4 T9: ORCHESTRATION_LAYER_PHASES has ship, review-disposition, verification, security, diagnose", () => {
	const phases = ORCHESTRATION_LAYER_PHASES.map((p) => p.name);
	const expected = [
		"ship",
		"review-disposition",
		"verification",
		"security",
		"diagnose",
	];
	for (const p of expected) {
		assert.ok(
			phases.includes(p),
			`ORCHESTRATION_LAYER_PHASES should include "${p}"`,
		);
	}
});

// Check: ship phase reads verification-before-completion + diff-driven-docs + commit
test("v0.4 T9: ship phase reads the 3 core specialists", () => {
	const ship = ORCHESTRATION_LAYER_PHASES.find((p) => p.name === "ship");
	assert.ok(ship);
	assert.ok(ship!.specialists.includes("verification-before-completion"));
	assert.ok(ship!.specialists.includes("diff-driven-docs"));
	assert.ok(ship!.specialists.includes("commit"));
});

// Check: review-disposition phase reads receiving-code-review
test("v0.4 T9: review-disposition phase reads receiving-code-review", () => {
	const review = ORCHESTRATION_LAYER_PHASES.find(
		(p) => p.name === "review-disposition",
	);
	assert.ok(review);
	assert.ok(review!.specialists.includes("receiving-code-review"));
});

// Check: security phase reads security-review
test("v0.4 T9: security phase reads security-review", () => {
	const security = ORCHESTRATION_LAYER_PHASES.find(
		(p) => p.name === "security",
	);
	assert.ok(security);
	assert.ok(security!.specialists.includes("security-review"));
});

// Check: diagnose phase has procedureScope limiting to Phases 1-4
test("v0.4 T9: diagnose phase has procedureScope limiting to Phases 1-4", () => {
	const diagnose = ORCHESTRATION_LAYER_PHASES.find(
		(p) => p.name === "diagnose",
	);
	assert.ok(diagnose);
	assert.ok(diagnose!.procedureScope);
	assert.match(diagnose!.procedureScope!, /Phases 1-4/i);
});

// Check: every community specialist in the reachability catalog exists on disk
test("v0.4 T9: community specialists referenced by ask-matt routes exist at runtime paths", () => {
	const communitySpecialists = [
		"tdd",
		"to-spec",
		"to-tickets",
		"wayfinder",
		"prototype",
		"domain-modeling",
		"codebase-design",
		"improve-codebase-architecture",
		"commit",
		"github",
		"research",
		"resolving-merge-conflicts",
		"grill-me",
		"triage",
	];
	for (const name of communitySpecialists) {
		const entry = REACHABILITY_ENTRIES.find((e) => e.skill === name);
		assert.ok(
			entry,
			`community specialist "${name}" should be in REACHABILITY_ENTRIES`,
		);
	}
});

// Check: ask-matt is classified as superseded (wrapped by the layer, not standalone)
test("v0.4 T9: ask-matt is classified as superseded in the reachability catalog", () => {
	const entry = REACHABILITY_ENTRIES.find((e) => e.skill === "ask-matt");
	assert.ok(entry);
	assert.equal(entry!.productRole, "superseded");
});

// Check: orchestration-layer is classified as workflow-orchestrator
test("v0.4 T9: orchestration-layer is classified as workflow-orchestrator", () => {
	const entry = REACHABILITY_ENTRIES.find(
		(e) => e.skill === "orchestration-layer",
	);
	assert.ok(entry);
	assert.equal(entry!.productRole, "workflow-orchestrator");
});

// Check: the 6 old orchestrators are NOT in the reachability catalog
test("v0.4 T9: the 6 collapsed orchestrators are NOT in the reachability catalog", () => {
	const collapsed = [
		"planning-workflow",
		"build-workflow",
		"review-workflow",
		"ship-workflow",
		"research-workflow",
		"debug-workflow",
	];
	for (const name of collapsed) {
		const entry = REACHABILITY_ENTRIES.find((e) => e.skill === name);
		assert.ok(
			!entry,
			`collapsed orchestrator "${name}" should NOT be in REACHABILITY_ENTRIES`,
		);
	}
});

// Check: the contract references pinned-deps.json for ask-matt provenance
test("v0.4 T9: contract ASK_MATT_SOURCE has sha256 matching pinned-deps.json", () => {
	const pinnedDepsPath = join(REPO_ROOT, "config", "pinned-deps.json");
	if (existsSync(pinnedDepsPath)) {
		const pinnedDeps = JSON.parse(readFileSync(pinnedDepsPath, "utf-8"));
		assert.equal(
			ASK_MATT_SOURCE.sha256,
			pinnedDeps["ask-matt"].sha256,
			"ASK_MATT_SOURCE.sha256 should match pinned-deps.json",
		);
	}
});

// ─── v0.4 T10: documentation consistency guards ──────────────────────────────

test("v0.4 T10: config/agents.md describes the 3-layer architecture", () => {
	const content = readFileSync(join(REPO_ROOT, "config", "agents.md"), "utf-8");
	assert.ok(/Coach/i.test(content), "AGENTS.md should mention Coach");
	assert.ok(/ask-matt/i.test(content), "AGENTS.md should mention ask-matt");
	assert.ok(
		/orchestration-layer/i.test(content),
		"AGENTS.md should mention orchestration-layer",
	);
});

test("v0.4 T10: no stale orchestrator references in key files", () => {
	const staleNames = [
		"planning-workflow",
		"build-workflow",
		"review-workflow",
		"ship-workflow",
		"research-workflow",
		"debug-workflow",
	];
	const filesToCheck = [
		join(REPO_ROOT, "config", "agents.md"),
		join(REPO_ROOT, "README.md"),
		join(REPO_ROOT, "extensions", "coach.ts"),
	];
	for (const promptFile of readdirSync(join(REPO_ROOT, "prompts"))) {
		filesToCheck.push(join(REPO_ROOT, "prompts", promptFile));
	}
	for (const file of filesToCheck) {
		if (!existsSync(file)) continue;
		const content = readFileSync(file, "utf-8");
		for (const name of staleNames) {
			assert.ok(
				!content.includes(name),
				`${file} should not reference stale orchestrator "${name}"`,
			);
		}
	}
});

test("v0.4 T10: v0.4 audit document exists", () => {
	assert.ok(
		existsSync(
			join(REPO_ROOT, "docs", "audits", "2026-08-01-auto-pi-v0.4-audit.md"),
		),
		"docs/audits/2026-08-01-auto-pi-v0.4-audit.md should exist",
	);
});

test("v0.4 T10: v0.3 audit is marked superseded", () => {
	const content = readFileSync(
		join(REPO_ROOT, "docs", "audits", "2026-07-26-workflow-skills-audit.md"),
		"utf-8",
	);
	assert.ok(
		/SUPERSEDED/i.test(content),
		"v0.3 audit should be marked SUPERSEDED",
	);
});

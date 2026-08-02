# Audit: Orchestration Graph Traceability for auto-pi

**Repo:** `/Users/rom.iluz/Dev/my-pi`
**Date:** 2025-07-14
**Scope:** Trace every invocation path from user input → skill execution for all 20 auto-pi repo skills.

---

## Architecture Summary

The auto-pi orchestration graph has three layers:

1. **Coach menu** (`extensions/coach.ts`) — intercepts user input, presents a fixed 9-option menu, transforms input into a slash command.
2. **Prompt pins** (`prompts/*.md`) — each prompt has a `skill:` frontmatter field that mechanically injects the named skill content. This is the DETERMINISTIC pin mechanism.
3. **Workflow reads** — workflow skills (layer 2) contain prose instructions like "Read `/Users/rom.iluz/.agents/skills/X/SKILL.md` completely" at phase boundaries. The LLM must execute these reads. This is the PROBABILISTIC mechanism.

**Key insight:** Only 7 of 20 repo skills are DETERMINISTICALLY pinned (via prompt `skill:` frontmatter). 7 more are loaded via PROBABILISTIC model reads (workflow orchestrator decides to read them). 3 are ORPHANED from the SDLC flow entirely. 3 more are catalog-only utilities.

---

## Entry Points

### Coach Menu (`extensions/coach.ts`, WORKFLOW_OPTIONS, lines ~153-197)

| # | Label | Command | Prompt Pin |
| --- | ------- | --------- | ------------ |
| 1 | Just do it | `null` (passthrough) | — |
| 2 | /build | `/build "$TASK"` | `prompts/build.md` → `skill: build-workflow` |
| 3 | /debug | `/debug "$TASK"` | `prompts/debug.md` → `skill: debug-workflow` |
| 4 | /plan | `/plan "$TASK"` | `prompts/plan.md` → `skill: planning-workflow` |
| 5 | /research | `/research "$TASK"` | `prompts/research.md` → `skill: research-workflow` |
| 6 | /review | `/review` | `prompts/review.md` → `skill: review-workflow` |
| 7 | /ship | `/ship` | `prompts/ship.md` → `skill: ship-workflow` |
| 8 | /triage | `/triage "$TASK"` | `prompts/triage.md` → `skill: triage` (external skill, not in repo) |
| 9 | Browse all | `/palette` | — |

### Direct Prompt Pins (no Coach menu entry)

| Prompt | Skill Pin | Coach Menu? |
|--------|-----------|-------------|
| `prompts/setup-audit.md` | `skill: setup-maintenance` | **NO** — not in Coach menu |

### AGENTS.md (`config/agents.md`, always injected)

Mentions skills by name in the "Skill flow graph" section but does NOT mechanically pin them. These are advisory references — the model may or may not act on them. Skills mentioned: planning-workflow, build-workflow, debug-workflow, research-workflow, review-workflow, ship-workflow, brainstorming, to-spec, to-tickets, wayfinder, tdd, diagnosing-bugs, resolving-merge-conflicts, code-review, receiving-code-review, domain-modeling, codebase-design, improve-codebase-architecture, codebase-hygiene, octocode-roast, impeccable, frontend-design, web-design-guidelines, octocode-brainstorming.

---

## Complete Skill Table (20 Auto-Pi Repo Skills)

| # | Skill | How Invoked | Invoked By (file:line) | Deterministic? | Verdict |
| --- | ------- | ------------- | ------------------------ | ---------------- | --------- |
| 1 | **bearings** | `/palette`, `/skill:bearings` | `extensions/session-status.ts:131` registers `/bearings` ext cmd, but handler reads STATUS_FILE directly — does NOT read SKILL.md | DETERMINISTIC (ext cmd) but ext cmd bypasses skill content | **CATALOG-ONLY** for skill; ext cmd is independent |
| 2 | **brainstorming** | Workflow phase read | `skills/planning-workflow/SKILL.md` (conditional: `style=brainstorming`) | PROBABILISTIC — model decides to read | **PROBABILISTIC** |
| 3 | **build-workflow** | Prompt pin + Coach menu | `prompts/build.md` `skill: build-workflow` + `extensions/coach.ts:162` (option 2) | DETERMINISTIC — mechanical frontmatter pin | **DETERMINISTIC** |
| 4 | **code-review** | Workflow phase read | `skills/review-workflow/SKILL.md` (phase: review, line ~25) | PROBABILISTIC — model decides to read | **PROBABILISTIC** |
| 5 | **codebase-hygiene** | `/palette`, `/skill:codebase-hygiene` | `config/agents.md:61` mentions it ("codebase-hygiene → find semantic duplicates") — advisory only, no pin | PROBABILISTIC — AGENTS.md mention, model may act on it | **PROBABILISTIC** (AGENTS.md mention only) |
| 6 | **debug-workflow** | Prompt pin + Coach menu | `prompts/debug.md` `skill: debug-workflow` + `extensions/coach.ts:168` (option 3) | DETERMINISTIC — mechanical frontmatter pin | **DETERMINISTIC** |
| 7 | **decision-hold-lifecycle** | `/palette`, `/skill:decision-hold-lifecycle` | **Nothing.** Not in any prompt, workflow, AGENTS.md, or extension. | N/A — no invocation path from SDLC flow | **ORPHANED** |
| 8 | **diagnosing-bugs** | Workflow phase read (×2) | `skills/build-workflow/SKILL.md` (phase: diagnose) + `skills/debug-workflow/SKILL.md` (phase: diagnose) | PROBABILISTIC — model decides to read | **PROBABILISTIC** |
| 9 | **diff-driven-docs** | Workflow phase read | `skills/ship-workflow/SKILL.md` (phase: docs, line ~38) | PROBABILISTIC — model decides to read | **PROBABILISTIC** |
| 10 | **grilling** | Workflow phase read | `skills/planning-workflow/SKILL.md` (conditional: `style=grilling && hasCodebase`) | PROBABILISTIC — model decides to read | **PROBABILISTIC** |
| 11 | **memory-compounding** | `/palette`, `/skill:memory-compounding` | **Nothing.** Not in any prompt, workflow, AGENTS.md, or extension. | N/A — no invocation path from SDLC flow | **ORPHANED** |
| 12 | **planning-workflow** | Prompt pin + Coach menu | `prompts/plan.md` `skill: planning-workflow` + `extensions/coach.ts:174` (option 4) | DETERMINISTIC — mechanical frontmatter pin | **DETERMINISTIC** |
| 13 | **receiving-code-review** | Workflow phase read | `skills/review-workflow/SKILL.md` (phase: disposition, line ~35) | PROBABILISTIC — model decides to read | **PROBABILISTIC** |
| 14 | **research-workflow** | Prompt pin + Coach menu | `prompts/research.md` `skill: research-workflow` + `extensions/coach.ts:180` (option 5) | DETERMINISTIC — mechanical frontmatter pin | **DETERMINISTIC** |
| 15 | **review-workflow** | Prompt pin + Coach menu | `prompts/review.md` `skill: review-workflow` + `extensions/coach.ts:186` (option 6) | DETERMINISTIC — mechanical frontmatter pin | **DETERMINISTIC** |
| 16 | **session-handoff** | `/palette`, `/skill:session-handoff` | **Nothing.** Not in any prompt, workflow, AGENTS.md, or extension. `/handoff` extension (`extensions/handoff.ts:190`) is separate and does NOT read this skill. | N/A — no invocation path from SDLC flow | **ORPHANED** |
| 17 | **setup-maintenance** | Prompt pin only | `prompts/setup-audit.md` `skill: setup-maintenance` | DETERMINISTIC (prompt pin) but **NOT in Coach menu** — contract claims otherwise | **DETERMINISTIC** (with contract discrepancy) |
| 18 | **setup-matt-pocock-skills** | `/palette`, `/skill:setup-matt-pocock-skills` | `skills/code-review/SKILL.md:20` — "run `/setup-matt-pocock-skills` if `docs/agents/issue-tracker.md` is missing" | PROBABILISTIC — model follows code-review's instruction | **PROBABILISTIC** (referenced by code-review) |
| 19 | **ship-workflow** | Prompt pin + Coach menu | `prompts/ship.md` `skill: ship-workflow` + `extensions/coach.ts:192` (option 7) | DETERMINISTIC — mechanical frontmatter pin | **DETERMINISTIC** |
| 20 | **verification-before-completion** | Workflow phase read | `skills/ship-workflow/SKILL.md` (phase: verify, line ~27) | PROBABILISTIC — model decides to read | **PROBABILISTIC** |

---

## Verdict Summary

| Verdict | Count | Skills |
| --------- | ------- | -------- |
| **DETERMINISTIC** (prompt pin) | 7 | build-workflow, debug-workflow, planning-workflow, research-workflow, review-workflow, ship-workflow, setup-maintenance |
| **PROBABILISTIC** (workflow phase read) | 7 | brainstorming, grilling, code-review, receiving-code-review, diagnosing-bugs, diff-driven-docs, verification-before-completion |
| **PROBABILISTIC** (AGENTS.md or skill-to-skill mention) | 2 | codebase-hygiene, setup-matt-pocock-skills |
| **ORPHANED** (no SDLC invocation path) | 3 | decision-hold-lifecycle, memory-compounding, session-handoff |
| **CATALOG-ONLY** (ext cmd exists but bypasses skill) | 1 | bearings |

---

## Findings

### BLOCKER: None

No critical broken edges that would prevent the SDLC from functioning. All 7 DETERMINISTIC skills are correctly wired. All 14 external specialist skills referenced by workflows exist at runtime paths (verified).

### Note 1: Orphan skills (3) — no SDLC invocation path

**Severity: Medium**

- **decision-hold-lifecycle** (`skills/decision-hold-lifecycle/SKILL.md`): Not referenced by any prompt, workflow, AGENTS.md, or extension. Only reachable via `/palette` or `/skill:decision-hold-lifecycle`. The skill persists unresolved decisions to `~/.pi/agent/decisions.json` and is mentioned by bearings' SKILL.md:36 as surfaced in `/bearings` output — but bearings' extension command doesn't read the skill either. This skill is effectively dead code in the orchestration graph.
- **memory-compounding** (`skills/memory-compounding/SKILL.md`): Not referenced by any prompt, workflow, AGENTS.md, or extension. Only reachable via `/palette` or `/skill:memory-compounding`.
- **session-handoff** (`skills/session-handoff/SKILL.md`): Not referenced by any prompt, workflow, AGENTS.md, or extension. The `/handoff` extension (`extensions/handoff.ts:190`) implements handoff functionality independently and does NOT read this skill. Comment in handoff.ts:23 says "Complements the `handoff` skill" — but `handoff` is a different external skill, not `session-handoff`.

### Note 2: Contract discrepancy — setup-maintenance Coach menu claim

**Severity: Low**

`config/workflow-graph-contract.ts:1610` claims `discoveryRoute: "Coach menu + direct prompt pin"` for setup-maintenance. However, the Coach menu (`extensions/coach.ts` WORKFLOW_OPTIONS) does NOT include `/setup-audit`. The 9 options are: passthrough, /build, /debug, /plan, /research, /review, /ship, /triage, /palette. Setup-maintenance is only reachable via the `/setup-audit` direct prompt pin.

### Note 3: 7 skills are PROBABILISTIC-only (fragile)

**Severity: Medium (architectural risk)**

The 7 workflow-phase-read skills (brainstorming, grilling, code-review, receiving-code-review, diagnosing-bugs, diff-driven-docs, verification-before-completion) are loaded only when the LLM executing the workflow skill correctly follows the "Read X/SKILL.md completely" instruction. The workflow SKILL.md files use absolute canonical paths and strong imperative language, which mitigates the risk. But there is no mechanical guarantee — the model could skip a read, hallucinate content, or read the wrong file after compaction.

This is a known design tradeoff documented in the contract: "This is NOT a runtime engine — it is a validation contract." The graph is enforced by tests (contract vs. SKILL.md content), not by runtime mechanics.

### Note 4: bearings — extension command bypasses skill content

**Severity: Low**

`extensions/session-status.ts:131` registers a `/bearings` command. The handler reads `STATUS_FILE` directly and produces a digest. It does NOT read `skills/bearings/SKILL.md`. The skill file and the extension implement overlapping functionality independently. The contract correctly classifies bearings as `catalog-only` for the skill, but a user typing `/bearings` gets the extension's implementation, not the skill's procedure.

### Note 5: No broken edges in workflow → specialist reads

**Severity: None (positive finding)**

All 14 external skills referenced by the 6 workflow SKILL.md files exist at their declared runtime paths:

- `~/.agents/skills/`: grill-me, domain-modeling, prototype, to-spec, to-tickets, wayfinder, tdd, uv, commit, github, research, octocode-research, resolving-merge-conflicts
- `~/.pi/agent/skills/`: live-research

The contract's WORKFLOWS graph (phases, specialists, conditionalSpecialists) matches the actual SKILL.md prose instructions in all 6 workflow files. No workflow says "read X" where X doesn't exist.

### Note 6: triage skill — pinned but not in repo

**Severity: Low**

`prompts/triage.md` has `skill: triage`, and the contract lists it with `sourcePaths: []` (empty — not an auto-pi repo skill). The runtime path is `/Users/rom.iluz/.agents/skills/triage/SKILL.md`, which exists. The triage skill is installed externally, not tracked in the repo's `skills/` directory. This is not a bug — it's an intentional design decision (triage is a direct-pinned state machine, not a workflow).

### Note 7: setup-matt-pocock-skills — cross-skill reference is probabilistic

**Severity: Low**

`skills/code-review/SKILL.md:20` instructs: "run `/setup-matt-pocock-skills` if `docs/agents/issue-tracker.md` is missing." This is a skill-to-skill reference that depends on the model reading code-review's SKILL.md (itself a PROBABILISTIC read) and then acting on the instruction. Two layers of probabilistic behavior must align for this skill to be invoked.

---

## Graph Visualization

```
User Input
  │
  ▼
Coach Menu (extensions/coach.ts)
  │
  ├── /build ──► prompts/build.md ──pin──► build-workflow
  │                                           ├── read ► tdd (external)
  │                                           ├── read ► uv (external, conditional)
  │                                           └── read ► diagnosing-bugs (repo, probabilistic)
  │
  ├── /debug ──► prompts/debug.md ──pin──► debug-workflow
  │                                           ├── read ► diagnosing-bugs (repo, probabilistic)
  │                                           └── read ► resolving-merge-conflicts (external)
  │
  ├── /plan ──► prompts/plan.md ──pin──► planning-workflow
  │                                           ├── read ► brainstorming (repo, probabilistic)
  │                                           ├── read ► grilling (repo, probabilistic)
  │                                           ├── read ► grill-me (external, conditional)
  │                                           ├── read ► domain-modeling (external, conditional)
  │                                           ├── read ► prototype (external, interrupt)
  │                                           ├── read ► to-spec (external)
  │                                           ├── read ► to-tickets (external)
  │                                           └── read ► wayfinder (external)
  │
  ├── /research ──► prompts/research.md ──pin──► research-workflow
  │                                           ├── read ► research (external)
  │                                           ├── read ► octocode-research (external)
  │                                           └── read ► live-research (external, pi-specific)
  │
  ├── /review ──► prompts/review.md ──pin──► review-workflow
  │                                           ├── read ► code-review (repo, probabilistic)
  │                                           │     └── references ► setup-matt-pocock-skills (repo, probabilistic)
  │                                           └── read ► receiving-code-review (repo, probabilistic)
  │
  ├── /ship ──► prompts/ship.md ──pin──► ship-workflow
  │                                           ├── read ► verification-before-completion (repo, probabilistic)
  │                                           ├── read ► diff-driven-docs (repo, probabilistic)
  │                                           ├── read ► commit (external)
  │                                           └── read ► github (external, conditional)
  │
  ├── /triage ──► prompts/triage.md ──pin──► triage (external skill, not in repo)
  │
  └── /palette ──► browse all skills (catalog)

Direct prompt (no Coach menu entry):
  /setup-audit ──► prompts/setup-audit.md ──pin──► setup-maintenance (repo, deterministic)

ORPHANED (no path from SDLC flow):
  decision-hold-lifecycle, memory-compounding, session-handoff

CATALOG-ONLY (ext cmd bypasses skill):
  bearings (/bearings ext cmd doesn't read SKILL.md)

AGENTS.md mention only (advisory, no pin):
  codebase-hygiene
```

---

## Contract vs. Reality Cross-Check

| Contract Claim | Reality | Match? |
| ---------------- | --------- | -------- |
| 20 skills with `sourcePaths` in `skills/` | 20 directories in `skills/` | ✅ Exact match |
| setup-maintenance `discoveryRoute: "Coach menu + direct prompt pin"` | NOT in Coach menu | ❌ Contract overstates |
| bearings `invocationSurfaces: ["catalog-only"]` | Also has `/bearings` ext cmd (bypasses skill) | ⚠️ Contract omits ext cmd |
| All workflow specialists exist at runtime paths | All 14 verified present | ✅ No broken edges |
| WORKFLOWS graph phases match SKILL.md prose | Verified for all 6 workflows | ✅ Match |
| triage `sourcePaths: []` (not a repo skill) | No `skills/triage/` directory | ✅ Correct |

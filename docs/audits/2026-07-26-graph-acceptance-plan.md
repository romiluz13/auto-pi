# Harmony Build Plan: Graph-Level Acceptance + Reachability Matrix (2026-07-26)

**Status:** PLAN — pending GPT-5.6 review before building the graph-level tests.
**Built on:** commit 184dad0 (the 6 missing capabilities, NOT pushed).

---

## 1. Ask-matt reference graph → auto-pi disposition matrix

Every edge in Matt's `ask-matt` reference graph, with the auto-pi disposition under the harmony bar (trigger, invariant, artifact, exit equivalence).

### Main flow: idea → ship

| Ask-matt edge | Auto-pi disposition | Trigger | Invariant | Artifact | Exit | Verdict |
|---------------|---------------------|---------|-----------|----------|------|---------|
| `grill-with-docs` (sharpen + durable record) | **DELIBERATE SUBSTITUTION** — decomposed into `grilling` (style) + `domain-modeling` (durable capture) in planning-workflow's setup + brainstorm phases | bounded work | collaborative approval + durable domain capture when triggers apply | approved design (+ CONTEXT.md/ADR when triggered) | spec phase | ✅ equivalent (decomposed, not bundled) |
| `prototype` detour (runnable answer) | **EQUIVALENT** — planning-workflow "Prototype interrupt" (workflow-owned, consented) | design question needs runnable answer | throwaway, one command, no persistence | answer captured | resume design phase | ✅ equivalent |
| `to-spec` | **EQUIVALENT** — planning-workflow spec phase | bounded, design approved | seam confirmation | spec reference (issue) | tickets phase | ✅ equivalent |
| `to-tickets` | **EQUIVALENT** — planning-workflow tickets phase | spec published | ticket-breakdown approval | ticket refs + frontier | complete → `/build` | ✅ equivalent |
| `implement` (tdd → review → commit) | **DELIBERATE SUBSTITUTION** — decomposed into `build-workflow` (tdd) + `review-workflow` (code-review) + `ship-workflow` (commit) | a ticket | tdd red-green, fresh context per ticket, review before commit | verification evidence, commit hash | review → ship | ✅ equivalent (decomposed, invariants preserved) |
| `tdd` | **EQUIVALENT** — build-workflow tdd phase | a slice | red-green one slice at a time | passing test | diagnose or complete | ✅ equivalent |
| `code-review` | **EQUIVALENT** — review-workflow review phase | uncommitted diff | standards + spec (+ security) | findings with file:line | disposition or complete | ✅ equivalent (+ Security axis) |

### On-ramps

| Ask-matt edge | Auto-pi disposition | Verdict |
|---------------|---------------------|---------|
| `triage` (incoming issues) | **EQUIVALENT** — `/triage` prompt (direct pin) + 8th Coach option. Never triage to-tickets output. | ✅ equivalent |
| `diagnosing-bugs` (diagnose + fix) | **DELIBERATE SUBSTITUTION** — `debug-workflow` (diagnose only) + `build-workflow` (fix with TDD). Diagnosis is independently observable; fix goes through TDD. | ✅ equivalent (split) |
| `wayfinder` (foggy) | **EQUIVALENT** — planning-workflow wayfind phase. Collapses to spec/tickets when clear. | ✅ equivalent |
| `improve-codebase-architecture` (codebase health) | **ON-DEMAND** — in AGENTS.md (codebase health section) + reachable via `/palette` + `/skill:`. Not a workflow (it's upkeep, not feature work). Generates ideas → `/plan`. | ✅ reachable (on-demand) |

### Vocabulary underneath

| Ask-matt edge | Auto-pi disposition | Verdict |
|---------------|---------------------|---------|
| `domain-modeling` | **EQUIVALENT** — planning-workflow domain-modeling underlay (trigger-based: ambiguous terms, ADRs constrain, cross-module contracts, hard-to-reverse trade-off) | ✅ equivalent (trigger-based underlay) |
| `codebase-design` | **ON-DEMAND** — in AGENTS.md (vocabulary section) + reachable via `/palette` + `/skill:`. Not a workflow (it's vocabulary, not a phase). | ✅ reachable (on-demand) |

### Crossing sessions

| Ask-matt edge | Auto-pi disposition | Verdict |
|---------------|---------------------|---------|
| `handoff` | **EQUIVALENT** — `handoff.ts` extension (the `/handoff` command) + referenced in build-workflow + planning-workflow (recommend fresh session/handoff when smart zone threatened) | ✅ equivalent |
| `compact` (built-in) | **N/A** — Pi's built-in `/compact`, not a skill. AGENTS.md documents it. | ✅ equivalent (built-in) |

### Standalone

| Ask-matt edge | Auto-pi disposition | Verdict |
|---------------|---------------------|---------|
| `grill-me` (no codebase) | **GAP** — not in any workflow, not in AGENTS.md. Reachable via `/palette` + `/skill:grill-me` only. **Missing disposition:** planning-workflow could branch to grill-me when there's no codebase, but currently doesn't. | ⚠️ reachable but no explicit disposition |
| `prototype` | **EQUIVALENT** — planning-workflow prototype interrupt (also reachable standalone via `/skill:prototype`) | ✅ equivalent |
| `research` | **EQUIVALENT** — research-workflow | ✅ equivalent |
| `teach` | **ON-DEMAND** — reachable via `/palette` + `/skill:teach`. Not a workflow (it's a learning tool, not SDLC). | ✅ reachable (on-demand) |
| `writing-great-skills` | **ON-DEMAND** — reachable via `/palette` + `/skill:writing-great-skills`. Not a workflow (it's a reference, not SDLC). | ✅ reachable (on-demand) |

### Precondition

| Ask-matt edge | Auto-pi disposition | Verdict |
|---------------|---------------------|---------|
| `setup-matt-pocock-skills` | **ON-DEMAND** — reachable via `/palette` + `/skill:setup-matt-pocock-skills` + in repo skills/. Run before first flow to configure the issue tracker. Not a workflow (it's a one-time setup). | ✅ reachable (on-demand) |

---

## 2. Reachability matrix (every installed skill, classified)

**Total installed:** 94 skills (90 at `~/.agents/skills/` + 4 at `~/.pi/agent/skills/`).
**Reachable:** 94 (all reachable via `/palette` or `/skill:<name>` — no true orphans).

| Reachability type | Count | Examples |
|-------------------|-------|---------|
| **Workflow-bundled** (read by a workflow skill at a phase boundary) | 18 | brainstorming, to-spec, to-tickets, wayfinder, tdd, diagnosing-bugs, code-review, receiving-code-review, verification-before-completion, diff-driven-docs, commit, github, research, octocode-research, live-research, resolving-merge-conflicts, grilling, domain-modeling |
| **Prompt-pinned** (direct pin via a prompt's `skill:` frontmatter) | 2 | setup-maintenance (via /setup-audit), triage (via /triage) |
| **Workflow skills** (pinned by the 6 workflow prompts) | 6 | planning-workflow, build-workflow, review-workflow, ship-workflow, research-workflow, debug-workflow |
| **Extension-backed** (reachable via an extension command) | 1 | handoff (via /handoff — the extension, not the skill file) |
| **Situational** (triggered by a predicate inside a workflow) | 1 | uv (Python → build-workflow) |
| **AGENTS.md-documented** (referenced in AGENTS.md, reachable via /palette) | 3 | improve-codebase-architecture, codebase-design, compact (built-in) |
| **On-demand (standalone)** (reachable via `/palette` + `/skill:<name>`, not in any workflow) | ~63 | grill-me, teach, writing-great-skills, setup-matt-pocock-skills, + the community skills (MongoDB, Cloudflare, Vercel, etc.) |

### The one gap: `grill-me`

`grill-me` is Matt's standalone for no-codebase grilling. It's reachable via `/palette` + `/skill:grill-me`, but it has no explicit auto-pi disposition. Options:
- **(a) Leave it on-demand** — it's a standalone, not a normal-path skill. Reachable via `/palette`.
- **(b) Add it as a planning-workflow branch** — when there's no codebase, use grill-me instead of brainstorming.
- **(c) Document it in AGENTS.md** — as a standalone for no-codebase planning.

I lean **(a)** — it's a standalone, not a normal-path skill. But the genius may disagree.

---

## 3. Graph-level acceptance checks (the tests to build)

Per the genius's criterion 5, these are the graph-level checks:

1. ✅ **Every workflow prompt pins an existing workflow/specialist.** (Already tested: 59/59 pass.)
2. ✅ **Every workflow phase references resolvable skills.** (Already tested: "all specialist skills referenced by workflows exist at a known path.")
3. **NEW — Every normal completion/branch has an internal next phase, terminal state, or valid user-facing slash handoff.** (Test: parse each workflow's complete phase, verify it either routes internally or tells the user a valid next slash command.)
4. **NEW — Every slash handoff names an installed prompt/command and provides required arguments.** (Test: extract every "type `/<command>`" from the workflow skills, verify the command is an installed prompt or skill.)
5. ✅ **No workflow tells the user to invoke internal `/skill:*` commands.** (Already tested.)
6. **NEW — No phase specialist silently hijacks workflow routing.** (Test: verify each workflow skill has the "workflow owns the routing" rule + the "ignore specialist routing prose" instruction where applicable.)
7. **NEW — Every ask-matt route has an equivalence/disposition.** (Test: for each ask-matt edge, verify the auto-pi disposition exists — either in a workflow or documented as on-demand.)
8. **NEW — Every installed skill has a reachability classification.** (Test: generate the reachability matrix, verify no true orphans — every skill is reachable by at least one means.)

---

## 4. Questions for the genius

1. **The `grill-me` gap:** leave it on-demand (a), add it as a planning-workflow branch (b), or document it in AGENTS.md (c)? I lean (a).

2. **The `grill-with-docs` disposition:** I classified it as "DELIBERATE SUBSTITUTION — decomposed into grilling + domain-modeling." Is this the right disposition, or should we add `grill-with-docs` itself as a reachable skill (it's installed but we never load it)?

3. **The graph-level tests (checks 3-8):** are these the right 8 checks, or am I missing one? The genius's criterion 5 listed 8 — I mapped them. Is the mapping right?

4. **The reachability matrix:** I classified 94 skills into 7 reachability types. Is this the right classification, or should it be simpler?

5. **The big question (criterion 2):** "Every user-facing workflow must contain the optimal minimal set of specialist skills: no missing normal-path capability, but no bloated eager bundle." Does the planning-workflow's setup phase (which reads grilling + domain-modeling when triggered) count as "eager bundling"? I think not — they're trigger-based, not eager. But the genius may disagree.

Push back on the plan. Where am I wrong? What's missing? I'll fix the plan, then build the 5 new graph-level tests (checks 3-8), then you review the commit.

# Skill Content Quality Audit — 20 auto-pi Repo Skills

**Repo:** `/Users/rom.iluz/Dev/my-pi`
**Date:** 2025-07-29
**Scope:** Internal contradictions, impossible instructions, unsatisfiable state, broken references, ambiguous exit conditions, compaction resilience. Special attention to the 6 workflow orchestrators.

## Methodology

Every SKILL.md was read in full. Every referenced skill path was verified to exist (both in the repo's `skills/` dir and in `~/.agents/skills/`). Every referenced file (templates, scripts, extensions, state files) was checked. The 6 workflow orchestrators were evaluated for real orchestration vs. prose-only, and for reread-after-phase protocol integrity.

## Workflow Orchestrator Verdict (the 6)

**All 6 workflow orchestrators genuinely orchestrate — they are not just descriptions.** Each has:

1. **Explicit phase transitions** — "Go to **[next phase]**" at the end of every phase, not implied.
2. **Real reread protocol** — "Reread this workflow skill" is called out at every phase transition AND after compaction. This is a repeated, explicit instruction, not a one-time mention. The pattern is: emit state block → reread workflow → go to next phase.
3. **Structured state blocks** — compact text blocks printed into the conversation, with reconstruction-from-artifacts as the compaction fallback.
4. **Evidence gates** — "Do NOT advance without [specific evidence]" at every phase boundary.
5. **Specialist isolation** — "Follow only the active phase's specialist. Do not preload other specialists."
6. **Routing ownership** — "The workflow owns the routing. Specialist skills own the procedure. Do not follow specialist routing prose."

The reread protocol is real and mechanically followable: the agent reads the workflow SKILL.md, enters a phase, reads the specialist SKILL.md, follows its procedure, emits the state block, rereads the workflow SKILL.md, and transitions. This is a genuine loop, not prose.

---

## Per-Skill Findings

### 1. planning-workflow — CLEAN

**File:** `skills/planning-workflow/SKILL.md`

- Well-structured with classify → setup → brainstorm → spec → tickets → complete (bounded) and classify → wayfind → complete (foggy).
- All referenced skills exist: `grilling`, `grill-me`, `brainstorming`, `domain-modeling`, `prototype`, `to-spec`, `to-tickets`, `wayfinder` — all verified at `~/.agents/skills/<name>/SKILL.md`.
- Prototype interrupt is well-specified with `prototype: proposed | declined | running | complete` state tracking.
- Foggy→bounded transitions are explicit: `ready-for-brainstorm` routes through setup (not directly to brainstorm); `ready-for-spec` sets `design: approved` and skips style/domain capture.
- Compaction resilience: state block is grounded in artifacts (spec URL, ticket refs, map reference).

**Note (non-defect):** Smart-zone checkpoint at spec phase references "~120k tokens" — this is a soft heuristic the agent cannot precisely measure, but it's guidance not a gate. Acceptable.

---

### 2. build-workflow — MINOR

**File:** `skills/build-workflow/SKILL.md`

**Defect 1 — Phase 6 gap (MINOR, potentially MAJOR in practice):**

- Line 54: `"Follow the specialist's Phases 1–4 (establish the feedback loop, reproduce, form hypotheses, find the root cause). Do NOT execute the specialist's Phase 5 (Fix + regression test) — the fix + regression test happen in the tdd phase, not here."`
- The instruction explicitly addresses Phases 1–4 (follow) and Phase 5 (prohibit) but says **nothing about Phase 6** (Cleanup + post-mortem). Phase 6 of `diagnosing-bugs` includes removing `[DEBUG-...]` instrumentation, deleting throwaway prototypes, and re-running the original repro. An agent following the workflow literally would skip Phase 6 entirely. When it returns to tdd, the tdd skill has no knowledge of `[DEBUG-...]` tags, so debug instrumentation could be left in the codebase.
- **Fix:** Add "Phase 6 (Cleanup + post-mortem) happens in the tdd phase after the fix is applied — ensure [DEBUG-...] instrumentation is removed and the original repro no longer reproduces."

**Defect 2 — Phase 4 parenthetical imprecision (MINOR):**

- Line 54: The parenthetical `"(establish the feedback loop, reproduce, form hypotheses, find the root cause)"` maps to Phases 1–4, but Phase 4 is named "Instrument", not "find the root cause". Finding the root cause is the *outcome* of instrumentation. Imprecise but not functionally wrong.

---

### 3. review-workflow — CLEAN

**File:** `skills/review-workflow/SKILL.md`

- Well-structured with review → disposition → complete.
- Correctly extends `code-review`'s two-axis design with a third Security reviewer (auto-pi policy). The workflow provides enough instruction for the third reviewer ("injection, auth, secrets, unsafe operations" + fresh context rule).
- `findings: none` → skip disposition → go to complete. Clean short-circuit.
- `needs-user-decision` dispositions keep the workflow in disposition until resolved. Good.
- All referenced skills exist: `code-review`, `receiving-code-review`.

---

### 4. ship-workflow — CLEAN

**File:** `skills/ship-workflow/SKILL.md`

- Well-structured with verify → docs → commit → github → complete.
- GitHub phase is correctly conditional ("Does the repo have a GitHub remote? Does the user want to push/PR?").
- CI failure loops back to verify — real feedback loop.
- Commit skip optimization: "If the working tree is already committed, skip to github." Good.
- All referenced skills exist: `verification-before-completion`, `diff-driven-docs`, `commit`, `github`.

---

### 5. research-workflow — CLEAN

**File:** `skills/research-workflow/SKILL.md`

- Well-structured with classify → investigate → complete.
- Correctly documents the `live-research` path exception: `"Exception: live-research is at /Users/rom.iluz/.pi/agent/skills/live-research/SKILL.md (a pi-specific package)."` — verified to exist at that path.
- All three research type specialists exist: `research`, `octocode-research`, `live-research`.

---

### 6. debug-workflow — MINOR

**File:** `skills/debug-workflow/SKILL.md`

**Defect 1 — Phase 6 gap (MINOR, same as build-workflow):**

- Line 42: `"Follow the specialist's Phases 1–4... Do NOT execute the specialist's Phase 5 (Fix + regression test) — the fix + regression test happen in /build (TDD), not here."`
- Same issue as build-workflow: Phase 6 (Cleanup + post-mortem) is unaddressed. The debug-workflow goes to `complete` and tells the user to type `/build`. Phase 6 cleanup (removing debug instrumentation, deleting throwaway prototypes) would need to happen during `/build`, but neither the debug-workflow nor the build-workflow carries this forward.
- **Fix:** Add "Phase 6 cleanup (remove [DEBUG-...] tags, delete throwaway prototypes) happens during /build after the fix."

**Defect 2 — Phase 4 parenthetical imprecision (MINOR):**

- Line 42: Same as build-workflow — "find the root cause" describes the outcome of Phase 4 (Instrument), not the phase name.

---

### 7. brainstorming — CLEAN

**File:** `skills/brainstorming/SKILL.md`

- Clear HARD-GATE: design approval required before any implementation action.
- Visual companion reference: `skills/brainstorming/visual-companion.md` — verified to exist.
- Process flow graph (dot syntax) is a diagram, not executable — fine.
- Defers navigation to planning-workflow: `"The /plan prompt tells you what to type."` and `"Do not publish the spec, commit, create tickets, or name the next command. The prompts own the navigation."` — consistent with planning-workflow owning routing.
- Self-review checklist (placeholder scan, internal consistency, scope check, ambiguity check) is well-defined.
- Exit condition: return approved-design handoff and stop. Clear.

---

### 8. bearings — MINOR

**File:** `skills/bearings/SKILL.md`

**Defect 1 — No missing-file handling (MINOR):**

- Lines 15, 21: `"Read ~/.pi/agent/session-status.jsonl"` and `"Also read ~/.pi/agent/decisions.json for open decisions."`
- On a fresh setup, these files may not exist. The skill doesn't say to handle missing files gracefully. The "Every section ALWAYS renders, even when empty" rule implies the agent should handle empty/missing data, but it's not explicit.
- **Fix:** Add "If a file doesn't exist, treat it as empty."

---

### 9. codebase-hygiene — CLEAN

**File:** `skills/codebase-hygiene/SKILL.md`

- Advisory-only, routes changes through `/build`. Clear.
- Three-gate consolidation discipline (tests + callers + re-run) is well-defined.
- No broken references.
- Exit condition: emit findings. Clear.

---

### 10. decision-hold-lifecycle — CLEAN

**File:** `skills/decision-hold-lifecycle/SKILL.md`

- Clear hold/resolve lifecycle with idempotent keys.
- `decisions.json` format is well-specified (array of objects with key, title, reason, project, createdAt, resolved).
- `user-invocable: false` is intentional — auto-triggered when unresolved decisions are discovered.
- Exit condition: when the user's answer is durably recorded. Clear.

---

### 11. memory-compounding — MINOR

**File:** `skills/memory-compounding/SKILL.md`

**Defect 1 — Markdown vs SQLite ambiguity (MINOR):**

- Line 21: `"For each entry in ~/.pi/agent/pi-hermes-memory/MEMORY.md, USER.md, failures.md, and the SQLite memories table (via memory_search), apply exactly one outcome"`
- The skill doesn't clarify the relationship between the markdown files and the SQLite table. Are they the same data in different formats? Different stores? If both exist, does the agent review the same entry twice? The skill should clarify which is authoritative or how they relate.
- All referenced files exist: `MEMORY.md`, `USER.md`, `failures.md` verified at `~/.pi/agent/pi-hermes-memory/`.

---

### 12. session-handoff — CLEAN

**File:** `skills/session-handoff/SKILL.md`

- References `extensions/handoff.ts` — verified to exist at `/Users/rom.iluz/.pi/agent/extensions/handoff.ts`.
- References `intercom` tool — available in Pi.
- References `compact-safe` — verified to exist at `~/.agents/skills/compact-safe`.
- References `session-status.ts` extension — verified to exist.
- Clear procedure: write doc → save memory → discover target → notify → confirm.
- Exit condition: confirm to user. Clear.

---

### 13. setup-maintenance — CLEAN

**File:** `skills/setup-maintenance/SKILL.md`

- Well-structured two-loop design (maintenance + improvement).
- References `coach.ts` — verified to exist at `/Users/rom.iluz/.pi/agent/extensions/coach.ts`.
- `/setup-audit` dispatches 6 parallel subagents — requires Agent tool, available in Pi.
- On-add harmony gate is well-specified.
- Exit condition: report at `docs/audits/setup-audit-YYYY-MM-DD.md`. Clear.

---

### 14. grilling — MINOR

**File:** `skills/grilling/SKILL.md`

**Defect 1 — Ambiguous exit condition (MINOR):**

- Line 6: `"Interview me relentlessly about every aspect of this until we reach a shared understanding."`
- Line 12: `"Do not act on it until I confirm we have reached a shared understanding."`
- "Shared understanding" is undefined — when is it achieved? There's no checklist, no criteria, no state field. The planning-workflow compensates with `design: pending | approved`, so the workflow knows when to advance. But the grilling skill itself has no exit condition.
- The skill is also very thin (11 lines of content) with no structured procedure, phases, or state protocol. It relies entirely on the planning-workflow for structure.

---

### 15. setup-matt-pocock-skills — CLEAN

**File:** `skills/setup-matt-pocock-skills/SKILL.md`

- All seed templates verified to exist: `issue-tracker-github.md`, `issue-tracker-gitlab.md`, `issue-tracker-local.md`, `triage-labels.md`, `domain.md`.
- `disable-model-invocation: true` is intentional — user-triggered setup skill.
- Clear explore → present → confirm → write → done procedure.
- Correctly checks for `triage` skill existence dynamically rather than assuming.
- Exit condition: "Tell the user the setup is complete." Clear.

---

### 16. code-review — MINOR

**File:** `skills/code-review/SKILL.md`

**Defect 1 — Impossible instruction (MINOR):**

- Line 20: `"The issue tracker should have been provided to you — run /setup-matt-pocock-skills if docs/agents/issue-tracker.md is missing."`
- The agent cannot run slash commands (per AGENTS.md: "The skill pin only fires when a HUMAN types the slash command. The agent cannot run slash commands."). Additionally, `setup-matt-pocock-skills` has `disable-model-invocation: true`, so the agent can't auto-invoke it either. The instruction should say "tell the user to run `/setup-matt-pocock-skills`".
- **Fix:** Change "run `/setup-matt-pocock-skills`" to "tell the user to run `/setup-matt-pocock-skills`".

Otherwise excellent: two-axis review with smell baseline, friction scan, AI-generated anti-patterns, no-self-grading downgrade rule. Upstream + local-patch metadata is well-documented.

---

### 17. diagnosing-bugs — MINOR

**File:** `skills/diagnosing-bugs/SKILL.md`

**Defect 1 — Ambiguous slash-command reference (MINOR):**

- Line 150: `"hand off to the /improve-codebase-architecture skill with the specifics."`
- "Hand off to" is ambiguous — the agent can't invoke slash commands. Should say "tell the user to run `/improve-codebase-architecture`". The skill `/improve-codebase-architecture` exists at `~/.agents/skills/improve-codebase-architecture`, so the reference isn't broken, just the invocation mode is wrong.

Otherwise excellent: 6-phase structure with tight completion criteria, hypothesis quality criteria, causal chain gate, debug attempt tracking. References `scripts/hitl-loop.template.sh` — verified to exist. References `CONTEXT.md` and ADRs — conventional. The `local-patch` metadata correctly describes the AI-agent failure-mode guards.

---

### 18. receiving-code-review — CLEAN

**File:** `skills/receiving-code-review/SKILL.md`

- Clear response pattern (READ → UNDERSTAND → VERIFY → EVALUATE → RESPOND → IMPLEMENT).
- Dispute contract is well-defined: `"A dispute is valid ONLY if it carries a concrete VERIFY_COMMAND whose output PROVES the finding false."`
- Calibration note is consistent with code-review's no-self-grading-downgrade rule.
- GitHub thread reply command (`gh api .../replies`) is correct.
- Exit condition: all items clarified, implemented, and tested. Clear.

---

### 19. diff-driven-docs — CLEAN

**File:** `skills/diff-driven-docs/SKILL.md`

- Clear 3-layer impact classifier (business/technical/audit) with a comprehensive table.
- SKIP short-circuit: "If all three layers are SKIP: set IMPACT_LEVEL: none and emit a SKIPPED note immediately."
- Step 3 verification: "re-read the changed doc section against the actual diff."
- Exit condition: emit SKIPPED note or write + verify needed updates. Clear.

---

### 20. verification-before-completion — MINOR

**File:** `skills/verification-before-completion/SKILL.md`

**Defect 1 — Stale count (MINOR):**

- Line 116: `"From 24 failure memories:"` — this is a hardcoded count that will go stale as memories are added or removed. Not functionally important (the count is context, not a procedure step), but factually imprecise.
- **Fix:** Change to "From failure memories:" or make the count dynamic.

Otherwise excellent: Iron Law, Gate Function, Phantom-Green Failure defense, evidence block format. Well-defined exit condition (verification command run + output confirms claim).

---

## Cross-Cutting Patterns

### Pattern 1: Specialist skills tell the agent to "run" slash commands (3 instances)

Three specialist skills use language that implies the agent can run slash commands:

- `code-review:20` — "run `/setup-matt-pocock-skills`"
- `diagnosing-bugs:150` — "hand off to the `/improve-codebase-architecture` skill"
- `codebase-hygiene:8,58` — "route the change through `/build`"

In all cases, the intent is "tell the user to run the command." The workflow orchestrators correctly handle this (they say "Never ask the user to type an internal `/skill:*` command" but DO tell users to type workflow-level commands like `/build`, `/review`, `/ship`). The specialists should use the same pattern: "tell the user to run X" rather than "run X."

**Severity:** MINOR — intent is clear from context, but the wording is mechanically wrong.

### Pattern 2: Phase 6 gap in build-workflow and debug-workflow

Both workflows that route to `diagnosing-bugs` say "Follow Phases 1–4, do NOT execute Phase 5" but say nothing about Phase 6 (Cleanup + post-mortem). This creates a gap where debug instrumentation (`[DEBUG-...]` tags, throwaway prototypes) may not be cleaned up.

**Severity:** MINOR (could be MAJOR if an agent follows the workflow literally and leaves debug code in production).

### Pattern 3: Compaction resilience is well-designed across all 6 workflows

All 6 workflow orchestrators have:

- State blocks printed into the conversation (survives compaction as text)
- "On every continuation: read the latest state block from the conversation. If missing or ambiguous, STOP — reconstruct from conversation artifacts."
- "Compaction is a residual risk" rule with reconstruction from artifacts
- "Reread this workflow skill after compaction"

The non-workflow skills that need persistence (bearings, decision-hold-lifecycle, memory-compounding, session-handoff) all write to disk, so they're compaction-immune by design. The conversational skills (brainstorming, grilling) rely on the workflow's state block for compaction resilience, which is the correct design.

**What survives compaction:** State blocks (text in conversation), artifact references (spec URLs, ticket refs, commit hashes, PR URLs), disk files (decisions.json, session-status.jsonl, memory files, handoff docs).

**What doesn't survive:** Conversational design details (brainstorming discussions, grilling Q&A), in-progress phase checklists (diagnosing-bugs phase checkboxes), intermediate reasoning. The workflows acknowledge this and provide reconstruction paths.

---

## Summary Verdicts

| Skill | Verdict | Key Issue |
| ------- | --------- | ----------- |
| planning-workflow | CLEAN | — |
| build-workflow | MINOR | Phase 6 gap; Phase 4 parenthetical imprecision |
| review-workflow | CLEAN | — |
| ship-workflow | CLEAN | — |
| research-workflow | CLEAN | — |
| debug-workflow | MINOR | Phase 6 gap; Phase 4 parenthetical imprecision |
| brainstorming | CLEAN | — |
| bearings | MINOR | No missing-file handling |
| codebase-hygiene | CLEAN | — |
| decision-hold-lifecycle | CLEAN | — |
| memory-compounding | MINOR | Markdown vs SQLite ambiguity |
| session-handoff | CLEAN | — |
| setup-maintenance | CLEAN | — |
| grilling | MINOR | Ambiguous exit condition |
| setup-matt-pocock-skills | CLEAN | — |
| code-review | MINOR | Impossible "run" slash-command instruction |
| diagnosing-bugs | MINOR | Ambiguous "hand off to" slash-command reference |
| receiving-code-review | CLEAN | — |
| diff-driven-docs | CLEAN | — |
| verification-before-completion | MINOR | Stale hardcoded count |

**Overall: 0 CRITICAL, 0 MAJOR, 9 MINOR, 11 CLEAN.**

The skill content is high quality. The 6 workflow orchestrators are genuinely well-designed with real reread-after-phase protocols — they orchestrate, not just describe. The defects found are minor wording/gap issues, not structural failures. The most actionable fix is closing the Phase 6 gap in build-workflow and debug-workflow to prevent debug instrumentation from being left in the codebase.

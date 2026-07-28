# Harmony Audit: auto-pi v0.3 vs Matt Pocock Skills (2026-07-26)

**Status:** DECISION / HARMONY AUDIT — not an implementation plan.
**Agreed by:** builder (Claude, this session) + external reviewer (GPT-5.6, session `019f9fe0`) through three-round intercom debate.
**Upstream source:** `/Users/rom.iluz/Dev/mattpocock-skills` at commit `ed37663` (fetched from origin, up-to-date).
**Scope:** research/learning only. No production code changed. Proposed changes below are **decisions pending a separately approved build** — not implementation.

---

## The harmony definition

Auto-pi is in harmony with Matt Pocock's skills when, for each upstream flow edge, the four equivalences hold **under the edge's applicable preconditions**:

1. **Trigger equivalence** — the same situation is recognized.
2. **Procedure-invariant equivalence** — the important safety/reasoning constraints survive.
3. **Artifact/evidence equivalence** — downstream gets durable inputs of equal or better quality.
4. **Exit equivalence** — the handoff preserves downstream assumptions.

The bar is **semantic equivalence, not filename or coverage equivalence**. An approved design stored in an issue is equivalent to a local doc if the same durable information and review gate survive. Coverage of every skill is **not** required; superset behavior is **not** required.

---

## Drift status (verified 2026-07-26)

Every upstream Matt Pocock engineering skill was diffed against the installed version in `~/.agents/skills/`. 16 of 18 match upstream exactly. 2 are drifted (intentional local patches):

| Skill | Upstream | Ours | The local addition |
|-------|----------|------|--------------------|
| `code-review` | 6,740 B | 7,862 B | "Review depth checks" — friction scan, AI-generated anti-patterns, no-self-grading-downgrade |
| `diagnosing-bugs` | 8,536 B | 9,396 B | Hypothesis quality criteria, causal chain gate, debug attempt tracking |

The other 16 engineering skills (`ask-matt`, `codebase-design`, `domain-modeling`, `grill-with-docs`, `grilling`, `implement`, `improve-codebase-architecture`, `prototype`, `research`, `resolving-merge-conflicts`, `setup-matt-pocock-skills`, `tdd`, `to-spec`, `to-tickets`, `triage`, `wayfinder`) match upstream.

---

## Upstream → auto-pi equivalence matrix

Matt's main flow: `grill-with-docs → [prototype detour] → to-spec → to-tickets → implement (tdd → code-review → commit)`

Auto-pi's flow: `planning-workflow (brainstorming → to-spec → to-tickets | wayfinder) → build-workflow (tdd | diagnosing-bugs on RED) → review-workflow (code-review → receiving-code-review) → ship-workflow (verification → diff-driven-docs → commit → github conditional)`

| Upstream edge | Auto-pi equivalent | Trigger | Invariant | Artifact | Exit | Verdict |
|---------------|-------------------|---------|-----------|----------|------|---------|
| `grill-with-docs` (sharpen + durable record) | planning-workflow brainstorm phase + domain-modeling underlay | bounded work | collaborative approval + durable domain capture when triggers apply | approved design (+ CONTEXT.md/ADR when triggered) | spec phase | **GAP — see Missing capabilities** |
| `to-spec` | planning-workflow spec phase | bounded, design approved | seam confirmation | spec reference (issue) | tickets phase | ✅ equivalent |
| `to-tickets` | planning-workflow tickets phase | spec published | ticket-breakdown approval | ticket refs + frontier | complete → `/build` | ✅ equivalent |
| `implement` (tdd → review → commit) | `build-workflow` (tdd) + `review-workflow` (code-review) + `ship-workflow` (commit) | a ticket | tdd red-green, fresh context per ticket, review before commit | verification evidence, commit hash | review → ship | **DELIBERATE SUBSTITUTION — see below** |
| `tdd` | build-workflow tdd phase | a slice | red-green one slice at a time | passing test | diagnose or complete | ✅ equivalent |
| `code-review` | review-workflow review phase | uncommitted diff | standards + spec (+ security, auto-pi addition) | findings with file:line | disposition or complete | ✅ equivalent (+ Security axis) |
| `diagnosing-bugs` (diagnose **and fix** with regression test) | `debug-workflow` (diagnose only) + `build-workflow` (fix with TDD) | bug | feedback loop, root cause | root cause diagnosis | `/build <fix>` | **DELIBERATE SUBSTITUTION — see below** |
| `wayfinder` | planning-workflow wayfind phase | foggy | decisions, not deliverables | map reference + outcome | resume or route | ✅ equivalent |
| `prototype` (design question → throwaway runnable answer) | **not in any workflow** | design question needs runnable answer | throwaway, one command, no persistence | answer captured | resume design | **GAP — see Missing capabilities** |
| `triage` (incoming issues → agent-ready briefs) | **not exposed** | incoming raw issues/PRs | triage roles, not to-tickets output | agent-ready briefs | `/build` | **GAP — see Missing capabilities** |
| `research` | research-workflow | cited findings needed | high-trust primary sources | cited markdown file | `/plan` or `/build` | ✅ equivalent |
| `receiving-code-review` | review-workflow disposition phase | review findings received | verify before accepting or queuing; push back if wrong | dispositions with reasons | complete | ✅ equivalent |
| `domain-modeling` (vocabulary underneath) | **on-demand only**, not loaded by any workflow | domain term resolved | glossary/ADR | CONTEXT.md / ADR | — | **GAP — see Missing capabilities** |
| `handoff` (cross-session) | `handoff.ts` extension + skill | session full / smart zone | preserve context | HANDOFF.md | fresh session | ✅ equivalent |

---

## Deliberate substitutions (documented, not gaps)

### `ask-matt` → **Coach** (the control-plane substitution)
Matt's `ask-matt` is a human-invoked prose router over individual slash commands — it recreates the user burden auto-pi exists to remove. Coach is deterministic at the control boundary: the user sees a fixed workflow menu, the selected workflow receives a mechanical `skill:` pin. `ask-matt` becomes a **versioned semantic routing reference** used by harmony audits like this one — not a runtime dependency. The two do not compete.

### `implement` → **build-workflow + review-workflow + ship-workflow** (the macro decomposition)
Matt's `implement` bundles tdd → code-review → commit. Auto-pi decomposes it into three independent workflows so each phase is independently observable, anti-anchored, and user-controlled. This is a deliberate split, not an inferior substitute — **provided Matt's invariants survive**:

| Matt's `implement` invariant | Auto-pi preservation |
|------------------------------|----------------------|
| Work from a spec/ticket | build-workflow captures the ticket + acceptance criteria at entry |
| `tdd` at pre-agreed seams | build-workflow tdd phase (one red-green slice at a time) |
| Regular typecheck / single-test / full-suite cadence | build-workflow: "test/lint/typecheck commands pass"; needs **explicit cadence** (see Missing capabilities) |
| `code-review` before commit | review-workflow (separate workflow, not bundled into build) |
| Commit on current branch | ship-workflow commit phase (commit always authorized by `/ship`; never push main) |
| **Fresh context per ticket** | **NOT explicit** — build-workflow does not enforce one-ticket-per-invocation or refuse multiple tickets. See Missing capabilities. |

**Verdict:** build-workflow supersedes `implement` at runtime **only if** the invariant mapping is completed — the fresh-context-per-ticket rule and explicit typecheck cadence are currently missing.

### `diagnosing-bugs` fix → **debug-workflow diagnosis + build-workflow fix** (the control-plane split)
Matt's `diagnosing-bugs` Phase 5 explicitly does "Fix + regression test." Auto-pi's `/debug` is **diagnosis only**; the fix + regression test happen in `/build` (TDD). This is a deliberate control-plane decomposition analogous to the `implement` split: diagnosis is independently observable, and the fix goes through TDD (not a bare patch). The invariant (regression test before fix) survives in build-workflow's tdd phase. Documented as a deliberate split, not upstream-equivalent behavior.

---

## Missing capabilities agreed for future design

These are **decisions pending a separately approved build** — not implemented in this research-only step.

### 1. Planning domain underlay (the biggest harmony gap)
**Gap:** Matt's `grill-with-docs` carries a durable semantic — it updates `CONTEXT.md` and ADRs through `domain-modeling`. Our `brainstorming` returns a conversation summary that compaction can erase. The domain record is lost.

**Decision:** planning-workflow loads `domain-modeling` as an **underlay** (not a style switch) when these triggers apply:
- ambiguous/overloaded domain terms materially affect the design;
- existing CONTEXT/ADRs constrain the change;
- cross-module/domain contracts are being changed;
- a hard-to-reverse, surprising trade-off with genuine alternatives is likely;
- the user explicitly asks to document/stress-test.

The underlay is **trigger-based**, not default. No ceremony merely because the domain is "complex" — `domain-modeling`'s own thresholds constrain behavior: glossary updates only when terminology is actually resolved; ADR only when hard-to-reverse + surprising + genuine trade-off.

### 2. Planning style switch (user-controlled, not silent agent escalation)
**Decision:** brainstorming is the default style. Grilling requires **explicit user intent or explicit consent**, never silent agent escalation:

```
bounded planning
  default: brainstorming
  if user explicitly asks to grill/stress-test → grilling
  if agent detects ambiguity/risk that would benefit from grilling
    → explain why briefly and ask permission once
    → yes: grilling
    → no: continue brainstorming
```

Relentless interviewing is a meaningful UX mode; silently imposing it violates user control and could make ordinary planning exhausting. The style switch is one of two high-friction transitions that require explicit user control; the other is the prototype interrupt.

### 3. Prototype detour (workflow-owned, consented interrupt)
**Gap:** Matt's `prototype` is a first-class branch when a design question needs a runnable answer. Our planning-workflow has no prototype branch.

**Decision:** the prototype detour is a **workflow-owned interrupt** in planning-workflow (not a classify branch, not inside the specialist — the workflow owns routing, the specialist owns procedure). It requires **explicit user consent** before building (it changes modality/cost):

```
design phase (brainstorm or grill)
  if a material question cannot be settled by reasoning/evidence alone:
    explain the design question the prototype would answer; ask permission once
    if declined: record the uncertainty and continue/stop (do not pretend it was resolved)
    if approved:
      checkpoint current design state
      read prototype
      build throwaway answer
      capture conclusion + delete/isolate prototype
      reread planning-workflow
      resume the same design phase with conclusion
```

Handoff to a fresh session is needed only if context pressure or isolation demands it — do not mechanically handoff every small prototype.

### 4. Triage discoverability
**Gap:** Matt's `triage` is an on-ramp for incoming raw issues/PRs. Auto-pi does not expose it. The user would have to know to type `/skill:triage`, which violates the "don't remember every skill" goal.

**Decision:** add `/triage` as a direct pin (upstream `triage` is already a substantial self-contained state machine — no wrapper until composition/state evidence requires one). Make it Coach-discoverable as an **8th workflow option** (the "fixed seven" is not sacred — there are already 9 options including raw + palette). Direct-pin upstream triage itself; never triage `to-tickets` output (Matt's rule: tickets produced by `to-tickets` are already agent-ready).

**Open empirical question:** does the 8th option make the menu noisy? If yes, group `setup-audit` + `triage` under a secondary category later. This is UX testing, not architecture.

### 5. Fresh-context-per-ticket invariants (both ends)
**Gap:** build-workflow does not enforce one-ticket-per-invocation or refuse multiple tickets. Matt's `implement` says "clearing context between each one."

**Decision:** both planning and build own different halves:
- **Planning exit invariant:** completion tells the user each frontier ticket is a separate build session; recommend fresh `/build <ticket>`.
- **Build entry invariant:** one invocation accepts exactly one ticket/slice-sized unit. If multiple tickets are supplied, refuse/break them apart. Detect inherited unrelated context and recommend fresh session/handoff when it threatens the smart zone.

Build must defend its own precondition because it can be entered from triage, a manually written issue, or direct user input — not just from planning. For a tracker ticket, the ticket itself is the durable handoff; a full conversation handoff may be unnecessary.

### 6. Provenance + drift automation for the 2 local forks
**Gap:** "the drift is the patch" is weak supply-chain governance. Tomorrow upstream may improve the same section and a copy could silently erase local guards or leave the fork stale.

**Decision:** keep the effective local forks as the runtime skills (do not revert to upstream + a separate patch file — that complicates loading). Add:
- frontmatter metadata or adjacent manifest recording upstream repo/path/commit/hash + local patch intent/owner;
- automated three-way drift check when upstream updates;
- test that upstream changes outside local patch hunks are not silently missed.

### 7. Calibrate local review heuristics
The local `code-review` additions (friction scan, AI anti-patterns) are currently phrased as automatic severities. They should be **evidence-seeking candidates, not automatic findings**:
- "Sequential awaits where `Promise.all` would do" is not inherently an anti-pattern — ordering, rate limits, resource contention, transaction semantics, and fail-fast behavior matter. Phrase as a candidate requiring proof.
- `>4 files/>2 directories` and `>3 cross-imports` are heuristics, not objective severities. Review must verify impact before MEDIUM/HIGH.

---

## Non-goals (what we are NOT doing)

- **Use every Matt skill.** Coverage is not the bar. Skills not on a normal path stay on-demand via `/skill:` or Coach hints.
- **Make `ask-matt` the runtime router.** It is a versioned semantic routing reference for harmony audits. Coach is the sole normal router.
- **Load every specialist upfront.** Workflows read specialists one at a time at phase boundaries (progressive disclosure).
- **Automatic grilling.** Grilling requires explicit user intent or consent, never silent agent escalation.
- **Revert the 2 drifted skills to upstream.** The local forks are the effective runtime skills; provenance + drift automation protects them.
- **Superset behavior.** Auto-pi does not need to do everything Matt does — it needs to preserve Matt's invariants + produce equivalent durable artifacts under applicable preconditions.

---

## Open empirical questions (test before committing to implementation)

1. **Coach menu with Triage (8th option).** Does it make the menu noisy? If yes, group `setup-audit` + `triage` under a secondary category. UX testing, not architecture.
2. **Model reliability returning from the prototype interrupt.** Does the agent actually reread planning-workflow and resume the same design phase with the conclusion? This is the same model-followed-prose residual risk as compaction.
3. **Compaction / state behavior.** The state block is best-effort in normal context. The planning domain underlay + prototype interrupt add more state to track. Instrument actual workflow traces; add a tiny persistence/reinjection mechanism only if real failures occur (per the v0.3 agreed contract).
4. **Domain-modeling underlay trigger reliability.** Does the agent reliably detect the domain/ADR triggers and load domain-modeling when appropriate? This is a soft agent judgment call — the one trigger-based soft decision that must happen invisibly.

---

## The agreement

This audit records the agreement reached between the builder (Claude, this session) and the external reviewer (GPT-5.6, session `019f9fe0`) through a three-round intercom debate on 2026-07-26. Both parties converged on:

1. **Coach** remains the sole normal router; `ask-matt` is a versioned semantic routing reference used by harmony audits.
2. **`build-workflow` supersedes `implement`** at runtime only if the invariant mapping is completed (fresh-context-per-ticket + explicit typecheck cadence — currently missing).
3. **Effective local forks remain installed**; provenance/drift automation protects upstream updates; local review heuristics become evidence-seeking candidates, not automatic severity.
4. **Triage** is direct-pinned and Coach-discoverable as an 8th workflow; no wrapper until composition/state evidence requires one; never triage `to-tickets` output.
5. **Planning staged routing:** bounded vs foggy; bounded defaults to brainstorming; grilling only by explicit request or accepted recommendation; domain-modeling underlay only on concrete terminology/ADR triggers; prototype is a workflow-owned, consented interrupt, then resume design; wayfinder for foggy, later collapse decisions through spec/tickets.
6. **Harmony** is assessed by applicable trigger, invariant, artifact/evidence, and exit equivalence — not skill-count coverage or identical implementation.
7. **Fresh context** is both planning/triage exit guidance and build entry enforcement; one build invocation owns one ticket-sized unit.

**Both high-friction transitions require explicit user consent, not silent agent escalation:**
- collaborative brainstorm → relentless grill (user asks, or agent explains + asks permission once);
- discussion → runnable prototype (agent explains the design question + asks permission once).

**The proposed changes are decisions pending a separately approved build.** This audit does not implement them and does not edit workflows.

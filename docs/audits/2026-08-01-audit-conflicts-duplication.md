# Audit: Conflicts, Duplication, and Overlap Among 20 auto-pi Repo Skills

**Date:** 2025-01-09
**Scope:** All 20 skills in `skills/*/SKILL.md` (repo-authored, not community)
**Method:** Read every SKILL.md + cross-referenced community specialists at `~/.agents/skills/`

---

## Executive Summary

The 20 repo skills divide into two layers: **6 workflow orchestrators** (planning, build, debug, research, review, ship) that route to **14 specialists** (brainstorming, grilling, code-review, diagnosing-bugs, etc.). The architecture is sound — workflows own routing, specialists own procedures. But there are **2 conflicts**, **2 duplications**, **3 overlaps**, and **7 responsibility gaps**, the most serious being a direct contradiction between `receiving-code-review` and `review-workflow` on whether to implement fixes during review.

---

## Conflict Matrix

| Skill A | Skill B | Relationship | Verdict |
| --------- | --------- | ------------- | --------- |
| `review-workflow` | `receiving-code-review` | Orchestrator → specialist | **CONFLICT** — "Do NOT apply" vs "IMPLEMENT" |
| `build-workflow` | `diagnosing-bugs` | Orchestrator → specialist | **CONFLICT** — workflow skips Phase 5; specialist defines it as required |
| `debug-workflow` | `diagnosing-bugs` | Orchestrator → specialist | **CONFLICT** — same as above |
| `build-workflow` | `debug-workflow` | Peer workflows | **DUPLICATION** — diagnose phase is near-identical |
| `build-workflow` | `verification-before-completion` | Should-be orchestrator → specialist | **DUPLICATION/OVERLAP** — build-workflow inlines verification instead of reading the specialist |
| `ship-workflow` | `verification-before-completion` | Orchestrator → specialist | **OK** — proper delegation |
| `code-review` | `review-workflow` | Specialist → orchestrator | **OVERLAP** — Security axis exists only in orchestrator, not specialist |
| `review-workflow` | `receiving-code-review` | Orchestrator → specialist | **OVERLAP** — disposition categories defined only in orchestrator |
| `planning-workflow` | `brainstorming` | Orchestrator → specialist | **OK** — aligned |
| `planning-workflow` | `grilling` | Orchestrator → specialist | **OK** — aligned |
| `build-workflow` | `tdd` (community) | Orchestrator → specialist | **OK** — build-workflow adds implement-invariant on top |
| `ship-workflow` | `diff-driven-docs` | Orchestrator → specialist | **OK** — aligned |
| `ship-workflow` | `commit` (community) | Orchestrator → specialist | **OK** — proper delegation |
| `ship-workflow` | `github` (community) | Orchestrator → specialist | **OK** — proper delegation |
| `bearings` | `decision-hold-lifecycle` | Consumer → producer | **OK** — clean separation |
| `session-handoff` | `memory-compounding` | Peer | **OK** — different concerns |
| `codebase-hygiene` | `code-review` | Peer | **OK** — whole-codebase vs diff scope |
| `setup-maintenance` | `setup-matt-pocock-skills` | Peer | **OK** — agent setup vs repo setup |
| `grilling` | `brainstorming` | Peer alternatives | **OK** — different styles, planning-workflow chooses |

---

## 1. DUPLICATION

### D-1: build-workflow and debug-workflow diagnose phases are near-identical

**Severity:** MEDIUM

**Evidence:**

`build-workflow/SKILL.md:53-54`:

```
1. Read `/Users/rom.iluz/.agents/skills/diagnosing-bugs/SKILL.md` completely.
2. Follow the diagnosing-bugs procedure: build a feedback loop, find the root cause. **Diagnosis only — do NOT fix the source here.** Follow the specialist's Phases 1–4 ... Do NOT execute the specialist's Phase 5 (Fix + regression test) — the fix + regression test happen in the tdd phase, not here.
```

`debug-workflow/SKILL.md:40-42`:

```
1. Read `/Users/rom.iluz/.agents/skills/diagnosing-bugs/SKILL.md` completely.
2. Follow the diagnosing-bugs procedure: build a feedback loop, find the root cause.
3. **Diagnosis only — do NOT fix the source here.** Follow the specialist's Phases 1–4 ... Do NOT execute the specialist's Phase 5 (Fix + regression test) — the fix + regression test happen in `/build` (TDD), not here.
```

The only difference: build-workflow returns to tdd with the diagnosis; debug-workflow goes to complete (tells user to run `/build`). The read-instruct-skip-Phase-5 logic is duplicated verbatim. If `diagnosing-bugs` phase numbering changes, both must be updated in sync.

**Fix direction:** Extract a shared "diagnose-only" snippet or have one workflow reference the other's diagnose procedure.

---

### D-2: build-workflow inlines verification discipline instead of reading verification-before-completion

**Severity:** MEDIUM

**Evidence:**

`build-workflow/SKILL.md:59-62` (complete phase):

```
The build is complete when:
- All acceptance criteria have evidence (each slice's test passes).
- You have literal verification evidence (the exact command, exit code, first + last 5 lines of output).
- A GREEN claim without this evidence block is a lie and will be rejected.
```

`verification-before-completion/SKILL.md` defines this exact discipline: "NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE" and the evidence block format. But `build-workflow` never reads `verification-before-completion` as a specialist. Meanwhile, `ship-workflow/SKILL.md:33` does: "Read `/Users/rom.iluz/.agents/skills/verification-before-completion/SKILL.md` completely."

The verification evidence format ("exact command, exit code, first + last 5 lines") appears in `build-workflow:61` and in `verification-before-completion` (the "evidence block" section). Two sources of truth for the same format.

**Fix direction:** Have `build-workflow` read `verification-before-completion` in its complete phase, or extract the evidence-block format to a shared reference.

---

## 2. CONFLICT

### C-1: receiving-code-review says "IMPLEMENT"; review-workflow says "Do NOT apply" — HIGH

**Severity:** HIGH

**Evidence:**

`receiving-code-review/SKILL.md:24` (The Response Pattern, step 6):

```
6. IMPLEMENT: One item at a time, test each
```

`receiving-code-review/SKILL.md:66`:

```
- **Trusted** - implement after understanding
```

`receiving-code-review/SKILL.md:110-113` (Implementation Order):

```
2. Then implement in this order:
   - Blocking issues (breaks, security)
   - Simple fixes (typos, imports)
   - Complex fixes (refactoring, logic)
3. Test each fix individually
```

`review-workflow/SKILL.md:44`:

```
- `verified-fix` — the finding is correct; verified and queued for `/build`. Do NOT apply changes during review — the fix happens in `/build` (TDD).
```

`review-workflow/SKILL.md:49`:

```
5. Do NOT use ambiguous "apply" — be explicit about the disposition. Do NOT apply changes during review — review is review-only; fixes happen in `/build`.
```

**The conflict:** When `review-workflow` loads `receiving-code-review` in the disposition phase, the agent receives two contradictory instructions:

- The specialist says: implement the fixes, test each one.
- The orchestrator says: do NOT apply any changes, queue for `/build`.

The workflow's "Rules" section says "The workflow owns the routing... Do not follow their routing prose" — but `receiving-code-review`'s IMPLEMENT step isn't routing prose, it's the core procedure. The agent must override the specialist's primary action loop.

**Impact:** An agent that follows the specialist's procedure (as instructed by "Follow the receiving-code-review procedure") will implement fixes during review, violating the workflow's review-only policy. The override is easy to miss.

**Fix direction:** Either (a) add a note to `receiving-code-review` that when loaded by `review-workflow`, the IMPLEMENT step becomes "queue for `/build`" instead of "apply now," or (b) have `review-workflow` explicitly state "skip step 6 of receiving-code-review's response pattern — replace with disposition recording."

---

### C-2: diagnosing-bugs Phase 5 (Fix) conflicts with both workflow orchestrators

**Severity:** MEDIUM

**Evidence:**

`diagnosing-bugs/SKILL.md:120`:

```
## Phase 5 — Fix + regression test
```

`diagnosing-bugs/SKILL.md:122-134`: Full fix procedure — write regression test, watch it fail, apply fix, watch it pass, re-run feedback loop.

`build-workflow/SKILL.md:54`:

```
Do NOT execute the specialist's Phase 5 (Fix + regression test) — the fix + regression test happen in the tdd phase, not here.
```

`debug-workflow/SKILL.md:42`:

```
Do NOT execute the specialist's Phase 5 (Fix + regression test) — the fix + regression test happen in `/build` (TDD), not here.
```

**The conflict:** `diagnosing-bugs` defines 6 phases, with Phase 5 being the fix. Both workflows explicitly suppress Phase 5. The specialist doesn't acknowledge this conditional behavior — it presents Phase 5 as a normal part of the procedure. An agent reading `diagnosing-bugs` standalone (without a workflow) would correctly execute Phase 5; an agent reading it via a workflow must override the specialist's own phase structure.

**Mitigating factor:** The workflows are explicit about the skip. The conflict is manageable but creates a cognitive burden: the agent must hold "follow this specialist's procedure, except skip its Phase 5" in context.

**Fix direction:** Add a note to `diagnosing-bugs` Phase 5: "When loaded by build-workflow or debug-workflow, skip this phase — the fix happens in tdd/`/build`."

---

## 3. OVERLAP

### O-1: Security review responsibility split between code-review and review-workflow

**Severity:** MEDIUM

**Evidence:**

`code-review/SKILL.md` defines exactly 2 axes: Standards and Spec (lines 5-7, 83-85). No security axis, no security methodology. (grep for "security" in code-review returns zero matches.)

`review-workflow/SKILL.md:32`:

```
3. **auto-pi policy:** add a third reviewer — **Security** (injection, auth, secrets, unsafe operations). Give each reviewer fresh context — only the diff, not the builder's reasoning (anti-anchored).
```

`review-workflow/SKILL.md:68`:

```
- **Security is always a third reviewer** (auto-pi policy).
```

**The overlap:** The Security axis is defined only as a one-liner in `review-workflow` ("injection, auth, secrets, unsafe operations"). There is no Security specialist skill with a methodology, smell catalog, or review brief — unlike Standards (which has the full Fowler smell baseline in `code-review`). The security reviewer gets no detailed brief comparable to the Standards/Spec sub-agent prompts in `code-review:71-79`.

If `code-review` is used standalone (without `review-workflow`), no security review happens at all. The security procedure is an orchestrator policy with no specialist backing it.

**Fix direction:** Either (a) add a Security axis to `code-review` with a brief and methodology, or (b) create a dedicated security-review specialist skill that `review-workflow` reads.

---

### O-2: Disposition categories defined only in review-workflow, not in receiving-code-review

**Severity:** MEDIUM

**Evidence:**

`review-workflow/SKILL.md:43-48` defines 4 disposition categories:

```
- `verified-fix` — the finding is correct; verified and queued for `/build`.
- `verified-defer` — the finding is correct but should be a separate ticket.
- `rejected` — the finding is wrong, push back with a reason.
- `needs-user-decision` — the finding is ambiguous, ask the user.
```

`receiving-code-review/SKILL.md` defines no such categories. Its response pattern (line 21-25) is: "READ → UNDERSTAND → VERIFY → EVALUATE → RESPOND → IMPLEMENT." Its push-back criteria (line 135-141) are about when to push back, not how to categorize dispositions.

When `review-workflow` loads `receiving-code-review`, the agent must cross-reference back to the workflow to find the disposition categories, because the specialist doesn't define them. The specialist's "IMPLEMENT" step (C-1) doesn't map to any of the 4 categories.

**Fix direction:** Add disposition categories to `receiving-code-review` or have `review-workflow` explicitly inject them into the specialist's procedure.

---

### O-3: Severity assignment has no defined procedure

**Severity:** LOW-MEDIUM

**Evidence:**

`review-workflow/SKILL.md:62`:

```
Report by severity: CRITICAL (blocks), HIGH (should fix), LOW (nice to have).
```

`code-review/SKILL.md:85`:

```
Present the two reports under `## Standards` and `## Spec` headings, verbatim or lightly cleaned.
```

`code-review` outputs findings organized by axis (Standards/Spec), not by severity. It distinguishes "hard violations" from "judgement calls" but doesn't assign CRITICAL/HIGH/LOW. `review-workflow` expects a flat list with severity (`findings: [<severity + file:line + description>]`, line 24). No skill defines how to map code-review's axis-organized findings to review-workflow's severity-tagged list.

**Fix direction:** Define severity mapping criteria in `review-workflow` or `code-review`.

---

## 4. SHALLOW WRAPPERS

### SW-1: debug-workflow — borderline, but earns its slot

**Assessment:** NOT a shallow wrapper.

`debug-workflow` classifies (bug vs merge-conflict), then routes to one of two specialists. The classification step and the two-way routing add real value. However, the diagnose phase (D-1) is near-identical to `build-workflow`'s — that's a duplication problem, not a shallow-wrapper problem. The skill's state protocol, classification logic, and distinct complete-phase messaging justify its existence.

---

### SW-2: grilling — very thin, but distinct purpose

**Assessment:** Borderline. Earns its slot narrowly.

`grilling/SKILL.md` is ~15 lines of content: "Interview me relentlessly... Ask the questions one at a time... Do not act on it until I confirm."

It's used by `planning-workflow` as an alternative to `brainstorming` (line 60-61). The conversational style is genuinely different (relentless interrogation vs collaborative dialogue). But the procedure is so thin it could be a section within `planning-workflow` or `brainstorming`. It earns its slot only because `planning-workflow` reads it as a standalone specialist and the style-switch is a routing decision.

**Risk:** If `grilling` grew any procedure depth, it would overlap with `brainstorming`'s "ask clarifying questions one at a time" pattern. Currently the distinction is style-only.

---

## 5. RESPONSIBILITY GAPS

### G-1: diagnosing-bugs Phase 6 (Cleanup + post-mortem) is never executed via workflows — MEDIUM

**Evidence:**

`diagnosing-bugs/SKILL.md:136`:

```
## Phase 6 — Cleanup + post-mortem
```

Phase 6 requires: remove `[DEBUG-...]` instrumentation, delete throwaway prototypes, verify original repro no longer reproduces, state the correct hypothesis in commit/PR message, recommend architectural improvements.

`build-workflow/SKILL.md:54`: "Follow the specialist's Phases 1–4 ... Do NOT execute the specialist's Phase 5."
`debug-workflow/SKILL.md:42`: "Follow the specialist's Phases 1–4 ... Do NOT execute the specialist's Phase 5."

Neither workflow mentions Phase 6. An agent following "Phases 1–4" literally would never execute Phase 6. Debug instrumentation (`[DEBUG-...]` logs, throwaway harnesses) could remain in the codebase. The post-mortem and architectural-improvement recommendation are also lost.

**Fix direction:** Add Phase 6 handling to both workflows — either execute it after diagnosis, or explicitly defer it to the build/complete phase with a specific instruction.

---

### G-2: Git commit procedure not owned by any repo skill — LOW

**Evidence:**

`ship-workflow/SKILL.md:55`: "Read `/Users/rom.iluz/.agents/skills/commit/SKILL.md` completely."

The `commit` skill is a community skill (from mitsuhiko/agent-stuff). The repo's ship workflow depends on it but doesn't own it. If the community skill changes its format or procedure, the repo's commit behavior changes without a repo-level review.

**Note:** This is an intentional architectural choice (workflows orchestrate community specialists). It's a dependency risk, not a bug. Documented here for completeness.

---

### G-3: PR description writing not owned by any repo skill — LOW

**Evidence:**

`ship-workflow/SKILL.md:62`: "Read `/Users/rom.iluz/.agents/skills/github/SKILL.md` completely. Follow the procedure: push to a branch (not main), create a PR with a clear description linking to the spec/issue."

The `github` skill is a community skill. The PR description format ("clear description linking to the spec/issue") is defined in `ship-workflow` as a brief instruction, but the actual `gh pr create` procedure is in the community skill. No repo skill defines what a good PR description looks like for this project.

**Fix direction:** If PR description quality matters, add a PR-description template or procedure to `ship-workflow` or a repo specialist.

---

### G-4: TDD procedure not owned by any repo skill — LOW

**Evidence:**

`build-workflow/SKILL.md:40`: "Read `/Users/rom.iluz/.agents/skills/tdd/SKILL.md` completely."

The `tdd` skill is a community skill (from Matt Pocock). `build-workflow` adds the "implement invariant" (typechecking regularly, full suite at end — line 43) which is NOT in `tdd`. This is good — the workflow adds value. But the core red-green-refactor procedure is external.

**Note:** Same as G-2 — intentional architectural choice. The repo does add real value on top via the implement invariant.

---

### G-5: Security review has no detailed methodology — MEDIUM

**Evidence:**

`review-workflow/SKILL.md:32`: "add a third reviewer — **Security** (injection, auth, secrets, unsafe operations)."

Compare to `code-review`'s Standards axis, which has a 12-item Fowler smell catalog (lines 38-68) and a detailed sub-agent brief (line 73). The Security reviewer gets a 4-word parenthetical: "injection, auth, secrets, unsafe operations." No smell catalog, no brief, no methodology.

**Fix direction:** Define a security review brief in `review-workflow` or create a `security-review` specialist.

---

### G-6: Memory saving after work completion not enforced by any workflow — LOW

**Evidence:**

AGENTS.md step 9: "Remember. Save decisions, gotchas, failures to memory."

But none of the 6 workflow orchestrators (planning, build, debug, research, review, ship) mention memory saves in their complete phases. `session-handoff` saves to memory, but only during cross-session handoff. `memory-compounding` is for pruning, not saving.

The "remember" step is a global AGENTS.md instruction with no skill-level enforcement. An agent could complete `/build` and `/ship` without saving any learnings to memory.

**Fix direction:** Add a "save learnings to memory" step to each workflow's complete phase, or create a post-completion memory skill.

---

### G-7: No handoff-workflow orchestrator — LOW

**Evidence:**

AGENTS.md step 10: "Handoff. Session getting long → `/handoff` to create continuation doc."

`build-workflow/SKILL.md:35`: references `/handoff` as a command.
`session-handoff/SKILL.md` is `user-invocable: true` — it's a standalone skill, not a workflow orchestrator.

There's no `handoff-workflow` that orchestrates the handoff with state protocol, phase transitions, etc. `session-handoff` does the work directly. This is fine — not everything needs a workflow — but it's inconsistent with the pattern where every user-facing command (`/plan`, `/build`, `/debug`, `/research`, `/review`, `/ship`) has a workflow orchestrator.

**Note:** Minor. `session-handoff` is self-contained and doesn't need multi-phase orchestration.

---

## 6. Workflow ↔ Specialist Alignment Checks

### planning-workflow → brainstorming: ALIGNED ✓

- `planning-workflow:84`: "When the user explicitly approves the design → set `design: approved`."
- `brainstorming:13`: HARD-GATE requires design approval before any implementation.
- `brainstorming:106`: "Return the approved-design handoff + stop."
- `brainstorming` says "does NOT publish the spec, commit anything, create tickets"; `planning-workflow` handles spec/tickets after. Clean handoff.

### build-workflow → tdd: ALIGNED ✓ (with value-add)

- `build-workflow:43` adds the "implement invariant" (typecheck regularly, full suite at end) which is NOT in `tdd`. This is genuine orchestrator value, not duplication.

### review-workflow → code-review: FORMAT MISMATCH

- `code-review:85`: outputs two headed sections (`## Standards`, `## Spec`), verbatim or lightly cleaned.
- `review-workflow:24`: expects `findings: [<severity + file:line + description>]` — a flat list with severity.
- The agent must transform code-review's two-axis prose reports into review-workflow's flat severity-tagged list. This transformation is unspecified. (See O-3.)

### review-workflow → receiving-code-review: CONFLICT + CATEGORY MISMATCH

- **Conflict:** receiving-code-review says IMPLEMENT (C-1); review-workflow says do NOT apply.
- **Category mismatch:** review-workflow defines 4 disposition categories (O-2); receiving-code-review has no such categories.
- The specialist's procedure doesn't match the orchestrator's state protocol.

### ship-workflow → verification-before-completion: ALIGNED ✓

- `ship-workflow:33-36`: reads the specialist, follows the procedure, adds the "independent auditor" framing.
- `verification-before-completion` defines the evidence-block discipline; `ship-workflow` consumes it.

### ship-workflow → diff-driven-docs: ALIGNED ✓

- `ship-workflow:42-43`: "classify the diff's doc impact (business/technical/audit). Write only the updates genuinely needed."
- `diff-driven-docs` defines this exact procedure. Clean delegation.

### build-workflow → diagnosing-bugs (diagnose phase): CONFLICT + GAP

- **Conflict:** Phase 5 suppression (C-2).
- **Gap:** Phase 6 (cleanup) silently dropped (G-1). The workflow says "Phases 1–4" — it doesn't address Phase 6 at all. An agent could interpret this as "skip Phase 6 too" or "do Phase 6 after diagnosis." Ambiguous.

### debug-workflow → diagnosing-bugs (diagnose phase): same as above

---

## Summary of Findings by Severity

| Severity | Count | Items |
| ---------- | ------- | ------- |
| HIGH | 1 | C-1 (receiving-code-review IMPLEMENT vs review-workflow Do-NOT-apply) |
| MEDIUM | 6 | D-1, D-2, C-2, O-1, O-2, G-1, G-5 |
| LOW | 5 | O-3, G-2, G-3, G-4, G-6, G-7 |

## Recommended Priority

1. **Fix C-1** — Add explicit override note to `receiving-code-review` or `review-workflow` about the IMPLEMENT step. This is the only finding that could cause incorrect agent behavior (implementing during review when the policy is review-only).
2. **Fix G-1** — Add Phase 6 (cleanup) handling to both `build-workflow` and `debug-workflow`. Debug instrumentation left in code is a real risk.
3. **Fix O-1/G-5** — Define the Security review methodology. Currently it's a 4-word parenthetical with no procedure.
4. **Fix D-1** — Extract shared diagnose-phase logic between `build-workflow` and `debug-workflow`.
5. **Fix D-2** — Have `build-workflow` read `verification-before-completion` instead of inlining.

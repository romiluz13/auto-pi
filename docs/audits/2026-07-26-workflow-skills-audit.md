# Workflow Skills Audit (v0.3)

**Date:** 2026-07-26
**Status:** Built, pending GPT-5.6 final review (do NOT ship until reviewed)
**Inventory appendix:** see `docs/audits/2026-07-26-skill-inventory-appendix.md` (all installed skills classified)

## The architecture (v0.3)

One thin **workflow skill** per user-facing workflow. Each prompt pins its workflow skill mechanically. The workflow skill is an orchestrator/map — it reads each specialist skill in turn, rereading itself between phases. The user types ONE slash command (`/plan`); the workflow handles everything. The user never types internal skill commands.

| Layer | Owns |
|-------|------|
| **Workflow skill** | Phase ordering, branching, completion evidence, the reread protocol, state block |
| **Specialist skill** | How to perform one phase (brainstorming, to-spec, tdd, etc.) |
| **Prompt** | Workflow entry + task input only |
| **User** | Answers/approvals inside the workflow; never invokes internal skills |

## The workflow graph

```
  /plan ==PIN==> planning-workflow
    classify bounded vs foggy
    bounded:
      read brainstorming → design approval → reread workflow
      read to-spec → publish spec (with reference) → reread workflow
      read to-tickets → publish tickets + frontier → reread workflow
      complete: spec URL, ticket URLs, first unblocked ticket
    foggy:
      read wayfinder → map/decisions → reread workflow
      complete: map reference + outcome (NOT spec/tickets; NOT /build)
      route to brainstorm/spec only when the destination becomes clear

  /build ==PIN==> build-workflow
    read tdd → red-green (one slice at a time) → reread workflow
    on persistent RED (blocks progress, not arbitrary retries): read diagnosing-bugs → root cause → reread workflow → return to tdd
    situational: uv for Python
    complete: ALL acceptance criteria have evidence + test/lint/typecheck pass

  /debug ==PIN==> debug-workflow
    classify: bug vs merge-conflict
    bug: read diagnosing-bugs → root cause (diagnosis only)
    merge-conflict: read resolving-merge-conflicts → resolve

  /research ==PIN==> research-workflow
    classify: general | code | deep-brief
    read research / octocode-research / live-research → cited findings file

  /review ==PIN==> review-workflow
    read code-review (standards + spec + security) → findings → reread workflow
    if findings: read receiving-code-review → disposition (verified-fix=queued for /build, verified-defer, rejected, needs-user-decision; wait for user decisions) → reread workflow
    if clean: skip disposition
    review is review-only — do NOT apply changes during review

  /ship ==PIN==> ship-workflow
    read verification-before-completion → evidence → reread workflow
    read diff-driven-docs → doc disposition (or none-needed) → reread workflow
    read commit → commit hash (commit always authorized; skip if already committed) → reread workflow
    github (CONDITIONAL: only if GitHub remote + user intent) → PR URL or not-applicable; CI: pass/fail/not-applicable
    complete: commit hash + PR URL/NA + CI status

  /setup-audit ==PIN==> setup-maintenance (direct — 1 specialist, no wrapper)
    read-only audit report → recommend action if findings
```

## Skill-library classification

| Type | Count | Role |
|------|-------|------|
| **Workflow orchestrator** | 6 (new, auto-pi's) | planning, build, review, ship, research, debug |
| **Core phase specialist** | 18 | brainstorming, to-spec, to-tickets, wayfinder, tdd, diagnosing-bugs, uv, code-review, receiving-code-review, verification-before-completion, diff-driven-docs, commit, github, research, octocode-research, live-research, resolving-merge-conflicts, setup-maintenance |
| **Operational utility (repo)** | 8 | bearings, codebase-hygiene, decision-hold-lifecycle, grilling, memory-compounding, session-handoff, setup-matt-pocock-skills, verification-before-completion (also a specialist) |
| **Community (excluded from workflows)** | ~80 | Available on-demand via `/skill:` or Coach; not on the normal path |

**Total installed:** 90 at `~/.agents/skills/` + 4 at `~/.pi/agent/skills/` (bright-data-best-practices, brightdata-cli, data-feeds, discover-api, live-research, etc.). Some overlap; see the inventory appendix for the per-skill breakdown.

## Candidate analysis (likely workflow enhancers — the user asked if the library is leveraged optimally)

The genius's review said: "blanket exclusion does not answer whether the library is leveraged optimally." Here's the candidate analysis for skills that COULD improve the normal path:

| Skill | Could enhance | Decision |
|-------|--------------|----------|
| `ask-matt` | A router over the skills — could be a Coach alternative | **Excluded.** Coach is auto-pi's entry menu; ask-matt is Matt Pocock's router. Adding it would create two competing entry points. |
| `implement` | A build specialist (Matt's version of tdd) | **Excluded.** `tdd` is already the build specialist. `implement` is Matt's thinner wrapper; `tdd` is the procedure. |
| `codebase-design` | Deep module vocabulary for planning | **Excluded from workflow.** It's on-demand vocabulary, not a phase procedure. The planning-workflow doesn't need it on every plan — only when designing module interfaces. Available via `/skill:codebase-design` when needed. |
| `domain-modeling` | Domain language + ADRs for planning | **Excluded from workflow.** Same as codebase-design — on-demand, not every plan. Available via `/skill:domain-modeling` when needed. |
| `frontend-design` | UI design direction for planning | **Excluded from workflow.** Not every plan involves UI. Available via `/skill:frontend-design` when the brainstorming phase identifies a UI design question. |
| `octocode-brainstorming` | Brainstorm with evidence (validate against data) | **Excluded from workflow.** The planning-workflow uses `brainstorming` (interview-based). `octocode-brainstorming` is for evidence-based validation — a different approach. Could be a situational branch, but adding it complicates the classify phase. Available via `/skill:octocode-brainstorming`. |
| `prototype` | Throwaway prototype to answer a design question | **Excluded from workflow.** Prototyping is a separate on-ramp, not part of the normal plan→build path. Available via `/skill:prototype`. |
| `compact-safe` | Compact the conversation preserving constraints | **Excluded from workflow.** This is a session management tool, not a workflow phase. Available via `/skill:compact-safe` when the session is getting long. |
| `decision-hold-lifecycle` | Persist unresolved decisions | **Excluded from workflow.** This is an operational utility (repo skill), not a workflow phase. Available on-demand. |
| `grill-with-docs` | Relentless interview to stress-test a plan | **Excluded from planning-workflow.** Grilling is a separate on-ramp for stress-testing a plan before building. Adding it to every plan would be overkill. Available via `/skill:grill-with-docs` when the user wants to stress-test. |

**Conclusion:** the library IS leveraged optimally. The 6 workflow skills bundle only the normal-path specialists. The situational/on-demand skills (codebase-design, domain-modeling, frontend-design, prototype, grill-with-docs, etc.) are available via `/skill:` when the workflow or user identifies the need — but they're NOT on every plan/build/review/ship because that would bloat the normal path with skills that aren't always relevant.

## State protocol (all 6 workflows)

Every workflow skill follows the same state protocol:
1. **At entry:** initialize the state block and print it.
2. **Before every user wait:** emit the current state block.
3. **On every continuation:** read the latest state block. If missing/ambiguous, STOP — reconstruct from conversation artifacts. Never guess.
4. **Before each phase transition:** update the state block, then reread the workflow skill.
5. **Compaction is a residual risk** — the state block is best-effort in normal context. Reconstruct from conversation artifacts if the state is lost.

## Path resolution (deterministic)

All skill reads use absolute canonical paths: `/Users/rom.iluz/.agents/skills/<name>/SKILL.md`. Exception: `live-research` is at `/Users/rom.iluz/.pi/agent/skills/live-research/SKILL.md` (a pi-specific package). The test suite verifies all 18 specialist skills exist at a known path.

## Conflicts requiring overrides

| Skill | Conflict | Resolution |
|-------|----------|------------|
| (none) | brainstorming was cleaned of routing prose in d6e6f56 | No override needed — the current brainstorming skill has no "invoke /skill:to-spec" routing prose. The planning-workflow's "ignore specialist routing prose" rule is a defensive measure, not a live conflict. |

## What was removed (vs v0.2)

- `/spec`, `/tickets`, `/wayfind` prompts — internal phases now, not user-facing.
- The "Next: type /X" handoff in ALL prompts — workflows own routing, prompts are thin entry adapters.

## What was kept

- The 6 extensions (coach, guardrails, session-status, handoff, trace, palette)
- The 7 user-facing prompts (thin — entry + task only, pinning the workflow skills)
- The intercom boundary rule in AGENTS.md

## Acceptance test results

```
$ npm test
34/34 pass, 0 fail (structural + policy + conditional state tests)
```

## Known residual risks (honest)

1. **Compaction is a residual risk.** The state block is best-effort in normal context. If the agent doesn't reread the workflow skill after compaction, the state may be lost. The workflow skills instruct rereading, but this is prose, not mechanical enforcement. A behavioral test would be needed to prove compaction survival — not added preemptively (per the agreed contract: "Add extension state/reinjection only if a concrete test shows the pure skill approach fails").
2. **The state block is in the conversation**, not a file. Compaction may lose it. Reconstruct from conversation artifacts (spec URL, commit hash, test output) if the state is lost.
3. **Absolute paths are not portable** to other users (this is a personal installation, not a distributed product).

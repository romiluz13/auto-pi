# Workflow Skills Audit (v0.3)

**Date:** 2026-07-26
**Status:** Built, pending GPT-5.6 review (do NOT ship until reviewed)
**Exhaustive inventory:** see `docs/audits/2026-07-26-skill-inventory-appendix.md` (all 88 installed skills classified)

## The architecture (v0.3)

One thin **workflow skill** per user-facing workflow. Each prompt pins its workflow skill mechanically. The workflow skill is an orchestrator/map — it reads each specialist skill in turn, rereading itself between phases. The user types ONE slash command (`/plan`); the workflow handles everything. The user never types internal skill commands.

| Layer | Owns |
| ------- | ------ |
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
      complete: map reference + outcome (NOT spec/tickets)
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
    if findings: read receiving-code-review → disposition (verified-fix/verified-defer/rejected/needs-user-decision) → reread workflow
    if clean: skip disposition

  /ship ==PIN==> ship-workflow
    read verification-before-completion → evidence → reread workflow
    read diff-driven-docs → doc disposition (or none-needed) → reread workflow
    read commit → commit hash → reread workflow
    github (CONDITIONAL: only if GitHub remote + user intent) → PR URL or not-applicable
    complete: commit hash + PR URL/NA

  /setup-audit ==PIN==> setup-maintenance (direct — 1 specialist, no wrapper)
    read-only audit report → recommend action if findings
```

## Skill-library classification (summary)

| Type | Count | Role |
| ------ | ------- | ------ |
| **Workflow orchestrator** | 6 (new, auto-pi's) | planning, build, review, ship, research, debug |
| **Core phase specialist** | 17 | brainstorming, to-spec, to-tickets, wayfinder, tdd, diagnosing-bugs, code-review, receiving-code-review, verification-before-completion, diff-driven-docs, commit, github, research, octocode-research, live-research, resolving-merge-conflicts, uv, setup-maintenance |
| **Operational utility (repo)** | 7 | bearings, codebase-hygiene, decision-hold-lifecycle, grilling, memory-compounding, session-handoff, setup-matt-pocock-skills |
| **Community (excluded from workflows)** | ~58 | Available on-demand via `/skill:` or Coach; not on the normal path |

**Exhaustive per-skill classification:** see `docs/audits/2026-07-26-skill-inventory-appendix.md`.

### Why community skills are excluded

The ~58 community skills (MongoDB, Cloudflare, Vercel, Bright Data, Octocode tools, etc.) are situational — they're not on any workflow's normal path. They're available on-demand via `/skill:` or Coach's skill hints. No workflow bundles them — bundling all 88 would be wrong (the genius's finding: "Do not bundle all 88—that would be wrong").

## State protocol (all 6 workflows)

Every workflow skill follows the same state protocol:

1. **At entry:** initialize the state block and print it.
2. **Before every user wait:** emit the current state block.
3. **On every continuation:** read the latest state block. If missing/ambiguous, STOP — reconstruct from conversation artifacts. Never guess.
4. **Before each phase transition:** update the state block, then reread the workflow skill.
5. **Compaction is a residual risk** — the state block is best-effort in normal context. Reconstruct from conversation artifacts if the state is lost.

## Path resolution (deterministic)

All skill reads use absolute canonical paths: `/Users/rom.iluz/.agents/skills/<name>/SKILL.md`. No `~` expansion (the `read` tool doesn't expand `~`). All 16 specialist skills + the 6 workflow skills are at this path (repo skills are synced to `~/.agents/skills/` by `scripts/sync-live.sh`; the installer makes repo skills authoritative for collisions).

## Conflicts requiring overrides

| Skill | Conflict | Resolution |
|-------|----------|------------|
| `brainstorming` | Says "invoke /skill:to-spec" (stale routing prose) | planning-workflow explicitly overrides: "Ignore brainstorming's routing prose — this workflow owns the routing." |

## What was removed (vs v0.2)

- `/spec`, `/tickets`, `/wayfind` prompts — internal phases now, not user-facing. The planning-workflow handles them internally.
- The "Next: type /spec" handoff in the prompts — the workflow skills own the routing now.
- The "Next: type /X" in ALL prompts — workflows own routing, prompts are thin entry adapters.

## What was kept

- The 6 extensions (coach, guardrails, session-status, handoff, trace, palette)
- The 7 user-facing prompts (now thin — entry + task only, pinning the workflow skills)
- The intercom boundary rule in AGENTS.md

## Acceptance test results

```
$ npm test
21/21 pass, 0 fail (structural + policy tests)
```

## Known residual risks (honest)

1. **Compaction is a residual risk.** The state block is best-effort in normal context. If the agent doesn't reread the workflow skill after compaction, the state may be lost. The workflow skills instruct rereading, but this is prose, not mechanical enforcement. A behavioral test would be needed to prove compaction survival — not added preemptively (per the agreed contract: "Add extension state/reinjection only if a concrete test shows the pure skill approach fails").
2. **The state block is in the conversation**, not a file. Compaction may lose it. Reconstruct from conversation artifacts (spec URL, commit hash, test output) if the state is lost.
3. **No self-location mechanism.** The workflow skills use absolute paths (`/Users/rom.iluz/.agents/skills/...`). This is not portable to other users, but this is a personal installation, not a distributed product.

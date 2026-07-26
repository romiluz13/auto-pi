# Skill-library audit + workflow graph (v0.3 — workflow skills)

**Date:** 2026-07-24
**Status:** Built, pending GPT-5.6 review (do NOT ship until reviewed)

## The architecture (v0.3)

One thin **workflow skill** per user-facing workflow. Each prompt pins its workflow skill mechanically. The workflow skill is an orchestrator/map — it reads each specialist skill in turn, rereading itself between phases. The user types ONE slash command (`/plan`); the workflow handles everything. The user never types internal skill commands.

| Layer | Owns |
|-------|------|
| **Workflow skill** | Phase ordering, branching, completion evidence, the reread protocol |
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
      route based on outcome (do not blindly force spec/tickets)

  /build ==PIN==> build-workflow
    read tdd → red-green → reread workflow
    on persistent RED: read diagnosing-bugs → root cause → reread workflow → return to tdd
    situational: uv for Python
    complete: literal verification evidence

  /debug ==PIN==> diagnosing-bugs (direct — 1 specialist, no wrapper)
    diagnosis only → Next: type /build <fix>

  /research ==PIN==> research (direct — 1 specialist, no wrapper)
    cited findings → Next: type /plan, /build, or stop

  /review ==PIN==> review-workflow
    read code-review (standards + spec + security) → findings → reread workflow
    read receiving-code-review → disposition (verify/push back) → reread workflow
    complete: findings + dispositions → Next: type /build or /ship

  /ship ==PIN==> ship-workflow
    read verification-before-completion → evidence → reread workflow
    read diff-driven-docs → doc disposition → reread workflow
    read commit → commit hash → reread workflow
    read github → PR URL → reread workflow
    complete: commit hash + PR URL (never push main, never commit secrets)

  /setup-audit ==PIN==> setup-maintenance (direct — 1 specialist, no wrapper)
    read-only audit report → recommend action if findings
```

## Skill-library classification

### Workflow orchestrators (4 — new, auto-pi's)
| Skill | Workflow | Phases |
|------|----------|--------|
| `planning-workflow` | /plan | brainstorming → to-spec → to-tickets (bounded); wayfinder (foggy) |
| `build-workflow` | /build | tdd (with diagnosing-bugs on RED) |
| `review-workflow` | /review | code-review → receiving-code-review |
| `ship-workflow` | /ship | verification → diff-driven-docs → commit → github |

### Core phase specialists (the skills the workflows read)
| Skill | Phase | Used by workflow(s) |
|-------|-------|---------------------|
| `brainstorming` | design | planning-workflow |
| `to-spec` | spec | planning-workflow |
| `to-tickets` | tickets | planning-workflow |
| `wayfinder` | wayfind (foggy) | planning-workflow |
| `tdd` | build | build-workflow (primary) |
| `diagnosing-bugs` | diagnose | build-workflow (on RED); /debug (direct) |
| `code-review` | review | review-workflow |
| `receiving-code-review` | disposition | review-workflow |
| `verification-before-completion` | verify | ship-workflow |
| `diff-driven-docs` | docs | ship-workflow |
| `commit` | commit | ship-workflow |
| `github` | github | ship-workflow |
| `research` | research | /research (direct) |
| `setup-maintenance` | audit | /setup-audit (direct) |

### Situational branch specialists (routed by predicate, not always)
| Skill | Trigger | Used by |
|-------|---------|---------|
| `uv` | Python project | build-workflow |
| `resolving-merge-conflicts` | git merge/rebase conflict | /debug (prose) |
| `octocode-research` | code-focused research | /research (prose) |
| `live-research` | deep multi-source brief | /research (prose) |

### Operational utility (not workflow-routed)
| Skill | Role |
|-------|------|
| `bearings` | /bearings (status report) |
| `session-handoff` | cross-session transfer |
| `decision-hold-lifecycle` | unresolved decisions |
| `memory-compounding` | memory hygiene |
| `codebase-hygiene` | semantic duplicates (advisory) |
| `setup-matt-pocock-skills` | one-time repo scaffolding |
| `grilling` | plan interview (used by grill-with-docs) |
| `domain-modeling` | domain language (on-demand) |
| `codebase-design` | deep module vocabulary (on-demand) |

### Excluded from workflows (not needed on the normal path)
The 78 community skills (MongoDB, Vercel, Bright Data, Octocode, Cloudflare, etc.) are not in any workflow. They're available on-demand via `/skill:` or Coach's skill hints. No workflow bundles them — they're situational, not on the normal path.

### Conflicts requiring edits/overrides
| Skill | Conflict | Resolution |
|-------|----------|------------|
| `brainstorming` | Says "invoke /skill:to-spec" (routing prose) | planning-workflow overrides: "Ignore brainstorming's routing prose — this workflow owns the routing." The brainstorming skill was already cleaned (the routing authority removed in commit d6e6f56), but if any stale routing prose remains, the workflow skill explicitly overrides it. |

## What was removed (vs v0.2)

- `/spec`, `/tickets`, `/wayfind` prompts — internal phases now, not user-facing. The planning-workflow handles them internally.
- The "Next: type /spec" handoff in the prompts — the workflow skills own the routing now, not the prompts.

## What was kept

- The 6 extensions (coach, guardrails, session-status, handoff, trace, palette)
- The 7 user-facing prompts (now thin — entry + task only, pinning the workflow skills)
- The 14 repo skills (brainstorming was cleaned of routing authority in d6e6f56)
- The intercom boundary rule in AGENTS.md

## Acceptance test results

```
$ npm test
21/21 pass, 0 fail
```

The tests verify:
1. Every prompt has exactly one skill: pin (the workflow skill or justified direct specialist)
2. The 4 workflow prompts pin their workflow skills
3. The 3 direct-pin prompts pin their specialists (debug, research, setup-audit — no wrapper needed)
4. The 4 workflow skills exist in the repo
5. No prompt instructs the user to type internal /skill: commands
6. No prompt says "invoke /skill:" (the workflow owns routing)
7. No prompt says "Want me to invoke it?"
8. The planning-workflow reads specialists one at a time (no upfront pile-up)
9. The planning-workflow does not advance before design approval
10. The planning-workflow requires a spec reference
11. The planning-workflow requires ticket references + frontier
12. The planning-workflow branches to wayfinder for foggy
13. The ship-workflow requires verification evidence + never commits secrets/pushes main
14. The build-workflow returns from diagnosis to tdd on RED

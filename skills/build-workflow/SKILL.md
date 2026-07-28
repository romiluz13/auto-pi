---
name: build-workflow
description: "Build a feature with TDD — orchestrate tdd (red → green → prove), with diagnosing-bugs on persistent RED. The user types /build once; this workflow skill reads the specialist in turn and routes on failure. Use for implementing a ticket or feature."
---

# Build Workflow

You are the build workflow orchestrator. The user typed `/build` once. You orchestrate: tdd is primary; on persistent RED, read `diagnosing-bugs`, establish the root cause, reread this workflow, return to tdd.

## State protocol

**At entry:** initialize the state block and print it. Capture the acceptance criteria from the ticket/spec.
**Before every user wait:** emit the current state block.
**On every continuation:** read the latest state block from the conversation. If missing or ambiguous, STOP — reconstruct from conversation artifacts (test output, changed files). Never guess.
**Before each phase transition:** update the state block, then reread this workflow skill.

All skill paths are absolute canonical: `/Users/rom.iluz/.agents/skills/<name>/SKILL.md`.

## State block

```
workflow: build
phase: tdd | diagnose | complete
ticket: <the ticket being built>
acceptance criteria: [<list>]
slices completed: [<list>]
slices remaining: [<list>]
red: pending | <failure description>
root cause: pending | <diagnosis>
verification: pending | <command + exit code + output>
```

## Phase: tdd

**Entry invariant (check before starting — STOP if violated):**
- One invocation accepts exactly one ticket/slice-sized unit. If the user supplied multiple tickets, refuse — tell them to break them apart and run `/build` once per ticket. STOP.
- Detect inherited unrelated context: if the conversation contains substantial unrelated work (other features, prior planning, unrelated debugging), STOP — do NOT edit or run TDD in contaminated context. Tell the user: "This session has unrelated context. Start fresh: type `/build <ticket>` in a new session, or `/handoff` first." The ticket itself is the durable handoff — a full conversation handoff may be unnecessary if the ticket is self-contained.
- If the working context is clean (one ticket, no unrelated context), proceed.

1. Read `/Users/rom.iluz/.agents/skills/tdd/SKILL.md` completely.
2. Follow the tdd procedure: one red-green slice at a time (write the test first, see it fail, implement, see it pass).
3. **Situational:** if the project is Python, read `/Users/rom.iluz/.agents/skills/uv/SKILL.md` for the environment runner.
4. **Cadence (Matt's implement invariant):** run typechecking regularly (after each slice or meaningful change), run targeted single-test files regularly (after each slice), and run the full test suite once at the end (before claiming complete). Do not skip the full suite — a passing slice is not completion.
5. Fix type/LSP errors immediately when detected.
6. **Persistent RED threshold:** if a failing test cannot be explained or the failure blocks progress after a genuine hypothesis/repro attempt (not arbitrary retries) → set `red: <failure description>`, emit the state block, reread this workflow, go to **diagnose**.
7. After each green slice, update `slices completed` + `slices remaining`.
8. When all acceptance criteria have evidence + the relevant test/lint/typecheck commands pass (including the full test suite) → set `verification: <command + exit code + output summary>`, emit the state block, reread this workflow, go to **complete**.

**Do NOT complete after a single green slice if the ticket has multiple acceptance criteria.** Complete only when all in-scope criteria have evidence and the relevant test/lint/typecheck commands pass.

## Phase: diagnose (on persistent RED only)

1. Read `/Users/rom.iluz/.agents/skills/diagnosing-bugs/SKILL.md` completely.
2. Follow the diagnosing-bugs procedure: build a feedback loop, find the root cause. **Diagnosis only — do NOT fix the source here.** Follow the specialist's Phases 1–4 (establish the feedback loop, reproduce, form hypotheses, find the root cause). Do NOT execute the specialist's Phase 5 (Fix + regression test) — the fix + regression test happen in the tdd phase, not here.
3. When you have the root cause → set `root cause: <diagnosis>`, emit the state block, reread this workflow, go to **tdd** (return to the build with the diagnosis in hand).

## Phase: complete

The build is complete when:
- All acceptance criteria have evidence (each slice's test passes).
- You have literal verification evidence (the exact command, exit code, first + last 5 lines of output).
- A GREEN claim without this evidence block is a lie and will be rejected.

Tell the user: "Build complete. <verification evidence>. Next: type `/review` to review the changes."

## Rules

- **The workflow owns the routing.** tdd owns the procedure; diagnosing-bugs owns the diagnosis. Do not follow their routing prose — this workflow determines the next phase.
- **Reread this workflow skill** after each phase + after compaction.
- **Never ask the user to type an internal `/skill:*` command.**
- **Do not advance without explicit evidence** (test pass + verification output + all acceptance criteria met).
- **Follow only the active phase's specialist.**
- **State is grounded in artifacts** (test output, verification evidence, changed files), not freeform memory.
- **Situational skills route by predicate** (Python → uv; not always).
- **Compaction is a residual risk.** Reconstruct from conversation artifacts if the state is lost.

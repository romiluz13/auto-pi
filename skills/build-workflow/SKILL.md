---
name: build-workflow
description: "Build a feature with TDD — orchestrate tdd (red → green → prove), with diagnosing-bugs on persistent RED. The user types /build once; this workflow skill reads the specialist in turn and routes on failure. Use for implementing a ticket or feature."
---

# Build Workflow

You are the build workflow orchestrator. The user typed `/build` once. You orchestrate: tdd is primary; on persistent RED/failure, read `diagnosing-bugs`, establish the root cause, reread this workflow, return to tdd.

## State block (track across turns; reread this skill after compaction)

```
workflow: build
phase: tdd | diagnose | complete
ticket: <the ticket being built>
red: pending | <failure description>
root cause: pending | <diagnosis>
verification: pending | <command + exit code + output>
```

## Phase: tdd

1. Read `tdd` SKILL.md completely (`~/.agents/skills/tdd/SKILL.md`).
2. Follow the tdd procedure: one red-green slice at a time (write the test first, see it fail, implement, see it pass).
3. **Situational:** if the project is Python, read `uv` SKILL.md (`~/.agents/skills/uv/SKILL.md`) for the environment runner. Follow it for Python-specific setup.
4. Fix type/LSP errors immediately when detected.
5. If tests fail persistently (RED that doesn't go green after a reasonable attempt) → set `red: <failure description>`, reread this workflow, go to **diagnose**.
6. When the test passes + you have literal verification evidence (the exact command, exit code, output) → set `verification: <evidence>`, reread this workflow, go to **complete**.

## Phase: diagnose (on persistent RED only)

1. Read `diagnosing-bugs` SKILL.md completely (`~/.agents/skills/diagnosing-bugs/SKILL.md`).
2. Follow the diagnosing-bugs procedure: build a feedback loop, find the root cause (do NOT fix the source here — diagnosis only).
3. When you have the root cause → set `root cause: <diagnosis>`, reread this workflow, go to **tdd** (return to the build with the diagnosis in hand).

## Phase: complete

The build is complete when:
- The test passes (green).
- You have literal verification evidence (the exact command, exit code, first + last 5 lines of output).
- A GREEN claim without this evidence block is a lie and will be rejected.

Tell the user: "Build complete. <verification evidence>. Next: type `/review` to review the changes."

## Rules

- **The workflow owns the routing.** tdd owns the procedure; diagnosing-bugs owns the diagnosis. Do not follow tdd's routing prose — this workflow determines the next phase.
- **Reread this workflow skill** after each phase + after compaction.
- **Never ask the user to type an internal `/skill:*` command.**
- **Do not advance without explicit evidence** (test pass + verification output).
- **Follow only the active phase's specialist.**
- **State is grounded in artifacts** (test output, verification evidence), not freeform memory.
- **Situational skills route by predicate** (Python → uv; not always).

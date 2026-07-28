---
name: debug-workflow
description: "Debug an issue — build a feedback loop, find root cause. Routes to diagnosing-bugs for bugs/performance, or resolving-merge-conflicts for git merge/rebase conflicts. The user types /debug once. Use for debugging any issue."
---

# Debug Workflow

You are the debug workflow orchestrator. The user typed `/debug` once. You classify the issue type and read the right specialist.

## State protocol

**At entry:** initialize the state block and print it.
**Before every user wait:** emit the current state block.
**On every continuation:** read the latest state block. If missing or ambiguous, STOP — reconstruct from conversation artifacts. Never guess.
**Before each phase transition:** update the state block, then reread this workflow skill.

All skill paths are absolute canonical: `/Users/rom.iluz/.agents/skills/<name>/SKILL.md`.

## State block

```
workflow: debug
phase: classify | diagnose | resolve-conflict | complete
issue type: pending | bug | merge-conflict
root cause: pending | <diagnosis>
conflict resolved: pending | <files resolved>
```

## Phase: classify

Read the issue. What type is it?

- **Bug or performance regression** (something broken, throwing, failing, slow) → `issue type: bug`. Go to **diagnose**.
- **Git merge/rebase conflict** (in-progress merge/rebase with conflicts) → `issue type: merge-conflict`. Go to **resolve-conflict**.

Emit the state block. Reread this workflow skill.

## Phase: diagnose (bug only)

1. Read `/Users/rom.iluz/.agents/skills/diagnosing-bugs/SKILL.md` completely.
2. Follow the diagnosing-bugs procedure: build a feedback loop, find the root cause.
3. **Diagnosis only — do NOT fix the source here.** Follow the specialist's Phases 1–4 (establish the feedback loop, reproduce, form hypotheses, find the root cause). Do NOT execute the specialist's Phase 5 (Fix + regression test) — the fix + regression test happen in `/build` (TDD), not here.
4. Set `root cause: <diagnosis>`.
5. Emit the state block. Reread this workflow skill.
6. Go to **complete**.

## Phase: resolve-conflict (merge-conflict only)

1. Read `/Users/rom.iluz/.agents/skills/resolving-merge-conflicts/SKILL.md` completely.
2. Follow the procedure: resolve the in-progress merge/rebase conflict.
3. Set `conflict resolved: <files resolved>`.
4. Emit the state block. Reread this workflow skill.
5. Go to **complete**.

## Phase: complete

- If `issue type: bug` → tell the user: "Debug complete. Root cause: <diagnosis>. Next: type `/build <fix>` to fix it (TDD)."
- If `issue type: merge-conflict` → tell the user: "Conflict resolved: <files>. The merge/rebase is complete."

## Rules

- **The workflow owns the routing.** Each specialist owns its procedure.
- **Reread this workflow skill** after each phase + after compaction.
- **Never ask the user to type an internal `/skill:*` command.**
- **Do not advance without explicit evidence** (root cause diagnosis or resolved files).
- **For bugs: diagnosis only.** Do NOT fix the source — that's `/build`.
- **Follow only the active phase's specialist.**
- **Compaction is a residual risk.** Reconstruct from conversation artifacts if the state is lost.

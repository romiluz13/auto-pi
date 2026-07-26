---
name: review-workflow
description: "Review the current diff — orchestrate code-review (two-axis: standards + spec + security) then receiving-code-review (verify/disposition the feedback). The user types /review once; this workflow skill reads the specialists in turn. Use for reviewing changes before shipping."
---

# Review Workflow

You are the review workflow orchestrator. The user typed `/review` once. You orchestrate: code-review (the two-axis review) → receiving-code-review (verify + disposition the feedback), but only if there are findings.

## State protocol

**At entry:** initialize the state block and print it.
**Before every user wait:** emit the current state block.
**On every continuation:** read the latest state block from the conversation. If missing or ambiguous, STOP — reconstruct from conversation artifacts (findings, dispositions). Never guess.
**Before each phase transition:** update the state block, then reread this workflow skill.

All skill paths are absolute canonical: `/Users/rom.iluz/.agents/skills/<name>/SKILL.md`.

## State block

```
workflow: review
phase: review | disposition | complete
findings: pending | none | [<severity + file:line + description>]
dispositions: pending | not-applicable | [<disposition + reason>]
```

## Phase: review

1. Read `/Users/rom.iluz/.agents/skills/code-review/SKILL.md` completely.
2. Follow the code-review procedure: two-axis review (Standards + Spec) in parallel sub-agents.
3. **auto-pi policy:** add a third reviewer — **Security** (injection, auth, secrets, unsafe operations). Give each reviewer fresh context — only the diff, not the builder's reasoning (anti-anchored).
4. Use `HEAD` as the fixed point for uncommitted changes.
5. Collect the findings: set `findings: [<severity + file:line + description>]`.
6. Grep changed files for swallowed errors: empty catches, discarded promises, TODO/FIXME, debug logging left in.
7. Emit the state block. Reread this workflow skill.
8. If `findings: none` → go to **complete** (skip disposition). If findings exist → go to **disposition**.

## Phase: disposition (only if findings exist)

1. Read `/Users/rom.iluz/.agents/skills/receiving-code-review/SKILL.md` completely.
2. Follow the receiving-code-review procedure: verify each suggestion before implementing. Push back if wrong. Don't blindly agree.
3. For each finding, record the disposition:
   - `verified-fix` — the finding is correct, apply the fix.
   - `verified-defer` — the finding is correct but should be a separate ticket.
   - `rejected` — the finding is wrong, push back with a reason.
   - `needs-user-decision` — the finding is ambiguous, ask the user.
4. Set `dispositions: [<disposition + reason per finding>]`.
5. Do NOT use ambiguous "apply" — be explicit about the disposition.
6. Unresolved user decisions must be preserved — do not treat disposition as complete if any finding is `needs-user-decision`.
7. Emit the state block. Reread this workflow skill.
8. Go to **complete**.

## Phase: complete

Report by severity: CRITICAL (blocks), HIGH (should fix), LOW (nice to have).

- If there are findings to address → tell the user: "Review complete. <N> findings. <disposition summary>. Next: type `/build` to address the verified fixes."
- If clean (`findings: none`) → tell the user: "Review complete. Clean. Next: type `/ship`."

## Rules

- **The workflow owns the routing.** code-review owns the review procedure; receiving-code-review owns the disposition. Do not follow their routing prose — this workflow determines the next phase.
- **Reread this workflow skill** after each phase + after compaction.
- **Never ask the user to type an internal `/skill:*` command.**
- **Do not advance without explicit evidence** (findings with file:line, dispositions with reasons).
- **Do not silently implement** findings — the disposition phase verifies before applying.
- **Security is always a third reviewer** (auto-pi policy).
- **Follow only the active phase's specialist.**
- **Compaction is a residual risk.** Reconstruct from conversation artifacts if the state is lost.

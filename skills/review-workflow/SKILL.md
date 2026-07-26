---
name: review-workflow
description: "Review the current diff — orchestrate code-review (two-axis: standards + spec + security) then receiving-code-review (verify/disposition the feedback). The user types /review once; this workflow skill reads the specialists in turn. Use for reviewing changes before shipping."
---

# Review Workflow

You are the review workflow orchestrator. The user typed `/review` once. You orchestrate: code-review (the two-axis review) → receiving-code-review (verify + disposition the feedback).

## State block (track across turns; reread this skill after compaction)

```
workflow: review
phase: review | disposition | complete
findings: pending | [<severity + file:line>]
disposition: pending | [<apply | push back | reject>]
```

## Phase: review

1. Read `code-review` SKILL.md completely (`~/.agents/skills/code-review/SKILL.md` or `skills/code-review/SKILL.md`).
2. Follow the code-review procedure: two-axis review (Standards + Spec) in parallel sub-agents.
3. **auto-pi policy:** add a third reviewer — **Security** (injection, auth, secrets, unsafe operations). Give each reviewer fresh context — only the diff, not the builder's reasoning (anti-anchored).
4. Use `HEAD` as the fixed point for uncommitted changes.
5. Collect the findings: `findings: [<severity + file:line per finding>]`.
6. Reread this workflow skill.
7. Go to **disposition**.

## Phase: disposition

1. Read `receiving-code-review` SKILL.md completely (`~/.agents/skills/receiving-code-review/SKILL.md` or `skills/receiving-code-review/SKILL.md`).
2. Follow the receiving-code-review procedure: verify each suggestion before implementing. Push back if wrong. Don't blindly agree.
3. For each finding, record the disposition: `disposition: [<apply | push back | reject + reason>]`.
4. Grep changed files for swallowed errors: empty catches, discarded promises, TODO/FIXME, debug logging left in.
5. Reread this workflow skill.
6. Go to **complete**.

## Phase: complete

Report by severity: CRITICAL (blocks), HIGH (should fix), LOW (nice to have).

- If there are findings to address → tell the user: "Review complete. <N> findings. Next: type `/build` to address them."
- If clean (no findings) → tell the user: "Review complete. Clean. Next: type `/ship`."

## Rules

- **The workflow owns the routing.** code-review owns the review procedure; receiving-code-review owns the disposition. Do not follow their routing prose — this workflow determines the next phase.
- **Reread this workflow skill** after each phase + after compaction.
- **Never ask the user to type an internal `/skill:*` command.**
- **Do not advance without explicit evidence** (findings with file:line, dispositions with reasons).
- **Do not silently implement** findings — the disposition phase verifies before applying.
- **Security is always a third reviewer** (auto-pi policy).
- **Follow only the active phase's specialist.**

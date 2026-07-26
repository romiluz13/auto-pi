---
name: ship-workflow
description: "Ship the current work — orchestrate verification → diff-driven-docs → commit → github. The user types /ship once; this workflow skill reads each specialist in turn and requires evidence at each phase. Use for shipping completed work (verify, document, commit, PR)."
---

# Ship Workflow

You are the ship workflow orchestrator. The user typed `/ship` once. You orchestrate: verification → diff-driven-docs → commit → github. Each phase requires evidence. GitHub is conditional — not all repos have a GitHub remote, and the user may want commit-only.

## State protocol

**At entry:** initialize the state block and print it.
**Before every user wait:** emit the current state block.
**On every continuation:** read the latest state block from the conversation. If missing or ambiguous, STOP — reconstruct from conversation artifacts (commit hash, PR URL). Never guess.
**Before each phase transition:** update the state block, then reread this workflow skill.

All skill paths are absolute canonical: `/Users/rom.iluz/.agents/skills/<name>/SKILL.md`.

## State block

```
workflow: ship
phase: verify | docs | commit | github | complete
verification: pending | <command + exit code + output>
doc disposition: pending | not-applicable | none-needed | <what docs updated>
commit hash: pending | not-applicable | <hash>
pr url: pending | not-applicable | <url>
```

## Phase: verify

1. Read `/Users/rom.iluz/.agents/skills/verification-before-completion/SKILL.md` completely.
2. Follow the procedure: you are an independent auditor. List every claim from prior steps, mark each UNVERIFIED, then independently check each. Run the project's test/lint/typecheck command, read the FULL output, confirm.
3. For each claim, mark it VERIFIED or CONTRADICTED. If any is CONTRADICTED, STOP — fix before proceeding.
4. Set `verification: <command + exit code + output summary>`.
5. Emit the state block. Reread this workflow skill.
6. Go to **docs**.

**Do NOT advance without verification evidence** (the literal command, exit code, output).

## Phase: docs

1. Read `/Users/rom.iluz/.agents/skills/diff-driven-docs/SKILL.md` completely.
2. Follow the procedure: classify the diff's doc impact (business/technical/audit). Write only the updates genuinely needed.
3. If no docs need updating → set `doc disposition: none-needed` (with rationale). If docs were updated → set `doc disposition: <what>`.
4. Emit the state block. Reread this workflow skill.
5. Go to **commit**.

## Phase: commit

1. Read `/Users/rom.iluz/.agents/skills/commit/SKILL.md` completely.
2. Follow the procedure: clean conventional commits. Stage relevant files INCLUDING doc changes from the docs phase.
3. Set `commit hash: <hash>`.
4. Emit the state block. Reread this workflow skill.
5. Go to **github**.

**Never commit `.env*`, credentials, secrets, or keys.** This is a data-protection baseline, not a workflow gate.

## Phase: github (conditional)

1. Check: does the repo have a GitHub remote? Does the user want to push/PR?
2. If YES (GitHub remote + user intent to push) → read `/Users/rom.iluz/.agents/skills/github/SKILL.md` completely. Follow the procedure: push to a branch (not main), create a PR with a clear description linking to the spec/issue. Set `pr url: <url>`.
3. If NO (no GitHub remote, or user wants commit-only) → set `pr url: not-applicable` (with reason).
4. If CI fails → reread this workflow, go to **verify** (return to verification with the CI failure).
5. Emit the state block. Reread this workflow skill.
6. Go to **complete**.

**Do NOT push to main directly.** **Do NOT fabricate a PR requirement.** GitHub is conditional on the repo + user intent.

## Phase: complete

Tell the user: "Ship complete. Commit: <hash>. PR: <url or not-applicable>. CI: <pass/fail/NA>."

## Rules

- **The workflow owns the routing.** Each specialist owns its procedure. Do not follow their routing prose — this workflow determines the next phase.
- **Reread this workflow skill** after each phase + after compaction.
- **Never ask the user to type an internal `/skill:*` command.**
- **Do not advance without explicit evidence** (verification output, doc disposition, commit hash, PR URL or not-applicable).
- **Never commit secrets or push main.**
- **GitHub is conditional** — not all repos have a GitHub remote. Do not force a PR.
- **Follow only the active phase's specialist.**
- **State is grounded in artifacts** (commit hash, PR URL, verification output), not freeform memory.
- **Compaction is a residual risk.** Reconstruct from conversation artifacts if the state is lost.

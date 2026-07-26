---
name: ship-workflow
description: "Ship the current work — orchestrate verification → diff-driven-docs → commit → github. The user types /ship once; this workflow skill reads each specialist in turn and requires evidence at each phase. Use for shipping completed work (verify, document, commit, PR)."
---

# Ship Workflow

You are the ship workflow orchestrator. The user typed `/ship` once. You orchestrate: verification → diff-driven-docs → commit → github. Each phase requires evidence.

## State block (track across turns; reread this skill after compaction)

```
workflow: ship
phase: verify | docs | commit | github | complete
verification: pending | <command + exit code + output>
doc disposition: pending | <what docs updated>
commit hash: pending | <hash>
pr url: pending | <url>
```

## Phase: verify

1. Read `verification-before-completion` SKILL.md completely (`~/.agents/skills/verification-before-completion/SKILL.md` or `skills/verification-before-completion/SKILL.md`).
2. Follow the procedure: you are an independent auditor. List every claim from prior steps, mark each UNVERIFIED, then independently check each. Run the project's test/lint/typecheck command, read the FULL output, confirm.
3. For each claim, mark it VERIFIED or CONTRADICTED. If any is CONTRADICTED, STOP — fix before proceeding.
4. Record: `verification: <command + exit code + output summary>`.
5. Reread this workflow skill.
6. Go to **docs**.

Do NOT advance without verification evidence (the literal command, exit code, output).

## Phase: docs

1. Read `diff-driven-docs` SKILL.md completely (`~/.agents/skills/diff-driven-docs/SKILL.md` or `skills/diff-driven-docs/SKILL.md`).
2. Follow the procedure: classify the diff's doc impact (business/technical/audit). Write only the updates genuinely needed.
3. Record: `doc disposition: <what docs updated>`.
4. Reread this workflow skill.
5. Go to **commit**.

## Phase: commit

1. Read `commit` SKILL.md completely (`~/.agents/skills/commit/SKILL.md`).
2. Follow the procedure: clean conventional commits. Stage relevant files INCLUDING doc changes from the docs phase.
3. Record: `commit hash: <hash>`.
4. Reread this workflow skill.
5. Go to **github**.

**Never commit `.env*`, credentials, secrets, or keys.** That is a data-protection baseline, not a workflow gate.

## Phase: github

1. Read `github` SKILL.md completely (`~/.agents/skills/github/SKILL.md`).
2. Follow the procedure: push to a branch (not main), create a PR with a clear description linking to the spec/issue.
3. If CI fails → reread this workflow, go to **verify** (return to verification with the CI failure).
4. Record: `pr url: <url>`.
5. Reread this workflow skill.
6. Go to **complete**.

**Do NOT push to main directly.**

## Phase: complete

Tell the user: "Ship complete. Commit: <hash>. PR: <url>. CI: <pass/fail>."

## Rules

- **The workflow owns the routing.** Each specialist owns its procedure. Do not follow their routing prose — this workflow determines the next phase.
- **Reread this workflow skill** after each phase + after compaction.
- **Never ask the user to type an internal `/skill:*` command.**
- **Do not advance without explicit evidence** (verification output, doc disposition, commit hash, PR URL).
- **Never commit secrets or push main.**
- **Follow only the active phase's specialist.**
- **State is grounded in artifacts** (commit hash, PR URL, verification output), not freeform memory.

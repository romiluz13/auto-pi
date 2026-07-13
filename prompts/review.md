---
description: Review current diff — two-axis (standards + spec) + security, anti-anchored
skill: code-review
---
Review the current uncommitted changes. The `code-review` skill is now loaded — it runs two-axis review (Standards + Spec) in parallel sub-agents. Follow its procedure, with these additions:

1. Get the diff: `git diff` (unstaged) and `git diff --cached` (staged). The code-review skill reviews changes since a fixed point — use `HEAD` as the fixed point for uncommitted changes.
2. The code-review skill dispatches two parallel reviewers (Standards + Spec). Add a third:
   - **Security reviewer**: injection, auth, secrets, unsafe operations.
3. Give each reviewer fresh context — only the diff, not the builder's reasoning (anti-anchored review).
4. After reviews return, run `/skill:receiving-code-review`: verify each suggestion before implementing. Push back if wrong. Don't blindly agree.
5. Grep changed files for swallowed errors: empty catches, discarded promises, TODO/FIXME, debug logging left in.
6. If architecture issues are found → run `/skill:improve-codebase-architecture` → fix → return to review.

Report findings by severity: CRITICAL (blocks), HIGH (should fix), LOW (nice to have).

For brutally honest code critique → `/skill:octocode-roast`.

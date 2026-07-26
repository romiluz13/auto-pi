---
description: Debug an issue — build feedback loop, find root cause (diagnose only)
argument-hint: "<what's wrong>"
skill: diagnosing-bugs
---
Debug the following issue. Follow the `diagnosing-bugs` skill (feedback loop, root cause). This is diagnosis only — do NOT fix the source here.

Issue: $@

Scope: the fix + regression test happen in `/build` (TDD), not here. If this is a git merge/rebase conflict → `/skill:resolving-merge-conflicts`.

Next: type `/build <fix>`. You decide.

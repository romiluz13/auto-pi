---
description: Debug an issue — build feedback loop, find root cause (diagnose only)
argument-hint: "<what's wrong>"
skill: diagnosing-bugs
---
Debug the following issue. Follow workflow step 5 (failure path — diagnosis only).

Issue: $@

1. **Build a feedback loop FIRST.** Before guessing, create the shortest path to reproduce the issue:
   - Failing test that reproduces it.
   - Minimal script that triggers it.
   - Manual steps that reliably cause it.
2. **Reproduce + minimize.** Confirm the loop fails. Then minimize the reproduction — remove everything that doesn't affect the bug.
3. **Hypothesize.** Based on the minimized repro, form a hypothesis about the root cause. Generate 3-5 ranked hypotheses before testing any.
4. **Instrument.** Add logging, breakpoints, or assertions to confirm the hypothesis. Don't guess — measure.
5. **Diagnose.** State the root cause with evidence: the repro command, the failing output, and the causal chain from root cause to symptom. Do NOT declare fixed until you can explain the full chain.
6. **Cleanup.** Remove debugging instrumentation (logging, breakpoints, assertions you added in step 4). Leave no debug code behind. The fix + regression test happen in `/build` (TDD), not here.

Do NOT skip the feedback loop. "I think the problem is..." is not a diagnosis — reproduce it first.

Do NOT fix the source here — /debug is diagnosis-only. Run `/build` or `/fix` to apply the fix with TDD (test first, see fail, implement, see pass). The TDD gate blocks source writes during /debug.

If this is a git merge/rebase conflict → `/skill:resolving-merge-conflicts`.

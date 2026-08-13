---
description: Debug an issue — feedback loop, root cause (diagnosis only)
argument-hint: "<what's wrong>"
skill: orchestration-layer
---
# Auto-Pi Workflow Goal

[AUTO_PI_WORKFLOW]
entry=debug
terminal=shipped
[/AUTO_PI_WORKFLOW]
[AUTO_PI_SUBJECT]
$@
[/AUTO_PI_SUBJECT]

Diagnose, fix, review, and ship the following issue autonomously. `orchestration-layer` reads `ask-matt` to select diagnosing-bugs or resolving-merge-conflicts; the workflow interpreter preserves the diagnosis evidence and continues through TDD, verification, review, and ship. Stop only for a genuinely user-owned hard-to-reverse decision.

Issue: $@

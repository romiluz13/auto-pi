---
description: Build a feature — implement, test, fix (TDD, with diagnosis on RED)
argument-hint: "<what to build>"
skill: orchestration-layer
---
# Auto-Pi Workflow Goal

[AUTO_PI_WORKFLOW]
entry=build
terminal=shipped
[/AUTO_PI_WORKFLOW]
[AUTO_PI_SUBJECT]
$@
[/AUTO_PI_SUBJECT]

Build and ship the following autonomously. `orchestration-layer` reads `ask-matt`; the workflow interpreter enforces TDD, evidence-backed transitions, verification, fresh review, remediation, and commit-only-in-ship. Stop only for a genuinely user-owned hard-to-reverse decision.

Task: $@

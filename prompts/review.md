---
description: Review current diff — two-axis (standards + spec) + security, then disposition
skill: orchestration-layer
---
# Auto-Pi Workflow Goal

[AUTO_PI_WORKFLOW]
entry=review
terminal=shipped
[/AUTO_PI_WORKFLOW]
[AUTO_PI_SUBJECT]
${@:-current uncommitted changes}
[/AUTO_PI_SUBJECT]

Review, remediate, verify, and ship the current work autonomously. `orchestration-layer` reads `ask-matt`; the workflow interpreter requires fresh read-only Standards, Spec, and Security reviewers, evidence-backed dispositions, new review epochs after fixes, and commit-only-in-ship. Stop only for a genuinely user-owned hard-to-reverse decision.

---
description: Research a topic — investigate against primary sources, capture findings
argument-hint: "<topic to research>"
skill: orchestration-layer
---
# Auto-Pi Workflow Goal

[AUTO_PI_WORKFLOW]
entry=research
terminal=researched
[/AUTO_PI_WORKFLOW]
[AUTO_PI_SUBJECT]
$@
[/AUTO_PI_SUBJECT]

Research the following topic autonomously. `orchestration-layer` reads `ask-matt`; the workflow interpreter requires a durable cited research artifact before completion. Stop only for a genuinely user-owned hard-to-reverse decision.

Topic: $@

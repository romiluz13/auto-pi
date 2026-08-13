---
description: Ship — verify, document, commit, PR (orchestrated)
skill: orchestration-layer
---
# Auto-Pi Workflow Goal

[AUTO_PI_WORKFLOW]
entry=ship
terminal=shipped
[/AUTO_PI_WORKFLOW]
[AUTO_PI_SUBJECT]
${@:-current work}
[/AUTO_PI_SUBJECT]

Ship the current work autonomously. `orchestration-layer` reads `ask-matt`; the workflow interpreter enforces independent verification, diff-driven documentation, one authorized commit, and conditional branch publication with durable evidence.

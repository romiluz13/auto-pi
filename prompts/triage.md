---
description: Triage incoming issues/PRs — categorise, verify, grill if needed, write agent-ready briefs
argument-hint: "<issue or PR to triage>"
skill: orchestration-layer
---
# Auto-Pi Workflow Goal

[AUTO_PI_WORKFLOW]
entry=triage
terminal=triaged
[/AUTO_PI_WORKFLOW]
[AUTO_PI_SUBJECT]
$@
[/AUTO_PI_SUBJECT]

Triage the following issue or PR autonomously. `orchestration-layer` reads `ask-matt`; the workflow interpreter requires a durable triage outcome and agent-ready brief when applicable. Stop only for a genuinely user-owned hard-to-reverse decision.

Issue: $@

Scope: triage is for **incoming raw issues/PRs you didn't create** — bug reports, incoming feature requests. Do NOT triage tickets produced by `/plan` (to-tickets output is already agent-ready).

---
description: Triage incoming issues/PRs — categorise, verify, grill if needed, write agent-ready briefs
argument-hint: "<issue or PR to triage>"
skill: orchestration-layer
---
Triage the following issue or PR. The `orchestration-layer` skill will read `ask-matt` (the routing brain) and route to the triage flow (move issues through triage roles — categorise, verify, grill if needed, write agent-ready briefs). State blocks + evidence gates + human-controlled stops are handled by the layer.

Issue: $@

Scope: triage is for **incoming raw issues/PRs you didn't create** — bug reports, incoming feature requests. Do NOT triage tickets produced by `/plan` (to-tickets output is already agent-ready).

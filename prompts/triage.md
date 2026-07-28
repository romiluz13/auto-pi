---
description: Triage incoming issues/PRs — categorise, verify, grill if needed, write agent-ready briefs
argument-hint: "<issue or PR to triage>"
skill: triage
---
Triage the following issue or PR. Follow the `triage` skill (move issues through triage roles — categorise, verify, grill if needed, write agent-ready briefs).

Issue: $@

Scope: triage is for **incoming raw issues/PRs you didn't create** — bug reports, incoming feature requests. Do NOT triage tickets produced by `/plan` (to-tickets output is already agent-ready). After triage, the agent-ready briefs can be picked up by `/build`.

Next: type `/build <triaged ticket>` to implement a triaged issue.

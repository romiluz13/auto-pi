---
description: Triage incoming issues/PRs — categorise, verify, grill if needed, write agent-ready briefs
argument-hint: "<issue or PR to triage>"
skill: triage
---
Triage the following issue or PR. Follow the `triage` skill (move issues through triage roles — categorise, verify, grill if needed, write agent-ready briefs).

Issue: $@

Scope: triage is for **incoming raw issues/PRs you didn't create** — bug reports, incoming feature requests. Do NOT triage tickets produced by `/plan` (to-tickets output is already agent-ready).

The triage outcome determines the next step:
- `ready-for-agent` → Next: type `/build <issue ref>` to implement the triaged issue.
- `needs-info` → ask the reporter for the missing info; stop.
- `ready-for-human` → hand off to the human for a decision; stop.
- `wontfix` → close with a reason; stop.
- `needs-triage` (needs more triage) → continue triaging.
- list/query without selecting an issue → report the list; stop.

Do NOT unconditionally recommend `/build` — only when the outcome is `ready-for-agent` with a specific issue ref.

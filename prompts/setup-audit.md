---
description: Full setup health audit — versions, harmony, Coach coverage, disk, AGENTS.md, ecosystem
argument-hint: "[focus: versions|harmony|coach|disk|all]"
skill: setup-maintenance
---
# Auto-Pi Workflow Goal

[AUTO_PI_WORKFLOW]
entry=setup-audit
terminal=audited
[/AUTO_PI_WORKFLOW]
[AUTO_PI_SUBJECT]
${@:-complete Pi setup health audit}
[/AUTO_PI_SUBJECT]

Run a full health audit of this Pi setup. Follow the `setup-maintenance` skill (prevent drift + find leverage). The deterministic workflow interpreter requires a durable audit artifact before completion. This is read-only: do NOT change anything, just report.

Scope: the report is an intentional deliverable — write it to `~/Dev/my-pi/docs/audits/setup-audit-YYYY-MM-DD.md` (the repo, so it's publishable). Do NOT push. Fan out parallel read-only subagents — one per audit axis (versions, harmony, Coach coverage, disk, AGENTS.md accuracy, ecosystem steals). Enumerate counts dynamically from `~/.pi/agent/settings.json` and `~/.pi/agent/extensions/*.ts`.

Next: recommend a concrete command only if the audit identifies work; otherwise stop. You decide.

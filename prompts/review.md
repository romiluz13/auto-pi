---
description: Review current diff — two-axis (standards + spec) + security, anti-anchored
skill: code-review
---
Review the current uncommitted changes. Follow the `code-review` skill (two-axis: Standards + Spec).

Scope: use `HEAD` as the fixed point. Add a third reviewer: **Security** (injection, auth, secrets, unsafe operations). Give each reviewer fresh context — only the diff, not the builder's reasoning (anti-anchored). After reviews, run `/skill:receiving-code-review` — verify each suggestion, push back if wrong. Grep changed files for swallowed errors (empty catches, TODO/FIXME, debug logging).

Next: if findings, type `/build` to address them; if clean, type `/ship`. You decide.

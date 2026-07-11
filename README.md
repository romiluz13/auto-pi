# auto-pi

> Type a task. Pick a workflow. The right skills fire at the right moment. The agent proves its work. Memory compounds.

A Pi coding agent config where every task follows a real engineering workflow — and every workflow loads the right skills at the right step. Not from hope. Not from memory. The actual procedure, mechanically injected where it's needed.

[![Pi](https://img.shields.io/badge/Pi-v0.80+-blue.svg)](https://pi.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/romiluz13/auto-pi?style=social)](https://github.com/romiluz13/auto-pi)

---

## The value

You type "add pagination to the user list." You pick a workflow. The right skills load at each phase — the agent follows a real procedure, not an improvisation.

**Plan** → the brainstorming skill loads. The agent asks you questions one at a time, proposes approaches, gets your approval. Then writes a spec and breaks it into tickets.

**Build** → the TDD skill loads. Write the test first, watch it fail, implement, watch it pass. If it fails, the diagnosing-bugs skill loads — build a feedback loop, find the root cause, fix the source.

**Review** → the code-review skill loads. Two-axis review (standards + spec) with fresh-context reviewers who only see the diff. When feedback returns, the receiving-code-review skill loads — verify before implementing, push back if wrong.

**Ship** → the verification skill loads. You are an independent auditor — a passing test is never sufficient. Run the command, read the output, prove it. Then document (before commit, so docs are in the commit). Then commit. Then PR.

**Throughout all of this:**

- **Memory** saves every decision, gotcha, and failure for the next session — it compounds
- **Research** fans out across web, GitHub, codebase, and memory when you need evidence
- **Guardrails** keep your conventions in context every turn — rules don't fade
- **Handoff** captures everything into a document when the session gets long — no lost context

Every skill at the right step. Every phase with the right procedure. Memory that compounds. Research that's grounded. Verification that demands proof.

## How it works

```
you:   add pagination to the user list

       1. Just do it (raw agent)
       2. /build — Build with TDD
       3. /feature — plan → build → review → ship
       4. /loop — bounded loop with phase gates + approval
       5. /debug — feedback loop, root cause
       6. /fix — debug → build → review → ship
       7. /plan — plan only (no code)
       8. /research — parallel fan-out
       9. /review — review current diff
      10. /ship — verify, document, commit, PR
      11. Browse all commands (/palette)

→ you pick 3 → /feature "add pagination to the user list"
  PLAN     brainstorming skill injected → questions → approval → spec + tickets
  BUILD    tdd skill injected → red → green → proof
           if RED: diagnosing-bugs skill injected → feedback loop → root cause
  REVIEW   code-review skill injected → 2-axis parallel reviewers → receiving-code-review
  SHIP     verification skill injected → independent audit → document → commit → PR
```

The skill fires because the prompt command runs. The `skill:` frontmatter pin mechanically injects the skill content into context. The model gets the real procedure — not an improvisation from prose.

## What's inside

**9 workflows** — each loads the right skill at the right phase:

`/build` `/debug` `/feature` `/fix` `/loop` `/plan` `/research` `/review` `/ship`

**6 extensions** that make it work:

| Extension | Role |
| --- | --- |
| `coach.ts` | Shows the workflow menu when you type a task. You pick, it runs. |
| `loop.ts` | Bounded autonomous loop for hard tasks. Contract gate, phase tool-gates, RED guard, plateau detection. |
| `guardrails.ts` | Keeps your rules in context. Re-injects AGENTS.md every turn + after compaction. |
| `trace.ts` | Shows which skills fired vs which sat orphaned. `/trace-skills` — the orphan detector. |
| `palette.ts` | Fuzzy search over every command. `Ctrl+Shift+K`. |
| `handoff.ts` | Captures the session into a document for the next one. No lost context. |

**14 packages** — one per capability axis, zero collisions: memory, subagents, LSP, web, intercom, rewind, destructive-gate, context-sidecar, observability, statusline, questions, prompt-engine, side-conversations, web-access.

**64 skills** — 11 hand-tuned + 53 community (Matt Pocock, MongoDB, Vercel, Bright Data, Octocode, Python/OSS, UX). The right one loads at the right step.

**One 137-line rule file** — `config/agents.md`, shared across Pi, Claude Code, and Codex. Edit once, every agent follows the same workflow.

## Install

```bash
git clone https://github.com/romiluz13/auto-pi.git
cd auto-pi
./scripts/install.sh
```

One command: 14 packages, 6 extensions, 9 workflows, 64 skills, model definitions, AGENTS.md wired across three agents. Reload Pi (`/reload`) and type a task.

**Prerequisites:** Pi, Node 20+, npm, git, [mise](https://mise.jdx.dev/). `gh` optional.

**Update:** `./scripts/update.sh`

## Use it

```
pi
> add pagination to the user list          # pick /feature
> !just fix this one typo                  # '!' = raw, no workflow
> /loop "migrate auth to JWT end to end"   # hard task → bounded loop
```

## Structure

```
config/agents.md        the rule file (137 lines, shared across 3 agents)
config/settings.json    14 packages, compaction, retry, memory, subagents
config/models.json      provider + model definitions
extensions/             6 TypeScript extensions
prompts/                9 slash commands (each with a skill: pin)
skills/                 11 hand-tuned skills
scripts/install.sh      one-command setup
scripts/update.sh       refresh everything
docs/audits/            the audit trail
```

## License

MIT

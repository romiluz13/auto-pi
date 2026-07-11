# auto-pi

A Pi coding agent config where the **workflow** — not the model — decides what
to do. Type a task in plain English. The system shows you the right workflow,
you pick one, and it mechanically injects the skills, runs the phases, and
proves the work. No command to remember. No skill to recall. One rule file,
shared across Pi, Claude Code, and Codex.

[![Pi](https://img.shields.io/badge/Pi-v0.80+-blue.svg)](https://pi.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/romiluz13/auto-pi?style=social)](https://github.com/romiluz13/auto-pi)

---

## The idea

Every coding agent ships the same gap: **the model decides what to do, when.**
You get a box of skills and a hope that the LLM picks the right one at the right
time. It won't. It forgets the rules by turn 20, skips the review when it's
"obviously fine," and reports tests passing that it never ran. And when you give
it a workflow, it improvises from the prose instead of running the commands that
would actually inject the skills — so 72 skills sit on the rack and 6 fire.

auto-pi closes that gap with **structure the model is steered through** — enforced
where Pi's runtime allows (tool restrictions, iteration bounds, mechanical skill
injection), prompted where it doesn't (phase transitions, verification claims):

- **A 10-step autonomous workflow** — Understand → Brainstorm → Plan → Build →
  Test → Review → Verify → Document → Remember → Handoff. The workflow *is* the
  router. Each step names the exact skill to invoke. No router subagent, no
  free will. AGENTS.md says "MUST run `/build`" — not "use TDD" — so the
  `skill:` frontmatter pin fires and the skill content is mechanically injected.
- **Guardrails** — keeps the rule file in the system prompt: a one-line reminder
  every turn, the full rules re-injected on session start and after compaction.
  Rules don't fade out of the attention window.
- **A real loop engine** — `/loop` runs Plan → Build → Review → Verify → Ship
  with bounded remediation, plateau detection, independent verifier
  convergence, and a RED guard that refuses to advance a self-reported failing
  test to "done."
- **Coach** — you type a task in plain English, Coach shows a fixed 9-option
  workflow menu, you pick one. No LLM routing guesswork — you always see the
  options. One tap to accept. The slash command runs, the skill fires.
- **Activation observability** — `/trace-skills` shows which skills were
  available vs which the model actually loaded. Orphans are visible in real
  time, not discovered in a yearly audit.

The human steers. The structure enforces. The model executes.

## See it

```
you:   add dark mode to the dashboard

coach: Coach — pick a workflow for: "add dark mode to the dashboard"
       1. /build — Build with TDD (red → green → prove it)
       2. /feature — Full chain: plan → build → review → ship
       3. /loop — Bounded autonomous loop
       4. /debug — Debug an issue
       5. /plan — Plan only (no code)
       6. /research — Research a topic
       7. /review — Review current diff
       8. /ship — Ship (verify, commit, PR)
       9. Just do it (raw agent)
       10. Browse all commands (/palette)

→ you pick 1 → /build "add dark mode to the dashboard"
  the tdd skill is mechanically injected via the skill: frontmatter pin
  BUILD  implement, TDD (red → green), paste exit code as proof
  (then you run /review → code-review skill injected → 2-3 parallel reviewers)
  (then you run /ship → verification skill injected → independent audit → commit)
```

No slash command was typed. No skill was recalled. The workflow ran itself —
and the skills actually fired, not improvised.

## What's inside

**14 npm packages** — one per capability axis, conflict-checked. Memory,
subagents, LSP/lens, web, intercom, rewind, destructive-command gate, context
sidecar, observability, statusline, structured questions, prompt-template
engine, side conversations. Full list with the axis each owns in
[`config/settings.json`](config/settings.json).

**6 custom extensions** — harmony-preserving glue, each owns one axis:

| Extension | What it does |
| ----------- | -------------- |
| `coach.ts` | Plain-English → fixed 9-option workflow menu. You always pick. No LLM routing guesswork. Transforms to slash command → skill fires. |
| `loop.ts` | Bounded autonomous loop. Contract gate → Plan → Build → Review → Verify → Ship. RED guard, plateau detection, santa convergence, per-session state. |
| `guardrails.ts` | Keeps AGENTS.md in the system prompt: reminder every turn, full rules on start + after compaction. Defeats mid-session forgetting by construction. |
| `palette.ts` | Fuzzy command palette over every slash command (`Ctrl+Shift+K`). Zero drift — discovers dynamically. |
| `handoff.ts` | Deterministic `HANDOFF.md` generation. No LLM call, no compaction — just the session ledger, rendered. |
| `trace.ts` | Activation observability. Logs what skills/tools the workflow actually activates. `/trace-skills` = available vs activated = the orphan detector. |

**9 slash commands** — the user-facing surface, all Coach-routable:

`/build` `/debug` `/feature` `/fix` `/plan` `/research` `/review` `/ship` `/setup-audit`

Plus `/trace` and `/trace-skills` for activation observability, `/coach` for
toggle/test, `/palette` for fuzzy search, `/handoff` for session handoff,
`/loop` + `/loop-status` + `/loop-abort` for the loop engine.

`/feature` chains `plan → build → review → ship`. `/fix` chains
`debug → build → review → ship`. The rest are single-phase. Each prompt has a
`skill:` frontmatter pin that mechanically injects the skill content when the
command runs — the model gets the real procedure, not an improvisation.

**11 hand-tuned skills** — the workflow's executable knowledge:

`brainstorming` · `code-review` · `codebase-hygiene` · `diagnosing-bugs` ·
`diff-driven-docs` · `grilling` · `memory-compounding` · `receiving-code-review` ·
`setup-maintenance` · `setup-matt-pocock-skills` · `verification-before-completion`

Plus **53 community skills** provisioned by `scripts/install.sh` — Matt Pocock's
engineering suite (19), MongoDB (7), Vercel (5), Bright Data (8), Octocode (5),
Python/OSS (3), UX skills (3) — plus package-shipped skills from pi-lens,
pi-subagents, pi-hermes-memory, and pi-web-access. Discovered live by the
harness, invoked by the workflow, never by memorization.

**One 137-line rule file** — `config/agents.md`, the single source of truth
loaded by Pi (contextFiles), Claude Code (`@import`), and Codex (symlink).
Edit once, every agent follows it. Says "MUST run `/build`" not "use TDD" so
skills actually fire.

## Why it's different

| Every other agent setup | auto-pi |
| ------------------------ | ------- |
| LLM picks which skill to run, when | The **workflow** picks. The model executes. |
| Skills sit in the catalog, never activated | **Coach's fixed menu** guarantees you pick a workflow command → `skill:` pin fires → skill content is mechanically injected |
| Rules fade out of context by turn 20 | **Guardrails** keeps them in the prompt — reminder every turn, full rules on start + after compaction |
| "Tests pass" is trusted on the agent's word | **RED guard + evidence block** — a self-reported failing test loops back to fix, not forward to ship; build demands the command + exit code + output as proof |
| One forward-only pipeline | A real **loop engine** with bounded remediation, plateau detection, verifier convergence |
| Remember 20 slash commands | Type English. **Coach** shows the 9 options. You pick. |
| No idea which skills actually fired | **`/trace-skills`** shows available vs activated — orphans are visible in real time |
| A pile of packages that may conflict | **Harmony-checked** — every axis has one owner, every extension audited by 8+ fresh-context reviewers across 8 independent audits |
| Tied to one tool | One rule file, **three agents** (Pi / Claude Code / Codex) |
| Rots and drifts | **Self-maintaining** — `/setup-audit` runs 6 parallel checks, `/trace-skills` catches orphans live |

## Install

```bash
git clone https://github.com/romiluz13/auto-pi.git
cd auto-pi
./scripts/install.sh
```

The installer wires the rule file across all three agents, installs the 14
packages, deploys the 6 extensions + 9 commands + 11 repo skills, provisions
53 community skills (Matt Pocock, MongoDB, Vercel, Bright Data, Octocode,
Python/OSS, UX), deploys model definitions, configures web search, and
installs legacy namespace shims. One command. Reload Pi (`/reload`) and type
a task.

**Prerequisites:** Pi (`curl -fsSL https://pi.dev/install.sh | sh`), Node 20+,
npm, git, [mise](https://mise.jdx.dev/) (for `mise exec node@24 -- npm`). `gh` optional.

**Update packages + community skills + curated assets:** `./scripts/update.sh`

## Use it

```
pi
> add pagination to the user list          # Coach shows 9 options → pick /feature
> !just fix this one typo                  # '!' = raw, no Coach menu
> /loop "migrate auth to JWT end to end"   # hard task → bounded autonomous loop
> /trace-skills                            # see which skills fired vs orphaned
> /setup-audit                             # monthly health check
```

Prefix `!` for raw mode (no Coach). Prefix `/` to run a command directly.
`Ctrl+Shift+K` opens the palette. `/handoff` writes a continuation doc.

## How it's built

- **It dogfoods itself.** The 2026-07-08 Pocock-alignment prune (issues #1–#8)
  was researched, specced, ticketed, built, and verified by Pi running this
  config. The commits are in the log.
- **It's audited, not just built.** 8 independent audits (48+ subagents across
  6 LLM providers) checked every extension, package, config, skill, prompt, and
  doc. Findings and fixes live in [`docs/audits/`](docs/audits/). 3 findings
  were refuted by source-code verification. 80+ findings were fixed.
- **It's honest about what it rejected.** Curation is the proof — packages
  excluded for conflict (`pi-dynamic-workflows`, team-mode RPC, the
  `tomsej/pi-ext` bundle) are documented in `extensions/README.md`.
- **It's observable.** The trace extension proves skills actually fire — not
  just sit in the catalog. The first dogfood test caught 0/6 Grade A skills
  activating (the agent improvised from prose instead of running commands).
  The Coach fixed-menu fix was the response — and the trace proved it worked.

## Structure

```
config/agents.md        the rule file (137 lines, shared across 3 agents)
config/settings.json    14 packages, compaction, retry, memory, subagents
config/models.json      provider + model definitions
extensions/             6 custom TypeScript extensions (coach, loop, guardrails, palette, handoff, trace)
prompts/                9 slash commands (the user interface)
skills/                 11 hand-tuned skills
scripts/install.sh      one-command setup (packages + extensions + 64 skills + models)
scripts/update.sh       refresh (packages + community skills + curated assets)
docs/audits/            the audit trail
vendor/                 legacy namespace shims for pi-intercom/pi-rewind
```

## License

MIT

# auto-pi

**A workflow OS for [Pi](https://pi.dev).**  
Type a task → pick a workflow → one pinned workflow skill orchestrates the phases by reading specialists in turn.

Not another coding agent. A dress on Pi's minimal harness: Coach, slash workflows, mechanical `skill:` pins, and workflow skills that orchestrate.

[![Pi](https://img.shields.io/badge/Pi-v0.80+-blue.svg)](https://pi.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What it is / is not

| Is | Is not |
| --- | --- |
| An installable Pi config: extensions + prompts + skills + shared `AGENTS.md` | A sealed product competing with Claude Code / Codex / ChatGPT |
| Seven workflows that **pin** a workflow skill via Pi `skill:` frontmatter | A promise that every cascading skill is force-injected |
| Model-agnostic — point Pi at whatever you pay for | Vendor lock-in |

---

## Install

```bash
git clone https://github.com/romiluz13/auto-pi.git
cd auto-pi
./scripts/install.sh
```

Then in Pi: `/reload`, type a task, pick a workflow.

**Needs:** [Pi](https://pi.dev) 0.80+, Node (installer uses `mise exec node@24`), npm, git, [mise](https://mise.jdx.dev/), `jq`. `gh` optional.

**Update:** `./scripts/update.sh`

---

## 30 seconds

```
pi
> add pagination to the user list
```

Coach shows a fixed menu. You pick. Examples:

| You pick | What happens |
| --- | --- |
| `/plan` | **Pins** `planning-workflow` — classifies bounded vs foggy, then orchestrates brainstorming → to-spec → to-tickets by reading each specialist in turn |
| `/build` | **Pins** `build-workflow` — tdd (red → green), with diagnosing-bugs on persistent RED |
| `/debug` | **Pins** `debug-workflow` — routes to diagnosing-bugs (bugs) or resolving-merge-conflicts (merge/rebase) |
| `/research` | **Pins** `research-workflow` — routes among research, octocode-research, live-research |
| `/review` | **Pins** `review-workflow` — code-review (standards + spec + security) → receiving-code-review |
| `/ship` | **Pins** `ship-workflow` — verification → docs → commit → github (conditional) |
| `Just do it` or `!…` | Raw agent — AGENTS.md only, no workflow pin |

The workflow skill orchestrates the phases. You answer questions and approve inside the workflow. You never type internal skill commands — the workflow handles the routing.

---

## How it works

**Pinned (HARD)** — Pi injects the workflow skill body when the slash command declares `skill:`:

| Command | Pinned workflow skill | Specialists it reads |
| --- | --- | --- |
| `/plan` | `planning-workflow` | brainstorming → to-spec → to-tickets (bounded); wayfinder (foggy) |
| `/build` | `build-workflow` | tdd; diagnosing-bugs on RED; uv for Python |
| `/debug` | `debug-workflow` | diagnosing-bugs; resolving-merge-conflicts |
| `/research` | `research-workflow` | research / octocode-research / live-research |
| `/review` | `review-workflow` | code-review → receiving-code-review |
| `/ship` | `ship-workflow` | verification-before-completion → diff-driven-docs → commit → github |
| `/setup-audit` | `setup-maintenance` | (direct pin — 1 specialist, no wrapper) |

**Orchestration** — the workflow skill reads each specialist `SKILL.md` at its phase boundary, follows only that specialist's procedure, then rereads the workflow skill to route to the next phase. The workflow owns the routing; the specialist owns the procedure.

**State block** — each workflow tracks a compact state block (phase, evidence, artifacts) across turns. Before every user wait, the workflow emits the state. On continuation, it reads the latest state. If the state is lost (compaction), the workflow reconstructs from conversation artifacts.

**Observable** — `/trace-skills` shows available vs activated skills.

---

## What's inside

| Piece | What you get |
| --- | --- |
| **Coach** | Plain-English task → fixed workflow menu (7 workflows + raw + palette) |
| **Prompts** | `/plan` `/build` `/debug` `/research` `/review` `/ship` `/setup-audit` (thin — entry + task only) |
| **Extensions** | `coach` · `guardrails` · `trace` · `palette` · `handoff` · `session-status` |
| **Packages** | 12 npm packages (memory, subagents, context sidecar, lens, rewind, web, etc.) |
| **Skills** | 6 workflow skills + 14 hand-tuned in-repo + community packs provisioned by install. Catalog: 88 skills total. **Only pinned workflow skills are mechanically injected; specialists are read on demand by the workflow.** |
| **Rules** | `config/agents.md` (~183 lines) — installer wires the same file for Pi, Claude Code, and Codex |

### Extensions (honest)

| Extension | Behavior |
| --- | --- |
| `coach.ts` | Intercepts plain input → menu → runs the chosen command (`!` or `/` skips) |
| `guardrails.ts` | Full HARD RULES block on session start and after compaction; short reminder on other turns |
| `session-status.ts` | Session tracking + auto-naming for unique intercom targeting |
| `trace.ts` | Activation log + `/trace-skills` orphan gap |
| `palette.ts` | Fuzzy command search — `Ctrl+Shift+K` or `/palette` |
| `handoff.ts` | Writes a compact `HANDOFF.md` from recent turns + last compaction summary |

### Memory

`pi-hermes-memory` + `pi-observational-memory` persist selected lessons and session structure across/within sessions. They do not record every decision automatically — you still steer what matters into memory.

---

## Philosophy

Pi ships a minimal harness on purpose. AutoPi fills the empty layer: **procedure reliability**.

- Rent models (Claude API, ChatGPT Codex subscription, GLM, local — whatever Pi can reach).
- Own the workflow: which workflow skill is pinned, what specialists it reads, what counts as "shipped."
- Prefer one honest workflow pin over fifty silent catalog entries.
- The workflow orchestrates; the human answers and approves.

---

## Structure

```
config/agents.md        shared rules (~183 lines)
config/settings.json    packages, compaction, memory, subagents
config/models.json      provider / model definitions
extensions/             coach, guardrails, trace, palette, handoff, session-status
prompts/                slash workflows (7 — thin entry adapters)
skills/                 6 workflow skills + 14 hand-tuned skills
scripts/install.sh      one-command setup
scripts/sync-live.sh    sync repo → live runtime
scripts/update.sh       refresh
docs/audits/            design / harmony trail
```

---

## License

MIT

# auto-pi

**A workflow OS for [Pi](https://pi.dev).**  
Type a task → pick a workflow → a pinned skill procedure enters context before the model acts.

Not another coding agent. A dress on Pi's minimal harness: Coach, slash workflows, mechanical `skill:` pins.

[![Pi](https://img.shields.io/badge/Pi-v0.80+-blue.svg)](https://pi.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What it is / is not

| Is | Is not |
| --- | --- |
| An installable Pi config: extensions + prompts + skills + shared `AGENTS.md` | A sealed product competing with Claude Code / Codex / ChatGPT |
| Seven workflows that **pin** a primary skill via Pi `skill:` frontmatter | A promise that every cascading skill is force-injected |
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
| `/plan` | **Pins** `brainstorming` — questions, design approval, then steered toward spec/tickets |
| `/build` | **Pins** `tdd` — red → green → prove. On failure, procedure **steers** toward diagnosing-bugs (or run `/debug`) |
| `/review` | **Pins** `code-review` — two-axis review procedure; receiving feedback is steered |
| `/ship` | **Pins** `verification-before-completion` — independent audit, then steered docs → commit → PR |
| `Just do it` or `!…` | Raw agent — AGENTS.md only, no workflow pin |

At the end of each workflow, the prompt tells you the next slash command to type. You drive — the agent guides.

---

## How it works

**Pinned (HARD)** — Pi injects the skill body when the slash command declares `skill:`:

| Command | Pinned skill |
| --- | --- |
| `/plan` | `brainstorming` |
| `/build` | `tdd` |
| `/debug` | `diagnosing-bugs` |
| `/research` | `research` |
| `/review` | `code-review` |
| `/ship` | `verification-before-completion` |
| `/setup-audit` | `setup-maintenance` |

**Steered** — follow-ons live in procedure text (spec/tickets after plan, diagnosing-bugs on RED, receiving-code-review, docs-before-commit, `/skill:commit` / github). The model is instructed to load them; they are not second frontmatter pins.

**Handoff** — at the end of each workflow, the prompt tells you the next slash command to type (`Next: type /review. You decide.`). You type it, Pi expands it, the skill pin fires. No automatic handoffs, no continuation detection — the human is the driver.

**Observable** — `/trace-skills` shows available vs activated skills (orphan detector).

That split is the product: **pins where it matters, steer for the rest, the human drives the next step** — not a wall of hoped-for skills.

---

## What's inside

| Piece | What you get |
| --- | --- |
| **Coach** | Plain-English task → fixed workflow menu (7 workflows + raw + palette) |
| **Prompts** | `/plan` `/build` `/debug` `/research` `/review` `/ship` `/setup-audit` |
| **Extensions** | `coach` · `guardrails` · `trace` · `palette` · `handoff` · `session-status` |
| **Packages** | 12 npm packages (memory, subagents, context sidecar, lens, rewind, web, etc.) |
| **Skills** | 14 hand-tuned in-repo + community packs provisioned by install (Matt Pocock, MongoDB, Vercel, Bright Data, Octocode, and related). Catalog size varies with sources; **only pinned skills are mechanically injected.** |
| **Rules** | `config/agents.md` (~183 lines) — installer wires the same file for Pi, Claude Code, and Codex |

### Extensions (honest)

| Extension | Behavior |
| --- | --- |
| `coach.ts` | Intercepts plain input → menu → runs the chosen command (`!` or `/` skips) |
| `guardrails.ts` | Full HARD RULES block on session start and after compaction; short reminder on other turns |
| `session-status.ts` | Session tracking + auto-naming for unique intercom targeting |
| `trace.ts` | Activation log + `/trace-skills` orphan gap |
| `palette.ts` | Fuzzy command search — `Ctrl+Shift+K` or `/palette` |
| `handoff.ts` | Writes a compact `HANDOFF.md` from recent turns + last compaction summary (deterministic, no extra LLM call) |

### Memory

`pi-hermes-memory` + `pi-observational-memory` persist selected lessons and session structure across/within sessions. They do not record every decision automatically — you still steer what matters into memory.

---

## Philosophy

Pi ships a minimal harness on purpose. AutoPi fills the empty layer: **procedure reliability**.

- Rent models (Claude API, ChatGPT Codex subscription, GLM, local — whatever Pi can reach).
- Own the workflow: which skill is pinned, what counts as "shipped."
- Prefer one honest pin over fifty silent catalog entries.
- The human drives the next step — the agent guides.

---

## Structure

```
config/agents.md        shared rules (~183 lines)
config/settings.json    packages, compaction, memory, subagents
config/models.json      provider / model definitions
extensions/             coach, guardrails, trace, palette, handoff, session-status
prompts/                slash workflows (7 standalone + setup-audit)
skills/                 14 hand-tuned skills
scripts/install.sh      one-command setup
scripts/sync-live.sh    sync repo → live runtime
scripts/update.sh       refresh
docs/audits/            design / harmony trail
```

---

## License

MIT

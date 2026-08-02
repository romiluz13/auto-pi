# auto-pi

**A workflow OS for [Pi](https://pi.dev).**
Type a task → pick a workflow → one pinned orchestration layer drives ask-matt's routing through the SDLC.

Not another coding agent. A dress on Pi's minimal harness: Coach, slash workflows, mechanical `skill:` pins, ask-matt as the routing brain, and a thin orchestration layer that adds the mechanics Matt's skills don't have.

[![Pi](https://img.shields.io/badge/Pi-v0.80+-blue.svg)](https://pi.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What it is / is not

| Is | Is not |
| --- | --- |
| An installable Pi config: extensions + prompts + skills + shared `AGENTS.md` | A sealed product competing with Claude Code / Codex / ChatGPT |
| Three layers: Coach → ask-matt → orchestration-layer | Six parallel workflow orchestrators duplicating upstream routing |
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
| `/plan` | **Pins** `orchestration-layer` → reads `ask-matt` → routes to brainstorming → to-spec → to-tickets (bounded) or wayfinder (foggy) |
| `/build` | **Pins** `orchestration-layer` → reads `ask-matt` → routes to tdd (red → green), with diagnosing-bugs on persistent RED |
| `/debug` | **Pins** `orchestration-layer` → reads `ask-matt` → routes to diagnosing-bugs (bugs) or resolving-merge-conflicts (merge/rebase) |
| `/research` | **Pins** `orchestration-layer` → reads `ask-matt` → routes among research, octocode-research, live-research |
| `/review` | **Pins** `orchestration-layer` → code-review (standards + spec + security) → receiving-code-review (disposition) |
| `/ship` | **Pins** `orchestration-layer` → verification → diff-driven-docs → commit → github (conditional) |
| `Just do it` or `!…` | Raw agent — AGENTS.md only, no workflow pin |

The orchestration layer reads ask-matt for routing, reads each specialist in turn, and tracks state + evidence. You answer questions and approve inside the workflow. You never type internal skill commands.

---

## How it works

**Three layers:**

| Layer | Role | Owner |
| ------- | ------ | ------- |
| **Coach** | Deterministic 9-option menu. Human-controlled entry. Intercepts input, hands to the matching prompt. | auto-pi (`extensions/coach.ts`) |
| **ask-matt** | The routing brain. Decides which specialist to read next based on where the work is in the SDLC. Pinned external skill with provenance + drift automation. | Matt Pocock (external, pinned) |
| **orchestration-layer** | The mechanics. State blocks, evidence gates, reread-after-phase, compaction recovery, human-controlled stops, and the unique auto-pi phases (ship, review disposition, verification, security). | auto-pi (one thin skill) |

**Pinned (HARD)** — Pi injects the orchestration layer when the slash command declares `skill: orchestration-layer`. The layer's first instruction reads `ask-matt` (the routing brain). ask-matt routes to the specialist for the current SDLC phase. The layer adds state + evidence + the human-controlled stop.

**Why not six orchestrators?** v0.3 had six parallel workflow orchestrators that each independently routed through the SDLC — duplicating routing that `ask-matt` already provides. v0.4 collapses them: ask-matt owns the routing (one source of truth), the orchestration layer owns the mechanics (one thin wrapper). No duplication.

**Orchestration** — the layer reads ask-matt for routing, reads each specialist `SKILL.md` at its phase boundary, follows only that specialist's procedure, then rereads itself + ask-matt to route to the next phase. The layer owns the mechanics; ask-matt owns the routing; the specialist owns the procedure.

**State block** — the layer tracks a compact state block (phase, evidence, artifacts) across turns. Before every user wait, the layer emits the state. On continuation, it reads the latest state. If the state is lost (compaction), the layer reconstructs from conversation artifacts.

**Observable** — `/trace-skills` shows available vs activated skills.

---

## What's inside

| Piece | What you get |
| --- | --- |
| **Coach** | Plain-English task → fixed workflow menu (8 workflows + raw + palette) |
| **Prompts** | `/plan` `/build` `/debug` `/research` `/review` `/ship` `/triage` `/setup-audit` (thin — entry + task only, each pins `orchestration-layer`) |
| **Extensions** | `coach` · `guardrails` · `trace` · `palette` · `handoff` · `session-status` |
| **Packages** | 12 npm packages (memory, subagents, context sidecar, lens, rewind, web, etc.) |
| **Routing brain** | `ask-matt` (Matt Pocock's, pinned with provenance + SHA-256 drift check) |
| **Orchestration layer** | `orchestration-layer` (auto-pi's thin wrapper — state, evidence, reread, compaction, human-controlled stops, unique phases) |
| **Specialists** | 14 hand-tuned in-repo skills (brainstorming, code-review, diagnosing-bugs, etc.) + community packs provisioned by install. Catalog: 88+ skills total. **Only the pinned layer is mechanically injected; ask-matt + specialists are read on demand.** |
| **Rules** | `config/agents.md` — installer wires the same file for Pi, Claude Code, and Codex |

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

Pi ships a minimal harness on purpose. auto-pi fills the empty layer: **orchestration reliability around Matt Pocock's routing brain.**

- Rent models (Claude API, ChatGPT Codex subscription, GLM, local — whatever Pi can reach).
- Own the orchestration: state blocks, evidence gates, compaction recovery, human-controlled stops, and the phases Matt's skills don't have (ship, review disposition, verification, security).
- Leverage upstream: ask-matt routes; we don't duplicate its graph.
- One honest pin (`orchestration-layer`) over six parallel orchestrators.
- The layer orchestrates; the human answers and approves.

---

## Structure

```
config/agents.md            shared rules (3-layer architecture)
config/settings.json        packages, compaction, memory, subagents
config/models.json          provider / model definitions
config/pinned-deps.json     ask-matt provenance (commit + SHA-256)
config/workflow-graph-contract.ts  v0.4 graph contract + reachability
extensions/                 coach, guardrails, trace, palette, handoff, session-status
prompts/                    slash workflows (8 — thin, each pins orchestration-layer)
skills/                     orchestration-layer + security-review + 14 hand-tuned skills
scripts/install.sh          one-command setup
scripts/sync-live.sh        sync repo → live runtime
scripts/check-drift.sh      drift check (local forks + pinned deps)
docs/specs/                 v0.4 spec
docs/audits/                design / harmony / v0.4 audit trail
```

---

## License

MIT

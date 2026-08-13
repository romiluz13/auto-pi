# auto-pi

**A workflow OS for [Pi](https://pi.dev).**
Type a task → pick a workflow → one deterministic machine drives ask-matt-routed specialists to evidence-backed completion.

Not another coding agent. A dress on Pi's minimal harness: Coach, PTM-authenticated workflow goals, ask-matt as the routing brain, a typed lifecycle reducer, durable journals, fresh top-level phase dispatch, and a thin procedure layer.

[![Pi](https://img.shields.io/badge/Pi-v0.84.1+-blue.svg)](https://pi.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What it is / is not

| Is | Is not |
| --- | --- |
| An installable Pi config: extensions + prompts + skills + shared `AGENTS.md` | A sealed product competing with Claude Code / Codex / ChatGPT |
| Four layers: Coach → workflow machine → ask-matt → procedure layer | Prompt-only handoffs or duplicated specialist routing |
| Model-agnostic — point Pi at whatever you pay for | Vendor lock-in |

---

## Install

```bash
git clone https://github.com/romiluz13/auto-pi.git
cd auto-pi
./scripts/install.sh
```

Then in Pi: `/reload`, type a task, pick a workflow.

**Needs:** [Pi](https://pi.dev) 0.84.1+, `pi-prompt-template-model` 0.12.0, Node (installer uses `mise exec node@24`), npm, git, [mise](https://mise.jdx.dev/), `jq`, and `gitleaks` for interpreter-owned commit scanning. `gh` is required only for PR publication.

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
| `/plan` | Starts at planning and autonomously converges through spec, tickets, build, fresh review, and ship |
| `/build` | Starts with TDD, diagnoses persistent RED, verifies, reviews, remediates, and ships |
| `/debug` | Diagnoses, fixes through TDD, reviews, and ships |
| `/research` | Produces one durable cited research artifact |
| `/review` | Runs fresh Standards + Spec + Security review, remediates, verifies, and ships |
| `/ship` | Independently verifies → documents → creates one commit → conditionally publishes |
| `Just do it` or `!…` | Raw agent — AGENTS.md only, no workflow pin |

The interpreter persists state and evidence, rejects illegal or no-progress transitions, and records a durable dispatch outbox. After each agent settles, the next phase starts as a fresh top-level run with a fresh system policy. You enter once; it stops only for a genuinely user-owned hard-to-reverse decision.

---

## How it works

**Four layers:**

| Layer | Role | Owner |
| ------- | ------ | ------- |
| **Coach** | Deterministic menu and public goal entry. | auto-pi (`extensions/coach.ts`) |
| **workflow machine/interpreter** | Typed legal transitions, state-bound tools, durable journal/outbox, bounded retries, fresh phase dispatch, commit/publish enforcement. | auto-pi (`config/workflow-machine.ts`, `extensions/workflow-interpreter.ts`) |
| **ask-matt** | Selects the semantic specialist without a copied route graph. | Matt Pocock (external, pinned) |
| **orchestration-layer + specialists** | Executes the active phase procedure and submits evidence through `workflow_transition`. | auto-pi + specialist authors |

**Mechanical entry** — PTM emits a versioned start receipt, renders the prompt's `AUTO_PI_WORKFLOW` marker, and injects `orchestration-layer`. The interpreter admits only matching PTM goals and initializes the durable run before the first model turn.

**Single authority** — `workflow-machine.ts` is the lifecycle authority. ask-matt remains the routing authority. The procedure layer never invents transitions or public handoff commands.

**Durable state** — every accepted state snapshot is hash-chained under `~/.pi/agent/workflows/`. Conversation state is only a display cache. `/workflow status|resume|abort` manages a run.

**Progress law** — every event moves forward, adds verified evidence, reduces an open set, or consumes a bounded retry with new diagnostics. Duplicate fingerprints fail safely instead of looping.

**Observable** — `/trace-skills` shows available vs activated skills.

---

## What's inside

| Piece | What you get |
| --- | --- |
| **Coach** | Plain-English task → fixed workflow menu (8 workflows + raw + palette) |
| **Prompts** | `/plan` `/build` `/debug` `/research` `/review` `/ship` `/triage` `/setup-audit` (thin — entry + task only, each pins `orchestration-layer`) |
| **Extensions** | `workflow-interpreter` · `coach` · `guardrails` · `trace` · `palette` · `handoff` · `session-status` |
| **Packages** | 12 npm packages (memory, subagents, context sidecar, lens, rewind, web, etc.) |
| **Routing brain** | `ask-matt` (Matt Pocock's, pinned with provenance + SHA-256 drift check) |
| **Control plane** | Typed workflow reducer + durable hash-chained store + Pi interpreter |
| **Procedure layer** | `orchestration-layer` reads ask-matt and drives the active specialist; it does not own transitions |
| **Specialists** | 14 hand-tuned in-repo skills (brainstorming, code-review, diagnosing-bugs, etc.) + community packs provisioned by install. Catalog: 88+ skills total. **Only the pinned layer is mechanically injected; ask-matt + specialists are read on demand.** |
| **Rules** | `config/agents.md` — installer wires the same file for Pi, Claude Code, and Codex |

### Extensions (honest)

| Extension | Behavior |
| --- | --- |
| `coach.ts` | Intercepts plain input → menu → invokes PTM through its versioned request/ack protocol (`!` or `/` skips) |
| `guardrails.ts` | Full HARD RULES block on session start and after compaction; short reminder on other turns |
| `session-status.ts` | Session tracking + auto-naming for unique intercom targeting |
| `trace.ts` | Activation log + `/trace-skills` orphan gap |
| `palette.ts` | Fuzzy command search — `Ctrl+Shift+K` or `/palette` |
| `handoff.ts` | Writes a compact `HANDOFF.md` from recent turns + last compaction summary |
| `workflow-interpreter.ts` | Admits PTM goals, binds tools to run/phase/sequence, persists journal/outbox, and dispatches fresh top-level phases after `agent_settled` |

### Memory

`pi-hermes-memory` + `pi-observational-memory` persist selected lessons and session structure across/within sessions. They do not record every decision automatically — you still steer what matters into memory.

---

## Philosophy

Pi ships a minimal harness on purpose. auto-pi fills the empty layer: **orchestration reliability around Matt Pocock's routing brain.**

- Rent models (Claude API, ChatGPT Codex subscription, GLM, local — whatever Pi can reach).
- Own the control plane: executable transitions, evidence gates, durable recovery, bounded loops, and the phases Matt's skills don't have.
- Leverage upstream: ask-matt routes; we don't duplicate its graph.
- One honest pin (`orchestration-layer`) over six parallel orchestrators.
- The machine orchestrates; the human is interrupted only for hard-to-reverse decisions.

---

## Structure

```
config/agents.md            shared rules (4-layer architecture)
config/settings.json        packages, compaction, memory, subagents
config/models.json          provider / model definitions
config/pinned-deps.json     ask-matt provenance (commit + SHA-256)
config/workflow-machine.ts  authoritative typed lifecycle reducer
config/workflow-graph-contract.ts  routing/reachability compatibility catalog
extensions/                 workflow interpreter/store + Coach and observability glue
prompts/                    slash workflow goals (8 — marker + skill pin)
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

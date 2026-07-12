# auto-pi

**A workflow OS for [Pi](https://pi.dev).**  
Type a task → pick a workflow → a pinned skill procedure enters context before the model acts.

Not another coding agent. A dress on Pi’s minimal harness: Coach, slash workflows, mechanical `skill:` pins, and a bounded `/loop` with real tool gates.

[![Pi](https://img.shields.io/badge/Pi-v0.80+-blue.svg)](https://pi.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What it is / is not

| Is | Is not |
| --- | --- |
| An installable Pi config: extensions + prompts + skills + shared `AGENTS.md` | A sealed product competing with Claude Code / Codex / ChatGPT |
| Six workflows that **pin** a primary skill via Pi `skill:` frontmatter | A promise that every cascading skill is force-injected |
| `/loop` with contract gate, per-phase tool allowlists, RED/plateau exits | Unbounded “autonomous AGI” |
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
| `/feature` | Chain: plan → build → review → ship (child pins fire; **no** human approval gates between phases) |
| `/loop` | Hard task mode: contract → phased tool gates → human pauses → cap / plateau / ship on a **real commit hash** |
| `Just do it` or `!…` | Raw agent — AGENTS.md only, no workflow pin |

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

**Chained** — `/feature` = plan→build→review→ship; `/fix` = debug→build→review→ship. No mega-pin on the chain itself; each leaf brings its pin.

**Steered** — follow-ons live in procedure text (spec/tickets after plan, diagnosing-bugs on RED, receiving-code-review, docs-before-commit, `/skill:commit` / github). The model is instructed to load them; they are not second frontmatter pins.

**Gated (`/loop`)** — extension owns phase tool allowlists, contract preflight, RED halt, plateau detection, ship only when a commit hash appears. Phase skills are steered inside those gates.

**Observable** — `/trace-skills` shows available vs activated skills (orphan detector).

That split is the product: **pins where it matters, gates where autonomy is dangerous, steer for the rest** — not a wall of hoped-for skills.

---

## What's inside

| Piece | What you get |
| --- | --- |
| **Coach** | Plain-English task → fixed workflow menu (11 options including raw + palette) |
| **Prompts** | `/plan` `/build` `/debug` `/research` `/review` `/ship` `/feature` `/fix` `/setup-audit` |
| **Loop** | `/loop` extension — bounded autonomy for hard multi-phase work |
| **Extensions** | `coach` · `loop` · `guardrails` · `trace` · `palette` · `handoff` |
| **Packages** | 14 npm packages (memory, subagents, context sidecar, lens, rewind, web, etc.) |
| **Skills** | 11 hand-tuned in-repo + community packs provisioned by install (Matt Pocock, MongoDB, Vercel, Bright Data, Octocode, and related). Catalog size varies with sources; **only pinned skills are mechanically injected.** |
| **Rules** | `config/agents.md` (~137 lines) — installer wires the same file for Pi, Claude Code, and Codex |

### Extensions (honest)

| Extension | Behavior |
| --- | --- |
| `coach.ts` | Intercepts plain input → menu → runs the chosen command (`!` or `/` skips) |
| `loop.ts` | Contract → PLAN/BUILD/REVIEW/VERIFY/SHIP with tool gates, RED/plateau, commit-hash ship |
| `guardrails.ts` | Full HARD RULES block on session start and after compaction; short reminder on other turns |
| `trace.ts` | Activation log + `/trace-skills` orphan gap |
| `palette.ts` | Fuzzy command search — `Ctrl+Shift+K` or `/palette` |
| `handoff.ts` | Writes a compact `HANDOFF.md` from recent turns + last compaction summary (deterministic, no extra LLM call) |

### Memory

`pi-hermes-memory` + `pi-observational-memory` persist selected lessons and session structure across/within sessions. They do not record every decision automatically — you still steer what matters into memory.

---

## Philosophy

Pi ships a minimal harness on purpose. AutoPi fills the empty layer: **procedure reliability**.

- Rent models (Claude API, ChatGPT Codex subscription, GLM, local — whatever Pi can reach).
- Own the loop: which skill is pinned, which tools a phase may use, what counts as “shipped.”
- Prefer one honest pin over fifty silent catalog entries.

---

## Structure

```
config/agents.md        shared rules (~137 lines)
config/settings.json    packages, compaction, memory, subagents
config/models.json      provider / model definitions
extensions/             coach, loop, guardrails, trace, palette, handoff
prompts/                slash workflows (pins + chains + setup-audit)
skills/                 11 hand-tuned skills
scripts/install.sh      one-command setup
scripts/update.sh       refresh
docs/audits/            design / harmony trail
```

---

## License

MIT

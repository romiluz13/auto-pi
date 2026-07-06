# my-pi

**The best Pi coding agent setup — 12 packages, 54 skills, 8 slash commands, 2 custom extensions, 10-step autonomous workflow. Zero bloat, pure Pi ideology.**

[![Pi](https://img.shields.io/badge/Pi-v0.80+-blue.svg)](https://pi.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## What This Is

A curated, reproducible Pi coding agent setup built on three principles:

1. **Every piece earns its place.** No bloat, no duplicates, no "just in case" packages.
2. **CLI + skills, not MCP.** Pi's philosophy is minimal — web access via CLI, code research via CLI, not MCP servers with 93 deps.
3. **Autonomous by default.** The agent brainstorms, plans, builds, tests, reviews, verifies, documents, and remembers without manual skill invocation.

---

## Quick Start (3 commands)

```bash
# 1. Clone and install everything
git clone https://github.com/romiluz13/my-pi.git
cd my-pi && ./scripts/install.sh

# 2. Authenticate external CLIs (one time, free)
bdata login              # Bright Data — web search + scrape, 5,000 free credits/month
npx octocode auth login  # GitHub — code research

# 3. Start Pi and tell it who you are
pi
# Then type: /memory-interview
```

After that, just describe what you want. Pi handles the rest.

---

## The User Interface — 8 Slash Commands

These are the commands you type. Each one kicks off an autonomous workflow.

| Command | What it does | Skills it loads |
| --------- | ------------- | ---------------- |
| `/feature "add dark mode"` | **Full chain:** plan → build → review → ship | brainstorming → tdd → code-review → verification |
| `/fix "login button broken"` | **Full chain:** debug → build → review → ship | diagnosing-bugs → tdd → code-review → verification |
| `/plan "redesign auth"` | Brainstorm, design, write spec + tickets | brainstorming |
| `/build "add JWT validation"` | TDD: write test → see fail → implement → see pass | tdd |
| `/debug "payment fails on Stripe"` | Build feedback loop, find root cause, fix | diagnosing-bugs |
| `/review` | Parallel reviewers on current diff, anti-anchored | code-review |
| `/ship` | Verify with evidence, commit, document | verification-before-completion |
| `/research "compare state libraries"` | Parallel fan-out across web, GitHub, codebase | research |

**`/feature` and `/fix` are the power commands** — they chain 4 skills end-to-end and run autonomously until done. Type one command, get a fully reviewed, verified, committed feature.

---

## The 10-Step Autonomous Workflow

Every task flows through these steps automatically. The workflow IS the skill router — each step names the exact skill to use. No separate router skill needed.

```
 1. Understand       → read repo, search memory, ask ONE question if ambiguous
 2. Brainstorm       → new features: design before code, get user approval
 3. Plan             → /to-spec + /to-tickets, or /wayfinder for fog-of-war
 4. Build            → /build or /feature (TDD: test first, see fail, implement, pass)
 5. Test             → run tests, diagnosing-bugs skill if fail (repro loop first)
 6. Review           → 2-3 parallel reviewer subagents, anti-anchored, fresh context
 7. Verify + commit  → evidence before claims, independent auditor, then commit
 8. Document         → AGENTS.md for gotchas, ADR for decisions, CHANGELOG for users
 9. Remember         → save to memory (SQLite + observational), capture before compaction
10. Handoff          → compact-safe skill if session gets long
```

**Context hygiene:** Steps 1-3 stay in one unbroken context window. Compaction mid-planning loses the thread.

---

## 12 Pi Packages

Every package earns its slot. No duplicates, no bloat.

| Package | What it does |
| --------- | ------------- |
| pi-hermes-memory | Persistent cross-session memory (SQLite FTS5), session search, learns from corrections |
| pi-observational-memory | Within-session memory that survives compaction — observations + reflections |
| pi-subagents | Delegate to child agents — review, scout, parallel work, chains |
| pi-lens | LSP diagnostics, linters, formatters, ast-grep rules on every edit |
| @hypabolic/pi-hypa | Summarize old tool outputs → 60-80% token savings on long sessions |
| @narumitw/pi-statusline | Model, tokens, cost, git branch in status bar |
| pi-intercom | Subagents can ask parent session when blocked — planner-worker coordination |
| pi-prompt-template-model | Slash commands auto-switch model + skills, then restore |
| pi-btw | Side questions without polluting main context |
| @juicesharp/rpiv-ask-user-question | Structured clarifying questions instead of guessing |
| pi-rewind | `/rewind` — checkpoint browser, diff preview, redo stack |
| pi-web-access | `web_search` + `fetch_content` tools — YouTube transcripts, PDFs, video analysis |

### Two Memory Layers (structural advantage)

```
pi-hermes-memory        → cross-session, SQLite FTS5, searchable
pi-observational-memory → within-session, survives compaction, observations + reflections
```

Together they solve the #1 agent problem: losing context across sessions AND across compaction boundaries. No other setup has this two-layer structure.

---

## 2 Custom Extensions

User-local TypeScript glue in `extensions/` — the Pi way: primitives, not features. Each reads from an existing store and owns no axis that a package already owns. Hot-reloadable with `/reload`. Full harmony contract in [`extensions/README.md`](extensions/README.md).

| Extension | Trigger | What it does |
| --------- | -------- | ------------ |
| `palette.ts` | `Ctrl+Shift+P` / `/palette` | Fuzzy command palette over **every** slash command (prompts + skills + extension commands). Discovers dynamically via `pi.getCommands()` — zero drift. Inserts `/<cmd>` into the editor for native dispatch. |
| `handoff.ts` | `/handoff [next task]` | Generates a self-contained `HANDOFF.md` from the session ledger and drafts a continuation prompt. **Deterministic — no LLM call**, so it never competes with the memory layers' background work. |

**Harmony audit** (3 fresh-context reviewers): 0 critical/major conflicts across all 12 packages + 2 extensions. Full reports in [`docs/audits/`](docs/audits/).

---

## 54 Skills

Skills are loaded into the system prompt on every session. Each one earns its place — no duplicates, no dead weight.

### Core Workflow (14) — Matt Pocock

The backbone of autonomous work. Each skill is a discipline, not a script.

| Skill | Triggers | What it does |
| ------- | --------- | ------------- |
| `brainstorming` | Before any creative work | Design before code — explore intent, propose approaches, get approval |
| `tdd` | Writing features or fixing bugs | Test first → see fail → implement → see pass → refactor |
| `diagnosing-bugs` | Something broken/throwing/failing/slow | 10-rung feedback loop ladder, ranked hypotheses, causal chain gate |
| `code-review` | Review a branch, PR, or WIP | Two-axis review: Standards + Spec, parallel subagents |
| `receiving-code-review` | When receiving feedback | Verify before implementing, push back with evidence if wrong |
| `verification-before-completion` | Before claiming done | Run test/lint/typecheck, read output, evidence before assertions |
| `commit` | Before git commits | Clean conventional commits |
| `github` | Issues, PRs, CI | gh CLI for issues, PRs, CI runs |
| `prototype` | Design question answerable by building | Throwaway prototype, answer the question, discard |
| `wayfinder` | Fog of war, loose idea | Turn loose idea into investigation tickets, resolve one at a time |
| `research` | Need evidence from primary sources | Background agent, cited markdown, 3+ sources agree → stop |
| `domain-modeling` | Domain terminology, ADRs | Build glossary, record architecture decisions |
| `codebase-design` | Module/interface design | Deep modules, seams, Ousterhout vocabulary |
| `resolving-merge-conflicts` | Git merge/rebase conflict | Resolve in-progress conflicts |

### Adapted Superpowers (3)

Cherry-picked from Superpowers, references removed, transitions point to Matt Pocock skills.

| Skill | What it does |
| ------- | ------------- |
| `brainstorming` | Design before code (adapted, overlaps with Matt Pocock's) |
| `verification-before-completion` | Evidence before claims (adapted) |
| `receiving-code-review` | Verify before implementing (adapted) |

### MongoDB (8) — Official

Auto-trigger when working with MongoDB.

`mongodb-schema-design` · `mongodb-search-and-ai` · `mongodb-query-optimizer` · `mongodb-connection` · `mongodb-mcp-setup` · `mongodb-natural-language-querying` · `mongodb-atlas-stream-processing` · `mongodb-mcp-cluster-per-project`

### Vercel/React (5)

Auto-trigger when building React or deploying to Vercel.

`vercel-react-best-practices` · `vercel-composition-patterns` · `deploy-to-vercel` · `vercel-optimize` · `web-design-guidelines`

### Bright Data (8) — Web Data

Auto-trigger for web tasks. Uses `bdata` CLI.

`search` · `scrape` · `discover-api` · `data-feeds` · `live-research` · `rag-pipeline` · `brightdata-cli` · `bright-data-best-practices`

### Octocode (5) — Code Research

Auto-trigger for evidence-first research.

`octocode` · `octocode-research` · `octocode-brainstorming` · `octocode-rfc-generator` · `octocode-roast`

### UI (3)

`frontend-design` · `impeccable` · `agent-browser`

### Python/OSS (3)

`uv` (use uv not pip) · `github` · `commit`

### Pi Extension Skills (8) — From Packages

Loaded automatically by installed packages.

`pi-intercom` · `pi-subagents` · `prompt-template-authoring` · `librarian` · `ast-grep` · `lsp-navigation` · `write-ast-grep-rule` · `write-tree-sitter-rule`

---

## External CLIs

| CLI | What it does | Free tier |
| ----- | ------------- | ----------- |
| `bdata` (Bright Data) | Web search, scrape, discover, structured data from 40+ platforms | 5,000 credits/month |
| `octocode` | Code research — AST search, cross-repo, PR deep-read, OQL | Free with GitHub auth |
| `gh` | GitHub CLI — issues, PRs, CI | Free |

---

## What We Deliberately Rejected (and why)

| Rejected | Why |
| ---------- | ----- |
| MCP bridge / pi-mcp-adapter | CLI + skills is the Pi way — no subprocess bloat |
| @octocodeai/pi-extension | Conflicts with 6 of our packages (duplicate tools) |
| Superpowers (as package) | Bootstrap injection overrides AGENTS.md workflow — took only 3 unique skills |
| pi-permission-system | Pi trusts the agent — no permission popups |
| monopi | Bundle installer — we curated individually |
| pi-simplify | code-review skill + subagents cover this |
| rpiv-todo | Pi intentionally has no todos |
| GBrain | Personal knowledge brain, not coding, MCP-based |
| octocode-awareness | Claude Code hooks, conflicts with pi-hermes-memory |
| 15 bloat skills | Non-coding, one-time, deprecated, or redundant |

---

## How AGENTS.md Works

The installer creates a single source of truth at `~/.ai/AGENTS.md` and wires all three agents to load it:

```
~/.ai/AGENTS.md  (real file, 124 lines)
     ↑              ↑              ↑
     symlink        @import        symlink
     Pi             Claude Code    Codex
```

- **Pi**: `~/.pi/agent/AGENTS.md` → symlink to `~/.ai/AGENTS.md`
- **Claude Code**: `~/.claude/CLAUDE.md` contains `@~/.ai/AGENTS.md`
- **Codex**: `~/.codex/AGENTS.md` → symlink to `~/.ai/AGENTS.md`

All three agents read the same 124-line workflow on every session start. One file, three agents, zero drift.

---

## Repository Structure

```
my-pi/
├── README.md                          This file
├── LICENSE                            MIT
├── config/
│   ├── settings.json                  12 packages, high thinking, tuned compaction
│   ├── agents.md                      Global AGENTS.md (124 lines, 10-step workflow)
│   ├── models.json                    Grove provider compat config
│   └── prompts/                       8 slash commands (the user interface)
│       ├── build.md                   /build → TDD
│       ├── debug.md                   /debug → diagnosing-bugs
│       ├── feature.md                 /feature → plan→build→review→ship chain
│       ├── fix.md                     /fix → debug→build→review→ship chain
│       ├── plan.md                    /plan → brainstorming
│       ├── research.md                /research → parallel fan-out
│       ├── review.md                  /review → code-review subagents
│       └── ship.md                    /ship → verify + commit + document
├── scripts/
│   ├── install.sh                     One-command installer
│   └── update.sh                      Update all packages + skills
└── skills/                            5 enhanced skills (cc10x audit wins)
    ├── brainstorming/                 Design before code
    ├── code-review/                   Two-axis review + friction scan + AI anti-patterns
    ├── diagnosing-bugs/               10-rung ladder + causal chain gate + loop cap
    ├── receiving-code-review/         Dispute needs proving command
    └── verification-before-completion/ Evidence before claims
```

The installer fetches the other 49 skills from their source repositories (Matt Pocock, MongoDB, Vercel, Bright Data, Octocode).

---

## Pi Ideology

From [Pi's blog](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/):

> Pi keeps the core small and pushes workflow-specific behavior into extensions, skills, prompt templates, and packages. It intentionally does not include built-in MCP, sub-agents, permission popups, plan mode, to-dos, or background bash.

This setup respects that. Every capability is an extension, skill, or CLI — never MCP bloat.

---

## Skill Selection Methodology

Every skill was compared prompt-by-prompt against alternatives:

- **TDD:** Matt Pocock vs Superpowers → Matt wins (leaner, seam concept, anti-patterns)
- **Debugging:** Matt Pocock vs Superpowers → Matt wins (feedback loop first, 10 loop types)
- **Code review:** Matt Pocock vs Superpowers → Matt wins (two-axis: standards + spec, Fowler smells)
- **Writing skills:** Matt Pocock vs Superpowers → Matt wins (information hierarchy, context load)
- **Planning:** Matt Pocock vs Superpowers → Matt wins (vertical tracer bullets vs micro-steps)

3 unique Superpowers skills were adapted (references removed, transitions point to Matt Pocock skills).

---

## License

MIT

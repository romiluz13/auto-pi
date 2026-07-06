# Pi Agent Capability-Gap Audit

**Scope:** `~/.pi/agent/` setup for capability gaps relative to Pi ideology + state of the art, **without introducing conflicts**.
**Priorities:** #1 HARMONY (no conflicts between moving parts), #2 Pi ideology (minimal core, extend via TS extensions/skills, primitives not features, self-extending).
**Mode:** Read-only. No files changed.

---

## 0. Current Setup (verified)

### Installed npm packages (`~/.pi/agent/npm/package.json` + `node_modules/`)
| Package | v | Domain |
|---|---|---|
| `@hypabolic/pi-hypa` | 0.1.6 | Tool-output compression (shell/file), recoverable evidence |
| `@juicesharp/rpiv-ask-user-question` | 1.20.0 | Structured questionnaire (typed options instead of free-form) |
| `@narumitw/pi-statusline` | 0.11.0 | Footer → info-rich statusline |
| `pi-btw` | 0.4.1 | Parallel side-conversations `/btw` |
| `pi-hermes-memory` | 0.7.23 | Persistent memory + session search + secret scanning + skills (SQLite FTS5) |
| `pi-intercom` | 0.6.0 | Inter-subagent messaging (broker.sock confirmed live) |
| `pi-lens` | 3.8.65 | Real-time LSP/lint/format/type/structural feedback |
| `pi-observational-memory` | 3.0.3 | Tiered compaction w/ observations + reflections |
| `pi-prompt-template-model` | 0.10.0 | Prompt-template model selector |
| `pi-rewind` | 0.5.0 | Per-tool checkpoint/rewind, `/rewind`, Esc+Esc |
| `pi-subagents` | 0.33.1 | Subagent delegation (chains, parallel, TUI clarification) |
| `pi-web-access` | 0.13.0 | Web search, fetch, GitHub clone, PDF/YouTube/video |

### Config highlights (`settings.json`)
- `defaultModel`: `FW-GLM-5.2` (GLM 5.2 Fireworks via grove-openai), `defaultThinkingLevel`: `xhigh`
- `observational-memory`: passive=false, reflect every 20k tokens, compact at 81k (ratio 0.4)
- `subagents.agentOverrides`: worker/planner/oracle/reviewer/researcher/context-builder/scout/delegate all `xhigh`
- `compaction`: enabled, reserveTokens 629146, keepRecent 50000
- `defaultProjectTrust`: `always`
- `theme`: `dark`
- No `extensions/` dir, no `themes/` dir, no custom TS extensions at all.

### Skills present
- `~/.pi/agent/skills/` (32): bright-data-best-practices, brightdata-cli, compact-safe, data-feeds, discover-api, find-skills, frontend-design, grill-with-docs, handoff, impeccable, implement, improve-codebase-architecture, live-research, mongodb-mcp-cluster-per-project, octocode (+ brainstorming/research/rfc-generator/roast), prototype, rag-pipeline, scrape, search, tdd, teach, triage, vercel-composition-patterns, vercel-react-best-practices, web-design-guidelines, writing-great-skills.
- `~/.agents/skills/` (47): adds agent-browser, code-review, codebase-design, commit, deploy-to-vercel, diagnosing-bugs, domain-modeling, git-guardrails-claude-code, github, grilling, mongodb-* (8), receiving-code-review, research, resolving-merge-conflicts, setup-matt-pocock-skills, setup-pre-commit, to-spec, to-tickets, uv, vercel-optimize, verification-before-completion, wayfinder, wizard.

### Prompts (`~/.pi/agent/prompts/`)
`build.md, debug.md, feature.md, fix.md, plan.md, research.md, review.md, ship.md` — slash-command prompts. `review.md` → `code-review` skill; `ship.md` → `verification-before-completion`.

### AGENTS.md
Single source of truth symlinked `~/.pi/agent/AGENTS.md → ~/.ai/AGENTS.md` (~190 lines, under the 200-line budget). Defines the 10-step autonomous workflow + subagent strategy + domain skill router.

---

## 1. Gap Inventory

For each candidate gap: **(a) conflict risk**, **(b) ideology alignment**, **(c) harmony-preserving add path**, then a **value/cost** score.

### G1 — Custom TypeScript extensions in `~/.pi/agent/extensions/` (currently ZERO)
- **(a) Conflict risk:** NONE. The `extensions/` dir does not exist; nothing occupies it. Installed npm packages live in `npm/node_modules/` and are surfaced via `settings.json.packages` — they do not touch `extensions/`. Custom extensions coexist by design (Pi's documented extension surface).
- **(b) Ideology:** STRONGLY ALIGNS. "Extend via TypeScript extensions" and "self-extending" are core Pi ideology. Zero custom extensions means the user has not exercised the *primary* extensibility primitive. This is the single highest-ideology gap.
- **(c) Harmony-preserving add:** Create `~/.pi/agent/extensions/` with a single thin `.ts` extension that wraps a *missing* primitive (see G2/G6 candidates). Do NOT replicate any npm package's responsibility. Treat extensions as user-local glue, never as a re-implementation of a published package (that would fork the moving parts → conflict).
- **Value/cost:** VALUE 10 / COST 2 → **5.0**

### G2 — Semantic git (`pi-sem`)
- **(a) Conflict risk:** LOW. No installed package owns git semantics. `pi-rewind` owns in-session checkpoints (per-tool snapshots, redo stack) — a *different* axis (working-tree rewind vs. semantic commit history). `pi-hermes-memory` secret-scanning touches git only to block secret commits, not to author/label commits. The `commit` skill is prose guidance, not an extension. Risk is only if `pi-sem` auto-commits; configure it proposal-only.
- **(b) Ideology:** ALIGNS. Turns the commit step (workflow step 7) from manual into a typed primitive; "primitives not features." Semantic labels feed memory consolidation (hermes) and review (lens) — composability.
- **(c) Harmony-preserving add:** Install `pi-sem` via `settings.json.packages` (npm). Wire its output to feed `pi-hermes-memory` (commit → memory event) and keep `pi-rewind` as the orthogonal working-tree undo. Keep `commit` skill as the human-facing wrapper; `pi-sem` is the engine under it. Verify it does NOT auto-push or auto-stage (proposal-only mode).
- **Value/cost:** VALUE 8 / COST 2 → **4.0**

### G3 — MCP adapter (`pi-mcp-adapter`)
- **(a) Conflict risk:** LOW–MEDIUM. No installed package provides MCP server hosting. Risk: `pi-web-access` already provides tool-fetching for web sources, and `pi-hermes-memory`/skills provide some tool surfaces — an MCP adapter must NOT replace those, only expose/bridge external MCP servers. Verify the adapter registers tools under a namespaced prefix to avoid name collisions with `pi-lens`/`pi-web-access` tool names.
- **(b) Ideology:** ALIGNS. MCP is the standard "primitive bridge to external capabilities" — exactly the self-extending primitive Pi favors over baking features in.
- **(c) Harmony-preserving add:** Install `pi-mcp-adapter` as an npm package. Configure ONE curated MCP server first (e.g., a filesystem or DB server the user already uses via mongodb skills). Namespace tools. Do NOT mount many servers at once — each is a moving part that must be harmony-checked individually.
- **Value/cost:** VALUE 8 / COST 3 → **2.7**

### G4 — Session handoff / archive
- **(a) Conflict risk:** MEDIUM. `pi-rewind` (checkpoints), `pi-observational-memory` (compaction w/ observations), `pi-hermes-memory` (session search via sessions.db), and the `handoff`/`compact-safe` skills ALL touch session continuity. A "session handoff/archive" package risks overlapping all four. MUST be scoped to *cross-session archival + resume doc generation* only — NOT compaction (owned by observational-memory), NOT search (owned by hermes), NOT rewind (owned by pi-rewind).
- **(b) Ideology:** ALIGNS (workflow step 10 "Handoff" is currently skill-only prose; a primitive would codify it). But the existing 4-way coverage means marginal ideology value is lower than G1/G2.
- **(c) Harmony-preserving add:** Prefer a **thin custom extension in `extensions/`** (G1) that emits a handoff doc from `pi-hermes-memory` session records + `pi-observational-memory` last observation, rather than a new npm package — to avoid a 5th overlapping moving part. If a published package is used, verify it reads (not duplicates) the hermes/observational stores.
- **Value/cost:** VALUE 6 / COST 3 → **2.0**

### G5 — Agent modes (code / architect / debug / ask / review)
- **(a) Conflict risk:** MEDIUM. `pi-subagents` already defines agent roles (worker/planner/oracle/reviewer/researcher/context-builder/scout/delegate) in `subagents.agentOverrides`, and prompts cover build/debug/feature/fix/plan/research/review/ship. A separate "agent modes" package could collide with both the subagent role taxonomy and the prompt set. Risk: two competing role vocabularies → the model gets inconsistent role cues.
- **(b) Ideology:** NEUTRAL–ALIGNS. "Agent modes" as a top-level switch can be a primitive, but Pi ideology prefers composing from existing subagent roles + prompts rather than a new mode FSM. The user already has the building blocks.
- **(c) Harmony-preserving add:** Do NOT add a modes package that redefines roles. Instead, add a **thin extension that maps the existing `pi-subagents` roles to a single `/mode <role>` command** that sets the default subagent role + thinking level + prompt. Reuses `agentOverrides` as the single source of truth. Zero new role vocabulary.
- **Value/cost:** VALUE 6 / COST 3 → **2.0**

### G6 — Leader-key command palette
- **(a) Conflict risk:** LOW. No installed package owns command dispatch / keybinding palette. `pi-statusline` owns the footer render only. Risk: keybinding collisions with `pi-rewind` (Esc+Esc) and `pi-btw` (`/btw`) — must reserve those.
- **(b) Ideology:** ALIGNS. A leader-key palette is a navigation/dispatch primitive (not a feature), and it makes the existing prompts + skills discoverable — amplifies the self-extending surface rather than adding content.
- **(c) Harmony-preserving add:** Install as npm package IF it supports reserved-key allowlist; else implement as a small `extensions/` TS file reading `prompts/*.md` + `skills/*/` to build the menu dynamically (stays in sync with new prompts/skills automatically — no manual registry = no drift = harmony).
- **Value/cost:** VALUE 7 / COST 3 → **2.3**

### G7 — Telescope-style fuzzy finder
- **(a) Conflict risk:** LOW. No installed package does fuzzy find. Could share the palette surface with G6 — if both are added, pick ONE that subsumes the other to avoid two finders competing for the same keybinding/real-estate. 
- **(b) Ideology:** ALIGNS (navigation primitive). But lower marginal value if G6 palette already lists everything.
- **(c) Harmony-preserving add:** Bundle with G6 as one extension (palette = fuzzy finder over prompts/skills/sessions). Do NOT add as a separate package.
- **Value/cost:** VALUE 5 / COST 3 → **1.7**

### G8 — Live observability dashboard (`pi-observability`)
- **(a) Conflict risk:** MEDIUM. `pi-statusline` owns the footer; `pi-lens` already streams real-time code feedback; `pi-observational-memory` streams observation/reflection events. A dashboard risks (i) TUI real-estate fight with statusline, (ii) duplicating lens's live feedback panel, (iii) re-rendering observational-memory's event stream. Must be a *read-only aggregator view*, not a second feedback channel.
- **(b) Ideology:** ALIGNS weakly — a dashboard is more "feature" than "primitive," and Pi ideology leans primitive. Marginal value is observability-as-a-pane rather than new capability.
- **(c) Harmony-preserving add:** If added, must subscribe to (not re-emit) events from lens/observational-memory/hermes and render in a dedicated pane (not the statusline). Verify it does NOT spawn its own LSP/lint loop (lens owns that). Given medium conflict + feature-not-primitive lean, **defer** unless the user explicitly wants a pane.
- **Value/cost:** VALUE 5 / COST 4 → **1.25**

### G9 — Dynamic multi-subagent fan-out at scale (`pi-dynamic-workflows`)
- **(a) Conflict risk:** HIGH. `pi-subagents` (delegation, chains, parallel, TUI clarification), `pi-btw` (parallel side convos), and `pi-intercom` (inter-subagent messaging) together already implement multi-subagent fan-out. A "dynamic workflows" package almost certainly re-implements delegation/orchestration → **direct conflict with pi-subagents**. This is the most conflict-prone gap.
- **(b) Ideology:** ALIGNS in spirit (primitives for orchestration), but conflicts with the installed primitive set. Per the user's #1 priority (harmony), **EXCLUDE unless it is confirmed to compose on top of pi-subagents rather than replace it.**
- **(c) Harmony-preserving add:** Do NOT install as a competing orchestrator. If scale is the real need (the AGENTS.md already describes fan-out patterns), the harmony-preserving path is to extend `pi-subagents` config / add a thin `extensions/` orchestrator that calls the existing subagent primitive — not a parallel package.
- **Value/cost:** VALUE 7 / COST 6 (high conflict) → **1.2** — and **EXCLUDED from recommendations** pending proof of composition.

### G10 — Team-mode RPC orchestration
- **(a) Conflict risk:** HIGH. Overlaps `pi-intercom` (RPC-ish messaging between agents) + `pi-subagents` (orchestration). A second RPC channel risks two message buses (broker.sock vs. team-mode transport) → messages get split across buses → broken coordination.
- **(b) Ideology:** Aligns only if team-mode is the *transport* under intercom. As a parallel bus it violates harmony.
- **(c) Harmony-preserving add:** EXCLUDE. If multi-agent RPC at scale is needed, extend `pi-intercom` (the live broker) rather than introduce a second transport.
- **Value/cost:** VALUE 6 / COST 6 → **1.0** — **EXCLUDED**.

### G11 — Custom themes
- **(a) Conflict risk:** LOW. `theme: dark` is a single settings field; no `themes/` dir exists. `pi-statusline` colors the footer — a custom theme must not override statusline's color contract (verify statusline reads theme tokens, not hardcoded colors).
- **(b) Ideology:** NEUTRAL. Cosmetic; not a capability. Low ideology value.
- **(c) Harmony-preserving add:** Add a `themes/` dir only if the user wants a personal palette; ensure statusline + lens ANSI colors derive from theme tokens. Low priority.
- **Value/cost:** VALUE 3 / COST 2 → **1.5**

### G12 — Permission / safety gates
- **(a) Conflict risk:** MEDIUM. `pi-hermes-memory` already ships **secret scanning**; `defaultProjectTrust: always` + `trust.json` already define a trust model; `pi-hypa` wraps shell/file tools (a soft safety layer); the `git-guardrails-claude-code` skill covers git safety. A new permission-gate package risks (i) double-prompting on the same command (hermes secret-scan + new gate), (ii) fighting `defaultProjectTrust: always` (which the user deliberately set — a gate package that overrides to a stricter default would silently contradict user intent).
- **(b) Ideology:** ALIGNS (gates are primitives), but the user explicitly chose `always` trust — adding strict gates may violate *user intent* even if ideology-fine.
- **(c) Harmony-preserving add:** Only as a **non-blocking advisory gate** layered on hermes secret-scanning (de-duplicate: hermes owns secret-detection, the gate owns *approval flow* for high-risk tool classes like `bash` destructive). Must respect `defaultProjectTrust: always` unless per-project overridden. Defer until the user signals wanting tighter trust.
- **Value/cost:** VALUE 5 / COST 4 → **1.25**

---

## 2. Ranked Top-5 (by value/cost, conflicts excluded)

| # | Gap | Score | Conflict | Why it wins |
|---|---|---|---|---|
| 1 | **G1 — Custom TS extensions dir** (zero today) | 5.0 | None | Highest-ideology gap; unblocks G2/G4/G5/G6 harmony paths. Prerequisite, not a feature. |
| 2 | **G2 — Semantic git (`pi-sem`)** | 4.0 | Low | Orthogonal to pi-rewind (history vs working-tree); composes with hermes memory + commit skill. Clean primitive. |
| 3 | **G6 — Leader-key command palette** | 2.3 | Low | Makes existing prompts/skills discoverable; amplifies self-extending surface. Best built as a dynamic `extensions/` file over `prompts/`+`skills/` (no registry drift). |
| 4 | **G3 — MCP adapter (`pi-mcp-adapter`)** | 2.7 | Low–Med | Standard primitive bridge to external tools; ideologically clean. Add ONE namespaced server first. (Ranked below palette only because each MCP server is its own harmony check — higher ongoing cost.) |
| 5 | **G5 — Agent modes** (via thin `/mode` extension over existing `pi-subagents` roles) | 2.0 | Med (managed) | Reuses `agentOverrides` as single source of truth; no new role vocabulary. Must be the wrapper form, NOT a competing modes package. |

**Tie-broken to a clean 5:** G4 (session handoff, 2.0) is the runner-up — implement as an `extensions/` doc-emitter over hermes+observational-memory rather than a 5th overlapping npm package.

---

## 3. Explicitly EXCLUDED (would conflict with existing packages — per task rules)

- **G9 — `pi-dynamic-workflows`**: conflicts with `pi-subagents` + `pi-btw` + `pi-intercom` (re-implements fan-out). EXCLUDE unless proven to compose *on top of* pi-subagents.
- **G10 — Team-mode RPC orchestration**: second message bus conflicts with `pi-intercom` broker.sock. EXCLUDE; extend intercom instead.
- **G8 — `pi-observability` dashboard**: medium conflict with `pi-statusline` (real-estate) + `pi-lens` (live feedback) + `pi-observational-memory` (event stream). DEFER; feature-leaning, not primitive.
- **G12 — Permission/safety gates**: conflicts with hermes secret-scanning + user's explicit `defaultProjectTrust: always`. DEFER unless user wants stricter trust.
- **G11 — Custom themes**: low value, cosmetic. DEFER.
- **G7 — Telescope fuzzy finder**: fold into G6 (one finder, not two). Do not add separately.

---

## 4. Harmony guardrails for any add

1. **One moving part per axis.** Each capability axis (memory, search, compaction, rewind, statusline, feedback, subagents, messaging, web, compression) already has an owner. Any new package must declare which axis it owns and not touch others.
2. **Extensions over packages for glue.** User-local orchestration/doc/mode glue belongs in `extensions/*.ts` reading from existing stores — never a re-implementation.
3. **Single source of truth for roles.** `subagents.agentOverrides` is the role vocabulary; `prompts/*.md` is the command surface. New commands/modes must *reference* these, not duplicate.
4. **Read, don't duplicate, event streams.** Observability/dashboard/gate packages must subscribe to hermes/observational-memory/lens events, not re-emit.
5. **Trust settings are user intent.** No package may silently override `defaultProjectTrust`.
6. **Verify before install.** Each npm package added must be checked for tool-name/keybinding/event-channel collisions with the 12 installed packages before enabling.

---

## 5. Method / evidence

- Read: `settings.json`, `models.json`, `npm/package.json`, `ls skills/`, `ls prompts/`, `ls ~/.agents/skills/`, `ls ~/.pi/agent/` (confirmed no `extensions/`, no `themes/`), `cat trust.json`, `ls intercom/` (broker live), `ls sessions/`, `ls pi-hermes-memory/` + `projects-memory/`.
- Per-package `description`/`keywords`/`version` pulled from each `node_modules/<pkg>/package.json` to ground conflict analysis in actual package domains (not assumptions).
- No files modified; read-only audit. `git` not applicable (no repo at audit path).

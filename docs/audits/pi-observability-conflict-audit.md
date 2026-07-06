# Conflict Audit: @spences10/pi-observability vs existing Pi setup

Candidate: `/tmp/pi-github-repos/spences10/my-pi/packages/pi-observability` (v0.0.14)
Existing setup: `~/.pi/agent/` (12 packages, settings.json)

All claims below are backed by `file:line` evidence. Read-only audit; no files were modified.

---

## 1. DOES IT TOUCH THE TUI/FOOTER?

**No. It does not touch the footer.**

- Searched all `.ts` in `src/` for `setFooter|setStatus|setHeader|setWidget|setWorkingIndicator` → **zero matches** (`grep -rnE` over `src/`, no output).
- The TUI dashboard is rendered via `show_modal` from `@spences10/pi-tui-modal` (`src/tui-dashboard.ts:14`, `:268`) — an **overlay modal**, not the footer slot. Modal is opened on-demand by the `/observability tui` command, not on every render.
- User-facing messages use `ctx.ui.notify(...)` (`src/index.ts:426,439,450,452`) — transient toasts, not footer content.
- pi-statusline owns the footer via `ctx.ui.setFooter(...)` (`@narumitw/pi-statusline/src/statusline.ts:48-64`) and the `statusline` setStatus key (`:46`). Observability never writes to either.

**Verdict: no conflict with pi-statusline. Safe.**

---

## 2. EVENT HOOK COLLISIONS

Events hooked by observability (`src/index.ts:486-503`, via the `observe()` helper at `:471-481` which only calls `emit()` → `queue.push()`):

| Event | Observability | lens | observational-memory | hermes |
|---|---|---|---|---|
| session_start | ✓ `:484` | ✓ `dist/index.js:761` | — (runtime init) | ✓ `index.ts:141` |
| before_agent_start | ✓ `:486` | — | ✓ `consolidation-trigger.ts:103` | ✓ `index.ts:174` |
| agent_end | ✓ `:487` | ✓ `dist/index.js:1594` | ✓ `compaction-trigger.ts:15` | — |
| turn_start | ✓ `:488` | ✓ `dist/index.js:1590` | — | — |
| turn_end | ✓ `:489` | ✓ `dist/index.js:1623` | ✓ `consolidation-trigger.ts:104`, `correction-detector.ts:150` | ✓ `background-review.ts:139` |
| message_start | ✓ `:490` | — | — | — |
| message_end | ✓ `:491` | — | — | ✓ `index.ts:224`, `background-review.ts:133`, `correction-detector.ts:140`, `session-flush.ts:22` |
| tool_call | ✓ `:492` | ✓ `dist/index.js:896` | — | — |
| tool_result | ✓ `:493` | ✓ `dist/index.js:1544` | — | — |
| tool_execution_start | ✓ `:494` | — | — | — |
| tool_execution_update | ✓ `:495` | — | — | — |
| tool_execution_end | ✓ `:496` | — | — | — |
| before_provider_request | ✓ `:498` | — | — | — |
| after_provider_response | ✓ `:499` | — | — | — |
| session_compact | ✓ `:500` | — | ✓ `compaction-hook.ts:16` (session_before_compact) | ✓ `session-flush.ts:56` (session_before_compact) |
| session_tree | ✓ `:501` | — | — | — |
| model_select | ✓ `:505` | — | — | — |
| session_shutdown | ✓ `:511` | ✓ `dist/index.js:1696` | — (via compaction-hook) | ✓ `index.ts:246`, `session-flush.ts:62` |

**Critical distinction: observability SUBSCRIBES read-only and forwards to a browser SSE stream. It does NOT re-emit, re-process, or mutate.**

- `observe()` (`src/index.ts:471-481`) wraps `pi.on(name, (event) => emit(obs_type, event))`. `emit()` (`:464-470`) calls `queue.push(create_event_envelope(...))`. The queue (`EventQueue`, `:223-262`) batches and POSTs to `http://127.0.0.1:43190/events` (`:240-244`). No return value, no state mutation, no side effects on the agent.
- For `before_agent_start` specifically: hermes returns `{ systemPrompt: ... }` to inject memory context (`hermes index.ts:174-181`). Observability's `before_agent_start` handler returns `void` (just `emit`) — it does NOT inject or modify the system prompt. No collision with hermes's prompt injection.
- For `session_compact` / `session_before_compact`: observability hooks `session_compact` (a different event name than observational-memory/hermes which hook `session_before_compact`). Even if same event, observability only records — it does not trigger compaction or modify the compacted context.

**Verdict: complementary, not conflicting. Read-only forwarding alongside existing read-write hooks is safe — Pi runs same-event handlers sequentially and each is independent.**

---

## 3. DOES IT SPAWN ITS OWN LSP/LINT LOOP?

**No.**

- Searched `src/` for `lsp|lint|diagnostic|LanguageServer` → **zero matches** (only `execFileSync` in `port-owner.ts:1` for `lsof`/`ss` port detection, and `spawn` in `index.ts:2` for `open`/`xdg-open` browser launch).
- No LSP client, no lint runner, no file watcher, no `tsserver`/`biome`/`eslint` invocation.
- Observability only **streams events that lens already produces** (`tool_call`, `tool_result`, `turn_*`, `agent_end`). It does not generate diagnostics.

**Verdict: no conflict with pi-lens. Lens owns the LSP/lint axis; observability is downstream-only.**

---

## 4. TOOL/COMMAND COLLISIONS

- Observability registers **zero tools** (`grep -rnE "registerTool" src/` → no output).
- Observability registers **one command**: `/observability` (`src/index.ts:416`).
- Existing commands in the setup (from grep over all installed packages): `lens-toggle`, `lens-context-toggle`, `lens-widget-toggle`, `lens-booboo`, `lens-tdi`, `lens-health`, `lens-tools`, `lens-allow-edit` (lens); `om:status`, `om:view` (observational-memory); `memory-consolidate`, `memory-index-sessions`, `memory-insights`, `memory-interview`, `memory-skills`, `memory-switch-project`, `memory-sync-markdown`, `memory-preview-context`, `learn-memory-tool` (hermes); `hypa` (pi-hypa); `chain-prompts`, `prompt-tool` (pi-prompt-template-model); `rewind` (pi-rewind); `run`, `chain`, `run-chain`, `parallel`, `subagent-cost`, `subagents-doctor`, `subagents-fleet`, `subagents-models`, `subagents-profiles`, `subagents-load-profile`, `subagents-refresh-provider-models` (pi-subagents).
- No `/observability` command exists in the current setup. No collision.

**Verdict: no tool or command name collisions.**

---

## 5. STORAGE

- Observability creates its own SQLite DB at `~/.pi/agent/observability.db` (`src/options.ts:25-27`, `src/index.ts:80`; default `${homedir()}/.pi/agent/observability.db`). Configurable via `MY_PI_OBSERVABILITY_DB`.
- Schema in `src/schema.sql`, prepared statements in `src/db.ts:16-83`. Tables: `events`, `sessions`. Uses `node:sqlite` `DatabaseSync` with WAL mode (`db.ts:11`).
- Does **NOT** touch:
  - hermes store: `~/.pi/agent/pi-hermes-memory/` (`hermes index.ts:42`, `DatabaseManager` at `store/db.js`). Different directory, different DB file.
  - observational-memory: uses `appendEntry` (per task description), no own DB. Observability does not call appendEntry or touch observational-memory's storage.
  - No shared SQLite file, no shared table names.

**Verdict: separate storage. No conflict with hermes or observational-memory.**

---

## 6. NETWORK/PORT

- Starts a local HTTP server on `127.0.0.1:43190` (default) (`src/server.ts:152-165`, `src/options.ts:18-19`).
- Routes: `/health`, `/` (dashboard HTML), `/assets/*`, `/fonts/*`, `/events` (POST ingest), `/sessions`, `/sessions/:id/events`, `/sessions/:id/trace`, `/events/search`, `/events/stream` (SSE) (`src/server.ts:72-195`).
- Port configurable via `MY_PI_OBSERVABILITY_PORT` (`options.ts:17-19`).
- **Auto-start behavior**: when `auto_start_server` is true (default when no custom URL configured — `index.ts:103`), `ensure_local_server()` is called on `session_start` (`index.ts:489-490`) and on `/observability` command invocation (`index.ts:419`). It checks `/health` first and only starts if not already running (`index.ts:83-99`).
- `EADDRINUSE` is handled gracefully: logs port owner via `lsof`/`ss` (`server.ts:144-156`, `port-owner.ts`), and with `throw_on_listen_error: false` (set by `ensure_local_server` at `index.ts:95`) it does **not** crash the agent — it silently fails to start the server.
- **No other Pi package in the setup runs a local HTTP server.** Lens uses LSP over stdio; hermes/observational use SQLite files only. No port conflict.

**Verdict: port 43190 is free in this setup. No conflict. The auto-start is a new background HTTP server in the agent process — a behavior to be aware of, not a collision.**

---

## 7. REDACTION

**Yes — verified, not assumed.**

`src/redact.ts`:
- `SECRET_KEY_RE` (`:2-3`): matches keys containing `api_key`, `authorization`, `bearer`, `client_secret`, `cookie`, `password`, `secret`, `token` (case-insensitive).
- `SECRET_VALUE_PATTERNS` (`:4-7`): JWT-shaped tokens (`xxxx.yyyy.zzzz`, 24+16+16 chars), and prefixed tokens (`sk-`, `pk-`, `ghp-`, `github_pat-`, `glpat-`, `xox[baprs]-` with 20+ chars).
- `redact_value()` (`:17-30`): recursively walks objects/arrays; any key matching `SECRET_KEY_RE` → replaced with `'[REDACTED]'`; string values run through `redact_text()` which applies `SECRET_VALUE_PATTERNS`.
- Applied in `create_event_envelope()` (`index.ts:230-238`): `payload: truncate_json_value(redact_value(safe_payload), config.max_payload_bytes)`. Every event payload is redacted before queuing.
- Additionally, by default `raw_payloads` is `false` (`index.ts:104`), so payloads go through `summarize_payload()` (`:160-218`) first — which truncates strings and replaces nested objects with key summaries — before redaction. Double layer of protection.

**Verdict: redaction is implemented and applied on the emit path. Verified.**

---

## 8. FINAL VERDICT

**INSTALL CLEAN.**

No fatal collisions found. The package is a read-only event forwarder + local web/TUI dashboard. It:
- Does not touch the footer (pi-statusline owns it).
- Does not spawn an LSP/lint loop (pi-lens owns it).
- Does not mutate agent state, system prompts, or memory (hermes/observational own those axes).
- Does not collide on tool names, command names, or storage paths.
- Redacts secrets before streaming.
- Uses port 43190 (free in this setup; configurable).

**Optional config (not required for install):**
- To use an external/centralized server instead of auto-starting a local one: set `observability-url` flag or `MY_PI_OBSERVABILITY_URL` env. This disables auto-start (`index.ts:103`).
- To change the port: `MY_PI_OBSERVABILITY_PORT=<port>`.
- To disable entirely for a session: `observability-disable` flag or `MY_PI_OBSERVABILITY_DISABLE=1`.

**Install command:**
```bash
# Add to ~/.pi/agent/settings.json packages array:
"npm:@spences10/pi-observability"
# Then:
cd ~/.pi/agent && mise exec node@24 -- npm install
# Or whichever install flow the agent uses for npm: packages.
```

**Behavioral note (not a blocker):** On first `session_start` after install, the extension auto-starts a background HTTP server on `127.0.0.1:43190` serving a web dashboard + SSE stream. This is by design (default `auto_start_server: true`). The server is in-process, binds loopback only, and fails gracefully if the port is taken. If undesired, set `MY_PI_OBSERVABILITY_URL` to point at an externally-run `pi-observability-server` (the package ships a `bin` entry, `package.json:14`).

---

## Evidence index

- Candidate entry: `src/index.ts` (full read)
- Server: `src/server.ts` (full read)
- Redaction: `src/redact.ts` (full read)
- TUI dashboard: `src/tui-dashboard.ts` (full read)
- Options: `src/options.ts`, `src/server-options.ts` (full read)
- DB: `src/db.ts` (full read)
- Port owner: `src/port-owner.ts` (full read)
- Assets: `src/assets.ts` (full read)
- Types: `src/types.ts` (full read)
- package.json (full read)
- Existing: `@narumitw/pi-statusline/src/statusline.ts` (full read)
- Existing: `pi-observational-memory/src/index.ts` + `hooks/*.ts` + `commands/*.ts` + `tools/*.ts` (grep + read)
- Existing: `pi-hermes-memory/src/index.ts` + `handlers/*.ts` (grep + read)
- Existing: `pi-lens/dist/index.js` (grep + targeted read at `:700-760`)
- Existing: `~/.pi/agent/settings.json` (full read)

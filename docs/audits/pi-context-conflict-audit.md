# pi-context Conflict Audit — `@spences10/pi-context` v0.1.4

Date: 2026-07-06
Audited against: `~/.pi/agent/` (12 packages: pi-hypa, rpiv-ask-user-question, pi-statusline, pi-btw, pi-hermes-memory, pi-intercom, pi-lens, pi-observational-memory, pi-prompt-template-model, pi-rewind, pi-subagents, pi-web-access)

---

## 1. TOOL NAME COLLISIONS — NONE

### Tools pi-context registers (6 total)

| Tool name | Source file:line |
|---|---|
| `context_search` | `src/tools/search.ts:9` |
| `context_get` | `src/tools/get.ts:9` |
| `context_export` | `src/tools/export.ts:14` |
| `context_list` | `src/tools/list.ts:9` |
| `context_stats` | `src/tools/stats.ts:9` |
| `context_purge` | `src/tools/purge.ts:9` |

All six are prefixed `context_`. Registration entry point: `src/tools/index.ts:8-15` (`register_context_tools`), called from `src/index.ts:10`.

### Existing tools in the protected setup (no overlap)

| Extension | Tools registered |
|---|---|
| hypa | `hypa_shell`, `hypa_read`, `hypa_grep`, `hypa_find`, `hypa_ls` (`extensions/tools.ts:131-227`) |
| lens | `ast_grep_search`, `ast_grep_replace`, `ast_grep_outline`, `ast_grep_dump`, `ast_dump`, `lens_diagnostics`, `lsp_diagnostics`, `lsp_navigation`, `module_report`, `read_symbol`, `read_enclosing` (`dist/index.js:~570-590`) |
| hermes | `memory`, `memory_search`, `session_search`, `skill_manage` (`src/index.ts:141-168`) |
| observational-memory | `recall` (`src/tools/recall-observation.ts:16,439`) |
| web-access | `web_search`, `fetch_content`, `get_search_content` (`index.ts:1241,1789,2040`) |
| ask-user-question | `ask_user_question` (`ask-user-question.ts:61`) |
| prompt-template-model | `run-prompt` (`tool-manager.ts:56`) |
| Pi builtins | `read`, `bash`, `grep`, `find`, `ls`, `edit`, `write`, `subagent`, `wait`, `intercom` |

**Verdict: ZERO tool name collisions.** No `context_*` name appears in any existing extension.

---

## 2. EVENT HOOK COLLISIONS — ONE LOW-RISK INTERACTION

### Events pi-context hooks (3 total)

| Event | Handler location | Return value |
|---|---|---|
| `session_start` | `src/lifecycle.ts:18` | `undefined` (no return — calls `set_context_sidecar_enabled(true)` + `get_context_store(scope).cleanup()`) |
| `session_shutdown` | `src/lifecycle.ts:24` | `undefined` (cleanup + `set_context_sidecar_enabled(false)`) |
| `tool_result` | `src/lifecycle.ts:31` | `{ content: [{ type: 'text', text: stored.receipt }] }` ONLY when `should_index_text(text)` is true (>24KB or >300 lines); otherwise `undefined` |

### Collision analysis per event

**`session_start` — ADDITIVE, no conflict.**
Also hooked by: hypa (replace-mode only, `extensions/index.ts:30`), lens (`dist/index.js:~980`), hermes (`src/index.ts:121`), pi-rewind, pi-web-access, pi-btw, pi-statusline.
pi-context's handler is pure side-effect: enables the sidecar and runs retention cleanup. It does NOT modify the event object, does NOT return a systemPrompt override, does NOT block. No destructive interaction with any co-handler.

**`session_shutdown` — ADDITIVE, no conflict.**
Also hooked by: hermes (`src/index.ts:233` — closes SQLite, indexes session), pi-rewind, pi-web-access, pi-btw, pi-statusline.
pi-context's handler runs its own cleanup and disables the sidecar. No return value. Does NOT touch hermes's SQLite (`pi-hermes-memory/sessions.db`). Hermetic.

**`tool_result` — LOW RISK, complementary in practice.**
Also hooked by: lens (`dist/index.js:1544`).

Lens's `tool_result` handler:
- Processes ONLY `write`, `edit`, `lsp_navigation` tools (returns early for all others).
- Returns `{ content: [...event.content, { type: "text", text: output }] }` — APPENDS diagnostics to existing content (`runtime-tool-result.js:485,506`).
- The explicit `[...event.content, ...]` spread pattern strongly implies Pi REPLACES content with the handler's return (not merge).

pi-context's `tool_result` handler:
- Processes ALL tools EXCEPT `context_*` and `team` (`context-scope.ts:31-34`).
- Returns `{ content: [{ type: 'text', text: stored.receipt }] }` — REPLACES content with a receipt, but ONLY when `should_index_text(text)` returns true (>24KB or >300 lines; `text.ts:7-8,17-27`).
- For small outputs: returns `undefined` (no override).

**The theoretical conflict:** If pi-context is loaded AFTER lens (appended to packages array) and a `write`/`edit` produces output >24KB/300 lines, both handlers would return content. Pi's last-return-wins behavior would replace lens's diagnostics with pi-context's receipt, losing the diagnostics.

**Why this is LOW risk in practice:**
- `write`/`edit` tool results are typically tiny ("File written successfully", "Edited N lines"). They almost never exceed 24KB/300 lines.
- For `bash`/`read`/`grep`/`find`/`ls` (the tools that DO produce large output), lens returns `undefined` (early-exits), so only pi-context returns content. No conflict.
- The intersection (large write/edit output that triggers both) is vanishingly rare.

**Mitigation if paranoid:** Place `@spences10/pi-context` BEFORE `pi-lens` in the packages array. Then lens runs after pi-context and appends diagnostics to whatever content exists (including a receipt). Order in `settings.json` packages array determines handler execution order.

---

## 3. STORAGE COLLISIONS — NONE

### Where pi-context writes

**SQLite DB path:** `~/.pi/agent/context.db` (`src/store/registry.ts:12-20`).
```typescript
export function default_context_db_path(): string {
    if (process.env.MY_PI_CONTEXT_DB) return process.env.MY_PI_CONTEXT_DB;
    const agent_dir = process.env.PI_CODING_AGENT_DIR
        ?? join(homedir(), '.pi', 'agent');
    return join(agent_dir, 'context.db');
}
```

Schema (`src/schema.sql`): tables `context_sources`, `context_chunks`, `context_chunks_fts` (FTS5 virtual table). Completely independent schema.

### What it does NOT touch

| Protected storage | Path | Touched? |
|---|---|---|
| Hermes SQLite | `~/.pi/agent/pi-hermes-memory/sessions.db` | NO — separate directory, separate DB file |
| Hermes markdown | `~/.pi/agent/pi-hermes-memory/MEMORY.md`, `USER.md`, `failures.md` | NO |
| Hermes skills | `~/.pi/agent/pi-hermes-memory/skills/` | NO |
| Loop engine | `~/.pi/workflows/` | NO |
| Observational ledger | (in-memory / pi-observational-memory internal) | NO |
| Lens state | `~/.pi-lens/`, `.pi-lens/` project dirs | NO |
| Hypa temp | `$(tmpdir)/pi-hypa-*` | NO |

**No shared SQLite. No shared directory. No file-level collision.** The DB file `context.db` is new and does not currently exist in `~/.pi/agent/`.

---

## 4. COMPRESS vs STORE-FOR-RETRIEVAL — NEW AXIS, COMPLEMENTARY

### Mechanism (cited from code)

pi-context's `tool_result` handler (`src/lifecycle.ts:31-57`):
1. Extracts text from `event.content` text items.
2. Checks `should_index_text(text)` — returns true only if `>24KB` or `>300 lines` (`text.ts:17-27`).
3. If large: stores full text in SQLite (`ContextStore.store()` in `src/store.ts:148-227`), chunks it, indexes with FTS5.
4. Returns a RECEIPT (short summary with source_id, size, preview, next-action hints) — `summarize_source()` in `text.ts:236-272`.
5. The receipt REPLACES the oversized content in-context. The model can later retrieve via `context_search` / `context_get` / `context_export`.

### Hypa's mechanism (for comparison)

Hypa does TWO things:
1. **Command rewriting** (`extensions/index.ts:38-67`): hooks `tool_call` for `bash`, rewrites the command via the Hypa CLI. This is a SAFETY/policy axis, not compression.
2. **Compressed tool wrappers** (`extensions/tools.ts:131-227`): `hypa_shell`, `hypa_read`, etc. run commands through `hypa -c` which compresses output. The compressed output is returned in-context. Truncation saves full output to a temp file (`tools.ts:159-175`).

### Key distinction

| Axis | Owner | What it does | Where output lives |
|---|---|---|---|
| Command rewriting / safety | hypa | Rewrites bash commands before execution | N/A (modifies input) |
| In-context compression | hypa | Compresses output via `hypa -c` CLI | In-context (compressed) |
| Out-of-context store + retrieval | **pi-context** | Stores oversized output in SQLite, returns receipt | Out-of-context (SQLite) |

**pi-context does NOT rewrite tool output in-context.** It does NOT compress. It stores the raw oversized output in SQLite and returns a receipt pointer. This is a **new, complementary axis** — it catches what hypa's compression doesn't fully reduce.

**Layered behavior when both are installed:**
- If agent uses `hypa_shell`: hypa compresses → if compressed output is still >24KB/300 lines → pi-context stores it and returns a receipt. Two-stage: compress then store.
- If agent uses builtin `bash`: hypa rewrites the command (safety) → bash runs → raw output → if >24KB/300 lines → pi-context stores and receipts. Complementary: safety + overflow.

**No functional overlap. No conflict.**

---

## 5. EVENT STREAM DUPLICATION — NONE

pi-context does NOT:
- Re-emit events (`pi.emit` / `pi.events.emit` — not called anywhere in the codebase).
- Subscribe to lens, hermes, or observational-memory internal event streams.
- Hook `before_agent_start` (hermes's prompt injection axis).
- Hook `session_before_compact` (hermes + observational-memory's compaction axis).
- Hook `tool_call` (hypa + lens's tool-call interception axis).
- Hook `turn_start` / `turn_end` / `agent_start` / `agent_end` (lens + observational-memory + pi-rewind's turn lifecycle).
- Hook `resources_discover` (lens + hermes's skill discovery axis).

It subscribes to exactly 3 events (`session_start`, `session_shutdown`, `tool_result`) as a **read-only consumer** that produces side-effects (SQLite storage + content replacement). It does not feed back into any other extension's event flow.

---

## 6. COMMAND COLLISIONS — NONE

### Commands pi-context registers (2 total)

| Command | Source file:line |
|---|---|
| `/context` | `src/commands/context-command.ts:13` |
| `/context-stats` | `src/commands/context-command.ts:76` |

### Existing commands in the protected setup

| Extension | Commands |
|---|---|
| hypa | `/hypa` |
| lens | `/lens-toggle`, `/lens-context-toggle`, `/lens-widget-toggle`, `/lens-booboo`, `/lens-tdi`, `/lens-health`, `/lens-tools`, `/lens-allow-edit` |
| hermes | `/memory-insights`, `/memory-skills`, `/memory-consolidate`, `/memory-interview`, `/memory-switch-project`, `/index-sessions`, `/learn-memory`, `/sync-markdown-memories`, `/preview-context` |
| observational-memory | `/om:status`, `/om:view` |
| btw | `/btw`, `/btw:tangent`, `/btw:new`, `/btw:clear`, `/btw:inject`, `/btw:summarize`, `/btw:model`, `/btw:thinking` |
| rewind | `/rewind` |
| prompt-template-model | `/chain-prompts`, `/prompt-tool` |
| Pi builtins | `palette`, `handoff`, `loop`, `coach`, `guardrails`, `/mcp`, `/model`, `/settings`, `/export`, `/share`, `/copy`, `/name`, `/session`, `/changelog` |

**No collision.** `/context` and `/context-stats` are unique. Note: pi-context has a `context_export` TOOL (not a command), so no collision with Pi's built-in `/export` command.

---

## 7. FINAL VERDICT — INSTALL CLEAN

### Verdict: ✅ INSTALL CLEAN

No tool name collisions. No command collisions. No storage collisions. No event stream duplication. The only interaction point (tool_result hook) is complementary in practice — lens processes write/edit (small output), pi-context processes large output from any tool. The theoretical edge case (large write/edit output triggering both) is vanishingly rare.

### Config needed

**None required.** Sensible defaults:
- Capture threshold: >24KB or >300 lines (`config.ts:47-48`)
- Retention: 7 days (`policy.ts:5`)
- DB path: `~/.pi/agent/context.db` (`registry.ts:12-20`)
- Purge on shutdown: follows config preset (default: off)

**Optional env vars for tuning:**
| Env var | Default | Purpose |
|---|---|---|
| `MY_PI_CONTEXT_RETENTION_DAYS` | 7 | Days before entries are purged |
| `MY_PI_CONTEXT_MAX_MB` | null (unlimited) | Max total stored MB before auto-purge |
| `MY_PI_CONTEXT_PURGE_ON_SHUTDOWN` | false | Purge all on session shutdown |
| `MY_PI_CONTEXT_DB` | `~/.pi/agent/context.db` | Custom SQLite path |

### Exact install command

```bash
pi install @spences10/pi-context
```

Or manually add to `~/.pi/agent/settings.json` packages array:
```json
"npm:@spences10/pi-context"
```

npm dependencies are published and available: `@spences10/pi-redact@0.0.12`, `@spences10/pi-tui-modal@0.0.20`, `@spences10/pi-settings@0.0.1`.

### Single biggest risk

**LOW RISK — tool_result hook ordering with lens.** If pi-context is loaded after lens (default when appended to packages array) and a `write`/`edit`/`lsp_navigation` tool produces output exceeding 24KB/300 lines, pi-context's receipt would replace lens's appended diagnostics (Pi's tool_result returns appear to be last-wins, inferred from lens's explicit `[...event.content, ...]` spread pattern). This is extremely unlikely — write/edit results are typically <1KB. Mitigation: place `@spences10/pi-context` before `npm:pi-lens` in the packages array if this is a concern.

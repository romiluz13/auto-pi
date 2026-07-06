# Pi Custom Extensions

User-local TypeScript glue for the Pi coding agent. These extensions are
**harmony-preserving glue**: each reads from an existing store or surface and
owns no axis that an installed package already owns. They are hot-reloadable
with `/reload`.

## Files

### `palette.ts` — Leader-key command palette

Fuzzy command palette over **every** slash command Pi has registered (prompts,
skills, extension commands). Discovers dynamically via `pi.getCommands()` — no
manual registry, no drift when prompts/skills are added.

- **Trigger:** `Ctrl+Shift+P` or `/palette`
- **On select:** inserts `/<command>` into the editor; Pi's native dispatch
  handles execution. Zero re-implementation of any command.
- **Harmony contract:** owns NO axis (no tools, no events, no storage). Reserves
  only `Ctrl+Shift+P`. pi-rewind (`Esc+Esc`) and pi-btw (`/btw`) untouched.
- **Why it exists:** closes the single biggest ideology gap — Pi's primary
  extensibility primitive is the TypeScript extension, and this dir previously
  had zero. Also folds in the telescope/fuzzy-finder gap as one navigation
  primitive over the existing command surface.

### `handoff.ts` — Session handoff (`/handoff`)

Generates a self-contained `HANDOFF.md` from the current session and drafts a
continuation prompt into the editor — **without** compacting (lossy) and
**without** an extra LLM call (which would compete with pi-hermes-memory /
pi-observational-memory background work).

- **Usage:** `/handoff` or `/handoff now implement tests`
- **Captures:** last compaction summary, recent user messages, file paths
  mentioned, your next task. Deterministic — no model call, no token cost.
- **Harmony contract:** reads `ctx.sessionManager` (Pi core), writes one file
  (`HANDOFF.md` in cwd). Owns no axis, hooks no events, registers no tools.
  Complements the `handoff` **skill** (prose guidance) with mechanical doc
  generation. Does NOT touch compaction (pi-observational-memory) or search
  (pi-hermes-memory).

## Harmony guardrails (for any future extension added here)

1. **One moving part per axis.** Each capability axis already has an owner
   among the 12 installed npm packages (see `~/.pi/agent/npm/package.json`):
   memory=hermes, search=hermes, compaction=observational, rewind=pi-rewind,
   statusline=pi-statusline, feedback=pi-lens, subagents=pi-subagents,
   messaging=pi-intercom, web=pi-web-access, compression=pi-hypa,
   questions=rpiv-ask-user-question, side-convo=pi-btw. A new extension must
   declare which axis it owns and touch no other.
2. **Extensions over packages for glue.** Local orchestration/doc/mode glue
   belongs here as `.ts` reading from existing stores — never a re-implementation
   of a published package.
3. **Single source of truth for roles.** `subagents.agentOverrides` (in
   `settings.json`) is the role vocabulary; `prompts/*.md` is the command
   surface. New commands/modes must *reference* these, not duplicate.
4. **Read, don't duplicate, event streams.** Subscribe to hermes/observational/
   lens events; never re-emit.
5. **Trust settings are user intent.** No extension may silently override
   `defaultProjectTrust`.

## Verified but NOT installed (needs a user decision)

### `pi-mcp-adapter` (npm, v2.11.0) — VERIFIED SAFE, ready to install

MCP protocol bridge — the one axis no installed package owns. Conflict-checked
against all 12 installed packages:

- Tools registered: `mcp`, `pi-mcp-probe` — no collision with any installed
  package or built-in.
- Commands: `/mcp`, `/mcp-auth` — no collision.
- Shortcuts: none — no keybinding collision with palette (`Ctrl+Shift+P`),
  pi-rewind (`Esc+Esc`), or pi-btw (`/btw`).
- Events: `session_start`, `session_shutdown` (additive lifecycle cleanup),
  `tool_result`. The `tool_result` hook only re-flags MCP-tool failures
  (`details.error === "tool_error" | "call_failed"`) and does not mutate
  content/details — scoped to MCP tools, so it cannot interfere with pi-hypa,
  pi-lens, or pi-rewind.

**Not auto-installed** because it needs an MCP server config to be useful, and
the right first server is a MongoDB one (matching the `mongodb-*` skill suite),
which needs your connection credentials. A dormant adapter with no servers is a
moving part that does nothing.

To install when ready:

```bash
pi install npm:pi-mcp-adapter
# then add a server config, e.g. a MongoDB MCP server, and /reload
```

### Semantic git (`pi-sem`) — NOT available standalone; build as glue instead

`pi-sem` ships only inside `tomsej/pi-ext` (a git bundle that also brings
leader-key, telescope, tool-pills, session-snap, and permissions). Installing
that whole bundle would **conflict** with `palette.ts` (leader-key + telescope
overlap) and add a competing permissions axis — a harmony violation.

**Recommendation:** if you want semantic git, build it as a future
`extensions/sem-git.ts` glue file that shells out to the `sem` CLI and feeds
labels into pi-hermes-memory — orthogonal to pi-rewind (which owns working-tree
rewind, not commit semantics). Do not install the `tomsej/pi-ext` bundle.

## Explicitly excluded (would conflict — do NOT add)

- `pi-dynamic-workflows` — re-implements fan-out; conflicts with pi-subagents +
  pi-btw + pi-intercom.
- Team-mode RPC — second message bus; conflicts with pi-intercom (`broker.sock`).
- `pi-observability` dashboard — TUI real-estate fight with pi-statusline +
  duplicates pi-lens / pi-observational-memory event streams.
- `tomsej/pi-ext` bundle — brings a competing palette + permissions (conflicts
  with `palette.ts`).

## Verification

Both extensions load cleanly at Pi startup (Pi surfaces extension load failures
to stderr as `Failed to load extension ...`; these two produce none). LSP
diagnostics: 0 errors. Biome: clean.

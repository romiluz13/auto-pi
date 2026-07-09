> **HISTORICAL** — this audit reflects pre-prune state (12–15 packages, pi-hypa active, 150-line AGENTS.md). Kept for the decision trail. For current state see the [2026-07-09 deep review](2026-07-09-deep-review.md) and [README](../../README.md).

# Pi Agent Setup — Harmony & Conflict Audit

Audited paths: `~/.pi/agent/` (settings.json, models.json, prompts/, skills/, npm/node_modules/*).
Date: 2026-07-06. Mode: read-only (nothing changed).

## Verdict

**IN HARMONY.** No critical or major conflicts. 4 minor conflicts found — every one is
already mitigated by a guard (`hasTool` / try-catch / mutually-exclusive config switch) or
by Pi's documented multi-handler event semantics. 3 informational notes (non-conflicts worth
knowing). The setup is safe to run as-is.

Conflict inventory: 4 minor + 0 major + 0 critical = 4 total.

---

## 1. Tool Registration Collisions

### Registered tool names (full inventory)

| Package | Tool names |
|---|---|
| `@hypabolic/pi-hypa` | `hypa_shell`, `hypa_read`, `hypa_grep`, `hypa_find`, `hypa_ls`, `hypa_mcp_proxy` |
| `@juicesharp/rpiv-ask-user-question` | `ask_user_question` |
| `@narumitw/pi-statusline` | (no tools) |
| `pi-btw` | (no tools) |
| `pi-hermes-memory` | `memory`, `memory_search`, `session_search`, `skill_manage` |
| `pi-intercom` | `intercom`, `contact_supervisor` (child-conditional) |
| `pi-lens` | `ast_grep_search`, `ast_grep_replace`, `ast_grep_outline`, `ast_grep_dump`, `ast_dump`, `lens_diagnostics`, `lsp_diagnostics`, `lsp_navigation`, `module_report`, `read_symbol`, `read_enclosing` |
| `pi-observational-memory` | `recall` |
| `pi-prompt-template-model` | `run-prompt` |
| `pi-rewind` | (no tools) |
| `pi-subagents` | `subagent`, `wait`, `contact_supervisor` (child-conditional, guarded), `intercom` (guarded fallback), `subagent_supervisor`, `structured_output` (subagent runtime only) |
| `pi-web-access` | `web_search`, `fetch_content`, `get_search_content` |

Built-ins (`read`/`write`/`edit`/`bash`/`grep`/`find`/`ls`) are NOT overridden:
- `pi-hypa` registers prefixed `hypa_*` alternatives only; default mode is **additive**
  (`parseMode` returns `"replace"` only when `HYPA_PI_MODE=replace`, which is unset —
  `extensions/policy.ts:6`). In replace mode it would disable built-ins via
  `REPLACE_MODE_DISABLED_BUILTINS = {bash,read,grep,find,ls}` (`extensions/index.ts:8`),
  but that mode is off.
- `pi-lens` wraps every `registerTool` in `try/catch` so a name clash aborts neither
  itself nor the other extension (`dist/index.js:737`).

### MINOR-1 — `intercom` registered by two packages (guarded, order-dependent)
- **Parties:** `pi-intercom` (`index.ts:1305`, unguarded, always registered) vs
  `pi-subagents` (`src/intercom/native-supervisor-channel.ts:468`, `if (!hasTool(pi,"intercom"))` guarded fallback).
- **Behavior:** `pi-intercom`'s full peer-to-peer intercom wins because it loads first
  (packages array index 5 < 10). `pi-subagents`' limited native-channel fallback is skipped.
  This is intentional defense-in-depth — `pi-intercom` already handles subagent events
  (`SUBAGENT_CONTROL_INTERCOM_EVENT` / `SUBAGENT_RESULT_INTERCOM_EVENT` at `index.ts:895,902`).
- **Risk:** If load order ever flipped, `pi-subagents`' reduced intercom (only status/list/
  send/ask) would shadow `pi-intercom`'s full tool. Currently safe.
- **Fix (harmony-preserving):** No action needed now. To make it order-independent, add a
  `hasTool(pi,"intercom")` short-circuit comment in `pi-intercom` documenting that it is the
  canonical owner, or pin `pi-intercom` before `pi-subagents` in `settings.json.packages`
  (already the case).

### MINOR-2 — `contact_supervisor` registered by two packages (guarded, order-dependent)
- **Parties:** `pi-intercom` (`index.ts:1031`, registered only when `childOrchestratorMetadata`
  is present — i.e. child subagent context, unguarded within that branch) vs
  `pi-subagents` (`native-supervisor-channel.ts:284`, `if (!hasTool(pi,"contact_supervisor"))` guarded).
- **Behavior:** In child context, `pi-intercom` loads first and registers the rich
  `contact_supervisor` (need_decision/interview_request/progress_update). `pi-subagents`
  sees it via `hasTool` and skips its simpler version. No crash.
- **Risk:** Same order-dependence as MINOR-1; mitigated identically.
- **Fix:** No action needed. Already guarded + ordered.

### Non-collisions (verified safe, NOT conflicts)
- `session_search` is registered twice **inside** `pi-hermes-memory`
  (`src/tools/session-search-tool.ts:42` anchor variant and `:121` legacy variant), but the
  public `registerSessionSearchTool` dispatches via `if (variant === 'anchors') {...; return;}`
  then falls through — only ONE path runs per process. Config default is `variant: "legacy"`
  (`src/config.ts:64`). Not a runtime collision.
- `subagent` is registered in `pi-subagents/src/extension/index.ts:455` (parent) and
  `src/extension/fanout-child.ts:157` (child). The child process is launched with
  `--no-extensions` + explicit `[PROMPT_RUNTIME_EXTENSION_PATH, FANOUT_CHILD_EXTENSION_PATH]`
  (`src/runs/shared/pi-args.ts:142`) — the main extension is NOT loaded in the child.
  Different processes; no same-process collision.
- `structured_output` (`subagent-prompt-runtime.ts:296`) lives only in the subagent prompt
  runtime. No clash.
- All `pi-lens` and `pi-hypa` tool names are unique across the whole inventory.

---

## 2. Event Handler Overlaps

Event bus multiplicity is by design (Pi runs all handlers per event). Only potentially
*interfering* overlaps are flagged. Full subscriber counts:

`session_start`(10) `session_shutdown`(9) `turn_end`(7) `agent_end`(5) `turn_start`(4)
`message_end`(4) `tool_execution_end`(3) `tool_call`(3) `session_tree`(3) `model_select`(3)
`context`(3) `before_agent_start`(3) `agent_start`(3) `tool_result`(2) `tool_execution_start`(2)
`session_before_tree`(2) `session_before_fork`(2) `session_before_compact`(2)
`resources_discover`(2) `thinking_level_select`(1)

### MINOR-3 — `before_agent_start` systemPrompt modified by 3 handlers (host-merge-dependent)
- **Parties:**
  - `pi-hermes-memory` (`src/index.ts:174`) — returns `{ systemPrompt: event.systemPrompt + memoryPolicy }`.
  - `pi-prompt-template-model` (`index.ts:1654`) — returns `{ systemPrompt, message? }` (appends run-prompt guidance / loop-iteration text / pending skill message).
  - `pi-rewind` (`src/index.ts:139`) — side-effect only (records `state.currentPrompt`), returns nothing.
- **Behavior:** Two handlers return a mutated `systemPrompt`. This is the standard Pi
  extension pattern; Pi's `before_agent_start` accumulates/merges returned `systemPrompt`
  values across handlers. Both packages only *append*; neither replaces the other's text.
- **Risk:** If a future Pi host build changed `before_agent_start` to last-wins semantics,
  hermes memory policy could be silently dropped. Currently safe.
- **Fix:** No action needed. Both handlers append-only; harmonious under current Pi semantics.

### Non-conflicts (overlaps that are complementary, NOT destructive)
- `session_before_compact` — `pi-hermes-memory` (`handlers/session-flush.ts:56`, runs a
  best-effort memory flush, returns nothing) + `pi-observational-memory`
  (`hooks/compaction-hook.ts`, returns `{ compaction: { summary, ... } }` to inject into the
  compacted context). One is side-effect, the other returns the compaction shape. Pi merges
  both. No fight.
- `tool_call` — `pi-hypa` intercepts only `bash` (rewrite/deny/ask, `extensions/index.ts:40`);
  `pi-rewind` records mutating-tool descriptions for checkpoint labels (side-effect);
  `pi-lens` runs per-tool diagnostics dispatch. Only `pi-hypa` can block, and only bash. No
  mutual interference.
- `session_before_tree` — `pi-rewind` (checkpoint) + `pi-prompt-template-model` (returns a
  `summary` only when a boomerang/fresh-collapse loop is active). Conditional + complementary.
- `session_before_fork` — `pi-rewind` (checkpoint) + `pi-lens` (stashes a fork snapshot for
  the forked session, `dist/index.js:887`). Different concerns.
- `resources_discover` — `pi-hermes-memory` (project skill discovery) + `pi-lens` (registers
  its own skills). Pi merges resource lists.

---

## 3. Skills Name Collisions

Load roots inspected:
- `~/.pi/agent/skills/` — 30 entries, **all symlinks** (no real dirs).
- `~/.agents/skills/` — 48 real skill dirs.
- `~/.pi/agent/pi-hermes-memory/skills/` — 1 entry (`pi-hermes-memory-cleanup`).
- Package skills: `pi-intercom/skills/pi-intercom`, `pi-lens/skills/{ast-grep,lsp-navigation,write-ast-grep-rule,write-tree-sitter-rule}`, `pi-prompt-template-model/skills/prompt-template-authoring`, `pi-subagents/skills/pi-subagents`, `pi-web-access/skills/librarian`.

### MINOR-4 — 18 skill names registered twice (symlink aliases, byte-identical)
The following names exist in BOTH `~/.pi/agent/skills/` (as a symlink) AND `~/.agents/skills/`
(as the real dir). The symlink targets are the canonical `~/.agents/skills/<name>` (or
`~/.octocode/skills/<name>` for the octocode set), so the loaded content is byte-identical:

`find-skills, frontend-design, grill-with-docs, handoff, implement, improve-codebase-architecture,
prototype, tdd, teach, triage, vercel-composition-patterns, vercel-react-best-practices,
web-design-guidelines, writing-great-skills, octocode, octocode-brainstorming, octocode-research,
octocode-rfc-generator, octocode-roast`

(Verified: e.g. `~/.pi/agent/skills/tdd -> ../../../.agents/skills/tdd`; `diff -q` of the
SKILL.md files shows no difference; `readlink` confirms all 18 are symlinks.)

- **Behavior:** Pi loads from both `~/.pi/agent/skills/` and `~/.agents/skills/`, sees each
  name twice, keeps the first found and emits a "duplicate skill name" warning. Because both
  paths resolve to the same file, there is zero functional divergence — only a cosmetic
  warning per duplicate.
- **Severity:** minor (noise, no behavioral conflict).
- **Fix (harmony-preserving):** Remove the `~/.pi/agent/skills/` symlinks whose target is
  inside `~/.agents/skills/` or `~/.octocode/skills/`, since those are already first-class
  load roots. Keep the `~/.pi/agent/skills/` symlinks that point elsewhere
  (`~/Dev/pi-optimize/brightdata-skills/*`, `~/Dev/ux-skills/*`) — those are the only way
  those skills enter the load path. (Read-only audit — not applied here.)

### Non-collision
- `~/.pi/agent/skills/` contains NO non-symlink entries (every entry is a symlink), so it
  introduces no *new* skill content that could diverge from a same-named skill elsewhere.

---

## 4. Settings Consistency (`settings.json`)

- `defaultProvider: "grove-openai"` → provider exists in `models.json`. ✓
- `defaultModel: "FW-GLM-5.2"` → exists under `grove-openai.models` (`models.json`). ✓
- `observational-memory.model`: `{provider:"grove-openai", id:"gpt-5.4-mini", thinking:"off"}`
  → `gpt-5.4-mini` exists under `grove-openai`. `thinking:"off"` on a `reasoning:true` model
  is valid (disables thinking). ✓
- `subagents.agentOverrides`: all 8 agent types set `thinking:"xhigh"`, equal to
  `defaultThinkingLevel:"xhigh"`. Redundant but **consistent** — not a conflict. ✓
- `compaction.reserveTokens:629146` + `keepRecentTokens:50000` (Pi core compaction) coexists
  with `observational-memory.compactAfterTokens:81000` + `compactAfterTokensMode:"ratio"` +
  `compactAfterTokensRatio:0.4` (obs-memory proactive trigger). Different mechanisms; in
  ratio mode the obs threshold auto-scales to `floor(contextWindow × 0.4)` per active model
  (e.g. FW-GLM-5.2 ctx 1,048,576 → 419,430; gpt-5.4-mini ctx 400,000 → 160,000), falling
  back to 81,000 when contextWindow is unknown. No conflict. ✓
- `retry: {enabled, maxRetries:10, baseDelayMs:2000}` — self-consistent. ✓
- No internal inconsistency found.

---

## 5. Models.json Sanity (`models.json`)

- 2 providers: `grove` (api `anthropic-messages`), `grove-openai` (api `openai-completions`).
- 30 models total. **No duplicate model IDs** within or across providers (script-checked).
- No model references a provider that doesn't exist.
- Both providers point at the same gateway base URL with `$GROVE_API_KEY`; the `grove-openai`
  provider carries `compat.supportsDeveloperRole:false`. Consistent.
- `defaultModel` and `observational-memory.model.id` both resolve under `grove-openai`. ✓
- No misconfiguration found.

---

## 6. Prompt Template Collisions (`prompts/`)

Templates: `build.md, debug.md, feature.md, fix.md, plan.md, research.md, review.md, ship.md`.

- Chains: `feature.md` → `chain: plan -> build -> review -> ship`; `fix.md` →
  `chain: debug -> build -> review -> ship`. Each step references a distinct template; no
  template appears twice in a chain. ✓
- Per-template `skill:` frontmatter: `build→tdd`, `debug→diagnosing-bugs`, `plan→brainstorming`,
  `research→research`, `review→code-review`, `ship→verification-before-completion`.
  `feature.md`/`fix.md` use `chain:` instead of `skill:`. No two templates claim the same
  skill. ✓
- Referenced skills (`tdd, diagnosing-bugs, brainstorming, research, code-review,
  receiving-code-review, improve-codebase-architecture, verification-before-completion,
  commit, domain-modeling, github`) all exist under `~/.agents/skills/`. ✓
- No template references a skill in a conflicting way; no cross-template skill overlap.
- No collisions.

---

## 7. Memory System Overlap (`pi-hermes-memory` vs `pi-observational-memory`)

**Storage — NO overlap:**
- `pi-hermes-memory` writes to `~/.pi/agent/pi-hermes-memory/` (`sessions.db` SQLite +
  `MEMORY.md` / `USER.md` markdown + `skills/`). Verified: `src/index.ts:86` `defaultGlobalDir
  = path.join(agentRoot, "pi-hermes-memory")`; `DatabaseManager(globalDir)`.
- `pi-observational-memory` writes NO files/DB of its own. It calls `pi.appendEntry(...)` to
  add `OM_OBSERVATIONS_RECORDED` / `OM_REFLECTIONS_RECORDED` / `OM_OBSERVATIONS_DROPPED`
  entries to the Pi session ledger (in-memory + the session JSONL owned by Pi core). No
  shared SQLite, no shared markdown, no shared dir. ✓

**Event hooks — complementary, not destructive:**
- `session_before_compact`: hermes flushes memory (side-effect, returns nothing); obs returns
  the compaction summary to inject. Different return contracts; Pi merges both.
- `turn_end`: hermes runs `correction-detector` + `background-review`; obs runs
  `consolidation-trigger` (observer/reflector/dropper). Different stores, different purposes.
- `before_agent_start` (hermes, injects memory policy) vs `agent_start` (obs, launches
  consolidation) — **different events**, no overlap.
- `message_end`: hermes-only (live session indexing). Obs does not hook it.

**No destructive fight.** The two systems are layered: hermes = cross-session durable memory
(SQLite); obs = within-session observations that survive compaction (ledger entries).

### NOTE-1 (informational, not a conflict) — double background-LLM cost on `turn_end`
Both `pi-hermes-memory` (`handlers/background-review.ts:139`) and `pi-observational-memory`
(`hooks/consolidation-trigger.ts`, on `agent_start` + `turn_end`) can spawn background
sub-agent LLM calls in the same turn. They do not fight over storage, but they do double the
background token spend. Each is gated by its own threshold (`flushMinTurns` / observe+reflect
token thresholds) and its own in-flight guard (`consolidationInFlight`, `compactHookInFlight`),
so they won't stampede. Worth knowing for cost tuning; not a harmony problem.

### NOTE-2 (informational) — `session_before_compact` runs two awaitable handlers sequentially
Hermes flush can take up to 30s (`session-flush.ts:48` timeout 30000) and is awaited before
obs's compaction-hook runs. This serializes compaction latency but cannot corrupt either
system. Acceptable.

### NOTE-3 (informational) — `~/.pi/agent/skills/` is a pure symlink aggregation layer
Every entry is a symlink into `~/.agents/skills/`, `~/.octocode/skills/`,
`~/Dev/pi-optimize/brightdata-skills/`, or `~/Dev/ux-skills/`. This is a deliberate
aggregation pattern, not drift. The only downside is MINOR-4 (symlinks back into
`~/.agents/skills/` cause redundant name registration).

---

## Summary Table

| # | Surface | Parties | Severity | Status |
|---|---|---|---|---|
| MINOR-1 | tool `intercom` | pi-intercom vs pi-subagents | minor | guarded + order-safe |
| MINOR-2 | tool `contact_supervisor` | pi-intercom vs pi-subagents | minor | guarded + order-safe |
| MINOR-3 | `before_agent_start` systemPrompt | hermes vs ptm vs rewind | minor | append-only merge, safe |
| MINOR-4 | 18 skill names double-registered | ~/.pi/agent/skills symlinks vs ~/.agents/skills | minor | byte-identical, cosmetic warning |
| NOTE-1 | turn_end double background LLM | hermes background-review vs obs consolidation | note | cost only, no conflict |
| NOTE-2 | session_before_compact dual await | hermes flush vs obs compaction-hook | note | serial latency, no corruption |
| NOTE-3 | skills dir is symlink-only aggregation | ~/.pi/agent/skills → external repos | note | intentional pattern |

**No critical or major conflicts. The setup is in harmony.**

# Conflict Audit: @spences10/pi-confirm-destructive vs Existing Pi Setup

**Date:** 2026-07-06
**Candidate:** `@spences10/pi-confirm-destructive` v0.0.16 (`/tmp/pi-github-repos/spences10/my-pi/packages/pi-confirm-destructive`)
**Existing setup:** `~/.pi/agent/` with 12 npm packages + 3 local extensions

---

## 1. tool_call HOOK OVERLAP — Three handlers, same event

### Existing tool_call handlers (in execution order)

| # | Extension | Source | Behavior on tool_call |
|---|-----------|--------|----------------------|
| 1 | pi-rewind | `pi-rewind/src/index.ts:158` | **Passive** — captures tool args for checkpoint labels. Returns `void`. Never blocks. |
| 2 | pi-hypa | `@hypabolic/pi-hypa/extensions/index.ts:51-80` | **Active** — for `bash` events: calls `rewriteCommand()`, may **mutate `event.input.command` in place** (`event.input.command = status.command`, line 68), may **deny** (`return { block: true, reason }`, line 72), may **ask** (confirm dialog, line 75), or may **pass through** (returns `void`). |
| 3 | loop.ts | `~/.pi/agent/extensions/loop.ts:395-405` | **Active** — blocks tools outside the current phase allowlist (`return { block: true, reason }`). Only active when a loop is running (`if (!active) return`). |
| 4 | **confirm-destructive (CANDIDATE)** | `src/index.ts:73-103` | **Active** — assesses bash/write/edit/custom-tool calls; may **block** (`return { block: true, reason }`, line 101) after a user confirmation dialog. |

### Do they compose or fight?

**They compose mechanically.** Pi runs all registered `tool_call` handlers in registration order (npm packages in `settings.json` `packages` array order, then `extensions/` directory). The first handler to return `{ block: true }` wins; subsequent handlers don't run for that event. Handlers that return `void` are passive and let execution continue.

**Evidence:** loop.ts header comment (lines 21-23) explicitly states: *"on('tool_call') is additive: pi-rewind (snapshots) and pi-hypa (bash rewrite) hook the same event for different concerns; this hook only blocks tools outside the current phase allowlist."* The design assumption is composition.

### Order-dependent behavior — REAL concern

If confirm-destructive is installed as an npm package, it appends to the end of the `packages` array. Execution order becomes:

1. **pi-hypa runs FIRST** (package position 0 in `settings.json:24`)
2. **confirm-destructive runs SECOND** (appended at end of packages)
3. **loop.ts runs THIRD** (extensions/ dir runs after packages)

**Scenario A — hypa rewrites, confirm-destructive sees the rewritten form:**
- hypa's `tool_call` handler mutates `event.input.command` in place (`@hypabolic/pi-hypa/extensions/index.ts:68`: `event.input.command = status.command`).
- confirm-destructive then reads `event.input.command` (`src/index.ts:79`: `const command = event.input.command`).
- confirm-destructive's assessors use **regex pattern matching** on the raw command string (`src/destructive/assessors.ts:13-57`, patterns like `/(^|[;&|]\s*)git\s+reset\b[^;&|]*--hard\b/`).
- **If hypa's rewrite changes the command syntax** (e.g., wraps it, reorders args, adds compression flags), confirm-destructive's regexes may **fail to match** the rewritten form → **silent bypass** of the destructive-command confirmation.
- **Mitigating factor:** hypa's rewrite is about output compression, not semantic transformation. The `rewriteCommand` function (`@hypabolic/pi-hypa/extensions/rewrite-client.ts:30`) calls `hypa rewrite --json <command>`. In practice, destructive semantics are preserved. But the risk is non-zero and **unverifiable without knowing hypa's rewrite rules**.

**Scenario B — hypa denies, confirm-destructive never runs:**
- hypa returns `{ block: true }` → confirm-destructive is skipped. This is fine — the command was already blocked. No double-prompt.

**Scenario C — hypa passes through, confirm-destructive sees the original:**
- hypa returns `void` (passthrough/skipped/error) → `event.input.command` is unchanged → confirm-destructive sees the original command. **Correct behavior.**

**Scenario D — confirm-destructive blocks, loop.ts never runs:**
- If a loop is active and the tool is in the phase allowlist, confirm-destructive may still block it as destructive. The user gets a destructive-command prompt even during a loop phase that allows `bash`. This is **correct** — safety should override phase gating — but may surprise users mid-loop.

**Scenario E — confirm-destructive prompts (user allows), then hypa also prompts or denies:**
- confirm-destructive's `should_allow()` shows a `ctx.ui.select()` dialog (`src/index.ts:22-30`). If the user clicks "Allow once", execution continues to hypa, which may then show its OWN confirmation dialog (`ctx.ui.confirm`, `@hypabolic/pi-hypa/extensions/index.ts:75`) or deny the command.
- **Result: double-prompt** — the user answers confirm-destructive's dialog, then may immediately face hypa's dialog. This is a **UX annoyance**, not a safety failure.

**Verdict on overlap:** The handlers compose without crashing. The order-dependent semantic gap (Scenario A — regex bypass after hypa rewrite) is a **NOTE-level risk**, not a blocker. The double-prompt scenario (E) is a UX annoyance. No handler fights another — they operate on different concerns (compression vs destructive-command confirmation vs phase gating).

---

## 2. DOES IT DUPLICATE HERMES SECRET SCANNING?

**No. Completely different axes. Zero overlap.**

### Hermes secret scanning — what it actually does

Hermes's `content-scanner.ts` (`pi-hermes-memory/src/store/content-scanner.ts`) scans **memory content being persisted to storage**. It is called from:
- `store/memory-store.ts:148` — blocks `store.add()` if content contains secrets
- `store/memory-store.ts:244` — blocks `store.update()` if content contains secrets
- `store/skill-store.ts:278,358,417` — blocks skill create/update if content contains secrets

The scanner checks for:
- API keys (`sk-ant-api*`, `sk-or-v1-*`, `sk-*`, `AKIA*`) — `content-scanner.ts:27-30`
- Tokens (`ghp_*`, `ghu_*`, `xoxb-*`, `Bearer *`) — `content-scanner.ts:32-36`
- SSH private keys (`-----BEGIN RSA PRIVATE KEY-----`) — `content-scanner.ts:38`
- Environment variable names (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.) — `content-scanner.ts:41-46`
- Inline secret assignments (`password=`, `secret=`, `token=`) — `content-scanner.ts:48-50`
- Prompt injection patterns (`ignore previous instructions`, `you are now`, etc.) — `content-scanner.ts:8-18`

**Hermes does NOT scan git commits, bash commands, or tool calls.** It scans memory writes only. The task's premise that "hermes blocks git commits containing secrets" is **incorrect** — hermes blocks MEMORY PERSISTENCE containing secrets, not git operations.

### confirm-destructive — what it does

confirm-destructive scans **bash commands, file writes, file edits, and custom tool calls** for **destructive operations**:
- `rm`/`rmdir`/`unlink`/`shred` — `assessors.ts:65-92`
- `git rm --force` — `assessors.ts:95-118`
- `git reset --hard` — `assessors.ts:121-131`
- `git clean -fdx` — `assessors.ts:30-34`
- `git checkout/restore .` (discard all) — `assessors.ts:36-40`
- `find -delete` / `find -exec rm` — `assessors.ts:24-28`
- `prisma migrate reset` / `prisma db push --force-reset` — `assessors.ts:13-19`
- Destructive SQL (`DROP`, `DELETE FROM`, `TRUNCATE`, `ALTER TABLE`) — `assessors.ts:20-23`
- `rsync --delete` — `assessors.ts:42-45`
- `truncate -s 0` — `assessors.ts:47-51`
- `dd of=` — `assessors.ts:53-57`
- `mkfs`/`fdisk`/`parted`/`wipefs` — `assessors.ts:59-62`
- File overwrites (write to existing non-git-recoverable file) — `assessors.ts:156-174`
- Large content removals in edits (>200 char net removal) — `assessors.ts:176-202`
- Custom tools with destructive names (`delete`, `destroy`, `drop`, `remove`, etc.) — `assessors.ts:10-12, 205-222`

**confirm-destructive does NOT scan for secrets, API keys, tokens, or credentials at all.** There is no overlap with hermes. They operate on completely different domains:
- **Hermes:** memory content → secret/injection patterns → block memory persistence
- **confirm-destructive:** bash commands/tool calls → destructive file/git/db operations → block execution

**No double-prompt risk.** A `git commit -m "fix"` command would not trigger confirm-destructive (not destructive) and would not trigger hermes (hermes doesn't scan git commits). A memory write containing an API key would trigger hermes but not confirm-destructive (confirm-destructive doesn't hook the memory tool).

---

## 3. USER INTENT RECONCILIATION

### The apparent contradiction

| Signal | Source | Implication |
|--------|--------|-------------|
| `defaultProjectTrust: "always"` | `settings.json:51` | User doesn't want project-trust prompts |
| `trust.json: { "/Users": true }` | `~/.pi/agent/trust.json` | User trusts all projects under /Users |
| "deliberately declined safety gates last turn" | Task context | User said no to safety gates |
| "Never run destructive git operations (`push --force`, `reset --hard`, branch deletion) without explicit confirmation." | `~/.ai/AGENTS.md` Safety section | User EXPLICITLY wants confirmation on destructive git |

### Reconciliation — these are DIFFERENT axes

**`defaultProjectTrust: "always"`** is about **project trust** — whether Pi prompts the user to trust a project directory before running tools in it. It is NOT about command-level safety gating. Setting it to `"always"` means "don't prompt me to trust projects." It says nothing about whether destructive commands should be confirmed.

**The "declined safety gates last turn"** most likely refers to the user declining **general-purpose safety gating** — e.g., prompting on every tool call, or project-trust gating, or broad command filtering. This is the kind of gate that adds friction to NORMAL work.

**The AGENTS.md Safety section** is a **SETTLED, EXPLICIT constraint** the user wrote themselves: *"Never run destructive git operations without explicit confirmation."* This is not a general gate — it is a specific requirement for DESTRUCTIVE operations only.

### Which intent wins?

**The AGENTS.md Safety section wins for destructive operations.** Evidence:
1. The user wrote it deliberately as a Safety rule (`~/.ai/AGENTS.md` Safety section).
2. It is scoped to destructive operations only — it does NOT say "prompt on all commands."
3. `defaultProjectTrust: "always"` is orthogonal — it governs project trust, not command safety.
4. The "declined safety gates" decision and the AGENTS.md Safety rule are **not contradictory** — they operate on different axes. The user wants: **no gates on normal work + YES gates on destructive operations.**

### Does confirm-destructive align or contradict?

**It aligns.** confirm-destructive ONLY prompts for destructive operations:
- `rm`, `git reset --hard`, `git clean -fdx`, `git push` (not implemented but in spirit), destructive SQL, disk tools, file overwrites of unrecoverable files, large content removals.
- It does NOT prompt for normal commands (`ls`, `cat`, `git status`, `npm install`, `git commit`, `edit` with small changes, `write` to new files, etc.).
- It has **git-recoverability awareness** (`assessors.ts:88-90`, `git.ts`) — it skips confirmation for `rm` of git-tracked-clean files and session-created temp files. This means it only prompts when work would actually be LOST.

**The user's intent is "no gates on normal work, yes gates on destructive." confirm-destructive implements exactly that.**

**There IS a contradiction in the user's config** — but only if you misread `defaultProjectTrust: "always"` as "no safety gates at all." It is not. It is project-trust specific. The AGENTS.md Safety section is the authoritative statement on destructive-command gating, and it says YES to confirmation.

---

## 4. COMMAND/TOOL COLLISIONS

**Zero collisions.**

confirm-destructive registers:
- **No commands** — no `pi.registerCommand()` calls in `src/index.ts`
- **No tools** — no `pi.registerTool()` calls in `src/index.ts`
- **3 event handlers:** `tool_call`, `tool_result`, `user_bash`

### Event handler collisions

| Event | Existing handlers | confirm-destructive | Conflict? |
|-------|-------------------|---------------------|-----------|
| `tool_call` | pi-rewind (passive), pi-hypa (active), loop.ts (active) | active (assess + block) | **No** — different concerns, composes (see §1) |
| `tool_result` | pi-subagents (`extension/index.ts:564`) | passive (tracks created files) | **No** — both return `void`, different state |
| `user_bash` | **None** — no existing extension hooks this event | active (assess + block) | **No** — exclusive handler |

**No `/command` name collisions** — the package registers zero commands. Existing commands (`/loop`, `/loop-status`, `/loop-abort`, `/hypa`, `/guardrails`, `/memory-insights`, `/memory-skills`, `/memory-consolidate`, `/memory-interview`, `/memory-switch-project`, `/handoff`) are all untouched.

**No tool name collisions** — the package registers zero tools. Existing tools (`hypa_shell`, `hypa_read`, `hypa_grep`, `hypa_find`, `hypa_ls`, `hypa_module_report`, `hypa_outline`, memory/skill/session-search/memory-search tools) are all untouched.

---

## 5. STORAGE

**Zero persistent storage. Zero overlap with hermes/observational/workflows.**

confirm-destructive uses **in-memory state only** — all declared in `src/index.ts:40-44`:

```typescript
const allowed_for_session = new Set<string>();        // session-scoped allowlist
const pending_created_files = new Map<string, string>(); // tool_call → file path (pre-execution)
const pending_bash_created_paths = new Map<string, string[]>(); // tool_call → bash-created paths
const bash_may_create_temp_path = new Set<string>();   // tool_call IDs that may create temp files
const session_created_files = new Set<string>();        // files created this session (for recovery awareness)
```

- **No disk writes** — no `writeFileSync`, no SQLite, no JSON files.
- **No database** — does not touch hermes's SQLite FTS5 (`pi-hermes-memory/src/store/db.ts`).
- **No observational memory** — does not touch `pi-observational-memory`.
- **No workflows directory** — does not touch `~/.pi/workflows/` (loop.ts's domain).
- **No config file** — no `~/.pi/agent/confirm-destructive.json` or similar (unlike guardrails.ts which reads `guardrails.json`).
- All state is lost on session end — by design, "Allow similar for this session" resets each session.

**The only side effect** is calling `git` via `execFileSync` (`src/destructive/git.ts:4-10`) for recoverability checks. This runs `git status`, `git ls-files`, `git rev-parse` — **read-only git queries**, no mutations.

---

## 6. FINAL VERDICT

### INSTALL WITH CONFIG

The package is well-designed, composes with existing extensions, has zero storage overlap, zero command/tool collisions, and does not duplicate hermes secret scanning. It aligns with the user's AGENTS.md Safety section.

**However, it must be installed with awareness of the hypa interaction.**

### Why not INSTALL CLEAN?

The order-dependent behavior with pi-hypa (§1, Scenario A) is a real semantic gap:
- **hypa runs FIRST** (package position 0), may rewrite `event.input.command` in place.
- **confirm-destructive runs SECOND**, sees the potentially-rewritten command.
- If hypa's rewrite changes command syntax, confirm-destructive's regex patterns may fail to match → **silent bypass of destructive-command confirmation.**
- Additionally, Scenario E (double-prompt) can occur: confirm-destructive prompts, user allows, then hypa also prompts or denies.

These are not crashes or data-loss risks, but they mean the package's effectiveness is **partially dependent on hypa's rewrite behavior**, which is external and not verifiable from the code alone.

### Why not 100% blocked?

- No hard conflicts — no crashes, no data corruption, no storage overlap.
- No duplication of hermes — completely different domain.
- No command/tool collisions.
- Aligns with the user's own AGENTS.md Safety section.
- The `defaultProjectTrust: "always"` is orthogonal — it governs project trust, not command safety.
- The user's "declined safety gates" and their AGENTS.md "never destructive git without confirmation" are **not contradictory** — they're different axes (normal-work gating vs destructive-command gating).

### Recommended config on install

1. **Place confirm-destructive BEFORE pi-hypa in the `packages` array** if possible, so it assesses the ORIGINAL command before hypa rewrites it. This eliminates Scenario A (regex bypass). If Pi doesn't support reordering, the risk remains but is bounded.
2. **Be aware of double-prompts** — when both confirm-destructive and hypa's `ask` mode trigger on the same bash command, the user may see two dialogs. This is a UX annoyance, not a safety failure.
3. **No config file needed** — the package has no configuration. It works out of the box. Session-scoped "Allow similar" resets each session by design.
4. **The package only prompts for genuinely destructive operations** — rm of unrecoverable files, git reset --hard with dirty working tree, destructive SQL, disk tools, large content removals. Normal work is unaffected. This is consistent with the user's "no gates on normal work" intent.

### The contradiction in the user's config — resolved

The user's config has an **apparent** contradiction: `defaultProjectTrust: "always"` (no gates) vs AGENTS.md "never destructive git without confirmation" (yes gates). This is **not a real contradiction** — they govern different axes:
- `defaultProjectTrust` → project trust prompts → **no gates wanted**
- AGENTS.md Safety → destructive command confirmation → **yes gates wanted**

**The AGENTS.md Safety section wins for destructive operations** because it is an explicit, settled, user-authored constraint. confirm-destructive implements exactly this constraint. Installing it aligns with the user's documented intent, even if it appears to conflict with their last-turn "declined safety gates" decision — because that decision was about a different kind of gate.

---

## Summary Table

| Question | Answer | Risk Level |
|----------|--------|------------|
| 1. tool_call hook overlap | Composes mechanically; order-dependent semantic gap with hypa (regex bypass after rewrite) + possible double-prompt | NOTE |
| 2. Duplicates hermes secret scanning? | No — completely different domains (memory content secrets vs destructive command operations) | NONE |
| 3. Contradicts user intent? | No — aligns with AGENTS.md Safety section; `defaultProjectTrust` is orthogonal | NONE |
| 4. Command/tool collisions? | Zero — no commands, no tools registered; event handlers compose | NONE |
| 5. Storage overlap? | Zero — in-memory only, no disk persistence, no DB, no config file | NONE |
| 6. Final verdict | **INSTALL WITH CONFIG** — install with awareness of hypa ordering | LOW RISK |

# Design: Pocock-Alignment + Bloat Prune

**Date:** 2026-07-08
**Status:** Approved (user review pending)
**Spec author:** research → brainstorm → this doc
**One unifying principle:** *the agent decides; the human doesn't do it manually.* Every change serves this principle or removes something that contradicts it.

**Two hard requirements added at approval:**

1. **0 phantom references** — no skill mentioned anywhere that doesn't exist. Structurally guaranteed, not policed.
2. **Dynamic discovery** — if a new skill is added, the system handles it with zero code/config edits.

---

## Background (from 2026-07-08 research audit)

The audit (`/tmp/research_codebase.md`, `/tmp/research_web.md`) found my-pi had crossed the over-engineering line in specific places, not uniformly. Harmony intact (4 minor conflicts, 0 major). The 7 bloat items this plan addresses, ranked:

1. `coach.ts` ~370 LOC hard-coded regex classifier (21 intents + 8 domains) — ideology betrayal (force-dumb-junior pattern).
2. AGENTS.md domain-skills enumeration (~40 lines, 52 skills, 10 phantom not installed).
3. guardrails re-injects full HARD RULES every turn — ETH Zurich evidence: breaks reasoning, +20% cost.
4. `grilling` skill auto-triggers, shadows `grill-with-docs` (near-duplicate).
5. `@hypabolic/pi-hypa` breaks multi-line bash (live bug).
6. `confirm-destructive` hard-blocks subagents (no UI → 'block') — deferred (correct safety behavior, separate concern).
7. 7 MongoDB skills all auto-trigger — resolved by enumeration cut (Section 3), true project-scoping deferred.

**Quantified evidence:** ETH Zurich "Evaluating AGENTS.md" (Feb 2026) — LLM context files reduce task success ~3%, raise inference cost 20%+, frontier models cliff at 150–200 instructions. Pocock ceiling ~16 skills; my-pi ships 53. Re-injecting full rules every turn = worst cell for reasoning tasks.

---

## Section 1 — coach.ts: regex → pure LLM judgment (dynamic discovery)

### Problem

`coach.ts` solves the developer-memory problem (aligned) but implements it via ~370 LOC hard-coded regex — `classify()` (lines 150–444, 21 intents) + `DOMAIN_SKILLS` (lines 51–104, 8 domains). This is the "treat the agent like a dumb junior, force it with tags" pattern the owner rejects. It also hard-codes the skill list, so adding a skill requires a code edit (violates requirement #2).

### Change

Replace the regex with a single `complete()` call per user input, feeding the **live** command list discovered via `pi.getCommands()`.

**Mechanism (the dynamic-discovery core):**

- `pi.getCommands()` returns `SlashCommandInfo[]` — every prompt, skill, and extension command with `name`, `description`, `source`. (Proof of pattern: `palette.ts:51` already uses this and documents "never drifts when prompts or skills are added.")
- Coach builds a compact catalog from the live list: `[{name, description, source}, ...]`.
- Coach calls `complete(deepseek-v4-flash, {system: catalog + instructions, user: userText})` — deepseek-v4-flash via `ctx.modelRegistry` (same pattern as `pi-web-access/summary-review.ts:291`).
- The LLM returns JSON: `{intent, suggestedCommand, skillHints, reason}`.
- Coach shows the existing `ui.select` suggestion (UX preserved); user taps Enter to accept (or picks "just do it" → `action: "continue"`).

**Why this satisfies both hard requirements:**

- *Dynamic discovery:* the catalog comes from `getCommands()` at call time. Add a skill → it appears in the catalog automatically → the LLM can route to it. Zero code/config edit.
- *0 phantoms:* `getCommands()` only returns commands that actually exist. The LLM can only pick from real commands. No hard-coded list can drift to phantoms.

**Skip logic (unchanged):** input starting with `/` (already a command) or `!` (raw mode) passes through with no LLM call.

**Error handling:** if the `complete()` call fails, times out (budget: 5s), or returns unparseable JSON → fall back to `action: "continue"` (pass-through "just do it"). Zero downtime — the agent still runs, just un-routed. Coach never blocks the user.

**LOC impact:** ~370 LOC regex → ~60 LOC (catalog builder + prompt + complete() call + existing ui.select plumbing).

**Model choice:** `deepseek-v4-flash` (grove-openai, $0.10/$0.21 per Mtok — cheapest in model list, in `enabledModels`). Configurable via a `coachModel` key in `~/.pi/agent/coach.json` (same pattern as `~/.pi/web-search.json`'s `summaryModel`), so the model isn't hard-coded. Default if file/key absent: `grove-openai/deepseek-v4-flash`.

---

## Section 2 — Activation flip: all 14 user-invoked skills → auto-decide

### Problem

14 skills carry `disable-model-invocation: true` — the model *cannot* invoke them; only the human typing the command can. This is the largest developer-memory load.

### Change

Remove `disable-model-invocation: true` from the SKILL.md frontmatter of all 14:
`bright-data-best-practices, compact-safe, grill-with-docs, handoff, implement, improve-codebase-architecture, setup-matt-pocock-skills, setup-pre-commit, teach, to-spec, to-tickets, triage, wizard, writing-great-skills`

### Why this is safe (the model still won't fire them randomly)

The skill *description* gates invocation. The model won't auto-fire `teach` unless the user says "teach me X"; won't fire `wizard` unless a manual setup procedure is described; won't fire `setup-pre-commit` unless pre-commit hooks are the topic. Removing the flag means the model *can* invoke when its judgment fits — exactly Pocock's "model-invoked skills fire automatically when the task fits."

### Dynamic-discovery interaction

With these flipped, the skills appear in `pi.getCommands()` (source: "skill") and are automatically in coach's catalog. No further hard-coding.

---

## Section 3 — AGENTS.md slim (152 → ~90 lines)

### Problem

AGENTS.md re-injects every turn (guardrails). Three sections are dead weight: the domain-skills enumeration (52 skills, 10 phantom — duplicates hermes's loaded descriptions), the slash-commands section (Coach routes these), and the pi-harness section (self-documenting via tools/status line).

### Change

**Cut:**

- Domain-skills enumeration (~40 lines) — hermes already loads skill descriptions into the system prompt; the prose copy is a stale second source and the origin of the 10 phantoms.
- Slash-commands section (~8 lines) — Coach routes dynamically.
- Pi-harness section (~10 lines) — discoverable via tools/status line.

**Keep:** 10-step workflow, working-style rules, subagent strategy, safety rules, external-tech validation.

### 0-phantom guarantee

With the enumeration cut, AGENTS.md no longer names any skill. Phantoms structurally cannot exist in AGENTS.md. The only skill references the agent sees are (a) the live hermes-loaded descriptions and (b) coach's live `getCommands()` catalog — both filesystem-derived, both real-only.

---

## Section 4 — grilling dedupe

### Problem

`grilling` (auto-trigger, 10 lines) is a near-duplicate of `grill-with-docs` (user-invoked, superset — grills AND creates docs). The auto-trigger version fires and gives the lesser outcome.

### Change

Remove the `grilling` skill. `grill-with-docs` (now auto-invocable per Section 2) is the single source. One skill, not two.

---

## Section 5 — Remove @hypabolic/pi-hypa

### Problem

`@hypabolic/pi-hypa` intercepts every bash command and breaks multi-line scripts (live bug this session: tries to start `#` as a process). It duplicates context-sidecar (oversized output) + observational-memory (compaction). Adds a bash-intercept gate and a failure point.

### Change

Remove `npm:@hypabolic/pi-hypa` from `settings.json` → `packages`. Remove any `hypa_*` references. One less bash-intercept handler on the `tool_call` event (reduces the 5-handler chain to 4: loop, confirm-destructive, rewind, lens).

---

## Section 6 — guardrails.ts: stop saturating reasoning every turn

### Problem

`guardrails.ts` injects the full HARD RULES block on every `before_agent_start`. ETH Zurich + SustainScore evidence: re-injecting full rules every turn breaks reasoning tasks and raises cost 20%+. The mechanism solves compaction-survival but causes saturation.

### Change

Modify `guardrails.ts`:

- Inject the **full** HARD RULES on `session_start` and `session_compact` (when context is genuinely lost).
- On every other `before_agent_start`, inject a **1-line reminder**: `⚡ AGENTS.md rules in effect — see session-start injection.`
- Solves the real problem (compaction-survival) without the per-turn reasoning-saturation cost.

---

## Section 7 — MongoDB skills (resolved via Section 3)

The 7 MongoDB skill descriptions still load via hermes (model can invoke when it detects Mongo work), but are no longer double-advertised in prose every turn (Section 3 cut). **True project-scoping (moving to per-project `.pi/skills/`) is deferred** — it adds complexity contrary to this plan's spirit, and the enumeration cut already removes the per-turn prose overhead.

---

## Data flow after changes

```
User input
  → coach.ts (input event)
  → skip if starts with "/" or "!"
  → catalog = pi.getCommands()              ← LIVE, dynamic
  → complete(deepseek-flash, {catalog, userText})   ← ~1s LLM
  → {intent, suggestedCommand, skillHints}
  → ui.select suggestion → user taps Enter → transform to slash command
     (or "just do it" → action: continue)
  → fallback on LLM failure/timeout: action: continue (never blocks)

Every turn:
  → guardrails before_agent_start
  → session_start or post-compact? → inject FULL HARD RULES
  → otherwise → inject 1-line reminder

Agent turn:
  → model sees all skill descriptions (14 formerly-user-invoked now auto-invocable)
  → invokes skills when judgment fits (teach only if asked, wizard only if manual setup)
```

---

## Hard-requirement verification

| Requirement | How it's satisfied |
| --- | --- |
| 0 phantom references | AGENTS.md stops naming skills (Section 3). Coach reads `getCommands()` live (Section 1). Only real skills can appear. Structurally guaranteed, not policed. |
| Add a new skill → it just works | New skill's SKILL.md is picked up by hermes (loaded into system prompt) AND appears in `pi.getCommands()` → coach's LLM catalog includes it automatically. Zero code/config edit. |
| Works perfectly / no breakage | Coach LLM failure → pass-through fallback (never blocks). Guardrails full-inject still fires on compaction (rules survive). All 5 extension hooks preserved. Loop/feature/fix chains untouched. |

---

## What is NOT changing (verified sound)

- 5-extension architecture (coach, guardrails, loop, handoff, palette).
- Loop engine, `/feature` `/fix` chains, `/loop` `/loop-status` `/loop-abort`.
- 10-step workflow + safety rules in AGENTS.md.
- Coach `ui.select` suggestion UX (user confirms with one tap).
- 14 → 15 packages: only hypa removed; no tool-name collisions (harmony-audit verified).
- confirm-destructive (correct safety behavior; subagent-block is a separate concern).

---

## File impact (7)

| # | File | Change |
| --- | --- | --- |
| 1 | `extensions/coach.ts` | Rewrite classifier: regex → `complete()` call with `getCommands()` catalog. ~370 LOC → ~60 LOC. |
| 2 | `extensions/guardrails.ts` | Conditional injection: full on session_start/compact, 1-line otherwise. |
| 3 | `config/agents.md` (deployed `~/.pi/agent/AGENTS.md`) | Cut domain-skills enum + slash-commands + pi-harness sections. 152 → ~90 lines. |
| 4 | `config/settings.json` | Remove `npm:@hypabolic/pi-hypa` from packages. |
| 5 | `skills/grilling/` | Remove skill. |
| 6 | 14 `SKILL.md` files | Remove `disable-model-invocation: true` line. |
| 7 | `README.md` | Update capability counts (publication-facing — must stay accurate: 53→52 skills, 15→14 packages, "agent decides" framing). |

---

## Testing

- **coach.ts:** load test (Pi starts, zero stderr). Manual: type a plain-English task → confirm LLM catalog call fires and ui.select appears. Type `/build ...` → confirm pass-through (no LLM call). Simulate LLM failure (bad model id) → confirm pass-through fallback. Add a dummy skill to `~/.pi/agent/skills/` → confirm it appears in coach's routing on next input without any code edit (validates dynamic discovery).
- **guardrails.ts:** start session → confirm full HARD RULES in system prompt. Run a turn → confirm 1-line reminder only. Trigger compaction → confirm full re-injection.
- **AGENTS.md:** `wc -l` ≤ ~95. Grep for skill names → none in the cut sections. Grep for the 10 phantom names → zero hits anywhere in the file.
- **Activation flip:** for each of the 14, grep SKILL.md → no `disable-model-invocation` line. Confirm skills appear in `pi.getCommands()` with source "skill".
- **hypa removal:** Pi starts clean, no `hypa: command not found` noise, multi-line bash runs unbroken.
- **grilling:** skill dir gone; `grill-with-docs` still present and auto-invocable.
- **Harmony re-check:** run the existing harmony-audit checklist — confirm no new tool/command collisions, no new event-handler conflicts.

---

## Out of scope / deferred

- `confirm-destructive` subagent-blocking (correct safety behavior; separate concern).
- True MongoDB project-scoping (Section 7 — resolved enough via enumeration cut).
- Loop engine simplification (stacked-not-replacing is noted but the loop itself is sound).
- Memory store cleanup (the 5000-char cap / SQLite ghost issue is a hermes tooling concern, not this plan).

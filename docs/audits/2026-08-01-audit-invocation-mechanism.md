# Audit: Skill Invocation Mechanism + Context Bloat Analysis

**Repo:** /Users/rom.iluz/Dev/my-pi (auto-pi)
**Date:** 2026-08-01
**Auditor:** review subagent (run e7691be9)

---

## 1. MECHANISM — How a skill actually gets loaded

### 1a. System prompt injection (always-on)

| Component | File | Bytes | Injected where |
| --- | --- | --- | --- |
| AGENTS.md | `config/agents.md` (symlink → `~/.ai/AGENTS.md`) | 12,817 | System prompt contextFile — EVERY turn |
| Guardrails HARD RULES block | `extensions/guardrails.ts` | ~3,700 (truncated to 3,500 chars + header) | System prompt — session_start + after auto-compaction |
| Skill catalog (descriptions) | All `SKILL.md` frontmatter `description` fields | ~32,890 (119 skills × ~276 bytes avg) | System prompt — every turn (main agent) |
| Tool definitions | Pi core + extensions | ~8,000 (estimated, ~15-20 tools) | System prompt — every turn |
| Pi core + memory policy | Pi harness | ~15,000 (estimated) | System prompt — every turn |

**AGENTS.md appears TWICE at session start:** once as a contextFile (full 12,817 bytes) and once as the guardrails HARD RULES block (truncated to 3,500 chars). This is intentional — `guardrails.ts:6-9` documents this as the "prominence tier" to defeat mid-session forgetting.

**Evidence:** `extensions/guardrails.ts:139-150` — `rulesBlock()` function truncates AGENTS.md to `maxChars: 3500` and prepends a header. `guardrails.ts:158-170` — `before_agent_start` handler appends `rulesBlock` to `event.systemPrompt`.

### 1b. Slash command pin (prompt template → mechanical skill injection)

**The pin is DETERMINISTIC and MECHANICAL.** When a user types `/plan`:

1. Pi loads `prompts/plan.md` (synced to `~/.pi/agent/prompts/plan.md`):

   ```yaml
   ---
   skill: planning-workflow
   ---
   Plan the following feature. Follow the `planning-workflow` skill...
   ```

2. The `pi-prompt-template-model` (PTM) extension reads the `skill:` frontmatter field.

3. PTM calls `resolveSkillMessage("planning-workflow", cwd)` (`index.ts:214-247`):
   - `resolveSkillPath()` searches in order (`prompt-loader.ts:2171-2186`):
     1. `<project>/.pi/skills/<name>/SKILL.md` (CONFIG_DIR_NAME = `.pi`)
     2. `.agents/skills/<name>/SKILL.md` walking ancestors to repo root
     3. `~/.pi/agent/skills/<name>/SKILL.md`
     4. `~/.agents/skills/<name>/SKILL.md`
   - For this repo, workflow skills resolve from `~/.agents/skills/<name>/SKILL.md` (4th priority — project `skills/` directory is the source, synced to `~/.agents/skills/`).

4. PTM reads the file with `readFileSync` (`prompt-loader.ts:2189-2191`), strips frontmatter, wraps in `<skill name="...">...</skill>`.

5. Stored as `pendingSkillMessage` (`index.ts:384`).

6. In `before_agent_start`, returned as `{ message: skillMessage }` (`index.ts:1673-1680`).

**CRITICAL:** The skill is injected as a **CONVERSATION MESSAGE**, not into the system prompt. The message has `customType: "skill-loaded"`, `display: true`, and `content: "<skill name=\"planning-workflow\">\n...\n</skill>"`.

**Evidence:** `pi-prompt-template-model/index.ts:228-240`:

```typescript
return {
    kind: "ready",
    message: {
        customType: "skill-loaded",
        content: `<skill name="${normalizedSkillName}">\n${skillContent}\n</skill>`,
        display: true,
        details: { skillName, skillContent, skillPath },
    },
};
```

### 1c. On-demand read (workflow says "read skills/X/SKILL.md")

**This is MODEL-DEPENDENT (probabilistic), not deterministic.**

The workflow skills contain instructions like:

- `planning-workflow/SKILL.md:80`: "read `/Users/rom.iluz/.agents/skills/brainstorming/SKILL.md` completely"
- `planning-workflow/SKILL.md:167`: "Reread this workflow skill after each phase + after compaction"
- `build-workflow/SKILL.md:54`: "Follow the diagnosing-bugs procedure"

These are natural-language instructions to the model. The model must:

1. Remember the instruction exists (it's in the pinned skill message, which may be far back in context)
2. Choose to call the `read` tool with the correct path
3. Actually follow the procedure after reading it

**There is no mechanical enforcement.** If the model skips the read, the specialist procedure is never loaded. The `trace.ts` extension calls this "Grade C" activation (`trace.ts:245-246`).

### 1d. Coach selection

**Coach is deterministic for workflow selection, probabilistic only for optional skill hints.**

`extensions/coach.ts:139-200` — Coach hooks the `input` event:

1. Intercepts every user input (unless prefixed with `!` for raw mode or `/` for commands)
2. Shows a **fixed 9-option menu** (`WORKFLOW_OPTIONS` array, `coach.ts:148-200`)
3. User picks one → Coach transforms input into the matching slash command (e.g. `/build "$TASK"`)
4. The LLM is used ONLY for `skillHints` (optional domain skill activation notes like MongoDB/Python) — non-blocking, with a timeout (`coach.ts:67-135`)

**The workflow selection is NEVER delegated to the LLM.** The user always picks from the fixed menu. If the LLM fails, the menu still shows (`coach.ts:237`).

**Evidence:** `coach.ts:9-12`:
> "The LLM is used ONLY for skillHints... The workflow selection itself is NEVER delegated to the LLM — the user always picks from the fixed menu."

---

## 2. CONTEXT BLOAT

### 2a. config/agents.md size

```
config/agents.md: 12,817 bytes (336 lines)
```

This is always injected as a contextFile in the system prompt. Additionally, `guardrails.ts` re-injects a truncated copy (3,500 chars) as the HARD RULES block at session start and after auto-compaction.

**Total AGENTS.md footprint at session start: ~16,317 bytes** (12,817 as contextFile + 3,500 as guardrails block).

### 2b. Total system-prompt size estimate (main agent, 119 skills in catalog)

| Component | Bytes | Tokens (~4 chars/tok) |
| --- | --- | --- |
| AGENTS.md (contextFile) | 12,817 | 3,204 |
| Guardrails HARD RULES block | 3,700 | 925 |
| Skill catalog (119 descriptions) | 32,890 | 8,223 |
| Tool definitions (~15-20 tools) | 8,000 | 2,000 |
| Pi core + memory policy | 15,000 | 3,750 |
| PTM run-prompt guidance | 200 | 50 |
| **TOTAL SYSTEM PROMPT** | **~72,607** | **~18,151** |

Plus the pinned workflow skill as a conversation message (not system prompt):
| Pinned skill (e.g. planning-workflow) | 12,345 | 3,086 |

**Total context at first turn: ~84,952 bytes = ~21,238 tokens**

### 2c. Context window consumption

| Model | Context window | System prompt % | First-turn total % |
| --- | --- | --- | --- |
| FW-GLM-5.2 (default) | 1,048,576 | 1.73% | 2.03% |
| FW-GLM-5.1 | 202,752 | 8.95% | 10.49% |
| 128K ctx model | 131,072 | 13.85% | 16.20% |

**At current default model (1M context), context bloat is NOT a near-term problem.** The system prompt consumes ~2% of the context window. Even with a 128K context model, it's ~16% — significant but not critical.

**However:** The skill catalog is the largest variable component. The trace data shows turns with 166 skills in the system prompt (`trace-2026-08-01.jsonl`). At 166 skills × 276 bytes = ~45,816 bytes = ~11,454 tokens, the skill catalog alone would consume ~8.7% of a 128K context window. With 131 skills total across all skill directories (`~/.agents/skills/` has 98, `~/.pi/agent/skills/` has 13, project has 21), the catalog is growing.

### 2d. When would the agent stop reliably invoking skills?

The risk is NOT context window exhaustion (at 1M tokens). The risk is **attention dilution** — the IFScale research cited in `guardrails.ts:38-43`:

> "arXiv 2507.11538 (IFScale — density decay, primacy effect, ~150-instruction ceiling)"

With 119 skill descriptions + 12,817 bytes of AGENTS.md + 3,700 bytes of guardrails rules + tool definitions, the system prompt contains **far more than 150 instructions**. The model's ability to reliably pick the right skill or follow the right rule degrades as the instruction count grows. This is a **quality problem, not a quantity problem** — the context window is large enough, but the model's attention is not.

The compaction threshold is set at `compactAfterTokensRatio: 0.4` (`settings.json`) = ~419K tokens for a 1M context model. The system prompt (~18K tokens) is never compacted. The conversation grows until 419K tokens, then compaction kicks in.

---

## 3. PROBABILISTIC VS DETERMINISTIC

### 3a. Three grades of skill activation (from `trace.ts:243-246`)

| Grade | Mechanism | Deterministic? | Count (all trace files) |
| --- | --- | --- | --- |
| A | `skill:` frontmatter pin (PTM mechanical injection) | YES — file read via `readFileSync` | 73 |
| B | `/skill:name` command (PTM mechanical injection) | YES — same mechanism | (included in 73) |
| C | Model reads `SKILL.md` via `read` tool | NO — model must choose to call `read` | 318 |

**Total skill loads across all trace files: 391**

- **Deterministic (Grade A/B): 73 = 18.7%**
- **Probabilistic (Grade C): 318 = 81.3%**

### 3b. Where the gap is

The **initial workflow skill load is deterministic** (Grade A — the pin fires mechanically). But everything after that is probabilistic:

1. **Specialist reads** ("read skills/brainstorming/SKILL.md") — the workflow instructs the model to read the specialist, but the model must choose to call `read`. **100% model-dependent.**

2. **Workflow rereads** ("reread this workflow skill after each phase") — the workflow instructs the model to re-read itself between phases. **100% model-dependent.** Trace data shows `build-workflow` was mechanically injected 20 times but model-read 19 times — the 19 reads are the "reread" instruction being followed, but there's no guarantee it happens every time.

3. **Post-compaction rereads** ("reread this workflow skill after compaction") — the workflow instructs the model to re-read after compaction. **100% model-dependent.** After compaction, the original skill message is gone from the conversation. The model must notice it's in a workflow and re-read the skill. This is the most fragile point.

4. **Conditional specialist reads** (e.g. "if style: grilling → read grilling/SKILL.md") — the model must evaluate the condition and choose to read. **100% model-dependent.**

### 3c. Concrete failure modes

- **Model skips specialist read:** The workflow says "read brainstorming/SKILL.md" but the model proceeds without reading it. The brainstorming procedure is never loaded. The model improvises.
- **Model reads wrong skill:** The model reads a skill with a similar name but wrong content.
- **Model reads skill but doesn't follow it:** The model reads the specialist but ignores its procedure, following its own approach instead.
- **Model doesn't reread the workflow after compaction:** After compaction, the workflow state block and skill content are gone. The model doesn't re-read the workflow skill and loses the orchestration thread.
- **Model reads skill too late:** The model reads the specialist after already doing work that should have followed the specialist's procedure.

**The `trace.ts` extension was built specifically to make this gap visible** (`trace.ts:30-35`):
> "8 audits found ~72 skills discoverable but only 6 force-activated via prompt skill: pins. The rest are catalog orphans."

---

## 4. COMPACTION

### 4a. What survives compaction

| Component | Survives compaction? | Mechanism |
| --- | --- | --- |
| AGENTS.md (contextFile) | **YES** | Pi re-injects contextFiles into every system prompt |
| Guardrails HARD RULES block | **YES** | `guardrails.ts:176-179` — `session_compact` handler sets `fullInjectNext = true` for auto-compaction, triggering full re-injection on next `before_agent_start` |
| Skill catalog (descriptions) | **YES** | Part of system prompt, always re-injected |
| Tool definitions | **YES** | Part of system prompt, always re-injected |
| Pi core + memory policy | **YES** | Part of system prompt, always re-injected |
| **Pinned workflow skill message** | **NO** | Conversation message — compacted away with conversation history |
| **Workflow state block** | **NO** | Conversation message — compacted away |
| **Specialist skills read via `read` tool** | **NO** | Tool output in conversation — compacted away |
| **Conversation context** | **NO** (summarized) | Replaced by compaction summary |

### 4b. The compaction recovery gap

After compaction, the system prompt is fully restored (AGENTS.md, guardrails, catalog, tools). But the **entire workflow context is gone**:

- The pinned skill message (with the full workflow procedure) is compacted
- The state block (tracking which phase we're in) is compacted
- Any specialist skills that were read are compacted
- The conversation context is summarized

The only recovery mechanism is the workflow skill's instruction: **"reread this workflow skill after compaction"**. This is a model instruction in the AGENTS.md (`config/agents.md:48-50`):
> "Compaction is a residual risk. The state block is best-effort in normal context. If the state is lost, reconstruct from conversation artifacts (spec URL, commit hash, test output). Do not guess."

And in each workflow skill (e.g. `planning-workflow/SKILL.md:167`):
> "Reread this workflow skill after each phase + after compaction (if you detect the context was lost, reread `/Users/rom.iluz/.agents/skills/planning-workflow/SKILL.md`)."

**But this instruction is in the workflow skill, which was compacted away.** After compaction, the model sees:

1. The system prompt (AGENTS.md mentions compaction as a risk, but doesn't say which workflow was active)
2. The compaction summary (may or may not mention the active workflow)
3. No skill content, no state block

The model must:

1. Recognize it was in a workflow
2. Know which workflow it was
3. Know the path to re-read the workflow skill
4. Choose to call `read` with that path
5. Reconstruct the state block from artifacts

**This is a multi-step probabilistic chain.** If any step fails, the workflow is silently abandoned.

### 4c. Manual vs auto-compaction

`guardrails.ts:177-179` distinguishes:

- **Auto-compaction** (context overflow): triggers full guardrails re-injection
- **Manual `/compact`**: user-initiated, only gets a 1-line reminder next turn

The workflow skill recovery instruction applies to both, but manual compaction gets less prominent guardrails reinforcement.

---

## 5. FRANK ASSESSMENT — Where invocation could silently fail

### HIGH RISK: Post-compaction workflow recovery (probabilistic multi-step chain)

After compaction, the entire workflow context is gone. Recovery depends on the model:

1. Recognizing it was in a workflow
2. Knowing which workflow and its file path
3. Choosing to re-read the skill
4. Reconstructing state from artifacts

**No mechanical safety net.** The AGENTS.md mentions compaction as a risk, but the specific workflow path and phase state are in the compacted conversation. If the compaction summary doesn't preserve "you are in planning-workflow, phase: to-spec", the model may not recover.

**Mitigation:** The workflow skills say to reconstruct from artifacts (spec URL, commit hash). This works IF artifacts were produced. In early phases (brainstorming, before spec), there may be no artifacts to reconstruct from.

### MEDIUM RISK: Specialist skill reads (81.3% of all loads are model-dependent)

The workflow instructs the model to read specialist skills, but there's no enforcement. If the model skips a read:

- It improvises the specialist's procedure
- It may produce lower-quality output
- There's no error or warning — the failure is silent

**The `trace.ts` extension makes this visible retroactively** (you can see which skills were never read), but it doesn't prevent the failure.

### MEDIUM RISK: Skill catalog bloat (119+ descriptions in system prompt)

With 131 skills total (98 in `~/.agents/skills/`, 13 in `~/.pi/agent/skills/`, 21 in project), the skill catalog in the system prompt is ~33KB. This is within the context window but exceeds the ~150-instruction ceiling from IFScale research. The model may not reliably surface the right skill from the catalog.

**Note:** This only affects on-demand skill discovery (when the model needs to pick a skill from descriptions). The workflow pin mechanism bypasses this — the skill is loaded mechanically regardless of catalog size.

### LOW RISK: AGENTS.md duplication (12,817 + 3,500 bytes)

AGENTS.md appears twice in the system prompt at session start. This is intentional (guardrails prominence tier) and well-researched (ETH Zurich study cited). The cost is ~4K tokens — negligible at 1M context.

### LOW RISK: Coach failure

Coach's LLM skillHints can fail (timeout, API error), but the menu still shows. The workflow selection is always user-driven. **Not a silent failure point.**

### STRUCTURAL RISK: No skill-injector.ts exists

The task asked about `extensions/skill-injector.ts` — this file does not exist. Skill injection is handled by the `pi-prompt-template-model` npm package (`~/.pi/agent/npm/node_modules/pi-prompt-template-model/`), not a project-local extension. This means:

- The injection mechanism is in a third-party package, not in the repo
- The repo cannot modify the injection behavior
- Any changes to skill loading require changes to the PTM package

---

## 6. SUMMARY VERDICT

1. **The initial skill load is deterministic** (PTM reads the file mechanically via `skill:` frontmatter pin), but **everything after that — specialist reads, workflow rereads, post-compaction recovery — is probabilistic** (81.3% of all skill loads are model-dependent `read` tool calls).

2. **Context bloat is not a near-term capacity problem** (~2% of 1M context window), but it IS an attention quality problem (119+ skill descriptions + 12,817 bytes of AGENTS.md + guardrails block exceeds the ~150-instruction attention ceiling from IFScale research).

3. **Compaction is the single biggest silent-failure risk**: the pinned workflow skill, state block, and all specialist reads are conversation messages that get compacted away. Recovery depends on a multi-step probabilistic chain (recognize → know path → re-read → reconstruct state) with no mechanical safety net.

---

## Appendix: File measurements

| File | Bytes |
| --- | --- |
| `config/agents.md` | 12,817 |
| `config/workflow-graph-contract.ts` | 72,241 (NOT injected — test/validation only) |
| `config/settings.json` | 2,179 |
| `config/models.json` | 13,429 |
| `extensions/coach.ts` | 11,124 |
| `extensions/guardrails.ts` | 9,942 |
| `extensions/handoff.ts` | 7,100 |
| `extensions/palette.ts` | 7,021 |
| `extensions/session-status.ts` | 6,970 |
| `extensions/trace.ts` | 14,380 |
| `prompts/build.md` | 274 |
| `prompts/debug.md` | 319 |
| `prompts/plan.md` | 311 |
| `prompts/research.md` | 344 |
| `prompts/review.md` | 292 |
| `prompts/setup-audit.md` | 862 |
| `prompts/ship.md` | 255 |
| `prompts/triage.md` | 1,093 |
| `skills/planning-workflow/SKILL.md` | 12,345 |
| `skills/build-workflow/SKILL.md` | 5,532 |
| `skills/debug-workflow/SKILL.md` | 3,195 |
| `skills/research-workflow/SKILL.md` | 3,499 |
| `skills/review-workflow/SKILL.md` | 4,453 |
| `skills/ship-workflow/SKILL.md` | 4,933 |

### Trace data summary (all trace files, 421 turns)

| Metric | Value |
| --- | --- |
| Total turns logged | 421 |
| Skill activations (model read, Grade C) | 318 |
| Skill injections (PTM mechanical, Grade A/B) | 73 |
| Deterministic ratio | 18.7% |
| Max skills in system prompt (single turn) | 166 |
| Average skills in system prompt | 82.7 |
| Most-read skill (model) | tdd (27×) |
| Most-injected skill (mechanical) | review-workflow (22×) |

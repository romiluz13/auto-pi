---
name: planning-workflow
description: "Plan a feature end-to-end — classify bounded vs foggy, then orchestrate brainstorming → to-spec → to-tickets (bounded) or wayfinder (foggy). The user types /plan once; this workflow skill reads each specialist in turn and routes between phases. Use for any new feature or design work."
---

# Planning Workflow

You are the planning workflow orchestrator. The user typed `/plan` once. You orchestrate the phases by reading each specialist skill in turn, rereading this workflow between phases. The user never types internal skill commands — you handle the routing.

## State protocol

**At entry:** initialize the state block and print it.
**Before every user wait:** emit the current state block.
**On every continuation:** read the latest state block from the conversation. If missing or ambiguous, STOP — reconstruct from conversation artifacts (spec URL, ticket refs). Never guess.
**Before each phase transition:** update the state block, then reread this workflow skill.

All skill paths are absolute canonical: `/Users/rom.iluz/.agents/skills/<name>/SKILL.md`.

## State block (bounded)

```
workflow: plan
mode: bounded
phase: setup | brainstorm | spec | tickets | complete
design: pending | approved
style: brainstorming | grilling | not-applicable
domain capture: off | on | not-applicable
domain artifacts: none | none-needed | not-applicable | [<CONTEXT/ADR refs>]
prototype: not-needed | proposed | declined | running | complete
prototype question: not-applicable | <question>
prototype conclusion: pending | not-applicable | <conclusion>
unresolved design uncertainty: none | <text>
resume phase: not-applicable | brainstorm
spec: pending | not-applicable | <tracker reference>
tickets: pending | not-applicable | [<references>]
frontier: pending | not-applicable | <first unblocked ticket>
```

## State block (foggy)

```
workflow: plan
mode: foggy
phase: wayfind | complete
map: pending | <reference>
wayfind frontier: pending | [<refs>]
outcome: map-charted | decision-resolved | ready-for-brainstorm | ready-for-spec
```

## Phase: classify

Read the task. Is it bounded or foggy?

- **Bounded** (can design in one session, the idea is clear enough to brainstorm) → set `mode: bounded`, go to **setup**.
- **Foggy** (too large or unclear for one planning session, greenfield or huge) → set `mode: foggy`, go to **wayfind**.

## Phase: setup (bounded only, after classify)

**Choose the conversational style:**

- Default: `style: brainstorming` (collaborative dialogue, design approval).
- If the user explicitly asks to grill / stress-test / relentless interview → `style: grilling`.
- If the agent detects high ambiguity that would benefit from grilling → explain why briefly and **ask permission once**. If yes → `style: grilling`. If no → `style: brainstorming`. Never silently switch to grilling — it's a high-friction transition that requires explicit user consent.

**Decide the durable domain capture:**

- Default: `domain capture: off`.
- Set `domain capture: on` when these triggers apply:
  - ambiguous/overloaded domain terms materially affect the design;
  - existing CONTEXT.md / ADRs constrain the change;
  - cross-module / domain contracts are being changed;
  - a hard-to-reverse, surprising trade-off with genuine alternatives is likely;
  - the user explicitly asks to document / stress-test with durable records.
- No ceremony merely because the domain is "complex" — `domain-modeling`'s own thresholds constrain: glossary updates only when terminology is actually resolved; ADR only when hard-to-reverse + surprising + genuine trade-off.

Emit the state block. Reread this workflow skill. Go to **brainstorm**.

## Phase: brainstorm (bounded only)

1. If `style: grilling` → read `/Users/rom.iluz/.agents/skills/grilling/SKILL.md` completely and run the grilling interview (relentless, one question at a time, with your recommended answer for each). If `style: brainstorming` → read `/Users/rom.iluz/.agents/skills/brainstorming/SKILL.md` completely and follow the brainstorming procedure (collaborative dialogue, questions one at a time, 2-3 approaches, present design, get approval). Do NOT preload both — read only the active style's skill.
   - **No-codebase grilling branch:** if `style: grilling` AND there is no repository/codebase (the planning work is outside a repo, not just `git rev-parse` failure) → read `/Users/rom.iluz/.agents/skills/grill-me/SKILL.md` instead of `grilling`. `grill-me` is the stateless version (saves nothing locally, builds no CONTEXT.md). Do NOT auto-use `grill-me` merely because cwd lacks git — "no codebase" is semantic (planning something outside a repo).
2. If `domain capture: on` → read `/Users/rom.iluz/.agents/skills/domain-modeling/SKILL.md` and use it as an underlay: resolve domain terms into a glossary (only when terminology is actually resolved), write ADRs (only when hard-to-reverse + surprising + genuine trade-off). The durable records (CONTEXT.md, ADRs) survive the planning session. Record the artifacts: set `domain artifacts: [<refs>]` or `none-needed` (with rationale) if no durable artifact was warranted.
3. **Ignore specialist routing prose** ("invoke /skill:to-spec", "terminal state"). This workflow owns the routing — the specialist owns only the procedure.
4. When the user explicitly approves the design → set `design: approved`.
5. Emit the state block. Reread this workflow skill.
6. Go to **spec**.

**Do NOT advance before explicit design approval in the conversation.**

## Prototype interrupt (available from brainstorm or grill)

During the design phase, if a material question cannot be settled by reasoning or evidence alone (it needs a runnable answer — state logic, a UI you have to see, business logic behavior):

1. Explain the design question the prototype would answer, and **ask permission once**. This is a high-friction transition (discussion → runnable code) that requires explicit user consent.
2. If the user **declines** → record the uncertainty in the state block and continue or stop. Do NOT pretend the question was resolved.
3. If the user **approves** →
   - Checkpoint the current design state (update the state block with the current design progress).
   - Read `/Users/rom.iluz/.agents/skills/prototype/SKILL.md` completely.
   - Build the throwaway answer (one command, no persistence, no polish — the prototype skill's rules).
   - Capture the conclusion (the verdict + the question it settled).
   - Delete or isolate the prototype code (keep only the validated decision).
   - Reread this workflow skill.
   - Resume the same design phase (brainstorm or grill) with the conclusion.
4. Handoff to a fresh session only if context pressure or isolation demands it. Do not mechanically handoff every small prototype.

## Phase: spec (bounded only, after design approval)

**Smart-zone checkpoint:** before starting the spec phase, assess the context window. If the session is approaching the smart zone (~120k tokens), STOP — tell the user: "This session is approaching the context limit. Type `/handoff` to save the context, then start fresh with `/plan <handoff>` to continue planning." Do NOT push on degraded — the spec and tickets must build on the same thinking as the design. This is an exceptional boundary, not a normal phase transition — most plans complete in one session without hitting it.

1. Read `/Users/rom.iluz/.agents/skills/to-spec/SKILL.md` completely.
2. Follow the to-spec procedure: synthesize the approved conversation into a tracker spec.
3. Complete the internal seam-confirmation step (a valid procedure-internal human gate).
4. Publish the spec. Set `spec: <reference>`.
5. Emit the state block. Reread this workflow skill.
6. Go to **tickets**.

**Do NOT advance without a spec reference** (issue URL, file path, or tracker number).

## Phase: tickets (bounded only, after spec)

1. Read `/Users/rom.iluz/.agents/skills/to-tickets/SKILL.md` completely.
2. Follow the to-tickets procedure: break the spec into tracer-bullet tickets.
3. Complete the ticket-breakdown approval step (a valid procedure-internal human gate).
4. Publish the tickets. Set `tickets: [<references>]`, `frontier: <first unblocked ticket>`.
5. Emit the state block. Reread this workflow skill.
6. Go to **complete**.

**Do NOT advance without published ticket references and an identified frontier.**

## Phase: wayfind (foggy only)

1. Read `/Users/rom.iluz/.agents/skills/wayfinder/SKILL.md` completely.
2. Follow the wayfinder procedure: chart a map of decision tickets, resolve them one at a time across sessions. Wayfinder produces decisions/a map, not a spec.
3. Wayfinder works at most one non-research ticket per session. Do NOT try to run an entire foggy effort in one invocation.
4. Set `map: <reference>`, `wayfind frontier: [<refs>]`.
5. Emit the state block. Reread this workflow skill.
6. Route based on the actual outcome:
   - `outcome: map-charted` → go to **complete** (the map is the deliverable; planning pauses until the next session).
   - `outcome: decision-resolved` → stay in wayfind or go to **complete** based on whether the destination is clear.
   - `outcome: ready-for-brainstorm` → set `mode: bounded`, go to **setup** (NOT directly to brainstorm — the setup phase must initialize `style` and `domain capture` before the design phase).
   - `outcome: ready-for-spec` → set `mode: bounded`, `design: approved` (the wayfinder's decisions ARE the approved design), `style: not-applicable`, `domain capture: not-applicable`, `domain artifacts: not-applicable` (the design is already resolved by the wayfinder's decisions; spec synthesis does not need a style or domain capture), go to **spec**.
   - Do NOT blindly force spec/tickets.

## Phase: complete (bounded)

Finish with: spec URL, ticket URLs, first unblocked ticket (the frontier).

Tell the user: "Planning complete. Spec: <URL>. Tickets: <URLs>. First unblocked ticket: <frontier>. Each ticket is a separate build session — start fresh for each one. Next: type `/build <frontier>` in a fresh session to start implementation."

## Phase: complete (foggy)

Finish with: map reference, wayfind frontier, outcome.

Tell the user (based on the outcome):

- `outcome: map-charted` → "Planning (foggy) complete. Map: <reference>. Frontier: <refs>. Next: type `/plan <map>` to resume planning from the map."
- `outcome: decision-resolved` → "Planning (foggy) complete. Map: <reference>. Decisions resolved. Next: type `/plan <map>` to resume, or continue wayfinding if the destination is still unclear."
- `outcome: ready-for-brainstorm` → (already routed to brainstorm internally — this completion is not reached)
- `outcome: ready-for-spec` → (already routed to spec internally — this completion is not reached)

Do NOT suggest `/build` from foggy completion — a map is not an implementation ticket. `/build` requires a ready ticket, which the foggy state does not track.

## Rules

- **The workflow owns the routing.** Specialist skills own the procedure. Do not follow specialist routing prose — this workflow determines the next phase.
- **Reread this workflow skill** after each phase + after compaction (if you detect the context was lost, reread `/Users/rom.iluz/.agents/skills/planning-workflow/SKILL.md`).
- **Never ask the user to type an internal `/skill:*` command.** The user typed `/plan`; you handle the rest.
- **Do not advance without explicit evidence** (design approval, spec reference, ticket references + frontier, or wayfinder map + outcome).
- **Follow only the active phase's specialist.** Do not preload other specialists.
- **State is grounded in artifacts** (spec URL, ticket refs, map reference), not freeform memory.
- **Compaction is a residual risk.** The state block is best-effort in normal context. If the state is lost after compaction, reconstruct from conversation artifacts. Do not guess.

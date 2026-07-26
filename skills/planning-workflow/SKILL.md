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
phase: brainstorm | spec | tickets | complete
design: pending | approved
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

- **Bounded** (can design in one session, the idea is clear enough to brainstorm) → set `mode: bounded`, go to **brainstorm**.
- **Foggy** (too large or unclear for one planning session, greenfield or huge) → set `mode: foggy`, go to **wayfind**.

## Phase: brainstorm (bounded only)

1. Read `/Users/rom.iluz/.agents/skills/brainstorming/SKILL.md` completely.
2. Follow the brainstorming procedure: explore context, ask questions one at a time, propose 2-3 approaches, present the design, get user approval.
3. **Ignore brainstorming's routing prose** ("invoke /skill:to-spec", "terminal state"). This workflow owns the routing — brainstorming owns only the procedure.
4. When the user explicitly approves the design → set `design: approved`.
5. Emit the state block. Reread this workflow skill.
6. Go to **spec**.

**Do NOT advance before explicit design approval in the conversation.**

## Phase: spec (bounded only, after design approval)

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
   - `outcome: ready-for-brainstorm` → set `mode: bounded`, go to **brainstorm**.
   - `outcome: ready-for-spec` → set `mode: bounded`, go to **spec**.
   - Do NOT blindly force spec/tickets.

## Phase: complete (bounded)

Finish with: spec URL, ticket URLs, first unblocked ticket (the frontier).

Tell the user: "Planning complete. Spec: <URL>. Tickets: <URLs>. First unblocked ticket: <frontier>. Next: type `/build <frontier>` to start implementation."

## Phase: complete (foggy)

Finish with: map reference, wayfind frontier, outcome.

Tell the user: "Planning (foggy) complete. Map: <reference>. Frontier: <refs>. Outcome: <outcome>. Next: <based on outcome — type `/plan` to resume, or `/build` if the destination is clear>."

## Rules

- **The workflow owns the routing.** Specialist skills own the procedure. Do not follow specialist routing prose — this workflow determines the next phase.
- **Reread this workflow skill** after each phase + after compaction (if you detect the context was lost, reread `/Users/rom.iluz/.agents/skills/planning-workflow/SKILL.md`).
- **Never ask the user to type an internal `/skill:*` command.** The user typed `/plan`; you handle the rest.
- **Do not advance without explicit evidence** (design approval, spec reference, ticket references + frontier, or wayfinder map + outcome).
- **Follow only the active phase's specialist.** Do not preload other specialists.
- **State is grounded in artifacts** (spec URL, ticket refs, map reference), not freeform memory.
- **Compaction is a residual risk.** The state block is best-effort in normal context. If the state is lost after compaction, reconstruct from conversation artifacts. Do not guess.

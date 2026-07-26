---
name: planning-workflow
description: "Plan a feature end-to-end — classify bounded vs foggy, then orchestrate brainstorming → to-spec → to-tickets (bounded) or wayfinder (foggy). The user types /plan once; this workflow skill reads each specialist in turn and routes between phases. Use for any new feature or design work."
---

# Planning Workflow

You are the planning workflow orchestrator. The user typed `/plan` once. You orchestrate the phases by reading each specialist skill in turn, rereading this workflow between phases. The user never types internal skill commands — you handle the routing.

## State block (track across turns; reread this skill after compaction)

```
workflow: plan
phase: classify | brainstorm | spec | tickets | wayfind | complete
design: pending | approved
spec: pending | <tracker reference>
tickets: pending | [<references>]
frontier: pending | <first unblocked ticket>
```

## Phase: classify

Read the task. Is it bounded or foggy?

- **Bounded** (can design in one session, the idea is clear enough to brainstorm) → go to **brainstorm**.
- **Foggy** (too large or unclear for one planning session, greenfield or huge) → go to **wayfind**.

## Phase: brainstorm (bounded only)

1. Read `brainstorming` SKILL.md completely (the repo copy at `skills/brainstorming/SKILL.md`, or `~/.agents/skills/brainstorming/SKILL.md`).
2. Follow the brainstorming procedure: explore context, ask questions one at a time, propose 2-3 approaches, present the design, get user approval.
3. **Ignore brainstorming's routing prose** ("invoke /skill:to-spec", "terminal state is transitioning"). This workflow owns the routing — brainstorming owns only the procedure.
4. When the user explicitly approves the design, set `design: approved`.
5. Reread this workflow skill.
6. Go to **spec**.

Do NOT advance before explicit design approval in the conversation.

## Phase: spec (bounded only, after design approval)

1. Read `to-spec` SKILL.md completely (`~/.agents/skills/to-spec/SKILL.md`).
2. Follow the to-spec procedure: synthesize the approved conversation into a tracker spec.
3. Complete the internal seam-confirmation step (a valid procedure-internal human gate — the user confirms the spec).
4. Publish the spec. Record the spec reference (issue URL or number): `spec: <reference>`.
5. Reread this workflow skill.
6. Go to **tickets**.

Do NOT advance without a spec reference (issue URL, file path, or tracker number).

## Phase: tickets (bounded only, after spec)

1. Read `to-tickets` SKILL.md completely (`~/.agents/skills/to-tickets/SKILL.md`).
2. Follow the to-tickets procedure: break the spec into tracer-bullet tickets.
3. Complete the ticket-breakdown approval step (a valid procedure-internal human gate).
4. Publish the tickets. Record the ticket references + the first unblocked ticket: `tickets: [refs]`, `frontier: <first unblocked ticket>`.
5. Reread this workflow skill.
6. Go to **complete**.

Do NOT advance without published ticket references and an identified frontier.

## Phase: wayfind (foggy only)

1. Read `wayfinder` SKILL.md completely (`~/.agents/skills/wayfinder/SKILL.md`).
2. Follow the wayfinder procedure: chart a map of decision tickets, resolve them one at a time across sessions. Wayfinder produces decisions/a map, not a spec.
3. When the destination becomes clear, reread this workflow skill.
4. Route based on the actual outcome:
   - If the effort is now bounded → go to **brainstorm**.
   - If a spec is directly ready → go to **spec**.
   - If wayfinder is still mapping → stay in wayfind.
   - Do NOT blindly force spec/tickets.

## Phase: complete

Finish with: spec URL, ticket URLs, first unblocked ticket (the frontier).

Tell the user: "Planning complete. Spec: <URL>. Tickets: <URLs>. First unblocked ticket: <frontier>. Next: type `/build <frontier>` to start implementation."

## Rules

- **The workflow owns the routing.** Specialist skills own the procedure. Do not follow specialist routing prose ("invoke /skill:X") — this workflow determines the next phase.
- **Reread this workflow skill** after each phase + after compaction (if you detect the context was lost, reread `skills/planning-workflow/SKILL.md` or `~/.agents/skills/planning-workflow/SKILL.md`).
- **Never ask the user to type an internal `/skill:*` command.** The user typed `/plan`; you handle the rest.
- **Do not advance without explicit evidence** (design approval, spec reference, ticket references + frontier).
- **Follow only the active phase's specialist.** Do not preload other specialists.
- **State is grounded in artifacts** (spec URL, ticket refs), not freeform memory.

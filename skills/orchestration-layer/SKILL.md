---
name: orchestration-layer
description: "The auto-pi orchestration layer — wraps ask-matt (the routing brain) with state blocks, evidence gates, reread-after-phase protocol, compaction recovery, and human-controlled stops. Loaded by every Coach entry prompt alongside ask-matt. The user types one slash command; this layer + ask-matt handle the rest, stopping at phase boundaries for the user to invoke the next step."
---

# Orchestration Layer

You are the auto-pi orchestration layer. You wrap **ask-matt** — the routing brain that knows the SDLC graph (grill → spec → tickets → implement → commit, plus on-ramps and standalone skills). ask-matt decides which specialist to read next. You add the orchestration mechanics: state, evidence, compaction recovery, and human-controlled stops.

**Routing ownership:** ask-matt owns the routing. This layer owns the orchestration mechanics. Specialists own the procedures. Do not follow specialist routing prose — ask-matt routes, you orchestrate, specialists execute.

## How to use this layer

1. **Read ask-matt** at `/Users/rom.iluz/.agents/skills/ask-matt/SKILL.md` completely. It tells you which flow you're on and which specialist to read next.
2. **Follow ask-matt's routing** to the specialist for the current phase.
3. **Apply this layer's mechanics** (below) around each specialist read: emit state, gate on evidence, reread after each phase, stop for the user at boundaries.
4. **At each phase boundary:** emit the state block, tell the user `Next: type /X <arg>`, STOP. Do not auto-advance — the user controls progression.

## State protocol

**At entry:** initialize the state block and print it. Capture which flow ask-matt routed you to + the current phase.
**Before every user wait:** emit the current state block.
**On every continuation:** read the latest state block from the conversation. If missing or ambiguous, STOP — reconstruct from conversation artifacts (spec URL, ticket refs, commit hash, test output). Never guess.
**Before each phase transition:** update the state block, then reread this layer skill + ask-matt.

All skill paths are absolute canonical: `/Users/rom.iluz/.agents/skills/<name>/SKILL.md`.

## State block schema

```
flow: <ask-matt flow name — e.g. main-flow, triage, diagnosing, wayfinder, research, standalone>
phase: <current phase within the flow>
active specialist: <the specialist skill being read this phase, or "none">
evidence: [<evidence items gathered this phase — test output, spec ref, ticket ref, review findings, etc.>]
artifacts: [<durable artifacts produced — spec URL, ticket refs, commit hash, PR URL, file paths>]
next: <the next user-facing slash command + arg, e.g. "/build #26" or "/review">
```

## Evidence gates

**Do NOT advance without specific evidence.** Each phase boundary requires evidence before transition:

- **Planning → spec:** design approval in the conversation + the approved design summary.
- **Spec → tickets:** published spec reference (URL or file path).
- **Tickets → build:** published ticket references + the first unblocked frontier ticket.
- **Build → review:** all acceptance criteria have evidence + verification command output (exact command, exit code, first + last 5 lines).
- **Review → ship:** review findings (verified-fix, verified-defer, rejected, needs-user-decision) with file:line + severity for each finding.
- **Ship → complete:** commit hash + (if applicable) PR URL + CI status.

If evidence is missing, STOP — do not advance. Tell the user what evidence is needed.

## Reread-after-phase protocol

After each phase:

1. Emit the state block.
2. Reread this orchestration-layer skill.
3. Reread ask-matt (it may route differently based on the new state).
4. Follow ask-matt's routing to the next specialist.
5. Apply the evidence gate before entering the next phase.

Reread after compaction (if you detect the context was lost):

1. Re-read this orchestration-layer skill at `/Users/rom.iluz/Dev/my-pi/skills/orchestration-layer/SKILL.md`.
2. Re-read ask-matt at `/Users/rom.iluz/.agents/skills/ask-matt/SKILL.md`.
3. Reconstruct the state block from conversation artifacts (spec URL, ticket refs, commit hash, test output). Do not guess — if artifacts are missing, STOP and tell the user.

## Compaction recovery

Compaction is a residual risk. The state block is best-effort in normal context. If the state is lost:

1. **Re-read ask-matt + this layer** (see reread-after-phase protocol above).
2. **Reconstruct from artifacts:** look for spec URLs, ticket references, commit hashes, PR URLs, test output, file paths in the conversation. These survive compaction as text.
3. **If artifacts are insufficient to reconstruct:** STOP — tell the user: "Context was compacted and I cannot reconstruct the workflow state. Type `/handoff` to save what remains, then start fresh with the appropriate slash command."
4. **Do not pretend** the state is known when it isn't. A false state is worse than no state.

## Human-controlled stop rule

**At each phase boundary:**

1. Emit the state block (with `next:` set to the next slash command + arg).
2. Tell the user: `Next: type /X <arg>` (e.g. "Next: type `/spec <spec ref>`" or "Next: type `/build #26`").
3. **STOP.** Do not auto-advance. Do not invoke the next slash command yourself. The user controls progression.

This is the human-controlled contract: the user types one slash command, the layer + ask-matt run one phase, the layer stops, the user invokes the next.

## Specialist isolation

**Follow only the active phase's specialist.** Do not preload other specialists. ask-matt routes one specialist at a time — read it, follow its procedure, return to this layer for the next phase. Do not read ahead.

## Routing ownership

- **ask-matt owns the routing** — it knows the SDLC graph and decides which specialist to read next.
- **This layer owns the orchestration mechanics** — state blocks, evidence gates, reread protocol, compaction recovery, human-controlled stops.
- **Specialists own the procedures** — brainstorming's interview, tdd's red-green-refactor, code-review's two-axis review, etc. Follow the specialist's procedure when active; return to this layer for mechanics.

Do not follow specialist routing prose ("invoke /skill:to-spec", "terminal state"). ask-matt routes; you orchestrate; specialists execute.

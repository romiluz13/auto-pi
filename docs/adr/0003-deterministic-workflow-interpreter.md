# ADR 0003: Deterministic Workflow Interpreter

**Date:** 2026-08-12
**Status:** Accepted for reducer/journal; streaming continuation superseded by ADR 0004
**Supersedes:** prompt-only transition mechanics in auto-pi v0.4 and ADR 0001's removed subprocess loop implementation

## Context

Hybrid-Search-RAG issue #7 exposed a structural loop. `/plan` routed to Wayfinder, Wayfinder processed one decision per session, and `orchestration-layer` required a human-entered slash command at every boundary. The run repeatedly emitted `next: /plan <issue #7>` even though re-entry supplied no new authority or evidence.

The v0.4 graph contract was explicitly non-executable and its tests mostly checked Markdown structure. Conversation-local state could not mechanically reject an illegal transition, a missing command such as `/spec`, an early commit, or a duplicate progress state.

Four independent designs were evaluated:

1. prompt-only autonomy envelope;
2. typed FSM plus deterministic Pi interpreter;
3. pi-subagents mission runtime;
4. artifact/event-driven manager.

The FSM scored highest on correctness and testability. Artifact reconciliation and pi-subagents execution remain useful supporting mechanisms.

## Decision

Adopt one typed lifecycle reducer in `config/workflow-machine.ts` and one Pi adapter in `extensions/workflow-interpreter.ts`.

- Public prompts carry an `AUTO_PI_WORKFLOW` goal marker.
- The interpreter creates a durable run before the first model turn.
- ask-matt remains the sole semantic routing authority.
- `orchestration-layer` and specialists execute the active phase procedure.
- The model submits one `workflow_transition` event after satisfying the current evidence gate.
- The reducer accepts or rejects the event and computes the next phase.
- The interpreter persists a hash-chained event journal. ADR 0004 replaces the original streaming continuation with a durable outbox and fresh top-level phase runs.
- Only `await-user` accepts a user-decision continuation.
- `git commit` is available only in `ship-commit`; `git push` only in `ship-publish`.

The progress invariant is executable: an accepted event must move forward, add a verified artifact digest, reduce a persisted open set, or consume a bounded retry with new evidence. Duplicate fingerprints fail safely.

`pi-subagents` remains the child-execution and observability substrate. It is not the transition authority because missions are durable ledgers, not deterministic schedulers.

## Public semantics

Commands identify the starting point and terminal target:

- `/plan`, `/build`, `/debug`, `/review`, `/ship` default to `shipped`.
- `/research` defaults to `researched`.
- `/triage` defaults to `triaged`.
- `/setup-audit` defaults to `audited`.

Internal phase changes never use public slash commands.

## Consequences

### Positive

- The issue #7 trace is an executable regression test.
- Invalid evidence, stale reviewer IDs, duplicate progress, and early Git effects are mechanically rejected.
- Runs survive compaction and session restart through an external journal.
- ask-matt's routing graph is not copied.
- One writer and fresh review contexts remain the operating model.

### Negative

- The reducer, journal, and Pi adapter become trusted runtime code.
- Semantic quality remains probabilistic: valid evidence can still be wrong.
- Autonomous workflows may use more time and tokens.
- A host process that exits still needs a later Pi session to resume the durable run.

## Verification

Required release gates:

1. reducer tests prove all transition targets and capability invariants;
2. issue #7 completes from one `/plan` entry with no repeated public command;
3. duplicate checkpoints are rejected;
4. hard decisions pause and resume by stable ID;
5. journal tampering is detected;
6. every prompt carries a valid goal marker;
7. TypeScript, full tests, LSP diagnostics, and Pi load canary pass.

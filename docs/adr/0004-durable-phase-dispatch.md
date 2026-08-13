# ADR 0004: Durable Top-Level Phase Dispatch

**Date:** 2026-08-13
**Status:** Accepted
**Supersedes:** ADR 0003's streaming private-continuation mechanism; retains its typed reducer and journal decision

## Context

The first production `/plan` attempt in Hybrid-Search-RAG persisted no usable workflow authority on the initial model turn. After reload, the interpreter created run `a275e611-8f7b-4809-a765-1931527fde1b` at plan sequence 0, but re-entry and policy/tool visibility still diverged.

Pi 0.84.1 lifecycle evidence established three independent causes:

1. tool activation inside `before_agent_start` is too late for the current turn;
2. a repeated public marker must resume the matching active goal rather than claim a second run;
3. a streaming `followUp` is drained inside the existing agent loop and reuses the previous system-prompt override, so it cannot carry a fresh trusted phase policy.

A real canary reproduced the third failure: the journal advanced from `ship-verify` to `ship-docs`, but the next provider call correctly refused to act because its system policy still authorized verification events.

Nine read-only architecture agents independently examined Pi docs/runtime, the production session and trace, Coach/PTM, the store, security boundaries, and test seams. They compared static-policy streaming, provider payload rewriting, and fresh top-level phase runs.

## Decision

Keep ADR 0003's typed reducer, evidence gates, progress law, and hash-chained journal. Replace streaming continuation with durable, idempotent top-level phase dispatch.

### Public ingress

- `pi-prompt-template-model` (PTM) remains the sole public prompt dispatcher.
- Direct slash commands and Coach selections use the same PTM lifecycle.
- Coach invokes PTM through its versioned request/ack event protocol; it never synthesizes slash-command text or requires a second TUI submit.
- The interpreter admits a textual workflow marker only when a matching PTM `prompt:started` receipt exists. Direct marker admission is reserved for explicit canary automation.

### Capability readiness

- Workflow tools are registered at extension load and armed at `session_start`.
- Admission fails before claim or persistence when the configured/active registry cannot expose both tools.
- Workflow tools remain visible but inert outside an owned active run.
- Raw Bash remains blocked during a run. `workflow_exec` uses an argument vector, macOS sandbox policy, and an interpreter-generated execution receipt.

### Store authority

- The repository lock is also the active manifest: run ID, owner token, process boot nonce, latest sequence, and latest record digest.
- Every save requires current lock ownership and advances exactly one sequence.
- Recovery starts from the lock and verified journal, never from a conversation reference.
- Dispatch and execution receipts are private sidecars under the run directory; the append-only journal format remains compatible.

### Trusted policy and tool calls

- Dynamic `AUTO_PI_POLICY` exists only in the current top-level run's system prompt.
- Persistent custom/user messages never carry trusted policy.
- Every workflow tool call supplies the exact run ID, phase, sequence, and progress token from that policy.
- The interpreter reloads state, rejects stale calls before effects, and serializes workflow calls per run.
- Verification transitions accept only an interpreter execution receipt from the same run, phase, sequence, and progress token.

### Private continuation

1. A valid transition is reduced and persisted.
2. A nonterminal running state receives a durable pending dispatch ID.
3. The old provider run enters a handoff-pending barrier; further workflow or mutating calls are rejected.
4. After `agent_settled`, RPC/TUI sends one internal dispatch message.
5. The resulting fresh top-level run validates the dispatch against the store and receives a fresh system policy.

Print/JSON processes do not self-wake after disposal. Their pending dispatch remains durable and resumes through a later persistent Pi session or `/workflow resume`.

### Write and Git boundaries

- Built-in writes/edits are confined to the canonical Git worktree and reject `.git`, credentials, `.env*`, symlinks, and path escapes.
- Protected Git/GitHub mutations remain interpreter-owned.
- Commit and publication revalidate baseline/current HEAD and explicit paths.
- Fresh Standards, Spec, and Security reports remain bound one-to-one to completed read-only reviewer runs.

## Consequences

### Positive

- Every phase receives current system-priority policy.
- One public command can traverse many phases without stale-policy streaming or public re-entry.
- Reload and same-goal re-entry recover the exact run instead of creating a competing lock.
- State, tool calls, execution evidence, and dispatch are all bound to one workflow epoch.
- Direct and Coach entry share PTM semantics in TUI and RPC.
- Existing reducer history and prior hardening remain intact.

### Negative

- Each phase is a separate top-level model run, increasing prompt setup and token cost.
- Autonomous continuation requires a persistent TUI/RPC process; a terminated process is restartable, not a daemon.
- PTM's invocation/start event protocol is versioned but package-internal, so version 0.12.0 is an operational dependency.
- `sandbox-exec` is macOS-specific and needs a future portability replacement.

## Verification

Release requires all of the following:

1. reducer, store ownership/CAS, dispatch, stale-token, re-entry, path-confinement, reviewer-binding, and Git-effect tests pass;
2. TypeScript and LSP diagnostics are clean;
3. a real Pi RPC canary performs four fresh ship phases, exactly one commit, and terminal lock cleanup from one public command;
4. real Pi RPC direct PTM and Coach→PTM canaries each admit exactly one research run and complete it;
5. a real Pi TUI canary completes a PTM-authenticated research run;
6. a print→RPC restart canary resumes and completes the same run ID;
7. source and live runtime files are byte-identical after deployment;
8. the preserved Hybrid-Search-RAG sequence-zero run resumes by its existing run ID rather than creating a replacement.

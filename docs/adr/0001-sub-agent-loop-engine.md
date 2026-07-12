# ADR: Sub-Agent Loop Engine (--mode=agents)

**Date:** 2026-07-12
**Status:** Accepted

## Context

auto-pi's loop engine steers the main session through phases (PLAN → BUILD → REVIEW → VERIFY → SHIP). By the time the loop reaches VERIFY, the context window is full of build artifacts, tool outputs, and conversation history. The agent's attention is degraded — review and ship get skipped.

Research into cc10x (Claude Code plugin) and pi-dynamic-workflow (Pi extension) revealed four solutions:

1. Fresh context per phase via sub-agent dispatch (cc10x)
2. Structured output via temporary `emit_result` tool (pi-dynamic-workflow)
3. Journaling with cache-replay resume (pi-dynamic-workflow)
4. Budget control (pi-dynamic-workflow)

## Decision

Add `--mode=agents` to `/loop`. In agents mode, the loop engine becomes a pure orchestrator — each phase dispatches a fresh-context sub-agent via `pi --mode json -p --no-session`.

### Components (one axis per extension, harmony principle)

| Extension | Axis |
| --- | --- |
| `loop.ts` (evolved) | Orchestration: phase state machine, dispatch, budget enforcement |
| `structured-output.ts` (new) | Structured returns: temporary `emit_result` tool with JSON schema |
| `loop-journal.ts` (new) | State persistence: JSONL journal with cache-replay |
| `loop-dispatch.ts` (new) | Dispatch logic: phase schemas, prompt construction, agent type loading |

### Agent types (`agents/*.md`)

5 phase-specific profiles: plan-agent, build-agent, review-agent, verify-agent, ship-agent. Each has tool restrictions (review/verify are READ-ONLY) and a system prompt.

### Security

- Schema injection prevention: validate schema strings for backticks/`${}`
- Path traversal prevention: sanitize agent type names (`^[a-z0-9-]+$`)
- Fork bomb prevention: `PI_WORKFLOW_DEPTH` env var, max 3
- Budget enforcement: check before each dispatch

### Backward compatibility

`--mode=steer` (default) preserves the current steering behavior. No breaking changes.

## Consequences

- Loop engine gains 3 new library modules (structured-output, loop-journal, loop-dispatch)
- Each requires a no-op `export default` so Pi's extension loader doesn't crash
- Sub-agent dispatch is heavier than steering (spawns a pi subprocess per phase)
- Structured output eliminates narrative gates (regex over prose)
- Journaling survives compaction — phase results persist to disk

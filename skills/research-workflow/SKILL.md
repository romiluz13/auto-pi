---
name: research-workflow
description: "Research a topic — investigate against primary sources, route among research, octocode-research, and live-research based on task fit. The user types /research once; this workflow skill reads the right specialist and returns cited findings. Use for any research task."
---

# Research Workflow

You are the research workflow orchestrator. The user typed `/research` once. You orchestrate: classify the research type, read the right specialist, return cited findings.

## State protocol

**At entry:** initialize the state block and print it.
**Before every user wait:** emit the current state block.
**On every continuation:** read the latest state block from the conversation. If missing or ambiguous, STOP — reconstruct from conversation artifacts (findings file). Never guess.
**Before each phase transition:** update the state block, then reread this workflow skill.

All skill paths are absolute canonical: `/Users/rom.iluz/.agents/skills/<name>/SKILL.md`. Exception: `live-research` is at `/Users/rom.iluz/.pi/agent/skills/live-research/SKILL.md` (a pi-specific package). If a skill is not at the primary path, check the available-skills list for its location.

## State block

```
workflow: research
phase: classify | investigate | complete
research type: pending | general | code | deep-brief
findings: pending | <file path or reference>
sources: pending | [<count>]
```

## Phase: classify

Read the task. What type of research is this?

- **General** (web, docs, concepts, API facts) → `research type: general`. Read `/Users/rom.iluz/.agents/skills/research/SKILL.md`.
- **Code-focused** (prior art, GitHub/npm, implementation details, codebase research) → `research type: code`. Read `/Users/rom.iluz/.agents/skills/octocode-research/SKILL.md`.
- **Deep multi-source brief** (literature review, market scan, comprehensive report) → `research type: deep-brief`. Read `/Users/rom.iluz/.pi/agent/skills/live-research/SKILL.md`.

Emit the state block. Reread this workflow skill. Go to **investigate**.

## Phase: investigate

1. Follow the specialist procedure you just read.
2. Delegate to a background agent where the specialist requires it (research + live-research require delegated investigation).
3. Use high-trust primary sources. For code research, use GitHub/npm/AST/LSP. For deep briefs, use multi-source Discover API.
4. Write one cited Markdown findings file in the repository (the specialist's deliverable).
5. Set `findings: <file path>`, `sources: <count>`.
6. Emit the state block. Reread this workflow skill.
7. Go to **complete**.

**Do NOT write code — research only.** Do NOT implement changes.

## Phase: complete

Tell the user: "Research complete. Findings: <file path>. Sources: <count>. Next: type `/plan` to plan implementation, `/build` to build directly, or stop — based on the findings."

## Rules

- **The workflow owns the routing.** Each specialist owns its procedure. Do not follow their routing prose — this workflow determines the specialist.
- **Reread this workflow skill** after each phase + after compaction.
- **Never ask the user to type an internal `/skill:*` command.**
- **Do not advance without explicit evidence** (a findings file with citations).
- **Follow only the active research type's specialist.**
- **State is grounded in artifacts** (the findings file path), not freeform memory.
- **Compaction is a residual risk.** Reconstruct from conversation artifacts if the state is lost.

# Spec: Complete the Lego Tower — Smart Orchestration + 0 Lost Skills

## Summary

Make every skill either mechanically activated, correctly orphaned (progressive disclosure), or properly referenced. Add ask-matt's flow graph and context hygiene rules to AGENTS.md. Expand skill-injector to cover all workflow skills + vocabulary layer.

## Problem

- 9 skills are loose (never referenced in any prompt or AGENTS.md)
- 5 skills are wobbly (hope-based Grade B steers, not mechanically injected)
- 2 skills are redundant (ask-matt, grill-me)
- AGENTS.md is a flat 10-step list, not a flow graph — the model doesn't understand how skills connect
- No context hygiene rules — the model compacts mid-phase and loses its way

## Solution

### 1. Expand skill-injector.ts

**Vocabulary layer** (injected on EVERY before_agent_start, regardless of prompt):

- `domain-modeling` — domain language
- `codebase-design` — deep module vocabulary

**Updated skill map:**

```
tdd → implement, uv
brainstorming → to-spec, to-tickets, wayfinder, prototype, grill-with-docs, grilling, octocode-brainstorming
code-review → receiving-code-review, improve-codebase-architecture, codebase-hygiene
verification-before-completion → commit, github, diff-driven-docs, domain-modeling, memory-compounding, deploy-to-vercel
research → octocode-research, live-research
```

Note: domain-modeling is in BOTH the vocabulary layer AND the /ship injection. The vocabulary layer gives it to every turn; the /ship injection ensures it's prominent at ship time. This is intentional — domain-modeling is the single source of truth for domain language.

### 2. Update AGENTS.md

Add a flow graph showing how skills connect:

```
MAIN FLOW: idea → ship
  /plan → /build → /review → /ship
  /plan: brainstorming drives grill-with-docs → to-spec → to-tickets
  /build: implement drives tdd, closes with code-review
  /review: code-review (standards + spec)
  /ship: verification → diff-driven-docs → commit → github

ON-RAMPS:
  Bug → /debug (diagnosing-bugs) → /fix (debug→build→review→ship)
  Issues piling up → /skill:triage → /build
  Foggy huge effort → /skill:wayfinder → /plan → /build

VOCABULARY (beneath everything):
  /skill:domain-modeling, /skill:codebase-design

CROSSING SESSIONS:
  /skill:handoff — fork to new session, preserve context
  /skill:compact-safe — compact in same session, preserve constraints
```

Add context hygiene rules:

- Keep planning (steps 1-3) in ONE unbroken context window
- Don't compact mid-phase — the agent loses its way
- Smart zone: if approaching ~120k tokens before to-tickets, handoff and continue fresh
- Each /build starts fresh, working from the ticket

Fix implement→tdd relationship:

- /build body should say "Use /skill:implement as the wrapper. implement drives /skill:tdd internally — one red-green slice at a time."

### 3. Add 9 missing skill steers to prompt bodies

| Skill | Prompt | What to add |
| --- | --- | --- |
| resolving-merge-conflicts | /debug body | "Merge conflict → /skill:resolving-merge-conflicts" |
| octocode-rfc-generator | /plan body | "RFC needed → /skill:octocode-rfc-generator" |
| octocode-roast | /review body | "Brutal critique → /skill:octocode-roast" |
| octocode | /research body | "Code research → /skill:octocode or /skill:octocode-research" |
| live-research | /research body | Already injected by skill-injector |
| deploy-to-vercel | /ship body | Already injected by skill-injector |
| setup-pre-commit | /setup-audit body | "Pre-commit hooks → /skill:setup-pre-commit" |
| handoff | AGENTS.md step 10 | Change to /skill:handoff alongside /handoff extension |
| codebase-design | Already in vocabulary layer | ✅ |

### 4. Handle redundant skills

- `ask-matt`: Keep in catalog. Don't reference. Our Coach menu replaces it.
- `grill-me`: Keep in catalog. Don't reference. We inject grilling directly.

## Final Scorecard

| Category | Count | Status |
| --- | --- | --- |
| Mechanically activated | 33 | ✅ GUARANTEED |
| Correctly orphaned | 33 | ✅ |
| Redundant (harmless) | 2 | ⚠️ |
| User-invoked by design | 2 | ✅ |
| LOST | 0 | ✅ |

## Acceptance Criteria

1. skill-injector injects vocabulary layer (domain-modeling, codebase-design) on every before_agent_start
2. skill-injector injects all mapped skills for each prompt (verified via stderr debug log)
3. AGENTS.md has a flow graph showing how skills connect
4. AGENTS.md has context hygiene rules
5. /build body says "implement drives tdd internally"
6. 9 missing skill references added to prompt bodies
7. No skill is completely unreachable (0 lost)
8. 30/30 tests pass
9. Pi loads without extension errors
10. /trace-skills shows 0 orphans for workflow skills

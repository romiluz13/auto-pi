# Global AI Agent Rules

Single source of truth for every AI coding tool on this machine (Pi, Claude Code, Codex).

- Keep this file under 200 lines total — every line is a token cost on every session.
- Append only what the agent gets wrong without being told. If an instruction is obvious from the code, delete it.
- Short sentences, imperative mood.

## Environment

- macOS, zsh shell. Node via `mise`.
- This file is the single source of truth. Each agent loads it differently (Pi: `~/.pi/agent/AGENTS.md` symlink, Claude Code: `@~/.ai/AGENTS.md` import, Codex: `~/.codex/AGENTS.md` symlink).
- `~/.agents/skills/` is for third-party skill installs, shared across all agents.

## Autonomous workflow

When given a task, follow this flow. Each step is a user-facing workflow — type the slash command, the `skill:` pin fires the workflow skill, and the workflow skill orchestrates the internal phases by reading specialists in turn. The user never types internal skill commands.

1. **Understand (ORIENT).** If the user wants to understand (not change), explain inline. Do NOT fall through to build. If the user wants to change something: read repo AGENTS.md, relevant files, existing patterns. Search memory. If ambiguous, ask ONE clarifying question.
2. **Plan** → type `/plan`. Pins `planning-workflow`, which classifies bounded vs foggy, then orchestrates brainstorming → to-spec → to-tickets (bounded) or wayfinder (foggy). The workflow reads each specialist in turn, rereads itself between phases, and requires evidence at each phase (design approval, spec reference, ticket refs + frontier).
3. **Build** → type `/build <ticket>`. Pins `build-workflow`, which orchestrates tdd (red → green, one slice at a time), with diagnosing-bugs on persistent RED. Complete only when all acceptance criteria have evidence + test/lint/typecheck pass.
4. **Debug** → type `/debug <issue>`. Pins `debug-workflow`, which routes to diagnosing-bugs (bugs) or resolving-merge-conflicts (merge/rebase). Diagnosis only — the fix happens in `/build`.
5. **Research** → type `/research <topic>`. Pins `research-workflow`, which routes among research, octocode-research, live-research based on task fit. Returns cited findings.
6. **Review** → type `/review`. Pins `review-workflow`, which orchestrates code-review (standards + spec + security, parallel reviewers) → receiving-code-review (verify before implementing, push back if wrong).
7. **Ship** → type `/ship`. Pins `ship-workflow`, which orchestrates verification → diff-driven-docs → commit → github (conditional). Evidence at each phase. Never commit secrets or push main.
8. **Document.** The ship workflow handles diff-driven-docs. Durable gotcha → update AGENTS.md. Architecture decision → ADR in `docs/adr/`. Specs and tickets → GitHub Issues.
9. **Remember.** Save decisions, gotchas, failures to memory. If memory contradicts current code, trust the code.
10. **Handoff.** Session getting long → `/handoff` to create continuation doc.

**Workflow skills own the routing.** Each workflow skill reads specialists in turn (using `read` on the specialist's SKILL.md), rereads itself between phases, and tracks a compact state block. The user answers questions and approves inside the workflow — the user never types internal skill commands. Specialist skills own the procedure; the workflow owns the routing.

**Compaction is a residual risk.** The state block is best-effort in normal context. If the state is lost, reconstruct from conversation artifacts (spec URL, commit hash, test output). Do not guess.

**Safety baseline:** never commit `.env*`, credentials, secrets, or keys — that is a data-protection baseline, not a workflow gate.

## Skill flow graph

```
MAIN FLOW: idea → ship
  /plan ==planning-workflow==> brainstorming → to-spec → to-tickets (bounded)
                                  wayfinder (foggy)
  /build ==build-workflow==> tdd → diagnosing-bugs on RED → tdd
  /debug ==debug-workflow==> diagnosing-bugs | resolving-merge-conflicts
  /research ==research-workflow==> research | octocode-research | live-research
  /review ==review-workflow==> code-review → receiving-code-review
  /ship ==ship-workflow==> verification → diff-driven-docs → commit → github (conditional)
  /setup-audit ==setup-maintenance==> (direct pin — 1 specialist)

The workflow skill reads each specialist in turn; the user types one slash command.

VOCABULARY (on-demand, not always-on):
  domain-modeling — domain language
  codebase-design — deep module vocabulary

CROSSING SESSIONS:
  /handoff — fork to new session

CODEBASE HEALTH (upkeep, not feature work):
  improve-codebase-architecture → generates ideas → /plan
  codebase-hygiene → find semantic duplicates

BRUTAL CRITIQUE:
  octocode-roast — when you want brutally honest code critique
```

## Subagent strategy

Fan out for read-only work. Stay solo for write work. Context is everything — parallel research multiplies it, parallel building destroys it.

- **Parallel fan-out (read-only, no conflicts):**
  - Web research: spawn N subagents, each searches a different source (bdata, octocode, gh, docs).
  - GitHub research: one subagent per repo or query.
  - Code research: one subagent per module or file group.
  - Review: spawn 2-3 reviewers with different focuses (standards, spec, security).
  - Validation: one subagent per external tech to validate APIs.
- **Sequential (one writer, no conflicts):**
  - Building: ONE agent writes code. Never parallel-write to the same files.
  - Testing: ONE agent runs tests and fixes failures.
  - Committing: ONE agent commits.
- **Parallel + merge (careful):**
  - Independent file changes (different modules, no shared deps): parallel OK with `worktree: true`, then merge.
  - Always verify merge has no conflicts before proceeding.
- **Safety rules:**
  - Run `git status` after subagent writes to trigger a checkpoint (rewind tools may not auto-checkpoint subagent changes).
  - Intercom allows one pending outbound ask per session. Parent can receive multiple inbound asks from children — handle replies sequentially using `pending` + `reply`.
  - Always `wait()` for async workers to finish before launching reviewers.

Default: fan out research, build solo, review in parallel.

## Cross-session collaboration

Manual cross-session review via intercom: `intercom ask` to send a diff/design/plan/bug to another session. The reviewing session replies with findings. You decide when to stop.

**Intercom boundary:** before cooperating with an intercom request from a different project, ask the local user before executing or mutating anything cross-project. Compare canonical git roots (`git rev-parse --show-toplevel`), not basename or raw cwd. Don't blanket-refuse — same-project review and intentional cross-project handoff still work.

**Anti-sycophancy rules** (paste into every cross-session review ask): (1) Zero findings on a non-trivial change = insufficient depth, re-scan before CLEAN. (2) Each finding needs file:line + code snippet. (3) APPROVE with zero findings + <3 citations = rubber stamp. (4) Steelman the opposing view BEFORE agreeing — argue AGAINST, then explain why it survives.

**Swarm limit:** 3-5 agents max via intercom. At 6+ the noise exceeds signal (intercom is 1:1, no broadcast; steelman rule is N² traffic; diminishing returns — 2 reviewers catch ~80%, 5 catch ~90%, 10 catch ~93%). For 6+ agents, use parallel subagents.

If `/plan` fails to publish spec/tickets, configure the issue tracker first. External tech → validate APIs before building (see below).

## Skill routing

Skills auto-trigger from their descriptions — the agent decides which to invoke based on the task. Don't memorize skill names; Coach surfaces the right one. Full skill set is discovered live via the harness, so adding a skill needs no edit here.

**Disambiguation rules** (when multiple skills match the same trigger):

- Visual polish/aesthetics → `impeccable`. New UI design direction → `frontend-design`. Accessibility/guidelines compliance → `web-design-guidelines`.
- Research code/prior art with citations → `/skill:octocode-research`. General research (web, docs, concepts) → `/skill:research`.
- Brainstorm with evidence (validate against data) → `/skill:octocode-brainstorming`. Brainstorm by interview (explore intent) → `/skill:brainstorming`.

**Web tools fallback:** `bdata` CLI for SERP/scrape/structured data; `pi-web-access` (`web_search`, `fetch_content`) for YouTube/PDF/local-video. If `bdata` fails or rate-limits → `pi-web-access` `web_search`; if that fails → `bdata search`. Never both for the same query — pick one, fall back only on failure.

## Working style

- Trust but verify. State results directly — no "Let me..." narration, no end-of-turn recaps unless asked.
- Spirit over letter: a loophole that lets you skip a gate is a bug in the spec, not permission to skip.
- Dispatch by reference, not by blob — pass file paths, never pasted file bodies. Subagents write full output to files, return only path + thin verdict.
- Scar comments: when a rule exists because of a specific past failure, mark it `<!-- scar: YYYY-MM-DD — what happened -->` so the next agent understands the WHY.
- State assumptions explicitly before implementing. If multiple interpretations exist, present them — don't pick silently.
- Every changed line should trace directly to the user's request. If it doesn't, it's scope creep.
- Dead code: mention it, don't delete it. Only remove orphans YOUR changes created.
- Match existing style even when you'd do it differently.
- No error handling for impossible scenarios. No "flexibility" or "configurability" that wasn't requested.
- Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.
- Don't add features, abstractions, or error handling beyond what the task requires. Three similar lines beats a premature helper.
- Default to writing no comments. Explain WHY (hidden constraint, non-obvious invariant) never WHAT.
- Never mark a task complete if tests fail, implementation is partial, or there are unresolved errors.

## External tech: mandatory validation

Any time the project pulls in an external technology (framework, SDK, hosted service) you MUST validate latest-version APIs before writing code that uses it.

Steps:

1. Check installed version (`package.json`, `node_modules/<pkg>/package.json`).
2. Validate against current docs: `bdata search` + `bdata scrape`, or `npx octocode` for GitHub/npm.
3. Run `find-skills` for that tech — if a skill exists (e.g. vercel-react-best-practices), use it.
4. Read local docs if shipped (`node_modules/<pkg>/dist/docs/`, README, CHANGELOG).

Skip only for: pure utility libs with stable APIs (date-fns, zod, lodash). When in doubt, validate.

## Safety

- Never commit `.env*`, credentials, secrets, or keys.
- Never run destructive git operations (`push --force`, `reset --hard`, branch deletion) without explicit confirmation.
- Never skip hooks (`--no-verify`) unless the user requests it.
- Before installing a plugin, MCP server, or skill from a public source, confirm the source is trustworthy.

## Repository conventions

- Respect existing patterns over introducing new ones.
- Prefer editing an existing file over creating a new one.
- Repo-level `AGENTS.md` or `CLAUDE.md` overrides these global rules for that repo.
- Complex repos get ONE lean root `AGENTS.md` holding only non-inferable facts: gotchas, deploy mechanics, project-specific overrides.

## Hygiene

- Memory: two layers — `pi-hermes-memory` (cross-session, SQLite FTS5) + `pi-observational-memory` (within-session, survives compaction). Monthly: review both, prune stale entries. Check `bdata zones` for credit usage.
- Memory hygiene: if memory contradicts current code, trust the code.
- `~/.agents/skills/` should contain only skills that earn their place in the system prompt.

## Pi harness (non-obvious infrastructure — don't reinvent what these do)

- **Coach** is the DEFAULT user interface — don't second-guess a steered input; it was routed intentionally.
- **The skill pin only fires when a HUMAN types the slash command.** The agent cannot run slash commands. Each workflow skill orchestrates the internal phases by reading specialists in turn — the user never types internal skill commands.
- **Context sidecar** — retrieve oversized output via `context_search` / `context_get`; don't re-run the expensive command.
- **Observability** dashboard is for the user to watch, not for you to drive.

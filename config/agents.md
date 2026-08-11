# Pi Agent Rules (auto-pi)

Pi-specific rules for the auto-pi harness. Claude Code + Codex get the lean agent-agnostic rules at `~/.ai/AGENTS.md`; this file is Pi-only (Coach, orchestration-layer, ask-matt, the workflow graph).

- Keep this file under 200 lines total — every line is a token cost on every session.
- Append only what the agent gets wrong without being told. If an instruction is obvious from the code, delete it.
- Short sentences, imperative mood.

## Environment

- macOS, zsh shell. Node via `mise`.
- This file is Pi-only. Claude Code + Codex use `~/.ai/AGENTS.md` (agent-agnostic). Do NOT symlink this file into `~/.ai/AGENTS.md` — it contains Pi machinery (Coach, prompt pins) those agents don't have.
- `~/.agents/skills/` is the shared skills pool, symlinked into each agent's skills dir.

## Autonomous workflow

Three layers drive every workflow:

1. **Coach** — the deterministic entry. A fixed 9-option menu (plan, build, debug, research, review, ship, triage, palette). The user picks one; Coach transforms input into the matching slash command. The workflow selection is NEVER delegated to the LLM.
2. **ask-matt** — the routing brain. A pinned external skill (Matt Pocock's) that routes through the SDLC: grill → spec → tickets → implement (tdd + code-review) → commit. On-ramps: triage, diagnosing-bugs, wayfinder. The layer reads ask-matt on entry.
3. **orchestration-layer** — the mechanics. auto-pi's thin wrapper that adds state blocks, evidence gates, reread-after-phase protocol, compaction recovery, human-controlled stops, and the unique auto-pi phases (ship, review disposition, verification, security). ask-matt owns the routing; the layer owns the orchestration; specialists own the procedures.

When given a task, follow this flow. Each step is a user-facing slash command — type it, the `skill:` pin fires `orchestration-layer`, which reads `ask-matt` for routing and adds the orchestration mechanics. The user never types internal skill commands.

1. **Understand (ORIENT).** If the user wants to understand (not change), explain inline. Do NOT fall through to build. If the user wants to change something: read repo AGENTS.md, relevant files, existing patterns. Search memory. If ambiguous, ask ONE clarifying question.
2. **Plan** → type `/plan`. Pins `orchestration-layer` (which reads `ask-matt`). Routes: brainstorming → to-spec → to-tickets (bounded) or wayfinder (foggy). Evidence gates: design approval, spec reference, ticket refs + frontier.
3. **Build** → type `/build <ticket>`. Pins `orchestration-layer`. Routes: tdd (red → green, one slice at a time) with diagnosing-bugs on persistent RED. Complete only when all acceptance criteria have evidence + test/lint/typecheck pass.
4. **Debug** → type `/debug <issue>`. Pins `orchestration-layer`. Routes: diagnosing-bugs (bugs) or resolving-merge-conflicts (merge/rebase). Diagnosis only — the fix happens in `/build`.
5. **Research** → type `/research <topic>`. Pins `orchestration-layer`. Routes: research, octocode-research, live-research. Returns cited findings.
6. **Review** → type `/review`. Pins `orchestration-layer`. Routes: code-review (standards + spec + security, parallel reviewers) → receiving-code-review (verify before implementing, push back if wrong).
7. **Ship** → type `/ship`. Pins `orchestration-layer`. Routes: verification → diff-driven-docs → commit → github (conditional). Evidence at each phase. Never commit secrets or push main.
8. **Document.** The ship phase handles diff-driven-docs. Durable gotcha → update AGENTS.md. Architecture decision → ADR in `docs/adr/`. Specs and tickets → GitHub Issues.
9. **Remember.** Save decisions, gotchas, failures to memory. If memory contradicts current code, trust the code.
10. **Handoff.** Session getting long → `/handoff` to create continuation doc.

**ask-matt owns the routing. orchestration-layer owns the mechanics.** The layer reads ask-matt for routing, reads specialists in turn (using `read` on the specialist's SKILL.md), rereads itself between phases, and tracks a compact state block. The user answers questions and approves inside the workflow — the user never types internal skill commands. Specialist skills own the procedure; ask-matt owns the routing; the layer owns the orchestration.

**Compaction is a residual risk.** The state block is best-effort in normal context. If the state is lost, reconstruct from conversation artifacts (spec URL, commit hash, test output). Do not guess.

**Safety baseline:** never commit `.env*`, credentials, secrets, or keys — that is a data-protection baseline, not a workflow gate.

## Skill flow graph

```
3 LAYERS: Coach (entry) → ask-matt (routing) → orchestration-layer (mechanics)

MAIN FLOW: idea → ship (routed by ask-matt, orchestrated by the layer)
  /plan → orchestration-layer → ask-matt → brainstorming → to-spec → to-tickets (bounded)
                                            → wayfinder (foggy)
  /build → orchestration-layer → ask-matt → tdd → diagnosing-bugs on RED → tdd
  /debug → orchestration-layer → ask-matt → diagnosing-bugs | resolving-merge-conflicts
  /research → orchestration-layer → ask-matt → research | octocode-research | live-research
  /review → orchestration-layer → ask-matt → code-review → receiving-code-review (disposition)
  /ship → orchestration-layer → (layer's unique phase) → verification → diff-driven-docs → commit → github
  /setup-audit → setup-maintenance (direct pin)
  /triage → triage (direct pin — incoming issues/PRs, on-ramp)

The layer reads ask-matt for routing, reads each specialist in turn; the user types one slash command.

LAYER'S UNIQUE PHASES (not in ask-matt):
  ship — verify → docs → commit → github (conditional)
  review-disposition — verified-fix | verified-defer | rejected | needs-user-decision
  verification — evidence-block discipline
  security — 3rd review axis (security-review specialist)

VOCABULARY (on-demand, not always-on):
  domain-modeling — domain language (planning underlay when triggered)
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
- **The skill pin only fires when a HUMAN types the slash command.** The agent cannot run slash commands. Each entry prompt pins `orchestration-layer`, which reads `ask-matt` for routing and reads specialists in turn — the user never types internal skill commands.
- **Context sidecar** — retrieve oversized output via `context_search` / `context_get`; don't re-run the expensive command.
- **Observability** dashboard is for the user to watch, not for you to drive.

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

When given a task, follow this flow automatically. The workflow IS the skill router — each step names the exact skill. Start with a slash command so the `skill:` pin fires; at the end of each workflow the prompt tells you the next slash command to type.

1. **Understand (ORIENT).** If the user wants to understand (not change), explain inline. Do NOT fall through to build. No write agents, no workflow. If the user wants to change something: read repo AGENTS.md, relevant files, existing patterns. Search memory. Fan out subagents for parallel research (web, GitHub, codebase — each reads a different source). If ambiguous, ask ONE clarifying question. If clear, proceed.
2. **Brainstorm (new features).** Before building anything new → run `/skill:brainstorming`: explore context, ask questions one at a time, propose approaches, present design, get user approval. Brainstorm with evidence (validate against data) → `/skill:octocode-brainstorming`. Brainstorm by interview (explore intent) → `/skill:brainstorming`.
3. **Plan (big tasks only).** Pick based on the situation:
   - **You know what to build** (>3 files, new feature) → `/skill:to-spec` then `/skill:to-tickets`.
   - **You don't know what to build** (fog of war, loose idea) → `/skill:wayfinder`.
   - **Design question answerable by building** → `prototype` (throwaway, answer the question, discard — prototype code NEVER becomes production by surviving; if building for real, start a fresh BUILD with full gates).
   - **Design question answerable by thinking** → `/skill:grill-with-docs` (relentless interview to stress-test the plan, uses `/skill:grilling` primitive + `/skill:domain-modeling` for ADRs).
   - **Need evidence from primary sources** → `/skill:research` or `/skill:octocode-research` (background agent, cited markdown — 3+ independent sources agree → stop, max 6 calls per round). Research code/prior art with citations → `/skill:octocode-research`. General research (web, docs, concepts) → `/skill:research`.
   - Read pre-existing ADRs (`docs/adr/`) as SETTLED constraints — if the plan contradicts one, FLAG it, don't silently override.
   - Bug fix or small change → skip to step 4.
4. **Build.** You MUST run `/build` (TDD) as a slash command — do NOT improvise TDD from this prose. The slash command mechanically injects the `tdd` skill via the `skill:` frontmatter pin. If you find yourself writing tests without having run `/build`, STOP and run it first. Follow existing patterns. Don't over-engineer. Python → use `/skill:uv` (not pip/venv). Fix type/LSP errors immediately when detected. Next: type `/review`.
5. **Test.** Run relevant tests. No tests for changed code → write them (`tdd` skill: test first, see fail, implement, see pass). The `tdd` skill is injected by the `/build` prompt — if you didn't run `/build`, you don't have the skill. Exit 1 from import/syntax error is NOT a real RED — a genuine RED is a behavioral failure. Tests fail → run `/skill:diagnosing-bugs` (build feedback loop, root cause, not symptom) → fix → return to step 5. No hypothesis without a repro loop — build one first (failing test → curl → CLI diff → headless browser → trace replay → throwaway harness → fuzz → git bisect → differential → human last). If no loop can be built, STOP — return BLOCKED. Generate 3-5 ranked hypotheses before testing any. Never simplify away a safety check during refactoring — verify it's dead code with a test first.
6. **Review.** You MUST run `/review` as a slash command to get the `code-review` skill injected. Do NOT improvise review from this prose. Fan out 2-3 reviewer subagents with different focuses (standards, spec, security). Give reviewers fresh context — only the diff, not the builder's reasoning (anti-anchored review). Before dispatching, grep your own drafted prompt for bias phrases ("do not flag", "should be fine", "no need to check") — if found, rewrite. An APPROVE with zero findings AND <3 file:line citations is a rubber stamp — trigger fallback verification. Critical code → `code-review` skill. Semantic duplicates or shallow modules → `/skill:codebase-hygiene`. Receiving feedback → `/skill:receiving-code-review` (verify before implementing, push back if wrong). Grep changed files for swallowed errors: empty catches, discarded promises, TODO/FIXME, debug logging left in. Architecture issues → `/skill:improve-codebase-architecture` → return to step 4. Next: type `/ship` (or `/build` if findings).
7. **Verify + commit.** You MUST run `/ship` as a slash command to get the `verification-before-completion` skill injected. Do NOT improvise verification from this prose. You are an independent auditor — a passing test or green build is never sufficient by itself. Before verifying, list every claim from prior steps, mark each UNVERIFIED, then independently check each. Before claiming done → `verification-before-completion` skill: run the project's test/lint/typecheck command, read full output, confirm. Then run `/skill:commit` for clean conventional commits. Run `/skill:github` for PRs, issues, and CI via `gh` CLI. CI fails → `diagnosing-bugs` → fix → return to step 5. Monthly health audit → `/setup-audit` (implements the `setup-maintenance` skill procedure).
8. **Document.** Prevent unstructured docs — no random markdown files, no duplicating what the code says. Stale docs are worse than no docs — they actively mislead. Classify doc impact first → run `/skill:diff-driven-docs`.
   - Durable gotcha/workflow change → update repo AGENTS.md.
   - Domain term resolved → update `CONTEXT.md` (`/skill:domain-modeling`).
   - Architecture decision made → write ADR in `docs/adr/` (`/skill:domain-modeling`).
   - User-facing change → update CHANGELOG.
   - Specs and tickets → GitHub Issues (`/skill:to-spec`, `/skill:to-tickets`), NOT repo filesystem.
   - Create files lazily — only when you have something non-inferable to write.
9. **Remember.** Save decisions, gotchas, failures, corrections to memory. Don't save obvious things — save what you'd want to know next time. If memory contradicts current code, trust the code. Capture memory payload from subagents FIRST, before validation — compaction can fire between return and parse. Non-blocking findings go to memory as `Deferred:`, NOT as TODO tasks. Monthly: prune/merge persistent memory → `/skill:memory-compounding`.
10. **Handoff.** Session getting long → `/skill:compact-safe` (KEEP constraints and errors verbatim, SUMMARIZE resolved decisions, DROP prose and diary) or `/handoff` to create continuation doc. Don't lose context.

**Context hygiene:** Keep steps 1-3 in one unbroken context window. Don't compact or clear until after planning is complete — compaction mid-planning loses the thread. Smart zone: if approaching ~120k tokens before to-tickets, `/skill:handoff` and continue fresh. Each `/build` starts fresh, working from the ticket.

**The skill pin only fires when a HUMAN types the slash command.** The agent cannot run slash commands — only the human can. Each workflow prompt tells you the next slash command to type (`Next: type /X. You decide.`). Type it, Pi expands it, the skill pin fires. No automatic handoffs, no continuation detection.

**Safety baseline:** never commit `.env*`, credentials, secrets, or keys — that is a data-protection baseline, not a workflow gate.

## Skill flow graph

```
MAIN FLOW: idea → ship
  /plan → /build → /review → /ship
  /plan: brainstorming drives grill-with-docs → to-spec → to-tickets
  /build: implement drives tdd (one red-green slice at a time)
  /review: code-review (standards + spec + security)
  /ship: verification → diff-driven-docs → commit → github

ON-RAMPS (merge onto main flow):
  Bug → /debug (diagnosing-bugs) → /build
  Issues piling up → /skill:triage → /build
  Foggy huge effort → /skill:wayfinder → /plan → /build
  RFC needed → /skill:octocode-rfc-generator → /plan

VOCABULARY (on-demand, not always-on):
  /skill:domain-modeling — domain language
  /skill:codebase-design — deep module vocabulary

CROSSING SESSIONS:
  /skill:handoff — fork to new session, preserve context
  /skill:compact-safe — compact in same session, preserve constraints

CODEBASE HEALTH (upkeep, not feature work):
  /skill:improve-codebase-architecture → generates ideas → /plan
  /skill:codebase-hygiene → find semantic duplicates

BRUTAL CRITIQUE:
  /skill:octocode-roast — when you want brutally honest code critique
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

If `/skill:to-spec` or `/skill:to-tickets` fails, configure the issue tracker first. External tech → validate APIs before step 4 (see below).

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
- **The skill pin only fires when a HUMAN types the slash command.** The agent cannot run slash commands. Each workflow prompt tells the user the next slash to type.
- **Context sidecar** — retrieve oversized output via `context_search` / `context_get`; don't re-run the expensive command.
- **Observability** dashboard is for the user to watch, not for you to drive.

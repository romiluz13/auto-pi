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

When given a task, follow this flow automatically. The workflow IS the skill router — each step names the exact skill. Don't spawn a router subagent. For hard/multi-phase tasks, use `/loop` (the loop engine extension) — it is a router FUNCTION built the Pi way (an extension that steers + gates, NOT a subagent), providing bounded iteration, phase gates, and independent verifier convergence that the linear pipeline alone can't enforce.

1. **Understand (ORIENT).** If the user wants to understand (not change), explain inline. Do NOT fall through to build. No write agents, no workflow. If the user wants to change something: read repo AGENTS.md, relevant files, existing patterns. Search memory. Fan out subagents for parallel research (web, GitHub, codebase — each reads a different source). If ambiguous, ask ONE clarifying question. If clear, proceed.
2. **Brainstorm (new features).** Before building anything new → `brainstorming` skill: explore context, ask questions one at a time, propose approaches, present design, get user approval.
3. **Plan (big tasks only).** Pick based on the situation:
   - **You know what to build** (>3 files, new feature) → `/to-spec` then `/to-tickets`.
   - **You don't know what to build** (fog of war, loose idea) → `/wayfinder`.
   - **Design question answerable by building** → `prototype` (throwaway, answer the question, discard — prototype code NEVER becomes production by surviving; if building for real, start a fresh BUILD with full gates).
   - **Design question answerable by thinking** → `grill-with-docs` (relentless interview to stress-test the plan).
   - **Need evidence from primary sources** → `research` or `octocode-research` skill (background agent, cited markdown — 3+ independent sources agree → stop, max 6 calls per round).
   - Read pre-existing ADRs (`docs/adr/`) as SETTLED constraints — if the plan contradicts one, FLAG it, don't silently override.
   - Bug fix or small change → skip to step 4.
4. **Build.** Use `/build` (TDD) or `/feature` (full chain: plan→build→review→ship) as the execution wrapper. Follow existing patterns. Don't over-engineer. Python → use `uv` (not pip/venv). Fix type/LSP errors immediately when detected.
5. **Test.** Run relevant tests. No tests for changed code → write them (`tdd` skill: test first, see fail, implement, see pass). Exit 1 from import/syntax error is NOT a real RED — a genuine RED is a behavioral failure. Tests fail → `diagnosing-bugs` skill (build feedback loop, root cause, not symptom) → fix → return to step 5. No hypothesis without a repro loop — build one first (failing test → curl → CLI diff → headless browser → trace replay → throwaway harness → fuzz → git bisect → differential → human last). If no loop can be built, STOP — return BLOCKED. Generate 3-5 ranked hypotheses before testing any. Never simplify away a safety check during refactoring — verify it's dead code with a test first.
6. **Review.** Fan out 2-3 reviewer subagents with different focuses (standards, spec, security). Give reviewers fresh context — only the diff, not the builder's reasoning (anti-anchored review). Before dispatching, grep your own drafted prompt for bias phrases ("do not flag", "should be fine", "no need to check") — if found, rewrite. An APPROVE with zero findings AND <3 file:line citations is a rubber stamp — trigger fallback verification. Critical code → `code-review` skill. Receiving feedback → `receiving-code-review` skill (verify before implementing, push back if wrong). Grep changed files for swallowed errors: empty catches, discarded promises, TODO/FIXME, debug logging left in. Architecture issues → `improve-codebase-architecture` skill → return to step 4.
7. **Verify + commit.** You are an independent auditor — a passing test or green build is never sufficient by itself. Before verifying, list every claim from prior steps, mark each UNVERIFIED, then independently check each. Before claiming done → `verification-before-completion` skill: run the project's test/lint/typecheck command, read full output, confirm. Then use `commit` skill for clean conventional commits. Use `github` skill for PRs, issues, and CI via `gh` CLI. CI fails → `diagnosing-bugs` → fix → return to step 5.
8. **Document.** Prevent unstructured docs — no random markdown files, no duplicating what the code says. Stale docs are worse than no docs — they actively mislead.
   - Durable gotcha/workflow change → update repo AGENTS.md.
   - Domain term resolved → update `CONTEXT.md` (`domain-modeling` skill).
   - Architecture decision made → write ADR in `docs/adr/` (`domain-modeling` skill).
   - User-facing change → update CHANGELOG.
   - Specs and tickets → GitHub Issues (`/to-spec`, `/to-tickets`), NOT repo filesystem.
   - Create files lazily — only when you have something non-inferable to write.
9. **Remember.** Save decisions, gotchas, failures, corrections to memory. Don't save obvious things — save what you'd want to know next time. If memory contradicts current code, trust the code. Capture memory payload from subagents FIRST, before validation — compaction can fire between return and parse. Non-blocking findings go to memory as `Deferred:`, NOT as TODO tasks.
10. **Handoff.** Session getting long → `compact-safe` skill (KEEP constraints and errors verbatim, SUMMARIZE resolved decisions, DROP prose and diary) or `/handoff` to create continuation doc. Don't lose context.

**Context hygiene:** Keep steps 1-3 in one unbroken context window. Don't compact or clear until after planning is complete — compaction mid-planning loses the thread.

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

If `/to-spec` or `/to-tickets` fails, configure the issue tracker first. External tech → validate APIs before step 4 (see below).

## Domain skills (auto-trigger from description)

- **MongoDB** (8): `mongodb-schema-design`, `mongodb-search-and-ai`, `mongodb-query-optimizer`, `mongodb-connection`, `mongodb-mcp-setup` (global first-time install), `mongodb-natural-language-querying`, `mongodb-atlas-stream-processing`, `mongodb-mcp-cluster-per-project` (per-project wiring) — auto-trigger when working with MongoDB.
- **Vercel/React** (5): `vercel-react-best-practices`, `vercel-composition-patterns`, `deploy-to-vercel`, `vercel-optimize`, `web-design-guidelines` — auto-trigger when building React or deploying to Vercel.
- **UI** (3): `frontend-design` (aesthetic direction), `impeccable` (UI quality/polish), `web-design-guidelines` (UI review) — auto-trigger when building or reviewing UI.
- **Web** (8): `search`, `scrape`, `discover-api`, `data-feeds`, `live-research`, `agent-browser`, `rag-pipeline`, `brightdata-cli` — auto-trigger for web tasks. Use `bdata` CLI for SERP/scrape/structured data. Use `pi-web-access` tools (`web_search`, `fetch_content`) for YouTube video understanding, PDF extraction, and local video analysis — configured with Brave, Tavily, and Gemini API keys at `~/.pi/web-search.json`. Fallback order: if `bdata` fails or rate-limited, use `pi-web-access` `web_search`. If `pi-web-access` fails, use `bdata search`. Never both for the same query — pick one, fall back only on failure.
- **Code research** (5): `octocode` (CLI quick-reference), `octocode-research` (investigation workflow), `octocode-brainstorming` (evidence validation), `octocode-rfc-generator`, `octocode-roast` — auto-trigger for evidence-first research, RFCs, or code critique.
- **User-invoked** (12 — `disable-model-invocation: true`, agent suggests, user types): `/teach`, `/triage`, `/writing-great-skills`, `/setup-pre-commit`, `/wizard` (interactive setup for third-party services), `/implement` (execution wrapper: drives TDD + code-review + commit), `/to-spec`, `/to-tickets`, `/grill-with-docs`, `/handoff`, `/improve-codebase-architecture`, `/compact-safe`.
- **Internal reference** (2): `codebase-design` (module/interface vocabulary), `domain-modeling` (domain glossary) — auto-loaded by other skills (tdd, grill-with-docs, to-spec, improve-codebase-architecture).
- **Python/OSS** (3): `uv` (use uv instead of pip/venv), `github` (gh CLI for issues/PRs/CI), `commit` (clean conventional commits) — auto-trigger for Python development and git operations.
- **Auto-safety** (2): `git-guardrails-claude-code`, `resolving-merge-conflicts` — auto-trigger on git operations and merge conflicts.
- **Code quality** (3): `memory-compounding` (5-outcome memory review + 3x promote + docs/solutions/), `codebase-hygiene` (semantic duplicate detection + module deepening, read-only), `diff-driven-docs` (3-layer doc impact classifier, write only what's needed) — auto-trigger on memory hygiene, code audits, and post-BUILD doc checks.
- **Maintenance** (1): `setup-maintenance` (cadence + on-add harmony gate + improvement loop) — auto-trigger on "audit my setup" / "is my setup healthy" / before adding a package. The `/setup-audit` runner is the one-command full audit.

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

- **Coach** (`coach.ts`): the DEFAULT user interface. The user types a task in plain English; Coach classifies it and suggests the workflow (/loop, /research, /review, /ship, or "just do it"). The user rarely types a slash command directly. Don't second-guess a steered input — it was routed intentionally.
- **`/loop "<task>"`** (loop engine): for hard/multi-phase tasks. Bounded (cap 3), plateau-aware, independent verifier convergence (santa, `--cross-model`), test-honesty gates, reconciliation over assertion. Durable state at `~/.pi/workflows/`. Prefer it over `/feature` when the task has separable concerns or a contract.
- **Context sidecar** (`@spences10/pi-context`): oversized tool output (>24KB/300 lines) is stored in SQLite, a receipt is returned in-context. Retrieve with `context_search` / `context_get` — don't re-run the expensive command.
- **Guardrails** (`guardrails.ts`): AGENTS.md rules are re-injected every turn (prominence + compaction-survival). If you skipped them before, follow them now — they didn't go away.
- **Destructive-command gate** (`@spences10/pi-confirm-destructive`): the SYSTEM confirms destructive ops (rm unrecoverable, git reset --hard, destructive SQL). You don't need to ask — it will prompt. Still: state destructive intent before running.
- **Observability** (`/observability`): live browser dashboard at `127.0.0.1:43190` — for the user to watch, not for you to drive.

## Slash commands (power-user shortcuts — Coach suggests these; you don't memorize them)

- `/feature "<desc>"` — full chain: plan → build → review → ship (autonomous end-to-end)
- `/fix "<desc>"` — full chain: debug → build → review → ship (autonomous end-to-end)
- `/plan "<desc>"` — brainstorm + design + spec + tickets
- `/build "<desc>"` — TDD: test first, see fail, implement, see pass
- `/debug "<desc>"` — build feedback loop, find root cause, fix
- `/review` — parallel reviewers on current diff, anti-anchored
- `/ship` — verify with evidence, commit, document
- `/research "<topic>"` — parallel fan-out across web, GitHub, codebase

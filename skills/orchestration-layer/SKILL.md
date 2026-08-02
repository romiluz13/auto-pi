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

## Decision persistence during planning (decision-hold-lifecycle)

During the planning phase (brainstorming, grilling, spec, tickets), when an unresolved decision is discovered that belongs to the user, persist it to `~/.pi/agent/decisions.json` per `decision-hold-lifecycle` (read `/Users/rom.iluz/.agents/skills/decision-hold-lifecycle/SKILL.md` if needed). Surface open decisions in the next state block. Decisions evaporate between sessions and across compaction — persisting them to disk is the structural fix.

## Standalone utilities

These skills are not part of the SDLC flow but are available as standalone utilities:

- **`session-handoff`** (`/handoff`) — cross-session handoff. Write a handoff doc, save key decisions to memory, notify the target session via intercom. Use when a session is getting long and you want a fresh context. This is the compaction escape hatch (see compaction recovery below).
- **`bearings`** (`/bearings`) — "pick up where I left off" status report across all active Pi sessions. The `/bearings` extension command (in `session-status.ts`) is the real implementation; the skill file is catalog-only. Use for morning brief, catch-up, or context reset.

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

## Unique auto-pi phases

These phases exist in the orchestration layer (not in ask-matt) because ask-matt does not define them. ask-matt commits inside implement; auto-pi keeps ship as a separate phase. ask-matt's code-review is two-axis (Standards + Spec); auto-pi adds a third Security axis. ask-matt has no review disposition flow; auto-pi defines the 4 dispositions. ask-matt does not formalize the evidence-block discipline; auto-pi applies it at build-complete and ship.

These phases are entered when ask-matt routes the flow to them — they replace or augment ask-matt's default behavior for these points in the SDLC.

## Phase: ship

**Entry conditions:**

- The build is complete (all acceptance criteria have evidence + verification command output).
- Code review is complete (findings dispositioned: verified-fix items are resolved).
- The user typed `/ship` (or ask-matt routed to the ship phase).

**Specialists to read (absolute paths):**

1. Read `/Users/rom.iluz/.agents/skills/verification-before-completion/SKILL.md` completely — the independent auditor. List every claim, mark each UNVERIFIED, then independently check each. Run the project's test/lint/typecheck command, read the FULL output, confirm exit code.
2. Read `/Users/rom.iluz/.agents/skills/diff-driven-docs/SKILL.md` completely — classify the diff's doc impact (business/technical/audit). Write only the updates genuinely needed. If no docs need updating, set `doc disposition: none-needed`.
3. Read `/Users/rom.iluz/.agents/skills/commit/SKILL.md` completely — clean conventional commits. Stage relevant files INCLUDING doc changes. `/ship` authorizes commit. Never commit `.env*`, credentials, secrets, or keys.
4. Read `/Users/rom.iluz/.agents/skills/github/SKILL.md` completely (conditional) — push to a branch (not main), create a PR with a clear description linking to the spec/issue. GitHub is conditional: if no GitHub remote or user wants commit-only, set `pr url: not-applicable`, `ci: not-applicable`. Do NOT push to main directly. Do NOT fabricate a PR requirement.

**Evidence gates:**

- After verify: the literal verification command, exit code, first + last 5 lines of output (the evidence block). If any claim is CONTRADICTED, STOP — fix before proceeding.
- After docs: doc disposition (`none-needed` with rationale, or what docs were updated).
- After commit: the commit hash.
- After github (if applicable): PR URL + CI status (`pass` / `fail` / `not-applicable`). If CI fails, return to the verify phase with the CI failure.

**Human-controlled stop:**
**Post-work memory hygiene (memory-compounding):**
After the ship phase is complete, run `memory-compounding` (read `/Users/rom.iluz/.agents/skills/memory-compounding/SKILL.md`): review and sharpen persistent memory so it compounds instead of accumulating. Post-work memory hygiene — save durable learnings, prune stale entries, deduplicate repeated lessons. This is the final step before the flow is truly complete.

At the end of the ship phase, emit the state block and tell the user: `Ship complete. Commit: <hash>. PR: <url or N/A>. CI: <pass/fail/NA>. Memory: <compounded or skipped>.` The flow is complete — no next slash command unless the user wants to start a new flow.

## Phase: review-disposition

**Entry conditions:**

- Code review findings exist (the review phase produced `findings: [<severity + file:line + description>]`).
- If `findings: none`, skip this phase entirely — go to the next step in ask-matt's flow.

**Specialists to read:**

1. Read `/Users/rom.iluz/.agents/skills/receiving-code-review/SKILL.md` completely — the verify-before-implement procedure. Verify each suggestion against codebase reality before dispositioning. Push back with technical reasoning if wrong.

**The 4 dispositions (record one per finding):**

- `verified-fix` — the finding is correct; verified and queued for `/build`. Do NOT apply changes during review — the fix happens in `/build` (TDD). Review is review-only.
- `verified-defer` — the finding is correct but should be a separate ticket.
- `rejected` — the finding is wrong; push back with a concrete reason. A dispute is valid ONLY if it carries a concrete `VERIFY_COMMAND` whose output PROVES the finding false.
- `needs-user-decision` — the finding is ambiguous; ask the user.

**Review-only policy:** Do NOT apply changes during review. The disposition phase verifies and records; fixes happen in `/build`.

**Override receiving-code-review's IMPLEMENT step:** When `receiving-code-review` says "6. IMPLEMENT: One item at a time, test each" — **skip it during review**. Replace the IMPLEMENT step with **disposition recording** (one of the 4 dispositions above per finding). The fix happens in `/build` (TDD), not during review. This is an explicit override of the specialist's step 6.

**Evidence gates:**

- Each finding has a disposition with a reason.
- If any disposition is `needs-user-decision`, REMAIN in this phase until all user decisions are resolved. Do NOT go to complete with unresolved user decisions.
- When all dispositions are resolved (no `needs-user-decision` remaining), the evidence gate is satisfied.

**Decision persistence (decision-hold-lifecycle):**
When a review finding surfaces an unresolved design or product decision that belongs to the user, persist it to `~/.pi/agent/decisions.json` per `decision-hold-lifecycle` (read `/Users/rom.iluz/.agents/skills/decision-hold-lifecycle/SKILL.md` if needed). Surface open decisions in the next state block so they are not lost across compaction or session restarts.

**Human-controlled stop:**
Emit the state block (with all dispositions). Tell the user: `Review complete. <N> findings. <disposition summary>. Next: type /build` to address the verified fixes.

## Phase: verification

**Entry conditions:**

- This gate is applied at two points: **build-complete** (before transitioning from build to review) AND **ship** (as the first sub-phase of the ship phase).
- At build-complete: all acceptance criteria have evidence (each slice's test passes).
- At ship: the working tree has changes to verify (or the tree is already committed, in which case verification still runs to confirm the committed state).

**Specialist to read:**

1. Read `/Users/rom.iluz/.agents/skills/verification-before-completion/SKILL.md` completely — the Iron Law: no completion claims without fresh verification evidence. The Gate Function: identify → run → read → verify → then claim.

**Evidence block format (required):**

```
$ <exact command>
exit=<code>
--- first 5 lines ---
<output>
--- last 5 lines ---
<output>
```

No evidence block → the claim is unverified → state that instead. Do NOT claim pass without running the command in this message.

**Evidence gates:**

- The exact verification command was run (not from memory, not from a previous message).
- The exit code is confirmed (0 for pass, non-zero for fail).
- The output is read (first + last 5 lines pasted as evidence).
- If any claim is CONTRADICTED by the output, STOP — fix before proceeding.

**Applied at:**

- **Build-complete:** before transitioning from build to review, run the full test suite + lint + typecheck. If any fail, do NOT advance to review — fix first.
- **Ship:** as the first sub-phase of ship, run verification independently (you are an independent auditor, not trusting the builder's claims).

**Human-controlled stop:**
Emit the state block with the verification evidence block. Tell the user: `Verification complete. <pass/fail>. Next: type /review` (at build-complete) or proceed to the next ship sub-phase (docs).

## Phase: security

**Entry conditions:**

- The review phase is active (code-review has been read, or the flow reached the review point in ask-matt's main flow).
- This is the third review axis, alongside Standards and Spec (which are in the code-review specialist).

**Specialist to read:**

1. Read `/Users/rom.iluz/Dev/my-pi/skills/security-review/SKILL.md` completely (created in T6). If the security-review specialist does not yet exist, use the smell categories below as the interim brief.

**Security review brief (fresh context, diff-only, anti-anchored):**
Give the security reviewer fresh context — only the diff, not the builder's reasoning. Review against these smell categories:

- **Injection** — SQL injection (unparameterized queries), command injection (user input in shell exec), template injection, XSS (unescaped output).
- **Authentication / authorization** — missing auth checks, privilege escalation, IDOR (insecure direct object reference), missing ownership checks.
- **Secrets** — hardcoded credentials, API keys in code, secret logging, secrets in config files committed to the repo.
- **Unsafe deserialization** — untrusted input to eval/parse/exec, YAML.loads with untrusted input, pickle.loads, JSON.parse of attacker-controlled data with prototype pollution.
- **SSRF** — server-side requests to user-controlled URLs, internal endpoint access from external input.
- **Path traversal** — user input in file paths, `../` sequences, symlink attacks.
- **Unsafe operations** — destructive git operations without confirmation, shell exec with user input, unvalidated redirects, regex DoS (ReDoS).
- **Dependency confusion** — untrusted packages, supply-chain risks, missing integrity checks.

**Evidence gates:**

- Each security finding has file:line + severity (CRITICAL / HIGH / LOW).
- Security findings are added to the review `findings:` list alongside Standards and Spec findings.
- If no security findings, state `security: clean` with the categories checked.

**Human-controlled stop:**
Security findings flow into the review-disposition phase. Emit the state block. If there are security findings, they will be dispositioned in review-disposition. Tell the user: `Security review complete. <N> findings or clean>. Next: type /review` (to proceed to disposition).

## Phase: diagnose (build-on-RED and debug)

**Entry conditions:**

- During build: a TDD red test persists after 3 attempts (ask-matt's implement routes here).
- During debug: the user typed `/debug` and ask-matt routed to the diagnosing-bugs on-ramp.

**Specialist to read:**

1. Read `/Users/rom.iluz/.agents/skills/diagnosing-bugs/SKILL.md` completely.
2. **Follow the specialist's Phases 1–4** (establish the feedback loop, reproduce, form hypotheses, instrument). **Skip Phase 5** (Fix + regression test) — the fix + regression test happen in the tdd phase, not here. Do NOT execute the specialist's Phase 5.
3. **Execute Phase 6 (Cleanup + post-mortem) AFTER the fix is applied in tdd** — not during diagnosis.

**Phase 6 cleanup (carried into post-fix):**
After the fix is applied in tdd, ensure:

- All `[DEBUG-...]` instrumentation is removed (`grep` the prefix).
- Throwaway prototypes are deleted (or moved to a clearly-marked debug location).
- The original repro no longer reproduces (re-run the Phase 1 loop).
- The correct hypothesis is stated in the commit / PR message.

This applies to both the build-on-RED path (build-workflow) and the debug path — Phase 6 cleanup happens in tdd after the fix, not during diagnosis.

**Evidence gates:**

- The root cause is identified (the correct hypothesis is stated).
- The causal chain is complete (no "somehow X leads to Y" gaps).
- After the fix: Phase 6 cleanup evidence (grep output showing no [DEBUG-...] tags, original repro no longer reproduces).

**Human-controlled stop:**
Emit the state block with the root cause + cleanup evidence. Tell the user: `Diagnosis complete. Root cause: <summary>. Next: type /build` (to apply the fix in TDD) or `Fix complete. Next: type /review`.

## Severity mapping (review axis → flat list)

**The review produces findings from 3 axes:** Standards (from `code-review`), Spec (from `code-review`), and Security (from the security phase above). The review-disposition phase expects a flat `findings: [<severity + file:line + description>]` list.

**Map each axis finding to a severity:**

- **CRITICAL** — blocks shipping: the code doesn't work, a security vulnerability is exploitable, the spec is not implemented at all, or the code violates a hard standard.
- **HIGH** — should fix before shipping: the code works but has a real quality issue (a spec deviation, a security smell that's likely exploitable, a standards violation that affects correctness or maintainability).
- **LOW** — nice to have: cosmetic, style, minor optimization, non-blocking standards nit.

**Transformation:** Take each axis report (Standards, Spec, Security) and assign one severity per finding. Merge into a single flat list: `findings: [CRITICAL: file:line: description, HIGH: file:line: description, LOW: file:line: description]`. The disposition phase then records one disposition per finding.

- **ask-matt owns the routing.** This layer owns the orchestration mechanics + the unique phases above. Specialists own the procedures.
- **Reread this layer skill** after each phase + after compaction.
- **Never ask the user to type an internal `/skill:*` command.**
- **Do not advance without explicit evidence** (verification output, review findings with file:line, dispositions with reasons, commit hash, PR URL or not-applicable, CI status).
- **Never commit secrets or push main.**
- **GitHub is conditional** — not all repos have a GitHub remote. Do not force a PR.
- **Review is review-only** — do not apply changes during review. Fixes happen in `/build`.
- **Follow only the active phase's specialist.**
- **State is grounded in artifacts** (commit hash, PR URL, verification output), not freeform memory.
- **Compaction is a residual risk.** Reconstruct from conversation artifacts if the state is lost.

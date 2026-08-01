# Audit: What Do the 117 Tests Actually Prove About auto-pi's Runtime Behavior?

**Date:** 2026-07-14  
**Repo:** /Users/rom.iluz/Dev/my-pi  
**Test file:** test/prompt-graph.test.ts (1900 lines)  
**Contract file:** config/workflow-graph-contract.ts (2276 lines)  
**Drift checker:** scripts/check-drift.sh (117 lines)  
**Suite result:** 117 pass, 0 fail, 0 skip, 0 todo — 3.6s total

---

## 1. STATIC VS BEHAVIORAL SPLIT

### Exact count: 111 static, 6 behavioral

| Category | Count | Description |
|---|---|---|
| **Static — string/regex on .md files** | ~75 | Read a prompt or SKILL.md file, run `.test(content)` regex assertions |
| **Static — file existence** | ~6 | `existsSync(path)` checks for SKILL.md files |
| **Static — contract object shape** | ~28 | Inspect TypeScript objects imported from `config/workflow-graph-contract.ts` (field existence, array lengths, set membership, cross-references) |
| **Static — hash verification** | 2 | SHA-256 format check + conditional file-hash comparison |
| **Behavioral — executes a process** | 6 | Run `scripts/check-drift.sh` via `execSync` against fixture git repos or the real repo |

### The 6 behavioral tests (all test the drift checker shell script):

1. `drift fixture 1: no changes (local = base = upstream-HEAD) → exit 0`
2. `drift fixture 2: local-only intentional patch (upstream unchanged) → exit 0`
3. `drift fixture 3: upstream-only change → stale fork → exit 1`
4. `drift fixture 4: both changed → manual review → exit 1`
5. `drift fixture 5: missing provenance → exit 1`
6. `drift integration: real auto-pi forks pass the drift check`

**None of the 117 tests start an agent, load a prompt through Coach, simulate a workflow run, trigger compaction, send an intercom message, or exercise any runtime behavior of the Pi harness.**

The contract file itself declares this at line 2:
> `// This is NOT a runtime engine — it is a validation contract used by tests`

---

## 2. WHAT THE TESTS ACTUALLY PROVE (with confidence)

### Prompt-to-skill pinning (static, high confidence)
- Every prompt `.md` file has a `skill:` frontmatter field (test:68)
- Every pinned skill name has a `SKILL.md` file somewhere on disk — repo `skills/` or `~/.agents/skills/` (test:75)
- Each of the 7 workflow prompts pins the correct workflow skill by name: `/plan`→`planning-workflow`, `/build`→`build-workflow`, `/review`→`review-workflow`, `/ship`→`ship-workflow`, `/debug`→`debug-workflow`, `/research`→`research-workflow`, `/setup-audit`→`setup-maintenance` (tests:88–112)

### Anti-pattern bans in prompts (static, high confidence)
- No prompt says "Next: type /skill:" (test:136)
- No prompt says "invoke /skill:" (test:146)
- No prompt says "Want me to invoke it?" (test:156)

### Workflow SKILL.md structural completeness (static, high confidence)
- All 6 workflow SKILL.md files have: a State protocol section, ≥2 phases, a `complete` phase, absolute canonical skill paths (no `~`), a reread instruction, compaction-as-residual-risk text (tests:168–284)
- Planning workflow has: bounded + foggy branches, design-approval gate, spec/ticket/frontier requirements, foggy state block, setup phase, prototype interrupt, grill-me branch, domain-modeling triggers, explicit consent for grilling, state block fields (style, domain capture, prototype, domain artifacts) (tests:298–530)
- Build workflow has: acceptance-criteria tracking, diagnosis→tdd return, entry invariants (one ticket, refuse multiple), cadence (typecheck regularly, full suite at end), fresh-context hard STOP (tests:330–380, 880–900)
- Ship workflow has: conditional github (not-applicable), none-needed docs, ci state field, always-authorized commit (tests:288–320)
- Review workflow has: skip-disposition-if-clean, no-change-during-review, wait-for-needs-user-decision (tests:324–340)
- Triage prompt has: conditional handoff (only /build when ready-for-agent), "do NOT triage to-tickets" (tests:384–400)

### Contract ↔ SKILL.md cross-reference (static, high confidence)
- Every workflow in the contract exists as a SKILL.md file (test:~910)
- Every workflow prompt pin matches the contract's `promptPin` field (test:~915)
- Every contract phase exists as a `## Phase:` header in the corresponding SKILL.md (test:~920)
- Every contract transition targets a valid phase within the same workflow (test:~925)
- Every workflow has at least one terminal phase (test:~930)
- Every contract handoff is a valid user-facing command (prompt or extension) (test:~935)
- No conditional specialist appears in the unconditional specialists list (test:~940)

### Contract internal consistency (static, high confidence)
- Every terminal phase has conditional outcomes with ≥1 evidence field (tests:~1108, ~1140)
- Every outcome handoff is a valid user-facing command (test:~1160)
- Prototype interrupt exists in the planning contract with correct specialist + resumePhase (test:~1175)
- Grill-me and grilling predicates are mutually exclusive (test:~1200)
- Research is in ASK_MATT_DISPOSITIONS as "equivalent" (test:~1212)
- Every ask-matt disposition has structured fields: trigger, invariants, artifacts, exit, autoPiRoute, sourceCommit (tests:~1219, ~1322)
- State constraints exist for spec phase (design: approved on entry) and tdd phase (ticket on entry) (tests:~1259, ~1274)
- Planning has stateDomains with valid mode, prototype, design, style, domain-capture, domain-artifacts, resume-phase domains (tests:~1790, ~1800)
- State constraint values are valid members of declared domains (test:~1805, with caveats — see vacuous section)

### Reachability/path validation (static, high confidence)
- All specialist skills referenced by workflows exist at a known path (test:~350)
- No installed skill is a true orphan — all reachable by at least one means (test:~815)
- Local forks (code-review, diagnosing-bugs) are the selected paths, not shadowed by community copies (test:~1280)
- Every reachability entry has physical paths that exist on disk (test:~1305)
- Selected path is in runtimePhysicalPaths; selected + shadowed partition runtimePhysicalPaths (tests:~1640–1670)
- Superseded skills (ask-matt, implement, grill-with-docs, claude-handoff) are classified correctly (tests:~1680–1730)

### Drift checker behavior (behavioral, high confidence for the 6 scenarios)
- check-drift.sh correctly exits 0 for: no changes, local-only intentional patch
- check-drift.sh correctly exits 1 for: stale fork (upstream changed), both changed (manual review), missing provenance
- The real auto-pi forks pass the drift check (integration test against the actual repo)
- Provenance frontmatter exists for code-review and diagnosing-bugs (tests:~535, ~540)

### Data integrity (static, conditional confidence)
- ASK_MATT_SOURCE.sha256 is a 64-char hex string (always checked)
- ASK_MATT_SOURCE.sha256 matches the actual upstream file hash (only if `/Users/rom.iluz/Dev/mattpocock-skills/skills/engineering/ask-matt/SKILL.md` exists — **see vacuous section**)

---

## 3. WHAT THE TESTS CANNOT PROVE

### No agent runtime is exercised
- **Coach actually loads the prompt** when a user types `/plan` — no test simulates Coach's prompt-loading mechanism
- **The `skill:` frontmatter actually pins the skill** in the Pi harness — tests verify the field exists and the target file exists, but not that the harness reads and acts on it
- **The model actually reads the SKILL.md** — no test simulates the model reading a skill file
- **The model actually follows the instructions** — no test verifies the model emits state, rereads between phases, or respects the STOP gate

### No workflow execution
- **The workflow actually progresses through phases** — no state machine is executed; tests only check that phase headers exist and transitions are valid by shape
- **Conditional specialists are correctly selected** — predicates like `hasCodebase` are checked for mutual exclusivity in the contract, but no test evaluates them against runtime state
- **State transitions actually happen** — `stateConstraints` are checked for existence and domain membership, but no test simulates a phase entry/exit with actual state values
- **The prototype interrupt actually interrupts and resumes** — the contract has the interrupt definition, and the SKILL.md has the text, but no test simulates the interrupt firing and the workflow resuming

### No compaction recovery
- **State actually survives compaction** — tests verify the SKILL.md *says* "compaction is a residual risk" and "reconstruct from artifacts", but no test simulates compaction and verifies reconstruction works
- **The state block is actually emitted** — tests verify the SKILL.md *says* "emit state before user wait", but no test verifies state is actually emitted

### No harness integration
- **Handoff commands are actually registered** — tests check that outcome handoffs reference valid command names from a set, but not that those commands exist as slash commands in the Pi harness
- **Skill reads actually happen in the right order** — tests extract skill names from `read` instructions via regex, but don't verify the model reads them in sequence
- **Triage routing actually works** — the contract has 6 outcomes with conditional handoffs, but no test simulates triage receiving an issue and routing it

### No portability
- **Absolute paths are machine-specific** — tests verify SKILL.md files use `/Users/rom.iluz/.agents/skills/...` (test:233), which hardcodes a single developer's home directory. On any other machine, these paths are wrong, but the tests pass because they check the pattern `/Users\/[^/]+\/.agents\/skills\//`, not the actual existence of those paths
- **The drift integration test hardcodes** `/Users/rom.iluz/Dev/mattpocock-skills` — fails silently or errors on any other machine
- **ASK_MATT_SOURCE.sha256 comparison is skipped** if the upstream repo isn't at the hardcoded path

---

## 4. VACUOUS / NEAR-VACUOUS TESTS

No test is truly vacuous (no `assert.ok(true)`, no impossible-to-fail assertions). However, several are **near-vacuous** in specific environments:

### Near-vacuous: `ASK_MATT_SOURCE.sha256 is a full 64-char hex digest matching the actual upstream file` (test:1858)
- The hash comparison is wrapped in `if (existsSync(upstreamPath))` — if the upstream repo isn't at `/Users/rom.iluz/Dev/mattpocock-skills/...`, the test only verifies the hash is 64 hex chars.
- The test name promises "matching the actual upstream file" but silently skips that assertion when the file is absent.
- On any machine other than the developer's, this test degrades to a format check.

### Near-vacuous: `ASK_MATT_SOURCE has a SHA-256 hash` (test:1806)
- Checks `sha256` field is truthy and ≥16 chars. Could be `aaaaaaaaaaaaaaaa` and pass. The companion test above catches this *only if the upstream file exists*.

### Weak: `check-drift.sh exists` (test:~545)
- `existsSync(join(REPO_ROOT, "scripts", "check-drift.sh"))` — trivially true unless someone deletes the file. Not vacuous but adds 1 to the count for near-zero value.

### Silent skip: `planning state constraint values are valid members of state domains` (test:1805)
- Contains `if (!domain) continue;` — constraints for fields without a declared domain are silently skipped. This means some state constraints are never validated against any domain. Not vacuous, but the coverage is narrower than the test name implies.

### Wasteful but not vacuous: `runDriftCheck` function (test:1336)
- Runs `check-drift.sh` **twice** per test — first with `|| true` to capture output, then again without to get the exit code. If the filesystem changed between runs, results could diverge. In practice it's just inefficient, not incorrect.

---

## 5. RUNTIME GAPS — WHAT WOULD BREAK THAT TESTS WON'T CATCH

| Runtime failure | Would tests catch it? | Why not |
|---|---|---|
| Coach fails to parse prompt frontmatter (invalid YAML) | **No** | Tests only extract `skill:` via regex, don't parse full YAML |
| `skill:` pin doesn't fire in the Pi harness | **No** | Tests check the field exists, not that the harness acts on it |
| Model reads SKILL.md but skips sections (too long) | **No** | No model simulation; tests only check text patterns exist |
| Model doesn't emit state block before user wait | **No** | Tests check the SKILL.md *says* to emit state, not that it happens |
| Workflow gets stuck between phases | **No** | No state machine execution; transitions checked by shape only |
| Compaction destroys state and reconstruction fails | **No** | Tests check the SKILL.md *mentions* compaction, not that recovery works |
| Conditional specialist predicate evaluates wrong at runtime | **No** | Predicates checked for mutual exclusivity in contract, never evaluated |
| Absolute skill paths wrong on another machine | **No** | Tests check the *pattern* `/Users/[^/]+/`, not actual path validity |
| Handoff command not registered as slash command | **No** | Tests check command name is in a set derived from prompt filenames |
| Drift check passes but fork content is semantically broken | **No** | Drift check compares text diffs, not semantic correctness |
| Skill reads happen out of order | **No** | Tests extract skill names via regex, don't verify execution order |
| Triage routes to wrong outcome | **No** | Contract has outcomes but no routing simulation |
| Prototype interrupt fires but doesn't resume correctly | **No** | Contract has resumePhase, but no interrupt simulation |

---

## 6. HONEST VERDICT

**If someone claimed "auto-pi is the best harness because it has 117 tests," here is the accurate response:**

The 117 tests are a **documentation consistency checking system**, not a runtime test suite. They verify that hand-written markdown files (prompts, SKILL.md) are internally consistent with a hand-maintained TypeScript contract (`workflow-graph-contract.ts`). The contract itself declares at line 2: "This is NOT a runtime engine."

Of the 117 tests:
- **111 (94.9%) are static** — regex matching on file contents, file existence checks, and TypeScript object shape validation
- **6 (5.1%) are behavioral** — all 6 test a single shell script (`check-drift.sh`), not the agent, not the workflow, not the harness

**What the 117 tests certify:** The documentation is self-consistent. Prompts pin skills that exist. SKILL.md files have the expected structural sections. The contract's phase graph has no dangling transitions. Local forks have provenance. The drift checker correctly classifies 5 drift scenarios.

**What the 117 tests do NOT certify:** That the agent actually works. That Coach loads prompts. That skill pins fire. That the model reads and follows SKILL.md instructions. That workflows progress through phases. That state survives compaction. That handoff commands exist at runtime. That any of this works on a machine other than the developer's.

The number "117" measures **documentation diligence**, not **runtime correctness**. Claiming it as evidence of harness quality conflates "we checked our docs are consistent" with "we proved our system works." These are fundamentally different claims. A system with 0 tests could work perfectly at runtime; a system with 117 static tests could fail completely at runtime. The tests provide confidence in the *design artifacts*, not in the *running system*.

The 6 drift-checker behavioral tests are genuinely valuable — they prove a real script behaves correctly in 5 scenarios plus integration. But they test a 117-line bash script, not the agent harness. If the claim is "auto-pi has the most rigorously validated documentation of any Pi config repo," that would be accurate. If the claim is "auto-pi is the best harness because it has 117 tests," that is marketing dressed as engineering.

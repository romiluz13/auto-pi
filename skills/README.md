# Skills

auto-pi v0.4. Three layers: **Coach** (entry) → **ask-matt** (routing) → **orchestration-layer** (mechanics).

## auto-pi repo skills (14)

| Skill | Role |
| ------- | ------ |
| `orchestration-layer` | The model-side procedure layer around ask-matt. The typed workflow machine/interpreter owns transitions, durable evidence, private continuation, and bounded retries. |
| `security-review` | The 3rd review axis (injection, auth/authz, secrets, unsafe deserialization, SSRF, path traversal, unsafe operations, dependency confusion). auto-pi original. |
| `brainstorming` | Design before code (read by ask-matt's grill flow). |
| `code-review` | Two-axis (Standards + Spec) parallel review. Local fork of Matt Pocock (provenance + drift automation, rebased on 84fdeff). |
| `diagnosing-bugs` | Hard-bug diagnosis loop. Local fork of Matt Pocock (provenance + drift automation, rebased on 84fdeff — includes Matt's Redact section + our AI-guards). |
| `receiving-code-review` | Verify before implementing review feedback. |
| `verification-before-completion` | Evidence-block discipline (read by the layer's verification gate + ship). |
| `diff-driven-docs` | Classify doc impact before writing (read by the layer's ship phase). |
| `decision-hold-lifecycle` | Persist unresolved decisions (wired into the layer's planning + review). |
| `memory-compounding` | Post-work memory hygiene (wired into the layer's ship-complete). |
| `session-handoff` | Cross-session handoff (standalone via `/handoff`; the layer's compaction escape hatch). |
| `bearings` | "Where did I leave off" status report (standalone via `/bearings`). |
| `codebase-hygiene` | Semantic duplicates + shallow-module detection (standalone). |
| `setup-maintenance` | Monthly `/setup-audit` runner. |

## ask-matt (pinned external dependency)

The routing brain. Installed from `mattpocock/skills`. Pinned in `config/pinned-deps.json` with provenance (commit `ed37663`, SHA-256). Drift checked by `scripts/check-drift.sh`. ask-matt owns the SDLC graph (main flow: grill → spec → tickets → implement; on-ramps: triage, diagnosing-bugs, wayfinder; standalone: grill-me, prototype, research, handoff). The orchestration-layer wraps it.

## External specialists (ask-matt routes to these)

| Source | Skills |
| -------- | -------- |
| **Matt Pocock** | tdd, handoff, prototype, grill-with-docs, to-spec, to-tickets, triage, implement, research, wayfinder, codebase-design, domain-modeling, resolving-merge-conflicts, writing-great-skills, teach, improve-codebase-architecture |
| **MongoDB** | mongodb-schema-design, mongodb-search-and-ai, mongodb-query-optimizer, mongodb-connection, mongodb-mcp-setup, mongodb-natural-language-querying, mongodb-atlas-stream-processing |
| **Vercel** | vercel-react-best-practices, vercel-composition-patterns, deploy-to-vercel, web-design-guidelines, agent-browser |
| **Bright Data** | search, scrape, discover-api, data-feeds, live-research, brightdata-cli |
| **Octocode** | octocode, octocode-research, octocode-brainstorming, octocode-rfc-generator, octocode-roast |
| **Python/OSS** | uv, github, commit |

## Provenance + drift automation

- `config/pinned-deps.json` — ask-matt provenance (commit + SHA-256).
- `scripts/check-drift.sh` — verifies local forks (code-review, diagnosing-bugs) + pinned deps (ask-matt). Run before any release.
- `code-review` + `diagnosing-bugs` declare upstream provenance in their frontmatter (commit `ed37663`).

> **HISTORICAL** — this audit reflects pre-prune state (12–15 packages, pi-hypa active, 150-line AGENTS.md). Kept for the decision trail. For current state see the [2026-07-09 deep review](2026-07-09-deep-review.md) and [README](../../README.md).

# Pi Agent — Version Freshness & Deprecation Audit

Date: 2026-07-06
Scope: `~/.pi/agent/npm/package.json` (12 extensions), pi core (`@earendil-works/pi-coding-agent`), `settings.json` model references vs `models.json`.

---

## 1. Extension version freshness (12 packages)

All 12 installed extensions are at the **latest published npm version**. No drift.

| Package | Pinned range | Installed | Latest (npm) | Status |
|---|---|---|---|---|
| `@hypabolic/pi-hypa` | `^0.1.6` | 0.1.6 | 0.1.6 | current |
| `@juicesharp/rpiv-ask-user-question` | `^1.20.0` | 1.20.0 | 1.20.0 | current |
| `@narumitw/pi-statusline` | `^0.11.0` | 0.11.0 | 0.11.0 | current |
| `pi-btw` | `^0.4.1` | 0.4.1 | 0.4.1 | current |
| `pi-hermes-memory` | `^0.7.23` | 0.7.23 | 0.7.23 | current |
| `pi-intercom` | `^0.6.0` | 0.6.0 | 0.6.0 | current |
| `pi-lens` | `^3.8.65` | 3.8.65 | 3.8.65 | current |
| `pi-observational-memory` | `^3.0.3` | 3.0.3 | 3.0.3 | current |
| `pi-prompt-template-model` | `^0.10.0` | 0.10.0 | 0.10.0 | current |
| `pi-rewind` | `^0.5.0` | 0.5.0 | 0.5.0 | current |
| `pi-subagents` | `^0.33.1` | 0.33.1 | 0.33.1 | current |
| `pi-web-access` | `^0.13.0` | 0.13.0 | 0.13.0 | current |

Verification command: `npm view <pkg> version` and `npm view <pkg> deprecated` per package.

## 2. Deprecated / renamed packages

**No installed user extension is deprecated.** However, a deprecated namespace is referenced via peer dependencies:

- `@mariozechner/pi-coding-agent` (v0.73.1) — **DEPRECATED** on npm: *"please use @earendil-works/pi-coding-agent instead going forward"*.
- `@mariozechner/pi-tui` (v0.73.1) — **DEPRECATED** on npm: *"please use @earendil-works/pi-tui instead going forward"*.

These are referenced as **peerDependencies** of `pi-intercom@0.6.0` (see §4). They are not installed and not directly pulled in, so there is no broken install — but the reference is stale.

## 3. Superseded by newer community standard

None of the 12 installed extensions have been superseded by a newer community-standard package. Each is the maintained package in its niche. The only supersession in play is the namespace migration `@mariozechner/*` → `@earendil-works/*` (the pi core vendor renamed), which only affects `pi-intercom`'s peer-dep declaration (§4).

## 4. Version conflicts / peer-dep mismatches

Shared peer dependencies across extensions (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, `typebox`):

Installed (resolved) shared deps in `~/.pi/agent/npm/node_modules`:
- `@earendil-works/pi-tui` 0.80.3
- `typebox` 1.1.24
- `better-sqlite3` 12.11.1
- `tsx` 4.22.4

Peer-only (not in node_modules, provided globally by mise — expected): `@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`. No version conflicts among installed shared deps.

**Latent peer-dep namespace mismatch — `pi-intercom@0.6.0`:**
```
peerDependencies:
  "@mariozechner/pi-coding-agent": "*"
  "@mariozechner/pi-tui": "*"
```
The actual pi core shipped by the vendor is now `@earendil-works/pi-coding-agent@0.80.3` and `@earendil-works/pi-tui@0.80.3`. `pi-intercom` is already at its latest published version (0.6.0), so this is **not user-fixable** — it requires an upstream release of `pi-intercom` that retargets its peer deps to the `@earendil-works/*` namespace. Because peer deps are not enforced at runtime by pi's loader, this does not break the install today, but it is a latent risk: any future strict peer-dep enforcement, or a `npm install` in a clean tree, will fail peer resolution for `pi-intercom`.

No other inter-package version conflicts found.

## 5. Pi core (`@earendil-works/pi-coding-agent`) freshness

- Installed (global, via mise `node@24.15.0`): `@earendil-works/pi-coding-agent@0.80.3` at `/Users/rom.iluz/.local/share/mise/installs/node/24.15.0/lib/node_modules/@earendil-works/pi-coding-agent/dist/cli.js`; `pi` binary resolves here.
- Latest on npm: `0.80.3`.
- `settings.json` `lastChangelogVersion`: `"0.80.3"`.

All three match → **pi core is current.** No changelog-version drift.

## 6. Model references in `settings.json` vs `models.json`

`models.json` defines providers `grove` and `grove-openai`. Checked each settings model reference:

| Setting location | provider | model id | Present in `models.json`? |
|---|---|---|---|
| `settings.defaultModel` (via `defaultProvider: "grove-openai"`) | grove-openai | `FW-GLM-5.2` | **YES** (grove-openai.models[].id) |
| `settings.observational-memory.model` | grove-openai | `gpt-5.4-mini` | **YES** (grove-openai.models[].id) |
| `settings.subagents.agentOverrides.*` | — | — | N/A — only sets `thinking: "xhigh"`, **no model/provider override** |

Both configured model IDs resolve to entries in `models.json`. **No latent model-reference bug.** No subagent role overrides a model, so there are no hidden missing-model references in `subagents.agentOverrides`.

Cross-check: `defaultProvider: "grove-openai"` and `observational-memory.model.provider: "grove-openai"` both exist as top-level providers in `models.json`.

---

## Verdict

- **Freshness: HEALTHY.** All 12 npm extensions and the pi core (`@earendil-works/pi-coding-agent@0.80.3`) are at latest published versions; `lastChangelogVersion` matches the installed core.
- **Deprecation: one latent, upstream-only issue.** `pi-intercom@0.6.0` declares peer deps on the deprecated `@mariozechner/pi-coding-agent` / `@mariozechner/pi-tui` namespace (superseded by `@earendil-works/*`). It's already the latest `pi-intercom`, so the fix must come from the `pi-intercom` maintainer. No runtime breakage today; risk under future strict peer-dep enforcement or clean-tree `npm install`.
- **Version conflicts: none** among installed shared deps.
- **Model references: NO latent bug.** `FW-GLM-5.2` and `gpt-5.4-mini` are both present in `models.json`; `subagents.agentOverrides` carries no model overrides to validate.

No action required on the user's side for freshness. The single follow-up worth tracking is an upstream `pi-intercom` release that retargets its peer deps to `@earendil-works/*`.

Read-only audit — no files changed.

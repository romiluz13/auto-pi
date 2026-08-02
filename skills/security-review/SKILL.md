---
name: security-review
description: "Security review of the diff — the third review axis alongside Standards and Spec. Reviews for injection, auth, secrets, deserialization, SSRF, path traversal, unsafe operations, and dependency confusion. Use as a parallel sub-agent with fresh context (diff-only, anti-anchored) during the review phase."
provenance: auto-pi-original
---

# Security Review

The third review axis in auto-pi's review phase — alongside **Standards** (does the code follow the repo's conventions?) and **Spec** (does the code match what was asked for?). This axis answers: **does the diff introduce security vulnerabilities?**

Runs as a **parallel sub-agent** with fresh context — only the diff, not the builder's reasoning — so the security review is not anchored by the implementer's assumptions.

## Smell catalog

Each smell reads *what it is* → *how to spot it in the diff* → *how to fix*. Match against the diff hunks:

1. **Injection** — user-controlled input reaches a dangerous sink without sanitization.
   - **SQL injection** — string-concatenated queries, unparameterized `query()`, ORM raw queries with user input. → parameterize; use prepared statements / parameterized query builders.
   - **Command injection** — user input in `exec()`, `execSync()`, `spawn()` shell mode, backticks, `subprocess.run(shell=True)`. → use argument arrays (`execFile`, `spawn` without `shell: true`); never interpolate.
   - **Template injection** — user input in template engines (`eval`, `ejs`, `jinja2`, `nunjucks`) that execute code. → use logic-less templates or auto-escaping; never `eval` user content.
   - **XSS** — unescaped user input rendered in HTML (`innerHTML`, `dangerouslySetInnerHTML`, `|safe` in Django, `{!! !!}` in Blade). → escape on output; use framework auto-escaping; CSP headers.

2. **Authentication / authorization** — missing or bypassable access control.
   - **Missing auth checks** — a route, endpoint, or function that should require authentication but doesn't. → add the auth middleware/guard.
   - **Privilege escalation** — a user can perform actions above their role (horizontal or vertical). → check role/permission at the action site, not just the route.
   - **IDOR (Insecure Direct Object Reference)** — user can access another user's resource by changing an ID in the URL/params. → verify ownership: `where("user_id = ?", currentUser.id)`.
   - **Missing ownership checks** — the code loads a resource by ID without checking the requester owns it. → add ownership scoping.

3. **Secrets** — credentials exposed in code or config.
   - **Hardcoded credentials** — API keys, passwords, tokens, private keys in source. → move to env vars / secret manager; rotate if committed.
   - **API keys in code** — `const API_KEY = "sk-..."`. → env var; `.env` in `.gitignore`.
   - **Secret logging** — tokens, passwords, PII written to logs. → redact before logging; never log secrets.
   - **Secrets in committed config** — `.env` not in `.gitignore`, `config.json` with prod keys. → `.gitignore` + secret manager.

4. **Unsafe deserialization** — untrusted data parsed into executable or object form.
   - `eval()` / `Function()` on user input. → never; use `JSON.parse` (no code execution).
   - `pickle.loads()` / `yaml.load()` (unsafe) on untrusted input. → `yaml.safe_load`; avoid pickle for untrusted data.
   - `JSON.parse` of attacker-controlled data with prototype pollution (`__proto__`). → use `Object.create(null)` or a safe schema; validate keys.
   - `unserialize()` in PHP, `readObject()` in Java. → use safe alternatives; whitelist classes.

5. **SSRF (Server-Side Request Forgery)** — the server makes requests to attacker-controlled URLs.
   - Server-side fetch/HTTP to a user-supplied URL (webhooks, image fetching, URL previews). → validate and restrict: allowlist domains, block internal IPs (127.0.0.1, 169.254.169.254, 10.x, 192.168.x), follow-redirect limits.
   - Internal endpoint access from external input. → same restrictions.

6. **Path traversal** — user input in file paths allows escaping the intended directory.
   - `../` sequences in file paths, `path.join(userInput, ...)` without normalization. → normalize and verify the result is within the allowed root: `path.resolve()` + check `startsWith(allowedDir)`.
   - Symlink attacks — following symlinks created by an attacker. → use `fs.realpath`; check the resolved path.

7. **Unsafe operations** — dangerous actions without safeguards.
   - **Destructive git** — `push --force`, `reset --hard`, branch deletion without confirmation. → require explicit user confirmation; never automate.
   - **Shell exec with user input** — `exec(userInput)`. → see Injection; use argument arrays.
   - **Unvalidated redirects** — `redirect(userInput)` (open redirect). → allowlist redirect targets; reject absolute URLs.
   - **ReDoS** — regex that can cause catastrophic backtracking on user input (`(a+)+`). → use safe regex patterns; test with long inputs; consider `re2`.

8. **Dependency confusion / untrusted packages** — supply-chain risks in the diff.
   - New dependencies from untrusted sources, missing integrity checks. → verify package source, check for known vulnerabilities (`npm audit`, `pip-audit`), pin versions.
   - Dependency confusion (package exists in multiple registries with different content). → use scoped registries; verify `package-lock.json` / `requirements.txt` integrity.
   - Importing from URLs / git repos instead of registries. → prefer registry packages; verify checksums.

## Review brief (sub-agent prompt)

Run the security review as a **parallel sub-agent** with fresh context. The sub-agent gets **only the diff** — not the builder's reasoning, not the spec, not the plan — so the review is anti-anchored.

**Security sub-agent prompt** — include:

- The full diff command and commit list (same as Standards/Spec sub-agents).
- The smell catalog above, pasted in full — the sub-agent has no other access to it.
- The brief: "Review this diff for security vulnerabilities ONLY. For each finding: (a) name the smell category, (b) cite the file:line, (c) quote the vulnerable hunk, (d) explain the attack scenario, (e) state severity (CRITICAL / HIGH / LOW), (f) suggest the fix. If a category has no findings, state it is clean. Skip anything tooling already enforces (e.g. a linter that blocks `eval`). Under 400 words."

**Anti-anchored rules:**

- Do NOT read the PR description, the commit message rationale, or the builder's plan — these are self-grading and may downplay security issues.
- Do NOT trust comments in the code that say "safe" or "validated" — verify the validation exists in the diff.
- Do NOT skip a category because "this repo doesn't do X" — if the diff touches X, review it.

## Severity guidance

Map each security finding to one of three severities:

- **CRITICAL** — the vulnerability allows unauthenticated remote code execution, authentication bypass, or mass data exfiltration. The system is exploitable as-is. → must fix before merge; blocks ship.
- **HIGH** — the vulnerability allows authenticated privilege escalation, injection with limited impact, or exposure of sensitive data to a subset of users. Exploitable but requires access or specific conditions. → should fix before merge; blocks ship unless explicitly accepted by the user.
- **LOW** — the vulnerability requires unusual conditions, has limited impact, or is a defense-in-depth concern (e.g. missing rate limiting, verbose error messages leaking internal paths). → nice to have; can ship with a follow-up ticket.

**No self-grading downgrade:** An implementer's stated rationale ("it's an internal tool", "the input is trusted") is self-grading, not external evidence. It must NOT downgrade a finding's severity. If the rationale points at the deployment context rather than the code, that's a PLAN_DEFECT (route to the planner), not a reason to soften the security finding.

## Aggregation

Security findings are added to the review `findings:` list alongside Standards and Spec findings. Each finding has:

```text
<severity> <file>:<line> <smell category> — <description>
```

If no security findings, state `security: clean` with the categories checked (so the reviewer didn't just skip them).

The findings flow into the review-disposition phase — the orchestration layer dispositions each finding (verified-fix, verified-defer, rejected, needs-user-decision). Security CRITICAL findings that are `verified-fix` block ship until resolved.

## Provenance

This skill is an **auto-pi original** — no Matt Pocock upstream. It exists because ask-matt's `code-review` is two-axis (Standards + Spec) with no security methodology; auto-pi adds the third axis with a real smell catalog and sub-agent brief.

# Launch post — "The GLM-5.2 push that made me leave Claude Code and Codex for Pi"

**Draft date:** 2026-07-08 (for posting 2026-07-09)
**Author voice:** Rom — first person, honest, evidence-backed
**Verified numbers:** GLM-5.2 $1.14/$3.58 (Fireworks route, from models.json) / Opus 4.8 $5/$25 — 4.4×–7× cheaper

---

## The post (Reddit + LinkedIn long-form)

The news around GLM-5.2 forced a decision I'd been putting off.

I was paying for Claude Code and Codex. Both are genuinely good at their job — Claude Code's long-horizon reasoning is still the gold standard, and Codex's parallel sandboxed agents are slick. But the bills were climbing, and the thing that always bugged me wouldn't go away: neither of them is *mine*. They're opinionated black boxes. I can't swap the model, I can't change the workflow, I can't look at the system prompt and say "this is what you actually are." I'm renting my agent.

Then GLM-5.2 dropped in June. Zhipu/Z.ai's 744B open-weight MoE, MIT-licensed, 1M-token context, trained on Huawei Ascend chips (no Nvidia). The community take was loud: Jeremy Howard called it a "marvel — at least as good as Opus 4.8, super fast, inexpensive." Simon Willison said "probably the most powerful text-only open weights LLM." The SWE-bench Pro score (62.1) beats GPT-5.5 (58.6) and trails Opus 4.8 (69.2) by a few points. On FrontierSWE it's within 1% of Opus. And the price: $1.40/$4.40 per million tokens vs Opus 4.8's $5/$25.

That was the push. Not because GLM is better than Opus at everything — it isn't. But because it's *good enough* for 95% of daily work at a fraction of the cost, and it exposed the real problem: I was renting an agent I couldn't shape, paying frontier-model prices for routine coding, and the harnesses I used wouldn't let me fix that.

So I went looking for a harness that was adjustable to *my* needs — minimal core, everything composable, any model I want. That's Pi.

## Why Pi

Pi (by Mario Zechner, the libGDX creator, now under Earendil Works) is the "Neovim of coding agents." Tiny core — read, write, edit, bash. No built-in MCP, no sub-agents, no plan mode baked in. You build those as extensions, skills, or CLI tools. Mario's framing: "All I wanted was a shitty coding agent that is truly mine." That's exactly the itch I had.

The Reddit community had already arrived at the same conclusion before me: r/ClaudeCode is full of "$20 Pro is unusable, you hit the 5-hour limit in 15 minutes" threads, the $200 Max tier has a "Max Trap" (weekly limits only 2-3× the $100 tier — you code faster, not longer), and there's no fuel gauge so agentic background reasoning silently burns 20-50% of your quota on one prompt. Over on r/codingagents, Codex users complain about v5.5 "token guzzling" and model degradation — a heavy agentic run at API rates can cost $15-25 *per PR*. The consensus advice I kept seeing: install an open harness like Pi or OpenCode, bring your own key, route to a cheaper model for daily work, reserve Claude for the hard stuff.

That's the setup I built.

## What I built on Pi (the proof, not the claim)

I paired Pi with GLM-5.2 (via Fireworks, $1.14/$3.58 per Mtok — **4.4× cheaper on input, 7× cheaper on output** than Opus 4.8). Then I spent weeks turning it into the agent I actually wanted. It's open source: **github.com/romiluz13/my-pi**.

The headline: **the agent decides, I never memorize a command.**

You type a task in plain English. An extension called Coach routes it — via an LLM call over the live command catalog — to the right workflow. One tap to confirm.

```
you:   add dark mode to the dashboard
coach: → BUILD — suggests /feature (plan→build→review→ship)
       (also activating: frontend-design, web-design-guidelines)
you:   [Enter]
       → runs autonomously: brainstorm → TDD → parallel review → verify → commit
```

I didn't memorize `/feature`. I didn't manually invoke the UI skills. Coach read my task and surfaced the right workflow; the skills activated themselves.

Here's the part I'm proudest of, and the part that's ideologically honest: **the routing isn't a hard-coded regex table.** I originally wrote a 370-line regex classifier and then ripped it out because it contradicted the whole point — the Matt Pocock methodology: the agent is smart, give it judgment. Coach now reads the live command list (`pi.getCommands()`) every call. Drop a new skill in the folder tomorrow and Coach can route to it on the next input. Zero code or config edit.

## What's in it

- **14 packages** — two-layer memory (cross-session SQLite FTS5 + within-session compaction-survival), LSP diagnostics, subagents, context sidecar, observability dashboard, destructive-op gate
- **5 custom extensions** — Coach (LLM routing), loop engine (bounded with phase gates + cross-model verifier), guardrails (conditional re-injection), palette, handoff
- **56 skills** — Matt Pocock core workflow, MongoDB (8), Vercel/React (5), Bright Data web (8), Octocode code research (5), UI, Python, code quality
- **9 slash commands** + `/loop` for hard multi-phase tasks
- **3 external CLIs** — bdata (web search/scrape), octocode (code research), gh (GitHub)

It self-maintains: `/setup-audit` runs 6 parallel subagents checking versions, harmony, Coach coverage, disk, AGENTS.md, and ecosystem steals.

And it dogfoods itself — the coach rewrite, the guardrails change, the skill flips were all researched, specced, ticketed, built, and verified using this exact setup. The GitHub issues (#1-#8) and commits are public.

## The honest part

I'm not going to tell you this is "the best setup in the world." I'm going to tell you what it does, what it costs me to run, and what it rejected — and let you decide.

It rejected 13 packages/skills with documented reasons (in the README). The one that broke multi-line bash got removed. The AGENTS.md rule file was slimmed from 152 to 131 lines because ETH Zurich research showed re-injecting a huge rulebook every turn actually *breaks* reasoning (+20% inference cost) — so guardrails now inject fully only on session start and after compaction, with a 1-line reminder otherwise.

GLM-5.2 isn't Opus 4.8. Opus still wins on the hardest logic and tool-heavy workflows. The community "benchmaxxing" skepticism is real — r/LocalLLaMA flags that GLM may be over-optimized for SWE-bench while struggling with messy real-world architecture. I use Opus for the 5% of work that actually needs it, and GLM for the 95% that doesn't. That's the whole point of an adjustable harness: you route to the model that fits the task, not the one your vendor locked you into.

If you're tired of the $200/month bill and the black box, this is one way out.

Repo: **github.com/romiluz13/my-pi** — one-command install, MIT, works with Pi and shares its rule file with Claude Code and Codex via symlink. The audit reports are in `docs/audits/` if you want to verify every claim.

Happy to answer questions.

---

## X (Twitter) thread version

**Tweet 1:**
GLM-5.2 forced a decision I'd been putting off.

I was renting Claude Code and Codex — paying frontier-model prices for routine coding, and neither harness let me swap the model or shape the workflow.

So I left both for Pi + GLM-5.2 and built the agent I actually wanted ↓

**Tweet 2:**
The numbers:

GLM-5.2 (via Fireworks): $1.14/$3.58 per Mtok
Claude Opus 4.8:          $5.00/$25.00 per Mtok

4.4× cheaper input. 7× cheaper output. Within 1% of Opus on FrontierSWE.

I use Opus for the 5% that needs it. GLM for the 95% that doesn't.

**Tweet 3:**
Pi (by Mario Zechner, the libGDX creator) is the "Neovim of coding agents" — tiny core, everything composable, any model.

Reddit was already there: r/ClaudeCode "$20 Pro unusable, 5hr limit in 15 min," r/codingagents "Codex token guzzling, $15-25 per PR at API rates."

The consensus: open harness + BYOK + cheap model.

**Tweet 4:**
What I built on it: the agent decides, I never memorize a command.

You type a task. Coach routes it via an LLM call to the right workflow. Skills activate themselves. It runs to done.

"add dark mode to the dashboard" → /feature → plan→build→review→ship, autonomously.

**Tweet 5:**
The routing isn't a regex table. I wrote 370 lines of regex, then ripped it out — it contradicted the point.

Coach reads the live command list every call. Add a new skill → it's routable on the next input. Zero code edit.

Matt Pocock school: the agent is smart, give it judgment.

**Tweet 6:**
What's in it:
• 14 packages (two-layer memory, LSP, subagents, context sidecar, observability)
• 5 custom extensions (Coach, loop engine, guardrails, palette, handoff)
• 56 skills, 9 slash commands
• Self-maintaining /setup-audit (6 parallel subagents)

**Tweet 7:**
It dogfoods itself. The coach rewrite, guardrails change, skill flips — all researched, specced, built, and verified using this exact setup. GitHub issues #1-#8 are public.

13 packages rejected with documented reasons. The one that broke multi-line bash got removed.

**Tweet 8:**
Honest part: GLM-5.2 isn't Opus. Opus wins on the hardest logic. The "benchmaxxing" skepticism is real. I use Opus for the 5%, GLM for the 95%.

That's the point of an adjustable harness — route to the model that fits, not the one your vendor locked you into.

github.com/romiluz13/my-pi

---

## Notes for posting

**Verified facts in this post:**

- GLM-5.2 pricing: $1.14/$3.58 (your Fireworks/Grove route from models.json) / official Z.ai $1.40/$4.40 — use your route for the headline ratio
- Opus 4.8 pricing: $5/$25 (corroborated by OpenRouter + Anthropic + multiple pricing guides)
- GLM-5.2 benchmarks: SWE-bench Pro 62.1, FrontierSWE 74.4 (within 1% of Opus 75.1), beats GPT-5.5 (58.6) — from official z.ai/blog/glm-5.2
- GLM-5.2: 744B MoE, MIT license, 1M context, Huawei Ascend training — from z.ai blog
- Pi: Mario Zechner, Earendil Works, "Neovim of coding agents" — from pi.dev + Reddit r/AI_Agent_Reviews
- Reddit complaints: r/ClaudeCode $20 unusable, Max Trap, no fuel gauge; r/codingagents Codex token guzzling $15-25/PR — from Reddit thread synthesis
- Jeremy Howard "marvel" quote, Simon Willison "most powerful text-only open weights" — from aggregator syntheses (ai-tldr.dev, latent.space); if you quote these directly, fetch the original tweets to confirm verbatim wording

**⚠️ Avoid (unverified / flagged by research):**

- Don't say "Opus 4.8 is $15/$75" — one source cited this, it's wrong. It's $5/$25.
- Don't state a SWE-bench *Verified* figure for GLM-5.2 — official blog reports SWE-bench *Pro* (62.1), not Verified.
- Don't cite Pi adoption numbers (66.9k stars, 2.5M npm/wk) as fact — from aggregator blogs, not verified against live counters. Run `gh api repos/earendil-works/pi` if you want a real number.
- If you quote tweets directly (Howard, Willison), fetch the original tweet IDs first — x.com blocks bot fetching so the research couldn't confirm verbatim text.

**Suggested subreddits:** r/ClaudeCode, r/codingagents, r/LocalLLaMA, r/AI_Agents
**Suggested hashtags (LinkedIn):** #AICoding #DeveloperTools #OpenSource #CodingAgents #Pi #GLM5

**Before you post:**

1. Restart your Pi session and run a real task through Coach — grab a screenshot/GIF of Coach routing a task. The text demo is strong; a visual is 10× stronger.
2. Double-check the repo link resolves and the README looks right on GitHub (the render can differ from local).

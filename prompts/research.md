---
description: Research a topic — investigate against primary sources, capture findings as markdown
argument-hint: "<topic to research>"
skill: research
---
Research the following topic. Follow the `research` skill procedure (investigate against high-trust primary sources, capture findings as a markdown file).

Topic: $@

The `research` skill is now loaded — follow its procedure. It delegates to a background agent that investigates against high-trust primary sources and captures findings as a markdown file in the repo.

Supplement with parallel fan-out where useful:

1. **Web research** — use `bdata search` and `bdata scrape` to find current docs. Focus on primary sources.
2. **GitHub research** — use `npx octocode` to search code across repositories.
3. **Codebase research** — search the current repo for existing implementations.
4. **Memory search** — search memory for past decisions, failures, or insights.

After research returns:

- Synthesize findings into a single summary.
- Cite each claim to its source.
- Flag contradictions.
- Save key findings to memory.

Do NOT write any code. This is research only.

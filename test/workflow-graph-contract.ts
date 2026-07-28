// Machine-readable workflow graph contract for auto-pi v0.3+.
// This is NOT a runtime engine — it is a validation contract used by tests
// and as documentation of the intended graph. Tests validate that the
// SKILL.md files match this contract (phases, transitions, specialists,
// handoffs) rather than inferring the graph from prose.

export interface PhaseDef {
	name: string;
	specialists: string[]; // skills read in this phase (conditional reads marked with predicate in the predicate field)
	conditionalSpecialists?: { skill: string; predicate: string }[];
	next?: string[]; // allowed next phases (by name)
	terminal?: boolean;
	handoff?: { command: string; argPlaceholder?: string }; // user-facing slash handoff
}

export interface WorkflowDef {
	name: string;
	promptPin: string; // the skill: frontmatter in the prompt
	phases: PhaseDef[];
	stateFields: string[];
}

export const WORKFLOWS: WorkflowDef[] = [
	{
		name: "planning-workflow",
		promptPin: "planning-workflow",
		stateFields: [
			"workflow",
			"mode",
			"phase",
			"design",
			"style",
			"domain capture",
			"domain artifacts",
			"prototype",
			"prototype question",
			"prototype conclusion",
			"unresolved design uncertainty",
			"spec",
			"tickets",
			"frontier",
		],
		phases: [
			{
				name: "classify",
				specialists: [],
				next: ["setup", "wayfind"],
			},
			{
				name: "setup",
				specialists: [],
				next: ["brainstorm"],
			},
			{
				name: "brainstorm",
				specialists: [],
				conditionalSpecialists: [
					{ skill: "brainstorming", predicate: "style: brainstorming" },
					{ skill: "grilling", predicate: "style: grilling" },
					{ skill: "grill-me", predicate: "style: grilling + no codebase" },
					{ skill: "domain-modeling", predicate: "domain capture: on" },
				],
				next: ["spec"],
			},
			{
				name: "spec",
				specialists: ["to-spec"],
				next: ["tickets"],
			},
			{
				name: "tickets",
				specialists: ["to-tickets"],
				next: ["complete"],
			},
			{
				name: "wayfind",
				specialists: ["wayfinder"],
				next: ["complete", "setup", "spec"],
			},
			{
				name: "complete",
				specialists: [],
				terminal: true,
				handoff: { command: "build", argPlaceholder: "<frontier>" },
			},
		],
	},
	{
		name: "build-workflow",
		promptPin: "build-workflow",
		stateFields: [
			"workflow",
			"phase",
			"ticket",
			"acceptance criteria",
			"slices completed",
			"slices remaining",
			"red",
			"root cause",
			"verification",
		],
		phases: [
			{
				name: "tdd",
				specialists: ["tdd"],
				conditionalSpecialists: [
					{ skill: "uv", predicate: "project is Python" },
				],
				next: ["diagnose", "complete"],
			},
			{
				name: "diagnose",
				specialists: ["diagnosing-bugs"],
				next: ["tdd"],
			},
			{
				name: "complete",
				specialists: [],
				terminal: true,
				handoff: { command: "review" },
			},
		],
	},
	{
		name: "review-workflow",
		promptPin: "review-workflow",
		stateFields: ["workflow", "phase", "findings", "dispositions"],
		phases: [
			{
				name: "review",
				specialists: ["code-review"],
				next: ["disposition", "complete"],
			},
			{
				name: "disposition",
				specialists: ["receiving-code-review"],
				next: ["complete"],
			},
			{
				name: "complete",
				specialists: [],
				terminal: true,
				handoff: { command: "build" }, // or ship — conditional on findings
			},
		],
	},
	{
		name: "ship-workflow",
		promptPin: "ship-workflow",
		stateFields: [
			"workflow",
			"phase",
			"verification",
			"doc disposition",
			"commit hash",
			"pr url",
			"ci",
		],
		phases: [
			{
				name: "verify",
				specialists: ["verification-before-completion"],
				next: ["docs"],
			},
			{
				name: "docs",
				specialists: ["diff-driven-docs"],
				next: ["commit"],
			},
			{
				name: "commit",
				specialists: ["commit"],
				next: ["github"],
			},
			{
				name: "github",
				specialists: [],
				conditionalSpecialists: [
					{ skill: "github", predicate: "GitHub remote + user intent to push" },
				],
				next: ["complete"],
			},
			{
				name: "complete",
				specialists: [],
				terminal: true,
			},
		],
	},
	{
		name: "research-workflow",
		promptPin: "research-workflow",
		stateFields: ["workflow", "phase", "research type", "findings", "sources"],
		phases: [
			{
				name: "classify",
				specialists: [],
				next: ["investigate"],
			},
			{
				name: "investigate",
				specialists: [],
				conditionalSpecialists: [
					{ skill: "research", predicate: "research type: general" },
					{ skill: "octocode-research", predicate: "research type: code" },
					{ skill: "live-research", predicate: "research type: deep-brief" },
				],
				next: ["complete"],
			},
			{
				name: "complete",
				specialists: [],
				terminal: true,
				handoff: { command: "plan" }, // or build, or stop — conditional
			},
		],
	},
	{
		name: "debug-workflow",
		promptPin: "debug-workflow",
		stateFields: [
			"workflow",
			"phase",
			"issue type",
			"root cause",
			"conflict resolved",
		],
		phases: [
			{
				name: "classify",
				specialists: [],
				next: ["diagnose", "resolve-conflict"],
			},
			{
				name: "diagnose",
				specialists: ["diagnosing-bugs"],
				next: ["complete"],
			},
			{
				name: "resolve-conflict",
				specialists: ["resolving-merge-conflicts"],
				next: ["complete"],
			},
			{
				name: "complete",
				specialists: [],
				terminal: true,
				handoff: { command: "build", argPlaceholder: "<fix>" },
			},
		],
	},
];

// ─── Reachability classification (two axes, non-overlapping) ───────────────

export interface ReachabilityEntry {
	skill: string;
	invocationSurface:
		| "workflow-prompt-pin"
		| "workflow-phase-read"
		| "extension-command"
		| "catalog-only"
		| "unavailable";
	productRole:
		| "orchestrator"
		| "normal-path-specialist"
		| "conditional-specialist"
		| "standalone-utility"
		| "domain-auto-triggered"
		| "superseded"
		| "community-on-demand";
	discoveryRoute: string;
	rationale: string;
}

// The ask-matt route dispositions (non-vacuous — each route has an explicit disposition)
export interface AskMattDisposition {
	askMattRoute: string;
	disposition:
		| "equivalent"
		| "deliberate-substitution"
		| "intentional-standalone"
		| "intentional-unsupported";
	rationale: string;
}

export const ASK_MATT_DISPOSITIONS: AskMattDisposition[] = [
	{
		askMattRoute: "grill-with-docs",
		disposition: "deliberate-substitution",
		rationale:
			"Decomposed into grilling (style) + domain-modeling (durable capture). Loading it would re-couple the dimensions we separated.",
	},
	{
		askMattRoute: "prototype",
		disposition: "equivalent",
		rationale:
			"Planning-workflow prototype interrupt (workflow-owned, consented).",
	},
	{
		askMattRoute: "to-spec",
		disposition: "equivalent",
		rationale: "Planning-workflow spec phase.",
	},
	{
		askMattRoute: "to-tickets",
		disposition: "equivalent",
		rationale: "Planning-workflow tickets phase.",
	},
	{
		askMattRoute: "implement",
		disposition: "deliberate-substitution",
		rationale:
			"Decomposed into build-workflow (tdd) + review-workflow (code-review) + ship-workflow (commit). Invariants preserved.",
	},
	{
		askMattRoute: "tdd",
		disposition: "equivalent",
		rationale: "Build-workflow tdd phase.",
	},
	{
		askMattRoute: "code-review",
		disposition: "equivalent",
		rationale: "Review-workflow review phase (+ Security axis).",
	},
	{
		askMattRoute: "triage",
		disposition: "equivalent",
		rationale: "/triage prompt (direct pin) + 8th Coach option.",
	},
	{
		askMattRoute: "diagnosing-bugs",
		disposition: "deliberate-substitution",
		rationale:
			"Debug-workflow (diagnose only) + build-workflow (fix with TDD). Split for independent observability.",
	},
	{
		askMattRoute: "wayfinder",
		disposition: "equivalent",
		rationale: "Planning-workflow wayfind phase.",
	},
	{
		askMattRoute: "improve-codebase-architecture",
		disposition: "intentional-standalone",
		rationale:
			"Codebase health (upkeep, not feature work). Reachable via /palette + AGENTS.md. Generates ideas → /plan.",
	},
	{
		askMattRoute: "domain-modeling",
		disposition: "equivalent",
		rationale: "Planning-workflow domain-modeling underlay (trigger-based).",
	},
	{
		askMattRoute: "codebase-design",
		disposition: "intentional-standalone",
		rationale: "Vocabulary (on-demand). Reachable via /palette + AGENTS.md.",
	},
	{
		askMattRoute: "handoff",
		disposition: "equivalent",
		rationale: "handoff.ts extension + referenced in build/planning workflows.",
	},
	{
		askMattRoute: "compact",
		disposition: "equivalent",
		rationale: "Pi built-in /compact. Documented in AGENTS.md.",
	},
	{
		askMattRoute: "grill-me",
		disposition: "equivalent",
		rationale:
			"Planning-workflow no-codebase branch (when style: grilling + no codebase).",
	},
	{
		askMattRoute: "teach",
		disposition: "intentional-standalone",
		rationale: "Learning tool (not SDLC). Reachable via /palette.",
	},
	{
		askMattRoute: "writing-great-skills",
		disposition: "intentional-standalone",
		rationale: "Reference (not SDLC). Reachable via /palette.",
	},
	{
		askMattRoute: "setup-matt-pocock-skills",
		disposition: "intentional-standalone",
		rationale: "One-time setup (not SDLC). Reachable via /palette.",
	},
];

// ─── Reachability entries (every installed skill with an explicit disposition) ──

export const REACHABILITY_ENTRIES: ReachabilityEntry[] = [
  { skill: "planning-workflow", invocationSurface: "workflow-prompt-pin", productRole: "orchestrator", discoveryRoute: "Coach menu + prompt pin", rationale: "auto-pi workflow orchestrator" },
  { skill: "build-workflow", invocationSurface: "workflow-prompt-pin", productRole: "orchestrator", discoveryRoute: "Coach menu + prompt pin", rationale: "auto-pi workflow orchestrator" },
  { skill: "review-workflow", invocationSurface: "workflow-prompt-pin", productRole: "orchestrator", discoveryRoute: "Coach menu + prompt pin", rationale: "auto-pi workflow orchestrator" },
  { skill: "ship-workflow", invocationSurface: "workflow-prompt-pin", productRole: "orchestrator", discoveryRoute: "Coach menu + prompt pin", rationale: "auto-pi workflow orchestrator" },
  { skill: "research-workflow", invocationSurface: "workflow-prompt-pin", productRole: "orchestrator", discoveryRoute: "Coach menu + prompt pin", rationale: "auto-pi workflow orchestrator" },
  { skill: "debug-workflow", invocationSurface: "workflow-prompt-pin", productRole: "orchestrator", discoveryRoute: "Coach menu + prompt pin", rationale: "auto-pi workflow orchestrator" },
  { skill: "setup-maintenance", invocationSurface: "workflow-prompt-pin", productRole: "standalone-utility", discoveryRoute: "Coach menu + direct prompt pin", rationale: "direct-pinned self-contained state machine" },
  { skill: "triage", invocationSurface: "workflow-prompt-pin", productRole: "standalone-utility", discoveryRoute: "Coach menu + direct prompt pin", rationale: "direct-pinned self-contained state machine" },
  { skill: "brainstorming", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "grilling", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "grill-me", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "to-spec", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "to-tickets", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "wayfinder", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "tdd", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "diagnosing-bugs", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "uv", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "code-review", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "receiving-code-review", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "verification-before-completion", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "diff-driven-docs", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "commit", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "github", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "research", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "octocode-research", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "live-research", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "resolving-merge-conflicts", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "prototype", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "domain-modeling", invocationSurface: "workflow-phase-read", productRole: "normal-path-specialist", discoveryRoute: "workflow phase read", rationale: "read by a workflow at a phase boundary" },
  { skill: "handoff", invocationSurface: "extension-command", productRole: "standalone-utility", discoveryRoute: "/handoff extension command", rationale: "extension-backed cross-session transfer" },
  { skill: "grill-with-docs", invocationSurface: "catalog-only", productRole: "superseded", discoveryRoute: "/palette only (expert/manual use)", rationale: "superseded by grilling + domain-modeling decomposition" },
  { skill: "improve-codebase-architecture", invocationSurface: "catalog-only", productRole: "standalone-utility", discoveryRoute: "/palette + /skill:improve-codebase-architecture", rationale: "intentionally standalone (upkeep/vocabulary/learning, not SDLC)" },
  { skill: "codebase-design", invocationSurface: "catalog-only", productRole: "standalone-utility", discoveryRoute: "/palette + /skill:codebase-design", rationale: "intentionally standalone (upkeep/vocabulary/learning, not SDLC)" },
  { skill: "teach", invocationSurface: "catalog-only", productRole: "standalone-utility", discoveryRoute: "/palette + /skill:teach", rationale: "intentionally standalone (upkeep/vocabulary/learning, not SDLC)" },
  { skill: "writing-great-skills", invocationSurface: "catalog-only", productRole: "standalone-utility", discoveryRoute: "/palette + /skill:writing-great-skills", rationale: "intentionally standalone (upkeep/vocabulary/learning, not SDLC)" },
  { skill: "setup-matt-pocock-skills", invocationSurface: "catalog-only", productRole: "standalone-utility", discoveryRoute: "/palette + /skill:setup-matt-pocock-skills", rationale: "intentionally standalone (upkeep/vocabulary/learning, not SDLC)" },
  { skill: "compact", invocationSurface: "catalog-only", productRole: "standalone-utility", discoveryRoute: "/palette + /skill:compact", rationale: "intentionally standalone (upkeep/vocabulary/learning, not SDLC)" },
  { skill: "agent-browser", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:agent-browser", rationale: "community skill, available on-demand" },
  { skill: "agents-sdk", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:agents-sdk", rationale: "community skill, available on-demand" },
  { skill: "ask-matt", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:ask-matt", rationale: "community skill, available on-demand" },
  { skill: "batch-grill-me", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:batch-grill-me", rationale: "community skill, available on-demand" },
  { skill: "bearings", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:bearings", rationale: "community skill, available on-demand" },
  { skill: "claude-handoff", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:claude-handoff", rationale: "community skill, available on-demand" },
  { skill: "cloudflare", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:cloudflare", rationale: "community skill, available on-demand" },
  { skill: "cloudflare-email-service", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:cloudflare-email-service", rationale: "community skill, available on-demand" },
  { skill: "cloudflare-one", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:cloudflare-one", rationale: "community skill, available on-demand" },
  { skill: "cloudflare-one-migrations", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:cloudflare-one-migrations", rationale: "community skill, available on-demand" },
  { skill: "codebase-hygiene", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:codebase-hygiene", rationale: "community skill, available on-demand" },
  { skill: "decision-hold-lifecycle", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:decision-hold-lifecycle", rationale: "community skill, available on-demand" },
  { skill: "deploy-to-vercel", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:deploy-to-vercel", rationale: "community skill, available on-demand" },
  { skill: "design-an-interface", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:design-an-interface", rationale: "community skill, available on-demand" },
  { skill: "design-heuristic-evaluation", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:design-heuristic-evaluation", rationale: "community skill, available on-demand" },
  { skill: "durable-objects", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:durable-objects", rationale: "community skill, available on-demand" },
  { skill: "edit-article", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:edit-article", rationale: "community skill, available on-demand" },
  { skill: "find-skills", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:find-skills", rationale: "community skill, available on-demand" },
  { skill: "frontend-design", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:frontend-design", rationale: "community skill, available on-demand" },
  { skill: "git-guardrails-claude-code", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:git-guardrails-claude-code", rationale: "community skill, available on-demand" },
  { skill: "herdr", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:herdr", rationale: "community skill, available on-demand" },
  { skill: "hyperadar-stack-gotchas", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:hyperadar-stack-gotchas", rationale: "community skill, available on-demand" },
  { skill: "implement", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:implement", rationale: "community skill, available on-demand" },
  { skill: "live-heuristic-evaluation", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:live-heuristic-evaluation", rationale: "community skill, available on-demand" },
  { skill: "loop-me", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:loop-me", rationale: "community skill, available on-demand" },
  { skill: "memory-compounding", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:memory-compounding", rationale: "community skill, available on-demand" },
  { skill: "migrate-to-shoehorn", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:migrate-to-shoehorn", rationale: "community skill, available on-demand" },
  { skill: "mongodb-atlas-stream-processing", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-atlas-stream-processing", rationale: "community skill, available on-demand" },
  { skill: "mongodb-connection", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-connection", rationale: "community skill, available on-demand" },
  { skill: "mongodb-mcp-setup", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-mcp-setup", rationale: "community skill, available on-demand" },
  { skill: "mongodb-natural-language-querying", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-natural-language-querying", rationale: "community skill, available on-demand" },
  { skill: "mongodb-query-optimizer", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-query-optimizer", rationale: "community skill, available on-demand" },
  { skill: "mongodb-schema-design", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-schema-design", rationale: "community skill, available on-demand" },
  { skill: "mongodb-search-and-ai", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:mongodb-search-and-ai", rationale: "community skill, available on-demand" },
  { skill: "obsidian-vault", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:obsidian-vault", rationale: "community skill, available on-demand" },
  { skill: "pi-hermes-memory-cleanup", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:pi-hermes-memory-cleanup", rationale: "community skill, available on-demand" },
  { skill: "pi-update-cache-bypass", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:pi-update-cache-bypass", rationale: "community skill, available on-demand" },
  { skill: "port-api-blueprint-creation", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:port-api-blueprint-creation", rationale: "community skill, available on-demand" },
  { skill: "qa", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:qa", rationale: "community skill, available on-demand" },
  { skill: "request-refactor-plan", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:request-refactor-plan", rationale: "community skill, available on-demand" },
  { skill: "sandbox-sdk", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:sandbox-sdk", rationale: "community skill, available on-demand" },
  { skill: "scaffold-exercises", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:scaffold-exercises", rationale: "community skill, available on-demand" },
  { skill: "session-handoff", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:session-handoff", rationale: "community skill, available on-demand" },
  { skill: "setup-pre-commit", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:setup-pre-commit", rationale: "community skill, available on-demand" },
  { skill: "setup-ts-deep-modules", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:setup-ts-deep-modules", rationale: "community skill, available on-demand" },
  { skill: "to-questionnaire", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:to-questionnaire", rationale: "community skill, available on-demand" },
  { skill: "turnstile-spin", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:turnstile-spin", rationale: "community skill, available on-demand" },
  { skill: "ubiquitous-language", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:ubiquitous-language", rationale: "community skill, available on-demand" },
  { skill: "vercel-composition-patterns", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:vercel-composition-patterns", rationale: "community skill, available on-demand" },
  { skill: "vercel-optimize", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:vercel-optimize", rationale: "community skill, available on-demand" },
  { skill: "vercel-react-best-practices", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:vercel-react-best-practices", rationale: "community skill, available on-demand" },
  { skill: "web-design-guidelines", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:web-design-guidelines", rationale: "community skill, available on-demand" },
  { skill: "web-perf", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:web-perf", rationale: "community skill, available on-demand" },
  { skill: "wizard", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:wizard", rationale: "community skill, available on-demand" },
  { skill: "workers-best-practices", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:workers-best-practices", rationale: "community skill, available on-demand" },
  { skill: "wrangler", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:wrangler", rationale: "community skill, available on-demand" },
  { skill: "writing-awesome-readmes", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:writing-awesome-readmes", rationale: "community skill, available on-demand" },
  { skill: "writing-beats", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:writing-beats", rationale: "community skill, available on-demand" },
  { skill: "writing-fragments", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:writing-fragments", rationale: "community skill, available on-demand" },
  { skill: "writing-shape", invocationSurface: "catalog-only", productRole: "community-on-demand", discoveryRoute: "/palette + /skill:writing-shape", rationale: "community skill, available on-demand" },
];

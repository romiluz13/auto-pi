import { createHash, randomUUID } from "node:crypto";

export const PUBLIC_WORKFLOW_ENTRIES = [
	"plan",
	"build",
	"debug",
	"research",
	"review",
	"ship",
	"triage",
	"setup-audit",
] as const;

export type PublicWorkflowEntry = (typeof PUBLIC_WORKFLOW_ENTRIES)[number];

export const WORKFLOW_PHASES = [
	"plan",
	"build",
	"verify-build",
	"review",
	"remediate",
	"diagnose",
	"research",
	"triage",
	"audit",
	"ship-verify",
	"ship-docs",
	"ship-commit",
	"ship-publish",
	"await-user",
	"complete",
	"failed",
] as const;

export type WorkflowPhase = (typeof WORKFLOW_PHASES)[number];
export type WorkflowStatus =
	| "running"
	| "awaiting-user"
	| "completed"
	| "failed";
export type TerminalTarget =
	| "planned"
	| "shipped"
	| "diagnosed"
	| "researched"
	| "reviewed"
	| "triaged"
	| "audited";

export type WorkflowEventType =
	| "CHECKPOINT"
	| "PLAN_READY"
	| "BUILD_READY"
	| "VERIFICATION_PASSED"
	| "VERIFICATION_FAILED"
	| "REVIEW_FINDINGS"
	| "REVIEW_CLEAN"
	| "REMEDIATION_READY"
	| "DIAGNOSIS_READY"
	| "RESEARCH_READY"
	| "TRIAGE_READY"
	| "AUDIT_READY"
	| "DOCS_READY"
	| "COMMIT_CREATED"
	| "PUBLICATION_DONE"
	| "USER_DECISION_REQUIRED"
	| "USER_DECISION_RESOLVED"
	| "FAILED";

export type ArtifactKind =
	| "route-decision"
	| "decision-log"
	| "spec"
	| "ticket"
	| "acceptance"
	| "verification"
	| "review-report"
	| "disposition"
	| "docs"
	| "commit"
	| "publication"
	| "research"
	| "triage"
	| "audit"
	| "diagnosis";

export interface ArtifactRef {
	id: string;
	kind: ArtifactKind;
	locator: string;
	digest: string;
}

export const HARD_DECISION_CLASSES = [
	"public-compatibility",
	"production-data",
	"money",
	"legal-security",
	"release-authority",
] as const;

export type HardDecisionClass = (typeof HARD_DECISION_CLASSES)[number];

export interface UserDecision {
	id: string;
	question: string;
	reason: string;
	classification: HardDecisionClass;
}

export interface WorkflowEvent {
	type: WorkflowEventType;
	artifacts?: ArtifactRef[];
	cursor?: string;
	openItems?: string[];
	workspaceDigest?: string;
	reviewerRunIds?: string[];
	decision?: UserDecision;
	decisionId?: string;
	answer?: string;
	reason?: string;
}

export interface WorkflowRun {
	schemaVersion: 1;
	runId: string;
	entry: PublicWorkflowEntry;
	subject: string;
	terminalTarget: TerminalTarget;
	phase: WorkflowPhase;
	status: WorkflowStatus;
	resumePhase?: WorkflowPhase;
	sequence: number;
	humanCommands: number;
	baselineHead: string;
	artifacts: ArtifactRef[];
	cursor: string;
	openItems: string[];
	workspaceDigest: string;
	progressToken: string;
	seenProgressTokens: string[];
	reviewerRunIds: string[];
	pendingDecision?: UserDecision;
	history: string[];
	retryCounts: Record<string, number>;
	checkpointCounts: Record<string, number>;
	noProgressKey: string;
	noProgressCount: number;
	createdAt: string;
	updatedAt: string;
}

export type WorkflowCapability = "git.commit" | "git.publish";

type ProgressMode = "forward" | "artifact" | "open-set" | "bounded-retry";

interface TransitionDefinition {
	target: WorkflowPhase | "terminal-target";
	requires?: ArtifactKind[];
	progress: ProgressMode;
	maxAttempts?: number;
}

export const WORKFLOW_MACHINE: Record<
	WorkflowPhase,
	Partial<Record<WorkflowEventType, TransitionDefinition>>
> = {
	plan: {
		CHECKPOINT: { target: "plan", progress: "open-set" },
		PLAN_READY: {
			target: "terminal-target",
			requires: ["spec", "ticket"],
			progress: "forward",
		},
	},
	build: {
		CHECKPOINT: { target: "build", progress: "artifact" },
		BUILD_READY: {
			target: "verify-build",
			requires: ["acceptance"],
			progress: "forward",
		},
	},
	"verify-build": {
		VERIFICATION_PASSED: {
			target: "review",
			requires: ["verification"],
			progress: "forward",
		},
		VERIFICATION_FAILED: {
			target: "build",
			requires: ["verification"],
			progress: "bounded-retry",
			maxAttempts: 3,
		},
	},
	review: {
		REVIEW_FINDINGS: {
			target: "remediate",
			requires: ["review-report"],
			progress: "bounded-retry",
			maxAttempts: 3,
		},
		REVIEW_CLEAN: {
			target: "terminal-target",
			requires: ["review-report"],
			progress: "forward",
		},
	},
	remediate: {
		REMEDIATION_READY: {
			target: "verify-build",
			requires: ["acceptance"],
			progress: "forward",
		},
	},
	diagnose: {
		CHECKPOINT: { target: "diagnose", progress: "artifact" },
		DIAGNOSIS_READY: {
			target: "terminal-target",
			requires: ["diagnosis"],
			progress: "forward",
		},
	},
	research: {
		RESEARCH_READY: {
			target: "complete",
			requires: ["research"],
			progress: "forward",
		},
	},
	triage: {
		TRIAGE_READY: {
			target: "terminal-target",
			requires: ["triage"],
			progress: "forward",
		},
	},
	audit: {
		AUDIT_READY: {
			target: "complete",
			requires: ["audit"],
			progress: "forward",
		},
	},
	"ship-verify": {
		VERIFICATION_PASSED: {
			target: "ship-docs",
			requires: ["verification"],
			progress: "forward",
		},
		VERIFICATION_FAILED: {
			target: "build",
			requires: ["verification"],
			progress: "bounded-retry",
			maxAttempts: 3,
		},
	},
	"ship-docs": {
		DOCS_READY: {
			target: "ship-commit",
			requires: ["docs"],
			progress: "forward",
		},
	},
	"ship-commit": {
		COMMIT_CREATED: {
			target: "ship-publish",
			requires: ["commit"],
			progress: "forward",
		},
	},
	"ship-publish": {
		PUBLICATION_DONE: {
			target: "complete",
			requires: ["publication"],
			progress: "forward",
		},
	},
	"await-user": {
		USER_DECISION_RESOLVED: {
			target: "terminal-target",
			requires: ["decision-log"],
			progress: "forward",
		},
	},
	complete: {},
	failed: {},
};

const ENTRY_PHASES: Record<PublicWorkflowEntry, WorkflowPhase> = {
	plan: "plan",
	build: "build",
	debug: "diagnose",
	research: "research",
	review: "review",
	ship: "ship-verify",
	triage: "triage",
	"setup-audit": "audit",
};

const TARGET_COMPLETION_PHASE: Record<TerminalTarget, WorkflowPhase> = {
	planned: "complete",
	shipped: "ship-verify",
	diagnosed: "complete",
	researched: "complete",
	reviewed: "complete",
	triaged: "complete",
	audited: "complete",
};

function now(): string {
	return new Date().toISOString();
}

function progressToken(
	run: Pick<
		WorkflowRun,
		"runId" | "phase" | "cursor" | "artifacts" | "openItems" | "workspaceDigest"
	>,
): string {
	return createHash("sha256")
		.update(
			JSON.stringify({
				runId: run.runId,
				phase: run.phase,
				cursor: run.cursor,
				artifacts: run.artifacts.map((item) => item.digest).sort(),
				openItems: [...run.openItems].sort(),
				workspaceDigest: run.workspaceDigest,
			}),
		)
		.digest("hex");
}

function uniqueArtifacts(
	current: ArtifactRef[],
	incoming: ArtifactRef[] = [],
): ArtifactRef[] {
	const byIdentity = new Map(
		current.map((item) => [`${item.kind}:${item.id}`, item]),
	);
	for (const item of incoming) {
		if (!item.id || !item.kind || !item.locator || !item.digest) {
			throw new Error(
				"Workflow artifacts require id, kind, locator, and digest",
			);
		}
		byIdentity.set(`${item.kind}:${item.id}`, item);
	}
	return [...byIdentity.values()];
}

function validateEvidence(
	event: WorkflowEvent,
	required: ArtifactKind[] = [],
): void {
	const kinds = new Set((event.artifacts ?? []).map((item) => item.kind));
	for (const kind of required) {
		if (!kinds.has(kind)) {
			throw new Error(`${event.type} requires ${kind} evidence`);
		}
	}
	if (event.type === "REVIEW_FINDINGS" || event.type === "REVIEW_CLEAN") {
		if (new Set(event.reviewerRunIds ?? []).size < 3) {
			throw new Error(`${event.type} requires three fresh reviewer run IDs`);
		}
		const reportIds = (event.artifacts ?? [])
			.filter((artifact) => artifact.kind === "review-report")
			.map((artifact) => artifact.id.toLowerCase());
		for (const axis of ["standards", "spec", "security"]) {
			if (!reportIds.some((id) => id.includes(axis))) {
				throw new Error(`${event.type} requires a ${axis} review report`);
			}
		}
	}
}

function resolveTerminalTarget(run: WorkflowRun): WorkflowPhase {
	if (run.phase === "await-user") {
		if (!run.resumePhase)
			throw new Error("Await-user state has no resume phase");
		return run.resumePhase;
	}
	if (run.phase === "plan") {
		return run.terminalTarget === "planned" ? "complete" : "build";
	}
	if (run.phase === "review") {
		return run.terminalTarget === "reviewed" ? "complete" : "ship-verify";
	}
	if (run.phase === "diagnose") {
		return run.terminalTarget === "diagnosed" ? "complete" : "build";
	}
	if (run.phase === "triage") {
		return run.terminalTarget === "triaged" ? "complete" : "build";
	}
	return TARGET_COMPLETION_PHASE[run.terminalTarget];
}

export function createWorkflowRun(input: {
	entry: PublicWorkflowEntry;
	subject: string;
	terminalTarget: TerminalTarget;
	runId?: string;
	baselineHead?: string;
}): WorkflowRun {
	if (!PUBLIC_WORKFLOW_ENTRIES.includes(input.entry)) {
		throw new Error(`Unknown workflow entry: ${input.entry}`);
	}
	const timestamp = now();
	const run: WorkflowRun = {
		schemaVersion: 1,
		runId: input.runId ?? randomUUID(),
		entry: input.entry,
		subject: input.subject,
		terminalTarget: input.terminalTarget,
		phase: ENTRY_PHASES[input.entry],
		status: "running",
		sequence: 0,
		humanCommands: 1,
		baselineHead: input.baselineHead ?? "",
		artifacts: [],
		cursor: "entry",
		openItems: [],
		workspaceDigest: "",
		progressToken: "",
		seenProgressTokens: [],
		reviewerRunIds: [],
		history: [],
		retryCounts: {},
		checkpointCounts: {},
		noProgressKey: "",
		noProgressCount: 0,
		createdAt: timestamp,
		updatedAt: timestamp,
	};
	run.progressToken = progressToken(run);
	run.seenProgressTokens = [run.progressToken];
	return run;
}

function failedTransition(current: WorkflowRun, reason: string): WorkflowRun {
	return {
		...structuredClone(current),
		phase: "failed",
		status: "failed",
		sequence: current.sequence + 1,
		history: [...current.history, `FAILED:${reason}`],
		updatedAt: now(),
	};
}

function noProgressTransition(
	current: WorkflowRun,
	event: WorkflowEvent,
	reason: string,
): WorkflowRun {
	const key = `${current.phase}:${event.type}:${current.progressToken}`;
	const count = current.noProgressKey === key ? current.noProgressCount + 1 : 1;
	if (count >= 2) return failedTransition(current, `NO_PROGRESS:${reason}`);
	return {
		...structuredClone(current),
		sequence: current.sequence + 1,
		noProgressKey: key,
		noProgressCount: count,
		history: [...current.history, `NO_PROGRESS_REJECTED:${reason}`],
		updatedAt: now(),
	};
}

function hasNewArtifact(current: WorkflowRun, next: WorkflowRun): boolean {
	const before = new Set(current.artifacts.map((artifact) => artifact.digest));
	return next.artifacts.some((artifact) => !before.has(artifact.digest));
}

function strictlyReducesOpenSet(
	current: WorkflowRun,
	next: WorkflowRun,
): boolean {
	if (next.openItems.length >= current.openItems.length) return false;
	const before = new Set(current.openItems);
	return next.openItems.every((item) => before.has(item));
}

function validateHardDecision(
	decision: UserDecision | undefined,
): UserDecision {
	if (!decision) throw new Error("USER_DECISION_REQUIRED needs a decision");
	if (!/^[a-z0-9][a-z0-9._-]{2,127}$/i.test(decision.id)) {
		throw new Error("USER_DECISION_REQUIRED needs a stable decision ID");
	}
	if (!decision.question.trim() || !decision.reason.trim()) {
		throw new Error("USER_DECISION_REQUIRED needs a question and reason");
	}
	if (!HARD_DECISION_CLASSES.includes(decision.classification)) {
		throw new Error(
			"USER_DECISION_REQUIRED has an invalid hard-decision class",
		);
	}
	return decision;
}

export function effectiveAllowedEvents(run: WorkflowRun): WorkflowEventType[] {
	if (run.status === "completed" || run.status === "failed") return [];
	if (run.status === "awaiting-user") {
		return ["USER_DECISION_RESOLVED", "FAILED"];
	}
	return [
		...new Set<WorkflowEventType>([
			...(Object.keys(WORKFLOW_MACHINE[run.phase]) as WorkflowEventType[]),
			"USER_DECISION_REQUIRED",
			"FAILED",
		]),
	];
}

export function transitionWorkflow(
	current: WorkflowRun,
	event: WorkflowEvent,
): WorkflowRun {
	if (current.status === "completed" || current.status === "failed") {
		throw new Error(`Cannot transition terminal workflow ${current.runId}`);
	}
	if (event.type === "FAILED") {
		return failedTransition(current, event.reason ?? "unknown");
	}
	if (event.type === "USER_DECISION_REQUIRED") {
		const decision = validateHardDecision(event.decision);
		if (current.phase === "await-user") {
			throw new Error("Workflow is already awaiting a user decision");
		}
		return {
			...structuredClone(current),
			phase: "await-user",
			status: "awaiting-user",
			resumePhase: current.phase,
			pendingDecision: structuredClone(decision),
			sequence: current.sequence + 1,
			noProgressKey: "",
			noProgressCount: 0,
			history: [...current.history, `USER_DECISION_REQUIRED:${decision.id}`],
			updatedAt: now(),
		};
	}

	const definition = WORKFLOW_MACHINE[current.phase][event.type];
	if (!definition) {
		throw new Error(`Event ${event.type} is invalid in phase ${current.phase}`);
	}
	validateEvidence(event, definition.requires);
	if (event.type === "USER_DECISION_RESOLVED") {
		if (
			!current.pendingDecision ||
			event.decisionId !== current.pendingDecision.id
		) {
			throw new Error("Resolved decision does not match the pending decision");
		}
		if (!event.answer?.trim()) {
			throw new Error("Resolved decision requires an answer");
		}
	}

	const next = structuredClone(current);
	next.sequence += 1;
	next.artifacts = uniqueArtifacts(next.artifacts, event.artifacts);
	next.cursor = event.cursor ?? next.cursor;
	next.openItems = event.openItems ? [...event.openItems] : next.openItems;
	next.workspaceDigest = event.workspaceDigest ?? next.workspaceDigest;
	if (event.reviewerRunIds) {
		for (const id of event.reviewerRunIds) {
			if (next.reviewerRunIds.includes(id)) {
				throw new Error(`Reviewer run ID was reused: ${id}`);
			}
		}
		next.reviewerRunIds.push(...event.reviewerRunIds);
	}

	const newArtifact = hasNewArtifact(current, next);
	const openSetReduced = strictlyReducesOpenSet(current, next);
	const workspaceChanged =
		Boolean(event.workspaceDigest) &&
		event.workspaceDigest !== current.workspaceDigest;

	if (event.type === "CHECKPOINT") {
		const count = (next.checkpointCounts[current.phase] ?? 0) + 1;
		next.checkpointCounts[current.phase] = count;
		if (count > 50) {
			return failedTransition(current, `CHECKPOINT_CAP:${current.phase}`);
		}
		const progressed =
			definition.progress === "open-set"
				? newArtifact || openSetReduced
				: newArtifact || workspaceChanged;
		if (!progressed) {
			return noProgressTransition(
				current,
				event,
				`${definition.progress} checkpoint made no verified change`,
			);
		}
	}

	if (definition.progress === "bounded-retry") {
		if (!newArtifact && !workspaceChanged) {
			return noProgressTransition(
				current,
				event,
				"bounded retry supplied no new evidence",
			);
		}
		const key = `${current.phase}:${event.type}`;
		const count = (next.retryCounts[key] ?? 0) + 1;
		if (count > (definition.maxAttempts ?? 1)) {
			return failedTransition(current, `RETRY_CAP:${key}`);
		}
		next.retryCounts[key] = count;
	}

	next.phase =
		definition.target === "terminal-target"
			? resolveTerminalTarget(current)
			: definition.target;
	next.status = next.phase === "complete" ? "completed" : "running";
	next.noProgressKey = "";
	next.noProgressCount = 0;
	if (event.type === "USER_DECISION_RESOLVED") {
		next.pendingDecision = undefined;
		next.resumePhase = undefined;
	}
	next.history.push(`${event.type}:${current.phase}->${next.phase}`);
	next.updatedAt = now();

	const nextToken = progressToken(next);
	if (
		next.phase === current.phase &&
		current.seenProgressTokens.includes(nextToken)
	) {
		return noProgressTransition(
			current,
			event,
			`duplicate workflow fingerprint in ${next.phase}`,
		);
	}
	next.progressToken = nextToken;
	if (!next.seenProgressTokens.includes(nextToken)) {
		next.seenProgressTokens.push(nextToken);
	}
	return next;
}

export function allowedCapabilities(
	phase: WorkflowPhase,
): WorkflowCapability[] {
	if (phase === "ship-commit") return ["git.commit"];
	if (phase === "ship-publish") return ["git.publish"];
	return [];
}

export function validateWorkflowMachine(): string[] {
	const errors: string[] = [];
	const phases = new Set<string>(WORKFLOW_PHASES);
	for (const [phase, transitions] of Object.entries(WORKFLOW_MACHINE)) {
		if (!phases.has(phase)) errors.push(`Unknown phase definition: ${phase}`);
		for (const [event, definition] of Object.entries(transitions)) {
			if (
				definition.target !== "terminal-target" &&
				!phases.has(definition.target)
			) {
				errors.push(
					`${phase}.${event} targets unknown phase ${definition.target}`,
				);
			}
			if (definition.progress === "bounded-retry" && !definition.maxAttempts) {
				errors.push(`${phase}.${event} has an unbounded retry`);
			}
		}
	}
	for (const phase of WORKFLOW_PHASES) {
		if (phase === "complete" || phase === "failed") continue;
		if (
			Object.keys(WORKFLOW_MACHINE[phase]).length === 0 &&
			phase !== "await-user"
		) {
			errors.push(`Nonterminal phase ${phase} has no exit`);
		}
		if (
			phase !== "ship-commit" &&
			allowedCapabilities(phase).includes("git.commit")
		) {
			errors.push(`Phase ${phase} can commit before ship-commit`);
		}
	}
	return errors;
}

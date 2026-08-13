import { createHash, randomUUID } from "node:crypto";
import {
	chmodSync,
	closeSync,
	constants,
	existsSync,
	fstatSync,
	fsyncSync,
	ftruncateSync,
	lstatSync,
	mkdirSync,
	openSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeSync,
} from "node:fs";
import { join } from "node:path";

import {
	HARD_DECISION_CLASSES,
	PUBLIC_WORKFLOW_ENTRIES,
	WORKFLOW_PHASES,
	type ArtifactRef,
	type WorkflowRun,
} from "../config/workflow-machine.ts";

const MAX_JOURNAL_BYTES = 10 * 1024 * 1024;
const MAX_RECORD_BYTES = 1024 * 1024;
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0;
const PROCESS_BOOT_NONCE = randomUUID();

interface JournalRecord {
	sequence: number;
	previousDigest: string;
	digest: string;
	state: WorkflowRun;
}

interface ActiveWorkflowLock {
	runId: string;
	pid: number;
	token: string;
	claimedAt: string;
	processBootNonce?: string;
	latestSequence?: number;
	latestDigest?: string;
	ownerId?: string;
}

export interface ExecutionReceipt {
	receiptId: string;
	runId: string;
	phase: WorkflowRun["phase"];
	sequence: number;
	progressToken: string;
	artifactKind: "verification" | "acceptance";
	command: string;
	argsDigest: string;
	exitCode: number;
	outputDigest: string;
	workspaceDigest: string;
	createdAt: string;
}

export interface PendingWorkflowDispatch {
	dispatchId: string;
	runId: string;
	phase: WorkflowRun["phase"];
	sequence: number;
	progressToken: string;
	status: "pending" | "delivered";
	createdAt: string;
	deliveredAt?: string;
}

function assertRunId(runId: string): void {
	if (!/^[a-zA-Z0-9._-]+$/.test(runId)) {
		throw new Error(`Invalid workflow run ID: ${runId}`);
	}
}

function recordDigest(record: Omit<JournalRecord, "digest">): string {
	return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}

function ensurePrivateDirectory(path: string): void {
	mkdirSync(path, { recursive: true, mode: 0o700 });
	const stat = lstatSync(path);
	if (!stat.isDirectory() || stat.isSymbolicLink()) {
		throw new Error(`Workflow path is not a private directory: ${path}`);
	}
	chmodSync(path, 0o700);
}

function writeExclusiveFile(path: string, content: string): void {
	const descriptor = openSync(
		path,
		constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | NO_FOLLOW,
		0o600,
	);
	try {
		if (!fstatSync(descriptor).isFile()) {
			throw new Error(`Workflow path is not a regular file: ${path}`);
		}
		writeSync(descriptor, content, undefined, "utf8");
		fsyncSync(descriptor);
	} finally {
		closeSync(descriptor);
	}
}

function writeAtomicFile(
	directory: string,
	name: string,
	content: string,
): void {
	ensurePrivateDirectory(directory);
	const temporaryPath = join(directory, `.${name}.${randomUUID()}.tmp`);
	writeExclusiveFile(temporaryPath, content);
	renameSync(temporaryPath, join(directory, name));
	fsyncDirectory(directory);
}

function fsyncDirectory(path: string): void {
	const descriptor = openSync(path, constants.O_RDONLY);
	try {
		fsyncSync(descriptor);
	} finally {
		closeSync(descriptor);
	}
}

export function workflowDirectoryFor(root: string, runId: string): string {
	assertRunId(runId);
	return join(root, runId);
}

// Pi auto-discovers top-level extension files. This helper exports a no-op
// factory so direct discovery is harmless; workflow-interpreter imports the class.
export default function workflowStoreModule(): void {}

export class WorkflowStore {
	private readonly root: string;
	private readonly instanceId = randomUUID();
	private readonly ownerTokens = new Map<
		string,
		{ token: string; ownerId: string }
	>();

	constructor(root: string) {
		this.root = root;
		ensurePrivateDirectory(root);
	}

	claim(runId: string, ownerId: string = this.instanceId): void {
		assertRunId(runId);
		const lockDirectory = join(this.root, "active.lock");
		const ownerPath = join(lockDirectory, "owner.json");
		const token = randomUUID();
		const lock: ActiveWorkflowLock = {
			runId,
			pid: process.pid,
			token,
			claimedAt: new Date().toISOString(),
			processBootNonce: PROCESS_BOOT_NONCE,
			latestSequence: -1,
			latestDigest: "",
			ownerId,
		};
		try {
			mkdirSync(lockDirectory, { mode: 0o700 });
			writeExclusiveFile(ownerPath, `${JSON.stringify(lock)}\n`);
			fsyncDirectory(lockDirectory);
			fsyncDirectory(this.root);
			this.ownerTokens.set(runId, { token, ownerId });
			return;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
				if (existsSync(lockDirectory) && !existsSync(ownerPath)) {
					rmSync(lockDirectory, { recursive: true, force: true });
				}
				throw error;
			}
		}

		const existing = this.readLock(ownerPath);
		const sameProcessInstance =
			existing.pid === process.pid &&
			(!existing.processBootNonce ||
				existing.processBootNonce === PROCESS_BOOT_NONCE);
		if (sameProcessInstance) {
			if (
				existing.runId === runId &&
				(!existing.ownerId || existing.ownerId === ownerId)
			) {
				this.ownerTokens.set(runId, { token: existing.token, ownerId });
				if (!existing.ownerId || !existing.processBootNonce) {
					this.writeLock({
						...existing,
						ownerId,
						processBootNonce: PROCESS_BOOT_NONCE,
					});
				}
				return;
			}
			throw new Error(
				`Active workflow ${existing.runId} already owns this repository (pid ${existing.pid})`,
			);
		}
		if (existing.pid !== process.pid && this.isProcessAlive(existing.pid)) {
			throw new Error(
				`Active workflow ${existing.runId} already owns this repository (pid ${existing.pid})`,
			);
		}

		const staleDirectory = join(
			this.root,
			`.active.lock.stale.${randomUUID()}`,
		);
		try {
			renameSync(lockDirectory, staleDirectory);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				this.claim(runId, ownerId);
				return;
			}
			throw error;
		}
		rmSync(staleDirectory, { recursive: true, force: true });
		this.claim(runId, ownerId);
	}

	release(runId: string): void {
		const lockDirectory = join(this.root, "active.lock");
		const ownerPath = join(lockDirectory, "owner.json");
		if (!existsSync(ownerPath)) return;
		const existing = this.readLock(ownerPath);
		const ownership = this.ownerTokens.get(runId);
		if (
			existing.runId !== runId ||
			existing.pid !== process.pid ||
			!ownership ||
			existing.token !== ownership.token ||
			existing.ownerId !== ownership.ownerId
		) {
			throw new Error(`Workflow ${runId} does not own the active lock`);
		}
		const releasedDirectory = join(
			this.root,
			`.active.lock.release.${randomUUID()}`,
		);
		renameSync(lockDirectory, releasedDirectory);
		rmSync(releasedDirectory, { recursive: true, force: true });
		this.ownerTokens.delete(runId);
		fsyncDirectory(this.root);
	}

	save(state: WorkflowRun): void {
		const lock = this.assertOwnership(state.runId);
		const directory = workflowDirectoryFor(this.root, state.runId);
		ensurePrivateDirectory(directory);
		const eventsPath = join(directory, "events.jsonl");
		const records = existsSync(eventsPath) ? this.readRecords(eventsPath) : [];
		if (existsSync(eventsPath)) this.repairTruncatedTail(eventsPath);
		const latest = records.at(-1);
		const expectedSequence = latest ? latest.sequence + 1 : 0;
		if (state.sequence !== expectedSequence) {
			throw new Error(
				`Workflow journal sequence must advance exactly one (${state.sequence} !== ${expectedSequence})`,
			);
		}
		const unsigned = {
			sequence: state.sequence,
			previousDigest: latest?.digest ?? "",
			state,
		};
		const record: JournalRecord = {
			...unsigned,
			digest: recordDigest(unsigned),
		};
		const line = `${JSON.stringify(record)}\n`;
		const lineBytes = Buffer.byteLength(line);
		const currentBytes = existsSync(eventsPath)
			? lstatSync(eventsPath).size
			: 0;
		if (
			lineBytes > MAX_RECORD_BYTES ||
			currentBytes + lineBytes > MAX_JOURNAL_BYTES
		) {
			throw new Error("Workflow journal size limit would be exceeded");
		}
		const journalDescriptor = openSync(
			eventsPath,
			constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | NO_FOLLOW,
			0o600,
		);
		try {
			if (!fstatSync(journalDescriptor).isFile()) {
				throw new Error(
					`Workflow journal is not a regular file: ${eventsPath}`,
				);
			}
			writeSync(journalDescriptor, line, undefined, "utf8");
			fsyncSync(journalDescriptor);
		} finally {
			closeSync(journalDescriptor);
		}

		writeAtomicFile(
			directory,
			"snapshot.json",
			`${JSON.stringify(record, null, 2)}\n`,
		);
		this.writeLock({
			...lock,
			latestSequence: record.sequence,
			latestDigest: record.digest,
		});
	}

	loadActive(): WorkflowRun | undefined {
		const ownerPath = join(this.root, "active.lock", "owner.json");
		if (!existsSync(ownerPath)) return undefined;
		const lock = this.readLock(ownerPath);
		const state = this.load(lock.runId);
		const digest = this.latestDigest(lock.runId);
		const manifestSequence = lock.latestSequence ?? -1;
		const legacyManifest = manifestSequence < 0 && !lock.latestDigest;
		const journalOneAhead =
			state.sequence === manifestSequence + 1 &&
			(manifestSequence < 0 ||
				this.digestAt(lock.runId, manifestSequence) === lock.latestDigest);
		if (legacyManifest || journalOneAhead) {
			const sameProcessInstance =
				lock.pid === process.pid &&
				(!lock.processBootNonce ||
					lock.processBootNonce === PROCESS_BOOT_NONCE);
			if (sameProcessInstance || !this.isProcessAlive(lock.pid)) {
				this.writeLock({
					...lock,
					latestSequence: state.sequence,
					latestDigest: digest,
				});
			}
			return state;
		}
		if (state.sequence !== manifestSequence || digest !== lock.latestDigest) {
			throw new Error(
				`Active workflow manifest disagrees with journal ${lock.runId}`,
			);
		}
		return state;
	}

	queueDispatch(state: WorkflowRun, force = false): PendingWorkflowDispatch {
		this.assertOwnership(state.runId);
		if (state.status !== "running") {
			throw new Error(`Cannot dispatch workflow in ${state.status} status`);
		}
		const existing = this.readDispatch(state.runId);
		if (
			!force &&
			existing &&
			existing.sequence === state.sequence &&
			existing.progressToken === state.progressToken
		) {
			return existing;
		}
		const dispatch: PendingWorkflowDispatch = {
			dispatchId: randomUUID(),
			runId: state.runId,
			phase: state.phase,
			sequence: state.sequence,
			progressToken: state.progressToken,
			status: "pending",
			createdAt: new Date().toISOString(),
		};
		const directory = workflowDirectoryFor(this.root, state.runId);
		writeAtomicFile(
			directory,
			"dispatch.json",
			`${JSON.stringify(dispatch, null, 2)}\n`,
		);
		return dispatch;
	}

	readDispatch(runId: string): PendingWorkflowDispatch | undefined {
		const path = join(workflowDirectoryFor(this.root, runId), "dispatch.json");
		if (!existsSync(path)) return undefined;
		const stat = lstatSync(path);
		if (!stat.isFile() || stat.isSymbolicLink()) {
			throw new Error(`Workflow dispatch is not a regular file: ${path}`);
		}
		let dispatch: PendingWorkflowDispatch;
		try {
			dispatch = JSON.parse(
				readFileSync(path, "utf8"),
			) as PendingWorkflowDispatch;
		} catch (error) {
			throw new Error(
				`Invalid workflow dispatch JSON for ${runId}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
		this.validateDispatch(dispatch, runId);
		return dispatch;
	}

	markDispatchDelivered(runId: string, dispatchId: string): void {
		this.assertOwnership(runId);
		const dispatch = this.readDispatch(runId);
		if (!dispatch || dispatch.dispatchId !== dispatchId) {
			throw new Error(`Workflow dispatch ${dispatchId} is not current`);
		}
		const directory = workflowDirectoryFor(this.root, runId);
		writeAtomicFile(
			directory,
			"dispatch.json",
			`${JSON.stringify({ ...dispatch, status: "delivered", deliveredAt: new Date().toISOString() }, null, 2)}\n`,
		);
	}

	createExecutionReceipt(
		run: WorkflowRun,
		input: Omit<
			ExecutionReceipt,
			| "receiptId"
			| "runId"
			| "phase"
			| "sequence"
			| "progressToken"
			| "createdAt"
		>,
	): ArtifactRef {
		this.assertOwnership(run.runId);
		const receiptId = `verification-receipt-${randomUUID()}`;
		const receipt: ExecutionReceipt = {
			receiptId,
			runId: run.runId,
			phase: run.phase,
			sequence: run.sequence,
			progressToken: run.progressToken,
			...input,
			createdAt: new Date().toISOString(),
		};
		const content = `${JSON.stringify(receipt, null, 2)}\n`;
		const directory = join(
			workflowDirectoryFor(this.root, run.runId),
			"receipts",
		);
		writeAtomicFile(directory, `${receiptId}.json`, content);
		return {
			id: receiptId,
			kind: receipt.artifactKind,
			locator: join(directory, `${receiptId}.json`),
			digest: createHash("sha256").update(content).digest("hex"),
		};
	}

	verifyExecutionReceipt(
		run: WorkflowRun,
		artifact: ArtifactRef,
		expectedSuccess: boolean,
		expectedWorkspaceDigest = "",
		expectedKind: "verification" | "acceptance" = "verification",
	): ExecutionReceipt {
		const expectedPath = join(
			workflowDirectoryFor(this.root, run.runId),
			"receipts",
			`${artifact.id}.json`,
		);
		if (artifact.kind !== expectedKind || artifact.locator !== expectedPath) {
			throw new Error(`${expectedKind} evidence is not an interpreter receipt`);
		}
		const content = readFileSync(expectedPath, "utf8");
		if (
			createHash("sha256").update(content).digest("hex") !== artifact.digest
		) {
			throw new Error("Verification receipt digest mismatch");
		}
		let receipt: ExecutionReceipt;
		try {
			receipt = JSON.parse(content) as ExecutionReceipt;
		} catch (error) {
			throw new Error(
				`Invalid verification receipt JSON: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
		if (
			receipt.receiptId !== artifact.id ||
			receipt.artifactKind !== expectedKind ||
			receipt.runId !== run.runId ||
			receipt.phase !== run.phase ||
			receipt.sequence !== run.sequence ||
			receipt.progressToken !== run.progressToken ||
			(expectedSuccess ? receipt.exitCode !== 0 : receipt.exitCode === 0) ||
			(expectedWorkspaceDigest &&
				receipt.workspaceDigest !== expectedWorkspaceDigest)
		) {
			throw new Error("Verification receipt is stale or has the wrong result");
		}
		return receipt;
	}

	list(): WorkflowRun[] {
		const runs: WorkflowRun[] = [];
		for (const entry of readdirSync(this.root, { withFileTypes: true })) {
			if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
			try {
				runs.push(this.load(entry.name));
			} catch {
				// Corrupt runs stay visible on disk for manual recovery but are not resumable.
			}
		}
		return runs.sort((left, right) =>
			right.updatedAt.localeCompare(left.updatedAt),
		);
	}

	load(runId: string): WorkflowRun {
		const directory = workflowDirectoryFor(this.root, runId);
		ensurePrivateDirectory(directory);
		const eventsPath = join(directory, "events.jsonl");
		if (!existsSync(eventsPath)) {
			throw new Error(`Workflow run not found: ${runId}`);
		}
		const records = this.readRecords(eventsPath);
		if (records.length === 0) {
			throw new Error(`Workflow journal is empty: ${runId}`);
		}

		let previousDigest = "";
		let previousSequence = -1;
		for (const record of records) {
			this.validateRecord(record);
			const expected = recordDigest({
				sequence: record.sequence,
				previousDigest: record.previousDigest,
				state: record.state,
			});
			if (record.digest !== expected) {
				throw new Error(
					`Workflow journal digest mismatch at sequence ${record.sequence}`,
				);
			}
			if (record.previousDigest !== previousDigest) {
				throw new Error(
					`Workflow journal chain digest mismatch at sequence ${record.sequence}`,
				);
			}
			if (record.sequence <= previousSequence) {
				throw new Error(
					`Workflow journal sequence is not increasing at ${record.sequence}`,
				);
			}
			previousDigest = record.digest;
			previousSequence = record.sequence;
		}
		const latest = records.at(-1);
		if (!latest) throw new Error(`Workflow journal is empty: ${runId}`);
		return latest.state;
	}

	assertOwned(runId: string, ownerId?: string): void {
		this.assertOwnership(runId, ownerId);
	}

	private assertOwnership(runId: string, ownerId?: string): ActiveWorkflowLock {
		const ownerPath = join(this.root, "active.lock", "owner.json");
		if (!existsSync(ownerPath)) {
			throw new Error(`Workflow ${runId} does not own the active lock`);
		}
		const lock = this.readLock(ownerPath);
		const ownership = this.ownerTokens.get(runId);
		if (
			lock.runId !== runId ||
			lock.pid !== process.pid ||
			!ownership ||
			lock.token !== ownership.token ||
			lock.ownerId !== ownership.ownerId ||
			(ownerId !== undefined && ownership.ownerId !== ownerId) ||
			(lock.processBootNonce !== undefined &&
				lock.processBootNonce !== PROCESS_BOOT_NONCE)
		) {
			throw new Error(`Workflow ${runId} does not own the active lock`);
		}
		return lock;
	}

	private writeLock(lock: ActiveWorkflowLock): void {
		const directory = join(this.root, "active.lock");
		writeAtomicFile(directory, "owner.json", `${JSON.stringify(lock)}\n`);
	}

	private digestAt(runId: string, sequence: number): string | undefined {
		const eventsPath = join(
			workflowDirectoryFor(this.root, runId),
			"events.jsonl",
		);
		return this.readRecords(eventsPath).find(
			(record) => record.sequence === sequence,
		)?.digest;
	}

	private latestDigest(runId: string): string {
		const eventsPath = join(
			workflowDirectoryFor(this.root, runId),
			"events.jsonl",
		);
		return this.readRecords(eventsPath).at(-1)?.digest ?? "";
	}

	private validateDispatch(
		dispatch: PendingWorkflowDispatch,
		runId: string,
	): void {
		if (
			dispatch?.runId !== runId ||
			typeof dispatch.dispatchId !== "string" ||
			!dispatch.dispatchId ||
			!WORKFLOW_PHASES.includes(dispatch.phase) ||
			!Number.isInteger(dispatch.sequence) ||
			dispatch.sequence < 0 ||
			typeof dispatch.progressToken !== "string" ||
			!dispatch.progressToken ||
			(dispatch.status !== "pending" && dispatch.status !== "delivered") ||
			Number.isNaN(Date.parse(dispatch.createdAt)) ||
			(dispatch.deliveredAt !== undefined &&
				Number.isNaN(Date.parse(dispatch.deliveredAt)))
		) {
			throw new Error(`Invalid workflow dispatch for ${runId}`);
		}
	}

	private readLock(ownerPath: string): ActiveWorkflowLock {
		try {
			const lock = JSON.parse(
				readFileSync(ownerPath, "utf8"),
			) as Partial<ActiveWorkflowLock>;
			if (
				typeof lock.runId !== "string" ||
				typeof lock.pid !== "number" ||
				typeof lock.token !== "string" ||
				typeof lock.claimedAt !== "string"
			) {
				throw new Error("missing fields");
			}
			return lock as ActiveWorkflowLock;
		} catch (error) {
			throw new Error(
				`Invalid active workflow lock ${ownerPath}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	private isProcessAlive(pid: number): boolean {
		try {
			process.kill(pid, 0);
			return true;
		} catch (error) {
			return (error as NodeJS.ErrnoException).code === "EPERM";
		}
	}

	private repairTruncatedTail(eventsPath: string): void {
		const content = readFileSync(eventsPath, "utf8");
		if (!content || content.endsWith("\n")) return;
		const lastNewline = content.lastIndexOf("\n");
		const tail = content.slice(lastNewline + 1);
		try {
			JSON.parse(tail);
			const descriptor = openSync(
				eventsPath,
				constants.O_WRONLY | constants.O_APPEND | NO_FOLLOW,
			);
			try {
				writeSync(descriptor, "\n", undefined, "utf8");
				fsyncSync(descriptor);
			} finally {
				closeSync(descriptor);
			}
		} catch {
			const descriptor = openSync(eventsPath, constants.O_WRONLY | NO_FOLLOW);
			try {
				ftruncateSync(descriptor, lastNewline + 1);
				fsyncSync(descriptor);
			} finally {
				closeSync(descriptor);
			}
		}
	}

	private readRecords(eventsPath: string): JournalRecord[] {
		const stat = lstatSync(eventsPath);
		if (!stat.isFile() || stat.isSymbolicLink()) {
			throw new Error(`Workflow journal is not a regular file: ${eventsPath}`);
		}
		if (stat.size > MAX_JOURNAL_BYTES) {
			throw new Error(`Workflow journal exceeds ${MAX_JOURNAL_BYTES} bytes`);
		}
		const content = readFileSync(eventsPath, "utf8");
		const lines = content.split("\n");
		const hasTruncatedTail = !content.endsWith("\n");
		const records: JournalRecord[] = [];
		for (let index = 0; index < lines.length; index += 1) {
			const line = lines[index] ?? "";
			if (!line.trim()) continue;
			if (Buffer.byteLength(line) > MAX_RECORD_BYTES) {
				throw new Error(
					`Workflow journal record exceeds ${MAX_RECORD_BYTES} bytes`,
				);
			}
			try {
				records.push(JSON.parse(line) as JournalRecord);
			} catch (error) {
				if (hasTruncatedTail && index === lines.length - 1) break;
				throw new Error(
					`Invalid workflow journal JSON in ${eventsPath}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
		return records;
	}

	private validateRecord(record: JournalRecord): void {
		const state = record?.state;
		const validStatus = [
			"running",
			"awaiting-user",
			"completed",
			"failed",
		].includes(state?.status);
		const validTarget = [
			"planned",
			"shipped",
			"diagnosed",
			"researched",
			"reviewed",
			"triaged",
			"audited",
		].includes(state?.terminalTarget);
		const validPendingDecision =
			state?.pendingDecision === undefined ||
			(typeof state.pendingDecision.id === "string" &&
				state.pendingDecision.id.length <= 128 &&
				typeof state.pendingDecision.question === "string" &&
				state.pendingDecision.question.length <= 4096 &&
				typeof state.pendingDecision.reason === "string" &&
				state.pendingDecision.reason.length <= 4096 &&
				HARD_DECISION_CLASSES.includes(state.pendingDecision.classification));
		const validArtifacts =
			Array.isArray(state?.artifacts) &&
			state.artifacts.length <= 2_000 &&
			state.artifacts.every(
				(artifact) =>
					typeof artifact.id === "string" &&
					artifact.id.length <= 256 &&
					typeof artifact.kind === "string" &&
					typeof artifact.locator === "string" &&
					artifact.locator.length <= 4096 &&
					typeof artifact.digest === "string" &&
					artifact.digest.length <= 256,
			);
		if (
			!record ||
			!Number.isSafeInteger(record.sequence) ||
			record.sequence < 0 ||
			typeof record.previousDigest !== "string" ||
			typeof record.digest !== "string" ||
			!state ||
			state.schemaVersion !== 1 ||
			state.sequence !== record.sequence ||
			!PUBLIC_WORKFLOW_ENTRIES.includes(state.entry) ||
			!WORKFLOW_PHASES.includes(state.phase) ||
			!validStatus ||
			!validTarget ||
			!validPendingDecision ||
			!validArtifacts ||
			!Array.isArray(state.openItems) ||
			state.openItems.length > 2_000 ||
			state.openItems.some(
				(item) => typeof item !== "string" || item.length > 1024,
			) ||
			typeof state.runId !== "string" ||
			!/^[a-zA-Z0-9._-]+$/.test(state.runId) ||
			typeof state.subject !== "string" ||
			state.subject.length > 4096 ||
			typeof state.cursor !== "string" ||
			state.cursor.length > 1024 ||
			typeof state.workspaceDigest !== "string" ||
			state.workspaceDigest.length > 256 ||
			typeof state.progressToken !== "string" ||
			state.progressToken.length > 256 ||
			!Array.isArray(state.seenProgressTokens) ||
			state.seenProgressTokens.length > 10_000 ||
			state.seenProgressTokens.some(
				(token) => typeof token !== "string" || token.length > 256,
			) ||
			!Array.isArray(state.reviewerRunIds) ||
			state.reviewerRunIds.length > 1_000 ||
			state.reviewerRunIds.some(
				(runId) => typeof runId !== "string" || runId.length > 256,
			) ||
			!Array.isArray(state.history) ||
			state.history.length > 10_000 ||
			state.history.some(
				(item) => typeof item !== "string" || item.length > 2048,
			) ||
			(state.resumePhase !== undefined &&
				!WORKFLOW_PHASES.includes(state.resumePhase)) ||
			Number.isNaN(Date.parse(state.createdAt)) ||
			Number.isNaN(Date.parse(state.updatedAt))
		) {
			throw new Error(
				`Invalid workflow journal record at sequence ${record?.sequence}`,
			);
		}
	}
}

/**
 * Background task registry (NEON-03-R1).
 *
 * Some runtime paths start work they deliberately do NOT await — post-ingest
 * notifications, conversation intelligence, per-message short-intent
 * persistence. In production that stays fire-and-forget: the request returns
 * while the work finishes on its own, and each site keeps its own error
 * handling (log or swallow). What was missing is any way to KNOW when that
 * work is done and HOW it ended, which tests need before they assert on its
 * effects and before they drop the database it writes to.
 *
 * `trackBackgroundTask(label, promise)` registers the ORIGINAL promise (before
 * the call site attaches its catch), so an observer sees the real outcome —
 * the rejection, or the fulfilled value — even when production swallows it.
 *
 * A task is in exactly one of three states while recording is on:
 *   - PENDING: not settled yet (`pendingBackgroundTaskCount()`);
 *   - SETTLED, UNREVIEWED: settled, outcome recorded, nobody has consumed it
 *     (`unreviewedBackgroundOutcomes()`);
 *   - CONSUMED: returned by `drainBackgroundTasks()`, which is the only way
 *     an outcome leaves the registry. Stopping the recording refuses to
 *     discard unreviewed outcomes, so a rejection that happened before a
 *     teardown can never vanish unvalidated.
 *
 * Recording is enabled only by tests; the pending set is always maintained
 * and never grows past what is in flight. This is a bounded drain/idle
 * mechanism, not a job queue: no retries, no persistence, no scheduling.
 */

import { assertOperationAllowed } from "@core/privileged-operations"

export interface BackgroundTaskOutcome {
  readonly label: string
  readonly status: "fulfilled" | "rejected"
  /** The fulfilled value (e.g. a best-effort task's own result record). */
  readonly value?: unknown
  readonly error?: unknown
}

const pending = new Set<Promise<unknown>>()
let recording = false
let unreviewed: BackgroundTaskOutcome[] = []

/** Register fire-and-forget work. Returns the same promise so the call site keeps its own handling. */
export function trackBackgroundTask<T>(label: string, task: Promise<T>): Promise<T> {
  pending.add(task)
  task.then(
    (value) => {
      pending.delete(task)
      if (recording) unreviewed.push({ label, status: "fulfilled", value })
    },
    (error: unknown) => {
      pending.delete(task)
      if (recording) unreviewed.push({ label, status: "rejected", error })
    },
  )
  return task
}

/**
 * Start NEW fire-and-forget work that may write (NEON-05).
 *
 * `trackBackgroundTask` receives a promise that already exists — the work has
 * started by the time it is registered, so a check there would be too late.
 * This variant takes a FACTORY and asks the Privileged Operations core for
 * `background.start` BEFORE invoking it: while writes are frozen the factory
 * is never called, nothing is registered, and the returned promise rejects
 * with the `PrivilegedOperationDeniedError` so the call site's own `.catch`
 * sees the refusal like any other failure. Otherwise it behaves exactly like
 * `trackBackgroundTask`.
 */
export function startBackgroundTask<T>(label: string, factory: () => Promise<T>): Promise<T> {
  try {
    assertOperationAllowed("background.start")
  } catch (error) {
    return Promise.reject(error)
  }
  return trackBackgroundTask(label, factory())
}

export class BackgroundQuiescenceTimeoutError extends Error {
  readonly pendingCount: number
  constructor(pendingCount: number, timeoutMs: number) {
    super(`background-tasks: ${pendingCount} task(s) still pending after ${timeoutMs} ms`)
    this.name = "BackgroundQuiescenceTimeoutError"
    this.pendingCount = pendingCount
  }
}

export interface QuiescenceReport {
  /** Tasks in flight when the wait began. */
  readonly pendingAtStart: number
  /** Always 0 on success. */
  readonly pendingAtEnd: number
  readonly waitedMs: number
}

/**
 * Wait until no background task is pending (in-flight work drains) or fail
 * deterministically after `timeoutMs`. Unlike `drainBackgroundTasks` it does
 * not consume recorded outcomes, so it can be used operationally: request a
 * freeze (no new writeful work starts), then prove quiescence here.
 */
export async function awaitBackgroundQuiescence(options: { timeoutMs: number }): Promise<QuiescenceReport> {
  const { timeoutMs } = options
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) throw new Error("background-tasks: timeoutMs must be a non-negative number")
  const pendingAtStart = pending.size
  const startedAt = Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs)
  })
  try {
    while (pending.size > 0) {
      const outcome = await Promise.race([Promise.allSettled([...pending]).then(() => "settled" as const), deadline])
      if (outcome === "timeout") throw new BackgroundQuiescenceTimeoutError(pending.size, timeoutMs)
    }
  } finally {
    if (timer) clearTimeout(timer)
  }
  return { pendingAtStart, pendingAtEnd: pending.size, waitedMs: Date.now() - startedAt }
}

/** Number of tasks currently in flight. */
export function pendingBackgroundTaskCount(): number {
  return pending.size
}

/** Outcomes that settled and were NOT yet consumed by `drainBackgroundTasks()`. */
export function unreviewedBackgroundOutcomes(): readonly BackgroundTaskOutcome[] {
  return [...unreviewed]
}

export function isBackgroundTaskRecording(): boolean {
  return recording
}

/** Start recording outcomes (tests). Refuses to discard unreviewed outcomes of a previous recording. */
export function startBackgroundTaskRecording(): void {
  if (unreviewed.length > 0) {
    throw new Error(`background-tasks: ${unreviewed.length} unreviewed outcome(s) from a previous recording: ${describe(unreviewed)}`)
  }
  recording = true
  unreviewed = []
}

/**
 * Stop recording. Fails if outcomes settled and were never consumed — a
 * rejection nobody validated must not disappear with the recording.
 */
export function stopBackgroundTaskRecording(): void {
  if (unreviewed.length > 0) {
    throw new Error(`background-tasks: refusing to stop recording with ${unreviewed.length} unreviewed outcome(s): ${describe(unreviewed)}`)
  }
  recording = false
}

/**
 * Wait until no background task is pending, then return (and consume) the
 * outcomes recorded since the last drain. Tasks spawned while draining are
 * awaited too, so the caller observes a genuinely idle registry.
 */
export async function drainBackgroundTasks(): Promise<BackgroundTaskOutcome[]> {
  while (pending.size > 0) {
    await Promise.allSettled([...pending])
  }
  const drained = unreviewed
  unreviewed = []
  return drained
}

function describe(outcomes: readonly BackgroundTaskOutcome[]): string {
  return outcomes.map((o) => `${o.label}:${o.status}`).join(", ")
}

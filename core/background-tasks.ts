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

/**
 * Client helpers for moving a `WorkspaceTask` between the user and AI
 * lanes from the Today surface. Thin `fetch` wrappers around
 * `PATCH /api/tasks/[id]/assignee` so the row component and the page /
 * drawer stay focused on UI state, not transport.
 *
 * Error handling philosophy:
 *   - We always throw on non-2xx so optimistic UIs can rollback in their
 *     `catch` block. The thrown `Error.message` is whatever the server
 *     returned in `error.message` (or `error.code`), falling back to a
 *     short generic line. Never expose raw HTTP status codes to users.
 *   - Network failures (`fetch` rejects) bubble up as `Error("Network
 *     request failed")` so the caller's `catch` always sees an `Error`.
 */

/**
 * Same wire envelope `successResponse` / `errorResponse` use in
 * `@/lib/api`. Kept duplicated here to avoid importing a server-only
 * module from the browser bundle.
 */
type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error?: { message?: string; code?: string } }

/**
 * Pre-parse before checking `res.ok` so we get the server's error
 * message even when it returns 400/404/500. Most API routes here use
 * the `{ success, error: { message } }` envelope; we degrade gracefully
 * if a layer below returned something else. Throws on any non-success.
 */
async function assertOk(res: Response): Promise<void> {
  let parsed: ApiEnvelope<unknown> | null = null
  try {
    parsed = (await res.json()) as ApiEnvelope<unknown>
  } catch {
    parsed = null
  }

  if (!res.ok || !parsed || parsed.success === false) {
    const msg =
      parsed && "error" in parsed && parsed.error?.message
        ? parsed.error.message
        : `Could not update task (HTTP ${res.status})`
    throw new Error(msg)
  }
}

async function patchAssignee(taskId: string, to: "user" | "ai"): Promise<void> {
  let res: Response
  try {
    res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/assignee`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to }),
      credentials: "same-origin",
    })
  } catch {
    throw new Error("Network request failed")
  }

  await assertOk(res)
}

/**
 * Send a task to the AI lane. Server clears `assigneeId` and sets
 * `assigneeType="ai"`. Does NOT change status / executionMode /
 * suggestedBy / sourceType.
 */
export async function sendToAI(taskId: string): Promise<void> {
  if (!taskId) throw new Error("taskId is required")
  return patchAssignee(taskId, "ai")
}

/**
 * Take a task over from the AI lane. Server sets `assigneeType="user"`
 * and pins `assigneeId` to the requesting `session.userId`. Does NOT
 * change status / executionMode / suggestedBy / sourceType.
 *
 * NB: a `status === "proposed"` row should never reach this helper —
 * the row UI hides the Take-over button while a proposal is still
 * awaiting Approve / Dismiss in the Inbox / Smart Hub.
 */
export async function takeOver(taskId: string): Promise<void> {
  if (!taskId) throw new Error("taskId is required")
  return patchAssignee(taskId, "user")
}

/**
 * Hand a LEGACY `Tarea` off to the AI lane. Unlike `sendToAI` (which
 * patches an existing WorkspaceTask), this hits a conversion route that
 * mirrors the Tarea into a WorkspaceTask linked via `tareaId` and
 * assigns it to AI. Idempotent server-side: a double-click reuses the
 * existing mirror. After it resolves the caller should refetch Today so
 * the `tarea:` row becomes a `task:` row in the AI lane.
 */
export async function sendLegacyTareaToAI(tareaId: string): Promise<void> {
  if (!tareaId) throw new Error("tareaId is required")
  let res: Response
  try {
    res = await fetch(
      `/api/tasks/legacy-tarea/${encodeURIComponent(tareaId)}/send-to-ai`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
      },
    )
  } catch {
    throw new Error("Network request failed")
  }

  await assertOk(res)
}

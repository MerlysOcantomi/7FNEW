import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"
import { getWorkspaceTaxonomies } from "@core/workspace-taxonomies"

type Params = { params: Promise<{ id: string }> }

/**
 * Set or unset a conversation's operator-assigned category.
 *
 * Strict scope: this endpoint touches ONLY `Conversation.category`. It
 * does NOT update `intent`, `status`, `urgency`, classification, or
 * anything else. The category is a free-form string at the DB layer;
 * this endpoint is what enforces the per-tenant vocabulary.
 *
 * Auth: `requireWriteAccess()` (>= MEMBER). VIEWER cannot mutate.
 *       Workspace is resolved from session/cookie context (same flow
 *       as every other inbox API).
 *
 * Cross-tenant guard: we re-check the conversation belongs to the
 * caller's workspace via `findFirst({ id, workspaceId })`. A 404 is
 * returned for both "id does not exist" and "id belongs to a different
 * tenant" — never 403 — so a probing client cannot enumerate
 * conversation IDs across workspace boundaries.
 *
 * Validation rules:
 *   - body must be `{ category: string | null }`
 *   - if `null` (or empty string normalised to null), we always accept;
 *     this is the "unset" path the operator uses to clear a label
 *   - otherwise:
 *       - resolve `Workspace.config.taxonomies.inbox` via the safe
 *         reader (`getWorkspaceTaxonomies`)
 *       - if the taxonomy list is non-empty: the candidate must be in
 *         the list (case-sensitive, exact match — operators see the
 *         exact label they are setting)
 *       - if the taxonomy list IS empty: reject with VALIDATION_ERROR
 *         and a clear explanation. We never let an operator set a
 *         category that has no anchor in the workspace vocabulary,
 *         because that would create silent vocabulary drift across
 *         tenants and make a future "rename label" migration painful.
 *
 * No-op fast path: if the candidate equals the existing value (after
 * null-normalisation), we return success WITHOUT writing to the DB.
 *
 * Response shape:
 *   {
 *     "success": true,
 *     "data": {
 *       "id": "...",
 *       "category": string | null,
 *       "unchanged": boolean
 *     }
 *   }
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireWriteAccess(request)
    const { id } = await params

    const body = await request.json().catch(() => null)
    const rawCandidate = (body as { category?: unknown } | null)?.category

    /**
     * Normalise input. Anything that is not a non-empty string becomes
     * `null` (the unset path). We trim before checking emptiness so a
     * whitespace-only string also reads as "unset".
     */
    let candidate: string | null
    if (typeof rawCandidate === "string") {
      const trimmed = rawCandidate.trim()
      candidate = trimmed.length === 0 ? null : trimmed
    } else if (rawCandidate === null || rawCandidate === undefined) {
      candidate = null
    } else {
      return errorResponse(
        "VALIDATION_ERROR",
        "category debe ser string o null",
      )
    }

    /**
     * Conversation lookup BEFORE the taxonomy lookup so a missing
     * conversation short-circuits without touching the workspace
     * config layer.
     */
    const existing = await db.conversation.findFirst({
      where: { id, workspaceId },
      select: { id: true, category: true },
    })
    if (!existing) {
      return errorResponse("NOT_FOUND", "Conversación no encontrada", 404)
    }

    /**
     * Validate against the workspace taxonomy when setting (not when
     * unsetting). Reading happens AFTER we confirmed the conversation
     * exists in this workspace — no extra cross-tenant exposure.
     */
    if (candidate !== null) {
      const taxonomies = await getWorkspaceTaxonomies(workspaceId)
      const allowed = taxonomies.inbox
      if (allowed.length === 0) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Este workspace no tiene taxonomía de Inbox configurada. Define Workspace.config.taxonomies.inbox antes de asignar categorías.",
        )
      }
      if (!allowed.includes(candidate)) {
        return errorResponse(
          "VALIDATION_ERROR",
          `category "${candidate}" no es válida para este workspace. Valores permitidos: ${allowed.join(", ")}`,
        )
      }
    }

    /**
     * No-op fast path. We compare after null-normalisation on both
     * sides so an operator clearing a "" (which doesn't actually
     * happen at the DB level since we'd have stored null) never causes
     * a redundant write.
     */
    const previous = existing.category ?? null
    if (previous === candidate) {
      return successResponse({
        id: existing.id,
        category: previous,
        unchanged: true,
      })
    }

    const updated = await db.conversation.update({
      where: { id: existing.id },
      data: { category: candidate },
      select: { id: true, category: true },
    })

    return successResponse({
      id: updated.id,
      category: updated.category,
      unchanged: false,
    })
  } catch (error) {
    return handleError(error, "ConversationCategory")
  }
}

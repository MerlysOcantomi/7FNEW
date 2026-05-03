import { NextResponse } from "next/server"
import { requireReadAccess } from "@core/auth/workspace-auth"
import { getWorkspaceTaxonomies } from "@core/workspace-taxonomies"

/**
 * Return the parsed taxonomies for the active workspace.
 *
 * Authorisation: `requireReadAccess()` resolves the workspace from the
 * caller's session/cookie context (same pattern as
 * `app/api/workspace/business-profile/route.ts`). Anyone with at least
 * `VIEWER` membership in the active workspace can read.
 *
 * Response shape:
 *
 *   {
 *     "taxonomies": {
 *       "inbox":    string[],
 *       "clients":  string[],
 *       "projects": string[],
 *       "tasks":    string[]
 *     }
 *   }
 *
 * Empty arrays are valid: a workspace that has never been seeded
 * returns four empty lists (and the UI can render an empty state). We
 * deliberately do NOT 404 in that case — the taxonomies sub-object is
 * optional metadata, not a required resource.
 *
 * The raw `Workspace.config` blob is NEVER exposed by this endpoint.
 * Callers receive only the sanitised taxonomy view: trimmed, deduped,
 * non-empty strings, capped at 200 items per key.
 *
 * Read-only: no PUT/PATCH/DELETE. Mutations live in the seed scripts
 * (`scripts/seed-7f-business-taxonomies.ts`) for now.
 */
export async function GET() {
  try {
    const { workspaceId } = await requireReadAccess()
    const taxonomies = await getWorkspaceTaxonomies(workspaceId)
    return NextResponse.json({ taxonomies })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

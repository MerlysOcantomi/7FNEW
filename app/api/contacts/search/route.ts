import { NextRequest } from "next/server"
import type { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { successResponse, errorResponse } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"

/**
 * GET /api/contacts/search?q=
 *
 * Read-only recipient suggestions for the Inbox "New Email" composer. Reads the
 * CENTRAL workspace Contact model (no Inbox-specific contact book) so Compose,
 * and any future vertical, reuse the same people data.
 *
 * Contract:
 *  - Workspace-scoped (multi-tenant isolation is enforced via `workspaceId`).
 *  - Only contacts WITH a usable email are returned — the composer needs an
 *    address, and a contact without one is noise.
 *  - `q` < 2 chars  → recent contacts (lastSeenAt desc), take 8. Lets the user
 *    open the picker and immediately see who they last talked to.
 *  - `q` >= 2 chars → match across nombre / email / empresa, lastSeenAt desc
 *    then nombre asc (no relevance ranking available on SQLite/Turso; mirror the
 *    `/api/search` `contains` approach).
 *  - Emails normalized to lowercase to match the compose/send convention.
 */
const TAKE = 8

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess()
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""

    const where: Prisma.ContactWhereInput = {
      workspaceId,
      email: { not: null },
      ...(q.length >= 2
        ? {
            OR: [
              { nombre: { contains: q } },
              { email: { contains: q } },
              { empresa: { contains: q } },
            ],
          }
        : {}),
    }

    const contacts = await db.contact.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        email: true,
        empresa: true,
        tipo: true,
        lastSeenAt: true,
      },
      orderBy:
        q.length >= 2
          ? [{ lastSeenAt: "desc" }, { nombre: "asc" }]
          : [{ lastSeenAt: "desc" }],
      take: TAKE,
    })

    /**
     * Defensive post-filter: a Contact row can technically carry an empty-string
     * email (legacy/manual data) which `{ not: null }` won't catch. Drop anything
     * that isn't a plausible address and normalize casing.
     */
    const results = contacts
      .map((c) => ({
        id: c.id,
        nombre: c.nombre,
        email: c.email ? c.email.trim().toLowerCase() : null,
        empresa: c.empresa,
        tipo: c.tipo,
        lastSeenAt: c.lastSeenAt,
      }))
      .filter((c): c is typeof c & { email: string } => !!c.email && c.email.includes("@"))

    return successResponse(results)
  } catch (err) {
    return errorResponse(
      "CONTACT_SEARCH_ERROR",
      "Error en búsqueda de contactos",
      (err as { status?: number })?.status || 500,
    )
  }
}

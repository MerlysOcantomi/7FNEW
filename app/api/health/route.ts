import { NextResponse } from "next/server"

/**
 * Liveness check (CORE-02B, closes F-AUTH-04).
 *
 * The previous version returned connection-URL previews, auth-token lengths,
 * raw libSQL/Prisma error text and a platform-wide (cross-tenant) customer
 * count. No consumer of that payload exists in the repository, so this is now
 * a minimal, non-sensitive liveness probe: it reads no environment variables,
 * opens no database connection and reports nothing about infrastructure.
 *
 * It stays behind the normal middleware authentication on purpose — it is
 * NOT in the middleware's PUBLIC_PATHS. If a DB-readiness contract ever
 * becomes necessary, it must be added behind server-side platform
 * authorization and return generic statuses only.
 */
export async function GET() {
  return NextResponse.json({ ok: true })
}

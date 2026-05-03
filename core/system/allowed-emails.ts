import { db } from "@core/db"

/**
 * Public shape returned to the SevenF System Admin allowlist UI.
 *
 * EXPLICIT WHITELIST. AllowedEmail is a small model so the difference is
 * minor today, but we keep the discipline so future additions to the schema
 * (e.g. invitation tokens, expiration dates) don't accidentally leak.
 */
export interface SystemAllowedEmailSummary {
  id: string
  email: string
  role: string
  createdAt: string
}

/**
 * List every allowlisted email in the platform.
 *
 * Caller MUST pass through `requirePlatformRole(...)` first. This function
 * is a pure accessor and does NOT authenticate.
 *
 * Ordering matches the legacy endpoint (`createdAt desc`) so the migrated UI
 * sees the same row order it did before.
 */
export async function listAllowedEmails(): Promise<SystemAllowedEmailSummary[]> {
  const rows = await db.allowedEmail.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    createdAt: r.createdAt.toISOString(),
  }))
}

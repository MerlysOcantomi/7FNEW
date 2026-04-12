import { NextRequest, NextResponse } from "next/server"
import { syncAllImapConnections } from "@modules/inbox/imap-sync"

/**
 * Cron endpoint for periodic IMAP sync across all active connections.
 *
 * Intended to be called by a cron job or external scheduler every 2-5 minutes.
 * Secured by CRON_SECRET env var — skip the standard auth flow since this
 * runs as a service, not as a user request.
 *
 * Example: Vercel Cron, external cURL, or a simple setInterval in dev.
 *
 *   curl -X POST http://localhost:3000/api/cron/imap-sync \
 *     -H "Authorization: Bearer YOUR_CRON_SECRET"
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret) {
    const token = authHeader?.replace("Bearer ", "")
    if (token !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }

  try {
    const results = await syncAllImapConnections()

    const summary = {
      total: results.length,
      totalIngested: results.reduce((s, r) => s + r.ingested, 0),
      totalSkipped: results.reduce((s, r) => s + r.skipped, 0),
      totalErrors: results.reduce((s, r) => s + r.errors.length, 0),
      connections: results.map((r) => ({
        connectionId: r.connectionId,
        fetched: r.fetched,
        ingested: r.ingested,
        skipped: r.skipped,
        errors: r.errors,
      })),
    }

    console.log(`[cron:imap-sync] Done connections=${summary.total} ingested=${summary.totalIngested} errors=${summary.totalErrors}`)

    return NextResponse.json({ ok: true, ...summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[cron:imap-sync] Fatal error: ${message}`)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

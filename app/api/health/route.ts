import { NextResponse } from "next/server"

function maskUrl(url: string | undefined): string {
  if (!url) return "undefined"
  if (url.length < 10) return url
  return url.substring(0, 15) + "..." + url.substring(url.length - 10)
}

export async function GET() {
  const checks: Record<string, string> = {}

  checks.DATABASE_URL_preview = maskUrl(process.env.DATABASE_URL)
  checks.TURSO_DATABASE_URL_preview = maskUrl(process.env.TURSO_DATABASE_URL)
  checks.DATABASE_AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN ? `set (${process.env.DATABASE_AUTH_TOKEN.length} chars)` : "missing"
  checks.TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN ? `set (${process.env.TURSO_AUTH_TOKEN.length} chars)` : "missing"

  const resolvedUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL
  checks.resolved_url_preview = maskUrl(resolvedUrl)

  try {
    const { createClient } = await import("@libsql/client")
    const token = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN
    const client = createClient({ url: resolvedUrl!, authToken: token })
    const result = await client.execute("SELECT COUNT(*) as cnt FROM Cliente")
    checks.libsql_direct = "ok"
    checks.clientes_count = String(result.rows[0]?.cnt)
  } catch (err) {
    checks.libsql_direct = "error"
    checks.libsql_error = err instanceof Error ? err.message : String(err)
  }

  try {
    const { db } = await import("@/lib/db")
    const count = await db.cliente.count()
    checks.prisma_connection = "ok"
    checks.prisma_clientes_count = String(count)
  } catch (err) {
    checks.prisma_connection = "error"
    checks.prisma_error = err instanceof Error ? err.message : String(err)
  }

  checks.version = "v3"
  return NextResponse.json(checks)
}

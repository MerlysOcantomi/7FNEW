import { NextResponse } from "next/server"

export async function GET() {
  const checks: Record<string, string> = {}

  // Check env vars
  checks.DATABASE_URL = process.env.DATABASE_URL ? "set" : "missing"
  checks.TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL ? "set" : "missing"
  checks.DATABASE_AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN ? "set" : "missing"
  checks.TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN ? "set" : "missing"

  // Check DB connection
  try {
    const { db } = await import("@/lib/db")
    const count = await db.cliente.count()
    checks.db_connection = "ok"
    checks.clientes_count = String(count)
  } catch (err) {
    checks.db_connection = "error"
    checks.db_error = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json(checks)
}

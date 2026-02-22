import { NextResponse } from "next/server"
import { createClient } from "@libsql/client"

export async function POST() {
  try {
    const dbUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL
    const dbToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN

    if (!dbUrl) {
      return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 })
    }

    const client = createClient({ url: dbUrl, authToken: dbToken })

    await client.execute(`CREATE TABLE IF NOT EXISTS "ClientAuth" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "clienteId" TEXT NOT NULL,
      "lastLogin" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ClientAuth_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`)

    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "ClientAuth_email_key" ON "ClientAuth"("email")`)
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "ClientAuth_clienteId_key" ON "ClientAuth"("clienteId")`)

    return NextResponse.json({ success: true, message: "ClientAuth table created" })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}

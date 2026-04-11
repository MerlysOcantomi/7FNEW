import "dotenv/config"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "../generated/prisma/client"

const dbUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL
if (!dbUrl) throw new Error("DATABASE_URL or TURSO_DATABASE_URL must be set")

const adapter = new PrismaLibSql({
  url: dbUrl,
  authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
})
const db = new PrismaClient({ adapter })

/**
 * Creates a default ChannelConnection for every workspace that doesn't have one yet.
 * Uses INBOX_FROM_EMAIL / INBOX_FROM_NAME env vars as the connection config.
 * Safe to run multiple times (idempotent).
 */
async function backfillConnections() {
  const fromEmail = process.env.INBOX_FROM_EMAIL || process.env.RESEND_FROM_EMAIL
  const fromName = process.env.INBOX_FROM_NAME || null

  if (!fromEmail) {
    console.warn("[backfill] No INBOX_FROM_EMAIL or RESEND_FROM_EMAIL set — skipping")
    return
  }

  const workspaces = await db.workspace.findMany({
    select: { id: true, nombre: true },
  })

  let created = 0
  let skipped = 0

  for (const ws of workspaces) {
    const existing = await db.channelConnection.findFirst({
      where: { workspaceId: ws.id, channelType: "email" },
    })

    if (existing) {
      console.log(`[backfill] Workspace "${ws.nombre}" (${ws.id}) already has email connection — skipped`)
      skipped++
      continue
    }

    await db.channelConnection.create({
      data: {
        workspaceId: ws.id,
        channelType: "email",
        provider: "resend",
        name: fromEmail,
        externalAccountId: fromEmail,
        isDefault: true,
        status: "active",
        config: JSON.stringify({ fromEmail, fromName }),
      },
    })

    console.log(`[backfill] Created default email connection for workspace "${ws.nombre}" (${ws.id})`)
    created++
  }

  console.log(`[backfill] Done. Created: ${created}, Skipped: ${skipped}, Total workspaces: ${workspaces.length}`)
}

backfillConnections()
  .catch((err) => {
    console.error("[backfill] Failed:", err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())

/**
 * Diagnostic script — inspects the live state of every `ChannelConnection` plus the most
 * recent inbound `Message` rows and the workspaces in the DB. Useful when an operator
 * reports "Inbox no longer receives emails" because it answers, in one run:
 *  - is there a connection at all?
 *  - is it in the expected workspace?
 *  - is it `active` or in `error`?
 *  - what's the persisted `syncState.lastUid` cursor?
 *  - has *any* inbound message ever been ingested?
 *
 * Usage:
 *   node --env-file=.env --import tsx scripts/diagnose-channel-connections.ts
 *
 * Output is plain stdout (no JSON), copy-pasteable into incident reports. Read-only — does
 * not mutate the DB. Safe to run in production.
 */

import { db } from "../core/db"

async function main() {
  const conns = await db.channelConnection.findMany({
    select: {
      id: true,
      workspaceId: true,
      channelType: true,
      provider: true,
      status: true,
      externalAccountId: true,
      isDefault: true,
      lastError: true,
      lastSyncAt: true,
      syncState: true,
      name: true,
    },
    orderBy: { createdAt: "asc" },
  })
  console.log(`ChannelConnection rows: ${conns.length}`)
  for (const c of conns) {
    console.log("---")
    console.log(`id=${c.id}`)
    console.log(`workspaceId=${c.workspaceId}`)
    console.log(`channelType=${c.channelType} provider=${c.provider} status=${c.status}`)
    console.log(`externalAccountId=${c.externalAccountId}`)
    console.log(`isDefault=${c.isDefault}`)
    console.log(`name=${c.name}`)
    console.log(`lastSyncAt=${c.lastSyncAt?.toISOString() ?? "null"}`)
    console.log(`syncState=${c.syncState}`)
    console.log(`lastError=${c.lastError}`)
  }

  const ws = await db.workspace.findMany({ select: { id: true, slug: true, nombre: true } })
  console.log("---")
  console.log(`Workspaces: ${ws.length}`)
  for (const w of ws) console.log(`  ${w.id} slug=${w.slug ?? "?"} nombre=${w.nombre}`)

  const recent = await db.message.findMany({
    where: { direction: "inbound" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, workspaceId: true, conversationId: true, createdAt: true },
  })
  console.log("---")
  console.log(`Most recent inbound messages (top 5):`)
  for (const m of recent) {
    console.log(`  ${m.createdAt.toISOString()} ws=${m.workspaceId} conv=${m.conversationId} msg=${m.id}`)
  }

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

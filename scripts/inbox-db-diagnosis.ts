/**
 * Smart Inbox — snapshot de solo lectura (counts + últimos 20).
 * Run: npx tsx scripts/inbox-db-diagnosis.ts
 * Usa DATABASE_URL / DATABASE_AUTH_TOKEN (o TURSO_*). No imprime secretos;
 * no subas la salida a sitios públicos si contiene IDs reales de prod.
 */
import "dotenv/config"
import { db } from "../core/db"

async function main() {
  const workspaceCount = await db.workspace.count()
  const memberCount = await db.workspaceMember.count()
  const connectionCount = await db.channelConnection.count()

  const convTotal = await db.conversation.count()
  const msgTotal = await db.message.count()

  const byWs = await db.conversation.groupBy({
    by: ["workspaceId"],
    _count: { _all: true },
  })
  const byStatus = await db.conversation.groupBy({
    by: ["status"],
    _count: { _all: true },
  })

  const latestConvs = await db.conversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    take: 20,
    select: {
      id: true,
      workspaceId: true,
      status: true,
      channel: true,
      lastMessageAt: true,
      messageCount: true,
    },
  })

  const latestMsgs = await db.message.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      workspaceId: true,
      conversationId: true,
      direction: true,
      createdAt: true,
    },
  })

  console.log(JSON.stringify({
    workspaceCount,
    workspaceMemberCount: memberCount,
    channelConnectionCount: connectionCount,
    conversationTotal: convTotal,
    messageTotal: msgTotal,
    conversationsByWorkspaceId: byWs.map((r) => ({ workspaceId: r.workspaceId, count: r._count._all })),
    conversationsByStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
    latest20Conversations: latestConvs,
    latest20Messages: latestMsgs,
  }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
}).finally(() => process.exit(0))

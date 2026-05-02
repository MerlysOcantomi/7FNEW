/**
 * One-off forensic — operator reports "no email is arriving" but the live IMAP sync
 * shows 3 inbound messages today on workspace cmm49gtfc000404jrz7s655a6 (skina). This
 * inspects the conversation + each message's metadata to figure out why they're not
 * visible in the UI: are they trashed? is the conversation in a status hidden by the
 * sidebar filter? does the contact resolve cleanly?
 *
 * Read-only. Outputs plain stdout for incident reports.
 */

import { db } from "../core/db"

const WORKSPACE_ID = "cmm49gtfc000404jrz7s655a6"
const CONV_ID = "cmnw94noa000104ld5g56u73u"

function safeMeta(m: string | null): Record<string, unknown> | null {
  if (!m) return null
  try { return JSON.parse(m) as Record<string, unknown> } catch { return null }
}

async function main() {
  const conv = await db.conversation.findFirst({
    where: { id: CONV_ID, workspaceId: WORKSPACE_ID },
    include: {
      contact: { select: { id: true, nombre: true, email: true } },
      messages: { orderBy: { createdAt: "asc" }, select: { id: true, direction: true, role: true, isInternal: true, content: true, createdAt: true, metadata: true } },
    },
  })

  if (!conv) {
    console.log("Conversation NOT FOUND in workspace.")
    return
  }

  console.log(`Conversation:`)
  console.log(`  id=${conv.id}`)
  console.log(`  status=${conv.status}`)
  console.log(`  channel=${conv.channel}`)
  console.log(`  subject=${conv.subject ?? "(null)"}`)
  console.log(`  trashedAt=${conv.trashedAt?.toISOString() ?? "null"}`)
  console.log(`  closedAt=${conv.closedAt?.toISOString() ?? "null"}`)
  console.log(`  lastMessageAt=${conv.lastMessageAt?.toISOString() ?? "null"}`)
  console.log(`  messageCount=${conv.messageCount}`)
  console.log(`  contact: id=${conv.contact?.id} nombre=${conv.contact?.nombre} email=${conv.contact?.email}`)
  console.log(`  total messages: ${conv.messages.length}`)
  console.log("---")
  for (const m of conv.messages) {
    const meta = safeMeta(m.metadata)
    const flags = [
      m.isInternal ? "internal" : null,
      meta?.trashedAt ? `trashed@${meta.trashedAt}` : null,
      meta?.intentStatus ? `intent=${meta.intentStatus}` : null,
      meta?.openedAt ? "opened" : null,
    ].filter(Boolean).join(",")
    console.log(`  ${m.createdAt.toISOString()} dir=${m.direction} role=${m.role} flags=[${flags}] preview="${m.content.slice(0, 60).replace(/\s+/g, " ")}"`)
  }

  console.log("---")
  console.log(`All inbound messages in workspace (last 14 days):`)
  const since = new Date(Date.now() - 14 * 86400000)
  const recent = await db.message.findMany({
    where: { workspaceId: WORKSPACE_ID, direction: "inbound", createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, conversationId: true, createdAt: true, metadata: true, content: true },
  })
  for (const m of recent) {
    const meta = safeMeta(m.metadata)
    console.log(`  ${m.createdAt.toISOString()} conv=${m.conversationId} trashed=${Boolean(meta?.trashedAt)} preview="${m.content.slice(0, 50).replace(/\s+/g, " ")}"`)
  }

  console.log("---")
  console.log(`All conversations in workspace (top 15 by lastMessageAt):`)
  const convs = await db.conversation.findMany({
    where: { workspaceId: WORKSPACE_ID },
    orderBy: { lastMessageAt: "desc" },
    take: 15,
    select: { id: true, status: true, channel: true, subject: true, lastMessageAt: true, messageCount: true, trashedAt: true },
  })
  for (const c of convs) {
    console.log(`  ${c.lastMessageAt?.toISOString() ?? "null"} status=${c.status} ch=${c.channel} msgs=${c.messageCount} trashed=${Boolean(c.trashedAt)} subj="${(c.subject ?? "").slice(0, 50)}"`)
  }

  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })

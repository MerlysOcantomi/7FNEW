import { db } from "@core/db"
import { type NotificationType } from "@core/notifications"
import { getTranslations, resolveLocaleFromConfig } from "@core/i18n"
import type { TranslationSet } from "@core/i18n"

interface InboxNotifyInput {
  workspaceId: string
  conversationId: string
  subject?: string | null
  contactName?: string | null
  channel?: string | null
}

async function getWorkspaceMemberIds(
  workspaceId: string,
  exclude?: string | null,
): Promise<string[]> {
  const members = await db.workspaceMember.findMany({
    where: { workspaceId },
    select: { userId: true },
  })
  return members
    .map((m) => m.userId)
    .filter((id) => !exclude || id !== exclude)
}

async function hasUnreadNotification(
  userId: string,
  type: NotificationType,
  conversationId: string,
  workspaceId: string,
): Promise<boolean> {
  const existing = await db.notification.findFirst({
    where: {
      userId,
      type,
      read: false,
      workspaceId,
      link: { contains: conversationId },
    },
    select: { id: true },
  })
  return !!existing
}

async function notifyUsers(
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  conversationId: string,
  workspaceId: string,
) {
  const link = `/inbox?id=${conversationId}`

  const filtered: string[] = []
  for (const userId of userIds) {
    const has = await hasUnreadNotification(userId, type, conversationId, workspaceId)
    if (!has) filtered.push(userId)
  }

  if (filtered.length === 0) return

  await db.notification.createMany({
    data: filtered.map((userId) => ({
      userId,
      type,
      title,
      message,
      link,
      workspaceId,
    })),
  })
}

async function resolveWorkspaceTranslations(workspaceId: string): Promise<TranslationSet> {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { config: true },
  })
  return getTranslations(resolveLocaleFromConfig(ws?.config))
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function label(
  t: TranslationSet,
  contactName?: string | null,
  channel?: string | null,
) {
  if (contactName) return contactName
  if (channel === "web_chat") return t.notifications.inbox.contactWebChat
  if (channel === "email") return t.notifications.inbox.contactEmail
  return t.notifications.inbox.contactDefault
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function notifyNewConversation(input: InboxNotifyInput) {
  const t = await resolveWorkspaceTranslations(input.workspaceId)
  const n = t.notifications.inbox
  const who = label(t, input.contactName, input.channel)
  const subj = input.subject ? truncate(input.subject, 60) : n.newConversationFallback

  await notifyUsers(
    await getWorkspaceMemberIds(input.workspaceId),
    "inbox_nueva_conversacion",
    n.newConversation(who),
    subj,
    input.conversationId,
    input.workspaceId,
  )
}

export async function notifyInboundMessage(
  input: InboxNotifyInput & { assignedTo?: string | null },
) {
  const t = await resolveWorkspaceTranslations(input.workspaceId)
  const n = t.notifications.inbox
  const who = label(t, input.contactName, input.channel)
  const subj = input.subject ? truncate(input.subject, 60) : n.newMessageFallback

  const userIds = input.assignedTo
    ? [input.assignedTo]
    : await getWorkspaceMemberIds(input.workspaceId)

  await notifyUsers(
    userIds,
    "inbox_nuevo_mensaje",
    n.newMessage(who),
    subj,
    input.conversationId,
    input.workspaceId,
  )
}

export async function notifyConversationAssigned(
  input: InboxNotifyInput & { assignedTo: string },
) {
  const t = await resolveWorkspaceTranslations(input.workspaceId)
  const n = t.notifications.inbox
  const subj = input.subject ? truncate(input.subject, 60) : n.assignedFallback

  await notifyUsers(
    [input.assignedTo],
    "inbox_asignacion",
    n.assigned,
    subj,
    input.conversationId,
    input.workspaceId,
  )
}

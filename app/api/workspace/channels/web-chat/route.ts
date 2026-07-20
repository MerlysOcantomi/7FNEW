import { NextRequest, NextResponse } from "next/server"
import { requireAdminAccess } from "@/lib/auth/workspace-auth"
import { db } from "@core/db"
import { parseJsonConfig } from "@core/verticals"
import { updateWorkspaceConfig } from "@core/workspace"

/**
 * PUT /api/workspace/channels/web-chat — toggle web chat reception for the
 * active workspace. Body: `{ "enabled": boolean }`.
 *
 * The flag lives at `Workspace.config.inbox.webChat.enabled` and is read by
 * `core/inbox/channel-setup.ts#isWebChatReceptionEnabled` — both the
 * Business Profile Channels view and the public web chat ingest endpoint
 * (`/api/inbox/public/send`) honor it, so switching it off REALLY stops new
 * visitor messages (existing conversations stay readable).
 *
 * `mergeConfigs` replaces top-level keys wholesale (only `modules`/`ui`
 * deep-merge), so the current `inbox` slice is re-read and spread here —
 * otherwise this write would destroy `inbox.channels` overrides.
 *
 * Admin-only, workspace resolved from the session (never from the client).
 */
export async function PUT(request: NextRequest) {
  try {
    const { workspaceId } = await requireAdminAccess()

    const body = await request.json().catch(() => null)
    const enabled = (body as { enabled?: unknown } | null)?.enabled
    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled must be a boolean" },
        { status: 400 },
      )
    }

    const ws = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { config: true },
    })
    if (!ws) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const current = parseJsonConfig(ws.config)
    const currentInbox =
      current.inbox && typeof current.inbox === "object" && !Array.isArray(current.inbox)
        ? (current.inbox as Record<string, unknown>)
        : {}
    const currentWebChat =
      currentInbox.webChat &&
      typeof currentInbox.webChat === "object" &&
      !Array.isArray(currentInbox.webChat)
        ? (currentInbox.webChat as Record<string, unknown>)
        : {}

    await updateWorkspaceConfig(workspaceId, {
      inbox: { ...currentInbox, webChat: { ...currentWebChat, enabled } },
    })

    return NextResponse.json({ enabled })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

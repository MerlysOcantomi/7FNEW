import { successResponse, handleError } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { db } from "@core/db"
import { getVerticalByKey } from "@core/verticals"
import { resolveWorkspaceExperience } from "@core/vertical-packs/experience"
import {
  extractInboxChannelsSlice,
  parseWorkspaceInboxChannels,
  resolveInboxChannelsConfig,
  resolveInboxChannelViews,
  type InboxChannelsConfigInput,
} from "@core/inbox/channel-config"

/**
 * GET /api/inbox/channels — the effective Inbox channel view for the active
 * workspace, resolved as:
 *
 *   core defaults → vertical layer → workspace overrides, reconciled with
 *   the workspace's real `ChannelConnection` rows.
 *
 * Vertical layer precedence: the DB `Vertical.defaultConfig` inbox slice
 * when the row carries one (admin edits win), otherwise the in-code pack
 * (`resolveWorkspaceExperience().inboxChannels`). The pack fallback matters
 * for environments whose Vertical row was seeded before packs declared an
 * inbox block — Beauty ordering must not depend on a reseed.
 *
 * NOTE: we deliberately do NOT read `resolvedConfig` from
 * `getWorkspaceWithResolvedConfig` for this slice — `mergeConfigs` replaces
 * top-level keys wholesale beyond `modules`/`ui`, so a workspace overriding
 * only `inbox.channels.order` would lose the vertical's `enabled` list.
 * `resolveInboxChannelsConfig` layers per field instead.
 *
 * Response: `{ channels: ResolvedInboxChannelView[], defaultChannel }`.
 * The raw `Workspace.config` blob never leaves this endpoint.
 */
export async function GET() {
  try {
    const { workspaceId } = await requireReadAccess()

    const ws = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { config: true, verticalKey: true },
    })

    let verticalLayer: InboxChannelsConfigInput | null = null
    if (ws?.verticalKey) {
      const vertical = await getVerticalByKey(ws.verticalKey)
      if (vertical?.defaultConfig) {
        try {
          verticalLayer = extractInboxChannelsSlice(JSON.parse(vertical.defaultConfig))
        } catch {
          verticalLayer = null
        }
      }
      if (!verticalLayer || Object.keys(verticalLayer).length === 0) {
        verticalLayer = resolveWorkspaceExperience(ws.verticalKey).inboxChannels
      }
    }

    const workspaceLayer = parseWorkspaceInboxChannels(ws?.config)
    const config = resolveInboxChannelsConfig(verticalLayer, workspaceLayer)

    const connections = await db.channelConnection.findMany({
      where: { workspaceId, status: "active" },
      select: { channelType: true },
    })

    const channels = resolveInboxChannelViews({
      config,
      connectedChannelIds: connections.map((c) => c.channelType),
    })

    return successResponse({ channels, defaultChannel: config.defaultChannel })
  } catch (error) {
    return handleError(error, "inbox channels")
  }
}

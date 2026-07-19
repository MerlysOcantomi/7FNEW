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
import {
  extractInboxFiltersSlice,
  parseWorkspaceInboxFilters,
  resolveInboxFiltersConfig,
  resolveInboxFilterViews,
  type InboxFiltersConfigInput,
} from "@core/inbox/filter-config"

/**
 * GET /api/inbox/channels — the effective Inbox CHANNEL and FILTER view for
 * the active workspace, resolved as:
 *
 *   core defaults → vertical layer → workspace overrides, with channels
 *   additionally reconciled with the workspace's real `ChannelConnection`
 *   rows, and filters derived on top of the effective channel views (channel
 *   filters exist only for channels the channel resolution surfaces).
 *
 * Vertical layer precedence (both slices): the DB `Vertical.defaultConfig`
 * inbox slice when the row carries one (admin edits win), otherwise the
 * in-code pack via `resolveWorkspaceExperience()`. The pack fallback matters
 * for environments whose Vertical row was seeded before packs declared an
 * inbox block. Vertical filter DEFINITIONS always come from the in-code pack
 * (typed code data) — neither the DB row nor workspace config can introduce
 * new filter rules, only reference known ids.
 *
 * NOTE: we deliberately do NOT read `resolvedConfig` from
 * `getWorkspaceWithResolvedConfig` for these slices — `mergeConfigs`
 * replaces top-level keys wholesale beyond `modules`/`ui`, so a workspace
 * overriding only `inbox.channels.order` would lose the vertical's `enabled`
 * list. The pure resolvers layer per field instead.
 *
 * Response: `{ channels, defaultChannel, filters, defaultFilter }`.
 * The raw `Workspace.config` blob never leaves this endpoint.
 */
export async function GET() {
  try {
    const { workspaceId } = await requireReadAccess()

    const ws = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { config: true, verticalKey: true },
    })

    let verticalChannelsLayer: InboxChannelsConfigInput | null = null
    let verticalFiltersLayer: InboxFiltersConfigInput | null = null
    const experience = resolveWorkspaceExperience(ws?.verticalKey ?? null)
    if (ws?.verticalKey) {
      const vertical = await getVerticalByKey(ws.verticalKey)
      if (vertical?.defaultConfig) {
        try {
          const parsed = JSON.parse(vertical.defaultConfig)
          verticalChannelsLayer = extractInboxChannelsSlice(parsed)
          verticalFiltersLayer = extractInboxFiltersSlice(parsed)
        } catch {
          verticalChannelsLayer = null
          verticalFiltersLayer = null
        }
      }
      if (!verticalChannelsLayer || Object.keys(verticalChannelsLayer).length === 0) {
        verticalChannelsLayer = experience.inboxChannels
      }
      if (!verticalFiltersLayer || Object.keys(verticalFiltersLayer).length === 0) {
        verticalFiltersLayer = experience.inboxFilters
      }
    }

    const config = resolveInboxChannelsConfig(
      verticalChannelsLayer,
      parseWorkspaceInboxChannels(ws?.config),
    )

    const connections = await db.channelConnection.findMany({
      where: { workspaceId, status: "active" },
      select: { channelType: true },
    })

    const channels = resolveInboxChannelViews({
      config,
      connectedChannelIds: connections.map((c) => c.channelType),
    })

    const filters = resolveInboxFilterViews(
      resolveInboxFiltersConfig({
        channelViews: channels,
        verticalDefinitions: experience.inboxFilterDefinitions,
        layers: [verticalFiltersLayer, parseWorkspaceInboxFilters(ws?.config)],
      }),
    )

    return successResponse({
      channels,
      defaultChannel: config.defaultChannel,
      filters,
      defaultFilter: filters.find((f) => f.isDefault)?.id ?? "all",
    })
  } catch (error) {
    return handleError(error, "inbox channels")
  }
}

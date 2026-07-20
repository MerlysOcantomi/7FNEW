import { successResponse, handleError } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { db } from "@core/db"
import { getVerticalByKey } from "@core/verticals"
import { parseJsonConfig } from "@core/verticals"
import { resolveWorkspaceExperience } from "@core/vertical-packs/experience"
import { resolveWorkspacePlan } from "@core/system/plans"
import {
  extractInboxChannelsSlice,
  parseWorkspaceInboxChannels,
  resolveInboxChannelsConfig,
  type InboxChannelsConfigInput,
} from "@core/inbox/channel-config"
import {
  countConnectedChannels,
  getWebChatActivation,
  resolveChannelSetupViews,
  type ChannelConnectionSummary,
} from "@core/inbox/channel-setup"

/**
 * GET /api/workspace/channels — the Business Profile → Channels setup view
 * for the active workspace.
 *
 * Configuration surface, NOT an Inbox surface: it answers "which channels
 * does this business have, in what setup state, with which identity" —
 * conversations/threads never appear here (that's `/api/inbox/*`).
 *
 * Resolution mirrors `app/api/inbox/channels/route.ts` for the config layers
 * (core → vertical DB row or in-code pack → workspace overrides), then feeds
 * the pure setup model with the SAFE projection of the workspace's
 * `ChannelConnection` rows. `credentials`, `config` and `syncState` are
 * never selected — they must not travel past this layer.
 *
 * Multi-tenant isolation: the workspace comes exclusively from
 * `requireReadAccess()` (session cookie); every query is scoped to that
 * workspaceId. No client-provided ids are honored.
 */
export async function GET() {
  try {
    const { workspaceId } = await requireReadAccess()

    const ws = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { nombre: true, config: true, verticalKey: true, plan: true },
    })

    let verticalChannelsLayer: InboxChannelsConfigInput | null = null
    const experience = resolveWorkspaceExperience(ws?.verticalKey ?? null)
    if (ws?.verticalKey) {
      const vertical = await getVerticalByKey(ws.verticalKey)
      if (vertical?.defaultConfig) {
        try {
          verticalChannelsLayer = extractInboxChannelsSlice(JSON.parse(vertical.defaultConfig))
        } catch {
          verticalChannelsLayer = null
        }
      }
      if (!verticalChannelsLayer || Object.keys(verticalChannelsLayer).length === 0) {
        verticalChannelsLayer = experience.inboxChannels
      }
    }

    const config = resolveInboxChannelsConfig(
      verticalChannelsLayer,
      parseWorkspaceInboxChannels(ws?.config),
    )

    const rows = await db.channelConnection.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: {
        channelType: true,
        provider: true,
        name: true,
        status: true,
        externalAccountId: true,
        isDefault: true,
        lastSyncAt: true,
        lastError: true,
      },
    })
    const connections: ChannelConnectionSummary[] = rows.map((row) => ({
      channelType: row.channelType,
      provider: row.provider,
      name: row.name,
      status: row.status,
      externalAccountId: row.externalAccountId,
      isDefault: row.isDefault,
      lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toISOString() : null,
      lastError: row.lastError,
    }))

    const parsedConfig = parseJsonConfig(ws?.config)
    const businessDisplayName =
      parsedConfig.businessProfile?.businessName || ws?.nombre || null

    const plan = resolveWorkspacePlan({ plan: ws?.plan })

    const channels = resolveChannelSetupViews({
      config,
      connections,
      // Explicit per-workspace signal only — the public endpoint existing is
      // not an installation (BUSINESS-PROFILE-CHANNELS-03B §3).
      webChatActivation: getWebChatActivation(ws?.config),
      businessDisplayName,
      planMaxChannels: plan.limits.maxChannels,
    })

    return successResponse({
      channels,
      // Observational plan context (core/system/plans.ts does not enforce).
      // `connectedChannels` counts DISTINCT channels with an active
      // connection — several email mailboxes are still one channel.
      plan: {
        key: plan.planKey,
        label: plan.label,
        maxChannels: plan.limits.maxChannels,
        connectedChannels: countConnectedChannels(connections),
      },
    })
  } catch (error) {
    return handleError(error, "workspace channels")
  }
}

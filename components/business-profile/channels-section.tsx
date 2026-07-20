"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronDown, Loader2 } from "lucide-react"
import {
  channelSetupGroup,
  type ChannelSetupAction,
  type ChannelSetupActionId,
  type ChannelSetupGroup,
  type ChannelSetupStatus,
  type ChannelSetupView,
} from "@core/inbox/channel-setup"
import { formatDateTime } from "@core/i18n/format"
import { channelLabel } from "@/lib/inbox-labels"
import { useI18n } from "@/components/i18n-provider"
import { ICON_BY_TOKEN } from "@/components/inbox/conversation-channel-badge"
import { cn } from "@/lib/utils"

/**
 * Business Profile → Channels (BUSINESS-PROFILE-CHANNELS-03).
 *
 * CONFIGURATION surface only: setup state, identity and real next actions
 * per channel. Conversations, threads and composers belong to the Inbox and
 * must never appear here.
 *
 * Layout: three groups (connected / actionable / future) rendered as
 * single-column disclosure lists — the same structure works from 320px to
 * desktop, so there is no table/breakpoint fork. One channel expands at a
 * time; collapsed rows show only name + identity/short description + status
 * so small screens never show every detail at once.
 *
 * Honesty rules (mirroring the pure model): actions arrive from the API —
 * this component never invents one, and channels without a real flow render
 * with no buttons.
 */

interface ChannelsPayload {
  channels: ChannelSetupView[]
  webChatReceptionEnabled: boolean
  plan: {
    key: string
    label: string
    maxChannels: number | null
    activeConnections: number
  }
}

/** Destination map for link-type actions — real routes only. */
const ACTION_HREFS: Partial<Record<ChannelSetupActionId, string>> = {
  connect_email: "/administracion/canales",
  manage_email_connections: "/administracion/canales",
  review_email_connection: "/administracion/canales",
  open_inbox: "/inbox",
}

const STATUS_DOT: Record<ChannelSetupStatus, string> = {
  connected: "bg-green-500",
  available: "bg-foreground/60",
  setup_required: "bg-amber-500",
  pending: "bg-amber-500",
  error: "bg-red-500",
  plan_locked: "bg-muted-foreground/50",
  coming_soon: "bg-muted-foreground/50",
  disabled: "bg-muted-foreground/50",
}

const STATUS_TEXT: Record<ChannelSetupStatus, string> = {
  connected: "text-green-600 dark:text-green-400",
  available: "text-foreground",
  setup_required: "text-amber-600 dark:text-amber-400",
  pending: "text-amber-600 dark:text-amber-400",
  error: "text-red-500",
  plan_locked: "text-muted-foreground",
  coming_soon: "text-muted-foreground",
  disabled: "text-muted-foreground",
}

const GROUP_ORDER: ChannelSetupGroup[] = ["connected", "actionable", "future"]

export function ChannelsSection() {
  const { t, locale } = useI18n()
  const copy = t.settings.businessProfileChannelsPage

  const [data, setData] = useState<ChannelsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [togglePending, setTogglePending] = useState(false)
  const [toggleError, setToggleError] = useState(false)

  const fetchChannels = useCallback(async () => {
    setLoading(true)
    setLoadFailed(false)
    try {
      const res = await fetch("/api/workspace/channels")
      if (!res.ok) throw new Error("failed")
      const body = await res.json()
      setData((body.data ?? body) as ChannelsPayload)
    } catch {
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChannels()
  }, [fetchChannels])

  const setWebChatReception = useCallback(
    async (enabled: boolean) => {
      setTogglePending(true)
      setToggleError(false)
      try {
        const res = await fetch("/api/workspace/channels/web-chat", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        })
        if (!res.ok) throw new Error("failed")
        await fetchChannels()
      } catch {
        setToggleError(true)
      } finally {
        setTogglePending(false)
      }
    },
    [fetchChannels],
  )

  const groups = useMemo(() => {
    const map: Record<ChannelSetupGroup, ChannelSetupView[]> = {
      connected: [],
      actionable: [],
      future: [],
    }
    for (const view of data?.channels ?? []) {
      map[channelSetupGroup(view.status)].push(view)
    }
    return map
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span className="text-sm">{copy.loading}</span>
      </div>
    )
  }

  if (loadFailed || !data) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-red-500" role="alert">
          {copy.loadError}
        </p>
        <button
          type="button"
          onClick={fetchChannels}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
        >
          {copy.retry}
        </button>
      </div>
    )
  }

  const planNote =
    data.plan.maxChannels !== null
      ? copy.planNote(data.plan.activeConnections, data.plan.maxChannels)
      : null

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {planNote && <p className="text-xs text-muted-foreground -mt-4">{planNote}</p>}

      {GROUP_ORDER.map((group) => {
        const views = groups[group]
        if (views.length === 0) return null
        const groupCopy = copy.groups[group]
        return (
          <section key={group} aria-labelledby={`channels-group-${group}`}>
            <h2
              id={`channels-group-${group}`}
              className="text-sm font-semibold text-foreground"
            >
              {groupCopy.title}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {groupCopy.description}
            </p>
            <ul className="mt-3 rounded-xl border border-border bg-card divide-y divide-border">
              {views.map((view) => (
                <ChannelRow
                  key={view.id}
                  view={view}
                  locale={locale}
                  copy={copy}
                  expanded={expandedId === view.id}
                  onToggleExpanded={() =>
                    setExpandedId((current) => (current === view.id ? null : view.id))
                  }
                  togglePending={togglePending}
                  toggleError={toggleError}
                  onSetWebChatReception={setWebChatReception}
                />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

type ChannelsCopy = ReturnType<typeof useI18n>["t"]["settings"]["businessProfileChannelsPage"]

function ChannelRow({
  view,
  locale,
  copy,
  expanded,
  onToggleExpanded,
  togglePending,
  toggleError,
  onSetWebChatReception,
}: {
  view: ChannelSetupView
  locale: string
  copy: ChannelsCopy
  expanded: boolean
  onToggleExpanded: () => void
  togglePending: boolean
  toggleError: boolean
  onSetWebChatReception: (enabled: boolean) => void
}) {
  const Icon = ICON_BY_TOKEN[view.iconToken]
  const label = channelLabel(view.id, locale)
  const description = copy.channelDescriptions[view.id as keyof ChannelsCopy["channelDescriptions"]]
  // Collapsed subtitle: the real identity when one exists, else what the
  // channel is for. Never both — small screens show one line only.
  const subtitle = view.identity?.address ?? view.identity?.name ?? description
  const detailsId = `channel-details-${view.id}`
  const live = view.status === "connected"

  return (
    <li>
      <button
        type="button"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        aria-controls={detailsId}
        aria-label={expanded ? copy.hideDetails(label) : copy.showDetails(label)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-accent/50 transition-colors min-h-[3.5rem]"
      >
        <Icon className="h-4.5 w-4.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{label}</span>
            {view.recommended && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {copy.recommendedBadge}
              </span>
            )}
          </span>
          <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
        </span>
        <StatusBadge status={view.status} copy={copy} />
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      <div id={detailsId} hidden={!expanded} className="border-t border-border/60 bg-muted/20">
        {expanded && (
          <div className="flex flex-col gap-3 px-4 py-4">
            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>

            {view.identity && (view.identity.name || view.identity.address) && (
              <div className="text-xs">
                <span className="font-medium text-foreground">
                  {view.id === "web_chat" ? copy.webChat.visitorNameLabel : copy.identityLabel}
                </span>
                <span className="text-muted-foreground">
                  {" — "}
                  {[view.identity.name, view.identity.address].filter(Boolean).join(" · ")}
                </span>
              </div>
            )}

            {live && (view.canReceive || view.canSend) && (
              <div className="flex flex-wrap gap-1.5">
                {view.canReceive && <CapabilityChip label={copy.receiving} />}
                {view.canSend && <CapabilityChip label={copy.sending} />}
              </div>
            )}

            {view.activeConnectionCount > 1 && (
              <p className="text-xs text-muted-foreground">
                {copy.activeConnections(view.activeConnectionCount)}
              </p>
            )}

            {view.lastSyncAt && (
              <p className="text-xs text-muted-foreground">
                {copy.lastSync(formatDateTime(view.lastSyncAt, { locale: locale as never }))}
              </p>
            )}

            {view.status === "error" && view.lastError && (
              <p className="text-xs text-red-500" role="alert">
                {copy.errorLabel}: {view.lastError}
              </p>
            )}

            {view.id === "web_chat" && live && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {copy.webChat.inboxNote}
              </p>
            )}

            {view.status === "plan_locked" && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {copy.planLockedHint}
              </p>
            )}
            {view.status === "coming_soon" && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {copy.comingSoonHint}
              </p>
            )}

            {toggleError && view.id === "web_chat" && (
              <p className="text-xs text-red-500" role="alert">
                {copy.webChat.updateError}
              </p>
            )}

            {view.actions.length > 0 && (
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                {view.actions.map((action) => (
                  <ChannelAction
                    key={action.id}
                    action={action}
                    copy={copy}
                    pending={togglePending}
                    onSetWebChatReception={onSetWebChatReception}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

function StatusBadge({ status, copy }: { status: ChannelSetupStatus; copy: ChannelsCopy }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-xs font-medium",
        STATUS_TEXT[status],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} aria-hidden="true" />
      {copy.status[status]}
    </span>
  )
}

function CapabilityChip({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
      {label}
    </span>
  )
}

function ChannelAction({
  action,
  copy,
  pending,
  onSetWebChatReception,
}: {
  action: ChannelSetupAction
  copy: ChannelsCopy
  pending: boolean
  onSetWebChatReception: (enabled: boolean) => void
}) {
  const label = copy.actions[action.id]
  const className = cn(
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors",
    action.emphasis === "primary"
      ? "bg-foreground text-background hover:opacity-90"
      : "border border-border bg-card text-foreground hover:bg-accent",
    pending && "opacity-50 pointer-events-none",
  )

  const href = ACTION_HREFS[action.id]
  if (href) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    )
  }

  if (
    action.id === "enable_web_chat_reception" ||
    action.id === "disable_web_chat_reception"
  ) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => onSetWebChatReception(action.id === "enable_web_chat_reception")}
        className={className}
      >
        {pending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
        {label}
      </button>
    )
  }

  // Unknown action id: render nothing rather than a dead control.
  return null
}

"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Columns3,
  Inbox as InboxIcon,
  Loader2,
  Maximize2,
  PauseCircle,
  Sparkles,
} from "lucide-react"
import { useFetch } from "@/hooks/use-fetch"
import { ConversationChannelBadge } from "@/components/inbox/conversation-channel-badge"
import {
  channelLabel,
  formatRelativeDateCompact,
  statusLabelDisplay,
  urgencyBadge,
  urgencyLabel,
} from "@/lib/inbox-labels"
import type { TodayPayload, TodayItem } from "@modules/today/types"
import { cn } from "@/lib/utils"

/**
 * Smart Inbox — Daily Overview (PR3 foundation).
 *
 * This is the first operational page the operator sees when they open the Inbox app: a
 * short, warm Fanny briefing built from REAL, workspace-scoped counts, plus a few "act here
 * next" blocks that link into the Inbox and Today. It is deliberately NOT a KPI dashboard
 * and it does NOT own any data — every block reads an existing endpoint and degrades to a
 * calm empty state. Today remains the execution surface; "Ready in Today" is a small preview
 * that links to `/today` and never duplicates the Today list logic.
 *
 * Data sources (all already multi-tenant scoped server-side):
 *  - `/api/auth/me`              → operator name for the greeting (raw fetch; not the
 *                                  success-envelope shape `useFetch` expects).
 *  - `/api/inbox/conversations`  → active working set (channel activity, needs-action,
 *                                  Fanny proposals) + a waiting slice.
 *  - `/api/today?tz=`            → confirmed Today work for the "Ready in Today" preview.
 *
 * Known v1 caps (documented, honest): the derived channel/needs-action/proposal blocks read
 * the first page of the working set (pageSize=50), so on very large inboxes they reflect the
 * most recent slice rather than a full-workspace aggregate. No fake numbers are ever shown.
 */

const ACTIVE_WORKING_STATUSES = "new,triaged,assigned,awaiting_response,lead_detected"
const WORKING_SET_PAGE_SIZE = 50
const SECTION_PREVIEW_CAP = 5

interface OverviewConversation {
  id: string
  channel: string
  status: string
  subject: string | null
  summary: string | null
  intent: string | null
  urgency: string
  contact: { nombre: string | null; email: string | null; empresa: string | null }
  lastMessageAt: string
  messageCount: number
  proposedTaskCount?: number
}

type Locale = "en" | "es" | "de"

function resolveLocale(raw: unknown): Locale {
  return raw === "es" || raw === "de" ? raw : "en"
}

// ─── Copy (locale-aware, honest templated text — no LLM narrative in v1) ─────

const COPY: Record<Locale, {
  greetingMorning: string
  greetingAfternoon: string
  greetingEvening: string
  briefingTitle: string
  channelActivity: string
  channelActivityCaption: string
  needsAction: string
  needsActionCaption: string
  proposedByFanny: string
  proposedByFannyCaption: string
  readyInToday: string
  readyInTodayCaption: string
  waiting: string
  waitingCaption: string
  openInboxAs: string
  openInboxAsCaption: string
  triage: string
  triageDesc: string
  reading: string
  readingDesc: string
  focus: string
  focusDesc: string
  reviewInInbox: string
  viewAllInToday: string
  openInbox: string
  nothingUrgent: string
  noProposals: string
  noWaiting: string
  noChannels: string
  noReady: string
  allCalm: string
  loadError: string
}> = {
  en: {
    greetingMorning: "Good morning",
    greetingAfternoon: "Good afternoon",
    greetingEvening: "Good evening",
    briefingTitle: "Fanny briefing",
    channelActivity: "Channel activity",
    channelActivityCaption: "Active conversations by channel",
    needsAction: "Needs action",
    needsActionCaption: "Urgent or new conversations to look at first",
    proposedByFanny: "Proposed by Fanny",
    proposedByFannyCaption: "Suggestions waiting for your review in the Inbox",
    readyInToday: "Ready in Today",
    readyInTodayCaption: "Confirmed work already on your Today board",
    waiting: "Waiting / Follow-ups",
    waitingCaption: "Conversations awaiting a response",
    openInboxAs: "Open Inbox as",
    openInboxAsCaption: "Pick how you want to work through the Inbox",
    triage: "Brief",
    triageDesc: "See who wrote, what matters, and what to do next.",
    reading: "Read",
    readingDesc: "Read the full message with AI context.",
    focus: "Handle",
    focusDesc: "Work through one conversation with AI beside you.",
    reviewInInbox: "Review in Inbox",
    viewAllInToday: "View all in Today",
    openInbox: "Open Inbox",
    nothingUrgent: "Nothing urgent right now — the radar is calm.",
    noProposals: "No Fanny proposals waiting. New suggestions will show up here.",
    noWaiting: "Nothing is waiting on a response.",
    noChannels: "No active conversations yet.",
    noReady: "No confirmed Inbox work on Today yet.",
    allCalm: "Your inbox is calm. Nothing needs attention right now.",
    loadError: "The overview could not be loaded.",
  },
  es: {
    greetingMorning: "Buenos días",
    greetingAfternoon: "Buenas tardes",
    greetingEvening: "Buenas noches",
    briefingTitle: "Resumen de Fanny",
    channelActivity: "Actividad por canal",
    channelActivityCaption: "Conversaciones activas por canal",
    needsAction: "Necesita atención",
    needsActionCaption: "Conversaciones urgentes o nuevas para revisar primero",
    proposedByFanny: "Propuesto por Fanny",
    proposedByFannyCaption: "Sugerencias esperando tu revisión en el Inbox",
    readyInToday: "Listo en Today",
    readyInTodayCaption: "Trabajo confirmado que ya está en tu tablero de Today",
    waiting: "En espera / Seguimientos",
    waitingCaption: "Conversaciones esperando respuesta",
    openInboxAs: "Abrir el Inbox como",
    openInboxAsCaption: "Elige cómo quieres trabajar el Inbox",
    triage: "Brief",
    triageDesc: "Ve quién escribió, qué importa y qué hacer a continuación.",
    reading: "Read",
    readingDesc: "Lee el mensaje completo con el contexto de la IA.",
    focus: "Handle",
    focusDesc: "Trabaja una conversación con la IA a tu lado.",
    reviewInInbox: "Revisar en el Inbox",
    viewAllInToday: "Ver todo en Today",
    openInbox: "Abrir Inbox",
    nothingUrgent: "Nada urgente ahora mismo — el radar está tranquilo.",
    noProposals: "No hay propuestas de Fanny pendientes. Las nuevas aparecerán aquí.",
    noWaiting: "Nada está esperando respuesta.",
    noChannels: "Aún no hay conversaciones activas.",
    noReady: "Aún no hay trabajo del Inbox confirmado en Today.",
    allCalm: "Tu inbox está tranquilo. Nada necesita atención ahora mismo.",
    loadError: "No se pudo cargar el resumen.",
  },
  de: {
    greetingMorning: "Guten Morgen",
    greetingAfternoon: "Guten Tag",
    greetingEvening: "Guten Abend",
    briefingTitle: "Fanny-Briefing",
    channelActivity: "Kanalaktivität",
    channelActivityCaption: "Aktive Konversationen nach Kanal",
    needsAction: "Braucht Aufmerksamkeit",
    needsActionCaption: "Dringende oder neue Konversationen zuerst ansehen",
    proposedByFanny: "Von Fanny vorgeschlagen",
    proposedByFannyCaption: "Vorschläge warten auf deine Prüfung im Posteingang",
    readyInToday: "Bereit in Today",
    readyInTodayCaption: "Bestätigte Arbeit, die bereits in Today liegt",
    waiting: "Wartend / Follow-ups",
    waitingCaption: "Konversationen, die auf eine Antwort warten",
    openInboxAs: "Posteingang öffnen als",
    openInboxAsCaption: "Wähle, wie du den Posteingang bearbeiten willst",
    triage: "Brief",
    triageDesc: "Sieh, wer geschrieben hat, was zählt und was als Nächstes zu tun ist.",
    reading: "Read",
    readingDesc: "Lies die vollständige Nachricht mit KI-Kontext.",
    focus: "Handle",
    focusDesc: "Bearbeite eine Konversation mit der KI an deiner Seite.",
    reviewInInbox: "Im Posteingang prüfen",
    viewAllInToday: "Alle in Today ansehen",
    openInbox: "Posteingang öffnen",
    nothingUrgent: "Gerade nichts Dringendes — der Radar ist ruhig.",
    noProposals: "Keine Fanny-Vorschläge offen. Neue erscheinen hier.",
    noWaiting: "Nichts wartet auf eine Antwort.",
    noChannels: "Noch keine aktiven Konversationen.",
    noReady: "Noch keine bestätigte Posteingang-Arbeit in Today.",
    allCalm: "Dein Posteingang ist ruhig. Im Moment ist nichts zu tun.",
    loadError: "Die Übersicht konnte nicht geladen werden.",
  },
}

function urgencyRank(urgency: string): number {
  switch (urgency) {
    case "critica":
      return 3
    case "alta":
      return 2
    case "media":
      return 1
    default:
      return 0
  }
}

function contactLabel(c: OverviewConversation["contact"]): string {
  return c.nombre?.trim() || c.empresa?.trim() || c.email?.trim() || "—"
}

function conversationLine(c: OverviewConversation): string {
  return c.intent?.trim() || c.summary?.trim() || c.subject?.trim() || ""
}

/** Build the templated, honest briefing sentence from real counts. */
function buildBriefing(
  locale: Locale,
  counts: { urgent: number; proposals: number; waiting: number; ready: number },
): string {
  const { urgent, proposals, waiting, ready } = counts
  if (urgent === 0 && proposals === 0 && waiting === 0 && ready === 0) {
    return COPY[locale].allCalm
  }
  const parts: string[] = []
  if (locale === "es") {
    if (urgent > 0) parts.push(`${urgent} ${urgent === 1 ? "conversación que necesita" : "conversaciones que necesitan"} atención`)
    if (proposals > 0) parts.push(`${proposals} ${proposals === 1 ? "propuesta de Fanny" : "propuestas de Fanny"} por revisar`)
    if (waiting > 0) parts.push(`${waiting} en espera de respuesta`)
    if (ready > 0) parts.push(`${ready} ${ready === 1 ? "tarea lista" : "tareas listas"} en Today`)
    return parts.length ? `Hay ${joinList(parts, "es")}.` : COPY[locale].allCalm
  }
  if (locale === "de") {
    if (urgent > 0) parts.push(`${urgent} ${urgent === 1 ? "Konversation braucht" : "Konversationen brauchen"} Aufmerksamkeit`)
    if (proposals > 0) parts.push(`${proposals} ${proposals === 1 ? "Fanny-Vorschlag" : "Fanny-Vorschläge"} zu prüfen`)
    if (waiting > 0) parts.push(`${waiting} warten auf Antwort`)
    if (ready > 0) parts.push(`${ready} ${ready === 1 ? "Aufgabe bereit" : "Aufgaben bereit"} in Today`)
    return parts.length ? `Es gibt ${joinList(parts, "de")}.` : COPY[locale].allCalm
  }
  if (urgent > 0) parts.push(`${urgent} ${urgent === 1 ? "conversation needs" : "conversations need"} attention`)
  if (proposals > 0) parts.push(`${proposals} Fanny ${proposals === 1 ? "proposal" : "proposals"} to review`)
  if (waiting > 0) parts.push(`${waiting} waiting on a response`)
  if (ready > 0) parts.push(`${ready} ${ready === 1 ? "task" : "tasks"} ready in Today`)
  return parts.length ? `There ${urgent === 1 && parts.length === 1 ? "is" : "are"} ${joinList(parts, "en")}.` : COPY[locale].allCalm
}

function joinList(parts: string[], locale: Locale): string {
  if (parts.length <= 1) return parts.join("")
  const and = locale === "es" ? "y" : locale === "de" ? "und" : "and"
  return `${parts.slice(0, -1).join(", ")} ${and} ${parts[parts.length - 1]}`
}

function greetingFor(locale: Locale, hour: number): string {
  if (hour < 12) return COPY[locale].greetingMorning
  if (hour < 19) return COPY[locale].greetingAfternoon
  return COPY[locale].greetingEvening
}

export function InboxOverview() {
  // Operator name — raw fetch because `/api/auth/me` does not use the success envelope.
  const [operatorName, setOperatorName] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return
        if (json?.authenticated && typeof json.user?.nombre === "string") {
          setOperatorName(json.user.nombre.trim() || null)
        }
      })
      .catch(() => null)
    return () => {
      alive = false
    }
  }, [])

  // Client clock — set after mount to avoid SSR/CSR hydration mismatch; refresh each minute.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Timezone for the Today preview (matches the Today page pattern).
  const [timezone, setTimezone] = useState<string | null>(null)
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      setTimezone(tz && typeof tz === "string" ? tz : "UTC")
    } catch {
      setTimezone("UTC")
    }
  }, [])

  const working = useFetch<OverviewConversation[]>(
    `/api/inbox/conversations?status=${encodeURIComponent(ACTIVE_WORKING_STATUSES)}&pageSize=${WORKING_SET_PAGE_SIZE}`,
  )
  const waitingSet = useFetch<OverviewConversation[]>(
    `/api/inbox/conversations?status=awaiting_response&pageSize=8`,
  )
  const today = useFetch<TodayPayload>(
    timezone ? `/api/today?tz=${encodeURIComponent(timezone)}` : null,
  )

  const locale = useMemo<Locale>(
    () => resolveLocale(working.meta?.locale),
    [working.meta?.locale],
  )
  const t = COPY[locale]

  const workingItems = useMemo(
    () => (Array.isArray(working.data) ? working.data : []),
    [working.data],
  )

  const channelActivity = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of workingItems) map.set(c.channel, (map.get(c.channel) ?? 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [workingItems])

  const needsAction = useMemo(() => {
    return workingItems
      .filter((c) => urgencyRank(c.urgency) >= 2 || c.status === "new")
      .sort((a, b) => {
        const r = urgencyRank(b.urgency) - urgencyRank(a.urgency)
        if (r !== 0) return r
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      })
      .slice(0, SECTION_PREVIEW_CAP)
  }, [workingItems])

  const proposals = useMemo(
    () =>
      workingItems
        .filter((c) => (c.proposedTaskCount ?? 0) > 0)
        .sort((a, b) => (b.proposedTaskCount ?? 0) - (a.proposedTaskCount ?? 0)),
    [workingItems],
  )
  const proposalsTotal = useMemo(
    () => proposals.reduce((sum, c) => sum + (c.proposedTaskCount ?? 0), 0),
    [proposals],
  )

  const waitingItems = useMemo(
    () => (Array.isArray(waitingSet.data) ? waitingSet.data : []),
    [waitingSet.data],
  )

  const readyInToday = useMemo<TodayItem[]>(() => {
    const buckets = today.data?.buckets
    if (!buckets) return []
    return [...buckets.overdue, ...buckets.today].filter(
      (i) => i.kind === "task" && !i.isProposed,
    )
  }, [today.data?.buckets])

  const urgentCount = typeof working.meta?.urgent === "number" ? (working.meta.urgent as number) : 0
  const waitingCount = typeof waitingSet.meta?.total === "number" ? (waitingSet.meta.total as number) : waitingItems.length

  const briefing = buildBriefing(locale, {
    urgent: urgentCount,
    proposals: proposalsTotal,
    waiting: waitingCount,
    ready: readyInToday.length,
  })

  const dateLabel =
    now?.toLocaleDateString(locale === "es" ? "es" : locale === "de" ? "de" : "en", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }) ?? ""
  const timeLabel =
    now?.toLocaleTimeString(locale === "es" ? "es" : locale === "de" ? "de" : "en", {
      hour: "2-digit",
      minute: "2-digit",
    }) ?? ""
  const greeting = greetingFor(locale, now?.getHours() ?? 9)

  if (working.loading && workingItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-24" role="status" aria-label="Loading overview">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-secondary-light)]" />
      </div>
    )
  }

  if (working.error && workingItems.length === 0) {
    return (
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" strokeWidth={1.5} />
        <p className="text-sm font-medium text-destructive">{working.error}</p>
        <p className="mt-1 text-xs text-destructive/80">{t.loadError}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Daily header ── */}
      <header className="rounded-2xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)]/40 p-6">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-[var(--text-secondary-light)]">
          <span suppressHydrationWarning>{dateLabel}</span>
          {timeLabel ? (
            <>
              <span aria-hidden="true">·</span>
              <span suppressHydrationWarning className="tabular-nums">{timeLabel}</span>
            </>
          ) : null}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-primary-light)]">
          {greeting}
          {operatorName ? `, ${operatorName}` : ""}.
        </h1>
        {/*
         * Weather is intentionally omitted: there is no workspace/user location or weather
         * provider wired today, and faking it is off-limits. The header simply leaves room —
         * a future PR can drop a gated weather nudge here when a provider exists.
         */}

        {/* ── Fanny briefing ── */}
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--accent-primary)]/20 bg-[var(--accent-primary)]/[0.06] p-4">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
          >
            <Sparkles size={16} strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--accent-primary)]">
              {t.briefingTitle}
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-[var(--text-primary-light)]">{briefing}</p>
          </div>
        </div>
      </header>

      {/* ── Channel activity ── */}
      <OverviewSection title={t.channelActivity} caption={t.channelActivityCaption} count={workingItems.length}>
        {channelActivity.length === 0 ? (
          <CalmEmpty text={t.noChannels} />
        ) : (
          <div className="flex flex-wrap gap-2">
            {channelActivity.map(([channel, count]) => (
              <div
                key={channel}
                className="flex items-center gap-2 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-3 py-2"
              >
                <ConversationChannelBadge channel={channel} label={channelLabel(channel, locale)} />
                <span className="text-sm font-semibold tabular-nums text-[var(--text-primary-light)]">{count}</span>
              </div>
            ))}
          </div>
        )}
      </OverviewSection>

      {/* ── Needs action ── */}
      <OverviewSection
        title={t.needsAction}
        caption={t.needsActionCaption}
        count={needsAction.length}
        tone="warning"
      >
        {needsAction.length === 0 ? (
          <CalmEmpty text={t.nothingUrgent} icon={<CheckCircle2 size={16} strokeWidth={1.8} aria-hidden="true" />} />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {needsAction.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/inbox?id=${encodeURIComponent(c.id)}`}
                  className="group flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-3 py-2.5 transition-colors hover:border-[var(--accent-primary)]/40 hover:bg-[var(--accent-primary)]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40"
                >
                  <ConversationChannelBadge channel={c.channel} label={channelLabel(c.channel, locale)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium text-[var(--text-primary-light)]">
                        {contactLabel(c.contact)}
                      </span>
                      {urgencyRank(c.urgency) >= 2 ? (
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                            urgencyBadge(c.urgency) === "urgency-critical"
                              ? "border border-[rgba(232,111,116,0.32)] bg-[rgba(232,111,116,0.12)] text-[var(--status-danger-text)]"
                              : "border border-[var(--status-warning-text)]/30 bg-[var(--status-warning-bg)]/50 text-[var(--status-warning-text)]",
                          )}
                        >
                          {urgencyLabel(c.urgency, locale)}
                        </span>
                      ) : null}
                    </div>
                    {conversationLine(c) ? (
                      <p className="truncate text-xs text-[var(--text-secondary-light)]">{conversationLine(c)}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[10px] tabular-nums text-[var(--text-secondary-light)]/80">
                    {formatRelativeDateCompact(c.lastMessageAt, locale)}
                  </span>
                  <ArrowUpRight
                    size={14}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="shrink-0 text-[var(--text-secondary-light)]/50 transition-colors group-hover:text-[var(--accent-primary)]"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </OverviewSection>

      {/* ── Proposed by Fanny ── */}
      <OverviewSection
        title={t.proposedByFanny}
        caption={t.proposedByFannyCaption}
        count={proposalsTotal}
        tone="ai"
        action={
          proposals.length > 0
            ? { href: "/inbox", label: t.reviewInInbox }
            : undefined
        }
      >
        {proposals.length === 0 ? (
          <CalmEmpty text={t.noProposals} />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {proposals.slice(0, SECTION_PREVIEW_CAP).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/inbox?id=${encodeURIComponent(c.id)}`}
                  className="group flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-3 py-2.5 transition-colors hover:border-[var(--accent-primary)]/40 hover:bg-[var(--accent-primary)]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[linear-gradient(135deg,rgba(47,128,237,0.18),rgba(139,92,246,0.18),rgba(236,72,153,0.18))] text-[var(--text-primary-light)]"
                  >
                    <Sparkles size={13} strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="truncate text-sm font-medium text-[var(--text-primary-light)]">
                      {contactLabel(c.contact)}
                    </span>
                    {conversationLine(c) ? (
                      <p className="truncate text-xs text-[var(--text-secondary-light)]">{conversationLine(c)}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-md border border-[var(--border-dark)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--text-secondary-light)]">
                    {c.proposedTaskCount}
                  </span>
                  <ArrowUpRight
                    size={14}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="shrink-0 text-[var(--text-secondary-light)]/50 transition-colors group-hover:text-[var(--accent-primary)]"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </OverviewSection>

      {/* ── Ready in Today ── */}
      <OverviewSection
        title={t.readyInToday}
        caption={t.readyInTodayCaption}
        count={readyInToday.length}
        action={{ href: "/today", label: t.viewAllInToday }}
      >
        {today.loading ? (
          <CalmEmpty text="…" />
        ) : readyInToday.length === 0 ? (
          <CalmEmpty text={t.noReady} />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {readyInToday.slice(0, SECTION_PREVIEW_CAP).map((item) => (
              <li key={item.id}>
                <Link
                  href={item.source.href || "/today"}
                  className="group flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-3 py-2.5 transition-colors hover:border-[var(--accent-primary)]/40 hover:bg-[var(--accent-primary)]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-[var(--text-primary-light)]"
                  >
                    <CheckCircle2 size={13} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-primary-light)]">
                    {item.title}
                  </span>
                  <ArrowUpRight
                    size={14}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="shrink-0 text-[var(--text-secondary-light)]/50 transition-colors group-hover:text-[var(--accent-primary)]"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </OverviewSection>

      {/* ── Waiting / Follow-ups ── */}
      <OverviewSection
        title={t.waiting}
        caption={t.waitingCaption}
        count={waitingCount}
        tone="warning"
      >
        {waitingItems.length === 0 ? (
          <CalmEmpty text={t.noWaiting} icon={<PauseCircle size={16} strokeWidth={1.8} aria-hidden="true" />} />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {waitingItems.slice(0, SECTION_PREVIEW_CAP).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/inbox?id=${encodeURIComponent(c.id)}`}
                  className="group flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-3 py-2.5 transition-colors hover:border-[var(--accent-primary)]/40 hover:bg-[var(--accent-primary)]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40"
                >
                  <ConversationChannelBadge channel={c.channel} label={channelLabel(c.channel, locale)} />
                  <div className="min-w-0 flex-1">
                    <span className="truncate text-sm font-medium text-[var(--text-primary-light)]">
                      {contactLabel(c.contact)}
                    </span>
                    {conversationLine(c) ? (
                      <p className="truncate text-xs text-[var(--text-secondary-light)]">{conversationLine(c)}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-md border border-[var(--border-dark)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary-light)]">
                    {statusLabelDisplay(c.status, locale)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </OverviewSection>

      {/* ── Open Inbox as ── */}
      <section aria-label={t.openInboxAs} className="rounded-2xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)]/40 p-5">
        <div className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
          >
            <InboxIcon size={13} strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary-light)]">{t.openInboxAs}</h2>
            <p className="text-[11px] leading-snug text-[var(--text-secondary-light)]">{t.openInboxAsCaption}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <OpenInboxCard href="/inbox?layout=triage" title={t.triage} desc={t.triageDesc} icon={<Sparkles size={16} strokeWidth={1.9} />} />
          <OpenInboxCard href="/inbox?layout=reading" title={t.reading} desc={t.readingDesc} icon={<Columns3 size={16} strokeWidth={1.9} />} />
          <OpenInboxCard href="/inbox?layout=focus" title={t.focus} desc={t.focusDesc} icon={<Maximize2 size={16} strokeWidth={1.9} />} />
        </div>
      </section>
    </div>
  )
}

// ─── Building blocks ─────────────────────────────────────────────────────────

function OverviewSection({
  title,
  caption,
  count,
  tone = "default",
  action,
  children,
}: {
  title: string
  caption: string
  count: number
  tone?: "default" | "warning" | "ai"
  action?: { href: string; label: string }
  children: React.ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)]/40 p-5"
    >
      {tone === "ai" ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(135deg,#2f80ed,#8b5cf6,#ec4899)]"
        />
      ) : null}
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[var(--text-primary-light)]">
            {title}
            <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--text-secondary-light)]">
              {count}
            </span>
          </h2>
          <p className="text-[11px] leading-snug text-[var(--text-secondary-light)]">{caption}</p>
        </div>
        {action ? (
          <Link
            href={action.href}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--accent-primary)]/30 px-2 py-1 text-[11px] font-medium text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40"
          >
            {action.label}
            <ArrowRight size={11} strokeWidth={2} className="shrink-0" aria-hidden="true" />
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  )
}

function CalmEmpty({ text, icon }: { text: string; icon?: React.ReactNode }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-4 py-5 text-[var(--text-secondary-light)]"
    >
      {icon ? <span aria-hidden="true" className="shrink-0">{icon}</span> : null}
      <p className="text-xs leading-relaxed">{text}</p>
    </div>
  )
}

function OpenInboxCard({
  href,
  title,
  desc,
  icon,
}: {
  href: string
  title: string
  desc: string
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 transition-colors hover:border-[var(--accent-primary)]/40 hover:bg-[var(--accent-primary)]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40"
    >
      <span
        aria-hidden="true"
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
      >
        {icon}
      </span>
      <span className="flex items-center gap-1 text-sm font-semibold text-[var(--text-primary-light)]">
        {title}
        <ArrowUpRight
          size={13}
          strokeWidth={2}
          aria-hidden="true"
          className="text-[var(--text-secondary-light)]/50 transition-colors group-hover:text-[var(--accent-primary)]"
        />
      </span>
      <span className="text-[11px] leading-snug text-[var(--text-secondary-light)]">{desc}</span>
    </Link>
  )
}

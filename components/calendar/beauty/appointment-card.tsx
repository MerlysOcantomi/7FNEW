"use client"

import { AlertTriangle, Clock, UserRound } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { toIntlLocale } from "@core/i18n/format"
import { cn } from "@/lib/utils"
import type { AppointmentPhase, BeautyAppointment } from "./appointment-model"

export function fmtTime(d: Date, intlLocale: string): string {
  return d.toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" })
}

/** Phase tone — never color-only: every use pairs it with the phase label text. */
const PHASE_TONE: Record<AppointmentPhase, string> = {
  upcoming: "text-[var(--accent-primary)]",
  current: "text-[var(--status-success-text,var(--accent-primary))]",
  past: "text-muted-foreground",
}

export function AppointmentPhaseBadge({ phase }: { phase: AppointmentPhase }) {
  const { t } = useI18n()
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium",
        PHASE_TONE[phase],
      )}
    >
      {t.appointments.phase[phase]}
    </span>
  )
}

/**
 * One appointment, rendered as a real, keyboard-focusable button. Shows only
 * data that exists on `Evento` — time, client, service (title), duration, the
 * time-derived phase and the shared conflict flag. No price, no fabricated
 * status.
 */
export function AppointmentCard({
  appointment,
  onOpen,
  dense = false,
}: {
  appointment: BeautyAppointment
  onOpen: (id: string) => void
  dense?: boolean
}) {
  const { t, locale } = useI18n()
  const a = t.appointments
  const intlLocale = toIntlLocale(locale)
  const timeRange = `${fmtTime(appointment.start, intlLocale)}${
    appointment.end ? ` – ${fmtTime(appointment.end, intlLocale)}` : ""
  }`

  return (
    <button
      type="button"
      onClick={() => onOpen(appointment.id)}
      aria-label={a.aria.openAppointment(appointment.title)}
      className={cn(
        "group flex w-full flex-col gap-0.5 rounded-lg border border-border bg-card px-2.5 text-left transition-colors hover:border-[var(--accent-muted-border)] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        dense ? "py-1" : "py-1.5",
        appointment.conflict && "border-[var(--status-danger-text)]/50",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Clock className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        <span className="font-mono text-[11px] tabular-nums text-foreground">{timeRange}</span>
        {appointment.conflict && (
          <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-medium text-[var(--status-danger-text)]">
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {a.conflict}
          </span>
        )}
      </div>
      <span className="truncate text-[12px] font-semibold text-foreground">{appointment.title}</span>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        {appointment.clientName ? (
          <span className="inline-flex min-w-0 items-center gap-1">
            <UserRound className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{appointment.clientName}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 italic">
            <UserRound className="h-3 w-3 shrink-0" aria-hidden />
            {a.detail.noClient}
          </span>
        )}
        {appointment.durationMinutes !== null && (
          <span className="shrink-0">· {a.durationLabel(appointment.durationMinutes)}</span>
        )}
        <span className="ml-auto shrink-0">
          <AppointmentPhaseBadge phase={appointment.phase} />
        </span>
      </div>
    </button>
  )
}

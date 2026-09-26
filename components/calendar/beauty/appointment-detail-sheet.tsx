"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CircleCheckBig,
  Clock,
  ExternalLink,
  Pencil,
  Timer,
  Trash2,
  UserCheck,
  UserRound,
  UserX,
  WalletCards,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ConfirmModal } from "@/components/confirm-modal"
import { useI18n } from "@/components/i18n-provider"
import { useToast } from "@/components/toast-provider"
import { formatDate, toIntlLocale } from "@core/i18n/format"
import {
  AppointmentLifecycleBadge,
  AppointmentPhaseBadge,
  fmtTime,
} from "./appointment-card"
import type {
  AppointmentLifecycleStatus,
  BeautyAppointment,
} from "./appointment-model"
import {
  cancelAppointment,
  fetchAppointment,
  updateAppointment,
  type FullAppointment,
} from "./appointment-api"
import { isoToLocalParts } from "./datetime"
import type { AppointmentFormSeed } from "./appointment-form-dialog"

export function AppointmentDetailSheet({
  appointment,
  onClose,
  onEdit,
  onReschedule,
  onCancelled,
}: {
  appointment: BeautyAppointment | null
  onClose: () => void
  onEdit: (seed: AppointmentFormSeed) => void
  onReschedule: (seed: AppointmentFormSeed) => void
  /** Historical prop name: used for every persisted lifecycle change/refetch. */
  onCancelled: () => void
}) {
  const { t, locale } = useI18n()
  const a = t.appointments
  const intlLocale = toIntlLocale(locale)
  const { addToast } = useToast()
  const [full, setFull] = useState<FullAppointment | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)

  const open = appointment !== null
  const status = full?.appointmentStatus ?? appointment?.lifecycleStatus ?? null

  useEffect(() => {
    if (!appointment) {
      setFull(null)
      return
    }
    let active = true
    fetchAppointment(appointment.id).then((record) => {
      if (active) setFull(record)
    })
    return () => {
      active = false
    }
  }, [appointment])

  function buildSeed(): AppointmentFormSeed | null {
    if (!appointment) return null
    const { date, time } = isoToLocalParts(appointment.start.toISOString())
    return {
      id: appointment.id,
      date,
      time,
      durationMinutes: full?.durationMinutes ?? appointment.durationMinutes ?? 60,
      serviceTitle:
        full?.serviceNameSnapshot ??
        appointment.serviceName ??
        appointment.title,
      serviceId: full?.serviceId ?? appointment.serviceId,
      clienteId: full?.clienteId ?? null,
      assignedUserId: full?.assignedUserId ?? appointment.assignedUserId,
      notes: full?.descripcion ?? null,
    }
  }

  async function setLifecycle(next: AppointmentLifecycleStatus) {
    if (!appointment) return
    setSavingStatus(true)
    try {
      await updateAppointment(appointment.id, { appointmentStatus: next })
      const refreshed = await fetchAppointment(appointment.id)
      setFull(refreshed)
      addToast({ type: "success", title: a.toast.updated })
      onCancelled()
    } catch (err) {
      addToast({
        type: "error",
        title: a.toast.error,
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSavingStatus(false)
    }
  }

  async function handleCancel() {
    if (!appointment) return
    setSavingStatus(true)
    try {
      await cancelAppointment(appointment.id)
      addToast({ type: "success", title: a.toast.cancelled })
      setConfirmOpen(false)
      onCancelled()
      onClose()
    } catch (err) {
      addToast({
        type: "error",
        title: a.toast.error,
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSavingStatus(false)
    }
  }

  const price =
    full?.servicePrice ?? appointment?.servicePrice ?? null
  const currency =
    full?.serviceCurrency ?? appointment?.serviceCurrency ?? null

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {a.detail.heading}
              {appointment &&
                (status ? (
                  <AppointmentLifecycleBadge status={status} />
                ) : (
                  <AppointmentPhaseBadge phase={appointment.phase} />
                ))}
            </SheetTitle>
            <SheetDescription className="sr-only">{a.subtitle}</SheetDescription>
          </SheetHeader>

          {appointment && (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
              <h3 className="text-lg font-semibold text-foreground">
                {full?.serviceNameSnapshot ?? appointment.serviceName ?? appointment.title}
              </h3>

              {appointment.conflict && status !== "cancelled" && (
                <p className="flex items-center gap-1.5 rounded-md bg-[color-mix(in_srgb,var(--status-danger-text)_10%,transparent)] px-2 py-1.5 text-xs text-[var(--status-danger-text)]">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {a.conflictHint}
                </p>
              )}

              <dl className="flex flex-col gap-3 text-sm">
                <Row icon={<UserRound className="h-4 w-4" />} label={a.fields.client}>
                  {appointment.clientName ?? (
                    <span className="italic text-muted-foreground">{a.detail.noClient}</span>
                  )}
                </Row>
                <Row icon={<CalendarClock className="h-4 w-4" />} label={a.fields.when}>
                  {formatDate(appointment.start.toISOString(), { locale })}
                </Row>
                <Row icon={<Clock className="h-4 w-4" />} label={a.fields.time}>
                  {fmtTime(appointment.start, intlLocale)}
                  {appointment.end
                    ? ` – ${fmtTime(appointment.end, intlLocale)}`
                    : ` · ${a.detail.noEnd}`}
                </Row>
                <Row icon={<Timer className="h-4 w-4" />} label={a.fields.duration}>
                  {(full?.durationMinutes ?? appointment.durationMinutes) !== null
                    ? a.durationLabel(
                        full?.durationMinutes ?? appointment.durationMinutes ?? 0,
                      )
                    : "—"}
                </Row>
                <Row icon={<WalletCards className="h-4 w-4" />} label={a.fields.price}>
                  {price !== null
                    ? `${price.toFixed(2)}${currency ? ` ${currency}` : ""}`
                    : "—"}
                </Row>
                <Row icon={<Pencil className="h-4 w-4" />} label={a.fields.notes}>
                  {full?.descripcion ? (
                    <span className="whitespace-pre-wrap">{full.descripcion}</span>
                  ) : (
                    <span className="italic text-muted-foreground">{a.detail.noNotes}</span>
                  )}
                </Row>
              </dl>

              {full?.clienteId && (
                <Link
                  href={`/clientes/${full.clienteId}`}
                  className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--accent-primary)] hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> {a.detail.openClient}
                </Link>
              )}

              {status !== "cancelled" && status !== "completed" && status !== "no_show" && (
                <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
                  {(!status || status === "pending") && (
                    <Button
                      variant="outline"
                      disabled={savingStatus}
                      onClick={() => void setLifecycle("confirmed")}
                    >
                      <Check className="mr-1.5 h-4 w-4" /> {a.actions.confirm}
                    </Button>
                  )}
                  {status === "confirmed" && (
                    <Button
                      variant="outline"
                      disabled={savingStatus}
                      onClick={() => void setLifecycle("arrived")}
                    >
                      <UserCheck className="mr-1.5 h-4 w-4" /> {a.actions.markArrived}
                    </Button>
                  )}
                  {status === "arrived" && (
                    <Button
                      variant="outline"
                      disabled={savingStatus}
                      onClick={() => void setLifecycle("completed")}
                    >
                      <CircleCheckBig className="mr-1.5 h-4 w-4" /> {a.actions.complete}
                    </Button>
                  )}
                  {(status === "confirmed" || status === "pending" || !status) && (
                    <Button
                      variant="outline"
                      disabled={savingStatus}
                      className="text-[var(--status-danger-text)] hover:text-[var(--status-danger-text)]"
                      onClick={() => void setLifecycle("no_show")}
                    >
                      <UserX className="mr-1.5 h-4 w-4" /> {a.actions.noShow}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          <SheetFooter className="flex-row flex-wrap gap-2">
            {status !== "cancelled" && status !== "completed" && status !== "no_show" && (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    const seed = buildSeed()
                    if (seed) onReschedule(seed)
                  }}
                >
                  <Clock className="mr-1.5 h-4 w-4" /> {a.actions.reschedule}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    const seed = buildSeed()
                    if (seed) onEdit(seed)
                  }}
                >
                  <Pencil className="mr-1.5 h-4 w-4" /> {t.common.edit}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-[var(--status-danger-text)] hover:text-[var(--status-danger-text)]"
                  disabled={savingStatus}
                  onClick={() => setConfirmOpen(true)}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> {a.actions.cancel}
                </Button>
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmModal
        open={confirmOpen}
        variant="danger"
        title={a.actions.cancelConfirmHeading}
        description={a.actions.cancelConfirmBody}
        confirmLabel={savingStatus ? a.form.submitting : a.actions.cancel}
        onConfirm={handleCancel}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <div className="flex min-w-0 flex-col">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className="text-foreground">{children}</dd>
      </div>
    </div>
  )
}

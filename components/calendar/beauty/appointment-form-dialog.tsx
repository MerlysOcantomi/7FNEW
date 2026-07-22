"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/i18n-provider"
import { useToast } from "@/components/toast-provider"
import type { BeautyAppointment } from "./appointment-model"
import type { AppointmentResources } from "./use-appointment-resources"
import { createAppointment, updateAppointment } from "./appointment-api"
import { addMinutesISO, localToISO, rangesOverlap } from "./datetime"

const CUSTOM_SERVICE = "__custom__"
const DEFAULT_DURATION = 60

export type FormMode = "create" | "edit" | "reschedule"

export interface AppointmentFormSeed {
  id: string
  date: string
  time: string
  durationMinutes: number
  serviceTitle: string
  clienteId: string | null
  notes: string | null
}

/**
 * Create / edit / reschedule an appointment. Every submit persists a real
 * `Evento` (tipo "cita") through the shared endpoints. The Radix dialog gives
 * focus trap, Escape-to-close and focus return for free.
 *
 * Service selection reuses the real `/services` catalog: the chosen (or typed)
 * service name becomes the appointment title — the operator's own text, kept
 * verbatim. There is no service FK on `Evento` today, so only the name is
 * persisted (documented gap).
 */
export function AppointmentFormDialog({
  open,
  mode,
  seed,
  defaultDate,
  resources,
  existing,
  onClose,
  onSaved,
}: {
  open: boolean
  mode: FormMode
  /** Present for edit/reschedule; absent for create. */
  seed: AppointmentFormSeed | null
  /** yyyy-mm-dd to preselect on create (the focused calendar day). */
  defaultDate: string
  resources: AppointmentResources
  existing: BeautyAppointment[]
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()
  const a = t.appointments
  const { addToast } = useToast()

  const [clienteId, setClienteId] = useState<string>(seed?.clienteId ?? "")
  const initialService = seed?.serviceTitle ?? ""
  const serviceIsInCatalog = useMemo(
    () => resources.services.some((s) => s.name === initialService),
    [resources.services, initialService],
  )
  const [serviceChoice, setServiceChoice] = useState<string>(
    initialService ? (serviceIsInCatalog ? initialService : CUSTOM_SERVICE) : "",
  )
  const [customService, setCustomService] = useState<string>(
    initialService && !serviceIsInCatalog ? initialService : "",
  )
  const [dateStr, setDateStr] = useState<string>(seed?.date ?? defaultDate)
  const [timeStr, setTimeStr] = useState<string>(seed?.time ?? "")
  const [duration, setDuration] = useState<number>(seed?.durationMinutes ?? DEFAULT_DURATION)
  const [notes, setNotes] = useState<string>(seed?.notes ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const serviceName = serviceChoice === CUSTOM_SERVICE ? customService.trim() : serviceChoice
  const hasClients = resources.clients.length > 0
  const hasServices = resources.services.length > 0

  const startISO = localToISO(dateStr, timeStr)
  const endISO = startISO ? addMinutesISO(startISO, duration) : null

  const conflict = useMemo(() => {
    if (!startISO || !endISO) return false
    const s = new Date(startISO).getTime()
    const e = new Date(endISO).getTime()
    return existing.some((appt) => {
      if (seed && appt.id === seed.id) return false
      const bs = appt.start.getTime()
      const be = appt.end ? appt.end.getTime() : bs + DEFAULT_DURATION * 60000
      return rangesOverlap(s, e, bs, be)
    })
  }, [startISO, endISO, existing, seed])

  const heading =
    mode === "create"
      ? a.form.createHeading
      : mode === "reschedule"
        ? a.form.rescheduleHeading
        : a.form.editHeading

  function validate(): string | null {
    if (!clienteId) return a.form.clientRequired
    if (!serviceName) return a.form.serviceRequired
    if (!dateStr) return a.form.dateRequired
    if (!timeStr) return a.form.timeRequired
    return null
  }

  async function handleSubmit() {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    if (!startISO || !endISO) {
      setError(a.form.timeRequired)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      if (mode === "create") {
        await createAppointment({
          titulo: serviceName,
          descripcion: notes.trim() || null,
          clienteId,
          fechaInicio: startISO,
          fechaFin: endISO,
        })
        addToast({ type: "success", title: a.toast.created })
      } else {
        await updateAppointment(seed!.id, {
          titulo: serviceName,
          descripcion: notes.trim() || null,
          clienteId,
          fechaInicio: startISO,
          fechaFin: endISO,
        })
        addToast({
          type: "success",
          title: mode === "reschedule" ? a.toast.rescheduled : a.toast.updated,
        })
      }
      onSaved()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : a.toast.error
      setError(message)
      addToast({ type: "error", title: a.toast.error, description: message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription className="sr-only">{a.subtitle}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {/* Client */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="appt-client">{a.form.clientLabel}</Label>
            {hasClients ? (
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger id="appt-client">
                  <SelectValue placeholder={a.form.clientPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {resources.clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">
                {a.form.noClientsYet}{" "}
                <Link href="/clientes" className="font-medium text-[var(--accent-primary)] underline">
                  {a.form.addClient}
                </Link>
              </p>
            )}
          </div>

          {/* Service */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="appt-service">{a.form.serviceLabel}</Label>
            {hasServices ? (
              <Select value={serviceChoice} onValueChange={setServiceChoice}>
                <SelectTrigger id="appt-service">
                  <SelectValue placeholder={a.form.servicePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {resources.services.map((s) => (
                    <SelectItem key={s.name} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_SERVICE}>{a.form.customServiceLabel}</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">
                {a.form.noServicesYet}{" "}
                <Link href="/services" className="font-medium text-[var(--accent-primary)] underline">
                  {a.form.manageServices}
                </Link>
              </p>
            )}
            {(serviceChoice === CUSTOM_SERVICE || !hasServices) && (
              <Input
                aria-label={a.form.customServiceLabel}
                placeholder={a.form.customServiceLabel}
                value={customService}
                onChange={(e) => {
                  setCustomService(e.target.value)
                  if (!hasServices) setServiceChoice(CUSTOM_SERVICE)
                }}
              />
            )}
          </div>

          {/* Date + time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="appt-date">{a.form.dateLabel}</Label>
              <Input
                id="appt-date"
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="appt-time">{a.form.timeLabel}</Label>
              <Input
                id="appt-time"
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
              />
            </div>
          </div>

          {/* Duration */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="appt-duration">{a.form.durationLabel}</Label>
            <Input
              id="appt-duration"
              type="number"
              min={5}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Math.max(5, Number(e.target.value) || DEFAULT_DURATION))}
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="appt-notes">{a.form.notesLabel}</Label>
            <Textarea
              id="appt-notes"
              rows={2}
              placeholder={a.form.notesPlaceholder}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {conflict && (
            <p className="flex items-center gap-1.5 rounded-md bg-[color-mix(in_srgb,var(--status-danger-text)_10%,transparent)] px-2 py-1.5 text-xs text-[var(--status-danger-text)]">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {a.form.conflictWarning}
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs text-[var(--status-danger-text)]">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t.common.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? a.form.submitting
              : mode === "create"
                ? a.form.submitCreate
                : a.form.submitSave}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

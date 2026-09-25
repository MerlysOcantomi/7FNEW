"use client"

import { useEffect, useMemo, useState } from "react"
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
const NO_PROFESSIONAL = "__none__"
const DEFAULT_DURATION = 60

export type FormMode = "create" | "edit" | "reschedule"

export interface AppointmentFormSeed {
  id: string
  date: string
  time: string
  durationMinutes: number
  serviceTitle: string
  serviceId: string | null
  clienteId: string | null
  assignedUserId: string | null
  notes: string | null
}

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
  seed: AppointmentFormSeed | null
  defaultDate: string
  resources: AppointmentResources
  existing: BeautyAppointment[]
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()
  const a = t.appointments
  const { addToast } = useToast()

  const initialService = seed?.serviceId
    ? resources.services.find((s) => s.id === seed.serviceId)?.id ?? CUSTOM_SERVICE
    : seed?.serviceTitle
      ? resources.services.find((s) => s.name === seed.serviceTitle)?.id ?? CUSTOM_SERVICE
      : ""

  const [clienteId, setClienteId] = useState(seed?.clienteId ?? "")
  const [serviceChoice, setServiceChoice] = useState(initialService)
  const [customService, setCustomService] = useState(
    seed?.serviceTitle && initialService === CUSTOM_SERVICE ? seed.serviceTitle : "",
  )
  const [assignedUserId, setAssignedUserId] = useState(seed?.assignedUserId ?? "")
  const [dateStr, setDateStr] = useState(seed?.date ?? defaultDate)
  const [timeStr, setTimeStr] = useState(seed?.time ?? "")
  const [duration, setDuration] = useState(seed?.durationMinutes ?? DEFAULT_DURATION)
  const [notes, setNotes] = useState(seed?.notes ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedService = useMemo(
    () => resources.services.find((service) => service.id === serviceChoice) ?? null,
    [resources.services, serviceChoice],
  )
  const serviceName =
    serviceChoice === CUSTOM_SERVICE ? customService.trim() : selectedService?.name ?? ""

  const allowedProfessionals = useMemo(() => {
    if (!selectedService?.staffUserIds?.length) return resources.professionals
    const allowed = new Set(selectedService.staffUserIds)
    return resources.professionals.filter((member) => allowed.has(member.userId))
  }, [resources.professionals, selectedService])

  useEffect(() => {
    if (!open || seed?.assignedUserId) return
    if (allowedProfessionals.length === 1 && !assignedUserId) {
      setAssignedUserId(allowedProfessionals[0].userId)
    }
  }, [open, seed?.assignedUserId, allowedProfessionals, assignedUserId])

  const startISO = localToISO(dateStr, timeStr)
  const endISO = startISO ? addMinutesISO(startISO, duration) : null

  const conflict = useMemo(() => {
    if (!startISO || !endISO) return false
    const s = new Date(startISO).getTime()
    const e = new Date(endISO).getTime()
    return existing.some((appt) => {
      if (seed && appt.id === seed.id) return false
      // When a professional is selected, only their existing appointments
      // compete for this slot. Legacy unassigned appointments remain visible
      // as conflicts because ownership is unknown.
      if (
        assignedUserId &&
        appt.assignedUserId &&
        appt.assignedUserId !== assignedUserId
      ) {
        return false
      }
      const bs = appt.start.getTime()
      const be = appt.end ? appt.end.getTime() : bs + DEFAULT_DURATION * 60000
      return rangesOverlap(s, e, bs, be)
    })
  }, [startISO, endISO, existing, seed, assignedUserId])

  const heading =
    mode === "create"
      ? a.form.createHeading
      : mode === "reschedule"
        ? a.form.rescheduleHeading
        : a.form.editHeading

  function handleServiceChange(value: string) {
    setServiceChoice(value)
    const service = resources.services.find((item) => item.id === value)
    if (service?.durationMinutes) setDuration(service.durationMinutes)

    if (service?.staffUserIds?.length) {
      if (!assignedUserId || !service.staffUserIds.includes(assignedUserId)) {
        setAssignedUserId(service.staffUserIds.length === 1 ? service.staffUserIds[0] : "")
      }
    }
  }

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
      const payload = {
        titulo: serviceName,
        descripcion: notes.trim() || null,
        clienteId,
        serviceId: selectedService?.id ?? null,
        assignedUserId: assignedUserId || null,
        origin: mode === "create" ? "manual_agenda" : undefined,
        fechaInicio: startISO,
        fechaFin: endISO,
      }

      if (mode === "create") {
        await createAppointment(payload)
        addToast({ type: "success", title: a.toast.created })
      } else {
        await updateAppointment(seed!.id, payload)
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

        <div className="flex max-h-[68vh] flex-col gap-3 overflow-y-auto pr-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="appt-client">{a.form.clientLabel}</Label>
            {resources.clients.length > 0 ? (
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger id="appt-client">
                  <SelectValue placeholder={a.form.clientPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {resources.clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.nombre}
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="appt-service">{a.form.serviceLabel}</Label>
            {resources.services.length > 0 ? (
              <Select value={serviceChoice} onValueChange={handleServiceChange}>
                <SelectTrigger id="appt-service">
                  <SelectValue placeholder={a.form.servicePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {resources.services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                      {service.durationMinutes ? ` · ${a.durationLabel(service.durationMinutes)}` : ""}
                      {service.price !== undefined
                        ? ` · ${service.price.toFixed(2)} ${service.currency ?? ""}`
                        : ""}
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
            {(serviceChoice === CUSTOM_SERVICE || resources.services.length === 0) && (
              <Input
                aria-label={a.form.customServiceLabel}
                placeholder={a.form.customServiceLabel}
                value={customService}
                onChange={(e) => {
                  setCustomService(e.target.value)
                  if (resources.services.length === 0) setServiceChoice(CUSTOM_SERVICE)
                }}
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="appt-professional">{a.fields.professional}</Label>
            <Select
              value={assignedUserId || NO_PROFESSIONAL}
              onValueChange={(value) =>
                setAssignedUserId(value === NO_PROFESSIONAL ? "" : value)
              }
            >
              <SelectTrigger id="appt-professional">
                <SelectValue placeholder={a.fields.professional} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROFESSIONAL}>—</SelectItem>
                {allowedProfessionals.map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    {member.nombre || member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="appt-date">{a.form.dateLabel}</Label>
              <Input id="appt-date" type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="appt-time">{a.form.timeLabel}</Label>
              <Input id="appt-time" type="time" value={timeStr} onChange={(e) => setTimeStr(e.target.value)} />
            </div>
          </div>

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

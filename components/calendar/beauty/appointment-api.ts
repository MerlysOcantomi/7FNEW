/**
 * Appointment mutations — thin wrappers over the shared Calendar Engine.
 * Appointment V2 adds structured service/professional/status/origin intent while
 * snapshots are derived server-side from the canonical service catalog.
 */

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "arrived"
  | "completed"
  | "no_show"
  | "cancelled"

export interface AppointmentInput {
  titulo: string
  descripcion?: string | null
  clienteId?: string | null
  serviceId?: string | null
  assignedUserId?: string | null
  appointmentStatus?: AppointmentStatus | null
  origin?: string | null
  /** ISO 8601 (UTC) start. */
  fechaInicio: string
  /** ISO 8601 (UTC) end, or null for an open-ended cita. */
  fechaFin?: string | null
}

export interface FullAppointment {
  id: string
  titulo: string
  descripcion: string | null
  clienteId: string | null
  clienteNombre: string | null
  fechaInicio: string
  fechaFin: string | null
  serviceId: string | null
  serviceNameSnapshot: string | null
  servicePrice: number | null
  serviceCurrency: string | null
  durationMinutes: number | null
  assignedUserId: string | null
  appointmentStatus: AppointmentStatus | null
  origin: string | null
}

async function assertOk(res: Response): Promise<Record<string, unknown>> {
  const json = (await res.json().catch(() => null)) as
    | { success?: boolean; data?: unknown; error?: { message?: string } }
    | null
  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message || `Error ${res.status}`)
  }
  return (json.data ?? {}) as Record<string, unknown>
}

export async function createAppointment(input: AppointmentInput): Promise<void> {
  const res = await fetch("/api/calendario", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ...input, tipo: "cita", todoElDia: false }),
  })
  await assertOk(res)
}

export async function updateAppointment(id: string, input: Partial<AppointmentInput>): Promise<void> {
  const res = await fetch(`/api/calendario/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  })
  await assertOk(res)
}

export async function cancelAppointment(id: string): Promise<void> {
  // V2 cancellation is a lifecycle transition, not deletion. Keeping the Evento
  // preserves history, client analytics and the service snapshot.
  await updateAppointment(id, { appointmentStatus: "cancelled" })
}

export async function fetchAppointment(id: string): Promise<FullAppointment | null> {
  const res = await fetch(`/api/calendario/${id}`, { credentials: "include" })
  if (!res.ok) return null
  const json = (await res.json().catch(() => null)) as
    | { success?: boolean; data?: Record<string, unknown> }
    | null
  if (!json?.success || !json.data) return null
  const e = json.data as {
    id: string
    titulo: string
    descripcion?: string | null
    clienteId?: string | null
    cliente?: { nombre?: string | null } | null
    fechaInicio: string
    fechaFin?: string | null
    serviceId?: string | null
    serviceNameSnapshot?: string | null
    servicePrice?: number | null
    serviceCurrency?: string | null
    durationMinutes?: number | null
    assignedUserId?: string | null
    appointmentStatus?: AppointmentStatus | null
    origin?: string | null
  }
  return {
    id: e.id,
    titulo: e.titulo,
    descripcion: e.descripcion ?? null,
    clienteId: e.clienteId ?? null,
    clienteNombre: e.cliente?.nombre ?? null,
    fechaInicio: e.fechaInicio,
    fechaFin: e.fechaFin ?? null,
    serviceId: e.serviceId ?? null,
    serviceNameSnapshot: e.serviceNameSnapshot ?? null,
    servicePrice: e.servicePrice ?? null,
    serviceCurrency: e.serviceCurrency ?? null,
    durationMinutes: e.durationMinutes ?? null,
    assignedUserId: e.assignedUserId ?? null,
    appointmentStatus: e.appointmentStatus ?? null,
    origin: e.origin ?? null,
  }
}

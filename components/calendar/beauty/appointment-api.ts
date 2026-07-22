/**
 * Appointment mutations — thin client wrappers over the EXISTING shared
 * calendar endpoints. No new API surface: create/reschedule/edit/cancel all go
 * through `/api/calendario` (+ `/[id]`), which persist a real `Evento` scoped
 * to the workspace. Every appointment is stamped `tipo: "cita"`.
 *
 * "Reschedule" is a PATCH of `fechaInicio`/`fechaFin` on the SAME record — it
 * keeps the event identity (never a copy). "Cancel" is a DELETE — the honest,
 * persistent operation the model supports today; it frees the slot. There is no
 * confirmed/completed/no-show call because `Evento` has no state column to hold
 * one (documented gap, not a fake button).
 */

export interface AppointmentInput {
  titulo: string
  descripcion?: string | null
  clienteId?: string | null
  /** ISO 8601 (UTC) start. */
  fechaInicio: string
  /** ISO 8601 (UTC) end, or null for an open-ended cita. */
  fechaFin?: string | null
}

/** Full record for the detail/edit surface (relations the feed omits). */
export interface FullAppointment {
  id: string
  titulo: string
  descripcion: string | null
  clienteId: string | null
  clienteNombre: string | null
  fechaInicio: string
  fechaFin: string | null
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
  const res = await fetch(`/api/calendario/${id}`, {
    method: "DELETE",
    credentials: "include",
  })
  await assertOk(res)
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
  }
  return {
    id: e.id,
    titulo: e.titulo,
    descripcion: e.descripcion ?? null,
    clienteId: e.clienteId ?? null,
    clienteNombre: e.cliente?.nombre ?? null,
    fechaInicio: e.fechaInicio,
    fechaFin: e.fechaFin ?? null,
  }
}

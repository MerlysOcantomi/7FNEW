import { db } from "@core/db"
import { getWorkspaceWithResolvedConfig } from "@core/workspace"
import { findServiceById, resolveServiceCatalog } from "@core/services/catalog"

export const APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "arrived",
  "completed",
  "no_show",
  "cancelled",
] as const

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

export interface AppointmentWriteInput {
  tipo?: string
  titulo?: string
  clienteId?: string | null
  fechaInicio?: string
  fechaFin?: string | null
  serviceId?: string | null
  assignedUserId?: string | null
  appointmentStatus?: AppointmentStatus | null
  origin?: string | null
}

export interface ExistingAppointment {
  tipo: string
  serviceId: string | null
  serviceNameSnapshot?: string | null
  servicePrice?: number | null
  serviceCurrency?: string | null
  durationMinutes?: number | null
  assignedUserId?: string | null
  appointmentStatus: string | null
  origin?: string | null
}

export type AppointmentWriteResult = AppointmentWriteInput & {
  serviceNameSnapshot?: string | null
  servicePrice?: number | null
  serviceCurrency?: string | null
  durationMinutes?: number | null
  confirmedAt?: Date | null
  cancelledAt?: Date | null
  completedAt?: Date | null
  noShowAt?: Date | null
}

function durationBetween(start?: string, end?: string | null): number | undefined {
  if (!start || !end) return undefined
  const a = new Date(start).getTime()
  const b = new Date(end).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return undefined
  return Math.max(1, Math.round((b - a) / 60_000))
}

/**
 * Enrich and validate Appointment V2 writes at the workspace boundary.
 *
 * Snapshot rule:
 * - create or CHANGE service -> snapshot the current catalog name/price/currency;
 * - status-only/edit-with-same-service -> preserve the original snapshot;
 * - duration changes only when the submitted start/end produce a new duration.
 *
 * That keeps historical bookings truthful when the catalog changes later.
 */
export async function resolveAppointmentWrite(
  input: AppointmentWriteInput,
  workspaceId: string,
  existing?: ExistingAppointment | null,
): Promise<AppointmentWriteResult> {
  const effectiveTipo = input.tipo ?? existing?.tipo
  if (effectiveTipo !== "cita") return { ...input }

  if (input.clienteId) {
    const client = await db.cliente.findFirst({
      where: { id: input.clienteId, workspaceId },
      select: { id: true },
    })
    if (!client) throw new Error("CLIENT_NOT_IN_WORKSPACE")
  }

  if (input.assignedUserId) {
    const member = await db.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId: input.assignedUserId, workspaceId },
      },
      select: { userId: true },
    })
    if (!member) throw new Error("PROFESSIONAL_NOT_IN_WORKSPACE")
  }

  const effectiveServiceId =
    input.serviceId === undefined ? existing?.serviceId ?? null : input.serviceId
  const serviceChanged =
    !existing || (input.serviceId !== undefined && input.serviceId !== existing.serviceId)

  const workspace = await getWorkspaceWithResolvedConfig(workspaceId)
  const catalog = resolveServiceCatalog(workspace?.resolvedConfig.serviceCatalog)
  const service = findServiceById(catalog, effectiveServiceId)

  if (effectiveServiceId && !service) throw new Error("SERVICE_NOT_IN_WORKSPACE")
  if (service && !service.active) throw new Error("SERVICE_INACTIVE")

  const effectiveAssignedUserId =
    input.assignedUserId === undefined
      ? existing?.assignedUserId ?? null
      : input.assignedUserId

  if (
    service?.staffUserIds?.length &&
    effectiveAssignedUserId &&
    !service.staffUserIds.includes(effectiveAssignedUserId)
  ) {
    throw new Error("PROFESSIONAL_NOT_ALLOWED_FOR_SERVICE")
  }

  const next: AppointmentWriteResult = { ...input }

  if (!existing) {
    next.serviceId = effectiveServiceId
    next.appointmentStatus =
      input.appointmentStatus === undefined ? "pending" : input.appointmentStatus
  } else if (input.serviceId !== undefined) {
    next.serviceId = effectiveServiceId
  }

  if (serviceChanged && service) {
    next.titulo = input.titulo?.trim() || service.name
    next.serviceNameSnapshot = service.name
    next.servicePrice = service.price ?? null
    next.serviceCurrency = service.currency ?? null
  }

  const submittedDuration = durationBetween(input.fechaInicio, input.fechaFin)
  if (submittedDuration !== undefined) {
    next.durationMinutes = submittedDuration
  } else if (!existing && service?.durationMinutes !== undefined) {
    next.durationMinutes = service.durationMinutes
  }

  if (input.origin !== undefined) {
    next.origin = input.origin?.trim() || null
  }

  const nextStatus =
    input.appointmentStatus === undefined
      ? existing?.appointmentStatus ?? (existing ? null : "pending")
      : input.appointmentStatus

  if (input.appointmentStatus !== undefined) {
    next.appointmentStatus = nextStatus as AppointmentStatus | null
    const now = new Date()

    if (nextStatus === "confirmed") next.confirmedAt = now
    if (nextStatus === "cancelled") next.cancelledAt = now
    if (nextStatus === "completed") next.completedAt = now
    if (nextStatus === "no_show") next.noShowAt = now

    if (nextStatus !== "cancelled") next.cancelledAt = null
    if (nextStatus !== "completed") next.completedAt = null
    if (nextStatus !== "no_show") next.noShowAt = null
  }

  return next
}

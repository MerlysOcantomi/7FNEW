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

interface AppointmentWriteInput {
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

interface ExistingAppointment {
  tipo: string
  serviceId: string | null
  appointmentStatus: string | null
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
 * Generic Evento writes pass through untouched.
 *
 * Service price/name are SNAPSHOTS from the canonical service catalog, never
 * trusted from the client. Staff and client relations are checked against the
 * active workspace before persistence.
 */
export async function resolveAppointmentWrite(
  input: AppointmentWriteInput,
  workspaceId: string,
  existing?: ExistingAppointment | null,
): Promise<Record<string, unknown>> {
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

  const workspace = await getWorkspaceWithResolvedConfig(workspaceId)
  const catalog = resolveServiceCatalog(workspace?.resolvedConfig.serviceCatalog)
  const effectiveServiceId =
    input.serviceId === undefined ? existing?.serviceId ?? null : input.serviceId
  const service = findServiceById(catalog, effectiveServiceId)

  if (effectiveServiceId && !service) throw new Error("SERVICE_NOT_IN_WORKSPACE")
  if (service && !service.active) throw new Error("SERVICE_INACTIVE")
  if (
    service?.staffUserIds?.length &&
    input.assignedUserId &&
    !service.staffUserIds.includes(input.assignedUserId)
  ) {
    throw new Error("PROFESSIONAL_NOT_ALLOWED_FOR_SERVICE")
  }

  const durationMinutes =
    durationBetween(input.fechaInicio, input.fechaFin) ??
    service?.durationMinutes

  const nextStatus =
    input.appointmentStatus === undefined
      ? (existing?.appointmentStatus ?? "pending")
      : input.appointmentStatus

  const now = new Date()
  const lifecycle: Record<string, Date | null | undefined> = {}
  if (input.appointmentStatus !== undefined) {
    if (nextStatus === "confirmed") lifecycle.confirmedAt = now
    if (nextStatus === "cancelled") lifecycle.cancelledAt = now
    if (nextStatus === "completed") lifecycle.completedAt = now
    if (nextStatus === "no_show") lifecycle.noShowAt = now

    if (nextStatus !== "cancelled") lifecycle.cancelledAt = null
    if (nextStatus !== "completed") lifecycle.completedAt = null
    if (nextStatus !== "no_show") lifecycle.noShowAt = null
  }

  return {
    ...input,
    serviceId: effectiveServiceId,
    ...(service
      ? {
          titulo: input.titulo?.trim() || service.name,
          serviceNameSnapshot: service.name,
          servicePrice: service.price ?? null,
          serviceCurrency: service.currency ?? null,
        }
      : {}),
    ...(durationMinutes !== undefined ? { durationMinutes } : {}),
    appointmentStatus: nextStatus,
    origin: input.origin?.trim() || undefined,
    ...lifecycle,
  }
}

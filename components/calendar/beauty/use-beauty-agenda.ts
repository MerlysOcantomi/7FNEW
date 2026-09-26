"use client"

import { useMemo } from "react"
import { useFetch } from "@/hooks/use-fetch"
import { formatDateParam } from "../grid"
import type { CalendarItem, CalendarView } from "../types"
import { toBeautyAppointments, type BeautyAppointment } from "./appointment-model"

interface FeedEvento {
  id: string
  titulo: string
  fechaInicio: string
  fechaFin?: string | null
  todoElDia?: boolean
  tipo: string
  cliente?: { nombre?: string | null } | null
  serviceId?: string | null
  serviceNameSnapshot?: string | null
  servicePrice?: number | null
  serviceCurrency?: string | null
  durationMinutes?: number | null
  assignedUserId?: string | null
  appointmentStatus?: string | null
  origin?: string | null
}

interface FeedShape {
  eventos?: FeedEvento[]
}

export interface UseBeautyAgendaResult {
  appointments: BeautyAppointment[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useBeautyAgenda(
  view: CalendarView,
  currentDate: Date,
  refreshKey: number,
): UseBeautyAgendaResult {
  const url = `/api/calendario/feed?view=${view}&date=${formatDateParam(currentDate)}`
  const { data, loading, error, refetch } = useFetch<FeedShape>(url, { refreshKey })

  const appointments = useMemo(() => {
    const eventos = data?.eventos ?? []
    const items: CalendarItem[] = eventos
      .filter((event) => event.fechaInicio)
      .map((event) => ({
        id: event.id,
        type: "evento",
        title: event.titulo,
        date: event.fechaInicio,
        endDate: event.fechaFin ?? null,
        allDay: !!event.todoElDia,
        status: event.tipo,
        clientName: event.cliente?.nombre ?? undefined,
        serviceId: event.serviceId ?? null,
        serviceNameSnapshot: event.serviceNameSnapshot ?? null,
        servicePrice: event.servicePrice ?? null,
        serviceCurrency: event.serviceCurrency ?? null,
        durationMinutes: event.durationMinutes ?? null,
        assignedUserId: event.assignedUserId ?? null,
        appointmentStatus: event.appointmentStatus ?? null,
        origin: event.origin ?? null,
      }))

    return toBeautyAppointments(items, new Date())
  }, [data])

  return { appointments, loading, error, refetch }
}

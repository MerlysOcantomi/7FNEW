"use client"

import { useMemo } from "react"
import { useFetch } from "@/hooks/use-fetch"
import { formatDateParam } from "../grid"
import type { CalendarItem, CalendarView } from "../types"
import { toBeautyAppointments, type BeautyAppointment } from "./appointment-model"

/**
 * Beauty agenda read hook — the SAME shared feed the Core calendar uses
 * (`/api/calendario/feed`, workspace-scoped + range-filtered server-side),
 * projected into Beauty appointments. No second endpoint, model or query.
 *
 * `refreshKey` lets the experience re-read after a create/edit/cancel without a
 * page reload; conflicts are derived by the shared engine inside
 * `toBeautyAppointments`.
 */
interface FeedEvento {
  id: string
  titulo: string
  fechaInicio: string
  fechaFin?: string | null
  todoElDia?: boolean
  tipo: string
  cliente?: { nombre?: string | null } | null
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
      .filter((e) => e.fechaInicio)
      .map((e) => ({
        id: e.id,
        type: "evento",
        title: e.titulo,
        date: e.fechaInicio,
        endDate: e.fechaFin ?? null,
        allDay: !!e.todoElDia,
        status: e.tipo,
        clientName: e.cliente?.nombre ?? undefined,
      }))
    return toBeautyAppointments(items, new Date())
  }, [data])

  return { appointments, loading, error, refetch }
}

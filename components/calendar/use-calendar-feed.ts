"use client"

import { useMemo } from "react"
import { useFetch } from "@/hooks/use-fetch"
import { formatDateParam } from "./grid"
import type { CalendarItem, CalendarView } from "./types"

/**
 * Maps the real /api/calendario/feed payload (workspace-scoped, range-filtered
 * server-side) into the unified CalendarItem[] the views render. Mirrors the
 * mapping the old page did, now also carrying evento end time + all-day flag so
 * Day/Week can place timed events. No fabricated data.
 */
function mapFeed(data: unknown): CalendarItem[] {
  const d = data as {
    tareas?: any[]
    proyectos?: any[]
    facturas?: any[]
    eventos?: any[]
  } | null
  if (!d) return []
  const out: CalendarItem[] = []

  for (const t of d.tareas ?? []) {
    if (!t.fechaLimite) continue
    out.push({
      id: t.id, type: "tarea", title: t.titulo, date: t.fechaLimite, allDay: true,
      status: t.estado, priority: t.prioridad, extra: t.proyecto?.nombre ?? t.cliente?.nombre ?? undefined,
    })
  }
  for (const p of d.proyectos ?? []) {
    const date = p.fechaInicio ?? p.fechaFin ?? p.createdAt
    if (!date) continue
    out.push({
      id: p.id, type: "proyecto", title: p.nombre, date, endDate: p.fechaFin ?? null, allDay: true,
      status: p.estado, extra: p.cliente?.nombre ?? undefined,
    })
  }
  for (const f of d.facturas ?? []) {
    if (!f.fechaVencimiento) continue
    out.push({
      id: f.id, type: "factura", title: `Invoice ${f.numero}`, date: f.fechaVencimiento, allDay: true,
      status: f.estado, extra: f.cliente?.nombre ? `${f.cliente.nombre} · $${f.total}` : `$${f.total}`,
    })
  }
  for (const e of d.eventos ?? []) {
    if (!e.fechaInicio) continue
    out.push({
      id: e.id, type: "evento", title: e.titulo, date: e.fechaInicio, endDate: e.fechaFin ?? null,
      allDay: !!e.todoElDia, status: e.tipo, extra: e.cliente?.nombre ?? e.proyecto?.nombre ?? undefined,
    })
  }
  return out
}

export interface UseCalendarFeedResult {
  items: CalendarItem[]
  loading: boolean
  error: string | null
}

export function useCalendarFeed(view: CalendarView, currentDate: Date, enabled = true): UseCalendarFeedResult {
  const dateParam = formatDateParam(currentDate)
  // `enabled: false` skips the request (useFetch treats a null url as a no-op) —
  // lets the shell reuse the active feed in Month view instead of double-fetching.
  const url = enabled ? `/api/calendario/feed?view=${view}&date=${dateParam}` : null
  const { data, loading, error } = useFetch<unknown>(url)
  const items = useMemo(() => mapFeed(data), [data])
  return { items, loading, error }
}

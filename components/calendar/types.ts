/**
 * 7F Calendar — shared types (pure, no imports so grid.ts + tests stay clean).
 * Calendar is a TIME instrument; these model the unified time items the views
 * render, mapped from /api/calendario/feed (tareas + proyectos + facturas + eventos).
 */

export type CalendarView = "day" | "week" | "month"

export type CalendarItemType = "tarea" | "proyecto" | "factura" | "evento"

export interface CalendarItem {
  id: string
  type: CalendarItemType
  title: string
  /** ISO start — deadline date for tarea/factura, start for evento/proyecto. */
  date: string
  /** ISO end — only eventos (and project spans) carry a real end. */
  endDate?: string | null
  /** Evento all-day flag; tareas/facturas/proyectos are treated as all-day deadlines. */
  allDay: boolean
  status: string
  priority?: string
  /** Secondary context line (client · project · amount). */
  extra?: string
  /**
   * Structured related context — client-side enrichment mapped in use-calendar-feed
   * from relations the feed ALREADY includes (no feed-API / schema change). Powers
   * EventDNA's context rows; absent when the feed carries no relation.
   */
  clientName?: string
  projectName?: string
  invoiceTotal?: number
}

/**
 * 7F Calendar — color / icon maps per item type (visible type labels live in
 * the `calendar.types` catalog).
 * Reuses the cross-module --tab-* semantic tokens and the shared status tokens
 * (Midnight-aware). No hardcoded colors.
 */
import { CheckSquare, FolderKanban, Receipt, Calendar as CalendarIcon } from "lucide-react"
import type { CalendarItemType } from "./types"

export const typeColors: Record<CalendarItemType, string> = {
  tarea: "var(--tab-tasks)",
  proyecto: "var(--tab-phases)",
  factura: "var(--tab-billing)",
  evento: "var(--tab-info)",
}

export const typeIcons: Record<CalendarItemType, typeof CheckSquare> = {
  tarea: CheckSquare,
  proyecto: FolderKanban,
  factura: Receipt,
  evento: CalendarIcon,
}

export const priorityDot: Record<string, string> = {
  urgente: "bg-[var(--status-danger-text)]",
  alta: "bg-[var(--status-warning-text)]",
  media: "bg-[var(--status-warning-text)]",
  baja: "bg-[var(--status-neutral-text)]",
}

/**
 * 7F Intelligence Panel — generic presentation modes.
 *
 * Named at the PANEL level (not "calendar event panel") so this exact vocabulary
 * can be hoisted into a shared cross-module control later WITHOUT renaming. No
 * calendar-specific coupling lives here — that is the extraction seam. Keep the
 * user-facing surface subtle: a single control, not a row of technical toggles.
 */
import { Layers, Maximize2, PanelRight, PanelRightClose, Rows2, type LucideIcon } from "lucide-react"

export type PanelMode = "docked" | "compact" | "overlay" | "expanded" | "collapsed"

export interface PanelModeDef {
  mode: PanelMode
  /** Friendly label — reads as an assistant layout choice, not a dev switch. */
  label: string
  /** Tooltip / aria description. */
  title: string
  Icon: LucideIcon
  /** Float modes render OVER the workspace (Sheet/Dialog) instead of reserving a column. */
  floats: boolean
}

export const PANEL_MODES: readonly PanelModeDef[] = [
  { mode: "docked", label: "Docked", title: "Docked — full context beside your calendar.", Icon: PanelRight, floats: false },
  { mode: "compact", label: "Compact", title: "Compact — the essentials in a slim column.", Icon: Rows2, floats: false },
  { mode: "overlay", label: "Overlay", title: "Overlay — context floats over the calendar.", Icon: Layers, floats: true },
  { mode: "expanded", label: "Expanded", title: "Expanded — full focus on this moment.", Icon: Maximize2, floats: true },
  { mode: "collapsed", label: "Collapsed", title: "Collapsed — hide the panel, maximize the calendar.", Icon: PanelRightClose, floats: false },
]

export const DEFAULT_PANEL_MODE: PanelMode = "docked"

/** Per-browser persistence key (page owns read/write; the panel is presentational). */
export const PANEL_MODE_STORAGE_KEY = "calendar-panel-mode"

export function isPanelMode(value: unknown): value is PanelMode {
  return (
    value === "docked" ||
    value === "compact" ||
    value === "overlay" ||
    value === "expanded" ||
    value === "collapsed"
  )
}

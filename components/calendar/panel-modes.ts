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
  Icon: LucideIcon
  /** Float modes render OVER the workspace (Sheet/Dialog) instead of reserving a column. */
  floats: boolean
}

/**
 * Structure only — the friendly labels and tooltip titles live in the
 * `calendar.panelModes` catalog, keyed by `mode` (UI reads
 * `t.calendar.panelModes.labels[mode]` / `.titles[mode]`).
 */
export const PANEL_MODES: readonly PanelModeDef[] = [
  { mode: "docked", Icon: PanelRight, floats: false },
  { mode: "compact", Icon: Rows2, floats: false },
  { mode: "overlay", Icon: Layers, floats: true },
  { mode: "expanded", Icon: Maximize2, floats: true },
  { mode: "collapsed", Icon: PanelRightClose, floats: false },
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

"use client"

import { Columns3, Maximize2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Inbox layout mode (PR2 foundation). Internal values are kept stable; user-facing labels are
 * Brief / Read / Handle:
 *  - `triage`  → "Brief":  conversation list + Fanny/context panel. Strictly two columns — no
 *               message-open substate. From here the operator picks Read or Handle to see the
 *               real message.
 *  - `reading` → "Read":   classic three columns: list + message/thread + Fanny/context panel.
 *  - `focus`   → "Handle": message/thread + composer beside the Fanny/context panel, with NO
 *               conversation list once a conversation is selected. A compact one-line context
 *               strip sits above the thread.
 *
 * Modes are a DESKTOP (xl+) concern — mobile keeps its existing list↔thread flow. The active
 * mode is persisted per-browser in localStorage by the page (key `smart-inbox-layout-mode`).
 */
export type InboxLayoutMode = "triage" | "reading" | "focus"

const MODES: ReadonlyArray<{
  mode: InboxLayoutMode
  label: string
  title: string
  Icon: typeof Columns3
}> = [
  {
    mode: "triage",
    label: "Brief",
    title: "Brief — See who wrote, what matters, and what to do next.",
    Icon: Sparkles,
  },
  {
    mode: "reading",
    label: "Read",
    title: "Read — Read the full message with AI context.",
    Icon: Columns3,
  },
  {
    mode: "focus",
    label: "Handle",
    title: "Handle — Work through one conversation with AI beside you.",
    Icon: Maximize2,
  },
]

interface InboxLayoutSwitcherProps {
  value: InboxLayoutMode
  onChange: (mode: InboxLayoutMode) => void
  className?: string
}

/**
 * Compact segmented control mirroring the existing Chat | Email toggle in the thread header,
 * so it reads as native inbox chrome. Read-only presentation: it only reports the chosen mode
 * up to the page, which owns persistence and the conditional column rendering.
 */
export function InboxLayoutSwitcher({ value, onChange, className }: InboxLayoutSwitcherProps) {
  return (
    <div
      role="group"
      aria-label="Inbox layout mode"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-[var(--inbox-border)]/45 bg-white/[0.03] p-0.5 text-[11px]",
        className,
      )}
    >
      {MODES.map(({ mode, label, title, Icon }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          aria-pressed={value === mode}
          title={title}
          className={cn(
            "inline-flex items-center gap-1 rounded-[5px] px-2 py-0.5 font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--inbox-accent)]/40",
            value === mode
              ? "bg-[var(--inbox-accent)]/15 text-[var(--inbox-accent)]"
              : "text-[var(--inbox-text-secondary)] hover:text-[var(--inbox-text)]",
          )}
        >
          <Icon className="h-3 w-3" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  )
}

"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PANEL_MODES, type PanelMode } from "./panel-modes"

/**
 * Subtle panel-layout control. A single quiet trigger (showing the active mode's
 * glyph) opens a small popover with the five modes — so the panel reads as an
 * intelligent context area, not a developer layout switcher. Generic on purpose
 * (extraction-ready): it knows nothing about the calendar.
 */
export function PanelModeSwitcher({
  value,
  onChange,
  className,
}: {
  value: PanelMode
  onChange: (mode: PanelMode) => void
  className?: string
}) {
  const { t } = useI18n()
  const modes = t.calendar.panelModes
  const [open, setOpen] = useState(false)
  const active = PANEL_MODES.find((m) => m.mode === value) ?? PANEL_MODES[0]
  const ActiveIcon = active.Icon

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={modes.ariaLabel(modes.labels[active.mode])}
          title={modes.ariaLabel(modes.labels[active.mode])}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            className,
          )}
        >
          <ActiveIcon className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1">
        <p className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{modes.heading}</p>
        {PANEL_MODES.map(({ mode, Icon }) => (
          <button
            key={mode}
            type="button"
            title={modes.titles[mode]}
            onClick={() => {
              onChange(mode)
              setOpen(false)
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors",
              mode === value ? "bg-[var(--accent-soft)] text-foreground" : "text-foreground/80 hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className={cn("h-3.5 w-3.5 shrink-0", mode === value ? "text-[var(--accent-primary)]" : "text-muted-foreground")} />
            <span className="flex-1">{modes.labels[mode]}</span>
            {mode === value && <Check className="h-3 w-3 text-[var(--accent-primary)]" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

"use client"

import { useEffect, useState } from "react"
import { Flower2, Gem, Leaf, Moon, Sun, Waves } from "lucide-react"
import { cn } from "@/lib/utils"
import { isValidThemeKey, THEME_STORAGE_KEY, type AppThemeKey } from "@core/theme-registry"

// Complete recommended directions come first. The existing themes remain
// selectable; choosing one is an explicit preference, never a workspace write.
const OPTIONS: { mode: AppThemeKey; label: string; icon: typeof Moon }[] = [
  { mode: "sevenef-blue-premium", label: "sevenef Blue", icon: Moon },
  { mode: "finesse-petrol-blue", label: "Finesse Petrol Blue", icon: Waves },
  { mode: "petrol-pearl", label: "Petrol Pearl", icon: Sun },
  { mode: "midnight", label: "Midnight", icon: Moon },
  { mode: "lavender-mist", label: "Lavender Mist", icon: Sun },
  { mode: "rose-nude", label: "Rose Nude", icon: Flower2 },
  { mode: "sage-luxe", label: "Sage Luxe", icon: Leaf },
  { mode: "noir-or", label: "Noir Or", icon: Gem },
]

export function ThemeModeToggle() {
  const [mode, setMode] = useState<AppThemeKey | null>(null)

  useEffect(() => {
    // Read the effective palette, including server defaults, not only storage.
    const sync = () => {
      const current = document.documentElement.getAttribute("data-theme")
      setMode(isValidThemeKey(current) ? current : null)
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
    return () => observer.disconnect()
  }, [])

  function choose(next: AppThemeKey) {
    document.documentElement.setAttribute("data-theme", next)
    setMode(next)
    const url = new URL(window.location.href)
    url.searchParams.delete("theme")
    window.history.replaceState(window.history.state, "", url)
    try { window.localStorage.setItem(THEME_STORAGE_KEY, next) } catch { /* Session-only selection. */ }
  }

  return (
    <div role="group" aria-label="Theme" className="flex flex-wrap gap-1 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-subtle)] p-1">
      {OPTIONS.map(({ mode: value, label, icon: Icon }) => (
        <button key={value} type="button" onClick={() => choose(value)} aria-pressed={mode === value}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-on-dark)]",
            mode === value
              ? "bg-[var(--app-surface-active)] text-[var(--app-sidebar-text)] shadow-[0_0_0_1px_var(--accent-primary)]"
              : "text-[var(--text-secondary-light)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-sidebar-text)]",
          )}>
          <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />{label}
        </button>
      ))}
    </div>
  )
}

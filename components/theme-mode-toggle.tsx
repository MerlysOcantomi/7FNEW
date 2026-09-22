"use client"

import { useEffect, useState } from "react"
import { Flower2, Layers3, Moon, Sun, Waves } from "lucide-react"
import { cn } from "@/lib/utils"
import { isValidThemeKey, THEME_STORAGE_KEY, type AppThemeKey } from "@core/theme-registry"
import { DEFAULT_APP_MATERIAL, isAppMaterial, MATERIAL_STORAGE_KEY, type AppMaterial } from "@core/material-registry"

// Active product directions only. Legacy palette keys remain readable by the
// registry for migration but are intentionally absent from this selector.
const OPTIONS: { mode: AppThemeKey; label: string; icon: typeof Moon }[] = [
  { mode: "midnight", label: "Midnight Blue", icon: Moon },
  { mode: "sevenef-pearl-blue", label: "sevenef Pearl", icon: Sun },
  { mode: "petrol-pearl", label: "Finesse Pearl", icon: Waves },
  { mode: "finesse-rose-cream-gold", label: "Finesse Cream Gold", icon: Flower2 },
]
export function ThemeModeToggle() {
  const [mode, setMode] = useState<AppThemeKey | null>(null)
  const [material, setMaterial] = useState<AppMaterial>(DEFAULT_APP_MATERIAL)

  useEffect(() => {
    // Read the effective palette, including server defaults, not only storage.
    const sync = () => {
      const current = document.documentElement.getAttribute("data-theme")
      setMode(isValidThemeKey(current) ? current : null)
    }
    sync()
    const syncMaterial = () => {
      const current = document.documentElement.getAttribute("data-material")
      setMaterial(isAppMaterial(current) ? current : DEFAULT_APP_MATERIAL)
    }
    syncMaterial()
    const observer = new MutationObserver(() => { sync(); syncMaterial() })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-material"] })
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

  function chooseMaterial(next: AppMaterial) {
    document.documentElement.setAttribute("data-material", next)
    setMaterial(next)
    try { window.localStorage.setItem(MATERIAL_STORAGE_KEY, next) } catch { /* Session-only selection. */ }
  }

  return (
    <div className="flex flex-col gap-2">
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
    <div role="group" aria-label="Surface material" className="flex w-fit gap-1 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-subtle)] p-1">
      {(["solid", "glass"] as AppMaterial[]).map((value) => (
        <button key={value} type="button" onClick={() => chooseMaterial(value)} aria-pressed={material === value}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
            material === value
              ? "bg-[var(--app-surface-active)] text-[var(--app-sidebar-text)] shadow-[0_0_0_1px_var(--accent-primary)]"
              : "text-[var(--text-secondary-light)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-sidebar-text)]",
          )}>
          <Layers3 className="h-3.5 w-3.5" />
          {value === "glass" ? "Glass" : "Solid"}
        </button>
      ))}
    </div>
    </div>
  )
}

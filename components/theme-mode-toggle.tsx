"use client"

import { useEffect, useState } from "react"
import { Flower2, Gem, Leaf, Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Minimal, opt-in theme switch for the 7F "Purple" family.
 *
 *   Purple / dark  → midnight       (default — what production ships)
 *   Purple / light → lavender-mist  (the dormant CSS block, opt-in only)
 *
 * This is a deliberate SIDE-CHANNEL to next-themes, not a replacement.
 * next-themes still owns the `class` attribute (and `.dark`); here we only
 * write `data-theme` on <html>, which is what activates the
 * `[data-theme="lavender-mist"]` block in app/globals.css. Because `:root`
 * still carries the Midnight palette, anything we don't set falls back to
 * it — so Midnight stays the default and nothing here can break it.
 *
 * Persistence: localStorage key `7f-theme`. The pre-paint script in
 * app/layout.tsx reads the same key so a refresh keeps the choice with no
 * flash. KEEP THE KEY IN SYNC with that script if you ever change it.
 */
const THEME_KEY = "7f-theme"
type ThemeMode = "midnight" | "lavender-mist" | "rose-nude" | "sage-luxe" | "noir-or"

/** Allowed palette values — keep in sync with the pre-paint script in app/layout.tsx. */
const VALID_THEMES: ThemeMode[] = ["midnight", "lavender-mist", "rose-nude", "sage-luxe", "noir-or"]

function readStored(): ThemeMode {
  if (typeof window === "undefined") return "midnight"
  const v = window.localStorage.getItem(THEME_KEY)
  return v && (VALID_THEMES as string[]).includes(v) ? (v as ThemeMode) : "midnight"
}

function applyMode(mode: ThemeMode) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", mode)
  }
  try {
    window.localStorage.setItem(THEME_KEY, mode)
  } catch {
    /* storage disabled (private mode) — the attribute still applies for this session */
  }
}

const OPTIONS: { mode: ThemeMode; label: string; icon: typeof Moon }[] = [
  { mode: "midnight", label: "Midnight", icon: Moon },
  { mode: "lavender-mist", label: "Lavender Mist", icon: Sun },
  // Beauty vertical palettes (foundation v1) — opt-in, dormant by default.
  { mode: "rose-nude", label: "Rose Nude", icon: Flower2 },
  { mode: "sage-luxe", label: "Sage Luxe", icon: Leaf },
  { mode: "noir-or", label: "Noir Or", icon: Gem },
]

export function ThemeModeToggle() {
  const [mode, setMode] = useState<ThemeMode>("midnight")
  const [mounted, setMounted] = useState(false)

  /**
   * Read the persisted choice after mount. SSR markup assumes the Midnight
   * default, so we gate the active highlight on `mounted` to avoid a
   * hydration mismatch — the same pattern next-themes uses.
   */
  useEffect(() => {
    setMounted(true)
    setMode(readStored())
  }, [])

  function choose(next: ThemeMode) {
    setMode(next)
    applyMode(next)
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className="flex flex-wrap gap-1 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-subtle)] p-1"
    >
      {OPTIONS.map(({ mode: m, label, icon: Icon }) => {
        const active = mounted && mode === m
        return (
          <button
            key={m}
            type="button"
            onClick={() => choose(m)}
            aria-pressed={active}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50",
              active
                ? "bg-[var(--app-surface-active)] text-[var(--app-sidebar-text)] shadow-[0_0_0_1px_var(--accent-primary)]"
                : "text-[var(--text-secondary-light)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-sidebar-text)]",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

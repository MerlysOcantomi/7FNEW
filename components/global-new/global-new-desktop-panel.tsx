"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  GLOBAL_NEW_GROUP_LABELS,
  actionsByGroup,
  getVisibleGlobalNewActions,
  type GlobalNewGroupId,
} from "@/lib/global-new-config"
import { GlobalNewItem } from "./global-new-item"
import { useGlobalNew } from "./global-new-provider"
import { useManualIntake } from "@/components/manual-intake/manual-intake-provider"

const GROUP_ORDER: GlobalNewGroupId[] = ["capture", "work", "assets", "vertical"]

export function GlobalNewDesktopChrome({
  variant,
  children,
}: {
  variant: "app" | "context"
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { desktopOpen, setDesktopOpen } = useGlobalNew()

  useEffect(() => {
    if (!desktopOpen) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDesktopOpen(false)
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [desktopOpen, setDesktopOpen])

  // ─── Escape to close ──────────────────────────────────────────────
  //
  // Parity with `GlobalTodayDesktopChrome` / `GlobalAgentsDesktopChrome`:
  // every desktop panel in the family closes on Escape, not just on
  // click-outside.
  useEffect(() => {
    if (!desktopOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDesktopOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [desktopOpen, setDesktopOpen])

  return (
    <div ref={ref} className="relative z-30 hidden shrink-0 md:block">
      {children}
      <GlobalNewDesktopPanel variant={variant} />
    </div>
  )
}

export function GlobalNewDesktopPanel({ variant }: { variant: "app" | "context" }) {
  const { desktopOpen, closeAll } = useGlobalNew()
  const { openManualIntake, available: manualIntakeAvailable } = useManualIntake()
  const actions = getVisibleGlobalNewActions()
  const byGroup = actionsByGroup(actions)
  const tone = variant === "app" ? "canvas" : "light"

  // ─── Surface + header tokens per variant ──────────────────────────
  //
  // Mirrors `GlobalTodayDesktopChrome` / `GlobalAgentsDesktopChrome` so
  // the New panel reads as a member of the same family: same icon-halo
  // header, same close affordance, same `border-b` + inset-top-shadow
  // "hangs from the toolbar" recipe, same max-height.
  const panelSurface =
    variant === "app"
      ? "border-[var(--border-dark)] bg-[var(--app-shell-bg)]"
      : "border-border bg-background"
  const headerBorder =
    variant === "app" ? "border-[var(--border-dark)]" : "border-border"
  const headerTitle =
    variant === "app" ? "text-[var(--text-primary-light)]" : "text-foreground"
  const headerSubtitle =
    variant === "app" ? "text-[var(--text-secondary-light)]" : "text-muted-foreground"
  const headerIconHalo =
    variant === "app"
      ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
      : "bg-[#DBEAFE] text-[#2563EB]"
  const headerCloseColour =
    variant === "app"
      ? "text-[var(--text-secondary-light)] hover:bg-white/[0.06] hover:text-[var(--text-primary-light)]"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  const focusRing =
    variant === "app"
      ? "focus-visible:ring-[var(--accent-primary)]/40"
      : "focus-visible:ring-[#3B82F6]/35"

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
        desktopOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
      aria-hidden={!desktopOpen}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={cn(
            // Fill the viewport below the sticky toolbar (≈3rem tall) so the
            // open panel fully covers the underlying page — no page content
            // peeks below it. Body scrolls internally via `overflow-y-auto`.
            "flex h-[calc(100dvh-3rem)] flex-col overflow-hidden border-b shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
            panelSurface,
          )}
        >
          <div
            className={cn(
              "flex shrink-0 items-center justify-between gap-3 border-b px-6 py-3",
              headerBorder,
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                  headerIconHalo,
                )}
              >
                <Plus size={14} strokeWidth={2.25} />
              </span>
              <div className="min-w-0">
                <p className={cn("text-sm font-semibold tracking-tight", headerTitle)}>
                  New
                </p>
                <p className={cn("text-[11px] leading-tight", headerSubtitle)}>
                  Create across your workspace
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeAll}
              aria-label="Close New panel"
              className={cn(
                "rounded-md p-1 transition-colors",
                headerCloseColour,
                "focus-visible:outline-none focus-visible:ring-2",
                focusRing,
              )}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {GROUP_ORDER.map((g) => {
                const items = byGroup[g]
                if (g === "vertical" && items.length === 0) return null
                return (
                  <div key={g}>
                    <p
                      className={cn(
                        "mb-3 text-[10px] font-semibold uppercase tracking-wider",
                        tone === "canvas"
                          ? "text-[var(--text-secondary-light)]"
                          : "text-muted-foreground",
                      )}
                    >
                      {GLOBAL_NEW_GROUP_LABELS[g]}
                    </p>
                    <ul className="space-y-0.5">
                      {items.map((action) => (
                        <li key={action.id}>
                          <GlobalNewItem
                            action={action}
                            variant="desktop"
                            tone={tone}
                            onNavigate={closeAll}
                            onSelect={
                              action.id === "manual-intake" && manualIntakeAvailable
                                ? openManualIntake
                                : undefined
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import {
  GLOBAL_NEW_GROUP_LABELS,
  actionsByGroup,
  getVisibleGlobalNewActions,
  type GlobalNewGroupId,
} from "@/lib/global-new-config"
import { GlobalNewItem } from "./global-new-item"
import { useGlobalNew } from "./global-new-provider"

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

  return (
    <div ref={ref} className="relative z-30 hidden shrink-0 md:block">
      {children}
      <GlobalNewDesktopPanel variant={variant} />
    </div>
  )
}

export function GlobalNewDesktopPanel({ variant }: { variant: "app" | "context" }) {
  const { desktopOpen, closeAll } = useGlobalNew()
  const actions = getVisibleGlobalNewActions()
  const byGroup = actionsByGroup(actions)
  const tone = variant === "app" ? "canvas" : "light"

  const panelSurface =
    variant === "app"
      ? "border-[var(--border-dark)] bg-[var(--app-shell-bg)]"
      : "border-[#E2E8F0] bg-[#F8FAFC]"

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
            "max-h-[min(420px,72vh)] overflow-y-auto border-t shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
            panelSurface,
          )}
        >
          <div className="px-6 py-4">
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
                          : "text-[#94A3B8]",
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

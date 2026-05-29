"use client"

import { Plus } from "lucide-react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import {
  GLOBAL_NEW_GROUP_LABELS,
  actionsByGroup,
  getVisibleGlobalNewActions,
  type GlobalNewGroupId,
} from "@/lib/global-new-config"
import { GlobalNewItem } from "./global-new-item"
import { useGlobalNew } from "./global-new-provider"

const GROUP_ORDER: GlobalNewGroupId[] = ["capture", "work", "assets", "vertical"]

export function GlobalNewMobileSheet() {
  const { mobileOpen, setMobileOpen } = useGlobalNew()
  const actions = getVisibleGlobalNewActions()
  const byGroup = actionsByGroup(actions)

  const close = () => setMobileOpen(false)

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent
        side="bottom"
        className="flex max-h-[85dvh] flex-col rounded-t-[24px] border-t border-[var(--border-dark)] bg-[var(--app-shell-bg)] p-0 [&>button]:top-3"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {/*
            Header aligned with the Today / Agents mobile drawers: icon
            halo + title + subtitle, same px-5 py-3 spacing and dark tokens.
            The Sheet keeps its own built-in close button (top-right).
            Follow-up: migrate this radix Sheet to a vaul Drawer to fully
            match Today/Agents (drag-to-close, 70vh) — deferred to keep this
            PR token-level only.
          */}
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-dark)] px-5 py-3">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
            >
              <Plus size={14} strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <SheetTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary-light)]">
                New
              </SheetTitle>
              <p className="text-[11px] leading-tight text-[var(--text-secondary-light)]">
                Create across your workspace
              </p>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-8">
            {GROUP_ORDER.map((g) => {
              const items = byGroup[g]
              if (g === "vertical" && items.length === 0) return null
              return (
                <div key={g} className="mb-8 last:mb-0">
                  <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary-light)]">
                    {GLOBAL_NEW_GROUP_LABELS[g]}
                  </p>
                  <ul className="space-y-0.5">
                    {items.map((action) => (
                      <li key={action.id}>
                        <GlobalNewItem
                          action={action}
                          variant="mobile"
                          tone="canvas"
                          onNavigate={close}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

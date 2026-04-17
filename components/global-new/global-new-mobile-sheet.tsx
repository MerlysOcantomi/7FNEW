"use client"

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
        <SheetTitle className="sr-only">New</SheetTitle>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-[var(--border-dark)] px-5 pb-3 pt-4">
            <p className="text-sm font-semibold text-[var(--app-sidebar-text)]">New</p>
            <p className="mt-0.5 text-xs text-[var(--text-secondary-light)]">
              Create across your workspace
            </p>
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

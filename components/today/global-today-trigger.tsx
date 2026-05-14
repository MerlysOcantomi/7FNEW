"use client"

import { useRouter } from "next/navigation"
import { Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTodayDrawer } from "@/components/today/today-drawer-provider"

/**
 * Desktop trigger for the global Today surface — visual sibling of
 * `GlobalNewTriggerDesktop`.
 *
 * Lives in the top toolbar of `AppShell` / `ContextShell`, BEFORE the New
 * trigger, because Today is the daily-work surface (read/plan) and is
 * meant to be the operator's first click of the day; New is the capture
 * surface (create) and follows.
 *
 * Visual contract — by design 1:1 with `GlobalNewTriggerDesktop`:
 *   - Same button shape, padding, font size, gap, focus/hover treatment.
 *   - Same `variant="app" | "context"` tone tokens.
 *   - Same "open ring" highlight when the panel is open.
 *
 * The only divergences are semantic:
 *   - `Sun` icon (already canonical for Today across the sidebar nav and
 *     the bottom chrome).
 *   - Label `"Today"`.
 *
 * Wiring:
 *   - `onClick` toggles `useTodayDrawer().open` directly. The shared
 *     provider drives `TodayDesktopBottomChrome` (desktop panel mounted
 *     sticky-bottom inside `<main>`) and `TodayMobileDrawer` (vaul) — so
 *     this single button drives every Today surface in the shell.
 *   - `data-today-trigger="true"` opts the button out of
 *     `TodayDesktopBottomChrome`'s click-outside listener, avoiding the
 *     "mousedown closes -> onClick reopens" race when the trigger is
 *     clicked while the panel is open. The guard lives in the chrome
 *     (the orchestrator) — any future Today trigger only needs the
 *     attribute to inherit the behavior.
 *   - `aria-controls="today-bottom-chrome"` points to the panel id (set
 *     in `today-desktop-bottom-chrome.tsx`) for AT users.
 */
export function GlobalTodayTriggerDesktop({ variant }: { variant: "app" | "context" }) {
  const { open, setOpen } = useTodayDrawer()

  const base =
    variant === "app"
      ? "rounded-lg border border-[var(--border-dark)] bg-white/[0.06] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary-light)] hover:bg-white/10"
      : "rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm font-medium text-[#334155] shadow-sm hover:bg-[#F1F5F9]"

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      data-today-trigger="true"
      aria-expanded={open}
      aria-haspopup="true"
      aria-controls="today-bottom-chrome"
      className={cn(
        "flex cursor-pointer items-center gap-1.5 transition-colors",
        base,
        open &&
          (variant === "app"
            ? "bg-white/10 ring-2 ring-[var(--accent-primary)]/40"
            : "bg-[#F1F5F9] ring-2 ring-[#3B82F6]/30"),
      )}
    >
      <Sun className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
      <span>Today</span>
    </button>
  )
}

/**
 * Mobile trigger for the global Today drawer — visual sibling of
 * `GlobalNewTriggerMobile`.
 *
 * Icon-only (Sun), same hit area, same hover/active tokens as the New
 * mobile trigger so the mobile header reads as a coherent action row.
 * Mounted in `MobileSidebarNav`'s header BEFORE the New / Search / Menu
 * icons.
 *
 * Behavior depends on whether a `<TodayDrawerProvider>` is visible from
 * this trigger's position in the tree:
 *
 *   - Inside the workspace shells (`AppShell`, `ContextShell`)
 *     `MobileSidebarNav` IS inside the provider, so the trigger calls
 *     `openToday()` and the existing mobile vaul drawer slides up.
 *   - On legacy pages (`/`, `/clientes`, `/proyectos`, `/finanzas`,
 *     `/facturacion`, `/agente`, `/assistant`, `/motor`)
 *     `MobileSidebarNav` is rendered ABOVE `<LegacyTodayChrome>`, so
 *     the provider is not visible from here. The hook returns the noop
 *     fallback (`available: false`) and we route to `/today` instead —
 *     the operator still gets a Today entry from the mobile header
 *     without us having to refactor every legacy page to wrap
 *     `<MobileSidebarNav>` in a provider it doesn't otherwise need.
 *
 * Either way, the button ALWAYS does something on tap — never a silent
 * no-op.
 *
 * `openToday()` (one-way) is preferred over toggling on mobile: vaul's
 * own swipe/back-press handling is the canonical close path — having a
 * header tap also close would conflict with the drag gesture.
 */
export function GlobalTodayTriggerMobile() {
  const { open, openToday, available } = useTodayDrawer()
  const router = useRouter()

  const onClick = () => {
    if (available) {
      openToday()
    } else {
      router.push("/today")
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-today-trigger="true"
      aria-label="Today"
      aria-expanded={available ? open : undefined}
      className={cn(
        "rounded-md p-1.5 text-[var(--app-sidebar-text-muted)] transition-colors hover:bg-white/10 hover:text-white",
        available && open && "text-white",
      )}
    >
      <Sun size={22} strokeWidth={2} />
    </button>
  )
}

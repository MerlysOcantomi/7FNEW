"use client"

import { Sparkles, X } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer"
import { useActiveWorkspace } from "@/hooks/use-active-workspace"
import { useIsMobile } from "@/hooks/use-mobile"
import { resolveVerticalSpecialist } from "@core/vertical-packs/specialists"
import { FINESSE_ASSISTANT_COPY as COPY } from "@modules/assistant/finesse-assistant"
import { useFinesseAssistant } from "./finesse-assistant-provider"
import {
  FinesseAssistantConversation,
  FinesseAssistantIdentity,
} from "./finesse-assistant-conversation"

/**
 * Global Ask Finesse chrome: ONE floating launcher + the contextual panel.
 *
 * Mounted once by the shared shells (`AppShell`, `ContextShell`) so the
 * assistant appears automatically on every Finesse page — never added
 * per-page, never duplicated in page headers (the floating launcher is the
 * only persistent entry point; mission §5).
 *
 * Vertical gating: renders ONLY when the active workspace resolves to a
 * vertical specialist (Beauty → Finesse), or under the `?vertical=beauty`
 * design-preview helper. Other verticals ship zero assistant UI or JS beyond
 * this cheap gate.
 *
 * Form factors:
 *  - Desktop (md+): pill launcher bottom-right → right-side Sheet panel
 *    (Radix dialog → focus trap, Escape, ARIA roles and focus restoration to
 *    the launcher come built in). The page stays visible behind the overlay.
 *  - Mobile: circular launcher above the safe-area inset → vaul bottom
 *    drawer (drag-to-close, keyboard/safe-area handling out of the box).
 *
 * Overlap discipline: the launcher sits at z-40 — BELOW toasts (z-[200]) and
 * below any Radix/vaul overlay (z-50), so it can never cover a toast, a
 * dialog action or the assistant itself; while any modal is open the
 * backdrop covers the launcher. Content clearance is handled by the shells
 * (extra bottom padding when the launcher is mounted).
 */
export function GlobalFinesseAssistantChrome() {
  const searchParams = useSearchParams()
  const { workspace } = useActiveWorkspace()
  const { open, setOpen, available } = useFinesseAssistant()
  const isMobile = useIsMobile()

  const forcedBeauty = searchParams.get("vertical") === "beauty"
  const specialist = resolveVerticalSpecialist(
    forcedBeauty ? "beauty" : workspace?.verticalKey,
  )

  if (!available || !specialist) return null

  return (
    <>
      <FinesseLauncher />
      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent
            className="bg-[var(--app-surface-dark)] text-[var(--text-primary-light)] data-[vaul-drawer-direction=bottom]:max-h-[88dvh]"
            aria-describedby={undefined}
          >
            <DrawerTitle className="sr-only">{COPY.panelTitle}</DrawerTitle>
            <DrawerDescription className="sr-only">{COPY.panelSubtitle}</DrawerDescription>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-dark)] px-4 py-3">
              <FinesseAssistantIdentity />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={COPY.close}
                className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-secondary-light)] transition-colors hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            {/* Fixed height keeps the composer reachable above the keyboard. */}
            <div className="flex h-[72dvh] min-h-0 flex-col pb-[env(safe-area-inset-bottom)]">
              <FinesseAssistantConversation />
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="right"
            className="w-full gap-0 border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-0 text-[var(--text-primary-light)] sm:max-w-[420px] [&>button]:hidden"
          >
            <SheetTitle className="sr-only">{COPY.panelTitle}</SheetTitle>
            <SheetDescription className="sr-only">{COPY.panelSubtitle}</SheetDescription>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-dark)] px-4 py-3.5">
              <FinesseAssistantIdentity />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={COPY.close}
                className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-secondary-light)] transition-colors hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <FinesseAssistantConversation />
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}

/**
 * The floating launcher. Desktop: labeled pill. Mobile: icon circle above the
 * device safe area. Stays mounted while the panel is open (behind the modal
 * overlay) so Radix/vaul can restore focus to it on close.
 */
function FinesseLauncher() {
  const { openAssistant, open } = useFinesseAssistant()

  return (
    <>
      {/* Desktop pill */}
      <button
        type="button"
        data-finesse-launcher
        onClick={openAssistant}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={COPY.launcherAria}
        className="fixed bottom-5 right-6 z-40 hidden items-center gap-2 rounded-2xl px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_14px_30px_-12px_color-mix(in_srgb,var(--accent-primary)_80%,transparent)] transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100 md:inline-flex"
        style={{
          background:
            "linear-gradient(135deg, var(--accent-primary), var(--accent-rich, var(--accent-primary-hover, var(--accent-primary))))",
        }}
      >
        <Sparkles size={15} strokeWidth={2} aria-hidden="true" />
        {COPY.launcherLabel}
      </button>

      {/* Mobile circle — above the safe-area inset, right side. */}
      <button
        type="button"
        data-finesse-launcher
        onClick={openAssistant}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={COPY.launcherAria}
        className="fixed right-4 z-40 grid h-[52px] w-[52px] place-items-center rounded-full text-white shadow-[0_14px_30px_-10px_color-mix(in_srgb,var(--accent-primary)_85%,transparent)] transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 motion-reduce:transition-none md:hidden"
        style={{
          bottom: "calc(1.25rem + env(safe-area-inset-bottom))",
          background:
            "linear-gradient(135deg, var(--accent-primary), var(--accent-rich, var(--accent-primary-hover, var(--accent-primary))))",
        }}
      >
        <Sparkles size={21} strokeWidth={2} aria-hidden="true" />
      </button>
    </>
  )
}

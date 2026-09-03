"use client"

import { FinesseAssistantProvider, useFinesseAssistant } from "./finesse-assistant-provider"
import { GlobalFinesseAssistantChrome } from "./global-finesse-assistant"

/**
 * Ensure-once scope for the Finesse assistant (FINESSE-UI-02 R1).
 *
 * `AppShell` and `ContextShell` mount `FinesseAssistantProvider` + the global
 * chrome themselves, but the legacy manual layouts (`/clientes`, `/facturacion`,
 * `/proyectos`, `/finanzas`, `/agente`, `/motor`) render `SidebarNav` +
 * `MobileSidebarNav` directly, outside any provider — so the mobile bar's
 * center mic had no assistant to open there.
 *
 * This component closes that gap with the SMALLEST correct reuse: if a provider
 * is already above (the `available` flag of the real context), it renders its
 * children untouched — never a second provider, never a second chrome. Only
 * when NO provider exists does it wrap the subtree in the existing provider and
 * mount the existing chrome, restricted to the mobile viewport (`md:hidden`)
 * so desktop legacy pages stay byte-for-byte as they were. The chrome keeps
 * its own vertical gating (Beauty → Finesse; other verticals render nothing).
 *
 * No new voice logic, no new contracts: the provider and chrome are the very
 * same modules the shells already use. The provider does no network on mount.
 */
export function FinesseAssistantScope({ children }: { children: React.ReactNode }) {
  const { available } = useFinesseAssistant()
  if (available) return <>{children}</>
  return (
    <FinesseAssistantProvider>
      {children}
      {/*
        Mobile-only fallback chrome (drawer + launcher). The launcher itself is
        hidden by app/globals.css while the bottom bar is present — the bar's
        mic is the launcher — so on these pages only the drawer becomes visible,
        and only when opened. The wrapper is display:none from `md` up, which
        also hides the fixed launcher descendants on desktop.
      */}
      <div className="md:hidden">
        <GlobalFinesseAssistantChrome />
      </div>
    </FinesseAssistantProvider>
  )
}

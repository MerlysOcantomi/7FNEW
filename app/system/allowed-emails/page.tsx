import { Mail } from "lucide-react"
import { requireAnyPlatformRole } from "@/lib/auth/platform-auth"
import { listAllowedEmails } from "@core/system/allowed-emails"
import { AllowedEmailsManager } from "@/components/system/allowed-emails-manager"

/**
 * Allowed emails management for the SevenF System Admin area.
 *
 * Read access requires `requireAnyPlatformRole()`. Mutations on the API side
 * require `requirePlatformAdmin()`, so SUPPORT/BILLING admins can browse the
 * list but cannot add/edit/delete. We also forward `canMutate` to the client
 * so disabled buttons reflect that boundary visually instead of letting the
 * user click and discover a 403 mid-action.
 *
 * Why server-load + client-mutate:
 *   - Server load is consistent with the rest of `/system/...` (one source
 *     of truth, no flash of empty state, same whitelist as the API).
 *   - After every mutation the client triggers `router.refresh()` so this
 *     server component re-renders and the table reflects the new state
 *     without us having to keep a parallel client cache.
 */
export const dynamic = "force-dynamic"

export const metadata = {
  title: "Allowed emails · SevenF System Admin",
}

export default async function SystemAllowedEmailsPage() {
  const { platformRole } = await requireAnyPlatformRole()
  const emails = await listAllowedEmails()

  /**
   * Mutation gate. Mirrors the API gate (`requirePlatformAdmin()` ≥ ADMIN)
   * so the UI never offers an action the server would refuse. SUPER_ADMIN
   * inherits ADMIN.
   */
  const canMutate = platformRole === "SUPER_ADMIN" || platformRole === "ADMIN"

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
          <Mail size={16} />
          <h1 className="text-base font-semibold">Allowed emails (allowlist)</h1>
        </div>
        <p className="text-xs text-amber-900/70 dark:text-amber-100/60">
          Lista blanca global para invite-only Google login. Cada email lleva
          un rol legacy (admin / editor / viewer) que se hereda al crear el
          usuario en su primer login. Mutaciones requieren rol de plataforma{" "}
          <span className="font-medium">ADMIN</span> o superior.
        </p>
      </header>

      <AllowedEmailsManager initial={emails} canMutate={canMutate} />
    </div>
  )
}

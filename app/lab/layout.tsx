import type { ReactNode } from "react"
import { requireLabAvailability } from "@core/lab/gate"
import { LabEnvironmentBanner } from "@/components/lab/lab-environment-banner"

/**
 * `/lab/*` — Mr Forte Lab namespace (DEV-PREVIEW-01A).
 *
 * The middleware evaluates the fail-closed gate at the edge and 404s denied
 * requests before this segment renders. This layout (and each lab page)
 * re-checks the gate as a second layer so nothing lab-branded renders or
 * streams even if the edge layer were bypassed. Intentionally standalone:
 * no AppShell, no sidebar, no links into the real product surfaces.
 */

// The gate reads request headers + private env → never statically prerendered.
export const dynamic = "force-dynamic"

export default async function LabLayout({ children }: { children: ReactNode }) {
  await requireLabAvailability()
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LabEnvironmentBanner />
      <main className="mx-auto w-full max-w-3xl px-6 py-10">{children}</main>
    </div>
  )
}

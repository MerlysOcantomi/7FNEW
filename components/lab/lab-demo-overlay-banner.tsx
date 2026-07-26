import { isLabDemoActiveSession } from "@core/lab/demo-banner"

/**
 * Permanent Lab marker for the REAL Sevenef surfaces (DEV-PREVIEW-01C).
 *
 * A fixed overlay strip rendered from the root layout so it stays visible on
 * every authenticated route without modifying the viewport-bounded AppShell.
 * It renders ONLY when `isLabDemoActiveSession()` is true (gate + demo user +
 * demo workspace), so it never appears in production or for any other
 * user/workspace. The check is server-derived — no public/browser variable
 * controls it.
 */
export async function LabDemoOverlayBanner() {
  const active = await isLabDemoActiveSession()
  if (!active) return null
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 py-1.5"
    >
      <span className="pointer-events-auto rounded-full border border-amber-500/40 bg-amber-500/95 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-amber-950 shadow-lg">
        Mr Forte Lab · Preview · Fictional data
      </span>
    </div>
  )
}

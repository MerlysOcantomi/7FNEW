import { redirect } from "next/navigation"
import { getSessionFromCookies } from "@/lib/auth/session"
import { ShieldCheck, ArrowLeft, LogOut } from "lucide-react"
import { SystemNav } from "@/components/system/system-nav"

export const metadata = {
  title: "SevenF System Admin",
  description: "Control plane for the 7F SaaS platform",
}

/**
 * Layout for the SevenF System Admin area (`/system`).
 *
 * UX rules enforced here:
 *   - This shell is INTENTIONALLY different from the workspace `AppShell`
 *     (no `SidebarNav`, no inbox/clients/etc). The amber accent makes it
 *     visually unambiguous that you are in the control plane and NOT inside
 *     a customer workspace.
 *   - Internal navigation lives in `SystemNav` (sections: Dashboard,
 *     Workspaces, Users, Allowed emails, Audit). It uses `next/link`, so
 *     clicks stay inside the platform shell — no full reload, no cookie
 *     side-effects.
 *   - "Volver al workspace" stays separate from the section nav because it
 *     EXITS the shell. It's a hard link to `/` — it does NOT manipulate
 *     `wf_workspace`, it just takes the admin back to the same workspace
 *     they were already in (the cookie was never modified by entering
 *     `/system`).
 *   - Sign out hits the existing endpoint which clears both `7f-session` and
 *     `wf_workspace`.
 *
 * Security:
 *   - The middleware (`middleware.ts`) is the primary gate, blocking the
 *     route for anyone whose JWT lacks `platformRole`.
 *   - This layout adds defence in depth: if the session is missing or the
 *     claim is absent, we redirect before rendering. This catches the edge
 *     case where the middleware allowlist drifts.
 *   - Per-action endpoints under `/api/system/**` re-validate against the
 *     DB via `requirePlatformRole`, so revoked admins can't use stale JWTs.
 */
export default async function SystemLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSessionFromCookies()
  if (!session) redirect("/login")
  if (!session.platformRole) redirect("/?error=forbidden_platform")

  return (
    <div className="flex min-h-dvh flex-col bg-amber-50/40 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-amber-300/60 bg-amber-100/80 backdrop-blur dark:border-amber-900/40 dark:bg-amber-950/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/40 dark:text-amber-300">
              <ShieldCheck size={15} />
            </span>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                SevenF System Admin
              </span>
              <span className="truncate text-[11px] text-amber-700/80 dark:text-amber-200/70">
                Platform · {session.email} · {session.platformRole}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/60 bg-white/60 px-2.5 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-white/90 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/60"
            >
              <ArrowLeft size={12} />
              <span>Volver al workspace</span>
            </a>
            <a
              href="/api/auth/logout"
              className="inline-flex items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-xs font-medium text-amber-900/80 transition-colors hover:bg-amber-200/60 dark:text-amber-100/80 dark:hover:bg-amber-950/40"
            >
              <LogOut size={12} />
              <span>Sign out</span>
            </a>
          </div>
        </div>
      </header>

      <SystemNav />

      <main className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8">
          {children}
        </div>
      </main>

      <footer className="border-t border-amber-200/50 px-4 py-2 text-center text-[10px] uppercase tracking-wide text-amber-800/60 dark:border-amber-900/30 dark:text-amber-200/40">
        Control plane · NOT a customer workspace
      </footer>
    </div>
  )
}

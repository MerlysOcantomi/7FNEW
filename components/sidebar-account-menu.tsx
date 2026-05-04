"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useUser } from "@/hooks/use-user"
import { useActiveWorkspace, type ActiveWorkspaceSummary } from "@/hooks/use-active-workspace"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { AccountCenterPanel } from "@/components/account-center/account-center-panel"
import { cn } from "@/lib/utils"

interface SidebarAccountMenuProps {
  collapsed: boolean
  /**
   * Inbox-focused mode tightens the sidebar gutters; the account menu uses this
   * to pick a slimmer footer layout. Visual-only — the data and logout behaviour
   * are identical in either mode.
   */
  focused?: boolean
}

/**
 * Friendly label for `WorkspaceMember.role` strings (which are not enums in
 * Prisma — see audit notes). We normalise unknown values to "Member" so a
 * legacy or mistyped value never surfaces raw text in the trigger.
 */
function formatRoleLabel(role: string | null | undefined): string {
  switch ((role ?? "").toUpperCase()) {
    case "OWNER":
      return "Owner"
    case "ADMIN":
      return "Admin"
    case "MEMBER":
      return "Member"
    case "VIEWER":
      return "Viewer"
    default:
      return "Member"
  }
}

/**
 * Two-letter avatar fallback derived from the display name; falls back to the
 * email's local-part initial if no name is set, and finally to "?". Pure
 * presentation — never displays anything that wasn't already on `session`.
 */
function getInitials(name: string | null | undefined, email: string | undefined): string {
  const safeName = (name ?? "").trim()
  if (safeName.length > 0) {
    const parts = safeName.split(/\s+/).filter(Boolean)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  const local = (email ?? "").split("@")[0]
  if (local.length > 0) return local.slice(0, 2).toUpperCase()
  return "?"
}

/**
 * Bottom sidebar account trigger.
 *
 * The trigger lives at the bottom of the sidebar (desktop expanded /
 * collapsed and inside the mobile sheet) with the same avatar +
 * name/email/role footprint it always had.
 *
 * What it opens: a left-anchored **Sheet drawer** that overlays the
 * sidebar with a roomy, scrollable Account Center surface
 * (`<AccountCenterPanel>`). The Sheet is the same primitive used for
 * the global "New" mobile sheet, just anchored to the left edge so it
 * appears to "extend" the sidebar where the trigger sits, instead of
 * a popover that gets clipped or compressed by the narrow column.
 *
 * Why not a Popover anymore:
 *   The previous inline expansion sat inside the sidebar's narrow
 *   container and had its content clipped on every viewport — emails,
 *   slugs and descriptions truncated mid-word. A drawer with a fixed
 *   480px width on desktop and full width on mobile gives the panel
 *   enough room to breathe without competing with the sidebar.
 *
 * Sheet primitives already do all the close behaviours we need:
 *   - Esc key             → handled by Radix Dialog
 *   - Click on overlay    → handled by Radix Dialog
 *   - Close button (X)    → rendered automatically by `SheetContent`
 *   - Pathname change     → handled below in a small effect (Radix
 *                           does not auto-close on route change, and
 *                           we want the same UX as `GlobalNewProvider`)
 *
 * Backend behaviour preserved verbatim:
 *   - `useUser()`            → `/api/auth/me`
 *   - `useActiveWorkspace()` → `/api/workspaces`
 *   - Switch                 → `POST /api/workspaces/active` + hard reload
 *   - Sign out               → `window.location.href = "/api/auth/logout"`
 *   - Platform link          → hard `<a href="/system">` (preserves the
 *                              `wf_workspace` cookie boundary; `/system`
 *                              is NOT a workspace)
 *
 * No new endpoints, no auth changes, no PlatformAdmin reads.
 */
export function SidebarAccountMenu({ collapsed, focused = false }: SidebarAccountMenuProps) {
  const { user, loading: userLoading, isPlatformAdmin, platformRole } = useUser()
  const {
    workspace,
    workspaces,
    loading: wsLoading,
    error: wsError,
  } = useActiveWorkspace()

  const [open, setOpen] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  /**
   * Close on path change. Radix Dialog (the underlying Sheet) doesn't
   * auto-close when the route changes; users who click a Settings link
   * or workspace switch should never end up with a drawer still open
   * on the next route. Mirrors `GlobalNewProvider`'s behaviour for the
   * New menu.
   */
  const pathname = usePathname()
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const initials = useMemo(
    () => getInitials(user?.nombre, user?.email),
    [user?.nombre, user?.email],
  )

  /**
   * Workspaces *other than* the active one — what the panel's "Switch
   * workspace" section iterates. Kept derived (not stored) so it stays
   * in sync with `useActiveWorkspace()` whenever the active workspace
   * flips. The filter is purely visual: the server re-validates
   * membership inside `POST /api/workspaces/active` regardless of what
   * the client lists. If `workspace` is `null` (loading / 401), we fall
   * back to showing every workspace as switchable so the UX recovers
   * gracefully when the active cookie is stale.
   */
  const otherWorkspaces = useMemo(
    () =>
      workspace
        ? workspaces.filter((w) => w.id !== workspace.id)
        : workspaces,
    [workspaces, workspace],
  )

  const handleLogout = () => {
    setLoggingOut(true)
    /**
     * Hard navigation so the entire React tree unmounts and any cached
     * fetches (workspaces, conversations, todos, drafts) are discarded
     * before the next user lands.
     */
    window.location.href = "/api/auth/logout"
  }

  const handleSwitch = async (target: ActiveWorkspaceSummary) => {
    if (!target?.id || target.id === workspace?.id) return
    setSwitchError(null)
    setSwitchingId(target.id)
    try {
      const res = await fetch("/api/workspaces/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ workspaceId: target.id }),
      })
      if (!res.ok) {
        let message = `Could not switch workspace (HTTP ${res.status})`
        try {
          const json = await res.json()
          const errMsg =
            (json?.error?.message as string | undefined)
            ?? (typeof json?.message === "string" ? json.message : undefined)
          if (errMsg) message = errMsg
        } catch {
          /** Non-JSON response — keep the generic message. */
        }
        setSwitchError(message)
        setSwitchingId(null)
        return
      }
      window.location.reload()
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : "Network error switching workspace")
      setSwitchingId(null)
    }
  }

  if (userLoading || !user) {
    return (
      <FooterShell collapsed={collapsed} focused={focused}>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--app-sidebar-surface)] text-[var(--app-sidebar-text-muted)]">
          <Loader2 size={14} className="animate-spin" />
        </div>
        {!collapsed && (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-medium text-[var(--app-sidebar-text-muted)]">
              Loading…
            </span>
          </div>
        )}
      </FooterShell>
    )
  }

  const displayName = user.nombre?.trim() || user.email
  const roleLabel = workspace ? formatRoleLabel(workspace.role) : null

  return (
    <FooterShell collapsed={collapsed} focused={focused} interactive>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40",
              "hover:bg-[var(--app-sidebar-surface)]/60",
              collapsed ? "justify-center p-1" : "p-1",
              open && "bg-[var(--app-sidebar-surface)]/60",
            )}
            title={collapsed ? `${displayName}${workspace ? ` · ${workspace.nombre}` : ""}` : undefined}
            aria-label="Open account center"
          >
            {user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar}
                alt=""
                referrerPolicy="no-referrer"
                className="h-7 w-7 rounded-full object-cover ring-1 ring-[var(--app-sidebar-border)]"
              />
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--app-sidebar-surface)] text-xs font-medium text-[var(--app-sidebar-text)] ring-1 ring-[var(--app-sidebar-border)]">
                {initials}
              </div>
            )}
            {!collapsed && (
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-xs font-medium text-[var(--app-sidebar-text)]">
                  {displayName}
                </span>
                <span className="truncate text-[10px] text-[var(--app-sidebar-text-muted)]">
                  {workspace?.nombre ?? (wsLoading ? "Loading workspace…" : "No workspace")}
                  {roleLabel ? ` · ${roleLabel}` : ""}
                </span>
              </div>
            )}
          </button>
        </SheetTrigger>

        {/**
         * Drawer surface. We override the Sheet defaults (which cap at
         * `sm:max-w-sm` ≈ 384px) so the panel gets the 480–520px range
         * the brief asked for. `cn` resolves the conflict via
         * `tailwind-merge` so the override wins cleanly.
         *
         * Layout: full flex column with no padding (the panel manages
         * its own spacing); `gap-0` cancels the default `gap-4` of
         * `SheetContent` which would otherwise push the close button
         * around. Background uses the same canvas surface as the New
         * menu so both surfaces feel like the same family.
         *
         * Side: anchored LEFT so it appears to extend the sidebar that
         * triggered it. The user's eye stays in the same region of the
         * screen instead of darting to the right.
         */}
        <SheetContent
          side="left"
          className={cn(
            "flex h-full flex-col gap-0 p-0",
            "w-full max-w-[520px] sm:w-[480px] sm:max-w-[480px]",
            "border-r border-[var(--border-dark)] bg-[var(--app-shell-bg)] text-[var(--app-sidebar-text)]",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
          )}
        >
          {/**
           * Required by Radix Dialog for screen readers. We hide them
           * visually because the panel header already presents the
           * same info to sighted users (avatar + name + email).
           */}
          <SheetTitle className="sr-only">Account center</SheetTitle>
          <SheetDescription className="sr-only">
            Active workspace, workspace switcher, platform admin link, settings, and sign out.
          </SheetDescription>

          <AccountCenterPanel
            user={{
              email: user.email,
              nombre: user.nombre,
              avatar: user.avatar,
              initials,
            }}
            workspace={workspace}
            otherWorkspaces={otherWorkspaces}
            isPlatformAdmin={isPlatformAdmin}
            platformRole={platformRole}
            switchingId={switchingId}
            switchError={switchError}
            loggingOut={loggingOut}
            wsLoading={wsLoading}
            wsError={wsError}
            onSwitch={handleSwitch}
            onLogout={handleLogout}
            onClose={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </FooterShell>
  )
}

/**
 * Wraps the trigger area so the desktop and mobile usages share the same
 * border / padding rules without duplicating layout strings. `interactive`
 * removes the static padding because the inner button supplies its own.
 */
function FooterShell({
  children,
  collapsed,
  focused,
  interactive = false,
}: {
  children: React.ReactNode
  collapsed: boolean
  focused: boolean
  interactive?: boolean
}) {
  if (collapsed) {
    return (
      <div className="flex shrink-0 justify-center border-t border-[var(--app-sidebar-border)] pb-5 pt-4">
        {children}
      </div>
    )
  }
  return (
    <div
      className={cn(
        "shrink-0 border-t border-[var(--app-sidebar-border)]",
        focused ? "px-3 pb-4 pt-3" : "px-4 pb-5 pt-4",
        interactive && "px-2",
      )}
    >
      {children}
    </div>
  )
}

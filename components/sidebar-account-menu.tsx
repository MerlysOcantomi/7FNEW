"use client"

import { useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { useUser } from "@/hooks/use-user"
import { useActiveWorkspace, type ActiveWorkspaceSummary } from "@/hooks/use-active-workspace"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
 * The trigger itself stays where it always lived — at the bottom of the
 * sidebar (desktop expanded / collapsed and inside the mobile sheet) —
 * with the same avatar + name/email/role footprint. What changed is the
 * *surface* it opens: the cramped `<DropdownMenu>` was replaced by a
 * larger Account Center `<Popover>` panel that mirrors the visual
 * language of the global "New" menu (`components/global-new/*`):
 *
 *   - Surface tone     → `bg-[var(--app-shell-bg)]` + `border-[var(--border-dark)]`
 *   - Section labels   → uppercase tracking-wider muted
 *   - Action rows      → 36px icon chip + title + sub-text + hover band
 *   - Two-column grid  → `sm:grid-cols-2` like the New panel
 *
 * Backend behaviour is preserved verbatim:
 *
 *   - `useUser()`            → `/api/auth/me`
 *   - `useActiveWorkspace()` → `/api/workspaces`
 *   - Switch                 → `POST /api/workspaces/active` + hard reload
 *   - Sign out               → `window.location.href = "/api/auth/logout"`
 *   - Platform link          → hard `<a href="/system">` (preserves the
 *                              `wf_workspace` cookie boundary; `/system`
 *                              is NOT a workspace)
 *
 * No new endpoints, no auth changes, no PlatformAdmin reads. The panel
 * is a pure presentation refactor.
 */
export function SidebarAccountMenu({ collapsed, focused = false }: SidebarAccountMenuProps) {
  const { user, loading: userLoading, isPlatformAdmin, platformRole } = useUser()
  const {
    workspace,
    workspaces,
    loading: wsLoading,
    error: wsError,
  } = useActiveWorkspace()

  /**
   * Workspace switcher state. `switchingId` disables every row while a
   * POST is in flight; `switchError` surfaces 403/network failures
   * without dumping to console alone. `loggingOut` mirrors the same
   * pattern for the sign-out button.
   *
   * Security note: this state is purely UX. The decision of "can this
   * user switch into workspace X" lives entirely on the server in
   * `POST /api/workspaces/active`, which validates membership before
   * flipping the cookie. We never bypass it.
   */
  const [open, setOpen] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

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
     * before the next user lands. A SPA-style `router.push` would keep
     * the in-memory cache.
     */
    window.location.href = "/api/auth/logout"
  }

  /**
   * Switch the active workspace. Hard-reload on success so every
   * workspace-scoped fetch in the running app (Inbox conversations,
   * channels, clients, todos, drafts, dashboards) re-runs against the
   * new tenant. A `router.refresh()` alone would re-fetch server
   * components but leave the in-memory client `useFetch` caches
   * pointing at the previous workspace — that's the kind of cross-tenant
   * leak the recent audit specifically warns against.
   *
   * Errors keep the panel open with an inline message so the user can
   * pick another workspace or retry without re-opening it.
   */
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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
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
        </PopoverTrigger>

        {/**
         * Panel surface. We override most of the default Popover styles
         * because this surface follows the New menu's visual language
         * (panel-canvas, large radius, subtle inset highlight), not the
         * generic dropdown look.
         *
         * `side`/`align`:
         *   - Desktop expanded   → side="top" align="start" (panel rises
         *     from the bottom-left of the sidebar like a card lifting
         *     off the trigger).
         *   - Desktop collapsed  → side="right" align="end" (panel pops
         *     out to the right since the sidebar is too narrow to fit
         *     the panel above).
         *   - Mobile             → same `top/start` config; Radix's
         *     collision detection will reposition it inside the viewport
         *     automatically, and the responsive width caps below keep
         *     it within the screen.
         */}
        <PopoverContent
          side={collapsed ? "right" : "top"}
          align={collapsed ? "end" : "start"}
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            "z-50 w-[min(560px,calc(100vw-1.5rem))] overflow-hidden p-0",
            "rounded-2xl border border-[var(--border-dark)] bg-[var(--app-shell-bg)] text-[var(--app-sidebar-text)]",
            "shadow-2xl shadow-black/40 ring-1 ring-white/[0.04]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          )}
        >
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
        </PopoverContent>
      </Popover>
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

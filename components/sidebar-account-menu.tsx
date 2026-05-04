"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useUser } from "@/hooks/use-user"
import { useActiveWorkspace, type ActiveWorkspaceSummary } from "@/hooks/use-active-workspace"
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
 * What changed: the surface that opens is now an **inline expansion
 * panel** mirroring the global "New" menu pattern from
 * `components/global-new/global-new-desktop-panel.tsx`. We use the
 * exact same animation primitive — `grid-template-rows: 0fr ↔ 1fr` —
 * so the panel grows out of the sidebar instead of overlaying as a
 * floating popover. The Account Center is positioned `bottom-full`
 * relative to the trigger so it expands UPWARD (the trigger is at the
 * bottom of the sidebar), the inverse of the New menu which expands
 * downward from the top header.
 *
 * Manual handlers (because we are not using Radix anymore):
 *   - Click outside  → close (mirrors `GlobalNewDesktopChrome`)
 *   - Escape         → close + restore focus to the trigger
 *   - Pathname change → close (matches `GlobalNewProvider`)
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

  const containerRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const pathname = usePathname()

  /**
   * Close on outside click. Mirrors the `mousedown` pattern from
   * `GlobalNewDesktopChrome` so the close gesture is identical to the
   * New menu — clicking anywhere outside the panel + trigger collapses
   * it. We listen on `mousedown` (not `click`) so a drag that starts
   * outside doesn't slip through.
   */
  useEffect(() => {
    if (!open) return
    function handleDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleDown)
    return () => document.removeEventListener("mousedown", handleDown)
  }, [open])

  /**
   * Close on Escape and restore focus to the trigger so keyboard users
   * land in a predictable place. Same UX contract as Radix Popover —
   * we re-implement it here because the panel is inline now, not a
   * portalled popover.
   */
  useEffect(() => {
    if (!open) return
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open])

  /**
   * Close on path change. Same behaviour as `GlobalNewProvider` —
   * users who click a Settings link or workspace switch should never
   * end up with a panel still open on the next route.
   */
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
      <div ref={containerRef} className="relative">
        {/**
         * Inline expansion panel — same animation primitive as
         * `GlobalNewDesktopPanel`: a `grid` whose first row morphs from
         * `0fr` to `1fr`. The inner overflow-hidden wrapper turns this
         * into a smooth height animation without measuring DOM heights
         * by hand.
         *
         * Anchored `bottom-full` (above the trigger) because the
         * trigger is at the BOTTOM of the sidebar — the inverse of the
         * New menu which is anchored top-full (below the trigger) at
         * the top of the chrome.
         *
         * Width: `w-[min(340px,calc(100vw-1rem))]` — the panel is
         * intentionally wider than the (often narrow) sidebar so it
         * spills to the right rather than cramping content. In a
         * collapsed sidebar (~56px wide) the panel becomes a lateral
         * drawer; in an expanded sidebar (~240px) it overhangs about
         * 100px to the right; in a mobile sheet (~280–320px) it caps
         * to viewport width. Consistent visual size across every
         * breakpoint.
         *
         * `pointer-events-none` while collapsed so any half-faded
         * action rows can't be clicked through during the transition.
         */}
        <div
          className={cn(
            "absolute bottom-full left-0 z-40 mb-1.5",
            "w-[min(340px,calc(100vw-1rem))]",
            "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            !open && "pointer-events-none",
          )}
          aria-hidden={!open}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className={cn(
                "max-h-[min(75vh,640px)] overflow-y-auto",
                "rounded-2xl border border-[var(--border-dark)] bg-[var(--app-shell-bg)] text-[var(--app-sidebar-text)]",
                "shadow-2xl shadow-black/40 ring-1 ring-white/[0.04]",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                "transition-opacity duration-150",
                open ? "opacity-100" : "opacity-0",
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
            </div>
          </div>
        </div>

        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="menu"
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
      </div>
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

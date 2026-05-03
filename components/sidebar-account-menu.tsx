"use client"

import { useMemo } from "react"
import { LogOut, Building2, Loader2 } from "lucide-react"
import { useUser } from "@/hooks/use-user"
import { useActiveWorkspace } from "@/hooks/use-active-workspace"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
 * legacy or mistyped value never surfaces raw text in the UI.
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
 * Replaces the previous mock footer ("Executive Admin / admin@7fcopilot.com / EA"
 * placeholder) with the real authenticated session + active workspace, plus a
 * visible Sign-out action.
 *
 * Data sources:
 *   - `useUser()`           → `/api/auth/me` (authenticated user identity).
 *   - `useActiveWorkspace()` → `/api/workspaces` (active tenant + role).
 *
 * Behaviour notes:
 *   - We deliberately do NOT redesign the sidebar footer; the trigger keeps the
 *     same visual footprint as the old static block (avatar + name/email stack)
 *     and only becomes a button-like dropdown trigger.
 *   - Logout posts to `/api/auth/logout` (POST, not GET, so it isn't pre-fetched
 *     by accident). The server clears both `7f-session` and `wf_workspace` and
 *     redirects to `/login`. We use a hard navigation (`window.location.href`)
 *     to wipe any client-side state — `useUser` is a context provider that
 *     lives at the app root and would otherwise keep stale data around for a
 *     beat after the redirect.
 *   - Loading state is intentionally minimal: a spinner in place of the avatar
 *     and "Loading…" / "Sign in…" labels. We never show stale account info.
 */
export function SidebarAccountMenu({ collapsed, focused = false }: SidebarAccountMenuProps) {
  const { user, loading: userLoading } = useUser()
  const { workspace, loading: wsLoading } = useActiveWorkspace()

  const initials = useMemo(
    () => getInitials(user?.nombre, user?.email),
    [user?.nombre, user?.email],
  )

  const handleLogout = () => {
    /**
     * Hard navigation so the entire React tree unmounts and any cached fetches
     * (workspaces, conversations, todos, drafts) are discarded before the next
     * user lands. A SPA-style `router.push` would keep the in-memory cache.
     */
    window.location.href = "/api/auth/logout"
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40",
              "hover:bg-[var(--app-sidebar-surface)]/60",
              collapsed ? "justify-center p-1" : "p-1",
            )}
            title={collapsed ? `${displayName}${workspace ? ` · ${workspace.nombre}` : ""}` : undefined}
            aria-label="Open account menu"
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
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side={collapsed ? "right" : "top"}
          align={collapsed ? "start" : "end"}
          className="min-w-[220px]"
        >
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-semibold">
              {user.nombre?.trim() || "Account"}
            </span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 size={13} />
              <span className="text-[11px] uppercase tracking-wide">Workspace</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="truncate font-medium">
                {workspace?.nombre ?? (wsLoading ? "Loading…" : "—")}
              </span>
              {roleLabel ? (
                <span className="shrink-0 rounded-full border border-[var(--surface-overlay-border)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {roleLabel}
                </span>
              ) : null}
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              handleLogout()
            }}
            className="cursor-pointer"
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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

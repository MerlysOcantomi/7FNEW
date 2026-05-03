"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Building2,
  Users as UsersIcon,
  Mail,
  ScrollText,
  type LucideIcon,
} from "lucide-react"

/**
 * Internal navigation bar for the SevenF System Admin shell.
 *
 * Behaviour:
 *   - Lives just below the platform header, before the page content.
 *   - Uses `next/link` so navigation stays inside the React tree (no full
 *     page reloads). The platform shell is preserved across clicks.
 *   - Highlights the active section based on the current pathname.
 *
 * Why a client component:
 *   - We need `usePathname` to compute `active`, which only works inside a
 *     client component. The rest of `app/system/layout.tsx` stays a server
 *     component so the auth check and session read are still server-side.
 *
 * The "Volver al workspace" and "Sign out" actions intentionally stay in
 * the parent layout's header, not in this nav, because they exit the shell
 * (one returns to a customer workspace, the other clears the session).
 * Mixing exits with internal section nav is confusing.
 */

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { href: "/system", label: "Dashboard", icon: Home },
  { href: "/system/workspaces", label: "Workspaces", icon: Building2 },
  { href: "/system/users", label: "Users", icon: UsersIcon },
  { href: "/system/allowed-emails", label: "Allowed emails", icon: Mail },
  { href: "/system/audit", label: "Audit", icon: ScrollText },
]

/**
 * `Dashboard` (/system) requires an exact match — otherwise it would light
 * up on every `/system/*` page since they all start with `/system`. Other
 * sections use prefix matching so detail pages like
 * `/system/workspaces/abc123` keep "Workspaces" highlighted.
 */
function isActive(pathname: string, href: string): boolean {
  if (href === "/system") return pathname === "/system"
  return pathname === href || pathname.startsWith(href + "/")
}

export function SystemNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Platform sections"
      className="border-b border-amber-200/50 bg-amber-50/60 dark:border-amber-900/30 dark:bg-amber-950/20"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-1.5 md:px-6">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-400/70 bg-white/80 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-100"
                  : "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-xs font-medium text-amber-900/70 transition-colors hover:border-amber-300/40 hover:bg-white/40 hover:text-amber-900 dark:text-amber-100/70 dark:hover:bg-amber-950/30 dark:hover:text-amber-100"
              }
            >
              <Icon size={12} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

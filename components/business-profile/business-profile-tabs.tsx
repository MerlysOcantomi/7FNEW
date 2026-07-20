"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useI18n } from "@/components/i18n-provider"
import { cn } from "@/lib/utils"

/**
 * Section switcher for Business Profile: the identity editor at
 * `/business-profile` and the channel configuration at
 * `/business-profile/channels` (BUSINESS-PROFILE-CHANNELS-03).
 *
 * Plain links, not client tabs — each section is its own route so deep links
 * and back/forward keep working. `aria-current` marks the active section.
 */
const TAB_ROUTES = [
  { key: "profile" as const, href: "/business-profile" },
  { key: "channels" as const, href: "/business-profile/channels" },
]

export function BusinessProfileTabs() {
  const { t } = useI18n()
  const copy = t.settings.businessProfilePage.tabs
  const pathname = usePathname()

  return (
    <nav aria-label={copy.aria} className="-mt-2">
      <ul className="flex gap-1 border-b border-border">
        {TAB_ROUTES.map(({ key, href }) => {
          const active = pathname === href
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-block border-b-2 px-3 py-2 text-sm font-medium transition-colors -mb-px",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {copy[key]}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

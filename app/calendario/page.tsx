import { AppShell } from "@/components/app-shell"
import { CalendarShell } from "@/components/calendar/calendar-shell"
import { getRequestLocale } from "@core/i18n/server"
import { getNamespace } from "@core/i18n/ui"

/**
 * /calendario — 7F Calendar (TIME instrument).
 *
 * PR1 base replacement: the previous single-file Month/Week/Day page is retired
 * in favour of a contained Calendar shell (components/calendar/*). It keeps the
 * route, the real /api/calendario/feed and the time-first framing; AppShell
 * provides the global nav + a viewport-bounded scrollport, and CalendarShell
 * owns its internal scroll so the body never scrolls. The left navigator,
 * lenses, the full 5-mode Intelligence Panel, EventDNA and the Schedule/Visual
 * views land in later PRs.
 *
 * Server Component: breadcrumb labels resolve via `getRequestLocale` +
 * `getNamespace` (the client shell localizes everything else via useI18n).
 */
export default async function CalendarioPage() {
  const { locale } = await getRequestLocale()
  const calendar = getNamespace(locale, "calendar")
  return (
    <AppShell
      currentSection="calendario"
      breadcrumbs={[{ label: "7F" }, { label: calendar.title }]}
      contentClassName="min-h-0 flex-1 max-w-[1500px]"
    >
      <CalendarShell />
    </AppShell>
  )
}

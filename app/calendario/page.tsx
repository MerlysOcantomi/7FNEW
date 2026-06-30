import { AppShell } from "@/components/app-shell"
import { CalendarShell } from "@/components/calendar/calendar-shell"

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
 */
export default function CalendarioPage() {
  return (
    <AppShell
      currentSection="calendario"
      breadcrumbs={[{ label: "7F" }, { label: "Calendar" }]}
      contentClassName="min-h-0 flex-1 max-w-[1500px]"
    >
      <CalendarShell />
    </AppShell>
  )
}

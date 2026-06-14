"use client"

import { AppShell } from "@/components/app-shell"
import { TodayPageClient } from "@/components/today/today-page-client"

/**
 * `/today` — read-only unified daily view.
 *
 * First step toward a workspace-level Today / Tasks system. Aggregates three
 * existing sources (`InboxTodo`, `Tarea`, `Evento`) into a single Overdue /
 * Due today / No date list, scoped strictly per workspace. No schema changes,
 * no Fanny pipeline changes, no New dropdown changes; all writes still happen
 * through the existing module-specific surfaces.
 *
 * Layout: AppShell (viewport-bounded `fixed inset-0` per
 * docs/app-shell-contract.md). The page introduces NO `min-h-screen` and NO
 * document/body scroll — `main` inside AppShell already owns the scrollport.
 *
 * Width: `contentClassName="max-w-7xl"` widens the AppShell content
 * container (default `max-w-6xl` = 1152px → 1280px) so the workboard's
 * two-column desktop layout (My work | AI work, activated at `lg`) has
 * comfortable room for the four sub-buckets per lane on wide screens.
 * `tailwind-merge` resolves the conflict cleanly. Caps at the viewport
 * width on smaller screens, so this is a no-op below ~1280px.
 */
export default function TodayPage() {
  return (
    <AppShell
      breadcrumbs={[{ label: "7F" }, { label: "Today" }]}
      contentClassName="max-w-7xl"
    >
      {/* Header is the workboard's own summary bar (TodayPageClient) — no
          SectionPage title here, to avoid duplicating "Today" twice. */}
      <TodayPageClient />
    </AppShell>
  )
}

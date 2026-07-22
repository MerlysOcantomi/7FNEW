"use client"

import { useActiveWorkspace } from "@/hooks/use-active-workspace"
import { isBeautyTodayVertical } from "@modules/today/beauty-today"
import { Skeleton } from "@/components/ui/skeleton"
import { CalendarShell } from "./calendar-shell"
import { BeautyAppointmentsExperience } from "./beauty/beauty-appointments-experience"

/**
 * `/calendario` experience selector — the SINGLE seam where the shared Calendar
 * Engine branches into its two experiences:
 *
 *   Shared Calendar Engine
 *   ├── Sevenef Core Calendar Experience  → CalendarShell (unchanged)
 *   └── Finesse Beauty Appointments       → BeautyAppointmentsExperience
 *
 * The source of truth is the workspace vertical (`verticalKey`), resolved
 * exactly like the Beauty "Hoy" (`isBeautyTodayVertical`). A brief skeleton on
 * first load avoids flashing the Core calendar to a Beauty operator before the
 * workspace resolves; the hook's module cache makes later navigations instant.
 */
export function CalendarExperienceRouter() {
  const { workspace, loading } = useActiveWorkspace()

  if (loading && !workspace) {
    return (
      <div className="flex h-full flex-col gap-2" aria-busy="true">
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="min-h-0 flex-1 rounded-xl" />
      </div>
    )
  }

  if (isBeautyTodayVertical(workspace?.verticalKey)) {
    return <BeautyAppointmentsExperience />
  }

  return <CalendarShell />
}

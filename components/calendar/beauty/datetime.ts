/**
 * Pure date/time bridging for the appointment form — unit-testable, no React.
 *
 * The Beauty experience renders times in the runtime's local zone (matching the
 * shared Core calendar's day/week views), so the form interprets the picked
 * `date`+`time` as LOCAL wall-clock and serializes to a UTC ISO instant for the
 * `Evento` record. Workspace-timezone precision is a shared-engine concern
 * (the Core calendar renders the same way today) — see the mission report.
 */

/** Local `yyyy-mm-dd` + `HH:mm` → UTC ISO instant, or null if unparseable. */
export function localToISO(dateStr: string, timeStr: string): string | null {
  if (!dateStr || !timeStr) return null
  const [y, m, d] = dateStr.split("-").map(Number)
  const [hh, mm] = timeStr.split(":").map(Number)
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return null
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0)
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString()
}

/** ISO instant shifted by `minutes`, serialized back to ISO. */
export function addMinutesISO(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString()
}

const pad = (n: number) => String(n).padStart(2, "0")

/** ISO instant → the local `date`/`time` strings a form input expects. */
export function isoToLocalParts(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: "", time: "" }
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

/** Whole minutes between two ISO instants, or null when there is no end. */
export function diffMinutes(startISO: string, endISO: string | null): number | null {
  if (!endISO) return null
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime()
  return ms > 0 ? Math.round(ms / 60000) : null
}

/** Half-open interval overlap in ms — the same rule the shared conflict engine uses. */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

import type { SVGProps } from "react"

/**
 * "Almanaque" glyph for the Today destination: a calendar frame drawn in the
 * lucide stroke vocabulary (24×24, stroke 2, currentColor) with the CURRENT
 * day of month printed inside. Pure presentational: the day arrives as a prop
 * so SSR renders the frame only (`day={null}`) and the client fills the number
 * after mount — no hydration mismatch, no date library.
 *
 * Decorative by contract (`aria-hidden`): the owning link carries the visible
 * "Today" label plus a screen-reader date, so the number is never the only
 * way to perceive the destination.
 */
export function TodayDateGlyph({
  day,
  size = 24,
  ...rest
}: { day: number | null; size?: number } & Omit<SVGProps<SVGSVGElement>, "width" | "height">) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-today-glyph
      {...rest}
    >
      <rect x="3" y="4" width="18" height="17" rx="3" />
      <path d="M3 9h18" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      {day !== null && (
        <text
          x="12"
          y="18.4"
          textAnchor="middle"
          fontSize={day >= 10 ? 8 : 8.5}
          fontWeight={700}
          fontFamily="inherit"
          fill="currentColor"
          stroke="none"
          data-today-day
        >
          {day}
        </text>
      )}
    </svg>
  )
}

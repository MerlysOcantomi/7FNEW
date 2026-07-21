/**
 * Public 404 for Presence sites. Neutral, self-contained, and NOT linked to the
 * authenticated dashboard (which would bounce anonymous visitors to /login).
 * Shown for missing, offline, suspended, or invalidly-configured sites — no
 * internal details are revealed. Uses theme tokens on the midnight default.
 */
export default function PresenceSiteNotFound() {
  return (
    <div
      data-theme="midnight"
      className="flex min-h-screen flex-col items-center justify-center bg-[var(--app-canvas)] px-6 text-center font-sans text-[var(--text-primary-light)]"
    >
      <p className="text-sm font-medium uppercase tracking-wide text-[var(--text-tertiary-light)]">
        Sevenef Presence
      </p>
      <h1 className="mt-3 text-3xl font-semibold">This site isn’t available</h1>
      <p className="mt-3 max-w-md text-[var(--text-secondary-light)]">
        The page you’re looking for doesn’t exist or is not currently published.
      </p>
    </div>
  )
}

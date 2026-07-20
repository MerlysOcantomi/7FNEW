/**
 * Public / static request-path classification (DEV-PREVIEW-01C hardening).
 *
 * Pure and Next-free so it is unit-testable and shared by `middleware.ts`.
 *
 * Why this exists: the root layout renders framework assets — the Vercel
 * Analytics script at `/_vercel/insights/script.js` and the metadata icons —
 * on EVERY page, including public ones with no session (e.g. `/login`,
 * `/lab/enter`). If the auth middleware redirects those asset requests to
 * `/login`, the browser receives HTML where it expected JavaScript and throws
 * `Unexpected token '<'`. Classifying them as public here fixes that for every
 * unauthenticated page, normal login included.
 */

/** Prefix matches — any path starting with one of these is a static asset. */
export const STATIC_PREFIXES = ["/_next", "/_vercel", "/favicon.ico", "/public"]

/** Exact public asset files referenced from root-layout metadata. */
export const PUBLIC_ASSET_PATHS = [
  "/icon.svg",
  "/icon-light-32x32.png",
  "/icon-dark-32x32.png",
  "/apple-icon.png",
]

export function isStaticAssetPath(pathname: string): boolean {
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) return true
  if (PUBLIC_ASSET_PATHS.includes(pathname)) return true
  return false
}

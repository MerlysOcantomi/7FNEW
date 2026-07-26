/**
 * Mr Forte Lab — Google OAuth isolation policy (DEV-PREVIEW-01D).
 *
 * The Lab deployment never uses Google OAuth. The decision is derived from the
 * private infrastructure gate (which verifies the project id, not just the
 * hostname), NOT from any public variable and NOT from `DISABLE_GOOGLE_AUTH`.
 *
 * Pure so both environments are unit-testable:
 *   - On the authorized Lab deployment (gate allowed) → block OAuth, and send
 *     `/login` to `/lab/enter`.
 *   - Everywhere else (production, gate denied) → Google OAuth is untouched.
 */

/** True on the authorized Lab deployment: hide the Google button + start/callback 404. */
export function shouldBlockGoogleOAuth(gateAllowed: boolean): boolean {
  return gateAllowed === true
}

/** True on the authorized Lab deployment: `/login` redirects to `/lab/enter`. */
export function shouldRedirectLoginToLab(gateAllowed: boolean): boolean {
  return gateAllowed === true
}

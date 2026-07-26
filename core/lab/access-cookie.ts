/**
 * Mr Forte Lab — access cookie shape (DEV-PREVIEW-01B).
 *
 * A namespace-scoped cookie, deliberately distinct from `7f-session` and
 * `wf_workspace`. `Path=/lab` means it is NEVER sent to `/today`, `/api/*` or
 * any normal Sevenef route, so it can never act as a general credential.
 * Pure builders so the attributes are unit-testable.
 */

export const LAB_ACCESS_COOKIE_NAME = "sevenef-lab-access"
export const LAB_ACCESS_COOKIE_PATH = "/lab"

export type LabCookieAttributes = {
  name: string
  value: string
  httpOnly: boolean
  secure: boolean
  sameSite: "strict"
  path: string
  maxAge: number
  // Intentionally no `domain` — host-only cookie.
}

export function buildLabAccessCookie(
  token: string,
  opts: { ttlMinutes: number; secure: boolean },
): LabCookieAttributes {
  return {
    name: LAB_ACCESS_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: opts.secure,
    sameSite: "strict",
    path: LAB_ACCESS_COOKIE_PATH,
    maxAge: opts.ttlMinutes * 60,
  }
}

export function buildLabAccessClearCookie(opts: { secure: boolean }): LabCookieAttributes {
  return {
    name: LAB_ACCESS_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: opts.secure,
    sameSite: "strict",
    path: LAB_ACCESS_COOKIE_PATH,
    maxAge: 0,
  }
}

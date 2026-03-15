// Re-export from new location — will be removed after full migration
export {
  createSession,
  verifySession,
  getSessionFromCookies,
  getSessionFromRequest,
  buildSessionCookie,
  buildLogoutCookie,
} from "@core/auth/session"
export type { SessionUser } from "@core/auth/session"

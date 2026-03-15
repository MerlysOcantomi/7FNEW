// Re-export from new location — will be removed after full migration
export {
  createClientSession,
  verifyClientSession,
  getClientSessionFromCookies,
  getClientSessionFromRequest,
  buildClientSessionCookie,
  buildClientLogoutCookie,
  CLIENT_COOKIE_NAME,
} from "@core/auth/client-session"
export type { ClientSession } from "@core/auth/client-session"

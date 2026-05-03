// Re-export from core — keeps `@/lib/auth/...` ergonomic for consumers in app/
export {
  PlatformError,
  isPlatformRole,
  requirePlatformRole,
  requirePlatformSuper,
  requirePlatformAdmin,
  requirePlatformSupport,
  requirePlatformBilling,
  requireAnyPlatformRole,
} from "@core/auth/platform-auth"
export type { PlatformRole, PlatformAuth } from "@core/auth/platform-auth"

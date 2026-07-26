/**
 * Mr Forte Lab — cookie secure-context detection (DEV-PREVIEW-01C).
 *
 * Deployed environments (VERCEL_ENV set) always require https-only cookies;
 * the explicit local-dev opt-in from 01A is the only http case. Shared by the
 * access-session (level 2) and application-session (level 3) cookie builders.
 */
export function isLabSecureContext(env: Record<string, string | undefined> = process.env): boolean {
  const vercelEnv = env.VERCEL_ENV
  const localDev =
    env.SEVENEF_LAB_LOCAL_DEV_ENABLED === "true" &&
    (vercelEnv === undefined || vercelEnv === "development")
  return !localDev
}

/**
 * Mr Forte Lab — environment variable names and the pure env reader
 * (DEV-PREVIEW-01A). Kept free of "server-only" so tests can exercise it; the
 * values themselves must never leave the server (`gate.ts` enforces that).
 */

import type { LabGateInput } from "./gate-policy"

export const LAB_ENV_KEYS = {
  enabled: "SEVENEF_LAB_PREVIEW_ENABLED",
  deploymentMode: "SEVENEF_LAB_DEPLOYMENT_MODE",
  expectedProjectId: "SEVENEF_LAB_EXPECTED_PROJECT_ID",
  actualProjectId: "VERCEL_PROJECT_ID",
  allowedHosts: "SEVENEF_LAB_ALLOWED_HOSTS",
  vercelEnv: "VERCEL_ENV",
  localDevEnabled: "SEVENEF_LAB_LOCAL_DEV_ENABLED",
} as const

export type LabGateEnvInput = Omit<LabGateInput, "requestHost">

export function readLabGateEnv(env: Record<string, string | undefined>): LabGateEnvInput {
  return {
    enabled: env[LAB_ENV_KEYS.enabled],
    deploymentMode: env[LAB_ENV_KEYS.deploymentMode],
    expectedProjectId: env[LAB_ENV_KEYS.expectedProjectId],
    actualProjectId: env[LAB_ENV_KEYS.actualProjectId],
    allowedHosts: env[LAB_ENV_KEYS.allowedHosts],
    vercelEnv: env[LAB_ENV_KEYS.vercelEnv],
    localDevEnabled: env[LAB_ENV_KEYS.localDevEnabled],
  }
}

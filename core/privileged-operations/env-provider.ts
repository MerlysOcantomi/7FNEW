import { OPERATION_MODES, type OperationMode, type PolicyResolution, type PolicySource } from "./types"

/**
 * v1 policy source: runtime configuration, read from the process environment.
 *
 *   SEVENF_OPERATION_MODE=normal          every registered operation allowed
 *   SEVENF_OPERATION_MODE=freeze-writes   database.write and background.start refused
 *   (unset / empty)                       normal — the documented default: a
 *                                         freeze is an explicit operator action,
 *                                         never something a missing variable
 *                                         switches on by accident
 *   anything else                         INVALID → fail closed (all refused)
 *
 * The source of truth deliberately lives OUTSIDE the application database:
 * the database is the thing a cutover migrates. Edge-safe: no Node built-ins,
 * so `middleware.ts` can reuse the same parser.
 */
export const OPERATION_MODE_ENV = "SEVENF_OPERATION_MODE"

export function parseOperationMode(raw: string | undefined): PolicyResolution {
  const origin = `env:${OPERATION_MODE_ENV}`
  if (raw === undefined || raw === "") return { kind: "mode", mode: "normal", origin: `${origin}(unset→normal)` }
  const value = raw.trim()
  if ((OPERATION_MODES as readonly string[]).includes(value)) return { kind: "mode", mode: value as OperationMode, origin }
  // The offending value is never echoed: it could be anything an operator typed.
  return { kind: "invalid", origin, detail: `unrecognised value (expected one of ${OPERATION_MODES.join(", ")})` }
}

export function createEnvironmentPolicySource(env: { readonly [key: string]: string | undefined } = process.env): PolicySource {
  return {
    name: `env:${OPERATION_MODE_ENV}`,
    resolve: () => parseOperationMode(env[OPERATION_MODE_ENV]),
  }
}

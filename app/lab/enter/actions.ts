"use server"

import { redirect } from "next/navigation"
import { createLabApplicationSession } from "@core/lab/application-session"

export type LabEnterState = { error: null | "invalid-key" | "not-ready" }

/**
 * Enter action (DEV-PREVIEW-01C). Delegates the full ordered flow
 * (gate → origin → access config → key → data config → fingerprint →
 * provisioned demo identity/workspace → issue cookies) to
 * `createLabApplicationSession`. No cookie is set on any failure. On success
 * the destination is always `/lab`; there is no `returnTo`.
 *
 * Two generic error kinds: a wrong key vs an environment that is not ready.
 * Neither leaks any internal detail.
 */
export async function enterLabAction(
  _prev: LabEnterState,
  formData: FormData,
): Promise<LabEnterState> {
  const outcome = await createLabApplicationSession(formData.get("key"))
  if (!outcome.ok) return { error: outcome.kind }
  redirect("/lab")
}

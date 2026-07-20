"use server"

import { redirect } from "next/navigation"
import { createLabAccessSession } from "@core/lab/access-session"

export type LabEnterState = { error: boolean }

/**
 * Enter action (DEV-PREVIEW-01B). Delegates the full ordered flow
 * (gate → origin → config → key → token → cookie) to
 * `createLabAccessSession`. Every failure — denied gate, untrusted origin,
 * bad configuration or wrong key — collapses to ONE generic outcome so the UI
 * never distinguishes them. On success the destination is always `/lab`;
 * there is no `returnTo`.
 */
export async function enterLabAction(
  _prev: LabEnterState,
  formData: FormData,
): Promise<LabEnterState> {
  const result = await createLabAccessSession(formData.get("key"))
  if (!result.ok) return { error: true }
  redirect("/lab")
}

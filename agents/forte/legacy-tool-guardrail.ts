/**
 * FOUND-03 — Bounded fail-closed guardrail for the legacy agent tool path.
 *
 * Confirmed pre-existing bypass (see 7F-FOUND-03-TOOL-AUTHORIZATION.md):
 * `app/api/ai/agent/route.ts` requires only read access, the adapter
 * appended non-bridged legacy tools unfiltered, and `executor.ts` executed
 * legacy WRITE tools with no role/permission check — so a VIEWER (or a
 * caller with a missing/corrupt role) could create tareas/campañas/
 * contenido and spend image generation through the agent.
 *
 * This guardrail closes exactly that hole using CANONICAL policy — the
 * FOUND-02a role→permission sets over FOUND-01 capability keys — not a
 * detached allowlist. It maps each gated legacy tool to the canonical
 * capabilities its execution exercises and denies unless the actor's role
 * MAY every one of them. Missing/unknown roles deny (fail closed).
 *
 * Deliberately bounded (NOT AI-06): the tool loop, the duplicated OpenAI
 * client and the legacy tool vocabulary stay untouched; workspace
 * CAPABILITY enforcement is not activated here (that would change behavior
 * for valid members); bridged read tools keep their existing Forte
 * capability filtering. Valid MEMBER/ADMIN/OWNER behavior is unchanged —
 * only the unauthorized paths now deny.
 */

import type { CapabilityKey } from "@core/platform/capabilities"
import { roleMay } from "@core/platform/role-policy"

/**
 * Canonical capabilities exercised by each gated legacy tool. Image
 * generation is grouped under content creation (it produces content
 * assets); `buscar_facturas` maps to invoice.read, which every valid role
 * holds — included for consistency, with no behavior change for valid
 * members.
 */
export const LEGACY_TOOL_REQUIRED_CAPABILITIES: Readonly<
  Record<string, readonly CapabilityKey[]>
> = {
  crear_tarea: ["task.write"],
  crear_campana: ["campaign.create"],
  crear_contenido: ["content.create"],
  crear_idea: ["content.create"],
  generar_imagen: ["content.create"],
  buscar_facturas: ["invoice.read"],
}

/**
 * Whether the actor's role may use this legacy tool. Tools not in the map
 * are not gated HERE (bridged read tools keep their Forte capability
 * filtering; unknown names are denied by the executor's default branch).
 * For gated tools, an invalid/missing role denies.
 */
export function isLegacyToolPermittedForRole(
  legacyToolName: string,
  role: string | null | undefined,
): boolean {
  const required = LEGACY_TOOL_REQUIRED_CAPABILITIES[legacyToolName]
  if (!required) return true
  return required.every((capability) => roleMay(role, capability))
}

/**
 * Mr Forte — vertical playbooks (declarative specs).
 *
 * A registry of per-vertical configuration playbooks Forte reads to detect and
 * set up a workspace. These are data, not executors: the runtime pipeline
 * (policy → approval → handlers) consumes them in a later phase. Adding a
 * vertical here never changes another vertical's behavior.
 */

import { BEAUTY_FORTE_PLAYBOOK, type ForteVerticalPlaybook } from "./beauty"

export type { ForteVerticalPlaybook, ForteStep, ForteQuestion, ForteAutonomy } from "./beauty"
export { BEAUTY_FORTE_PLAYBOOK } from "./beauty"

export const FORTE_VERTICAL_PLAYBOOKS: Record<string, ForteVerticalPlaybook> = {
  beauty: BEAUTY_FORTE_PLAYBOOK,
}

/** Resolve a vertical playbook by key, or `null` when none is registered. */
export function getForteVerticalPlaybook(
  verticalKey: string | null | undefined,
): ForteVerticalPlaybook | null {
  if (!verticalKey) return null
  return FORTE_VERTICAL_PLAYBOOKS[verticalKey] ?? null
}

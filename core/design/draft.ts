import type { DesignContract } from "./contracts"
import { MAX_CONTRACT_SIZE, exportDesignJSON, parseDesignContract } from "./resolve"

export const DESIGN_DRAFT_KEY = "forte-design-foundation:local-draft:v1"
export interface DraftStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export type DraftResult = { ok: true; contract: DesignContract; savedAt: string } | { ok: false; error: string }

// Storage is injected: this module is safe to import on the server and in tests.
// Only design choices are stored. No workspace records, session or API keys.
export function readDesignDraft(storage: DraftStorage): DraftResult {
  try {
    const raw = storage.getItem(DESIGN_DRAFT_KEY)
    if (!raw) return { ok: false, error: "No local draft found" }
    if (raw.length > MAX_CONTRACT_SIZE + 1000) throw new Error("Draft is too large")
    const data = JSON.parse(raw)
    if (data.version !== 1 || typeof data.savedAt !== "string" || !Number.isFinite(Date.parse(data.savedAt))) throw new Error("Unsupported or damaged draft")
    const parsed = parseDesignContract(data.contract)
    if (!parsed.ok) return parsed
    return { ok: true, contract: parsed.contract, savedAt: data.savedAt }
  } catch { return { ok: false, error: "Cannot read this local draft. Export or restore a valid JSON file." } }
}
export function saveDesignDraft(storage: DraftStorage, contract: DesignContract, now: Date = new Date()): DraftResult {
  try {
    const clean = JSON.parse(exportDesignJSON(contract)) as DesignContract
    const savedAt = now.toISOString()
    storage.setItem(DESIGN_DRAFT_KEY, JSON.stringify({ version: 1, contract: clean, savedAt }))
    return { ok: true, contract: clean, savedAt }
  } catch { return { ok: false, error: "Draft was not saved. Browser storage may be blocked or full; export JSON instead." } }
}

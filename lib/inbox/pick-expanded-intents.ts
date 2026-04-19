import { filterConsecutiveDuplicateIntents } from "@/lib/inbox/filter-consecutive-intent-duplicates"

/** Max intents shown in the expanded inbox row (Phase 4). */
export const MAX_EXPANDED_INTENTS = 3

/**
 * Normalización solo para comparar igualdad trivial (sin NLP).
 * Conserva el texto mostrado tal como viene del último mensaje relevante.
 */
export function normalizeIntentForComparison(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase()
}

/**
 * Phase 4: selecciona como máximo {@link MAX_EXPANDED_INTENTS} intents compactos a partir de la
 * secuencia temporal ya extraída de `shortIntent`.
 *
 * Reglas:
 * 1. Quitar repeticiones consecutivas (Phase 3).
 * 2. Si el mismo texto normalizado vuelve a aparecer más adelante, quitar la aparición anterior
 *    y conservar la última (menos ruido, mismo “paso” actualizado).
 * 3. Tomar los **últimos** hasta 3 de esa lista → progresión reciente del hilo.
 */
export function pickExpandedIntents(phrases: string[]): string[] {
  const consecutive = filterConsecutiveDuplicateIntents(phrases)
  const dedupLastWins: string[] = []
  for (const raw of consecutive) {
    const display = raw.trim()
    const n = normalizeIntentForComparison(display)
    if (!n) continue
    const kept = dedupLastWins.filter((x) => normalizeIntentForComparison(x) !== n)
    dedupLastWins.length = 0
    dedupLastWins.push(...kept, display)
  }
  return dedupLastWins.slice(-MAX_EXPANDED_INTENTS)
}

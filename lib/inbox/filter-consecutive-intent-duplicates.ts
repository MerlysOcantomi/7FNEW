/** Dedup mínimo (Phase 3): quita repeticiones consecutivas normalizadas. Phase 4 podrá refinar. */
export function filterConsecutiveDuplicateIntents(phrases: string[]): string[] {
  const out: string[] = []
  let prevNorm: string | null = null
  for (const raw of phrases) {
    const s = raw.trim()
    if (!s) continue
    const norm = s.toLowerCase()
    if (norm === prevNorm) continue
    out.push(s)
    prevNorm = norm
  }
  return out
}

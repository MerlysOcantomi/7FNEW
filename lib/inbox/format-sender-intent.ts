/** Frase corta para la lista del inbox (IA / Fanny): máx. palabras, sin cortar a medias. */

const DEFAULT_MAX_WORDS = 10

export function formatSenderIntentPhrase(
  input: string | null | undefined,
  maxWords: number = DEFAULT_MAX_WORDS,
): string | null {
  if (!input?.trim()) return null
  const normalized = input.replace(/\s+/g, " ").trim()
  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length === 0) return null
  const clipped = words.slice(0, Math.max(1, maxWords)).join(" ")
  return clipped
}

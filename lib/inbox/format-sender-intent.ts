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

/** Preview de último mensaje: sin HTML rudo, una línea, elipsis en límite de carácter respetando palabras. */
export function formatMessageSnippet(
  raw: string | null | undefined,
  maxChars: number = 140,
): string | null {
  if (!raw?.trim()) return null
  const text = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!text) return null
  if (text.length <= maxChars) return text
  const slice = text.slice(0, maxChars)
  const lastSpace = slice.lastIndexOf(" ")
  const cut = lastSpace > 24 ? slice.slice(0, lastSpace) : slice
  return `${cut.trim()}…`
}

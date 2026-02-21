import { readFile } from "fs/promises"
import { join } from "path"
import Tesseract from "tesseract.js"

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/tiff",
])

const PDF_TYPES = new Set(["application/pdf"])

export async function extractText(
  filePath: string,
  mimeType: string,
): Promise<string> {
  const absolutePath = join(process.cwd(), "public", filePath)

  if (IMAGE_TYPES.has(mimeType)) {
    return extractFromImage(absolutePath)
  }

  if (PDF_TYPES.has(mimeType)) {
    return extractFromPDF(absolutePath)
  }

  if (mimeType.startsWith("text/")) {
    const content = await readFile(absolutePath, "utf-8")
    return content
  }

  return ""
}

async function extractFromImage(absolutePath: string): Promise<string> {
  console.log("[7F OCR] Procesando imagen:", absolutePath)

  const result = await Tesseract.recognize(absolutePath, "spa+eng", {
    logger: (m) => {
      if (m.status === "recognizing text") {
        console.log(`[7F OCR] Progreso: ${Math.round((m.progress ?? 0) * 100)}%`)
      }
    },
  })

  const text = result.data.text.trim()
  console.log(`[7F OCR] Texto extraido: ${text.length} caracteres`)
  return text
}

async function extractFromPDF(absolutePath: string): Promise<string> {
  console.log("[7F OCR] Procesando PDF:", absolutePath)

  const { PDFParse } = await import("pdf-parse")
  const buffer = await readFile(absolutePath)
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  const result = await parser.getText()
  const text = result.text.trim()
  await parser.destroy()

  console.log(`[7F OCR] Texto extraido de PDF: ${text.length} caracteres`)
  return text
}

export function isScannable(mimeType: string): boolean {
  return (
    IMAGE_TYPES.has(mimeType) ||
    PDF_TYPES.has(mimeType) ||
    mimeType.startsWith("text/")
  )
}

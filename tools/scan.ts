import { askMotorIA } from "@engines/ai"

export interface ScanResult {
  tipoDocumento: string
  fecha: string | null
  total: string | null
  entidad: string | null
  resumen: string
  tags: string[]
  direccion: string | null
  numerosRelevantes: string[]
}

export async function analyzeDocument(
  text: string,
  fileName: string,
): Promise<ScanResult> {
  if (!text || text.trim().length < 10) {
    return {
      tipoDocumento: "desconocido",
      fecha: null,
      total: null,
      entidad: null,
      resumen: "No se pudo extraer suficiente texto para analizar.",
      tags: [],
      direccion: null,
      numerosRelevantes: [],
    }
  }

  const prompt = `Analiza el siguiente texto extraido de un documento llamado "${fileName}" y extrae informacion estructurada.

TEXTO DEL DOCUMENTO:
---
${text.slice(0, 4000)}
---

Responde UNICAMENTE con un JSON valido (sin markdown, sin backticks, sin explicaciones) con esta estructura exacta:
{
  "tipoDocumento": "factura" | "contrato" | "recibo" | "nota" | "carta" | "reporte" | "otro",
  "fecha": "YYYY-MM-DD" o null si no se detecta,
  "total": "$X,XXX.XX" o null si no aplica,
  "entidad": "nombre de empresa o persona principal" o null,
  "resumen": "resumen de 2-3 oraciones del contenido",
  "tags": ["etiqueta1", "etiqueta2", ...],
  "direccion": "direccion encontrada" o null,
  "numerosRelevantes": ["RFC", "folio", "telefono", etc]
}

IMPORTANTE:
- Solo JSON, sin texto adicional.
- Las tags deben ser palabras clave relevantes del documento.
- El resumen debe ser claro y conciso en español.`

  console.log("[7F Scan] Analizando documento con IA:", fileName)

  const response = await askMotorIA(prompt, "operativo")

  try {
    const cleaned = response
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim()

    const result: ScanResult = JSON.parse(cleaned)

    if (!result.tags) result.tags = []
    if (!result.numerosRelevantes) result.numerosRelevantes = []

    console.log("[7F Scan] Analisis completado:", result.tipoDocumento)
    return result
  } catch {
    console.error("[7F Scan] Error parseando respuesta IA:", response.slice(0, 200))

    return {
      tipoDocumento: "otro",
      fecha: null,
      total: null,
      entidad: null,
      resumen: response.slice(0, 300),
      tags: [],
      direccion: null,
      numerosRelevantes: [],
    }
  }
}

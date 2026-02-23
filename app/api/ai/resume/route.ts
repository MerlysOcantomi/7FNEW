import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api"
import { askMotorIA } from "@/lib/ai"

const MAX_CV_LENGTH = 20000

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, idioma = "espanol", nivel = "medio" } = body as {
      text?: string
      idioma?: string
      nivel?: "corto" | "medio" | "largo"
    }

    if (!text || text.trim().length === 0) {
      return errorResponse("VALIDATION_ERROR", "El texto del CV es obligatorio")
    }

    if (text.length > MAX_CV_LENGTH) {
      return errorResponse("VALIDATION_ERROR", `El CV excede el limite de ${MAX_CV_LENGTH} caracteres`)
    }

    const nivelInstruccion: Record<string, string> = {
      corto: "Genera un resumen muy breve (3-5 lineas) con los puntos mas relevantes.",
      medio: "Genera un resumen de longitud media (1-2 parrafos) con experiencia, habilidades y fortalezas.",
      largo: "Genera un resumen detallado y completo con analisis profundo de cada seccion del CV.",
    }

    const prompt = `Analiza el siguiente curriculum vitae y genera:

1. **Resumen profesional**: Un resumen ejecutivo del candidato.
2. **Version mejorada**: Una version optimizada y mejor redactada del CV.
3. **Puntos clave**: Lista de las 5-7 fortalezas principales.
4. **Sugerencias**: Recomendaciones para mejorar el CV.

Nivel de detalle: ${nivelInstruccion[nivel] || nivelInstruccion.medio}
Idioma de respuesta: ${idioma}

---
CV:
${text.trim()}
---

Responde en formato estructurado con las 4 secciones claramente separadas.`

    const result = await askMotorIA(prompt, "cv")

    return successResponse({
      result,
      mode: "cv",
      nivel,
      idioma,
    })
  } catch (error) {
    console.error("[7F AI Resume] Error:", error)
    const message = error instanceof Error ? error.message : "Error al procesar el CV"
    return errorResponse("AI_ERROR", message, 500)
  }
}

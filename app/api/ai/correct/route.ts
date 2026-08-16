import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { askMotorIA } from "@/lib/ai"

const MAX_TEXT_LENGTH = 15000

export async function POST(request: NextRequest) {
  try {
    // CORE-02B (F-AUTH-05): require a valid session + workspace membership
    // in-handler, before reading the body or contacting any AI provider.
    await requireReadAccess(request)

    const body = await request.json()
    const { text, idioma = "espanol", formalidad = "profesional" } = body as {
      text?: string
      idioma?: string
      formalidad?: "informal" | "profesional" | "formal" | "academico"
    }

    if (!text || text.trim().length === 0) {
      return errorResponse("VALIDATION_ERROR", "El texto es obligatorio")
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return errorResponse("VALIDATION_ERROR", `El texto excede el limite de ${MAX_TEXT_LENGTH} caracteres`)
    }

    const prompt = `Corrige y mejora el siguiente texto.

Nivel de formalidad deseado: ${formalidad}
Idioma: ${idioma}

Genera tu respuesta con estas 3 secciones:

1. **Texto corregido**: El texto con todas las correcciones ortograficas, gramaticales y de puntuacion aplicadas.
2. **Texto mejorado**: Una version optimizada con mejor redaccion, claridad y fluidez, manteniendo el significado original.
3. **Explicacion**: Lista breve de los cambios mas importantes realizados.

---
Texto original:
${text.trim()}
---`

    const result = await askMotorIA(prompt, "correccion")

    return successResponse({
      result,
      mode: "correccion",
      formalidad,
      idioma,
    })
  } catch (error) {
    return handleError(error, "CorrectAI")
  }
}

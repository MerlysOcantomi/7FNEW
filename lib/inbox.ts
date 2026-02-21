import { askMotorIA } from "./ai"

export interface InboxClassification {
  tipo: "lead" | "ticket" | "consulta" | "proyecto" | "factura"
  categoria: string
  urgencia: "baja" | "media" | "alta" | "critica"
  intencion: string
  resumen: string
  datosCliente: {
    nombre?: string
    email?: string
    telefono?: string
    empresa?: string
  }
  datosProyecto: {
    nombre?: string
    descripcion?: string
    presupuesto?: string
  }
  notas: string
  tags: string[]
}

export async function classifyInboxEntry(input: {
  nombre?: string
  email?: string
  telefono?: string
  mensaje: string
  fuente: string
}): Promise<InboxClassification> {
  const prompt = `Eres el sistema de clasificacion inteligente de 7F, una plataforma de gestion empresarial.

Analiza el siguiente mensaje entrante y clasifícalo:

DATOS DE ENTRADA:
- Fuente: ${input.fuente}
${input.nombre ? `- Nombre: ${input.nombre}` : ""}
${input.email ? `- Email: ${input.email}` : ""}
${input.telefono ? `- Telefono: ${input.telefono}` : ""}
- Mensaje: ${input.mensaje}

Responde UNICAMENTE con JSON valido (sin markdown, sin backticks):
{
  "tipo": "lead" | "ticket" | "consulta" | "proyecto" | "factura",
  "categoria": "categoria especifica del mensaje (ej: soporte tecnico, cotizacion, reclamo, informacion, nuevo proyecto, pago, etc.)",
  "urgencia": "baja" | "media" | "alta" | "critica",
  "intencion": "que quiere lograr el remitente en una frase corta",
  "resumen": "resumen de 1-2 oraciones del mensaje",
  "datosCliente": {
    "nombre": "nombre detectado o null",
    "email": "email detectado o null",
    "telefono": "telefono detectado o null",
    "empresa": "empresa detectada o null"
  },
  "datosProyecto": {
    "nombre": "nombre de proyecto mencionado o null",
    "descripcion": "descripcion si aplica o null",
    "presupuesto": "monto mencionado o null"
  },
  "notas": "observaciones adicionales relevantes",
  "tags": ["etiqueta1", "etiqueta2"]
}

REGLAS:
- tipo "lead": alguien interesado en contratar servicios o comprar
- tipo "ticket": reporte de problema, soporte, bug, queja
- tipo "consulta": pregunta general, informacion
- tipo "proyecto": solicitud concreta de trabajo o proyecto
- tipo "factura": relacionado con pagos, cobros, facturas
- urgencia "critica": requiere atencion inmediata
- urgencia "alta": requiere atencion en las proximas horas
- urgencia "media": puede esperar 1-2 dias
- urgencia "baja": sin presion de tiempo`

  console.log("[7F Inbox] Clasificando entrada:", input.mensaje.slice(0, 80))

  const response = await askMotorIA(prompt, "operativo")

  try {
    const cleaned = response
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim()

    const result: InboxClassification = JSON.parse(cleaned)

    if (!result.tags) result.tags = []
    if (!result.datosCliente) result.datosCliente = {}
    if (!result.datosProyecto) result.datosProyecto = {}

    console.log("[7F Inbox] Clasificacion:", result.tipo, result.urgencia)
    return result
  } catch {
    console.error("[7F Inbox] Error parseando respuesta IA:", response.slice(0, 200))
    return {
      tipo: "consulta",
      categoria: "sin clasificar",
      urgencia: "media",
      intencion: "No se pudo determinar",
      resumen: input.mensaje.slice(0, 200),
      datosCliente: {
        nombre: input.nombre,
        email: input.email,
        telefono: input.telefono,
      },
      datosProyecto: {},
      notas: "Clasificacion automatica fallida. Requiere revision manual.",
      tags: ["revision-manual"],
    }
  }
}

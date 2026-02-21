import { askDeepSeek } from "./deepseek"
import { askGPT } from "./gpt"

export type AIMode = "operativo" | "editorial"

export async function askMotorIA(prompt: string, mode: AIMode): Promise<string> {
  if (mode === "operativo") {
    return askDeepSeek(prompt)
  }
  return askGPT(prompt)
}

// ─── Tareas ───

export function promptSugerirPrioridad(tarea: { titulo: string; descripcion?: string; fechaLimite?: string }) {
  return `Analiza esta tarea y sugiere una prioridad (baja, media, alta, urgente) con justificacion breve:
Titulo: ${tarea.titulo}
${tarea.descripcion ? `Descripcion: ${tarea.descripcion}` : ""}
${tarea.fechaLimite ? `Fecha limite: ${tarea.fechaLimite}` : ""}
Responde con formato: PRIORIDAD: [valor] — [razon]`
}

export function promptDetectarRiesgos(tarea: { titulo: string; descripcion?: string; estado: string; fechaLimite?: string }) {
  return `Analiza esta tarea e identifica posibles riesgos o bloqueos:
Titulo: ${tarea.titulo}
Estado: ${tarea.estado}
${tarea.descripcion ? `Descripcion: ${tarea.descripcion}` : ""}
${tarea.fechaLimite ? `Fecha limite: ${tarea.fechaLimite}` : ""}
Lista los riesgos detectados y sugiere mitigaciones.`
}

export function promptGenerarSubtareas(tarea: { titulo: string; descripcion?: string }) {
  return `Descompone esta tarea en subtareas concretas y accionables:
Titulo: ${tarea.titulo}
${tarea.descripcion ? `Descripcion: ${tarea.descripcion}` : ""}
Lista entre 3 y 7 subtareas con titulo breve y estimacion de esfuerzo.`
}

export function promptResumirNotas(notas: string) {
  return `Resume las siguientes notas de trabajo de forma clara y concisa, destacando los puntos clave:
${notas}`
}

// ─── Proyectos ───

export function promptAnalisisProyecto(proyecto: {
  nombre: string
  estado: string
  tareasPendientes: number
  tareasCompletadas: number
  presupuesto?: number
  gastoActual?: number
}) {
  return `Analiza el estado de este proyecto y genera un diagnostico:
Nombre: ${proyecto.nombre}
Estado: ${proyecto.estado}
Tareas pendientes: ${proyecto.tareasPendientes}
Tareas completadas: ${proyecto.tareasCompletadas}
${proyecto.presupuesto ? `Presupuesto: $${proyecto.presupuesto}` : ""}
${proyecto.gastoActual ? `Gasto actual: $${proyecto.gastoActual}` : ""}
Incluye: estado general, riesgos detectados y proximos pasos recomendados.`
}

export function promptDetectarRetrasos(proyecto: {
  nombre: string
  fechaInicio: string
  fechaFin?: string
  porcentajeAvance: number
}) {
  return `Evalua si este proyecto tiene retrasos:
Nombre: ${proyecto.nombre}
Fecha inicio: ${proyecto.fechaInicio}
${proyecto.fechaFin ? `Fecha fin estimada: ${proyecto.fechaFin}` : ""}
Avance: ${proyecto.porcentajeAvance}%
Indica si hay retraso, que tan critico es y que acciones tomar.`
}

export function promptSiguientesPasos(proyecto: { nombre: string; estado: string; descripcion?: string }) {
  return `Sugiere los proximos 3-5 pasos concretos para avanzar este proyecto:
Nombre: ${proyecto.nombre}
Estado: ${proyecto.estado}
${proyecto.descripcion ? `Descripcion: ${proyecto.descripcion}` : ""}
Cada paso debe ser accionable y tener un responsable sugerido.`
}

// ─── Clientes ───

export function promptResumenCliente(cliente: {
  nombre: string
  empresa?: string
  proyectos: number
  facturasAbiertas: number
  estado: string
}) {
  return `Genera un resumen ejecutivo de este cliente:
Nombre: ${cliente.nombre}
${cliente.empresa ? `Empresa: ${cliente.empresa}` : ""}
Proyectos activos: ${cliente.proyectos}
Facturas abiertas: ${cliente.facturasAbiertas}
Estado: ${cliente.estado}
Incluye valoracion general, relacion comercial y recomendaciones.`
}

export function promptComunicacionCliente(cliente: { nombre: string }, contexto: string) {
  return `Redacta un mensaje profesional y amable para el cliente ${cliente.nombre}.
Contexto: ${contexto}
El tono debe ser cordial, claro y orientado a la accion. Formato listo para enviar.`
}

// ─── Finanzas ───

export function promptAnalisisFinanciero(datos: {
  ingresosMes: number
  gastosMes: number
  margen: number
  tendencia: string
}) {
  return `Analiza esta situacion financiera mensual:
Ingresos: $${datos.ingresosMes}
Gastos: $${datos.gastosMes}
Margen: ${datos.margen}%
Tendencia: ${datos.tendencia}
Identifica patrones, anomalias y recomendaciones para optimizar.`
}

export function promptDetectarAnomalias(transacciones: string) {
  return `Revisa estas transacciones y detecta posibles anomalias, pagos duplicados o patrones inusuales:
${transacciones}
Responde con una lista de alertas ordenadas por importancia.`
}

// ─── Facturas ───

export function promptResumenFacturacion(datos: {
  totalPendiente: number
  totalVencidas: number
  cantidadFacturas: number
}) {
  return `Resume el estado de facturacion:
Total pendiente: $${datos.totalPendiente}
Total vencidas: $${datos.totalVencidas}
Cantidad de facturas: ${datos.cantidadFacturas}
Genera un diagnostico breve con prioridades de cobranza.`
}

export function promptExplicarVencimiento(factura: {
  numero: string
  cliente: string
  monto: number
  vencimiento: string
  diasVencida: number
}) {
  return `Explica de forma clara la situacion de vencimiento de esta factura:
Factura: ${factura.numero}
Cliente: ${factura.cliente}
Monto: $${factura.monto}
Vencimiento: ${factura.vencimiento}
Dias vencida: ${factura.diasVencida}
Incluye nivel de urgencia y accion recomendada.`
}

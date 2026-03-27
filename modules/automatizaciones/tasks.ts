import { db } from "@core/db"
import { askMotorIA } from "@engines/ai"

export async function detectarRetrasos(workspaceId: string) {
  const hoy = new Date()
  const tareas = await db.tarea.findMany({
    where: {
      workspaceId,
      estado: { notIn: ["completada", "cancelada"] },
      fechaLimite: { lt: hoy },
    },
    include: { proyecto: true, usuario: true },
  })

  if (tareas.length === 0) {
    return { count: 0, result: "No se detectaron tareas con retraso." }
  }

  const resumen = tareas.map((t) =>
    `- "${t.titulo}" (prioridad: ${t.prioridad}, estado: ${t.estado}, vencio: ${t.fechaLimite?.toISOString().slice(0, 10)}, proyecto: ${t.proyecto?.nombre ?? "sin proyecto"}, responsable: ${t.usuario?.nombre ?? "sin asignar"})`
  ).join("\n")

  const prompt = `Se detectaron ${tareas.length} tareas con retraso:\n${resumen}\n\nAnaliza cada una: nivel de criticidad, impacto potencial y acciones inmediatas recomendadas.`
  const result = await askMotorIA(prompt, "operativo")

  return { count: tareas.length, tareas: tareas.map((t) => t.id), result }
}

export async function sugerirReprogramacion(workspaceId: string) {
  const hoy = new Date()
  const tareas = await db.tarea.findMany({
    where: {
      workspaceId,
      estado: { notIn: ["completada", "cancelada"] },
      fechaLimite: { lt: hoy },
    },
    include: { proyecto: true, usuario: true },
  })

  if (tareas.length === 0) {
    return { count: 0, result: "No hay tareas que necesiten reprogramacion." }
  }

  const resumen = tareas.map((t) =>
    `- "${t.titulo}" (prioridad: ${t.prioridad}, vencio: ${t.fechaLimite?.toISOString().slice(0, 10)}, proyecto: ${t.proyecto?.nombre ?? "N/A"})`
  ).join("\n")

  const prompt = `Estas tareas estan vencidas y necesitan reprogramacion:\n${resumen}\n\nFecha de hoy: ${hoy.toISOString().slice(0, 10)}\nSugiere nuevas fechas para cada una, considerando su prioridad y dependencias logicas. Formato: titulo → nueva fecha sugerida + justificacion.`
  const result = await askMotorIA(prompt, "operativo")

  return { count: tareas.length, result }
}

export async function generarSubtareas(workspaceId: string) {
  const tareas = await db.tarea.findMany({
    where: {
      workspaceId,
      estado: { in: ["pendiente", "en_progreso"] },
      prioridad: { in: ["alta", "urgente"] },
    },
    take: 5,
    orderBy: { createdAt: "desc" },
  })

  if (tareas.length === 0) {
    return { count: 0, result: "No hay tareas de alta prioridad para descomponer." }
  }

  const resumen = tareas.map((t) =>
    `- "${t.titulo}" ${t.descripcion ? `(${t.descripcion.slice(0, 100)})` : ""}`
  ).join("\n")

  const prompt = `Descompone estas tareas de alta prioridad en subtareas accionables:\n${resumen}\n\nPara cada tarea, genera 3-5 subtareas con titulo claro y estimacion de esfuerzo (horas).`
  const result = await askMotorIA(prompt, "operativo")

  return { count: tareas.length, result }
}

export async function resumenDiario(workspaceId: string) {
  const hoy = new Date()
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const fin = new Date(inicio)
  fin.setDate(fin.getDate() + 1)

  const [pendientes, completadasHoy, vencidas, total] = await Promise.all([
    db.tarea.count({ where: { workspaceId, estado: "pendiente" } }),
    db.tarea.count({ where: { workspaceId, completedAt: { gte: inicio, lt: fin } } }),
    db.tarea.count({
      where: { workspaceId, estado: { notIn: ["completada", "cancelada"] }, fechaLimite: { lt: hoy } },
    }),
    db.tarea.count({ where: { workspaceId } }),
  ])

  const tareasProximas = await db.tarea.findMany({
    where: {
      workspaceId,
      estado: { notIn: ["completada", "cancelada"] },
      fechaLimite: { gte: hoy },
    },
    orderBy: { fechaLimite: "asc" },
    take: 5,
    include: { proyecto: true },
  })

  const proximas = tareasProximas.map((t) =>
    `- "${t.titulo}" → ${t.fechaLimite?.toISOString().slice(0, 10)} (${t.prioridad}, proyecto: ${t.proyecto?.nombre ?? "N/A"})`
  ).join("\n")

  const prompt = `Genera un resumen diario de tareas para hoy ${hoy.toISOString().slice(0, 10)}:
Total de tareas: ${total}
Pendientes: ${pendientes}
Completadas hoy: ${completadasHoy}
Con retraso: ${vencidas}

Proximas a vencer:
${proximas || "Ninguna"}

Redacta un resumen ejecutivo breve con alertas, prioridades del dia y recomendaciones.`
  const result = await askMotorIA(prompt, "editorial")

  return { stats: { total, pendientes, completadasHoy, vencidas }, result }
}

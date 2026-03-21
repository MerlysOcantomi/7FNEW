import { db } from "@core/db"
import { askMotorIA } from "@engines/ai"
import { DEFAULT_WORKSPACE_ID } from "@/lib/workspace"

export async function detectarBloqueos(workspaceId = DEFAULT_WORKSPACE_ID) {
  const proyectos = await db.proyecto.findMany({
    where: {
      workspaceId,
      estado: { in: ["en_progreso", "planificacion"] },
    },
    include: {
      tareas: true,
      cliente: true,
    },
  })

  if (proyectos.length === 0) {
    return { count: 0, result: "No hay proyectos activos para analizar." }
  }

  const hoy = new Date()

  const resumen = proyectos.map((p) => {
    const totalTareas = p.tareas.length
    const completadas = p.tareas.filter((t) => t.estado === "completada").length
    const vencidas = p.tareas.filter(
      (t) => t.fechaLimite && new Date(t.fechaLimite) < hoy && t.estado !== "completada" && t.estado !== "cancelada"
    ).length
    const sinAsignar = p.tareas.filter((t) => !t.usuarioId).length

    return `Proyecto: "${p.nombre}" (estado: ${p.estado}, progreso: ${p.progreso}%)
  - Cliente: ${p.cliente?.nombre ?? "N/A"}
  - Tareas: ${totalTareas} total, ${completadas} completadas, ${vencidas} vencidas, ${sinAsignar} sin asignar
  - Fechas: inicio ${p.fechaInicio?.toISOString().slice(0, 10) ?? "N/A"} → fin ${p.fechaFin?.toISOString().slice(0, 10) ?? "N/A"}
  - Presupuesto: ${p.presupuesto ? `$${p.presupuesto}` : "N/A"}`
  }).join("\n\n")

  const prompt = `Analiza estos proyectos activos y detecta bloqueos o problemas:\n\n${resumen}\n\nFecha actual: ${hoy.toISOString().slice(0, 10)}\n\nPara cada proyecto identifica: bloqueos, riesgos, y acciones correctivas prioritarias.`
  const result = await askMotorIA(prompt, "operativo")

  return { count: proyectos.length, result }
}

export async function sugerirSiguientesPasos(workspaceId = DEFAULT_WORKSPACE_ID) {
  const proyectos = await db.proyecto.findMany({
    where: {
      workspaceId,
      estado: { in: ["en_progreso", "planificacion"] },
    },
    include: {
      tareas: {
        where: { estado: { notIn: ["completada", "cancelada"] } },
        take: 5,
        orderBy: { createdAt: "desc" },
      },
      cliente: true,
    },
    take: 5,
  })

  if (proyectos.length === 0) {
    return { count: 0, result: "No hay proyectos activos." }
  }

  const resumen = proyectos.map((p) => {
    const tareasAbiertas = p.tareas.map((t) => `    - "${t.titulo}" (${t.estado}, ${t.prioridad})`).join("\n")
    return `Proyecto: "${p.nombre}" (${p.estado}, ${p.progreso}% avance)
  Cliente: ${p.cliente?.nombre ?? "N/A"}
  Tareas abiertas:\n${tareasAbiertas || "    - Ninguna"}`
  }).join("\n\n")

  const prompt = `Para cada uno de estos proyectos, sugiere los 3 proximos pasos mas importantes:\n\n${resumen}\n\nCada paso debe ser concreto, accionable y con responsable sugerido.`
  const result = await askMotorIA(prompt, "operativo")

  return { count: proyectos.length, result }
}

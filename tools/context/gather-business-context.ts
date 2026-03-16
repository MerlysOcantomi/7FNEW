import { db } from "@core/db"

export async function gatherBusinessContext(workspaceId: string): Promise<string> {
  try {
    const [clientes, proyectos, tareasPendientes, facturasRecientes, campanasActivas, contenidoReciente] = await Promise.all([
      db.cliente.findMany({ where: { workspaceId }, take: 30, orderBy: { updatedAt: "desc" }, select: { id: true, nombre: true, email: true, empresa: true } }),
      db.proyecto.findMany({ where: { workspaceId, estado: { not: "completado" } }, take: 20, orderBy: { updatedAt: "desc" }, select: { id: true, nombre: true, estado: true, prioridad: true, clienteId: true } }),
      db.tarea.findMany({ where: { workspaceId, estado: { not: "completada" } }, take: 20, orderBy: { fechaLimite: "asc" }, select: { id: true, titulo: true, estado: true, prioridad: true, fechaLimite: true, proyectoId: true } }),
      db.factura.findMany({ where: { workspaceId }, take: 15, orderBy: { createdAt: "desc" }, select: { id: true, numero: true, estado: true, total: true, clienteId: true, fechaEmision: true, fechaVencimiento: true } }),
      db.campaign.findMany({ where: { workspaceId, estado: { in: ["activa", "planificacion"] } }, take: 10, orderBy: { updatedAt: "desc" }, select: { id: true, nombre: true, estado: true, marca: true } }),
      db.contentPiece.findMany({ where: { workspaceId }, take: 10, orderBy: { createdAt: "desc" }, select: { id: true, titulo: true, estado: true, plataforma: true, tipo: true } }),
    ])

    const parts: string[] = []
    const today = new Date()
    parts.push(`FECHA ACTUAL: ${today.toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`)

    if (clientes.length > 0) {
      parts.push(`CLIENTES (${clientes.length}):\n${clientes.map((c) => `- [${c.id}] ${c.nombre}${c.empresa ? ` (${c.empresa})` : ""} — ${c.email || "sin email"}`).join("\n")}`)
    }
    if (proyectos.length > 0) {
      parts.push(`PROYECTOS ACTIVOS (${proyectos.length}):\n${proyectos.map((p) => `- [${p.id}] ${p.nombre} [${p.estado}] prioridad:${p.prioridad || "normal"}`).join("\n")}`)
    }
    if (tareasPendientes.length > 0) {
      const atrasadas = tareasPendientes.filter((t) => t.fechaLimite && new Date(t.fechaLimite) < today)
      parts.push(`TAREAS PENDIENTES (${tareasPendientes.length}, ${atrasadas.length} atrasadas):\n${tareasPendientes.map((t) => {
        const vencida = t.fechaLimite && new Date(t.fechaLimite) < today
        return `- [${t.id}] ${t.titulo} [${t.estado}] prioridad:${t.prioridad || "normal"}${t.fechaLimite ? ` vence:${new Date(t.fechaLimite).toLocaleDateString("es-MX")}` : ""}${vencida ? " ⚠ ATRASADA" : ""}`
      }).join("\n")}`)
    }
    if (facturasRecientes.length > 0) {
      const vencidas = facturasRecientes.filter((f) => f.fechaVencimiento && new Date(f.fechaVencimiento) < today && f.estado !== "pagada")
      parts.push(`FACTURAS (${facturasRecientes.length}, ${vencidas.length} vencidas):\n${facturasRecientes.map((f) => {
        const vencida = f.fechaVencimiento && new Date(f.fechaVencimiento) < today && f.estado !== "pagada"
        return `- [${f.id}] #${f.numero} [${f.estado}] $${f.total}${f.fechaVencimiento ? ` vence:${new Date(f.fechaVencimiento).toLocaleDateString("es-MX")}` : ""}${vencida ? " ⚠ VENCIDA" : ""}`
      }).join("\n")}`)
    }
    if (campanasActivas.length > 0) {
      parts.push(`CAMPANAS (${campanasActivas.length}):\n${campanasActivas.map((c) => `- [${c.id}] ${c.nombre} [${c.estado}] marca:${c.marca}`).join("\n")}`)
    }
    if (contenidoReciente.length > 0) {
      parts.push(`CONTENIDO RECIENTE (${contenidoReciente.length}):\n${contenidoReciente.map((c) => `- [${c.id}] ${c.titulo} [${c.estado}] ${c.plataforma}/${c.tipo}`).join("\n")}`)
    }

    return parts.join("\n\n")
  } catch (error) {
    console.error("[Agent] Context error:", error)
    return `FECHA ACTUAL: ${new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n(Error al cargar contexto)`
  }
}

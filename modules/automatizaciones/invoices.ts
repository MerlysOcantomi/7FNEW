import { db } from "@core/db"
import { askMotorIA } from "@engines/ai"

export async function detectarVencimientos(workspaceId: string) {
  const hoy = new Date()
  const facturas = await db.factura.findMany({
    where: {
      workspaceId,
      estado: { in: ["enviada", "vencida"] },
      fechaVencimiento: { lt: hoy },
    },
    include: { cliente: true, proyecto: true },
    orderBy: { fechaVencimiento: "asc" },
  })

  if (facturas.length === 0) {
    return { count: 0, result: "No hay facturas vencidas." }
  }

  const totalVencido = facturas.reduce((sum, f) => sum + f.total, 0)
  const resumen = facturas.map((f) => {
    const dias = Math.ceil((hoy.getTime() - new Date(f.fechaVencimiento!).getTime()) / 86400000)
    return `- Factura ${f.numero}: $${f.total} (vencida hace ${dias} dias, cliente: ${f.cliente?.nombre ?? "N/A"})`
  }).join("\n")

  const prompt = `Se detectaron ${facturas.length} facturas vencidas por un total de $${totalVencido.toFixed(2)}:\n${resumen}\n\nAnaliza la situacion: prioriza por monto y dias de atraso, sugiere estrategia de cobro para cada una.`
  const result = await askMotorIA(prompt, "operativo")

  return { count: facturas.length, totalVencido, result }
}

export async function generarRecordatorios(workspaceId: string) {
  const hoy = new Date()
  const en7dias = new Date(hoy)
  en7dias.setDate(en7dias.getDate() + 7)

  const facturas = await db.factura.findMany({
    where: {
      workspaceId,
      estado: { in: ["enviada", "borrador"] },
      fechaVencimiento: { gte: hoy, lt: en7dias },
    },
    include: { cliente: true },
    orderBy: { fechaVencimiento: "asc" },
  })

  if (facturas.length === 0) {
    return { count: 0, result: "No hay facturas proximas a vencer en los proximos 7 dias." }
  }

  const resumen = facturas.map((f) => {
    const dias = Math.ceil((new Date(f.fechaVencimiento!).getTime() - hoy.getTime()) / 86400000)
    return `- Factura ${f.numero}: $${f.total}, vence en ${dias} dias, cliente: ${f.cliente?.nombre ?? "N/A"}`
  }).join("\n")

  const prompt = `Estas facturas vencen en los proximos 7 dias:\n${resumen}\n\nPara cada una, redacta un recordatorio de pago profesional y amable dirigido al cliente. Incluye el monto, fecha de vencimiento y datos de la factura.`
  const result = await askMotorIA(prompt, "editorial")

  return { count: facturas.length, result }
}

import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "../generated/prisma/client"

const dbUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL
if (!dbUrl) throw new Error("DATABASE_URL or TURSO_DATABASE_URL must be set")

const adapter = new PrismaLibSql({
  url: dbUrl,
  authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
})
const db = new PrismaClient({ adapter })

async function seedVerticals() {
  console.log("Seeding verticales...")

  const verticals = [
    {
      key: "creative-agency",
      name: "Agencia Creativa",
      description: "Agencias de diseño, branding, marketing y producción audiovisual",
      defaultConfig: JSON.stringify({
        modules: {
          advancedProjectPlan: false,
          crm: true,
          finance: true,
          inbox: true,
          automation: true,
          campaigns: true,
          content: true,
        },
        ui: {
          labels: {
            projects: "Proyectos",
            clients: "Clientes",
            tasks: "Tareas",
            invoices: "Facturas",
          },
        },
      }),
    },
    {
      key: "construction",
      name: "Construcción",
      description: "Empresas de construcción, remodelación y obra civil",
      defaultConfig: JSON.stringify({
        modules: {
          advancedProjectPlan: true,
          crm: true,
          finance: true,
          inbox: true,
          automation: true,
          campaigns: false,
          content: false,
        },
        ui: {
          labels: {
            projects: "Obras",
            clients: "Clientes",
            tasks: "Actividades",
            invoices: "Estimaciones",
          },
        },
      }),
    },
    {
      key: "florals",
      name: "Floristerías",
      description: "Floristerías, event styling y decoración floral",
      defaultConfig: JSON.stringify({
        modules: {
          advancedProjectPlan: false,
          crm: true,
          finance: true,
          inbox: true,
          automation: true,
          campaigns: true,
          content: true,
        },
        ui: {
          labels: {
            projects: "Eventos",
            clients: "Clientes",
            tasks: "Pedidos",
            invoices: "Cotizaciones",
          },
        },
      }),
    },
    {
      key: "clinic",
      name: "Clínica / Salud",
      description: "Clínicas, consultorios y centros de salud",
      defaultConfig: JSON.stringify({
        modules: {
          advancedProjectPlan: false,
          crm: true,
          finance: true,
          inbox: true,
          automation: true,
          campaigns: false,
          content: false,
        },
        ui: {
          labels: {
            projects: "Tratamientos",
            clients: "Pacientes",
            tasks: "Citas",
            invoices: "Facturas",
          },
        },
      }),
    },
    {
      key: "law",
      name: "Despacho Legal",
      description: "Despachos de abogados y consultoría legal",
      defaultConfig: JSON.stringify({
        modules: {
          advancedProjectPlan: false,
          crm: true,
          finance: true,
          inbox: true,
          automation: true,
          campaigns: false,
          content: false,
        },
        ui: {
          labels: {
            projects: "Casos",
            clients: "Clientes",
            tasks: "Diligencias",
            invoices: "Honorarios",
          },
        },
      }),
    },
  ]

  for (const v of verticals) {
    await db.vertical.upsert({
      where: { key: v.key },
      update: { name: v.name, description: v.description, defaultConfig: v.defaultConfig },
      create: v,
    })
  }

  console.log(`  ${verticals.length} verticales insertadas`)
}

async function main() {
  await seedVerticals()

  console.log("Limpiando base de datos...")
  await db.tarea.deleteMany()
  await db.documento.deleteMany()
  await db.transaccion.deleteMany()
  await db.factura.deleteMany()
  await db.evento.deleteMany()
  await db.nota.deleteMany()
  await db.automatizacion.deleteMany()
  await db.proyecto.deleteMany()
  await db.cliente.deleteMany()
  await db.usuario.deleteMany()

  console.log("Creando usuarios...")
  const usuarios = await Promise.all([
    db.usuario.create({ data: { nombre: "Ana Rodríguez", email: "ana@7f.com", rol: "admin", departamento: "Dirección", estado: "activo" } }),
    db.usuario.create({ data: { nombre: "Diego Navarro", email: "diego@7f.com", rol: "gerente", departamento: "Desarrollo", estado: "activo" } }),
    db.usuario.create({ data: { nombre: "Sofía Torres", email: "sofia@7f.com", rol: "miembro", departamento: "Diseño", estado: "activo" } }),
    db.usuario.create({ data: { nombre: "Roberto Díaz", email: "roberto@7f.com", rol: "miembro", departamento: "Marketing", estado: "activo" } }),
    db.usuario.create({ data: { nombre: "Laura Chen", email: "laura@7f.com", rol: "miembro", departamento: "Desarrollo", estado: "activo" } }),
    db.usuario.create({ data: { nombre: "Miguel Torres", email: "miguel@7f.com", rol: "gerente", departamento: "Finanzas", estado: "activo" } }),
    db.usuario.create({ data: { nombre: "Valentina Mora", email: "valentina@7f.com", rol: "miembro", departamento: "Estrategia", estado: "activo" } }),
    db.usuario.create({ data: { nombre: "Jorge Vega", email: "jorge@7f.com", rol: "miembro", departamento: "Producción", estado: "inactivo" } }),
  ])

  console.log("Creando clientes...")
  const clientes = await Promise.all([
    db.cliente.create({ data: { nombre: "Cliente activo", email: "contacto@clienteactivo.com", telefono: "+52 55 1234 5678", empresa: "Cliente Activo S.A. de C.V.", tipo: "empresa", estado: "activo", notas: "Cliente desde 2024. Contrato anual de branding y web." } }),
    db.cliente.create({ data: { nombre: "Cuenta prioritaria", email: "hola@cuentaprioritaria.com", telefono: "+52 55 2345 6789", empresa: "Cuenta Prioritaria S.A.P.I.", tipo: "startup", estado: "activo", notas: "Cuenta con proyecto de campaña digital en curso." } }),
    db.cliente.create({ data: { nombre: "Cuenta creativa", email: "info@cuentacreativa.com", telefono: "+52 55 3456 7890", empresa: "Cuenta Creativa S.A.", tipo: "empresa", estado: "activo", notas: "Trabajo de branding entregado. Posible fase 2." } }),
    db.cliente.create({ data: { nombre: "Operacion digital", email: "andres@operaciondigital.com", telefono: "+52 55 4567 8901", empresa: "Operacion Digital S.A.", tipo: "empresa", estado: "activo", notas: "Aplicación web en desarrollo. Presupuesto alto." } }),
    db.cliente.create({ data: { nombre: "Lead consultivo", email: "laura@leadconsultivo.com", telefono: "+52 55 5678 9012", empresa: "Lead Consultivo LLC", tipo: "empresa", estado: "prospecto", notas: "En negociación. Interesado en servicios de consultoría." } }),
    db.cliente.create({ data: { nombre: "Partner recurrente", email: "jorge@partnerrecurrente.mx", telefono: "+52 55 6789 0123", empresa: "Partner Recurrente Media", tipo: "freelancer", estado: "activo", notas: "Productor independiente. Proyectos recurrentes." } }),
    db.cliente.create({ data: { nombre: "Cuenta de inversion", email: "contacto@cuentadeinversion.com", telefono: "+52 55 7890 1234", empresa: "Cuenta de Inversion Capital", tipo: "empresa", estado: "prospecto", notas: "Cuenta del sector financiero. Contacto inicial por referencia." } }),
    db.cliente.create({ data: { nombre: "Proyecto en pausa", email: "hello@proyectoenpausa.co", telefono: "+52 55 8901 2345", empresa: "Proyecto en Pausa Creativo", tipo: "startup", estado: "inactivo", notas: "Proyecto pausado por restructuración interna." } }),
  ])

  console.log("Creando proyectos...")
  const proyectos = await Promise.all([
    db.proyecto.create({ data: { nombre: "Rediseño Web Cliente Activo", descripcion: "Rediseño completo del sitio web corporativo.", estado: "en_progreso", prioridad: "alta", progreso: 65, presupuesto: 48000, fechaInicio: new Date("2025-11-15"), fechaFin: new Date("2026-03-30"), clienteId: clientes[0].id } }),
    db.proyecto.create({ data: { nombre: "Campaña Digital Prioritaria", descripcion: "Campaña de lanzamiento de producto.", estado: "en_progreso", prioridad: "alta", progreso: 40, presupuesto: 35000, fechaInicio: new Date("2026-01-10"), fechaFin: new Date("2026-04-15"), clienteId: clientes[1].id } }),
    db.proyecto.create({ data: { nombre: "Branding Cuenta Creativa", descripcion: "Identidad de marca completa.", estado: "revision", prioridad: "media", progreso: 90, presupuesto: 28000, fechaInicio: new Date("2025-10-01"), fechaFin: new Date("2026-02-28"), clienteId: clientes[2].id } }),
    db.proyecto.create({ data: { nombre: "Web App Operacion Digital", descripcion: "Desarrollo de aplicación web SaaS.", estado: "en_progreso", prioridad: "urgente", progreso: 30, presupuesto: 120000, fechaInicio: new Date("2026-01-20"), fechaFin: new Date("2026-08-30"), clienteId: clientes[3].id } }),
    db.proyecto.create({ data: { nombre: "Consultoría Comercial", descripcion: "Consultoría estratégica de posicionamiento digital.", estado: "planificacion", prioridad: "media", progreso: 10, presupuesto: 15000, fechaInicio: new Date("2026-03-01"), fechaFin: new Date("2026-06-30"), clienteId: clientes[4].id } }),
    db.proyecto.create({ data: { nombre: "Video Institucional Recurrente", descripcion: "Producción de video corporativo.", estado: "completado", prioridad: "baja", progreso: 100, presupuesto: 18000, fechaInicio: new Date("2025-09-01"), fechaFin: new Date("2025-12-15"), clienteId: clientes[5].id } }),
    db.proyecto.create({ data: { nombre: "E-commerce Cliente Activo", descripcion: "Tienda en línea integrada al sitio principal.", estado: "planificacion", prioridad: "alta", progreso: 5, presupuesto: 65000, fechaInicio: new Date("2026-04-01"), fechaFin: new Date("2026-09-30"), clienteId: clientes[0].id } }),
  ])

  console.log("Creando tareas...")
  await Promise.all([
    db.tarea.create({ data: { titulo: "Diseñar logotipo alternativo", descripcion: "Crear 3 variaciones del logotipo.", estado: "en_progreso", prioridad: "alta", fechaLimite: new Date("2026-02-22"), proyectoId: proyectos[0].id, clienteId: clientes[0].id, usuarioId: usuarios[2].id } }),
    db.tarea.create({ data: { titulo: "Maquetación landing page", descripcion: "Implementar diseño aprobado en Next.js.", estado: "pendiente", prioridad: "alta", fechaLimite: new Date("2026-02-25"), proyectoId: proyectos[0].id, clienteId: clientes[0].id, usuarioId: usuarios[1].id } }),
    db.tarea.create({ data: { titulo: "Redactar copy para redes", descripcion: "30 publicaciones para Instagram y LinkedIn.", estado: "en_progreso", prioridad: "media", fechaLimite: new Date("2026-02-20"), proyectoId: proyectos[1].id, clienteId: clientes[1].id, usuarioId: usuarios[3].id } }),
    db.tarea.create({ data: { titulo: "Revisión de paleta de color", descripcion: "Ajustar contraste según feedback.", estado: "completada", prioridad: "baja", fechaLimite: new Date("2026-02-18"), proyectoId: proyectos[2].id, clienteId: clientes[2].id, usuarioId: usuarios[2].id } }),
    db.tarea.create({ data: { titulo: "Configurar analytics", descripcion: "Implementar Google Analytics 4.", estado: "pendiente", prioridad: "media", fechaLimite: new Date("2026-02-28"), proyectoId: proyectos[3].id, clienteId: clientes[3].id, usuarioId: usuarios[1].id } }),
    db.tarea.create({ data: { titulo: "Implementar sistema de pagos", descripcion: "Integración con Stripe.", estado: "en_progreso", prioridad: "urgente", fechaLimite: new Date("2026-03-10"), proyectoId: proyectos[3].id, clienteId: clientes[3].id, usuarioId: usuarios[4].id } }),
    db.tarea.create({ data: { titulo: "Propuesta comercial consultiva", descripcion: "Elaborar propuesta de servicios.", estado: "pendiente", prioridad: "alta", fechaLimite: new Date("2026-02-26"), proyectoId: proyectos[4].id, clienteId: clientes[4].id, usuarioId: usuarios[0].id } }),
  ])

  console.log("Creando transacciones...")
  await Promise.all([
    db.transaccion.create({ data: { tipo: "ingreso", monto: 24000, descripcion: "Anticipo 50% - Rediseño Web Cliente Activo", categoria: "proyectos", fecha: new Date("2025-11-20"), clienteId: clientes[0].id, proyectoId: proyectos[0].id } }),
    db.transaccion.create({ data: { tipo: "ingreso", monto: 17500, descripcion: "Anticipo 50% - Campaña Digital Prioritaria", categoria: "proyectos", fecha: new Date("2026-01-15"), clienteId: clientes[1].id, proyectoId: proyectos[1].id } }),
    db.transaccion.create({ data: { tipo: "ingreso", monto: 60000, descripcion: "Anticipo 50% - Web App Operacion Digital", categoria: "proyectos", fecha: new Date("2026-01-25"), clienteId: clientes[3].id, proyectoId: proyectos[3].id } }),
    db.transaccion.create({ data: { tipo: "gasto", monto: 8500, descripcion: "Licencias software", categoria: "herramientas", fecha: new Date("2026-01-05") } }),
    db.transaccion.create({ data: { tipo: "gasto", monto: 45000, descripcion: "Nómina equipo - Enero 2026", categoria: "nomina", fecha: new Date("2026-01-31") } }),
  ])

  console.log("Creando facturas...")
  await Promise.all([
    db.factura.create({ data: { numero: "7F-2026-001", estado: "pagada", subtotal: 17500, impuesto: 2800, total: 20300, items: JSON.stringify([{ descripcion: "Campaña Digital - Anticipo 50%", cantidad: 1, precioUnitario: 17500, total: 17500 }]), fechaEmision: new Date("2026-01-12"), fechaVencimiento: new Date("2026-02-12"), clienteId: clientes[1].id, proyectoId: proyectos[1].id } }),
    db.factura.create({ data: { numero: "7F-2026-002", estado: "pagada", subtotal: 60000, impuesto: 9600, total: 69600, items: JSON.stringify([{ descripcion: "Web App SaaS - Anticipo 50%", cantidad: 1, precioUnitario: 60000, total: 60000 }]), fechaEmision: new Date("2026-01-22"), fechaVencimiento: new Date("2026-02-22"), clienteId: clientes[3].id, proyectoId: proyectos[3].id } }),
    db.factura.create({ data: { numero: "7F-2026-003", estado: "enviada", subtotal: 7000, impuesto: 1120, total: 8120, items: JSON.stringify([{ descripcion: "Branding cuenta creativa - Pago final", cantidad: 1, precioUnitario: 7000, total: 7000 }]), fechaEmision: new Date("2026-02-10"), fechaVencimiento: new Date("2026-03-10"), clienteId: clientes[2].id, proyectoId: proyectos[2].id } }),
  ])

  console.log("Creando eventos...")
  await Promise.all([
    db.evento.create({ data: { titulo: "Revisión semanal equipo", descripcion: "Standup semanal.", tipo: "reunion", fechaInicio: new Date("2026-02-23T10:00:00"), fechaFin: new Date("2026-02-23T11:00:00") } }),
    db.evento.create({ data: { titulo: "Presentación branding cliente", descripcion: "Entrega final de brand guidelines.", tipo: "entrega", fechaInicio: new Date("2026-02-25T15:00:00"), fechaFin: new Date("2026-02-25T16:30:00"), clienteId: clientes[2].id, proyectoId: proyectos[2].id } }),
  ])

  console.log("Creando notas...")
  await Promise.all([
    db.nota.create({ data: { titulo: "Estrategia Q2 2026", contenido: "Prioridades del trimestre:\n- Cerrar proyecto de branding\n- Avanzar 60% en la web app activa\n- Convertir el lead consultivo" } }),
  ])

  console.log("\n Seed completado")
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e)
    db.$disconnect()
    process.exit(1)
  })

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { PrismaClient } from "../generated/prisma/client"

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" })
const db = new PrismaClient({ adapter })

async function main() {
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
    db.cliente.create({ data: { nombre: "Alpha Corp", email: "contacto@alphacorp.com", telefono: "+52 55 1234 5678", empresa: "Alpha Corp S.A. de C.V.", tipo: "empresa", estado: "activo", notas: "Cliente desde 2024. Contrato anual de branding y web." } }),
    db.cliente.create({ data: { nombre: "Beta Labs", email: "hola@betalabs.io", telefono: "+52 55 2345 6789", empresa: "Beta Labs Inc.", tipo: "startup", estado: "activo", notas: "Startup de IA. Proyecto de campaña digital en curso." } }),
    db.cliente.create({ data: { nombre: "Gamma Inc", email: "info@gammainc.com", telefono: "+52 55 3456 7890", empresa: "Gamma Inc.", tipo: "empresa", estado: "activo", notas: "Branding completo entregado. Posible fase 2." } }),
    db.cliente.create({ data: { nombre: "Delta Tech", email: "andres@deltatech.com", telefono: "+52 55 4567 8901", empresa: "Delta Tech Solutions", tipo: "empresa", estado: "activo", notas: "Web app en desarrollo. Presupuesto alto." } }),
    db.cliente.create({ data: { nombre: "Epsilon Group", email: "laura@epsilongroup.com", telefono: "+52 55 5678 9012", empresa: "Epsilon Group LLC", tipo: "empresa", estado: "prospecto", notas: "En negociación. Interesado en servicios de consultoría." } }),
    db.cliente.create({ data: { nombre: "Zeta Digital", email: "jorge@zetadigital.mx", telefono: "+52 55 6789 0123", empresa: "Zeta Digital Media", tipo: "freelancer", estado: "activo", notas: "Productor independiente. Proyectos recurrentes." } }),
    db.cliente.create({ data: { nombre: "Sigma Ventures", email: "contacto@sigmavc.com", telefono: "+52 55 7890 1234", empresa: "Sigma Ventures Capital", tipo: "empresa", estado: "prospecto", notas: "Fondo de inversión. Contacto inicial por referencia." } }),
    db.cliente.create({ data: { nombre: "Omega Studio", email: "hello@omegastudio.co", telefono: "+52 55 8901 2345", empresa: "Omega Studio Creativo", tipo: "startup", estado: "inactivo", notas: "Proyecto pausado por restructuración interna." } }),
  ])

  console.log("Creando proyectos...")
  const proyectos = await Promise.all([
    db.proyecto.create({ data: { nombre: "Rediseño Web Alpha Corp", descripcion: "Rediseño completo del sitio web corporativo. Incluye nueva arquitectura de información, diseño UI/UX y desarrollo frontend.", estado: "en_progreso", prioridad: "alta", progreso: 65, presupuesto: 48000, fechaInicio: new Date("2025-11-15"), fechaFin: new Date("2026-03-30"), clienteId: clientes[0].id } }),
    db.proyecto.create({ data: { nombre: "Campaña Digital Beta Labs", descripcion: "Campaña de lanzamiento de producto con estrategia en redes sociales, contenido y pauta digital.", estado: "en_progreso", prioridad: "alta", progreso: 40, presupuesto: 35000, fechaInicio: new Date("2026-01-10"), fechaFin: new Date("2026-04-15"), clienteId: clientes[1].id } }),
    db.proyecto.create({ data: { nombre: "Branding Gamma Inc", descripcion: "Identidad de marca completa: logotipo, paleta cromática, tipografía, brand guidelines y aplicaciones.", estado: "revision", prioridad: "media", progreso: 90, presupuesto: 28000, fechaInicio: new Date("2025-10-01"), fechaFin: new Date("2026-02-28"), clienteId: clientes[2].id } }),
    db.proyecto.create({ data: { nombre: "Web App Delta Tech", descripcion: "Desarrollo de aplicación web SaaS para gestión de inventarios. Stack: Next.js, PostgreSQL, Stripe.", estado: "en_progreso", prioridad: "urgente", progreso: 30, presupuesto: 120000, fechaInicio: new Date("2026-01-20"), fechaFin: new Date("2026-08-30"), clienteId: clientes[3].id } }),
    db.proyecto.create({ data: { nombre: "Consultoría Epsilon", descripcion: "Consultoría estratégica de posicionamiento digital y plan de marketing a 12 meses.", estado: "planificacion", prioridad: "media", progreso: 10, presupuesto: 15000, fechaInicio: new Date("2026-03-01"), fechaFin: new Date("2026-06-30"), clienteId: clientes[4].id } }),
    db.proyecto.create({ data: { nombre: "Video Institucional Zeta", descripcion: "Producción de video corporativo de 3 minutos con animación motion graphics.", estado: "completado", prioridad: "baja", progreso: 100, presupuesto: 18000, fechaInicio: new Date("2025-09-01"), fechaFin: new Date("2025-12-15"), clienteId: clientes[5].id } }),
    db.proyecto.create({ data: { nombre: "E-commerce Alpha Corp", descripcion: "Tienda en línea integrada al sitio principal. Catálogo de productos, carrito y pasarela de pago.", estado: "planificacion", prioridad: "alta", progreso: 5, presupuesto: 65000, fechaInicio: new Date("2026-04-01"), fechaFin: new Date("2026-09-30"), clienteId: clientes[0].id } }),
  ])

  console.log("Creando tareas...")
  await Promise.all([
    db.tarea.create({ data: { titulo: "Diseñar logotipo alternativo", descripcion: "Crear 3 variaciones del logotipo para presentar al cliente.", estado: "en_progreso", prioridad: "alta", fechaLimite: new Date("2026-02-22"), proyectoId: proyectos[0].id, clienteId: clientes[0].id, usuarioId: usuarios[2].id } }),
    db.tarea.create({ data: { titulo: "Maquetación landing page", descripcion: "Implementar diseño aprobado en Next.js con componentes reutilizables.", estado: "pendiente", prioridad: "alta", fechaLimite: new Date("2026-02-25"), proyectoId: proyectos[0].id, clienteId: clientes[0].id, usuarioId: usuarios[1].id } }),
    db.tarea.create({ data: { titulo: "Redactar copy para redes", descripcion: "30 publicaciones para Instagram y LinkedIn. Tono profesional.", estado: "en_progreso", prioridad: "media", fechaLimite: new Date("2026-02-20"), proyectoId: proyectos[1].id, clienteId: clientes[1].id, usuarioId: usuarios[3].id } }),
    db.tarea.create({ data: { titulo: "Revisión de paleta de color", descripcion: "Ajustar contraste según feedback del cliente.", estado: "completada", prioridad: "baja", fechaLimite: new Date("2026-02-18"), proyectoId: proyectos[2].id, clienteId: clientes[2].id, usuarioId: usuarios[2].id } }),
    db.tarea.create({ data: { titulo: "Configurar analytics", descripcion: "Implementar Google Analytics 4 y eventos personalizados.", estado: "pendiente", prioridad: "media", fechaLimite: new Date("2026-02-28"), proyectoId: proyectos[3].id, clienteId: clientes[3].id, usuarioId: usuarios[1].id } }),
    db.tarea.create({ data: { titulo: "Entrega de brand guidelines", descripcion: "PDF final con manual de identidad corporativa.", estado: "revision", prioridad: "alta", fechaLimite: new Date("2026-02-19"), proyectoId: proyectos[2].id, clienteId: clientes[2].id, usuarioId: usuarios[6].id } }),
    db.tarea.create({ data: { titulo: "Crear storyboard video", descripcion: "Storyboard de 12 escenas para video de campaña.", estado: "pendiente", prioridad: "media", fechaLimite: new Date("2026-03-01"), proyectoId: proyectos[1].id, clienteId: clientes[1].id, usuarioId: usuarios[7].id } }),
    db.tarea.create({ data: { titulo: "Optimización SEO on-page", descripcion: "Meta tags, headings, alt texts y estructura semántica.", estado: "pendiente", prioridad: "baja", fechaLimite: new Date("2026-03-05"), proyectoId: proyectos[0].id, clienteId: clientes[0].id, usuarioId: usuarios[1].id } }),
    db.tarea.create({ data: { titulo: "Presentación final al cliente", descripcion: "Deck de presentación con resultados del branding.", estado: "en_progreso", prioridad: "alta", fechaLimite: new Date("2026-02-21"), proyectoId: proyectos[2].id, clienteId: clientes[2].id, usuarioId: usuarios[6].id } }),
    db.tarea.create({ data: { titulo: "Implementar sistema de pagos", descripcion: "Integración con Stripe: checkout, webhooks y panel de admin.", estado: "en_progreso", prioridad: "urgente", fechaLimite: new Date("2026-03-10"), proyectoId: proyectos[3].id, clienteId: clientes[3].id, usuarioId: usuarios[4].id } }),
    db.tarea.create({ data: { titulo: "Fotografías de producto", descripcion: "Sesión fotográfica para catálogo web.", estado: "completada", prioridad: "media", fechaLimite: new Date("2026-02-15"), proyectoId: proyectos[1].id, clienteId: clientes[1].id, usuarioId: usuarios[3].id } }),
    db.tarea.create({ data: { titulo: "Wireframes sección blog", descripcion: "Diseño de wireframes para sección de blog corporativo.", estado: "pendiente", prioridad: "baja", fechaLimite: new Date("2026-03-12"), proyectoId: proyectos[0].id, clienteId: clientes[0].id, usuarioId: usuarios[2].id } }),
    db.tarea.create({ data: { titulo: "Diseño de interfaz dashboard", descripcion: "UI para el panel principal de la web app.", estado: "en_progreso", prioridad: "alta", fechaLimite: new Date("2026-03-15"), proyectoId: proyectos[3].id, clienteId: clientes[3].id, usuarioId: usuarios[2].id } }),
    db.tarea.create({ data: { titulo: "Propuesta comercial Epsilon", descripcion: "Elaborar propuesta de servicios con presupuesto y timeline.", estado: "pendiente", prioridad: "alta", fechaLimite: new Date("2026-02-26"), proyectoId: proyectos[4].id, clienteId: clientes[4].id, usuarioId: usuarios[0].id } }),
    db.tarea.create({ data: { titulo: "Testing responsive web Alpha", descripcion: "Verificar diseño en mobile, tablet y desktop.", estado: "pendiente", prioridad: "media", fechaLimite: new Date("2026-03-20"), proyectoId: proyectos[0].id, clienteId: clientes[0].id, usuarioId: usuarios[4].id } }),
  ])

  console.log("Creando transacciones...")
  await Promise.all([
    db.transaccion.create({ data: { tipo: "ingreso", monto: 24000, descripcion: "Anticipo 50% - Rediseño Web Alpha Corp", categoria: "proyectos", fecha: new Date("2025-11-20"), clienteId: clientes[0].id, proyectoId: proyectos[0].id } }),
    db.transaccion.create({ data: { tipo: "ingreso", monto: 17500, descripcion: "Anticipo 50% - Campaña Digital Beta Labs", categoria: "proyectos", fecha: new Date("2026-01-15"), clienteId: clientes[1].id, proyectoId: proyectos[1].id } }),
    db.transaccion.create({ data: { tipo: "ingreso", monto: 21000, descripcion: "Pago 75% - Branding Gamma Inc", categoria: "proyectos", fecha: new Date("2026-01-28"), clienteId: clientes[2].id, proyectoId: proyectos[2].id } }),
    db.transaccion.create({ data: { tipo: "ingreso", monto: 60000, descripcion: "Anticipo 50% - Web App Delta Tech", categoria: "proyectos", fecha: new Date("2026-01-25"), clienteId: clientes[3].id, proyectoId: proyectos[3].id } }),
    db.transaccion.create({ data: { tipo: "ingreso", monto: 18000, descripcion: "Pago total - Video Institucional Zeta", categoria: "proyectos", fecha: new Date("2025-12-20"), clienteId: clientes[5].id, proyectoId: proyectos[5].id } }),
    db.transaccion.create({ data: { tipo: "gasto", monto: 8500, descripcion: "Licencias software (Adobe CC, Figma, Vercel)", categoria: "herramientas", fecha: new Date("2026-01-05") } }),
    db.transaccion.create({ data: { tipo: "gasto", monto: 45000, descripcion: "Nómina equipo - Enero 2026", categoria: "nomina", fecha: new Date("2026-01-31") } }),
    db.transaccion.create({ data: { tipo: "gasto", monto: 3200, descripcion: "Hosting y servicios cloud", categoria: "infraestructura", fecha: new Date("2026-02-01") } }),
    db.transaccion.create({ data: { tipo: "gasto", monto: 12000, descripcion: "Pauta publicitaria - Campaña Beta Labs", categoria: "marketing", fecha: new Date("2026-02-05"), clienteId: clientes[1].id, proyectoId: proyectos[1].id } }),
    db.transaccion.create({ data: { tipo: "gasto", monto: 45000, descripcion: "Nómina equipo - Febrero 2026", categoria: "nomina", fecha: new Date("2026-02-15") } }),
    db.transaccion.create({ data: { tipo: "ingreso", monto: 7000, descripcion: "Branding Gamma - Pago final pendiente", categoria: "proyectos", fecha: new Date("2026-02-10"), clienteId: clientes[2].id, proyectoId: proyectos[2].id } }),
    db.transaccion.create({ data: { tipo: "gasto", monto: 2800, descripcion: "Equipo fotográfico alquiler", categoria: "produccion", fecha: new Date("2026-02-08") } }),
  ])

  console.log("Creando facturas...")
  await Promise.all([
    db.factura.create({ data: { numero: "7F-2025-001", estado: "pagada", subtotal: 18000, impuesto: 2880, total: 20880, items: JSON.stringify([{ descripcion: "Video Institucional - Producción completa", cantidad: 1, precioUnitario: 18000, total: 18000 }]), fechaEmision: new Date("2025-12-15"), fechaVencimiento: new Date("2026-01-15"), clienteId: clientes[5].id, proyectoId: proyectos[5].id } }),
    db.factura.create({ data: { numero: "7F-2025-002", estado: "pagada", subtotal: 24000, impuesto: 3840, total: 27840, items: JSON.stringify([{ descripcion: "Rediseño Web - Anticipo 50%", cantidad: 1, precioUnitario: 24000, total: 24000 }]), fechaEmision: new Date("2025-11-18"), fechaVencimiento: new Date("2025-12-18"), clienteId: clientes[0].id, proyectoId: proyectos[0].id } }),
    db.factura.create({ data: { numero: "7F-2026-001", estado: "pagada", subtotal: 17500, impuesto: 2800, total: 20300, items: JSON.stringify([{ descripcion: "Campaña Digital - Anticipo 50%", cantidad: 1, precioUnitario: 17500, total: 17500 }]), fechaEmision: new Date("2026-01-12"), fechaVencimiento: new Date("2026-02-12"), clienteId: clientes[1].id, proyectoId: proyectos[1].id } }),
    db.factura.create({ data: { numero: "7F-2026-002", estado: "pagada", subtotal: 21000, impuesto: 3360, total: 24360, items: JSON.stringify([{ descripcion: "Branding - Identidad corporativa (75%)", cantidad: 1, precioUnitario: 21000, total: 21000 }]), fechaEmision: new Date("2026-01-25"), fechaVencimiento: new Date("2026-02-25"), clienteId: clientes[2].id, proyectoId: proyectos[2].id } }),
    db.factura.create({ data: { numero: "7F-2026-003", estado: "pagada", subtotal: 60000, impuesto: 9600, total: 69600, items: JSON.stringify([{ descripcion: "Web App SaaS - Anticipo 50%", cantidad: 1, precioUnitario: 60000, total: 60000 }]), fechaEmision: new Date("2026-01-22"), fechaVencimiento: new Date("2026-02-22"), clienteId: clientes[3].id, proyectoId: proyectos[3].id } }),
    db.factura.create({ data: { numero: "7F-2026-004", estado: "enviada", subtotal: 7000, impuesto: 1120, total: 8120, items: JSON.stringify([{ descripcion: "Branding Gamma - Pago final 25%", cantidad: 1, precioUnitario: 7000, total: 7000 }]), fechaEmision: new Date("2026-02-10"), fechaVencimiento: new Date("2026-03-10"), clienteId: clientes[2].id, proyectoId: proyectos[2].id } }),
    db.factura.create({ data: { numero: "7F-2026-005", estado: "borrador", subtotal: 24000, impuesto: 3840, total: 27840, items: JSON.stringify([{ descripcion: "Rediseño Web - Segundo pago 50%", cantidad: 1, precioUnitario: 24000, total: 24000 }]), fechaEmision: new Date("2026-02-20"), fechaVencimiento: new Date("2026-03-20"), clienteId: clientes[0].id, proyectoId: proyectos[0].id } }),
    db.factura.create({ data: { numero: "7F-2026-006", estado: "borrador", subtotal: 17500, impuesto: 2800, total: 20300, items: JSON.stringify([{ descripcion: "Campaña Digital - Segundo pago 50%", cantidad: 1, precioUnitario: 17500, total: 17500 }]), fechaEmision: new Date("2026-02-20"), clienteId: clientes[1].id, proyectoId: proyectos[1].id } }),
  ])

  console.log("Creando documentos...")
  await Promise.all([
    db.documento.create({ data: { nombre: "Propuesta comercial Alpha Corp.pdf", tipo: "pdf", url: "/docs/propuesta-alpha.pdf", tamano: 2450000, clienteId: clientes[0].id, proyectoId: proyectos[0].id } }),
    db.documento.create({ data: { nombre: "Brand Guidelines Gamma v3.pdf", tipo: "pdf", url: "/docs/brand-gamma-v3.pdf", tamano: 8700000, clienteId: clientes[2].id, proyectoId: proyectos[2].id } }),
    db.documento.create({ data: { nombre: "Wireframes homepage.fig", tipo: "documento", url: "/docs/wireframes-alpha.fig", tamano: 4200000, clienteId: clientes[0].id, proyectoId: proyectos[0].id } }),
    db.documento.create({ data: { nombre: "Contrato Delta Tech.pdf", tipo: "pdf", url: "/docs/contrato-delta.pdf", tamano: 890000, clienteId: clientes[3].id, proyectoId: proyectos[3].id } }),
    db.documento.create({ data: { nombre: "Estrategia redes Beta.pptx", tipo: "documento", url: "/docs/estrategia-beta.pptx", tamano: 5600000, clienteId: clientes[1].id, proyectoId: proyectos[1].id } }),
    db.documento.create({ data: { nombre: "Logo Alpha final.svg", tipo: "imagen", url: "/docs/logo-alpha-final.svg", tamano: 45000, clienteId: clientes[0].id, proyectoId: proyectos[0].id } }),
    db.documento.create({ data: { nombre: "Reporte mensual Enero 2026.xlsx", tipo: "hoja_calculo", url: "/docs/reporte-enero-2026.xlsx", tamano: 1200000 } }),
    db.documento.create({ data: { nombre: "Brief creativo Epsilon.pdf", tipo: "pdf", url: "/docs/brief-epsilon.pdf", tamano: 670000, clienteId: clientes[4].id, proyectoId: proyectos[4].id } }),
    db.documento.create({ data: { nombre: "Fotografías producto Beta.zip", tipo: "otro", url: "/docs/fotos-beta.zip", tamano: 125000000, clienteId: clientes[1].id, proyectoId: proyectos[1].id } }),
  ])

  console.log("Creando eventos...")
  await Promise.all([
    db.evento.create({ data: { titulo: "Revisión semanal equipo", descripcion: "Standup semanal con todo el equipo.", tipo: "reunion", fechaInicio: new Date("2026-02-23T10:00:00"), fechaFin: new Date("2026-02-23T11:00:00") } }),
    db.evento.create({ data: { titulo: "Presentación branding Gamma", descripcion: "Entrega final de brand guidelines al cliente.", tipo: "entrega", fechaInicio: new Date("2026-02-25T15:00:00"), fechaFin: new Date("2026-02-25T16:30:00"), clienteId: clientes[2].id, proyectoId: proyectos[2].id } }),
    db.evento.create({ data: { titulo: "Kickoff Consultoría Epsilon", descripcion: "Primera reunión con el equipo de Epsilon Group.", tipo: "reunion", fechaInicio: new Date("2026-03-03T09:00:00"), fechaFin: new Date("2026-03-03T10:30:00"), clienteId: clientes[4].id, proyectoId: proyectos[4].id } }),
    db.evento.create({ data: { titulo: "Demo Web App Delta", descripcion: "Demo del MVP al equipo de Delta Tech.", tipo: "entrega", fechaInicio: new Date("2026-03-15T14:00:00"), fechaFin: new Date("2026-03-15T15:00:00"), clienteId: clientes[3].id, proyectoId: proyectos[3].id } }),
    db.evento.create({ data: { titulo: "Cierre fiscal Q1", descripcion: "Preparar reportes financieros del primer trimestre.", tipo: "recordatorio", fechaInicio: new Date("2026-03-31T09:00:00"), todoElDia: true } }),
    db.evento.create({ data: { titulo: "Review campaña Beta Labs", descripcion: "Revisión de métricas mid-campaign.", tipo: "reunion", fechaInicio: new Date("2026-03-01T11:00:00"), fechaFin: new Date("2026-03-01T12:00:00"), clienteId: clientes[1].id, proyectoId: proyectos[1].id } }),
  ])

  console.log("Creando notas...")
  await Promise.all([
    db.nota.create({ data: { titulo: "Ideas para e-commerce Alpha", contenido: "El cliente mencionó interés en:\n- Catálogo con filtros avanzados\n- Integración con su ERP\n- Sección de mayoreo con precios especiales\n\nEvaluar si Shopify headless o custom con Next.js.", clienteId: clientes[0].id, proyectoId: proyectos[6].id } }),
    db.nota.create({ data: { titulo: "Feedback reunión Gamma", contenido: "El cliente está satisfecho con la dirección del branding. Pide:\n1. Más opciones de color secundario\n2. Versión del logo para fondos oscuros\n3. Mockups de tarjetas de presentación", clienteId: clientes[2].id, proyectoId: proyectos[2].id } }),
    db.nota.create({ data: { titulo: "Estrategia Q2 2026", contenido: "Prioridades del trimestre:\n- Cerrar proyecto Gamma\n- Avanzar 60% en Web App Delta\n- Convertir a Epsilon de prospecto a cliente\n- Iniciar e-commerce Alpha\n- Contratar un desarrollador senior" } }),
    db.nota.create({ data: { titulo: "Stack técnico Delta Tech", contenido: "Decisiones técnicas confirmadas:\n- Frontend: Next.js 16 + TypeScript\n- Backend: API Routes + Prisma\n- DB: PostgreSQL (Neon)\n- Pagos: Stripe\n- Auth: NextAuth.js\n- Deploy: Vercel", clienteId: clientes[3].id, proyectoId: proyectos[3].id } }),
    db.nota.create({ data: { titulo: "Proceso de onboarding clientes", contenido: "Pasos del proceso:\n1. Reunión inicial (30 min)\n2. Brief creativo\n3. Propuesta comercial (48h)\n4. Firma de contrato\n5. Anticipo 50%\n6. Kickoff del proyecto" } }),
  ])

  console.log("Creando automatizaciones...")
  await Promise.all([
    db.automatizacion.create({ data: { nombre: "Bienvenida nuevo cliente", descripcion: "Enviar email de bienvenida cuando se crea un cliente nuevo.", trigger: "nuevo_cliente", condiciones: JSON.stringify({ estado: "activo" }), acciones: JSON.stringify([{ tipo: "enviar_email", plantilla: "bienvenida_cliente" }]), estado: "activa" } }),
    db.automatizacion.create({ data: { nombre: "Alerta tarea vencida", descripcion: "Notificar cuando una tarea pasa su fecha límite sin completarse.", trigger: "tarea_vencida", condiciones: JSON.stringify({ estado: ["pendiente", "en_progreso"] }), acciones: JSON.stringify([{ tipo: "notificacion", mensaje: "Tarea vencida: {titulo}" }, { tipo: "enviar_email", destinatario: "asignado" }]), estado: "activa" } }),
    db.automatizacion.create({ data: { nombre: "Factura pagada → actualizar proyecto", descripcion: "Cuando una factura cambia a pagada, actualizar el estado financiero del proyecto.", trigger: "factura_pagada", condiciones: null, acciones: JSON.stringify([{ tipo: "actualizar_registro", modelo: "proyecto", campo: "ultimo_pago" }]), estado: "activa" } }),
    db.automatizacion.create({ data: { nombre: "Reporte semanal", descripcion: "Generar reporte automático de progreso cada lunes.", trigger: "cron_semanal", condiciones: JSON.stringify({ dia: "lunes", hora: "09:00" }), acciones: JSON.stringify([{ tipo: "generar_reporte" }, { tipo: "enviar_email", destinatario: "admin" }]), estado: "pausada" } }),
  ])

  console.log("\n✅ Seed completado:")
  console.log(`   ${usuarios.length} usuarios`)
  console.log(`   ${clientes.length} clientes`)
  console.log(`   ${proyectos.length} proyectos`)
  console.log("   15 tareas")
  console.log("   12 transacciones")
  console.log("   8 facturas")
  console.log("   9 documentos")
  console.log("   6 eventos")
  console.log("   5 notas")
  console.log("   4 automatizaciones")
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e)
    db.$disconnect()
    process.exit(1)
  })

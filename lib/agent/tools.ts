/**
 * Tool definitions for OpenAI function calling.
 * The agent decides when to use each tool based on user intent.
 */

export interface ToolDefinition {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, any>
  }
}

export const AGENT_TOOLS: ToolDefinition[] = [
  // ── READ ──
  {
    type: "function",
    function: {
      name: "buscar_clientes",
      description: "Buscar clientes por nombre, email o empresa. Usar cuando se pregunte por un cliente o se necesite su informacion.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Texto de busqueda (nombre, email o empresa)" },
        },
        required: ["search"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detalle_cliente",
      description: "Obtener detalle completo de un cliente por su ID, incluyendo proyectos y facturas.",
      parameters: {
        type: "object",
        properties: {
          clienteId: { type: "string", description: "ID del cliente" },
        },
        required: ["clienteId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detalle_proyecto",
      description: "Obtener detalle completo de un proyecto por su ID, incluyendo tareas y cliente.",
      parameters: {
        type: "object",
        properties: {
          proyectoId: { type: "string", description: "ID del proyecto" },
        },
        required: ["proyectoId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_tareas",
      description: "Buscar tareas con filtros. Usar para ver tareas pendientes, atrasadas, por prioridad, etc.",
      parameters: {
        type: "object",
        properties: {
          estado: { type: "string", description: "Filtrar por estado: pendiente, en-progreso, completada, cancelada" },
          prioridad: { type: "string", description: "Filtrar por prioridad: baja, media, alta, urgente" },
          proyectoId: { type: "string", description: "Filtrar por proyecto" },
          search: { type: "string", description: "Buscar por texto en titulo" },
          atrasadas: { type: "boolean", description: "Si es true, solo muestra tareas con fecha vencida" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_facturas",
      description: "Buscar facturas con filtros. Usar para ver facturas pendientes, vencidas, por cliente, etc.",
      parameters: {
        type: "object",
        properties: {
          estado: { type: "string", description: "Filtrar por estado: pendiente, pagada, vencida, borrador" },
          clienteId: { type: "string", description: "Filtrar por cliente" },
          vencidas: { type: "boolean", description: "Si es true, solo muestra facturas vencidas" },
        },
      },
    },
  },
  // ── WRITE ──
  {
    type: "function",
    function: {
      name: "crear_contenido",
      description: "Crear una pieza de contenido en el modulo editorial. Usar cuando el usuario pida generar un post, reel, carrusel, blog, newsletter u otra pieza.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Titulo de la pieza" },
          copy: { type: "string", description: "Texto/copy de la pieza" },
          plataforma: { type: "string", enum: ["instagram", "tiktok", "facebook", "linkedin", "youtube", "twitter", "blog", "newsletter", "web", "otro"], description: "Plataforma destino" },
          tipo: { type: "string", enum: ["post", "reel", "carrusel", "story", "video", "blog", "newsletter", "guion", "pieza-creativa", "otro"], description: "Tipo de contenido" },
          estado: { type: "string", enum: ["idea", "borrador", "en-progreso", "programado"], description: "Estado inicial", default: "borrador" },
          hashtags: { type: "string", description: "Hashtags separados por espacio" },
          notas: { type: "string", description: "Notas internas" },
          prioridad: { type: "string", enum: ["baja", "media", "alta", "urgente"], default: "media" },
        },
        required: ["titulo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crear_idea",
      description: "Guardar una idea en el banco creativo. Usar cuando se generen ideas que el usuario quiera conservar.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Titulo de la idea" },
          descripcion: { type: "string", description: "Descripcion de la idea" },
          categoria: { type: "string", description: "Categoria (contenido, marketing, branding, editorial, otro)" },
          plataforma: { type: "string", description: "Plataforma sugerida" },
          tags: { type: "string", description: "Tags separados por coma" },
        },
        required: ["titulo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crear_tarea",
      description: "Crear una tarea. Usar cuando el usuario pida crear un recordatorio, tarea o accion.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Titulo de la tarea" },
          descripcion: { type: "string", description: "Descripcion de la tarea" },
          estado: { type: "string", enum: ["pendiente", "en-progreso"], default: "pendiente" },
          prioridad: { type: "string", enum: ["baja", "media", "alta", "urgente"], default: "media" },
          proyectoId: { type: "string", description: "ID del proyecto asociado (opcional)" },
          fechaVencimiento: { type: "string", description: "Fecha de vencimiento en formato ISO (YYYY-MM-DD)" },
        },
        required: ["titulo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crear_campana",
      description: "Crear una campana de marketing. Usar cuando el usuario pida planificar una campana.",
      parameters: {
        type: "object",
        properties: {
          nombre: { type: "string", description: "Nombre de la campana" },
          descripcion: { type: "string", description: "Descripcion y objetivos" },
          estado: { type: "string", enum: ["idea", "planificacion", "activa"], default: "planificacion" },
          marca: { type: "string", enum: ["skina", "7f", "cliente", "general"], default: "general" },
          fechaInicio: { type: "string", description: "Fecha de inicio ISO" },
          fechaFin: { type: "string", description: "Fecha de fin ISO" },
          objetivos: { type: "string", description: "Objetivos de la campana" },
        },
        required: ["nombre"],
      },
    },
  },
  // ── GENERATE ──
  {
    type: "function",
    function: {
      name: "generar_imagen",
      description: "Generar una imagen con DALL-E 3. El prompt debe ser en ingles, detallado, con sujeto, estilo, composicion, colores e iluminacion.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Prompt detallado en ingles para DALL-E 3" },
          size: { type: "string", enum: ["1024x1024", "1792x1024", "1024x1792"], default: "1024x1024", description: "Tamano de la imagen" },
          style: { type: "string", enum: ["vivid", "natural"], default: "natural", description: "Estilo visual" },
        },
        required: ["prompt"],
      },
    },
  },
]

export const TOOL_NAMES = AGENT_TOOLS.map((t) => t.function.name)

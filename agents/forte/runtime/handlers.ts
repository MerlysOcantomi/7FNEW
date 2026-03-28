import type { ForteActionHandler } from "./types"

const handlers = new Map<string, ForteActionHandler<any, any>>()

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function registerBuiltinHandlers() {
  registerForteActionHandler({
    actionId: "clientes.list",
    moduleId: "clientes",
    kind: "read",
    async run(ctx, input: Record<string, unknown>) {
      const clientesService = await import("@modules/clientes/service")
      return clientesService.list({
        workspaceId: ctx.workspaceId,
        skip: asNumber(input.skip, 0),
        take: asNumber(input.take, 20),
        estado: asString(input.estado),
        tipo: asString(input.tipo),
        search: asString(input.search),
      })
    },
  })

  registerForteActionHandler({
    actionId: "clientes.get",
    moduleId: "clientes",
    kind: "read",
    async run(ctx, input: Record<string, unknown>) {
      const clientesService = await import("@modules/clientes/service")
      const id = asString(input.id)
      if (!id) throw new Error("clientes.get requiere un id")
      return clientesService.getById(id, ctx.workspaceId)
    },
  })

  registerForteActionHandler({
    actionId: "proyectos.list",
    moduleId: "proyectos",
    kind: "read",
    async run(ctx, input: Record<string, unknown>) {
      const proyectosService = await import("@modules/proyectos/service")
      return proyectosService.list({
        workspaceId: ctx.workspaceId,
        skip: asNumber(input.skip, 0),
        take: asNumber(input.take, 20),
        estado: asString(input.estado),
        prioridad: asString(input.prioridad),
        clienteId: asString(input.clienteId),
        search: asString(input.search),
        userId: ctx.userId,
        userRole: ctx.wsRole,
      })
    },
  })

  registerForteActionHandler({
    actionId: "proyectos.get",
    moduleId: "proyectos",
    kind: "read",
    async run(ctx, input: Record<string, unknown>) {
      const proyectosService = await import("@modules/proyectos/service")
      const id = asString(input.id)
      if (!id) throw new Error("proyectos.get requiere un id")
      return proyectosService.getById(id, ctx.workspaceId)
    },
  })

  registerForteActionHandler({
    actionId: "tareas.list",
    moduleId: "tareas",
    kind: "read",
    async run(ctx, input: Record<string, unknown>) {
      const tareasService = await import("@modules/tareas/service")
      return tareasService.list({
        workspaceId: ctx.workspaceId,
        skip: asNumber(input.skip, 0),
        take: asNumber(input.take, 20),
        estado: asString(input.estado),
        prioridad: asString(input.prioridad),
        proyectoId: asString(input.proyectoId),
        clienteId: asString(input.clienteId),
        usuarioId: asString(input.usuarioId),
        search: asString(input.search),
      })
    },
  })

  registerForteActionHandler({
    actionId: "tareas.get",
    moduleId: "tareas",
    kind: "read",
    async run(ctx, input: Record<string, unknown>) {
      const tareasService = await import("@modules/tareas/service")
      const id = asString(input.id)
      if (!id) throw new Error("tareas.get requiere un id")
      return tareasService.getById(id, ctx.workspaceId)
    },
  })

  registerForteActionHandler({
    actionId: "tareas.create",
    moduleId: "tareas",
    kind: "write",
    async run(ctx, input: Record<string, unknown>) {
      const tareasService = await import("@modules/tareas/service")
      const titulo = asString(input.titulo)
      if (!titulo) throw new Error("tareas.create requiere un titulo")

      return tareasService.create(
        {
          titulo,
          descripcion: asString(input.descripcion) ?? null,
          estado: asString(input.estado) ?? "pendiente",
          prioridad: asString(input.prioridad) ?? "media",
          proyectoId: asString(input.proyectoId) ?? null,
          clienteId: asString(input.clienteId) ?? null,
          usuarioId: asString(input.usuarioId) ?? null,
          fechaLimite: asString(input.fechaLimite)
            ? new Date(input.fechaLimite as string)
            : null,
          updatedAt: new Date(),
        },
        ctx.workspaceId,
      )
    },
  })
}

export function registerForteActionHandler(handler: ForteActionHandler<any, any>) {
  if (handlers.has(handler.actionId)) {
    throw new Error(`Forte handler duplicado: ${handler.actionId}`)
  }
  handlers.set(handler.actionId, handler)
}

export function getForteActionHandler(actionId: string) {
  return handlers.get(actionId)
}

export function hasForteActionHandler(actionId: string) {
  return handlers.has(actionId)
}

export function listForteActionHandlers() {
  return Array.from(handlers.values())
}

registerBuiltinHandlers()

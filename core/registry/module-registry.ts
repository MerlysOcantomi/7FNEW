import type {
  ModuleManifest,
  EngineManifest,
  ToolManifest,
  AgentToolDefinition,
} from "./types";

function normalizeModuleManifest(manifest: ModuleManifest): ModuleManifest {
  const kind = manifest.kind ?? "core";
  return {
    ...manifest,
    kind,
    namespace: manifest.namespace ?? `${kind}.${manifest.id}`,
    provides: manifest.provides ?? manifest.models,
    optional: manifest.optional ?? false,
  };
}

function normalizeEngineManifest(manifest: EngineManifest): EngineManifest {
  return {
    ...manifest,
    kind: "engine",
    namespace: manifest.namespace ?? `engine.${manifest.id}`,
    optional: manifest.optional ?? false,
  };
}

function normalizeToolManifest(manifest: ToolManifest): ToolManifest {
  return {
    ...manifest,
    kind: "tool",
    namespace: manifest.namespace ?? `tool.${manifest.id}`,
    provides: manifest.provides ?? [manifest.id],
    optional: manifest.optional ?? false,
  };
}

/**
 * Central registry for modules, engines, and tools.
 *
 * Phase 0: manual registration only (no auto-discovery).
 * Modules/engines/tools call `registry.registerXxx(manifest)` at import time.
 * Discovery will be added in a later phase.
 */
class ModuleRegistry {
  private modules = new Map<string, ModuleManifest>();
  private engines = new Map<string, EngineManifest>();
  private tools = new Map<string, ToolManifest>();

  // ---- Registration -------------------------------------------------------

  registerModule(manifest: ModuleManifest): void {
    const normalized = normalizeModuleManifest(manifest);
    if (this.modules.has(normalized.id)) {
      throw new Error(`Module "${normalized.id}" is already registered`);
    }
    this.modules.set(normalized.id, normalized);
  }

  registerEngine(manifest: EngineManifest): void {
    const normalized = normalizeEngineManifest(manifest);
    if (this.engines.has(normalized.id)) {
      throw new Error(`Engine "${normalized.id}" is already registered`);
    }
    this.engines.set(normalized.id, normalized);
  }

  registerTool(manifest: ToolManifest): void {
    const normalized = normalizeToolManifest(manifest);
    if (this.tools.has(normalized.id)) {
      throw new Error(`Tool "${normalized.id}" is already registered`);
    }
    this.tools.set(normalized.id, normalized);
  }

  // ---- Queries — Modules --------------------------------------------------

  getModule(id: string): ModuleManifest | undefined {
    return this.modules.get(id);
  }

  getAllModules(): ModuleManifest[] {
    return Array.from(this.modules.values());
  }

  getModuleByModel(modelName: string): ModuleManifest | undefined {
    return this.getAllModules().find((m) => m.models.includes(modelName));
  }

  getModulesWithCapability(
    capability: keyof ModuleManifest["capabilities"],
  ): ModuleManifest[] {
    return this.getAllModules().filter((m) => m.capabilities[capability]);
  }

  // ---- Queries — Engines --------------------------------------------------

  getEngine(id: string): EngineManifest | undefined {
    return this.engines.get(id);
  }

  getAllEngines(): EngineManifest[] {
    return Array.from(this.engines.values());
  }

  // ---- Queries — Tools ----------------------------------------------------

  getTool(id: string): ToolManifest | undefined {
    return this.tools.get(id);
  }

  getAllTools(): ToolManifest[] {
    return Array.from(this.tools.values());
  }

  // ---- Aggregated queries (for Mr Forte) ----------------------------------

  /**
   * Collect every agent-tool definition exposed by registered modules.
   * In a later phase this will be filtered by workspace-active modules.
   */
  getAgentTools(): AgentToolDefinition[] {
    return this.getAllModules().flatMap((m) => m.tools ?? []);
  }

  /**
   * Check whether a dependency identifier is satisfied.
   * Accepted formats: "core/*" (always true), "engines/<id>", "<moduleId>".
   */
  isAvailable(dep: string): boolean {
    if (dep.startsWith("core/")) return true;
    if (dep.startsWith("engines/")) {
      return this.engines.has(dep.replace("engines/", ""));
    }
    return this.modules.has(dep);
  }

  /**
   * Validate that every dependency declared by a manifest is satisfied.
   * Returns an array of missing dependency identifiers (empty = all good).
   */
  validateDependencies(
    manifest: { dependencies: string[] },
  ): string[] {
    return manifest.dependencies.filter((dep) => !this.isAvailable(dep));
  }

  // ---- Introspection ------------------------------------------------------

  get stats() {
    return {
      modules: this.modules.size,
      engines: this.engines.size,
      tools: this.tools.size,
    };
  }
}

/** Singleton — the single source of truth for the whole application. */
export const registry = new ModuleRegistry();

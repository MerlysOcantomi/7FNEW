import type {
  ModuleManifest,
  EngineManifest,
  ToolManifest,
  AgentToolDefinition,
} from "./types";

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
    if (this.modules.has(manifest.id)) {
      throw new Error(`Module "${manifest.id}" is already registered`);
    }
    this.modules.set(manifest.id, manifest);
  }

  registerEngine(manifest: EngineManifest): void {
    if (this.engines.has(manifest.id)) {
      throw new Error(`Engine "${manifest.id}" is already registered`);
    }
    this.engines.set(manifest.id, manifest);
  }

  registerTool(manifest: ToolManifest): void {
    if (this.tools.has(manifest.id)) {
      throw new Error(`Tool "${manifest.id}" is already registered`);
    }
    this.tools.set(manifest.id, manifest);
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

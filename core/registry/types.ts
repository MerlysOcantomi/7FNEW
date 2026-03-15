// ---------------------------------------------------------------------------
// 7F Architecture — Manifest & Registry Types
// ---------------------------------------------------------------------------

/**
 * Parameter definition for an agent tool.
 */
export interface ToolParameter {
  type: "string" | "number" | "boolean" | "enum";
  description: string;
  required: boolean;
  enum?: string[];
}

/**
 * A tool that a module exposes to the AI agent via function-calling.
 */
export interface AgentToolDefinition {
  name: string;
  description: string;
  type: "read" | "write" | "generate";
  parameters: Record<string, ToolParameter>;
  /**
   * Qualified path to the handler function.
   * Format: "modules/<id>/tools#functionName"
   */
  handler: string;
}

/**
 * An API route that a module owns.
 */
export interface RouteDefinition {
  path: string;
  methods: ("GET" | "POST" | "PATCH" | "DELETE")[];
  auth: "public" | "user" | "admin" | "portal";
}

// ---------------------------------------------------------------------------
// Module Manifest
// ---------------------------------------------------------------------------

export interface ModuleCapabilities {
  crud: boolean;
  search: boolean;
  export: boolean;
  ai: boolean;
  portal: boolean;
}

export interface ModuleLifecycleHooks {
  onRegister?: () => Promise<void>;
  onActivate?: (workspaceId: string) => Promise<void>;
  onDeactivate?: (workspaceId: string) => Promise<void>;
}

export interface ModuleManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  icon?: string;

  dependencies: string[];
  optionalDependencies?: string[];

  capabilities: ModuleCapabilities;

  /** Prisma model names managed by this module. */
  models: string[];

  tools?: AgentToolDefinition[];
  routes?: RouteDefinition[];
  hooks?: ModuleLifecycleHooks;

  /**
   * Per-vertical default configuration.
   * Key = vertical key (e.g. "agencia"), value = defaults.
   */
  verticalDefaults?: Record<
    string,
    { enabled: boolean; config?: Record<string, unknown> }
  >;
}

// ---------------------------------------------------------------------------
// Engine Manifest
// ---------------------------------------------------------------------------

export interface EngineProvider {
  id: string;
  name: string;
  models?: string[];
}

export interface EngineExtensionPoint {
  id: string;
  description: string;
  interface: string;
}

export interface EngineManifest {
  id: string;
  name: string;
  description: string;
  version: string;

  dependencies: string[];

  /** Capabilities this engine makes available to the system. */
  provides: string[];

  providers?: EngineProvider[];
  extensionPoints?: EngineExtensionPoint[];
}

// ---------------------------------------------------------------------------
// Tool Manifest
// ---------------------------------------------------------------------------

export interface ToolManifest {
  id: string;
  name: string;
  description: string;
  version: string;

  dependencies: string[];

  /** What kind of utility this tool provides. */
  category: "generation" | "export" | "processing" | "integration";
}

// ---------------------------------------------------------------------------
// Registry query helpers
// ---------------------------------------------------------------------------

export type ManifestKind = "module" | "engine" | "tool";

export type AnyManifest = ModuleManifest | EngineManifest | ToolManifest;

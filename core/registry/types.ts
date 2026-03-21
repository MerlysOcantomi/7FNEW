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

export type ModuleComplexityLevelName = "basic" | "intermediate" | "advanced";

export interface ModuleComplexityLevelDefinition {
  level: ModuleComplexityLevelName;
  label: string;
  summary: string;
  businessValue: string;
  includedCapabilities: string[];
  suitableFor: string[];
  unlocksNext?: string[];
}

export interface ModuleProgressionProfile {
  moduleId: string;
  defaultLevel: ModuleComplexityLevelName;
  recommendedStart?: ModuleComplexityLevelName;
  levels: ModuleComplexityLevelDefinition[];
}

export interface ModuleManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  icon?: string;

  /**
   * Architectural intent of the module.
   * Defaults to "core" during registration when omitted.
   */
  kind?: "core" | "tool" | "vertical";

  /**
   * Stable, machine-readable namespace.
   * Example: "core.inbox", "tool.automations", "vertical.education.students"
   */
  namespace?: string;

  dependencies: string[];
  optionalDependencies?: string[];

  /**
   * Capabilities or business resources exposed by the module.
   * Defaults to `models` during registration when omitted.
   */
  provides?: string[];

  /**
   * Whether the module is optional/activatable at runtime.
   * Defaults to false during registration when omitted.
   */
  optional?: boolean;

  /**
   * Progressive complexity metadata for the module.
   * Describes how the same domain can grow from basic to advanced without
   * splitting into duplicate modules.
   */
  progression?: ModuleProgressionProfile;

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

  /**
   * Architectural intent of the registry entry.
   * Defaults to "engine" during registration when omitted.
   */
  kind?: "engine";

  /**
   * Stable, machine-readable namespace.
   * Example: "engine.ai"
   */
  namespace?: string;

  dependencies: string[];

  /** Capabilities this engine makes available to the system. */
  provides: string[];

  /**
   * Whether the engine is optional/activatable at runtime.
   * Defaults to false during registration when omitted.
   */
  optional?: boolean;

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

  /**
   * Architectural intent of the registry entry.
   * Defaults to "tool" during registration when omitted.
   */
  kind?: "tool";

  /**
   * Stable, machine-readable namespace.
   * Example: "tool.scan"
   */
  namespace?: string;

  dependencies: string[];

  /**
   * Capabilities exposed by the tool.
   * Defaults to `[id]` during registration when omitted.
   */
  provides?: string[];

  /**
   * Whether the tool is optional/activatable at runtime.
   * Defaults to false during registration when omitted.
   */
  optional?: boolean;

  /** What kind of utility this tool provides. */
  category: "generation" | "export" | "processing" | "integration";
}

// ---------------------------------------------------------------------------
// Registry query helpers
// ---------------------------------------------------------------------------

export type ManifestKind = "module" | "engine" | "tool";

/**
 * Semantic architecture kind.
 *
 * This is intentionally different from ManifestKind:
 * - ManifestKind = technical bucket in the registry
 * - RegistryEntryKind = architectural intent of the entry
 */
export type RegistryEntryKind = "core" | "tool" | "vertical" | "engine";

export type AnyManifest = ModuleManifest | EngineManifest | ToolManifest;

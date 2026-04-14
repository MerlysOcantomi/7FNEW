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

export type AnyManifest = ModuleManifest | EngineManifest | ToolManifest | AgentManifest;

// ---------------------------------------------------------------------------
// Agent Manifest (type contract only — no runtime implementation yet)
// ---------------------------------------------------------------------------

/**
 * Role classification for an agent within the 7F system.
 *
 * - orchestrator: coordinates other agents and system-level decisions (Mr. Forte)
 * - operator: handles specific operational flows (Fanny — inbox)
 * - specialist: deep domain expertise by vertical/region/language (Fathon Tief)
 * - strategist: business-level reasoning and direction (Francis)
 * - functional: domain-specific execution (Fiona — marketing, Felix — finance)
 * - generative: produces outputs like UI or content (Freya)
 */
export type AgentRole =
  | "orchestrator"
  | "operator"
  | "specialist"
  | "strategist"
  | "functional"
  | "generative";

/**
 * Defines how an agent's knowledge sources should be prioritized.
 * Lower number = higher priority.
 */
export interface AgentKnowledgeSourcePriority {
  workspaceKnowledge: number;
  verticalSpecialization: number;
  externalIntelligence: number;
}

/**
 * Specialization profile that can be activated per workspace context.
 * Primarily designed for Fathon Tief but usable by any agent.
 */
export interface AgentSpecializationProfile {
  vertical: string;
  region: string;
  language: string;
  confidence: number;
  description?: string;
}

/**
 * Defines what an agent is allowed or restricted from doing.
 */
export interface AgentPolicy {
  canWrite: boolean;
  canExecuteTools: boolean;
  canDelegateToAgents: boolean;
  canAccessExternalSources: boolean;
  requiresApproval?: boolean;
  maxAutonomyLevel?: "suggest" | "act" | "orchestrate";
}

/**
 * Personality and communication traits for an agent.
 */
export interface AgentPersonality {
  tone: string;
  style: string;
  traits?: string[];
}

/**
 * Manifest for an AI agent in the 7F system.
 *
 * Agents are a layer above modules + engines + context. They consume
 * capabilities from the registry and orchestrate actions through engines,
 * modules, and tools — but they do not own data or business logic directly.
 *
 * This type is the contract for future agent registration. No runtime
 * implementation exists yet.
 */
export interface AgentManifest {
  id: string;
  name: string;
  description: string;
  version: string;

  kind: "agent";

  /**
   * Stable, machine-readable namespace.
   * Example: "agent.forte", "agent.fanny", "agent.fathon"
   */
  namespace: string;

  role: AgentRole;

  /**
   * Module IDs this agent can read from or act upon.
   */
  modules: string[];

  /**
   * Engine IDs this agent can use.
   */
  engines: string[];

  /**
   * Tool IDs this agent has access to.
   */
  tools?: string[];

  /**
   * Primary system section where this agent responds in the transversal chat.
   * Example: "dashboard" for Francis, "inbox" for Fanny, "improvements" for Forte.
   */
  primarySection?: string;

  personality: AgentPersonality;
  policy: AgentPolicy;

  /**
   * Knowledge source prioritization for this agent.
   * Determines the order in which workspace knowledge, vertical
   * specialization, and external intelligence are consulted.
   */
  knowledgePriority?: AgentKnowledgeSourcePriority;

  /**
   * Activatable specialization profiles (primarily for Fathon Tief).
   * Each profile is selected based on workspace vertical + region + language.
   */
  specializations?: AgentSpecializationProfile[];
}

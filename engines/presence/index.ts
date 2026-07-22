/**
 * @engines/presence — Sevenef Presence (FOUNDATION barrel).
 *
 * Shared engine to build and publish business websites. This barrel exposes the
 * contract, registries and pure resolvers. No Prisma model, route, UI or AI call
 * is wired yet — see `README.md` and `docs/presence-architecture.md`.
 */

export { manifest } from "./manifest"

// Core contracts
export type {
  PresenceSite,
  PresenceSectionInstance,
  PresencePublication,
  PresenceDomain,
  PresenceMedia,
  PresenceSiteResolution,
  PresenceOwnershipModel,
  PresenceSiteStatus,
  PresencePublicationState,
  PresenceDomainKind,
  PresenceDomainVerification,
  PresenceDomainOwnership,
  PresenceMediaKind,
  PresenceMediaRole,
} from "./types"
export {
  PRESENCE_OWNERSHIP_MODELS,
  PRESENCE_SITE_STATUSES,
  PRESENCE_PUBLICATION_STATES,
  PRESENCE_DOMAIN_KINDS,
  PRESENCE_DOMAIN_VERIFICATION,
  PRESENCE_DOMAIN_OWNERSHIP,
  PRESENCE_MEDIA_KINDS,
  PRESENCE_MEDIA_ROLES,
} from "./types"

// Sections
export {
  presenceSectionRegistry,
  PRESENCE_SECTION_KINDS,
  PRESENCE_SECTION_DEFINITIONS,
  PRESENCE_PROFILE_SOURCES,
} from "./sections"
export type {
  PresenceSectionKind,
  PresenceSectionDefinition,
  PresenceProfileSource,
} from "./sections"

// Templates
export {
  presenceTemplateRegistry,
  PRESENCE_TEMPLATE_FAMILIES,
  PRESENCE_TEMPLATE_STATUSES,
  PRESENCE_TEMPLATES,
} from "./templates"
export type {
  PresenceTemplate,
  PresenceTemplateFamily,
  PresenceTemplateStatus,
  PresenceTemplateSectionRef,
} from "./templates"

// Themes
export {
  PRESENCE_THEMES,
  PRESENCE_THEME_KEYS,
  isPresenceThemeKey,
  resolvePresenceTheme,
} from "./themes"
export type { PresenceTheme, PresenceThemeKey } from "./themes"

// Content source (read-only projection of the Business Profile)
export {
  buildPresenceContentSource,
  computeAvailableSources,
} from "./content-source"
export type {
  PresenceContentSource,
  PresenceContentSourceInput,
  PresenceChannelSource,
} from "./content-source"

// Resolution & entitlement
export {
  PRESENCE_MODULE_KEY,
  resolvePresenceEntitlement,
  isPresencePubliclyVisible,
  resolveSiteBySlug,
  resolveSiteByHostname,
  buildSiteResolution,
} from "./resolve"
export type {
  PresenceEntitlement,
  PresenceEntitlementInput,
  PresenceStandaloneSubscription,
} from "./resolve"

// Slug & hostname normalization
export {
  normalizeSlug,
  isValidSlug,
  normalizeHostname,
  isValidHostname,
} from "./slug"

// Pure write planners
export {
  planProposalSelection,
  planPublish,
  planUnpublish,
  sanitizeVisualConfig,
  FORBIDDEN_VISUAL_CONFIG_KEYS,
} from "./planning"
export type { ProposalSelectionPlan, PublicationPlan, VisualConfig } from "./planning"

// Data-access layer (Prisma-backed; multi-tenant)
export {
  getOrCreateSiteForWorkspace,
  findSiteBySlug,
  findSiteByHostname,
  updateVisualConfig,
  selectFreyaProposal,
  publishSite,
  unpublishSite,
  getPresenceEntitlement,
  resolvePublicSite,
  upsertDomain,
  markDomainVerified,
  recordMedia,
  listMedia,
} from "./repository"
export type {
  CreateSiteInput,
  UpsertDomainInput,
  RecordMediaInput,
} from "./repository"

// Render plan (pure composition of template + content + media)
export {
  buildRenderPlan,
  isApprovedMedia,
  PresenceTemplateNotFoundError,
} from "./render-plan"
export type {
  PresenceRenderPlan,
  PlannedSection,
  PlannedImage,
  PlannedCta,
  PlannedNavItem,
  RenderMedia,
  BuildRenderPlanInput,
} from "./render-plan"

// Public social links (validated public URLs from the Business Profile)
export {
  PRESENCE_SOCIAL_PLATFORMS,
  PRESENCE_SOCIAL_KEYS,
  normalizeSocialLink,
  normalizeSocialLinks,
  socialLinksToMap,
  socialMapToLinks,
  publicSocialForAssistant,
} from "./social"
export type { PresenceSocialPlatform, PresenceSocialLink } from "./social"

// DB-backed content loader + public-site composition
export { loadPresenceContent, loadSiteMedia } from "./content-loader"
export {
  loadPublicSiteBySlug,
  loadPublicSiteByHostname,
} from "./public-site"
export type { PublicSiteResult, PresenceSeoMeta, PublicSiteContext } from "./public-site"

// Freya providers
export {
  HeuristicFreyaStyleProvider,
  HeuristicFreyaMediaProvider,
  resolveFreyaStyleProvider,
  resolveFreyaMediaProvider,
  FREYA_MEDIA_VERDICTS,
} from "./freya"
export type {
  FreyaSiteProposal,
  FreyaMediaAssessment,
  FreyaMediaVariantSpec,
  FreyaMediaVerdict,
  FreyaStyleProvider,
  FreyaMediaProvider,
  FreyaStyleProviderInput,
  FreyaMediaProviderInput,
} from "./freya"

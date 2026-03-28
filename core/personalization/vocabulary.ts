/**
 * Default business vocabulary — the canonical labels used when no
 * business-type preset or workspace override is active.
 *
 * These match the current hardcoded labels across the product.
 */

import type { EntityVocabulary } from "./types"

export const DEFAULT_VOCABULARY: EntityVocabulary = {
  client:     { singular: "Client",     plural: "Clients" },
  project:    { singular: "Project",    plural: "Projects" },
  task:       { singular: "Task",       plural: "Tasks" },
  invoice:    { singular: "Invoice",    plural: "Invoices" },
  document:   { singular: "Document",   plural: "Documents" },
  campaign:   { singular: "Campaign",   plural: "Campaigns" },
  department: { singular: "Department", plural: "Departments" },
  member:     { singular: "Member",     plural: "Members" },
  inbox:      { singular: "Inbox",      plural: "Inbox" },
  finance:    { singular: "Finance",    plural: "Finance" },
  billing:    { singular: "Billing",    plural: "Billing" },
  marketing:  { singular: "Marketing",  plural: "Marketing" },
  calendar:   { singular: "Calendar",   plural: "Calendar" },
  automation: { singular: "Automation", plural: "Automations" },
}

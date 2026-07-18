/**
 * Business-type presets for vocabulary relabeling.
 *
 * Each preset overrides only the entities that differ from defaults.
 * These are starting points — workspaces can further override via
 * VerticalConfig.ui.labels stored in Workspace.config.
 */

import type { BusinessType, VocabularyOverrides } from "./types"

export const BUSINESS_PRESETS: Record<BusinessType, VocabularyOverrides> = {
  default: {},

  school: {
    client:     { singular: "Student",    plural: "Students" },
    project:    { singular: "Course",     plural: "Courses" },
    task:       { singular: "Assignment", plural: "Assignments" },
    invoice:    { singular: "Tuition",    plural: "Tuition" },
    document:   { singular: "Material",   plural: "Materials" },
    campaign:   { singular: "Program",    plural: "Programs" },
    department: { singular: "Faculty",    plural: "Faculties" },
    member:     { singular: "Staff",      plural: "Staff" },
  },

  clinic: {
    client:     { singular: "Patient",    plural: "Patients" },
    project:    { singular: "Treatment",  plural: "Treatments" },
    task:       { singular: "Procedure",  plural: "Procedures" },
    invoice:    { singular: "Bill",       plural: "Bills" },
    document:   { singular: "Record",     plural: "Records" },
    campaign:   { singular: "Outreach",   plural: "Outreach" },
    department: { singular: "Ward",       plural: "Wards" },
    member:     { singular: "Staff",      plural: "Staff" },
  },

  creator: {
    client:     { singular: "Client",     plural: "Clients" },
    project:    { singular: "Project",    plural: "Projects" },
    task:       { singular: "Task",       plural: "Tasks" },
    campaign:   { singular: "Campaign",   plural: "Campaigns" },
    document:   { singular: "Asset",      plural: "Assets" },
    billing:    { singular: "Invoicing",  plural: "Invoicing" },
  },

  service: {
    client:     { singular: "Client",     plural: "Clients" },
    project:    { singular: "Engagement", plural: "Engagements" },
    task:       { singular: "Deliverable", plural: "Deliverables" },
    invoice:    { singular: "Invoice",    plural: "Invoices" },
    campaign:   { singular: "Initiative", plural: "Initiatives" },
  },

  /**
   * Beauty — salons, nails, lashes, aesthetics, barbershops. BASE (English)
   * variant: neutral sector nouns that differ from the 7F defaults. Language
   * variants live in LOCALIZED_BUSINESS_PRESETS below — presets are vertical
   * DEFAULTS selected by the effective locale, never workspace choices.
   * Product decision (P4.2.1): standard Finesse uses neutral Cliente/Clientes
   * — the sector serves mixed clienteles; a workspace can still choose
   * "Clientas" (or anything else) via VerticalConfig.ui.labels.
   */
  beauty: {
    project:    { singular: "Service",  plural: "Services" },
    member:     { singular: "Team",     plural: "Team" },
    inbox:      { singular: "Messages", plural: "Messages" },
    billing:    { singular: "Billing",  plural: "Billing" },
  },
}

/**
 * Per-locale preset variants, merged ON TOP of the base preset when the
 * effective locale matches. Only non-English variants live here (English is
 * the base). Keyed by canonical locale prefix ("es", "de", …); locales
 * without a variant (de until P5) simply keep the base — that is the
 * English-fallback rule, so a German UI never shows Spanish nouns.
 */
export const LOCALIZED_BUSINESS_PRESETS: Partial<
  Record<BusinessType, Record<string, VocabularyOverrides>>
> = {
  beauty: {
    es: {
      client:     { singular: "Cliente",   plural: "Clientes" },
      project:    { singular: "Servicio",  plural: "Servicios" },
      task:       { singular: "Pendiente", plural: "Pendientes" },
      invoice:    { singular: "Cobro",     plural: "Cobros" },
      billing:    { singular: "Cobro",     plural: "Cobros" },
      document:   { singular: "Foto",      plural: "Fotos" },
      campaign:   { singular: "Promoción", plural: "Promociones" },
      member:     { singular: "Equipo",    plural: "Equipo" },
      calendar:   { singular: "Agenda",    plural: "Agenda" },
      inbox:      { singular: "Mensajes",  plural: "Mensajes" },
    },
  },
}

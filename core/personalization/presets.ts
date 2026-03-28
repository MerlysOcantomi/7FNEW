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
}

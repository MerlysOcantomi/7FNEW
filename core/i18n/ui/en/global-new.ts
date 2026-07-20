import type { GlobalNewMessages } from "../types"

/**
 * English source for the `globalNew` UI namespace — trigger + panel chrome
 * and the creation-action copy, keyed by action id.
 */
export const globalNew: GlobalNewMessages = {
  trigger: "New",
  title: "New",
  subtitle: "Create across your workspace",
  close: "Close New panel",
  groups: {
    capture: "Capture",
    work: "Work",
    assets: "Assets",
    vertical: "Vertical",
  },
  items: {
    conversation: {
      label: "New conversation",
      description: "Open the inbox to start or continue work",
    },
    manualIntake: {
      label: "Manual intake",
      description: "Capture unstructured input with AI routing",
    },
    request: {
      label: "New request",
      description: "Review and manage portal requests",
    },
    quickNote: {
      label: "Quick note",
      description: "Fast capture as a task or reminder",
    },
    client: {
      label: "New client",
      description: "Add an account or prospect",
    },
    project: {
      label: "New project",
      description: "Plan delivery work",
    },
    task: {
      label: "New task",
      description: "Track execution work",
    },
    invoice: {
      label: "New invoice",
      description: "Billing and invoices",
    },
    document: {
      label: "New document",
      description: "Library and structured files",
    },
    upload: {
      label: "Upload file",
      description: "Add files to the workspace",
    },
    contentCampaign: {
      label: "New content / campaign",
      description: "Marketing content and campaigns",
    },
  },
}

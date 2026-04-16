export function formatRelativeDate(value: string) {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "Now"
  if (minutes < 60) return `${minutes} min ago`
  if (hours < 24) return `${hours} h ago`
  if (days < 7) return `${days} d ago`
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short" })
}

export function statusBadge(status: string) {
  switch (status) {
    case "lead_detected":
      return "status-lead-detected"
    case "converted":
      return "status-converted"
    case "assigned":
      return "status-assigned"
    case "awaiting_response":
      return "status-awaiting-response"
    case "closed":
    case "archived":
      return "status-closed"
    case "triaged":
      return "status-triaged"
    case "new":
    default:
      return "status-new"
  }
}

export function statusLabel(status: string) {
  return (
    {
      new: "New",
      triaged: "Triaged",
      assigned: "Assigned",
      awaiting_response: "Awaiting response",
      lead_detected: "Lead detected",
      converted: "Converted",
      closed: "Closed",
      archived: "Archived",
    } as Record<string, string>
  )[status] ?? status
}

export function urgencyBadge(urgency: string) {
  switch (urgency) {
    case "critica":
      return "urgency-critical"
    case "alta":
      return "urgency-high"
    case "media":
      return "urgency-medium"
    default:
      return "urgency-low"
  }
}

export function urgencyLabel(urgency: string) {
  return (
    {
      critica: "Critical",
      alta: "High",
      media: "Medium",
      baja: "Low",
    } as Record<string, string>
  )[urgency] ?? urgency
}

export function channelLabel(channel: string) {
  return (
    {
      manual: "Manual",
      web_chat: "Web chat",
      email: "Email",
      portal: "Portal",
      whatsapp: "WhatsApp",
    } as Record<string, string>
  )[channel] ?? channel
}

export function actionTypeLabel(type: string) {
  return (
    {
      create_client: "Create client",
      create_project: "Create project",
      create_task: "Create task",
      schedule_followup: "Schedule follow-up",
      assign_operator: "Assign owner",
      generate_proposal: "Generate proposal",
    } as Record<string, string>
  )[type] ?? type
}

export function actionStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return "action-approved"
    case "executed":
      return "action-executed"
    case "dismissed":
      return "action-dismissed"
    case "failed":
      return "action-failed"
    case "suggested":
    default:
      return "action-suggested"
  }
}

export function actionStatusLabel(status: string) {
  return (
    {
      suggested: "Suggested",
      approved: "Approved",
      executed: "Executed",
      dismissed: "Dismissed",
      failed: "Failed",
    } as Record<string, string>
  )[status] ?? status
}

export function formatRoleLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

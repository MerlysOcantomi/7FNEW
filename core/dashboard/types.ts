import type { WorkspaceRole } from "@core/auth/workspace-auth"

export type DashboardModuleId = "clients" | "projects" | "tasks" | "billing"

export type DashboardPriorityKind =
  | "project-risk"
  | "task-overdue"
  | "invoice-overdue"
  | "invoice-pending"
  | "workspace-stable"

export type DashboardPrioritySeverity = "critical" | "high" | "medium" | "positive"

export type DashboardPrioritySourceModule = "projects" | "tasks" | "billing" | "system"

export interface DashboardContext {
  workspaceId: string
  workspaceName: string
  workspaceSlug: string
  role: WorkspaceRole
}

export interface DashboardHeroAction {
  id: "open-inbox" | "view-recommendations"
  label: string
  href: string
}

export interface DashboardHeroData {
  summary: string
  quickActions: DashboardHeroAction[]
}

export interface DashboardModulesSummary {
  totalClients: number
  activeProjects: number
  atRiskProjects: number
  overdueTasks: number
  pendingInvoices: number
  billedThisMonth: number
  revenueThisMonth: number
  expensesThisMonth: number
}

export interface DashboardPriorityAction {
  id: string
  kind: DashboardPriorityKind
  severity: DashboardPrioritySeverity
  title: string
  value: number
  summary: string
  href: string
  sourceModule: DashboardPrioritySourceModule
  score: number
  detectedAt: string
}

export interface DashboardActivityItem {
  id: string
  module: string
  recordId: string
  type: string
  label: string
  detail: string
  userName: string | null
  createdAt: string
  href: string
}

export interface DashboardFinanceSummary {
  billedThisMonth: number
  revenueMonth: number
  expensesMonth: number
  pendingInvoicesCount: number
  pendingInvoicesAmount: number
  budgetVariancePct: number | null
}

export interface DashboardRecommendationPreview {
  id: string
  title: string
  helper?: string
  description: string
  href: string
  cta: string
  source: "forte" | "module" | "operations"
  freshness: "live" | "cached" | "static"
}

export interface ForteInsight {
  maturity: string
  analyzedAt: string
  topPriorities: Array<{ label: string; href: string }>
  nextMove: { label: string; href: string } | null
}

export interface DashboardData {
  context: DashboardContext
  hero: DashboardHeroData
  modulesSummary: DashboardModulesSummary
  priorityActions: DashboardPriorityAction[]
  recentActivity: DashboardActivityItem[]
  financeSummary: DashboardFinanceSummary
  recommendations: DashboardRecommendationPreview[]
  forteInsight?: ForteInsight
  meta: {
    generatedAt: string
    source: "dashboard-service"
  }
}

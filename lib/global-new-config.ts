import type { LucideIcon } from "lucide-react"
import {
  MessageSquarePlus,
  LogIn,
  ClipboardList,
  StickyNote,
  Users,
  FolderKanban,
  CheckSquare,
  FileText,
  FileType,
  Upload,
  Megaphone,
} from "lucide-react"

import type { GlobalNewMessages } from "@core/i18n/ui"

export type GlobalNewGroupId = "capture" | "work" | "assets" | "vertical"

export interface GlobalNewActionDef {
  id: string
  /**
   * Canonical-English FALLBACK label. Since I18N-TOP-ACTIONS-01 the panels
   * compose the visible copy from `globalNew.items[messageKey]` at the
   * effective locale; these literals render only for an action that declares
   * no `messageKey` (future vertical actions before their catalog entry
   * lands) — same safety-net pattern as `VerticalNavItem.label`.
   */
  label: string
  description: string
  /** Catalog binding: copy resolves from `globalNew.items` by this key. */
  messageKey?: keyof GlobalNewMessages["items"]
  icon: LucideIcon
  group: GlobalNewGroupId
  href?: string
  verticalKey?: string
  visible?: () => boolean
}

/**
 * Group HEADINGS live in the i18n catalog (`globalNew.groups` — P4.2) and
 * item copy in `globalNew.items` (I18N-TOP-ACTIONS-01); the definitions below
 * declare IDENTITY (id/messageKey), ROUTE and icon.
 */

export const GLOBAL_NEW_ACTIONS: GlobalNewActionDef[] = [
  {
    id: "conversation",
    label: "New conversation",
    description: "Open the inbox to start or continue work",
    messageKey: "conversation",
    icon: MessageSquarePlus,
    group: "capture",
    href: "/inbox",
  },
  {
    id: "manual-intake",
    label: "Manual intake",
    description: "Capture unstructured input with AI routing",
    messageKey: "manualIntake",
    icon: LogIn,
    group: "capture",
    href: "/entrada",
  },
  {
    id: "request",
    label: "New request",
    description: "Review and manage portal requests",
    messageKey: "request",
    icon: ClipboardList,
    group: "capture",
    href: "/requests",
  },
  {
    id: "quick-note",
    label: "Quick note",
    description: "Fast capture as a task or reminder",
    messageKey: "quickNote",
    icon: StickyNote,
    group: "capture",
    href: "/tareas",
  },
  {
    id: "client",
    label: "New client",
    description: "Add an account or prospect",
    messageKey: "client",
    icon: Users,
    group: "work",
    href: "/clientes",
  },
  {
    id: "project",
    label: "New project",
    description: "Plan delivery work",
    messageKey: "project",
    icon: FolderKanban,
    group: "work",
    href: "/proyectos",
  },
  {
    id: "task",
    label: "New task",
    description: "Track execution work",
    messageKey: "task",
    icon: CheckSquare,
    group: "work",
    href: "/tareas",
  },
  {
    id: "invoice",
    label: "New invoice",
    description: "Billing and invoices",
    messageKey: "invoice",
    icon: FileText,
    group: "work",
    href: "/facturacion",
  },
  {
    id: "document",
    label: "New document",
    description: "Library and structured files",
    messageKey: "document",
    icon: FileType,
    group: "assets",
    href: "/archivos",
  },
  {
    id: "upload",
    label: "Upload file",
    description: "Add files to the workspace",
    messageKey: "upload",
    icon: Upload,
    group: "assets",
    href: "/archivos",
  },
  {
    id: "content-campaign",
    label: "New content / campaign",
    description: "Marketing content and campaigns",
    messageKey: "contentCampaign",
    icon: Megaphone,
    group: "assets",
    href: "/contenido",
  },
]

export const GLOBAL_NEW_VERTICAL_ACTIONS: GlobalNewActionDef[] = []

export function getVisibleGlobalNewActions(): GlobalNewActionDef[] {
  const core = GLOBAL_NEW_ACTIONS.filter((a) => (a.visible ? a.visible() : true))
  const vertical = GLOBAL_NEW_VERTICAL_ACTIONS.filter((a) => (a.visible ? a.visible() : true))
  return [...core, ...vertical]
}

export function actionsByGroup(actions: GlobalNewActionDef[]): Record<GlobalNewGroupId, GlobalNewActionDef[]> {
  const map: Record<GlobalNewGroupId, GlobalNewActionDef[]> = {
    capture: [],
    work: [],
    assets: [],
    vertical: [],
  }
  for (const a of actions) {
    map[a.group].push(a)
  }
  return map
}

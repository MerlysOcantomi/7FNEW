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

export type GlobalNewGroupId = "capture" | "work" | "assets" | "vertical"

export interface GlobalNewActionDef {
  id: string
  label: string
  description: string
  icon: LucideIcon
  group: GlobalNewGroupId
  href?: string
  verticalKey?: string
  visible?: () => boolean
}

/**
 * Group HEADINGS moved to the i18n catalog (`globalNew.groups` — P4.2); the
 * panels resolve them by group id via useI18n(), so no label constant lives
 * here anymore. Item labels below are still literals — they will compose with
 * entity vocabulary ("New client" → "Nueva clienta") in a later block.
 */

export const GLOBAL_NEW_ACTIONS: GlobalNewActionDef[] = [
  {
    id: "conversation",
    label: "New conversation",
    description: "Open the inbox to start or continue work",
    icon: MessageSquarePlus,
    group: "capture",
    href: "/inbox",
  },
  {
    id: "manual-intake",
    label: "Manual intake",
    description: "Capture unstructured input with AI routing",
    icon: LogIn,
    group: "capture",
    href: "/entrada",
  },
  {
    id: "request",
    label: "New request",
    description: "Review and manage portal requests",
    icon: ClipboardList,
    group: "capture",
    href: "/requests",
  },
  {
    id: "quick-note",
    label: "Quick note",
    description: "Fast capture as a task or reminder",
    icon: StickyNote,
    group: "capture",
    href: "/tareas",
  },
  {
    id: "client",
    label: "New client",
    description: "Add an account or prospect",
    icon: Users,
    group: "work",
    href: "/clientes",
  },
  {
    id: "project",
    label: "New project",
    description: "Plan delivery work",
    icon: FolderKanban,
    group: "work",
    href: "/proyectos",
  },
  {
    id: "task",
    label: "New task",
    description: "Track execution work",
    icon: CheckSquare,
    group: "work",
    href: "/tareas",
  },
  {
    id: "invoice",
    label: "New invoice",
    description: "Billing and invoices",
    icon: FileText,
    group: "work",
    href: "/facturacion",
  },
  {
    id: "document",
    label: "New document",
    description: "Library and structured files",
    icon: FileType,
    group: "assets",
    href: "/archivos",
  },
  {
    id: "upload",
    label: "Upload file",
    description: "Add files to the workspace",
    icon: Upload,
    group: "assets",
    href: "/archivos",
  },
  {
    id: "content-campaign",
    label: "New content / campaign",
    description: "Marketing content and campaigns",
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

"use client"

import { useState, useRef } from "react"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { cn } from "@/lib/utils"
import {
  Workflow,
  Sparkles,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Settings,
  Tag,
  FolderKanban,
  User,
  Zap,
  BarChart3,
  Power,
  ChevronDown,
  ChevronRight,
  Plus,
  Eye,
  Pause,
  Play,
  FileText,
  Mail,
  Bell,
  CalendarClock,
  Database,
  Brain,
  Send,
  Loader2,
  Copy,
  Check,
  ListChecks,
  TrendingUp,
  Users,
  DollarSign,
  Receipt,
} from "lucide-react"

/* ── Rules (Clasificacion) ── */
const classificationRules = [
  {
    id: "rule-1",
    name: "Emails con 'cotizacion' o 'presupuesto'",
    trigger: "Asunto o cuerpo contiene: cotizacion, presupuesto, precio, costo",
    action: "Clasificar como: Prospecto comercial",
    target: "Asignar a: Departamento Estrategia",
    status: "activa",
    executions: 23,
    accuracy: 94,
  },
  {
    id: "rule-2",
    name: "Mensajes de clientes existentes con 'revision'",
    trigger: "Remitente es cliente activo AND contiene: revision, cambio, ajuste, correccion",
    action: "Clasificar como: Solicitud de cambio",
    target: "Asignar a: Proyecto activo del cliente > Tarea nueva",
    status: "activa",
    executions: 45,
    accuracy: 91,
  },
  {
    id: "rule-3",
    name: "Archivos adjuntos de clientes",
    trigger: "Mensaje contiene adjuntos (PDF, ZIP, AI, PSD, JPG, PNG)",
    action: "Clasificar como: Entrega de materiales",
    target: "Asignar a: Proyecto activo > Documentos",
    status: "activa",
    executions: 18,
    accuracy: 88,
  },
  {
    id: "rule-4",
    name: "Confirmaciones de pago",
    trigger: "Asunto contiene: pago, transferencia, comprobante, OC",
    action: "Clasificar como: Confirmacion financiera",
    target: "Asignar a: Modulo Facturacion + Notificar Finanzas",
    status: "activa",
    executions: 12,
    accuracy: 96,
  },
  {
    id: "rule-5",
    name: "Formularios web nuevos",
    trigger: "Fuente = Formulario de contacto web",
    action: "Clasificar como: Nuevo lead",
    target: "Crear cliente prospecto + Notificar Estrategia",
    status: "activa",
    executions: 8,
    accuracy: 85,
  },
  {
    id: "rule-6",
    name: "Mensajes de seguimiento sin respuesta",
    trigger: "Cliente escribio hace >48h AND sin respuesta del equipo",
    action: "Clasificar como: Alerta de seguimiento",
    target: "Notificar al responsable del proyecto + Alerta alta",
    status: "pausada",
    executions: 5,
    accuracy: 72,
  },
]

/* ── Distribution rules ── */
const distributionRules = [
  {
    id: "dist-1",
    name: "Asignacion por departamento",
    description: "Distribuye tareas nuevas al departamento con menor carga de trabajo",
    mode: "Automatico (balance de carga)",
    status: "activa",
    processed: 67,
  },
  {
    id: "dist-2",
    name: "Escalado de prioridad",
    description: "Si una tarea lleva >24h sin asignar, escala a lider de departamento",
    mode: "Automatico (tiempo)",
    status: "activa",
    processed: 12,
  },
  {
    id: "dist-3",
    name: "Reasignacion por ausencia",
    description: "Redirige tareas a backup cuando el responsable esta de vacaciones",
    mode: "Automatico (calendario)",
    status: "pausada",
    processed: 3,
  },
]

/* ── Conversion rules ── */
const conversionRules = [
  {
    id: "conv-1",
    name: "Lead a Cliente",
    description: "Cuando un prospecto responde positivamente a una propuesta, convertir a cliente activo",
    trigger: "Prospecto + Respuesta positiva detectada",
    conversions: 5,
    status: "activa",
  },
  {
    id: "conv-2",
    name: "Mensaje a Tarea",
    description: "Cuando un mensaje del cliente contiene una solicitud accionable, crear tarea en el proyecto",
    trigger: "Cliente activo + Contenido accionable detectado",
    conversions: 28,
    status: "activa",
  },
  {
    id: "conv-3",
    name: "Idea a Contenido",
    description: "Cuando una idea del banco creativo es aprobada, crear pieza en el calendario de contenido",
    trigger: "Idea aprobada en banco creativo",
    conversions: 11,
    status: "activa",
  },
  {
    id: "conv-4",
    name: "Nota a Proyecto",
    description: "Cuando una nota de cliente menciona nuevo alcance, crear proyecto prospecto automaticamente",
    trigger: "Nota con keywords: proyecto, nuevo, adicional, expandir",
    conversions: 3,
    status: "pausada",
  },
]

/* ── Automatizaciones ── */
const automations = [
  { id: "auto-1", name: "Notificacion de nueva tarea", trigger: "Al crear tarea", action: "Enviar email al responsable", status: "activa", runs: 142, icon: Bell },
  { id: "auto-2", name: "Recordatorio de deadline", trigger: "3 dias antes del vencimiento", action: "Enviar notificacion push", status: "activa", runs: 58, icon: CalendarClock },
  { id: "auto-3", name: "Reporte semanal", trigger: "Cada lunes 8:00am", action: "Generar y enviar PDF", status: "activa", runs: 24, icon: FileText },
  { id: "auto-4", name: "Bienvenida a cliente", trigger: "Al agregar cliente", action: "Enviar email de bienvenida", status: "pausada", runs: 12, icon: Mail },
  { id: "auto-5", name: "Backup automatico", trigger: "Cada domingo 2:00am", action: "Exportar datos a nube", status: "activa", runs: 48, icon: Database },
  { id: "auto-6", name: "Alerta de presupuesto", trigger: "Al superar 80% del budget", action: "Notificar a admin", status: "activa", runs: 7, icon: AlertTriangle },
]

const statusBadge: Record<string, string> = {
  activa: "bg-[var(--tab-phases)] text-foreground/70",
  pausada: "bg-[var(--tab-tasks)] text-foreground/70",
  inactiva: "bg-muted text-muted-foreground",
}

type TabId = "ia" | "clasificacion" | "distribucion" | "conversion" | "automatizaciones"
const tabs: { id: TabId; label: string }[] = [
  { id: "ia", label: "Motor IA" },
  { id: "clasificacion", label: "Clasificacion" },
  { id: "distribucion", label: "Distribucion" },
  { id: "conversion", label: "Conversion" },
  { id: "automatizaciones", label: "Automatizaciones" },
]

type AIMode = "operativo" | "editorial" | "skina" | "7f" | "cv" | "correccion" | "general"

interface AIQuickAction {
  label: string
  module: string
  icon: typeof Brain
  prompt: string
  mode: AIMode
}

const quickActions: AIQuickAction[] = [
  { label: "Analizar tareas pendientes", module: "Tareas", icon: ListChecks, prompt: "Analiza las tareas pendientes del sistema. Identifica cuales son mas urgentes, cuales tienen riesgo de retraso, y sugiere un orden de prioridad para la semana.", mode: "operativo" },
  { label: "Estado de proyectos", module: "Proyectos", icon: FolderKanban, prompt: "Genera un resumen del estado general de los proyectos activos. Identifica cuales van bien, cuales tienen retraso y que acciones inmediatas se necesitan.", mode: "operativo" },
  { label: "Resumen de clientes", module: "Clientes", icon: Users, prompt: "Genera un resumen ejecutivo de la cartera de clientes. Incluye clientes mas activos, oportunidades de crecimiento y riesgos de churn.", mode: "editorial" },
  { label: "Diagnostico financiero", module: "Finanzas", icon: DollarSign, prompt: "Realiza un diagnostico financiero general. Analiza tendencias de ingresos vs gastos, margenes y sugiere optimizaciones.", mode: "operativo" },
  { label: "Estado de facturacion", module: "Facturas", icon: Receipt, prompt: "Analiza el estado de la facturacion. Identifica facturas vencidas, montos pendientes de cobro y prioridades de gestion.", mode: "operativo" },
  { label: "Reporte semanal editorial", module: "General", icon: FileText, prompt: "Redacta un reporte semanal ejecutivo para la direccion. Debe incluir logros principales, problemas detectados, metricas clave y plan para la proxima semana. Tono profesional y conciso.", mode: "editorial" },
]

/* ── Automatizaciones IA Component ── */
interface AutomationIA {
  id: string
  label: string
  description: string
  action: string
  icon: typeof Brain
  module: string
}

const iaAutomations: AutomationIA[] = [
  { id: "ia-1", label: "Analisis diario completo", description: "Ejecuta analisis de tareas, resumen del dia y revision de facturas vencidas", action: "analisis_diario", icon: ListChecks, module: "General" },
  { id: "ia-2", label: "Analisis semanal completo", description: "Analisis de tareas, proyectos, facturas y proximos pasos", action: "analisis_semanal", icon: TrendingUp, module: "General" },
  { id: "ia-3", label: "Detectar retrasos en tareas", description: "Identifica tareas vencidas y sugiere acciones", action: "detectar_retrasos", icon: AlertTriangle, module: "Tareas" },
  { id: "ia-4", label: "Sugerir reprogramacion", description: "Propone nuevas fechas para tareas vencidas", action: "sugerir_reprogramacion", icon: CalendarClock, module: "Tareas" },
  { id: "ia-5", label: "Generar subtareas", description: "Descompone tareas complejas en pasos accionables", action: "generar_subtareas", icon: ListChecks, module: "Tareas" },
  { id: "ia-6", label: "Detectar bloqueos en proyectos", description: "Analiza proyectos activos buscando problemas", action: "detectar_bloqueos", icon: AlertTriangle, module: "Proyectos" },
  { id: "ia-7", label: "Sugerir siguientes pasos", description: "Recomienda acciones concretas por proyecto", action: "sugerir_siguientes_pasos", icon: ArrowRight, module: "Proyectos" },
  { id: "ia-8", label: "Revisar facturas vencidas", description: "Detecta facturas vencidas y prioriza cobranza", action: "detectar_vencimientos", icon: Receipt, module: "Facturas" },
  { id: "ia-9", label: "Generar recordatorios de pago", description: "Redacta mensajes de cobro para facturas proximas", action: "generar_recordatorios", icon: Bell, module: "Facturas" },
  { id: "ia-10", label: "Resumen diario de tareas", description: "Genera un reporte ejecutivo del estado de las tareas", action: "resumen_diario", icon: FileText, module: "Tareas" },
]

function AutomatizacionesTab() {
  const [autoResult, setAutoResult] = useState("")
  const [autoLoading, setAutoLoading] = useState<string | null>(null)
  const [autoError, setAutoError] = useState("")
  const [autoCopied, setAutoCopied] = useState(false)
  const [lastAction, setLastAction] = useState("")

  async function runAutomation(action: string) {
    setAutoLoading(action)
    setAutoError("")
    setAutoResult("")
    setLastAction(action)
    try {
      const res = await fetch("/api/automations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (!json.success) {
        setAutoError(json.error?.message ?? "Error desconocido")
        return
      }
      const d = json.data
      const parts: string[] = []
      if (d.result) parts.push(d.result)
      if (d.tareas?.result) parts.push("── Tareas ──\n" + d.tareas.result)
      if (d.resumen?.result) parts.push("── Resumen ──\n" + d.resumen.result)
      if (d.proyectos?.result) parts.push("── Proyectos ──\n" + d.proyectos.result)
      if (d.facturas?.result) parts.push("── Facturas ──\n" + d.facturas.result)
      if (d.pasos?.result) parts.push("── Proximos Pasos ──\n" + d.pasos.result)
      setAutoResult(parts.join("\n\n") || "Sin resultados")
    } catch (err) {
      setAutoError(err instanceof Error ? err.message : "Error de conexion")
    } finally {
      setAutoLoading(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Resumen</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-semibold text-foreground">{automations.length + iaAutomations.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-foreground">{automations.filter(a => a.status === "activa").length + iaAutomations.length}</p>
            <p className="text-xs text-muted-foreground">Activas</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-foreground">{automations.reduce((a, r) => a + r.runs, 0)}</p>
            <p className="text-xs text-muted-foreground">Ejecuciones</p>
          </div>
        </div>
      </div>

      {/* IA Automations */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Automatizaciones inteligentes (IA)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {iaAutomations.map((auto) => {
            const AutoIcon = auto.icon
            const isRunning = autoLoading === auto.action
            return (
              <button
                key={auto.id}
                onClick={() => runAutomation(auto.action)}
                disabled={!!autoLoading}
                className={cn(
                  "flex items-start gap-3 rounded-lg border border-border p-4 text-left transition-all",
                  isRunning
                    ? "border-foreground/20 bg-muted/30"
                    : autoLoading
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:border-foreground/20 hover:bg-muted/30"
                )}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--tab-ai)] flex-shrink-0">
                  {isRunning ? <Loader2 className="h-4 w-4 text-foreground/60 animate-spin" /> : <AutoIcon className="h-4 w-4 text-foreground/60" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{auto.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{auto.description}</p>
                  <span className="inline-block mt-1 rounded-full bg-[var(--tab-tasks)] px-2 py-0.5 text-[10px] font-medium text-foreground/70">
                    {auto.module}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {autoError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-destructive">Error en automatizacion</p>
              <p className="text-xs text-destructive/80 mt-0.5">{autoError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {autoResult && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Resultado — {lastAction.replace(/_/g, " ")}</p>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(autoResult); setAutoCopied(true); setTimeout(() => setAutoCopied(false), 2000) }}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {autoCopied ? <><Check className="h-3 w-3" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar</>}
            </button>
          </div>
          <div className="px-5 py-4">
            <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{autoResult}</div>
          </div>
        </div>
      )}

      {/* Static automations */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Automatizaciones programadas</p>
        <div className="flex flex-col gap-2">
          {automations.map((auto) => {
            const AutoIcon = auto.icon
            return (
              <div key={auto.id} className="flex items-start gap-3 rounded-lg border border-border px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--tab-ai)] flex-shrink-0">
                  <AutoIcon className="h-3.5 w-3.5 text-foreground/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-medium text-foreground">{auto.name}</p>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", statusBadge[auto.status])}>{auto.status}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {auto.trigger} → {auto.action} · {auto.runs} ejecuciones
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function MotorPage() {
  const [activeTab, setActiveTab] = useState<TabId>("ia")
  const [expandedRule, setExpandedRule] = useState<string | null>("rule-1")

  // IA state
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiMode, setAiMode] = useState<AIMode>("operativo")
  const [aiResult, setAiResult] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState("")
  const [aiCopied, setAiCopied] = useState(false)
  const [aiHistory, setAiHistory] = useState<{ prompt: string; mode: AIMode; result: string }[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function executeAI(prompt: string, mode: AIMode) {
    if (!prompt.trim()) return
    setAiLoading(true)
    setAiError("")
    setAiResult("")

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), mode }),
      })
      const json = await res.json()
      if (!json.success) {
        setAiError(json.error?.message ?? "Error desconocido")
        return
      }
      const result = json.data.result
      setAiResult(result)
      setAiHistory((prev) => [{ prompt: prompt.trim(), mode, result }, ...prev].slice(0, 10))
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Error de conexion")
    } finally {
      setAiLoading(false)
    }
  }

  function handleQuickAction(action: AIQuickAction) {
    setAiPrompt(action.prompt)
    setAiMode(action.mode)
    executeAI(action.prompt, action.mode)
  }

  function handleCopy() {
    navigator.clipboard.writeText(aiResult)
    setAiCopied(true)
    setTimeout(() => setAiCopied(false), 2000)
  }

  const totalRules = classificationRules.length + distributionRules.length + conversionRules.length
  const activeRules = [...classificationRules, ...distributionRules, ...conversionRules].filter(r => r.status === "activa").length
  const totalExec = classificationRules.reduce((a, r) => a + r.executions, 0) + distributionRules.reduce((a, r) => a + r.processed, 0) + conversionRules.reduce((a, r) => a + r.conversions, 0)
  const avgAccuracy = Math.round(classificationRules.reduce((a, r) => a + r.accuracy, 0) / classificationRules.length)

  return (
    <AppShell currentSection="motor" breadcrumbs={[{ label: "7F" }, { label: "Motor IA" }]}>
      <SectionPage title="Motor IA" description="IA multimodal con GPT-4.1 y DeepSeek. Modos: Skina, 7F, CV, Correccion, Editorial, Operativo y General.">

        {/* Stats - only for rules tabs */}
        {activeTab !== "ia" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reglas totales</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{totalRules}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Activas</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{activeRules}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ejecuciones</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{totalExec}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Precision prom.</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{avgAccuracy}%</p>
              <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-[var(--tab-phases)]" style={{ width: `${avgAccuracy}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                activeTab === tab.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
          <button className="ml-auto flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-xs font-medium text-background transition-opacity hover:opacity-80">
            <Plus className="h-3.5 w-3.5" /> Nueva regla
          </button>
        </div>

        {/* ── Motor IA tab ── */}
        {activeTab === "ia" && (
          <div className="flex flex-col gap-4">
            {/* Architecture overview */}
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Arquitectura del Motor</p>
              <div className="flex items-center justify-between gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {[
                  { label: "Prompt", sub: "Texto o modulo", icon: FileText, color: "var(--tab-info)" },
                  { label: "Motor IA", sub: "Router inteligente", icon: Brain, color: "var(--tab-ai)" },
                  { label: "DeepSeek", sub: "Razonamiento", icon: Zap, color: "var(--tab-tasks)" },
                  { label: "GPT-4.1", sub: "Multimodal", icon: Sparkles, color: "var(--tab-phases)" },
                  { label: "Respuesta", sub: "Texto limpio", icon: CheckCircle2, color: "var(--tab-phases)" },
                ].map((step, i) => (
                  <div key={step.label} className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: step.color }}>
                        <step.icon className="h-4 w-4 text-foreground/60" />
                      </div>
                      <p className="text-xs font-medium text-foreground text-center">{step.label}</p>
                      <p className="text-[10px] text-muted-foreground text-center max-w-20">{step.sub}</p>
                    </div>
                    {i < 4 && <ArrowRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 mx-1" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Prompt panel */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Consola IA</p>
                <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border p-0.5" style={{ scrollbarWidth: "none" }}>
                  {([
                    { id: "operativo" as AIMode, label: "Operativo", icon: Zap },
                    { id: "editorial" as AIMode, label: "Editorial", icon: Sparkles },
                    { id: "skina" as AIMode, label: "Skina", icon: Sparkles },
                    { id: "7f" as AIMode, label: "7F", icon: Zap },
                    { id: "cv" as AIMode, label: "CV", icon: FileText },
                    { id: "correccion" as AIMode, label: "Correccion", icon: CheckCircle2 },
                    { id: "general" as AIMode, label: "General", icon: Brain },
                  ]).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setAiMode(m.id)}
                      className={cn(
                        "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap",
                        aiMode === m.id
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="flex items-center gap-1"><m.icon className="h-3 w-3" /> {m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      executeAI(aiPrompt, aiMode)
                    }
                  }}
                  placeholder={aiMode === "operativo"
                    ? "Escribe un analisis, pregunta operativa o solicitud de razonamiento..."
                    : "Escribe una solicitud de redaccion, resumen o comunicacion..."
                  }
                  className="w-full min-h-[120px] rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={aiLoading}
                />
                <div className="flex items-center justify-between mt-3">
                  <p className="text-[10px] text-muted-foreground">
                    {aiMode === "operativo" ? "DeepSeek R1 — Razonamiento" : `GPT-4.1 — Modo ${aiMode}`} · Ctrl+Enter para ejecutar
                  </p>
                  <button
                    onClick={() => executeAI(aiPrompt, aiMode)}
                    disabled={aiLoading || !aiPrompt.trim()}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all",
                      aiLoading || !aiPrompt.trim()
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-foreground text-background hover:opacity-80"
                    )}
                  >
                    {aiLoading ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Procesando...</>
                    ) : (
                      <><Send className="h-3.5 w-3.5" /> Ejecutar</>
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {aiError && (
                <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-destructive">Error del Motor IA</p>
                      <p className="text-xs text-destructive/80 mt-0.5">{aiError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Result */}
              {aiResult && (
                <div className="mt-4 rounded-lg border border-border bg-muted/20 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2">
                      {aiMode === "operativo" ? (
                        <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <p className="text-xs font-medium text-muted-foreground">
                        Respuesta — {aiMode === "operativo" ? "DeepSeek" : `GPT-4.1 (${aiMode})`}
                      </p>
                    </div>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      {aiCopied ? <><Check className="h-3 w-3" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar</>}
                    </button>
                  </div>
                  <div className="px-4 py-4">
                    <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{aiResult}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Acciones rapidas por modulo</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {quickActions.map((action) => {
                  const ActionIcon = action.icon
                  return (
                    <button
                      key={action.label}
                      onClick={() => handleQuickAction(action)}
                      disabled={aiLoading}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border border-border p-4 text-left transition-all",
                        aiLoading
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:border-foreground/20 hover:bg-muted/30"
                      )}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--tab-ai)] flex-shrink-0">
                        <ActionIcon className="h-3.5 w-3.5 text-foreground/60" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{action.label}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground">{action.module}</span>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            action.mode === "operativo"
                              ? "bg-[var(--tab-tasks)] text-foreground/70"
                              : "bg-[var(--tab-phases)] text-foreground/70"
                          )}>
                            {action.mode === "operativo" ? "DeepSeek" : "GPT-4.1 mini"}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* History */}
            {aiHistory.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Historial de sesion ({aiHistory.length})</p>
                <div className="flex flex-col gap-2">
                  {aiHistory.map((entry, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setAiPrompt(entry.prompt)
                        setAiMode(entry.mode)
                        setAiResult(entry.result)
                      }}
                      className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-left hover:bg-muted/20 transition-colors"
                    >
                      {entry.mode === "operativo" ? (
                        <Zap className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                      <p className="text-xs text-foreground truncate flex-1">{entry.prompt}</p>
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0",
                        entry.mode === "operativo"
                          ? "bg-[var(--tab-tasks)] text-foreground/70"
                          : "bg-[var(--tab-phases)] text-foreground/70"
                      )}>
                        {entry.mode === "operativo" ? "DeepSeek" : "GPT-4.1 mini"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* API reference */}
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Endpoints disponibles</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { method: "POST", path: "/api/ai", desc: "Endpoint unificado (prompt + mode)" },
                  { method: "POST", path: "/api/ai/chat", desc: "Chat conversacional (skina, 7f, general)" },
                  { method: "POST", path: "/api/ai/resume", desc: "Resumen y mejora de CV" },
                  { method: "POST", path: "/api/ai/correct", desc: "Correccion ortografica y redaccion" },
                  { method: "POST", path: "/api/ai/tareas", desc: "prioridad, riesgos, subtareas, resumir_notas" },
                  { method: "POST", path: "/api/ai/proyectos", desc: "analisis, retrasos, siguientes_pasos" },
                  { method: "POST", path: "/api/ai/clientes", desc: "resumen, comunicacion" },
                  { method: "POST", path: "/api/ai/finanzas", desc: "analisis, anomalias" },
                  { method: "POST", path: "/api/ai/facturacion", desc: "resumen, vencimiento" },
                ].map((ep) => (
                  <div key={ep.path} className="rounded-lg border border-border px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="rounded bg-[var(--tab-phases)] px-1.5 py-0.5 text-[10px] font-mono font-medium text-foreground/70">{ep.method}</span>
                      <span className="text-xs font-mono text-foreground">{ep.path}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{ep.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Clasificacion tab ── */}
        {activeTab === "clasificacion" && (
          <div className="flex flex-col gap-3">
            {/* Pipeline visual */}
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Pipeline de clasificacion</p>
              <div className="flex items-center justify-between gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {[
                  { label: "Entrada", sub: "Email, WhatsApp, Form, Llamada", icon: Zap, color: "var(--tab-info)" },
                  { label: "Analisis IA", sub: "NLP + Reglas", icon: Sparkles, color: "var(--tab-ai)" },
                  { label: "Clasificacion", sub: "Tipo + Prioridad", icon: Tag, color: "var(--tab-tasks)" },
                  { label: "Asignacion", sub: "Proyecto + Persona", icon: User, color: "var(--tab-phases)" },
                  { label: "Accion", sub: "Tarea, Nota, Alerta", icon: CheckCircle2, color: "var(--tab-phases)" },
                ].map((step, i) => (
                  <div key={step.label} className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: step.color }}>
                        <step.icon className="h-4 w-4 text-foreground/60" />
                      </div>
                      <p className="text-xs font-medium text-foreground text-center">{step.label}</p>
                      <p className="text-[10px] text-muted-foreground text-center max-w-20">{step.sub}</p>
                    </div>
                    {i < 4 && <ArrowRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 mx-1" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Rules */}
            {classificationRules.map((rule) => {
              const isExpanded = expandedRule === rule.id
              return (
                <div key={rule.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--tab-ai)] flex-shrink-0">
                      <Sparkles className="h-4 w-4 text-foreground/60" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-foreground">{rule.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{rule.executions} ejecuciones &middot; {rule.accuracy}% precision</p>
                    </div>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium flex-shrink-0", statusBadge[rule.status])}>
                      {rule.status}
                    </span>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {isExpanded && (
                    <div className="border-t border-border px-5 py-4 bg-muted/10">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Trigger</p>
                          <p className="text-xs text-foreground leading-relaxed">{rule.trigger}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Accion</p>
                          <p className="text-xs text-foreground leading-relaxed">{rule.action}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Destino</p>
                          <p className="text-xs text-foreground leading-relaxed">{rule.target}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-4">
                        <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors">
                          <Settings className="h-3 w-3" /> Editar
                        </button>
                        <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors">
                          <Eye className="h-3 w-3" /> Ver log
                        </button>
                        <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                          {rule.status === "activa" ? <><Pause className="h-3 w-3" /> Pausar</> : <><Play className="h-3 w-3" /> Activar</>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Distribucion tab ── */}
        {activeTab === "distribucion" && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Pipeline de distribucion</p>
              <div className="flex items-center justify-between gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {[
                  { label: "Elemento clasificado", icon: Tag, color: "var(--tab-tasks)" },
                  { label: "Evaluar carga", icon: BarChart3, color: "var(--tab-info)" },
                  { label: "Seleccionar destino", icon: User, color: "var(--tab-ai)" },
                  { label: "Asignar", icon: CheckCircle2, color: "var(--tab-phases)" },
                ].map((step, i) => (
                  <div key={step.label} className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: step.color }}>
                        <step.icon className="h-4 w-4 text-foreground/60" />
                      </div>
                      <p className="text-xs font-medium text-foreground text-center">{step.label}</p>
                    </div>
                    {i < 3 && <ArrowRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 mx-2" />}
                  </div>
                ))}
              </div>
            </div>

            {distributionRules.map((rule) => (
              <div key={rule.id} className="rounded-xl border border-border bg-card px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--tab-info)] flex-shrink-0">
                    <Workflow className="h-4 w-4 text-foreground/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{rule.name}</p>
                      <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium", statusBadge[rule.status])}>
                        {rule.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{rule.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>Modo: {rule.mode}</span>
                      <span>&middot;</span>
                      <span>{rule.processed} procesados</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Configurar">
                      <Settings className="h-4 w-4" />
                    </button>
                    <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Toggle">
                      {rule.status === "activa" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Conversion tab ── */}
        {activeTab === "conversion" && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Pipeline de conversion</p>
              <div className="flex items-center justify-between gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {[
                  { label: "Entidad origen", icon: FileText, color: "var(--tab-tasks)" },
                  { label: "Detectar patron", icon: Sparkles, color: "var(--tab-ai)" },
                  { label: "Transformar", icon: ArrowRight, color: "var(--tab-docs)" },
                  { label: "Crear en destino", icon: CheckCircle2, color: "var(--tab-phases)" },
                ].map((step, i) => (
                  <div key={step.label} className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: step.color }}>
                        <step.icon className="h-4 w-4 text-foreground/60" />
                      </div>
                      <p className="text-xs font-medium text-foreground text-center">{step.label}</p>
                    </div>
                    {i < 3 && <ArrowRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 mx-2" />}
                  </div>
                ))}
              </div>
            </div>

            {conversionRules.map((rule) => (
              <div key={rule.id} className="rounded-xl border border-border bg-card px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--tab-docs)] flex-shrink-0">
                    <ArrowRight className="h-4 w-4 text-foreground/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{rule.name}</p>
                      <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium", statusBadge[rule.status])}>
                        {rule.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{rule.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>Trigger: {rule.trigger}</span>
                      <span>&middot;</span>
                      <span>{rule.conversions} conversiones</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Configurar">
                      <Settings className="h-4 w-4" />
                    </button>
                    <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Toggle">
                      {rule.status === "activa" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* ── Automatizaciones tab ── */}
        {activeTab === "automatizaciones" && (
          <AutomatizacionesTab />
        )}
      </SectionPage>
    </AppShell>
  )
}

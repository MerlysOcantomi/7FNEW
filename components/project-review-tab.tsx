"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Eye,
  MessageSquareText,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Paperclip,
  Send,
  Upload,
  Image,
  FileText,
  Clock,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  CircleDot,
  CircleDashed,
  Sparkles,
} from "lucide-react"

/* ═══════════════ TYPES ═══════════════ */

interface Version {
  number: number
  date: string
  note: string
}

interface CommentItem {
  id: string
  author: string
  initials: string
  isClient: boolean
  text: string
  date: string
  attachments?: string[]
}

interface ChangeRequest {
  id: string
  description: string
  status: "pendiente" | "en progreso" | "resuelto"
  date: string
  requestedBy: string
  assignedTo?: string
  resolvedDate?: string
}

interface Approval {
  id: string
  version: number
  approvedBy: string
  date: string
}

interface TimelineEvent {
  id: string
  type: "version" | "comment" | "approval" | "change_request" | "upload"
  title: string
  description: string
  date: string
  author: string
}

interface Deliverable {
  id: string
  name: string
  phase: string
  thumbnail: string
  currentVersion: number
  versions: Version[]
  status: "pendiente" | "en revision" | "aprobado" | "con cambios"
  comments: CommentItem[]
  changeRequests: ChangeRequest[]
  approvals: Approval[]
  timeline: TimelineEvent[]
}

/* ═══════════════ MOCK DATA ═══════════════ */

const deliverables: Deliverable[] = [
  {
    id: "del1",
    name: "Logotipo - Opciones iniciales",
    phase: "Diseno",
    thumbnail: "logo",
    currentVersion: 3,
    versions: [
      { number: 1, date: "10 feb 2026", note: "Tres propuestas iniciales de logotipo" },
      { number: 2, date: "15 feb 2026", note: "Ajustes en opcion B segun feedback" },
      { number: 3, date: "19 feb 2026", note: "Icono mas oscuro, version fondo oscuro" },
    ],
    status: "en revision",
    comments: [
      { id: "c1", author: "Maria Lopez", initials: "ML", isClient: true, text: "Me gusta la opcion B pero el color del icono podria ser mas oscuro. La tipografia es perfecta.", date: "18 feb 2026", attachments: ["referencia-color.png"] },
      { id: "c2", author: "Ana Rodriguez", initials: "AR", isClient: false, text: "Entendido Maria, preparo la version con el ajuste para manana. Coincido en que la tipografia funciona bien.", date: "18 feb 2026" },
      { id: "c3", author: "Maria Lopez", initials: "ML", isClient: true, text: "Perfecto. Tambien me gustaria ver como queda en fondo oscuro para la app movil.", date: "19 feb 2026" },
      { id: "c4", author: "Ana Rodriguez", initials: "AR", isClient: false, text: "Ya subi la v3 con ambos ajustes. Revisa cuando puedas.", date: "19 feb 2026" },
    ],
    changeRequests: [
      { id: "cr1", description: "Oscurecer el color del icono en opcion B", status: "resuelto", date: "18 feb", requestedBy: "Maria Lopez", assignedTo: "Ana R.", resolvedDate: "19 feb" },
      { id: "cr2", description: "Generar version sobre fondo oscuro para app", status: "resuelto", date: "19 feb", requestedBy: "Maria Lopez", assignedTo: "Ana R.", resolvedDate: "19 feb" },
      { id: "cr3", description: "Probar variante con icono mas geometrico", status: "pendiente", date: "19 feb", requestedBy: "Carlos M.", assignedTo: "Ana R." },
    ],
    approvals: [],
    timeline: [
      { id: "t1", type: "version", title: "Version 1 subida", description: "Tres propuestas iniciales de logotipo", date: "10 feb 2026", author: "Ana Rodriguez" },
      { id: "t2", type: "comment", title: "Comentario del cliente", description: "Feedback sobre opcion B y color del icono", date: "18 feb 2026", author: "Maria Lopez" },
      { id: "t3", type: "change_request", title: "Solicitud de cambio", description: "Oscurecer color del icono en opcion B", date: "18 feb 2026", author: "Maria Lopez" },
      { id: "t4", type: "version", title: "Version 2 subida", description: "Ajustes segun feedback del cliente", date: "15 feb 2026", author: "Ana Rodriguez" },
      { id: "t5", type: "change_request", title: "Solicitud de cambio", description: "Version sobre fondo oscuro", date: "19 feb 2026", author: "Maria Lopez" },
      { id: "t6", type: "version", title: "Version 3 subida", description: "Icono oscuro + version fondo oscuro", date: "19 feb 2026", author: "Ana Rodriguez" },
      { id: "t7", type: "upload", title: "Referencia subida", description: "referencia-color.png", date: "18 feb 2026", author: "Maria Lopez" },
    ],
  },
  {
    id: "del2",
    name: "Paleta de colores corporativa",
    phase: "Diseno",
    thumbnail: "palette",
    currentVersion: 2,
    versions: [
      { number: 1, date: "12 feb 2026", note: "Propuesta inicial con colores principales" },
      { number: 2, date: "16 feb 2026", note: "Paleta secundaria de tonos calidos agregada" },
    ],
    status: "aprobado",
    comments: [
      { id: "c5", author: "Maria Lopez", initials: "ML", isClient: true, text: "Los colores principales estan bien pero necesitamos tonos calidos complementarios para campanas de temporada.", date: "14 feb 2026" },
      { id: "c6", author: "Ana Rodriguez", initials: "AR", isClient: false, text: "Perfecto, agrego una paleta secundaria de tonos calidos para complementar.", date: "14 feb 2026" },
      { id: "c7", author: "Maria Lopez", initials: "ML", isClient: true, text: "La paleta secundaria es exactamente lo que buscabamos. Aprobado.", date: "16 feb 2026" },
    ],
    changeRequests: [
      { id: "cr4", description: "Agregar paleta secundaria de tonos calidos", status: "resuelto", date: "14 feb", requestedBy: "Maria Lopez", assignedTo: "Ana R.", resolvedDate: "16 feb" },
    ],
    approvals: [
      { id: "a1", version: 2, approvedBy: "Maria Lopez", date: "16 feb 2026" },
    ],
    timeline: [
      { id: "t8", type: "version", title: "Version 1 subida", description: "Propuesta inicial", date: "12 feb 2026", author: "Ana Rodriguez" },
      { id: "t9", type: "change_request", title: "Solicitud de cambio", description: "Agregar tonos calidos", date: "14 feb 2026", author: "Maria Lopez" },
      { id: "t10", type: "version", title: "Version 2 subida", description: "Paleta con tonos calidos", date: "16 feb 2026", author: "Ana Rodriguez" },
      { id: "t11", type: "approval", title: "Aprobado por cliente", description: "Version 2 aprobada", date: "16 feb 2026", author: "Maria Lopez" },
    ],
  },
  {
    id: "del3",
    name: "Moodboard creativo",
    phase: "Estrategia",
    thumbnail: "moodboard",
    currentVersion: 1,
    versions: [
      { number: 1, date: "8 feb 2026", note: "Moodboard con direccion minimalista" },
    ],
    status: "aprobado",
    comments: [
      { id: "c8", author: "Maria Lopez", initials: "ML", isClient: true, text: "Gran direccion creativa. Nos encanta el enfoque minimalista. Aprobado sin cambios.", date: "10 feb 2026" },
    ],
    changeRequests: [],
    approvals: [
      { id: "a2", version: 1, approvedBy: "Maria Lopez", date: "10 feb 2026" },
    ],
    timeline: [
      { id: "t12", type: "version", title: "Version 1 subida", description: "Moodboard minimalista", date: "8 feb 2026", author: "Ana Rodriguez" },
      { id: "t13", type: "approval", title: "Aprobado por cliente", description: "Sin cambios solicitados", date: "10 feb 2026", author: "Maria Lopez" },
    ],
  },
  {
    id: "del4",
    name: "Mockups pagina principal",
    phase: "Diseno",
    thumbnail: "mockup",
    currentVersion: 1,
    versions: [
      { number: 1, date: "20 feb 2026", note: "Primera propuesta de homepage" },
    ],
    status: "pendiente",
    comments: [],
    changeRequests: [],
    approvals: [],
    timeline: [
      { id: "t14", type: "version", title: "Version 1 subida", description: "Primera propuesta", date: "20 feb 2026", author: "Luis Garcia" },
    ],
  },
  {
    id: "del5",
    name: "Guia de estilo (draft)",
    phase: "Diseno",
    thumbnail: "guide",
    currentVersion: 1,
    versions: [
      { number: 1, date: "19 feb 2026", note: "Borrador inicial de la guia de estilo" },
    ],
    status: "con cambios",
    comments: [
      { id: "c9", author: "Carlos Mendez", initials: "CM", isClient: false, text: "La seccion de tipografia necesita mas detalle. Agregar ejemplos de uso en diferentes medios.", date: "19 feb 2026" },
    ],
    changeRequests: [
      { id: "cr5", description: "Expandir seccion de tipografia con ejemplos de uso", status: "en progreso", date: "19 feb", requestedBy: "Carlos M.", assignedTo: "Ana R." },
    ],
    approvals: [],
    timeline: [
      { id: "t15", type: "version", title: "Version 1 subida", description: "Borrador inicial", date: "19 feb 2026", author: "Ana Rodriguez" },
      { id: "t16", type: "change_request", title: "Cambio interno solicitado", description: "Expandir tipografia", date: "19 feb 2026", author: "Carlos Mendez" },
    ],
  },
]

const thumbnailIcons: Record<string, { bg: string; label: string }> = {
  logo: { bg: "bg-indigo-100", label: "LOGO" },
  palette: { bg: "bg-emerald-100", label: "COLOR" },
  moodboard: { bg: "bg-amber-100", label: "MOOD" },
  mockup: { bg: "bg-sky-100", label: "WEB" },
  guide: { bg: "bg-rose-100", label: "GUIA" },
}

/* ═══════════════ MAIN EXPORT ═══════════════ */

export interface ProjectReviewTabProps {
  project?: any
  tareas?: any[]
  cliente?: any
}

export function ProjectReviewTab({ project, tareas, cliente }: ProjectReviewTabProps = {}) {
  const [selectedId, setSelectedId] = useState("del1")
  const [activeSection, setActiveSection] = useState<"comentarios" | "cambios" | "aprobaciones" | "historial">("comentarios")
  const [newComment, setNewComment] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)
  const [filterStatus, setFilterStatus] = useState("todos")

  const current = deliverables.find((d) => d.id === selectedId)

  const filteredDeliverables = filterStatus === "todos"
    ? deliverables
    : deliverables.filter((d) => d.status === filterStatus)

  const totalApproved = deliverables.filter((d) => d.status === "aprobado").length
  const totalInReview = deliverables.filter((d) => d.status === "en revision" || d.status === "con cambios").length
  const totalPending = deliverables.filter((d) => d.status === "pendiente").length
  const totalChanges = deliverables.reduce((acc, d) => acc + d.changeRequests.filter((cr) => cr.status !== "resuelto").length, 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-foreground">Revision y Feedback</h3>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Aprobados" value={totalApproved} total={deliverables.length} color="var(--tab-phases)" />
        <SummaryCard label="En revision" value={totalInReview} total={deliverables.length} color="var(--tab-review)" />
        <SummaryCard label="Pendientes" value={totalPending} total={deliverables.length} color="var(--tab-tasks)" />
        <SummaryCard label="Cambios activos" value={totalChanges} total={deliverables.reduce((a, d) => a + d.changeRequests.length, 0)} color="var(--tab-info)" />
      </div>

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Left: Entregables panel */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Entregables</p>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground focus:outline-none"
            >
              <option value="todos">Todos</option>
              <option value="aprobado">Aprobados</option>
              <option value="en revision">En revision</option>
              <option value="con cambios">Con cambios</option>
              <option value="pendiente">Pendientes</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            {filteredDeliverables.map((del) => {
              const thumb = thumbnailIcons[del.thumbnail] || { bg: "bg-muted", label: "?" }
              return (
                <button
                  key={del.id}
                  onClick={() => setSelectedId(del.id)}
                  className={cn(
                    "rounded-xl border px-4 py-3.5 text-left transition-all flex items-start gap-3",
                    selectedId === del.id
                      ? "border-foreground/20 bg-card shadow-sm"
                      : "border-border bg-card/60 hover:bg-card"
                  )}
                >
                  {/* Thumbnail */}
                  <div className={cn("flex h-12 w-12 items-center justify-center rounded-lg flex-shrink-0", thumb.bg)}>
                    <span className="text-[10px] font-bold text-foreground/50">{thumb.label}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-tight">{del.name}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                      <span>{del.phase}</span>
                      <span className="text-muted-foreground/40">|</span>
                      <span>v{del.currentVersion}</span>
                      {del.comments.length > 0 && (
                        <>
                          <span className="text-muted-foreground/40">|</span>
                          <span className="flex items-center gap-0.5">
                            <MessageSquareText className="h-3 w-3" />
                            {del.comments.length}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="mt-2">
                      <DeliverableStatusBadge status={del.status} />
                    </div>
                  </div>
                </button>
              )
            })}
            {filteredDeliverables.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No hay entregables con este filtro.</p>
            )}
          </div>
        </div>

        {/* Right: Detail panel */}
        {current && (
          <div className="flex-1 flex flex-col gap-5 min-w-0">
            {/* Detail header */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-4">
                  <div className={cn("flex h-14 w-14 items-center justify-center rounded-xl flex-shrink-0", thumbnailIcons[current.thumbnail]?.bg || "bg-muted")}>
                    <span className="text-xs font-bold text-foreground/50">{thumbnailIcons[current.thumbnail]?.label || "?"}</span>
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-foreground">{current.name}</h4>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span>Fase: {current.phase}</span>
                      <span className="text-muted-foreground/40">|</span>
                      <span>Version actual: v{current.currentVersion}</span>
                      <span className="text-muted-foreground/40">|</span>
                      <span>{current.comments.length} comentarios</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(current.status === "en revision" || current.status === "con cambios") && (
                    <>
                      <button className="flex items-center gap-1.5 rounded-lg bg-[var(--tab-phases)] px-3.5 py-2 text-xs font-medium text-foreground/80 transition-opacity hover:opacity-80">
                        <ThumbsUp className="h-3.5 w-3.5" /> Aprobar
                      </button>
                      <button className="flex items-center gap-1.5 rounded-lg bg-[var(--tab-review)] px-3.5 py-2 text-xs font-medium text-foreground/80 transition-opacity hover:opacity-80">
                        <ThumbsDown className="h-3.5 w-3.5" /> Solicitar cambio
                      </button>
                    </>
                  )}
                  {current.status === "pendiente" && (
                    <button className="flex items-center gap-1.5 rounded-lg bg-[var(--tab-info)] px-3.5 py-2 text-xs font-medium text-foreground/80 transition-opacity hover:opacity-80">
                      <Eye className="h-3.5 w-3.5" /> Iniciar revision
                    </button>
                  )}
                  <DeliverableStatusBadge status={current.status} />
                </div>
              </div>

              {/* Version selector */}
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2">Versiones</p>
                <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                  {current.versions.map((v) => (
                    <button
                      key={v.number}
                      className={cn(
                        "rounded-lg px-3.5 py-2 text-xs font-medium border transition-colors flex-shrink-0 flex flex-col items-start",
                        v.number === current.currentVersion
                          ? "border-foreground/20 bg-muted text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/10"
                      )}
                    >
                      <span className="font-semibold">v{v.number}</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">{v.date}</span>
                    </button>
                  ))}
                </div>
                {current.versions.find((v) => v.number === current.currentVersion) && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    {current.versions.find((v) => v.number === current.currentVersion)?.note}
                  </p>
                )}
              </div>
            </div>

            {/* Preview area */}
            <div className="rounded-xl border border-border bg-muted/20 h-52 flex items-center justify-center relative overflow-hidden">
              <div className={cn("absolute inset-0 opacity-10", thumbnailIcons[current.thumbnail]?.bg || "bg-muted")} />
              <div className="text-center relative z-10">
                <Eye className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm font-medium text-muted-foreground">Vista previa del entregable</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  {current.name} &middot; v{current.currentVersion}
                </p>
              </div>
            </div>

            {/* Section switcher */}
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {([
                { id: "comentarios" as const, label: "Comentarios", count: current.comments.length },
                { id: "cambios" as const, label: "Solicitudes de cambio", count: current.changeRequests.length },
                { id: "aprobaciones" as const, label: "Aprobaciones", count: current.approvals.length },
                { id: "historial" as const, label: "Historial", count: current.timeline.length },
              ]).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={cn(
                    "rounded-md px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5",
                    activeSection === s.id
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s.label}
                  {s.count > 0 && (
                    <span className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      activeSection === s.id ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground"
                    )}>
                      {s.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Section content */}
            {activeSection === "comentarios" && (
              <CommentsSection comments={current.comments} newComment={newComment} setNewComment={setNewComment} />
            )}
            {activeSection === "cambios" && (
              <ChangeRequestsSection requests={current.changeRequests} />
            )}
            {activeSection === "aprobaciones" && (
              <ApprovalsSection approvals={current.approvals} deliverableName={current.name} />
            )}
            {activeSection === "historial" && (
              <TimelineSection events={current.timeline} />
            )}

            {/* Reference upload */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Subir referencias</p>
              <div
                className={cn(
                  "rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer",
                  isDragOver ? "border-foreground/40 bg-muted/50" : "border-border bg-card/50"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragOver(false) }}
              >
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Arrastra imagenes, PDFs, capturas o moodboards aqui
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">PNG, JPG, PDF, AI, PSD hasta 50MB</p>
                <div className="flex items-center justify-center gap-4 mt-4">
                  <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted">
                    <Image className="h-3.5 w-3.5" /> Imagenes
                  </button>
                  <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted">
                    <FileText className="h-3.5 w-3.5" /> Documentos
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════ SECTIONS ═══════════════ */

function CommentsSection({ comments, newComment, setNewComment }: {
  comments: CommentItem[]
  newComment: string
  setNewComment: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      {comments.length > 0 ? (
        <div className="flex flex-col gap-3">
          {comments.map((c) => (
            <div
              key={c.id}
              className={cn(
                "rounded-xl border px-4 py-3.5",
                c.isClient
                  ? "border-[var(--tab-review)]/40 bg-[var(--tab-review)]/8"
                  : "border-border bg-card"
              )}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0",
                  c.isClient ? "bg-[var(--tab-review)] text-foreground/70" : "bg-muted text-muted-foreground"
                )}>
                  {c.initials}
                </div>
                <span className="text-xs font-semibold text-foreground">{c.author}</span>
                {c.isClient && (
                  <span className="rounded-full bg-[var(--tab-review)] px-2 py-0.5 text-[9px] font-semibold text-foreground/70">
                    Cliente
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{c.date}</span>
              </div>
              <p className="text-sm leading-relaxed text-foreground/80 pl-9">{c.text}</p>
              {c.attachments && c.attachments.length > 0 && (
                <div className="flex items-center gap-2 mt-2.5 pl-9">
                  {c.attachments.map((a) => (
                    <span key={a} className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                      <Paperclip className="h-3 w-3" /> {a}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card/50 p-8 text-center">
          <MessageSquareText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Sin comentarios aun</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Se el primero en dejar feedback sobre este entregable.</p>
        </div>
      )}

      {/* New comment input */}
      <div className="rounded-xl border border-border bg-card p-4">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Escribe un comentario sobre este entregable..."
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
        <div className="flex items-center justify-between mt-3">
          <button className="flex items-center gap-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5">
            <Paperclip className="h-3.5 w-3.5" /> Adjuntar archivo
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-xs font-medium text-background transition-opacity hover:opacity-80">
            <Send className="h-3.5 w-3.5" /> Enviar comentario
          </button>
        </div>
      </div>
    </div>
  )
}

function ChangeRequestsSection({ requests }: { requests: ChangeRequest[] }) {
  const [expandedCr, setExpandedCr] = useState<string | null>(null)

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card/50 p-8 text-center">
        <Check className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Sin solicitudes de cambio</p>
        <p className="text-xs text-muted-foreground/60 mt-1">No se han solicitado modificaciones para este entregable.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CircleDashed className="h-3 w-3 text-amber-500" /> {requests.filter((r) => r.status === "pendiente").length} pendientes
        </span>
        <span className="flex items-center gap-1">
          <CircleDot className="h-3 w-3 text-blue-500" /> {requests.filter((r) => r.status === "en progreso").length} en progreso
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-green-600" /> {requests.filter((r) => r.status === "resuelto").length} resueltos
        </span>
      </div>

      {requests.map((cr) => (
        <div key={cr.id} className="rounded-xl border border-border bg-card overflow-hidden">
          <button
            onClick={() => setExpandedCr(expandedCr === cr.id ? null : cr.id)}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/20 transition-colors"
          >
            <CRStatusIcon status={cr.status} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{cr.description}</p>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <span>Solicitado por {cr.requestedBy}</span>
                <span className="text-muted-foreground/40">|</span>
                <span>{cr.date}</span>
              </div>
            </div>
            <CRStatusBadge status={cr.status} />
            {expandedCr === cr.id ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
          </button>
          {expandedCr === cr.id && (
            <div className="border-t border-border px-4 py-3 bg-muted/10">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Asignado a</p>
                  <p className="font-medium text-foreground mt-0.5">{cr.assignedTo || "Sin asignar"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fecha solicitud</p>
                  <p className="font-medium text-foreground mt-0.5">{cr.date}</p>
                </div>
                {cr.resolvedDate && (
                  <div>
                    <p className="text-muted-foreground">Fecha resolucion</p>
                    <p className="font-medium text-foreground mt-0.5">{cr.resolvedDate}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Estado</p>
                  <p className="font-medium text-foreground mt-0.5 capitalize">{cr.status}</p>
                </div>
              </div>
              {cr.status !== "resuelto" && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                  <button className="flex items-center gap-1.5 rounded-lg bg-[var(--tab-phases)] px-3 py-1.5 text-xs font-medium text-foreground/80 transition-opacity hover:opacity-80">
                    <Check className="h-3 w-3" /> Marcar resuelto
                  </button>
                  {cr.status === "pendiente" && (
                    <button className="flex items-center gap-1.5 rounded-lg bg-[var(--tab-info)] px-3 py-1.5 text-xs font-medium text-foreground/80 transition-opacity hover:opacity-80">
                      <ArrowRight className="h-3 w-3" /> Iniciar
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ApprovalsSection({ approvals, deliverableName }: { approvals: Approval[]; deliverableName: string }) {
  if (approvals.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card/50 p-8 text-center">
        <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Sin aprobaciones aun</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Este entregable aun no ha sido aprobado.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {approvals.map((a) => (
        <div key={a.id} className="rounded-xl border border-[var(--tab-phases)]/40 bg-[var(--tab-phases)]/10 p-4 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--tab-phases)] flex-shrink-0">
            <CheckCircle2 className="h-5 w-5 text-foreground/60" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{deliverableName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Version {a.version} aprobada por <span className="font-medium text-foreground">{a.approvedBy}</span>
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-muted-foreground">{a.date}</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">v{a.version}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function TimelineSection({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

      <div className="flex flex-col gap-0">
        {events.map((event, i) => (
          <div key={event.id} className="flex items-start gap-4 relative py-3">
            {/* Dot */}
            <div className={cn(
              "relative z-10 flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0",
              event.type === "approval" ? "bg-[var(--tab-phases)]" :
              event.type === "version" ? "bg-[var(--tab-info)]" :
              event.type === "change_request" ? "bg-[var(--tab-review)]" :
              event.type === "upload" ? "bg-[var(--tab-docs)]" :
              "bg-muted"
            )}>
              {event.type === "version" && <RotateCcw className="h-3.5 w-3.5 text-foreground/60" />}
              {event.type === "comment" && <MessageSquareText className="h-3.5 w-3.5 text-foreground/60" />}
              {event.type === "approval" && <ThumbsUp className="h-3.5 w-3.5 text-foreground/60" />}
              {event.type === "change_request" && <AlertTriangle className="h-3.5 w-3.5 text-foreground/60" />}
              {event.type === "upload" && <Upload className="h-3.5 w-3.5 text-foreground/60" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{event.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">{event.date}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{event.author}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════ SHARED SMALL COMPONENTS ═══════════════ */

function SummaryCard({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 text-center">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      <div className="h-1 rounded-full bg-muted mt-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: total > 0 ? `${(value / total) * 100}%` : "0%", backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function DeliverableStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    aprobado: { bg: "bg-[var(--tab-phases)]", text: "text-foreground/70", label: "Aprobado" },
    "en revision": { bg: "bg-[var(--tab-review)]", text: "text-foreground/70", label: "En revision" },
    "con cambios": { bg: "bg-[var(--tab-tasks)]", text: "text-foreground/70", label: "Con cambios" },
    pendiente: { bg: "bg-muted", text: "text-muted-foreground", label: "Pendiente" },
  }
  const s = map[status] || map.pendiente
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium", s.bg, s.text)}>
      {s.label}
    </span>
  )
}

function CRStatusIcon({ status }: { status: string }) {
  if (status === "resuelto") return <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
  if (status === "en progreso") return <CircleDot className="h-4 w-4 text-blue-500 flex-shrink-0" />
  return <CircleDashed className="h-4 w-4 text-amber-500 flex-shrink-0" />
}

function CRStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pendiente: "bg-amber-100 text-amber-700",
    "en progreso": "bg-blue-100 text-blue-700",
    resuelto: "bg-green-100 text-green-700",
  }
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize flex-shrink-0", map[status] || "bg-muted text-muted-foreground")}>
      {status}
    </span>
  )
}

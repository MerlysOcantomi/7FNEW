"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ContextShell } from "@/components/context-shell";
import { cn } from "@/lib/utils";
import {
  Calendar, Building2, User, DollarSign, AlertTriangle,
  CheckCircle2, Circle, Clock, FileBarChart, Plus, Pencil,
  ArrowUpRight, Paperclip, Download, FileText, MapPin,
} from "lucide-react";

// ── Types & Data ──────────────────────────────────────────────────────────────

type ProjectStatus = "En marcha" | "En riesgo" | "Retrasado" | "Completado";
type MilestoneStatus = "Completado" | "En progreso" | "Pendiente";
type RiskLevel = "Alto" | "Medio" | "Bajo";

interface Project {
  id: string;
  name: string;
  client: string;
  clientId: string;
  location: string;
  status: ProjectStatus;
  progress: number;
  dueDate: string;
  startDate: string;
  phase: string;
  budget: string;
  budgetUsed: string;
  budgetRemaining: string;
  lead: string;
  description: string;
  nextMilestone: string;
  riskLevel: RiskLevel;
  keyMetrics: { label: string; value: string }[];
  milestones: { label: string; date: string; status: MilestoneStatus; description?: string }[];
  tasks: { label: string; assignee: string; due: string; status: MilestoneStatus; category: string }[];
  risks: { title: string; level: RiskLevel; description: string; action: string }[];
  files: { name: string; type: string; size: string; date: string }[];
  notes: { author: string; date: string; content: string }[];
  financialNote: string;
  financialItems: { label: string; value: string; variant: "neutral" | "positive" | "warning" }[];
}

const PROJECT_DATA: Record<string, Project> = {
  p1: {
    id: "p1",
    name: "Alpha Expansion",
    client: "Acme Corp",
    clientId: "c1",
    location: "Noreste, Medio Oeste y Pacífico",
    status: "En marcha",
    progress: 60,
    dueDate: "30 jun 2025",
    startDate: "5 ene 2025",
    phase: "Fase 3 / 5",
    budget: "$820.000",
    budgetUsed: "62%",
    budgetRemaining: "$311.600",
    lead: "M. Torres",
    nextMilestone: "Expansión Regional — Fase A",
    riskLevel: "Medio",
    description:
      "Expansión operativa a escala completa en tres nuevos mercados regionales. Incluye infraestructura, permisos, incorporación de equipos e integración de clientes en los corredores Noreste, Medio Oeste y Pacífico. Estructurado en cinco fases de entrega con compromiso de lanzamiento en Q2.",
    keyMetrics: [
      { label: "Presupuesto usado", value: "62%" },
      { label: "Tareas completadas", value: "34 / 56" },
      { label: "Riesgos activos", value: "2" },
      { label: "Días restantes", value: "47" },
    ],
    milestones: [
      { label: "Descubrimiento y alcance", date: "15 ene 2025", status: "Completado", description: "Evaluaciones de sitio completadas. Documentos de alcance firmados." },
      { label: "Planificación de infraestructura", date: "28 feb 2025", status: "Completado", description: "Planos de ingeniería aprobados. Lista de adquisiciones finalizada." },
      { label: "Expansión Regional — Fase A", date: "10 abr 2025", status: "En progreso", description: "Corredor Noreste en progreso. Dos confirmaciones de proveedores pendientes." },
      { label: "Incorporación e integración de equipos", date: "20 may 2025", status: "Pendiente", description: "Responsables regionales identificados. Materiales de formación en desarrollo." },
      { label: "Lanzamiento y entrega al cliente", date: "30 jun 2025", status: "Pendiente", description: "Revisión final y aprobación de Acme Corp planificada." },
    ],
    tasks: [
      { label: "Confirmar acuerdos con proveedores — región Noreste", assignee: "M. Torres", due: "5 mar", status: "En progreso", category: "Adquisición" },
      { label: "Enviar documentos de cumplimiento Fase 3", assignee: "E. Davis", due: "8 mar", status: "Pendiente", category: "Legal" },
      { label: "Auditoría de infraestructura — Medio Oeste", assignee: "S. Patel", due: "12 mar", status: "Pendiente", category: "Ingeniería" },
      { label: "Presentación de incorporación cliente — Acme", assignee: "A. Chen", due: "20 mar", status: "Pendiente", category: "Cliente" },
      { label: "Retrospectiva Fase 2 cerrada", assignee: "M. Torres", due: "28 feb", status: "Completado", category: "Gestión" },
      { label: "Trámites de permisos — corredor Pacífico", assignee: "R. Kim", due: "25 mar", status: "Pendiente", category: "Legal" },
    ],
    risks: [
      { title: "Retraso de proveedor — Nivel 2 Noreste", level: "Alto", description: "Dos proveedores no han confirmado compromisos de hito.", action: "Escalar al responsable de adquisiciones antes del 6 de marzo." },
      { title: "Variación presupuestaria — infraestructura", level: "Medio", description: "Costes de infraestructura con tendencia al 4% por encima del estimado.", action: "Registrar en la revisión financiera mensual." },
    ],
    files: [
      { name: "Alpha_Expansion_SOW_v3.pdf", type: "PDF", size: "2,4 MB", date: "12 feb 2025" },
      { name: "Phase2_Retrospectiva.xlsx", type: "Excel", size: "840 KB", date: "1 mar 2025" },
      { name: "Noreste_Plan_Infraestructura.pdf", type: "PDF", size: "5,1 MB", date: "28 feb 2025" },
      { name: "Acme_Presentacion_v1.pptx", type: "PowerPoint", size: "3,7 MB", date: "3 mar 2025" },
    ],
    notes: [
      { author: "M. Torres", date: "3 mar 2025", content: "Acme Corp confirmó reunión Fase A para el 11 de marzo. Se necesitan resultados de auditoría de infraestructura antes." },
      { author: "E. Davis", date: "27 feb 2025", content: "El equipo de cumplimiento señaló dos elementos de permisos para el corredor Pacífico. Seguimiento en módulo legal." },
    ],
    financialNote: "Fondo de Crecimiento III parcialmente asignado. Seguimiento activo de desviación presupuestaria. Informe de varianza mensual previsto el 15 de marzo.",
    financialItems: [
      { label: "Presupuesto total", value: "$820.000", variant: "neutral" },
      { label: "Gastado hasta la fecha", value: "$508.400 (62%)", variant: "neutral" },
      { label: "Restante", value: "$311.600", variant: "positive" },
      { label: "Varianza", value: "+$18.200 sobre estimado", variant: "warning" },
    ],
  },
  p2: {
    id: "p2",
    name: "Beta Relaunch",
    client: "Nexus Holdings",
    clientId: "c2",
    location: "Remoto / Empresarial",
    status: "En riesgo",
    progress: 45,
    dueDate: "15 may 2025",
    startDate: "20 nov 2024",
    phase: "Fase 2 / 4",
    budget: "$540.000",
    budgetUsed: "51%",
    budgetRemaining: "$264.600",
    lead: "A. Chen",
    nextMilestone: "Pruebas Beta Empresarial",
    riskLevel: "Alto",
    description:
      "Iniciativa de relanzamiento de producto orientada a la reactivación del segmento empresarial. Retrasada por dependencia de confirmación de API de proveedor para entregables principales.",
    keyMetrics: [
      { label: "Presupuesto usado", value: "51%" },
      { label: "Tareas completadas", value: "18 / 40" },
      { label: "Riesgos activos", value: "4" },
      { label: "Días restantes", value: "19" },
    ],
    milestones: [
      { label: "Auditoría de producto", date: "20 dic 2024", status: "Completado", description: "Plataforma auditada. Análisis de brechas completado." },
      { label: "Rediseño y prototipo", date: "10 feb 2025", status: "En progreso", description: "Renovación de interfaz al 70%. Pendiente confirmación de API." },
      { label: "Pruebas Beta Empresarial", date: "30 mar 2025", status: "Pendiente", description: "Grupo de prueba de 12 clientes empresariales seleccionado." },
      { label: "Lanzamiento completo", date: "15 may 2025", status: "Pendiente", description: "Evento de lanzamiento pendiente de aprobación beta." },
    ],
    tasks: [
      { label: "Confirmación proveedor — integraciones API", assignee: "A. Chen", due: "4 mar", status: "En progreso", category: "Proveedor" },
      { label: "Configuración entorno beta", assignee: "R. Kim", due: "10 mar", status: "Pendiente", category: "Ingeniería" },
      { label: "Selección grupo de prueba cliente", assignee: "A. Chen", due: "15 mar", status: "Pendiente", category: "Cliente" },
      { label: "Documentación de alcance Fase 1", assignee: "E. Davis", due: "15 feb", status: "Completado", category: "Gestión" },
    ],
    risks: [
      { title: "Retrasos API del proveedor", level: "Alto", description: "El proveedor principal no ha confirmado disponibilidad de API. Plazo en riesgo.", action: "Escalar a CTO e identificar proveedor alternativo." },
      { title: "Expansión de alcance — Fase 2", level: "Medio", description: "Nuevas solicitudes de funciones fuera del alcance original.", action: "Programar revisión de alcance con partes interesadas." },
    ],
    files: [
      { name: "BetaRelaunch_Alcance_v2.pdf", type: "PDF", size: "1,9 MB", date: "10 ene 2025" },
      { name: "Prototipo_Rediseno_UI.fig", type: "Figma", size: "14,2 MB", date: "8 feb 2025" },
    ],
    notes: [
      { author: "A. Chen", date: "2 mar 2025", content: "El proveedor envió confirmación preliminar pero no definitiva. Seguimiento mañana." },
    ],
    financialNote: "Presupuesto al 51% en punto medio — antes de lo proyectado. Se recomienda revisión de fin de mes.",
    financialItems: [
      { label: "Presupuesto total", value: "$540.000", variant: "neutral" },
      { label: "Gastado hasta la fecha", value: "$275.400 (51%)", variant: "neutral" },
      { label: "Restante", value: "$264.600", variant: "positive" },
      { label: "Varianza", value: "En estimado", variant: "positive" },
    ],
  },
  p3: {
    id: "p3",
    name: "Delta Infrastructure",
    client: "Vertex Capital",
    clientId: "c3",
    location: "Multi-sede / 4 Unidades de Negocio",
    status: "En marcha",
    progress: 33,
    dueDate: "12 ago 2025",
    startDate: "15 ene 2025",
    phase: "Fase 1 / 3",
    budget: "$1.100.000",
    budgetUsed: "29%",
    budgetRemaining: "$781.000",
    lead: "S. Patel",
    nextMilestone: "Evaluación y Arquitectura",
    riskLevel: "Bajo",
    description:
      "Programa de modernización de infraestructura a largo plazo que cubre migración de centros de datos y consolidación de plataformas en cuatro unidades de negocio.",
    keyMetrics: [
      { label: "Presupuesto usado", value: "29%" },
      { label: "Tareas completadas", value: "12 / 36" },
      { label: "Riesgos activos", value: "1" },
      { label: "Días restantes", value: "128" },
    ],
    milestones: [
      { label: "Evaluación y Arquitectura", date: "1 feb 2025", status: "En progreso", description: "Auditoría de centro de datos al 80%. Diagramas de arquitectura en revisión." },
      { label: "Migración Fase A", date: "15 may 2025", status: "Pendiente", description: "Unidades de negocio 1 y 2 programadas para migración." },
      { label: "Consolidación y pruebas", date: "12 ago 2025", status: "Pendiente", description: "Consolidación completa de plataforma y pruebas de carga." },
    ],
    tasks: [
      { label: "Finalización auditoría del centro de datos", assignee: "S. Patel", due: "10 mar", status: "En progreso", category: "Ingeniería" },
      { label: "Adquisición de proveedor — hardware", assignee: "M. Torres", due: "25 mar", status: "Pendiente", category: "Adquisición" },
      { label: "Revisión de arquitectura de red", assignee: "R. Kim", due: "1 abr", status: "Pendiente", category: "Ingeniería" },
    ],
    risks: [
      { title: "Compatibilidad con sistemas heredados", level: "Medio", description: "Dos sistemas heredados pueden requerir herramientas de migración personalizadas.", action: "Evaluación antes del 1 de abril." },
    ],
    files: [
      { name: "Delta_Infrastructure_Brief.pdf", type: "PDF", size: "3,2 MB", date: "18 ene 2025" },
      { name: "DC_Auditoria_Borrador.xlsx", type: "Excel", size: "1,1 MB", date: "25 feb 2025" },
    ],
    notes: [
      { author: "S. Patel", date: "28 feb 2025", content: "La auditoría progresa bien. Dos servidores señalados para revisión de compatibilidad." },
    ],
    financialNote: "Varianza favorable. Consumo presupuestario 4 semanas adelantado — bien dentro del margen.",
    financialItems: [
      { label: "Presupuesto total", value: "$1.100.000", variant: "neutral" },
      { label: "Gastado hasta la fecha", value: "$319.000 (29%)", variant: "neutral" },
      { label: "Restante", value: "$781.000", variant: "positive" },
      { label: "Varianza", value: "−$22.000 bajo estimado", variant: "positive" },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<ProjectStatus, { bg: string; text: string }> = {
  "En marcha":   { bg: "bg-[#DCFCE7]", text: "text-[#166534]" },
  "En riesgo":   { bg: "bg-[#FEF9C3]", text: "text-[#854D0E]" },
  "Retrasado":   { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
  "Completado":  { bg: "bg-[#F0FDF4]", text: "text-[#166534]" },
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
  "En marcha": "En marcha",
  "En riesgo": "En riesgo",
  "Retrasado": "Retrasado",
  "Completado": "Completado",
};

const RISK_STYLE: Record<RiskLevel, { bg: string; text: string; dot: string }> = {
  Alto:  { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]", dot: "bg-[#EF4444]" },
  Medio: { bg: "bg-[#FEF9C3]", text: "text-[#854D0E]", dot: "bg-[#F59E0B]" },
  Bajo:  { bg: "bg-[#F1F5F9]", text: "text-[#64748B]", dot: "bg-[#94A3B8]" },
};

const MILESTONE_BADGE: Record<MilestoneStatus, string> = {
  "Completado":  "bg-[#DCFCE7] text-[#166534]",
  "En progreso": "bg-[#EFF6FF] text-[#1D4ED8]",
  "Pendiente":   "bg-[#F1F5F9] text-[#64748B]",
};

const FIN_VARIANT: Record<"neutral" | "positive" | "warning", string> = {
  neutral: "text-[#334155]",
  positive: "text-[#166534]",
  warning: "text-[#854D0E]",
};

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
      <div className="h-full bg-[#3B82F6] rounded-full transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

function MilestoneIcon({ status }: { status: MilestoneStatus }) {
  if (status === "Completado")  return <CheckCircle2 size={15} className="text-[#22C55E] shrink-0" strokeWidth={1.75} />;
  if (status === "En progreso") return <Clock size={15} className="text-[#3B82F6] shrink-0" strokeWidth={1.75} />;
  return <Circle size={15} className="text-[#CBD5E1] shrink-0" strokeWidth={1.75} />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-3">{children}</h3>;
}

// ── Tab content panels ────────────────────────────────────────────────────────

function TabResumen({ project }: { project: Project }) {
  const riskStyle = RISK_STYLE[project.riskLevel];
  return (
    <div className="space-y-8">
      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {project.keyMetrics.map(({ label, value }) => (
          <div key={label} className="bg-[#EFF6FF] rounded-xl p-4">
            <p className="text-xl font-bold text-[#0F172A] tracking-tight">{value}</p>
            <p className="text-[10px] text-[#64748B] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Description + risk */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E2E8F0] p-5">
          <SectionLabel>Descripción del proyecto</SectionLabel>
          <p className="text-sm text-[#334155] leading-relaxed">{project.description}</p>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Responsable", value: project.lead },
              { label: "Inicio", value: project.startDate },
              { label: "Vencimiento", value: project.dueDate },
              { label: "Fase", value: project.phase },
              { label: "Próximo hito", value: project.nextMilestone },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-[#94A3B8] mb-0.5">{label}</p>
                <p className="text-xs font-medium text-[#334155]">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {/* Progress card */}
          <div className="bg-[#DBEAFE] rounded-xl p-4">
            <p className="text-[10px] font-bold text-[#2563EB] uppercase tracking-widest mb-2">Progreso general</p>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-2xl font-bold text-[#0F172A]">{project.progress}%</span>
            </div>
            <ProgressBar value={project.progress} />
          </div>
          {/* Risk badge */}
          <div className={cn("rounded-xl p-4", riskStyle.bg)}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "inherit" }}>Nivel de riesgo</p>
            <div className="flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full shrink-0", riskStyle.dot)} />
              <span className={cn("text-sm font-semibold", riskStyle.text)}>{project.riskLevel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabTareas({ project }: { project: Project }) {
  const statusBadge: Record<MilestoneStatus, string> = {
    "Completado":  "bg-[#DCFCE7] text-[#166534]",
    "En progreso": "bg-[#EFF6FF] text-[#1D4ED8]",
    "Pendiente":   "bg-[#F1F5F9] text-[#64748B]",
  };
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionLabel>Tareas del proyecto</SectionLabel>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F172A] text-white text-xs font-medium hover:bg-[#1E293B] transition-colors">
          <Plus size={12} strokeWidth={2.5} />
          Nueva tarea
        </button>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-2.5 border-b border-[#F1F5F9] bg-[#F8FAFC]">
          <span className="col-span-5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Tarea</span>
          <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Responsable</span>
          <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Vencimiento</span>
          <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Categoría</span>
          <span className="col-span-1 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Estado</span>
        </div>
        {project.tasks.map((task, i) => (
          <div key={i} className={cn("grid grid-cols-12 items-center px-5 py-3.5 hover:bg-[#F8FAFC] transition-colors", i < project.tasks.length - 1 && "border-b border-[#F1F5F9]")}>
            <span className="col-span-5 text-sm text-[#334155] pr-3">{task.label}</span>
            <span className="col-span-2 text-xs text-[#64748B]">{task.assignee}</span>
            <span className="col-span-2 text-xs text-[#64748B]">{task.due}</span>
            <span className="col-span-2 text-xs text-[#64748B]">{task.category}</span>
            <span className={cn("col-span-1 text-[10px] font-semibold px-2 py-0.5 rounded w-fit", statusBadge[task.status])}>{task.status}</span>
          </div>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {project.tasks.map((task, i) => (
          <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm font-medium text-[#334155] leading-snug">{task.label}</p>
              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded shrink-0", statusBadge[task.status])}>{task.status}</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] text-[#94A3B8]">{task.assignee}</span>
              <span className="text-[10px] text-[#94A3B8]">·</span>
              <span className="text-[10px] text-[#94A3B8]">Vence {task.due}</span>
              <span className="text-[10px] text-[#94A3B8]">·</span>
              <span className="text-[10px] text-[#94A3B8]">{task.category}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabHitos({ project }: { project: Project }) {
  return (
    <div className="space-y-3">
      <SectionLabel>Cronograma de hitos</SectionLabel>
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        {project.milestones.map((m, i) => (
          <div key={i} className={cn("flex items-start gap-4 px-5 py-4 hover:bg-[#F8FAFC] transition-colors", i < project.milestones.length - 1 && "border-b border-[#F1F5F9]")}>
            <MilestoneIcon status={m.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-0.5">
                <p className="text-sm font-medium text-[#0F172A]">{m.label}</p>
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", MILESTONE_BADGE[m.status])}>{m.status}</span>
              </div>
              {m.description && <p className="text-xs text-[#64748B] leading-relaxed">{m.description}</p>}
            </div>
            <span className="shrink-0 text-xs text-[#94A3B8] font-medium">{m.date}</span>
          </div>
        ))}
      </div>

      {/* Risks */}
      {project.risks.length > 0 && (
        <div className="mt-6">
          <SectionLabel>Riesgos identificados</SectionLabel>
          <div className="space-y-3">
            {project.risks.map((risk, i) => {
              const rs = RISK_STYLE[risk.level];
              return (
                <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-4">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className={cn("flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded", rs.bg, rs.text)}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", rs.dot)} />
                      {risk.level}
                    </span>
                    <p className="text-sm font-medium text-[#0F172A]">{risk.title}</p>
                  </div>
                  <p className="text-xs text-[#64748B] mb-1.5">{risk.description}</p>
                  <p className="text-xs font-medium text-[#334155]">Acción: {risk.action}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TabArchivos({ project }: { project: Project }) {
  const typeColors: Record<string, string> = {
    PDF: "bg-[#FEE2E2] text-[#991B1B]",
    Excel: "bg-[#DCFCE7] text-[#166534]",
    PowerPoint: "bg-[#FEF9C3] text-[#854D0E]",
    Figma: "bg-[#EFF6FF] text-[#1D4ED8]",
    Word: "bg-[#F1F5F9] text-[#64748B]",
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Archivos del proyecto</SectionLabel>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F172A] text-white text-xs font-medium hover:bg-[#1E293B] transition-colors">
          <Plus size={12} strokeWidth={2.5} />
          Subir archivo
        </button>
      </div>
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        {project.files.map((file, i) => (
          <div key={i} className={cn("flex items-center gap-4 px-5 py-4 hover:bg-[#F8FAFC] transition-colors", i < project.files.length - 1 && "border-b border-[#F1F5F9]")}>
            <Paperclip size={14} className="text-[#94A3B8] shrink-0" strokeWidth={1.75} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#334155] truncate">{file.name}</p>
              <p className="text-[10px] text-[#94A3B8] mt-0.5">{file.size} · {file.date}</p>
            </div>
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded shrink-0", typeColors[file.type] ?? "bg-[#F1F5F9] text-[#64748B]")}>
              {file.type}
            </span>
            <button className="shrink-0 p-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[#64748B] hover:text-[#3B82F6] hover:border-[#BFDBFE] transition-colors">
              <Download size={13} strokeWidth={1.75} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabFinanzas({ project }: { project: Project }) {
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {project.financialItems.map(({ label, value, variant }) => (
          <div key={label} className={cn("rounded-xl p-4", variant === "warning" ? "bg-[#FEF9C3]" : variant === "positive" ? "bg-[#DCFCE7]" : "bg-[#EFF6FF]")}>
            <p className={cn("text-base font-bold tracking-tight", FIN_VARIANT[variant])}>{value}</p>
            <p className="text-[10px] text-[#64748B] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Note */}
      <div className="bg-[#DBEAFE] rounded-xl p-5">
        <p className="text-[10px] font-bold text-[#2563EB] uppercase tracking-widest mb-2">Nota financiera</p>
        <p className="text-sm text-[#334155] leading-relaxed">{project.financialNote}</p>
      </div>

      {/* Link to Funds */}
      <div className="flex items-center justify-end">
        <Link href="/finanzas" className="flex items-center gap-1.5 text-xs text-[#3B82F6] font-medium hover:text-[#2563EB] transition-colors">
          Ver en Funds <ArrowUpRight size={12} />
        </Link>
      </div>
    </div>
  );
}

function TabNotas({ project }: { project: Project }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Notas del proyecto</SectionLabel>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F172A] text-white text-xs font-medium hover:bg-[#1E293B] transition-colors">
          <Plus size={12} strokeWidth={2.5} />
          Añadir nota
        </button>
      </div>
      <div className="space-y-3">
        {project.notes.map((note, i) => (
          <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-5">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#DBEAFE] flex items-center justify-center">
                  <span className="text-[9px] font-bold text-[#2563EB]">{note.author.split(".")[0]}</span>
                </div>
                <span className="text-xs font-semibold text-[#334155]">{note.author}</span>
              </div>
              <span className="text-[10px] text-[#94A3B8]">{note.date}</span>
            </div>
            <p className="text-sm text-[#64748B] leading-relaxed">{note.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: "resumen",  label: "Resumen" },
  { key: "tareas",   label: "Tareas" },
  { key: "hitos",    label: "Hitos" },
  { key: "archivos", label: "Archivos" },
  { key: "finanzas", label: "Finanzas" },
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const project = PROJECT_DATA[id as string] ?? PROJECT_DATA["p1"];
  const statusStyle = STATUS_STYLE[project.status];

  return (
    <ContextShell
      breadcrumbs={[
        { label: "Flow", href: "/" },
        { label: "Proyectos", href: "/proyectos" },
        { label: project.name },
      ]}
      heading={
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight text-balance">{project.name}</h1>
          <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold", statusStyle.bg, statusStyle.text)}>
            {STATUS_LABEL[project.status]}
          </span>
          <span className="text-xs text-[#94A3B8] font-medium">{project.phase}</span>
        </div>
      }
      meta={
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 text-sm text-[#64748B]">
            <Building2 size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
            <Link href={`/clientes/${project.clientId}`} className="hover:text-[#3B82F6] transition-colors">{project.client}</Link>
          </span>
          <span className="flex items-center gap-1.5 text-sm text-[#64748B]">
            <MapPin size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
            {project.location}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-[#64748B]">
            <Calendar size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
            Vence {project.dueDate}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-[#64748B]">
            <User size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
            {project.lead}
          </span>
        </div>
      }
      actions={
        <>
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E2E8F0] bg-white text-[#334155] text-xs font-medium hover:bg-[#F8FAFC] transition-colors">
            <Pencil size={13} strokeWidth={1.75} />
            Actualizar
          </button>
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-medium hover:bg-[#1E293B] transition-colors">
            <FileBarChart size={13} strokeWidth={1.75} />
            Generar informe
          </button>
        </>
      }
      tabs={TABS}
      defaultTab="resumen"
      copilotContext="Flow"
    >
      {(activeTab) => {
        if (activeTab === "resumen")  return <TabResumen project={project} />;
        if (activeTab === "tareas")   return <TabTareas project={project} />;
        if (activeTab === "hitos")    return <TabHitos project={project} />;
        if (activeTab === "archivos") return <TabArchivos project={project} />;
        if (activeTab === "finanzas") return <TabFinanzas project={project} />;
        return null;
      }}
    </ContextShell>
  );
}

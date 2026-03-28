"use client"

import { useState } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { cn } from "@/lib/utils"
import {
  Building2,
  Users,
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertCircle,
  BarChart3,
  User,
  ChevronDown,
  ChevronRight,
  Briefcase,
  Palette,
  Code2,
  Megaphone,
  PenTool,
  Settings,
} from "lucide-react"

const departments = [
  {
    id: "dep-diseno",
    name: "Design",
    icon: Palette,
    color: "var(--tab-info)",
    lead: "Ana Rodriguez",
    members: [
      { name: "Ana Rodriguez", role: "Creative Director", avatar: "AR", projects: 4, tasks: 12, load: 85 },
      { name: "Diego Navarro", role: "UI/UX Designer", avatar: "DN", projects: 3, tasks: 8, load: 70 },
      { name: "Camila Rios", role: "Graphic Designer", avatar: "CR", projects: 2, tasks: 6, load: 55 },
    ],
    activeProjects: 5,
    pendingTasks: 18,
    completedThisWeek: 7,
    avgLoad: 70,
  },
  {
    id: "dep-desarrollo",
    name: "Development",
    icon: Code2,
    color: "var(--tab-phases)",
    lead: "Miguel Torres",
    members: [
      { name: "Miguel Torres", role: "Lead Developer", avatar: "MT", projects: 3, tasks: 15, load: 90 },
      { name: "Lucia Herrera", role: "Frontend Developer", avatar: "LH", projects: 2, tasks: 10, load: 75 },
      { name: "Pablo Sanchez", role: "Backend Developer", avatar: "PS", projects: 2, tasks: 8, load: 65 },
    ],
    activeProjects: 4,
    pendingTasks: 22,
    completedThisWeek: 9,
    avgLoad: 77,
  },
  {
    id: "dep-estrategia",
    name: "Strategy",
    icon: Briefcase,
    color: "var(--tab-tasks)",
    lead: "Valentina Mora",
    members: [
      { name: "Valentina Mora", role: "Strategy Director", avatar: "VM", projects: 5, tasks: 10, load: 80 },
      { name: "Tomas Gutierrez", role: "Digital Strategist", avatar: "TG", projects: 3, tasks: 6, load: 50 },
    ],
    activeProjects: 6,
    pendingTasks: 12,
    completedThisWeek: 5,
    avgLoad: 65,
  },
  {
    id: "dep-marketing",
    name: "Marketing & Content",
    icon: Megaphone,
    color: "var(--tab-docs)",
    lead: "Isabela Cruz",
    members: [
      { name: "Isabela Cruz", role: "Marketing Director", avatar: "IC", projects: 4, tasks: 14, load: 88 },
      { name: "Daniel Vargas", role: "Content Manager", avatar: "DV", projects: 3, tasks: 9, load: 60 },
      { name: "Sofia Perez", role: "Community Manager", avatar: "SP", projects: 2, tasks: 7, load: 45 },
    ],
    activeProjects: 5,
    pendingTasks: 20,
    completedThisWeek: 8,
    avgLoad: 64,
  },
  {
    id: "dep-produccion",
    name: "Production",
    icon: PenTool,
    color: "var(--tab-ai)",
    lead: "Jorge Vega",
    members: [
      { name: "Jorge Vega", role: "Production Director", avatar: "JV", projects: 3, tasks: 11, load: 75 },
      { name: "Andrea Luna", role: "Audiovisual Producer", avatar: "AL", projects: 2, tasks: 6, load: 50 },
    ],
    activeProjects: 3,
    pendingTasks: 14,
    completedThisWeek: 4,
    avgLoad: 63,
  },
]

function LoadBar({ load }: { load: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", load >= 85 ? "bg-[var(--tab-review)]" : load >= 65 ? "bg-[var(--tab-tasks)]" : "bg-[var(--tab-phases)]")}
          style={{ width: `${load}%` }}
        />
      </div>
      <span className={cn("text-xs font-medium", load >= 85 ? "text-foreground" : "text-muted-foreground")}>{load}%</span>
    </div>
  )
}

export default function DepartamentosPage() {
  const [expandedDept, setExpandedDept] = useState<string | null>("dep-diseno")

  const totalMembers = departments.reduce((a, d) => a + d.members.length, 0)
  const totalProjects = departments.reduce((a, d) => a + d.activeProjects, 0)
  const totalPending = departments.reduce((a, d) => a + d.pendingTasks, 0)
  const avgLoad = Math.round(departments.reduce((a, d) => a + d.avgLoad, 0) / departments.length)

  return (
    <AppShell currentSection="departamentos" breadcrumbs={[{ label: "7F" }, { label: "Departments" }]}>
      <SectionPage title="Departments" description="Team management, individual workload, and project distribution by department.">

        {/* Cross-link */}
        <div className="flex justify-end">
          <Link href="/usuarios" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            View all users →
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Departments</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{departments.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Members</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{totalMembers}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active projects</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{totalProjects}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Average load</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{avgLoad}%</p>
            <LoadBar load={avgLoad} />
          </div>
        </div>

        {/* Department cards */}
        <div className="flex flex-col gap-3">
          {departments.map((dept) => {
            const DeptIcon = dept.icon
            const isExpanded = expandedDept === dept.id
            return (
              <div key={dept.id} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Department header */}
                <button
                  onClick={() => setExpandedDept(isExpanded ? null : dept.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: dept.color }}>
                    <DeptIcon className="h-5 w-5 text-foreground/60" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{dept.name}</h3>
                      <span className="text-xs text-muted-foreground">&middot; {dept.members.length} members</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Lead: {dept.lead}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Projects</p>
                      <p className="text-sm font-semibold text-foreground">{dept.activeProjects}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Pending</p>
                      <p className="text-sm font-semibold text-foreground">{dept.pendingTasks}</p>
                    </div>
                    <div className="w-24">
                      <p className="text-xs text-muted-foreground mb-0.5">Load</p>
                      <LoadBar load={dept.avgLoad} />
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                </button>

                {/* Expanded members */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Mobile stats */}
                    <div className="grid grid-cols-3 gap-3 px-5 py-3 border-b border-border sm:hidden">
                      <div><p className="text-[10px] text-muted-foreground">Projects</p><p className="text-sm font-semibold text-foreground">{dept.activeProjects}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">Pending</p><p className="text-sm font-semibold text-foreground">{dept.pendingTasks}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">Completed/wk</p><p className="text-sm font-semibold text-foreground">{dept.completedThisWeek}</p></div>
                    </div>

                    {/* Members */}
                    <div className="divide-y divide-border">
                      {dept.members.map((member) => (
                        <div key={member.name} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted flex-shrink-0">
                            <span className="text-xs font-bold text-muted-foreground">{member.avatar}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link href="/usuarios" className="text-sm font-medium text-foreground hover:underline">{member.name}</Link>
                            <p className="text-xs text-muted-foreground">{member.role}</p>
                          </div>
                          <div className="hidden sm:flex items-center gap-4 flex-shrink-0 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><FolderKanban className="h-3 w-3" />{member.projects}</span>
                            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{member.tasks}</span>
                          </div>
                          <div className="w-20 flex-shrink-0">
                            <LoadBar load={member.load} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </SectionPage>
    </AppShell>
  )
}

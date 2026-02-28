"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, ArrowUpRight, Maximize2 } from "lucide-react"
import { cn } from "@/lib/utils"

const CONTEXT_CHIPS = ["Flow", "Forge", "Funds", "Future", "Foresight"] as const
type ContextChip = (typeof CONTEXT_CHIPS)[number]

const CHIP_SUBTITLES: Record<ContextChip, string> = {
  Flow: "Operacion",
  Forge: "Creacion",
  Funds: "Finanzas",
  Future: "Estrategia",
  Foresight: "Inteligencia",
}

const CHIP_LINKS: Record<ContextChip, { label: string; href: string }[]> = {
  Flow: [
    { label: "Proyectos", href: "/proyectos" },
    { label: "Clientes", href: "/clientes" },
    { label: "Tareas", href: "/tareas" },
  ],
  Forge: [
    { label: "Contenido", href: "/contenido" },
  ],
  Funds: [
    { label: "Finanzas", href: "/finanzas" },
    { label: "Facturacion", href: "/facturacion" },
  ],
  Future: [
    { label: "Asistente", href: "/agente" },
    { label: "Motor IA", href: "/motor" },
  ],
  Foresight: [
    { label: "Dashboard", href: "/" },
    { label: "Analisis", href: "/agente" },
  ],
}

interface ContextBarProps {
  className?: string
  defaultChip?: string
}

export function ContextBar({ className, defaultChip = "Flow" }: ContextBarProps) {
  const safeDefault: ContextChip = CONTEXT_CHIPS.includes(defaultChip as ContextChip)
    ? (defaultChip as ContextChip)
    : "Flow"

  const [activeChip, setActiveChip] = useState<ContextChip>(safeDefault)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const entities = CHIP_LINKS[activeChip]
  const selected = entities[selectedIdx] ?? entities[0]

  return (
    <div className={cn("flex flex-col gap-2.5 px-4 py-3.5 border-b border-[#E2E8F0] bg-[#FAFCFF]", className)}>
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">Contexto</p>

      <div className="flex items-center gap-1 flex-wrap">
        {CONTEXT_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => { setActiveChip(chip); setSelectedIdx(0); setDropdownOpen(false) }}
            title={CHIP_SUBTITLES[chip]}
            className={cn(
              "flex flex-col items-center px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors leading-tight",
              activeChip === chip
                ? "bg-[#DBEAFE] text-[#1D4ED8]"
                : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#EFF6FF] hover:text-[#3B82F6]"
            )}
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md border border-[#E2E8F0] bg-white text-xs font-medium text-[#0F172A] hover:border-[#3B82F6] transition-colors"
          >
            <span className="truncate">{selected.label}</span>
            <ChevronDown
              size={12}
              className={cn("text-[#94A3B8] shrink-0 transition-transform", dropdownOpen && "rotate-180")}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white border border-[#E2E8F0] rounded-md shadow-lg overflow-hidden">
              {entities.map((option, idx) => (
                <button
                  key={option.label}
                  onClick={() => { setSelectedIdx(idx); setDropdownOpen(false) }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs transition-colors",
                    selectedIdx === idx
                      ? "bg-[#EFF6FF] text-[#2563EB] font-semibold"
                      : "text-[#334155] hover:bg-[#F8FAFC]"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <Link
          href={selected.href}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold text-[#3B82F6] hover:bg-[#EFF6FF] border border-[#E2E8F0] hover:border-[#BFDBFE] transition-colors whitespace-nowrap"
        >
          Ver
          <ArrowUpRight size={11} />
        </Link>

        <Link
          href="/agente"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold text-[#64748B] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-colors whitespace-nowrap"
          title="Abrir asistente completo"
        >
          <Maximize2 size={11} />
        </Link>
      </div>
    </div>
  )
}

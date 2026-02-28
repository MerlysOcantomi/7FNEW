"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ArrowUpRight, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── 5F Context Chips ─────────────────────────────────────────────────────────
const CONTEXT_CHIPS = ["Flow", "Forge", "Funds", "Future", "Foresight"] as const;
type ContextChip = (typeof CONTEXT_CHIPS)[number];

const CHIP_SUBTITLES: Record<ContextChip, string> = {
  Flow: "Operación",
  Forge: "Creación",
  Funds: "Finanzas",
  Future: "Estrategia",
  Foresight: "Inteligencia",
};

const ENTITY_OPTIONS: Record<ContextChip, { label: string; href: string }[]> = {
  Flow: [
    { label: "Alpha Expansion", href: "/proyectos/alpha-expansion" },
    { label: "Beta Relaunch", href: "/proyectos/beta-relaunch" },
    { label: "Acme Corp", href: "/clientes/acme-corp" },
    { label: "Nexus Holdings", href: "/clientes/nexus-holdings" },
  ],
  Forge: [
    { label: "Q1 Launch Campaign", href: "/contenido" },
    { label: "Enterprise Outreach", href: "/contenido" },
    { label: "Partner Summit", href: "/contenido" },
  ],
  Funds: [
    { label: "Growth Fund III", href: "/finanzas" },
    { label: "Innovation Pool", href: "/finanzas" },
    { label: "Seed Reserve", href: "/finanzas" },
    { label: "INV-2024-089", href: "/facturacion" },
  ],
  Future: [
    { label: "Strategic Overview", href: "/agente" },
    { label: "Q2 Planning", href: "/agente" },
    { label: "AI Model Config", href: "/motor" },
  ],
  Foresight: [
    { label: "Market Intelligence", href: "/agente" },
    { label: "Risk Radar", href: "/agente" },
    { label: "Opportunity Map", href: "/agente" },
  ],
};

interface ContextBarProps {
  className?: string;
  defaultChip?: ContextChip | string;
}

export function ContextBar({ className, defaultChip = "Flow" }: ContextBarProps) {
  const safeDefault: ContextChip = CONTEXT_CHIPS.includes(defaultChip as ContextChip)
    ? (defaultChip as ContextChip)
    : "Flow";

  const [activeChip, setActiveChip] = useState<ContextChip>(safeDefault);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const entities = ENTITY_OPTIONS[activeChip];
  const selected = entities[selectedIdx] ?? entities[0];

  const handleChipChange = (chip: ContextChip) => {
    setActiveChip(chip);
    setSelectedIdx(0);
    setDropdownOpen(false);
  };

  return (
    <div className={cn("flex flex-col gap-2.5 px-4 py-3.5 border-b border-[#E2E8F0] bg-[#FAFCFF]", className)}>
      {/* Section label */}
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">Context</p>

      {/* 5F Chips */}
      <div className="flex items-center gap-1 flex-wrap">
        {CONTEXT_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => handleChipChange(chip)}
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

      {/* Entity Selector + View + Full Screen */}
      <div className="flex items-center gap-2">
        {/* Dropdown */}
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
                  onClick={() => { setSelectedIdx(idx); setDropdownOpen(false); }}
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

        {/* View button */}
        <Link
          href={selected.href}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold text-[#3B82F6] hover:bg-[#EFF6FF] border border-[#E2E8F0] hover:border-[#BFDBFE] transition-colors whitespace-nowrap"
          title="View entity"
        >
          View
          <ArrowUpRight size={11} />
        </Link>

        {/* Full Screen button */}
        <Link
          href="/assistant"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold text-[#64748B] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-colors whitespace-nowrap"
          title="Open full screen assistant"
        >
          <Maximize2 size={11} />
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { SidebarNav, MobileSidebarNav, SidebarCollapseContext } from "@/components/sidebar-nav";
import { CopilotPanel, CopilotCollapseContext } from "@/components/copilot-panel";
import { Save, ToggleLeft, ToggleRight, ChevronDown } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CapabilityItem {
  id: string;
  label: string;
  locked?: boolean;
}
interface CapabilityGroup {
  section: string;
  items: CapabilityItem[];
}

// ── Core Capabilities ─────────────────────────────────────────────────────────
const CORE_CAPABILITIES: CapabilityGroup[] = [
  {
    section: "Flow",
    items: [
      { id: "inbox", label: "Inbox Inteligente", locked: true },
      { id: "entrada", label: "Entrada Manual", locked: true },
      { id: "clientes", label: "Clientes", locked: true },
      { id: "proyectos", label: "Proyectos", locked: true },
      { id: "tareas", label: "Tareas", locked: true },
      { id: "calendario", label: "Calendario", locked: true },
      { id: "archivos", label: "Archivos", locked: true },
      { id: "departamentos", label: "Departamentos", locked: true },
    ],
  },
  {
    section: "Forge",
    items: [
      { id: "campanas", label: "Campañas & Contenido", locked: true },
    ],
  },
  {
    section: "Funds",
    items: [
      { id: "finanzas", label: "Finanzas", locked: true },
      { id: "facturacion", label: "Facturación", locked: true },
    ],
  },
  {
    section: "Future",
    items: [
      { id: "agente", label: "Agente Ejecutivo", locked: true },
      { id: "motor", label: "Motor IA", locked: true },
    ],
  },
];

// ── Extension Packs ────────────────────────────────────────────────────────────
type PackKey = "standard" | "construction" | "ecommerce";

const EXTENSION_PACKS: Record<PackKey, { label: string; groups: CapabilityGroup[] }> = {
  standard: {
    label: "Core estándar",
    groups: [],
  },
  construction: {
    label: "Pack Construction",
    groups: [
      {
        section: "Flow",
        items: [
          { id: "subcontratistas", label: "Subcontratistas" },
          { id: "control_obra", label: "Control de obra" },
          { id: "certificaciones", label: "Certificaciones" },
          { id: "avance_fisico", label: "Avance físico" },
        ],
      },
      {
        section: "Funds",
        items: [
          { id: "pagos_avance", label: "Pagos por avance" },
          { id: "retenciones", label: "Retenciones" },
        ],
      },
    ],
  },
  ecommerce: {
    label: "Pack Ecommerce",
    groups: [
      {
        section: "Flow",
        items: [
          { id: "pedidos", label: "Pedidos" },
          { id: "inventario", label: "Inventario" },
          { id: "productos", label: "Productos" },
        ],
      },
      {
        section: "Funds",
        items: [
          { id: "pagos_online", label: "Pagos online" },
          { id: "reembolsos", label: "Reembolsos" },
        ],
      },
    ],
  },
};

// ── Advanced customization items ──────────────────────────────────────────────
const ADVANCED_ITEMS = [
  { id: "custom_fields", label: "Campos personalizados" },
  { id: "etiquetas", label: "Etiquetas internas" },
  { id: "automatizaciones", label: "Automatizaciones específicas" },
];

// ── Section label color map ────────────────────────────────────────────────────
const SECTION_COLOR: Record<string, string> = {
  Flow: "text-[#2563EB]",
  Forge: "text-[#0F172A]",
  Funds: "text-[#1D4ED8]",
  Future: "text-[#64748B]",
};

// ── Toggle component ──────────────────────────────────────────────────────────
function Toggle({
  enabled,
  locked,
  onToggle,
}: {
  enabled: boolean;
  locked?: boolean;
  onToggle: () => void;
}) {
  if (locked) {
    return (
      <div className="flex items-center gap-1.5">
        <ToggleRight size={22} className="text-[#3B82F6]" strokeWidth={1.5} />
        <span className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide whitespace-nowrap">
          Base del sistema
        </span>
      </div>
    );
  }
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 group"
      aria-label={enabled ? "Desactivar" : "Activar"}
    >
      {enabled ? (
        <ToggleRight size={22} className="text-[#3B82F6]" strokeWidth={1.5} />
      ) : (
        <ToggleLeft size={22} className="text-[#CBD5E1] group-hover:text-[#94A3B8]" strokeWidth={1.5} />
      )}
    </button>
  );
}

// ── Capability Row ─────────────────────────────────────────────────────────────
function CapabilityRow({
  item,
  enabled,
  onToggle,
}: {
  item: CapabilityItem;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors">
      <span className={`text-sm ${item.locked ? "text-[#334155] font-medium" : enabled ? "text-[#334155]" : "text-[#94A3B8]"}`}>
        {item.label}
      </span>
      <Toggle enabled={item.locked ? true : enabled} locked={item.locked} onToggle={onToggle} />
    </div>
  );
}

// ── Section Group ──────────────────────────────────────────────────────────────
function CapabilityGroupBlock({
  group,
  enabledMap,
  onToggle,
  bgClass,
}: {
  group: CapabilityGroup;
  enabledMap: Record<string, boolean>;
  onToggle: (id: string) => void;
  bgClass?: string;
}) {
  return (
    <div className={`rounded-xl overflow-hidden border border-[#E2E8F0] ${bgClass ?? "bg-white"}`}>
      <div className="px-4 py-2.5 border-b border-[#E2E8F0] flex items-center gap-2">
        <span className={`text-[11px] font-bold uppercase tracking-widest ${SECTION_COLOR[group.section] ?? "text-[#334155]"}`}>
          {group.section}
        </span>
      </div>
      <div>
        {group.items.map((item) => (
          <CapabilityRow
            key={item.id}
            item={item}
            enabled={item.locked ? true : (enabledMap[item.id] ?? false)}
            onToggle={() => onToggle(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Administracion() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [copilotCollapsed, setCopilotCollapsed] = useState(false);

  // Extension pack selection
  const [selectedPack, setSelectedPack] = useState<PackKey>("construction");
  const [packDropdownOpen, setPackDropdownOpen] = useState(false);

  // Extension toggles (keyed by item id)
  const [extensionEnabled, setExtensionEnabled] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    Object.values(EXTENSION_PACKS).forEach(({ groups }) => {
      groups.forEach(({ items }) => {
        items.forEach(({ id }) => { initial[id] = true; });
      });
    });
    return initial;
  });

  // Advanced toggles
  const [advancedEnabled, setAdvancedEnabled] = useState<Record<string, boolean>>({
    custom_fields: true,
    etiquetas: false,
    automatizaciones: false,
  });

  const toggleExtension = (id: string) => {
    setExtensionEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const toggleAdvanced = (id: string) => {
    setAdvancedEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const currentPack = EXTENSION_PACKS[selectedPack];

  return (
    <SidebarCollapseContext.Provider value={{ collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed }}>
      <CopilotCollapseContext.Provider value={{ copilotCollapsed, setCopilotCollapsed }}>
        <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAFC] font-sans overflow-x-hidden">
          <SidebarNav />
          <MobileSidebarNav />

          {/* ── Main ── */}
          <main className="flex-1 min-w-0 overflow-y-auto">

            {/* Header */}
            <div className="px-4 md:px-8 pt-7 pb-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-1">
                  Sistema
                </p>
                <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight">
                  Gestión del sistema
                </h1>
                <p className="text-sm text-[#64748B] mt-1">
                  Configuración de módulos y capacidades del workspace activo
                </p>
                <p className="text-xs text-[#94A3B8] mt-1.5">
                  Activa o desactiva capacidades según el tipo de empresa o vertical.
                </p>
              </div>
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0F172A] text-white text-sm font-medium hover:bg-[#1E293B] transition-colors shadow-sm shrink-0 self-start sm:self-auto">
                <Save size={14} strokeWidth={1.75} />
                Guardar configuración
              </button>
            </div>

            {/* Body */}
            <div className="px-4 md:px-8 py-8 space-y-10">

              {/* ── SECCIÓN 1: Core del sistema ── */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-widest">
                    Core del sistema
                  </h2>
                  <span className="text-[10px] text-[#94A3B8] font-medium">
                    Siempre activo
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 bg-[#EFF6FF] border-b border-[#DBEAFE]">
                    <p className="text-xs text-[#1D4ED8] font-medium">
                      Estas capacidades son la base del sistema y no pueden desactivarse.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#F1F5F9]">
                    {CORE_CAPABILITIES.map((group) => (
                      <div key={group.section}>
                        <div className="px-5 py-2.5 border-b border-[#F1F5F9] bg-[#FAFAFA]">
                          <span className={`text-[11px] font-bold uppercase tracking-widest ${SECTION_COLOR[group.section] ?? "text-[#334155]"}`}>
                            {group.section}
                          </span>
                        </div>
                        <div className="divide-y divide-[#F1F5F9]">
                          {group.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between py-3 px-5 hover:bg-[#F8FAFC] transition-colors">
                              <span className="text-sm font-medium text-[#334155]">{item.label}</span>
                              <div className="flex items-center gap-1.5">
                                <ToggleRight size={20} className="text-[#3B82F6]" strokeWidth={1.5} />
                                <span className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide hidden sm:block">
                                  Base
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* ── SECCIÓN 2: Extensiones por vertical ── */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-widest">
                    Extensiones por vertical
                  </h2>
                </div>

                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                  {/* Pack selector */}
                  <div className="px-5 py-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">Vertical activa</p>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        Selecciona el pack de capacidades para tu tipo de empresa
                      </p>
                    </div>

                    {/* Dropdown */}
                    <div className="relative shrink-0">
                      <button
                        onClick={() => setPackDropdownOpen((v) => !v)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#BFDBFE] text-sm font-medium text-[#0F172A] transition-colors min-w-[180px] justify-between"
                      >
                        {currentPack.label}
                        <ChevronDown
                          size={14}
                          strokeWidth={2}
                          className={`text-[#64748B] transition-transform duration-200 ${packDropdownOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      {packDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setPackDropdownOpen(false)}
                          />
                          <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-[#E2E8F0] rounded-xl shadow-lg z-20 overflow-hidden">
                            {(Object.keys(EXTENSION_PACKS) as PackKey[]).map((key) => (
                              <button
                                key={key}
                                onClick={() => {
                                  setSelectedPack(key);
                                  setPackDropdownOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 text-sm hover:bg-[#EFF6FF] transition-colors ${
                                  selectedPack === key
                                    ? "bg-[#EFF6FF] text-[#1D4ED8] font-medium"
                                    : "text-[#334155]"
                                }`}
                              >
                                {EXTENSION_PACKS[key].label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Extension groups */}
                  {currentPack.groups.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                      <p className="text-sm text-[#94A3B8]">
                        El pack estándar no incluye extensiones adicionales.
                      </p>
                      <p className="text-xs text-[#CBD5E1] mt-1">
                        Selecciona un pack vertical para ver sus capacidades.
                      </p>
                    </div>
                  ) : (
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {currentPack.groups.map((group) => (
                        <CapabilityGroupBlock
                          key={group.section}
                          group={group}
                          enabledMap={extensionEnabled}
                          onToggle={toggleExtension}
                          bgClass="bg-[#F8FAFC]"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* ── SECCIÓN 3: Personalización avanzada ── */}
              <section>
                <div className="mb-4">
                  <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-widest">
                    Personalización avanzada
                  </h2>
                </div>

                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden max-w-lg">
                  <div className="divide-y divide-[#F1F5F9]">
                    {ADVANCED_ITEMS.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-3.5 px-5 hover:bg-[#F8FAFC] transition-colors"
                      >
                        <span className={`text-sm ${advancedEnabled[item.id] ? "text-[#334155] font-medium" : "text-[#94A3B8]"}`}>
                          {item.label}
                        </span>
                        <Toggle
                          enabled={advancedEnabled[item.id] ?? false}
                          onToggle={() => toggleAdvanced(item.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* ── Bottom save bar (mobile sticky) ── */}
              <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30 px-4 py-3 bg-white border-t border-[#E2E8F0] shadow-lg">
                <button className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#0F172A] text-white text-sm font-medium hover:bg-[#1E293B] transition-colors">
                  <Save size={14} strokeWidth={1.75} />
                  Guardar configuración
                </button>
              </div>

            </div>
          </main>

          {/* Copilot Panel */}
          <CopilotPanel defaultContext="Foresight" />
        </div>
      </CopilotCollapseContext.Provider>
    </SidebarCollapseContext.Provider>
  );
}

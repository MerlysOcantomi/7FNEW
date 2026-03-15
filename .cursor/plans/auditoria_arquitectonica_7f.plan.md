---
name: auditoría arquitectónica 7f
overview: Diagnóstico completo del estado actual del repositorio 7F — inventario, clasificación tentativa, dependencias y observaciones arquitectónicas para preparar la transición hacia una arquitectura modular con core, engines, modules, tools, verticals, agents y apps independientes.
todos:
  - id: inventario
    content: Inventario completo del repositorio (estructura, archivos, modelos, rutas)
    status: completed
  - id: clasificacion
    content: Clasificación tentativa de cada área en core / modules / tools / infra / mixed
    status: completed
  - id: dependencias
    content: Mapa de dependencias entre capas y módulos
    status: completed
  - id: observaciones
    content: Observaciones arquitectónicas y áreas de responsabilidad mezclada
    status: completed
  - id: engines
    content: Identificación de candidatos a engines futuros
    status: completed
  - id: roadmap
    content: Recomendaciones para la transición modular (sin mover código todavía)
    status: pending
isProject: false
---

# Auditoría Arquitectónica — 7F

## 1. Resumen ejecutivo

| Dimensión | Valor |
|-----------|-------|
| Framework | Next.js (App Router) |
| Lenguaje | TypeScript |
| Base de datos | Prisma + SQLite (dev) / Turso (prod) |
| UI | shadcn/ui (Radix) + Tailwind CSS 4 |
| Auth | JWT (doble sesión: usuarios + portal cliente) |
| IA | OpenAI GPT-4.1 + DeepSeek Reasoner |
| Multi-tenancy | Workspace por organización |
| Archivos totales | ~342 |
| Modelos Prisma | ~38 |
| Rutas API | ~75 endpoints |
| Páginas | ~35 rutas |

---

## 2. Inventario del repositorio

### 2.1 Estructura de directorios

```
7f/
├── app/                    # ~140 archivos — Next.js App Router
│   ├── api/                # Rutas API (~75 endpoints)
│   ├── cliente/            # Portal de clientes (login, dashboard, proyectos, facturas)
│   └── [módulos internos]/ # ~25 secciones de la app interna
├── components/             # ~115 archivos — Componentes React
│   ├── forms/              # 9 formularios por entidad
│   ├── templates/          # 3 templates PDF (Skina)
│   └── ui/                 # ~55 componentes shadcn/ui
├── lib/                    # ~63 archivos — Lógica de negocio y servicios
│   ├── agent/              # Agente IA (tools, executor, prompts)
│   ├── ai/                 # Motor IA (GPT, DeepSeek, modos)
│   ├── auth/               # Autenticación y RBAC
│   ├── automations/        # Automatizaciones (tareas, proyectos, facturas)
│   ├── export/             # Exportación CSV
│   └── modules/            # 13 módulos de negocio (service + validation)
├── hooks/                  # 5 hooks React
├── prisma/                 # Schema, seed, push
├── scripts/                # 1 script de mantenimiento
├── styles/                 # 1 archivo CSS global
└── [config raíz]           # ~13 archivos de configuración
```

### 2.2 Conteo por extensión

| Extensión | Cantidad |
|-----------|----------|
| `.ts` | ~169 |
| `.tsx` | ~159 |
| `.json` | 4 |
| `.css` | 2 |
| `.mjs` | 2 |
| `.prisma` | 1 |
| `.sql` | 1 |
| **Total** | **~342** |

### 2.3 Modelos Prisma (38 modelos)

| Dominio | Modelos |
|---------|---------|
| Multi-tenancy | Workspace, WorkspaceMember, Vertical |
| Auth/Usuarios | User, Usuario, AllowedEmail |
| CRM | Cliente, ClientAuth, ClientProject, ClientInvoice, ClientFile, ClientAsset, ClientRequest, ClientRequestAsset |
| Proyectos | Proyecto, Tarea |
| Finanzas | Transaccion, Factura |
| Documentos | Documento, Attachment |
| Calendario | Evento |
| Notas | Nota |
| Automatización | Automatizacion |
| Inbox/Conversaciones | Contact, Conversation, Message, InboxEntry, ConversationAction, AIClassification, ConversationHandoff, ConversationDraft |
| Contenido/Marketing | Campaign, ContentPiece, ContentIdea |
| Sistema | Notification, Activity, QRCode |

---

## 3. Clasificación tentativa

### 3.1 CORE — Infraestructura esencial del sistema

Componentes que cualquier módulo, engine o app necesita para funcionar.

| Archivo/Carpeta | Responsabilidad |
|-----------------|-----------------|
| `lib/db.ts` | Cliente Prisma (acceso a datos) |
| `lib/api.ts` | Respuestas API estandarizadas, manejo de errores |
| `lib/utils.ts` | Utilidad CSS (`cn`) |
| `lib/auth/session.ts` | Sesión JWT de usuarios |
| `lib/auth/client-session.ts` | Sesión JWT de clientes |
| `lib/auth/password.ts` | Hash y verificación de contraseñas |
| `lib/auth/google.ts` | OAuth Google |
| `lib/auth/permissions.ts` | Roles y rutas protegidas |
| `lib/auth/workspace-auth.ts` | RBAC por workspace |
| `lib/workspace.ts` | Gestión de workspaces |
| `lib/workspace-context.ts` | Resolución del workspace activo |
| `lib/verticals.ts` | Configuración de verticales |
| `lib/activity.ts` | Log de actividad |
| `lib/notifications.ts` | Sistema de notificaciones |
| `lib/storage.ts` | Almacenamiento (Vercel Blob) |
| `middleware.ts` | Middleware de autenticación y routing |
| `prisma/schema.prisma` | Modelos de datos |
| `app/layout.tsx` | Layout raíz con providers |

### 3.2 MODULES — Módulos de negocio verticales

Cada uno encapsula CRUD + validación para una entidad.

| Módulo | Archivos | Patrón |
|--------|----------|--------|
| `lib/modules/clientes/` | service.ts, validation.ts | CRUD + Zod |
| `lib/modules/proyectos/` | service.ts, validation.ts | CRUD + Zod |
| `lib/modules/tareas/` | service.ts, validation.ts | CRUD + Zod |
| `lib/modules/facturacion/` | service.ts, validation.ts | CRUD + Zod |
| `lib/modules/finanzas/` | service.ts, validation.ts | CRUD + Zod |
| `lib/modules/calendario/` | service.ts, validation.ts | CRUD + Zod |
| `lib/modules/contenido/` | service.ts, validation.ts | CRUD + Zod |
| `lib/modules/notas/` | service.ts, validation.ts | CRUD + Zod |
| `lib/modules/documentos/` | service.ts, validation.ts | CRUD + Zod |
| `lib/modules/campanas/` | service.ts, validation.ts | CRUD + Zod |
| `lib/modules/usuarios/` | service.ts, validation.ts | CRUD + Zod |
| `lib/modules/automatizaciones/` | service.ts, validation.ts | CRUD + Zod |
| `lib/modules/inbox/` | service.ts, state.ts, intelligence.ts | CRUD + FSM + IA ⚠️ |

### 3.3 TOOLS — Utilidades independientes reutilizables

| Archivo | Función |
|---------|---------|
| `lib/qr.ts` | Generación de QR codes |
| `lib/ocr.ts` | OCR (Tesseract + pdf-parse) |
| `lib/scan.ts` | Análisis de documentos con IA |
| `lib/export/csv.ts` | Exportación CSV |
| `lib/api-client.ts` | Cliente HTTP para el frontend |
| `lib/project-access.ts` | Control de acceso a proyectos |

### 3.4 INFRA — Configuración y despliegue

| Archivo | Función |
|---------|---------|
| `next.config.mjs` | Configuración Next.js |
| `tsconfig.json` | Configuración TypeScript |
| `postcss.config.mjs` | PostCSS / Tailwind |
| `prisma.config.ts` | Configuración Prisma |
| `components.json` | Configuración shadcn/ui |
| `package.json` | Dependencias |
| `.env` | Variables de entorno |
| `prisma/seed.ts` | Seed de BD |
| `prisma/push-turso.ts` | Push a producción |
| `scripts/checkTables.ts` | Verificación de tablas |

### 3.5 ENGINES (candidatos) — Sistemas complejos con lógica propia

| Candidato | Archivos actuales | Por qué es un engine |
|-----------|-------------------|----------------------|
| **AI Engine** | `lib/ai/`, `lib/openai.ts`, `lib/aiModes.ts` | Enrutamiento multi-modelo, modos, prompts, historial |
| **Agent Engine** | `lib/agent/` | System prompt, tools, executor, function calling |
| **Inbox Engine** | `lib/modules/inbox/`, `lib/inbox.ts` | FSM, pipeline IA, clasificación, handoff, drafts, acciones |
| **Automation Engine** | `lib/automations/` | Detección de retrasos, sugerencias, recordatorios |
| **Scan/OCR Engine** | `lib/ocr.ts`, `lib/scan.ts` | Pipeline de procesamiento de documentos |

### 3.6 MIXED / UNCLEAR — Áreas con responsabilidades mezcladas

| Área | Problema |
|------|----------|
| `lib/aiModes.ts` vs `lib/ai/index.ts` | Modos de IA divididos entre raíz y subcarpeta |
| `lib/openai.ts` vs `lib/ai/gpt.ts` | Dos wrappers de OpenAI en ubicaciones distintas |
| `lib/inbox.ts` vs `lib/modules/inbox/` | Lógica de inbox dividida entre raíz y módulo |
| `lib/scan.ts` + `lib/ocr.ts` | Tools sueltos que pertenecen a un engine de procesamiento |
| `components/` raíz | Mezcla de componentes compartidos, específicos de módulo y de layout |
| Modelos `Usuario` vs `User` | Dos modelos para representar usuarios con solapamiento |
| Modelos `ClientProject` vs `Proyecto` | Duplicación conceptual entre portal y app interna |

---

## 4. Mapa de dependencias

### 4.1 Grafo de dependencias (lib/)

```
                    ┌─────────────────────────┐
                    │      db.ts (Prisma)      │
                    └─────────┬───────────────┘
                              │
              ┌───────────────┼───────────────────────────┐
              │               │                           │
        ┌─────▼─────┐  ┌─────▼─────┐              ┌──────▼──────┐
        │ workspace  │  │ verticals │              │notifications│
        └─────┬─────┘  └───────────┘              └─────────────┘
              │
     ┌────────┼────────────┐
     │        │            │
┌────▼────┐ ┌─▼──────────┐│
│ws-context│ │ws-auth     ││
└────┬────┘ └─┬──────────┘│
     │        │            │
     │   ┌────▼────┐      │
     └──►│ session  │      │
         └─────────┘      │
                          │
    ┌─────────────────────┼──────────────────┐
    │                     │                  │
┌───▼───┐          ┌─────▼─────┐     ┌──────▼──────┐
│modules │          │automations│     │   activity   │
│ (×13)  │          │           │     └─────────────┘
└───┬───┘          └─────┬─────┘
    │                    │
    │              ┌─────▼─────┐
    │              │  ai/index │
    │              └─────┬─────┘
    │           ┌────────┼────────┐
    │     ┌─────▼───┐ ┌──▼────┐  │
    │     │ openai  │ │deepseek│  │
    │     └─────────┘ └───────┘  │
    │                      ┌─────▼─────┐
    │                      │  aiModes   │
    │                      └───────────┘
    │
    │  ┌──────────────┐
    └──► inbox module  ├──► lib/inbox.ts ──► ai/index
       └──────┬───────┘
              ├──► inbox/state.ts (FSM)
              └──► inbox/intelligence.ts ──► lib/inbox.ts

    ┌───────────────┐
    │  agent/       │
    ├── executor ───┤──► db, image-generator
    ├── tools       │
    ├── system-prompt│
    └── image-gen ──┘──► storage
```

### 4.2 Nodos centrales (alto acoplamiento)

| Nodo | Dependientes directos |
|------|-----------------------|
| `db.ts` | Todos los services, workspace, activity, notifications, agent/executor, automations |
| `ai/index.ts` | inbox, scan, automations (×3) |
| `auth/session.ts` | workspace-context, workspace-auth, activity |
| `workspace.ts` | workspace-auth, automations (×3) |

---

## 5. Observaciones arquitectónicas

### 5.1 Fortalezas

1. **Separación frontend/backend limpia**: las páginas nunca acceden a la BD directamente; todo pasa por API routes.
2. **Patrón consistente en módulos**: 12 de 13 módulos siguen `service.ts` + `validation.ts` (CRUD + Zod).
3. **Multi-tenancy implementado**: `workspaceId` presente en la mayoría de modelos y filtrado en queries.
4. **RBAC funcional**: sistema de roles por workspace (OWNER/ADMIN/MEMBER/VIEWER) con helpers reutilizables.
5. **Doble sesión**: separación clara entre sesión de usuarios internos y portal de clientes.
6. **Enrutamiento IA multi-modelo**: capacidad de dirigir a GPT o DeepSeek según el modo.

### 5.2 Problemas detectados

#### P1 — Lógica de negocio en API routes

Hay ~15 API routes con lógica de negocio embebida directamente en el handler en lugar de delegarla a `lib/`:

- `/api/search` — búsqueda multi-entidad
- `/api/dashboard/summary` — KPIs y agregaciones
- `/api/requests` — CRUD de solicitudes
- `/api/notifications` — filtrado y paginación
- `/api/admin/users` — gestión de usuarios
- `/api/admin/allowed-emails` — whitelist de emails
- `/api/cliente/*` (8+ rutas) — todo el portal de clientes usa Prisma directo
- `/api/auth/callback/google` — flujo OAuth completo
- `/api/attachments` — subida y escaneo
- `/api/inbox` — construcción de queries complejas

**Impacto**: estas funciones no son reutilizables por el agente, automations ni engines futuros.

#### P2 — Archivos de lib/ raíz que deberían estar agrupados

Archivos sueltos en `lib/` que pertenecen a dominios claros:

| Archivo suelto | Dominio natural |
|----------------|-----------------|
| `openai.ts` | `ai/` |
| `aiModes.ts` | `ai/` |
| `inbox.ts` | `modules/inbox/` o `engines/inbox/` |
| `scan.ts` | `tools/` o `engines/document-processing/` |
| `ocr.ts` | `tools/` o `engines/document-processing/` |
| `qr.ts` | `tools/` |
| `project-access.ts` | `modules/proyectos/` o `auth/` |

#### P3 — Modelo de datos con duplicidades

- **`Usuario` vs `User`**: dos modelos para usuarios. `Usuario` parece legacy (tiene `departamento`, `estado`, `tareas`). `User` es el modelo real de auth. Ambos coexisten.
- **`ClientProject` vs `Proyecto`**: el portal de clientes tiene su propio modelo de proyecto separado del principal.
- **`ClientInvoice` vs `Factura`**: mismo caso para facturas.
- **`ContentPiece.clienteId` / `ContentPiece.proyectoId`**: FKs sin relaciones en el schema — Prisma no las modela.
- **`AllowedEmail`**: sin relación con Workspace — no queda claro si es whitelist global o por tenant.

#### P4 — Inbox como módulo sobredimensionado

`lib/modules/inbox/` contiene:
- CRUD de conversaciones y contactos (service.ts)
- Máquina de estados (state.ts)
- Pipeline de IA: clasificación, scoring, handoff, drafts, acciones sugeridas (intelligence.ts)
- Conversión a entidades CRM

Esto es un **engine**, no un módulo. Es el único módulo que rompe el patrón `service + validation`.

#### P5 — Componentes sin organización por dominio

`components/` tiene ~50 archivos en la raíz mezclando:
- Layout/navegación: `app-shell`, `app-sidebar`, `sidebar-nav`, `context-shell`, `section-page`
- Específicos de clientes: `client-tabs`, `client-billing-tab`, `client-documents-tab`, `client-portal-access`, `client-portal-shell`
- Específicos de contenido: `content-list`, `content-calendar`, `content-ideas`, `content-ai`
- Específicos de proyectos: `project-tabs`, `project-review-tab`
- Utilidades compartidas: `confirm-modal`, `empty-state`, `inline-edit`, `role-gate`
- Notificaciones: `notifications-bell`, `notifications-panel`
- QR: `qr-code-modal`, `saved-qr-codes`

No hay agrupación por módulo/dominio.

#### P6 — Respuestas API inconsistentes

Algunas rutas usan `successResponse`/`errorResponse` de `lib/api.ts`, otras devuelven `NextResponse.json` directo (particularmente las rutas de `/api/cliente/*`).

#### P7 — Agent executor sin filtro de workspace

El executor del agente (`lib/agent/executor.ts`) opera sobre toda la BD sin filtrar por `workspaceId`. El workspace se resuelve en la capa API, pero si el agente se ejecutara fuera de ese contexto, no habría aislamiento de tenant.

#### P8 — Sin loading/error boundaries

No existe ningún `loading.tsx` ni `error.tsx` en ninguna ruta del proyecto.

#### P9 — Escaneo fire-and-forget

El escaneo de attachments (`runScanInBackground`) usa un IIFE async sin cola, reintentos ni monitoreo.

---

## 6. Candidatos a engines futuros

### Engine 1: AI Engine (`lib/ai/` + `lib/openai.ts` + `lib/aiModes.ts`)

**Estado actual**: distribuido entre `lib/ai/index.ts`, `lib/ai/gpt.ts`, `lib/ai/deepseek.ts`, `lib/openai.ts` y `lib/aiModes.ts`.

**Responsabilidades**:
- Enrutamiento multi-modelo (GPT vs DeepSeek)
- 7 modos de IA con prompts y parámetros
- Prompts específicos por dominio (tareas, proyectos, clientes, finanzas, facturas)
- Chat con historial

**Para ser engine**: unificar los archivos dispersos, definir una interfaz de registro de proveedores, permitir registrar modos y prompts desde módulos externos.

### Engine 2: Agent Engine (`lib/agent/`)

**Estado actual**: system prompt, definiciones de tools, executor.

**Responsabilidades**:
- Prompt del agente híbrido (7F–Skina)
- 10 herramientas (lectura, escritura, generación)
- Ejecución de function calls contra BD y APIs

**Para ser engine**: las tools deberían ser registrables por módulo (cada módulo registra sus propias tools). El executor necesita contexto de workspace. El system prompt debería ser composable.

### Engine 3: Inbox/Conversation Engine (`lib/modules/inbox/` + `lib/inbox.ts`)

**Estado actual**: el módulo más complejo, con FSM, pipeline IA, y conversión a CRM.

**Responsabilidades**:
- Máquina de estados de conversación
- Pipeline IA (clasificación, scoring, handoff, drafts, acciones)
- Gestión de contactos
- Conversión a entidades CRM
- Multi-canal (preparado pero no implementado)

**Para ser engine**: separar la FSM, el pipeline IA y la conversión como capas independientes.

### Engine 4: Automation Engine (`lib/automations/`)

**Estado actual**: 3 archivos con detección de retrasos, bloqueos y vencimientos.

**Responsabilidades**:
- Detección de condiciones (retrasos, bloqueos, vencimientos)
- Generación de sugerencias y recordatorios
- Dependencia de IA para análisis

**Para ser engine**: definir un sistema de triggers y acciones registrables, con scheduler y cola.

### Engine 5: Document Processing Engine (`lib/ocr.ts` + `lib/scan.ts`)

**Estado actual**: dos archivos sueltos.

**Responsabilidades**:
- OCR con Tesseract
- Parsing de PDFs
- Análisis con IA (tipo, fecha, total, entidad, tags)

**Para ser engine**: unificar en un pipeline con etapas (extracción → análisis → clasificación), con soporte para nuevos procesadores.

---

## 7. Mapa de preparación para Mr Forte (orquestador)

### 7.1 Qué necesita Mr Forte para descubrir y activar módulos

Para que un orquestador pueda descubrir módulos automáticamente, cada módulo/engine/tool necesita:

1. **Manifest**: archivo de declaración con metadata (nombre, versión, dependencias, capabilities)
2. **Registry**: punto central donde los módulos se registran al inicializarse
3. **Interfaz estándar**: contrato que todos los módulos implementan (service interface)
4. **Hooks de ciclo de vida**: `onRegister`, `onActivate`, `onDeactivate`
5. **Declaración de tools**: qué herramientas expone para el agente
6. **Declaración de rutas**: qué endpoints API registra

### 7.2 Estado actual vs requerido

| Aspecto | Estado actual | Requerido |
|---------|---------------|-----------|
| Patrón de módulos | Consistente (service + validation) pero implícito | Manifest + auto-registro |
| Descubrimiento | Manual (imports explícitos) | Automático (scan de carpetas o registry) |
| Tools del agente | Hardcoded en `agent/tools.ts` | Declaradas por cada módulo |
| Rutas API | Una carpeta por entidad en `app/api/` | Registrables dinámicamente o por convención |
| Configuración por workspace | `workspace.config` (JSON) | Manifest de módulos habilitados |
| Verticales | `verticals.ts` con config por vertical | Cada vertical declara qué módulos activa |

### 7.3 Módulos listos vs no listos

| Módulo | Patrón estándar | Separación limpia | Listo para registry |
|--------|-----------------|-------------------|---------------------|
| clientes | ✅ | ✅ | 🟡 Falta manifest |
| proyectos | ✅ | ✅ | 🟡 Falta manifest |
| tareas | ✅ | ✅ | 🟡 Falta manifest |
| facturacion | ✅ | ✅ | 🟡 Falta manifest |
| finanzas | ✅ | ✅ | 🟡 Falta manifest |
| calendario | ✅ | ✅ | 🟡 Falta manifest |
| contenido | ✅ | ✅ | 🟡 Falta manifest |
| notas | ✅ | ✅ | 🟡 Falta manifest |
| documentos | ✅ | ✅ | 🟡 Falta manifest |
| campanas | ✅ | ✅ | 🟡 Falta manifest |
| usuarios | ✅ | ✅ | 🟡 Falta manifest |
| automatizaciones | ✅ | ✅ | 🟡 Falta manifest |
| inbox | ❌ Sobre-dimensionado | ❌ Mezclado | ❌ Necesita refactor a engine |

---

## 8. Resumen de hallazgos

### Lo que funciona bien
- Estructura base sólida con Next.js App Router
- Patrón CRUD consistente en 12/13 módulos
- Multi-tenancy implementado
- Separación frontend/backend limpia
- RBAC funcional por workspace
- Sistema de verticales configurable

### Lo que necesita atención antes de modularizar
1. Extraer lógica de negocio de ~15 API routes a `lib/`
2. Consolidar archivos sueltos de `lib/` raíz en sus dominios
3. Resolver la duplicidad `Usuario` vs `User`
4. Separar inbox en un engine propio
5. Organizar `components/` por dominio
6. Unificar formato de respuestas API
7. Agregar contexto de workspace al agent executor
8. Diseñar e implementar sistema de manifests para módulos
9. Crear registry de módulos para descubrimiento automático
10. Definir interfaces estándar (Module, Engine, Tool, Vertical)

### Estructura objetivo (referencia, sin implementar aún)

```
7f/
├── core/                   # Auth, DB, workspace, activity, notifications
│   ├── auth/
│   ├── db/
│   ├── workspace/
│   └── registry/           # Module/engine/tool registry
├── engines/                # Sistemas complejos con lógica propia
│   ├── ai/                 # Motor IA multi-modelo
│   ├── agent/              # Agente con tools registrables
│   ├── inbox/              # Conversaciones, FSM, pipeline IA
│   ├── automation/         # Triggers, condiciones, acciones
│   └── document-processing/# OCR, scan, análisis
├── modules/                # Módulos de negocio (CRUD + validation + manifest)
│   ├── clientes/
│   ├── proyectos/
│   ├── tareas/
│   ├── facturacion/
│   ├── finanzas/
│   ├── calendario/
│   ├── contenido/
│   ├── campanas/
│   ├── notas/
│   ├── documentos/
│   ├── usuarios/
│   └── automatizaciones/
├── tools/                  # Utilidades independientes
│   ├── qr/
│   ├── ocr/
│   ├── csv-export/
│   └── scan/
├── verticals/              # Configuraciones por vertical
├── agents/                 # Agentes especializados (Mr Forte, Skina, etc.)
├── apps/                   # Apps independientes
│   ├── portal-cliente/
│   └── admin/
├── components/             # UI compartida y por dominio
│   ├── shared/
│   ├── layout/
│   └── ui/
└── app/                    # Next.js App Router (thin layer)
```

---

*Diagnóstico generado el 15 de marzo de 2026. No se movió ni modificó código.*

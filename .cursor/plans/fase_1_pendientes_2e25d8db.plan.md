---
name: fase 1 pendientes
overview: Mapa completo de lo que falta por migrar en Fase 1, clasificado por riesgo, con separacion clara entre refactor estructural y desarrollo de producto.
todos:
  - id: step-c
    content: "Paso C: migrar lib/activity.ts a core/activity.ts"
    status: pending
  - id: step-d
    content: "Paso D: migrar lib/verticals.ts a core/verticals.ts"
    status: pending
  - id: step-e
    content: "Paso E: migrar lib/workspace-context.ts a core/workspace-context.ts"
    status: pending
  - id: step-f
    content: "Paso F: migrar lib/workspace.ts a core/workspace.ts"
    status: pending
  - id: step-g
    content: "Paso G: migrar lib/auth/portal-context.ts a core/auth/portal-context.ts"
    status: pending
  - id: step-h
    content: "Paso H: migrar lib/auth/workspace-auth.ts a core/auth/workspace-auth.ts"
    status: pending
isProject: false
---

# Fase 1 — Informe de pendientes y plan de cierre

## 1. Resumen ejecutivo

### Ya hecho (8 archivos migrados a core/)

- `core/db.ts`, `core/utils.ts`, `core/api.ts`, `core/storage.ts`, `core/notifications.ts`
- `core/auth/session.ts`, `core/auth/client-session.ts`, `core/auth/password.ts`
- Todos con re-export bridge en `lib/`
- 0 regresiones

### Falta para cerrar Fase 1 (6 archivos de core restantes)

- `activity.ts`, `verticals.ts`, `workspace-context.ts`, `workspace.ts`
- `auth/portal-context.ts`, `auth/workspace-auth.ts`

### Fuera de Fase 1 (no tocar ahora)

- 26 archivos de lib/modules/ (Fase 2 — modules)
- 8 archivos de lib/ai/ + lib/agent/ (Fase 3 — engines)
- 4 archivos de lib/automations/ (Fase 3 — engines)
- 5 archivos de tools sueltos (Fase 4 — tools)
- 2 archivos de codigo muerto
- 3 archivos de inbox engine (futuro)

---

## 2. Inventario completo — 55 archivos con codigo real en lib/

### Estado actual del repo

```
lib/ (63 archivos)
├── 8 re-export bridges (ya migrados) ✅
└── 55 archivos con codigo real:
    ├── 6 → core/ (pendientes de Fase 1)
    ├── 26 → modules/ (Fase 2)
    ├── 12 → engines/ (Fase 3)
    ├── 5 → tools/ (Fase 4)
    ├── 3 → decision pendiente
    ├── 2 → codigo muerto
    └── 1 → integracion desactivada
```

---

## 3. Clasificacion por grupo de riesgo

### Grupo A — Leaf nodes seguros (migrar ya)


| Archivo                    | Deps de lib/                       | Consumidores | Destino                     | Riesgo |
| -------------------------- | ---------------------------------- | ------------ | --------------------------- | ------ |
| `lib/activity.ts`          | db (bridge), auth/session (bridge) | 11           | `core/activity.ts`          | Nulo   |
| `lib/verticals.ts`         | db (bridge)                        | 4            | `core/verticals.ts`         | Nulo   |
| `lib/workspace-context.ts` | auth/session (bridge), db (bridge) | 4            | `core/workspace-context.ts` | Nulo   |


Todas sus dependencias de lib/ ya son bridges. Movimiento mecanico identico a los 8 anteriores.

### Grupo B — Near-leaf / riesgo bajo (migrar despues del grupo A)


| Archivo                      | Deps de lib/                                            | Consumidores | Destino                       | Riesgo |
| ---------------------------- | ------------------------------------------------------- | ------------ | ----------------------------- | ------ |
| `lib/workspace.ts`           | db (bridge), `verticals`                                | 11           | `core/workspace.ts`           | Bajo   |
| `lib/auth/portal-context.ts` | db (bridge), auth/client-session (bridge)               | 9            | `core/auth/portal-context.ts` | Bajo   |
| `lib/auth/workspace-auth.ts` | auth/session (bridge), `workspace-context`, `workspace` | **63**       | `core/auth/workspace-auth.ts` | Bajo   |


`workspace.ts` importa de `@/lib/verticals` — si verticals ya se migro con bridge, funciona sin cambios.
`workspace-auth.ts` importa de `@/lib/workspace-context` y `@/lib/workspace` — si ambos ya tienen bridge, funciona sin cambios.

**Patron clave**: como NO cambiamos los imports internos del archivo migrado, el orden no importa estrictamente. Pero mover las dependencias primero (grupo A) es mas limpio conceptualmente.

### Grupo C — No tocar en Fase 1 (clasificacion correcta pero fuera de scope)

**Candidatos a engines/ (Fase 3)**:


| Archivo                        | Deps de lib/                 | Consumidores | Destino futuro        |
| ------------------------------ | ---------------------------- | ------------ | --------------------- |
| `lib/openai.ts`                | ninguna                      | 1            | `engines/ai/`         |
| `lib/aiModes.ts`               | ninguna                      | 1            | `engines/ai/`         |
| `lib/ai/deepseek.ts`           | ninguna                      | 1            | `engines/ai/`         |
| `lib/ai/gpt.ts`                | ninguna                      | 0 directo    | `engines/ai/`         |
| `lib/ai/index.ts`              | deepseek, openai, aiModes    | 11           | `engines/ai/`         |
| `lib/agent/system-prompt.ts`   | ninguna                      | 1            | `engines/agent/`      |
| `lib/agent/tools.ts`           | ninguna                      | 1            | `engines/agent/`      |
| `lib/agent/image-generator.ts` | storage (bridge)             | 1            | `engines/agent/`      |
| `lib/agent/executor.ts`        | db (bridge), image-generator | 1            | `engines/agent/`      |
| `lib/automations/tasks.ts`     | db, ai, workspace            | 1            | `engines/automation/` |
| `lib/automations/projects.ts`  | db, ai, workspace            | 1            | `engines/automation/` |
| `lib/automations/invoices.ts`  | db, ai, workspace            | 1            | `engines/automation/` |


**Candidatos a tools/ (Fase 4)**:


| Archivo             | Deps de lib/  | Consumidores | Destino futuro                      |
| ------------------- | ------------- | ------------ | ----------------------------------- |
| `lib/qr.ts`         | ninguna       | 2            | `tools/qr/`                         |
| `lib/ocr.ts`        | ninguna       | 2            | `tools/`                            |
| `lib/scan.ts`       | ai (relativo) | 2            | `tools/` o `engines/`               |
| `lib/export/csv.ts` | ninguna       | 2            | `tools/csv-export/`                 |
| `lib/api-client.ts` | ninguna       | 22           | `tools/` o `lib/` (frontend helper) |


**Modulos de negocio (Fase 2 — todos siguen patron service + validation)**:

12 modulos x 2 archivos = 24 archivos + 2 del barrel de automations = 26 archivos.
Todos dependen solo de `@/lib/db` (bridge). Se migran en bloque a `modules/` cuando toque.

### Grupo D — No tocar / requiere decision previa


| Archivo                             | Razon                                                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `lib/modules/inbox/service.ts`      | Motor del Smart Inbox. Mezcla CRUD + FSM + conversion CRM. Requiere refactor de dominio, no simple movimiento. |
| `lib/modules/inbox/intelligence.ts` | Pipeline IA del inbox. Depende de inbox, state. Acoplado al dominio conversacional.                            |
| `lib/modules/inbox/state.ts`        | FSM de conversaciones. Leaf node puro, pero forma parte del engine inbox — moverlo solo no tiene sentido.      |
| `lib/inbox.ts`                      | Clasificacion IA. Import relativo a `./ai`. Parte del engine inbox.                                            |
| `lib/auth/google.ts`                | Integracion desactivada. 2 consumidores. Funciona pero no se ejecuta. Migrar cuando se reactive.               |
| `lib/auth/permissions.ts`           | **Codigo muerto. 0 consumidores.** Decidir: integrar o eliminar. No migrar.                                    |
| `lib/project-access.ts`             | **Codigo muerto. 0 consumidores.** Decidir: integrar o eliminar. No migrar.                                    |


---

## 4. Pasos restantes de Fase 1

### Paso C — activity.ts

- **Objetivo**: migrar activity a core
- **Archivos**: `lib/activity.ts` → `core/activity.ts`
- **Seguridad**: todas sus deps (db, auth/session) ya son bridges
- **Riesgo**: nulo
- **Precondiciones**: ninguna
- **Re-exports**: si, en `lib/activity.ts`
- **Consumidores**: no se tocan

### Paso D — verticals.ts

- **Objetivo**: migrar verticals a core
- **Archivos**: `lib/verticals.ts` → `core/verticals.ts`
- **Seguridad**: unica dep (db) ya es bridge
- **Riesgo**: nulo
- **Precondiciones**: ninguna
- **Re-exports**: si, en `lib/verticals.ts`
- **Consumidores**: no se tocan (4 consumidores, incluido workspace.ts)

### Paso E — workspace-context.ts

- **Objetivo**: migrar workspace-context a core
- **Archivos**: `lib/workspace-context.ts` → `core/workspace-context.ts`
- **Seguridad**: deps (auth/session, db) ambas bridges
- **Riesgo**: nulo
- **Precondiciones**: ninguna
- **Re-exports**: si, en `lib/workspace-context.ts`
- **Consumidores**: no se tocan (4 consumidores, incluido workspace-auth.ts)

### Paso F — workspace.ts

- **Objetivo**: migrar workspace a core
- **Archivos**: `lib/workspace.ts` → `core/workspace.ts`
- **Seguridad**: deps (db = bridge, verticals = bridge despues de paso D)
- **Riesgo**: nulo si paso D ya esta hecho, bajo si no (verticals.ts aun existe como archivo real)
- **Precondiciones**: paso D idealmente completado
- **Re-exports**: si, en `lib/workspace.ts`
- **Consumidores**: no se tocan (11 consumidores)

### Paso G — auth/portal-context.ts

- **Objetivo**: migrar portal-context a core/auth
- **Archivos**: `lib/auth/portal-context.ts` → `core/auth/portal-context.ts`
- **Seguridad**: deps (db = bridge, auth/client-session = bridge)
- **Riesgo**: nulo
- **Precondiciones**: ninguna
- **Re-exports**: si, en `lib/auth/portal-context.ts`
- **Consumidores**: no se tocan (9 consumidores)

### Paso H — auth/workspace-auth.ts

- **Objetivo**: migrar workspace-auth a core/auth. Este es el archivo mas importado de todo auth (63 consumidores).
- **Archivos**: `lib/auth/workspace-auth.ts` → `core/auth/workspace-auth.ts`
- **Seguridad**: deps (auth/session = bridge, workspace-context = bridge despues de paso E, workspace = bridge despues de paso F)
- **Riesgo**: bajo. El archivo migrado seguira importando de @/lib/ que seran bridges.
- **Precondiciones**: pasos E y F idealmente completados
- **Re-exports**: si, en `lib/auth/workspace-auth.ts`
- **Consumidores**: no se tocan (63 consumidores)

### Secuencia recomendada

```
Paso C: activity.ts          (leaf, 0 deps no-bridge)
Paso D: verticals.ts         (leaf, 0 deps no-bridge)
Paso E: workspace-context.ts (leaf, 0 deps no-bridge)
   ↓
Paso F: workspace.ts         (near-leaf, verticals ya sera bridge)
Paso G: portal-context.ts    (near-leaf, client-session ya es bridge)
   ↓
Paso H: workspace-auth.ts    (near-leaf, workspace + ws-context ya seran bridges)
```

Los pasos C, D, E son completamente independientes y podrian hacerse en cualquier orden o en un solo paso conjunto (todos son leaf nodes con 0 deps no-bridge). F depende idealmente de D. H depende idealmente de E y F.

---

## 5. Separacion: refactor estructural vs desarrollo de producto

### A. Refactor base estructural pendiente (NO cambia comportamiento)


| Tarea                                                 | Fase        | Esfuerzo            |
| ----------------------------------------------------- | ----------- | ------------------- |
| Migrar activity.ts a core/                            | Fase 1      | Trivial             |
| Migrar verticals.ts a core/                           | Fase 1      | Trivial             |
| Migrar workspace-context.ts a core/                   | Fase 1      | Trivial             |
| Migrar workspace.ts a core/                           | Fase 1      | Trivial             |
| Migrar portal-context.ts a core/auth/                 | Fase 1      | Trivial             |
| Migrar workspace-auth.ts a core/auth/                 | Fase 1      | Trivial             |
| Decidir sobre permissions.ts (eliminar o integrar)    | Post Fase 1 | Bajo                |
| Decidir sobre project-access.ts (eliminar o integrar) | Post Fase 1 | Bajo                |
| Migrar ai/ a engines/ai/                              | Fase 3      | Medio               |
| Migrar agent/ a engines/agent/                        | Fase 3      | Medio               |
| Migrar automations/ a engines/automation/             | Fase 3      | Medio               |
| Migrar qr, ocr, csv a tools/                          | Fase 4      | Bajo                |
| Migrar 12 modulos a modules/ con manifest             | Fase 2      | Medio-alto          |
| Actualizar consumidores de @/lib/ a @core/            | Fase final  | Alto (500+ imports) |
| Eliminar re-export bridges                            | Fase final  | Bajo                |


### B. Desarrollo funcional pendiente (SI cambia comportamiento)


| Tarea                                              | Area               | Tipo                |
| -------------------------------------------------- | ------------------ | ------------------- |
| Implementar canales reales (WhatsApp, email)       | Inbox              | Producto            |
| Async jobs / cola para escaneo y clasificacion     | Inbox, Attachments | Infra de producto   |
| Envio real de drafts                               | Inbox              | Producto            |
| Analytics / metricas de conversaciones             | Inbox              | Producto            |
| Memoria operativa persistente por contacto         | Inbox              | Producto            |
| Pipeline IA por etapas con gobernanza              | Inbox              | Producto            |
| Unificar Usuario vs User                           | Schema             | Rediseno de dominio |
| Unificar ClientProject vs Proyecto                 | Schema             | Rediseno de dominio |
| Corregir FKs huerfanas en ContentPiece             | Schema             | Rediseno de dominio |
| Extraer logica de negocio de ~15 API routes a lib/ | API                | Refactor funcional  |
| Proteger dev-login contra uso en produccion        | Auth               | Seguridad           |
| Implementar registry.discover() automatico         | Registry           | Producto            |
| Conectar Mr Forte con registry                     | Agent              | Producto            |
| Implementar loading.tsx / error.tsx                | UX                 | Producto            |


Estas tareas NO son refactor mecanico. Requieren decisiones de producto, cambios de schema, o nueva funcionalidad.

---

## 6. Conclusion

**Quedan exactamente 6 archivos para cerrar Fase 1** (migracion de infraestructura core). Todos siguen el mismo patron mecanico que los 8 ya migrados. El riesgo combinado es nulo si se respeta la secuencia C→D→E→F→G→H.

Despues de Fase 1, el directorio `core/` contendra **toda** la infraestructura transversal del sistema:

- DB, API, utils, storage
- Auth completo (session, client-session, password, portal-context, workspace-auth)
- Workspace completo (workspace, workspace-context, verticals)
- Activity, notifications
- Registry (ya presente)

Y `lib/` quedara solo con:

- Re-export bridges (14 total)
- Engines candidatos (ai, agent, automations, inbox)
- Modulos de negocio (12 modulos CRUD)
- Tools (qr, ocr, scan, csv, api-client)
- Codigo muerto (permissions, project-access)
- Integracion desactivada (google)

Eso es un corte limpio entre fases.
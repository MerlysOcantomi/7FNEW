# Prompt para Claude Design — 7F Beauty · "Hoy / Agenda de hoy" + Rose Nude

> Copia todo lo que hay debajo de la línea y pégalo en Claude Design.

---

Actúa como diseñador senior de producto (UX/UI) especializado en SaaS verticalizado y sistemas de diseño. **Solo diseñas y entregas mockups + handoff. No implementas código, no editas archivos, no pides commits.**

## Contexto

Estamos construyendo **7F / SevenF**, un SaaS empresarial con IA. 7F Core ya existe (Today, Calendar, Inbox, Tasks, Clients, Marketing, Finance, Inventory, Reports, Agentes/Mr Forte, Business Profile, vertical packs) y tiene AppShell, sidebar y un sistema de tokens propio. **No diseñes una app nueva ni una identidad nueva: diseñas una capa vertical sobre 7F Core.**

Estamos lanzando **7F Beauty** como primera vertical, para España, en español. La usuaria puede ser manicura, esteticista, peluquera, lash artist, masajista, barbería o pequeño salón. No quiere ser administradora, influencer ni community manager. Los competidores del sector son Fresha, Treatwell, Booksy, Planity, Vagaro, Salonized, Square Appointments y Timely — **entiende su estándar visual y funcional, pero no los copies.** La ventaja de 7F es IA operativa, WhatsApp/mensajes inteligentes, marketing fácil (fotos→contenido), campañas simples, rebooking, sugerencia de huecos y agentes integrados. La experiencia Beauty está liderada por **Finesse**, la especialista vertical — *"7F Beauty, powered by Finesse"* — que interpreta el contexto Beauty y coordina a los agentes core (Fanny, Freya, Fiona, Felix, Mr Forte, Fathom) **sin reemplazarlos**.

## Tu encargo

Diseña la **pantalla principal de 7F Beauty**: en el menú se llama **"Hoy"** y su bloque protagonista es **"Agenda de hoy"**. Es el Today verticalizado en modo `appointment_first` (agenda del día + rail de acciones), **no un dashboard empresarial ni otro "overview"**. Debe responder en **menos de 10 segundos**: *"¿Qué tengo que hacer hoy?"*.

Prioriza **desktop primero**, con una nota de adaptación a móvil después. Todo el microcopy en **español de España**, natural y cálido (Hoy, Agenda de hoy, Clientas, Mensajes, Marketing, Servicios, Pendientes, Huecos libres, Confirmada, Pendiente de confirmar, No asistió, Cobros, Publicar, Preparar post, Enviar recordatorio). **Evita** anglicismos y jerga: nada de Inbox, Overview, Pipeline, Revenue, Task management, Client management.

### Composición de "Hoy" (canvas central + rail derecho)

Diseña con jerarquía fuerte y **sin saturar de widgets**. El día es el protagonista; lo demás son acciones de un toque. Incluye:

1. **Header Beauty** — nombre del negocio, fecha, estado del día y mini resumen (citas, huecos, mensajes pendientes, contenido listo).
2. **Brief de Fanny** — 1–2 frases útiles. Ej.: *"Hoy tienes 6 citas, 2 clientas sin confirmar y un hueco libre a las 13:30."*
3. **Agenda de hoy** (canvas protagonista) — timeline/lista clara, próxima cita destacada, línea de "ahora". Cada cita: clienta, servicio, duración, hora. **Estados visuales**: Confirmada · Pendiente de confirmar · Cancelada · Completada · No asistió.
4. **Huecos y oportunidades** — huecos libres + sugerencia de llenarlos. Ej.: *"13:30–14:15 libre. Ofrece un esmaltado rápido a clientas frecuentes."*
5. **Mensajes / confirmaciones** — solicitudes de cita, WhatsApp pendiente, clientas sin confirmar, cambios de hora, respuestas sugeridas por Fanny.
6. **Pendientes importantes** — tareas simples del día (no un gestor de tareas corporativo). Ej.: confirmar cita de Laura, preparar cabina antes de las 15:00, comprar top coat, publicar foto de ayer.
7. **Clientas a cuidar** — no han vuelto, cumpleaños, rebooking sugerido, riesgo de no-show, fidelización simple. (Fusiona "clientas a cuidar" y rebooking en una sola tarjeta.)
8. **Marketing rápido** — foto reciente + post/story sugerido + caption preparada + promo sugerida + botón aprobar/previsualizar. Rol de Freya/Fiona. La usuaria **aprueba**, no crea desde cero ni piensa como influencer.
9. **Resumen simple de cobros** — ingresos estimados del día + pendiente de cobrar. **Un vistazo, no Finance avanzado.**
10. **Panel de agentes/ayuda** — **Finesse lidera la experiencia Beauty como especialista vertical, sin reemplazar a los agentes core** ("Finesse leads the Beauty experience as the vertical specialist, without replacing the core agents"). En superficies generales de Beauty la voz principal puede ser Finesse ("Preguntar a Finesse", "Finesse · Beauty Intelligence", "Finesse recomienda…"), pero cada acción que pertenece a un agente core sigue mostrando ese agente: Fanny (operación/mensajes), Freya (contenido), Fiona (marketing/CRM), Felix (cobros), Mr Forte (configuración). Útil, no decorativo.

**Disciplina de scope (crítico):** "Hoy" es ejecución diaria, **no** un panel de métricas. Marca claramente qué va en el **canvas central** (la agenda + lo accionable ahora) y qué va en el **rail derecho** (flujo de Fanny: sin confirmar / huecos / seguimientos / un nudge de marketing / un número de cobros). Dinero y marketing son *una mirada*, no secciones-dashboard. Si un elemento solo informa y no se acciona de un toque, degrádalo o quítalo.

### Requisitos visuales

Premium, claro, ligero, moderno, beauty-friendly; menos cargado que un dashboard, más operativo que un calendario; alineado con 7F (reusa AppShell, sidebar, tokens/paletas, componentes). **Evita:** muchas cards sin prioridad, exceso de gráficos, lenguaje corporativo, overviews duplicados, apariencia de CRM pesado o de marketplace copiado, menús innecesarios, paneles que compiten.

## Dirección visual: paleta **Rose Nude**

Define la paleta **Rose Nude** para 7F Beauty: familia beauty/premium, suave, cálida y elegante; femenina sin exagerar; profesional; usable todo el día. Debe sentirse "7F Beauty tiene piel propia, pero sigue siendo 7F". **Evita** rosa saturado tipo Barbie, tonos infantiles, bajo contraste, apariencia de spa barato, exceso de beige sin vida, y perder la identidad de 7F.

Parte de esta dirección y **define los HEX finales** (no solo nombres): Rose Nude Base (rosa nude suave), Warm Ivory (fondo claro cálido), Soft Blush (superficies), Dusty Rose (acento principal), Mauve Clay (acento secundario), Cocoa Grey (texto principal), Muted Taupe (texto secundario), Champagne Line (bordes/divisores), Deep Plum / Espresso Rose (contraste premium), Sage Soft (positivo/confirmación, si encaja).

Especifica el uso en: (1) principales, (2) secundarios, (3) fondo, (4) superficies/cards, (5) bordes, (6) texto principal, (7) texto secundario, (8) acentos, (9) estados de citas, (10) estados operativos, (11) botones, (12) badges, (13) timeline de agenda, (14) marketing cards, (15) panel de agentes. Aplícala especialmente en: header de Hoy, cards de Agenda, estados de cita, badges, botones principales, panel de Fanny/Freya/Fiona, marketing rápido, clientas a cuidar, empty states y highlights del día.

Entrega una **versión clara** primero. Puedes sugerir una futura dark/evening, pero no es el foco. **Cuida accesibilidad y contraste** (mínimo AA para texto): no sacrifiques legibilidad por estética; incluye ratios de contraste de las combinaciones texto/fondo clave.

## Entregables (mockups + handoff, sin código)

1. Mockup visual detallado de **desktop** de "Hoy / Agenda de hoy".
2. Propuesta de layout y grid.
3. Jerarquía de secciones (qué va arriba, qué abajo, qué en canvas vs. rail).
4. Microcopy real en español (España).
5. Estados visuales de las citas (los 5).
6. Datos ficticios realistas (clientas, servicios, horas, precios).
7. Especificación Rose Nude (HEX + usos + contraste).
8. Cómo mantenerlo simple (qué NO incluir).
9. Adaptación a móvil (nota + wireframe ligero).
10. Empty states clave (sin citas, sin mensajes, sin fotos).
11. **Handoff para Claude Code**: componentes sugeridos, datos necesarios, módulos core usados, y **qué NO implementar todavía**.

## Sección obligatoria del handoff: **Navigation / Vertical-aware handoff**

Diseña la **navegación Beauty objetivo** visible en el mockup: **Hoy · Agenda · Clientas · Mensajes · Marketing · Servicios · Más**. Pero deja explícito que esto es **dirección de producto/diseño, no una instrucción para hardcodear Beauty**. En esta sección explica:

- Qué elementos de navegación se muestran en Beauty y qué módulo core alimenta cada uno (Hoy→Today `appointment_first`, Agenda→Calendar, Clientas→Clients, Mensajes→Inbox, Marketing→Contenido, Servicios→catálogo de servicios, Más→Cobros/Equipo/Mr Forte…).
- Qué se **oculta** en Beauty MVP (Business Overview, Inbox Overview, Projects, Finance avanzado, Reports, Inventory avanzado, Tasks como página) y qué se **agrupa en "Más"**.
- Cómo la **misma lógica** se reutiliza para otras verticales (una portada distinta por vertical, mismo core):
  - **Construction**: Hoy/Trabajos de hoy · Presupuestos · Clientes · Mensajes · Obras/Trabajos · Materiales · Cobros · Más
  - **Cleaning**: Hoy/Rutas de hoy · Clientes · Servicios · Mensajes · Equipo · Productos · Cobros · Más
  - **Agency/Marketing**: Hoy · Clientes · Campañas · Contenido · Aprobaciones · Reportes · Propuestas · Más
- Qué **riesgos** hay si se hardcodea la navegación solo para Beauty (deuda, difícil de escalar a otras verticales, rompe el core).
- Qué debe resolver Claude Code **antes** de implementar el diseño en producción.

> **Nota técnica para el handoff (ya en marcha):** el paso técnico de "navegación vertical-aware" ya tiene una primera base en el código — un resolutor puro `resolveNavProfile(verticalKey)` que deriva labels/módulos/orden por vertical con *fallback* al core, más el vertical pack Beauty como dato. El diseño de "Hoy / Agenda de hoy" es la **experiencia objetivo**; su implementación real se conecta encima de esa base (no con parches hardcodeados), y el Today de citas con datos reales llega **después** (nunca mostrando datos mock a usuarias reales).

## Restricciones (no hacer)

No implementes código ni edites archivos. No pidas crear una app Beauty separada, ni una ruta `/beauty` o `/today-beauty`, ni hardcodear Beauty en el sidebar. No diseñes booking público todavía, ni Finance/Inventory/Reports avanzados, ni todo 7F Beauty completo. No hagas una pantalla llena de widgets. No copies Fresha/Treatwell. No uses inglés en el mockup.

**Objetivo final:** el diseño del **Today verticalizado de Beauty — "Hoy / Agenda de hoy"** con piel Rose Nude, que se sienta hecho para una profesional beauty y que deje claro que la navegación se implementará como sistema reutilizable por vertical, sin romper 7F Core.

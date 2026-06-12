# Cotizapp — CLAUDE.md

## Qué es este proyecto
Cotizapp es una web app PWA para que autónomos y pymes (plomeros, electricistas, 
jardineros, revendedores, etc.) generen cotizaciones profesionales con su marca 
en minutos. Incluye catálogo de ítems, escaneo de facturas con IA, PDF con marca 
personalizada, chat con agente IA, registro de gastos y compartir por WhatsApp.

## Stack
- Next.js 14 con App Router y TypeScript
- Clerk (@clerk/nextjs) para autenticación
- Supabase (base de datos + storage; RLS validado con el JWT de Clerk)
- Tailwind CSS + shadcn/ui
- next-themes para dark/light mode
- lucide-react para iconos
- Plus Jakarta Sans como tipografía principal
- @react-pdf/renderer para generación de PDF server-side
- openai SDK para chat, invoice scanning y receipt scanning
- recharts para gráficos del dashboard

## Reglas generales
- Todo el texto de la UI siempre en español latino neutro
- Mobile-first en todo momento
- Nunca usar "presupuesto" — siempre "cotización"
- Nunca hardcodear colores — siempre usar CSS variables del design system
- Siempre usar los componentes de shadcn/ui cuando existan antes de crear uno nuevo
- Cada componente en su carpeta correspondiente dentro de /components
- Nunca poner lógica de negocio en los page.tsx — siempre en hooks o en /lib
- Server actions para CRUD tradicional, route handlers para IA y uploads

## Design system
Fondo oscuro base: #0F1117
Superficie: #1A1D27
Superficie 2: #222536
Acento principal: #00E5A0
Acento hover: #00C984
Texto primario: #FFFFFF (dark) / #0F1117 (light)
Texto secundario: #8B8FA8
Bordes: #2A2D3E

Badges de estado de cotización:
- Borrador: bg #2d333b, text #8b949e, border #444c56
- Enviada: bg #1c3a5e, text #58a6ff, border #1f4e79
- Aceptada: bg #1a3a2a, text #00E5A0, border #1d5c3a
- Rechazada: bg #3d1c1c, text #f85149, border #6e2020
- Pendiente: bg #3d2e1c, text #f0883e, border #6e4c1c
- Vencida: bg #3d1c1c, text #f85149, border rojo, borde de tarjeta rojo

IMPORTANTE: El PDF de cotización es siempre fondo BLANCO.
El dark mode es solo para la interfaz, nunca para documentos generados.

## Estructura de rutas
/                          → Landing page pública (minimalista, sin texto largo)
/sign-in y /sign-up        → Auth con Clerk (/login es legacy: redirige a /sign-in)
/onboarding                → Setup inicial 2 pasos: datos negocio + logo
/dashboard                 → Home con KPIs reales (solo cotizaciones aceptadas)
/cotizaciones              → Lista con filtros, búsqueda y vista tabla/tarjetas
/cotizaciones/nueva        → Crear nueva cotización (Cliente→Ítems→Escaneo→Ajustes)
/cotizaciones/[id]         → Detalle con historial de estados
/catalogo                  → Gestión de ítems con costo y precio de venta
/clientes                  → Lista y CRUD de clientes
/gastos                    → Registro y escaneo de gastos con IA
/chat                      → Chat con agente IA
/perfil-usuario            → Datos personales del usuario
/perfil-empresa            → Datos del negocio, logo, PDF, numeración
/ajustes                   → Configuración completa de la cuenta

## MÓDULO OCULTO (no mostrar en UI hasta nuevo aviso)
/facturas                  → Módulo de facturas — código existe pero NO mostrar
                             en sidebar, navegación ni CTAs

## Base de datos (Supabase)
Tablas principales:
- profiles → datos del negocio (clerk_id, logo_url, pdf_color, pdf_template, 
             quotation_prefix, quotation_counter, tax_id, pdf_accent_color,
             logo_onboarding_completed, avatar_url, first_name, last_name,
             phone, country, city, birth_date)
- catalog_items → ítems con nombre, precio, costo, categoría, unidad
- clients → clientes del usuario
- quotations → cotizaciones (estados: draft, sent, accepted, pending, rejected)
              columnas extra: paid_at, share_token, pdf_path, status_history
- quotation_items → ítems con precio, costo y margen por ítem
- quotation_attachments → adjuntos de cotizaciones
- invoice_scans → historial de facturas escaneadas con IA
- expenses → gastos (description, amount, currency, category, date, receipt_url)

Buckets de Storage:
- business-assets → logos del negocio
- quotation-attachments → adjuntos de cotizaciones
- invoice-uploads → fotos de facturas para IA
- quotation-pdfs → PDFs generados
- expense-receipts → fotos de recibos de gastos
- avatars → fotos de perfil de usuario

Todas las tablas tienen RLS activado.
Las políticas RLS usan public.current_profile_id() (mapea el JWT de Clerk
→ profiles.clerk_id → UUID). NUNCA usar auth.uid() en políticas: bajo Clerk
devuelve NULL y bloquea todo. En queries de la app, filtrar por user_id
con el UUID que devuelve requireUser().id.

## Auth
Clerk (@clerk/nextjs) con clerkMiddleware en middleware.ts.
Rutas públicas: /, /sign-in, /sign-up y /api/quotations/share/* (PDFs compartidos).

REGLA CRÍTICA: el userId de Clerk ("user_xxx") NUNCA se usa directo en queries.
requireUser() y getCurrentUser() (lib/profile.ts) resuelven Clerk ID → UUID del
perfil vía ensureProfileForClerkUser(). AppUser.id ya es el UUID de profiles
(el user_id de las tablas); AppUser.clerkId es el ID de Clerk.
El cliente Supabase server-side (lib/supabase/server.ts) usa el JWT de Clerk
como accessToken — RLS valida con ese token.

Flujo post-login:
Si no tiene profile → /onboarding paso 1 (datos negocio).
Si tiene profile pero no logo_onboarding_completed → /onboarding?step=logo.
Si tiene todo completo → /dashboard.

## Dashboard KPIs
Solo contar cotizaciones con estado "accepted":
- Total aceptado este mes
- Cotizaciones enviadas este mes
- Cotizaciones aceptadas este mes
- Cotizaciones pendientes
- Gastos este mes
- Ganancia neta = aceptado - gastos (ocultar si gastos = 0, mostrar CTA)

## PDF
Generado server-side con @react-pdf/renderer.
Fondo BLANCO siempre.
Incluye: logo del negocio, datos emisor, número de cotización formateado,
tabla de ítems (sin mostrar costo ni margen — solo precio de venta),
subtotal, impuesto, total, firma del cliente si existe, notas y pie de página.
Color de acento configurable desde perfil (profiles.pdf_accent_color).
Plantilla configurable: clásica, moderna, minimalista (profiles.pdf_template).

## Cotizaciones — reglas de negocio
- Fecha de validez default: 30 días desde hoy si no se elige
- Advertir si la fecha elegida es anterior a hoy
- Cotizaciones vencidas (válida_hasta < hoy): badge rojo "Vencida"
- IDs configurables según profiles.quotation_prefix y profiles.quotation_counter
- Tarjetas enteras son clickeables, no solo el botón "Ver detalle"
- Toggle "Pagada/No pagada" — guarda paid_at timestamp
- Historial de cambios de estado visible en el detalle

## Ítems de cotización — margen de ganancia
Cada ítem tiene: descripción, cantidad, costo, margen%, precio de venta, total.
- Cambiar margen% actualiza precio de venta automáticamente
- Cambiar precio de venta actualiza margen% automáticamente
- El cliente NUNCA ve el costo ni el margen en el PDF
- El resumen muestra: costo total, precio total, ganancia estimada, margen promedio
- Los ítems importados del catálogo son editables sin afectar el catálogo original

## Gastos
Categorías: Materiales, Herramientas, Transporte, Combustible, Comida, 
Servicios, Marketing, Alquiler, Impuestos, Otro.
Escaneo de recibos con OpenAI Vision — mismo flujo que facturas.
KPIs: total del mes, cantidad, categoría más usada.

## WhatsApp
Link con wa.me + mensaje precargado + URL pública del PDF.
Toma el teléfono del cliente de la cotización.
Si el cliente no tiene teléfono, pedir antes de continuar.
URL usa NEXT_PUBLIC_APP_URL, nunca localhost.
Al compartir → estado cambia a "sent" automáticamente.

## Chat IA
Modelo: gpt-4o-mini.
Contexto incluye fecha actual para filtros por período.
Acciones: crear borrador, consultar por período, modificar catálogo (con confirmación).
Toda escritura requiere confirmación explícita del usuario.

## Navegación
Desktop: sidebar izquierdo fijo con logo Cotizapp arriba.
Mobile: bottom nav fija de 64px — NO flotante, NO tapa contenido.
Padding-bottom en todas las páginas para no quedar tapado por la nav.
Items del sidebar: Dashboard, Cotizaciones, Nueva cotización, 
Clientes, Catálogo, Gastos, Chat IA, Ajustes (abajo), Cerrar sesión (abajo).

## Convenciones de código
- Componentes: PascalCase
- Funciones y variables: camelCase  
- Archivos: kebab-case.tsx
- Hooks: useNombreHook.ts en /hooks
- Server actions en /app/actions/
- Tipos en /types/index.ts

## Deploy en Vercel (CRÍTICO)

**EL ÚNICO PROYECTO REAL EN VERCEL ES `cotizapp-ia`.**

- Producción: https://cotizapp.lat
- No crear ni desplegar a `cotizapp`, `landing-cotizapp` ni ningún otro proyecto.
- Deploy preferido: push a `main` (Git conectado a `cotizapp-ia`).
- Deploy manual: solo `vercel link --project cotizapp-ia` y luego `vercel deploy --prod`.
- Antes de deploy manual, verificar `.vercel/project.json` → `projectName: cotizapp-ia`.

## Variables de entorno requeridas
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
OPENAI_CHAT_MODEL=gpt-4o-mini        (opcional, default en código)
OPENAI_VISION_MODEL=gpt-4o           (opcional, default en código)
NEXT_PUBLIC_APP_URL=https://cotizapp.lat

## Lo que NO hacer
- **No desplegar ni vincular a ningún proyecto Vercel que no sea `cotizapp-ia`**
- No usar el userId de Clerk ("user_xxx") directo en queries — siempre requireUser().id
- No usar auth.uid() en políticas RLS — bajo Clerk devuelve NULL; usar current_profile_id()
- No mostrar /facturas en ninguna parte de la UI hasta nuevo aviso
- No mostrar el costo ni el margen en el PDF — es información privada
- No usar páginas /api para cosas que Supabase puede hacer directo
- No instalar librerías sin verificar que no exista algo en el stack
- No crear estilos inline — siempre Tailwind con CSS variables
- No saltear estados de loading en operaciones async
- No mostrar errores técnicos — siempre mensajes en español amigables
- No guardar resultados de IA sin confirmación explícita del usuario
- No hardcodear IDs, URLs ni tokens
- No hacer el PDF oscuro — siempre fondo blanco
- No mostrar ganancia neta si gastos = 0
- No contar cotizaciones que no sean "accepted" en el KPI principal

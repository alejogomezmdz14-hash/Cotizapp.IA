# Informe de auditoría Cotizapp — Pre-lanzamiento

> Auditoría integral multi-agente (2026-07-28). 9 agentes, 60 hallazgos. Áreas: onboarding, flujo de cotización, chat IA, accesibilidad, copy/voseo, conversión (WhatsApp+PDF), correctness/bugs, facturación ARCA + launch-readiness.

## 1. Resumen ejecutivo

La app está funcional y con buen feedback visual en el flujo core, pero **no está lista para un lanzamiento serio tal como está**. Hay tres focos que bloquean: (a) la **puerta de entrada rompe la conversión** — el registro/login sale en inglés y el chat estrella se "cuelga" visualmente; (b) **toda la facturación ARCA es un campo minado** (sin PDF/QR legal, nunca probada en homologación, cache de ticket que se rompe en serverless y riesgo de doble emisión); (c) **la infra es frágil** (Supabase free se auto-pausa y ya tiró la DB, sin observabilidad de errores). Además hay un patrón sistémico de **bugs de zona horaria (UTC vs Argentina)** que muestran fechas y plata mal cada noche. Recomendación: lanzar **cotizaciones + WhatsApp** tras resolver los críticos no-fiscales, y tratar **facturación ARCA como un lanzamiento aparte** que no sale hasta cerrar sus 4 críticos + infra.

## 2. 🔴 Críticos

### Conversión / flujo core
- **C1. Registro y login en INGLÉS (Clerk sin `esES`)** — `app/layout.tsx:54` + falta `@clerk/localizations`. Fix: `npm i @clerk/localizations` → `<ClerkProvider localization={esES}>`.
- **C2. El chat no hace auto-scroll: respuestas/tarjetas quedan fuera de pantalla** — `components/chat/chat-message-list.tsx:102-104`. Fix: sentinel al final + `scrollIntoView` en `useEffect([messages, isSubmitting])`.
- **C3. El chat muestra errores técnicos crudos ("OPENAI_API_KEY", "JSON")** — `app/api/ai/chat/route.ts:69-90` (textos en `lib/ai/chat.ts:263,273,906`). Fix: para `status>=500` copy genérico + `console.error` server-side.

### Facturación ARCA + infra (gatillan solo si se lanza facturación)
- **C4. La factura emitida no genera PDF ni el QR de AFIP obligatorio (RG 4291)** — `emitir-factura-button.tsx:36-48`, `cotizaciones/[id]/page.tsx:278-291`. Sin QR el comprobante no es válido. Fix: dep `qrcode`, payload `afip.gob.ar/fe/qr/?p=<base64>`, PDF Factura C con `@react-pdf/renderer`.
- **C5. Facturación nunca ejecutada contra ARCA real** — `lib/arca/billing.ts:209-249`. Fix: smoke test de homologación antes de lanzar; fijar `@arcasdk/core` a `1.3.1` exacto.
- **C6. El ticket WSAA se cachea en `/tmp` (efímero en serverless) → "ya posee un TA válido"** — `lib/arca/billing.ts:225`. Fix: persistir TA en Supabase con `TicketStorage` propio.
- **C7. Doble emisión posible: `releaseClaim()` corre ante CUALQUIER error** — `app/actions/facturacion.ts:154-159`. Fix: no liberar el claim ante error de red incierto (solo ante `ArcaEmissionError`).
- **C8. Supabase free tier se auto-pausa (ya tiró la DB)** — infra. Fix: plan Pro + cron keep-alive `/api/health` + uptime check.

## 3. 🟡 Importantes (resumen)

- **Onboarding:** dashboard del usuario nuevo con el CTA al fondo; etiquetas de paso contradictorias ("Último paso" vs "Paso 1 de 2"); landing sin prueba visual del PDF.
- **Crear cotización:** ítem manual cuesta 2 sheets anidados; sección "Notas" que es el escáner; anclas de navegación rotas (`#paso-notas`/`#paso-resumen` no existen); voseo roto en el editor de ítems.
- **Chat IA:** sin indicador "escribiendo…"; los prompts vacíos rellenan pero no envían; confirmar gasto solo por texto "sí"; preview sin total; Chat escondido en el menú "···".
- **Accesibilidad:** inputs a 14px → zoom iOS; labels de nav a 11px; contraste WCAG AA falla en modo claro (naranja, verde acento, gris secundario); targets táctiles < 44px.
- **Copy:** jerga "trial"/"onboarding"; CTA "Nuevo" (vago) → "Cotizar".
- **Conversión:** tras enviar no cambia a "Enviada" (falta `router.refresh()`); "pendiente" vs "Enviada"; el CUIT del emisor no sale en el PDF.
- **Correctness — zona horaria (sistémico):** `formatDateTime` en UTC; totales "este mes" con límites UTC; validación de validez con "hoy" UTC. Fix: `America/Argentina/Buenos_Aires`.
- **Correctness — plata:** `updateDraftQuotationAction` puede dejar total ≠ suma de ítems si falla el re-insert (sin transacción).
- **Facturación:** onboarding del cert inviable + clave sin cifrar (→ modelo delegación); SW versionado a mano; sin observabilidad; migraciones a mano (drift).

## 4. 🟢 Mejoras (selección)

Guía de pasos oculta en mobile; estados vacíos con tono distinto; auth sin logo; "Guardar" deshabilitado sin decir por qué; combinar Guardar+Enviar; header del asistente frío; conversación se pierde al recargar; PDF muestra "Impuesto (0%)" para monotributistas; parseo de montos IA "1.500"→1.5; `CbteFch` en UTC; número DEMO mezcla con reales.

## 5. Top 5 de mayor impacto

1. **Localizar Clerk a español (`esES`)** — `app/layout.tsx:54`. Fix de 5 min que arregla el peor punto de fuga (form en inglés en el momento de máxima fricción).
2. **Arreglar el Chat IA (auto-scroll + "escribiendo…" + errores crudos)** — es la función más diferenciadora y hoy se lee como "se colgó/se rompió".
3. **Decidir facturación: lanzar SIN ARCA o cerrar sus 4 críticos + infra fiscal** — hoy puede emitir comprobantes inválidos, duplicados o fantasma (riesgo legal/fiscal).
4. **Estabilizar infra: Supabase Pro + keep-alive + Sentry** — la DB ya se cayó; sin observabilidad un CAE perdido es un descuadre invisible.
5. **Corregir zona horaria (UTC → Argentina)** — sistémico: fechas adelantadas y plata del mes equivocada a todos los usuarios AR cada noche.

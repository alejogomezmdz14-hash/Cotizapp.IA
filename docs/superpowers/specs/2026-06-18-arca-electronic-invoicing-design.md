# Diseño — Emisión de Factura Electrónica ARCA (Factura C)

Fecha: 2026-06-18
Estado: aprobado por el usuario (pendiente de plan)

## Contexto y alcance

Agregar emisión de **factura electrónica** contra ARCA (ex-AFIP) desde el detalle de
una cotización aceptada. Es la **fase siguiente** del spec de captura de datos
fiscales (`2026-06-18-fiscal-profile-argentina-design.md`), que define
`fiscal_profiles`, el bucket privado `fiscal` y el form en Mi empresa.

Al emitir, se obtiene un **CAE** (Código de Autorización Electrónico) de ARCA y se
guarda junto al número de factura en la cotización.

**Alcance de este spec (v1):**
- Solo **Factura C** (Monotributo): `CbteTipo = 11`, sin discriminar IVA.
- Receptor siempre **Consumidor Final** (`DocTipo 99`, `DocNro 0`).
- Entorno **configurable por usuario**, default **homologación** (testing).
- CAE + número de factura persistidos en `quotations`.
- Botón "Emitir factura" en el detalle de cotización con gating.

### Dependencia (en curso en otra sesión)

La capa de captura (tabla `fiscal_profiles`, bucket `fiscal`, `lib/fiscal-profile.ts`,
`lib/profile-countries.ts`, `lib/storage/buckets.ts` con `fiscal`, el form fiscal)
**se está implementando en otra sesión**. Este spec **asume** esas piezas y reusa sus
formas canónicas exactas. No las redefine; solo las extiende (columna `environment`)
y las consume.

### Fuera de alcance (v1)

- Factura A/B y discriminación de IVA (Responsable Inscripto).
- `Concepto` de servicios (fechas de servicio `FchServDesde/Hasta/VtoPago`); v1 usa
  `Concepto = 1` (Productos).
- Captura de CUIT/DNI del cliente como receptor.
- Nota de crédito / anulación de comprobantes.
- Generación del PDF de la factura con el CAE/QR (queda anotado como mejora futura).

### Limitaciones conocidas de v1 (de la revisión de código)

- **Reconciliación tras fallo de guardado:** si ARCA aprueba pero el `update` de la
  cotización falla, el CAE se loguea (`console.error`) y se muestra al usuario, pero
  no queda persistido; la recuperación es manual. El guardado es condicional
  (`.is("cae", null)`) para no sobrescribir un CAE ya escrito. Endurecerlo (fila de
  reconciliación / reintento) queda como mejora futura.
- **Ventana de carrera mínima:** el guard anti-doble-emisión lee y luego escribe; dos
  clicks concurrentes (dos pestañas) podrían emitir dos CAE reales antes del guardado.
  El botón se deshabilita durante la carga y el guardado condicional evita corromper el
  CAE ya guardado; un lock a nivel DB previo a ARCA sería el fix robusto (futuro).
- **`CbteFch` en UTC:** se asume server en UTC (Vercel). Cerca de medianoche UTC la
  fecha del comprobante puede adelantarse un día respecto de la argentina; la tolerancia
  de ARCA normalmente lo absorbe. Documentado como supuesto.

Stack: Next.js 14 App Router, TypeScript, Clerk + Supabase (anon key + JWT de Clerk +
RLS), `@arcasdk/core`. Texto UI en voseo rioplatense.

## Decisiones tomadas

- **Paquete real: `@arcasdk/core`** (v1.3.x). El `afipts` de la instrucción original
  **no existe en npm**; afipts.com publica el SDK como `@arcasdk/core`. Clase `Arca`,
  servicio `electronicBillingService`. Depende de `soap` + `node-forge` →
  **runtime Node** (no Edge).
- **Tabla de cotizaciones: `quotations`** (no `quotes`). Estado "aprobada" = `accepted`.
- **Path de credenciales: `fiscal/{clerk_user_id}/cert.crt` y `/private.key`**
  (keyeado por Clerk ID, igual que el spec de captura). Bucket privado `fiscal`.
- **Reuso de columnas de `fiscal_profiles`**: `sales_point` (text, ej. "0001"),
  `contributor_type`. La emisión v1 exige `contributor_type = 'monotributista'`.
- **CAE en `quotations`** (no en la tabla `invoices` del módulo oculto `/facturas`):
  campos `cae`, `cae_vencimiento`, `numero_factura`, `facturado_at`.
- **Lógica ARCA aislada en `lib/arca/`**, server action delgada que orquesta.

## 1. Base de datos (1 migración nueva)

`supabase/migrations/20260618_arca_invoicing.sql` — se aplica a mano en el SQL Editor
del Dashboard de `cotizapp-ia` (igual que el resto).

```sql
-- Emisión de factura electrónica ARCA. Extiende fiscal_profiles con el entorno
-- (homologación/producción) y agrega los campos de CAE a quotations.

alter table public.fiscal_profiles
  add column if not exists environment text not null default 'homologacion'
    check (environment in ('homologacion', 'produccion'));

alter table public.quotations
  add column if not exists cae text,
  add column if not exists cae_vencimiento date,
  add column if not exists numero_factura text,
  add column if not exists facturado_at timestamptz;
```

No se tocan políticas RLS: `fiscal_profiles` y `quotations` ya tienen RLS (por
`clerk_user_id()` y `current_profile_id()` respectivamente). Los nuevos campos quedan
cubiertos por las policies existentes.

## 2. Dependencia npm y runtime

- `npm install @arcasdk/core`.
- La server action y `lib/arca/billing.ts` corren en **Node** (Server Actions de Next
  14 ya son Node por defecto). `@arcasdk/core` no se importa en ningún componente
  cliente ni en código Edge, para que `soap`/`node-forge` no se bundleen mal.

## 3. Credenciales en Storage

- Bucket privado `fiscal` (definido por el spec de captura; `STORAGE_BUCKETS.fiscal`
  ya existe en `lib/storage/buckets.ts`).
- La action descarga con `downloadFile('fiscal', '{clerkId}/cert.crt')` y
  `'{clerkId}/private.key'` (helper existente en `lib/storage/server.ts`, usa el JWT de
  Clerk del propio usuario → RLS le permite leer su carpeta; **no requiere service
  role**).
- Los bytes se convierten a string PEM (`Buffer.from(bytes).toString('utf8')`) para
  pasarlos al SDK. La `.key` nunca se expone al cliente.
- ⚠️ La clave privada queda at-rest en Storage (bucket privado + RLS estricta). Cifrado
  en reposo queda como endurecimiento futuro (fuera de alcance), consistente con el
  spec de captura.

## 4. Módulo ARCA: `lib/arca/billing.ts`

Aísla toda la conversación con ARCA. Recibe datos ya resueltos (sin tocar DB ni auth) →
testeable con el SDK mockeado.

- **Tipos:**
  - `ArcaCredentials = { cuit: string; certPem: string; keyPem: string; environment: 'homologacion' | 'produccion' }`
  - `FacturaCInput = { salesPoint: string; total: number; date: Date }`
  - `FacturaCResult = { cae: string; caeVencimiento: string /* YYYYMMDD */; numeroComprobante: number; numeroFactura: string /* "0001-00000123" */ }`
- **`buildFacturaCRequest(input, lastVoucherNumber)`** (pura): arma el payload de
  Factura C:
  - `CantReg 1`, `PtoVta = Number(salesPoint)`, `CbteTipo 11`, `Concepto 1`.
  - `DocTipo 99`, `DocNro 0` (Consumidor Final).
  - `CbteDesde = CbteHasta = lastVoucherNumber + 1`.
  - `CbteFch = YYYYMMDD(date)`.
  - `ImpTotal = ImpNeto = round2(total)`, `ImpIVA 0`, `ImpTrib 0`, `ImpOpEx 0`,
    `ImpTotConc 0`.
  - `MonId 'PES'`, `MonCotiz 1`, **sin** array `Iva` (Factura C no discrimina).
- **`emitirFacturaC(credentials, input)`** (efecto):
  1. `new Arca({ cuit: Number(cuit), cert: certPem, key: keyPem })` (+ flag de entorno
     según la API real del SDK — ver nota de implementación).
  2. Obtener último comprobante autorizado para `(PtoVta, CbteTipo 11)`.
  3. `buildFacturaCRequest(...)`.
  4. `arca.electronicBillingService.createVoucher(request)`.
  5. Validar `Resultado === 'A'`; si `R`/`P` o hay `Errores`/`Observaciones`, lanzar
     `ArcaEmissionError` con mensaje en español.
  6. Devolver `FacturaCResult` (formatea `numeroFactura` como
     `{salesPoint}-{nro.padStart(8,'0')}`).
- **Nota de implementación:** los nombres exactos del SDK (método para "último
  comprobante", flag de entorno homologación/producción, forma de la respuesta) se
  **confirman contra los tipos del paquete instalado** en la primera tarea del plan,
  antes de escribir la lógica. El diseño asume `createVoucher` + un getter de último
  número, que es lo documentado en afipts.com.
- **`ArcaEmissionError`**: clase de error con `message` amigable (es) para distinguir
  fallos de ARCA de errores genéricos.

## 5. Server Action: `app/actions/facturacion.ts`

`emitirFacturaAction(quotationId: string)`:

1. `requireUser()` → `{ id (UUID), clerkId }`.
2. Cargar la cotización (`id = quotationId`, `user_id = user.id`). Validar:
   - existe,
   - `status === 'accepted'`,
   - **no tiene CAE** ya (`facturado_at`/`cae` nulos) — guard anti-doble-emisión.
3. Cargar `profile` (para `country`) y `getFiscalProfile(user.clerkId)`. Validar:
   - `isArgentina(profile.country)`,
   - perfil fiscal **completo**: `cuit` formato válido, `sales_point`, `cert_path`,
     `key_path`,
   - `contributor_type === 'monotributista'` (v1 solo Factura C).
4. Descargar `cert.crt` + `private.key` del bucket `fiscal`.
5. `emitirFacturaC({ cuit, certPem, keyPem, environment }, { salesPoint, total, date })`.
6. Persistir en la cotización: `cae`, `cae_vencimiento` (parse `YYYYMMDD` → `Date`),
   `numero_factura`, `facturado_at = now()` (filtrando por `id` + `user_id`).
7. `revalidatePath('/cotizaciones/[id]', 'page')` (o `revalidatePath` del detalle).
8. Devolver `{ ok: true, cae, numeroFactura, vencimiento }` o
   `{ ok: false, error }` con mensaje en español (no lanzar técnico al cliente).

Idempotencia: el guard del paso 2 evita doble emisión. Si ARCA aprueba pero el
`update` falla, se loguea el CAE para reconciliación manual (no se reintenta ARCA).

## 6. UI — botón "Emitir factura" en `/cotizaciones/[id]`

- **Page (server)** `app/(dashboard)/cotizaciones/[id]/page.tsx`: ya carga `quotation`
  y `profile`. Agregar:
  - `getFiscalProfile(user.clerkId)` cuando `isArgentina(profile.country)`.
  - `canIssue = quotation.status === 'accepted' && isArgentina(profile.country) && isFiscalProfileComplete(fiscalProfile)`.
  - Si `quotation.cae` ya existe → mostrar panel con CAE, número de factura y
    vencimiento (en vez del botón).
  - Si `canIssue && !quotation.cae` → renderizar `<EmitirFacturaButton quotationId=... />`.
- **`isFiscalProfileComplete(fp)`** (helper puro en `lib/arca/eligibility.ts`, para no
  tocar el archivo que crea la sesión de captura): `cuit` válido + `sales_point` +
  `cert_path` + `key_path` + `contributor_type === 'monotributista'`. Testeable.
- **`components/cotizacion/emitir-factura-button.tsx`** (client):
  - Estado `idle | loading | done | error`.
  - Click → llama `emitirFacturaAction(quotationId)` → loading.
  - Éxito → muestra el CAE generado + número de factura (toast + panel inline).
  - Error → mensaje en español amigable. Sin tecnicismos.
  - Botón deshabilitado durante loading (spinner, patrón del repo).
- Tokens del design system (accent `#00E5A0`, surface, etc.), nada hardcodeado.

## 7. Coordinación con la sesión de captura

La columna `environment` y su selector tocan piezas que la otra sesión está creando:
- **`fiscal_profiles.environment`**: la agrega la migración de **este** spec (ALTER),
  no la de captura.
- **Selector de entorno** (Homologación/Producción) en `FiscalProfileForm` +
  persistencia en `saveFiscalProfileAction`: son **modificaciones** a archivos que crea
  la sesión de captura. El plan de emisión debe aplicarlas **después** de que esos
  archivos existan (o coordinarse para evitar conflicto). Si al ejecutar el plan el form
  aún no existe, esta parte se difiere y `environment` queda en su default
  `homologacion` hasta poder exponerlo.

## 8. Manejo de errores (mensajes en español)

| Situación | Mensaje |
|---|---|
| Perfil fiscal incompleto | "Completá tus datos fiscales en Mi empresa antes de facturar." |
| No es monotributista (v1) | "Por ahora solo emitimos Factura C para monotributistas." |
| Cert/key ilegible o vencido | "No pudimos leer tu certificado ARCA. Revisá que sea válido." |
| ARCA rechaza (`Resultado R`) | Mensaje derivado de `Errores`/`Observaciones` de ARCA. |
| ARCA caído / timeout | "ARCA no está disponible en este momento. Probá más tarde." |
| Ya facturada | "Esta cotización ya tiene una factura emitida." |

Nunca se persiste CAE/numero si la emisión falla.

## 9. Testing

- **Puras (unit, `node:test` vía `tsx --test`):**
  - `buildFacturaCRequest`: neto = total, sin IVA, `CbteTipo 11`, `Concepto 1`,
    `DocTipo 99`/`DocNro 0`, `CbteDesde = last+1`, formato de fecha `YYYYMMDD`,
    `MonId 'PES'`.
  - Formato de `numeroFactura` (`"0001-00000123"`).
  - `isFiscalProfileComplete` (casos completo / falta cert / no monotributista).
- **`emitirFacturaC`** con el SDK mockeado: éxito (`Resultado A` → result), rechazo
  (`Resultado R` → `ArcaEmissionError`).
- **Wiring (source-regex, patrón del repo):** el detalle de cotización renderiza
  `EmitirFacturaButton` bajo las condiciones de gating; la action exporta
  `emitirFacturaAction`.
- **General:** `tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`.

## 10. Pasos manuales del usuario (Dashboard de `cotizapp-ia`)

Correr en el SQL Editor el contenido de
`supabase/migrations/20260618_arca_invoicing.sql` (ALTER de `fiscal_profiles` +
columnas CAE en `quotations`). Sin eso, el botón falla-closed con mensaje amigable; el
resto de la app no se afecta.

## Convenciones

- Texto UI en voseo rioplatense; nunca "presupuesto".
- Sin colores hardcodeados fuera del design system; sin librerías nuevas salvo
  `@arcasdk/core`.
- Componentes en `/components`, lógica en `/lib` (`lib/arca/`), acciones en
  `/app/actions`.
- RLS con `public.clerk_user_id()` / `public.current_profile_id()`, nunca `auth.uid()`.
- El `@arcasdk/core` solo en código server (Node), nunca en cliente ni Edge.

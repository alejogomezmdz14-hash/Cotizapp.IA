# Diseño — Datos Fiscales (Argentina)

Fecha: 2026-06-18
Estado: aprobado por el usuario (pendiente de plan)

## Contexto y alcance

Agregar una sección "Datos Fiscales" para usuarios de Argentina, dentro de la
pantalla **Mi empresa** (`/perfil-empresa`). Es el cimiento de la futura
facturación electrónica ARCA/AFIP.

**Alcance de este spec:** captura de datos fiscales + subida de certificado/clave
ARCA. **NO** incluye la emisión de facturas contra ARCA (web services con el
cert/key) — eso es la fase siguiente.

Stack: Next.js 14, Clerk + Supabase (RLS con JWT de Clerk), shadcn/ui, tema
oscuro. Texto en voseo rioplatense.

## Decisiones tomadas

- **País → selector.** El campo `profiles.country` hoy es input de texto libre.
  Se convierte a un selector con lista de países (Argentina incluida) para que la
  detección sea confiable.
- **CUIT en `fiscal_profiles`, prellenado desde `tax_id`.** El CUIT fiscal vive en
  la tabla nueva; al abrir el form se prellena con `profiles.tax_id` si existe.
  `tax_id` se mantiene para mostrar / usuarios no-AR.
- **Validación de CUIT: solo formato** `XX-XXXXXXXX-X` (sin dígito verificador).
- **Ubicación:** sección dentro de `/perfil-empresa`, visible solo si el país es
  Argentina.
- **Razón social** se mantiene aparte de `business_name` (nombre legal vs
  comercial); se prellena con `business_name`.

## 1. Base de datos: `fiscal_profiles`

```sql
create table public.fiscal_profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  cuit text not null,
  contributor_type text not null
    check (contributor_type in ('monotributista', 'responsable_inscripto')),
  sales_point text not null,
  business_name text not null,
  cert_path text,
  key_path text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.fiscal_profiles enable row level security;

-- CORRECCIÓN sobre el spec original: esta app NO usa current_setting('app.current_user_id').
-- Pasa el JWT de Clerk a Supabase y RLS lo lee con public.clerk_user_id() (= auth.jwt()->>'sub').
create policy "Users manage their own fiscal profile"
  on public.fiscal_profiles
  for all
  to authenticated
  using (clerk_user_id = public.clerk_user_id())
  with check (clerk_user_id = public.clerk_user_id());
```

`public.clerk_user_id()` ya existe (migración `20260602_clerk_auth_rls.sql`). Se
mantiene `clerk_user_id` como clave (no profile UUID) tal como lo pidió el usuario;
es consistente con la policy de arriba.

Migración nueva: `supabase/migrations/20260618_fiscal_profiles.sql`. Se aplica a
mano en el SQL Editor del Dashboard (proyecto `cotizapp-ia`), igual que el resto.

## 2. Storage: bucket privado `fiscal`

- Bucket nuevo `fiscal`, **privado** (`public = false`).
- Objetos: `{clerk_user_id}/cert.crt` y `{clerk_user_id}/private.key`.
- Storage RLS (sobre `storage.objects`):
  ```sql
  create policy "Users manage their own fiscal credentials"
    on storage.objects for all to authenticated
    using (bucket_id = 'fiscal'
           and (storage.foldername(name))[1] = public.clerk_user_id())
    with check (bucket_id = 'fiscal'
           and (storage.foldername(name))[1] = public.clerk_user_id());
  ```
  (Keyeado por `clerk_user_id`, no por profile UUID como los otros buckets —
  consistente con `fiscal_profiles`.)
- Creación del bucket + policy: parte de los pasos manuales en el Dashboard (SQL
  incluido en el plan).
- **Seguridad:** la `.key` es un secreto de alto valor. Bucket privado + RLS
  estricta es el mínimo aceptable para esta fase. Cifrado en reposo de la `.key`
  queda anotado como endurecimiento futuro (no en este alcance).

## 3. Detección de país (selector)

- Nuevo `lib/profile-countries.ts`: lista de países (al menos los de LatAm + un
  fallback "Otro"), con `value` canónico = nombre ("Argentina", "México", …) para
  ser compatible con los valores de texto libre ya guardados.
- `isArgentina(country: string | null): boolean` — pura, normaliza (trim, case,
  acentos) y compara contra "Argentina"/"AR". Testeable.
- `components/profile/user-profile-form.tsx`: el `<Input name="country">` pasa a un
  selector (shadcn/ui) poblado con la lista. `defaultValue` = `profile.country`.
  No requiere migración (la columna ya es text).

## 4. Backend

- `lib/fiscal-profile.ts`:
  - Tipo `FiscalProfile` y `ContributorType = "monotributista" | "responsable_inscripto"`.
  - `normalizeCuit(value)` y `isValidCuitFormat(value)` — valida `XX-XXXXXXXX-X`
    (2 díg. - 8 díg. - 1 díg.). Solo formato. Puras, testeables.
  - `normalizeContributorType`, `normalizeSalesPoint` (ej. left-pad a 4 dígitos
    "0001"; acepta entrada "1" → "0001"). Puras.
  - `getFiscalProfile(clerkUserId)` y upsert vía `createClient()` (anon + JWT,
    RLS). Filtra por `clerk_user_id`.
- `app/actions/fiscal.ts`: `saveFiscalProfileAction(formData)` — `requireUser()`,
  valida (formato CUIT, tipo, punto de venta, razón social requeridos), hace
  `upsert` en `fiscal_profiles` por `clerk_user_id` (con `updated_at = now()`),
  `revalidatePath('/perfil-empresa')`.
- Upload de credenciales: route handler(s) bajo `app/api/uploads/fiscal-*` (o uno
  que reciba `kind: 'cert'|'key'`). `requireUser()`, valida **extensión** (.crt /
  .key) + **tamaño** (≤ 64KB) — no por MIME. Sube al bucket `fiscal` en
  `{clerkId}/cert.crt` o `{clerkId}/private.key` (reusa `lib/storage/server.ts`) y
  guarda `cert_path`/`key_path` en `fiscal_profiles`. Helpers de validación en
  `lib/uploads.ts` (junto a los existentes), testeables.

## 5. UI

- `components/profile/fiscal-profile-form.tsx` (client, shadcn/ui, tokens del
  design system — background `#0A0A0F`, surface `#1A1D27`, accent `#00E5A0`):
  - CUIT (texto, validación de formato en cliente + servidor).
  - Tipo de contribuyente (selector: Monotributista / Responsable Inscripto).
  - Punto de venta (texto/número, ej. 0001).
  - Razón social (texto, prellena con `business_name`).
  - Certificado ARCA (.crt) y Clave privada ARCA (.key) — uploads con estado
    "cargado/no cargado".
  - Disclaimer exacto debajo: "Cotizapp emite facturas con los datos que vos
    cargás. Para dudas sobre tu situación fiscal, consultá a tu contador."
  - Voseo en todos los labels y mensajes ("Cargá", "Ingresá tu CUIT", etc.).
- `app/(dashboard)/perfil-empresa/page.tsx`: obtiene `profile` + `fiscalProfile`;
  si `isArgentina(profile.country)` → renderiza `<FiscalProfileForm ...>`; si no,
  no muestra nada.

## 6. Testing

- Puras (unit): `isValidCuitFormat`/`normalizeCuit`, `normalizeContributorType`,
  `normalizeSalesPoint`, `isArgentina`, validación de upload (extensión/tamaño),
  lista de países (Argentina presente).
- Wiring (source-regex, patrón del repo): perfil-empresa renderiza
  `FiscalProfileForm` bajo condición de país; user-profile-form usa selector.
- General: `tsc --noEmit`, `lint`, `npm test`, `npm run build`.

## 7. Pasos manuales del usuario (Dashboard de `cotizapp-ia`)

El plan incluirá el SQL exacto para: (a) crear `fiscal_profiles` + su policy RLS;
(b) crear el bucket privado `fiscal` + su policy de storage. Sin esos pasos, el
form guardará/leerá con RLS fail-closed (no rompe la app, pero la sección no
persiste hasta aplicarlos). El código tolera la ausencia (mensajes amigables).

## Convenciones

- Texto UI en voseo rioplatense; nunca "presupuesto".
- Sin colores hardcodeados fuera del design system; sin librerías nuevas (reusar
  shadcn/ui y los helpers de storage existentes).
- Componentes en `/components`, lógica en `/lib`, acciones en `/app/actions`,
  uploads vía route handlers.
- RLS con `public.clerk_user_id()`, nunca `auth.uid()` ni `current_setting(...)`.

## Fuera de alcance (fase siguiente)

Emisión de facturas electrónicas contra ARCA/AFIP (usar cert/key para firmar y
llamar a los web services, CAE, tipos de comprobante A/B/C, etc.).

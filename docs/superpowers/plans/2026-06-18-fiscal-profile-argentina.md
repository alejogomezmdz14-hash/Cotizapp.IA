# Datos Fiscales (Argentina) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una sección "Datos Fiscales" (CUIT, tipo de contribuyente, punto de venta, razón social, cert/key ARCA) en Mi empresa, visible solo para usuarios de Argentina, con persistencia en `fiscal_profiles` (RLS por Clerk) y los archivos en un bucket privado.

**Architecture:** Funciones puras de validación/normalización en `lib/`, una server action única (`saveFiscalProfileAction`) que upsertea los textos y sube cert/key en el mismo submit, un form cliente en Mi empresa renderizado condicionalmente según `isArgentina(profile.country)`, y el campo País convertido a selector. RLS y storage keyean por `clerk_user_id` vía `public.clerk_user_id()`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (anon key + JWT de Clerk + RLS), shadcn/ui + `<select>` nativo estilado (no hay primitivo Select en el repo), tests con `node:test` vía `tsx --test`.

**Entorno:** Rama nueva desde `main`. Spec: `docs/superpowers/specs/2026-06-18-fiscal-profile-argentina-design.md`. Alcance: captura + storage; NO emisión ARCA.

**Nota git:** Al commitear, git imprime warnings inofensivos ("LF will be replaced by CRLF", "failed to delete '.git/worktrees/...': Permission denied"). No son fallos — confirmar con `git log --oneline -1`.

**Pasos manuales del usuario (Dashboard de cotizapp-ia):** Task 1 produce el SQL que el usuario debe correr (tabla + RLS + bucket + policy de storage). Hasta aplicarlo, el form falla-closed con mensajes amigables; el resto de la app no se afecta.

---

## Mapa de archivos

- Create: `supabase/migrations/20260618_fiscal_profiles.sql` — tabla + RLS + bucket + storage policy (se aplica a mano).
- Modify: `lib/storage/buckets.ts` — agregar `fiscal: "fiscal"`.
- Create: `lib/profile-countries.ts` — lista de países + `isArgentina`.
- Test: `tests/profile-countries.test.ts`.
- Modify: `components/profile/user-profile-form.tsx` — País: input → `<select>`.
- Create: `lib/fiscal-profile.ts` — tipos, validación/normalización de CUIT/tipo/punto de venta, get/upsert.
- Test: `tests/fiscal-profile.test.ts`.
- Modify: `lib/uploads.ts` — validación de credenciales fiscales (.crt/.key + tamaño).
- Test: `tests/fiscal-uploads.test.ts`.
- Create: `app/actions/fiscal.ts` — `saveFiscalProfileAction` (texto + subida cert/key).
- Create: `components/profile/fiscal-profile-form.tsx` — el formulario.
- Modify: `app/(dashboard)/perfil-empresa/page.tsx` — render condicional por país.
- Test: `tests/fiscal-profile-page.test.ts` — wiring.

---

## Task 1: Migración SQL + constante de bucket

**Files:**
- Create: `supabase/migrations/20260618_fiscal_profiles.sql`
- Modify: `lib/storage/buckets.ts`

- [ ] **Step 1: Crear la migración SQL**

Crear `supabase/migrations/20260618_fiscal_profiles.sql`:

```sql
-- Datos fiscales (Argentina). Keyea por clerk_user_id (no profile UUID), igual
-- que la policy. RLS usa public.clerk_user_id() (= auth.jwt()->>'sub'); esta app
-- NO usa current_setting('app.current_user_id').

create table if not exists public.fiscal_profiles (
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

drop policy if exists "Users manage their own fiscal profile" on public.fiscal_profiles;
create policy "Users manage their own fiscal profile"
  on public.fiscal_profiles
  for all
  to authenticated
  using (clerk_user_id = public.clerk_user_id())
  with check (clerk_user_id = public.clerk_user_id());

-- Bucket privado para cert/key.
insert into storage.buckets (id, name, public)
values ('fiscal', 'fiscal', false)
on conflict (id) do nothing;

drop policy if exists "Users manage their own fiscal credentials" on storage.objects;
create policy "Users manage their own fiscal credentials"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'fiscal'
    and (storage.foldername(name))[1] = public.clerk_user_id()
  )
  with check (
    bucket_id = 'fiscal'
    and (storage.foldername(name))[1] = public.clerk_user_id()
  );
```

- [ ] **Step 2: Agregar el bucket a la constante**

En `lib/storage/buckets.ts`, agregar la línea `fiscal: "fiscal",` dentro del objeto `STORAGE_BUCKETS` (después de `quotationSignatures`). El objeto queda:

```ts
export const STORAGE_BUCKETS = {
  businessAssets: "business-assets",
  quotationAttachments: "quotation-attachments",
  quotationPdfs: "quotation-pdfs",
  quotationSharePdfs: "quotation-share-pdfs",
  invoiceUploads: "invoice-uploads",
  expenseReceipts: "expense-receipts",
  quotationSignatures: "quotation-signatures",
  fiscal: "fiscal",
} as const;
```

- [ ] **Step 3: Typecheck**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add supabase/migrations/20260618_fiscal_profiles.sql lib/storage/buckets.ts && git commit -m "feat(fiscal): migracion de fiscal_profiles + bucket privado fiscal

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Lista de países + isArgentina

**Files:**
- Create: `lib/profile-countries.ts`
- Test: `tests/profile-countries.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/profile-countries.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { PROFILE_COUNTRIES, isArgentina } from "../lib/profile-countries";

test("PROFILE_COUNTRIES incluye Argentina", () => {
  assert.ok(PROFILE_COUNTRIES.includes("Argentina"));
});

test("isArgentina reconoce variantes y acentos/espacios", () => {
  assert.equal(isArgentina("Argentina"), true);
  assert.equal(isArgentina("  argentina "), true);
  assert.equal(isArgentina("ARGENTINA"), true);
  assert.equal(isArgentina("AR"), true);
});

test("isArgentina rechaza otros países y vacío", () => {
  assert.equal(isArgentina("México"), false);
  assert.equal(isArgentina(""), false);
  assert.equal(isArgentina(null), false);
});
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/profile-countries.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar lib/profile-countries.ts**

```ts
export const PROFILE_COUNTRIES = [
  "Argentina",
  "Bolivia",
  "Brasil",
  "Chile",
  "Colombia",
  "Ecuador",
  "México",
  "Paraguay",
  "Perú",
  "Uruguay",
  "Venezuela",
  "Otro",
] as const;

export type ProfileCountry = (typeof PROFILE_COUNTRIES)[number];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export function isArgentina(country: string | null | undefined): boolean {
  if (!country) {
    return false;
  }

  const normalized = normalize(country);
  return normalized === "argentina" || normalized === "ar";
}
```

- [ ] **Step 4: Correr el test para verlo pasar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/profile-countries.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/profile-countries.ts tests/profile-countries.test.ts && git commit -m "feat(profile): lista de paises + deteccion isArgentina

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Campo País como selector

**Files:**
- Modify: `components/profile/user-profile-form.tsx`
- Test: `tests/fiscal-profile-page.test.ts` (se crea acá la primera parte; se completa en Task 7)

- [ ] **Step 1: Escribir el test de cableado (falla primero)**

Crear `tests/fiscal-profile-page.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("user-profile-form usa un selector de país poblado con PROFILE_COUNTRIES", async () => {
  const source = await readFile(
    new URL("../components/profile/user-profile-form.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /PROFILE_COUNTRIES/);
  assert.match(source, /<select[\s\S]*name="country"/);
});
```

- [ ] **Step 2: Correr para verlo fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/fiscal-profile-page.test.ts`
Expected: FAIL — el form todavía usa `<Input name="country">`.

- [ ] **Step 3: Convertir el campo País a `<select>`**

En `components/profile/user-profile-form.tsx`:
1. Agregar el import: `import { PROFILE_COUNTRIES } from "@/lib/profile-countries";`
2. Reemplazar el bloque actual del campo país (el `<Input id="country" name="country" ...>`) por un `<select>` nativo estilado con tokens del design system:

```tsx
<div className="space-y-2">
  <Label htmlFor="country">País</Label>
  <select
    id="country"
    name="country"
    defaultValue={profile?.country ?? ""}
    className="flex h-10 w-full rounded-md border border-token bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
  >
    <option value="">Seleccioná tu país</option>
    {PROFILE_COUNTRIES.map((country) => (
      <option key={country} value={country}>
        {country}
      </option>
    ))}
  </select>
</div>
```

No cambiar el resto del form ni su `action`. El `name="country"` se mantiene, así que la acción de guardado existente sigue funcionando.

- [ ] **Step 4: Correr el test para verlo pasar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/fiscal-profile-page.test.ts`
Expected: PASS (1 test por ahora).

- [ ] **Step 5: Typecheck + lint**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add components/profile/user-profile-form.tsx tests/fiscal-profile-page.test.ts && git commit -m "feat(profile): campo Pais como selector

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: lib/fiscal-profile.ts (validación + datos)

**Files:**
- Create: `lib/fiscal-profile.ts`
- Test: `tests/fiscal-profile.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/fiscal-profile.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidCuitFormat,
  normalizeCuit,
  normalizeContributorType,
  normalizeSalesPoint,
} from "../lib/fiscal-profile";

test("normalizeCuit formatea 11 dígitos a XX-XXXXXXXX-X", () => {
  assert.equal(normalizeCuit("20123456789"), "20-12345678-9");
  assert.equal(normalizeCuit("20-12345678-9"), "20-12345678-9");
  assert.equal(normalizeCuit(" 20 12345678 9 "), "20-12345678-9");
});

test("normalizeCuit devuelve el original (trim) si no son 11 dígitos", () => {
  assert.equal(normalizeCuit("123"), "123");
});

test("isValidCuitFormat acepta solo el formato XX-XXXXXXXX-X", () => {
  assert.equal(isValidCuitFormat("20-12345678-9"), true);
  assert.equal(isValidCuitFormat("20123456789"), false);
  assert.equal(isValidCuitFormat("2-12345678-9"), false);
  assert.equal(isValidCuitFormat(""), false);
});

test("normalizeContributorType valida los dos tipos", () => {
  assert.equal(normalizeContributorType("monotributista"), "monotributista");
  assert.equal(
    normalizeContributorType("Responsable_Inscripto"),
    "responsable_inscripto",
  );
  assert.equal(normalizeContributorType("otro"), null);
});

test("normalizeSalesPoint deja solo dígitos y rellena a 4", () => {
  assert.equal(normalizeSalesPoint("1"), "0001");
  assert.equal(normalizeSalesPoint("0001"), "0001");
  assert.equal(normalizeSalesPoint("12"), "0012");
  assert.equal(normalizeSalesPoint("abc1"), "0001");
  assert.equal(normalizeSalesPoint(""), "");
});
```

- [ ] **Step 2: Correr para verlos fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/fiscal-profile.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar lib/fiscal-profile.ts**

```ts
import { createClient } from "@/lib/supabase/server";

export type ContributorType = "monotributista" | "responsable_inscripto";

export type FiscalProfile = {
  id: string;
  clerk_user_id: string;
  cuit: string;
  contributor_type: ContributorType;
  sales_point: string;
  business_name: string;
  cert_path: string | null;
  key_path: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const CUIT_FORMAT = /^\d{2}-\d{8}-\d$/;

export function normalizeCuit(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 11) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  }

  return value.trim();
}

export function isValidCuitFormat(value: string): boolean {
  return CUIT_FORMAT.test(value.trim());
}

export function normalizeContributorType(
  value: string | null | undefined,
): ContributorType | null {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (normalized === "monotributista" || normalized === "responsable_inscripto") {
    return normalized;
  }

  return null;
}

export function normalizeSalesPoint(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  return digits.length >= 4 ? digits : digits.padStart(4, "0");
}

export async function getFiscalProfile(
  clerkUserId: string,
): Promise<FiscalProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fiscal_profiles")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) {
    console.error("[fiscal] getFiscalProfile failed", { reason: error.message });
    return null;
  }

  return (data as FiscalProfile | null) ?? null;
}
```

- [ ] **Step 4: Correr para verlos pasar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/fiscal-profile.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/fiscal-profile.ts tests/fiscal-profile.test.ts && git commit -m "feat(fiscal): validacion de CUIT/tipo/punto de venta + lectura de fiscal_profiles

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Validación de subida de credenciales (.crt/.key)

**Files:**
- Modify: `lib/uploads.ts`
- Test: `tests/fiscal-uploads.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/fiscal-uploads.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  FISCAL_CREDENTIAL_MAX_BYTES,
  assertValidFiscalCredential,
} from "../lib/uploads";

function fakeFile(name: string, size: number) {
  return { name, size } as File;
}

test("acepta .crt para kind cert y .key para kind key dentro del límite", () => {
  assert.doesNotThrow(() =>
    assertValidFiscalCredential(fakeFile("cert.crt", 2000), "cert"),
  );
  assert.doesNotThrow(() =>
    assertValidFiscalCredential(fakeFile("private.key", 2000), "key"),
  );
});

test("rechaza extensión que no corresponde al kind", () => {
  assert.throws(() =>
    assertValidFiscalCredential(fakeFile("cert.key", 2000), "cert"),
  );
  assert.throws(() =>
    assertValidFiscalCredential(fakeFile("private.crt", 2000), "key"),
  );
});

test("rechaza archivos por encima del límite de tamaño", () => {
  assert.throws(() =>
    assertValidFiscalCredential(
      fakeFile("cert.crt", FISCAL_CREDENTIAL_MAX_BYTES + 1),
      "cert",
    ),
  );
});
```

- [ ] **Step 2: Correr para verlos fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/fiscal-uploads.test.ts`
Expected: FAIL — exports inexistentes.

- [ ] **Step 3: Agregar la validación a lib/uploads.ts**

Al final de `lib/uploads.ts` (que ya exporta `UploadActionError`), agregar:

```ts
export const FISCAL_CREDENTIAL_MAX_BYTES = 64 * 1024;

export type FiscalCredentialKind = "cert" | "key";

const FISCAL_CREDENTIAL_EXTENSION: Record<FiscalCredentialKind, string> = {
  cert: ".crt",
  key: ".key",
};

export function assertValidFiscalCredential(
  file: File,
  kind: FiscalCredentialKind,
): void {
  const expectedExtension = FISCAL_CREDENTIAL_EXTENSION[kind];

  if (!file.name.toLowerCase().endsWith(expectedExtension)) {
    throw new UploadActionError(
      `El archivo debe tener extensión ${expectedExtension}.`,
      400,
    );
  }

  if (file.size <= 0) {
    throw new UploadActionError("El archivo está vacío.", 400);
  }

  if (file.size > FISCAL_CREDENTIAL_MAX_BYTES) {
    throw new UploadActionError(
      "El archivo es demasiado grande (máximo 64 KB).",
      400,
    );
  }
}
```

(Nota: `UploadActionError` ya está definido arriba en el mismo archivo; no re-importar.)

- [ ] **Step 4: Correr para verlos pasar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/fiscal-uploads.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/uploads.ts tests/fiscal-uploads.test.ts && git commit -m "feat(fiscal): validacion de credenciales .crt/.key (extension + tamano)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Server action saveFiscalProfileAction

**Files:**
- Create: `app/actions/fiscal.ts`

Sin test unitario nuevo (integra requireUser + Supabase + storage; se cubre con build y los puros ya testeados). 

- [ ] **Step 1: Implementar app/actions/fiscal.ts**

```ts
"use server";

import { revalidatePath } from "next/cache";

import {
  isValidCuitFormat,
  normalizeContributorType,
  normalizeCuit,
  normalizeSalesPoint,
} from "@/lib/fiscal-profile";
import { requireUser } from "@/lib/profile";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import { uploadFile } from "@/lib/storage/server";
import { createClient } from "@/lib/supabase/server";
import {
  assertValidFiscalCredential,
  UploadActionError,
  type FiscalCredentialKind,
} from "@/lib/uploads";

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

export async function saveFiscalProfileAction(formData: FormData) {
  const user = await requireUser();

  const cuit = normalizeCuit(readText(formData, "cuit"));
  const contributorType = normalizeContributorType(
    readText(formData, "contributor_type"),
  );
  const salesPoint = normalizeSalesPoint(readText(formData, "sales_point"));
  const businessName = readText(formData, "business_name");

  if (!isValidCuitFormat(cuit)) {
    throw new Error("El CUIT debe tener el formato XX-XXXXXXXX-X.");
  }
  if (!contributorType) {
    throw new Error("Elegí un tipo de contribuyente válido.");
  }
  if (!salesPoint) {
    throw new Error("Ingresá el punto de venta.");
  }
  if (!businessName) {
    throw new Error("Ingresá la razón social.");
  }

  const supabase = await createClient();

  // 1) Upsert de los textos (crea la fila si no existe; satisface NOT NULL).
  const { error: upsertError } = await supabase.from("fiscal_profiles").upsert(
    {
      clerk_user_id: user.clerkId,
      cuit,
      contributor_type: contributorType,
      sales_point: salesPoint,
      business_name: businessName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clerk_user_id" },
  );

  if (upsertError) {
    console.error("[fiscal] upsert failed", { reason: upsertError.message });
    throw new Error("No se pudieron guardar los datos fiscales.");
  }

  // 2) Subir cert/key si vinieron en este submit, y guardar el path.
  const uploads: Array<{ kind: FiscalCredentialKind; column: "cert_path" | "key_path"; objectName: string }> = [
    { kind: "cert", column: "cert_path", objectName: "cert.crt" },
    { kind: "key", column: "key_path", objectName: "private.key" },
  ];

  for (const { kind, column, objectName } of uploads) {
    const file = readFile(formData, kind);

    if (!file) {
      continue;
    }

    try {
      assertValidFiscalCredential(file, kind);
    } catch (error) {
      if (error instanceof UploadActionError) {
        throw new Error(error.message);
      }
      throw error;
    }

    const path = `${user.clerkId}/${objectName}`;
    const body = await file.arrayBuffer();

    await uploadFile({
      bucket: STORAGE_BUCKETS.fiscal,
      path,
      body,
      upsert: true,
    });

    const { error: pathError } = await supabase
      .from("fiscal_profiles")
      .update({ [column]: path, updated_at: new Date().toISOString() })
      .eq("clerk_user_id", user.clerkId);

    if (pathError) {
      console.error("[fiscal] path update failed", { reason: pathError.message });
      throw new Error("No se pudo asociar el archivo a tus datos fiscales.");
    }
  }

  revalidatePath("/perfil-empresa");
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add app/actions/fiscal.ts && git commit -m "feat(fiscal): saveFiscalProfileAction (texto + subida de cert/key)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Formulario + render condicional en Mi empresa

**Files:**
- Create: `components/profile/fiscal-profile-form.tsx`
- Modify: `app/(dashboard)/perfil-empresa/page.tsx`
- Test: `tests/fiscal-profile-page.test.ts` (completar)

- [ ] **Step 1: Completar el test de cableado (falla primero)**

Agregar al final de `tests/fiscal-profile-page.test.ts` (ya creado en Task 3):

```ts
test("FiscalProfileForm tiene los campos fiscales y el disclaimer", async () => {
  const source = await readFile(
    new URL("../components/profile/fiscal-profile-form.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /saveFiscalProfileAction/);
  assert.match(source, /name="cuit"/);
  assert.match(source, /name="contributor_type"/);
  assert.match(source, /name="sales_point"/);
  assert.match(source, /name="business_name"/);
  assert.match(source, /name="cert"/);
  assert.match(source, /name="key"/);
  assert.match(source, /consultá a tu contador/);
});

test("perfil-empresa renderiza FiscalProfileForm solo si isArgentina", async () => {
  const source = await readFile(
    new URL("../app/(dashboard)/perfil-empresa/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /isArgentina/);
  assert.match(source, /<FiscalProfileForm/);
});
```

- [ ] **Step 2: Correr para verlo fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/fiscal-profile-page.test.ts`
Expected: FAIL — el form y el cableado no existen.

- [ ] **Step 3: Crear components/profile/fiscal-profile-form.tsx**

```tsx
"use client";

import { saveFiscalProfileAction } from "@/app/actions/fiscal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FiscalProfile } from "@/lib/fiscal-profile";

type FiscalProfileFormProps = {
  fiscalProfile: FiscalProfile | null;
  defaultCuit: string;
  defaultBusinessName: string;
};

const selectClassName =
  "flex h-10 w-full rounded-md border border-token bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function FiscalProfileForm({
  fiscalProfile,
  defaultCuit,
  defaultBusinessName,
}: FiscalProfileFormProps) {
  return (
    <section className="shell-panel space-y-5 px-4 py-5 sm:px-6 sm:py-6">
      <div className="space-y-1">
        <h3 className="text-xl font-semibold tracking-tight">Datos Fiscales</h3>
        <p className="text-sm text-muted-foreground">
          Necesarios para emitir facturas en Argentina.
        </p>
      </div>

      <form action={saveFiscalProfileAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cuit">CUIT</Label>
          <Input
            id="cuit"
            name="cuit"
            placeholder="Ej. 20-12345678-9"
            defaultValue={fiscalProfile?.cuit ?? defaultCuit}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contributor_type">Tipo de contribuyente</Label>
          <select
            id="contributor_type"
            name="contributor_type"
            defaultValue={fiscalProfile?.contributor_type ?? ""}
            required
            className={selectClassName}
          >
            <option value="">Elegí una opción</option>
            <option value="monotributista">Monotributista</option>
            <option value="responsable_inscripto">Responsable Inscripto</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sales_point">Punto de venta</Label>
          <Input
            id="sales_point"
            name="sales_point"
            placeholder="Ej. 0001"
            defaultValue={fiscalProfile?.sales_point ?? ""}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="business_name">Razón social</Label>
          <Input
            id="business_name"
            name="business_name"
            placeholder="Ej. Juan Pérez"
            defaultValue={fiscalProfile?.business_name ?? defaultBusinessName}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cert">Certificado ARCA (.crt)</Label>
            <Input id="cert" name="cert" type="file" accept=".crt" />
            {fiscalProfile?.cert_path ? (
              <p className="text-xs text-accent-token">Certificado cargado ✓</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="key">Clave privada ARCA (.key)</Label>
            <Input id="key" name="key" type="file" accept=".key" />
            {fiscalProfile?.key_path ? (
              <p className="text-xs text-accent-token">Clave cargada ✓</p>
            ) : null}
          </div>
        </div>

        <Button type="submit" className="min-h-11">
          Guardar datos fiscales
        </Button>
      </form>

      <p className="text-xs leading-5 text-muted-foreground">
        Cotizapp emite facturas con los datos que vos cargás. Para dudas sobre tu
        situación fiscal, consultá a tu contador.
      </p>
    </section>
  );
}
```

- [ ] **Step 4: Cablear en app/(dashboard)/perfil-empresa/page.tsx**

Leer el archivo. Es un Server Component que ya obtiene el `profile`. Aplicar:
1. Agregar imports:
```tsx
import { FiscalProfileForm } from "@/components/profile/fiscal-profile-form";
import { getFiscalProfile } from "@/lib/fiscal-profile";
import { isArgentina } from "@/lib/profile-countries";
```
2. Después de obtener `profile` (y `user`), obtener el fiscal profile cuando corresponda:
```tsx
const showFiscal = isArgentina(profile?.country ?? null);
const fiscalProfile = showFiscal
  ? await getFiscalProfile(user.clerkId).catch(() => null)
  : null;
```
(Si en el archivo la variable del usuario no se llama `user`, usar la que exista; `requireUser()`/`getCurrentUser()` devuelven `clerkId`.)
3. Donde termina el contenido principal de la página (después del `<BusinessProfileForm .../>` o equivalente), agregar el render condicional:
```tsx
{showFiscal ? (
  <FiscalProfileForm
    fiscalProfile={fiscalProfile}
    defaultCuit={profile?.tax_id ?? ""}
    defaultBusinessName={profile?.business_name ?? ""}
  />
) : null}
```
No cambiar el resto de la página.

- [ ] **Step 5: Correr el test de cableado para verlo pasar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/fiscal-profile-page.test.ts`
Expected: PASS (3 tests en total — el de Task 3 + los 2 nuevos).

- [ ] **Step 6: Typecheck + lint**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add components/profile/fiscal-profile-form.tsx "app/(dashboard)/perfil-empresa/page.tsx" tests/fiscal-profile-page.test.ts && git commit -m "feat(fiscal): formulario de Datos Fiscales en Mi empresa (solo Argentina)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Verificación final

**Files:** ninguno.

- [ ] **Step 1: Suite completa**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npm test 2>&1 | tail -12`
Expected: `# fail 0`. Total ≈ 224 (base de main) + 3 (countries) + 5 (fiscal-profile) + 3 (fiscal-uploads) + 3 (fiscal-profile-page) = ~238.

- [ ] **Step 2: Typecheck + lint**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint`
Expected: exit 0, sin warnings.

- [ ] **Step 3: Build (limpiar .next primero por flakiness de OneDrive)**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && rm -rf .next; npm run build 2>&1 | tail -15; echo "EXIT:${PIPESTATUS[0]}"`
Expected: EXIT:0 y tabla de rutas.

- [ ] **Step 4: Recordatorio de pasos manuales**

Avisar al usuario que, para que la sección persista, debe correr en el SQL Editor del Dashboard de `cotizapp-ia` el contenido de `supabase/migrations/20260618_fiscal_profiles.sql` (tabla + RLS + bucket + storage policy).

---

## Self-review (cobertura del spec)

- Tabla `fiscal_profiles` + RLS `clerk_user_id()` → Task 1. ✓
- Bucket privado `fiscal` + storage policy por clerk_user_id → Task 1. ✓
- País → selector + `isArgentina` → Tasks 2 y 3. ✓
- CUIT solo formato, prellenado de `tax_id` → Task 4 (validación) + Task 7 (`defaultCuit={profile.tax_id}`). ✓
- Tipo contribuyente / punto de venta / razón social (prellena business_name) → Tasks 4, 6, 7. ✓
- Subida .crt/.key (extensión + tamaño) a `{clerk_user_id}/...` → Tasks 5 y 6. ✓
- Form en Mi empresa, solo Argentina, shadcn/tokens/voseo + disclaimer exacto → Task 7. ✓
- Tests de puras + wiring → Tasks 2,4,5,3,7; verificación → Task 8. ✓
- Fuera de alcance (emisión ARCA) respetado. ✓
- Tipos/nombres consistentes: `isArgentina`, `FiscalProfile`, `ContributorType`, `normalizeCuit`/`isValidCuitFormat`/`normalizeContributorType`/`normalizeSalesPoint`, `assertValidFiscalCredential`/`FISCAL_CREDENTIAL_MAX_BYTES`/`FiscalCredentialKind`, `saveFiscalProfileAction`, `STORAGE_BUCKETS.fiscal` usados igual en todas las tareas. ✓

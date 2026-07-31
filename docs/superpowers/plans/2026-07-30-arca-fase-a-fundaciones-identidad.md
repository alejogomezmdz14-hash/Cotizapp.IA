# ARCA Camino 1 — Fase A: fundaciones criptográficas e identidad fiscal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los tres hallazgos críticos de la auditoría: que la clave privada fiscal quede cifrada y fuera del alcance del navegador, y que el CUIT lo determine el certificado en vez del formulario.

**Architecture:** Un sobre criptográfico AES-256-GCM puro y testeable (`lib/crypto/`), una tabla `fiscal_credentials` con RLS de negación total accesible solo con `service_role` desde el servidor, y un parser de certificados X.509 con node-forge que extrae el CUIT del subject y verifica la correspondencia clave↔certificado. Nada de esto toca todavía la emisión: al terminar esta fase el sistema guarda y valida credenciales de forma segura, y sigue emitiendo como hoy.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (`@supabase/supabase-js` 2.106.1), `node:crypto`, `node-forge` 1.4.0, tests con `node:test` vía `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-07-30-arca-camino-1-design.md` (secciones 4.2, 4.3, 4.5, 4.5.1, 5, 6, 9).

**Planes hermanos:** Fase B (wizard + ticket WSAA) y Fase C (integridad de emisión + receptor) se escriben después de esta.

## Global Constraints

- Todo el texto de la UI y todos los mensajes de error, en **español latino neutro**. Nunca mostrar errores técnicos crudos.
- Nunca usar el userId de Clerk (`user_xxx`) en queries de tablas que keyean por UUID. `requireUser().id` es el UUID de `profiles`; `requireUser().clerkId` es el de Clerk. `fiscal_credentials` keyea por **`clerk_user_id`**.
- **Fail closed:** si falta `FISCAL_ENCRYPTION_KEY`, no se guarda material fiscal en claro. Nunca `slice(0,32)` ni padding sobre la clave.
- La validación de env vars es **perezosa** (al primer uso), nunca al cargar el módulo: `next build` corre sin las variables de producción y un throw en el import rompe el build. Ver el precedente en `lib/supabase/server.ts:13-21`.
- El sobre criptográfico es **exactamente** `magic "CZFK" (4) || version (1) || keyId (1) || iv (12) || tag (16) || ciphertext`. Cambiarlo después obliga a re-cifrar el material de todos.
- `AAD = "${version}|${keyId}|${clerkUserId}|${purpose}"`, construida en el servidor. **Nunca se lee del blob.**
- IV con `crypto.randomBytes(12)` por operación. `createCipheriv` siempre, nunca `createCipher`. `setAAD()` antes del primer `update()`. `setAuthTag()` obligatorio antes de `final()` al descifrar.
- Migraciones SQL: se escriben en `supabase/migrations/` y **el usuario las aplica a mano** en el SQL Editor del Dashboard del proyecto `cotizapp-ia`.
- Baseline de tests: en `main` hay ~12 tests que fallan desde antes. Los tests nuevos deben pasar y ese número no debe aumentar. No se exige "fail 0" global.
- Al commitear, git imprime warnings inofensivos (`LF will be replaced by CRLF`, `failed to delete '.git/worktrees/...': Permission denied`). No son fallos — confirmar con `git log --oneline -1`.
- Rama de trabajo: `feat/arca-camino-1` (ya creada, con el spec commiteado).

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/20260730_fiscal_credentials.sql` | Tabla `fiscal_credentials` con RLS de negación total. Se aplica a mano. |
| `lib/crypto/envelope.ts` | `seal` / `open` del sobre AES-256-GCM. Puro: recibe la clave, no la busca. |
| `lib/crypto/fiscal-key.ts` | Carga y valida el llavero desde el entorno. Perezoso, fail closed. |
| `lib/log.ts` | `logError(scope, error)` que extrae solo `{ name, message }`. |
| `lib/supabase/service-role.ts` | Cliente privilegiado. `import "server-only"` + regla de ESLint que restringe quién puede importarlo. |
| `lib/fiscal/certificate.ts` | Parseo X.509, extracción del CUIT, correspondencia clave↔certificado, vencimiento. Puro. |
| `lib/fiscal/credentials.ts` | Guardar y leer credenciales cifradas. Único lugar que descifra. |
| `tests/crypto-envelope.test.ts` | Sobre criptográfico. |
| `tests/crypto-fiscal-key.test.ts` | Llavero. |
| `tests/log-error.test.ts` | Helper de logging. |
| `tests/fiscal-certificate.test.ts` | Parser de certificados, con fixture generado en el propio test. |

---

## Task 1: Migración SQL de `fiscal_credentials`

**Files:**
- Create: `supabase/migrations/20260730_fiscal_credentials.sql`

**Interfaces:**
- Produces: la tabla `public.fiscal_credentials` que consumen las Tasks 8 y 9.

- [ ] **Step 1: Crear la migración**

Crear `supabase/migrations/20260730_fiscal_credentials.sql`:

```sql
-- Credenciales fiscales de ARCA (Camino 1). La clave privada se guarda CIFRADA
-- con AES-256-GCM y el CUIT se extrae del certificado, no del formulario.
--
-- RLS de negación total: la tabla tiene RLS activo y NINGUNA policy, así que el
-- rol `authenticated` no ve nada. Solo se accede con service_role desde el
-- servidor. Esto es deliberado: el material fiscal no debe ser alcanzable con el
-- anon key + el JWT de Clerk, que están los dos en el navegador.
--
-- Se aplica a mano en el SQL Editor del Dashboard (proyecto cotizapp-ia).

create table if not exists public.fiscal_credentials (
  clerk_user_id       text primary key,
  cuit                text not null,
  -- El sobre AES-256-GCM completo, en base64. Es `text` y no `bytea` a
  -- propósito: PostgREST transporta JSON, así que un bytea vuelve como string
  -- hexadecimal "\x..." al leer y no acepta un Buffer al escribir.
  private_key_enc     text not null,
  cert_pem            text,
  cert_serial         text,
  cert_not_after      timestamptz,
  key_id              smallint not null default 1,
  csr_pem             text,
  verified_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.fiscal_credentials enable row level security;

revoke all on public.fiscal_credentials from authenticated, anon;

-- Un CUIT verificado pertenece a una sola cuenta.
create unique index if not exists fiscal_credentials_cuit_verificado
  on public.fiscal_credentials (cuit)
  where verified_at is not null;
```

- [ ] **Step 2: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add supabase/migrations/20260730_fiscal_credentials.sql && git commit -m "feat(fiscal): migracion de fiscal_credentials con RLS de negacion total

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Expected: commit creado. Verificar con `git log --oneline -1`.

- [ ] **Step 3: Avisar al usuario**

Decirle que corra el contenido de `supabase/migrations/20260730_fiscal_credentials.sql` en el SQL Editor del Dashboard de `cotizapp-ia`. Hasta que lo haga, las Tasks 8 y 9 no se pueden probar contra la base real, pero el resto del plan avanza igual.

---

## Task 2: Dependencias

**Files:**
- Modify: `package.json`, `package-lock.json` (vía npm)

**Interfaces:**
- Produces: `node-forge` y `@types/node-forge` importables; `@arcasdk/core` fijado.

- [ ] **Step 1: Fijar el SDK y declarar node-forge**

Run:
```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npm install --save-exact @arcasdk/core@1.3.1 && npm install --save node-forge@1.4.0 && npm install --save-dev @types/node-forge
```

Expected: exit 0. En `package.json`, `"@arcasdk/core": "1.3.1"` (sin `^`) y `"node-forge": "^1.4.0"` en `dependencies`, `"@types/node-forge"` en `devDependencies`.

- [ ] **Step 2: Verificar que quedó fijo y que forge tipa**

Run:
```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && node -e "const p=require('./package.json'); console.log('arca:',p.dependencies['@arcasdk/core'],'| forge:',p.dependencies['node-forge'],'| types:',p.devDependencies['@types/node-forge'])"
```

Expected: `arca: 1.3.1 | forge: ^1.4.0 | types: ^1.3.x` (el patch de los types puede variar).

- [ ] **Step 3: Typecheck**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add package.json package-lock.json && git commit -m "chore(fiscal): fijar @arcasdk/core 1.3.1 y declarar node-forge como dependencia directa

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `lib/crypto/envelope.ts` — el sobre AES-256-GCM

El corazón de todo. Puro: recibe la clave como parámetro, no la busca en el entorno. Eso lo hace testeable sin variables de entorno.

**Files:**
- Create: `lib/crypto/envelope.ts`
- Test: `tests/crypto-envelope.test.ts`

**Interfaces:**
- Produces:
  - `type EnvelopeKey = { keyId: number; key: Buffer }`
  - `class EnvelopeError extends Error`
  - `function seal(key: EnvelopeKey, plaintext: Buffer | string, aadContext: string): Buffer`
  - `function open(keys: EnvelopeKey[], blob: Buffer, aadContext: string): Buffer`
  - `const ENVELOPE_VERSION = 1`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/crypto-envelope.test.ts`:

```ts
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import {
  EnvelopeError,
  open,
  seal,
  type EnvelopeKey,
} from "../lib/crypto/envelope";

const KEY_A: EnvelopeKey = { keyId: 1, key: randomBytes(32) };
const KEY_B: EnvelopeKey = { keyId: 2, key: randomBytes(32) };

const AAD_USER_A = "user_aaa|fiscal-private-key";
const AAD_USER_B = "user_bbb|fiscal-private-key";

const SECRET = "-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n";

test("seal y open hacen ida y vuelta", () => {
  const blob = seal(KEY_A, SECRET, AAD_USER_A);
  assert.equal(open([KEY_A], blob, AAD_USER_A).toString("utf8"), SECRET);
});

test("el sobre tiene el layout documentado", () => {
  const blob = seal(KEY_A, "hola", AAD_USER_A);
  assert.equal(blob.subarray(0, 4).toString("ascii"), "CZFK");
  assert.equal(blob[4], 1); // version
  assert.equal(blob[5], 1); // keyId
  assert.equal(blob.length, 34 + Buffer.byteLength("hola"));
});

test("cifrar dos veces el mismo texto da blobs distintos (IV aleatorio)", () => {
  const a = seal(KEY_A, SECRET, AAD_USER_A);
  const b = seal(KEY_A, SECRET, AAD_USER_A);
  assert.notEqual(a.toString("base64"), b.toString("base64"));
  // Y el IV concreto tampoco se repite.
  assert.notEqual(
    a.subarray(6, 18).toString("hex"),
    b.subarray(6, 18).toString("hex"),
  );
});

test("un blob de un usuario no se abre con la AAD de otro", () => {
  const blob = seal(KEY_A, SECRET, AAD_USER_A);
  assert.throws(() => open([KEY_A], blob, AAD_USER_B), EnvelopeError);
});

test("corromper un byte del ciphertext hace fallar la autenticacion", () => {
  const blob = seal(KEY_A, SECRET, AAD_USER_A);
  blob[blob.length - 1] ^= 0xff;
  assert.throws(() => open([KEY_A], blob, AAD_USER_A), EnvelopeError);
});

test("corromper el authTag hace fallar la autenticacion", () => {
  const blob = seal(KEY_A, SECRET, AAD_USER_A);
  blob[20] ^= 0xff; // dentro del tag (offset 18..33)
  assert.throws(() => open([KEY_A], blob, AAD_USER_A), EnvelopeError);
});

test("open elige la clave por keyId y soporta rotacion", () => {
  const blob = seal(KEY_B, SECRET, AAD_USER_A);
  assert.equal(open([KEY_A, KEY_B], blob, AAD_USER_A).toString("utf8"), SECRET);
});

test("open falla si no tiene la clave del keyId del blob", () => {
  const blob = seal(KEY_B, SECRET, AAD_USER_A);
  assert.throws(() => open([KEY_A], blob, AAD_USER_A), EnvelopeError);
});

test("open rechaza un blob que no es del formato", () => {
  assert.throws(
    () => open([KEY_A], Buffer.from("cualquier cosa"), AAD_USER_A),
    EnvelopeError,
  );
});

test("open rechaza un blob truncado", () => {
  const blob = seal(KEY_A, SECRET, AAD_USER_A);
  assert.throws(() => open([KEY_A], blob.subarray(0, 20), AAD_USER_A), EnvelopeError);
});
```

- [ ] **Step 2: Correr para verlos fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/crypto-envelope.test.ts`
Expected: FAIL — el módulo `../lib/crypto/envelope` no existe.

- [ ] **Step 3: Implementar `lib/crypto/envelope.ts`**

```ts
// Sobre criptográfico para material fiscal (clave privada de ARCA, tickets WSAA).
//
// Formato, fijo y versionado:
//   magic "CZFK" (4) || version (1) || keyId (1) || iv (12) || tag (16) || ciphertext
//
// Cambiar este layout obliga a re-cifrar el material de todos los usuarios, por
// eso lleva versión y keyId adentro.
//
// La AAD ata el criptograma a su dueño y a su propósito: GCM autentica el
// contenido, no el contexto, así que sin AAD un blob válido se descifra igual
// esté donde esté. La AAD se construye en el servidor a partir del clerkUserId
// del request; NUNCA se lee del blob.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const ENVELOPE_VERSION = 1;

const MAGIC = Buffer.from("CZFK", "ascii");
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + 1 + 1 + IV_BYTES + TAG_BYTES; // 34

const OFFSET_VERSION = MAGIC.length;
const OFFSET_KEY_ID = OFFSET_VERSION + 1;
const OFFSET_IV = OFFSET_KEY_ID + 1;
const OFFSET_TAG = OFFSET_IV + IV_BYTES;

export type EnvelopeKey = {
  keyId: number;
  key: Buffer;
};

export class EnvelopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvelopeError";
  }
}

function buildAad(version: number, keyId: number, aadContext: string): Buffer {
  return Buffer.from(`${version}|${keyId}|${aadContext}`, "utf8");
}

export function seal(
  { keyId, key }: EnvelopeKey,
  plaintext: Buffer | string,
  aadContext: string,
): Buffer {
  if (key.byteLength !== 32) {
    throw new EnvelopeError("La clave de cifrado debe ser de 32 bytes.");
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  // setAAD va ANTES de cualquier update().
  cipher.setAAD(buildAad(ENVELOPE_VERSION, keyId, aadContext));

  const body = Buffer.concat([
    cipher.update(
      typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : plaintext,
    ),
    cipher.final(),
  ]);
  // getAuthTag solo es válido después de final().
  const tag = cipher.getAuthTag();

  return Buffer.concat([
    MAGIC,
    Buffer.from([ENVELOPE_VERSION, keyId]),
    iv,
    tag,
    body,
  ]);
}

export function open(
  keys: EnvelopeKey[],
  blob: Buffer,
  aadContext: string,
): Buffer {
  if (blob.byteLength < HEADER_BYTES || !blob.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new EnvelopeError("El material cifrado no tiene el formato esperado.");
  }

  const version = blob[OFFSET_VERSION];
  const keyId = blob[OFFSET_KEY_ID];

  if (version !== ENVELOPE_VERSION) {
    throw new EnvelopeError(`Versión de sobre no soportada: ${version}.`);
  }

  const match = keys.find((candidate) => candidate.keyId === keyId);
  if (!match) {
    throw new EnvelopeError(
      `No hay clave de cifrado disponible para el material guardado (keyId ${keyId}).`,
    );
  }

  const iv = blob.subarray(OFFSET_IV, OFFSET_TAG);
  const tag = blob.subarray(OFFSET_TAG, HEADER_BYTES);
  const body = blob.subarray(HEADER_BYTES);

  const decipher = createDecipheriv("aes-256-gcm", match.key, iv);
  decipher.setAAD(buildAad(version, keyId, aadContext));
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    // Autenticación fallida: clave equivocada, AAD equivocada o blob alterado.
    // No distinguimos cuál para no dar señal a un atacante.
    throw new EnvelopeError("No se pudo descifrar el material fiscal.");
  }
}
```

- [ ] **Step 4: Correr para verlos pasar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/crypto-envelope.test.ts`
Expected: PASS — 10 tests, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/crypto/envelope.ts tests/crypto-envelope.test.ts && git commit -m "feat(fiscal): sobre criptografico AES-256-GCM con AAD y versionado

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `lib/crypto/fiscal-key.ts` — el llavero

Lee `FISCAL_ENCRYPTION_KEY` del entorno, valida que sean 32 bytes exactos en base64, y soporta una clave anterior para rotación. **Perezoso**: si validara al importar, `next build` rompería.

**Files:**
- Create: `lib/crypto/fiscal-key.ts`
- Test: `tests/crypto-fiscal-key.test.ts`

**Interfaces:**
- Consumes: `EnvelopeKey` de `lib/crypto/envelope`.
- Produces:
  - `const ACTIVE_KEY_ID = 1`
  - `type FiscalKeyring = { active: EnvelopeKey; all: EnvelopeKey[] }`
  - `function parseFiscalKeyring(env: NodeJS.ProcessEnv): FiscalKeyring` (puro, testeable)
  - `function getFiscalKeyring(): FiscalKeyring` (lee `process.env`, memoiza)

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/crypto-fiscal-key.test.ts`:

```ts
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { ACTIVE_KEY_ID, parseFiscalKeyring } from "../lib/crypto/fiscal-key";

const VALID = randomBytes(32).toString("base64");
const VALID_PREVIOUS = randomBytes(32).toString("base64");

test("acepta una clave base64 de 32 bytes", () => {
  const keyring = parseFiscalKeyring({ FISCAL_ENCRYPTION_KEY: VALID });
  assert.equal(keyring.active.keyId, ACTIVE_KEY_ID);
  assert.equal(keyring.active.key.byteLength, 32);
  assert.equal(keyring.all.length, 1);
});

test("suma la clave anterior para poder rotar", () => {
  const keyring = parseFiscalKeyring({
    FISCAL_ENCRYPTION_KEY: VALID,
    FISCAL_ENCRYPTION_KEY_PREVIOUS: VALID_PREVIOUS,
  });
  assert.equal(keyring.all.length, 2);
  assert.equal(keyring.all[1].keyId, ACTIVE_KEY_ID - 1);
  // La activa sigue siendo la primera: es con la que se cifra.
  assert.equal(keyring.all[0].keyId, ACTIVE_KEY_ID);
});

test("falla cerrado si falta la clave", () => {
  assert.throws(() => parseFiscalKeyring({}), /FISCAL_ENCRYPTION_KEY/);
});

test("falla cerrado si la clave esta vacia", () => {
  assert.throws(
    () => parseFiscalKeyring({ FISCAL_ENCRYPTION_KEY: "   " }),
    /FISCAL_ENCRYPTION_KEY/,
  );
});

test("rechaza una clave que no mide 32 bytes", () => {
  const corta = randomBytes(16).toString("base64");
  assert.throws(() => parseFiscalKeyring({ FISCAL_ENCRYPTION_KEY: corta }), /32 bytes/);
});

test("rechaza una clave pegada en hex en vez de base64", () => {
  // 64 chars hex decodificados como base64 dan 48 bytes, no 32.
  const hex = randomBytes(32).toString("hex");
  assert.throws(() => parseFiscalKeyring({ FISCAL_ENCRYPTION_KEY: hex }), /32 bytes/);
});

test("rechaza una clave anterior invalida en vez de ignorarla", () => {
  assert.throws(
    () =>
      parseFiscalKeyring({
        FISCAL_ENCRYPTION_KEY: VALID,
        FISCAL_ENCRYPTION_KEY_PREVIOUS: "corta",
      }),
    /32 bytes/,
  );
});
```

- [ ] **Step 2: Correr para verlos fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/crypto-fiscal-key.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `lib/crypto/fiscal-key.ts`**

```ts
// Llavero para el material fiscal cifrado.
//
// FISCAL_ENCRYPTION_KEY es base64 de 32 bytes EXACTOS, generada con
// `openssl rand -base64 32`. En Vercel va marcada SOLO para el entorno
// Production: si estuviera en Preview, cualquier deploy de un PR podría
// descifrar el material de producción.
//
// Rotación: se pone la nueva en FISCAL_ENCRYPTION_KEY, la vieja en
// FISCAL_ENCRYPTION_KEY_PREVIOUS, se sube ACTIVE_KEY_ID en una línea de código,
// se re-cifra el material y recién ahí se saca la vieja. El keyId viaja dentro
// del sobre, así que durante la transición conviven blobs de las dos.
//
// La validación es PEREZOSA a propósito: `next build` corre sin las variables de
// producción y un throw al importar rompería el build.

import type { EnvelopeKey } from "@/lib/crypto/envelope";

export const ACTIVE_KEY_ID = 1;

export type FiscalKeyring = {
  active: EnvelopeKey;
  all: EnvelopeKey[];
};

function decodeKey(value: string, varName: string): Buffer {
  const raw = Buffer.from(value.trim(), "base64");

  if (raw.byteLength !== 32) {
    throw new Error(
      `${varName} debe ser base64 de 32 bytes exactos (generala con "openssl rand -base64 32"). ` +
        `Se decodificaron ${raw.byteLength} bytes.`,
    );
  }

  return raw;
}

export function parseFiscalKeyring(env: NodeJS.ProcessEnv): FiscalKeyring {
  const rawActive = env.FISCAL_ENCRYPTION_KEY?.trim();

  if (!rawActive) {
    throw new Error(
      "Falta configurar FISCAL_ENCRYPTION_KEY. Sin esa clave no se puede guardar ni leer material fiscal.",
    );
  }

  const active: EnvelopeKey = {
    keyId: ACTIVE_KEY_ID,
    key: decodeKey(rawActive, "FISCAL_ENCRYPTION_KEY"),
  };

  const all: EnvelopeKey[] = [active];

  const rawPrevious = env.FISCAL_ENCRYPTION_KEY_PREVIOUS?.trim();
  if (rawPrevious) {
    all.push({
      keyId: ACTIVE_KEY_ID - 1,
      key: decodeKey(rawPrevious, "FISCAL_ENCRYPTION_KEY_PREVIOUS"),
    });
  }

  return { active, all };
}

let cached: FiscalKeyring | null = null;

/** Llavero del proceso. Perezoso y memoizado. Tira si el entorno está mal. */
export function getFiscalKeyring(): FiscalKeyring {
  if (!cached) {
    cached = parseFiscalKeyring(process.env);
  }

  return cached;
}
```

- [ ] **Step 4: Correr para verlos pasar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/crypto-fiscal-key.test.ts`
Expected: PASS — 7 tests, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/crypto/fiscal-key.ts tests/crypto-fiscal-key.test.ts && git commit -m "feat(fiscal): llavero de cifrado perezoso con soporte de rotacion

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `lib/log.ts` — logging que no filtra

La librería `soap` adjunta `error.body` con el XML crudo de la respuesta de ARCA. Un `console.error(err)` sobre un error de WSFE imprimiría la respuesta entera en los logs de Vercel.

**Files:**
- Create: `lib/log.ts`
- Test: `tests/log-error.test.ts`

**Interfaces:**
- Produces:
  - `function describeError(error: unknown): { name: string; message: string }`
  - `function logError(scope: string, error: unknown, extra?: Record<string, string | number | boolean | null>): void`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/log-error.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { describeError } from "../lib/log";

test("extrae solo name y message de un Error", () => {
  const error = new TypeError("algo salio mal");
  assert.deepEqual(describeError(error), {
    name: "TypeError",
    message: "algo salio mal",
  });
});

test("descarta las propiedades extra que adjunta la libreria soap", () => {
  const error = Object.assign(new Error("fallo WSFE"), {
    body: "<soap:Envelope>...secreto...</soap:Envelope>",
    response: { headers: { authorization: "Bearer TOKEN" } },
  });

  const described = describeError(error);

  assert.deepEqual(Object.keys(described).sort(), ["message", "name"]);
  assert.equal(JSON.stringify(described).includes("secreto"), false);
  assert.equal(JSON.stringify(described).includes("TOKEN"), false);
});

test("no explota con valores que no son Error", () => {
  assert.deepEqual(describeError("un string suelto"), {
    name: "UnknownError",
    message: "un string suelto",
  });
  assert.deepEqual(describeError(null), {
    name: "UnknownError",
    message: "unknown",
  });
});

test("no filtra el contenido de un objeto arbitrario", () => {
  const described = describeError({ cert: "-----BEGIN RSA PRIVATE KEY-----" });
  assert.equal(described.message.includes("PRIVATE KEY"), false);
});
```

- [ ] **Step 2: Correr para verlos fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/log-error.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `lib/log.ts`**

```ts
// Logging de errores que no filtra material sensible.
//
// Importa especialmente en los caminos de ARCA: la librería `soap` adjunta al
// error propiedades enumerables `body` (el XML crudo de la respuesta) y
// `response` (la respuesta HTTP completa). Un `console.error(err)` sobre un
// error de WSAA/WSFE volcaría todo eso a los logs de Vercel.
//
// Regla: nunca `console.error(error)` con el objeto entero. Siempre este helper.

export type DescribedError = {
  name: string;
  message: string;
};

export function describeError(error: unknown): DescribedError {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  if (typeof error === "string") {
    return { name: "UnknownError", message: error };
  }

  // Cualquier otra cosa (objetos, null, undefined) se colapsa a "unknown": no
  // serializamos objetos arbitrarios porque podrían contener credenciales.
  return { name: "UnknownError", message: "unknown" };
}

export function logError(
  scope: string,
  error: unknown,
  extra: Record<string, string | number | boolean | null> = {},
): void {
  console.error(`[${scope}]`, { ...describeError(error), ...extra });
}
```

- [ ] **Step 4: Correr para verlos pasar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/log-error.test.ts`
Expected: PASS — 4 tests, `# fail 0`.

- [ ] **Step 5: Reemplazar el `console.error` crudo del handler de factura**

En `app/api/quotations/[id]/factura-pdf/route.ts`, agregar el import junto a los existentes:

```ts
import { logError } from "@/lib/log";
```

Y reemplazar la línea 41:

```ts
    console.error("[factura-pdf] error", error);
```

por:

```ts
    logError("factura-pdf", error);
```

- [ ] **Step 6: Typecheck y lint**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/log.ts tests/log-error.test.ts "app/api/quotations/[id]/factura-pdf/route.ts" && git commit -m "feat(fiscal): helper de logging que no vuelca respuestas SOAP ni credenciales

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `lib/supabase/service-role.ts` — el cliente privilegiado

`service_role` saltea RLS por completo. Por eso el módulo lleva `import "server-only"` y una regla de ESLint que restringe quién puede importarlo.

**Files:**
- Create: `lib/supabase/service-role.ts`
- Modify: `.eslintrc.json`

**Interfaces:**
- Produces: `function createServiceRoleClient(): SupabaseClient` — **solo importable desde `lib/fiscal/*` y `lib/arca/*`**.

- [ ] **Step 1: Implementar `lib/supabase/service-role.ts`**

```ts
import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente con service_role: SALTEA RLS POR COMPLETO.
//
// Existe porque el material fiscal (fiscal_credentials, arca_tickets, facturas)
// vive en tablas con RLS de negación total, deliberadamente inalcanzables con el
// anon key + el JWT de Clerk que están los dos en el navegador.
//
// REGLAS DE USO, no negociables:
//   1. Solo se importa desde lib/fiscal/* y lib/arca/*. Hay una regla de ESLint
//      que lo hace cumplir.
//   2. Como no hay RLS que proteja, TODA query hecha con este cliente filtra
//      explícitamente por clerk_user_id. Eso se verifica en review.
//   3. Nunca se le pasa a un componente ni se re-exporta.

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Falta configurar SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL. " +
        "Sin eso no se puede acceder al material fiscal.",
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

Nota: acá **no** se replica el placeholder de build de `lib/supabase/server.ts:13-21`. Ese existe porque el cliente anon se instancia durante el prerender de páginas; este se llama solo dentro de funciones de dominio en runtime, así que fallar es lo correcto.

- [ ] **Step 2: Restringir quién lo puede importar**

Leer `.eslintrc.json` y agregar la regla dentro de un bloque `overrides`. Si el archivo ya tiene `overrides`, agregar un elemento más al array; si no, crear la clave. El bloque a agregar:

```json
{
  "files": ["**/*.ts", "**/*.tsx"],
  "excludedFiles": ["lib/fiscal/**", "lib/arca/**", "lib/supabase/service-role.ts"],
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          {
            "group": ["**/supabase/service-role", "@/lib/supabase/service-role"],
            "message": "El cliente service_role saltea RLS. Solo se puede importar desde lib/fiscal/* y lib/arca/*."
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 3: Verificar que la regla funciona**

Crear un archivo temporal que la viole y confirmar que el lint la caza:

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && printf 'import { createServiceRoleClient } from "@/lib/supabase/service-role";\nexport const x = createServiceRoleClient;\n' > lib/tmp-lint-check.ts && npm run lint 2>&1 | tail -20; rm lib/tmp-lint-check.ts
```

Expected: el lint reporta el error `no-restricted-imports` sobre `lib/tmp-lint-check.ts` con el mensaje en castellano. Si pasa limpio, la regla está mal configurada — revisarla antes de seguir.

- [ ] **Step 4: Lint limpio sin el archivo temporal**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/supabase/service-role.ts .eslintrc.json && git commit -m "feat(fiscal): cliente service_role aislado con restriccion de importacion por lint

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Avisar al usuario**

Decirle que agregue `SUPABASE_SERVICE_ROLE_KEY` en Vercel (proyecto `cotizapp-ia`), **solo para el entorno Production**. La encuentra en el Dashboard de Supabase → Project Settings → API → `service_role` secret. Y que la agregue a su `.env.local` para poder probar en desarrollo.

---

## Task 7: `lib/fiscal/certificate.ts` — parseo y validación de certificados

El arreglo del hallazgo crítico: el CUIT sale del certificado, no del formulario.

**Files:**
- Create: `lib/fiscal/certificate.ts`
- Test: `tests/fiscal-certificate.test.ts`

**Interfaces:**
- Produces:
  - `class CertificateError extends Error`
  - `type ParsedCertificate = { cuit: string; serialNumber: string; notAfter: Date; subjectCommonName: string | null }`
  - `function parseCertificate(certPem: string): ParsedCertificate`
  - `function assertKeyMatchesCertificate(certPem: string, privateKeyPem: string): void`
  - `function generateKeyAndCsr(input: { cuit: string; businessName: string; alias: string }): { privateKeyPem: string; csrPem: string }`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/fiscal-certificate.test.ts`:

```ts
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";

import forge from "node-forge";

import {
  CertificateError,
  assertKeyMatchesCertificate,
  generateKeyAndCsr,
  parseCertificate,
} from "../lib/fiscal/certificate";

/** Genera un par y un certificado autofirmado con el CUIT en el serialNumber. */
function makeFixture(cuit: string, notAfterOffsetMs: number) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
  });

  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.publicKeyFromPem(publicKey);
  cert.serialNumber = "0a1b2c";
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + notAfterOffsetMs);

  const attrs = [
    { name: "commonName", value: "cotizapp" },
    { shortName: "O", value: "Gomez Frate" },
    { name: "serialNumber", value: `CUIT ${cuit}` },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(forge.pki.privateKeyFromPem(privateKey), forge.md.sha256.create());

  return { certPem: forge.pki.certificateToPem(cert), keyPem: privateKey };
}

// 2048 bits es lento: se genera una sola vez y se reusa.
const VIGENTE = makeFixture("20123456789", 365 * 86_400_000);
const VENCIDO = makeFixture("20123456789", -86_400_000);
const OTRO = makeFixture("27987654321", 365 * 86_400_000);

test("parseCertificate extrae el CUIT del serialNumber del subject", () => {
  const parsed = parseCertificate(VIGENTE.certPem);
  assert.equal(parsed.cuit, "20123456789");
  assert.equal(parsed.subjectCommonName, "cotizapp");
  assert.ok(parsed.notAfter.getTime() > Date.now());
  assert.ok(parsed.serialNumber.length > 0);
});

test("parseCertificate rechaza un certificado vencido", () => {
  assert.throws(() => parseCertificate(VENCIDO.certPem), CertificateError);
});

test("parseCertificate rechaza algo que no es PEM", () => {
  assert.throws(() => parseCertificate("no soy un certificado"), CertificateError);
});

test("parseCertificate rechaza un certificado sin CUIT en el subject", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
  });
  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.publicKeyFromPem(publicKey);
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 86_400_000);
  const attrs = [{ name: "commonName", value: "sin-cuit" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(forge.pki.privateKeyFromPem(privateKey), forge.md.sha256.create());

  assert.throws(
    () => parseCertificate(forge.pki.certificateToPem(cert)),
    CertificateError,
  );
});

test("assertKeyMatchesCertificate acepta el par correcto", () => {
  assert.doesNotThrow(() =>
    assertKeyMatchesCertificate(VIGENTE.certPem, VIGENTE.keyPem),
  );
});

test("assertKeyMatchesCertificate rechaza una clave de otro certificado", () => {
  assert.throws(
    () => assertKeyMatchesCertificate(VIGENTE.certPem, OTRO.keyPem),
    CertificateError,
  );
});

test("assertKeyMatchesCertificate rechaza una clave que no es PEM", () => {
  assert.throws(
    () => assertKeyMatchesCertificate(VIGENTE.certPem, "cualquier cosa"),
    CertificateError,
  );
});

test("generateKeyAndCsr produce una clave y un CSR que se corresponden", () => {
  const { privateKeyPem, csrPem } = generateKeyAndCsr({
    cuit: "20123456789",
    businessName: "Gomez Frate",
    alias: "cotizapp",
  });

  assert.match(privateKeyPem, /-----BEGIN RSA PRIVATE KEY-----/);
  assert.match(csrPem, /-----BEGIN CERTIFICATE REQUEST-----/);

  const csr = forge.pki.certificationRequestFromPem(csrPem);
  assert.equal(csr.verify(), true);

  const key = forge.pki.privateKeyFromPem(privateKeyPem);
  const csrPublicKey = csr.publicKey as forge.pki.rsa.PublicKey;
  assert.equal(csrPublicKey.n.compareTo(key.n), 0);

  const serialNumber = csr.subject.getField({ name: "serialNumber" }) as
    | { value: string }
    | null;
  assert.equal(serialNumber?.value, "CUIT 20123456789");
});
```

- [ ] **Step 2: Correr para verlos fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/fiscal-certificate.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `lib/fiscal/certificate.ts`**

```ts
// Parseo y validación de certificados X.509 de ARCA.
//
// La regla que arregla el hallazgo crítico de la auditoría: el CUIT que se usa
// para hablar con ARCA sale del `serialNumber` del subject del certificado, NO
// del campo que teclea el usuario. El formulario deja de ser una credencial.
//
// ARCA pone el CUIT en el subject como `serialNumber = "CUIT 20123456789"`.

import { generateKeyPairSync } from "node:crypto";

import forge from "node-forge";

export class CertificateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CertificateError";
  }
}

export type ParsedCertificate = {
  cuit: string;
  serialNumber: string;
  notAfter: Date;
  subjectCommonName: string | null;
};

function readSubjectField(
  subject: forge.pki.Certificate["subject"] | forge.pki.CertificateRequest["subject"],
  name: string,
): string | null {
  const field = subject.getField({ name }) as { value?: unknown } | null;
  return typeof field?.value === "string" ? field.value : null;
}

export function parseCertificate(certPem: string): ParsedCertificate {
  const trimmed = certPem.trim();

  if (!trimmed.includes("-----BEGIN CERTIFICATE-----")) {
    throw new CertificateError(
      "El archivo no parece un certificado. Subí el .crt que bajaste de ARCA.",
    );
  }

  let cert: forge.pki.Certificate;
  try {
    cert = forge.pki.certificateFromPem(trimmed);
  } catch {
    throw new CertificateError(
      "No pudimos leer el certificado. Revisá que sea el archivo que bajaste de ARCA y que esté completo.",
    );
  }

  const rawSerialNumber = readSubjectField(cert.subject, "serialNumber");
  const cuitDigits = rawSerialNumber?.replace(/\D/g, "") ?? "";

  if (cuitDigits.length !== 11) {
    throw new CertificateError(
      "El certificado no tiene un CUIT en sus datos. Revisá que hayas bajado el correcto de ARCA.",
    );
  }

  if (cert.validity.notAfter.getTime() <= Date.now()) {
    throw new CertificateError(
      `Este certificado venció el ${cert.validity.notAfter.toLocaleDateString("es-AR")}. Generá uno nuevo en ARCA.`,
    );
  }

  return {
    cuit: cuitDigits,
    serialNumber: cert.serialNumber,
    notAfter: cert.validity.notAfter,
    subjectCommonName: readSubjectField(cert.subject, "commonName"),
  };
}

export function assertKeyMatchesCertificate(
  certPem: string,
  privateKeyPem: string,
): void {
  let cert: forge.pki.Certificate;
  try {
    cert = forge.pki.certificateFromPem(certPem.trim());
  } catch {
    throw new CertificateError("No pudimos leer el certificado.");
  }

  let privateKey: forge.pki.rsa.PrivateKey;
  try {
    // privateKeyFromPem acepta tanto PKCS#1 ("RSA PRIVATE KEY") como PKCS#8
    // ("PRIVATE KEY") sin cifrar, que son los dos formatos que entrega openssl.
    privateKey = forge.pki.privateKeyFromPem(privateKeyPem.trim());
  } catch {
    throw new CertificateError(
      "No pudimos leer la clave privada. Tiene que ser el .key sin contraseña.",
    );
  }

  const publicKey = cert.publicKey as forge.pki.rsa.PublicKey;

  if (publicKey.n.compareTo(privateKey.n) !== 0) {
    throw new CertificateError(
      "El certificado y la clave privada no se corresponden. Subí el .crt que ARCA generó a partir de tu pedido.",
    );
  }
}

export function generateKeyAndCsr(input: {
  cuit: string;
  businessName: string;
  alias: string;
}): { privateKeyPem: string; csrPem: string } {
  const cuitDigits = input.cuit.replace(/\D/g, "");

  if (cuitDigits.length !== 11) {
    throw new CertificateError("El CUIT tiene que tener 11 dígitos.");
  }

  // Generación nativa: node-forge en JS puro tarda segundos para 2048 bits.
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
  });

  const forgeKey = forge.pki.privateKeyFromPem(privateKey);

  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = forge.pki.setRsaPublicKey(forgeKey.n, forgeKey.e);
  csr.setSubject([
    { name: "countryName", value: "AR" },
    { shortName: "O", value: input.businessName.slice(0, 64) },
    { name: "commonName", value: input.alias.slice(0, 64) },
    { name: "serialNumber", value: `CUIT ${cuitDigits}` },
  ]);
  csr.sign(forgeKey, forge.md.sha256.create());

  return {
    privateKeyPem: privateKey,
    csrPem: forge.pki.certificationRequestToPem(csr),
  };
}
```

- [ ] **Step 4: Correr para verlos pasar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/fiscal-certificate.test.ts`
Expected: PASS — 8 tests, `# fail 0`. Puede tardar unos segundos por la generación de claves RSA.

- [ ] **Step 5: Typecheck**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/fiscal/certificate.ts tests/fiscal-certificate.test.ts && git commit -m "feat(fiscal): parseo de certificados ARCA con CUIT extraido del subject

El CUIT deja de venir del formulario: sale del serialNumber del certificado.
Cierra el hallazgo critico de identidad fiscal no ligada al certificado.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `lib/fiscal/credentials.ts` — guardar y leer cifrado

Único lugar del sistema que descifra material fiscal.

**Files:**
- Create: `lib/fiscal/credentials.ts`

**Interfaces:**
- Consumes: `seal`/`open`/`EnvelopeError` de `lib/crypto/envelope`; `getFiscalKeyring`/`ACTIVE_KEY_ID` de `lib/crypto/fiscal-key`; `createServiceRoleClient` de `lib/supabase/service-role`; `parseCertificate`/`assertKeyMatchesCertificate`/`CertificateError` de `lib/fiscal/certificate`; `logError` de `lib/log`.
- Produces:
  - `type FiscalCredentialSummary = { cuit: string; certNotAfter: string | null; verifiedAt: string | null; hasCert: boolean }`
  - `async function savePrivateKey(clerkUserId: string, privateKeyPem: string, csrPem: string, provisionalCuit: string): Promise<void>`
  - `async function attachCertificate(clerkUserId, certPem): Promise<ParsedCertificate>`
  - `async function loadCredentials(clerkUserId): Promise<{ cuit: string; certPem: string; privateKeyPem: string } | null>`
  - `async function getCredentialSummary(clerkUserId): Promise<FiscalCredentialSummary | null>`
  - `async function markVerified(clerkUserId): Promise<void>`
  - `async function clearCredentials(clerkUserId): Promise<void>`

Sin test unitario: es acceso a Supabase. La lógica pura que contiene ya está cubierta por las Tasks 3, 4 y 7; el camino completo se prueba a mano en la Task 9 y con el wizard de la Fase B.

- [ ] **Step 1: Implementar `lib/fiscal/credentials.ts`**

```ts
import "server-only";

import {
  EnvelopeError,
  open,
  seal,
} from "@/lib/crypto/envelope";
import { ACTIVE_KEY_ID, getFiscalKeyring } from "@/lib/crypto/fiscal-key";
import {
  CertificateError,
  assertKeyMatchesCertificate,
  parseCertificate,
  type ParsedCertificate,
} from "@/lib/fiscal/certificate";
import { logError } from "@/lib/log";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Único lugar del sistema que descifra material fiscal.
//
// `fiscal_credentials` tiene RLS de negación total, así que todo acá pasa por el
// cliente service_role. Como ese cliente saltea RLS, CADA query filtra
// explícitamente por clerk_user_id. No hay excepción.

const TABLE = "fiscal_credentials";
const PURPOSE_PRIVATE_KEY = "fiscal-private-key";

function aadFor(clerkUserId: string): string {
  return `${clerkUserId}|${PURPOSE_PRIVATE_KEY}`;
}

export type FiscalCredentialSummary = {
  cuit: string;
  certNotAfter: string | null;
  verifiedAt: string | null;
  hasCert: boolean;
};

/** Guarda la clave privada recién generada, cifrada. El CUIT todavía es provisorio. */
export async function savePrivateKey(
  clerkUserId: string,
  privateKeyPem: string,
  csrPem: string,
  provisionalCuit: string,
): Promise<void> {
  const keyring = getFiscalKeyring();
  const blob = seal(keyring.active, privateKeyPem, aadFor(clerkUserId));

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from(TABLE).upsert(
    {
      clerk_user_id: clerkUserId,
      cuit: provisionalCuit.replace(/\D/g, ""),
      private_key_enc: blob,
      csr_pem: csrPem,
      key_id: ACTIVE_KEY_ID,
      // Una llave nueva invalida cualquier verificación previa.
      cert_pem: null,
      cert_serial: null,
      cert_not_after: null,
      verified_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clerk_user_id" },
  );

  if (error) {
    logError("fiscal.savePrivateKey", error);
    throw new Error("No pudimos guardar tu llave. Probá de nuevo en un momento.");
  }
}

/**
 * Asocia el certificado que bajó el usuario de ARCA. Valida que corresponda a la
 * clave guardada y ESCRIBE el CUIT del certificado: esa es la autoridad.
 */
export async function attachCertificate(
  clerkUserId: string,
  certPem: string,
): Promise<ParsedCertificate> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select("private_key_enc, key_id")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error || !data) {
    throw new CertificateError(
      "Primero generá tu llave desde Cotizapp y después subí el certificado.",
    );
  }

  const keyring = getFiscalKeyring();
  let privateKeyPem: string;
  try {
    privateKeyPem = open(
      keyring.all,
      Buffer.from(data.private_key_enc as unknown as Uint8Array),
      aadFor(clerkUserId),
    ).toString("utf8");
  } catch (unsealError) {
    logError("fiscal.attachCertificate.open", unsealError);
    throw new CertificateError(
      "No pudimos leer tu llave guardada. Generá una nueva y rehacé el trámite en ARCA.",
    );
  }

  const parsed = parseCertificate(certPem);
  assertKeyMatchesCertificate(certPem, privateKeyPem);

  const { error: updateError } = await supabase
    .from(TABLE)
    .update({
      // El CUIT del certificado manda. El del formulario nunca fue autoridad.
      cuit: parsed.cuit,
      cert_pem: certPem.trim(),
      cert_serial: parsed.serialNumber,
      cert_not_after: parsed.notAfter.toISOString(),
      verified_at: null, // se sella recién cuando "Probar conexión" pasa
      updated_at: new Date().toISOString(),
    })
    .eq("clerk_user_id", clerkUserId);

  if (updateError) {
    // El índice único parcial sobre cuit solo aplica a filas verificadas, así
    // que acá un conflicto es otra cosa; igual damos un mensaje humano.
    logError("fiscal.attachCertificate.update", updateError);
    throw new CertificateError(
      "No pudimos guardar el certificado. Probá de nuevo en un momento.",
    );
  }

  await clearTicketsFor(clerkUserId);

  return parsed;
}

/** Devuelve el material listo para hablar con ARCA, o null si no está completo. */
export async function loadCredentials(
  clerkUserId: string,
): Promise<{ cuit: string; certPem: string; privateKeyPem: string } | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select("cuit, cert_pem, private_key_enc")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) {
    logError("fiscal.loadCredentials", error);
    return null;
  }

  if (!data?.cert_pem || !data.private_key_enc) {
    return null;
  }

  const keyring = getFiscalKeyring();

  try {
    const privateKeyPem = open(
      keyring.all,
      Buffer.from(data.private_key_enc as unknown as Uint8Array),
      aadFor(clerkUserId),
    ).toString("utf8");

    return {
      cuit: String(data.cuit),
      certPem: String(data.cert_pem),
      privateKeyPem,
    };
  } catch (unsealError) {
    if (unsealError instanceof EnvelopeError) {
      logError("fiscal.loadCredentials.open", unsealError);
      return null;
    }
    throw unsealError;
  }
}

/** Datos no sensibles para mostrar en la UI. Nunca devuelve material criptográfico. */
export async function getCredentialSummary(
  clerkUserId: string,
): Promise<FiscalCredentialSummary | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select("cuit, cert_pem, cert_not_after, verified_at")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) {
    logError("fiscal.getCredentialSummary", error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    cuit: String(data.cuit),
    certNotAfter: (data.cert_not_after as string | null) ?? null,
    verifiedAt: (data.verified_at as string | null) ?? null,
    hasCert: Boolean(data.cert_pem),
  };
}

export async function markVerified(clerkUserId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from(TABLE)
    .update({ verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("clerk_user_id", clerkUserId);

  if (error) {
    logError("fiscal.markVerified", error);
    throw new Error("No pudimos confirmar la verificación. Probá de nuevo.");
  }
}

export async function clearCredentials(clerkUserId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from(TABLE).delete().eq("clerk_user_id", clerkUserId);

  if (error) {
    logError("fiscal.clearCredentials", error);
    throw new Error("No pudimos borrar tus credenciales. Probá de nuevo.");
  }

  await clearTicketsFor(clerkUserId);
}

/**
 * Borra los tickets WSAA del usuario. La tabla `arca_tickets` la crea la Fase B;
 * hasta entonces esto es un no-op silencioso, a propósito: cambiar de certificado
 * SIEMPRE tiene que invalidar los tickets, y no queremos que el día que exista la
 * tabla haya que acordarse de venir a agregar la llamada.
 */
async function clearTicketsFor(clerkUserId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("arca_tickets")
    .delete()
    .eq("clerk_user_id", clerkUserId);

  // 42P01 = undefined_table: la Fase B todavía no corrió su migración.
  if (error && error.code !== "42P01") {
    logError("fiscal.clearTickets", error);
  }
}
```

- [ ] **Step 2: Typecheck y lint**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint`
Expected: exit 0. En particular, la regla de la Task 6 **no** debe disparar: `lib/fiscal/credentials.ts` está en la lista de archivos permitidos.

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/fiscal/credentials.ts && git commit -m "feat(fiscal): guardado y lectura de credenciales cifradas via service_role

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Migrar el material existente y cerrar el bucket

Trae la clave que hoy está en claro en el bucket a `fiscal_credentials`, y después cierra la puerta. **Explícita, no perezosa**: si fuera perezosa dentro del flujo de emisión y el proceso muriera a mitad, el PEM en claro quedaría en el bucket para siempre sin que nadie se entere.

**Files:**
- Create: `scripts/migrar-credenciales-fiscales.ts`
- Create: `supabase/migrations/20260730_cerrar_bucket_fiscal.sql`

**Interfaces:**
- Consumes: todo lo de las Tasks 3-8.

- [ ] **Step 1: Escribir el script de migración**

Crear `scripts/migrar-credenciales-fiscales.ts`:

```ts
/**
 * Migra las credenciales fiscales del bucket `fiscal` (clave privada en CLARO) a
 * la tabla `fiscal_credentials` (cifrada), y borra el material en claro.
 *
 * Orden estricto y no negociable:
 *   1. leer y validar   2. escribir cifrado   3. RELEER Y DESCIFRAR para
 *   verificar   4. recién ahí borrar el objeto   5. barrido final
 *
 * Si el paso 3 falla, no se borra nada: es preferible dejar el archivo en claro
 * a dejar al usuario sin clave recuperable.
 *
 * Uso:
 *   npx tsx scripts/migrar-credenciales-fiscales.ts          (simulacro)
 *   npx tsx scripts/migrar-credenciales-fiscales.ts --aplicar
 */

import { seal, open } from "../lib/crypto/envelope";
import { ACTIVE_KEY_ID, parseFiscalKeyring } from "../lib/crypto/fiscal-key";
import {
  assertKeyMatchesCertificate,
  parseCertificate,
} from "../lib/fiscal/certificate";
import { createClient } from "@supabase/supabase-js";

const APLICAR = process.argv.includes("--aplicar");

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function main() {
  const keyring = parseFiscalKeyring(process.env);
  const db = supabase();

  const { data: perfiles, error } = await db
    .from("fiscal_profiles")
    .select("clerk_user_id, cuit, cert_path, key_path");

  if (error) {
    throw new Error(`No se pudieron listar los perfiles fiscales: ${error.message}`);
  }

  let migrados = 0;
  let salteados = 0;
  let fallidos = 0;

  for (const perfil of perfiles ?? []) {
    const clerkUserId = String(perfil.clerk_user_id);

    if (!perfil.cert_path || !perfil.key_path) {
      console.log(`- ${clerkUserId}: sin certificado cargado, se saltea.`);
      salteados += 1;
      continue;
    }

    try {
      const [certFile, keyFile] = await Promise.all([
        db.storage.from("fiscal").download(String(perfil.cert_path)),
        db.storage.from("fiscal").download(String(perfil.key_path)),
      ]);

      if (certFile.error || keyFile.error || !certFile.data || !keyFile.data) {
        throw new Error("no se pudieron descargar los archivos del bucket");
      }

      const certPem = await certFile.data.text();
      const privateKeyPem = await keyFile.data.text();

      // 1. Validar antes de tocar nada.
      const parsed = parseCertificate(certPem);
      assertKeyMatchesCertificate(certPem, privateKeyPem);

      const declarado = String(perfil.cuit ?? "").replace(/\D/g, "");
      if (declarado && declarado !== parsed.cuit) {
        console.warn(
          `  ! ${clerkUserId}: el CUIT declarado (${declarado}) no es el del certificado (${parsed.cuit}). Gana el del certificado.`,
        );
      }

      if (!APLICAR) {
        console.log(
          `- ${clerkUserId}: LISTO PARA MIGRAR (CUIT ${parsed.cuit}, vence ${parsed.notAfter.toISOString().slice(0, 10)}).`,
        );
        migrados += 1;
        continue;
      }

      // 2. Escribir cifrado.
      const aad = `${clerkUserId}|fiscal-private-key`;
      const blob = seal(keyring.active, privateKeyPem, aad);

      const { error: upsertError } = await db.from("fiscal_credentials").upsert(
        {
          clerk_user_id: clerkUserId,
          cuit: parsed.cuit,
          // base64, no Buffer: la columna es `text` y JSON no transporta binario.
          private_key_enc: blob.toString("base64"),
          cert_pem: certPem.trim(),
          cert_serial: parsed.certSerialNumber,
          cert_not_after: parsed.notAfter.toISOString(),
          key_id: ACTIVE_KEY_ID,
          verified_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "clerk_user_id" },
      );

      if (upsertError) {
        throw new Error(`upsert falló: ${upsertError.message}`);
      }

      // 3. Releer y descifrar: sin esto no se borra nada.
      const { data: releido, error: releerError } = await db
        .from("fiscal_credentials")
        .select("private_key_enc")
        .eq("clerk_user_id", clerkUserId)
        .maybeSingle();

      if (releerError || !releido) {
        throw new Error("no se pudo releer lo que acabamos de escribir");
      }

      const recuperado = open(
        keyring.all,
        Buffer.from(String(releido.private_key_enc), "base64"),
        aad,
      ).toString("utf8");

      if (recuperado.trim() !== privateKeyPem.trim()) {
        throw new Error("lo descifrado no coincide con el original");
      }

      // 4. Recién ahora se borra el material en claro. Ruidoso si falla.
      const { error: removeError } = await db.storage
        .from("fiscal")
        .remove([String(perfil.key_path)]);

      if (removeError) {
        throw new Error(
          `la clave quedó cifrada OK pero NO se pudo borrar el archivo en claro: ${removeError.message}`,
        );
      }

      console.log(`- ${clerkUserId}: MIGRADO (CUIT ${parsed.cuit}).`);
      migrados += 1;
    } catch (err) {
      fallidos += 1;
      console.error(
        `- ${clerkUserId}: FALLÓ — ${err instanceof Error ? err.message : "error desconocido"}`,
      );
    }
  }

  // 5. Barrido final: que no quede ninguna clave en claro.
  if (APLICAR) {
    const { data: objetos } = await db.storage.from("fiscal").list("", { limit: 1000 });
    const sospechosos: string[] = [];

    for (const carpeta of objetos ?? []) {
      const { data: dentro } = await db.storage.from("fiscal").list(carpeta.name);
      for (const objeto of dentro ?? []) {
        if (objeto.name.endsWith(".key")) {
          sospechosos.push(`${carpeta.name}/${objeto.name}`);
        }
      }
    }

    if (sospechosos.length > 0) {
      console.error("\n!! QUEDARON CLAVES EN CLARO EN EL BUCKET:");
      sospechosos.forEach((s) => console.error(`   ${s}`));
      process.exitCode = 1;
    } else {
      console.log("\nBarrido final OK: no quedan claves en claro en el bucket.");
    }
  }

  console.log(
    `\n${APLICAR ? "Aplicado" : "Simulacro"} — migrados: ${migrados}, salteados: ${salteados}, fallidos: ${fallidos}.`,
  );

  if (fallidos > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Correr el simulacro**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx scripts/migrar-credenciales-fiscales.ts`

Expected: lista los perfiles y dice cuáles migraría, sin tocar nada. Requiere que la migración de la Task 1 ya esté aplicada y que estén `SUPABASE_SERVICE_ROLE_KEY` y `FISCAL_ENCRYPTION_KEY` en `.env.local`.

Si el simulacro reporta algún `FALLÓ`, **parar y avisar al usuario** con el detalle antes de aplicar nada.

- [ ] **Step 3: Aplicar la migración de datos**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx scripts/migrar-credenciales-fiscales.ts --aplicar`

Expected: `MIGRADO` para cada perfil con certificado, `Barrido final OK`, y `fallidos: 0`.

- [ ] **Step 4: Escribir la migración que cierra el bucket**

Crear `supabase/migrations/20260730_cerrar_bucket_fiscal.sql`:

```sql
-- Cierra el bucket `fiscal`. La policy anterior era `for all to authenticated`,
-- y `for all` INCLUYE SELECT: como el anon key y el JWT de Clerk están los dos en
-- el navegador, la clave privada fiscal era descargable desde JavaScript del
-- cliente. El material ya vive cifrado en public.fiscal_credentials.
--
-- Correr SOLO después de que scripts/migrar-credenciales-fiscales.ts --aplicar
-- haya terminado con "fallidos: 0" y "Barrido final OK".
--
-- Se aplica a mano en el SQL Editor del Dashboard (proyecto cotizapp-ia).

drop policy if exists "Users manage their own fiscal credentials" on storage.objects;

-- Sin policy para `authenticated`: el bucket `fiscal` queda inaccesible desde el
-- navegador. Lo que quede adentro solo se toca con service_role desde el servidor.

-- Los paths dejan de ser autoridad: la fuente de verdad es fiscal_credentials.
alter table public.fiscal_profiles
  drop column if exists cert_path,
  drop column if exists key_path;
```

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add scripts/migrar-credenciales-fiscales.ts supabase/migrations/20260730_cerrar_bucket_fiscal.sql && git commit -m "feat(fiscal): migracion explicita del material en claro y cierre del bucket

Cierra el hallazgo de clave privada descargable desde el navegador.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Avisar al usuario**

Decirle que corra `supabase/migrations/20260730_cerrar_bucket_fiscal.sql` en el SQL Editor, **después** de confirmar que el script de migración terminó sin fallos.

Advertirle además que al borrar `cert_path`/`key_path` de `fiscal_profiles`, el form de datos fiscales (`components/profile/fiscal-profile-form.tsx`) va a dejar de mostrar los "✓ cargado". Eso es esperado: ese form lo reemplaza el wizard de la Fase B. Si quiere el sistema usable en el medio, la Fase B tiene que ir seguida.

---

## Task 10: Verificación final de la fase

**Files:** ninguno.

- [ ] **Step 1: Tests nuevos**

Run:
```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/crypto-envelope.test.ts tests/crypto-fiscal-key.test.ts tests/log-error.test.ts tests/fiscal-certificate.test.ts
```
Expected: PASS — 29 tests (10 + 7 + 4 + 8), `# fail 0`.

- [ ] **Step 2: Suite completa, comparada contra el baseline**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npm test 2>&1 | tail -8`
Expected: los ~12 fallos preexistentes de `main` no aumentan, y ningún test nuevo falla.

- [ ] **Step 3: Typecheck y lint**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint`
Expected: exit 0, sin warnings.

- [ ] **Step 4: Build**

Run:
```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && rm -rf .next; npm run build 2>&1 | tail -15; echo "EXIT:${PIPESTATUS[0]}"
```
Expected: `EXIT:0` y la tabla de rutas. Esto valida en particular que la validación perezosa de `FISCAL_ENCRYPTION_KEY` no rompe el build cuando la variable no está.

- [ ] **Step 5: Resumen al usuario**

Confirmarle qué quedó cerrado de la auditoría (hallazgos 1-5, 8, 10-13, 22, 24, 28, 29, 31 en lo que toca a esta fase) y qué sigue pendiente hasta la Fase B: el `ticketPath` de `lib/arca/billing.ts:225` **sigue en `/tmp`** y la emisión todavía usa el CUIT de `fiscal_profiles`. O sea: **el hallazgo crítico no está cerrado del todo hasta que la Fase B reemplace el ticket storage y la emisión lea de `fiscal_credentials`.** Decirlo explícitamente, sin adornos.

---

## Self-review

**Cobertura del spec (secciones que le tocan a esta fase):**

- 4.2 tabla `fiscal_credentials` con RLS de negación total → Task 1. ✓
- 4.3 sobre criptográfico completo (formato, AAD, IV, invariantes de GCM, encoding y validación de la clave, rotación) → Tasks 3 y 4. ✓
- 4.5 validación del certificado (PEM, correspondencia clave↔cert, vencimiento, CUIT del subject, índice único) → Tasks 1 y 7. ✓
- 4.5.1 migración explícita del material existente y de las cotizaciones ya facturadas → Task 9 para la clave. **El backfill de `quotations` a `facturas` NO está acá**: `facturas` la crea la Fase C, así que el backfill va con ella. Anotado como dependencia explícita de la Fase C.
- 5 superficie de acceso, `service_role`, `select("*")` → Tasks 6 y 9. El cambio de `getFiscalProfile` a columnas explícitas y `{ hasCert }` va en la Fase B, cuando el wizard reemplace el form que hoy consume esos campos.
- 6 logging que no filtra → Task 5. La traducción de errores de ARCA va en la Fase B, con `lib/arca/verify.ts`.
- 9 dependencias (pin del SDK, node-forge directo, variables nuevas) → Task 2 y los avisos de las Tasks 6 y 9. ✓

**Placeholders:** ninguno. Todos los pasos con código traen el código completo.

**Consistencia de tipos entre tareas:** `EnvelopeKey` (Task 3) es lo que produce `parseFiscalKeyring` (Task 4) y lo que consume `seal`/`open`; `ParsedCertificate` (Task 7) es lo que devuelve `attachCertificate` (Task 8); `aadFor(clerkUserId)` de la Task 8 produce exactamente el mismo string (`"${clerkUserId}|fiscal-private-key"`) que arma a mano el script de la Task 9 — verificado, porque si divergen el material migrado no se abre.

**Un riesgo asumido y anotado:** entre la Task 9 (que borra `cert_path`/`key_path`) y la Fase B, el form de datos fiscales queda a medias. Es deliberado — no se puede cerrar el bucket y a la vez mantener el form viejo que depende de él — y está avisado en la Task 9 Step 6.

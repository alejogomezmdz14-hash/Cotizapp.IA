# ARCA Fase B2 — Wizard del certificado

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un autónomo sin conocimientos técnicos pueda sacar su certificado de ARCA guiado por la app, sin abrir una terminal ni usar `openssl`, y que la app le confirme que quedó bien antes de dejarlo facturar.

**Architecture:** El servidor genera la clave privada y el pedido de certificado (CSR) con node-forge y guarda la clave cifrada; el usuario descarga el CSR, hace el trámite en ARCA y sube el `.crt`, que se valida de verdad (PEM, correspondencia con la clave, CUIT del subject, vigencia). El último paso llama a `getSalesPoints()` —solo lectura, no emite nada— contra producción y traduce el error de ARCA a castellano. Recién cuando eso pasa se sella `verified_at` y aparece el botón de facturar.

**Tech Stack:** Next.js 14 App Router, TypeScript, Clerk, Supabase, `@arcasdk/core` 1.3.1, node-forge, shadcn/ui, tests con `node:test` vía `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-07-30-arca-camino-1-design.md` (secciones 2.1, 4.4, 4.5, 5).
**Depende de:** Fases A y B1, ya implementadas en esta misma rama.

## Global Constraints

- Todo el texto de la UI en **español latino neutro**. Los mensajes los lee un plomero, no un desarrollador: nada de jerga, nada de errores técnicos crudos, nada que suene a culpa del usuario.
- Nunca usar "presupuesto": siempre "cotización". Mobile-first. Componentes de shadcn/ui cuando existan (`components/ui/`: `button`, `card`, `input`, `label`, `confirm-dialog`, `separator`, `toast-provider`). **Nunca hardcodear colores**: siempre CSS variables del design system. Nada de estilos inline.
- **La clave privada nunca sale del servidor.** El usuario descarga el CSR, jamás la clave.
- **`verified_at` solo se sella después de una llamada real y exitosa a ARCA.** Ningún otro camino puede sellarlo. Es la frontera de confianza de todo el diseño: el CUIT que trae un certificado es no confiable hasta que ARCA autentique, porque el certificado también lo sube el usuario.
- Un certificado de **producción no funciona en homologación** (homologación usa certificados propios de WSASS). Por eso la verificación es una llamada de **solo lectura contra producción**: `getSalesPoints()`. No emite nada.
- **El usuario nunca elige el entorno.** Demo mientras no tenga certificado verificado; producción cuando lo tenga.
- Solo **monotributistas** (Factura C). `responsable_inscripto` sale del selector.
- Migraciones SQL: el usuario las aplica a mano en el SQL Editor del Dashboard de `cotizapp-ia`.
- Al commitear, git imprime warnings inofensivos ("LF will be replaced by CRLF", "failed to delete '.git/worktrees/...'"). No son fallos; confirmar con `git log --oneline -1`.
- Rama de trabajo: `feat/arca-fase-b2`, creada desde `feat/arca-fase-b1`.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/arca/verify.ts` | Llamada de verificación + traducción de errores de ARCA a castellano. |
| `tests/arca-verify.test.ts` | Tests de la traducción (parte pura). |
| `lib/fiscal/estado.ts` | Estado del wizard derivado de los datos. Puro. |
| `tests/fiscal-estado.test.ts` | Tests del estado. |
| `app/actions/certificado.ts` | Server actions del wizard. |
| `components/profile/certificado-wizard.tsx` | El wizard por estados. |
| `app/(dashboard)/perfil-empresa/page.tsx` | Monta el wizard. |
| `components/profile/fiscal-profile-form.tsx` | Se le sacan los archivos y el entorno. |
| `app/actions/fiscal.ts` | Deja de escribir al bucket. |
| `lib/fiscal-profile.ts` | Columnas explícitas en vez de `select("*")`. |

---

## Task 1: `lib/arca/verify.ts` — verificación y traducción de errores

Es lo que convierte un error indescifrable de ARCA en una instrucción accionable. Los dos pasos que todo el mundo se saltea en el trámite —delegar el web service y crear el punto de venta— fallan acá, y el usuario tiene que entender cuál de los dos le falta.

**Files:**
- Create: `lib/arca/verify.ts`
- Test: `tests/arca-verify.test.ts`

**Interfaces:**
- Produces:
  - `type VerificacionResultado = { ok: true; puntosDeVenta: number[] } | { ok: false; motivo: MotivoFallo; mensaje: string }`
  - `type MotivoFallo = "sin-delegacion" | "punto-de-venta" | "certificado" | "arca-caida" | "desconocido"`
  - `function traducirErrorArca(error: unknown, salesPoint: string): { motivo: MotivoFallo; mensaje: string }`
  - `async function verificarConexionArca(credentials, salesPoint, ticketStorage): Promise<VerificacionResultado>`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/arca-verify.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { traducirErrorArca } from "../lib/arca/verify";

test("detecta que falta delegar el web service", () => {
  const r = traducirErrorArca(
    new Error("ns1:cms.cert.untrusted: El CEE no se encuentra autorizado a acceder al servicio wsfe"),
    "0001",
  );
  assert.equal(r.motivo, "sin-delegacion");
  assert.match(r.mensaje, /Administrador de Relaciones/i);
});

test("detecta que el punto de venta no existe o no es de Web Services", () => {
  const r = traducirErrorArca(
    new Error("El punto de venta referido no se encuentra habilitado para operar"),
    "0003",
  );
  assert.equal(r.motivo, "punto-de-venta");
  assert.match(r.mensaje, /0003/);
});

test("detecta un certificado vencido o rechazado", () => {
  const r = traducirErrorArca(
    new Error("Certificado expirado o no vigente"),
    "0001",
  );
  assert.equal(r.motivo, "certificado");
});

test("detecta que ARCA no responde", () => {
  assert.equal(traducirErrorArca(new Error("ETIMEDOUT"), "0001").motivo, "arca-caida");
  assert.equal(traducirErrorArca(new Error("socket hang up"), "0001").motivo, "arca-caida");
  assert.equal(traducirErrorArca(new Error("ECONNRESET"), "0001").motivo, "arca-caida");
});

test("un error desconocido no inventa un diagnostico", () => {
  const r = traducirErrorArca(new Error("algo rarisimo"), "0001");
  assert.equal(r.motivo, "desconocido");
  assert.doesNotMatch(r.mensaje, /Administrador de Relaciones/i);
});

test("nunca devuelve el texto crudo del error al usuario", () => {
  const r = traducirErrorArca(new Error("ns1:internal.stacktrace at com.afip.Foo:42"), "0001");
  assert.doesNotMatch(r.mensaje, /ns1:|stacktrace|com\.afip/);
});

test("tolera cosas que no son Error", () => {
  assert.equal(traducirErrorArca(null, "0001").motivo, "desconocido");
  assert.equal(traducirErrorArca("texto suelto", "0001").motivo, "desconocido");
});
```

- [ ] **Step 2: Correr para verlos fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/arca-verify.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `lib/arca/verify.ts`**

```ts
import "server-only";

import type { ITicketStoragePort } from "@arcasdk/core";

import { logError } from "@/lib/log";

// Verificación del certificado contra ARCA.
//
// Se usa `getSalesPoints()`, que es de SOLO LECTURA: no emite ningún comprobante.
// Corre contra PRODUCCIÓN porque un certificado de producción no sirve en
// homologación (homologación usa certificados propios sacados por WSASS), así
// que "probar en homologación" no es una opción.
//
// Una sola llamada valida las tres cosas que pueden estar mal después del
// trámite: que el certificado sea válido, que el web service esté delegado, y
// que el punto de venta exista y esté habilitado para Web Services. Los dos
// últimos son los pasos que todo el mundo se saltea.

export type MotivoFallo =
  | "sin-delegacion"
  | "punto-de-venta"
  | "certificado"
  | "arca-caida"
  | "desconocido";

export type VerificacionResultado =
  | { ok: true; puntosDeVenta: number[] }
  | { ok: false; motivo: MotivoFallo; mensaje: string };

function textoDelError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "";
}

/**
 * Traduce lo que devuelve ARCA a una instrucción que el usuario pueda seguir.
 * Nunca devuelve el texto crudo: los mensajes de ARCA vienen con prefijos SOAP y
 * a veces con trazas internas.
 */
export function traducirErrorArca(
  error: unknown,
  salesPoint: string,
): { motivo: MotivoFallo; mensaje: string } {
  const texto = textoDelError(error).toLowerCase();

  if (
    texto.includes("no se encuentra autorizado") ||
    texto.includes("cert.untrusted") ||
    texto.includes("cee no se encuentra") ||
    texto.includes("no autorizado a acceder")
  ) {
    return {
      motivo: "sin-delegacion",
      mensaje:
        "Falta autorizar a Cotizapp en ARCA. Entrá con tu Clave Fiscal a Administrador de Relaciones y delegá el servicio de Facturación Electrónica al certificado que generaste.",
    };
  }

  if (
    texto.includes("punto de venta") ||
    texto.includes("punto_de_venta") ||
    texto.includes("ptovta")
  ) {
    return {
      motivo: "punto-de-venta",
      mensaje: `El punto de venta ${salesPoint} no existe o no está habilitado para Web Services en ARCA. Crealo desde Regímenes de Facturación y Registración, eligiendo el tipo "Web Services".`,
    };
  }

  if (
    texto.includes("certificado") ||
    texto.includes("expirado") ||
    texto.includes("cms") ||
    texto.includes("firma")
  ) {
    return {
      motivo: "certificado",
      mensaje:
        "ARCA no aceptó tu certificado. Puede estar vencido o no ser el que corresponde a la llave que generamos. Generá uno nuevo y rehacé el trámite.",
    };
  }

  if (
    texto.includes("etimedout") ||
    texto.includes("econnreset") ||
    texto.includes("socket hang up") ||
    texto.includes("enotfound") ||
    texto.includes("network")
  ) {
    return {
      motivo: "arca-caida",
      mensaje:
        "ARCA no está respondiendo en este momento. No es un problema de tus datos: probá de nuevo en unos minutos.",
    };
  }

  return {
    motivo: "desconocido",
    mensaje:
      "No pudimos verificar tu certificado con ARCA. Revisá que hayas completado los tres pasos del trámite y probá de nuevo.",
  };
}

export async function verificarConexionArca(
  credentials: { cuit: string; certPem: string; keyPem: string },
  salesPoint: string,
  ticketStorage: ITicketStoragePort,
): Promise<VerificacionResultado> {
  try {
    const { Arca } = await import("@arcasdk/core");

    const arca = new Arca({
      cuit: Number(credentials.cuit.replace(/\D/g, "")),
      cert: credentials.certPem,
      key: credentials.keyPem,
      production: true,
      useHttpsAgent: true,
      ticketStorage,
    });

    const respuesta = await arca.electronicBillingService.getSalesPoints();

    // La forma exacta de la respuesta varía; nos interesa la lista de números.
    const crudos = (respuesta as { data?: unknown })?.data ?? respuesta;
    const lista = Array.isArray(crudos) ? crudos : [];
    const puntosDeVenta = lista
      .map((item) => Number((item as { Nro?: unknown })?.Nro ?? NaN))
      .filter((n) => Number.isFinite(n));

    const buscado = Number(salesPoint.replace(/\D/g, ""));
    if (puntosDeVenta.length > 0 && !puntosDeVenta.includes(buscado)) {
      return {
        ok: false,
        motivo: "punto-de-venta",
        mensaje: `Tu certificado funciona, pero el punto de venta ${salesPoint} no figura entre los habilitados para Web Services en ARCA. Los que tenés habilitados son: ${puntosDeVenta.join(", ")}.`,
      };
    }

    return { ok: true, puntosDeVenta };
  } catch (error) {
    logError("arca.verificar", error);
    const { motivo, mensaje } = traducirErrorArca(error, salesPoint);
    return { ok: false, motivo, mensaje };
  }
}
```

- [ ] **Step 4: Correr para verlos pasar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/arca-verify.test.ts`
Expected: PASS — 7 tests.

Nota: si `tsx` falla al importar el módulo por el `import "server-only"`, sacá ese import de `verify.ts` y dejá el módulo sin él (la función pura tiene que ser testeable). Reportalo si pasa.

- [ ] **Step 5: Verificar y commitear**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint`

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/arca/verify.ts tests/arca-verify.test.ts && git commit -m "feat(facturacion): verificacion del certificado contra ARCA con errores traducidos

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `lib/fiscal/estado.ts` — el estado del wizard

Decide qué paso mostrar. Puro, para que la UI no tenga lógica.

**Files:**
- Create: `lib/fiscal/estado.ts`
- Test: `tests/fiscal-estado.test.ts`

**Interfaces:**
- Produces:
  - `type PasoWizard = "datos" | "generar" | "tramite" | "subir" | "verificar" | "listo"`
  - `function pasoDelWizard(input: EntradaEstado): PasoWizard`
  - `type EntradaEstado = { tieneDatosFiscales: boolean; tieneLlave: boolean; tieneCertificado: boolean; verificado: boolean; certVencido: boolean }`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/fiscal-estado.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { pasoDelWizard } from "../lib/fiscal/estado";

const base = {
  tieneDatosFiscales: false,
  tieneLlave: false,
  tieneCertificado: false,
  verificado: false,
  certVencido: false,
};

test("sin datos fiscales, el primer paso es cargarlos", () => {
  assert.equal(pasoDelWizard(base), "datos");
});

test("con datos pero sin llave, toca generarla", () => {
  assert.equal(pasoDelWizard({ ...base, tieneDatosFiscales: true }), "generar");
});

test("con llave y sin certificado, toca el tramite en ARCA", () => {
  assert.equal(
    pasoDelWizard({ ...base, tieneDatosFiscales: true, tieneLlave: true }),
    "tramite",
  );
});

test("con certificado sin verificar, toca probar la conexion", () => {
  assert.equal(
    pasoDelWizard({
      ...base,
      tieneDatosFiscales: true,
      tieneLlave: true,
      tieneCertificado: true,
    }),
    "verificar",
  );
});

test("verificado y vigente, esta listo", () => {
  assert.equal(
    pasoDelWizard({
      tieneDatosFiscales: true,
      tieneLlave: true,
      tieneCertificado: true,
      verificado: true,
      certVencido: false,
    }),
    "listo",
  );
});

test("un certificado vencido vuelve al tramite aunque este verificado", () => {
  assert.equal(
    pasoDelWizard({
      tieneDatosFiscales: true,
      tieneLlave: true,
      tieneCertificado: true,
      verificado: true,
      certVencido: true,
    }),
    "tramite",
  );
});

test("sin datos fiscales gana el primer paso aunque haya llave", () => {
  assert.equal(pasoDelWizard({ ...base, tieneLlave: true }), "datos");
});
```

- [ ] **Step 2: Correr para verlos fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/fiscal-estado.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// Estado del wizard del certificado. Puro para que la UI no tenga que decidir
// nada: cada estado muestra un solo paso, el siguiente.

export type PasoWizard =
  | "datos"      // faltan CUIT, razón social y punto de venta
  | "generar"    // hay datos, falta la llave
  | "tramite"    // hay llave, falta el certificado de ARCA
  | "subir"      // reservado: el paso de subida vive dentro de "tramite"
  | "verificar"  // hay certificado, falta probar la conexión
  | "listo";     // verificado y vigente

export type EntradaEstado = {
  tieneDatosFiscales: boolean;
  tieneLlave: boolean;
  tieneCertificado: boolean;
  verificado: boolean;
  certVencido: boolean;
};

export function pasoDelWizard(input: EntradaEstado): PasoWizard {
  if (!input.tieneDatosFiscales) {
    return "datos";
  }

  // Un certificado vencido manda de vuelta al trámite: hay que sacar uno nuevo
  // en ARCA, aunque en su momento haya estado verificado.
  if (input.certVencido) {
    return "tramite";
  }

  if (!input.tieneLlave) {
    return "generar";
  }

  if (!input.tieneCertificado) {
    return "tramite";
  }

  if (!input.verificado) {
    return "verificar";
  }

  return "listo";
}
```

- [ ] **Step 4: Correr para verlos pasar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/fiscal-estado.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/fiscal/estado.ts tests/fiscal-estado.test.ts && git commit -m "feat(facturacion): estado del wizard del certificado, puro y testeable

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Las server actions del wizard

**Files:**
- Create: `app/actions/certificado.ts`

**Interfaces:**
- Consumes: `generateKeyAndCsr`, `parseCertificate`, `CertificateError` de `lib/fiscal/certificate`; `savePrivateKey`, `attachCertificate`, `loadCredentials`, `getCredentialSummary`, `markVerified` de `lib/fiscal/credentials`; `verificarConexionArca` de `lib/arca/verify`; `createSupabaseTicketStorage` de `lib/arca/ticket-storage`; `getFiscalProfile` de `lib/fiscal-profile`; `requireUser` de `lib/profile`.
- Produces:
  - `async function generarLlaveAction(): Promise<{ ok: true; csrPem: string; nombreArchivo: string } | { ok: false; error: string }>`
  - `async function subirCertificadoAction(formData: FormData): Promise<{ ok: true; cuit: string; venceEl: string } | { ok: false; error: string }>`
  - `async function verificarCertificadoAction(): Promise<{ ok: true } | { ok: false; error: string }>`

Sin test unitario: integran Clerk, Supabase y ARCA. Lo puro que usan ya está cubierto.

- [ ] **Step 1: Implementar**

```ts
"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseTicketStorage } from "@/lib/arca/ticket-storage";
import { verificarConexionArca } from "@/lib/arca/verify";
import {
  CertificateError,
  generateKeyAndCsr,
  parseCertificate,
} from "@/lib/fiscal/certificate";
import {
  attachCertificate,
  loadCredentials,
  markVerified,
  savePrivateKey,
} from "@/lib/fiscal/credentials";
import { getFiscalProfile } from "@/lib/fiscal-profile";
import { logError } from "@/lib/log";
import { requireUser } from "@/lib/profile";

const MAX_CERT_BYTES = 64 * 1024;

function fecha(iso: Date): string {
  return iso.toLocaleDateString("es-AR");
}

/** Genera la clave privada y el CSR. La clave nunca sale del servidor. */
export async function generarLlaveAction(): Promise<
  { ok: true; csrPem: string; nombreArchivo: string } | { ok: false; error: string }
> {
  try {
    const user = await requireUser();
    const fiscal = await getFiscalProfile(user.clerkId);

    if (!fiscal?.cuit || !fiscal.business_name) {
      return {
        ok: false,
        error: "Antes de generar la llave, completá tu CUIT y tu razón social.",
      };
    }

    const { privateKeyPem, csrPem } = generateKeyAndCsr({
      cuit: fiscal.cuit,
      businessName: fiscal.business_name,
      alias: "cotizapp",
    });

    await savePrivateKey(user.clerkId, privateKeyPem, csrPem, fiscal.cuit);

    revalidatePath("/perfil-empresa");

    return {
      ok: true,
      csrPem,
      nombreArchivo: `cotizapp-${fiscal.cuit.replace(/\D/g, "")}.csr`,
    };
  } catch (error) {
    if (error instanceof CertificateError) {
      return { ok: false, error: error.message };
    }
    logError("certificado.generar", error);
    return {
      ok: false,
      error: "No pudimos generar tu llave. Probá de nuevo en un momento.",
    };
  }
}

/** Asocia el .crt que el usuario bajó de ARCA. Valida de verdad antes de aceptarlo. */
export async function subirCertificadoAction(
  formData: FormData,
): Promise<{ ok: true; cuit: string; venceEl: string } | { ok: false; error: string }> {
  try {
    const user = await requireUser();

    const archivo = formData.get("cert");
    if (!(archivo instanceof File) || archivo.size === 0) {
      return { ok: false, error: "Elegí el archivo .crt que bajaste de ARCA." };
    }
    if (archivo.size > MAX_CERT_BYTES) {
      return {
        ok: false,
        error: "Ese archivo es demasiado grande para ser un certificado.",
      };
    }

    const certPem = await archivo.text();
    const parsed = await attachCertificate(user.clerkId, certPem);

    revalidatePath("/perfil-empresa");

    return { ok: true, cuit: parsed.cuit, venceEl: fecha(parsed.notAfter) };
  } catch (error) {
    if (error instanceof CertificateError) {
      return { ok: false, error: error.message };
    }
    logError("certificado.subir", error);
    return {
      ok: false,
      error: "No pudimos guardar el certificado. Probá de nuevo en un momento.",
    };
  }
}

/**
 * Prueba la conexión real con ARCA y, solo si funciona, sella la verificación.
 * Es una llamada de solo lectura: no emite ningún comprobante.
 */
export async function verificarCertificadoAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const user = await requireUser();
    const fiscal = await getFiscalProfile(user.clerkId);

    if (!fiscal?.sales_point) {
      return {
        ok: false,
        error: "Cargá tu punto de venta antes de verificar.",
      };
    }

    const credenciales = await loadCredentials(user.clerkId);

    if (credenciales.status !== "ok") {
      const mensaje =
        credenciales.status === "undecryptable"
          ? "Hay un problema con la configuración de tu certificado. Escribinos y lo resolvemos."
          : credenciales.status === "unavailable"
            ? "No pudimos leer tus datos en este momento. Probá de nuevo en un minuto."
            : "Todavía falta subir el certificado que bajaste de ARCA.";
      return { ok: false, error: mensaje };
    }

    const resultado = await verificarConexionArca(
      {
        cuit: credenciales.cuit,
        certPem: credenciales.certPem,
        keyPem: credenciales.privateKeyPem,
      },
      fiscal.sales_point,
      createSupabaseTicketStorage(user.clerkId, "produccion"),
    );

    if (!resultado.ok) {
      return { ok: false, error: resultado.mensaje };
    }

    // Recién acá: ARCA respondió que sí. Antes de esto el certificado era
    // material sin verificar y su CUIT no era confiable.
    const parsed = parseCertificate(credenciales.certPem);
    await markVerified(user.clerkId, parsed.certSerialNumber);

    revalidatePath("/perfil-empresa");
    revalidatePath("/cotizaciones");

    return { ok: true };
  } catch (error) {
    if (error instanceof CertificateError) {
      return { ok: false, error: error.message };
    }
    logError("certificado.verificar", error);
    return {
      ok: false,
      error: "No pudimos completar la verificación. Probá de nuevo en un momento.",
    };
  }
}
```

- [ ] **Step 2: Verificar y commitear**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint`
Expected: exit 0. Si `attachCertificate` o `markVerified` tienen otra firma que la asumida, ajustá la llamada a la firma real y reportalo.

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add app/actions/certificado.ts && git commit -m "feat(facturacion): server actions del wizard del certificado

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: El wizard

**Files:**
- Create: `components/profile/certificado-wizard.tsx`

Sin test unitario: es UI. Se verifica con typecheck, lint y build.

- [ ] **Step 1: Mirar el lenguaje visual del proyecto**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && cat components/profile/fiscal-profile-form.tsx`

Ese es el componente que el wizard acompaña. Usá el mismo patrón: `section.shell-panel`, títulos, `text-muted-foreground` para las descripciones, `Button` con `min-h-11`. No inventes un lenguaje visual nuevo.

- [ ] **Step 2: Implementar el componente**

Es un `"use client"` que recibe por props el estado ya calculado y renderiza **solo el paso que corresponde**, según `pasoDelWizard`:

Props:
```tsx
type CertificadoWizardProps = {
  paso: PasoWizard;
  cuitVerificado: string | null;
  venceEl: string | null;
};
```

Contenido de cada paso, en español latino neutro:

- **`datos`** — "Primero completá tus datos fiscales acá abajo: CUIT, razón social y punto de venta." Sin botón; el form de al lado hace el trabajo.

- **`generar`** — Explicá en una frase que Cotizapp le va a generar la llave y que no hace falta instalar nada. Botón "Generar mi llave" que llama a `generarLlaveAction`. Al volver con éxito, disparar la descarga del CSR en el navegador creando un `Blob` con `csrPem` y un enlace temporal con el `nombreArchivo`. Mostrar estado de carga mientras corre: la generación de una clave RSA tarda un par de segundos.

- **`tramite`** — Los tres pasos del trámite en ARCA, numerados y concretos. El texto tiene que nombrar los lugares exactos, porque son los que la gente no encuentra:
  1. Entrar a ARCA con Clave Fiscal → **Administración de Certificados Digitales** → subir el archivo `.csr` que descargaste → bajar el `.crt`.
  2. **Administrador de Relaciones** → delegar el servicio de **Facturación Electrónica** al certificado que acabás de crear.
  3. **Regímenes de Facturación y Registración** → crear el punto de venta con el tipo **Web Services**.
  Aclarar que los pasos 2 y 3 son los que más se saltean y sin ellos la facturación no funciona.
  Debajo, el campo para subir el `.crt` (`<Input type="file" accept=".crt,.pem">`) y un botón "Subir certificado" que llama a `subirCertificadoAction`. Y un enlace secundario para volver a descargar el CSR si lo perdió.

- **`verificar`** — Mostrar el CUIT que se leyó del certificado y su fecha de vencimiento. Botón "Probar conexión con ARCA", aclarando en una línea que es una prueba de solo lectura y que **no emite ninguna factura**. Al fallar, mostrar el mensaje traducido tal cual viene de la action: ya está redactado para el usuario, no lo reescribas ni le agregues prefijos.

- **`listo`** — Confirmación: "Ya podés emitir facturas", el CUIT verificado y la fecha de vencimiento del certificado. Si vence en menos de 30 días, un aviso para renovarlo.

Reglas de UI que aplican a todos los pasos:
- Un solo paso visible a la vez. Nada de acordeones con todo abierto.
- Estados de carga en cada botón (el proyecto tiene `Loader2` de lucide-react y ya se usa así en `components/cotizacion/emitir-factura-button.tsx`; mirá ese archivo).
- Los errores se muestran con `text-destructive`, en el mismo lugar donde estaba el botón.
- Nunca hardcodear un color.

- [ ] **Step 3: Verificar y commitear**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint`

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add components/profile/certificado-wizard.tsx && git commit -m "feat(facturacion): wizard del certificado ARCA por pasos

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Montar el wizard y limpiar el form viejo

**Files:**
- Modify: `app/(dashboard)/perfil-empresa/page.tsx`
- Modify: `components/profile/fiscal-profile-form.tsx`
- Modify: `app/actions/fiscal.ts`
- Modify: `lib/fiscal-profile.ts`

- [ ] **Step 1: Columnas explícitas en `getFiscalProfile`**

`lib/fiscal-profile.ts` hoy hace `select("*")` y la fila entera termina en el payload que viaja al navegador. Cambiar a columnas explícitas: `id, clerk_user_id, cuit, contributor_type, sales_point, business_name, created_at, updated_at`. Sacar `cert_path` y `key_path` del tipo `FiscalProfile` — ya no son la fuente de verdad y la migración de cierre del bucket las borra.

- [ ] **Step 2: Sacar del form fiscal lo que ahora hace el wizard**

En `components/profile/fiscal-profile-form.tsx`:
- Borrar el bloque de los dos `<Input type="file">` (certificado y clave) y sus indicadores de "cargado ✓".
- Borrar el selector de **Entorno de facturación** entero: el usuario ya no elige entorno.
- En el selector de tipo de contribuyente, dejar **solo** `monotributista`. Sacar la opción de Responsable Inscripto y agregar debajo, en `text-xs text-muted-foreground`: "Por ahora Cotizapp emite Factura C, así que la facturación electrónica está disponible solo para monotributistas."

- [ ] **Step 3: Sacar de la action fiscal la escritura al bucket**

En `app/actions/fiscal.ts`, borrar todo el bloque que sube `cert`/`key` al bucket y actualiza `cert_path`/`key_path`, junto con los imports que queden sin uso (`STORAGE_BUCKETS`, `uploadFile`, `assertValidFiscalCredential`, `UploadActionError`, `FiscalCredentialKind`, `readFile`). Sacar también la lectura y persistencia de `environment`. La action queda solo con el upsert de los campos de texto.

- [ ] **Step 4: Montar el wizard en la página**

En `app/(dashboard)/perfil-empresa/page.tsx`, donde hoy se renderiza `<FiscalProfileForm>`:
1. Traer el resumen de credenciales con `getCredentialSummary(user.clerkId)` de `lib/fiscal/credentials`.
2. Calcular el paso con `pasoDelWizard`, derivando cada campo:
   - `tieneDatosFiscales`: hay `cuit`, `business_name` y `sales_point` en el perfil fiscal.
   - `tieneLlave`: el resumen existe (la fila se crea al generar la llave).
   - `tieneCertificado`: `resumen.hasCert`.
   - `verificado`: `resumen.verifiedAt` no es null.
   - `certVencido`: `resumen.certNotAfter` es anterior a hoy.
3. Renderizar `<CertificadoWizard>` **arriba** del form fiscal, para que el paso siguiente sea lo primero que se ve.

- [ ] **Step 5: Verificar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint && npm test 2>&1 | tail -5`
Expected: los tres limpios. Si algún test se rompe por el cambio de tipo de `FiscalProfile`, ajustalo al contrato nuevo.

- [ ] **Step 6: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add "app/(dashboard)/perfil-empresa/page.tsx" components/profile/fiscal-profile-form.tsx app/actions/fiscal.ts lib/fiscal-profile.ts && git commit -m "feat(facturacion): montar el wizard y retirar la carga manual de archivos

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Verificación final

- [ ] **Step 1: Suite, typecheck, lint y build**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npm test 2>&1 | tail -5 && npx tsc --noEmit && npm run lint && rm -rf .next && npm run build 2>&1 | tail -10; echo "EXIT:${PIPESTATUS[0]}"`
Expected: `EXIT:0`, sin fallos.

- [ ] **Step 2: Confirmar que ya nadie escribe al bucket fiscal**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && grep -rn "STORAGE_BUCKETS.fiscal" app/ lib/ --include="*.ts" --include="*.tsx"`
Expected: sin coincidencias. Ese era el requisito para poder cerrar el bucket sin romper nada.

- [ ] **Step 3: Anotar lo que queda**

Para el reporte: con esta fase, el material fiscal ya no depende del bucket, así que **ahora sí** se puede correr la migración de datos y aplicar `20260730_cerrar_bucket_fiscal.sql`.

---

## Self-review

- Wizard por estados, un paso a la vez → Tasks 2 y 4. ✓
- Clave y CSR generados en el servidor; la clave nunca se descarga → Task 3. ✓
- Certificado validado de verdad antes de aceptarlo (lo hace `attachCertificate`, ya implementado en la Fase A) → Task 3. ✓
- Verificación por llamada de solo lectura contra producción, con errores traducidos, incluidos los dos pasos del trámite que todos se saltean → Task 1. ✓
- `verified_at` sellado solo tras esa llamada exitosa → Task 3. ✓
- El usuario no elige entorno; solo monotributistas → Task 5. ✓
- `select("*")` reemplazado por columnas explícitas → Task 5. ✓
- El bucket fiscal queda sin escritores → Tasks 5 y 6. ✓
- Fuera de alcance: la tabla `facturas`, la reconciliación y el receptor identificado (Fase C); la renovación automática del certificado antes del vencimiento.

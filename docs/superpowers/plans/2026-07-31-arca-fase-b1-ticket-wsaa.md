# ARCA Fase B1 — Ticket WSAA persistido y emisión con material cifrado

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el hallazgo crítico de la auditoría: sacar el caché de tickets WSAA de `/tmp` (donde se indexa por CUIT y se comparte entre usuarios) y hacer que la emisión use el material fiscal cifrado en vez del bucket en claro.

**Architecture:** Un adaptador del `ITicketStoragePort` del SDK contra una tabla `arca_tickets` con RLS de negación total, keyeada por `clerk_user_id` y con el ticket cifrado con el mismo sobre AES-256-GCM de la Fase A. `emitirFacturaC` pasa a recibir el storage por parámetro en vez de un `ticketPath`, y la server action lee las credenciales de `fiscal_credentials` en lugar de descargarlas del bucket.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase, `@arcasdk/core` 1.3.1, tests con `node:test` vía `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-07-30-arca-camino-1-design.md` (secciones 4.2, 4.6).
**Depende de:** la Fase A, ya implementada en esta misma rama.

## Global Constraints

- Todo el texto de la UI y los mensajes de error, en **español latino neutro**. Nunca errores técnicos crudos.
- **Nada que decida un resultado fiscal se indexa por un dato que controla el usuario.** La clave del ticket es `clerk_user_id`, **nunca** el CUIT. Este es el punto entero de la fase.
- El ticket WSAA (`token` + `sign`) es una **credencial portadora**: con ella se emite durante ~12 h sin la clave privada. Se guarda cifrado con el mismo sobre de la Fase A (`lib/crypto/envelope.ts`), con su propio `purpose` en la AAD.
- `service_role` saltea RLS: **toda** query filtra explícitamente por `clerk_user_id`.
- Migraciones SQL: el usuario las aplica a mano en el SQL Editor del Dashboard de `cotizapp-ia`.
- Al commitear, git imprime warnings inofensivos ("LF will be replaced by CRLF", "failed to delete '.git/worktrees/...'"). No son fallos; confirmar con `git log --oneline -1`.
- Rama de trabajo: `feat/arca-fase-b1`, creada desde `feat/arca-camino-1`.

### Dos correcciones al spec, ya verificadas contra el SDK

1. **El spec decía guardar `token_enc` y `sign_enc` por separado. Está mal.** `AccessTicket.create()` necesita `{ header, credentials }`: el `header` trae el `expirationtime` y sin él el ticket no se puede reconstruir. Se guarda **un solo blob** con el objeto entero.
2. **Omitir `ticketPath` no alcanza para desactivar el storage de archivos.** El constructor del SDK rellena un default que apunta dentro de `node_modules` (de solo lectura en Vercel) y vuelve a elegir `FileSystemTicketStorage`. Hay que pasar `ticketStorage` **explícito** siempre.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/20260731_arca_tickets.sql` | Tabla `arca_tickets` con RLS de negación total. |
| `lib/arca/ticket-storage.ts` | `ITicketStoragePort` contra Supabase, cifrado, keyeado por `clerk_user_id`. |
| `lib/fiscal/aad.ts` | Suma el propósito del ticket. |
| `tests/fiscal-aad.test.ts` | Fija el nuevo valor de AAD. |
| `lib/arca/billing.ts` | `emitirFacturaC` recibe el storage; se va `ticketPath`. |
| `app/actions/facturacion.ts` | Lee de `fiscal_credentials` en vez del bucket. |
| `lib/arca/eligibility.ts` | Deja de mirar `cert_path`/`key_path`. |
| `tests/arca-eligibility.test.ts` | Se ajusta al nuevo contrato. |

---

## Task 1: Migración de `arca_tickets`

**Files:**
- Create: `supabase/migrations/20260731_arca_tickets.sql`

**Interfaces:**
- Produces: la tabla `public.arca_tickets` que consume la Task 3.

- [ ] **Step 1: Crear la migración**

Crear `supabase/migrations/20260731_arca_tickets.sql`:

```sql
-- Tickets de acceso WSAA de ARCA. Antes se cacheaban en /tmp con un nombre de
-- archivo keyeado por CUIT (TA-{cuit}-{servicio}.json), y en Vercel /tmp se
-- comparte entre invocaciones de usuarios distintos en la misma instancia tibia.
-- Como el CUIT era un campo de formulario, eso permitía que un usuario reusara
-- el ticket de otro y emitiera facturas reales a su nombre. Acá la clave es
-- clerk_user_id y nunca el CUIT.
--
-- El ticket (token + sign) es una credencial portadora: con ella se emite durante
-- ~12 h SIN la clave privada. Por eso se guarda cifrado con el mismo sobre
-- AES-256-GCM que la clave, y la tabla tiene RLS de negación total: RLS activo,
-- ninguna policy, y revoke explícito. Solo se accede con service_role.
--
-- Se aplica a mano en el SQL Editor del Dashboard (proyecto cotizapp-ia).

create table if not exists public.arca_tickets (
  clerk_user_id     text not null,
  service_name      text not null,
  environment       text not null
    check (environment in ('homologacion', 'produccion')),
  -- Sobre AES-256-GCM en base64 del JSON { header, credentials } que devuelve
  -- WSAA. Se guarda entero porque AccessTicket.create() necesita el header:
  -- ahí viene el expirationtime, y sin él el ticket no se puede reconstruir.
  credentials_enc   text not null,
  expires_at        timestamptz not null,
  key_id            smallint not null default 1,
  updated_at        timestamptz not null default now(),
  primary key (clerk_user_id, service_name, environment)
);

alter table public.arca_tickets enable row level security;

revoke all on public.arca_tickets from authenticated, anon;

-- Para limpiar vencidos sin escanear la tabla entera.
create index if not exists arca_tickets_expires_at
  on public.arca_tickets (expires_at);
```

- [ ] **Step 2: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add supabase/migrations/20260731_arca_tickets.sql && git commit -m "feat(facturacion): migracion de arca_tickets con RLS de negacion total

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: El propósito del ticket en la AAD

**Files:**
- Modify: `lib/fiscal/aad.ts`
- Test: `tests/fiscal-aad.test.ts`

**Interfaces:**
- Produces: `PURPOSE_WSAA_TICKET` y `aadForTicket(clerkUserId, serviceName, environment)`.

- [ ] **Step 1: Leer lo que hay**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && cat lib/fiscal/aad.ts tests/fiscal-aad.test.ts`

Ese módulo ya existe y es la fuente de verdad única de la AAD (se extrajo justamente para que el script de migración y `credentials.ts` no pudieran divergir). Seguí su estilo exactamente.

- [ ] **Step 2: Agregar el test que falla**

Agregar a `tests/fiscal-aad.test.ts`:

```ts
import { aadForTicket } from "../lib/fiscal/aad";

test("aadForTicket ata el ticket al usuario, al servicio y al entorno", () => {
  assert.equal(
    aadForTicket("user_x", "wsfe", "produccion"),
    "user_x|wsaa-ticket|wsfe|produccion",
  );
});

test("aadForTicket distingue entornos y servicios", () => {
  assert.notEqual(
    aadForTicket("user_x", "wsfe", "produccion"),
    aadForTicket("user_x", "wsfe", "homologacion"),
  );
  assert.notEqual(
    aadForTicket("user_x", "wsfe", "produccion"),
    aadForTicket("user_x", "wsfex", "produccion"),
  );
});

test("aadForTicket nunca colisiona con la AAD de la clave privada", () => {
  assert.notEqual(aadForTicket("user_x", "wsfe", "produccion"), aadFor("user_x"));
});
```

Ajustá los imports del archivo para que `aadFor` y `aadForTicket` vengan del mismo módulo.

- [ ] **Step 3: Correr para verlo fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/fiscal-aad.test.ts`
Expected: FAIL — `aadForTicket` no existe.

- [ ] **Step 4: Implementar**

Agregar a `lib/fiscal/aad.ts`, siguiendo el estilo del archivo:

```ts
export const PURPOSE_WSAA_TICKET = "wsaa-ticket";

/**
 * Contexto de AAD para un ticket WSAA. Ata el criptograma al usuario, al
 * servicio y al entorno: un ticket de homologación no puede abrirse como si
 * fuera de producción, ni el de un usuario como el de otro.
 */
export function aadForTicket(
  clerkUserId: string,
  serviceName: string,
  environment: string,
): string {
  return `${clerkUserId}|${PURPOSE_WSAA_TICKET}|${serviceName}|${environment}`;
}
```

- [ ] **Step 5: Correr para verlo pasar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/fiscal-aad.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/fiscal/aad.ts tests/fiscal-aad.test.ts && git commit -m "feat(facturacion): AAD propia para los tickets WSAA

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `lib/arca/ticket-storage.ts` — el adaptador

**Files:**
- Create: `lib/arca/ticket-storage.ts`

**Interfaces:**
- Consumes: `seal`/`open`/`EnvelopeError` de `lib/crypto/envelope`; `getFiscalKeyring`/`ACTIVE_KEY_ID` de `lib/crypto/fiscal-key`; `aadForTicket` de `lib/fiscal/aad`; `createServiceRoleClient` de `lib/supabase/service-role`; `logError` de `lib/log`.
- Produces: `function createSupabaseTicketStorage(clerkUserId: string, environment: "homologacion" | "produccion"): ITicketStoragePort`

Sin test unitario: es acceso a Supabase más el tipo del SDK. La lógica pura de la que depende (sobre, AAD) ya está cubierta.

- [ ] **Step 1: Implementar**

```ts
import "server-only";

import { AccessTicket, type ITicketStoragePort } from "@arcasdk/core";

import { EnvelopeError, open, seal } from "@/lib/crypto/envelope";
import { ACTIVE_KEY_ID, getFiscalKeyring } from "@/lib/crypto/fiscal-key";
import { aadForTicket } from "@/lib/fiscal/aad";
import { logError } from "@/lib/log";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Storage de tickets WSAA contra Supabase, reemplazando el FileSystemTicketStorage
// del SDK.
//
// POR QUÉ EXISTE: el storage de archivos del SDK nombra el ticket
// `TA-{cuit}-{servicio}.json` en /tmp. En Vercel /tmp se comparte entre
// invocaciones de usuarios distintos en la misma instancia tibia, y el CUIT era
// un campo de formulario. Un usuario podía reusar el ticket de otro y emitir
// facturas reales a su nombre. Acá la clave es `clerk_user_id`, jamás el CUIT.
//
// El port solo recibe `serviceName` en sus métodos, así que el resto de la clave
// (usuario y entorno) va capturado en el closure. NO derivar nunca la clave de
// nada que venga del SDK.
//
// El ticket es una credencial portadora (~12 h de emisión sin la clave privada),
// así que va cifrado con el mismo sobre que la clave.

const TABLE = "arca_tickets";

/** Margen antes del vencimiento real: no queremos usar un ticket que muere en
 * el medio de la llamada a ARCA. */
const RENEW_MARGIN_MS = 10 * 60 * 1000;

type StoredCredentials = {
  header: unknown;
  credentials: unknown;
};

export function createSupabaseTicketStorage(
  clerkUserId: string,
  environment: "homologacion" | "produccion",
): ITicketStoragePort {
  const aadFor = (serviceName: string) =>
    aadForTicket(clerkUserId, serviceName, environment);

  return {
    async save(ticket: AccessTicket, serviceName: string): Promise<void> {
      try {
        const payload: StoredCredentials = {
          header: ticket.getHeaders(),
          credentials: ticket.getCredentials(),
        };

        const keyring = getFiscalKeyring();
        const blob = seal(
          keyring.active,
          JSON.stringify(payload),
          aadFor(serviceName),
        );

        const supabase = createServiceRoleClient();
        const { error } = await supabase.from(TABLE).upsert(
          {
            clerk_user_id: clerkUserId,
            service_name: serviceName,
            environment,
            credentials_enc: blob.toString("base64"),
            expires_at: ticket.getExpiration().toISOString(),
            key_id: ACTIVE_KEY_ID,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "clerk_user_id,service_name,environment" },
        );

        if (error) {
          logError("arca.ticket.save", error, { code: error.code ?? null });
        }
      } catch (error) {
        // Nunca romper la emisión por no poder cachear: en el peor caso se pide
        // un ticket nuevo la próxima vez.
        logError("arca.ticket.save", error);
      }
    },

    async get(serviceName: string): Promise<AccessTicket | null> {
      try {
        const supabase = createServiceRoleClient();
        const { data, error } = await supabase
          .from(TABLE)
          .select("credentials_enc, expires_at")
          .eq("clerk_user_id", clerkUserId)
          .eq("service_name", serviceName)
          .eq("environment", environment)
          .maybeSingle();

        if (error) {
          logError("arca.ticket.get", error, { code: error.code ?? null });
          return null;
        }

        if (!data?.credentials_enc) {
          return null;
        }

        // Filtramos por vencimiento acá, con margen, en vez de confiar solo en
        // isExpired() del SDK.
        const expiresAt = new Date(String(data.expires_at)).getTime();
        if (!Number.isFinite(expiresAt) || expiresAt - RENEW_MARGIN_MS <= Date.now()) {
          return null;
        }

        const keyring = getFiscalKeyring();
        const plain = open(
          keyring.all,
          Buffer.from(String(data.credentials_enc), "base64"),
          aadFor(serviceName),
        ).toString("utf8");

        const parsed = JSON.parse(plain) as StoredCredentials;

        // AccessTicket.create espera { header, credentials } tal como los
        // devolvió WSAA.
        return AccessTicket.create(
          parsed as unknown as Parameters<typeof AccessTicket.create>[0],
        );
      } catch (error) {
        if (error instanceof EnvelopeError) {
          // Ticket ilegible (clave rotada, blob alterado): que pida uno nuevo.
          logError("arca.ticket.get.open", error);
          return null;
        }
        logError("arca.ticket.get", error);
        return null;
      }
    },

    async delete(serviceName: string): Promise<void> {
      try {
        const supabase = createServiceRoleClient();
        const { error } = await supabase
          .from(TABLE)
          .delete()
          .eq("clerk_user_id", clerkUserId)
          .eq("service_name", serviceName)
          .eq("environment", environment);

        if (error) {
          logError("arca.ticket.delete", error, { code: error.code ?? null });
        }
      } catch (error) {
        logError("arca.ticket.delete", error);
      }
    },
  };
}
```

- [ ] **Step 2: Confirmar que el SDK exporta lo que importamos**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit`

Si `AccessTicket` o `ITicketStoragePort` no se exportan desde la raíz de `@arcasdk/core`, buscá la ruta real:
`grep -rn "AccessTicket\|ITicketStoragePort" node_modules/@arcasdk/core/lib/index.d.ts`
y ajustá el import. **No cambies la lógica**, solo el origen del import, y reportalo.

Expected: exit 0.

- [ ] **Step 3: Lint**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npm run lint`
Expected: exit 0. La regla de `no-restricted-imports` **no** debe disparar: `lib/arca/` está permitido.

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/arca/ticket-storage.ts && git commit -m "feat(facturacion): ticket WSAA persistido en Supabase, keyeado por usuario

Cierra el hallazgo critico: el caché en /tmp se indexaba por CUIT y se comparte
entre usuarios en la misma instancia de Vercel.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `emitirFacturaC` recibe el storage

**Files:**
- Modify: `lib/arca/billing.ts`

- [ ] **Step 1: Leer el adaptador actual**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && sed -n '200,260p' lib/arca/billing.ts`

Hoy construye el `Arca` con `ticketPath: path.join(os.tmpdir(), "arca-tickets")`.

- [ ] **Step 2: Cambiar la firma y el constructor**

1. Importar el tipo del port junto a los imports existentes del archivo:

```ts
import type { ITicketStoragePort } from "@arcasdk/core";
```

(Si `billing.ts` no tiene imports estáticos de `@arcasdk/core` porque usa `await import(...)`, agregá solo el `import type`, que se borra en compilación y no afecta el runtime.)

2. Agregar el campo al tipo `ArcaCredentials`:

```ts
export type ArcaCredentials = {
  cuit: string;
  certPem: string;
  keyPem: string;
  environment: ArcaEnvironment;
  /** Storage del ticket WSAA. Obligatorio: sin esto el SDK cae en su
   * FileSystemTicketStorage, que indexa por CUIT en un /tmp compartido. */
  ticketStorage: ITicketStoragePort;
};
```

3. En `emitirFacturaC`, sacar los imports de `node:os` y `node:path` y reemplazar la construcción:

```ts
  const arca = new Arca({
    cuit: Number(credentials.cuit.replace(/\D/g, "")),
    cert: credentials.certPem,
    key: credentials.keyPem,
    production: credentials.environment === "produccion",
    // ARCA usa TLS legacy; en Node hace falta el agente HTTPS legacy.
    useHttpsAgent: true,
    // SIEMPRE explícito. Omitirlo no alcanza: el SDK rellena un default que
    // apunta dentro de node_modules (solo lectura en Vercel) y vuelve a elegir
    // FileSystemTicketStorage, que keyea por CUIT en un /tmp compartido.
    ticketStorage: credentials.ticketStorage,
  });
```

Comprobá que no quede ninguna referencia a `ticketPath`, `os.tmpdir` ni `node:path` en el archivo.

- [ ] **Step 3: Verificar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && grep -n "ticketPath\|tmpdir\|node:os\|node:path" lib/arca/billing.ts; echo "EXIT:$?"`
Expected: sin coincidencias (`EXIT:1` de grep, que acá es lo bueno).

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit`
Expected: va a fallar en `app/actions/facturacion.ts`, que todavía no pasa `ticketStorage`. Es lo esperado; lo arregla la Task 5.

- [ ] **Step 4: Correr los tests de billing**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/arca-billing.test.ts`
Expected: PASS. Esos tests ejercitan `issueFacturaC` con un fake, no el adaptador real, así que no deberían verse afectados.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/arca/billing.ts && git commit -m "feat(facturacion): emitirFacturaC recibe el ticket storage; se va el ticketPath de /tmp

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: La emisión lee el material cifrado

**Files:**
- Modify: `app/actions/facturacion.ts`
- Modify: `lib/arca/eligibility.ts`
- Test: `tests/arca-eligibility.test.ts`

**Interfaces:**
- Consumes: `loadCredentials` de `lib/fiscal/credentials`, `createSupabaseTicketStorage` de `lib/arca/ticket-storage`.

- [ ] **Step 1: Ajustar la elegibilidad**

`lib/arca/eligibility.ts` hoy exige `cert_path` y `key_path`, columnas que la Fase A dejó obsoletas (las borra la migración de cierre del bucket). El nuevo contrato es: el perfil fiscal aporta los datos de texto, y el certificado verificado vive en `fiscal_credentials`.

Reemplazar el contenido de `lib/arca/eligibility.ts` por:

```ts
// Elegibilidad para emitir Factura C. El formato del CUIT ya se valida al
// capturar los datos fiscales, así que acá solo chequeamos presencia + que sea
// monotributista (v1 solo emite Factura C).
//
// Ojo: esto NO dice que el usuario tenga un certificado válido. Eso vive en
// `fiscal_credentials.verified_at` y lo chequea quien va a emitir. Acá solo se
// mira que los datos de texto del perfil estén completos.

export type BillingFiscalProfile = {
  cuit: string | null;
  sales_point: string | null;
  contributor_type: string | null;
};

function isFilled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function isFiscalProfileComplete(
  profile: BillingFiscalProfile | null | undefined,
): boolean {
  if (!profile) {
    return false;
  }

  return (
    isFilled(profile.cuit) &&
    isFilled(profile.sales_point) &&
    profile.contributor_type === "monotributista"
  );
}
```

Y en `tests/arca-eligibility.test.ts`, sacar `cert_path` y `key_path` del objeto `complete` y borrar el test que verificaba que faltando esos campos rechaza. Agregar en su lugar:

```ts
test("no exige certificado: eso se verifica aparte, contra fiscal_credentials", () => {
  assert.equal(isFiscalProfileComplete(complete), true);
});
```

- [ ] **Step 2: Correr los tests de elegibilidad**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/arca-eligibility.test.ts`
Expected: PASS.

- [ ] **Step 3: Cambiar la lectura de credenciales en la server action**

En `app/actions/facturacion.ts`:

1. Sacar los imports de `STORAGE_BUCKETS` y `downloadFile` si quedan sin uso, y agregar:

```ts
import { createSupabaseTicketStorage } from "@/lib/arca/ticket-storage";
import { loadCredentials } from "@/lib/fiscal/credentials";
```

2. Reemplazar el bloque que descarga `cert.crt` y `private.key` del bucket (hoy dentro del `try` de la rama que no es demo) por:

```ts
        const credentials = await loadCredentials(user.clerkId);

        if (credentials.status !== "ok") {
          await releaseClaim();

          const mensaje =
            credentials.status === "undecryptable"
              ? "Hay un problema con la configuración de tu certificado. Escribinos y lo resolvemos."
              : credentials.status === "unavailable"
                ? "No pudimos leer tus datos fiscales en este momento. Probá de nuevo en un minuto."
                : "Todavía no cargaste tu certificado de ARCA. Configuralo en Mi empresa antes de facturar.";

          return { ok: false, error: mensaje };
        }
```

3. Reemplazar la llamada a `emitirFacturaC` para que use el CUIT **del certificado** y pase el storage:

```ts
        result = await emitirFacturaC(
          {
            // El CUIT sale del certificado, no del formulario: es la autoridad.
            cuit: credentials.cuit,
            certPem: credentials.certPem,
            keyPem: credentials.privateKeyPem,
            environment,
            ticketStorage: createSupabaseTicketStorage(
              user.clerkId,
              environment === "produccion" ? "produccion" : "homologacion",
            ),
          },
          {
            salesPoint: fiscal!.sales_point,
            total: Number(quotation.total ?? 0),
            date: new Date(),
          },
        );
```

No cambies nada más de la función: el claim atómico, la clasificación de errores y la persistencia del CAE quedan como están (los revisa la Fase C).

- [ ] **Step 4: Verificar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint`
Expected: exit 0 en ambos.

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && grep -rn "STORAGE_BUCKETS.fiscal\|private.key\|cert.crt" app/ lib/ --include="*.ts" --include="*.tsx" | grep -v "scripts/"`
Expected: solo quedan referencias en `app/actions/fiscal.ts` (el form viejo, que reemplaza la Fase B2). Anotar cuáles quedaron.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add app/actions/facturacion.ts lib/arca/eligibility.ts tests/arca-eligibility.test.ts && git commit -m "feat(facturacion): la emision usa el material cifrado y el CUIT del certificado

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Verificación final

**Files:** ninguno.

- [ ] **Step 1: Suite completa**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npm test 2>&1 | tail -6`
Expected: sin fallos.

- [ ] **Step 2: Typecheck, lint y build**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint && rm -rf .next && npm run build 2>&1 | tail -12; echo "EXIT:${PIPESTATUS[0]}"`
Expected: `EXIT:0`.

- [ ] **Step 3: Confirmar que el crítico quedó cerrado**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && grep -rn "ticketPath\|arca-tickets\"" lib/ app/ --include="*.ts" | grep -v "ticket-storage.ts"`
Expected: sin coincidencias. Ningún camino de la app puede volver a caer en el storage de archivos del SDK.

- [ ] **Step 4: Anotar los pasos manuales**

Para el reporte (no ejecutar): el usuario tiene que correr `supabase/migrations/20260731_arca_tickets.sql` en el SQL Editor del Dashboard de `cotizapp-ia`. Hasta entonces, cada emisión pide un ticket nuevo a WSAA y ARCA va a rechazar el segundo pedido dentro de las 12 h con "el CEE ya posee un TA válido".

---

## Self-review

- Ticket WSAA fuera de `/tmp`, keyeado por `clerk_user_id` y nunca por CUIT → Tasks 1 y 3. ✓
- Ticket cifrado con el mismo sobre, con AAD propia que distingue servicio y entorno → Tasks 2 y 3. ✓
- `ticketStorage` siempre explícito, porque omitir `ticketPath` no desactiva el storage de archivos → Task 4. ✓
- Renovación con margen y filtrado por `expires_at` en el SELECT → Task 3. ✓
- La emisión usa el CUIT del certificado, no el del formulario → Task 5. ✓
- La elegibilidad deja de depender de columnas que la Fase A dejó obsoletas → Task 5. ✓
- Corrección al spec (un solo blob en vez de `token_enc`/`sign_enc`), justificada → cabecera y Task 1. ✓
- Fuera de alcance: el wizard del certificado (Fase B2), la tabla `facturas` y la reconciliación (Fase C), y el form fiscal viejo, que sigue escribiendo al bucket hasta la B2.

# Camino 1 — Facturación ARCA con certificado propio por usuario

> Spec de diseño. Fecha: 2026-07-30.
> Reemplaza en lo que corresponda a `2026-06-18-arca-electronic-invoicing-design.md`
> y `2026-06-18-fiscal-profile-argentina-design.md`, que quedan como historia.

## 1. Objetivo

Dejar el **Camino 1** listo para vender: cada usuario obtiene su propio certificado digital
de ARCA, lo carga en Cotizapp guiado por un wizard, y emite Facturas C bajo su propio CUIT y
su propia responsabilidad fiscal.

Hoy el flujo existe pero tiene tres defectos críticos de seguridad, cinco de integridad fiscal
y un onboarding inviable para el público objetivo (autónomos sin conocimientos técnicos).
Este spec cubre las tres cosas.

**No está desplegado en producción.** No hay usuarios con certificado real cargado más allá
del propio autor, así que no hace falta contención previa: se arregla y se lanza arreglado.

## 2. Decisiones de producto

| Decisión | Resolución |
|---|---|
| Alcance | Paquete completo: wizard + los tres bloqueantes técnicos + cifrado. |
| Contribuyente | **Solo monotributistas** (Factura C). `responsable_inscripto` sale del selector. |
| Entorno | **El usuario nunca lo elige.** Demo hasta que el certificado se verifica; producción después. |
| Receptor | Documento del cliente opcional; si está, la factura sale identificada. |

### 2.1 Corrección sobre la verificación del certificado

Un certificado emitido por ARCA **producción no funciona en homologación** — homologación usa
certificados propios obtenidos vía WSASS. Por lo tanto no se puede "probar en homologación" un
certificado de producción.

La verificación se hace con una llamada de **solo lectura contra producción**:
`electronicBillingService.getSalesPoints()`. No emite nada y valida de una tres cosas: que el
certificado sea válido, que el web service esté delegado, y que el punto de venta exista.

## 3. Estado actual

Existe y funciona: tabla `fiscal_profiles`, bucket privado `fiscal`, form de datos fiscales con
upload de `.crt`/`.key`, emisión de Factura C vía `@arcasdk/core@1.3.1`, claim atómico por
cotización, PDF de factura con CAE y QR de RG 4291, modo demo simulado.

Auditado el 2026-07-30 con cuatro lentes independientes y verificación adversaria por hallazgo:
**31 hallazgos confirmados, 1 refutado.** El detalle de cada uno y su trazabilidad está en la
sección 12.

### 3.1 Los tres críticos, que son un solo bug

1. **El CUIT no está ligado al certificado.** `assertValidFiscalCredential`
   (`lib/uploads.ts:195-218`) valida la extensión del nombre de archivo y que pese menos de
   64 KB. No parsea el PEM, no verifica que la clave privada corresponda al certificado, y no
   verifica que el CUIT del subject sea el CUIT declarado. `fiscal_profiles.cuit` es texto libre
   que teclea el usuario y no tiene índice único.

2. **El caché de tickets WSAA se indexa por CUIT.** `emitirFacturaC` (`lib/arca/billing.ts:225`)
   pasa `ticketPath: os.tmpdir()/arca-tickets`. El SDK nombra el archivo
   `TA-{cuit}-{servicio}[-production].json` — la única clave es el CUIT — y `AuthRepository.login`
   devuelve el ticket cacheado **sin volver a mirar el certificado ni la clave** si no venció
   (~12 h). En Vercel `/tmp` se comparte entre invocaciones de usuarios distintos en la misma
   instancia tibia.

3. **Encadenados:** un atacante declara el CUIT ajeno (dato público: figura en cada factura y en
   el QR), sube cualquier par de archivos con nombre `.crt`/`.key` y emite. Si la víctima facturó
   hace poco en esa instancia, el SDK le entrega su ticket y **ARCA emite una Factura C real bajo
   el CUIT de la víctima**, sin que el atacante haya tenido nunca su clave privada.

   Variante determinista (no depende de instancia tibia): el atacante saca un certificado propio
   de ARCA — gratis para cualquiera con CUIT —, declara el CUIT ajeno y emite. El ticket de *su*
   CUIT queda guardado bajo el nombre del de la víctima, y **la facturación de la víctima falla**
   de forma repetible.

### 3.2 El otro grave: la clave privada es alcanzable desde el navegador

La policy del bucket `fiscal` (`20260618_fiscal_profiles.sql:34-46`) es `for all to authenticated`,
y `for all` incluye `SELECT`. El único cliente Supabase del proyecto usa la anon key más el JWT de
Clerk, y ambos están disponibles en el navegador. Un XSS o una sesión de Clerk robada permite
`supabase.storage.from('fiscal').download('user_XXX/private.key')` y llevarse el PEM en claro.
`next.config.mjs` además declara explícitamente que no hay CSP.

Cifrar en reposo ayuda pero no alcanza: sin quitar el `SELECT`, el atacante se lleva el
ciphertext y solo le falta la clave del entorno.

## 4. Arquitectura

Cuatro principios que ordenan todo lo demás:

1. **El material fiscal no vive donde llega el navegador.** Clave privada y tickets WSAA salen
   de Storage y van a tablas con RLS de negación total, accesibles solo desde el servidor con
   `service_role`.
2. **La identidad fiscal la determina el servidor, no el formulario.** El CUIT se extrae del
   certificado, no se teclea.
3. **Nada que decida un resultado fiscal se indexa por un dato que controla el usuario.** La
   clave de todo caché es `clerk_user_id`, nunca el CUIT.
4. **El ciclo de vida del comprobante vive en su propia tabla**, no en columnas de `quotations`
   que el cliente puede reescribir por PostgREST.

### 4.1 Módulos nuevos

| Módulo | Responsabilidad |
|---|---|
| `lib/supabase/service-role.ts` | Acceso privilegiado. `import "server-only"`. **Exporta funciones, no un cliente** — nadie puede obtener un cliente crudo que saltee RLS. |
| `lib/crypto/envelope.ts` | Sobre AES-256-GCM: `seal(plaintext, aad)` / `open(blob, aad)`. Puro, testeable. |
| `lib/fiscal/credentials.ts` | Guardar/leer credenciales cifradas. Único lugar que descifra. |
| `lib/fiscal/certificate.ts` | node-forge: generar clave + CSR, parsear `.crt`, extraer CUIT y vencimiento, verificar correspondencia clave↔certificado. Puro. |
| `lib/arca/ticket-storage.ts` | `ITicketStoragePort` contra `arca_tickets`, cifrado, keyeado por `clerk_user_id`. |
| `lib/arca/verify.ts` | `getSalesPoints()` de solo lectura + traducción de errores de ARCA a castellano. |
| `lib/arca/vouchers.ts` | Reserva de número, transición de estados, reconciliación con `getVoucherInfo`. |
| `lib/log.ts` | `logError(scope, error)` que extrae solo `{ name, message }`. |
| `components/profile/certificado-wizard.tsx` | El wizard, por estados. |
| `app/api/facturacion/emitir/route.ts` | Emisión, con `maxDuration` explícito. |
| `app/api/facturacion/verificar/route.ts` | Reconciliación de un comprobante en revisión. |

### 4.2 Modelo de datos

Todo se aplica a mano en el SQL Editor del Dashboard de `cotizapp-ia`, como el resto del proyecto.

```sql
-- Credenciales fiscales. RLS de negación total: sin policies para authenticated.
-- Solo se accede con service_role desde el servidor.
create table if not exists public.fiscal_credentials (
  clerk_user_id       text primary key,
  cuit                text not null,          -- extraído del certificado, NO del formulario
  private_key_enc     bytea not null,
  cert_pem            text,                   -- parte pública, no se cifra
  cert_serial         text,
  cert_not_after      timestamptz,
  key_id              smallint not null default 1,
  csr_pem             text,                   -- para que el usuario lo pueda volver a bajar
  verified_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.fiscal_credentials enable row level security;
revoke all on public.fiscal_credentials from authenticated, anon;
-- Sin CREATE POLICY: con RLS activo y sin policies, authenticated no ve nada.

create unique index if not exists fiscal_credentials_cuit_verificado
  on public.fiscal_credentials (cuit) where verified_at is not null;

-- Tickets WSAA. Mismo régimen.
create table if not exists public.arca_tickets (
  clerk_user_id  text not null,
  service_name   text not null,
  environment    text not null check (environment in ('homologacion','produccion')),
  token_enc      bytea not null,
  sign_enc       bytea not null,
  expires_at     timestamptz not null,
  updated_at     timestamptz not null default now(),
  primary key (clerk_user_id, service_name, environment)
);

alter table public.arca_tickets enable row level security;
revoke all on public.arca_tickets from authenticated, anon;

-- Ciclo de vida del comprobante. Fuera de quotations para que el cliente no lo pueda reescribir.
create table if not exists public.facturas (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null,          -- profiles.id, para joins
  clerk_user_id         text not null,
  quotation_id          uuid not null,
  environment           text not null check (environment in ('demo','produccion')),
  estado                text not null check (estado in ('reservado','emitido','en_revision','descartado')),
  cuit_emisor           text not null,
  pto_vta               integer not null,
  cbte_tipo             integer not null default 11,
  cbte_nro              integer not null,
  cbte_fch              date not null,          -- EXACTAMENTE lo que se le mandó a ARCA
  importe_total         numeric(15,2) not null,
  doc_tipo              integer not null,
  doc_nro               bigint not null,
  cond_iva_receptor     integer not null,
  cae                   text,
  cae_vencimiento       date,
  observaciones         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.facturas enable row level security;
revoke all on public.facturas from authenticated, anon;

create unique index if not exists facturas_numeracion
  on public.facturas (clerk_user_id, pto_vta, cbte_tipo, cbte_nro);
create unique index if not exists facturas_una_por_cotizacion
  on public.facturas (quotation_id) where estado in ('reservado','emitido','en_revision');

-- Receptor.
alter table public.clients
  add column if not exists tax_id text,
  add column if not exists iva_condition text
    check (iva_condition in ('responsable_inscripto','monotributista','exento','consumidor_final'));

-- fiscal_profiles: el entorno deja de ser elegible y el CUIT deja de ser autoridad.
alter table public.fiscal_profiles
  drop column if exists environment;
```

Las columnas `cae`, `cae_vencimiento`, `numero_factura` y `facturado_at` de `quotations` quedan
**deprecadas**: se dejan de escribir y de leer. No se borran en esta entrega para no romper filas
existentes; se limpian en una migración posterior una vez confirmado que nada las usa.

### 4.3 El sobre criptográfico

Formato explícito y versionado, porque cambiarlo después obliga a re-cifrar el material de todos:

```
magic "CZFK" (4) || version (1) || keyId (1) || iv (12) || tag (16) || ciphertext
```

- `AAD = "${version}|${keyId}|${clerkUserId}|${purpose}"`, con `purpose` en
  `"fiscal-private-key" | "wsaa-token" | "wsaa-sign"`. Se construye en el servidor a partir del
  `clerkUserId` del request; **no se lee del blob**. Un blob de otro usuario falla en
  `decipher.final()` por authTag inválido — que es exactamente el comportamiento deseado.
- `crypto.randomBytes(12)` por operación. Nunca un IV derivado ni fijo: con GCM, repetir
  (clave, IV) permite recuperar la subclave de autenticación y forjar criptogramas.
- `createCipheriv` siempre, nunca `createCipher`. `setAAD()` antes del primer `update()`.
  `getAuthTag()` después de `final()`. `setAuthTag()` obligatorio antes de `final()` al descifrar.
- Cualquier fallo de autenticación al descifrar se trata como "credencial corrupta, volvé a
  cargar el certificado", nunca como "reintentá".

**La clave:**

- `FISCAL_ENCRYPTION_KEY` — base64 de 32 bytes exactos, generada con `openssl rand -base64 32`.
- Validación al cargar el módulo: `Buffer.from(env, 'base64')` y `byteLength !== 32` → tirar.
  **Fail closed**: si falta la clave, no se guarda nada en claro. Nunca un `slice(0,32)` ni padding.
- `FISCAL_ENCRYPTION_KEY_PREVIOUS` opcional, solo para descifrar durante una rotación. El `keyId`
  del sobre indica con cuál se cifró.
- En Vercel, ambas marcadas **solo para el entorno Production**. Si estuvieran en Preview,
  cualquier deploy de PR podría descifrar el material de producción.

### 4.4 El wizard

Vive en `/perfil-empresa` y reemplaza el bloque de archivos sueltos del form actual. Cinco estados,
cada uno mostrando solo el paso siguiente:

1. **Sin datos** — CUIT, razón social, punto de venta. El CUIT acá es solo un valor esperado que
   sirve para chequear después contra el certificado; no es autoridad.
2. **Generar la llave** — el servidor genera RSA 2048 y el CSR con node-forge, guarda la clave
   cifrada y descarga el `.csr`. La clave privada nunca sale del servidor.
3. **Hacer el trámite en ARCA** — instrucciones concretas de los tres pasos, incluidos los dos que
   todo el mundo se saltea:
   - Administración de Certificados Digitales → subir el CSR → bajar el `.crt`.
   - Administrador de Relaciones → **delegar el web service de Facturación Electrónica** al
     certificado.
   - Regímenes de Facturación → **crear el punto de venta como "Web Services"**.
4. **Subir el certificado** — se valida de verdad antes de aceptarlo (sección 4.5).
5. **Probar conexión** — `getSalesPoints()`. Si pasa, `verified_at` se sella y el usuario queda en
   producción. Si no, se traduce el error a castellano (sección 6).

**El upload de `.key` desaparece por completo.** Si el servidor genera la clave, el usuario no debe
poder subir una nunca: si conviviera, el wizard sería una fachada y el vector seguiría abierto.

Se soporta también el caso "ya tengo mi certificado": el usuario sube su `.crt` **y** su `.key`
por una ruta que aplica exactamente las mismas validaciones de la sección 4.5. Es la única
excepción al párrafo anterior y existe porque hay usuarios que ya hicieron el trámite.

Esa excepción no reabre el vector crítico, y conviene entender por qué. El ataque de la sección
3.1 funcionaba porque el CUIT lo declaraba el usuario y nadie lo contrastaba con nada. Con la
validación de 4.5, el CUIT sale del certificado: para emitir a nombre de otro habría que tener su
clave privada — y quien la tenga ya puede facturar por él desde cualquier herramienta de ARCA, sin
pasar por Cotizapp. Cotizapp deja de ser el eslabón débil.

### 4.5 Validación del certificado

Antes de aceptar nada, con node-forge:

1. Headers PEM presentes (`-----BEGIN CERTIFICATE-----`).
2. `pki.certificateFromPem` parsea sin error.
3. `cert.publicKey.n` igual al módulo de la clave privada que tenemos guardada (o de la que subió).
4. `cert.validity.notAfter` en el futuro.
5. CUIT extraído del `serialNumber` del subject (`CUIT 20123456789`). **Ese CUIT es el que se
   escribe en `fiscal_credentials.cuit` y el que se le pasa a `new Arca({ cuit })`.** El campo del
   formulario deja de ser una credencial: si no coincide, se rechaza con un mensaje claro.
6. Índice único sobre `cuit where verified_at is not null`: un CUIT verificado pertenece a una
   sola cuenta.

Cambiar el CUIT o el certificado invalida `verified_at`, borra las filas de `arca_tickets` de ese
usuario y lo devuelve a modo demo.

### 4.5.1 Migración de lo que ya existe

Dos cosas hay que traer del esquema viejo, y ninguna se hace de forma perezosa dentro del flujo de
emisión: es el momento de mayor presión de tiempo y si el proceso muere a mitad, la clave en claro
queda en el bucket para siempre sin que nadie se entere.

**La clave privada del autor**, hoy en `fiscal/{clerkId}/private.key` en claro. Se migra con una
operación explícita y auditable, en este orden estricto:

1. Leer el PEM del bucket y validarlo contra el `.crt` (misma validación de 4.5).
2. Escribir `fiscal_credentials` con la clave cifrada y el CUIT extraído del certificado.
3. **Releer y descifrar para verificar** que el material quedó recuperable.
4. Recién entonces borrar el objeto del bucket, con el borrado **no silenciado**: si falla, se
   reintenta y se loguea ruidosamente.
5. Barrido final que liste el bucket y falle si queda algún objeto de clave.

La fuente de verdad de si un usuario está migrado es la existencia de su fila en
`fiscal_credentials`, no la presencia o ausencia de un archivo.

**Las cotizaciones ya facturadas.** Las filas con `quotations.cae` no nulo se backfillean a
`facturas` con `estado='emitido'` y `environment='demo'` — salvo evidencia en contrario, porque
todo lo emitido hasta hoy fue prueba. `pto_vta` y `cbte_nro` se derivan del `numero_factura`
existente, descartando el prefijo `DEMO-` cuando está. Después del backfill, el detalle de la
cotización lee de `facturas` y `getQuotationInvoicing` se retira.

### 4.6 Ticket WSAA

Adaptador de `ITicketStoragePort` contra `arca_tickets`. Detalles que no son opcionales:

- El port solo recibe `serviceName` en `get`/`save`/`delete`. La clave real
  (`clerk_user_id + service + environment`) se captura **en el closure del adaptador**. Jamás se
  deriva del CUIT.
- Hay que pasar `ticketStorage` **explícitamente** en el constructor de `Arca`. Omitir `ticketPath`
  no alcanza: el SDK rellena un default que apunta dentro de `node_modules`, que en Vercel es de
  solo lectura, y vuelve a elegir `FileSystemTicketStorage`.
- `token` y `sign` se guardan cifrados con el mismo sobre. Son credenciales portadoras: con ellas
  se emite durante ~12 h sin la clave privada.
- Se descarta y se re-pide el ticket con 10 minutos de margen antes del vencimiento real, filtrando
  por `expires_at` en el SELECT en vez de confiar solo en `isExpired()` del SDK.
- En el primer deploy, borrar los restos de `os.tmpdir()/arca-tickets`.

### 4.7 Integridad de la emisión

**Numeración y reserva.** El número se reserva en `facturas` **antes** de llamar a ARCA:

1. `getLastVoucher(ptoVta, 11)` contra ARCA.
2. `next = max(último de ARCA, máximo local) + 1`.
3. `insert` en `facturas` con `estado='reservado'` y `cbte_nro = next`.
4. Si el índice único `facturas_numeracion` rechaza el insert, otra emisión tomó ese número:
   releer y reintentar, hasta 3 veces. El índice único **es** el serializador; no hacen falta
   locks, que además no funcionan bien con el pooler de Supabase vía PostgREST.

**Clasificación de errores.** Es el corazón del arreglo de doble emisión:

| Situación | Qué sabemos | Qué se hace |
|---|---|---|
| ARCA responde `Resultado='R'` | No se emitió | `estado='descartado'`, se libera, el usuario reintenta |
| Falla antes de `createVoucher` (credencial ilegible, WSAA caído) | No se emitió | Igual que arriba |
| Timeout, `ECONNRESET`, corte de TLS después de despachar `createVoucher` | **No sabemos** | `estado='en_revision'`. **No se libera.** |

**Reconciliación.** La cotización en revisión muestra un botón *Verificar* que llama
`getVoucherInfo(cbte_nro, pto_vta, 11)`:

- Existe con CAE → se persiste, `estado='emitido'`. La factura era buena.
- No existe → `estado='descartado'`, se libera para reintentar.
- ARCA no responde → sigue en revisión, se puede reintentar la verificación.

**Timeout de la función.** La emisión pasa a un route handler con `export const maxDuration = 60`.
Hoy `vercel.json` no declara ninguno y una llamada SOAP lenta a ARCA puede morir por el default,
dejando el comprobante huérfano.

**Fecha.** `CbteFch` pasa a calcularse con `getArgentinaToday()` de `lib/argentina-time.ts`, que ya
existe en el repo y hoy solo se usa en el PDF. Se persiste en `facturas.cbte_fch` el valor
**exacto** que se le mandó a ARCA, y el PDF y el QR leen esa columna en vez de recalcular.

### 4.8 Demo y comprobantes de prueba

- `facturas.environment` es la fuente de verdad, escrita en la misma operación que graba el CAE.
  El banner "SIN VALOR FISCAL" deriva de esa columna, **nunca** del entorno actual del perfil
  (hoy, si un usuario emite en demo y después cambia el selector, el PDF de esa factura pierde
  el banner y pasa a verse como un comprobante real).
- El CAE demo pasa a ser sintácticamente imposible de confundir con uno real: `DEMO-000001`, nunca
  14 dígitos empezando en 7.
- `pto_vta` y `cbte_nro` son columnas enteras propias. El PDF deja de derivarlas partiendo el
  string `numero_factura`, que en demo producía `puntoVenta = "DEMO"` y un QR con `ptoVta: 0`
  silenciosamente.
- `renderFacturaPdfForUser` se niega a renderizar sin banner si `environment !== 'produccion'`.

### 4.9 Receptor

Un solo campo de documento en el cliente, con el tipo detectado solo: 11 dígitos → CUIT
(`DocTipo 80`), 7 u 8 → DNI (`DocTipo 96`), vacío → Consumidor Final (`DocTipo 99`, `DocNro 0`).
El CUIT se valida con el dígito verificador módulo 11 que ya está en `lib/fiscal-profile.ts`.

Desde la RG 5616 el comprobante exige declarar la **condición frente al IVA del receptor**. Hoy
está clavada en Consumidor Final (`CondicionIVAReceptorId: 5`), lo que sería inconsistente al
mandar un CUIT. Cuando el cliente tiene documento cargado aparece un selector de condición, y el
valor se persiste en `facturas.cond_iva_receptor`.

El monto a partir del cual ARCA obliga a identificar al receptor se actualiza con la inflación.
Va como constante con nombre explícito y comentario de origen, la UI avisa antes de emitir cuando
el importe lo supera, y **además** se traduce el rechazo de ARCA por si la constante quedó vieja.
Dos redes, porque una sola se pudre con el tiempo.

El QR pasa a recibir `tipoDocRec` y `nroDocRec` reales. Hoy `factura-pdf.ts` no se los pasa y toma
el default 99/0: apenas identifiquemos clientes, el QR diría una cosa y la factura otra, y el QR
es lo que ARCA valida.

## 5. Superficie de acceso

| Recurso | `authenticated` (navegador) | Servidor |
|---|---|---|
| `fiscal_credentials` | nada | `service_role` |
| `arca_tickets` | nada | `service_role` |
| `facturas` | nada | `service_role` |
| Bucket `fiscal` | se deja de usar; la policy se restringe y los objetos se migran a `fiscal_credentials` | — |
| `fiscal_profiles` | lectura/escritura de los campos de display | — |

`lib/supabase/service-role.ts` lleva `import "server-only"` y **exporta funciones de dominio, no
un cliente**. `service_role` saltea RLS, así que cada función filtra explícitamente por
`clerk_user_id` y eso se verifica en review. Requiere la variable nueva
`SUPABASE_SERVICE_ROLE_KEY`, marcada solo para Production.

`getFiscalProfile` deja de hacer `select("*")` y proyecta columnas explícitas; al componente
cliente se le pasa `{ hasCert: boolean }`, nunca los paths.

## 6. Errores

Todo mensaje al usuario en castellano rioplatense, sin jerga técnica, siguiendo la regla del
proyecto. Los errores de ARCA se traducen por código:

| Situación | Mensaje |
|---|---|
| Web service no delegado | "Falta autorizar a Cotizapp en ARCA. Volvé al paso 3 del wizard: Administrador de Relaciones → Facturación Electrónica." |
| Punto de venta inexistente | "El punto de venta 0001 no existe o no está habilitado para Web Services en ARCA." |
| Certificado vencido | "Tu certificado de ARCA venció el DD/MM/AAAA. Generá uno nuevo desde acá." |
| CUIT del certificado ≠ declarado | "El certificado pertenece a otro CUIT. Revisá que hayas bajado el correcto de ARCA." |
| Rechazo de comprobante | El texto de las observaciones de ARCA, que ya viene en castellano. |
| Timeout / red | "No pudimos confirmar la emisión con ARCA. Apretá *Verificar* para chequear si la factura salió." |

**Logging.** Un único helper `logError(scope, error)` que extrae solo `{ name, message }`. Importa
específicamente acá: la librería `soap` adjunta `error.body` con el XML crudo de la respuesta, así
que un `console.error(err)` sobre un error de WSFE imprimiría la respuesta entera en los logs de
Vercel. Nunca loguear el objeto de credenciales que se le pasa a `new Arca({ cert, key })`.

## 7. Pruebas

**Con test automático** (`node:test` vía `tsx --test`, como el resto del repo):

- *Sobre criptográfico*: ida y vuelta; cifrar dos veces el mismo texto da ciphertexts distintos
  (mata el IV determinista, que es la regresión grave); `iv.length === 12`; corromper un byte hace
  fallar `final()`; un blob de `user_A` no abre con el AAD de `user_B`; falta de env var tira al
  cargar el módulo.
- *Certificado*: parseo de PEM; extracción del CUIT del subject; correspondencia clave↔certificado
  (caso positivo y negativo); certificado vencido; basura que no es PEM.
- *Payload de Factura C*: los casos que ya existen, más receptor identificado (CUIT y DNI),
  condición IVA, y `CbteFch` en horario argentino (con un caso a las 23:00 ART que hoy fallaría).
- *QR*: payload con receptor real; `ptoVta`/`nroCmp` desde columnas enteras.
- *Clasificación de errores de emisión*: cada fila de la tabla de la sección 4.7 decide bien entre
  liberar y dejar en revisión.
- *Reserva de número*: colisión del índice único reintenta y avanza.

**Sin test automático, se prueba a mano**: todo lo que habla con ARCA de verdad. El último paso
antes de dar esto por cerrado es **una emisión real de punta a punta con el CUIT del autor**,
verificando el CAE en el portal de ARCA y el QR con la app de AFIP.

**Baseline**: en `main` hay ~12 tests que fallan desde antes. La verificación exige que los tests
nuevos pasen y que ese número no aumente.

## 8. Operación

`FISCAL_ENCRYPTION_KEY` es la pieza más delicada de la infraestructura:

- **Si se pierde, las claves privadas de todos los usuarios quedan irrecuperables** y cada uno
  tiene que rehacer el trámite del certificado en ARCA. Se respalda fuera de Vercel.
- Rotación: se pone la nueva en `FISCAL_ENCRYPTION_KEY` y la vieja en
  `FISCAL_ENCRYPTION_KEY_PREVIOUS`, se corre el re-cifrado (una función server-side que recorre
  `fiscal_credentials` con `service_role` y sube el `keyId`), y recién ahí se saca la vieja.
- Si se filtra: rotar, re-cifrar, y **avisar a los usuarios que revoquen su certificado en ARCA** —
  porque el material comprometido es de ellos, no nuestro.

Esto va también en el copy del wizard y en los términos: Cotizapp **puede** descifrar la clave,
porque la necesita para emitir. No es cifrado de punta a punta. El Camino 1 sigue siendo
legalmente limpio — la factura la emite el certificado del usuario bajo su CUIT y la
responsabilidad fiscal es de él — pero la custodia de la llave es nuestra y hay que decirlo.

## 9. Dependencias

- `@arcasdk/core` pasa de `^1.3.1` a **`1.3.1` exacto**. Un patch del SDK no debería poder cambiar
  el comportamiento de la facturación sin que sea una decisión.
- `node-forge` pasa a **dependencia directa** más `@types/node-forge` en desarrollo. Hoy está
  instalado (1.4.0) pero solo como dependencia transitiva del SDK y sin tipos; depender de eso es
  frágil.
- Variables nuevas: `SUPABASE_SERVICE_ROLE_KEY`, `FISCAL_ENCRYPTION_KEY`,
  `FISCAL_ENCRYPTION_KEY_PREVIOUS` (opcional). Las tres solo en Production.

## 10. Orden de implementación

Cada fase deja el sistema en un estado coherente:

0. **Fundaciones** — sobre criptográfico, cliente `service_role`, `logError`, tablas nuevas, pin
   del SDK, node-forge directo.
1. **Identidad fiscal** — parseo y validación de certificados, CUIT server-authoritative,
   `fiscal_credentials`, migración de la clave del autor, cierre del bucket.
2. **Wizard** — generación de clave y CSR, los cinco estados, verificación con `getSalesPoints`,
   traducción de errores.
3. **Ticket WSAA** — `ITicketStoragePort` contra Supabase, borrado de `ticketPath`.
4. **Integridad de emisión** — tabla `facturas`, reserva previa, clasificación de errores,
   reconciliación, `maxDuration`, fecha argentina.
5. **Receptor y documentos** — documento y condición IVA del cliente, payload, PDF, QR, demo
   inconfundible.

## 11. Fuera de alcance

Explícito, para que no se cuele:

- Factura A y B, IVA discriminado, alícuotas por ítem. Solo Factura C.
- Notas de crédito y débito.
- Concepto "Servicios" con período facturado. Solo productos.
- Moneda extranjera.
- **Camino 2** (delegación: Cotizapp factura por cuenta de terceros con su propio certificado).
  Es otro proyecto, con otra estructura legal.
- **CSP en `next.config.mjs`.** La auditoría la recomienda y hay que hacerla, pero al mover el
  material fiscal a tablas inalcanzables desde el navegador, el camino XSS → robo de clave queda
  cerrado y la CSP pasa a ser defensa en profundidad. Agregarla a una app con Clerk, Supabase y
  OpenAI puede romper cosas y merece su propia entrega. **Queda registrado como pendiente.**

### Un hallazgo fuera de tema que no hay que perder

`ensure_clerk_profile` (`20260602_ensure_clerk_profile_rpc.sql:34-47`) adopta perfiles legacy por
email sin exigir que Clerk lo tenga verificado. Si quedan filas huérfanas, es un takeover de
cuenta completo. La probabilidad es baja (requiere filas sobrevivientes de una ventana de 9 días
previa al lanzamiento, que ya no se pueden crear) pero el impacto es total.

**Triage primero**: correr `select count(*) from public.profiles where clerk_id is null;` en el
Dashboard. Si da 0, se borra la rama de adopción por email. Si da más de 0, se exige el flag de
email verificado. No es parte del Camino 1 pero se resuelve en esta entrega porque cuesta poco.

## 12. Trazabilidad de la auditoría

Auditoría del 2026-07-30: cuatro lentes independientes (criptografía y secretos, control de acceso
y multi-tenancy, integridad de emisión, fuga por canales laterales), cada hallazgo verificado por
un agente adversario que intentaba refutarlo. **31 confirmados, 1 refutado.**

| # | Sev. | Hallazgo | Dónde se resuelve |
|---|---|---|---|
| 1, 2 | crítico | Caché de tickets WSAA en `/tmp` keyeado por CUIT | 4.6 |
| 3 | crítico | CUIT no ligado al certificado, sin UNIQUE | 4.5 |
| 4, 5, 8 | alto | Clave privada descargable desde el navegador | 4.2, 5 |
| 6 | alto | `releaseClaim()` ante timeout → doble emisión | 4.7 |
| 7 | alto | Timeout serverless deja el comprobante huérfano | 4.7 |
| 9, 15, 23 | medio | Ticket WSAA sin cifrar, sin RLS, sin distinguir entorno | 4.2, 4.6 |
| 10, 12, 30 | medio | Sobre AES sin versión, sin AAD, invariantes de GCM sin fijar | 4.3 |
| 11 | medio | Encoding y validación de `FISCAL_ENCRYPTION_KEY` | 4.3 |
| 13 | medio | Custodia y rotación de la clave maestra | 4.3, 8 |
| 14 | medio | RLS `FOR ALL` sin control de columnas en `fiscal_profiles` | 4.2, 5 |
| 16, 17 | medio | `CbteFch` en UTC; PDF y QR con otra fecha | 4.7 |
| 18 | medio | Banner "SIN VALOR FISCAL" derivado del perfil actual | 4.8 |
| 19 | medio | CAE demo con forma de CAE real | 4.8 |
| 20 | medio | Numeración sin serializar entre cotizaciones | 4.7 |
| 21 | medio | Ticket en claro en `/tmp`, nunca borrado | 4.6 |
| 22 | medio | Upload valida solo extensión y tamaño | 4.5 |
| 24, 31 | bajo | Migración perezosa con carrera y borrado no confirmado | 4.5.1 (migración explícita, no perezosa) |
| 25 | bajo | Columnas fiscales de `quotations` escribibles por el cliente | 4.2 (tabla `facturas`) |
| 26 | bajo | `ensure_clerk_profile` adopta por email sin verificar | 11 |
| 27 | bajo | PDF demo parsea mal el número | 4.8 |
| 28 | bajo | `console.error(error)` completo vuelca la respuesta SOAP | 6 |
| 29 | bajo | `select("*")` de `fiscal_profiles` al payload RSC | 5 |

**Refutado:** "AES-256-GCM con una única clave global sin AAD es explotable" — el verificador
demostró que la cadena de ataque descansaba en supuestos que el código contradice. El AAD se
implementa igual, porque cuesta nada y evita tener que re-cifrar todo si mañana hace falta.

Las correcciones que los verificadores le hicieron a los arreglos originalmente propuestos están
incorporadas en el diseño. Las tres que más lo cambiaron:

- `MemoryTicketStorage` **no** mitiga el bug del `/tmp`: su backing store es un `Map` estático de
  proceso y su clave también incluye el CUIT. Misma colisión, en RAM.
- `ticketPath: undefined` **no** fuerza memoria: el SDK rellena un default dentro de
  `node_modules`, de solo lectura en Vercel. Hay que pasar `ticketStorage` explícito.
- El lock por advisory lock para serializar la numeración **no** funciona con el pooler de
  Supabase vía PostgREST. Se usa el índice único como serializador.

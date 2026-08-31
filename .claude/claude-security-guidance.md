# Reglas de seguridad — Cotizapp

Reglas obligatorias para cualquier cambio de código en este proyecto.
Aplican tanto a código escrito a mano como a código generado por IA.

---

## 1. Nunca guardar el `customer_id` en los logs

**Qué protege:** evita que un identificador de cliente quede escrito en texto plano
en logs de Vercel, Sentry o la consola, donde lo puede leer cualquiera con acceso a
observabilidad y usarlo para correlacionar o enumerar clientes.

En este proyecto el identificador equivalente es `client_id` (tabla `clients`) y
también `user_id` / `clerk_id` del perfil: la regla aplica a todos por igual.

```ts
// ❌ Nunca
console.log("Cotización creada", { client_id: quotation.client_id });
console.error("Fallo al generar PDF", quotation); // el objeto entero incluye client_id

// ✅ Sí
console.log("Cotización creada", { quotationId: quotation.id });
console.error("Fallo al generar PDF", { quotationId: quotation.id, reason: error.message });
```

Reglas prácticas:
- No loguear objetos completos de `quotations`, `clients`, `profiles` ni `expenses`
  — siempre elegir campos explícitos.
- Si hace falta correlacionar un caso puntual, loguear el `id` de la cotización o
  del gasto, nunca el identificador del cliente ni datos personales (nombre,
  teléfono, email, `tax_id`).
- Lo mismo aplica a mensajes de error mostrados al usuario: en español, amigables
  y sin IDs internos.

---

## 2. Toda ruta que empiece con `/admin` debe verificar el rol antes de leer la base

**Qué protege:** impide que un usuario autenticado pero sin privilegios llegue a
datos de otras cuentas — estar logueado no es lo mismo que estar autorizado.

Hoy no existen rutas `/admin` en el repo. Cuando se creen, el chequeo de rol va
**antes** de cualquier consulta a Supabase, dentro de la ruta o el server action —
nunca solo en el `middleware.ts` ni solo escondiendo el link en la UI.

```ts
// ❌ Nunca: consultar primero y filtrar después
const { data } = await supabase.from("quotations").select("*");
if (!isAdmin(user)) return notFound();

// ✅ Sí: cortar antes de tocar la base
const user = await requireUser();
if (user.role !== "admin") {
  return NextResponse.json({ error: "No tenés permiso para ver esto" }, { status: 403 });
}
const { data } = await supabase.from("quotations").select("*");
```

Reglas prácticas:
- El rol se lee del servidor (perfil en Supabase o claim de Clerk), nunca de un
  parámetro de la request, de un header ni de estado del cliente.
- Denegar por defecto: si el rol no se puede determinar, se rechaza.
- Las políticas RLS siguen siendo obligatorias — el chequeo de rol se suma, no las
  reemplaza. Y en RLS se usa `public.current_profile_id()`, nunca `auth.uid()`.

---

## 3. Para comparar tokens, usar comparación segura — nunca `===`

**Qué protege:** cierra los ataques de temporización, donde un atacante mide cuánto
tarda la respuesta para adivinar un token carácter por carácter, ya que `===` corta
en la primera diferencia.

Aplica al `share_token` de cotizaciones (`app/api/quotations/share/[token]/route.ts`
y `lib/quotation-share-route.ts`), a firmas de webhooks y a cualquier secreto futuro.

```ts
// ❌ Nunca
if (token === quotation.share_token) { /* ... */ }

// ✅ Sí
import { timingSafeEqual } from "node:crypto";

function tokensMatch(a: string, b: string) {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false; // longitudes distintas: no filtra nada útil
  return timingSafeEqual(bufA, bufB);
}
```

Reglas prácticas:
- `timingSafeEqual` requiere buffers del mismo largo: comparar longitud primero y
  salir, nunca pasarle largos distintos (tira excepción).
- Los tokens se generan con `crypto.randomUUID()` o `crypto.randomBytes`, nunca con
  `Math.random()`.
- Un token inválido y un token inexistente devuelven la misma respuesta genérica,
  para no revelar cuáles existen.

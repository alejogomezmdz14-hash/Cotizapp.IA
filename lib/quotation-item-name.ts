import { normalizeEntityName } from "@/lib/entity-normalization";

/**
 * Cómo tratar el nombre de un ítem de cotización al guardarlo.
 *
 * - `"entity"`: title-case, como un nombre propio ("cemento portland" →
 *   "Cemento Portland"). Es el comportamiento histórico y el default.
 * - `"verbatim"`: tal cual lo escribió el usuario, solo colapsando espacios.
 *
 * Por qué hace falta la distinción: en el modo "monto único" del editor móvil,
 * ese texto NO es el nombre de un producto sino la descripción del trabajo —
 * "destapado de cocina" — y es lo único que el cliente lee en el PDF.
 * Title-casearlo lo convierte en "Destapado De Cocina", que se ve como un error
 * de la app. En modo ítem el title-case pasa desapercibido y es deseable.
 *
 * No se puede decidir por heurística de forma: "destapado de cocina" y "cemento
 * portland" son indistinguibles. Tiene que venir declarado desde la UI.
 */
export type QuotationItemNameFormat = "entity" | "verbatim";

/**
 * `normalizeEntityName` ya colapsa espacios, pero `"verbatim"` los tiene que
 * colapsar igual: nadie quiere "destapado    de   cocina" en el PDF.
 */
function collapseWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Nombre final que se guarda en la base.
 *
 * `nameFormat` llega como `unknown` a propósito: viene de un payload JSON del
 * cliente, así que cualquier cosa que no sea exactamente `"verbatim"` cae al
 * comportamiento histórico. Un payload viejo, sin el campo, se guarda igual que
 * siempre.
 */
export function resolveQuotationItemName(name: string, nameFormat: unknown): string {
  const collapsed = collapseWhitespace(name);

  return nameFormat === "verbatim" ? collapsed : normalizeEntityName(collapsed);
}

/**
 * Qué formato tenía un nombre que ya está guardado en la base.
 *
 * Existe para el round-trip: sin esto, guardás "destapado de cocina", reabrís
 * el borrador con `?edit=1`, tocás cualquier cosa, guardás, y el nombre se
 * title-casea a tus espaldas.
 *
 * La regla es conservadora a propósito: si el nombre guardado ya coincide con
 * su forma normalizada, se trata como `"entity"`. Consecuencia deseada: TODAS
 * las filas que ya existen en la base conservan exactamente el comportamiento
 * actual, sin migración.
 */
export function inferQuotationItemNameFormat(
  storedName: string,
): QuotationItemNameFormat {
  const collapsed = collapseWhitespace(storedName);

  return collapsed === normalizeEntityName(collapsed) ? "entity" : "verbatim";
}

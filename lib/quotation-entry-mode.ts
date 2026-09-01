import type { QuotationEditorItem } from "@/components/cotizacion/quotation-items-editor";
import { parseDecimalInput } from "@/lib/decimal-input";

/**
 * Cómo se carga una cotización en el celular.
 *
 * - `"amount"` (monto único): "¿Qué trabajo es?" + "¿Cuánto cobrás?". Es el
 *   camino del 90% de los casos reales — un plomero cotizando un destapado no
 *   detalla ítems.
 * - `"items"`: la lista de siempre, con cantidades y precio unitario.
 */
export type QuotationEntryMode = "amount" | "items";

/**
 * Si el contenido actual del draft se puede mostrar como un solo monto sin
 * perder información: como mucho un ítem, cantidad 1 y sin descripción.
 *
 * Es lo que hace que el modo no necesite una columna nueva en la base: el
 * contenido ES el flag. Reabrir un borrador de 1 ítem simple entra en monto
 * único con los datos cargados; uno de 3 ítems entra en lista.
 */
export function canRenderAsSingleAmount(items: QuotationEditorItem[]): boolean {
  if (items.length === 0) {
    return true;
  }

  if (items.length > 1) {
    return false;
  }

  const [item] = items;

  return item.quantity === 1 && item.description.trim() === "";
}

/**
 * Modo efectivo. El override del usuario solo puede pedir MÁS detalle, nunca
 * menos: si pidió lista, es lista; si pidió monto único pero el contenido ya no
 * entra, la UI cae sola a lista.
 *
 * De esa regla salen gratis dos comportamientos: escanear una factura de 4
 * ítems desde monto único pasa a lista sin una línea de código en el handler, y
 * el override nunca puede mentir sobre lo que hay en el draft.
 */
export function resolveQuotationEntryMode(
  override: QuotationEntryMode | null,
  items: QuotationEditorItem[],
): QuotationEntryMode {
  if (override === "items") {
    return "items";
  }

  return canRenderAsSingleAmount(items) ? "amount" : "items";
}

/**
 * `parseDecimalInput` acepta negativos a propósito (sirve para descuentos,
 * gastos, etc.), pero el precio de un ítem nunca puede serlo: un input de
 * texto libre con `inputMode="decimal"` deja tipear o pegar un "-", y sin este
 * chequeo un "-45000" pasaba el gate, disparaba el diálogo "¿Va en $0?" (que
 * describe mal lo que pasa) y el server lo rechazaba con un mensaje que no
 * nombra el problema real.
 */
function parseNonNegativeAmountInput(text: string): number | null {
  const parsed = parseDecimalInput(text);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

/**
 * Qué hacer con el store ante el estado actual de los dos campos de monto
 * único. El ítem se materializa en el PRIMER tecleo con contenido, no al
 * guardar.
 */
export type SingleAmountSync =
  | { type: "none" }
  | { type: "create"; item: QuotationEditorItem }
  | { type: "update"; id: string; updates: Partial<QuotationEditorItem> }
  | { type: "remove"; id: string };

/**
 * Reducer puro de la sincronización.
 *
 * POR QUÉ LAZY (lo más importante de todo esto): crear el ítem al montar la
 * pantalla haría `items.length > 0` desde el arranque, y eso contamina
 * `hasDraftContent` (store/cotizacion-store.ts), `hasUnsavedChanges` y
 * `markUnsavedDraft`. El cartel "Tenés una cotización sin guardar" aparecería
 * apenas abrís la pantalla, sin haber tocado nada.
 *
 * POR QUÉ SE BORRA AL VACIAR: sin el `remove`, el botón Guardar queda
 * habilitado con un ítem fantasma sin nombre y el server contesta "Cada ítem
 * necesita un concepto", que no le dice nada al usuario.
 */
export function planSingleAmountSync(input: {
  currentItem: QuotationEditorItem | null;
  name: string;
  amountText: string;
  /** De `allocNextItemId()` del store. */
  nextItemId: number;
}): SingleAmountSync {
  // El nombre se guarda CRUDO, sin trim. Si se recortara acá, el campo estaría
  // bindeado al store y el usuario no podría escribir un espacio: al tipear
  // "destapado " el store guardaría "destapado", el input volvería a mostrar
  // "destapado" y sería imposible llegar a "destapado de cocina". El `trim`
  // solo decide si HAY contenido; el server ya recorta al guardar
  // (getOptionalStringValue en lib/quotations.ts).
  const parsedAmount = parseNonNegativeAmountInput(input.amountText);
  const hasName = input.name.trim().length > 0;
  const hasAmount = parsedAmount !== null;

  if (!input.currentItem) {
    if (!hasName && !hasAmount) {
      return { type: "none" };
    }

    return {
      type: "create",
      item: {
        id: `item-${input.nextItemId}`,
        source: "manual",
        catalogItemId: null,
        name: input.name,
        description: "",
        quantity: 1,
        unit: "unidad",
        unitPrice: parsedAmount ?? 0,
        nameFormat: "verbatim",
      },
    };
  }

  if (!hasName && !hasAmount) {
    return { type: "remove", id: input.currentItem.id };
  }

  const updates: Partial<QuotationEditorItem> = {};

  if (input.name !== input.currentItem.name) {
    updates.name = input.name;
    // Todo lo que se tipea en este modo es la descripción del trabajo, no el
    // nombre de un producto: va al PDF tal cual. Si no se marcara acá, reabrir
    // un borrador viejo y editarle el nombre lo title-casearía al guardar.
    updates.nameFormat = "verbatim";
  }

  const nextUnitPrice = parsedAmount ?? 0;

  if (nextUnitPrice !== input.currentItem.unitPrice) {
    updates.unitPrice = nextUnitPrice;
  }

  if (Object.keys(updates).length === 0) {
    return { type: "none" };
  }

  return { type: "update", id: input.currentItem.id, updates };
}

/**
 * Texto crudo del campo de monto, atado al ítem que lo produjo.
 *
 * El vínculo con el id es lo que hace que el campo vuelva a leer del store
 * cuando el ítem cambia de identidad: guardaste, escaneaste una factura,
 * reseteaste el borrador.
 */
export type SingleAmountInput = { itemId: string | null; text: string } | null;

/** Qué mostrar en el campo de monto. */
export function resolveSingleAmountText(
  amountInput: SingleAmountInput,
  itemId: string | null,
  unitPrice: number | null,
): string {
  if (amountInput && amountInput.itemId === itemId) {
    return amountInput.text;
  }

  return formatSingleAmountInput(unitPrice);
}

/**
 * Estado siguiente del texto crudo, DESPUÉS de aplicar el plan.
 *
 * Se reescribe SIEMPRE, incluso cuando el tecleo vino del campo del nombre.
 * Si solo se reescribiera al tocar el monto, pasaba esto: `resetDraft()`
 * devuelve `nextItemId` a 1, así que el primer ítem después de "Empezar de
 * nuevo" recicla el id `item-1`; el texto viejo seguía atado a ese id y volvía
 * solo al campo apenas escribías el trabajo nuevo. El plomero descartaba una
 * cotización de $50.000, escribía otra, y sin tocar el campo de plata quedaba
 * cotizando el monto de la que había tirado.
 */
export function nextSingleAmountInput(
  resultingItemId: string | null,
  text: string,
): SingleAmountInput {
  return { itemId: resultingItemId, text };
}

/** Por qué no se puede guardar todavía. */
export type SingleAmountBlockedReason = "name" | "amount";

export type SingleAmountSaveState = {
  unitPrice: number | null;
  ready: boolean;
  blockedReason: SingleAmountBlockedReason | null;
  /** El usuario escribió un cero de verdad (no dejó el campo vacío). */
  isExplicitZero: boolean;
};

/**
 * Separa "falta el monto" de "el monto es cero".
 *
 * Sin esta distinción, quien escribe el trabajo y todavía no puso precio se
 * come el diálogo "¿Va en $0?", que es la respuesta equivocada a "te falta el
 * monto". El diálogo se conserva intacto para el caso que sí es suyo: alguien
 * que tipeó un 0 a propósito.
 *
 * El nombre tiene prioridad sobre el monto porque ese es el orden en que se
 * llena la pantalla: cliente → trabajo → monto.
 */
export function getSingleAmountSaveState(input: {
  name: string;
  amountText: string;
}): SingleAmountSaveState {
  const hasName = input.name.trim().length > 0;
  const unitPrice = parseNonNegativeAmountInput(input.amountText);

  const blockedReason: SingleAmountBlockedReason | null = !hasName
    ? "name"
    : unitPrice === null
      ? "amount"
      : null;

  return {
    unitPrice,
    ready: blockedReason === null,
    blockedReason,
    isExplicitZero: unitPrice === 0,
  };
}

/** Qué decirle al usuario que falta. Español rioplatense, sin jerga. */
export function explainSingleAmountBlockedReason(
  reason: SingleAmountBlockedReason,
): string {
  return reason === "name" ? "Escribí qué trabajo es" : "Poné cuánto cobrás";
}

/**
 * Texto inicial del campo de monto a partir del precio guardado.
 *
 * Sin separadores de miles a propósito: si mostrara "45.000" y el usuario
 * agregara un dígito al final quedaría "45.0001", que `parseDecimalInput` lee
 * como cuarenta y cinco con cuatro decimales. Un `0` se muestra vacío, igual
 * que en la hoja manual del editor móvil.
 */
export function formatSingleAmountInput(unitPrice: number | null): string {
  // Solo `null` (sin ítem todavía) se muestra vacío. Un `0` guardado a
  // propósito (el usuario tipeó "0" y confirmó el diálogo "¿Va en $0?") tiene
  // que reaparecer como "0" al reabrir el borrador: si se mostrara vacío, el
  // gate de guardado lo leería como "falta el monto" y bloquearía Guardar
  // hasta volver a tipear el mismo 0, para editar solo la fecha o las notas.
  //
  // Esto no reintroduce la ambigüedad que gotcha 3 evita: un ítem recién
  // materializado por tipear primero el NOMBRE se sincroniza al estado local
  // en el mismo tick (ver nextSingleAmountInput), así que este fallback nunca
  // se usa para ese caso — solo para ítems que ya existían antes de esta
  // sesión de edición.
  if (unitPrice === null) {
    return "";
  }

  return String(unitPrice);
}

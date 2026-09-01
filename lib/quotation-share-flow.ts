/**
 * Orquesta el envío de una cotización por WhatsApp.
 *
 * EL PROBLEMA QUE RESUELVE: la app marcaba la cotización como "Enviada" —
 * escribiendo `status` y `sent_at` en la base— y recién 24 líneas y dos `await`
 * después abría el menú nativo de compartir. Si el usuario cancelaba, la app ya
 * había dicho que la mandó. Y no era por falta de información: el outcome de
 * `presentQuotationPdfShare` ya distingue "shared" de "cancelled" y "blocked".
 * Era puramente el orden.
 *
 * Acá el orden queda expresado en un solo lugar y con las dependencias
 * inyectadas, así que se puede testear sin DOM: preparar → armar el archivo →
 * abrir el menú → y SOLO si el sistema entregó el archivo, marcar como enviada.
 *
 * CAVEAT DE LA API: "shared" significa "el sistema entregó el payload al
 * destino", no "el usuario apretó enviar dentro de WhatsApp". Es un proxy
 * mucho mejor que el anterior, pero por eso el copy dice "compartida" y no
 * "Enviada".
 */

export type QuotationShareOutcome = "shared" | "cancelled" | "blocked";

export type QuotationShareAttempt<TPrepared, TShare> =
  /** El dispositivo no puede compartir archivos: hay que ir por wa.me. */
  | { status: "unsupported" }
  /** Se preparó el enlace pero no se pudo armar el archivo: wa.me. */
  | { status: "unavailable"; share: TShare }
  /** El sistema entregó el archivo. Es el único caso que marca como enviada. */
  | { status: "shared"; share: TShare }
  /** El usuario cerró el menú a propósito. No se tocó la base. */
  | { status: "cancelled"; share: TShare; prepared: TPrepared }
  /** Venció el permiso del gesto (típico de iPhone): hace falta otro toque. */
  | { status: "blocked"; share: TShare; prepared: TPrepared };

export type NativeQuotationShareDependencies<TPrepared, TShare> = {
  /** Si el dispositivo soporta compartir archivos. */
  isSupported: () => boolean;
  /** Prepara token, PDF público y mensaje. NO toca `status` ni `sent_at`. */
  prepareShare: () => Promise<TShare>;
  /** Descarga el PDF y arma el archivo. `null` si el dispositivo no puede. */
  buildShareFile: (share: TShare) => Promise<TPrepared | null>;
  /** Abre el menú nativo del sistema. */
  presentShare: (prepared: TPrepared) => Promise<QuotationShareOutcome>;
  /** Marca la cotización como enviada. Solo se llama con "shared". */
  markAsSent: () => Promise<void>;
};

export async function runNativeQuotationShare<TPrepared, TShare>(
  dependencies: NativeQuotationShareDependencies<TPrepared, TShare>,
): Promise<QuotationShareAttempt<TPrepared, TShare>> {
  if (!dependencies.isSupported()) {
    return { status: "unsupported" };
  }

  const share = await dependencies.prepareShare();
  const prepared = await dependencies.buildShareFile(share);

  if (!prepared) {
    return { status: "unavailable", share };
  }

  const outcome = await dependencies.presentShare(prepared);

  if (outcome === "shared") {
    await dependencies.markAsSent();
    return { status: "shared", share };
  }

  return { status: outcome, share, prepared };
}

/**
 * Segundo toque, cuando el primero quedó "blocked" y el archivo ya está armado.
 *
 * Va directo a `presentShare`, sin ningún `await` previo: iOS exige que
 * `navigator.share()` se llame inmediatamente después del toque.
 */
export async function retryQuotationShare<TPrepared>(dependencies: {
  prepared: TPrepared;
  presentShare: (prepared: TPrepared) => Promise<QuotationShareOutcome>;
  markAsSent: () => Promise<void>;
}): Promise<QuotationShareOutcome> {
  const outcome = await dependencies.presentShare(dependencies.prepared);

  if (outcome === "shared") {
    await dependencies.markAsSent();
  }

  return outcome;
}

export type QuotationShareMessage = {
  text: string;
  tone: "ok" | "info";
};

/**
 * Qué decirle al usuario en cada desenlace. Nunca afirma que se envió algo que
 * no se envió.
 */
export function describeQuotationShareAttempt(
  status: QuotationShareAttempt<unknown, unknown>["status"],
): QuotationShareMessage | null {
  switch (status) {
    case "shared":
      return {
        text: "Listo, la compartiste. Quedó marcada como enviada.",
        tone: "ok",
      };
    case "cancelled":
      return {
        text: "No la compartiste. Sigue igual que antes, podés intentar de nuevo.",
        tone: "info",
      };
    case "blocked":
      return {
        text: "El PDF está listo. Tocá «Compartir PDF» para mandarlo por WhatsApp.",
        tone: "info",
      };
    case "unsupported":
    case "unavailable":
      // Estos dos siguen por el camino de wa.me, que pone su propio mensaje.
      return null;
  }
}

/**
 * Copy del camino wa.me, donde NO hay forma de saber si el usuario mandó el
 * mensaje: se abre WhatsApp y la app pierde el control. Por eso se marca como
 * enviada pero se dice exactamente eso, y se ofrece deshacer.
 */
export const WHATSAPP_FALLBACK_MESSAGE =
  "Te abrimos WhatsApp con el mensaje listo. La marcamos como enviada; si al final no la mandaste, tocá «No la mandé».";

/**
 * Si tiene sentido ofrecer el deshacer: solo cuando marcar como enviada
 * cambió algo. Si la cotización ya estaba enviada o aceptada, volver a
 * borrador no sería deshacer sino romper.
 */
export function canUndoQuotationShare(previousSentAt: string | null): boolean {
  return previousSentAt === null;
}

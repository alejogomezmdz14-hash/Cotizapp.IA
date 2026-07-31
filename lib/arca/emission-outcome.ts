// Qué hacer con la reserva cuando la emisión falla.
//
// La distinción que importa: "sabemos que ARCA no emitió" vs "no sabemos".
// Liberar en el segundo caso es lo que producía dos facturas reales con dos CAE
// sobre la misma cotización — un problema fiscal que solo se arregla con una
// nota de crédito.
//
// Por eso la regla es: ante la duda, NO se libera. Queda en revisión y se
// reconcilia preguntándole a ARCA por el número que reservamos.

import { ArcaEmissionError } from "@/lib/arca/billing";

export type DecisionDeError = "liberar" | "revisar";

export function decidirAnteError(
  error: unknown,
  yaSeLlamoAArca: boolean,
): DecisionDeError {
  // Todavía no despachamos nada: no hay comprobante posible.
  if (!yaSeLlamoAArca) {
    return "liberar";
  }

  // ARCA contestó y rechazó. Hay respuesta, y dice que no emitió.
  if (error instanceof ArcaEmissionError) {
    return "liberar";
  }

  // Cualquier otra cosa después de despachar: no sabemos.
  return "revisar";
}

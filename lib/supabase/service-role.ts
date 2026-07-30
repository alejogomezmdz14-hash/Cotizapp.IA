import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente con service_role: SALTEA RLS POR COMPLETO.
//
// Existe porque el material fiscal (fiscal_credentials, arca_tickets, facturas)
// vive en tablas con RLS de negación total, deliberadamente inalcanzables con el
// anon key + el JWT de Clerk que están los dos en el navegador.
//
// REGLAS DE USO, no negociables:
//   1. Solo se importa desde lib/fiscal/* y lib/arca/*. Una regla de ESLint
//      caza el import (estático o dinámico) directo desde cualquier otro
//      lugar, pero NO cubre un re-export puente desde un módulo permitido
//      (ej. lib/fiscal/x.ts reexportando esto para que otro módulo lo
//      importe indirectamente). La barrera real de última instancia contra
//      eso es `import "server-only"` de arriba más el review de código.
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

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

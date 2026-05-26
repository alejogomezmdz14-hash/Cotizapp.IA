import type { Client } from "@/types";

export function getDefaultQuotationClientId(
  clients: Pick<Client, "id">[],
): string | null {
  if (clients.length !== 1) {
    return null;
  }

  return clients[0]?.id ?? null;
}

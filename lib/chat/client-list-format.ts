import type { ChatClientListItem } from "@/types";

export type { ChatClientListItem };

export function formatClientesListForChatReply(clients: ChatClientListItem[]) {
  if (clients.length === 0) {
    return "Todavía no tenés clientes cargados. Creá uno desde Clientes y volvé a pedirme la cotización.";
  }

  const lines = clients.map(
    (client, index) =>
      `${index + 1}. ${client.nombre}${client.telefono ? ` (${client.telefono})` : ""} [id: ${client.id}]`,
  );

  return ["Estos son tus clientes:", ...lines, "¿Para cuál cliente es la cotización?"].join(
    "\n",
  );
}

export function buildClientSelectorReply(clients: ChatClientListItem[]) {
  if (clients.length === 0) {
    return {
      reply:
        "Todavía no tenés clientes cargados. Creá uno desde Clientes y volvé a pedirme la cotización.",
      suggestedAction: null,
      uiHint: null,
    };
  }

  return {
    reply: "¿Para cuál cliente es la cotización?",
    suggestedAction: null,
    uiHint: {
      type: "client_selector" as const,
      clients,
    },
  };
}

export function isClientSelectorReply(reply: string) {
  return (
    reply.includes("¿Para cuál cliente") || reply.includes("Estos son tus clientes:")
  );
}

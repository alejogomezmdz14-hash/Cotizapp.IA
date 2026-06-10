export type ChatClientListItem = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
};

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

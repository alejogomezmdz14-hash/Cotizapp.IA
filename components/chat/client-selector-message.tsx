import type { ChatClientListItem } from "@/types";

type ClientSelectorMessageProps = {
  clients: ChatClientListItem[];
  disabled?: boolean;
  onSelect: (client: ChatClientListItem) => void;
};

export function ClientSelectorMessage({
  clients,
  disabled = false,
  onSelect,
}: ClientSelectorMessageProps) {
  return (
    <div className="mt-1 flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">¿Para cuál cliente?</p>
      {clients.map((client) => (
        <button
          key={client.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(client)}
          className="flex items-center gap-3 rounded-xl border border-token bg-card p-3 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
            {client.nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium leading-tight">{client.nombre}</p>
            {client.telefono ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{client.telefono}</p>
            ) : null}
          </div>
        </button>
      ))}
    </div>
  );
}

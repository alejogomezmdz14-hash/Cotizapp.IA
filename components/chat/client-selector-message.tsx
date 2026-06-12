"use client";

import { useState } from "react";
import { Check, UserPlus } from "lucide-react";
import type { ChatClientListItem } from "@/types";

type ClientSelectorMessageProps = {
  clients: ChatClientListItem[];
  disabled?: boolean;
  onSelect: (client: ChatClientListItem) => void;
};

function getAvatarColor(name: string): string {
  const colors = [
    "bg-violet-500",
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-pink-500",
    "bg-indigo-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return colors[Math.abs(hash) % colors.length] ?? "bg-[#00E5A0]";
}

export function ClientSelectorMessage({
  clients,
  disabled = false,
  onSelect,
}: ClientSelectorMessageProps) {
  const [selected, setSelected] = useState<ChatClientListItem | null>(null);
  const [search, setSearch] = useState("");

  const showSearch = clients.length > 4;
  const filtered = showSearch
    ? clients.filter((client) =>
        client.nombre.toLowerCase().includes(search.toLowerCase()),
      )
    : clients;

  function handleConfirm() {
    if (selected && !disabled) {
      onSelect(selected);
    }
  }

  if (clients.length === 0) {
    return (
      <div className="mt-3 flex flex-col items-start gap-3 rounded-xl border border-dashed border-[#2A2D3E] p-4">
        <p className="text-sm text-[#8B8FA8]">
          Todavía no tenés clientes cargados.
        </p>
        <a
          href="/clientes"
          className="flex items-center gap-2 rounded-lg bg-[#1A1D27] px-3 py-2 text-sm font-medium text-[#00E5A0] transition hover:bg-[#222536]"
        >
          <UserPlus className="h-4 w-4" />
          Crear primer cliente
        </a>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {showSearch && (
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar cliente..."
          className="w-full rounded-xl border border-[#2A2D3E] bg-[#0F1117] px-3 py-2 text-sm text-white placeholder:text-[#8B8FA8] focus:border-[#00E5A0] focus:outline-none"
        />
      )}

      <div className="flex max-h-[280px] flex-col gap-1.5 overflow-y-auto">
        {filtered.map((client) => {
          const isSelected = selected?.id === client.id;
          return (
            <button
              key={client.id}
              type="button"
              disabled={disabled}
              onClick={() => setSelected(client)}
              className={`flex min-h-[64px] items-center gap-3 rounded-xl border p-3 text-left transition-all active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 ${
                isSelected
                  ? "border-[#00E5A0] bg-[#00E5A0]/10"
                  : "border-[#2A2D3E] bg-[#0F1117] hover:border-[#00E5A0]/40"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${getAvatarColor(client.nombre)}`}
              >
                {client.nombre.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {client.nombre}
                </p>
                {client.telefono && (
                  <p className="mt-0.5 text-xs text-[#8B8FA8]">
                    {client.telefono}
                  </p>
                )}
              </div>
              {isSelected && (
                <Check className="h-4 w-4 shrink-0 text-[#00E5A0]" />
              )}
            </button>
          );
        })}

        {filtered.length === 0 && (
          <p className="py-4 text-center text-sm text-[#8B8FA8]">
            Sin resultados para &ldquo;{search}&rdquo;
          </p>
        )}
      </div>

      {selected && (
        <button
          type="button"
          disabled={disabled}
          onClick={handleConfirm}
          className="mt-1 min-h-[52px] w-full rounded-xl bg-[#00E5A0] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#00C984] active:opacity-80 disabled:opacity-50"
        >
          Elegir a {selected.nombre}
        </button>
      )}
    </div>
  );
}

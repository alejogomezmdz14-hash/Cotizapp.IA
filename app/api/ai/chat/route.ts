import { NextResponse } from "next/server";

import {
  attachClientSelectorUiHint,
  buildBusinessChatContext,
  loadBusinessChatExpenseContext,
  readChatRequestBody,
  resolveQuotationPeriodFilter,
  resolveSelectedClientFromRequest,
  runBusinessChat,
} from "@/lib/ai/chat";
import {
  buildChatRateLimitMessage,
  consumeChatRateLimit,
} from "@/lib/ai/rate-limit";
import { getCatalogItems } from "@/lib/catalog";
import { getClients } from "@/lib/clients";
import { getCurrentUser, getProfile } from "@/lib/profile";
import { getQuotations } from "@/lib/quotations";
import type { ChatClientListItem, ChatConversationMessage, Client } from "@/types";

const CHAT_CONTEXT_QUOTATION_LIMIT = 30;
const CHAT_CONTEXT_CATALOG_LIMIT = 50;
function toAvailableClients(clients: Client[]): ChatClientListItem[] {
  return clients.map((client) => ({
    id: client.id,
    nombre: client.name,
    email: client.email,
    telefono: client.phone,
  }));
}

const MAX_MESSAGES = 10;
const MAX_MESSAGE_LENGTH = 1500;

function normalizeMessages(input: unknown): ChatConversationMessage[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((message) => {
      if (
        !message ||
        typeof message !== "object" ||
        !("role" in message) ||
        !("content" in message)
      ) {
        return null;
      }

      const role =
        message.role === "user" || message.role === "assistant"
          ? message.role
          : null;
      const content =
        typeof message.content === "string" ? message.content.trim() : "";

      if (!role || !content) {
        return null;
      }

      return {
        role,
        content: content.slice(0, MAX_MESSAGE_LENGTH),
      } satisfies ChatConversationMessage;
    })
    .filter((message): message is ChatConversationMessage => message !== null)
    .slice(-MAX_MESSAGES);
}

function getErrorResponse(error: unknown) {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : "No se pudo responder desde el chat.";
  const status =
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : 500;

  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
    },
  );
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Tenés que iniciar sesión para usar el chat.",
        },
        {
          status: 401,
        },
      );
    }

    const rateLimit = consumeChatRateLimit(user.id);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            buildChatRateLimitMessage(rateLimit) ??
            "Demasiadas consultas al chat. Probá más tarde.",
        },
        {
          status: 429,
          headers: rateLimit.retryInSeconds
            ? { "Retry-After": String(rateLimit.retryInSeconds) }
            : undefined,
        },
      );
    }

    const body = await readChatRequestBody(request);
    const messages = normalizeMessages(body.messages);
    const latestMessage = messages.at(-1);

    if (!latestMessage || latestMessage.role !== "user") {
      return NextResponse.json(
        {
          error: "Envía una consulta válida para continuar.",
        },
        {
          status: 400,
        },
      );
    }

    const [clients, catalogItems, quotations, profile] = await Promise.all([
      getClients(user.id),
      getCatalogItems(user.id).then((rows) =>
        rows.slice(0, CHAT_CONTEXT_CATALOG_LIMIT),
      ),
      getQuotations(user.id, { limit: CHAT_CONTEXT_QUOTATION_LIMIT }),
      getProfile(user.id),
    ]);
    const availableClients = toAvailableClients(clients);
    const selectedClient = resolveSelectedClientFromRequest(
      body.selectedClientId,
      availableClients,
    );
    const quotationPeriodFilter = resolveQuotationPeriodFilter(
      latestMessage.content,
    );
    const expenses = await loadBusinessChatExpenseContext(user.id, {
      periodFilter: quotationPeriodFilter,
      quotations,
      profile,
    });
    const context = buildBusinessChatContext({
      profile,
      clients,
      availableClients,
      selectedClient,
      catalogItems,
      quotations,
      expenses,
      quotationPeriodFilter,
    });
    const result = attachClientSelectorUiHint(
      await runBusinessChat(
        latestMessage.content,
        context,
        {
          clients,
          catalogItems,
        },
        {
          history: messages.slice(0, -1),
          selectedClient,
        },
      ),
      availableClients,
    );

    return NextResponse.json(result);
  } catch (error) {
    return getErrorResponse(error);
  }
}

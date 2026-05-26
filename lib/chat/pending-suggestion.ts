import type { ChatSuggestedAction } from "@/types";

type PendingSuggestionEvent =
  | {
      type: "submit";
    }
  | {
      type: "error";
    }
  | {
      type: "response";
      suggestedAction: ChatSuggestedAction | null | undefined;
    };

export function getNextPendingSuggestion(
  event: PendingSuggestionEvent,
): ChatSuggestedAction | null {
  if (event.type === "response") {
    return event.suggestedAction ?? null;
  }

  return null;
}

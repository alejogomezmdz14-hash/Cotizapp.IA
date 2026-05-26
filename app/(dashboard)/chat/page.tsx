import { ChatShell } from "@/components/chat/chat-shell";
import { requireUser } from "@/lib/profile";

export default async function ChatPage() {
  await requireUser();

  return <ChatShell />;
}

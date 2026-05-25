"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleSignOut = async () => {
    setIsPending(true);

    const supabase = createClient();
    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="border-token bg-surface text-foreground hover:bg-surface-2 hover:text-foreground"
      onClick={handleSignOut}
      disabled={isPending}
    >
      {isPending ? "Saliendo..." : "Salir"}
    </Button>
  );
}

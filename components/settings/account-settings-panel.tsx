"use client";

import { useTransition } from "react";

import { deleteAccountAction } from "@/app/actions/profile";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-provider";
import {
  cancelAllPendingTasks,
  hasUnsavedDraft,
} from "@/lib/pending-tasks";

type AccountSettingsPanelProps = {
  email: string | null;
};

export function AccountSettingsPanel({ email }: AccountSettingsPanelProps) {
  const { toast } = useToast();
  const [isDeleting, startDeleteTransition] = useTransition();

  const handleDeleteAccount = () => {
    const draftWarning = hasUnsavedDraft()
      ? "\n\nTenés un borrador sin guardar que se perderá."
      : "";

    const firstConfirm = window.confirm(
      `Vas a eliminar tu cuenta y todos tus datos de Cotizapp.${draftWarning}\n\nEsta acción no se puede deshacer. ¿Querés continuar?`,
    );

    if (!firstConfirm) {
      return;
    }

    const secondConfirm = window.confirm(
      "Última confirmación: se borrarán cotizaciones, clientes, catálogo y perfil.\n\n¿Eliminar la cuenta definitivamente?",
    );

    if (!secondConfirm) {
      return;
    }

    startDeleteTransition(async () => {
      cancelAllPendingTasks();

      try {
        await deleteAccountAction();
      } catch {
        toast({
          title: "No se pudo eliminar la cuenta",
          description: "Intentá nuevamente en unos segundos.",
          variant: "error",
        });
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="account_email">Email</Label>
        <Input id="account_email" value={email ?? ""} readOnly />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <SignOutButton className="sm:w-auto" />
        <Button
          type="button"
          variant="destructive"
          onClick={handleDeleteAccount}
          disabled={isDeleting}
        >
          {isDeleting ? "Eliminando..." : "Eliminar cuenta"}
        </Button>
      </div>
    </div>
  );
}

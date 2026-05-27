"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastVariant = "success" | "error";

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type ToastRecord = ToastInput & {
  id: string;
};

type ToastContextValue = {
  toast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function getToastClasses(variant: ToastVariant) {
  if (variant === "error") {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }

  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const toast = useCallback((input: ToastInput) => {
    const id = globalThis.crypto.randomUUID();
    const nextToast: ToastRecord = {
      id,
      variant: input.variant ?? "success",
      title: input.title,
      description: input.description,
    };

    setToasts((currentToasts) => [...currentToasts, nextToast]);

    window.setTimeout(() => {
      setToasts((currentToasts) =>
        currentToasts.filter((toastItem) => toastItem.id !== id),
      );
    }, 4200);
  }, []);

  const value = useMemo(
    () => ({
      toast,
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] mx-auto flex w-full max-w-md flex-col gap-3 px-4">
        {toasts.map((toastItem) => (
          <div
            key={toastItem.id}
            className={`pointer-events-auto rounded-[1.25rem] border px-4 py-3 shadow-lg backdrop-blur ${getToastClasses(
              toastItem.variant ?? "success",
            )}`}
          >
            <p className="text-sm font-semibold">{toastItem.title}</p>
            {toastItem.description ? (
              <p className="mt-1 text-sm leading-6">{toastItem.description}</p>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast debe usarse dentro de ToastProvider.");
  }

  return context;
}

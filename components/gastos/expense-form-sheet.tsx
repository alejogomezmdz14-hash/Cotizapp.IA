"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, ScanLine, Upload } from "lucide-react";

import {
  createExpenseAction,
  updateExpenseAction,
} from "@/app/actions/expenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import type { Expense, ExpenseReceiptScanResult } from "@/types";

type ExpenseFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense | null;
  defaultCurrency: string | null;
  onSaved: () => void;
};

type ReceiptUploadResponse = {
  receipt?: {
    receiptPath: string;
    previewUrl: string | null;
  };
  error?: string;
};

type ScanResponse = {
  result?: ExpenseReceiptScanResult;
  error?: string;
};

function todayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseFormSheet({
  open,
  onOpenChange,
  expense,
  defaultCurrency,
  onSaved,
}: ExpenseFormSheetProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("Materiales");
  const [date, setDate] = useState(todayDateInputValue());
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanPreview, setScanPreview] = useState<ExpenseReceiptScanResult | null>(
    null,
  );

  const isEditing = Boolean(expense?.id);
  const currency = expense?.currency ?? defaultCurrency ?? "MXN";

  useEffect(() => {
    if (!open) {
      return;
    }

    setError(null);
    setScanPreview(null);
    setSelectedFile(null);

    if (expense) {
      setDescription(expense.description);
      setAmount(String(expense.amount).replace(".", ","));
      setCategory(expense.category);
      setDate(expense.date);
      setReceiptPath(expense.receipt_url);
      setReceiptPreviewUrl(null);
      return;
    }

    setDescription("");
    setAmount("");
    setCategory("Materiales");
    setDate(todayDateInputValue());
    setReceiptPath(null);
    setReceiptPreviewUrl(null);
  }, [open, expense]);

  async function uploadReceiptIfNeeded() {
    if (!selectedFile) {
      return receiptPath;
    }

    setIsUploadingReceipt(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("file", selectedFile);

      const response = await fetch("/api/uploads/expense-receipt", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as ReceiptUploadResponse;

      if (!response.ok || !payload.receipt) {
        throw new Error(payload.error || "No se pudo subir el recibo.");
      }

      setReceiptPath(payload.receipt.receiptPath);
      setReceiptPreviewUrl(payload.receipt.previewUrl);
      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return payload.receipt.receiptPath;
    } finally {
      setIsUploadingReceipt(false);
    }
  }

  async function handleScanReceipt() {
    setError(null);
    setIsScanning(true);

    try {
      const path = await uploadReceiptIfNeeded();

      if (!path) {
        throw new Error("Seleccioná una foto del recibo antes de escanear.");
      }

      const response = await fetch("/api/ai/expense-receipt-scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ receiptPath: path }),
      });

      const payload = (await response.json()) as ScanResponse;

      if (!response.ok || !payload.result) {
        throw new Error(payload.error || "No se pudo escanear el recibo.");
      }

      setScanPreview(payload.result);

      if (payload.result.description) {
        setDescription(payload.result.description);
      }

      if (payload.result.amount !== null) {
        setAmount(String(payload.result.amount).replace(".", ","));
      }

      if (payload.result.category) {
        setCategory(payload.result.category);
      }
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : "No se pudo escanear el recibo.",
      );
    } finally {
      setIsScanning(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const finalReceiptPath = await uploadReceiptIfNeeded();
        const formData = new FormData(event.currentTarget);

        if (finalReceiptPath) {
          formData.set("receipt_url", finalReceiptPath);
        }

        if (isEditing && expense) {
          await updateExpenseAction(expense.id, formData);
        } else {
          await createExpenseAction(formData);
        }

        onSaved();
        onOpenChange(false);
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "No se pudo guardar el gasto.",
        );
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Editar gasto" : "Nuevo gasto"}</SheetTitle>
          <SheetDescription>
            Registrá el gasto manualmente o escaneá el recibo con IA antes de
            guardar.
          </SheetDescription>
        </SheetHeader>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="mt-6 space-y-5 pb-8"
        >
          <input type="hidden" name="currency" value={currency} />
          {receiptPath ? (
            <input type="hidden" name="receipt_url" value={receiptPath} />
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="expense-description">Descripción</Label>
            <Input
              id="expense-description"
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ej. Compra de tornillos"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expense-amount">Monto</Label>
              <Input
                id="expense-amount"
                name="amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Ej. 1.250,50"
                inputMode="decimal"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-date">Fecha</Label>
              <Input
                id="expense-date"
                name="date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-category">Categoría</Label>
            <select
              id="expense-category"
              name="category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {EXPENSE_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 p-4 space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Foto del recibo (opcional)
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                PNG, JPG o WEBP. Máximo 5 MB.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={isUploadingReceipt || isScanning || isPending}
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] ?? null);
                setScanPreview(null);
              }}
            />

            {selectedFile ? (
              <p className="text-sm text-muted-foreground">
                Archivo: <span className="font-medium">{selectedFile.name}</span>
              </p>
            ) : null}

            {receiptPreviewUrl ? (
              <div className="overflow-hidden rounded-xl border border-token/80">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={receiptPreviewUrl}
                  alt="Vista previa del recibo"
                  className="max-h-40 w-full object-contain bg-background"
                />
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="bg-background/75"
                disabled={isUploadingReceipt || isScanning || isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Elegir imagen
              </Button>

              <Button
                type="button"
                variant="outline"
                className="bg-background/75"
                disabled={
                  isUploadingReceipt ||
                  isScanning ||
                  isPending ||
                  (!selectedFile && !receiptPath)
                }
                onClick={handleScanReceipt}
              >
                {isScanning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Escaneando...
                  </>
                ) : (
                  <>
                    <ScanLine className="mr-2 h-4 w-4" />
                    Escanear recibo con IA
                  </>
                )}
              </Button>
            </div>

            {scanPreview ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
                <p className="font-medium">Resultado del escaneo</p>
                <p className="mt-1">
                  Revisá los campos antes de guardar. Podés editarlos libremente.
                </p>
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-[1.5rem] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="bg-background/75"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || isUploadingReceipt}>
              {isPending ? "Guardando..." : isEditing ? "Guardar cambios" : "Guardar gasto"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

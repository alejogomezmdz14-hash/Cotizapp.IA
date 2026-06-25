"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ScanLine, Upload } from "lucide-react";

import {
  createExpenseFromInput,
  updateExpenseFromInput,
} from "@/app/actions/expenses";
import { ActionHint } from "@/components/ui/action-hint";
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
import { EXPENSE_CURRENCIES } from "@/lib/expense-currencies";
import { formatExpenseAmount } from "@/lib/formatting";
import type { Expense, ExpenseReceiptScanResult } from "@/types";
import { useGastoStore } from "@/store/gasto-store";

type ExpenseFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense | null;
  defaultCurrency: string;
  onSaved: () => void;
};

type ReceiptUploadResponse = {
  receipt?: {
    receiptPath: string;
    previewUrl: string | null;
  };
  scan?: ExpenseReceiptScanResult;
  error?: string;
};

function todayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatAmountForInput(value: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function ExpenseFormSheet({
  open,
  onOpenChange,
  expense,
  defaultCurrency,
  onSaved,
}: ExpenseFormSheetProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [category, setCategory] = useState<string>("Materiales");
  const [date, setDate] = useState(todayDateInputValue());
  const [notes, setNotes] = useState("");
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanPreview, setScanPreview] = useState<ExpenseReceiptScanResult | null>(
    null,
  );

  const isEditing = Boolean(expense?.id);
  const patchGastoDraft = useGastoStore((state) => state.patchDraft);
  const resetGastoDraft = useGastoStore((state) => state.resetDraft);
  const storedGastoDraft = useGastoStore((state) => state.draft);

  useEffect(() => {
    if (!open) {
      return;
    }

    setError(null);
    setAmountError(null);
    setScanPreview(null);
    setSelectedFile(null);

    if (expense) {
      setDescription(expense.description);
      setAmount(formatAmountForInput(expense.amount));
      setCurrency(expense.currency);
      setCategory(expense.category);
      setDate(expense.date);
      setNotes(expense.notes ?? "");
      setReceiptPath(expense.receipt_path ?? expense.receipt_url);
      setReceiptPreviewUrl(null);
      return;
    }

    if (storedGastoDraft.hasUnsavedDraft) {
      setDescription(storedGastoDraft.description);
      setAmount(storedGastoDraft.amount);
      setCurrency(storedGastoDraft.currency || defaultCurrency);
      setCategory(storedGastoDraft.category);
      setDate(storedGastoDraft.date);
      setNotes(storedGastoDraft.notes);
      setReceiptPath(storedGastoDraft.receiptPath);
      setReceiptPreviewUrl(null);
      return;
    }

    setDescription("");
    setAmount("");
    setCurrency(defaultCurrency);
    setCategory("Materiales");
    setDate(todayDateInputValue());
    setNotes("");
    setReceiptPath(null);
    setReceiptPreviewUrl(null);
  }, [open, expense, defaultCurrency, storedGastoDraft]);

  useEffect(() => {
    if (!open || isEditing) {
      return;
    }

    patchGastoDraft({
      description,
      amount,
      currency,
      category,
      date,
      notes,
      receiptPath,
    });
  }, [
    amount,
    category,
    currency,
    date,
    description,
    isEditing,
    notes,
    open,
    patchGastoDraft,
    receiptPath,
  ]);

  async function uploadReceipt(scan = false) {
    if (!selectedFile && !scan) {
      return receiptPath;
    }

    if (!selectedFile) {
      if (scan) {
        throw new Error("Seleccioná una foto del recibo antes de escanear.");
      }

      return receiptPath;
    }

    setIsUploadingReceipt(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("file", selectedFile);

      if (scan) {
        formData.set("scan", "true");
      }

      const response = await fetch("/api/uploads/receipt", {
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

      if (scan && payload.scan) {
        setScanPreview(payload.scan);
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
      await uploadReceipt(true);
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

  function applyScanToForm() {
    if (!scanPreview) {
      return;
    }

    if (scanPreview.description) {
      setDescription(scanPreview.description);
    }

    if (scanPreview.amount !== null) {
      setAmount(formatAmountForInput(scanPreview.amount));
    }

    if (scanPreview.currency) {
      setCurrency(scanPreview.currency);
    }

    if (scanPreview.category) {
      setCategory(scanPreview.category);
    }

    if (scanPreview.date) {
      setDate(scanPreview.date);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsedAmount = Number.parseFloat(amount.trim().replace(",", "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setAmountError("El monto debe ser mayor a 0");
      return;
    }

    setAmountError(null);
    setIsSubmitting(true);

    try {
      const finalReceiptPath = await uploadReceipt(false);
      const payload = {
        description,
        amount,
        currency,
        category,
        date,
        notes,
        receipt_path: finalReceiptPath,
      };

      if (isEditing && expense) {
        await updateExpenseFromInput(expense.id, payload);
      } else {
        await createExpenseFromInput(payload);
        resetGastoDraft(defaultCurrency);
      }

      onSaved();
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar el gasto.",
      );
    } finally {
      setIsSubmitting(false);
    }
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
          onSubmit={handleSubmit}
          className="mt-6 space-y-5 pb-8"
        >
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
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setAmountError(null);
                }}
                placeholder="Ej. 1250.50"
                className="min-h-12"
                aria-invalid={Boolean(amountError)}
                required
              />
              {amountError ? (
                <ActionHint tone="error">{amountError}</ActionHint>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-currency">Moneda</Label>
              <select
                id="expense-currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {EXPENSE_CURRENCIES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label} ({item.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
            <Label htmlFor="expense-notes">Notas (opcional)</Label>
            <textarea
              id="expense-notes"
              name="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Detalle adicional del gasto"
              className="flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 p-4 space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Foto del recibo (opcional)
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                PNG, JPG, WEBP o PDF. Máximo 10 MB.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              className="hidden"
              disabled={isUploadingReceipt || isScanning || isSubmitting}
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
                disabled={isUploadingReceipt || isScanning || isSubmitting}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Elegir archivo
              </Button>

              <Button
                type="button"
                variant="outline"
                className="bg-background/75"
                disabled={
                  isUploadingReceipt ||
                  isScanning ||
                  isSubmitting ||
                  (!selectedFile && !receiptPath)
                }
                onClick={handleScanReceipt}
                title="El sistema lee el monto y lo carga solo"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Leyendo ticket...
                  </>
                ) : (
                  <>
                    <ScanLine className="mr-2 h-4 w-4" />
                    Sacale una foto al ticket
                  </>
                )}
              </Button>
            </div>

            {scanPreview ? (
              <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
                <div>
                  <p className="font-medium">Resultado del escaneo</p>
                  <p className="mt-1 text-emerald-800/90 dark:text-emerald-100/90">
                    Revisá los datos antes de aplicarlos al formulario.
                  </p>
                </div>
                <dl className="grid gap-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Descripción</dt>
                    <dd className="text-right font-medium">
                      {scanPreview.description ?? "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Monto</dt>
                    <dd className="text-right font-medium">
                      {scanPreview.amount !== null
                        ? formatExpenseAmount(
                            scanPreview.amount,
                            scanPreview.currency ?? currency,
                          )
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Categoría</dt>
                    <dd className="text-right font-medium">
                      {scanPreview.category ?? "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Fecha</dt>
                    <dd className="text-right font-medium">
                      {scanPreview.date ?? "—"}
                    </dd>
                  </div>
                </dl>
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  onClick={applyScanToForm}
                >
                  Aplicar al formulario
                </Button>
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
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={isSubmitting || isUploadingReceipt}
            >
              {isSubmitting ? "Guardando..." : isEditing ? "Guardar cambios" : "Guardar gasto"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

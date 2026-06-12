import { NextResponse } from "next/server";

import { scanExpenseReceiptWithAi } from "@/lib/ai/expense-receipt";
import { getCurrentUser } from "@/lib/profile";
import { createSignedFileUrl, STORAGE_BUCKETS } from "@/lib/storage/server";

type ExpenseReceiptScanRequestBody = {
  receiptPath?: string;
};

function getErrorResponse(error: unknown) {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : "No se pudo escanear el recibo.";

  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Tenés que iniciar sesión para escanear recibos." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as ExpenseReceiptScanRequestBody;
    const receiptPath =
      typeof body.receiptPath === "string" ? body.receiptPath.trim() : "";

    if (!receiptPath || !receiptPath.startsWith(`${user.id}/`)) {
      return NextResponse.json(
        { error: "El recibo no es válido para escanear." },
        { status: 400 },
      );
    }

    const signedUrl = await createSignedFileUrl(
      STORAGE_BUCKETS.expenseReceipts,
      receiptPath,
    );

    const result = await scanExpenseReceiptWithAi({
      signedUrl,
      fileName: receiptPath.split("/").pop() ?? null,
    });

    return NextResponse.json({ result });
  } catch (error) {
    return getErrorResponse(error);
  }
}

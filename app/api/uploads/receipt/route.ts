import { NextResponse } from "next/server";

import { uploadExpenseReceiptFromFormData } from "@/app/actions/uploads";
import { scanExpenseReceiptWithAi } from "@/lib/ai/expense-receipt";
import { getCurrentUser } from "@/lib/profile";
import { createSignedFileUrl, STORAGE_BUCKETS } from "@/lib/storage/server";
import { UploadActionError } from "@/lib/uploads";

function getErrorResponse(error: unknown, status = 500) {
  if (error instanceof UploadActionError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : "No se pudo procesar el recibo.";

  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Tenés que iniciar sesión para subir recibos." },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const scanRequested = formData.get("scan") === "true";
    const receipt = await uploadExpenseReceiptFromFormData(formData);

    if (!scanRequested) {
      return NextResponse.json({
        receipt: {
          receiptPath: receipt.receiptPath,
          previewUrl: receipt.previewUrl,
        },
      });
    }

    const signedUrl = await createSignedFileUrl(
      STORAGE_BUCKETS.expenseReceipts,
      receipt.receiptPath,
    );

    const scan = await scanExpenseReceiptWithAi({
      signedUrl,
      fileName: receipt.fileName,
    });

    return NextResponse.json({
      receipt: {
        receiptPath: receipt.receiptPath,
        previewUrl: receipt.previewUrl,
      },
      scan,
    });
  } catch (error) {
    return getErrorResponse(error);
  }
}

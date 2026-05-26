import { NextResponse } from "next/server";

import { uploadQuotationAttachmentsFromFormData } from "@/app/actions/uploads";
import { UploadActionError } from "@/lib/uploads";

function getErrorResponse(error: unknown) {
  if (error instanceof UploadActionError) {
    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: error.status,
      },
    );
  }

  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : "No se pudieron subir los adjuntos.";

  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 500,
    },
  );
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const attachments = await uploadQuotationAttachmentsFromFormData(formData);

    return NextResponse.json({ attachments });
  } catch (error) {
    return getErrorResponse(error);
  }
}

import { NextResponse } from "next/server";

import { uploadQuotationSignatureFromFormData } from "@/app/actions/uploads";
import { UploadActionError } from "@/lib/uploads";

function getErrorResponse(error: unknown) {
  if (error instanceof UploadActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json(
    {
      error:
        error instanceof Error && error.message.trim()
          ? error.message
          : "No se pudo subir la firma.",
    },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const signature = await uploadQuotationSignatureFromFormData(formData);

    return NextResponse.json({ signature });
  } catch (error) {
    return getErrorResponse(error);
  }
}

import { NextResponse } from "next/server";

import { uploadLogoFromFormData } from "@/app/actions/uploads";
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
      : "No se pudo subir el logo.";

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
    const logo = await uploadLogoFromFormData(formData);

    return NextResponse.json({ logo });
  } catch (error) {
    return getErrorResponse(error);
  }
}

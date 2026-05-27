import { NextResponse } from "next/server";

import { uploadAvatarFromFormData } from "@/app/actions/uploads";
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
      : "No se pudo subir la foto.";

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
    const avatar = await uploadAvatarFromFormData(formData);

    return NextResponse.json({ avatar });
  } catch (error) {
    return getErrorResponse(error);
  }
}


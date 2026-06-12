import { NextResponse } from "next/server";

import {
  TranscriptionError,
  parseTranscriptionUploadFormData,
  transcribeAudioFile,
} from "@/lib/ai/transcribe";
import { getCurrentUser } from "@/lib/profile";

function getErrorResponse(error: unknown) {
  if (error instanceof TranscriptionError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : "No se pudo transcribir el audio. Intentá de nuevo.";

  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Tenés que iniciar sesión para transcribir audio." },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const file = parseTranscriptionUploadFormData(formData);
    const text = await transcribeAudioFile(file);

    return NextResponse.json({ text });
  } catch (error) {
    return getErrorResponse(error);
  }
}

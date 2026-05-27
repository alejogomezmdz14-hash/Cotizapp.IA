const WHISPER_MODEL = "whisper-1";
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "video/webm",
]);

const ALLOWED_AUDIO_EXTENSIONS = new Set([
  "webm",
  "mp4",
  "m4a",
  "wav",
  "mp3",
  "ogg",
]);

export class TranscriptionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "TranscriptionError";
    this.status = status;
  }
}

function getFileExtension(fileName: string) {
  const parts = fileName.trim().toLowerCase().split(".");

  if (parts.length < 2) {
    return "";
  }

  return parts.at(-1) ?? "";
}

export function isSupportedTranscriptionFile(file: File) {
  const mimeType = file.type.trim().toLowerCase();

  if (mimeType && ALLOWED_AUDIO_TYPES.has(mimeType)) {
    return true;
  }

  return ALLOWED_AUDIO_EXTENSIONS.has(getFileExtension(file.name));
}

export function parseTranscriptionUploadFormData(formData: FormData) {
  const entry = formData.get("file");

  if (!(entry instanceof File) || entry.size <= 0) {
    throw new TranscriptionError(
      "Seleccioná un archivo de audio válido para transcribir.",
    );
  }

  if (!isSupportedTranscriptionFile(entry)) {
    throw new TranscriptionError(
      "El audio debe estar en formato webm, mp4 o wav.",
    );
  }

  if (entry.size > MAX_AUDIO_BYTES) {
    throw new TranscriptionError(
      "El audio supera el tamaño máximo permitido de 10 MB.",
    );
  }

  return entry;
}

export async function transcribeAudioFile(file: File) {
  const { getOpenAIClient } = await import("./openai");
  const client = getOpenAIClient();

  const transcription = await client.audio.transcriptions.create({
    file,
    model: WHISPER_MODEL,
    language: "es",
  });

  const text = transcription.text?.trim() ?? "";

  if (!text) {
    throw new TranscriptionError(
      "No se detectó voz en el audio. Intentá hablar más cerca del micrófono.",
    );
  }

  return text;
}

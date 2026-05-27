"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Loader2, Mic, SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ChatInputProps = {
  value: string;
  isLoading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

type VoiceState = "idle" | "recording" | "processing";

const textareaClassName =
  "flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const AUTO_SEND_DELAY_MS = 2000;

const PERMISSION_DENIED_MESSAGE =
  "Habilitá el micrófono en tu navegador para usar esta función";

const TRANSCRIPTION_ERROR_MESSAGE =
  "No se pudo transcribir el audio. Intentá de nuevo.";

function getPreferredRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/wav",
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function buildRecordingFileName(mimeType: string) {
  if (mimeType.includes("mp4")) {
    return "chat-voice.mp4";
  }

  if (mimeType.includes("wav")) {
    return "chat-voice.wav";
  }

  return "chat-voice.webm";
}

export function ChatInput({
  value,
  isLoading,
  onChange,
  onSubmit,
}: ChatInputProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const autoSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptBaselineRef = useRef<string | null>(null);
  const isRecordingRef = useRef(false);

  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const isVoiceBusy = voiceState !== "idle";
  const isInputDisabled = isLoading || voiceState === "processing";

  function clearAutoSendTimer() {
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
  }

  function scheduleAutoSend(transcript: string) {
    clearAutoSendTimer();
    transcriptBaselineRef.current = transcript;

    autoSendTimerRef.current = setTimeout(() => {
      if (transcriptBaselineRef.current === transcript && transcript.trim()) {
        onSubmit();
      }
    }, AUTO_SEND_DELAY_MS);
  }

  function handleValueChange(nextValue: string) {
    if (
      transcriptBaselineRef.current !== null &&
      nextValue !== transcriptBaselineRef.current
    ) {
      clearAutoSendTimer();
      transcriptBaselineRef.current = null;
    }

    onChange(nextValue);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    clearAutoSendTimer();
    transcriptBaselineRef.current = null;
    onSubmit();
  }

  async function stopMediaStream() {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  async function transcribeRecording(blob: Blob, mimeType: string) {
    const formData = new FormData();
    const fileName = buildRecordingFileName(mimeType);
    formData.set("file", new File([blob], fileName, { type: mimeType || blob.type }));

    const response = await fetch("/api/ai/transcribe", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json().catch(() => ({}))) as {
      text?: string;
      error?: string;
    };

    if (!response.ok || !payload.text?.trim()) {
      throw new Error(payload.error || TRANSCRIPTION_ERROR_MESSAGE);
    }

    return payload.text.trim();
  }

  async function finishRecording() {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      isRecordingRef.current = false;
      setVoiceState("idle");
      return;
    }

    setVoiceState("processing");

    await new Promise<void>((resolve) => {
      recorder.addEventListener(
        "stop",
        () => {
          resolve();
        },
        { once: true },
      );
      recorder.stop();
    });

    const mimeType = recorder.mimeType || audioChunksRef.current[0]?.type || "audio/webm";
    const blob = new Blob(audioChunksRef.current, { type: mimeType });

    mediaRecorderRef.current = null;
    isRecordingRef.current = false;
    audioChunksRef.current = [];
    await stopMediaStream();

    if (blob.size === 0) {
      setVoiceState("idle");
      setVoiceError(TRANSCRIPTION_ERROR_MESSAGE);
      return;
    }

    try {
      const transcript = await transcribeRecording(blob, mimeType);
      handleValueChange(transcript);
      scheduleAutoSend(transcript);
      setVoiceError(null);
    } catch (error) {
      setVoiceError(
        error instanceof Error && error.message.trim()
          ? error.message
          : TRANSCRIPTION_ERROR_MESSAGE,
      );
    } finally {
      setVoiceState("idle");
    }
  }

  async function startRecording() {
    if (isLoading || isVoiceBusy || isRecordingRef.current) {
      return;
    }

    setVoiceError(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setVoiceError("Tu navegador no soporta grabación de voz.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionDenied(false);

      const mimeType = getPreferredRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      });

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      isRecordingRef.current = true;
      recorder.start();
      setVoiceState("recording");
    } catch (error) {
      await stopMediaStream();

      const denied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");

      if (denied) {
        setPermissionDenied(true);
        setVoiceError(PERMISSION_DENIED_MESSAGE);
        return;
      }

      setVoiceError(TRANSCRIPTION_ERROR_MESSAGE);
    }
  }

  function handleMicPointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    void startRecording();
  }

  function handleMicPointerUp(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (isRecordingRef.current) {
      void finishRecording();
    }
  }

  function handleMicPointerCancel(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (isRecordingRef.current) {
      void finishRecording();
    }
  }

  useEffect(() => {
    return () => {
      clearAutoSendTimer();

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }

      void stopMediaStream();
    };
  }, []);

  return (
    <Card className="shell-panel overflow-hidden shadow-none">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">Escribí tu consulta</CardTitle>
            <CardDescription className="leading-6">
              Puedes pedir contexto del negocio, ayuda para armar una cotización o
              mantener presionado el micrófono para dictar.
            </CardDescription>
          </div>
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Modo seguro
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-[1.75rem] border border-token/80 bg-background/70 p-4">
          <textarea
            value={value}
            onChange={(event) => handleValueChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ej. Necesito un borrador para Cliente 2 con 20 bolsas de cemento y envío en 48 horas."
            disabled={isInputDisabled}
            className={textareaClassName}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            "Consultar historial de cotizaciones",
            "Pedir un borrador sugerido",
            "Revisar precios del catálogo",
          ].map((hint) => (
            <span
              key={hint}
              className="rounded-full border border-token/80 bg-background/70 px-3 py-1 text-xs text-muted-foreground"
            >
              {hint}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Enter para enviar, Shift + Enter para salto de línea, o mantené el
              micrófono para dictar.
            </p>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                aria-label={
                  voiceState === "recording"
                    ? "Grabando audio"
                    : voiceState === "processing"
                      ? "Transcribiendo audio"
                      : "Mantener presionado para dictar"
                }
                disabled={isLoading || voiceState === "processing"}
                onPointerDown={handleMicPointerDown}
                onPointerUp={handleMicPointerUp}
                onPointerCancel={handleMicPointerCancel}
                onContextMenu={(event) => event.preventDefault()}
                className={cn(
                  "h-12 min-h-12 w-12 min-w-12 shrink-0 touch-none select-none rounded-full p-0 sm:h-11 sm:w-11",
                  voiceState === "recording" &&
                    "animate-pulse border-red-500/50 bg-red-500/15 text-red-600 hover:bg-red-500/20 dark:text-red-300",
                  permissionDenied && voiceState === "idle" && "border-destructive/40",
                )}
              >
                {voiceState === "processing" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>

              <Button
                type="button"
                onClick={() => {
                  clearAutoSendTimer();
                  transcriptBaselineRef.current = null;
                  onSubmit();
                }}
                disabled={isLoading || isVoiceBusy || !value.trim()}
                className="min-h-12 sm:min-h-10"
              >
                <SendHorizontal className="mr-2 h-4 w-4" />
                {isLoading ? "Consultando..." : "Enviar mensaje"}
              </Button>
            </div>
          </div>

          {voiceState === "recording" ? (
            <p className="text-sm font-medium text-red-600 dark:text-red-300">
              Grabando… soltá para transcribir
            </p>
          ) : null}

          {voiceError ? (
            <p className="rounded-[1.5rem] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {voiceError}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

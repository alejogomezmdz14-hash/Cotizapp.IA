"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Loader2, Mic, SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type BrowserSpeechRecognition,
  type SpeechRecognitionEventLike,
  createBrowserSpeechRecognition,
  isBrowserSpeechRecognitionSupported,
  parseSpeechRecognitionResults,
} from "@/lib/chat/browser-speech-recognition";
import { cn } from "@/lib/utils";

type ChatInputProps = {
  value: string;
  isLoading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

type VoiceState = "idle" | "listening" | "processing";

const textareaClassName =
  "flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

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

function joinTranscriptParts(...parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function ChatInput({
  value,
  isLoading,
  onChange,
  onSubmit,
}: ChatInputProps) {
  const supportsLiveSpeechRef = useRef(isBrowserSpeechRecognitionSupported());
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const dictationBaseRef = useRef("");
  const dictationFinalRef = useRef("");
  const interimTranscriptRef = useRef("");
  const shouldRestartRecognitionRef = useRef(false);
  const isListeningRef = useRef(false);
  const recognitionRestartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [dictationFinal, setDictationFinal] = useState("");

  const isListening = voiceState === "listening";
  const isVoiceBusy = voiceState !== "idle";
  const isInputDisabled = isLoading || voiceState === "processing";
  const usesWhisperFallback = !supportsLiveSpeechRef.current;

  const committedDictation = joinTranscriptParts(
    dictationBaseRef.current,
    dictationFinal,
  );

  const stopRecognition = useCallback(() => {
    shouldRestartRecognitionRef.current = false;
    isListeningRef.current = false;
    if (recognitionRestartTimeoutRef.current) {
      clearTimeout(recognitionRestartTimeoutRef.current);
      recognitionRestartTimeoutRef.current = null;
    }
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, []);

  const commitDictation = useCallback(() => {
    const nextValue = joinTranscriptParts(
      dictationBaseRef.current,
      dictationFinalRef.current,
      interimTranscriptRef.current,
    );

    if (nextValue) {
      onChange(nextValue);
    }

    dictationBaseRef.current = "";
    dictationFinalRef.current = "";
    interimTranscriptRef.current = "";
    setDictationFinal("");
    setInterimTranscript("");
  }, [onChange]);

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

  async function finishWhisperRecording() {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      setVoiceState("idle");
      return;
    }

    setVoiceState("processing");

    await new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });

    const mimeType = recorder.mimeType || audioChunksRef.current[0]?.type || "audio/webm";
    const blob = new Blob(audioChunksRef.current, { type: mimeType });

    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    await stopMediaStream();

    if (blob.size === 0) {
      setVoiceState("idle");
      setVoiceError(TRANSCRIPTION_ERROR_MESSAGE);
      return;
    }

    try {
      const transcript = await transcribeRecording(blob, mimeType);
      onChange(joinTranscriptParts(value, transcript));
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

  async function startWhisperRecording() {
    if (isLoading || isVoiceBusy) {
      return;
    }

    setVoiceError(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setVoiceError("Tu navegador no soporta dictado por voz.");
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
      recorder.start();
      setVoiceState("listening");
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

  const handleRecognitionResult = useCallback((event: SpeechRecognitionEventLike) => {
      const { interimTranscript: nextInterim, newFinalSegments } =
        parseSpeechRecognitionResults(event);

      if (newFinalSegments.length > 0) {
        dictationFinalRef.current = joinTranscriptParts(
          dictationFinalRef.current,
          ...newFinalSegments,
        );
        setDictationFinal(dictationFinalRef.current);
      }

      interimTranscriptRef.current = nextInterim;
      setInterimTranscript(nextInterim);
  }, []);

  const startLiveDictation = useCallback(() => {
    const recognition = createBrowserSpeechRecognition();

    if (!recognition) {
      setVoiceError("Tu navegador no soporta dictado en tiempo real.");
      return;
    }

    dictationBaseRef.current = value.trim();
    dictationFinalRef.current = "";
    interimTranscriptRef.current = "";
    setDictationFinal("");
    setInterimTranscript("");
    setVoiceError(null);
    setPermissionDenied(false);

    recognition.onresult = handleRecognitionResult;
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setPermissionDenied(true);
        setVoiceError(PERMISSION_DENIED_MESSAGE);
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        setVoiceError(TRANSCRIPTION_ERROR_MESSAGE);
      }

      shouldRestartRecognitionRef.current = false;
      isListeningRef.current = false;
      setVoiceState("idle");
      setInterimTranscript("");
    };
    recognition.onend = () => {
      if (!shouldRestartRecognitionRef.current) {
        isListeningRef.current = false;
        setVoiceState("idle");
        commitDictation();
        if (recognitionRestartTimeoutRef.current) {
          clearTimeout(recognitionRestartTimeoutRef.current);
          recognitionRestartTimeoutRef.current = null;
        }
        recognitionRef.current = null;
        return;
      }

      if (!isListeningRef.current) {
        recognitionRef.current = null;
        return;
      }

      if (recognitionRestartTimeoutRef.current) {
        clearTimeout(recognitionRestartTimeoutRef.current);
      }
      recognitionRestartTimeoutRef.current = setTimeout(() => {
        try {
          recognition.start();
        } catch {
          shouldRestartRecognitionRef.current = false;
          isListeningRef.current = false;
          setVoiceState("idle");
          commitDictation();
          recognitionRef.current = null;
        }
      }, 250);
    };

    recognitionRef.current = recognition;
    shouldRestartRecognitionRef.current = true;
    isListeningRef.current = true;

    try {
      recognition.start();
      setVoiceState("listening");
    } catch {
      recognitionRef.current = null;
      shouldRestartRecognitionRef.current = false;
      isListeningRef.current = false;
      setVoiceError(TRANSCRIPTION_ERROR_MESSAGE);
    }
  }, [commitDictation, handleRecognitionResult, value]);

  const stopLiveDictation = useCallback(() => {
    shouldRestartRecognitionRef.current = false;
    isListeningRef.current = false;
    setVoiceState("idle");
    stopRecognition();
  }, [stopRecognition]);

  function handleMicToggle() {
    if (isLoading || voiceState === "processing") {
      return;
    }

    if (voiceState === "listening") {
      if (usesWhisperFallback) {
        void finishWhisperRecording();
      } else {
        stopLiveDictation();
      }
      return;
    }

    if (usesWhisperFallback) {
      void startWhisperRecording();
      return;
    }

    startLiveDictation();
  }

  function handleValueChange(nextValue: string) {
    if (isListening) {
      return;
    }

    onChange(nextValue);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    onSubmit();
  }

  useEffect(() => {
    return () => {
      shouldRestartRecognitionRef.current = false;
      if (recognitionRestartTimeoutRef.current) {
        clearTimeout(recognitionRestartTimeoutRef.current);
        recognitionRestartTimeoutRef.current = null;
      }
      recognitionRef.current?.abort();
      recognitionRef.current = null;

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
              dictar con el micrófono en tiempo real.
            </CardDescription>
          </div>
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Modo seguro
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-[1.75rem] border border-token/80 bg-background/70 p-4">
          {isListening && !usesWhisperFallback ? (
            <div
              role="textbox"
              aria-label="Dictado en tiempo real"
              aria-live="polite"
              className={cn(textareaClassName, "whitespace-pre-wrap")}
            >
              {committedDictation ? <span>{committedDictation}</span> : null}
              {committedDictation && interimTranscript ? <span> </span> : null}
              {interimTranscript ? (
                <span className="italic text-muted-foreground">{interimTranscript}</span>
              ) : !committedDictation ? (
                <span className="italic text-muted-foreground/70">
                  Empezá a hablar…
                </span>
              ) : null}
            </div>
          ) : (
            <textarea
              value={value}
              onChange={(event) => handleValueChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ej. Necesito un borrador para Cliente 2 con 20 bolsas de cemento y envío en 48 horas."
              disabled={isInputDisabled}
              className={textareaClassName}
            />
          )}
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
              Enter para enviar, Shift + Enter para salto de línea, o el micrófono
              para dictar en tiempo real.
            </p>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                aria-label={
                  voiceState === "listening"
                    ? "Detener dictado"
                    : voiceState === "processing"
                      ? "Transcribiendo audio"
                      : "Iniciar dictado por voz"
                }
                aria-pressed={voiceState === "listening"}
                disabled={isLoading || voiceState === "processing"}
                onClick={handleMicToggle}
                className={cn(
                  "h-12 min-h-12 w-12 min-w-12 shrink-0 rounded-full p-0 sm:h-11 sm:w-11",
                  voiceState === "listening" &&
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
                onClick={onSubmit}
                disabled={isLoading || isVoiceBusy || !value.trim()}
                className="min-h-12 sm:min-h-10"
              >
                <SendHorizontal className="mr-2 h-4 w-4" />
                {isLoading ? "Consultando..." : "Enviar mensaje"}
              </Button>
            </div>
          </div>

          {voiceState === "listening" ? (
            <p className="text-sm font-medium text-red-600 dark:text-red-300">
              {usesWhisperFallback
                ? "Grabando… tocá el micrófono de nuevo para transcribir"
                : "Escuchando…"}
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

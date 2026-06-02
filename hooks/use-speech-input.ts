"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  createBrowserSpeechRecognition,
  isBrowserSpeechRecognitionSupported,
  parseSpeechRecognitionResults,
  type BrowserSpeechRecognition,
  type SpeechRecognitionEventLike,
} from "@/lib/chat/browser-speech-recognition";

function joinTranscriptParts(...parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

type UseSpeechInputOptions = {
  value: string;
  onChange: (nextValue: string) => void;
};

export function useSpeechInput({ value, onChange }: UseSpeechInputOptions) {
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const supportsSpeech = isBrowserSpeechRecognitionSupported();

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const baseValueRef = useRef("");
  const finalTranscriptRef = useRef("");

  const commitDictation = useCallback(() => {
    const merged = joinTranscriptParts(baseValueRef.current, finalTranscriptRef.current);
    if (merged !== value) {
      onChange(merged);
    }
    finalTranscriptRef.current = "";
  }, [onChange, value]);

  const handleRecognitionResult = useCallback(
    (event: SpeechRecognitionEventLike) => {
      const { newFinalSegments } = parseSpeechRecognitionResults(event);
      if (newFinalSegments.length > 0) {
        finalTranscriptRef.current = joinTranscriptParts(
          finalTranscriptRef.current,
          ...newFinalSegments,
        );
        onChange(joinTranscriptParts(baseValueRef.current, finalTranscriptRef.current));
      }
    },
    [onChange],
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    commitDictation();
  }, [commitDictation]);

  const startListening = useCallback(() => {
    const recognition = createBrowserSpeechRecognition();
    if (!recognition) {
      setVoiceError("Tu navegador no soporta dictado por voz.");
      return;
    }

    baseValueRef.current = value.trim();
    finalTranscriptRef.current = "";
    setVoiceError(null);

    recognition.onresult = handleRecognitionResult;
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setVoiceError("Habilitá el micrófono en tu navegador para usar esta función.");
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        setVoiceError("No se pudo transcribir. Intentá de nuevo.");
      }
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      commitDictation();
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch {
      setVoiceError("No se pudo iniciar el dictado.");
      setIsListening(false);
    }
  }, [commitDictation, handleRecognitionResult, value]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
      return;
    }
    startListening();
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return {
    supportsSpeech,
    isListening,
    voiceError,
    toggleListening,
  };
}

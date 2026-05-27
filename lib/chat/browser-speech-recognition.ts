export const SPEECH_RECOGNITION_LANG = "es-AR";

export type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
  length: number;
};

export type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike> & {
    length: number;
  };
};

export type SpeechRecognitionErrorEventLike = {
  error: string;
  message?: string;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const browserWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return (
    browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null
  );
}

export function isBrowserSpeechRecognitionSupported() {
  return getSpeechRecognitionConstructor() !== null;
}

export function parseSpeechRecognitionResults(event: SpeechRecognitionEventLike) {
  let interimTranscript = "";
  const newFinalSegments: string[] = [];

  for (let index = event.resultIndex; index < event.results.length; index += 1) {
    const result = event.results[index];

    if (!result) {
      continue;
    }

    const transcript = result[0]?.transcript ?? "";

    if (!transcript) {
      continue;
    }

    if (result.isFinal) {
      newFinalSegments.push(transcript);
    } else {
      interimTranscript += transcript;
    }
  }

  return {
    interimTranscript,
    newFinalSegments,
  };
}

export function createBrowserSpeechRecognition() {
  const SpeechRecognitionClass = getSpeechRecognitionConstructor();

  if (!SpeechRecognitionClass) {
    return null;
  }

  const recognition = new SpeechRecognitionClass();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = SPEECH_RECOGNITION_LANG;

  return recognition;
}

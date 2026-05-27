import assert from "node:assert/strict";
import test from "node:test";

import {
  parseSpeechRecognitionResults,
  SPEECH_RECOGNITION_LANG,
} from "../lib/chat/browser-speech-recognition";

test("parseSpeechRecognitionResults splits final and interim transcripts", () => {
  const parsed = parseSpeechRecognitionResults({
    resultIndex: 0,
    results: [
      { isFinal: true, 0: { transcript: "Hola " }, length: 1 },
      { isFinal: false, 0: { transcript: "mundo" }, length: 1 },
    ],
  });

  assert.deepEqual(parsed.newFinalSegments, ["Hola "]);
  assert.equal(parsed.interimTranscript, "mundo");
});

test("speech recognition uses es-AR locale constant", () => {
  assert.equal(SPEECH_RECOGNITION_LANG, "es-AR");
});

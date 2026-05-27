import assert from "node:assert/strict";
import test from "node:test";

import {
  TranscriptionError,
  isSupportedTranscriptionFile,
  parseTranscriptionUploadFormData,
} from "../lib/ai/transcribe";

test("isSupportedTranscriptionFile accepts common voice capture formats", () => {
  assert.equal(
    isSupportedTranscriptionFile(
      new File(["audio"], "voice.webm", { type: "audio/webm" }),
    ),
    true,
  );
  assert.equal(
    isSupportedTranscriptionFile(
      new File(["audio"], "voice.mp4", { type: "audio/mp4" }),
    ),
    true,
  );
  assert.equal(
    isSupportedTranscriptionFile(
      new File(["audio"], "voice.wav", { type: "audio/wav" }),
    ),
    true,
  );
});

test("parseTranscriptionUploadFormData rejects missing or unsupported files", () => {
  assert.throws(
    () => parseTranscriptionUploadFormData(new FormData()),
    (error: unknown) => {
      assert.ok(error instanceof TranscriptionError);
      assert.equal(error.status, 400);
      return true;
    },
  );

  const formData = new FormData();
  formData.set(
    "file",
    new File(["text"], "notes.txt", { type: "text/plain" }),
  );

  assert.throws(
    () => parseTranscriptionUploadFormData(formData),
    (error: unknown) => {
      assert.ok(error instanceof TranscriptionError);
      assert.match(String(error), /webm, mp4 o wav/i);
      return true;
    },
  );
});

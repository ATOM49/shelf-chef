const TRANSCRIPTION_MODEL = "gemini-2.5-flash";
const MAX_OUTPUT_TOKENS = 400;

/**
 * Normalizes a browser-reported MIME type to the subset Gemini's inline audio
 * API accepts.  Strips codec suffixes (e.g. "audio/webm; codecs=opus" →
 * "audio/webm") and maps aliases to their canonical forms.
 */
export function normalizeAudioMimeType(raw: string): string {
  const base = raw.split(";")[0].trim().toLowerCase();
  switch (base) {
    case "audio/mpeg":
    case "audio/mp3":
      return "audio/mp3";
    case "audio/x-m4a":
      return "audio/mp4";
    default:
      return base;
  }
}

/**
 * The set of MIME types accepted by both the browser (MediaRecorder / File) and
 * Gemini's inline audio input.
 */
export const SUPPORTED_AUDIO_MIME_TYPES = new Set([
  "audio/mp3",
  "audio/mpeg",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
  "audio/aac",
  "audio/mp4",
  "audio/x-m4a",
]);

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string };
};

/**
 * Sends the audio to Gemini's multimodal API and returns a plain-English
 * description of the cooking intent captured in the voice note.  The
 * transcript itself is never stored — it is only used to build the recipe
 * generation prompt.
 */
export async function transcribeAudioForRecipe(
  audioBase64: string,
  mimeType: string,
  apiKey: string,
): Promise<string> {
  const normalizedMime = normalizeAudioMimeType(mimeType);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TRANSCRIPTION_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: normalizedMime,
                  data: audioBase64,
                },
              },
              {
                text: [
                  "Listen to this voice note and extract the cooking or recipe intent.",
                  "",
                  "Return a clear, concise plain-English description (under 200 words) of:",
                  "1. What dish the speaker wants to make",
                  "2. Any ingredients, dietary preferences, or constraints mentioned",
                  "3. Any cuisine style, serving size, or cooking method hints",
                  "",
                  "Write the description as if briefing a chef.",
                  "Do not add headers, bullet points, markdown, or extra commentary.",
                  "Just write a natural, flowing description.",
                ].join("\n"),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Audio transcription failed (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as GeminiResponse;

  if (data.error?.message) {
    throw new Error(`Audio transcription error: ${data.error.message}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error("The voice note could not be understood. Please try again with a clearer recording.");
  }

  return text;
}

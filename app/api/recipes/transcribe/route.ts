import type { NextRequest } from "next/server";
import { isLlmConfigurationError } from "@/lib/ai/structured";
import {
  normalizeAudioMimeType,
  SUPPORTED_AUDIO_MIME_TYPES,
  transcribeAudioForRecipe,
} from "@/lib/ai/transcription";

const MAX_AUDIO_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data." }, { status: 400 });
  }

  const audioFile = formData.get("audio");
  if (!(audioFile instanceof File)) {
    return Response.json({ error: "An audio file is required." }, { status: 400 });
  }

  if (audioFile.size > MAX_AUDIO_SIZE_BYTES) {
    return Response.json({ error: "Audio file must be under 8 MB." }, { status: 400 });
  }

  const mimeType = normalizeAudioMimeType(audioFile.type || "audio/webm");
  if (!SUPPORTED_AUDIO_MIME_TYPES.has(mimeType) && !SUPPORTED_AUDIO_MIME_TYPES.has(audioFile.type)) {
    return Response.json(
      { error: "Unsupported audio format. Use mp3, wav, webm, ogg, flac, aac, or mp4." },
      { status: 400 },
    );
  }

  const apiKey = (
    process.env["LLM_API_KEY"] ??
    process.env["GOOGLE_API_KEY"] ??
    process.env["GEMINI_API_KEY"] ??
    ""
  ).trim();

  if (!apiKey) {
    return Response.json(
      {
        error: "LLM configuration error",
        detail: "No API key configured. Set GOOGLE_API_KEY or GEMINI_API_KEY.",
      },
      { status: 500 },
    );
  }

  try {
    const audioBuffer = await audioFile.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");
    const transcript = await transcribeAudioForRecipe(audioBase64, audioFile.type || "audio/webm", apiKey);
    return Response.json({ transcript });
  } catch (err) {
    const status = isLlmConfigurationError(err) ? 500 : 502;
    return Response.json(
      {
        error: isLlmConfigurationError(err) ? "LLM configuration error" : "LLM call failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status },
    );
  }
}

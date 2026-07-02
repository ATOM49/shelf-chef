import type { NextRequest } from "next/server";

const SHARED_STOCK_IMAGE_STORAGE_KEY = "stockpot:shared-stock-image";
const MAX_SHARED_IMAGE_BYTES = 3 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return renderRedirectPage(req, "Stockpot could not read the shared image.");
  }

  const image = getSharedImageFile(formData);
  if (!image) {
    return renderRedirectPage(req, "Share an image file to update stock.");
  }

  if (image.size > MAX_SHARED_IMAGE_BYTES) {
    return renderRedirectPage(req, "Shared images must be smaller than 3 MB.");
  }

  const mimeType = normalizeImageMimeType(image);
  if (!ACCEPTED_IMAGE_TYPES.has(mimeType)) {
    return renderRedirectPage(
      req,
      "Stockpot accepts JPEG, PNG, WebP, HEIC, or HEIF images.",
    );
  }

  const imageBuffer = Buffer.from(await image.arrayBuffer());
  const payload = {
    dataUrl: `data:${mimeType};base64,${imageBuffer.toString("base64")}`,
    fileName: image.name || "Shared image",
    sharedAt: Date.now(),
  };

  return renderHandoffPage(payload);
}

function getSharedImageFile(formData: FormData) {
  const namedFile = formData.get("stockImage");
  if (namedFile instanceof File) {
    return namedFile;
  }

  for (const value of formData.values()) {
    if (value instanceof File && value.type.startsWith("image/")) {
      return value;
    }
  }

  return null;
}

function normalizeImageMimeType(file: File) {
  if (file.type) {
    return file.type.toLowerCase();
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    default:
      return "application/octet-stream";
  }
}

function renderHandoffPage(payload: {
  dataUrl: string;
  fileName: string;
  sharedAt: number;
}) {
  const serializedPayload = safeInlineJson(payload);

  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Opening Stockpot...</title>
  </head>
  <body>
    <script>
      try {
        sessionStorage.setItem(${JSON.stringify(SHARED_STOCK_IMAGE_STORAGE_KEY)}, ${serializedPayload});
        location.replace("/?stockImageShared=1");
      } catch {
        location.replace("/?stockImageError=Shared%20image%20could%20not%20be%20stored.%20Try%20a%20smaller%20image.");
      }
    </script>
  </body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

function renderRedirectPage(req: NextRequest, message: string) {
  const url = `/?stockImageError=${encodeURIComponent(message)}`;

  return Response.redirect(new URL(url, req.nextUrl.origin), 303);
}

function safeInlineJson(value: unknown) {
  return JSON.stringify(JSON.stringify(value)).replaceAll("<", "\\u003c");
}

/**
 * PKCE (Proof Key for Code Exchange – RFC 7636) helpers.
 *
 * All operations use the Web Crypto API, which is available in both the
 * Node.js 18+ runtime and the Next.js Edge runtime.
 */

/** Encodes a Uint8Array to a base64url string (no padding). */
function base64UrlEncode(bytes: Uint8Array): string {
  // btoa works on a binary string
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Generates a cryptographically random code verifier.
 *
 * The verifier is a high-entropy random string between 43 and 128 characters
 * (per RFC 7636 §4.1).  We use 32 random bytes → 43-character base64url string.
 */
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/**
 * Derives the code challenge from a verifier using the S256 method.
 *
 * challenge = BASE64URL(SHA256(ASCII(verifier)))
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Generates a cryptographically random `state` parameter for an OAuth request.
 *
 * 16 random bytes → 22-character base64url string.
 */
export function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

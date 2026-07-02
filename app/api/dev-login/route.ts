import { devSignIn, isDevLoginEnabled } from "@/src/auth";
import { NextResponse } from "next/server";

// Dev-only endpoint for Playwright (or other API clients) to authenticate
// directly, per Playwright's recommended API-based auth setup pattern:
// https://playwright.dev/docs/auth
export async function POST(req: Request) {
  if (!isDevLoginEnabled) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { email, password } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const user = await devSignIn(email, password);
    return NextResponse.json({ id: user.id, email: user.email, name: user.name });
  } catch {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
}

import { NextRequest, NextResponse } from "next/server";

/** Observe a nonce policy first; retain the existing enforced framing policy. */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const policy = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'`;
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  // Next extracts the nonce from the request CSP for its own scripts.
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy-Report-Only", policy);
  if (process.env.HSTS_ENABLED === "true") response.headers.set("Strict-Transport-Security", "max-age=300");
  return response;
}

export const config = { matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"] };

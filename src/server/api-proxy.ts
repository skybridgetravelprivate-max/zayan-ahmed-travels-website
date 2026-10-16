import "server-only";

const hopByHopHeaders = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export function embeddedApiOrigin() {
  const configured = process.env.ZAT_INTERNAL_API_ORIGIN?.trim() ?? "";
  let origin: URL;
  try {
    origin = new URL(configured);
  } catch {
    throw new Error("The embedded API is not ready.");
  }

  if (
    origin.protocol !== "http:" ||
    origin.hostname !== "127.0.0.1" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error("The embedded API origin must be a loopback HTTP origin.");
  }

  return origin.origin;
}

function forwardRequestHeaders(source: Headers) {
  const headers = new Headers();
  source.forEach((value, name) => {
    if (!hopByHopHeaders.has(name.toLowerCase())) headers.append(name, value);
  });
  return headers;
}

function forwardResponseHeaders(source: Headers) {
  const headers = new Headers();
  source.forEach((value, name) => {
    const normalized = name.toLowerCase();
    if (normalized !== "set-cookie" && !hopByHopHeaders.has(normalized)) {
      headers.append(name, value);
    }
  });

  const cookieHeaders = source as Headers & { getSetCookie?: () => string[] };
  for (const cookie of cookieHeaders.getSetCookie?.() ?? []) {
    headers.append("set-cookie", cookie);
  }
  if (!cookieHeaders.getSetCookie) {
    const cookie = source.get("set-cookie");
    if (cookie) headers.append("set-cookie", cookie);
  }

  return headers;
}

export async function proxyApiRequest(request: Request) {
  const incoming = new URL(request.url);
  const target = new URL(`${incoming.pathname}${incoming.search}`, embeddedApiOrigin());
  const hasBody = !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase());
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers: forwardRequestHeaders(request.headers),
    body: hasBody ? request.body : undefined,
    redirect: "manual",
    cache: "no-store",
    ...(hasBody && request.body ? { duplex: "half" } : {}),
  };
  const response = await fetch(target, init);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: forwardResponseHeaders(response.headers),
  });
}

import "server-only";

import { isIP } from "node:net";

const windowMs = 15 * 60 * 1000;
const maxBuckets = 10_000;
const cleanupIntervalMs = 60 * 1000;

type RateLimitScope = "customer-auth" | "inquiries";

const limits: Record<RateLimitScope, number> = {
  "customer-auth": 10,
  inquiries: 10,
};

const buckets = new Map<string, { count: number; resetAt: number }>();
let lastCleanupAt = 0;

function normalizedIp(value: string) {
  const version = isIP(value);
  if (version === 4) return value;
  if (version === 6) return new URL(`http://[${value}]/`).hostname;
  return "";
}

function clientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const trustedProxyClient = forwardedFor.split(",").at(-1)?.trim() ?? "";
    return normalizedIp(trustedProxyClient) || "unknown";
  }
  return normalizedIp(request.headers.get("x-real-ip")?.trim() ?? "") || "unknown";
}

function removeExpiredBuckets(now: number, force = false) {
  if (!force && now - lastCleanupAt < cleanupIntervalMs) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  lastCleanupAt = now;
}

function tooManyRequests(retryAfterSeconds: number) {
  return Response.json(
    { ok: false, error: "Too many requests. Try again later." },
    {
      status: 429,
      headers: {
        "Cache-Control": "private, no-store",
        "Retry-After": String(Math.max(1, retryAfterSeconds)),
      },
    },
  );
}

export function publicRateLimitResponse(
  request: Request,
  scope: RateLimitScope,
  now = Date.now(),
): Response | null {
  removeExpiredBuckets(now);
  const key = `${scope}:${clientIp(request)}`;
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (bucket) buckets.delete(key);
    if (buckets.size >= maxBuckets) {
      removeExpiredBuckets(now, true);
      if (buckets.size >= maxBuckets) return tooManyRequests(Math.ceil(windowMs / 1000));
    }
    bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, bucket);
    return null;
  }

  if (bucket.count >= limits[scope]) {
    return tooManyRequests(Math.ceil((bucket.resetAt - now) / 1000));
  }

  bucket.count += 1;
  return null;
}

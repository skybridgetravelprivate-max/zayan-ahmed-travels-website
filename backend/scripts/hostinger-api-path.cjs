"use strict";

/**
 * Paths the Hostinger gateway must send to Nest (not Next).
 * Keep /v1/customer/bookings and /v1/customer/upsert-by-email exact — do not open all of /v1/*.
 */
function isApiPathname(pathOnly) {
  const p = String(pathOnly || "").split("?")[0];
  if (p === "/api/account" || p.startsWith("/api/account/") || p === "/api/inquiries") return false;
  return p === "/api" || p.startsWith("/api/") || p === "/v1/customer/bookings" || p === "/v1/customer/upsert-by-email";
}

// A nonempty value other than "false" fails closed, including configuration typos.
function receiptWriteBlocked(req, disabled, businessDisabled) {
  const receiptsClosed = !!disabled && disabled !== "false";
  const businessClosed = !!businessDisabled && businessDisabled !== "false";
  if ((!receiptsClosed && !businessClosed) || ["GET", "HEAD", "OPTIONS"].includes(req.method)) return false;
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, "http://gateway.local").pathname); }
  catch { return true; }
  if (businessClosed && /^\/api\/v1(?:\/|$)/i.test(pathname)) return true;
  return receiptsClosed && /^\/api\/v1\/finance\/receipts(?:\/|$)/i.test(pathname);
}

module.exports = { isApiPathname, receiptWriteBlocked };

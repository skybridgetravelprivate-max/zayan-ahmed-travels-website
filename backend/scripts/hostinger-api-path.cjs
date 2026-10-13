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

module.exports = { isApiPathname };

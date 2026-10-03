import "server-only";

const privateNoStore = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
};

/** Account API JSON. These responses must not be stored by a shared cache. */
export function accountResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: privateNoStore });
}

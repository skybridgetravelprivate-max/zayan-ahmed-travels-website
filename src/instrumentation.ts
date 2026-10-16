export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return;
  }

  const { startEmbeddedApi } = await import("./server/embedded-api");
  await startEmbeddedApi();
}

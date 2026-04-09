const appRole = (process.env["APP_ROLE"] ?? "api").toLowerCase();

if (appRole === "worker") {
  await import("./modules/recognitions/worker.js");
} else if (appRole === "combined") {
  const index = await import("./index.js");
  index.startHttpServer();
  await import("./modules/recognitions/worker.js");

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await index.closeHttpServer();
    const worker = await import("./modules/recognitions/worker.js");
    worker.requestWorkerShutdown();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
} else {
  const index = await import("./index.js");
  index.startHttpServer();
}

export {};

import { startHttpServer, closeHttpServer } from "./index.js";

startHttpServer();

const worker = await import("./modules/recognitions/worker.js");

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  await closeHttpServer();
  worker.requestWorkerShutdown();
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

export {};

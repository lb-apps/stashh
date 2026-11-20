import type { MenuRepository, PlaceMenu } from "../storage/repository.ts";
import type { Logger } from "../lib/logger.ts";

const POLL_INTERVAL_MS = 5_000;
const IDLE_INTERVAL_MS = 30_000;

export class MenuWorker {
  private running = false;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private inFlight = 0;
  private options: {
    repo: MenuRepository;
    process: (task: PlaceMenu) => Promise<void>;
    concurrency: number;
    log: Logger;
  };

  constructor(options: {
    repo: MenuRepository;
    process: (task: PlaceMenu) => Promise<void>;
    concurrency: number;
    log: Logger;
  }) {
    this.options = options;
  }

  start() {
    this.running = true;
    this.options.log.info({ concurrency: this.options.concurrency }, "menu worker started");
    this.poll();
  }

  async stop() {
    this.running = false;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
    while (this.inFlight > 0) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    this.options.log.info("menu worker stopped");
  }

  get inFlightCount() {
    return this.inFlight;
  }

  private poll() {
    if (!this.running) return;

    if (this.inFlight >= this.options.concurrency) {
      this.scheduleNext(POLL_INTERVAL_MS);
      return;
    }

    void this.tryProcessNext();
  }

  private async tryProcessNext() {
    try {
      const task = await this.options.repo.claimNext();
      if (!task) {
        this.scheduleNext(IDLE_INTERVAL_MS);
        return;
      }

      this.inFlight++;
      this.options.log.info({ menuId: task.id, placeId: task.place_id }, "processing menu task");

      void this.options
        .process(task)
        .catch((error: unknown) => {
          this.options.log.error({ err: error, menuId: task.id }, "menu task failed");
          return this.options.repo.markFailed(task.id, String(error), task.retry_count);
        })
        .finally(() => {
          this.inFlight--;
          if (this.running) this.poll();
        });

      this.scheduleNext(POLL_INTERVAL_MS);
    } catch (error) {
      this.options.log.error({ err: error }, "worker poll error");
      this.scheduleNext(IDLE_INTERVAL_MS);
    }
  }

  private scheduleNext(ms: number) {
    if (!this.running) return;
    const timer = setTimeout(() => this.poll(), ms);
    this.timers.push(timer);
  }
}

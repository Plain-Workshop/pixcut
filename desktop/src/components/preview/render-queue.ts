// Video frame decoding can take longer than one UI tick. Finish the current
// frame, then render only the most recent request instead of starving playback.
export class LatestRenderQueue {
  private next: (() => Promise<void>) | null = null;
  private running = false;
  constructor(private readonly onError: (error: unknown) => void) {}
  enqueue(task: () => Promise<void>) {
    this.next = task;
    if (!this.running) void this.drain();
  }
  private async drain() {
    this.running = true;
    try {
      while (this.next) {
        const task = this.next; this.next = null;
        try { await task(); } catch (error) { this.onError(error); }
      }
    } finally { this.running = false; }
  }
}

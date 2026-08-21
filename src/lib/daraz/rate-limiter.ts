/**
 * Daraz API Request Rate Limiter (Token Bucket / Throttling)
 * Ensures API requests respect QPS (Queries Per Second) limits.
 */
export class DarazRateLimiter {
  private minIntervalMs: number;
  private lastRequestTime: number = 0;

  constructor(minIntervalMs = 200) {
    this.minIntervalMs = minIntervalMs;
  }

  /**
   * Throttle execution to ensure minimum interval between requests
   */
  public async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.minIntervalMs) {
      const waitMs = this.minIntervalMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Reset throttle timer
   */
  public reset(): void {
    this.lastRequestTime = 0;
  }
}

// Global rate limiter instance (default 5 QPS = 200ms interval)
export const globalDarazRateLimiter = new DarazRateLimiter(200);

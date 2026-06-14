// 最小间隔限流队列 —— 按 qps 控制请求节奏（TECH_DESIGN §6.3）
export class RateLimiter {
  private minIntervalMs: number
  private lastTime = 0
  private queue: Promise<void> = Promise.resolve()

  constructor(qps: number) {
    this.minIntervalMs = qps > 0 ? 1000 / qps : 0
  }

  // 串行排队，确保相邻调用至少间隔 minIntervalMs
  schedule<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const now = Date.now()
      const wait = Math.max(0, this.lastTime + this.minIntervalMs - now)
      if (wait > 0) await sleep(wait)
      this.lastTime = Date.now()
    })
    this.queue = run.catch(() => undefined)
    return run.then(fn)
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

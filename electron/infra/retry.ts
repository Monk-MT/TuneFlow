import { sleep } from './rateLimiter'

export interface RetryOptions {
  retries: number
  baseMs: number
  maxMs: number
  isRetryable?: (err: unknown) => boolean
  signal?: AbortSignal
}

// 指数退避重试，仅对可重试错误生效（TECH_DESIGN §6.3）
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  let attempt = 0
  for (;;) {
    if (opts.signal?.aborted) throw new Error('aborted')
    try {
      return await fn()
    } catch (err) {
      const retryable = opts.isRetryable ? opts.isRetryable(err) : true
      if (!retryable || attempt >= opts.retries) throw err
      const delay = Math.min(opts.maxMs, opts.baseMs * 2 ** attempt)
      attempt++
      await sleep(delay)
    }
  }
}

// 任务级日志，脱敏（不记录 Cookie/token）—— TECH_DESIGN §8
/* eslint-disable no-console */
export const logger = {
  info(msg: string, meta?: Record<string, unknown>): void {
    console.log(`[INFO] ${msg}`, meta ? sanitize(meta) : '')
  },
  warn(msg: string, meta?: Record<string, unknown>): void {
    console.warn(`[WARN] ${msg}`, meta ? sanitize(meta) : '')
  },
  error(msg: string, meta?: Record<string, unknown>): void {
    console.error(`[ERROR] ${msg}`, meta ? sanitize(meta) : '')
  }
}

const SENSITIVE = /cookie|token|secret|password|csrf/i

function sanitize(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(meta)) {
    out[k] = SENSITIVE.test(k) ? '***' : v
  }
  return out
}

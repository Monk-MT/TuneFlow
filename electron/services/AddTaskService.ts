// AddTaskService —— 批量添加核心管线（TECH_DESIGN §6.3 / PRD F6）
import type { AddResult, TaskProgress, StartTaskPayload } from '@shared/types'
import type { MusicProvider } from '../providers/MusicProvider'
import { RateLimiter } from '../infra/rateLimiter'
import { withRetry } from '../infra/retry'
import { ProviderError } from '../providers/community/CommunityProvider'
import { logger } from '../infra/logger'

export type ProgressCb = (p: TaskProgress) => void

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export class AddTaskService {
  private abort: AbortController | null = null

  constructor(private provider: MusicProvider) {}

  cancel(): void {
    this.abort?.abort()
  }

  async start(payload: StartTaskPayload, onProgress: ProgressCb): Promise<AddResult> {
    this.abort = new AbortController()
    const signal = this.abort.signal
    const caps = this.provider.capabilities()
    const limiter = new RateLimiter(caps.qps)

    // 渲染层已展平为可添加的 songId 列表
    const uniqueIds = Array.from(new Set(payload.songIds))

    const result: AddResult = { succeeded: [], failed: [], skipped: [] }
    const total = uniqueIds.length

    const emit = (phase: TaskProgress['phase'], message?: string): void => {
      onProgress({
        phase,
        total,
        succeeded: result.succeeded.length,
        failed: result.failed.length,
        skipped: result.skipped.length,
        message
      })
    }

    // 去重：比对目标歌单已有曲目
    emit('dedupe')
    let existing: Set<string>
    try {
      existing = new Set(await this.provider.getPlaylistTrackIds(payload.playlistId))
    } catch (e) {
      logger.warn('getPlaylistTrackIds failed, skip dedupe', { err: String(e) })
      existing = new Set()
    }
    const toAdd: string[] = []
    for (const id of uniqueIds) {
      if (existing.has(id)) result.skipped.push(id)
      else toAdd.push(id)
    }
    emit('adding')

    // 分批 + 限流 + 重试
    const batches = chunk(toAdd, caps.maxTracksPerAdd)
    for (const batch of batches) {
      if (signal.aborted) {
        emit('cancelled')
        return result
      }
      try {
        const batchResult = await limiter.schedule(() =>
          withRetry(() => this.provider.addTracksToPlaylist(payload.playlistId, batch), {
            retries: 3,
            baseMs: 800,
            maxMs: 8000,
            signal,
            isRetryable: (err) => err instanceof ProviderError && err.retryable
          })
        )
        result.succeeded.push(...batchResult.succeeded)
        result.failed.push(...batchResult.failed)
        result.skipped.push(...batchResult.skipped)
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e)
        for (const id of batch) result.failed.push({ songId: id, reason })
      }
      emit('adding')
    }

    emit('done')
    return result
  }
}

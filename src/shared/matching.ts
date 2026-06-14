// 匹配打分纯逻辑 —— 对应 TECH_DESIGN §6.2，便于 Vitest 单测
import type { SongCandidate, MatchStatus } from './types'

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s\p{P}]/gu, '')
    .trim()
}

// Levenshtein 相似度，归一化到 [0,1]
export function similarity(a: string, b: string): number {
  const x = normalize(a)
  const y = normalize(b)
  if (!x && !y) return 1
  if (!x || !y) return 0
  if (x === y) return 1
  const m = x.length
  const n = y.length
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (x[i - 1] === y[j - 1] ? 0 : 1)
      )
      prev = tmp
    }
  }
  const dist = dp[n]
  return 1 - dist / Math.max(m, n)
}

export interface ScoreWeights {
  title: number
  artist: number
}

const DEFAULT_WEIGHTS: ScoreWeights = { title: 0.6, artist: 0.4 }
// 自动匹配阈值
export const AUTO_THRESHOLD = 0.82

export function scoreCandidate(
  title: string,
  artist: string | undefined,
  cand: SongCandidate,
  weights: ScoreWeights = DEFAULT_WEIGHTS
): number {
  const titleSim = similarity(title, cand.name)
  if (!artist) {
    // 无歌手信息时，得分完全取决于歌名
    return titleSim
  }
  const candArtist = cand.artists.join(' ')
  const artistSim = similarity(artist, candArtist)
  return weights.title * titleSim + weights.artist * artistSim
}

export interface MatchDecision {
  status: MatchStatus
  selected?: SongCandidate
  ranked: SongCandidate[]
}

export function decideMatch(
  title: string,
  artist: string | undefined,
  candidates: SongCandidate[]
): MatchDecision {
  if (candidates.length === 0) {
    return { status: 'unmatched', ranked: [] }
  }
  const scored = candidates
    .map((c) => ({ c, score: scoreCandidate(title, artist, c) }))
    .sort((a, b) => b.score - a.score)
  const ranked = scored.map((s) => s.c)
  const top = scored[0]
  const second = scored[1]

  // 歌名与歌手完全一致 → 直接判定已匹配
  if (artist) {
    const exact = ranked.find(
      (c) => similarity(title, c.name) === 1 && similarity(artist, c.artists.join(' ')) === 1
    )
    if (exact) {
      return { status: 'auto', selected: exact, ranked }
    }
  }

  // 提供歌手且 Top1 高吻合，且与第二名拉开差距 → auto
  const hasArtist = !!artist
  const clearWinner = !second || top.score - second.score >= 0.15
  if (hasArtist && top.score >= AUTO_THRESHOLD && clearWinner) {
    return { status: 'auto', selected: top.c, ranked }
  }
  // 仅歌名但极高吻合且唯一候选 → auto
  if (!hasArtist && top.score >= 0.95 && candidates.length === 1) {
    return { status: 'auto', selected: top.c, ranked }
  }
  return { status: 'need_confirm', selected: top.c, ranked }
}

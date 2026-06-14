// MatchService —— 搜索与自动匹配（TECH_DESIGN §6.2）
import type { ParsedEntry, MatchItem, SongCandidate, EntryMode } from '@shared/types'
import type { MusicProvider } from '../providers/MusicProvider'
import { decideMatch } from '@shared/matching'
import { localId } from './ImportService'

const TOP_N = 10

export class MatchService {
  constructor(private provider: MusicProvider) {}

  async searchOne(entry: ParsedEntry): Promise<MatchItem> {
    const title = entry.title ?? entry.rawInput
    const keyword = entry.artist ? `${title} ${entry.artist}` : title
    const candidates = await this.provider.searchSongs(keyword, TOP_N)
    const decision = decideMatch(title, entry.artist, candidates)
    return {
      id: localId(),
      rawInput: entry.rawInput,
      mode: 'song' as EntryMode,
      candidates: decision.ranked,
      selected: decision.selected,
      status: decision.status
    }
  }

  async searchBatch(entries: ParsedEntry[]): Promise<MatchItem[]> {
    const out: MatchItem[] = []
    for (const e of entries) {
      try {
        out.push(await this.searchOne(e))
      } catch {
        out.push({
          id: localId(),
          rawInput: e.rawInput,
          mode: 'song',
          candidates: [],
          status: 'unmatched'
        })
      }
    }
    return out
  }

  reSearch(keyword: string): Promise<SongCandidate[]> {
    return this.provider.searchSongs(keyword, TOP_N)
  }
}

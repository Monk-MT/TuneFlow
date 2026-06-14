// ImportService —— 录入解析与专辑展开（TECH_DESIGN §6.1）
import Papa from 'papaparse'
import type {
  ParsedEntry,
  EntryMode,
  AlbumCandidate,
  MatchItem,
  AlbumRow,
  SongCandidate,
  MatchStatus
} from '@shared/types'
import type { MusicProvider } from '../providers/MusicProvider'

let counter = 0
function localId(): string {
  counter += 1
  return `row_${Date.now().toString(36)}_${counter}`
}

export class ImportService {
  constructor(private provider: MusicProvider) {}

  // 文本录入（每行一条），规则同对应模式的 txt
  parseText(text: string, mode: EntryMode): ParsedEntry[] {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    return this.dedupeEntries(lines.map((l) => this.parseLine(l, mode)))
  }

  // 文件录入：按扩展名走 csv 或 txt
  parseFile(content: string, fileName: string, mode: EntryMode): ParsedEntry[] {
    if (fileName.toLowerCase().endsWith('.csv')) {
      return this.parseCsv(content, mode)
    }
    return this.parseText(content, mode)
  }

  private parseCsv(content: string, mode: EntryMode): ParsedEntry[] {
    const parsed = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true
    })
    const rows = parsed.data ?? []
    const entries: ParsedEntry[] = rows
      .map((row): ParsedEntry | null => {
        const lower: Record<string, string> = {}
        for (const [k, v] of Object.entries(row)) lower[k.trim().toLowerCase()] = (v ?? '').trim()
        if (mode === 'album') {
          const album = lower['album'] ?? lower['专辑'] ?? ''
          if (!album) return null
          const artist = lower['artist'] ?? lower['歌手'] ?? ''
          return { rawInput: artist ? `${album} - ${artist}` : album, album, artist: artist || undefined }
        }
        const title = lower['title'] ?? lower['歌名'] ?? ''
        if (!title) return null
        const artist = lower['artist'] ?? lower['歌手'] ?? ''
        const album = lower['album'] ?? lower['专辑'] ?? ''
        return {
          rawInput: artist ? `${title} - ${artist}` : title,
          title,
          artist: artist || undefined,
          album: album || undefined
        }
      })
      .filter((e): e is ParsedEntry => e !== null)
    return this.dedupeEntries(entries)
  }

  // 拆「名称 - 歌手」
  private parseLine(line: string, mode: EntryMode): ParsedEntry {
    const parts = line.split(/\s*-\s*/)
    if (mode === 'album') {
      const [album, artist] = [parts[0]?.trim() ?? line, parts[1]?.trim()]
      return { rawInput: line, album, artist }
    }
    const [title, artist] = [parts[0]?.trim() ?? line, parts[1]?.trim()]
    return { rawInput: line, title, artist }
  }

  private dedupeEntries(entries: ParsedEntry[]): ParsedEntry[] {
    const seen = new Set<string>()
    const out: ParsedEntry[] = []
    for (const e of entries) {
      const key = e.rawInput.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(e)
    }
    return out
  }

  searchAlbums(keyword: string): Promise<AlbumCandidate[]> {
    return this.provider.searchAlbums(keyword, 20)
  }

  // 获取某专辑的曲目（带 songId，自动视为已匹配）
  getAlbumTracks(albumId: string): Promise<SongCandidate[]> {
    return this.provider.getAlbumTracks(albumId)
  }

  // 批量录入专辑名 → 每条搜索候选、自动选首个并展开曲目，生成专辑行
  async buildAlbumRows(names: string[]): Promise<AlbumRow[]> {
    const rows: AlbumRow[] = []
    for (const raw of names) {
      const name = raw.trim()
      if (!name) continue
      try {
        const candidates = await this.provider.searchAlbums(name, 20)
        if (candidates.length === 0) {
          rows.push({
            id: localId(),
            kind: 'album',
            rawInput: name,
            albumCandidates: [],
            tracks: [],
            status: 'unmatched'
          })
          continue
        }
        const selectedAlbum = candidates[0]
        const tracks = await this.provider.getAlbumTracks(selectedAlbum.albumId)
        rows.push({
          id: localId(),
          kind: 'album',
          rawInput: name,
          albumCandidates: candidates,
          selectedAlbum,
          tracks,
          status: (candidates.length > 1 ? 'need_confirm' : 'auto') as MatchStatus
        })
      } catch {
        rows.push({
          id: localId(),
          kind: 'album',
          rawInput: name,
          albumCandidates: [],
          tracks: [],
          status: 'unmatched'
        })
      }
    }
    return rows
  }

  // 专辑展开为多个 MatchItem（status=auto，带 sourceTag）
  async expandAlbum(albumId: string, albumName: string): Promise<MatchItem[]> {
    const tracks = await this.provider.getAlbumTracks(albumId)
    return tracks.map((t) => ({
      id: localId(),
      rawInput: `${t.name} - ${t.artists.join('/')}`,
      mode: 'album' as EntryMode,
      sourceTag: `来自专辑：${albumName}`,
      candidates: [t],
      selected: t,
      status: 'auto' as const
    }))
  }
}

export { localId }

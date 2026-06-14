// Zustand 全局状态 —— 列表、匹配状态、筛选、任务进度
import { create } from 'zustand'
import type {
  AuthState,
  MatchItem,
  AlbumRow,
  AlbumCandidate,
  ListRow,
  Playlist,
  TaskProgress,
  AddResult,
  ProviderType,
  MatchStatus,
  SongCandidate
} from '@shared/types'
import { isAlbumRow } from '@shared/types'

export type StatusFilter = 'all' | MatchStatus
export type ModalKind = 'auth' | 'import' | 'playlist' | 'result' | null

interface AppState {
  auth: AuthState
  provider: ProviderType
  items: ListRow[]
  statusFilter: StatusFilter
  keyword: string
  activeModal: ModalKind
  progress: TaskProgress | null
  result: AddResult | null

  setAuth: (a: AuthState) => void
  setProvider: (p: ProviderType) => void
  addItems: (items: MatchItem[]) => void
  addAlbumRows: (rows: AlbumRow[]) => void
  removeItem: (id: string) => void
  removeItems: (ids: string[]) => void
  removeAlbumTrack: (albumRowId: string, songId: string) => void
  setAlbumSelection: (albumRowId: string, album: AlbumCandidate, tracks: SongCandidate[]) => void
  updateItemSelection: (id: string, selected: SongCandidate) => void
  confirmItem: (id: string) => void
  replaceItemCandidates: (id: string, candidates: SongCandidate[]) => void
  clearItems: () => void

  setStatusFilter: (f: StatusFilter) => void
  setKeyword: (k: string) => void
  openModal: (m: ModalKind) => void
  closeModal: () => void
  setProgress: (p: TaskProgress | null) => void
  setResult: (r: AddResult | null) => void
}

export const useStore = create<AppState>((set) => ({
  auth: { loggedIn: false },
  provider: 'community',
  items: [],
  statusFilter: 'all',
  keyword: '',
  activeModal: null,
  progress: null,
  result: null,

  setAuth: (auth) => set({ auth }),
  setProvider: (provider) => set({ provider }),
  addItems: (newItems) =>
    set((s) => {
      // 合并时按 songId 去重（PRD F2），已展开的专辑曲目也计入去重集
      const existingSongIds = collectSongIds(s.items)
      const merged = [...s.items]
      for (const it of newItems) {
        const sid = it.selected?.songId
        if (sid && existingSongIds.has(sid)) continue
        if (sid) existingSongIds.add(sid)
        merged.push(it)
      }
      return { items: merged }
    }),
  addAlbumRows: (rows) => set((s) => ({ items: [...s.items, ...rows] })),
  removeItem: (id) => set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
  removeItems: (ids) =>
    set((s) => {
      const set2 = new Set(ids)
      return { items: s.items.filter((it) => !set2.has(it.id)) }
    }),
  removeAlbumTrack: (albumRowId, songId) =>
    set((s) => ({
      items: s.items.map((it) =>
        isAlbumRow(it) && it.id === albumRowId
          ? { ...it, tracks: it.tracks.filter((t) => t.songId !== songId) }
          : it
      )
    })),
  setAlbumSelection: (albumRowId, album, tracks) =>
    set((s) => ({
      items: s.items.map((it) =>
        isAlbumRow(it) && it.id === albumRowId
          ? { ...it, selectedAlbum: album, tracks, status: 'auto' as MatchStatus }
          : it
      )
    })),
  updateItemSelection: (id, selected) =>
    set((s) => ({
      items: s.items.map((it) =>
        !isAlbumRow(it) && it.id === id
          ? { ...it, selected, status: 'auto' as MatchStatus }
          : it
      )
    })),
  // 用户打开下拉框确认后（关闭即视为确认）：need_confirm → auto，不改变选中项
  confirmItem: (id) =>
    set((s) => ({
      items: s.items.map((it) => {
        if (it.id !== id || it.status !== 'need_confirm') return it
        if (isAlbumRow(it)) {
          return it.selectedAlbum ? { ...it, status: 'auto' as MatchStatus } : it
        }
        return it.selected ? { ...it, status: 'auto' as MatchStatus } : it
      })
    })),
  replaceItemCandidates: (id, candidates) =>
    set((s) => ({
      items: s.items.map((it) =>
        !isAlbumRow(it) && it.id === id
          ? {
              ...it,
              candidates,
              selected: candidates[0],
              status: candidates.length
                ? ('need_confirm' as MatchStatus)
                : ('unmatched' as MatchStatus)
            }
          : it
      )
    })),
  clearItems: () => set({ items: [] }),

  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setKeyword: (keyword) => set({ keyword }),
  openModal: (activeModal) => set({ activeModal }),
  closeModal: () => set({ activeModal: null }),
  setProgress: (progress) => set({ progress }),
  setResult: (result) => set({ result })
}))

// 收集所有已选 songId（含专辑展开曲目），用于跨来源去重
function collectSongIds(rows: ListRow[]): Set<string> {
  const ids = new Set<string>()
  for (const r of rows) {
    if (isAlbumRow(r)) {
      for (const t of r.tracks) ids.add(t.songId)
    } else if (r.selected?.songId) {
      ids.add(r.selected.songId)
    }
  }
  return ids
}

// 派生：应用筛选（状态 + 关键词），单曲行与专辑行统一生效
export function selectFilteredItems(s: AppState): ListRow[] {
  const kw = s.keyword.trim().toLowerCase()
  return s.items.filter((it) => {
    if (s.statusFilter !== 'all' && it.status !== s.statusFilter) return false
    if (kw) {
      const hay = isAlbumRow(it)
        ? `${it.rawInput} ${it.selectedAlbum?.name ?? ''} ${
            it.selectedAlbum?.artists.join(' ') ?? ''
          }`.toLowerCase()
        : `${it.rawInput} ${it.selected?.name ?? ''} ${
            it.selected?.artists.join(' ') ?? ''
          }`.toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })
}

export function selectStats(items: ListRow[]): {
  total: number
  auto: number
  need_confirm: number
  unmatched: number
} {
  return {
    total: items.length,
    auto: items.filter((i) => i.status === 'auto').length,
    need_confirm: items.filter((i) => i.status === 'need_confirm').length,
    unmatched: items.filter((i) => i.status === 'unmatched').length
  }
}

// 展平为可添加的去重 songId 列表：单曲取选中项，专辑取全部曲目
export function selectAddableSongIds(items: ListRow[]): string[] {
  const ids = new Set<string>()
  for (const it of items) {
    if (isAlbumRow(it)) {
      for (const t of it.tracks) ids.add(t.songId)
    } else if (it.status !== 'unmatched' && it.selected) {
      ids.add(it.selected.songId)
    }
  }
  return Array.from(ids)
}

// 前后端共享数据模型 —— 对应 TECH_DESIGN §4

export type MatchStatus = 'auto' | 'need_confirm' | 'unmatched'
export type EntryMode = 'song' | 'album'
export type ProviderType = 'official' | 'community'

export interface AuthState {
  loggedIn: boolean
  userId?: string
  nickname?: string
  avatarUrl?: string
}

export interface LoginPayload {
  // 社区方案：Cookie 登录态
  cookie?: string
  // 官方方案预留
  appKey?: string
  appSecret?: string
}

// 二维码登录
export interface QrCode {
  key: string // unikey
  qrimg: string // base64 data URL，可直接渲染
  url: string // 二维码内含的登录 URL
}

export type QrStatus = 'waiting' | 'scanned' | 'confirmed' | 'expired'

export interface QrCheckResult {
  status: QrStatus
  // confirmed 时返回登录态
  auth?: AuthState
  nickname?: string
  message?: string
}

export interface SongCandidate {
  songId: string
  name: string
  artists: string[]
  album: string
  durationMs: number
}

export interface AlbumCandidate {
  albumId: string
  name: string
  artists: string[]
  publishYear?: number
  trackCount: number
  coverUrl?: string
}

// 主页面列表的一行（单曲行）
export interface MatchItem {
  id: string // 本地行 ID
  kind?: 'song' // 行类型，缺省视为单曲行
  rawInput: string // 用户原始输入文本
  mode: EntryMode
  sourceTag?: string // 「来自专辑：XXX」，单曲为空
  candidates: SongCandidate[] // 搜索候选
  selected?: SongCandidate // 当前选中
  status: MatchStatus
}

// 主页面列表的一行（专辑行）—— 可展开为多首曲目
export interface AlbumRow {
  id: string // 本地行 ID
  kind: 'album'
  rawInput: string // 用户录入的专辑名
  albumCandidates: AlbumCandidate[] // 搜索到的专辑候选
  selectedAlbum?: AlbumCandidate // 当前选中的专辑
  tracks: SongCandidate[] // 选中专辑展开后的曲目
  status: MatchStatus // auto=已选定专辑, need_confirm=多候选待确认, unmatched=无候选
}

// 主列表行：单曲行或专辑行
export type ListRow = MatchItem | AlbumRow

export function isAlbumRow(row: ListRow): row is AlbumRow {
  return (row as AlbumRow).kind === 'album'
}

export interface Playlist {
  id: string
  name: string
  coverUrl?: string
  trackCount: number
  writable: boolean
}

export interface AddResult {
  succeeded: string[] // songId
  failed: { songId: string; reason: string }[]
  skipped: string[] // 已存在
}

export interface ProviderCapabilities {
  maxTracksPerAdd: number
  qps: number
  supportsCreatePlaylist: boolean
}

// 录入解析
export interface ParsedEntry {
  rawInput: string
  title?: string
  artist?: string
  album?: string
}

// 任务进度事件
export interface TaskProgress {
  phase: 'dedupe' | 'adding' | 'done' | 'error' | 'cancelled'
  total: number
  succeeded: number
  failed: number
  skipped: number
  message?: string
}

export interface StartTaskPayload {
  playlistId: string
  songIds: string[]
}

// IPC 暴露给渲染层的接口签名
export interface RendererApi {
  auth: {
    getState: () => Promise<AuthState>
    login: (payload: LoginPayload) => Promise<AuthState>
    logout: () => Promise<void>
    qrCreate: () => Promise<QrCode>
    qrCheck: (key: string) => Promise<QrCheckResult>
    loginByWindow: () => Promise<AuthState>
  }
  import: {
    parseFile: (content: string, fileName: string, mode: EntryMode) => Promise<ParsedEntry[]>
    parseText: (text: string, mode: EntryMode) => Promise<ParsedEntry[]>
    searchAlbums: (keyword: string) => Promise<AlbumCandidate[]>
    expandAlbum: (albumId: string, albumName: string) => Promise<MatchItem[]>
    buildAlbumRows: (names: string[]) => Promise<AlbumRow[]>
    getAlbumTracks: (albumId: string) => Promise<SongCandidate[]>
  }
  match: {
    searchOne: (entry: ParsedEntry) => Promise<MatchItem>
    searchBatch: (entries: ParsedEntry[]) => Promise<MatchItem[]>
    reSearch: (itemId: string, keyword: string) => Promise<SongCandidate[]>
  }
  playlist: {
    listMine: () => Promise<Playlist[]>
    create: (name: string) => Promise<Playlist>
  }
  task: {
    start: (payload: StartTaskPayload) => Promise<AddResult>
    cancel: () => Promise<void>
    onProgress: (cb: (p: TaskProgress) => void) => () => void
  }
  report: {
    exportCsv: (rows: Record<string, string>[]) => Promise<{ saved: boolean; path?: string }>
  }
  config: {
    getProvider: () => Promise<ProviderType>
    setProvider: (t: ProviderType) => Promise<void>
    capabilities: () => Promise<ProviderCapabilities>
  }
}

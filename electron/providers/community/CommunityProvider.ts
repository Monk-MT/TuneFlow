// 方案 B：社区接口实现（weapi 直连 music.163.com）—— TECH_DESIGN §3.2
import type {
  AuthState,
  LoginPayload,
  SongCandidate,
  AlbumCandidate,
  Playlist,
  AddResult,
  ProviderCapabilities,
  QrCode,
  QrCheckResult
} from '@shared/types'
import type { MusicProvider } from '../MusicProvider'
import { HttpClient, HttpError } from '../../infra/httpClient'
import { loadCookie, saveCookie, clearCookie } from '../../infra/store'
import { logger } from '../../infra/logger'
import QRCode from 'qrcode'

const BASE = 'https://music.163.com'

interface NeteaseSong {
  id: number
  name: string
  ar?: { name: string }[]
  artists?: { name: string }[]
  al?: { name: string }
  album?: { name: string }
  dt?: number
  duration?: number
}

interface SearchSongResult {
  result?: { songs?: NeteaseSong[] }
  code: number
}

export class CommunityProvider implements MusicProvider {
  private http: HttpClient
  private auth: AuthState = { loggedIn: false }

  constructor() {
    this.http = new HttpClient({ baseUrl: BASE })
    const saved = loadCookie()
    if (saved) this.http.setCookie(saved)
  }

  capabilities(): ProviderCapabilities {
    return { maxTracksPerAdd: 200, qps: 3, supportsCreatePlaylist: true }
  }

  async getAuthState(): Promise<AuthState> {
    if (!this.http.getCookie()) {
      this.auth = { loggedIn: false }
      return this.auth
    }
    try {
      const res = await this.http.weapi<{
        code: number
        profile?: { userId: number; nickname: string; avatarUrl: string }
        account?: { id: number }
      }>('/weapi/w/nuser/account/get', {})
      if (res.profile) {
        this.auth = {
          loggedIn: true,
          userId: String(res.profile.userId),
          nickname: res.profile.nickname,
          avatarUrl: res.profile.avatarUrl
        }
      } else {
        this.auth = { loggedIn: false }
      }
    } catch (e) {
      logger.warn('getAuthState failed', { err: String(e) })
      this.auth = { loggedIn: false }
    }
    return this.auth
  }

  async login(payload: LoginPayload): Promise<AuthState> {
    if (!payload.cookie) {
      throw new Error('社区方案需要提供登录 Cookie（MUSIC_U）')
    }
    this.http.setCookie(payload.cookie)
    saveCookie(payload.cookie)
    return this.getAuthState()
  }

  async logout(): Promise<void> {
    this.http.setCookie('')
    clearCookie()
    this.auth = { loggedIn: false }
  }

  // 1) 取 unikey 并生成二维码图片（base64）
  async qrCreate(): Promise<QrCode> {
    const keyRes = await this.http.weapi<{ code: number; unikey?: string; data?: { unikey: string } }>(
      '/weapi/login/qrcode/unikey',
      { type: 1 }
    )
    const key = keyRes.unikey ?? keyRes.data?.unikey
    if (!key) throw new Error('获取二维码 key 失败')
    const url = `https://music.163.com/login?codekey=${key}`
    const qrimg = await QRCode.toDataURL(url, { width: 220, margin: 1 })
    return { key, qrimg, url }
  }

  // 2) 轮询扫码状态；800 过期 / 801 等待 / 802 已扫待确认 / 803 成功(带 Cookie)
  async qrCheck(key: string): Promise<QrCheckResult> {
    const res = await this.http.weapi<{ code: number; nickname?: string; message?: string }>(
      '/weapi/login/qrcode/client/login',
      { key, type: 1 }
    )
    logger.info('qrCheck', { code: res.code, hasCred: !!this.http.getCookie(), credLen: this.http.getCookie().length })
    switch (res.code) {
      case 800:
        return { status: 'expired', message: '二维码已过期，请刷新' }
      case 801:
        return { status: 'waiting' }
      case 802:
        return { status: 'scanned', nickname: res.nickname, message: '已扫描，请在手机上确认' }
      case 803: {
        // 登录成功：HttpClient 已合并 set-cookie，持久化并拉取账号信息
        saveCookie(this.http.getCookie())
        const auth = await this.getAuthState()
        logger.info('qrCheck confirmed', { loggedIn: auth.loggedIn, hasUser: !!auth.userId })
        return { status: 'confirmed', auth }
      }
      default:
        // 8821 等为网易云风控拦截：手机虽提示成功，服务端仍拒绝下发登录态
        logger.warn('qrCheck risk-control', { code: res.code })
        return {
          status: 'expired',
          message: `扫码登录被网易云风控拦截（code ${res.code}），请改用「Cookie 登录」`
        }
    }
  }

  async searchSongs(keyword: string, limit: number): Promise<SongCandidate[]> {
    const res = await this.http.weapi<SearchSongResult>('/weapi/search/get', {
      s: keyword,
      type: 1,
      limit,
      offset: 0
    })
    const songs = res.result?.songs ?? []
    return songs.map((s) => this.mapSong(s))
  }

  async searchAlbums(keyword: string, limit: number): Promise<AlbumCandidate[]> {
    const res = await this.http.weapi<{
      result?: {
        albums?: {
          id: number
          name: string
          artists?: { name: string }[]
          publishTime?: number
          size?: number
          picUrl?: string
        }[]
      }
    }>('/weapi/search/get', { s: keyword, type: 10, limit, offset: 0 })
    const albums = res.result?.albums ?? []
    return albums.map((a) => ({
      albumId: String(a.id),
      name: a.name,
      artists: (a.artists ?? []).map((ar) => ar.name),
      publishYear: a.publishTime ? new Date(a.publishTime).getFullYear() : undefined,
      trackCount: a.size ?? 0,
      coverUrl: a.picUrl
    }))
  }

  async getAlbumTracks(albumId: string): Promise<SongCandidate[]> {
    const res = await this.http.weapi<{ songs?: NeteaseSong[] }>(`/weapi/v1/album/${albumId}`, {})
    return (res.songs ?? []).map((s) => this.mapSong(s))
  }

  async getMyPlaylists(): Promise<Playlist[]> {
    if (!this.auth.userId) await this.getAuthState()
    if (!this.auth.userId) throw new Error('未登录')
    const res = await this.http.weapi<{
      playlist?: {
        id: number
        name: string
        coverImgUrl?: string
        trackCount: number
        userId: number
      }[]
    }>('/weapi/user/playlist', { uid: this.auth.userId, limit: 1000, offset: 0 })
    const mine = (res.playlist ?? []).filter((p) => String(p.userId) === this.auth.userId)
    return mine.map((p) => ({
      id: String(p.id),
      name: p.name,
      coverUrl: p.coverImgUrl,
      trackCount: p.trackCount,
      writable: true
    }))
  }

  async createPlaylist(name: string): Promise<Playlist> {
    const res = await this.http.weapi<{
      code: number
      id?: number
      playlist?: { id: number; name: string }
    }>('/weapi/playlist/create', { name, privacy: 0, type: 'NORMAL' })
    const id = res.playlist?.id ?? res.id
    if (!id) throw new Error('新建歌单失败')
    return { id: String(id), name, trackCount: 0, writable: true }
  }

  async getPlaylistTrackIds(playlistId: string): Promise<string[]> {
    const res = await this.http.weapi<{
      playlist?: { trackIds?: { id: number }[] }
    }>('/weapi/v6/playlist/detail', { id: playlistId, n: 100000, s: 0 })
    return (res.playlist?.trackIds ?? []).map((t) => String(t.id))
  }

  async addTracksToPlaylist(playlistId: string, songIds: string[]): Promise<AddResult> {
    if (songIds.length === 0) return { succeeded: [], failed: [], skipped: [] }
    try {
      const res = await this.http.weapi<{ code: number; message?: string }>(
        '/weapi/playlist/manipulate/tracks',
        {
          op: 'add',
          pid: playlistId,
          trackIds: JSON.stringify(songIds.map((id) => Number(id)))
        }
      )
      if (res.code === 200) {
        return { succeeded: [...songIds], failed: [], skipped: [] }
      }
      // code 502: 歌曲已存在
      if (res.code === 502) {
        return { succeeded: [], failed: [], skipped: [...songIds] }
      }
      return {
        succeeded: [],
        failed: songIds.map((id) => ({ songId: id, reason: res.message ?? `code ${res.code}` })),
        skipped: []
      }
    } catch (e) {
      const reason = e instanceof HttpError ? `HTTP ${e.status}` : String(e)
      // 抛出以便上层重试逻辑判断可重试性
      throw new ProviderError(reason, e instanceof HttpError && e.retryable)
    }
  }

  private mapSong(s: NeteaseSong): SongCandidate {
    return {
      songId: String(s.id),
      name: s.name,
      artists: (s.ar ?? s.artists ?? []).map((a) => a.name),
      album: (s.al ?? s.album)?.name ?? '',
      durationMs: s.dt ?? s.duration ?? 0
    }
  }
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public retryable: boolean
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

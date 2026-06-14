// 方案 A：官方开放平台 —— TECH_DESIGN §3.2
// ⚠️ 「写入歌单」能力为 PRD §9 最高优先级待确认项，M0 未解除前以下方法抛出未实现。
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

const NOT_CONFIRMED = '官方开放平台写歌单能力待 M0 实测确认，请暂时切换到社区方案（community）'

export class OfficialProvider implements MusicProvider {
  capabilities(): ProviderCapabilities {
    return { maxTracksPerAdd: 100, qps: 5, supportsCreatePlaylist: false }
  }

  async getAuthState(): Promise<AuthState> {
    return { loggedIn: false }
  }

  async login(_payload: LoginPayload): Promise<AuthState> {
    throw new Error(NOT_CONFIRMED)
  }

  async logout(): Promise<void> {
    /* no-op */
  }

  async qrCreate(): Promise<QrCode> {
    throw new Error(NOT_CONFIRMED)
  }

  async qrCheck(_key: string): Promise<QrCheckResult> {
    throw new Error(NOT_CONFIRMED)
  }

  async searchSongs(_keyword: string, _limit: number): Promise<SongCandidate[]> {
    throw new Error(NOT_CONFIRMED)
  }

  async searchAlbums(_keyword: string, _limit: number): Promise<AlbumCandidate[]> {
    throw new Error(NOT_CONFIRMED)
  }

  async getAlbumTracks(_albumId: string): Promise<SongCandidate[]> {
    throw new Error(NOT_CONFIRMED)
  }

  async getMyPlaylists(): Promise<Playlist[]> {
    throw new Error(NOT_CONFIRMED)
  }

  async createPlaylist(_name: string): Promise<Playlist> {
    throw new Error(NOT_CONFIRMED)
  }

  async getPlaylistTrackIds(_playlistId: string): Promise<string[]> {
    throw new Error(NOT_CONFIRMED)
  }

  async addTracksToPlaylist(_playlistId: string, _songIds: string[]): Promise<AddResult> {
    throw new Error(NOT_CONFIRMED)
  }
}

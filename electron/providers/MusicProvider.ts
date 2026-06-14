// MusicProvider 能力契约 —— TECH_DESIGN §3.1
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

export interface MusicProvider {
  // 鉴权
  getAuthState(): Promise<AuthState>
  login(payload: LoginPayload): Promise<AuthState>
  logout(): Promise<void>
  qrCreate(): Promise<QrCode>
  qrCheck(key: string): Promise<QrCheckResult>

  // 搜索与匹配
  searchSongs(keyword: string, limit: number): Promise<SongCandidate[]>
  searchAlbums(keyword: string, limit: number): Promise<AlbumCandidate[]>
  getAlbumTracks(albumId: string): Promise<SongCandidate[]>

  // 歌单
  getMyPlaylists(): Promise<Playlist[]>
  createPlaylist(name: string): Promise<Playlist>
  getPlaylistTrackIds(playlistId: string): Promise<string[]>
  addTracksToPlaylist(playlistId: string, songIds: string[]): Promise<AddResult>

  capabilities(): ProviderCapabilities
}

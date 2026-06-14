// PlaylistService —— 我的歌单与新建（TECH_DESIGN §6）
import type { Playlist } from '@shared/types'
import type { MusicProvider } from '../providers/MusicProvider'

export class PlaylistService {
  constructor(private provider: MusicProvider) {}

  listMine(): Promise<Playlist[]> {
    return this.provider.getMyPlaylists()
  }

  create(name: string): Promise<Playlist> {
    if (!this.provider.capabilities().supportsCreatePlaylist) {
      throw new Error('当前接口不支持新建歌单')
    }
    return this.provider.createPlaylist(name)
  }
}

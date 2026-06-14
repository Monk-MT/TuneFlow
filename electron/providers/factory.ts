// 工厂：按配置注入 MusicProvider 实现 —— TECH_DESIGN §3.3
import type { ProviderType } from '@shared/types'
import type { MusicProvider } from './MusicProvider'
import { CommunityProvider } from './community/CommunityProvider'
import { OfficialProvider } from './official/OfficialProvider'

let current: MusicProvider | null = null
let currentType: ProviderType | null = null

export function createProvider(type: ProviderType): MusicProvider {
  if (current && currentType === type) return current
  current = type === 'official' ? new OfficialProvider() : new CommunityProvider()
  currentType = type
  return current
}

export function resetProvider(): void {
  current = null
  currentType = null
}

// 加密持久化：凭证用 Electron safeStorage 加密后存盘（TECH_DESIGN §8）
import Store from 'electron-store'
import { app, safeStorage } from 'electron'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdirSync } from 'fs'
import type { ProviderType } from '@shared/types'

interface StoreSchema {
  providerType: ProviderType
  encryptedCookie?: string // base64 of safeStorage-encrypted cookie
}

function resolveCwd(): string {
  // 优先 userData；若受限不可写，回退到临时目录，保证应用可运行
  const candidates = [
    (): string => app.getPath('userData'),
    (): string => join(tmpdir(), 'wangyi-add-music')
  ]
  for (const get of candidates) {
    try {
      const dir = get()
      mkdirSync(dir, { recursive: true })
      return dir
    } catch {
      /* try next */
    }
  }
  return tmpdir()
}

const storeFactory = (): Store<StoreSchema> =>
  new Store<StoreSchema>({
    name: 'wangyi-add-music',
    cwd: resolveCwd(),
    defaults: { providerType: 'community' }
  })

let _store: Store<StoreSchema> | null = null
function store(): Store<StoreSchema> {
  if (!_store) _store = storeFactory()
  return _store
}

export function getProviderType(): ProviderType {
  return store().get('providerType', 'community')
}

export function setProviderType(t: ProviderType): void {
  store().set('providerType', t)
}

export function saveCookie(cookie: string): void {
  if (!cookie) {
    store().delete('encryptedCookie')
    return
  }
  if (safeStorage.isEncryptionAvailable()) {
    const enc = safeStorage.encryptString(cookie).toString('base64')
    store().set('encryptedCookie', enc)
  } else {
    // 回退：明文（仅在系统不支持加密时），不写日志
    store().set('encryptedCookie', Buffer.from(cookie, 'utf8').toString('base64'))
  }
}

export function loadCookie(): string {
  const enc = store().get('encryptedCookie')
  if (!enc) return ''
  const buf = Buffer.from(enc, 'base64')
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(buf)
    }
  } catch {
    // 解密失败则当作未登录
    return ''
  }
  return buf.toString('utf8')
}

export function clearCookie(): void {
  store().delete('encryptedCookie')
}

// preload —— 经 contextBridge 暴露白名单 IPC（TECH_DESIGN §7.2 / §8）
import { contextBridge, ipcRenderer } from 'electron'
import type {
  LoginPayload,
  EntryMode,
  ParsedEntry,
  ProviderType,
  StartTaskPayload,
  TaskProgress
} from '@shared/types'

const api = {
  auth: {
    getState: () => ipcRenderer.invoke('auth:getState'),
    login: (payload: LoginPayload) => ipcRenderer.invoke('auth:login', payload),
    logout: () => ipcRenderer.invoke('auth:logout'),
    qrCreate: () => ipcRenderer.invoke('auth:qrCreate'),
    qrCheck: (key: string) => ipcRenderer.invoke('auth:qrCheck', key),
    loginByWindow: () => ipcRenderer.invoke('auth:loginByWindow')
  },
  import: {
    parseFile: (content: string, fileName: string, mode: EntryMode) =>
      ipcRenderer.invoke('import:parseFile', content, fileName, mode),
    parseText: (text: string, mode: EntryMode) =>
      ipcRenderer.invoke('import:parseText', text, mode),
    searchAlbums: (keyword: string) => ipcRenderer.invoke('import:searchAlbums', keyword),
    expandAlbum: (albumId: string, albumName: string) =>
      ipcRenderer.invoke('import:expandAlbum', albumId, albumName),
    buildAlbumRows: (names: string[]) => ipcRenderer.invoke('import:buildAlbumRows', names),
    getAlbumTracks: (albumId: string) => ipcRenderer.invoke('import:getAlbumTracks', albumId)
  },
  match: {
    searchOne: (entry: ParsedEntry) => ipcRenderer.invoke('match:searchOne', entry),
    searchBatch: (entries: ParsedEntry[]) => ipcRenderer.invoke('match:searchBatch', entries),
    reSearch: (itemId: string, keyword: string) =>
      ipcRenderer.invoke('match:reSearch', itemId, keyword)
  },
  playlist: {
    listMine: () => ipcRenderer.invoke('playlist:listMine'),
    create: (name: string) => ipcRenderer.invoke('playlist:create', name)
  },
  task: {
    start: (payload: StartTaskPayload) => ipcRenderer.invoke('task:start', payload),
    cancel: () => ipcRenderer.invoke('task:cancel'),
    onProgress: (cb: (p: TaskProgress) => void) => {
      const handler = (_e: unknown, p: TaskProgress): void => cb(p)
      ipcRenderer.on('task:progress', handler)
      return () => ipcRenderer.removeListener('task:progress', handler)
    }
  },
  report: {
    exportCsv: (rows: Record<string, string>[]) => ipcRenderer.invoke('report:exportCsv', rows)
  },
  config: {
    getProvider: () => ipcRenderer.invoke('config:getProvider'),
    setProvider: (t: ProviderType) => ipcRenderer.invoke('config:setProvider', t),
    capabilities: () => ipcRenderer.invoke('config:capabilities')
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api

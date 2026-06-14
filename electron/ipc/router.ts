// IPC 路由层 —— 渲染层经 preload 调用，所有外呼经 Provider（TECH_DESIGN §7.2）
import { ipcMain, BrowserWindow, dialog } from 'electron'
import { writeFileSync } from 'fs'
import Papa from 'papaparse'
import type {
  LoginPayload,
  EntryMode,
  ParsedEntry,
  ProviderType,
  StartTaskPayload
} from '@shared/types'
import { createProvider, resetProvider } from '../providers/factory'
import { ImportService } from '../services/ImportService'
import { MatchService } from '../services/MatchService'
import { PlaylistService } from '../services/PlaylistService'
import { AddTaskService } from '../services/AddTaskService'
import { getProviderType, setProviderType } from '../infra/store'
import { logger } from '../infra/logger'
import { openLoginWindow, clearLoginPartition } from '../auth/loginWindow'
import type { AuthState } from '@shared/types'

function services() {
  const provider = createProvider(getProviderType())
  return {
    provider,
    importSvc: new ImportService(provider),
    matchSvc: new MatchService(provider),
    playlistSvc: new PlaylistService(provider)
  }
}

let addTask: AddTaskService | null = null

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  // —— auth ——
  ipcMain.handle('auth:getState', async () => services().provider.getAuthState())
  ipcMain.handle('auth:login', async (_e, payload: LoginPayload) =>
    services().provider.login(payload)
  )
  ipcMain.handle('auth:logout', async () => {
    await clearLoginPartition()
    return services().provider.logout()
  })
  ipcMain.handle('auth:qrCreate', async () => services().provider.qrCreate())
  ipcMain.handle('auth:qrCheck', async (_e, key: string) => services().provider.qrCheck(key))
  // 方案一：内嵌官方登录页扫码，成功后提取 Cookie 注入 provider
  ipcMain.handle('auth:loginByWindow', async (): Promise<AuthState> => {
    const { cookie, cancelled } = await openLoginWindow(getWindow())
    if (cancelled || !cookie) return { loggedIn: false }
    return services().provider.login({ cookie })
  })

  // —— import ——
  ipcMain.handle(
    'import:parseFile',
    async (_e, content: string, fileName: string, mode: EntryMode) =>
      services().importSvc.parseFile(content, fileName, mode)
  )
  ipcMain.handle('import:parseText', async (_e, text: string, mode: EntryMode) =>
    services().importSvc.parseText(text, mode)
  )
  ipcMain.handle('import:searchAlbums', async (_e, keyword: string) =>
    services().importSvc.searchAlbums(keyword)
  )
  ipcMain.handle('import:expandAlbum', async (_e, albumId: string, albumName: string) =>
    services().importSvc.expandAlbum(albumId, albumName)
  )
  ipcMain.handle('import:buildAlbumRows', async (_e, names: string[]) =>
    services().importSvc.buildAlbumRows(names)
  )
  ipcMain.handle('import:getAlbumTracks', async (_e, albumId: string) =>
    services().importSvc.getAlbumTracks(albumId)
  )

  // —— match ——
  ipcMain.handle('match:searchOne', async (_e, entry: ParsedEntry) =>
    services().matchSvc.searchOne(entry)
  )
  ipcMain.handle('match:searchBatch', async (_e, entries: ParsedEntry[]) =>
    services().matchSvc.searchBatch(entries)
  )
  ipcMain.handle('match:reSearch', async (_e, _itemId: string, keyword: string) =>
    services().matchSvc.reSearch(keyword)
  )

  // —— playlist ——
  ipcMain.handle('playlist:listMine', async () => services().playlistSvc.listMine())
  ipcMain.handle('playlist:create', async (_e, name: string) => services().playlistSvc.create(name))

  // —— task ——
  ipcMain.handle('task:start', async (_e, payload: StartTaskPayload) => {
    const { provider } = services()
    addTask = new AddTaskService(provider)
    const win = getWindow()
    return addTask.start(payload, (p) => {
      win?.webContents.send('task:progress', p)
    })
  })
  ipcMain.handle('task:cancel', async () => {
    addTask?.cancel()
  })

  // —— report ——
  ipcMain.handle('report:exportCsv', async (_e, rows: Record<string, string>[]) => {
    const win = getWindow()
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      title: '导出清单',
      defaultPath: `wangyi-report-${Date.now()}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (canceled || !filePath) return { saved: false }
    const csv = Papa.unparse(rows)
    writeFileSync(filePath, '\uFEFF' + csv, 'utf8')
    return { saved: true, path: filePath }
  })

  // —— config ——
  ipcMain.handle('config:getProvider', async () => getProviderType())
  ipcMain.handle('config:setProvider', async (_e, t: ProviderType) => {
    setProviderType(t)
    resetProvider()
    logger.info('provider switched', { provider: t })
  })
  ipcMain.handle('config:capabilities', async () => services().provider.capabilities())
}

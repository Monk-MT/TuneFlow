// 主进程入口 —— 窗口、安全配置、IPC 注册（TECH_DESIGN §8 / §9）
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { registerIpc } from './ipc/router'

let mainWindow: BrowserWindow | null = null

const appIcon = app.isPackaged
  ? join(process.resourcesPath, 'resources/icon.png')
  : join(__dirname, '../../resources/icon.png')

// 显式设置应用名与数据目录，避免回落到 Chromium 默认目录
app.setName('wangyi-add-music')
app.setPath('userData', join(app.getPath('appData'), 'wangyi-add-music'))
// 部分受限环境无法初始化 Chromium 沙箱，显式关闭以保证可运行
app.commandLine.appendSwitch('no-sandbox')
app.disableHardwareAcceleration()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: '网易云音乐批量加歌工具',
    icon: appIcon,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(appIcon)
  }
  registerIpc(() => mainWindow)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

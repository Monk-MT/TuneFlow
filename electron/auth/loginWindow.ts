// 方案一：内嵌网易云官方登录页扫码，登录成功后从 session 中提取 Cookie
// 真实浏览器导航（真实 TLS/请求头/JS 运行时），规避 weapi 网页模拟登录风控
import { BrowserWindow, session as electronSession } from 'electron'
import { logger } from '../infra/logger'

const LOGIN_URL = 'https://music.163.com/login'
const COOKIE_URL = 'https://music.163.com'
const PARTITION = 'persist:netease-login'
const TIMEOUT_MS = 5 * 60 * 1000
const POLL_MS = 1200

export interface LoginWindowResult {
  cookie: string
  cancelled?: boolean
}

async function readCookieString(): Promise<string> {
  const ses = electronSession.fromPartition(PARTITION)
  const cookies = await ses.cookies.get({ url: COOKIE_URL })
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ')
}

// 打开登录窗口；检测到 MUSIC_U 即视为登录成功
export function openLoginWindow(parent: BrowserWindow | null): Promise<LoginWindowResult> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 400,
      height: 520,
      parent: parent ?? undefined,
      modal: false,
      title: '扫码登录网易云音乐',
      autoHideMenuBar: true,
      webPreferences: {
        partition: PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })

    let done = false
    let timer: ReturnType<typeof setInterval> | null = null
    let timeout: ReturnType<typeof setTimeout> | null = null

    const cleanup = (): void => {
      if (timer) clearInterval(timer)
      if (timeout) clearTimeout(timeout)
      timer = null
      timeout = null
    }

    const finish = async (cancelled: boolean): Promise<void> => {
      if (done) return
      done = true
      cleanup()
      const cookie = cancelled ? '' : await readCookieString()
      if (!win.isDestroyed()) win.close()
      resolve({ cookie, cancelled })
    }

    win.on('closed', () => {
      // 用户手动关闭窗口
      if (!done) {
        done = true
        cleanup()
        resolve({ cookie: '', cancelled: true })
      }
    })

    timer = setInterval(async () => {
      try {
        const cookie = await readCookieString()
        if (/(^|;\s*)MUSIC_U=/.test(cookie)) {
          logger.info('login window: MUSIC_U detected')
          void finish(false)
        }
      } catch (e) {
        logger.warn('login window poll failed', { err: String(e) })
      }
    }, POLL_MS)

    timeout = setTimeout(() => {
      logger.warn('login window timeout')
      void finish(true)
    }, TIMEOUT_MS)

    void win.loadURL(LOGIN_URL)
  })
}

// 清空登录分区的 Cookie（登出时调用）
export async function clearLoginPartition(): Promise<void> {
  const ses = electronSession.fromPartition(PARTITION)
  await ses.clearStorageData()
}

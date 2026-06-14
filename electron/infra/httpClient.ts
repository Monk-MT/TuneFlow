// 基于 Node 内置 fetch 的 HTTP 客户端，负责网易云请求头与 Cookie 注入
import { weapiEncrypt } from './crypto'

export interface HttpClientOptions {
  baseUrl: string
}

export class HttpClient {
  private baseUrl: string
  private cookie = ''

  constructor(opts: HttpClientOptions) {
    this.baseUrl = opts.baseUrl
  }

  setCookie(cookie: string): void {
    this.cookie = cookie
  }

  getCookie(): string {
    return this.cookie
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      Referer: 'https://music.163.com',
      Origin: 'https://music.163.com',
      Cookie: this.cookie
    }
  }

  private mergeCookieFromResponse(res: Response): void {
    // Node fetch 暴露 getSetCookie（undici）
    const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[] }
    const setCookies = anyHeaders.getSetCookie?.() ?? []
    if (setCookies.length === 0) return
    const jar = new Map<string, string>()
    this.parseCookieInto(this.cookie, jar)
    for (const sc of setCookies) {
      const first = sc.split(';')[0]
      const eq = first.indexOf('=')
      if (eq > 0) jar.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim())
    }
    this.cookie = Array.from(jar.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')
  }

  private parseCookieInto(cookie: string, jar: Map<string, string>): void {
    cookie
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((p) => {
        const eq = p.indexOf('=')
        if (eq > 0) jar.set(p.slice(0, eq).trim(), p.slice(eq + 1).trim())
      })
  }

  // weapi 加密 POST
  async weapi<T>(path: string, data: Record<string, unknown>): Promise<T> {
    const csrf = this.extractCsrf()
    const payload = weapiEncrypt({ ...data, csrf_token: csrf })
    const body = new URLSearchParams({
      params: payload.params,
      encSecKey: payload.encSecKey
    }).toString()
    const url = `${this.baseUrl}${path}${path.includes('?') ? '&' : '?'}csrf_token=${csrf}`
    const res = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body
    })
    this.mergeCookieFromResponse(res)
    if (!res.ok) {
      throw new HttpError(res.status, `HTTP ${res.status} for ${path}`)
    }
    return (await res.json()) as T
  }

  private extractCsrf(): string {
    const jar = new Map<string, string>()
    this.parseCookieInto(this.cookie, jar)
    return jar.get('__csrf') ?? ''
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'HttpError'
  }
  get retryable(): boolean {
    return this.status === 429 || this.status >= 500
  }
}

// 网易云 weapi 加密 —— 使用 Node 内置 crypto，无第三方依赖
import crypto from 'crypto'

const PRESET_KEY = '0CoJUm6Qyw8W8jud'
const IV = '0102030405060708'
const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function aesEncrypt(text: string, key: string): string {
  const cipher = crypto.createCipheriv('aes-128-cbc', key, IV)
  let encrypted = cipher.update(text, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  return encrypted
}

function rsaEncrypt(text: string): string {
  // 网易云使用无填充 RSA，需手动实现：reverse 文本后做模幂
  const reversed = text.split('').reverse().join('')
  const buf = Buffer.from(reversed, 'utf8')
  const n = BigInt(
    '0x00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7'
  )
  const e = BigInt('0x010001')
  const m = BigInt('0x' + buf.toString('hex')) % n
  const result = modPow(m, e, n)
  let hex = result.toString(16)
  hex = hex.padStart(256, '0')
  return hex
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n
  base = base % mod
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod
    exp >>= 1n
    base = (base * base) % mod
  }
  return result
}

function randomString(len: number): string {
  let s = ''
  for (let i = 0; i < len; i++) {
    s += BASE62[Math.floor(Math.random() * BASE62.length)]
  }
  return s
}

export interface WeapiPayload {
  params: string
  encSecKey: string
}

// 对请求体做 weapi 双层加密
export function weapiEncrypt(obj: Record<string, unknown>): WeapiPayload {
  const text = JSON.stringify(obj)
  const secretKey = randomString(16)
  const params = aesEncrypt(aesEncrypt(text, PRESET_KEY), secretKey)
  const encSecKey = rsaEncrypt(secretKey)
  return { params, encSecKey }
}


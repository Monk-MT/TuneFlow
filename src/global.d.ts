// 渲染层访问 window.api 的类型声明
import type { RendererApi } from '@shared/types'

declare global {
  interface Window {
    api: RendererApi
  }
}

export {}

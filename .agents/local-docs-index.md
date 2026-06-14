# 本地文档索引 (Local Docs Index)

> 本文件索引项目内部的「总结/归档」类文档与关键目录，供 Agent 加载上下文时参考。

## 项目核心文档

| 文档 | 路径 | 说明 |
| --- | --- | --- |
| 产品需求文档 | `PRD.md` | 网易云音乐批量加歌工具的完整产品需求，含功能编号 F1-F6、主流程、优先级问题 |
| 技术设计文档 | `TECH_DESIGN.md` | 分层架构设计（Main/Preload/IPC -> Adapters -> Services -> Infra）、Provider 适配方案、登录与写入链路 |
| 图标设计规格 | `ICON_DESIGN.md` | 应用图标设计规格（方向二「多音符汇入歌单」），含配色 Hex、1024 画布构图比例、导出规格 |

## 关键源码目录

| 目录 | 路径 | 说明 |
| --- | --- | --- |
| Electron 主进程 | `electron/main.ts` | 应用入口，窗口创建 |
| 鉴权 | `electron/auth/loginWindow.ts` | 官方 BrowserWindow 登录拦截，提取 MUSIC_U |
| Provider 适配层 | `electron/providers/` | `MusicProvider` 接口、`CommunityProvider`(weapi, 默认)、`OfficialProvider`(stub)、`factory` |
| 服务层 | `electron/services/` | `AddTaskService`(去重/批量/限流/重试)、`MatchService`、`ImportService`、`PlaylistService` |
| 基础设施 | `electron/infra/` | `httpClient`、`crypto`(weapi 加密)、`rateLimiter`、`retry`、`logger`、`store` |
| IPC 路由 | `electron/ipc/router.ts` | 主进程 IPC handler 注册 |
| 前端入口 | `src/App.tsx`、`src/main.tsx` | React 应用 |
| 前端组件 | `src/components/` | `TopBar`、`MatchTable`(虚拟列表)、`StatsFilterBar`、`EmptyState` |
| 弹窗 | `src/modals/` | `AuthModal`、`ImportModal`、`PlaylistPickModal`、`ResultModal` |
| 共享逻辑 | `src/shared/` | `types.ts`、`matching.ts` |
| 状态管理 | `src/store/useStore.ts` | 全局 store |

## 外部本地知识库索引

| 名称 | 路径 | 说明 |
| --- | --- | --- |
| _(待补充)_ | _(待用户提供)_ | 项目外部本地知识库的索引文件路径 |

# wangyiAddMusic — 网易云音乐批量加歌工具

一个 Electron 桌面应用，帮助你**一次性把一批歌曲准确地添加到自己的网易云歌单**。支持文件/文本批量导入、整张专辑导入、搜索匹配与人工消歧、批量写入的限流与重试。

## 功能特性

- **批量添加**：一次提交几十到几百首歌曲（单批次/合并录入上限 500 首）。
- **两种录入模式**：录入前先选「单曲模式」或「专辑模式」；专辑模式下输入专辑名自动展开为整张曲目。
- **导入来源**：支持 `txt`/`csv` 文件导入与文本粘贴（每行「歌名 - 歌手」）。
- **搜索消歧**：关键词搜索后在预览区人工选择正确版本（区分同名、翻唱、伴奏）。
- **预览与筛选**：虚拟列表预览匹配结果，按匹配状态/来源/关键词实时筛选；批量操作仅对当前筛选子集生效。
- **稳定写入**：统一去重（按歌曲 ID）、分批、限流、重试，写入后给出成功/失败/未匹配报告。
- **官方登录**：使用真实 Electron `BrowserWindow` 加载官方登录页扫码，规避风控，自动提取 `MUSIC_U`。

## 技术栈

- **桌面框架**：Electron 31 + electron-vite
- **前端**：React 18 + TypeScript + Ant Design + zustand + rc-virtual-list
- **后端（主进程）**：Node.js，weapi 加密（Node crypto）
- **测试**：Vitest

## 架构概览

分层架构：`Main / Preload / IPC` → `Adapters (Provider)` → `Services` → `Infra`。

```
electron/
├── main.ts                 # 应用入口、窗口创建
├── preload.ts              # 预加载脚本
├── auth/loginWindow.ts     # 官方 BrowserWindow 登录拦截，提取 MUSIC_U
├── ipc/router.ts           # 主进程 IPC handler 注册
├── providers/              # Provider 适配层（屏蔽 A/B 方案差异）
│   ├── MusicProvider.ts    # Provider 接口
│   ├── community/          # CommunityProvider (weapi，默认可用)
│   ├── official/           # OfficialProvider (stub)
│   └── factory.ts          # Provider 工厂，可配置切换
├── services/               # AddTaskService / MatchService / ImportService / PlaylistService
└── infra/                  # httpClient / crypto / rateLimiter / retry / logger / store

src/
├── App.tsx / main.tsx      # React 应用入口
├── components/             # TopBar / MatchTable(虚拟列表) / StatsFilterBar / EmptyState
├── modals/                 # AuthModal / ImportModal / PlaylistPickModal / ResultModal
├── store/useStore.ts       # 全局状态
└── shared/                 # types.ts / matching.ts
```

> Provider 模式：应用逻辑与官方/社区方案解耦。`CommunityProvider`（weapi）为当前默认可用实现，`OfficialProvider` 为 stub。

## 快速开始

环境要求：Node.js 18+、npm。

```bash
# 安装依赖
npm install

# 启动开发环境
npm run dev
```

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发环境（electron-vite dev） |
| `npm run build` | 构建产物 |
| `npm run start` | 预览构建产物 |
| `npm run dist` | 构建并用 electron-builder 打包安装包 |
| `npm run typecheck` | 类型检查（node + web） |
| `npm test` | 运行单元测试（Vitest） |

## 使用流程

1. **登录**：点击「打开官方登录」，在弹出的官方页面扫码完成登录。
2. **录入**：选择单曲或专辑模式，导入文件或粘贴歌曲列表。
3. **匹配与预览**：系统搜索匹配，在预览区人工修正待确认项，可按状态/来源/关键词筛选。
4. **导入**：确认无误后点击导入，选择目标歌单。
5. **查看结果**：批量写入完成后查看成功/失败/未匹配报告。

## 注意事项

- 社区方案（weapi）的歌单写入操作必须携带 `MUSIC_U` cookie，需先完成官方登录。
- 仅支持对**当前授权账号本人**的歌单进行写操作；不做播放、下载、歌单同步、多账号管理。
- macOS 开发环境需要 `no-sandbox` 标志并覆盖 `userData` 路径以保证稳定性。

## 相关文档

- [产品需求文档（PRD.md）](./PRD.md)
- [技术设计文档（TECH_DESIGN.md）](./TECH_DESIGN.md)
- [图标设计规格（ICON_DESIGN.md）](./ICON_DESIGN.md)
- [项目上下文索引（AGENTS.md）](./AGENTS.md)

## License

MIT

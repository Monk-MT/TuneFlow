# 网易云音乐批量加歌工具 — 技术设计文档（TDD）

| 项 | 内容 |
| --- | --- |
| 文档版本 | v0.1（草稿） |
| 创建日期 | 2026-06-14 |
| 关联文档 | PRD.md（v0.1） |
| 产品代号 | wangyiAddMusic |
| 文档状态 | 待评审 |

> 本文档将 PRD 的需求映射为可实现的技术方案。涉及网易云接口的具体参数以 PRD 第 3.3 / 第 9 节「M0 待实测确认项」为准，确认后回填本文 §5 接口契约。

---

## 1. 技术选型

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 桌面壳 | **Electron** | PRD 已定。主进程承载本地后端，渲染进程承载前端 UI |
| 语言 | **TypeScript**（前后端统一） | 类型安全，前后端共享数据模型定义 |
| 前端框架 | **React 18 + Vite** | 生态成熟、组件化；Vite 提供快速开发与构建 |
| UI 组件 | **Ant Design**（或 Arco） | 内置表格、虚拟列表、Modal、上传组件，贴合「列表 + 弹窗」形态 |
| 前端状态 | **Zustand** | 轻量；管理列表、匹配状态、任务进度 |
| 长列表 | **react-window / rc-virtual-list** | 满足 500 行虚拟滚动（PRD §7 性能） |
| 后端运行时 | **Node.js（Electron 主进程内）** | 复用 TS；通过 IPC 暴露能力，不开公网端口 |
| HTTP 客户端 | **undici / axios** | 后端发起对网易云的请求 |
| 本地存储 | **electron-store**（配置/凭证） + 文件（任务报告） | 凭证加密存储（见 §8 安全） |
| CSV 解析/导出 | **papaparse** | 导入解析与失败清单导出 |
| 打包分发 | **electron-builder** | 产出 macOS `.app` / Windows `.exe`；macOS 签名公证 |
| 测试 | **Vitest**（单元）+ **Playwright**（端到端，可选） | 重点覆盖匹配/去重/分批/限流纯逻辑 |

> 说明：以上为按 PRD「Electron + React/Vue + Node」方向取的合理默认值。若团队更熟悉 Vue，可将前端替换为 Vue3 + Element Plus，不影响后端与适配器设计。

---

## 2. 总体架构

```text
┌───────────────────────── Electron 应用 ─────────────────────────┐
│  Renderer（前端 / React）                                       │
│   主页面：搜索与匹配列表                                          │
│   弹窗：① 授权 ② 录入 ③ 选歌单 ④ 结果                            │
│        │  contextBridge 暴露的安全 IPC（preload）               │
│  Main（后端 / Node）                                            │
│   ├─ IPC 路由层（ipcMain.handle）                               │
│   ├─ 应用服务层（与具体接口无关的业务逻辑）                       │
│   │    ImportService / MatchService / PlaylistService          │
│   │    AddTaskService（去重·分批·限流·重试·进度）                │
│   ├─ MusicProvider 适配器接口（能力契约）                        │
│   │    ├─ OfficialProvider（方案 A：开放平台）                  │
│   │    └─ CommunityProvider（方案 B：社区接口，回退）            │
│   ├─ 基础设施：HttpClient / RateLimiter / Retry / Store / Logger │
└─────────────────────────────────────────────────────────────────┘
                              ▼
                       网易云接口（A 或 B）
```

分层原则：

- **Renderer 只做展示与交互**，不直接发网络请求、不接触密钥/凭证。
- **应用服务层只依赖 `MusicProvider` 契约**，不感知 A/B 实现（对应 PRD §3.2 架构决策）。
- **适配器层负责差异收敛**：鉴权方式、字段映射、错误码、限流参数。

---

## 3. 适配器层设计（核心）

### 3.1 能力契约 `MusicProvider`

```typescript
interface MusicProvider {
  // 鉴权
  getAuthState(): Promise<AuthState>;
  login(payload: LoginPayload): Promise<AuthState>;   // A: 签名换 token；B: Cookie 登录
  logout(): Promise<void>;

  // 搜索与匹配
  searchSongs(keyword: string, limit: number): Promise<SongCandidate[]>;
  searchAlbums(keyword: string, limit: number): Promise<AlbumCandidate[]>;
  getAlbumTracks(albumId: string): Promise<SongCandidate[]>;

  // 歌单
  getMyPlaylists(): Promise<Playlist[]>;             // 仅返回可写歌单
  createPlaylist(name: string): Promise<Playlist>;   // P1
  getPlaylistTrackIds(playlistId: string): Promise<string[]>; // 去重用
  addTracksToPlaylist(playlistId: string, songIds: string[]): Promise<AddResult>;

  // 元信息：单次写入上限、限流参数等，供服务层读取
  capabilities(): ProviderCapabilities;
}

interface ProviderCapabilities {
  maxTracksPerAdd: number;   // 单次写入上限（A/B 不同，M0 实测）
  qps: number;               // 限流基准
  supportsCreatePlaylist: boolean;
}
```

### 3.2 两个实现

- **OfficialProvider（方案 A，默认）**：RSA 2048/PKCS8 签名 + `access_token`；字段映射到内部模型；`addTracksToPlaylist` 待 M0 确认是否可用。
- **CommunityProvider（方案 B，回退）**：Cookie 登录态；`/search`、`/album`、`/user/playlist`、`/playlist/create`、`/playlist/tracks?op=add`；多歌曲 ID 逗号分隔。

### 3.3 选择与切换

```typescript
// 配置驱动，默认 official，可在设置或环境变量切换
const provider = createProvider(config.providerType); // 'official' | 'community'
```

服务层通过工厂注入 `MusicProvider`，切换实现不改动上层代码。

---

## 4. 数据模型（前后端共享）

```typescript
type MatchStatus = 'auto' | 'need_confirm' | 'unmatched';
type EntryMode = 'song' | 'album';

interface SongCandidate {
  songId: string;
  name: string;
  artists: string[];
  album: string;
  durationMs: number;
}

interface AlbumCandidate {
  albumId: string;
  name: string;
  artists: string[];
  publishYear?: number;
  trackCount: number;
  coverUrl?: string;
}

// 主页面列表的一行
interface MatchItem {
  id: string;                  // 本地行 ID
  rawInput: string;            // 用户原始输入文本
  mode: EntryMode;
  sourceTag?: string;          // 「来自专辑：XXX」，单曲为空
  candidates: SongCandidate[]; // 搜索候选
  selected?: SongCandidate;    // 当前选中
  status: MatchStatus;
}

interface Playlist {
  id: string;
  name: string;
  coverUrl?: string;
  trackCount: number;
  writable: boolean;
}

interface AddResult {
  succeeded: string[];   // songId
  failed: { songId: string; reason: string }[];
  skipped: string[];     // 已存在
}
```

---

## 5. 接口契约映射（待 M0 回填）

| 内部能力 | 方案 A（官方，待确认） | 方案 B（社区） |
| --- | --- | --- |
| 搜索歌曲 | 搜索接口 `type=song` | `/search?type=1` |
| 搜索专辑 | 搜索接口 `type=album` | `/search?type=10` |
| 获取专辑曲目 | 专辑详情接口 | `/album?id=` |
| 我的歌单 | 用户歌单接口 | `/user/playlist?uid=` |
| 新建歌单 | ⚠️ 待确认 | `/playlist/create?name=` |
| 歌单已有曲目 | 歌单详情接口 | `/playlist/detail?id=` |
| **写入歌曲** | ⚠️ **最高优先级待确认** | `/playlist/tracks?op=add&pid=&tracks=` |

> ⚠️ 标注项为 PRD §9 未解除的风险点。M0 阶段须实测确认方案 A 的写能力与参数，否则切换到方案 B。

---

## 6. 核心模块与算法

### 6.1 ImportService（录入与专辑展开）

- 解析 `txt`/`csv` → 规范化（去空行、trim、去重复行）。
- 单曲模式：拆 `歌名 - 歌手`。
- 专辑模式：每条 `searchAlbums` → 多候选时回传前端消歧 → `getAlbumTracks` 展开为多个 `MatchItem`（`status='auto'`，带 `sourceTag`）。
- 数量校验：专辑按展开后曲目计入上限（默认 500），超限提示。

### 6.2 MatchService（搜索与自动匹配）

打分规则（输入含歌手时）：

```text
score = w1 * 歌名相似度 + w2 * 歌手相似度 (- 时长偏差惩罚)
相似度用归一化后的字符串比较（小写、去空格/标点）
```

- 歌名与歌手均高吻合（超阈值）→ `auto`，`selected` = Top1。
- 仅歌名 / 多个相近候选 → `need_confirm`。
- 无候选 → `unmatched`。
- 专辑展开的曲目已带准确 `songId`，直接 `auto`，跳过搜索。

### 6.3 AddTaskService（批量添加，PRD §4.7 核心）

执行管线：

```text
仅取 status∈{auto, 已确认} 的项
  → 去重：getPlaylistTrackIds(target) 比对，已存在→skipped
  → 分批：按 capabilities.maxTracksPerAdd 切片
  → 限流：RateLimiter 按 qps 控制节奏
  → 写入：addTracksToPlaylist(batch)
  → 重试：失败项指数退避（base * 2^n，上限可配）
  → 进度：每批回报 succeeded/failed/skipped，可取消（AbortSignal）
```

- **RateLimiter**：令牌桶或最小间隔队列，参数取自 `capabilities.qps`。
- **Retry**：仅对可重试错误（限流、网络）退避重试；鉴权失效则中断并提示重新授权。
- **幂等**：已成功的 songId 不重复提交（中断续跑时依据进度记录）。

---

## 7. 前端结构与 IPC

### 7.1 页面结构（对应 PRD §5）

```text
App
├─ MainPage（搜索与匹配列表 · 常驻）
│   ├─ TopBar（账号 / 录入歌曲 / 导入到歌单）
│   ├─ StatsFilterBar（统计点击筛选 · 状态/来源筛选 · 列表内查找）
│   └─ MatchTable（虚拟滚动 · 行内修正 · 批量操作）
└─ Modals（同时仅一个，主页面置灰）
    ├─ AuthModal ①        未登录前置
    ├─ ImportModal ②      先选模式→选来源→录入
    ├─ PlaylistPickModal ③ 选目标歌单 / 新建 / 二次确认
    └─ ResultModal ④      进度→结果汇总→导出（执行中不可关闭）
```

### 7.2 IPC 通道（preload 经 contextBridge 暴露）

```typescript
window.api = {
  auth: { getState, login, logout },
  import: { parseFile, parseText, expandAlbum },
  match: { searchOne, searchBatch, reSearch },
  playlist: { listMine, create, picked },
  task: { start, cancel, onProgress },   // onProgress 通过事件推送
  report: { exportCsv },
};
```

- 渲染进程不直连网络；所有外呼经 Main 的 Provider。
- `task.onProgress` 用 `ipcRenderer.on` 接收主进程进度事件，驱动 ResultModal 进度条。

---

## 8. 安全、合规与可观测（对应 PRD §7）

- **凭证安全**：`appKey/appSecret`、Cookie/token 仅存主进程；持久化用 electron-store 加密（safeStorage / OS keychain），不写日志、不下发渲染层。
- **最小权限**：渲染进程开启 `contextIsolation`，关闭 `nodeIntegration`，仅暴露白名单 IPC。
- **合规**：仅写本人歌单；遵守限流；方案 B 在 UI 明示风险并需用户确认。
- **日志**：任务级日志（计数、错误原因）脱敏存本地，便于排查失败。

---

## 9. 工程结构（建议）

```text
wangyiAddMusic/
├─ electron/
│  ├─ main.ts                 # 主进程入口、窗口、IPC 注册
│  ├─ preload.ts              # contextBridge 暴露 window.api
│  ├─ ipc/                    # IPC 路由 → 调用 services
│  ├─ services/               # ImportService / MatchService / AddTaskService / PlaylistService
│  ├─ providers/
│  │  ├─ MusicProvider.ts     # 契约接口
│  │  ├─ official/            # 方案 A
│  │  └─ community/           # 方案 B
│  └─ infra/                  # HttpClient / RateLimiter / retry / store / logger
├─ src/                       # React 前端
│  ├─ pages/MainPage/
│  ├─ modals/                 # Auth / Import / PlaylistPick / Result
│  ├─ store/                  # Zustand
│  └─ shared/types.ts         # 与 electron 共享的数据模型
├─ package.json
└─ electron-builder.yml
```

---

## 10. 落地里程碑（对接 PRD §8）

| 阶段 | 技术交付物 |
| --- | --- |
| M0 接口验证 | 定义 `MusicProvider` 契约；实现 CommunityProvider 跑通「登录→搜一首→写入测试歌单」；同时验证 OfficialProvider 写能力可达性 |
| M1 核心闭环 | ImportService/MatchService/AddTaskService + 主页面与 4 弹窗；F1–F6 打通 |
| M2 体验完善 | 去重/限流/重试稳定性；F7 报告与 CSV 导出；虚拟滚动 |
| M3 增强 | F8 历史任务；新建歌单作目标；CSV 字段映射增强；electron-builder 打包与 macOS 公证 |

---

## 11. 主要技术风险

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 方案 A 写歌单不可用/资质不可达 | 核心功能无法用官方实现 | 适配器已抽象，切 CommunityProvider 回退 |
| 接口限流/风控 | 批量任务失败、封号风险 | RateLimiter + 退避重试；UI 明示并控制节奏 |
| 社区接口随官方更新失效 | 方案 B 不稳定 | 接口集中在 Provider，便于快速修补 |
| macOS 签名公证缺开发者账号 | 无法正常分发 | M3 前确认账号；开发期用 ad-hoc 签名 |
| 同名/翻唱误匹配 | 加错版本 | 打分阈值保守，多候选转「需确认」交人工 |

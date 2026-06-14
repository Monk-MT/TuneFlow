# 项目约束 (Constraints)

> 本文件记录项目开发中必须遵守的约束、规范与要求。

## 硬性约束

1. **写入鉴权**：社区方案（Community / weapi）的歌单写入操作必须携带 `MUSIC_U` cookie，否则无法成功。
2. **登录风控**：禁止使用模拟 `weapi` 二维码轮询登录（易触发风控 `8821`）。必须使用真实 Electron `BrowserWindow` 加载官方登录页，从会话中拦截 `MUSIC_U`。
3. **全局滚动条**：主窗口不得出现全局滚动条。需设置 `body { overflow: hidden }` 及 100% 高度，滚动仅限内部组件（如 `MatchTable` 虚拟列表）。
4. **总量上限**：单批次/合并录入的曲目总量上限为 500 首（含专辑展开后的曲目）。
5. **录入模式单一性**：录入前必须先选模式（单曲模式 / 专辑模式），不使用启发式猜测或语法前缀判断输入类型。
6. **macOS 沙箱**：开发环境需 `no-sandbox` 标志并覆盖 `userData` 路径以保证稳定性。

## 工程规范

1. **架构分层**：遵循 Main/Preload/IPC -> Adapters(Provider) -> Services -> Infra 分层，应用逻辑与 A/B 方案（官方/社区）解耦，支持可配置切换。
2. **Provider 模式**：通过 `MusicProvider` 接口屏蔽 Provider 差异，`CommunityProvider` 为默认可用实现，`OfficialProvider` 当前为 stub。
3. **批量稳定性**：批量写入须经 `AddTaskService` 统一处理去重、分批、限流与重试。
4. **去重逻辑**：多来源（含专辑导入）的曲目按 ID 去重；专辑曲目自带 ID 自动标记为「已自动匹配」。
5. **筛选联动**：批量操作仅对当前筛选结果子集生效。

## 协作约定

1. 每次执行 Bash 命令或修改文件前，先用一句话解释要做什么。
2. 代码改动后须执行 IDE 静态诊断。

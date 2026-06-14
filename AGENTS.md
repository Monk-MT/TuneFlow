# AGENTS.md

> 本文件是项目上下文索引入口。Agent 在开发需求或回答问题前，应先读取本文件，再按索引加载相关上下文。

## 项目简介

- **名称**：wangyiAddMusic（网易云音乐批量加歌工具）
- **目标**：将歌曲/整张专辑批量添加到指定网易云歌单。
- **技术栈**：Electron + React + TypeScript + Node.js（weapi 加密）。
- **架构**：分层架构 Main/Preload/IPC -> Adapters(Provider) -> Services -> Infra。

## 上下文索引

### 1. 本地文档索引

- 路径：`.agents/local-docs-index.md`
- 内容：项目核心文档（`PRD.md`、`TECH_DESIGN.md`）、关键源码目录索引。

### 2. 远程文档索引

- 路径：`.agents/remote-docs-index.md`
- 内容：远端上下文（在线文档、API 文档、设计稿 URL）。

### 3. 约束与规范

- 路径：`.agents/constraints.md`
- 内容：硬性约束（写入鉴权、登录风控、全局滚动条等）、工程规范、协作约定。

### 4. 外部本地知识库索引

- 路径：_(暂无，用户已确认跳过)_

## 使用约定

1. 开发或回答前，先读取本文件并按需加载 `.agents/` 下的索引文件。
2. 涉及具体需求时，结合 `PRD.md` / `TECH_DESIGN.md` 加载更深层文档内容。
3. 修改文件或执行命令前，须遵守 `.agents/constraints.md` 中的约束与规范。

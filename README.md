# 光束短剧 (GuangShu Drama)

基于 AI 的一站式短剧自动化生产平台。品牌「光束短剧」。

**一句话生成完整短剧，从剧本到成片全自动化。**

## 功能特性

- **剧本改写**：小说/梗概 → 标准短剧剧本
- **元素提取**：自动提取角色、场景、道具并去重
- **分镜拆解**：剧本 → 镜头序列（景别、运镜、时长）
- **提示词生成**：角色/场景/道具/分镜图片与视频提示词
- **AI 生图**：OpenAI / Gemini / 火山引擎
- **AI 生视频**：
  - 火山引擎 Seedance（`volcengine`）
  - MiniMax H3 / Hailuo（`minimax`）
  - 阿里云百炼 Wan（`aliyun`）
- **分辨率选择**：工作台按当前视频厂商能力展示可选分辨率
- **批量视频确认**：批量提交前确认镜头、时长与分辨率
- **选择性拼接**：按分镜勾选后 FFmpeg 合成整集
- **Agent 对话**：工作台 Copilot，工具调用驱动生产流程
- **内容审核处理**：识别审核/鉴权/限流错误；瞬态错误自动指数退避重试（最多 3 次）
- **素材库**：统一管理图片/视频资源与缩略图
- **FFmpeg 合成**：字幕烧录、整集导出

## 人性化工作流

- **样片优先**：先生成前 2～4 镜确认画风，再批量补齐，降低试错成本
- **阶段教练**：工作台根据进度提示「下一步该做什么」
- **模式说明**：新建项目时用白话解释内容来源、创作类型与生成模式
- **过期不重复扣费**：默认批量跳过「过期」镜头，避免提示词小改就整批重跑
- **费用粗估**：批量提交前展示粗估费用（以供应商账单为准）

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Nuxt 4 + Vue 3 + TypeScript，纯 CSS 暗色主题 |
| 后端 | Hono + Drizzle ORM + **PostgreSQL** |
| AI | Vercel AI SDK（Agent + 结构化输出） |
| 媒体 | ffmpeg-static + sharp |
| 部署 | Docker Compose（API + PostgreSQL） |

## 环境要求

- Node.js 22+（推荐 LTS；请自行安装，仓库不包含 Node 运行时）
- npm 10+
- **PostgreSQL 16+**（本地或 Docker，必需）

## 快速开始

### 一键启动（推荐）

```bash
./scripts/start-dev.sh
```

脚本会提示 `DATABASE_URL`，并在检测到 `guangshu-pg` 容器时尝试启动。

### PostgreSQL

本项目**必须**使用 PostgreSQL，通过环境变量 `DATABASE_URL` 连接。

默认连接串：

```text
postgres://guangshu:guangshu@127.0.0.1:5432/guangshu_drama
```

快速启动本地 Postgres：

```bash
docker run -d --name guangshu-pg \
  -e POSTGRES_USER=guangshu \
  -e POSTGRES_PASSWORD=guangshu \
  -e POSTGRES_DB=guangshu_drama \
  -p 5432:5432 postgres:16
```

或使用 Compose（含应用与数据库）：

```bash
docker compose up -d --build
```

Compose 中 `postgres` 服务与 `guangshu-drama` API 共享网络；应用侧 `DATABASE_URL` 指向 `postgres:5432`。

### 接口冒烟（无 Docker 也可用）

本机没有 Docker 时，可用嵌入式 Postgres 跑一轮 API 可行性验证：

```bash
npm run smoke
```

会自动拉起临时库、启动后端、验证 health / 建剧 / 分集 / 分镜 / 产物状态 / 用量汇总，结束后清理。

### 安装

```bash
# 后端
cd backend && npm install

# 前端
cd ../frontend && npm install
```

### 开发模式

```bash
# 终端 1：后端（需已配置 DATABASE_URL）
cd backend && npm run dev

# 终端 2：前端
cd frontend && npm run dev
```

- 前端：http://localhost:3013
- 后端 API：http://localhost:5679/api/v1

### 首次使用

1. 确保 PostgreSQL 可连接（见 `DATABASE_URL`）
2. 打开「设置」页
3. 使用「**快捷配置**」粘贴 API Key，或手动添加文本/图片/视频配置
4. 创建剧集，进入工作台，粘贴原文开始生产

### 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `5679` | 后端端口 |
| `DATABASE_URL` | `postgres://guangshu:guangshu@127.0.0.1:5432/guangshu_drama` | **PostgreSQL 连接串（必需）** |
| `STORAGE_PATH` | `./data/static` | 静态资源目录 |
| `PUBLIC_BASE_URL` | `http://localhost:5679` | 对外可访问的媒体基址（供视频厂商拉取首帧图） |
| `LOG_LEVEL` | `info` | 日志级别 |
| `TASK_LOG_DIR` | `./data/logs` | 可选；任务日志文件目录 |
| `IMAGE_CONCURRENCY` | `3` | 本地图片生成并发上限 |
| `VIDEO_CONCURRENCY` | `2` | 每 tick 查询的视频任务上限 |

### Docker 部署

```bash
docker compose up -d --build
```

访问 http://localhost:5679

Compose 会同时启动：

- `postgres`：PostgreSQL 16
- `guangshu-drama`：API + 静态前端

### 生产模式（单服务）

```bash
cd frontend && npm run generate
cp -r .output/public dist
cd ../backend && npm start
```

## 视频厂商

| Provider Key | 说明 | 典型模型 |
|---|---|---|
| `volcengine` | 火山引擎 Seedance | 图生视频 / 文生视频 |
| `minimax` | MiniMax（H3 走 `/v2/video_generation`） | MiniMax-Hailuo / H3 |
| `aliyun` | 阿里云百炼 Wan（DashScope Async） | wan2.6-t2v 等 |

工作台顶栏可按厂商能力切换分辨率；批量生视频前会弹出确认框。

## 常用脚本

```bash
# 类型检查
cd backend && npm run typecheck

# 结构/适配器测试（node --test，无需 Jest）
cd backend && npm test
cd frontend && npm test

# 回填缺失缩略图 / 视频封面
cd backend && npm run backfill-artwork

# Drizzle
cd backend && npm run db:generate
cd backend && npm run db:push
```

根目录：

```bash
npm run typecheck   # 后端 tsc
npm run test        # 后端 + 前端测试
```

## 项目结构

```
backend/                 Hono API + AI Agents + PostgreSQL (Drizzle)
backend/src/services/adapters/   图片/视频厂商适配器（含 volcengine / minimax / aliyun）
backend/workspace/skills/        Agent 技能 Markdown（可在线编辑）
frontend/                Nuxt 4 SPA
data/static/             生成文件（图片/视频）
data/logs/               任务日志（task-{id}.log）
docker-compose.yml       API + PostgreSQL
```

### Skills 路径

Agent 技能文件位于：

```text
backend/workspace/skills/
├── script-rewriter/SKILL.md
├── extractor/SKILL.md
├── storyboard-breaker/SKILL.md
└── prompt-generator/
    ├── character-prompt/SKILL.md
    ├── scene-prompt/SKILL.md
    ├── prop-prompt/SKILL.md
    └── video-prompt/SKILL.md
```

可在设置/技能页在线编辑；运行时由后端 skills 路由加载。

## 能力一览

| 能力域 | 状态 |
|---|---|
| 端到端生产（改写→提取→分镜→提示词→生图→生视频→合成导出） | 已具备 |
| 多厂商生图 / 生视频（OpenAI、Gemini、火山、MiniMax、阿里 Wan） | 已具备 |
| 分集级图片/视频模型绑定（工作台 ModelSelect → episode configId） | 已具备 |
| 分镜尾帧 / 参考图上传与视频生成透传 | 已具备 |
| 图片真实生成连通性探测 + 视频网络/鉴权轻量探测 | 已具备 |
| 工作台风格预设切换（style-presets → drama.style） | 已具备 |
| 工作台单镜头闭环（改提示词、生图/视频、预览、合成、批量确认、失败重试） | 已具备 |
| 导出前确认对话框、分镜失败角标与行内重试、任务已运行时长 | 已具备 |
| 设置与运维（厂商模板、快捷配置、连通性测试、未配置引导、技能编辑） | 已具备 |
| 稳健性（审核错误分类、瞬态重试、本地参考图公网校验、拼接缺文件校验） | 已具备 |
| Agent 对话 + 工具查询 / 写剧本 / 改写·提取·拆镜生产工具 | 已具备 |
| 用量台账、TTS 旁白、剪映草稿导出、媒体版本历史 | 已具备 |
| 任务幂等 / 事件进度、资产确认闸门、分镜锁定、就绪探针 | 已具备 |
| 可恢复样片流水线、首尾帧、跨项目素材库、角色级联重生 | 已具备 |
| 结构测试与适配器请求形状校验 | 已具备 |

## 许可证

MIT，见 [LICENSE](LICENSE)。安全披露见 [SECURITY.md](SECURITY.md)；贡献方式见 [CONTRIBUTING.md](CONTRIBUTING.md)。

生产环境请务必修改 Docker / `.env` 中的默认数据库口令，并妥善保管各厂商 API Key。

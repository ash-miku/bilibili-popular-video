# bilibili-popular-video

一个围绕 **B 站热门视频** 的全栈数据分析项目。

项目会抓取 B 站热门视频与 UP 主信息，落库到 PostgreSQL，再同步聚合到 ClickHouse，对外提供分析 API，并通过 React 仪表盘展示热门榜单、视频趋势、UP 主分析、分类趋势与视频播放能力。

## 功能概览

- 首页 Dashboard：总览指标、热门排行榜、分区视频数量分布
- 热门页：综合热门视频排行
- 趋势分析：按 BV 号查看视频趋势，查看榜单波动
- UP 主分析：UP 主排行、详情抽屉、趋势图
- 分类分析：分区分布、热门标签、分区热度趋势
- 视频播放：弹窗播放器、分辨率切换、代理流播放
- 数据链路：PostgreSQL 原始数据 + ClickHouse 分析数据
- 定时任务：自动抓取 + 每日同步

## 技术栈

### 后端

- Go
- Gin
- PostgreSQL
- ClickHouse
- pgx

### 前端

- React 18
- TypeScript
- Vite
- Ant Design
- ECharts
- Artplayer

### 部署

- Docker Compose
- Nginx

## 项目结构

```text
.
├── cmd/server/                 # 服务启动入口
├── internal/
│   ├── config/                 # 配置读取
│   ├── crawler/                # B站抓取与调度
│   ├── handler/                # HTTP API
│   ├── model/                  # 数据模型
│   ├── repository/
│   │   ├── pg/                 # PostgreSQL 读写
│   │   └── ch/                 # ClickHouse 查询与聚合
│   └── sync/                   # PG -> CH 同步
├── migrations/                 # PostgreSQL / ClickHouse 初始化脚本
├── web/                        # React 前端
├── docker-compose.yaml
├── Dockerfile
└── .env.example
```

## 数据流

1. 抓取 B 站热门视频与 UP 主基础数据
2. 将原始数据写入 PostgreSQL
3. 定时把每日快照同步到 ClickHouse
4. 前端通过 `/api/v1/*` 读取分析结果
5. 播放器通过后端代理与缓存能力提供视频播放

## 本地开发

### 1. 准备配置

复制环境变量模板：

```bash
cp .env.example .env
```

然后按需填写：

- `PG_PASSWORD`
- `CH_PASSWORD`
- `BILIBILI_SESSDATA`（如果需要高清视频播放能力）

> `SESSDATA` 属于敏感 Cookie，**不要提交到 GitHub**。

### 2. 启动数据库

```bash
docker compose up -d postgres clickhouse
```

### 3. 构建前端

```bash
cd web
npm install
npm run build
```

### 4. 构建后端二进制

在项目根目录执行：

```bash
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o bili-server ./cmd/server
```

### 5. 构建并启动应用

```bash
DOCKER_BUILDKIT=0 docker build -t bilibili-popular-video-app .
docker compose up -d app web
```

启动后可访问：

- 前端：`http://localhost:3000`
- 后端：`http://localhost:8090`
- 健康检查：`http://localhost:8090/health`

## 常用命令

### 前端开发

```bash
cd web
npm install
npm run build
```

### 后端构建

```bash
go build -o bili-server ./cmd/server
```

### 手动触发同步

```bash
curl -X POST http://localhost:8090/api/v1/admin/sync
```

## 主要 API

### Dashboard

- `GET /api/v1/dashboard/overview`
- `GET /api/v1/dashboard/ranking`

### Trend

- `GET /api/v1/trend/video/:bvid`
- `GET /api/v1/trend/ranking-change`

### Uploader

- `GET /api/v1/uploader/top`
- `GET /api/v1/uploader/:mid/detail`

### Category

- `GET /api/v1/category/distribution`
- `GET /api/v1/category/partitions`
- `GET /api/v1/category/:id/trend`
- `GET /api/v1/tags/hot`

### Hot

- `GET /api/v1/hot/ranking`

### Player

- `GET /api/v1/player/info`
- `GET /api/v1/player/stream`
- `GET /api/v1/player/proxy`

## 配置说明

项目通过环境变量读取配置，参考 `.env.example`。

关键项：

| 变量 | 说明 |
|---|---|
| `PG_HOST` / `PG_PORT` / `PG_USER` / `PG_PASSWORD` / `PG_DB` | PostgreSQL 连接配置 |
| `CH_HOST` / `CH_PORT` / `CH_HTTP_PORT` / `CH_USER` / `CH_PASSWORD` / `CH_DB` | ClickHouse 连接配置 |
| `CRAWL_INTERVAL_HOUR` | 热门抓取间隔 |
| `CRAWL_DAILY_HOUR` | 每日同步时间 |
| `CRAWL_DELAY_MS` | 抓取请求延迟 |
| `APP_PORT` | 后端服务端口 |
| `BILIBILI_SESSDATA` | 播放代理所需的 B 站 Cookie |

## 安全说明

- `.env` 已被 `.gitignore` 排除，不会默认提交
- 仓库内只保留 `.env.example`
- 文档与配置中的示例密码已替换为占位符
- 推送前请再次确认没有把本地 Cookie、密码、Token 写进源码或文档

## 当前已知特点

- 播放器依赖 `SESSDATA` 才能访问部分高质量流
- Docker 镜像构建依赖根目录下已生成的 `bili-server`
- ClickHouse 里使用的是实际抓到的分区 ID / 分区名，不建议在前端手写固定分区映射

## 后续可继续优化的方向

- 增加前端开发模式与一键启动脚本
- 为后端增加测试与 lint 流程
- 引入 GitHub Actions 做自动构建与检查
- 优化图表体积与前端 chunk size
- 补充更细的播放链路与爬虫限流文档

## License

本项目使用 [MIT License](./LICENSE)。

# B站热门视频分析平台 - 项目维护指南

> 本文档由开发过程自动总结，涵盖项目架构、编译启动、模块功能、数据库设计、API 接口、前端页面等全部技术细节，供后续维护参考。

---

## 1. 项目概述

B站热门视频分析平台是一个全栈 Web 应用，用于实时追踪 Bilibili 热门视频数据，进行趋势分析、UP主分析和分区统计。

**技术栈**：
- 后端：Go 1.25 + Gin + PostgreSQL 18 + ClickHouse
- 前端：React 19 + TypeScript + Ant Design 5 + ECharts
- 部署：Docker Compose（4 个容器）
- 数据流：B站 API → 爬虫 → PostgreSQL → 同步 → ClickHouse → API → 前端

---

## 2. 项目结构

```
bilibili-popular-video/
├── cmd/server/main.go          # 入口：配置加载 → DB连接 → 迁移 → 路由 → 爬虫调度
├── internal/
│   ├── config/config.go        # 环境变量配置（PG、CH、爬虫、服务器）
│   ├── crawler/
│   │   ├── bilibili.go         # B站 API 客户端（Popular API、Tags、用户卡片）
│   │   └── scheduler.go        # 定时调度：小时级热门 + 日级全量
│   ├── handler/                # Gin HTTP handler（dashboard/trend/uploader/category/hot）
│   ├── model/video.go          # 数据模型（PG 模型 + CH 模型 + API 响应）
│   ├── repository/
│   │   ├── ch/stats_repo.go    # ClickHouse 读写（批量插入 + 分析查询）
│   │   └── pg/                 # PostgreSQL CRUD（video/snapshot/uploader）
│   └── sync/syncer.go          # PG→CH 数据同步（每日视频快照 + UP主统计）
├── migrations/
│   ├── postgres/001_init.sql   # PG 表：videos, video_snapshots, uploaders
│   └── clickhouse/001_init.sql # CH 表：video_daily_stats, uploader_stats
├── web/                        # React 前端
│   ├── src/
│   │   ├── api/index.ts        # Axios API 客户端
│   │   ├── components/MainLayout.tsx  # 侧边栏 + 主题切换布局
│   │   ├── contexts/ThemeContext.tsx   # 深色/浅色主题状态
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx   # 仪表盘（概览卡片 + 排行榜 + 分区饼图）
│   │   │   ├── Hot.tsx         # 综合热门（日期范围 + 分区过滤 + 排行表格）
│   │   │   ├── Trend.tsx       # 趋势分析（排名变化 + 视频趋势折线图）
│   │   │   ├── Uploader.tsx    # UP主分析（排行 + 详情趋势图）
│   │   │   └── Category.tsx    # 分类分析（分布饼图 + 分类趋势折线）
│   │   ├── styles/global.css   # 全局 CSS（深色/浅色变量 + 动画）
│   │   ├── App.tsx             # 路由 + Ant Design ConfigProvider
│   │   └── main.tsx            # 入口
│   ├── nginx.conf              # Nginx 反向代理配置
│   └── dist/                   # 构建产物（nginx 静态托管）
├── docker-compose.yaml         # 4 服务编排
├── Dockerfile                  # Go 应用容器（预编译二进制）
├── .env                        # 环境变量
├── go.mod / go.sum             # Go 依赖
└── docs/                       # 文档
```

---

## 3. 编译与启动

### 3.1 本地开发

```bash
# 后端
go run ./cmd/server

# 前端
cd web
npm install
npm run dev    # Vite 开发服务器，默认 5173 端口
```

### 3.2 Docker Compose 部署（生产）

```bash
# 1. 编译 Go 二进制
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o bili-server ./cmd/server

# 2. 构建 Docker 镜像
# ⚠️ 必须用 DOCKER_BUILDKIT=0，因为本地镜像在 BuildKit 下无法解析
DOCKER_BUILDKIT=0 docker build -t bilibili-popular-video-app .

# 3. 构建前端
cd web && npm run build && cd ..

# 4. 启动所有服务
docker compose up -d

# 5. 查看日志
docker logs -f bili-app
```

### 3.3 端口映射

| 服务 | 容器端口 | 宿主端口 | 说明 |
|------|---------|---------|------|
| PostgreSQL | 5432 | 5432 | 数据库直连 |
| ClickHouse | 8123/9000 | 8123/9000 | HTTP/Native 接口 |
| Go App | 8080 | 8090 | API 服务 |
| Nginx (前端) | 80 | 3000 | Web 界面 |

### 3.4 环境变量（.env）

```env
PG_HOST=postgres          # PG 主机名（Docker 网络）
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=your_password
PG_DB=bili_data

CH_HOST=clickhouse        # CH 主机名（Docker 网络）
CH_PORT=9000              # Native TCP
CH_HTTP_PORT=8123         # HTTP 接口
CH_USER=ly
CH_PASSWORD=your_password
CH_DB=bili_data

CRAWL_INTERVAL_HOUR=1     # 热门爬取间隔（小时）
CRAWL_DAILY_HOUR=0        # 每日全量爬取时间（0=凌晨）
CRAWL_DELAY_MS=300        # 请求间延迟（毫秒）

APP_PORT=8080             # 服务端口
```

---

## 4. 数据库设计

### 4.1 PostgreSQL（原始数据）

**videos 表** - 视频基本信息
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL PK | 自增 ID |
| bvid | VARCHAR(20) UNIQUE | B站视频 ID |
| aid | BIGINT | 旧版视频 ID |
| title | VARCHAR(500) | 标题 |
| uploader_mid | BIGINT | UP主 ID |
| uploader_name | VARCHAR(100) | UP主名 |
| partition_id | INT | 分区 ID |
| partition_name | VARCHAR(50) | 分区名 |
| tags | JSONB | 标签（JSON 数组） |
| cover_url | VARCHAR(500) | 封面 URL |
| duration | INT | 时长（秒） |
| pub_time | TIMESTAMP | 发布时间 |

**video_snapshots 表** - 每日数据快照
| 字段 | 类型 | 说明 |
|------|------|------|
| bvid | VARCHAR(20) FK | 视频引用 |
| snapshot_date | DATE | 快照日期 |
| view_count | BIGINT | 播放量 |
| danmaku_count | INT | 弹幕数 |
| like_count | INT | 点赞数 |
| coin_count | INT | 投币数 |
| favorite_count | INT | 收藏数 |
| share_count | INT | 分享数 |
| rank_position | INT | 排名位置 |
| UNIQUE(bvid, snapshot_date) | | 每天每视频一条 |

**uploaders 表** - UP主信息
| 字段 | 类型 | 说明 |
|------|------|------|
| mid | BIGINT PK | UP主 ID |
| name | VARCHAR(100) | 昵称 |
| fans_count | INT | 粉丝数 |
| video_count | INT | 投稿数 |

### 4.2 ClickHouse（分析数据）

**video_daily_stats** - 视频日统计
- 引擎：MergeTree，按月分区 (`toYYYYMM(snapshot_date)`)
- 排序键：`(snapshot_date, bvid)`
- 包含字段与 PG 快照类似，加上 title/uploader 信息冗余（便于直接查询）

**uploader_stats** - UP主日统计
- 引擎：MergeTree，按月分区
- 排序键：`(stat_date, uploader_mid)`
- 统计：video_count, total_views, total_likes, avg_views

### 4.3 ⚠️ ClickHouse 类型规则

```
count() / countDistinct() → uint64  （必须用 uint64 变量接收）
sum(Int64 字段)          → int64    （必须用 int64 变量接收）
sum(Int32 字段)          → int64    （sum 结果类型升级）
```

这是本项目多次踩坑的关键点。Go 的 `rows.Scan()` 对类型严格匹配，`uint64` 和 `int` 不能互换。

---

## 5. 后端模块详解

### 5.1 爬虫 (`internal/crawler/`)

**数据源**：使用 B站 **Popular API**（`/x/web-interface/popular`），而非 Ranking API。
- Popular API 返回近期热门视频（1-3天内）
- 每次抓取 5 页 × 20 条 = 100 个视频

**爬取流程**：
1. `CrawlRanking()`：小时级，抓取 Popular API 各页 → upsert video → insert snapshot
2. `CrawlDaily()`：日级，遍历所有已知视频 → 刷新 tags → 刷新 UP主信息

**限流**：每请求间隔 200-500ms 随机延迟 + 3 次指数退避重试

**分区映射**：`partitions` 变量定义了 18 个 B站分区 ID→名称映射

### 5.2 调度器 (`internal/crawler/scheduler.go`)

- 启动时立即执行一次 `CrawlRanking`
- 之后每 `intervalHour` 小时（默认1小时）执行一次
- 每分钟检查是否到达 `dailyHour`（默认0点），执行 `CrawlDaily` + `SyncDaily`

### 5.3 数据同步 (`internal/sync/syncer.go`)

**PG→CH 同步流程**：
1. 从 PG `video_snapshots` 读取指定日期的所有快照 → 批量插入 CH `video_daily_stats`
2. 从 PG 计算 UP主日统计（按 mid 聚合）→ 批量插入 CH `uploader_stats`

**触发方式**：
- 自动：每日调度器在日级爬取后自动同步
- 手动：`POST /api/v1/admin/sync`

### 5.4 API 路由 (`cmd/server/main.go`)

```
GET /health                                    # 健康检查
POST /api/v1/admin/sync                        # 手动触发 PG→CH 同步

GET /api/v1/dashboard/overview?date=           # 概览统计
GET /api/v1/dashboard/ranking?date=&page=      # 排行榜

GET /api/v1/trend/video/:bvid?start=&end=      # 单视频趋势
GET /api/v1/trend/ranking-change?start=&end=   # 排名变化

GET /api/v1/uploader/top?date=&sortBy=&page=   # UP主排行
GET /api/v1/uploader/:mid/detail?start=&end=   # UP主详情

GET /api/v1/category/distribution?date=        # 分区分布
GET /api/v1/category/:id/trend?start=&end=     # 分区趋势
GET /api/v1/tags/hot?date=&limit=              # 热门标签

GET /api/v1/hot/ranking?start=&end=&partitionName=&page=  # 综合热门
```

所有响应格式：`{"code": 0, "data": {...}, "message": ""}`

---

## 6. 前端页面详解

### 6.1 仪表盘 (`/dashboard`)
- 4 个统计卡片（动画数字）：热门视频数、新增视频、活跃UP主、总播放量
- 热门排行榜 Top 20（可搜索、可按分区过滤，标题点击跳转B站）
- 分区视频数量分布饼图（ECharts）

### 6.2 综合热门 (`/hot`)
- 日期范围选择 + 分区下拉过滤
- 分页排行表格（默认查看最近 7 天）

### 6.3 趋势分析 (`/trend`)
- 排名变化：选择日期范围，展示播放量增长最快的视频
- 视频趋势：搜索视频后展示多日折线图

### 6.4 UP主分析 (`/uploader`)
- UP主排行表格（按播放量/视频数/点赞数排序）
- 点击 UP主查看详情趋势图

### 6.5 分类分析 (`/category`)
- 分区分布饼图
- 选择分区后查看该分类的趋势折线图

### 6.6 主题系统
- 深色/浅色切换，状态保存在 `localStorage`
- B站品牌色：`#FB7299`（粉）、`#23ADE5`（蓝）、`#FFB027`（金）
- CSS 变量驱动，通过 `data-theme` 属性切换

---

## 7. Docker 部署注意事项

1. **PG 数据目录**：必须挂载 `/var/lib/postgresql`（不是 `/var/lib/postgresql/data`），PG 18+ 会自动创建子目录
2. **BuildKit**：必须 `DOCKER_BUILDKIT=0`，因为使用本地镜像 `golang:1.25-local`
3. **Go 镜像**：本地环境已通过 `docker tag` 从 `hub.yunqutech.com/base/golang:1.25.9` 映射
4. **迁移**：应用启动时自动执行 `migrations/` 下的 SQL 文件（幂等）

---

## 8. 常见问题排查

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| `converting UInt64 to *int is unsupported` | CH `count()` 返回 uint64，Go 用 int 接收 | 改用 `uint64` 变量接收 |
| `converting Int64 to *uint64 is unsupported` | CH `sum()` 返回 int64，Go 用 uint64 接收 | 改用 `int64` 变量接收 |
| 分区显示为数字 2xxx | 使用了 `partition_id` 而非 `partition_name` | 查询改为返回 `partition_name` |
| 排行数据全是历史热门 | 使用了 Ranking API（全站历史排行） | 改用 Popular API（近期热门） |
| Docker build 找不到 base image | BuildKit 无法解析本地镜像 | 设置 `DOCKER_BUILDKIT=0` |
| PG 容器启动失败 | 数据目录挂载路径错误 | 挂载 `/var/lib/postgresql` 而非子目录 |

---

## 9. 关键设计决策

1. **PG 写入 + CH 分析**：PG 负责原始数据写入和事务，CH 负责高性能分析查询
2. **单体 Go 服务**：爬虫 + 同步 + API 合并为一个二进制，简化部署
3. **Popular API**：选择近期热门数据而非历史全站排行，数据更有时效性
4. **幂等迁移**：SQL 使用 `IF NOT EXISTS`，可重复执行
5. **默认昨日数据**：前端默认查询 `dayjs().subtract(1, 'day')`，因为爬虫数据为前一天

# B站热门视频全栈分析平台 — 设计文档

**日期**: 2026-04-25
**状态**: 已确认

---

## 1. 概述

构建一个全栈数据分析平台，用于采集、存储、分析Bilibili（B站）热门视频数据，并提供可视化仪表盘。

### 1.1 目标

- 定时采集B站热门视频排行榜数据（全量追踪：视频信息 + 每日快照 + UP主信息）
- 历史趋势追踪（同一视频多天数据变化）
- 提供 Web 仪表盘进行数据可视化分析

### 1.2 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Go (Gin 框架) |
| 前端 | React + TypeScript + Ant Design + ECharts |
| 关系数据库 | PostgreSQL（原始数据存储） |
| 分析数据库 | ClickHouse（聚合查询） |
| 部署 | Docker Compose |

### 1.3 架构方案

**单体 Go 服务**（方案 A）：一个 Go 二进制文件包含爬虫、数据同步、API 服务。

```
┌─────────────────────────────────────────────┐
│  Docker Compose                              │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Go App   │  │PostgreSQL│  │ClickHouse │  │
│  │ ┌──────┐ │  │          │  │           │  │
│  │ │Crawler│ │  │ 原始数据  │  │ 聚合数据   │  │
│  │ ├──────┤ │  │          │  │           │  │
│  │ │Sync  │ │  └──────────┘  └───────────┘  │
│  │ ├──────┤ │                                │
│  │ │API   │ │  ┌──────────┐                  │
│  │ └──────┘ │  │ React    │                  │
│  └──────────┘  │ Nginx容器 │                  │
│               └──────────┘                  │
└─────────────────────────────────────────────┘
```

**数据流向**: 爬虫 → PostgreSQL → 同步器 → ClickHouse → API → React 前端

---

## 2. 项目结构

```
bilibili-popular-video/
├── docker-compose.yaml
├── Dockerfile                     # Go 后端镜像
├── .env                           # 环境变量配置
├── cmd/
│   └── server/
│       └── main.go                # 入口
├── internal/
│   ├── crawler/                   # B站数据爬取
│   │   ├── bilibili.go            # B站 API 客户端
│   │   └── scheduler.go           # 定时任务调度
│   ├── sync/                      # PG → ClickHouse 数据同步
│   │   └── syncer.go
│   ├── handler/                   # HTTP API handlers
│   │   ├── dashboard.go
│   │   ├── trend.go
│   │   ├── uploader.go
│   │   └── category.go
│   ├── repository/                # 数据访问层
│   │   ├── pg/                    # PostgreSQL 操作
│   │   └── ch/                    # ClickHouse 操作
│   ├── model/                     # 数据模型
│   │   └── video.go
│   └── config/                    # 配置管理
│       └── config.go
├── migrations/                    # 数据库迁移脚本
│   ├── postgres/
│   └── clickhouse/
├── web/                           # React 前端
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Trend.tsx
│   │   │   ├── Uploader.tsx
│   │   │   └── Category.tsx
│   │   ├── components/
│   │   ├── api/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── nginx.conf
├── postgresql/                    # PG 数据卷
└── clickhouse/                    # CH 数据卷
```

---

## 3. 数据模型

### 3.1 PostgreSQL（原始数据存储）

#### videos 表 — 视频基础信息

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL PK | 自增主键 |
| bvid | VARCHAR(20) UNIQUE | BV号 |
| aid | BIGINT | AV号 |
| title | VARCHAR(500) | 标题 |
| description | TEXT | 简介 |
| uploader_mid | BIGINT | UP主 mid |
| uploader_name | VARCHAR(100) | UP主名称 |
| partition_id | INT | 分区ID |
| partition_name | VARCHAR(50) | 分区名称 |
| tags | JSONB | 标签数组 |
| cover_url | VARCHAR(500) | 封面URL |
| duration | INT | 时长（秒） |
| pub_time | TIMESTAMP | 发布时间 |
| created_at | TIMESTAMP | 入库时间 |

```sql
CREATE TABLE videos (
    id              BIGSERIAL PRIMARY KEY,
    bvid            VARCHAR(20) NOT NULL UNIQUE,
    aid             BIGINT NOT NULL,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    uploader_mid    BIGINT NOT NULL,
    uploader_name   VARCHAR(100),
    partition_id    INT,
    partition_name  VARCHAR(50),
    tags            JSONB,
    cover_url       VARCHAR(500),
    duration        INT,
    pub_time        TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_videos_partition ON videos(partition_id);
CREATE INDEX idx_videos_uploader ON videos(uploader_mid);
```

#### video_snapshots 表 — 视频每日快照

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL PK | 自增主键 |
| bvid | VARCHAR(20) FK | 关联视频 |
| snapshot_date | DATE | 快照日期 |
| view_count | BIGINT | 播放量 |
| danmaku_count | INT | 弹幕数 |
| reply_count | INT | 评论数 |
| favorite_count | INT | 收藏数 |
| coin_count | INT | 投币数 |
| share_count | INT | 分享数 |
| like_count | INT | 点赞数 |
| rank_position | INT | 排行榜位置 |

```sql
CREATE TABLE video_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    bvid            VARCHAR(20) NOT NULL REFERENCES videos(bvid),
    snapshot_date   DATE NOT NULL,
    view_count      BIGINT,
    danmaku_count   INT,
    reply_count     INT,
    favorite_count  INT,
    coin_count      INT,
    share_count     INT,
    like_count      INT,
    rank_position   INT,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(bvid, snapshot_date)
);

CREATE INDEX idx_snapshots_date ON video_snapshots(snapshot_date);
CREATE INDEX idx_snapshots_bvid_date ON video_snapshots(bvid, snapshot_date);
```

#### uploaders 表 — UP主信息

| 字段 | 类型 | 说明 |
|------|------|------|
| mid | BIGINT PK | UP主 mid |
| name | VARCHAR(100) | 名称 |
| face_url | VARCHAR(500) | 头像URL |
| fans_count | INT | 粉丝数 |
| video_count | INT | 视频数 |
| updated_at | TIMESTAMP | 更新时间 |

```sql
CREATE TABLE uploaders (
    mid             BIGINT PRIMARY KEY,
    name            VARCHAR(100),
    face_url        VARCHAR(500),
    fans_count      INT,
    video_count     INT,
    updated_at      TIMESTAMP DEFAULT NOW()
);
```

### 3.2 ClickHouse（分析聚合）

#### video_daily_stats 表

```sql
CREATE TABLE video_daily_stats (
    snapshot_date   Date,
    bvid            String,
    title           String,
    uploader_mid    Int64,
    uploader_name   String,
    partition_id    Int32,
    partition_name  String,
    view_count      Int64,
    danmaku_count   Int32,
    reply_count     Int32,
    favorite_count  Int32,
    coin_count      Int32,
    share_count     Int32,
    like_count      Int32,
    rank_position   Nullable(Int32)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(snapshot_date)
ORDER BY (snapshot_date, bvid);
```

#### uploader_stats 表

```sql
CREATE TABLE uploader_stats (
    stat_date       Date,
    uploader_mid    Int64,
    uploader_name   String,
    video_count     Int32,
    total_views     Int64,
    total_likes     Int64,
    avg_views       Float64
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(stat_date)
ORDER BY (stat_date, uploader_mid);
```

---

## 4. 爬虫设计

### 4.1 采集接口

| 数据 | B站 API | 频率 |
|------|---------|------|
| 热门视频排行榜 | `/api/x/web-interface/ranking/v2` | 每小时 |
| 视频详细信息 | `/x/web-interface/view` | 每日 |
| UP主信息 | `/x/space/wbi/acc/info` | 每日 |
| 视频标签 | `/x/tag/archive/tags` | 随视频采集 |

### 4.2 采集调度

- **每小时**: 采集热门排行榜（各分区 Top 100）
  - 新视频 → INSERT videos + INSERT video_snapshots
  - 已有视频 → 只 INSERT video_snapshots（新增快照）
- **每日 00:00**: 补充采集
  - 遍历所有已入库视频，更新 video_snapshots
  - 更新 UP主信息
  - 触发 PG → ClickHouse 数据同步

### 4.3 反爬策略

- 请求间隔 200-500ms 随机延迟
- 模拟浏览器 User-Agent
- 请求超时 10s
- 限流自动退避重试（指数退避，最多3次）

### 4.4 技术实现

- 使用 Go `time.Ticker` + `goroutine` 实现调度
- 爬取结果通过 Go channel 传递给写入协程
- 错误日志记录到文件，不影响其他采集任务

---

## 5. API 设计

### 5.1 框架与规范

- **框架**: Gin
- **前缀**: `/api/v1`
- **响应格式**: `{ "code": 0, "data": {...}, "message": "ok" }`
- **数据源**: 所有查询走 ClickHouse
- **时间过滤**: `?start=2025-01-01&end=2025-04-01`
- **分页**: `?page=1&pageSize=20`

### 5.2 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/dashboard/overview` | 总览数据 |
| GET | `/api/v1/dashboard/ranking` | 当前排行榜 |
| GET | `/api/v1/trend/video/:bvid` | 单视频趋势 |
| GET | `/api/v1/trend/ranking-change` | 排行榜变动趋势 |
| GET | `/api/v1/uploader/top` | TOP UP主排行 |
| GET | `/api/v1/uploader/:mid/detail` | UP主详情 |
| GET | `/api/v1/category/distribution` | 分区视频分布 |
| GET | `/api/v1/category/:id/trend` | 单分区趋势 |
| GET | `/api/v1/tags/hot` | 热门标签 |

---

## 6. 前端设计

### 6.1 技术选型

- **UI 框架**: Ant Design
- **图表库**: ECharts
- **路由**: React Router v6
- **HTTP 客户端**: Axios

### 6.2 页面结构

**导航栏**: 仪表盘 | 趋势分析 | UP主 | 分类

#### 6.2.1 数据仪表盘（Dashboard）

- 今日概览卡片（热门视频数、新增视频、活跃UP主、总播放量）
- 当前 Top 20 排行榜表格
- 各分区视频数量饼图
- 近7天新增视频趋势折线图

#### 6.2.2 趋势分析（Trend）

- 搜索框（BV号/标题）
- 视频趋势折线图（播放/弹幕/评论/点赞随时间变化）
- 排行榜变动热力图
- 支持多视频对比

#### 6.2.3 UP主分析（Uploader）

- TOP UP主排行表格（播放量/视频数/平均播放）
- UP主详情页（视频列表、粉丝趋势、分区分布）
- UP主产出量趋势图

#### 6.2.4 分类分析（Category）

- 分区视频数量分布柱状图
- 分区热度趋势折线图
- 热门标签词云
- 分区详情（该分区下视频排行）

---

## 7. 部署设计

### 7.1 Docker Compose 服务

| 服务 | 镜像 | 端口 | 说明 |
|------|------|------|------|
| postgres | postgres:latest | 5432 | 关系数据库 |
| clickhouse | clickhouse:latest | 8123, 9000 | 分析数据库 |
| app | 自建 Go 镜像 | 8080 | Go 后端 |
| web | nginx:alpine | 3000 | React 前端 |
| init-db | 自建 Go 镜像 | — | 一次性 schema 初始化 |

### 7.2 启动流程

1. PostgreSQL + ClickHouse 启动
2. `init-db` 运行数据库迁移，完成后退出
3. `app` 启动（Go 服务：爬虫调度 + API）
4. `web` 启动（Nginx 托管 React 构建产物，反向代理 `/api` 到 `app`）

### 7.3 配置管理

通过 `.env` 文件管理：

```env
# PostgreSQL
PG_HOST=postgres
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=your_password
PG_DB=bili_data

# ClickHouse
CH_HOST=clickhouse
CH_PORT=9000
CH_HTTP_PORT=8123
CH_USER=ly
CH_PASSWORD=your_password
CH_DB=bili_data

# 爬虫
CRAWL_INTERVAL_HOUR=1
CRAWL_DAILY_HOUR=0
CRAWL_DELAY_MS=300

# 服务
APP_PORT=8080
```

### 7.4 错误处理与日志

- 使用 Go 标准库 `log/slog` 结构化日志
- 爬虫失败自动重试，超过3次记录错误日志跳过
- 数据库连接池 + 健康检查，自动重连
- API 错误统一格式返回，5xx 记录日志

---

## 8. 非功能性要求

- **性能**: ClickHouse 查询响应 < 500ms（百万级数据）
- **可靠性**: 爬虫单次失败不影响后续采集
- **可观测性**: 结构化日志 + 错误追踪
- **可维护性**: 清晰的项目分层、标准 Go 项目布局

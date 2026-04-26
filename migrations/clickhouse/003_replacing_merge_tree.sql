-- Bilibili Popular Video Analytics - ClickHouse Schema Upgrade
-- Version: 003
-- Purpose: Switch from MergeTree to ReplacingMergeTree for dedup-by-insert.
--          No DELETE needed before INSERT anymore.
--
-- NOTE: This RENAME approach is necessary because table names are hardcoded
-- in the application code. Once table names are configurable, 003 can be
-- removed and 001_init.sql can use ReplacingMergeTree directly.

-- 1. video_daily_stats: dedup by (snapshot_date, bvid)
CREATE TABLE IF NOT EXISTS video_daily_stats_new
(
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
    rank_position   Nullable(Int32),
    tags            Array(String)
) ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(snapshot_date)
ORDER BY (snapshot_date, bvid);

INSERT INTO video_daily_stats_new SELECT * FROM video_daily_stats;

RENAME TABLE video_daily_stats      TO video_daily_stats_old,
               video_daily_stats_new TO video_daily_stats;

DROP TABLE IF EXISTS video_daily_stats_old;

-- 2. uploader_stats: dedup by (stat_date, uploader_mid)
CREATE TABLE IF NOT EXISTS uploader_stats_new
(
    stat_date       Date,
    uploader_mid    Int64,
    uploader_name   String,
    video_count     Int32,
    total_views     Int64,
    total_likes     Int64,
    avg_views       Float64
) ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(stat_date)
ORDER BY (stat_date, uploader_mid);

INSERT INTO uploader_stats_new SELECT * FROM uploader_stats;

RENAME TABLE uploader_stats      TO uploader_stats_old,
               uploader_stats_new TO uploader_stats;

DROP TABLE IF EXISTS uploader_stats_old;

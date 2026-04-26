-- Bilibili Popular Video Analytics - ClickHouse Schema Initialization
-- Version: 001

CREATE TABLE IF NOT EXISTS video_daily_stats (
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

CREATE TABLE IF NOT EXISTS uploader_stats (
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

-- Bilibili Popular Video Analytics - PostgreSQL Schema Initialization
-- Version: 001

-- videos: video basic information
CREATE TABLE IF NOT EXISTS videos (
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

CREATE INDEX IF NOT EXISTS idx_videos_partition ON videos(partition_id);
CREATE INDEX IF NOT EXISTS idx_videos_uploader ON videos(uploader_mid);

-- video_snapshots: daily snapshot of video statistics
CREATE TABLE IF NOT EXISTS video_snapshots (
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

CREATE INDEX IF NOT EXISTS idx_snapshots_date ON video_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_snapshots_bvid_date ON video_snapshots(bvid, snapshot_date);

-- uploaders: UPZhu (uploader) profile information
CREATE TABLE IF NOT EXISTS uploaders (
    mid             BIGINT PRIMARY KEY,
    name            VARCHAR(100),
    face_url        VARCHAR(500),
    fans_count      INT,
    video_count     INT,
    updated_at      TIMESTAMP DEFAULT NOW()
);

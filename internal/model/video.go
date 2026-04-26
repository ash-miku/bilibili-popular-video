// Package model defines the data structures used across the Bilibili popular video
// analytics platform. Structs are organised by storage target: PostgreSQL for raw
// ingestion data and ClickHouse for aggregated analytics. Every struct carries both
// json tags (for API serialisation) and db tags (for database row scanning).
package model

import (
	"encoding/json"
	"time"
)

// ---------------------------------------------------------------------------
// PostgreSQL models (raw data)
// ---------------------------------------------------------------------------

// Video represents a Bilibili video's base information stored in the PostgreSQL
// videos table. Tags is stored as JSONB.
type Video struct {
	Id            int64           `json:"id"             db:"id"`
	Bvid          string          `json:"bvid"           db:"bvid"`
	Aid           int64           `json:"aid"            db:"aid"`
	Title         string          `json:"title"          db:"title"`
	Description   string          `json:"description"    db:"description"`
	UploaderMid   int64           `json:"uploader_mid"   db:"uploader_mid"`
	UploaderName  string          `json:"uploader_name"  db:"uploader_name"`
	PartitionId   int             `json:"partition_id"   db:"partition_id"`
	PartitionName string          `json:"partition_name" db:"partition_name"`
	Tags          json.RawMessage `json:"tags"           db:"tags"`
	CoverUrl      string          `json:"cover_url"      db:"cover_url"`
	Duration      int             `json:"duration"       db:"duration"`
	PubTime       time.Time       `json:"pub_time"       db:"pub_time"`
	CreatedAt     time.Time       `json:"created_at"     db:"created_at"`
}

// VideoSnapshot represents a single daily snapshot of a video's engagement metrics,
// stored in the PostgreSQL video_snapshots table.
type VideoSnapshot struct {
	Id            int64     `json:"id"             db:"id"`
	Bvid          string    `json:"bvid"           db:"bvid"`
	SnapshotDate  time.Time `json:"snapshot_date"  db:"snapshot_date"`
	ViewCount     int64     `json:"view_count"     db:"view_count"`
	DanmakuCount  int       `json:"danmaku_count"  db:"danmaku_count"`
	ReplyCount    int       `json:"reply_count"    db:"reply_count"`
	FavoriteCount int       `json:"favorite_count" db:"favorite_count"`
	CoinCount     int       `json:"coin_count"     db:"coin_count"`
	ShareCount    int       `json:"share_count"    db:"share_count"`
	LikeCount     int       `json:"like_count"     db:"like_count"`
	RankPosition  int       `json:"rank_position"  db:"rank_position"`
	CreatedAt     time.Time `json:"created_at"     db:"created_at"`
}

// Uploader represents a Bilibili content creator stored in the PostgreSQL
// uploaders table.
type Uploader struct {
	Mid        int64     `json:"mid"         db:"mid"`
	Name       string    `json:"name"        db:"name"`
	FaceUrl    string    `json:"face_url"    db:"face_url"`
	FansCount  int       `json:"fans_count"  db:"fans_count"`
	VideoCount int       `json:"video_count" db:"video_count"`
	UpdatedAt  time.Time `json:"updated_at"  db:"updated_at"`
}

// ---------------------------------------------------------------------------
// ClickHouse models (aggregated analytics)
// ---------------------------------------------------------------------------

// VideoDailyStat represents a daily aggregation of video metrics stored in the
// ClickHouse video_daily_stats table. Used for trend analysis and dashboard queries.
type VideoDailyStat struct {
	SnapshotDate  time.Time `json:"snapshot_date"  db:"snapshot_date"`
	Bvid          string    `json:"bvid"           db:"bvid"`
	Title         string    `json:"title"          db:"title"`
	UploaderMid   int64     `json:"uploader_mid"   db:"uploader_mid"`
	UploaderName  string    `json:"uploader_name"  db:"uploader_name"`
	PartitionId   int32     `json:"partition_id"   db:"partition_id"`
	PartitionName string    `json:"partition_name" db:"partition_name"`
	ViewCount     int64     `json:"view_count"     db:"view_count"`
	DanmakuCount  int32     `json:"danmaku_count"  db:"danmaku_count"`
	ReplyCount    int32     `json:"reply_count"    db:"reply_count"`
	FavoriteCount int32     `json:"favorite_count" db:"favorite_count"`
	CoinCount     int32     `json:"coin_count"     db:"coin_count"`
	ShareCount    int32     `json:"share_count"    db:"share_count"`
	LikeCount     int32     `json:"like_count"     db:"like_count"`
	RankPosition  *int32    `json:"rank_position"  db:"rank_position"` // Nullable in ClickHouse
}

// UploaderStat represents a daily aggregation of uploader statistics stored in
// the ClickHouse uploader_stats table.
type UploaderStat struct {
	StatDate     time.Time `json:"stat_date"     db:"stat_date"`
	UploaderMid  int64     `json:"uploader_mid"  db:"uploader_mid"`
	UploaderName string    `json:"uploader_name" db:"uploader_name"`
	VideoCount   int64     `json:"video_count"   db:"video_count"`
	TotalViews   int64     `json:"total_views"   db:"total_views"`
	TotalLikes   int64     `json:"total_likes"   db:"total_likes"`
	AvgViews     float64   `json:"avg_views"     db:"avg_views"`
}

// ---------------------------------------------------------------------------
// API response wrapper
// ---------------------------------------------------------------------------

// APIResponse is the standard envelope for all HTTP API responses.
// Code 0 means success; non-zero codes indicate errors.
type APIResponse[T any] struct {
	Code    int    `json:"code"`
	Data    T      `json:"data"`
	Message string `json:"message"`
}

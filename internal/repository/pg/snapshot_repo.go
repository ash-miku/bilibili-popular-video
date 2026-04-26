package pg

import (
	"context"
	"fmt"
	"time"

	"bilibili-popular-video/internal/model"

	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	// Joins video_snapshots with videos to produce the flat row format
	// required by ClickHouse video_daily_stats.
	getSnapshotsForSyncSQL = `
		SELECT
			vs.snapshot_date,
			vs.bvid,
			v.title,
			v.uploader_mid,
			v.uploader_name,
		v.partition_id,
		v.partition_name,
		v.tags,
		vs.view_count,
			vs.danmaku_count,
			vs.reply_count,
			vs.favorite_count,
			vs.coin_count,
			vs.share_count,
			vs.like_count,
			vs.rank_position
		FROM video_snapshots vs
		JOIN videos v ON v.bvid = vs.bvid
		WHERE vs.snapshot_date = $1
		ORDER BY vs.bvid
	`

	// Aggregates per-uploader statistics for the ClickHouse uploader_stats table.
	getUploaderStatsForSyncSQL = `
		SELECT
			vs.snapshot_date   AS stat_date,
			v.uploader_mid,
			v.uploader_name,
			COUNT(DISTINCT v.bvid)                     AS video_count,
			COALESCE(SUM(vs.view_count), 0)            AS total_views,
			COALESCE(SUM(vs.like_count), 0)            AS total_likes,
			COALESCE(AVG(vs.view_count), 0)            AS avg_views
		FROM video_snapshots vs
		JOIN videos v ON v.bvid = vs.bvid
		WHERE vs.snapshot_date = $1
		GROUP BY vs.snapshot_date, v.uploader_mid, v.uploader_name
		ORDER BY v.uploader_mid
	`
)

// SnapshotRepo provides PG → ClickHouse sync read operations.
type SnapshotRepo struct {
	pool *pgxpool.Pool
}

func NewSnapshotRepo(pool *pgxpool.Pool) *SnapshotRepo {
	return &SnapshotRepo{pool: pool}
}

func (r *SnapshotRepo) GetSnapshotsForSync(ctx context.Context, date time.Time) ([]model.VideoDailyStat, error) {
	rows, err := r.pool.Query(ctx, getSnapshotsForSyncSQL, date)
	if err != nil {
		return nil, fmt.Errorf("query snapshots for sync date=%s: %w",
			date.Format(time.DateOnly), err)
	}
	defer rows.Close()

	var stats []model.VideoDailyStat
	for rows.Next() {
		var s model.VideoDailyStat
		if err := rows.Scan(
			&s.SnapshotDate, &s.Bvid, &s.Title,
			&s.UploaderMid, &s.UploaderName,
			&s.PartitionId, &s.PartitionName, &s.Tags,
			&s.ViewCount, &s.DanmakuCount, &s.ReplyCount,
			&s.FavoriteCount, &s.CoinCount, &s.ShareCount,
			&s.LikeCount, &s.RankPosition,
		); err != nil {
			return nil, fmt.Errorf("scan snapshot for sync date=%s: %w",
				date.Format(time.DateOnly), err)
		}
		stats = append(stats, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate snapshots for sync date=%s: %w",
			date.Format(time.DateOnly), err)
	}
	return stats, nil
}

func (r *SnapshotRepo) GetUploaderStatsForSync(ctx context.Context, date time.Time) ([]model.UploaderStat, error) {
	rows, err := r.pool.Query(ctx, getUploaderStatsForSyncSQL, date)
	if err != nil {
		return nil, fmt.Errorf("query uploader stats for sync date=%s: %w",
			date.Format(time.DateOnly), err)
	}
	defer rows.Close()

	var stats []model.UploaderStat
	for rows.Next() {
		var s model.UploaderStat
		if err := rows.Scan(
			&s.StatDate, &s.UploaderMid, &s.UploaderName,
			&s.VideoCount, &s.TotalViews, &s.TotalLikes, &s.AvgViews,
		); err != nil {
			return nil, fmt.Errorf("scan uploader stat for sync date=%s: %w",
				date.Format(time.DateOnly), err)
		}
		stats = append(stats, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate uploader stats for sync date=%s: %w",
			date.Format(time.DateOnly), err)
	}
	return stats, nil
}

package pg

import (
	"context"
	"fmt"
	"time"

	"bilibili-popular-video/internal/model"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	upsertVideoSQL = `
		INSERT INTO videos (
			bvid, aid, title, description, uploader_mid, uploader_name,
			partition_id, partition_name, tags, cover_url, duration, pub_time
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (bvid) DO UPDATE SET
			aid             = EXCLUDED.aid,
			title           = EXCLUDED.title,
			description     = EXCLUDED.description,
			uploader_mid    = EXCLUDED.uploader_mid,
			uploader_name   = EXCLUDED.uploader_name,
			partition_id    = EXCLUDED.partition_id,
			partition_name  = EXCLUDED.partition_name,
			tags            = EXCLUDED.tags,
			cover_url       = EXCLUDED.cover_url,
			duration        = EXCLUDED.duration,
			pub_time        = EXCLUDED.pub_time
	`

	getVideoByBvidSQL = `
		SELECT id, bvid, aid, title, description, uploader_mid, uploader_name,
		       partition_id, partition_name, tags, cover_url, duration, pub_time, created_at
		FROM videos
		WHERE bvid = $1
	`

	insertSnapshotSQL = `
		INSERT INTO video_snapshots (
			bvid, snapshot_date, view_count, danmaku_count, reply_count,
			favorite_count, coin_count, share_count, like_count, rank_position
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (bvid, snapshot_date) DO NOTHING
	`

	getSnapshotsByBvidSQL = `
		SELECT id, bvid, snapshot_date, view_count, danmaku_count, reply_count,
		       favorite_count, coin_count, share_count, like_count, rank_position, created_at
		FROM video_snapshots
		WHERE bvid = $1 AND snapshot_date >= $2 AND snapshot_date <= $3
		ORDER BY snapshot_date ASC
	`

	getAllBvidsSQL = `
		SELECT bvid FROM videos
	`

	getVideosByBvidsSQL = `
		SELECT bvid, cover_url, duration
		FROM videos
		WHERE bvid = ANY($1)
	`
)

type VideoRepo struct {
	pool *pgxpool.Pool
}

func NewVideoRepo(pool *pgxpool.Pool) *VideoRepo {
	return &VideoRepo{pool: pool}
}

func (r *VideoRepo) UpsertVideo(ctx context.Context, v *model.Video) error {
	_, err := r.pool.Exec(ctx, upsertVideoSQL,
		v.Bvid, v.Aid, v.Title, v.Description, v.UploaderMid, v.UploaderName,
		v.PartitionId, v.PartitionName, v.Tags, v.CoverUrl, v.Duration, v.PubTime,
	)
	if err != nil {
		return fmt.Errorf("upsert video bvid=%s: %w", v.Bvid, err)
	}
	return nil
}

func (r *VideoRepo) GetVideoByBvid(ctx context.Context, bvid string) (*model.Video, error) {
	row := r.pool.QueryRow(ctx, getVideoByBvidSQL, bvid)
	var v model.Video
	err := row.Scan(
		&v.Id, &v.Bvid, &v.Aid, &v.Title, &v.Description,
		&v.UploaderMid, &v.UploaderName, &v.PartitionId, &v.PartitionName,
		&v.Tags, &v.CoverUrl, &v.Duration, &v.PubTime, &v.CreatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("video not found: bvid=%s", bvid)
		}
		return nil, fmt.Errorf("get video bvid=%s: %w", bvid, err)
	}
	return &v, nil
}

func (r *VideoRepo) InsertSnapshot(ctx context.Context, s *model.VideoSnapshot) error {
	var rankPosition *int
	if s.RankPosition != 0 {
		rankPosition = &s.RankPosition
	}
	_, err := r.pool.Exec(ctx, insertSnapshotSQL,
		s.Bvid, s.SnapshotDate, s.ViewCount, s.DanmakuCount, s.ReplyCount,
		s.FavoriteCount, s.CoinCount, s.ShareCount, s.LikeCount, rankPosition,
	)
	if err != nil {
		return fmt.Errorf("insert snapshot bvid=%s date=%s: %w",
			s.Bvid, s.SnapshotDate.Format(time.DateOnly), err)
	}
	return nil
}

func (r *VideoRepo) GetSnapshotsByBvid(ctx context.Context, bvid string, start, end time.Time) ([]model.VideoSnapshot, error) {
	rows, err := r.pool.Query(ctx, getSnapshotsByBvidSQL, bvid, start, end)
	if err != nil {
		return nil, fmt.Errorf("query snapshots bvid=%s: %w", bvid, err)
	}
	defer rows.Close()

	var snapshots []model.VideoSnapshot
	for rows.Next() {
		var s model.VideoSnapshot
		var rankPosition *int
		if err := rows.Scan(
			&s.Id, &s.Bvid, &s.SnapshotDate, &s.ViewCount, &s.DanmakuCount,
			&s.ReplyCount, &s.FavoriteCount, &s.CoinCount, &s.ShareCount,
			&s.LikeCount, &rankPosition, &s.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan snapshot bvid=%s: %w", bvid, err)
		}
		if rankPosition != nil {
			s.RankPosition = *rankPosition
		}
		snapshots = append(snapshots, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate snapshots bvid=%s: %w", bvid, err)
	}
	return snapshots, nil
}

// VideoInfo holds the lightweight video fields needed for gallery and other
// display-oriented queries.
type VideoInfo struct {
	Bvid     string
	CoverUrl string
	Duration int
}

// GetVideosByBvids batch-fetches cover_url and duration for a list of bvids.
// Returns a map keyed by bvid for O(1) lookup. Missing bvids are silently omitted.
func (r *VideoRepo) GetVideosByBvids(ctx context.Context, bvids []string) (map[string]VideoInfo, error) {
	if len(bvids) == 0 {
		return map[string]VideoInfo{}, nil
	}
	rows, err := r.pool.Query(ctx, getVideosByBvidsSQL, bvids)
	if err != nil {
		return nil, fmt.Errorf("batch query videos: %w", err)
	}
	defer rows.Close()

	result := make(map[string]VideoInfo, len(bvids))
	for rows.Next() {
		var info VideoInfo
		if err := rows.Scan(&info.Bvid, &info.CoverUrl, &info.Duration); err != nil {
			return nil, fmt.Errorf("scan video info: %w", err)
		}
		result[info.Bvid] = info
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate video info rows: %w", err)
	}
	return result, nil
}

func (r *VideoRepo) GetAllBvids(ctx context.Context) ([]string, error) {
	rows, err := r.pool.Query(ctx, getAllBvidsSQL)
	if err != nil {
		return nil, fmt.Errorf("query all bvids: %w", err)
	}
	defer rows.Close()

	var bvids []string
	for rows.Next() {
		var bvid string
		if err := rows.Scan(&bvid); err != nil {
			return nil, fmt.Errorf("scan bvid: %w", err)
		}
		bvids = append(bvids, bvid)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate bvids: %w", err)
	}
	return bvids, nil
}

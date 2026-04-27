package ch

import (
	"context"
	"fmt"
	"time"

	"bilibili-popular-video/internal/model"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

const statsDailyTable = "video_daily_stats"
const statsUploaderTable = "uploader_stats"

type StatsRepo struct {
	conn clickhouse.Conn
}

func NewStatsRepo(conn clickhouse.Conn) *StatsRepo {
	return &StatsRepo{conn: conn}
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

func (r *StatsRepo) DeleteDailyStats(ctx context.Context, date time.Time) error {
	if err := r.conn.Exec(ctx, `ALTER TABLE `+statsDailyTable+` DELETE WHERE snapshot_date = $1 SETTINGS mutations_sync = 2`, date); err != nil {
		return fmt.Errorf("delete daily stats for %s: %w", date.Format("2006-01-02"), err)
	}
	return nil
}

func (r *StatsRepo) DeleteUploaderStats(ctx context.Context, date time.Time) error {
	if err := r.conn.Exec(ctx, `ALTER TABLE `+statsUploaderTable+` DELETE WHERE stat_date = $1 SETTINGS mutations_sync = 2`, date); err != nil {
		return fmt.Errorf("delete uploader stats for %s: %w", date.Format("2006-01-02"), err)
	}
	return nil
}

func (r *StatsRepo) OptimizeDailyStats(ctx context.Context, date time.Time) error {
	partition := date.Format("200601")
	if err := r.conn.Exec(ctx, `OPTIMIZE TABLE `+statsDailyTable+` PARTITION ID '`+partition+`' FINAL`); err != nil {
		return fmt.Errorf("optimize daily stats partition %s: %w", partition, err)
	}
	return nil
}

func (r *StatsRepo) OptimizeUploaderStats(ctx context.Context, date time.Time) error {
	partition := date.Format("200601")
	if err := r.conn.Exec(ctx, `OPTIMIZE TABLE `+statsUploaderTable+` PARTITION ID '`+partition+`' FINAL`); err != nil {
		return fmt.Errorf("optimize uploader stats partition %s: %w", partition, err)
	}
	return nil
}

func (r *StatsRepo) InsertDailyStats(ctx context.Context, stats []model.VideoDailyStat) error {
	batch, err := r.conn.PrepareBatch(ctx, "INSERT INTO "+statsDailyTable)
	if err != nil {
		return fmt.Errorf("prepare daily stats batch: %w", err)
	}

	for i := range stats {
		s := &stats[i]
		if err := batch.Append(
			s.SnapshotDate,
			s.Bvid,
			s.Title,
			s.UploaderMid,
			s.UploaderName,
			s.PartitionId,
			s.PartitionName,
			s.ViewCount,
			s.DanmakuCount,
			s.ReplyCount,
			s.FavoriteCount,
			s.CoinCount,
			s.ShareCount,
			s.LikeCount,
			s.RankPosition,
			s.Tags,
		); err != nil {
			return fmt.Errorf("append daily stat row %d (bvid=%s): %w", i, s.Bvid, err)
		}
	}

	if err := batch.Send(); err != nil {
		return fmt.Errorf("send daily stats batch (%d rows): %w", len(stats), err)
	}
	return nil
}

func (r *StatsRepo) InsertUploaderStats(ctx context.Context, stats []model.UploaderStat) error {
	batch, err := r.conn.PrepareBatch(ctx, "INSERT INTO "+statsUploaderTable)
	if err != nil {
		return fmt.Errorf("prepare uploader stats batch: %w", err)
	}

	for i := range stats {
		s := &stats[i]
		if err := batch.Append(
			s.StatDate,
			s.UploaderMid,
			s.UploaderName,
			s.VideoCount,
			s.TotalViews,
			s.TotalLikes,
			s.AvgViews,
		); err != nil {
			return fmt.Errorf("append uploader stat row %d (mid=%d): %w", i, s.UploaderMid, err)
		}
	}

	if err := batch.Send(); err != nil {
		return fmt.Errorf("send uploader stats batch (%d rows): %w", len(stats), err)
	}
	return nil
}

// HasDailyStats returns true if any daily stats rows exist for the given date.
// This is used as a persistent guard to prevent duplicate daily notifications
// after container restarts within the same day.
func (r *StatsRepo) HasDailyStats(ctx context.Context, date time.Time) (bool, error) {
	rows, err := r.conn.Query(ctx,
		`SELECT 1 FROM `+statsDailyTable+` WHERE snapshot_date = $1 LIMIT 1`,
		date)
	if err != nil {
		return false, fmt.Errorf("check daily stats for %s: %w", date.Format("2006-01-02"), err)
	}
	defer rows.Close()
	return rows.Next(), nil
}

// ---------------------------------------------------------------------------
// Dashboard queries
// ---------------------------------------------------------------------------

// GetOverview returns today's summary: total videos, total uploaders, total views.
// The returned map always contains the keys "total_videos", "total_uploaders",
// and "total_views".
func (r *StatsRepo) GetOverview(ctx context.Context, date time.Time) (map[string]interface{}, error) {
	row := r.conn.QueryRow(ctx, `
		SELECT
			countDistinct(bvid)   AS total_videos,
			countDistinct(uploader_mid) AS total_uploaders,
			sum(view_count)       AS total_views
		FROM `+statsDailyTable+`
		WHERE snapshot_date = $1
	`, date)

	var totalVideos uint64
	var totalUploaders uint64
	var totalViews int64

	if err := row.Scan(&totalVideos, &totalUploaders, &totalViews); err != nil {
		return nil, fmt.Errorf("scan overview for %s: %w", date.Format("2006-01-02"), err)
	}

	return map[string]interface{}{
		"total_videos":   int(totalVideos),
		"total_uploaders": int(totalUploaders),
		"total_views":    int(totalViews),
	}, nil
}

// GetRanking returns a page of video daily stats for a given date and partition,
// ordered by view_count descending. Pass partitionId 0 to select all partitions.
// It returns the stats slice, the total count (for pagination), and any error.
func (r *StatsRepo) GetRanking(ctx context.Context, date time.Time, partitionId int, page, pageSize int) ([]model.VideoDailyStat, int, error) {
	offset := (page - 1) * pageSize

	var countQuery string
	var countArgs []interface{}
	var dataQuery string
	var dataArgs []interface{}

	if partitionId > 0 {
		countQuery = `SELECT countDistinct(bvid) FROM `+statsDailyTable+` WHERE snapshot_date = $1 AND partition_id = $2`
		countArgs = []interface{}{date, int32(partitionId)}

		dataQuery = `
			SELECT
				$1 AS snapshot_date,
				bvid,
				argMax(title, snapshot_date) AS title,
				argMax(uploader_mid, snapshot_date) AS uploader_mid,
				argMax(uploader_name, snapshot_date) AS uploader_name,
				partition_id,
				argMax(partition_name, snapshot_date) AS partition_name,
				any(tags) AS tags,
				argMax(view_count, snapshot_date) AS view_count,
				argMax(danmaku_count, snapshot_date) AS danmaku_count,
				argMax(reply_count, snapshot_date) AS reply_count,
				argMax(favorite_count, snapshot_date) AS favorite_count,
				argMax(coin_count, snapshot_date) AS coin_count,
				argMax(share_count, snapshot_date) AS share_count,
				argMax(like_count, snapshot_date) AS like_count,
				argMin(rank_position, snapshot_date) AS rank_position
			FROM `+statsDailyTable+`
			WHERE snapshot_date = $1 AND partition_id = $2
			GROUP BY bvid, partition_id
			ORDER BY view_count DESC
			LIMIT $3 OFFSET $4
		`
		dataArgs = []interface{}{date, int32(partitionId), uint64(pageSize), uint64(offset)}
	} else {
		countQuery = `SELECT countDistinct(bvid) FROM `+statsDailyTable+` WHERE snapshot_date = $1`
		countArgs = []interface{}{date}

		dataQuery = `
			SELECT
				$1 AS snapshot_date,
				bvid,
				argMax(title, snapshot_date) AS title,
				argMax(uploader_mid, snapshot_date) AS uploader_mid,
				argMax(uploader_name, snapshot_date) AS uploader_name,
				argMax(partition_id, snapshot_date) AS partition_id,
				argMax(partition_name, snapshot_date) AS partition_name,
				any(tags) AS tags,
				argMax(view_count, snapshot_date) AS view_count,
				argMax(danmaku_count, snapshot_date) AS danmaku_count,
				argMax(reply_count, snapshot_date) AS reply_count,
				argMax(favorite_count, snapshot_date) AS favorite_count,
				argMax(coin_count, snapshot_date) AS coin_count,
				argMax(share_count, snapshot_date) AS share_count,
				argMax(like_count, snapshot_date) AS like_count,
				argMin(rank_position, snapshot_date) AS rank_position
			FROM video_daily_stats
			WHERE snapshot_date = $1
			GROUP BY bvid
			ORDER BY view_count DESC
			LIMIT $2 OFFSET $3
		`
		dataArgs = []interface{}{date, uint64(pageSize), uint64(offset)}
	}

	var total uint64
	if err := r.conn.QueryRow(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count ranking for %s partition=%d: %w", date.Format("2006-01-02"), partitionId, err)
	}

	rows, err := r.conn.Query(ctx, dataQuery, dataArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("query ranking: %w", err)
	}
	defer rows.Close()

	var result []model.VideoDailyStat
	for rows.Next() {
		var s model.VideoDailyStat
		if err := rows.Scan(
			&s.SnapshotDate, &s.Bvid, &s.Title, &s.UploaderMid, &s.UploaderName,
			&s.PartitionId, &s.PartitionName, &s.Tags, &s.ViewCount, &s.DanmakuCount,
			&s.ReplyCount, &s.FavoriteCount, &s.CoinCount, &s.ShareCount,
			&s.LikeCount, &s.RankPosition,
		); err != nil {
			return nil, 0, fmt.Errorf("scan ranking row: %w", err)
		}
		result = append(result, s)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate ranking rows: %w", err)
	}

	return result, int(total), nil
}

// GetLaunchCurve returns all daily stats for a given video, ordered by
// snapshot_date ascending. The caller can compute growth deltas (24h, 3-day,
// 7-day) from the returned data.
func (r *StatsRepo) GetLaunchCurve(ctx context.Context, bvid string) ([]model.VideoDailyStat, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT snapshot_date, bvid, title, uploader_mid, uploader_name,
		       partition_id, partition_name, tags, view_count, danmaku_count,
		       reply_count, favorite_count, coin_count, share_count,
		       like_count, rank_position
		FROM `+statsDailyTable+`
		WHERE bvid = $1
		ORDER BY snapshot_date ASC
	`, bvid)
	if err != nil {
		return nil, fmt.Errorf("query launch curve for bvid=%s: %w", bvid, err)
	}
	defer rows.Close()

	var result []model.VideoDailyStat
	for rows.Next() {
		var s model.VideoDailyStat
		if err := rows.Scan(
			&s.SnapshotDate, &s.Bvid, &s.Title, &s.UploaderMid, &s.UploaderName,
			&s.PartitionId, &s.PartitionName, &s.Tags, &s.ViewCount, &s.DanmakuCount,
			&s.ReplyCount, &s.FavoriteCount, &s.CoinCount, &s.ShareCount,
			&s.LikeCount, &s.RankPosition,
		); err != nil {
			return nil, fmt.Errorf("scan launch curve row: %w", err)
		}
		result = append(result, s)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate launch curve rows: %w", err)
	}
	return result, nil
}

func (r *StatsRepo) GetVideoTrend(ctx context.Context, bvid string, start, end time.Time) ([]model.VideoDailyStat, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT snapshot_date, bvid, title, uploader_mid, uploader_name,
		       partition_id, partition_name, tags, view_count, danmaku_count,
		       reply_count, favorite_count, coin_count, share_count,
		       like_count, rank_position
		FROM `+statsDailyTable+`
		WHERE bvid = $1 AND snapshot_date BETWEEN $2 AND $3
		ORDER BY snapshot_date ASC
	`, bvid, start, end)
	if err != nil {
		return nil, fmt.Errorf("query video trend for bvid=%s: %w", bvid, err)
	}
	defer rows.Close()

	var result []model.VideoDailyStat
	for rows.Next() {
		var s model.VideoDailyStat
		if err := rows.Scan(
			&s.SnapshotDate, &s.Bvid, &s.Title, &s.UploaderMid, &s.UploaderName,
			&s.PartitionId, &s.PartitionName, &s.Tags, &s.ViewCount, &s.DanmakuCount,
			&s.ReplyCount, &s.FavoriteCount, &s.CoinCount, &s.ShareCount,
			&s.LikeCount, &s.RankPosition,
		); err != nil {
			return nil, fmt.Errorf("scan video trend row: %w", err)
		}
		result = append(result, s)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate video trend rows: %w", err)
	}
	return result, nil
}

// GetRankingChange returns videos with the largest view_count change over the
// given period [start, end], limited to the top `limit` entries.
func (r *StatsRepo) GetRankingChange(ctx context.Context, start, end time.Time, limit int) ([]model.VideoDailyStat, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT
			latest.snapshot_date, latest.bvid, latest.title,
			latest.uploader_mid, latest.uploader_name,
			latest.partition_id, latest.partition_name, latest.tags,
			latest.view_count, latest.danmaku_count, latest.reply_count,
			latest.favorite_count, latest.coin_count, latest.share_count,
			latest.like_count, latest.rank_position
		FROM `+statsDailyTable+` AS latest
		INNER JOIN (
			SELECT bvid, view_count AS first_views
			FROM `+statsDailyTable+`
			WHERE snapshot_date = $1
		) AS first ON latest.bvid = first.bvid
		WHERE latest.snapshot_date = $2
		ORDER BY (latest.view_count - first.first_views) DESC
		LIMIT $3
	`, start, end, uint64(limit))
	if err != nil {
		return nil, fmt.Errorf("query ranking change [%s, %s]: %w", start.Format("2006-01-02"), end.Format("2006-01-02"), err)
	}
	defer rows.Close()

	var result []model.VideoDailyStat
	for rows.Next() {
		var s model.VideoDailyStat
		if err := rows.Scan(
			&s.SnapshotDate, &s.Bvid, &s.Title, &s.UploaderMid, &s.UploaderName,
			&s.PartitionId, &s.PartitionName, &s.Tags, &s.ViewCount, &s.DanmakuCount,
			&s.ReplyCount, &s.FavoriteCount, &s.CoinCount, &s.ShareCount,
			&s.LikeCount, &s.RankPosition,
		); err != nil {
			return nil, fmt.Errorf("scan ranking change row: %w", err)
		}
		result = append(result, s)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate ranking change rows: %w", err)
	}
	return result, nil
}

// GetTopUploaders returns a page of uploader stats for a given date sorted by
// sortBy (e.g. "total_views", "video_count", "avg_views"). It returns the
// stats slice, the total count, and any error.
func (r *StatsRepo) GetTopUploaders(ctx context.Context, date time.Time, sortBy string, page, pageSize int) ([]model.UploaderStat, int, error) {
	// Whitelist allowed sort columns to prevent injection.
	allowedSort := map[string]string{
		"total_views": "total_views DESC",
		"video_count": "video_count DESC",
		"avg_views":   "avg_views DESC",
		"total_likes": "total_likes DESC",
	}
	orderClause, ok := allowedSort[sortBy]
	if !ok {
		orderClause = "total_views DESC"
	}

	var total uint64
	if err := r.conn.QueryRow(ctx, `
		SELECT countDistinct(uploader_mid) FROM `+statsUploaderTable+` WHERE stat_date = $1
	`, date).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count uploaders for %s: %w", date.Format("2006-01-02"), err)
	}

	offset := (page - 1) * pageSize

	query := fmt.Sprintf(`
		SELECT
			$1 AS stat_date,
			uploader_mid,
			argMax(uploader_name, stat_date) AS uploader_name,
			sum(video_count) AS video_count,
			sum(total_views) AS total_views,
			sum(total_likes) AS total_likes,
			avg(avg_views) AS avg_views
		FROM `+statsUploaderTable+`
		WHERE stat_date = $1
		GROUP BY uploader_mid
		ORDER BY %s
		LIMIT $2 OFFSET $3
	`, orderClause)

	rows, err := r.conn.Query(ctx, query, date, uint64(pageSize), uint64(offset))
	if err != nil {
		return nil, 0, fmt.Errorf("query top uploaders: %w", err)
	}
	defer rows.Close()

	var result []model.UploaderStat
	for rows.Next() {
		var s model.UploaderStat
		if err := rows.Scan(
			&s.StatDate, &s.UploaderMid, &s.UploaderName, &s.VideoCount,
			&s.TotalViews, &s.TotalLikes, &s.AvgViews,
		); err != nil {
			return nil, 0, fmt.Errorf("scan uploader stat row: %w", err)
		}
		result = append(result, s)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate uploader stat rows: %w", err)
	}
	return result, int(total), nil
}

func (r *StatsRepo) GetUploaderDetail(ctx context.Context, mid int64, start, end time.Time) ([]model.UploaderStat, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT
			stat_date,
			uploader_mid,
			argMax(uploader_name, stat_date) AS uploader_name,
			sum(video_count) AS video_count,
			sum(total_views) AS total_views,
			sum(total_likes) AS total_likes,
			avg(avg_views) AS avg_views
		FROM `+statsUploaderTable+`
		WHERE uploader_mid = $1 AND stat_date BETWEEN $2 AND $3
		GROUP BY stat_date, uploader_mid
		ORDER BY stat_date ASC
	`, mid, start, end)
	if err != nil {
		return nil, fmt.Errorf("query uploader detail mid=%d: %w", mid, err)
	}
	defer rows.Close()

	var result []model.UploaderStat
	for rows.Next() {
		var s model.UploaderStat
		if err := rows.Scan(
			&s.StatDate, &s.UploaderMid, &s.UploaderName, &s.VideoCount,
			&s.TotalViews, &s.TotalLikes, &s.AvgViews,
		); err != nil {
			return nil, fmt.Errorf("scan uploader detail row: %w", err)
		}
		result = append(result, s)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate uploader detail rows: %w", err)
	}
	return result, nil
}

// GetCategoryDistribution returns a map of partition_id -> video count for the
// given date.
func (r *StatsRepo) GetCategoryDistribution(ctx context.Context, date time.Time) (map[string]int, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT partition_name, count() AS cnt
			FROM `+statsDailyTable+`
			WHERE snapshot_date = $1
		GROUP BY partition_name
		ORDER BY cnt DESC
	`, date)
	if err != nil {
		return nil, fmt.Errorf("query category distribution for %s: %w", date.Format("2006-01-02"), err)
	}
	defer rows.Close()

	result := make(map[string]int)
	for rows.Next() {
		var name string
		var cnt uint64
		if err := rows.Scan(&name, &cnt); err != nil {
			return nil, fmt.Errorf("scan category distribution row: %w", err)
		}
		result[name] = int(cnt)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate category distribution rows: %w", err)
	}
	return result, nil
}

// GetCategoryTrend returns daily aggregated metrics for a single partition
// within [start, end]. Each map contains "snapshot_date", "video_count", and
// "total_views".
func (r *StatsRepo) GetCategoryTrend(ctx context.Context, partitionId int, start, end time.Time) ([]map[string]interface{}, error) {
	var rows driver.Rows
	var err error

	if partitionId == 0 {
		rows, err = r.conn.Query(ctx, `
			SELECT snapshot_date, count() AS video_count, sum(view_count) AS total_views
			FROM `+statsDailyTable+`
			WHERE snapshot_date BETWEEN $1 AND $2
			GROUP BY snapshot_date
			ORDER BY snapshot_date ASC
		`, start, end)
	} else {
		rows, err = r.conn.Query(ctx, `
			SELECT snapshot_date, count() AS video_count, sum(view_count) AS total_views
			FROM `+statsDailyTable+`
			WHERE partition_id = $1 AND snapshot_date BETWEEN $2 AND $3
			GROUP BY snapshot_date
			ORDER BY snapshot_date ASC
		`, int32(partitionId), start, end)
	}
	if err != nil {
		return nil, fmt.Errorf("query category trend partition=%d: %w", partitionId, err)
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var snapshotDate time.Time
		var videoCount uint64
		var totalViews int64
		if err := rows.Scan(&snapshotDate, &videoCount, &totalViews); err != nil {
			return nil, fmt.Errorf("scan category trend row: %w", err)
		}
		result = append(result, map[string]interface{}{
			"snapshot_date": snapshotDate,
			"video_count":   int(videoCount),
			"total_views":   int(totalViews),
		})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate category trend rows: %w", err)
	}
	return result, nil
}

type PartitionItem struct {
	ID   int32  `json:"id"`
	Name string `json:"name"`
}

func (r *StatsRepo) GetPartitionList(ctx context.Context) ([]PartitionItem, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT DISTINCT partition_id, partition_name
		FROM `+statsDailyTable+`
		ORDER BY partition_id ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("query partition list: %w", err)
	}
	defer rows.Close()

	var result []PartitionItem
	for rows.Next() {
		var item PartitionItem
		if err := rows.Scan(&item.ID, &item.Name); err != nil {
			return nil, fmt.Errorf("scan partition row: %w", err)
		}
		result = append(result, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate partition rows: %w", err)
	}
	return result, nil
}

// GetHotTags returns the top `limit` tags across all videos on the given date.
// Tags are extracted from the video_daily_stats.tags Array(String) column using
// arrayJoin to flatten the per-video tag arrays into individual tag rows.
func (r *StatsRepo) GetHotTags(ctx context.Context, date time.Time, limit int) (map[string]int, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT tag, count() AS cnt
		FROM (
			SELECT arrayJoin(tags) AS tag
			FROM `+statsDailyTable+`
			WHERE snapshot_date = $1
		)
		GROUP BY tag
		ORDER BY cnt DESC
		LIMIT $2
	`, date, uint64(limit))
	if err != nil {
		return nil, fmt.Errorf("query hot tags for %s: %w", date.Format("2006-01-02"), err)
	}
	defer rows.Close()

	result := make(map[string]int)
	for rows.Next() {
		var tag string
		var cnt uint64
		if err := rows.Scan(&tag, &cnt); err != nil {
			return nil, fmt.Errorf("scan hot tags row: %w", err)
		}
		result[tag] = int(cnt)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate hot tags rows: %w", err)
	}
	return result, nil
}

func (r *StatsRepo) GetHotRanking(ctx context.Context, start, end time.Time, partitionName string, page, pageSize int) ([]model.VideoDailyStat, int, error) {
	offset := (page - 1) * pageSize

	var countQuery string
	var countArgs []interface{}
	var dataQuery string
	var dataArgs []interface{}

	baseJoin := `
		FROM `+statsDailyTable+` v
		INNER JOIN (
			SELECT bvid, max(snapshot_date) AS max_date
			FROM `+statsDailyTable+`
			WHERE snapshot_date BETWEEN $1 AND $2
			GROUP BY bvid
		) latest ON v.bvid = latest.bvid AND v.snapshot_date = latest.max_date
	`

	if partitionName != "" {
		countQuery = "SELECT count(DISTINCT v.bvid) " + baseJoin + " WHERE v.partition_name = $3"
		countArgs = []interface{}{start, end, partitionName}

		dataQuery = `
			SELECT v.snapshot_date, v.bvid, v.title, v.uploader_mid, v.uploader_name,
			       v.partition_id, v.partition_name, v.tags, v.view_count, v.danmaku_count,
			       v.reply_count, v.favorite_count, v.coin_count, v.share_count,
			       v.like_count, v.rank_position
			` + baseJoin + `
			WHERE v.partition_name = $3
			ORDER BY v.view_count DESC
			LIMIT 1 BY v.bvid
			LIMIT $4 OFFSET $5
		`
		dataArgs = []interface{}{start, end, partitionName, uint64(pageSize), uint64(offset)}
	} else {
		countQuery = "SELECT count(DISTINCT v.bvid) " + baseJoin
		countArgs = []interface{}{start, end}

		dataQuery = `
			SELECT v.snapshot_date, v.bvid, v.title, v.uploader_mid, v.uploader_name,
			       v.partition_id, v.partition_name, v.tags, v.view_count, v.danmaku_count,
			       v.reply_count, v.favorite_count, v.coin_count, v.share_count,
			       v.like_count, v.rank_position
			` + baseJoin + `
			ORDER BY v.view_count DESC
			LIMIT 1 BY v.bvid
			LIMIT $3 OFFSET $4
		`
		dataArgs = []interface{}{start, end, uint64(pageSize), uint64(offset)}
	}

	var total uint64
	if err := r.conn.QueryRow(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count hot ranking [%s, %s]: %w", start.Format("2006-01-02"), end.Format("2006-01-02"), err)
	}

	rows, err := r.conn.Query(ctx, dataQuery, dataArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("query hot ranking: %w", err)
	}
	defer rows.Close()

	var result []model.VideoDailyStat
	for rows.Next() {
		var s model.VideoDailyStat
		if err := rows.Scan(
			&s.SnapshotDate, &s.Bvid, &s.Title, &s.UploaderMid, &s.UploaderName,
			&s.PartitionId, &s.PartitionName, &s.Tags, &s.ViewCount, &s.DanmakuCount,
			&s.ReplyCount, &s.FavoriteCount, &s.CoinCount, &s.ShareCount,
			&s.LikeCount, &s.RankPosition,
		); err != nil {
			return nil, 0, fmt.Errorf("scan hot ranking row: %w", err)
		}
		result = append(result, s)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate hot ranking rows: %w", err)
	}

	return result, int(total), nil
}

// ---------------------------------------------------------------------------
// Search queries
// ---------------------------------------------------------------------------

// SearchVideos performs a full-text search across video_daily_stats for videos
// whose title contains the query string (case-insensitive). It returns the
// latest snapshot for each matching bvid, along with the total count for
// pagination.
func (r *StatsRepo) SearchVideos(ctx context.Context, query string, page, pageSize int) ([]model.VideoDailyStat, int, error) {
	offset := (page - 1) * pageSize

	baseJoin := `
		FROM `+statsDailyTable+` v
		INNER JOIN (
			SELECT bvid, max(snapshot_date) AS max_date
			FROM `+statsDailyTable+`
			GROUP BY bvid
		) latest ON v.bvid = latest.bvid AND v.snapshot_date = latest.max_date
	`

	var total uint64
	if err := r.conn.QueryRow(ctx,
		"SELECT count(DISTINCT v.bvid) "+baseJoin+" WHERE positionCaseInsensitive(v.title, $1) > 0",
		query,
	).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count search videos for q=%s: %w", query, err)
	}

	rows, err := r.conn.Query(ctx, `
		SELECT v.snapshot_date, v.bvid, v.title, v.uploader_mid, v.uploader_name,
		       v.partition_id, v.partition_name, v.tags, v.view_count, v.danmaku_count,
		       v.reply_count, v.favorite_count, v.coin_count, v.share_count,
		       v.like_count, v.rank_position
	`+baseJoin+`
		WHERE positionCaseInsensitive(v.title, $1) > 0
		ORDER BY v.view_count DESC
		LIMIT 1 BY v.bvid
		LIMIT $2 OFFSET $3
	`, query, uint64(pageSize), uint64(offset))
	if err != nil {
		return nil, 0, fmt.Errorf("query search videos for q=%s: %w", query, err)
	}
	defer rows.Close()

	var result []model.VideoDailyStat
	for rows.Next() {
		var s model.VideoDailyStat
		if err := rows.Scan(
			&s.SnapshotDate, &s.Bvid, &s.Title, &s.UploaderMid, &s.UploaderName,
			&s.PartitionId, &s.PartitionName, &s.Tags, &s.ViewCount, &s.DanmakuCount,
			&s.ReplyCount, &s.FavoriteCount, &s.CoinCount, &s.ShareCount,
			&s.LikeCount, &s.RankPosition,
		); err != nil {
			return nil, 0, fmt.Errorf("scan search videos row: %w", err)
		}
		result = append(result, s)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate search videos rows: %w", err)
	}

	return result, int(total), nil
}

// SearchUploaders performs a full-text search across uploader_stats for
// uploaders whose name contains the query string (case-insensitive). It returns
// the latest stat for each matching uploader_mid, along with the total count
// for pagination.
func (r *StatsRepo) SearchUploaders(ctx context.Context, query string, page, pageSize int) ([]model.UploaderStat, int, error) {
	offset := (page - 1) * pageSize

	baseJoin := `
		FROM `+statsUploaderTable+` u
		INNER JOIN (
			SELECT uploader_mid, max(stat_date) AS max_date
			FROM `+statsUploaderTable+`
			GROUP BY uploader_mid
		) latest ON u.uploader_mid = latest.uploader_mid AND u.stat_date = latest.max_date
	`

	var total uint64
	if err := r.conn.QueryRow(ctx,
		"SELECT count(DISTINCT u.uploader_mid) "+baseJoin+" WHERE positionCaseInsensitive(u.uploader_name, $1) > 0",
		query,
	).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count search uploaders for q=%s: %w", query, err)
	}

	rows, err := r.conn.Query(ctx, `
		SELECT u.stat_date, u.uploader_mid, u.uploader_name, u.video_count,
		       u.total_views, u.total_likes, u.avg_views
	`+baseJoin+`
		WHERE positionCaseInsensitive(u.uploader_name, $1) > 0
		ORDER BY u.total_views DESC
		LIMIT 1 BY u.uploader_mid
		LIMIT $2 OFFSET $3
	`, query, uint64(pageSize), uint64(offset))
	if err != nil {
		return nil, 0, fmt.Errorf("query search uploaders for q=%s: %w", query, err)
	}
	defer rows.Close()

	var result []model.UploaderStat
	for rows.Next() {
		var s model.UploaderStat
		if err := rows.Scan(
			&s.StatDate, &s.UploaderMid, &s.UploaderName, &s.VideoCount,
			&s.TotalViews, &s.TotalLikes, &s.AvgViews,
		); err != nil {
			return nil, 0, fmt.Errorf("scan search uploaders row: %w", err)
		}
		result = append(result, s)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate search uploaders rows: %w", err)
	}

	return result, int(total), nil
}

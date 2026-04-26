package sync

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"bilibili-popular-video/internal/repository/ch"
	"bilibili-popular-video/internal/repository/pg"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Syncer struct {
	pgPool  *pgxpool.Pool
	pgSnap  *pg.SnapshotRepo
	chStats *ch.StatsRepo
	mu      sync.Mutex
}

func NewSyncer(pgPool *pgxpool.Pool, chStats *ch.StatsRepo) *Syncer {
	return &Syncer{
		pgPool:  pgPool,
		pgSnap:  pg.NewSnapshotRepo(pgPool),
		chStats: chStats,
	}
}

// SyncDaily reads snapshots and uploader stats for the given date from
// PostgreSQL and writes them into ClickHouse.
func (s *Syncer) SyncDaily(ctx context.Context, date time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	dateStr := date.Format(time.DateOnly)
	slog.Info("sync daily started", "date", dateStr)

	videoStats, err := s.pgSnap.GetSnapshotsForSync(ctx, date)
	if err != nil {
		return fmt.Errorf("read video snapshots from pg for %s: %w", dateStr, err)
	}
	slog.Info("sync: fetched video snapshots", "date", dateStr, "count", len(videoStats))

	if len(videoStats) > 0 {
		if err := s.chStats.DeleteDailyStats(ctx, date); err != nil {
			return fmt.Errorf("delete old video daily stats for %s: %w", dateStr, err)
		}
		if err := s.chStats.InsertDailyStats(ctx, videoStats); err != nil {
			return fmt.Errorf("insert video daily stats to ch for %s: %w", dateStr, err)
		}
		slog.Info("sync: replaced video daily stats", "date", dateStr, "count", len(videoStats))
	}

	uploaderStats, err := s.pgSnap.GetUploaderStatsForSync(ctx, date)
	if err != nil {
		return fmt.Errorf("read uploader stats from pg for %s: %w", dateStr, err)
	}
	slog.Info("sync: fetched uploader stats", "date", dateStr, "count", len(uploaderStats))

	if len(uploaderStats) > 0 {
		if err := s.chStats.DeleteUploaderStats(ctx, date); err != nil {
			return fmt.Errorf("delete old uploader stats for %s: %w", dateStr, err)
		}
		if err := s.chStats.InsertUploaderStats(ctx, uploaderStats); err != nil {
			return fmt.Errorf("insert uploader stats to ch for %s: %w", dateStr, err)
		}
		slog.Info("sync: replaced uploader stats", "date", dateStr, "count", len(uploaderStats))
	}

	slog.Info("sync daily completed", "date", dateStr,
		"videos", len(videoStats), "uploaders", len(uploaderStats))
	return nil
}

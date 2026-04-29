package crawler

import (
	"context"
	"log/slog"
	stdsync "sync"
	"time"

	"bilibili-popular-video/internal/notify"
	"bilibili-popular-video/internal/repository/ch"

	datasync "bilibili-popular-video/internal/sync"
)

// Scheduler runs periodic crawl tasks: an hourly ranking crawl and a daily
// supplementary crawl followed by a PG-to-ClickHouse sync.
type Scheduler struct {
	crawler      *BilibiliCrawler
	syncer       *datasync.Syncer
	notifier     *notify.Notifier
	statsRepo    *ch.StatsRepo
	intervalHour int
	dailyHour    int
}

// NewScheduler creates a scheduler that triggers ranking crawls every
// intervalHour hours and daily full crawls at dailyHour (0-23).
func NewScheduler(crawler *BilibiliCrawler, syncer *datasync.Syncer, notifier *notify.Notifier, statsRepo *ch.StatsRepo, intervalHour, dailyHour int) *Scheduler {
	return &Scheduler{
		crawler:      crawler,
		syncer:       syncer,
		notifier:     notifier,
		statsRepo:    statsRepo,
		intervalHour: intervalHour,
		dailyHour:    dailyHour,
	}
}

// Start launches the scheduling goroutines and blocks until the context is
// cancelled. It runs the hourly ranking crawler on a ticker and checks every
// minute whether the daily crawl should execute.
func (s *Scheduler) Start(ctx context.Context) {
	slog.Info("scheduler: starting", "interval_hours", s.intervalHour, "daily_hour", s.dailyHour)

	var wg stdsync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		s.runHourlyRanking(ctx)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		s.runDailyCrawl(ctx)
	}()

	wg.Wait()
	slog.Info("scheduler: stopped")
}

// sendDailyNotification builds a daily summary from ClickHouse and sends it to
// all configured notification channels. Failures are logged but never bubble up
// – the crawl pipeline must not be blocked by notification problems.
func (s *Scheduler) sendDailyNotification(ctx context.Context, date time.Time) {
	if s.notifier == nil || s.statsRepo == nil {
		return
	}

	slog.Info("scheduler: building daily notification summary", "date", date.Format("2006-01-02"))
	summary, err := notify.BuildDailySummary(ctx, s.statsRepo, date)
	if err != nil {
		slog.Warn("scheduler: failed to build daily summary for notification", "error", err, "date", date.Format("2006-01-02"))
		return
	}

	slog.Info("scheduler: sending daily notification",
		"date", date.Format("2006-01-02"),
		"videos", summary.TotalVideos,
		"views", summary.TotalViews,
	)
	if err := s.notifier.SendDailySummary(ctx, summary); err != nil {
		slog.Warn("scheduler: daily notification failed", "error", err)
	}
}

// runHourlyRanking executes the ranking crawl immediately once, then on a
// ticker at the configured interval until the context is cancelled.
func (s *Scheduler) runHourlyRanking(ctx context.Context) {
	// Run once immediately on startup.
	slog.Info("scheduler: executing initial ranking crawl")
	if err := s.crawler.CrawlRanking(ctx); err != nil {
		slog.Error("scheduler: initial ranking crawl failed", "error", err)
	}

	ticker := time.NewTicker(time.Duration(s.intervalHour) * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("scheduler: hourly ranking stopped")
			return
		case <-ticker.C:
			slog.Info("scheduler: scheduled ranking crawl starting")
			if err := s.crawler.CrawlRanking(ctx); err != nil {
				slog.Error("scheduler: ranking crawl failed", "error", err)
			}
		}
	}
}

// runDailyCrawl checks every minute whether the current hour matches
// dailyHour. When it matches and no crawl has run today, it triggers the daily
// full crawl and the PG-to-ClickHouse sync.
func (s *Scheduler) runDailyCrawl(ctx context.Context) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	var lastDailyDate time.Time

	for {
		select {
		case <-ctx.Done():
			slog.Info("scheduler: daily crawl stopped")
			return
		case <-ticker.C:
			now := time.Now()
			today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

			if now.Hour() == s.dailyHour && lastDailyDate.Before(today) {
				// Persistent guard: if daily data already exists in ClickHouse
				// (e.g. after a container restart within the same day), skip to
				// avoid sending duplicate notifications.
				if s.statsRepo != nil {
					hasData, err := s.statsRepo.HasDailyStats(ctx, today)
					if err != nil {
						slog.Warn("scheduler: failed to check existing daily data", "error", err)
					} else if hasData {
						slog.Info("scheduler: daily data already synced, skipping",
							"date", today.Format("2006-01-02"))
						lastDailyDate = today
						continue
					}
				}

				slog.Info("scheduler: daily full crawl starting")
				if err := s.crawler.CrawlDaily(ctx); err != nil {
					slog.Error("scheduler: daily crawl failed", "error", err)
					continue
				}

				if s.syncer != nil {
					slog.Info("scheduler: syncing daily data to clickhouse")
					if err := s.syncer.SyncDaily(ctx, today); err != nil {
						slog.Error("scheduler: sync daily failed", "error", err)
						continue
					} else {
						s.sendDailyNotification(ctx, today)
					}
				}

				lastDailyDate = today
			}
		}
	}
}

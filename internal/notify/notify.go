// Package notify sends daily summary notifications to configured channels
// (Telegram, DingTalk, Feishu). It uses only stdlib net/http – no external dependencies.
package notify

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"bilibili-popular-video/internal/config"
	"bilibili-popular-video/internal/repository/ch"
)

// DailySummary holds the aggregated data for a single day's notification.
type DailySummary struct {
	Date            time.Time
	TotalVideos     int
	TotalViews      int64
	TopVideos       []VideoSummary
	TopUploaders    []UploaderSummary
}

// VideoSummary is a lightweight view of a top video for notifications.
type VideoSummary struct {
	Title string
	Bvid  string
	Views int64
}

// UploaderSummary is a lightweight view of a top uploader for notifications.
type UploaderSummary struct {
	Name       string
	TotalViews int64
}

// Notifier sends daily summary notifications to all configured channels.
type Notifier struct {
	telegram *TelegramNotifier
	dingtalk *DingTalkNotifier
	feishu   *FeishuNotifier
}

// NewNotifier creates a Notifier from config. Channels with missing credentials
// are silently disabled.
func NewNotifier(cfg *config.Config) *Notifier {
	n := &Notifier{}
	if cfg.Notify.TelegramBotToken != "" && cfg.Notify.TelegramChatID != "" {
		n.telegram = NewTelegramNotifier(cfg.Notify.TelegramBotToken, cfg.Notify.TelegramChatID)
	}
	if cfg.Notify.DingTalkWebhook != "" {
		n.dingtalk = NewDingTalkNotifier(cfg.Notify.DingTalkWebhook)
	}
	if cfg.Notify.FeishuWebhook != "" {
		n.feishu = NewFeishuNotifier(cfg.Notify.FeishuWebhook, cfg.Notify.FeishuSecret)
	}
	return n
}

// SendDailySummary sends the summary to every configured channel. Errors from
// individual channels are logged but do not fail the overall call – notification
// failures must never block the crawl pipeline.
func (n *Notifier) SendDailySummary(ctx context.Context, stats *DailySummary) error {
	if n == nil {
		return nil
	}

	var lastErr error
	if n.telegram != nil {
		if err := n.telegram.Send(ctx, stats); err != nil {
			slog.Warn("notify: telegram send failed", "error", err)
			lastErr = err
		}
	}
	if n.dingtalk != nil {
		if err := n.dingtalk.Send(ctx, stats); err != nil {
			slog.Warn("notify: dingtalk send failed", "error", err)
			lastErr = err
		}
	}
	if n.feishu != nil {
		if err := n.feishu.Send(ctx, stats); err != nil {
			slog.Warn("notify: feishu send failed", "error", err)
			lastErr = err
		}
	}
	if lastErr != nil {
		return fmt.Errorf("notify: one or more channels failed: %w", lastErr)
	}
	return nil
}

// BuildDailySummary queries ClickHouse for the given date and assembles a
// DailySummary suitable for notification delivery.
func BuildDailySummary(ctx context.Context, statsRepo *ch.StatsRepo, date time.Time) (*DailySummary, error) {
	// Overview (total videos, total views)
	overview, err := statsRepo.GetOverview(ctx, date)
	if err != nil {
		return nil, fmt.Errorf("query overview: %w", err)
	}

	totalVideos, _ := overview["total_videos"].(int)
	totalViewsVal, _ := overview["total_views"].(int)
	totalViews := int64(totalViewsVal)

	// Top 5 videos by views
	topVideos, _, err := statsRepo.GetRanking(ctx, date, 0, 1, 5)
	if err != nil {
		return nil, fmt.Errorf("query top videos: %w", err)
	}

	var videos []VideoSummary
	for _, v := range topVideos {
		videos = append(videos, VideoSummary{
			Title: v.Title,
			Bvid:  v.Bvid,
			Views: v.ViewCount,
		})
	}

	// Top 3 uploaders by total views
	topUploaders, _, err := statsRepo.GetTopUploaders(ctx, date, "total_views", 1, 3)
	if err != nil {
		return nil, fmt.Errorf("query top uploaders: %w", err)
	}

	var uploaders []UploaderSummary
	for _, u := range topUploaders {
		uploaders = append(uploaders, UploaderSummary{
			Name:       u.UploaderName,
			TotalViews: u.TotalViews,
		})
	}

	return &DailySummary{
		Date:         date,
		TotalVideos:  totalVideos,
		TotalViews:   totalViews,
		TopVideos:    videos,
		TopUploaders: uploaders,
	}, nil
}

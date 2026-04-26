package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const telegramAPI = "https://api.telegram.org/bot%s/sendMessage"

// TelegramNotifier sends markdown-formatted messages via the Telegram Bot API.
type TelegramNotifier struct {
	botToken string
	chatID   string
	client   *http.Client
}

func NewTelegramNotifier(botToken, chatID string) *TelegramNotifier {
	return &TelegramNotifier{
		botToken: botToken,
		chatID:   chatID,
		client:   &http.Client{Timeout: 10 * time.Second},
	}
}

type telegramRequest struct {
	ChatID    string `json:"chat_id"`
	Text      string `json:"text"`
	ParseMode string `json:"parse_mode"`
}

func (t *TelegramNotifier) Send(ctx context.Context, stats *DailySummary) error {
	text := formatMarkdown(stats)
	body := telegramRequest{
		ChatID:    t.chatID,
		Text:      text,
		ParseMode: "MarkdownV2",
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal telegram request: %w", err)
	}

	url := fmt.Sprintf(telegramAPI, t.botToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create telegram request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := t.client.Do(req)
	if err != nil {
		return fmt.Errorf("send telegram request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("telegram api returned status %d", resp.StatusCode)
	}
	return nil
}

func formatMarkdown(stats *DailySummary) string {
	var b strings.Builder
	dateStr := stats.Date.Format("2006-01-02")

	fmt.Fprintf(&b, "*📊 B站热门日报 %s*\n\n", dateStr)
	fmt.Fprintf(&b, "*总视频数:* %d\n", stats.TotalVideos)
	fmt.Fprintf(&b, "*总播放量:* %s\n\n", formatNumber(stats.TotalViews))

	if len(stats.TopVideos) > 0 {
		fmt.Fprintf(&b, "*🔥 热门视频 Top %d*\n", len(stats.TopVideos))
		for i, v := range stats.TopVideos {
			title := escapeMarkdownV2(v.Title)
			fmt.Fprintf(&b, "%d\\. %s\n  `%s` 播放 %s\n",
				i+1, title, v.Bvid, formatNumber(v.Views))
		}
		b.WriteString("\n")
	}

	if len(stats.TopUploaders) > 0 {
		fmt.Fprintf(&b, "*👤 高产UP主 Top %d*\n", len(stats.TopUploaders))
		for i, u := range stats.TopUploaders {
			name := escapeMarkdownV2(u.Name)
			fmt.Fprintf(&b, "%d\\. %s  — 总播放 %s\n",
				i+1, name, formatNumber(u.TotalViews))
		}
	}

	return b.String()
}

func formatNumber(n int64) string {
	if n < 10_000 {
		return fmt.Sprintf("%d", n)
	}
	if n < 100_000_000 {
		wan := float64(n) / 10_000.0
		return fmt.Sprintf("%.1f万", wan)
	}
	yi := float64(n) / 100_000_000.0
	return fmt.Sprintf("%.2f亿", yi)
}

func escapeMarkdownV2(s string) string {
	special := []string{"_", "*", "[", "]", "(", ")", "~", "`", ">", "#", "+", "-", "=", "|", "{", "}", ".", "!"}
	for _, ch := range special {
		s = strings.ReplaceAll(s, ch, "\\"+ch)
	}
	return s
}

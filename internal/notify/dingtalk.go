package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// DingTalkNotifier sends markdown-formatted messages via a DingTalk webhook.
type DingTalkNotifier struct {
	webhook string
	client  *http.Client
}

func NewDingTalkNotifier(webhook string) *DingTalkNotifier {
	return &DingTalkNotifier{
		webhook: webhook,
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

type dingTalkMarkdown struct {
	Title string `json:"title"`
	Text  string `json:"text"`
}

type dingTalkRequest struct {
	MsgType  string            `json:"msgtype"`
	Markdown dingTalkMarkdown  `json:"markdown"`
}

func (d *DingTalkNotifier) Send(ctx context.Context, stats *DailySummary) error {
	dateStr := stats.Date.Format("2006-01-02")
	text := formatDingTalkMarkdown(stats)
	title := fmt.Sprintf("B站热门日报 %s", dateStr)

	body := dingTalkRequest{
		MsgType: "markdown",
		Markdown: dingTalkMarkdown{
			Title: title,
			Text:  text,
		},
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal dingtalk request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, d.webhook, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create dingtalk request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.client.Do(req)
	if err != nil {
		return fmt.Errorf("send dingtalk request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("dingtalk webhook returned status %d", resp.StatusCode)
	}
	return nil
}

func formatDingTalkMarkdown(stats *DailySummary) string {
	var b bytes.Buffer
	dateStr := stats.Date.Format("2006-01-02")

	fmt.Fprintf(&b, "### 📊 B站热门日报 %s\n\n", dateStr)
	fmt.Fprintf(&b, "- 总视频数：%d\n", stats.TotalVideos)
	fmt.Fprintf(&b, "- 总播放量：%s\n\n", formatNumber(stats.TotalViews))

	if len(stats.TopVideos) > 0 {
		fmt.Fprintf(&b, "#### 🔥 热门视频 Top %d\n\n", len(stats.TopVideos))
		for i, v := range stats.TopVideos {
			fmt.Fprintf(&b, "%d. %s\n", i+1, v.Title)
			fmt.Fprintf(&b, "   - BV号：`%s`\n", v.Bvid)
			fmt.Fprintf(&b, "   - 播放量：%s\n\n", formatNumber(v.Views))
		}
	}

	if len(stats.TopUploaders) > 0 {
		fmt.Fprintf(&b, "#### 👤 高产UP主 Top %d\n\n", len(stats.TopUploaders))
		for i, u := range stats.TopUploaders {
			fmt.Fprintf(&b, "%d. **%s** — 总播放 %s\n\n", i+1, u.Name, formatNumber(u.TotalViews))
		}
	}

	return b.String()
}

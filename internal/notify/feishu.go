package notify

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

type FeishuNotifier struct {
	webhook string
	secret  string
	client  *http.Client
}

func NewFeishuNotifier(webhook, secret string) *FeishuNotifier {
	return &FeishuNotifier{
		webhook: webhook,
		secret:  secret,
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

type feishuCardHeader struct {
	Title    feishuPlainText `json:"title"`
	Template string          `json:"template"`
}

type feishuPlainText struct {
	Tag     string `json:"tag"`
	Content string `json:"content"`
}

type feishuLarkMd struct {
	Tag     string `json:"tag"`
	Content string `json:"content"`
}

type feishuCardElement struct {
	Tag  string        `json:"tag"`
	Text feishuLarkMd  `json:"text"`
}

type feishuCard struct {
	Header   feishuCardHeader    `json:"header"`
	Elements []feishuCardElement `json:"elements"`
}

type feishuRequest struct {
	Timestamp string     `json:"timestamp,omitempty"`
	Sign      string     `json:"sign,omitempty"`
	MsgType   string     `json:"msg_type"`
	Card      feishuCard `json:"card"`
}

func (f *FeishuNotifier) Send(ctx context.Context, stats *DailySummary) error {
	dateStr := stats.Date.Format("2006-01-02")

	body := feishuRequest{
		MsgType: "interactive",
		Card: feishuCard{
			Header: feishuCardHeader{
				Title: feishuPlainText{
					Tag:     "plain_text",
					Content: fmt.Sprintf("📊 B站热门日报 %s", dateStr),
				},
				Template: "blue",
			},
			Elements: []feishuCardElement{
				{
					Tag: "div",
					Text: feishuLarkMd{
						Tag:     "lark_md",
						Content: formatFeishuMarkdown(stats),
					},
				},
			},
		},
	}

	if f.secret != "" {
		timestamp := strconv.FormatInt(time.Now().Unix(), 10)
		body.Timestamp = timestamp
		body.Sign = signFeishu(timestamp, f.secret)
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal feishu request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, f.webhook, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create feishu request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := f.client.Do(req)
	if err != nil {
		return fmt.Errorf("send feishu request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("feishu webhook returned status %d", resp.StatusCode)
	}
	return nil
}

func signFeishu(timestamp, secret string) string {
	// Feishu uses stringToSign as the HMAC key and signs an empty message.
	// This is NOT the conventional HMAC usage — see official Feishu docs.
	stringToSign := timestamp + "\n" + secret
	h := hmac.New(sha256.New, []byte(stringToSign))
	h.Write([]byte{})
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

func formatFeishuMarkdown(stats *DailySummary) string {
	dateStr := stats.Date.Format("2006-01-02")

	var b bytes.Buffer
	fmt.Fprintf(&b, "**📅 日期：%s**\n\n", dateStr)
	fmt.Fprintf(&b, "总视频数：**%d**\n", stats.TotalVideos)
	fmt.Fprintf(&b, "总播放量：**%s**\n\n", formatNumber(stats.TotalViews))

	if len(stats.TopVideos) > 0 {
		fmt.Fprintf(&b, "**🔥 热门视频 Top %d**\n\n", len(stats.TopVideos))
		for i, v := range stats.TopVideos {
			fmt.Fprintf(&b, "%d. %s\n", i+1, v.Title)
			fmt.Fprintf(&b, "    BV号：`%s`　播放：%s\n\n", v.Bvid, formatNumber(v.Views))
		}
	}

	if len(stats.TopUploaders) > 0 {
		fmt.Fprintf(&b, "**👤 高产UP主 Top %d**\n\n", len(stats.TopUploaders))
		for i, u := range stats.TopUploaders {
			fmt.Fprintf(&b, "%d. **%s** — 总播放 %s\n\n", i+1, u.Name, formatNumber(u.TotalViews))
		}
	}

	return b.String()
}

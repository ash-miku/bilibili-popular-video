// Package crawler implements the Bilibili API client and crawl orchestration
// for collecting popular video ranking data, tags, and uploader information.
package crawler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"bilibili-popular-video/internal/model"
	"bilibili-popular-video/internal/repository/pg"
)

// ---------------------------------------------------------------------------
// Bilibili API response structs (local to this package)
// ---------------------------------------------------------------------------

// biliResponse is the common envelope for all Bilibili API responses.
type biliResponse struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

type popularResponse struct {
	List   []rankingItem `json:"list"`
	NoMore bool          `json:"no_more"`
}

type rankingItem struct {
	Aid      int64         `json:"aid"`
	Bvid     string        `json:"bvid"`
	Title    string        `json:"title"`
	Pic      string        `json:"pic"`
	Desc     string        `json:"desc"`
	Duration int           `json:"duration"`
	Pubdate  int64         `json:"pubdate"`
	Tid      int           `json:"tid"`
	Tname    string        `json:"tname"`
	TidV2    int           `json:"tidv2"`
	TnameV2  string        `json:"tnamev2"`
	Owner    rankingOwner  `json:"owner"`
	Stat     rankingStat   `json:"stat"`
}

type rankingOwner struct {
	Mid  int64  `json:"mid"`
	Name string `json:"name"`
	Face string `json:"face"`
}

type rankingStat struct {
	View     int64 `json:"view"`
	Danmaku  int   `json:"danmaku"`
	Reply    int   `json:"reply"`
	Favorite int   `json:"favorite"`
	Coin     int   `json:"coin"`
	Share    int   `json:"share"`
	Like     int   `json:"like"`
	NowRank  int   `json:"now_rank"`
}

type tagResponse []tagItem

type tagItem struct {
	TagName string `json:"tag_name"`
}

type cardResponse struct {
	Card         cardData `json:"card"`
	ArchiveCount int      `json:"archive_count"`
	Follower     int      `json:"follower"`
}

type cardData struct {
	Mid  string `json:"mid"`
	Name string `json:"name"`
	Face string `json:"face"`
	Fans int    `json:"fans"`
}

// ---------------------------------------------------------------------------
// BilibiliCrawler
// ---------------------------------------------------------------------------

const (
	popularAPIURL  = "https://api.bilibili.com/x/web-interface/popular"
	tagsAPIURL     = "https://api.bilibili.com/x/tag/archive/tags"
	userCardAPIURL = "https://api.bilibili.com/x/web-interface/card"

	userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

	maxRetries     = 3
	retryBaseDelay = 2 * time.Second
)

// BilibiliCrawler handles all HTTP interactions with Bilibili APIs and persists
// crawled data through the PostgreSQL repository layer.
type BilibiliCrawler struct {
	client       *http.Client
	videoRepo    *pg.VideoRepo
	uploaderRepo *pg.UploaderRepo
	delayMs      int
}

// NewBilibiliCrawler creates a crawler with the given repositories and inter-request
// delay in milliseconds.
func NewBilibiliCrawler(videoRepo *pg.VideoRepo, uploaderRepo *pg.UploaderRepo, delayMs int) *BilibiliCrawler {
	return &BilibiliCrawler{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		videoRepo:    videoRepo,
		uploaderRepo: uploaderRepo,
		delayMs:      delayMs,
	}
}

// ---------------------------------------------------------------------------
// API fetch methods
// ---------------------------------------------------------------------------

func (c *BilibiliCrawler) FetchPopular(ctx context.Context, pn, ps int) ([]rankingItem, error) {
	url := fmt.Sprintf("%s?pn=%d&ps=%d", popularAPIURL, pn, ps)

	var body []byte
	err := retry(ctx, maxRetries, retryBaseDelay, func() error {
		var reqErr error
		body, reqErr = c.doGet(ctx, url)
		return reqErr
	})
	if err != nil {
		return nil, fmt.Errorf("fetch popular pn=%d: %w", pn, err)
	}

	var resp biliResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("parse popular response pn=%d: %w", pn, err)
	}
	if resp.Code != 0 {
		return nil, fmt.Errorf("popular api error pn=%d: code=%d message=%s", pn, resp.Code, resp.Message)
	}

	var pop popularResponse
	if err := json.Unmarshal(resp.Data, &pop); err != nil {
		return nil, fmt.Errorf("parse popular data pn=%d: %w", pn, err)
	}
	return pop.List, nil
}

// FetchTags retrieves the tag names for a video identified by its bvid.
func (c *BilibiliCrawler) FetchTags(ctx context.Context, bvid string) ([]string, error) {
	url := fmt.Sprintf("%s?bvid=%s", tagsAPIURL, bvid)

	var body []byte
	err := retry(ctx, maxRetries, retryBaseDelay, func() error {
		var reqErr error
		body, reqErr = c.doGet(ctx, url)
		return reqErr
	})
	if err != nil {
		return nil, fmt.Errorf("fetch tags bvid=%s: %w", bvid, err)
	}

	var resp biliResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("parse tags response bvid=%s: %w", bvid, err)
	}
	if resp.Code != 0 {
		return nil, fmt.Errorf("tags api error bvid=%s: code=%d message=%s", bvid, resp.Code, resp.Message)
	}

	var tags tagResponse
	if err := json.Unmarshal(resp.Data, &tags); err != nil {
		return nil, fmt.Errorf("parse tags data bvid=%s: %w", bvid, err)
	}

	names := make([]string, 0, len(tags))
	for _, t := range tags {
		if t.TagName != "" {
			names = append(names, t.TagName)
		}
	}
	return names, nil
}

// FetchUploaderInfo retrieves the uploader profile for the given mid and maps it
// to a model.Uploader. Note that the card API returns mid as a string.
func (c *BilibiliCrawler) FetchUploaderInfo(ctx context.Context, mid int64) (*model.Uploader, error) {
	url := fmt.Sprintf("%s?mid=%d", userCardAPIURL, mid)

	var body []byte
	err := retry(ctx, maxRetries, retryBaseDelay, func() error {
		var reqErr error
		body, reqErr = c.doGet(ctx, url)
		return reqErr
	})
	if err != nil {
		return nil, fmt.Errorf("fetch uploader mid=%d: %w", mid, err)
	}

	var resp biliResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("parse uploader response mid=%d: %w", mid, err)
	}
	if resp.Code != 0 {
		return nil, fmt.Errorf("uploader api error mid=%d: code=%d message=%s", mid, resp.Code, resp.Message)
	}

	var card cardResponse
	if err := json.Unmarshal(resp.Data, &card); err != nil {
		return nil, fmt.Errorf("parse uploader data mid=%d: %w", mid, err)
	}

	// card.Card.Mid is a string; parse to int64.
	parsedMid, err := strconv.ParseInt(card.Card.Mid, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("parse uploader mid from card %q: %w", card.Card.Mid, err)
	}

	return &model.Uploader{
		Mid:        parsedMid,
		Name:       card.Card.Name,
		FaceUrl:    card.Card.Face,
		FansCount:  card.Card.Fans,
		VideoCount: card.ArchiveCount,
		UpdatedAt:  time.Now(),
	}, nil
}

// ---------------------------------------------------------------------------
// Crawl orchestration
// ---------------------------------------------------------------------------

// CrawlRanking performs a full hourly ranking crawl across all configured
// partitions. For each video it upserts the record and inserts a snapshot for
// today's date.
func (c *BilibiliCrawler) CrawlRanking(ctx context.Context) error {
	slog.Info("crawl ranking: starting popular video crawl")
	today := time.Now().Truncate(24 * time.Hour)
	totalVideos := 0

	for pn := 1; pn <= 5; pn++ {
		slog.Info("crawl ranking: fetching popular page", "pn", pn)

		items, err := c.FetchPopular(ctx, pn, 20)
		if err != nil {
			slog.Error("crawl ranking: failed to fetch popular page", "pn", pn, "error", err)
			continue
		}
		if len(items) == 0 {
			slog.Info("crawl ranking: no more results", "pn", pn)
			break
		}

		for i, item := range items {
			partitionID := item.TidV2
			partitionName := item.TnameV2
			if partitionID == 0 {
				partitionID = item.Tid
				partitionName = item.Tname
			}

			video := &model.Video{
				Bvid:          item.Bvid,
				Aid:           item.Aid,
				Title:         item.Title,
				Description:   item.Desc,
				UploaderMid:   item.Owner.Mid,
				UploaderName:  item.Owner.Name,
				PartitionId:   partitionID,
				PartitionName: partitionName,
				CoverUrl:      item.Pic,
				Duration:      item.Duration,
				PubTime:       time.Unix(item.Pubdate, 0),
			}

			if err := c.videoRepo.UpsertVideo(ctx, video); err != nil {
				slog.Error("crawl ranking: upsert video failed", "bvid", item.Bvid, "error", err)
				continue
			}

			rank := (pn-1)*20 + i + 1
			snapshot := &model.VideoSnapshot{
				Bvid:          item.Bvid,
				SnapshotDate:  today,
				ViewCount:     item.Stat.View,
				DanmakuCount:  item.Stat.Danmaku,
				ReplyCount:    item.Stat.Reply,
				FavoriteCount: item.Stat.Favorite,
				CoinCount:     item.Stat.Coin,
				ShareCount:    item.Stat.Share,
				LikeCount:     item.Stat.Like,
				RankPosition:  rank,
			}

			if err := c.videoRepo.InsertSnapshot(ctx, snapshot); err != nil {
				slog.Error("crawl ranking: insert snapshot failed", "bvid", item.Bvid, "error", err)
			}

			totalVideos++
			c.randomDelay(ctx)
		}

		c.randomDelay(ctx)
	}

	slog.Info("crawl ranking: completed", "total_videos", totalVideos)
	return nil
}

// CrawlDaily performs the daily supplementary crawl: refreshes tags for every
// stored video, takes a new snapshot, and updates uploader profiles.
func (c *BilibiliCrawler) CrawlDaily(ctx context.Context) error {
	slog.Info("crawl daily: starting full daily crawl")
	today := time.Now().Truncate(24 * time.Hour)

	// Phase 1: Refresh tags and snapshots for all known videos.
	bvids, err := c.videoRepo.GetAllBvids(ctx)
	if err != nil {
		return fmt.Errorf("crawl daily: get all bvids: %w", err)
	}
	slog.Info("crawl daily: fetched bvid list", "count", len(bvids))

	for _, bvid := range bvids {
		tags, err := c.FetchTags(ctx, bvid)
		if err != nil {
			slog.Error("crawl daily: fetch tags failed", "bvid", bvid, "error", err)
			c.randomDelay(ctx)
			continue
		}

		tagsJSON, err := json.Marshal(tags)
		if err != nil {
			slog.Error("crawl daily: marshal tags failed", "bvid", bvid, "error", err)
			c.randomDelay(ctx)
			continue
		}

		// Re-fetch the video to preserve all fields, then update tags via upsert.
		video, err := c.videoRepo.GetVideoByBvid(ctx, bvid)
		if err != nil {
			slog.Error("crawl daily: get video failed", "bvid", bvid, "error", err)
			c.randomDelay(ctx)
			continue
		}
		video.Tags = tagsJSON

		if err := c.videoRepo.UpsertVideo(ctx, video); err != nil {
			slog.Error("crawl daily: update tags failed", "bvid", bvid, "error", err)
		}

		// Insert a daily snapshot with current stats from ranking if available.
		// The ranking crawl may have already inserted today's snapshot, so we
		// rely on the ON CONFLICT DO NOTHING in InsertSnapshot.
		snapshot := &model.VideoSnapshot{
			Bvid:         bvid,
			SnapshotDate: today,
		}
		if err := c.videoRepo.InsertSnapshot(ctx, snapshot); err != nil {
			slog.Error("crawl daily: insert snapshot failed", "bvid", bvid, "error", err)
		}

		c.randomDelay(ctx)
	}

	// Phase 2: Collect unique uploader MIDs from all videos and refresh their info.
	uploaderMids, err := c.collectUniqueUploaderMids(ctx, bvids)
	if err != nil {
		slog.Error("crawl daily: collect uploader mids failed", "error", err)
	} else {
		slog.Info("crawl daily: refreshing uploader info", "count", len(uploaderMids))
		for _, mid := range uploaderMids {
			uploader, err := c.FetchUploaderInfo(ctx, mid)
			if err != nil {
				slog.Error("crawl daily: fetch uploader failed", "mid", mid, "error", err)
				c.randomDelay(ctx)
				continue
			}
			if err := c.uploaderRepo.UpsertUploader(ctx, uploader); err != nil {
				slog.Error("crawl daily: upsert uploader failed", "mid", mid, "error", err)
			}
			c.randomDelay(ctx)
		}
	}

	slog.Info("crawl daily: completed")
	return nil
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// collectUniqueUploaderMids retrieves the unique set of uploader MIDs for the
// given bvids by looking up each video record.
func (c *BilibiliCrawler) collectUniqueUploaderMids(ctx context.Context, bvids []string) ([]int64, error) {
	seen := make(map[int64]struct{}, len(bvids))
	for _, bvid := range bvids {
		video, err := c.videoRepo.GetVideoByBvid(ctx, bvid)
		if err != nil {
			continue
		}
		seen[video.UploaderMid] = struct{}{}
	}

	mids := make([]int64, 0, len(seen))
	for mid := range seen {
		mids = append(mids, mid)
	}
	return mids, nil
}

// doGet performs an HTTP GET with the configured User-Agent and returns the
// response body. The request respects context cancellation.
func (c *BilibiliCrawler) doGet(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("User-Agent", userAgent)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}
	return body, nil
}

// randomDelay sleeps for a random duration between 200ms and the configured
// delayMs, respecting context cancellation. Falls back to 200-500ms if delayMs
// is unset or zero.
func (c *BilibiliCrawler) randomDelay(ctx context.Context) {
	minDelay := 200
	maxDelay := c.delayMs
	if maxDelay <= minDelay {
		maxDelay = 500
	}
	ms := minDelay + rand.Intn(maxDelay-minDelay+1)
	delay := time.Duration(ms) * time.Millisecond

	select {
	case <-ctx.Done():
	case <-time.After(delay):
	}
}

// retry executes fn up to maxAttempts times with exponential back-off. It
// returns immediately on success or context cancellation.
func retry(ctx context.Context, maxAttempts int, baseDelay time.Duration, fn func() error) error {
	var lastErr error
	for attempt := 0; attempt < maxAttempts; attempt++ {
		if err := ctx.Err(); err != nil {
			return err
		}
		if err := fn(); err != nil {
			lastErr = err
			backoff := baseDelay << attempt // 2^attempt * baseDelay
			slog.Warn("retry: attempt failed, backing off",
				"attempt", attempt+1,
				"max", maxAttempts,
				"backoff", backoff,
				"error", err,
			)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(backoff):
				continue
			}
		}
		return nil
	}
	return fmt.Errorf("retry exhausted after %d attempts: %w", maxAttempts, lastErr)
}

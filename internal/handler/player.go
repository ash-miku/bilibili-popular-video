package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"bilibili-popular-video/internal/config"

	"github.com/gin-gonic/gin"
)

type PlayerHandler struct {
	cfg    *config.Config
	client *http.Client
	cache  *videoCache
}

type videoCache struct {
	mu    sync.RWMutex
	locks map[string]*sync.Mutex
	dir   string
}

func newVideoCache() *videoCache {
	dir := os.TempDir() + "/bili-video-cache"
	os.MkdirAll(dir, 0755)
	go func() {
		for {
			time.Sleep(10 * time.Minute)
			cleanCacheDir(dir, 30*time.Minute)
		}
	}()
	return &videoCache{locks: make(map[string]*sync.Mutex), dir: dir}
}

func cleanCacheDir(dir string, maxAge time.Duration) {
	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		info, err := e.Info()
		if err != nil {
			continue
		}
		if time.Since(info.ModTime()) > maxAge {
			os.Remove(filepath.Join(dir, e.Name()))
		}
	}
}

func (vc *videoCache) getLock(key string) *sync.Mutex {
	vc.mu.Lock()
	defer vc.mu.Unlock()
	if _, ok := vc.locks[key]; !ok {
		vc.locks[key] = &sync.Mutex{}
	}
	return vc.locks[key]
}

func (vc *videoCache) path(bvid string, qn int) string {
	return filepath.Join(vc.dir, fmt.Sprintf("%s_q%d.mp4", bvid, qn))
}

func NewPlayerHandler(cfg *config.Config) *PlayerHandler {
	return &PlayerHandler{
		cfg:    cfg,
		client: &http.Client{Timeout: 15 * time.Second},
		cache:  newVideoCache(),
	}
}

func (h *PlayerHandler) GetVideoInfo(c *gin.Context) {
	bvid := c.Query("bvid")
	if bvid == "" {
		fail(c, 400, "missing bvid")
		return
	}

	if h.cfg.Bilibili.SESSDATA == "" {
		fail(c, 403, "未配置B站Cookie，无法播放高清视频")
		return
	}

	cid, aid, duration, err := h.fetchCid(bvid)
	if err != nil {
		slog.Error("fetch cid failed", "bvid", bvid, "error", err)
		fail(c, 500, "获取视频CID失败: "+err.Error())
		return
	}

	success(c, gin.H{
		"bvid":     bvid,
		"aid":      aid,
		"cid":      cid,
		"duration": duration,
	})
}

func (h *PlayerHandler) StreamVideo(c *gin.Context) {
	bvid := c.Query("bvid")
	if bvid == "" {
		fail(c, 400, "missing bvid")
		return
	}
	if h.cfg.Bilibili.SESSDATA == "" {
		fail(c, 403, "未配置B站Cookie")
		return
	}

	qn := 80
	if q, err := strconv.Atoi(c.Query("qn")); err == nil && q > 0 {
		qn = q
	}

	cachePath := h.cache.path(bvid, qn)

	if info, err := os.Stat(cachePath); err == nil && info.Size() > 0 {
		c.Header("Content-Type", "video/mp4")
		c.Header("Cache-Control", "public, max-age=1800")
		http.ServeFile(c.Writer, c.Request, cachePath)
		return
	}

	lock := h.cache.getLock(fmt.Sprintf("%s_q%d", bvid, qn))
	lock.Lock()
	defer lock.Unlock()

	if info, err := os.Stat(cachePath); err == nil && info.Size() > 0 {
		c.Header("Content-Type", "video/mp4")
		c.Header("Cache-Control", "public, max-age=1800")
		http.ServeFile(c.Writer, c.Request, cachePath)
		return
	}

	cid, aid, _, err := h.fetchCid(bvid)
	if err != nil {
		slog.Error("stream: fetch cid failed", "bvid", bvid, "error", err)
		fail(c, 500, "获取视频信息失败")
		return
	}

	videoURL, audioURL, err := h.fetchDASHURLs(aid, cid, qn)
	if err != nil {
		slog.Error("stream: fetch dash urls failed", "bvid", bvid, "error", err)
		fail(c, 500, "获取视频流失败: "+err.Error())
		return
	}

	proxyBase := fmt.Sprintf("http://127.0.0.1:%d/api/v1/player/proxy?url=", h.cfg.Server.Port)
	proxyVideo := proxyBase + encodeURIComponent(videoURL)
	proxyAudio := proxyBase + encodeURIComponent(audioURL)

	tmpPath := cachePath + ".tmp"
	defer os.Remove(tmpPath)

	ffmpegPath := "/app/bin/ffmpeg"
	args := []string{
		"-i", proxyVideo,
		"-i", proxyAudio,
		"-c:v", "copy",
		"-c:a", "copy",
		"-movflags", "+faststart",
		"-f", "mp4",
		"-loglevel", "warning",
		"-y",
		tmpPath,
	}

	cmd := exec.Command(ffmpegPath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		slog.Error("stream: ffmpeg failed", "error", err, "output", string(output))
		fail(c, 500, "视频转码失败")
		return
	}

	if err := os.Rename(tmpPath, cachePath); err != nil {
		slog.Error("stream: rename failed", "error", err)
		fail(c, 500, "缓存写入失败")
		return
	}

	c.Header("Content-Type", "video/mp4")
	c.Header("Cache-Control", "public, max-age=1800")
	http.ServeFile(c.Writer, c.Request, cachePath)
}

func (h *PlayerHandler) ProxyURL(c *gin.Context) {
	targetURL := c.Query("url")
	if targetURL == "" {
		c.Status(400)
		return
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, targetURL, nil)
	if err != nil {
		c.Status(500)
		return
	}
	req.Header.Set("Referer", "https://www.bilibili.com")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := h.client.Do(req)
	if err != nil {
		slog.Error("proxy: fetch failed", "error", err)
		c.Status(502)
		return
	}
	defer resp.Body.Close()

	for key, values := range resp.Header {
		for _, value := range values {
			c.Writer.Header().Add(key, value)
		}
	}
	c.Writer.WriteHeader(resp.StatusCode)
	io.Copy(c.Writer, resp.Body)
}

func (h *PlayerHandler) fetchCid(bvid string) (cid int64, aid int64, duration int64, err error) {
	url := fmt.Sprintf("https://api.bilibili.com/x/web-interface/view?bvid=%s", bvid)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	req.Header.Set("Cookie", fmt.Sprintf("SESSDATA=%s", h.cfg.Bilibili.SESSDATA))

	resp, err := h.client.Do(req)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("request view api: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("read view response: %w", err)
	}

	var result struct {
		Code int `json:"code"`
		Data struct {
			Aid      int64 `json:"aid"`
			Cid      int64 `json:"cid"`
			Duration int64 `json:"duration"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return 0, 0, 0, fmt.Errorf("parse view response: %w", err)
	}
	if result.Code != 0 {
		return 0, 0, 0, fmt.Errorf("view api code=%d", result.Code)
	}
	return result.Data.Cid, result.Data.Aid, result.Data.Duration, nil
}

func (h *PlayerHandler) fetchDASHURLs(aid, cid int64, qn int) (videoURL, audioURL string, err error) {
	url := fmt.Sprintf(
		"https://api.bilibili.com/x/player/playurl?avid=%d&cid=%d&qn=%d&fnver=0&fnval=16&fourk=1",
		aid, cid, qn,
	)

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	req.Header.Set("Referer", "https://www.bilibili.com")
	req.Header.Set("Cookie", fmt.Sprintf("SESSDATA=%s", h.cfg.Bilibili.SESSDATA))

	resp, err := h.client.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("request playurl: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", fmt.Errorf("read playurl: %w", err)
	}

	var result struct {
		Code int `json:"code"`
		Data struct {
			Quality       int   `json:"quality"`
			AcceptQuality []int `json:"accept_quality"`
			Dash          *struct {
				Video []struct {
					ID        int      `json:"id"`
					BaseURL   string   `json:"baseUrl"`
					BackupURL []string `json:"backupUrl"`
					Codecs    string   `json:"codecs"`
					Bandwidth int64    `json:"bandwidth"`
				} `json:"video"`
				Audio []struct {
					ID        int      `json:"id"`
					BaseURL   string   `json:"baseUrl"`
					BackupURL []string `json:"backupUrl"`
					Codecs    string   `json:"codecs"`
					Bandwidth int64    `json:"bandwidth"`
				} `json:"audio"`
			} `json:"dash"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", "", fmt.Errorf("parse playurl: %w", err)
	}
	if result.Code != 0 {
		return "", "", fmt.Errorf("playurl api code=%d", result.Code)
	}
	if result.Data.Dash == nil {
		return "", "", fmt.Errorf("no DASH data")
	}

	var selectedURL string
	for _, v := range result.Data.Dash.Video {
		if v.ID == qn {
			selectedURL = v.BaseURL
			break
		}
	}
	if selectedURL == "" {
		selectedURL = result.Data.Dash.Video[0].BaseURL
	}

	bestAudio := result.Data.Dash.Audio[0]
	for _, a := range result.Data.Dash.Audio {
		if a.Bandwidth > bestAudio.Bandwidth {
			bestAudio = a
		}
	}

	return selectedURL, bestAudio.BaseURL, nil
}

func encodeURIComponent(s string) string {
	result := ""
	for _, c := range s {
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') ||
			c == '-' || c == '_' || c == '.' || c == '!' || c == '~' || c == '*' ||
			c == '\'' || c == '(' || c == ')' {
			result += string(c)
		} else {
			result += fmt.Sprintf("%%%02X", c)
		}
	}
	return result
}

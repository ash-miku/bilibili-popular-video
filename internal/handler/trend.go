package handler

import (
	"log/slog"
	"strconv"

	"bilibili-popular-video/internal/repository/ch"

	"github.com/gin-gonic/gin"
)

type TrendHandler struct {
	statsRepo *ch.StatsRepo
}

func NewTrendHandler(statsRepo *ch.StatsRepo) *TrendHandler {
	return &TrendHandler{statsRepo: statsRepo}
}

// VideoTrend handles GET /api/v1/trend/video/:bvid?start=2026-01-01&end=2026-04-25
func (h *TrendHandler) VideoTrend(c *gin.Context) {
	bvid := c.Param("bvid")
	if bvid == "" {
		fail(c, -1, "bvid is required")
		return
	}

	start, end, err := getDateRange(c)
	if err != nil {
		fail(c, -1, "invalid date format, expected YYYY-MM-DD")
		return
	}

	stats, err := h.statsRepo.GetVideoTrend(c.Request.Context(), bvid, start, end)
	if err != nil {
		slog.Error("video trend query failed",
			"bvid", bvid,
			"start", start.Format("2006-01-02"),
			"end", end.Format("2006-01-02"),
			"error", err,
		)
		fail(c, -1, err.Error())
		return
	}

	success(c, stats)
}

// LaunchCurve handles GET /api/v1/trend/launch-curve?bvid=xxx
func (h *TrendHandler) LaunchCurve(c *gin.Context) {
	bvid := c.Query("bvid")
	if bvid == "" {
		fail(c, -1, "bvid is required")
		return
	}

	stats, err := h.statsRepo.GetLaunchCurve(c.Request.Context(), bvid)
	if err != nil {
		slog.Error("launch curve query failed",
			"bvid", bvid,
			"error", err,
		)
		fail(c, -1, err.Error())
		return
	}

	success(c, stats)
}

// RankingChange handles GET /api/v1/trend/ranking-change?start=2026-04-18&end=2026-04-25&limit=20
func (h *TrendHandler) RankingChange(c *gin.Context) {
	start, end, err := getDateRange(c)
	if err != nil {
		fail(c, -1, "invalid date format, expected YYYY-MM-DD")
		return
	}

	limit := 20
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 100 {
			limit = v
		}
	}

	stats, err := h.statsRepo.GetRankingChange(c.Request.Context(), start, end, limit)
	if err != nil {
		slog.Error("ranking change query failed",
			"start", start.Format("2006-01-02"),
			"end", end.Format("2006-01-02"),
			"limit", limit,
			"error", err,
		)
		fail(c, -1, err.Error())
		return
	}

	success(c, stats)
}

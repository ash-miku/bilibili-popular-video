package handler

import (
	"log/slog"
	"strconv"
	"time"

	"bilibili-popular-video/internal/repository/ch"

	"github.com/gin-gonic/gin"
)

type StatsHandler struct {
	statsRepo *ch.StatsRepo
}

func NewStatsHandler(statsRepo *ch.StatsRepo) *StatsHandler {
	return &StatsHandler{statsRepo: statsRepo}
}

// Overview handles GET /api/v1/stats/overview
// Returns aggregate statistics across all dates.
func (h *StatsHandler) Overview(c *gin.Context) {
	overview, err := h.statsRepo.GetStatsOverview(c.Request.Context())
	if err != nil {
		slog.Error("stats overview query failed", "error", err)
		fail(c, -1, err.Error())
		return
	}
	success(c, overview)
}

// DailyTrend handles GET /api/v1/stats/daily-trend?days=30
// Returns daily video count and total views for the last N days.
func (h *StatsHandler) DailyTrend(c *gin.Context) {
	days := 30
	if d := c.Query("days"); d != "" {
		if v, err := strconv.Atoi(d); err == nil && v > 0 && v <= 365 {
			days = v
		}
	}

	now := time.Now()
	end := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	start := end.AddDate(0, 0, -(days - 1))

	trend, err := h.statsRepo.GetCategoryTrend(c.Request.Context(), 0, start, end)
	if err != nil {
		slog.Error("stats daily trend query failed", "error", err)
		fail(c, -1, err.Error())
		return
	}
	success(c, trend)
}

// Heatmap handles GET /api/v1/stats/heatmap?days=90
// Returns daily video counts suitable for calendar heatmap visualization.
func (h *StatsHandler) Heatmap(c *gin.Context) {
	days := 90
	if d := c.Query("days"); d != "" {
		if v, err := strconv.Atoi(d); err == nil && v > 0 && v <= 365 {
			days = v
		}
	}

	now := time.Now()
	end := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	start := end.AddDate(0, 0, -(days - 1))

	data, err := h.statsRepo.GetHeatmapData(c.Request.Context(), start, end)
	if err != nil {
		slog.Error("stats heatmap query failed", "error", err)
		fail(c, -1, err.Error())
		return
	}
	success(c, data)
}

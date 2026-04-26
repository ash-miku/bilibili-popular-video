package handler

import (
	"log/slog"
	"strconv"

	"bilibili-popular-video/internal/repository/ch"

	"github.com/gin-gonic/gin"
)

type DashboardHandler struct {
	statsRepo *ch.StatsRepo
}

func NewDashboardHandler(statsRepo *ch.StatsRepo) *DashboardHandler {
	return &DashboardHandler{statsRepo: statsRepo}
}

// Overview handles GET /api/v1/dashboard/overview
func (h *DashboardHandler) Overview(c *gin.Context) {
	date, err := getSingleDate(c)
	if err != nil {
		fail(c, -1, "invalid date format, expected YYYY-MM-DD")
		return
	}

	overview, err := h.statsRepo.GetOverview(c.Request.Context(), date)
	if err != nil {
		slog.Error("dashboard overview query failed",
			"date", date.Format("2006-01-02"),
			"error", err,
		)
		fail(c, -1, err.Error())
		return
	}

	success(c, overview)
}

// Ranking handles GET /api/v1/dashboard/ranking?partitionId=0&page=1&pageSize=20&date=2026-04-25
func (h *DashboardHandler) Ranking(c *gin.Context) {
	date, err := getSingleDate(c)
	if err != nil {
		fail(c, -1, "invalid date format, expected YYYY-MM-DD")
		return
	}

	partitionId := 0
	if pid := c.Query("partitionId"); pid != "" {
		if v, err := strconv.Atoi(pid); err == nil && v > 0 {
			partitionId = v
		}
	}

	page, pageSize := getPagination(c)

	stats, total, err := h.statsRepo.GetRanking(c.Request.Context(), date, partitionId, page, pageSize)
	if err != nil {
		slog.Error("dashboard ranking query failed",
			"date", date.Format("2006-01-02"),
			"partitionId", partitionId,
			"page", page,
			"pageSize", pageSize,
			"error", err,
		)
		fail(c, -1, err.Error())
		return
	}

	success(c, gin.H{
		"list":     stats,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

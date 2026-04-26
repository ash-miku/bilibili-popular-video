package handler

import (
	"log/slog"

	"bilibili-popular-video/internal/repository/ch"

	"github.com/gin-gonic/gin"
)

type HotHandler struct {
	statsRepo *ch.StatsRepo
}

func NewHotHandler(statsRepo *ch.StatsRepo) *HotHandler {
	return &HotHandler{statsRepo: statsRepo}
}

func (h *HotHandler) HotRanking(c *gin.Context) {
	start, end, err := getDateRange(c)
	if err != nil {
		fail(c, -1, "invalid date format")
		return
	}

	partitionName := c.Query("partitionName")

	page, pageSize := getPagination(c)

	stats, total, err := h.statsRepo.GetHotRanking(c.Request.Context(), start, end, partitionName, page, pageSize)
	if err != nil {
		slog.Error("hot ranking query failed", "error", err)
		fail(c, -1, err.Error())
		return
	}

	success(c, map[string]interface{}{
		"list":     stats,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

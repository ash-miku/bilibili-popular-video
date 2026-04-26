package handler

import (
	"log/slog"
	"strconv"

	"bilibili-popular-video/internal/repository/ch"

	"github.com/gin-gonic/gin"
)

type UploaderHandler struct {
	statsRepo *ch.StatsRepo
}

func NewUploaderHandler(statsRepo *ch.StatsRepo) *UploaderHandler {
	return &UploaderHandler{statsRepo: statsRepo}
}

// Top handles GET /api/v1/uploader/top?sortBy=total_views&page=1&pageSize=20&date=2026-04-25
func (h *UploaderHandler) Top(c *gin.Context) {
	date, err := getSingleDate(c)
	if err != nil {
		fail(c, -1, "invalid date format, expected YYYY-MM-DD")
		return
	}

	sortBy := c.DefaultQuery("sortBy", "total_views")
	page, pageSize := getPagination(c)

	stats, total, err := h.statsRepo.GetTopUploaders(c.Request.Context(), date, sortBy, page, pageSize)
	if err != nil {
		slog.Error("uploader top query failed",
			"date", date.Format("2006-01-02"),
			"sortBy", sortBy,
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

// Detail handles GET /api/v1/uploader/:mid/detail?start=2026-01-01&end=2026-04-25
func (h *UploaderHandler) Detail(c *gin.Context) {
	midStr := c.Param("mid")
	mid, err := strconv.ParseInt(midStr, 10, 64)
	if err != nil || mid <= 0 {
		fail(c, -1, "invalid uploader mid")
		return
	}

	start, end, err := getDateRange(c)
	if err != nil {
		fail(c, -1, "invalid date format, expected YYYY-MM-DD")
		return
	}

	stats, err := h.statsRepo.GetUploaderDetail(c.Request.Context(), mid, start, end)
	if err != nil {
		slog.Error("uploader detail query failed",
			"mid", mid,
			"start", start.Format("2006-01-02"),
			"end", end.Format("2006-01-02"),
			"error", err,
		)
		fail(c, -1, err.Error())
		return
	}

	success(c, stats)
}

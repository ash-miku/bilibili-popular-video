package handler

import (
	"log/slog"

	"bilibili-popular-video/internal/repository/ch"

	"github.com/gin-gonic/gin"
)

type SearchHandler struct {
	statsRepo *ch.StatsRepo
}

func NewSearchHandler(statsRepo *ch.StatsRepo) *SearchHandler {
	return &SearchHandler{statsRepo: statsRepo}
}

func (h *SearchHandler) Search(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		fail(c, -1, "missing required parameter: q")
		return
	}

	searchType := c.DefaultQuery("type", "video")
	page, pageSize := getPagination(c)

	switch searchType {
	case "uploader":
		stats, total, err := h.statsRepo.SearchUploaders(c.Request.Context(), q, page, pageSize)
		if err != nil {
			slog.Error("search uploaders failed", "q", q, "error", err)
			fail(c, -1, err.Error())
			return
		}
		success(c, gin.H{
			"list":     stats,
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		})
	default:
		stats, total, err := h.statsRepo.SearchVideos(c.Request.Context(), q, page, pageSize)
		if err != nil {
			slog.Error("search videos failed", "q", q, "error", err)
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
}

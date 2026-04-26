package handler

import (
	"log/slog"
	"strconv"

	"bilibili-popular-video/internal/repository/ch"

	"github.com/gin-gonic/gin"
)

type CategoryHandler struct {
	statsRepo *ch.StatsRepo
}

func NewCategoryHandler(statsRepo *ch.StatsRepo) *CategoryHandler {
	return &CategoryHandler{statsRepo: statsRepo}
}

// Distribution handles GET /api/v1/category/distribution?date=2026-04-25
func (h *CategoryHandler) Distribution(c *gin.Context) {
	date, err := getSingleDate(c)
	if err != nil {
		fail(c, -1, "invalid date format, expected YYYY-MM-DD")
		return
	}

	dist, err := h.statsRepo.GetCategoryDistribution(c.Request.Context(), date)
	if err != nil {
		slog.Error("category distribution query failed",
			"date", date.Format("2006-01-02"),
			"error", err,
		)
		fail(c, -1, err.Error())
		return
	}

	success(c, dist)
}

// Trend handles GET /api/v1/category/:id/trend?start=2026-01-01&end=2026-04-25
// id=0 means all partitions (no filter).
func (h *CategoryHandler) Trend(c *gin.Context) {
	idStr := c.Param("id")
	partitionId, err := strconv.Atoi(idStr)
	if err != nil || partitionId < 0 {
		fail(c, -1, "invalid partition id")
		return
	}

	start, end, err := getDateRange(c)
	if err != nil {
		fail(c, -1, "invalid date format, expected YYYY-MM-DD")
		return
	}

	trend, err := h.statsRepo.GetCategoryTrend(c.Request.Context(), partitionId, start, end)
	if err != nil {
		slog.Error("category trend query failed",
			"partitionId", partitionId,
			"start", start.Format("2006-01-02"),
			"end", end.Format("2006-01-02"),
			"error", err,
		)
		fail(c, -1, err.Error())
		return
	}

	success(c, trend)
}

// PartitionList handles GET /api/v1/category/partitions
func (h *CategoryHandler) PartitionList(c *gin.Context) {
	partitions, err := h.statsRepo.GetPartitionList(c.Request.Context())
	if err != nil {
		slog.Error("partition list query failed", "error", err)
		fail(c, -1, err.Error())
		return
	}
	success(c, partitions)
}

// HotTags handles GET /api/v1/tags/hot?date=2026-04-25&limit=20
func (h *CategoryHandler) HotTags(c *gin.Context) {
	date, err := getSingleDate(c)
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

	tags, err := h.statsRepo.GetHotTags(c.Request.Context(), date, limit)
	if err != nil {
		slog.Error("hot tags query failed",
			"date", date.Format("2006-01-02"),
			"limit", limit,
			"error", err,
		)
		fail(c, -1, err.Error())
		return
	}

	success(c, tags)
}

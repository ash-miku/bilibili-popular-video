package handler

import (
	"context"
	"log/slog"
	"time"

	"bilibili-popular-video/internal/model"
	"bilibili-popular-video/internal/repository/ch"
	"bilibili-popular-video/internal/repository/pg"

	"github.com/gin-gonic/gin"
)

type galleryVideo struct {
	model.VideoDailyStat
	CoverUrl string `json:"cover_url"`
	Duration int    `json:"duration"`
}

type GalleryHandler struct {
	statsRepo *ch.StatsRepo
	videoRepo *pg.VideoRepo
}

func NewGalleryHandler(statsRepo *ch.StatsRepo, videoRepo *pg.VideoRepo) *GalleryHandler {
	return &GalleryHandler{statsRepo: statsRepo, videoRepo: videoRepo}
}

func (h *GalleryHandler) List(c *gin.Context) {
	start, end, err := getDateRange(c)
	if err != nil {
		fail(c, -1, "invalid date format")
		return
	}

	partitionName := c.Query("partitionName")
	page, pageSize := getPagination(c)

	stats, total, err := h.statsRepo.GetHotRanking(c.Request.Context(), start, end, partitionName, page, pageSize)
	if err != nil {
		slog.Error("gallery list query failed", "error", err)
		fail(c, -1, err.Error())
		return
	}

	if len(stats) == 0 {
		success(c, map[string]interface{}{
			"list":     []galleryVideo{},
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		})
		return
	}

	bvids := make([]string, len(stats))
	for i, s := range stats {
		bvids[i] = s.Bvid
	}

	pgCtx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	infos, err := h.videoRepo.GetVideosByBvids(pgCtx, bvids)
	if err != nil {
		slog.Error("gallery batch query pg failed", "error", err)
		fail(c, -1, err.Error())
		return
	}

	list := make([]galleryVideo, 0, len(stats))
	for _, s := range stats {
		info, ok := infos[s.Bvid]
		gv := galleryVideo{VideoDailyStat: s}
		if ok {
			gv.CoverUrl = info.CoverUrl
			gv.Duration = info.Duration
		}
		list = append(list, gv)
	}

	success(c, map[string]interface{}{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}



package handler

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type apiResponse struct {
	Code    int         `json:"code"`
	Data    interface{} `json:"data"`
	Message string      `json:"message"`
}

func success(c *gin.Context, data interface{}) {
	c.JSON(200, apiResponse{Code: 0, Data: data, Message: "ok"})
}

func fail(c *gin.Context, code int, msg string) {
	c.JSON(200, apiResponse{Code: code, Data: nil, Message: msg})
}

func getPagination(c *gin.Context) (page, pageSize int) {
	page = 1
	pageSize = 20
	if p, err := strconv.Atoi(c.Query("page")); err == nil && p > 0 {
		page = p
	}
	if ps, err := strconv.Atoi(c.Query("pageSize")); err == nil && ps > 0 && ps <= 100 {
		pageSize = ps
	}
	return
}

func getDateRange(c *gin.Context) (start, end time.Time, err error) {
	const layout = "2006-01-02"

	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	startStr := c.Query("start")
	endStr := c.Query("end")

	if startStr == "" && endStr == "" {
		return today.AddDate(0, 0, -6), today, nil
	}

	if startStr != "" {
		start, err = time.Parse(layout, startStr)
		if err != nil {
			return time.Time{}, time.Time{}, err
		}
	} else {
		start = today.AddDate(0, 0, -6)
	}

	if endStr != "" {
		end, err = time.Parse(layout, endStr)
		if err != nil {
			return time.Time{}, time.Time{}, err
		}
	} else {
		end = today
	}

	return start, end, nil
}

func getSingleDate(c *gin.Context) (time.Time, error) {
	const layout = "2006-01-02"

	dateStr := c.Query("date")
	if dateStr == "" {
		now := time.Now()
		return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()), nil
	}
	return time.Parse(layout, dateStr)
}

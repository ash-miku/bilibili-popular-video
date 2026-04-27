package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"bilibili-popular-video/internal/config"
	"bilibili-popular-video/internal/crawler"
	"bilibili-popular-video/internal/handler"
	"bilibili-popular-video/internal/notify"
	"bilibili-popular-video/internal/repository/ch"
	"bilibili-popular-video/internal/repository/pg"
	"bilibili-popular-video/internal/sync"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	// ---------- 1. Configuration ----------
	cfg, err := config.Load()
	if err != nil {
		slog.Error("load config", "error", err)
		os.Exit(1)
	}
	slog.Info("config loaded",
		"pg_host", cfg.PostgreSQL.Host,
		"ch_host", cfg.ClickHouse.Host,
		"app_port", cfg.Server.Port,
	)

	// ---------- 2. Connect PostgreSQL ----------
	pgPool, err := pg.NewPGPool(cfg)
	if err != nil {
		slog.Error("connect postgres", "error", err)
		os.Exit(1)
	}
	defer pgPool.Close()
	slog.Info("postgres connected")

	// ---------- 3. Connect ClickHouse ----------
	chConn, err := ch.NewCHConn(cfg)
	if err != nil {
		slog.Error("connect clickhouse", "error", err)
		os.Exit(1)
	}
	defer chConn.Close()
	slog.Info("clickhouse connected")

	// ---------- 4. Run migrations ----------
	if err := runMigrations(pgPool, chConn); err != nil {
		slog.Error("run migrations", "error", err)
		os.Exit(1)
	}
	slog.Info("migrations completed")

	// ---------- 5. Create repositories ----------
	videoRepo := pg.NewVideoRepo(pgPool)
	uploaderRepo := pg.NewUploaderRepo(pgPool)
	statsRepo := ch.NewStatsRepo(chConn)

	// ---------- 6. Create syncer ----------
	syncer := sync.NewSyncer(pgPool, statsRepo)

	// ---------- 7. Start crawler scheduler ----------
	biliCrawler := crawler.NewBilibiliCrawler(videoRepo, uploaderRepo, cfg.Crawler.DelayMs)
	notifier := notify.NewNotifier(cfg)
	scheduler := crawler.NewScheduler(biliCrawler, syncer, notifier, statsRepo, cfg.Crawler.IntervalHour, cfg.Crawler.DailyHour)

	schedCtx, schedCancel := context.WithCancel(context.Background())
	defer schedCancel()
	go scheduler.Start(schedCtx)

	slog.Info("repositories, syncer and crawler initialized",
		"interval_hour", cfg.Crawler.IntervalHour,
		"daily_hour", cfg.Crawler.DailyHour,
		"delay_ms", cfg.Crawler.DelayMs,
	)

	// ---------- 8. Setup Gin router ----------
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())

	registerRoutes(router, statsRepo, videoRepo, cfg)

	router.POST("/api/v1/admin/sync", func(c *gin.Context) {
		today := time.Now().Truncate(24 * time.Hour)
		slog.Info("manual sync triggered", "date", today.Format("2006-01-02"))
		if err := syncer.SyncDaily(c.Request.Context(), today); err != nil {
			slog.Error("manual sync failed", "error", err)
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		slog.Info("manual sync completed")

		// Send daily notification if notifier is configured.
		if notifier != nil && statsRepo != nil {
			go func() {
				slog.Info("manual sync: building daily notification")
				summary, err := notify.BuildDailySummary(context.Background(), statsRepo, today)
				if err != nil {
					slog.Warn("manual sync: failed to build summary", "error", err)
					return
				}
				slog.Info("manual sync: sending daily notification", "channels", "feishu")
				if err := notifier.SendDailySummary(context.Background(), summary); err != nil {
					slog.Warn("manual sync: notification failed", "error", err)
				}
			}()
		}

		c.JSON(200, gin.H{"status": "ok", "date": today.Format("2006-01-02")})
	})

	// ---------- 9. Start HTTP server ----------
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Server.Port),
		Handler: router,
	}

	go func() {
		slog.Info("http server starting", "port", cfg.Server.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("http server error", "error", err)
			os.Exit(1)
		}
	}()

	// ---------- 10. Graceful shutdown ----------
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	slog.Info("shutdown signal received", "signal", sig.String())

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("server shutdown error", "error", err)
	}

	slog.Info("server exited cleanly")
}

// registerRoutes wires all API v1 handlers to the Gin engine.
func registerRoutes(r *gin.Engine, statsRepo *ch.StatsRepo, videoRepo *pg.VideoRepo, cfg *config.Config) {
	dashboardHandler := handler.NewDashboardHandler(statsRepo)
	trendHandler := handler.NewTrendHandler(statsRepo)
	uploaderHandler := handler.NewUploaderHandler(statsRepo)
	categoryHandler := handler.NewCategoryHandler(statsRepo)
	hotHandler := handler.NewHotHandler(statsRepo)
	playerHandler := handler.NewPlayerHandler(cfg)
	searchHandler := handler.NewSearchHandler(statsRepo)
	galleryHandler := handler.NewGalleryHandler(statsRepo, videoRepo)

	v1 := r.Group("/api/v1")
	{
		dashboard := v1.Group("/dashboard")
		{
			dashboard.GET("/overview", dashboardHandler.Overview)
			dashboard.GET("/ranking", dashboardHandler.Ranking)
		}

		trend := v1.Group("/trend")
		{
			trend.GET("/video/:bvid", trendHandler.VideoTrend)
			trend.GET("/ranking-change", trendHandler.RankingChange)
			trend.GET("/launch-curve", trendHandler.LaunchCurve)
		}

		uploader := v1.Group("/uploader")
		{
			uploader.GET("/top", uploaderHandler.Top)
			uploader.GET("/:mid/detail", uploaderHandler.Detail)
		}

		category := v1.Group("/category")
		{
			category.GET("/distribution", categoryHandler.Distribution)
			category.GET("/partitions", categoryHandler.PartitionList)
			category.GET("/:id/trend", categoryHandler.Trend)
		}

		v1.GET("/tags/hot", categoryHandler.HotTags)

		hot := v1.Group("/hot")
		{
			hot.GET("/ranking", hotHandler.HotRanking)
		}

		player := v1.Group("/player")
		{
			player.GET("/info", playerHandler.GetVideoInfo)
			player.GET("/stream", playerHandler.StreamVideo)
			player.GET("/proxy", playerHandler.ProxyURL)
		}

		v1.GET("/search", searchHandler.Search)

		gallery := v1.Group("/gallery")
		{
			gallery.GET("/list", galleryHandler.List)
		}
	}

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
}

// runMigrations reads SQL migration files and executes them against PostgreSQL
// and ClickHouse.
func runMigrations(pgPool *pgxpool.Pool, chConn clickhouse.Conn) error {
	// PostgreSQL migrations
	pgSQL, err := os.ReadFile("migrations/postgres/001_init.sql")
	if err != nil {
		return fmt.Errorf("read postgres migration: %w", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if _, err := pgPool.Exec(ctx, string(pgSQL)); err != nil {
		return fmt.Errorf("exec postgres migration: %w", err)
	}
	slog.Info("postgres migration applied", "file", "migrations/postgres/001_init.sql")

	// ClickHouse migrations — apply each in order
	chMigrations := []string{
		"migrations/clickhouse/001_init.sql",
		"migrations/clickhouse/002_add_tags.sql",
	}
	for _, path := range chMigrations {
		chSQL, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read clickhouse migration %s: %w", path, err)
		}
		chStatements := splitSQL(string(chSQL))
		for i, stmt := range chStatements {
			if stmt == "" {
				continue
			}
			if err := chConn.Exec(ctx, stmt); err != nil {
				return fmt.Errorf("exec %s statement %d: %w", path, i+1, err)
			}
		}
		slog.Info("clickhouse migration applied", "file", path, "statements", len(chStatements))
	}

	slog.Info("all migrations completed")

	return nil
}

// splitSQL splits a SQL file into individual statements on semicolons,
// trimming whitespace and comments.
func splitSQL(raw string) []string {
	var statements []string
	current := ""
	for _, line := range splitLines(raw) {
		trimmed := trimSpace(line)
		if trimmed == "" || startsWith(trimmed, "--") {
			continue
		}
		if current != "" {
			current += "\n"
		}
		current += trimmed
		if endsWithSemicolon(trimmed) {
			statements = append(statements, current[:len(current)-1])
			current = ""
		}
	}
	if current != "" {
		statements = append(statements, current)
	}
	return statements
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			lines = append(lines, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}

func trimSpace(s string) string {
	start, end := 0, len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\r') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\r') {
		end--
	}
	return s[start:end]
}

func startsWith(s, prefix string) bool {
	return len(s) >= len(prefix) && s[:len(prefix)] == prefix
}

func endsWithSemicolon(s string) bool {
	return len(s) > 0 && s[len(s)-1] == ';'
}

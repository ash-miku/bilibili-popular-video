// Package config provides configuration management for the Bilibili popular video
// analytics platform. It reads environment variables with sensible defaults matching
// the Docker Compose deployment and .env file conventions.
package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config holds all application configuration, grouped by subsystem.
type Config struct {
	PostgreSQL PostgreSQLConfig
	ClickHouse ClickHouseConfig
	Crawler    CrawlerConfig
	Server     ServerConfig
	Bilibili   BilibiliConfig
	Notify     NotifyConfig
}

// PostgreSQLConfig holds connection parameters for PostgreSQL.
type PostgreSQLConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	DB       string
}

// ClickHouseConfig holds connection parameters for ClickHouse.
// Port is the native TCP port; HTTPPort is the HTTP interface port.
type ClickHouseConfig struct {
	Host     string
	Port     int
	HTTPPort int
	User     string
	Password string
	DB       string
}

// CrawlerConfig holds crawl scheduling and rate-limiting parameters.
type CrawlerConfig struct {
	IntervalHour int // hours between popular-ranking crawls
	DailyHour    int // hour of day (0-23) for daily supplementary crawl
	DelayMs      int // milliseconds of random delay between requests
}

// ServerConfig holds the HTTP server configuration.
type ServerConfig struct {
	Port int
}

// BilibiliConfig holds the B站 user cookie for video stream proxy.
type BilibiliConfig struct {
	SESSDATA string
}

// NotifyConfig holds notification channel configuration.
// All fields are optional – empty means the channel is disabled.
type NotifyConfig struct {
	TelegramBotToken string
	TelegramChatID   string
	DingTalkWebhook  string
	FeishuWebhook    string
	FeishuSecret     string
}

// DSN returns a PostgreSQL connection string in key=value format
// suitable for pgx, lib/pq, and database/sql.
func (c PostgreSQLConfig) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		c.Host, c.Port, c.User, c.Password, c.DB,
	)
}

// HTTPURL returns the ClickHouse HTTP interface base URL.
func (c ClickHouseConfig) HTTPURL() string {
	return fmt.Sprintf("http://%s:%d", c.Host, c.HTTPPort)
}

// Load reads configuration from environment variables.
// Every variable has a sensible default so the application can start
// without any .env file in a standard Docker Compose setup.
func Load() (*Config, error) {
	cfg := &Config{
		PostgreSQL: PostgreSQLConfig{
			Host:     getEnv("PG_HOST", "postgres"),
			Port:     getEnvInt("PG_PORT", 5432),
			User:     getEnv("PG_USER", "postgres"),
			Password: getEnv("PG_PASSWORD", ""),
			DB:       getEnv("PG_DB", "bili_data"),
		},
		ClickHouse: ClickHouseConfig{
			Host:     getEnv("CH_HOST", "clickhouse"),
			Port:     getEnvInt("CH_PORT", 9000),
			HTTPPort: getEnvInt("CH_HTTP_PORT", 8123),
			User:     getEnv("CH_USER", "default"),
			Password: getEnv("CH_PASSWORD", ""),
			DB:       getEnv("CH_DB", "bili_data"),
		},
		Crawler: CrawlerConfig{
			IntervalHour: getEnvInt("CRAWL_INTERVAL_HOUR", 1),
			DailyHour:    getEnvInt("CRAWL_DAILY_HOUR", 0),
			DelayMs:      getEnvInt("CRAWL_DELAY_MS", 300),
		},
		Server: ServerConfig{
			Port: getEnvInt("APP_PORT", 8080),
		},
		Bilibili: BilibiliConfig{
			SESSDATA: getEnv("BILIBILI_SESSDATA", ""),
		},
		Notify: NotifyConfig{
			TelegramBotToken: getEnv("TELEGRAM_BOT_TOKEN", ""),
			TelegramChatID:   getEnv("TELEGRAM_CHAT_ID", ""),
			DingTalkWebhook:  getEnv("DINGTALK_WEBHOOK", ""),
			FeishuWebhook:    getEnv("FEISHU_WEBHOOK", ""),
			FeishuSecret:     getEnv("FEISHU_SECRET", ""),
		},
	}

	if cfg.PostgreSQL.Port <= 0 || cfg.PostgreSQL.Port > 65535 {
		return nil, fmt.Errorf("invalid PG_PORT: %d", cfg.PostgreSQL.Port)
	}
	if cfg.ClickHouse.Port <= 0 || cfg.ClickHouse.Port > 65535 {
		return nil, fmt.Errorf("invalid CH_PORT: %d", cfg.ClickHouse.Port)
	}
	if cfg.ClickHouse.HTTPPort <= 0 || cfg.ClickHouse.HTTPPort > 65535 {
		return nil, fmt.Errorf("invalid CH_HTTP_PORT: %d", cfg.ClickHouse.HTTPPort)
	}
	if cfg.Server.Port <= 0 || cfg.Server.Port > 65535 {
		return nil, fmt.Errorf("invalid APP_PORT: %d", cfg.Server.Port)
	}
	if cfg.Crawler.IntervalHour <= 0 {
		return nil, fmt.Errorf("invalid CRAWL_INTERVAL_HOUR: %d", cfg.Crawler.IntervalHour)
	}
	if cfg.Crawler.DailyHour < 0 || cfg.Crawler.DailyHour > 23 {
		return nil, fmt.Errorf("invalid CRAWL_DAILY_HOUR: %d", cfg.Crawler.DailyHour)
	}
	if cfg.Crawler.DelayMs < 0 {
		return nil, fmt.Errorf("invalid CRAWL_DELAY_MS: %d", cfg.Crawler.DelayMs)
	}

	return cfg, nil
}

// getEnv returns the value of the environment variable named by key,
// or the provided default value if the variable is empty or unset.
func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

// getEnvInt returns the integer value of the environment variable named by key,
// or the provided default value if the variable is empty, unset, or not a valid integer.
func getEnvInt(key string, defaultVal int) int {
	v := os.Getenv(key)
	if v == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return defaultVal
	}
	return n
}

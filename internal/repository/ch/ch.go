package ch

import (
	"context"
	"fmt"
	"time"

	"bilibili-popular-video/internal/config"

	"github.com/ClickHouse/clickhouse-go/v2"
)

func NewCHConn(cfg *config.Config) (clickhouse.Conn, error) {
	conn, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{fmt.Sprintf("%s:%d", cfg.ClickHouse.Host, cfg.ClickHouse.Port)},
		Auth: clickhouse.Auth{
			Database: cfg.ClickHouse.DB,
			Username: cfg.ClickHouse.User,
			Password: cfg.ClickHouse.Password,
		},
		Protocol:        clickhouse.Native,
		DialTimeout:     10 * time.Second,
		ConnMaxLifetime: 5 * time.Minute,
	})
	if err != nil {
		return nil, fmt.Errorf("open clickhouse: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := conn.Ping(ctx); err != nil {
		conn.Close()
		return nil, fmt.Errorf("ping clickhouse: %w", err)
	}

	return conn, nil
}

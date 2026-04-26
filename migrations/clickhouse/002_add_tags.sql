-- Bilibili Popular Video Analytics - ClickHouse Schema Migration
-- Version: 002
-- Purpose: Add tags column to video_daily_stats for real tag analytics.

ALTER TABLE video_daily_stats ADD COLUMN IF NOT EXISTS tags Array(String);

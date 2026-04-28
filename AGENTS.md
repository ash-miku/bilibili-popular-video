# AGENTS.md

## Overview
- This repo is a split Go + React app for Bilibili popular-video analytics. The backend entrypoint is `cmd/server/main.go`; the real frontend package is `web/`.
- Do not treat the root `package.json` as the app workspace. It only contains a Playwright dependency; frontend scripts live in `web/package.json`.

## Key commands
- Backend local run: `go run ./cmd/server`
- Backend production binary: `GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o bili-server ./cmd/server`
- Frontend install/build: `cd web && npm install && npm run build`
- Frontend dev server: `cd web && npm run dev`
- Docker-exposed manual PG -> ClickHouse sync: `curl -X POST http://localhost:8090/api/v1/admin/sync`
- Dated manual sync is supported: `POST /api/v1/admin/sync?date=YYYY-MM-DD`

## Architecture and entrypoints
- `cmd/server/main.go` does all backend bootstrap: load env config, connect PostgreSQL + ClickHouse, run migrations, start the in-process crawler scheduler, register Gin routes, and serve HTTP.
- `internal/crawler/scheduler.go` runs an initial ranking crawl on startup, then hourly ranking crawls, plus a daily crawl followed by sync. Backend changes can affect scheduled jobs, not just request/response APIs.
- `internal/sync/syncer.go` deletes that day's ClickHouse rows before reinserting and optimizing. Manual sync is not append-only.
- Frontend runtime entry is `web/src/main.tsx`; routes are wired in `web/src/App.tsx` and the UI surface is broader than the README summary.
- Frontend API calls use `/api/v1` from `web/src/api/index.ts`.

## Docker and runtime gotchas
- `Dockerfile` does **not** build Go code. It copies prebuilt local artifacts: `bili-server`, `migrations/`, and `bin/ffmpeg`.
- `bin/ffmpeg` is required for Docker build/runtime flow and is intentionally untracked (`.gitignore`). If it is missing locally, `docker build` will fail.
- The documented Docker build flow uses `DOCKER_BUILDKIT=0 docker build ...` and relies on the local base image `golang:1.25-local`.
- `docker-compose.yaml` serves the frontend from a bind-mounted `./web/dist` through nginx. Build `web/dist` before expecting the `web` service to work.
- Port behavior differs by mode:
  - local backend / Vite proxy: `http://localhost:8080`
  - Docker-exposed backend: `http://localhost:8090`
  - Docker web UI: `http://localhost:3000`

## Config and secrets
- Start from `.env.example`. Key app env comes from `PG_*`, `CH_*`, `APP_PORT`, `CRAWL_*`, and optional `BILIBILI_SESSDATA`.
- `BILIBILI_SESSDATA` is sensitive and should never be committed.
- Optional notification channels exist in code and env: Telegram, DingTalk, and Feishu.

## Verification expectations
- There is no repo-defined lint command, no CI workflow, and no checked-in test suite. Do not claim lint/tests passed unless you added and ran them yourself.
- The main frontend verification path is `cd web && npm run build`; this includes TypeScript checking via `tsc -b`.
- For backend verification, use focused `go build` / `go run` checks against the files you changed.

## Repo-specific implementation notes
- App startup runs SQL migrations automatically from `migrations/postgres/001_init.sql` and `migrations/clickhouse/{001_init.sql,002_add_tags.sql}`.
- When changing ClickHouse scans, match the existing numeric scan types in `internal/repository/ch/stats_repo.go`.
- Several runtime/build artifacts are intentionally ignored: `.env*` (except `.env.example`), `bili-server`, `server`, `bin/ffmpeg`, `web/dist/`, `node_modules/`, and local DB data directories.
- Prefer executable sources over docs when they disagree.

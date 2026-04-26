package pg

import (
	"context"
	"fmt"

	"bilibili-popular-video/internal/model"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	upsertUploaderSQL = `
		INSERT INTO uploaders (mid, name, face_url, fans_count, video_count, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (mid) DO UPDATE SET
			name        = EXCLUDED.name,
			face_url    = EXCLUDED.face_url,
			fans_count  = EXCLUDED.fans_count,
			video_count = EXCLUDED.video_count,
			updated_at  = NOW()
	`

	getUploaderByMidSQL = `
		SELECT mid, name, face_url, fans_count, video_count, updated_at
		FROM uploaders
		WHERE mid = $1
	`
)

type UploaderRepo struct {
	pool *pgxpool.Pool
}

func NewUploaderRepo(pool *pgxpool.Pool) *UploaderRepo {
	return &UploaderRepo{pool: pool}
}

func (r *UploaderRepo) UpsertUploader(ctx context.Context, u *model.Uploader) error {
	_, err := r.pool.Exec(ctx, upsertUploaderSQL,
		u.Mid, u.Name, u.FaceUrl, u.FansCount, u.VideoCount,
	)
	if err != nil {
		return fmt.Errorf("upsert uploader mid=%d: %w", u.Mid, err)
	}
	return nil
}

func (r *UploaderRepo) GetUploaderByMid(ctx context.Context, mid int64) (*model.Uploader, error) {
	row := r.pool.QueryRow(ctx, getUploaderByMidSQL, mid)
	var u model.Uploader
	err := row.Scan(&u.Mid, &u.Name, &u.FaceUrl, &u.FansCount, &u.VideoCount, &u.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("uploader not found: mid=%d", mid)
		}
		return nil, fmt.Errorf("get uploader mid=%d: %w", mid, err)
	}
	return &u, nil
}

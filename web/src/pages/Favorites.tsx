import React, { useMemo } from 'react'
import { Empty, message, Popconfirm } from 'antd'
import { HeartOutlined, EyeOutlined, LikeOutlined, DeleteOutlined } from '@ant-design/icons'
import { Masonry } from 'masonic'
import { useFavorites, type FavoriteItem } from '../contexts/FavoritesContext'
import { useVideoModal } from './Player'
import { formatCount } from '../utils/format'

function proxyCoverUrl(url: string): string {
  if (!url) return ''
  return `/api/v1/player/proxy?url=${encodeURIComponent(url)}`
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const Favorites: React.FC = () => {
  const { favorites, removeFavorite } = useFavorites()
  const videoModal = useVideoModal()

  const sorted = useMemo(() => {
    return [...favorites].sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
    )
  }, [favorites])

  function FavoriteCard({ data: item }: { data: FavoriteItem; index: number; width: number }) {
    return (
      <div
        className="gallery-card"
        style={{ position: 'relative' }}
      >
        <div
          className="gallery-cover"
          style={{
            backgroundImage: item.cover_url
              ? `url(${proxyCoverUrl(item.cover_url)})`
              : undefined,
          }}
          onClick={() =>
            videoModal.open({
              bvid: item.bvid,
              title: item.title,
              uploaderName: item.uploader_name,
              viewCount: item.view_count,
            })
          }
        >
          {item.duration > 0 && (
            <span className="gallery-duration-badge">
              {formatDuration(item.duration)}
            </span>
          )}
          <div className="gallery-cover-overlay">
            <span className="gallery-cover-overlay-title">{item.title}</span>
          </div>
        </div>

        <div className="gallery-card-body">
          <div className="gallery-card-title">{item.title}</div>
          <div className="gallery-card-uploader">{item.uploader_name}</div>
          <div className="gallery-card-stats">
            <span className="gallery-card-stat">
              <EyeOutlined /> {formatCount(item.view_count)}
            </span>
            <span className="gallery-card-stat">
              <LikeOutlined /> {formatCount(item.like_count)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="gallery-partition-tag">{item.partition_name}</span>
            <Popconfirm
              title="确定取消收藏？"
              onConfirm={(e) => {
                e?.stopPropagation()
                removeFavorite(item.bvid)
                message.success('已取消收藏')
              }}
              onCancel={(e) => e?.stopPropagation()}
              okText="确定"
              cancelText="取消"
            >
              <button
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 16,
                  padding: '4px 8px',
                  borderRadius: 6,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#FB7299'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)'
                }}
                title="取消收藏"
              >
                <DeleteOutlined />
              </button>
            </Popconfirm>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .fav-empty-wrap {
          padding: 100px 0;
          text-align: center;
        }
        .fav-empty-icon {
          font-size: 64px;
          color: var(--text-muted);
          opacity: 0.3;
          margin-bottom: 16px;
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="bili-banner">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <HeartOutlined style={{ color: '#FB7299' }} />
            我的收藏
          </h2>
          <p>收藏你感兴趣的视频 · 随时回顾</p>
        </div>

        {sorted.length === 0 ? (
          <div className="section-card">
            <div className="fav-empty-wrap">
              <div className="fav-empty-icon">
                <HeartOutlined />
              </div>
              <Empty description="还没有收藏视频，快去浏览热门榜单收藏吧" />
            </div>
          </div>
        ) : (
          <div className="section-card" style={{ padding: '16px 20px' }}>
            <div className="section-header" style={{ marginBottom: 16 }}>
              <div className="section-title">
                <HeartOutlined style={{ color: '#FB7299' }} />
                已收藏视频
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                  共 <span style={{ color: '#FB7299', fontWeight: 600 }}>{sorted.length}</span> 个
                </span>
              </div>
            </div>
            <Masonry
              items={sorted}
              columnGutter={16}
              columnWidth={320}
              itemHeightEstimate={300}
              overscanBy={3}
              render={FavoriteCard}
              itemKey={(data: FavoriteItem) => data.bvid}
            />
          </div>
        )}
      </div>
    </>
  )
}

export default Favorites

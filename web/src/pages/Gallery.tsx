import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Select, Empty, message } from 'antd'
import {
  PictureOutlined,
  EyeOutlined,
  LikeOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { Masonry, useInfiniteLoader } from 'masonic'
import { getGalleryList, getPartitionList, type GalleryVideo } from '../api'
import { useVideoModal } from './Player'
import { formatCount } from '../utils/format'
import { presets, presetToRange, type PresetKey } from '../utils/datePresets'
import { useFavorites } from '../contexts/FavoritesContext'
import { HeartOutlined, HeartFilled } from '@ant-design/icons'

function proxyCoverUrl(url: string): string {
  if (!url) return ''
  return `/api/v1/player/proxy?url=${encodeURIComponent(url)}`
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function SkeletonCard() {
  return (
    <div className="gallery-card gallery-skeleton">
      <div className="gallery-cover-skeleton" />
      <div className="gallery-card-body">
        <div className="gallery-skeleton-line gallery-skeleton-line--title" />
        <div className="gallery-skeleton-line gallery-skeleton-line--short" />
        <div className="gallery-skeleton-line gallery-skeleton-line--medium" />
      </div>
    </div>
  )
}

const PAGE_SIZE = 20

export default function Gallery() {
  const videoModal = useVideoModal()
  const { addFavorite, removeFavorite, isFavorite } = useFavorites()
  const containerRef = useRef<HTMLDivElement>(null)

  const [videos, setVideos] = useState<GalleryVideo[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [partitions, setPartitions] = useState<string[]>([])
  const [partitionName, setPartitionName] = useState<string | undefined>(undefined)
  const [showBackTop, setShowBackTop] = useState(false)
  const loadingRef = useRef(false)
  const pageRef = useRef(1)
  const [activePreset, setActivePreset] = useState<PresetKey>('7d')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(presetToRange('7d'))

  useEffect(() => {
    getPartitionList()
      .then((list) => {
        setPartitions(list.map((p) => p.name))
      })
      .catch(() => {
        // Partition list is non-critical; silently ignore failures
      })
  }, [])

  const fetchData = useCallback(
    async (pageNum: number, append: boolean) => {
      if (loadingRef.current) return
      try {
        loadingRef.current = true
        if (append) {
          setLoadingMore(true)
        } else {
          setLoading(true)
        }

        const data = await getGalleryList({
          start: dateRange[0].format('YYYY-MM-DD'),
          end: dateRange[1].format('YYYY-MM-DD'),
          partitionName: partitionName || undefined,
          page: pageNum,
          pageSize: PAGE_SIZE,
        })

        if (append) {
          setVideos((prev) => [...prev, ...data.list])
        } else {
          setVideos(data.list)
        }
        setTotal(data.total)
        setPage(data.page)
        pageRef.current = data.page
      } catch {
        message.error('加载画廊数据失败，请稍后重试')
        if (!append) {
          setVideos([])
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
        loadingRef.current = false
      }
    },
    [dateRange, partitionName],
  )

  useEffect(() => {
    pageRef.current = 1
    void fetchData(1, false)
  }, [fetchData])

  const hasMore = videos.length < total

  const maybeLoadMore = useInfiniteLoader<GalleryVideo, (startIndex: number, stopIndex: number, items: GalleryVideo[]) => Promise<void>>(
    async () => {
      if (loadingRef.current || !hasMore) return
      await fetchData(pageRef.current + 1, true)
    },
    {
      isItemLoaded: (index, items) => index < items.length,
      minimumBatchSize: PAGE_SIZE,
      threshold: 8,
    },
  )

  useEffect(() => {
    const handleScroll = () => {
      setShowBackTop(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handlePartitionChange = useCallback((value: unknown) => {
    setPartitionName(value as string | undefined)
  }, [])

  return (
    <>
      <style>{`
        .gallery-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .gallery-filters {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          background: var(--bg-card-solid);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
        }

        .gallery-preset-btn {
          padding: 4px 12px;
          border-radius: 6px;
          border: 1px solid var(--border-subtle);
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 13px;
          font-weight: 400;
          transition: all 0.2s;
        }

        .gallery-preset-btn:hover {
          border-color: var(--bili-pink);
          color: var(--bili-pink);
        }

        .gallery-preset-btn.active {
          border: none;
          background: var(--bili-pink);
          color: #fff;
          font-weight: 500;
        }

        .gallery-skeleton {
          pointer-events: none;
        }

        .gallery-cover-skeleton {
          width: 100%;
          aspect-ratio: 16 / 9;
          background: linear-gradient(
            90deg,
            var(--bg-card-solid) 0%,
            rgba(255, 255, 255, 0.04) 50%,
            var(--bg-card-solid) 100%
          );
          background-size: 200% 100%;
          animation: gallery-shimmer 1.5s ease-in-out infinite;
          border-radius: 12px 12px 0 0;
        }

        .gallery-skeleton-line {
          height: 12px;
          border-radius: 6px;
          background: linear-gradient(
            90deg,
            var(--bg-card-solid) 0%,
            rgba(255, 255, 255, 0.04) 50%,
            var(--bg-card-solid) 100%
          );
          background-size: 200% 100%;
          animation: gallery-shimmer 1.5s ease-in-out infinite;
          margin-bottom: 8px;
        }

        .gallery-skeleton-line--title {
          width: 85%;
          height: 14px;
        }

        .gallery-skeleton-line--short {
          width: 50%;
        }

        .gallery-skeleton-line--medium {
          width: 65%;
        }

        @keyframes gallery-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        .gallery-empty {
          padding: 80px 0;
          text-align: center;
        }

        .gallery-back-top {
          position: fixed;
          right: 32px;
          bottom: 32px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--bili-pink);
          color: #fff;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          box-shadow: 0 4px 16px rgba(251, 114, 153, 0.4);
          transition: all 0.3s ease;
          z-index: 1000;
        }

        .gallery-back-top:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 24px rgba(251, 114, 153, 0.6);
        }

        .gallery-loading-more {
          text-align: center;
          padding: 24px 0;
          color: var(--text-secondary);
          font-size: 14px;
        }

        .gallery-loading-more::after {
          content: '';
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid var(--border-subtle);
          border-top-color: var(--bili-pink);
          border-radius: 50%;
          animation: gallery-spin 0.8s linear infinite;
          margin-left: 8px;
          vertical-align: middle;
        }

        @keyframes gallery-spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .gallery-filters {
            flex-direction: column;
            align-items: stretch;
          }
          .gallery-filters .ant-picker,
          .gallery-filters .ant-select {
            width: 100%;
          }

          .gallery-back-top {
            right: 16px;
            bottom: 16px;
          }
        }
      `}</style>

      <div className="gallery-container" ref={containerRef}>
        <div className="bili-banner">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PictureOutlined style={{ color: '#FB7299' }} />
            视频封面画廊
          </h2>
          <p>瀑布流浏览模式 · 直观发现热门内容</p>
        </div>

        <div className="gallery-filters analytics-toolbar">
          {presets.map((p) => (
            <button
              key={p.key}
              onClick={() => {
                setActivePreset(p.key)
                setDateRange(presetToRange(p.key))
              }}
              className={`gallery-preset-btn${activePreset === p.key ? ' active' : ''}`}
            >
              {p.label}
            </button>
          ))}
          <Select
            placeholder="全部分区"
            value={partitionName}
            onChange={handlePartitionChange}
            allowClear
            style={{ minWidth: 160 }}
            options={partitions.map((name) => ({
              label: name,
              value: name,
            }))}
          />
      </div>

        {loading ? (
          <div style={{ display: 'flex', gap: 16 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ flex: 1 }}>
                <SkeletonCard />
              </div>
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="gallery-empty">
            <Empty description="暂无数据" />
          </div>
        ) : (
          <>
            <Masonry
              items={videos}
              onRender={maybeLoadMore}
              columnGutter={16}
              columnWidth={320}
              itemHeightEstimate={300}
              overscanBy={3}
              render={GalleryCard}
              itemKey={(data: GalleryVideo) => `${data.bvid}-${data.cover_url}`}
            />
            {loadingMore && (
              <div className="gallery-loading-more">加载中</div>
            )}
          </>
        )}
      </div>

      {showBackTop && (
        <button className="gallery-back-top" onClick={scrollToTop} title="返回顶部">
          <VerticalAlignTopOutlined />
        </button>
      )}
    </>
  )

  function GalleryCard({ data: video }: { index: number; data: GalleryVideo; width: number }) {
    return (
      <div
        className="gallery-card"
        onClick={() =>
          videoModal.open({
            bvid: video.bvid,
            title: video.title,
            uploaderName: video.uploader_name,
            viewCount: video.view_count,
          })
        }
      >
        <div
          className="gallery-cover"
          style={{
            backgroundImage: video.cover_url
              ? `url(${proxyCoverUrl(video.cover_url)})`
              : undefined,
          }}
        >
          <span className="gallery-duration-badge">
            {formatDuration(video.duration)}
          </span>
          <button
             className={`gallery-fav-btn${isFavorite(video.bvid) ? ' is-favorited' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              if (isFavorite(video.bvid)) {
                removeFavorite(video.bvid)
              } else {
                addFavorite({
                  bvid: video.bvid,
                  title: video.title,
                  uploader_name: video.uploader_name,
                  view_count: video.view_count,
                  like_count: video.like_count,
                  partition_name: video.partition_name,
                  cover_url: video.cover_url,
                  duration: video.duration,
                  addedAt: new Date().toISOString(),
                })
              }
            }}
            title={isFavorite(video.bvid) ? '取消收藏' : '收藏'}
          >
            {isFavorite(video.bvid) ? <HeartFilled /> : <HeartOutlined />}
          </button>
          <div className="gallery-cover-overlay">
            <span className="gallery-cover-overlay-title">
              {video.title}
            </span>
          </div>
        </div>

        <div className="gallery-card-body">
          <div className="gallery-card-title">
            {video.title}
          </div>
          <div className="gallery-card-uploader">
            {video.uploader_name}
          </div>
          <div className="gallery-card-stats">
            <span className="gallery-card-stat">
              <EyeOutlined />
              {formatCount(video.view_count)}
            </span>
            <span className="gallery-card-stat">
              <LikeOutlined />
              {formatCount(video.like_count)}
            </span>
          </div>
          <span className="gallery-partition-tag">
            {video.partition_name}
          </span>
        </div>
      </div>
    )
  }
}

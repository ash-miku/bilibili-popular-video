import React, { useState, useEffect, useCallback } from 'react'
import { DatePicker, Select, Button, Empty, message } from 'antd'
import {
  PictureOutlined,
  EyeOutlined,
  LikeOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { getGalleryList, getPartitionList, type GalleryVideo } from '../api'
import { useVideoModal } from './Player'
import { formatCount } from '../utils/format'

const { RangePicker } = DatePicker

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

  const [videos, setVideos] = useState<GalleryVideo[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [partitions, setPartitions] = useState<string[]>([])
  const [partitionName, setPartitionName] = useState<string | undefined>(undefined)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(7, 'day'),
    dayjs(),
  ])

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
      try {
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
      } catch {
        message.error('加载画廊数据失败，请稍后重试')
        if (!append) {
          setVideos([])
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [dateRange, partitionName],
  )

  useEffect(() => {
    void fetchData(1, false)
  }, [fetchData])

  const handleLoadMore = useCallback(() => {
    void fetchData(page + 1, true)
  }, [fetchData, page])

  const handleDateChange = useCallback(
    (dates: [Dayjs | null, Dayjs | null] | null) => {
      if (dates?.[0] && dates?.[1]) {
        setDateRange([dates[0], dates[1]])
      }
    },
    [],
  )

  const handlePartitionChange = useCallback((value: unknown) => {
    setPartitionName(value as string | undefined)
  }, [])

  const displayedCount = videos.length
  const hasMore = displayedCount < total
  const rangeText = `第 ${page} 页 · 已加载 ${displayedCount} / ${total} 个视频`

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

        .gallery-range-text {
          font-size: 13px;
          color: var(--text-secondary);
          margin-left: auto;
          white-space: nowrap;
        }

        .gallery-masonry {
          column-count: 4;
          column-gap: 16px;
        }

        @media (max-width: 1200px) {
          .gallery-masonry {
            column-count: 3;
          }
        }

        @media (max-width: 768px) {
          .gallery-masonry {
            column-count: 2;
          }

          .gallery-filters {
            flex-direction: column;
            align-items: stretch;
          }
          .gallery-filters .ant-picker,
          .gallery-filters .ant-select {
            width: 100%;
          }

          .gallery-range-text {
            margin-left: 0;
            text-align: center;
          }
        }

        /* ── Card ──────────────────────────────────────────── */

        .gallery-card {
          break-inside: avoid;
          display: inline-block;
          width: 100%;
          margin-bottom: 16px;
          border-radius: 12px;
          background: var(--bg-card-solid);
          border: 1px solid var(--border-subtle);
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .gallery-card:hover {
          transform: scale(1.03);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
          border-color: rgba(251, 114, 153, 0.3);
          z-index: 2;
        }

        /* ── Cover ─────────────────────────────────────────── */

        .gallery-cover {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          background-size: cover;
          background-position: center;
          background-color: var(--bg-card-solid);
          border-radius: 12px 12px 0 0;
          overflow: hidden;
        }

        .gallery-cover-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.7) 0%,
            transparent 60%
          );
          opacity: 0;
          transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: flex-end;
          padding: 12px;
        }

        .gallery-card:hover .gallery-cover-overlay {
          opacity: 1;
        }

        .gallery-cover-overlay-title {
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
        }

        .gallery-duration-badge {
          position: absolute;
          bottom: 8px;
          right: 8px;
          background: rgba(0, 0, 0, 0.75);
          color: #fff;
          font-size: 12px;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
          line-height: 1.4;
          z-index: 1;
        }

        .gallery-card:hover .gallery-duration-badge {
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        /* ── Card body ─────────────────────────────────────── */

        .gallery-card-body {
          padding: 12px;
        }

        .gallery-card-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .gallery-card-uploader {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 6px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .gallery-card-stats {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 8px;
        }

        .gallery-card-stat {
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }

        .gallery-partition-tag {
          display: inline-block;
          font-size: 11px;
          line-height: 1;
          color: #fff;
          background: var(--bili-pink);
          padding: 3px 8px;
          border-radius: 4px;
          font-weight: 500;
        }

        /* ── Skeleton ──────────────────────────────────────── */

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

        /* ── Load more ─────────────────────────────────────── */

        .gallery-load-more {
          text-align: center;
          padding: 24px 0;
        }

        /* ── Empty ─────────────────────────────────────────── */

        .gallery-empty {
          padding: 80px 0;
          text-align: center;
        }
      `}</style>

      <div className="gallery-container">
        <div className="bili-banner">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PictureOutlined style={{ color: '#FB7299' }} />
            视频封面画廊
          </h2>
          <p>瀑布流浏览模式 · 直观发现热门内容</p>
        </div>

        <div className="gallery-filters">
          <RangePicker
            value={dateRange}
            onChange={handleDateChange}
            allowClear={false}
            disabledDate={(d) => d.isAfter(dayjs())}
          />
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
          <span className="gallery-range-text">{rangeText}</span>
        </div>

        {loading ? (
          <div className="gallery-masonry">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="gallery-empty">
            <Empty description="暂无数据" />
          </div>
        ) : (
          <>
            <div className="gallery-masonry">
              {videos.map((video) => (
                <div
                  key={`${video.bvid}-${video.cover_url}`}
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
                        ? `url(${video.cover_url})`
                        : undefined,
                    }}
                  >
                    <span className="gallery-duration-badge">
                      {formatDuration(video.duration)}
                    </span>
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
              ))}
            </div>

            {hasMore && (
              <div className="gallery-load-more">
                <Button
                  onClick={handleLoadMore}
                  loading={loadingMore}
                  size="large"
                >
                  加载更多
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

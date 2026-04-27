import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Table, Tabs, Empty, Spin, Input, message } from 'antd'
import { SearchOutlined, HeartOutlined, HeartFilled } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { searchVideos, searchUploaders, type VideoStat, type UploaderStat } from '../api'
import { useVideoModal } from './Player'
import { useFavorites } from '../contexts/FavoritesContext'
import { formatCount } from '../utils/format'

const Search: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const q = searchParams.get('q') || ''
  const inputRef = useRef<any>(null)

  const [loading, setLoading] = useState(false)
  const [videos, setVideos] = useState<VideoStat[]>([])
  const [videoTotal, setVideoTotal] = useState(0)
  const [uploaders, setUploaders] = useState<UploaderStat[]>([])
  const [uploaderTotal, setUploaderTotal] = useState(0)
  const [videoPage, setVideoPage] = useState(1)
  const [uploaderPage, setUploaderPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [activeTab, setActiveTab] = useState('video')
  const videoModal = useVideoModal()
  const { addFavorite, removeFavorite, isFavorite } = useFavorites()

  useEffect(() => {
    if (!q && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [q])

  const handleSearch = useCallback((value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    setVideoPage(1)
    setUploaderPage(1)
    navigate(`/search?q=${encodeURIComponent(trimmed)}`, { replace: true })
  }, [navigate])

  const fetchVideos = useCallback(async () => {
    if (!q) return
    setLoading(true)
    try {
      const res = await searchVideos(q, videoPage, pageSize)
      setVideos(res.list ?? [])
      setVideoTotal(res.total ?? 0)
    } catch {
      message.error('搜索视频失败')
    } finally {
      setLoading(false)
    }
  }, [q, videoPage, pageSize])

  const fetchUploaders = useCallback(async () => {
    if (!q) return
    setLoading(true)
    try {
      const res = await searchUploaders(q, uploaderPage, pageSize)
      setUploaders(res.list ?? [])
      setUploaderTotal(res.total ?? 0)
    } catch {
      message.error('搜索UP主失败')
    } finally {
      setLoading(false)
    }
  }, [q, uploaderPage, pageSize])

  useEffect(() => {
    if (activeTab === 'video') {
      fetchVideos()
    } else {
      fetchUploaders()
    }
  }, [activeTab, fetchVideos, fetchUploaders])

  const videoColumns: ColumnsType<VideoStat> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: VideoStat) => (
        <a
          onClick={(e) => {
            e.preventDefault()
            videoModal.open({
              bvid: record.bvid,
              title: record.title,
              uploaderName: record.uploader_name,
              viewCount: record.view_count,
            })
          }}
          style={{ fontWeight: 500, cursor: 'pointer' }}
        >
          {text}
        </a>
      ),
    },
    {
      title: 'UP主',
      dataIndex: 'uploader_name',
      key: 'uploader',
      width: 130,
      ellipsis: true,
      render: (text: string) => <span style={{ color: 'var(--text-secondary)' }}>{text}</span>,
    },
    {
      title: '播放',
      dataIndex: 'view_count',
      key: 'views',
      width: 110,
      align: 'right' as const,
      sorter: (a, b) => a.view_count - b.view_count,
      render: (n: number) => <span style={{ color: '#FB7299', fontWeight: 600 }}>{formatCount(n)}</span>,
    },
    {
      title: '分区',
      dataIndex: 'partition_name',
      key: 'partition',
      width: 110,
      render: (text: string) => <span className="partition-tag">{text}</span>,
    },
    {
      title: '',
      key: 'fav',
      width: 40,
      align: 'center',
      render: (_: unknown, record: VideoStat) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (isFavorite(record.bvid)) removeFavorite(record.bvid)
            else addFavorite({
              bvid: record.bvid, title: record.title,
              uploader_name: record.uploader_name, view_count: record.view_count,
              like_count: record.like_count, partition_name: record.partition_name,
              cover_url: '', duration: 0, addedAt: new Date().toISOString(),
            })
          }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: isFavorite(record.bvid) ? '#FF6B6B' : 'var(--text-muted)',
            fontSize: 15, transition: 'color 0.2s, transform 0.2s', padding: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.2)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          {isFavorite(record.bvid) ? <HeartFilled /> : <HeartOutlined />}
        </button>
      ),
    },
  ]

  const uploaderColumns: ColumnsType<UploaderStat> = [
    {
      title: 'UP主',
      dataIndex: 'uploader_name',
      key: 'name',
      render: (text: string) => (
        <span style={{ fontWeight: 600 }}>{text}</span>
      ),
    },
    {
      title: '视频数',
      dataIndex: 'video_count',
      key: 'videos',
      width: 100,
      align: 'right' as const,
      sorter: (a, b) => a.video_count - b.video_count,
    },
    {
      title: '总播放',
      dataIndex: 'total_views',
      key: 'views',
      width: 120,
      align: 'right' as const,
      sorter: (a, b) => a.total_views - b.total_views,
      render: (n: number) => <span style={{ color: '#FB7299', fontWeight: 600 }}>{formatCount(n)}</span>,
    },
    {
      title: '平均播放',
      dataIndex: 'avg_views',
      key: 'avgViews',
      width: 120,
      align: 'right' as const,
      render: (n: number) => <span style={{ color: 'var(--bili-blue)' }}>{formatCount(Math.round(n))}</span>,
    },
  ]

  const searchInput = (
    <Input.Search
      ref={inputRef}
      placeholder="搜索视频标题或UP主名称..."
      allowClear
      enterButton="搜索"
      size="large"
      defaultValue={q}
      onSearch={handleSearch}
      style={{ maxWidth: 560, margin: '0 auto' }}
    />
  )

  if (!q) {
    return (
      <div>
        <div className="bili-banner">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SearchOutlined style={{ color: '#FB7299' }} />
            搜索
          </h2>
          <p>搜索视频标题或UP主名称，快速找到你想看的内容</p>
        </div>
        <div className="section-card">
          <div style={{ padding: '64px 40px', textAlign: 'center' }}>
            <div style={{ marginBottom: 32 }}>
              <SearchOutlined style={{ fontSize: 48, color: 'var(--text-muted)', opacity: 0.4 }} />
            </div>
            <div style={{ marginBottom: 24 }}>
              {searchInput}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              试试搜索 &quot;原神&quot;、&quot;搞笑&quot; 或任何你感兴趣的主题
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="bili-banner">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SearchOutlined style={{ color: '#FB7299' }} />
          搜索
        </h2>
        <p style={{ marginBottom: 16 }}>
          搜索 &quot;<span style={{ color: '#FB7299', fontWeight: 600 }}>{q}</span>&quot;
          ，找到 {activeTab === 'video' ? videoTotal : uploaderTotal} 条结果
        </p>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {searchInput}
        </div>
      </div>

      <div className="section-card">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key)
            setVideoPage(1)
            setUploaderPage(1)
          }}
          items={[
            {
              key: 'video',
              label: `视频 (${videoTotal})`,
              children: (
                <Spin spinning={loading && activeTab === 'video'}>
                  {videos.length === 0 && !loading ? (
                    <div style={{ padding: '60px 0' }}>
                      <Empty description="未找到匹配的视频" />
                    </div>
                  ) : (
                    <Table<VideoStat>
                      rowKey="bvid"
                      columns={videoColumns}
                      dataSource={videos}
                      pagination={{
                        current: videoPage,
                        pageSize,
                        total: videoTotal,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        pageSizeOptions: ['10', '20', '50'],
                        showTotal: (t) => `共 ${t} 个视频`,
                        onChange: (p, ps) => {
                          setVideoPage(p)
                          setPageSize(ps)
                        },
                      }}
                      size="middle"
                    />
                  )}
                </Spin>
              ),
            },
            {
              key: 'uploader',
              label: `UP主 (${uploaderTotal})`,
              children: (
                <Spin spinning={loading && activeTab === 'uploader'}>
                  {uploaders.length === 0 && !loading ? (
                    <div style={{ padding: '60px 0' }}>
                      <Empty description="未找到匹配的UP主" />
                    </div>
                  ) : (
                    <Table<UploaderStat>
                      rowKey="uploader_mid"
                      columns={uploaderColumns}
                      dataSource={uploaders}
                      pagination={{
                        current: uploaderPage,
                        pageSize,
                        total: uploaderTotal,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        pageSizeOptions: ['10', '20', '50'],
                        showTotal: (t) => `共 ${t} 位UP主`,
                        onChange: (p, ps) => {
                          setUploaderPage(p)
                          setPageSize(ps)
                        },
                      }}
                      size="middle"
                    />
                  )}
                </Spin>
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}

export default Search

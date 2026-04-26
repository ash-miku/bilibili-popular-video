import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { Row, Col, Table, Spin, message, Input, Select, Button, Tooltip } from 'antd'
import {
  PlayCircleOutlined,
  UserOutlined,
  EyeOutlined,
  RiseOutlined,
  SearchOutlined,
  SyncOutlined,
  CloudSyncOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import dayjs from 'dayjs'
import {
  getOverview,
  getRanking,
  getCategoryDistribution,
  syncData,
  type OverviewData,
  type VideoStat,
} from '../api'
import { useVideoModal } from './Player'

echarts.use([PieChart, TitleComponent, TooltipComponent, LegendComponent, CanvasRenderer])

function formatCount(n: number): string {
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1).replace(/\.0$/, '') + '亿'
  if (n >= 10_000) return (n / 10_000).toFixed(1).replace(/\.0$/, '') + '万'
  return n.toLocaleString()
}

const today = () => {
  const now = dayjs()
  const hour = now.hour()
  if (hour >= 1) return now.format('YYYY-MM-DD')
  return now.subtract(1, 'day').format('YYYY-MM-DD')
}

const STAT_CARDS = [
  { title: '热门视频数', key: 'total_videos' as const, icon: <PlayCircleOutlined />, color: '#23ADE5', bg: 'rgba(35,173,229,0.12)' },
  { title: '新增视频', key: 'total_videos' as const, suffix: '今日', icon: <RiseOutlined />, color: '#FB7299', bg: 'rgba(251,114,153,0.12)' },
  { title: '活跃UP主', key: 'total_uploaders' as const, icon: <UserOutlined />, color: '#FFB027', bg: 'rgba(255,176,39,0.12)' },
  { title: '总播放量', key: 'total_views' as const, icon: <EyeOutlined />, color: '#02B340', bg: 'rgba(2,179,64,0.12)' },
]

const PIE_PALETTE = [
  '#FB7299', '#23ADE5', '#FFB027', '#02B340', '#7B5FFF',
  '#4ECDC4', '#FF6B6B',
]

function AnimatedNumber({ value, format }: { value: number; format?: (v: number) => string }) {
  const [displayed, setDisplayed] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const duration = 1200
    const start = performance.now()
    const from = displayed
    const to = value

    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.round(from + (to - from) * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return <>{format ? format(displayed) : displayed.toLocaleString()}</>
}

function makeRankingColumns(onTitleClick: (record: VideoStat) => void): ColumnsType<VideoStat> {
  return [
    {
      title: '排名',
      dataIndex: 'rank_position',
      key: 'rank',
      width: 64,
      align: 'center',
      render: (pos: number | null, _, idx) => {
        const rank = pos ?? idx + 1
        const cls = rank <= 3 ? `rank-${rank}` : 'rank-default'
        return <span className={`rank-badge ${cls}`}>{rank}</span>
      },
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 280,
      render: (text: string, record: VideoStat) => (
        <span
          onClick={() => onTitleClick(record)}
          style={{
            fontWeight: 500,
            color: 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'color 0.2s',
            display: 'inline-block',
            maxWidth: 280,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--bili-pink)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
        >
          {text}
        </span>
      ),
    },
    {
      title: 'UP主',
      dataIndex: 'uploader_name',
      key: 'uploader',
      width: 110,
      ellipsis: true,
      render: (text: string) => <span style={{ color: 'var(--text-secondary)' }}>{text}</span>,
    },
    {
      title: '分区',
      dataIndex: 'partition_name',
      key: 'partition',
      width: 90,
      render: (text: string) => <span className="partition-tag">{text}</span>,
    },
    {
      title: '播放',
      dataIndex: 'view_count',
      key: 'views',
      width: 90,
      align: 'right',
      sorter: (a, b) => a.view_count - b.view_count,
      render: (n: number) => <span style={{ color: '#FB7299', fontWeight: 500 }}>{formatCount(n)}</span>,
    },
    {
      title: '点赞',
      dataIndex: 'like_count',
      key: 'likes',
      width: 90,
      align: 'right',
      sorter: (a, b) => a.like_count - b.like_count,
      render: (n: number) => <span style={{ color: '#23ADE5', fontWeight: 500 }}>{formatCount(n)}</span>,
    },
    {
      title: '弹幕',
      dataIndex: 'danmaku_count',
      key: 'danmaku',
      width: 90,
      align: 'right',
      sorter: (a, b) => a.danmaku_count - b.danmaku_count,
      render: (n: number) => <span style={{ color: '#FFB027' }}>{formatCount(n)}</span>,
    },
  ]
}

const Dashboard: React.FC = () => {
  const getThemeColor = (varName: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(varName).trim()

  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [ranking, setRanking] = useState<VideoStat[]>([])
  const [categoryData, setCategoryData] = useState<{ name: string; value: number }[]>([])
  const [searchText, setSearchText] = useState('')
  const [filterPartition, setFilterPartition] = useState<string>('')
  const videoModal = useVideoModal()

  const partitionOptions = useMemo(
    () => [...new Set(ranking.map((r) => r.partition_name).filter(Boolean))].map((n) => ({ label: n, value: n })),
    [ranking],
  )

  const filteredRanking = useMemo(() => {
    return ranking.filter((v) => {
      const matchSearch = !searchText || v.title.toLowerCase().includes(searchText.toLowerCase()) || v.uploader_name.toLowerCase().includes(searchText.toLowerCase())
      const matchPartition = !filterPartition || v.partition_name === filterPartition
      return matchSearch && matchPartition
    })
  }, [ranking, searchText, filterPartition])

  useEffect(() => {
    const date = today()
    setLoading(true)

    Promise.all([
      getOverview(date).catch((err: Error) => { message.error('加载概览数据失败: ' + err.message); return null }),
      getRanking({ page: 1, pageSize: 20, date }).catch((err: Error) => { message.error('加载排行榜失败: ' + err.message); return null }),
      getCategoryDistribution(date).catch((err: Error) => { message.error('加载分区分布失败: ' + err.message); return null }),
    ]).then(([ov, rk, cd]) => {
      if (ov) setOverview(ov)
      if (rk) setRanking(rk.list ?? [])
      if (cd) setCategoryData(Object.entries(cd).map(([name, value]) => ({ name, value })))
    }).finally(() => setLoading(false))
  }, [])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    try {
      const result = await syncData()
      message.success(`同步成功！日期: ${result.date}`)
      const date = today()
      const [ov, rk, cd] = await Promise.all([
        getOverview(date).catch(() => null),
        getRanking({ page: 1, pageSize: 20, date }).catch(() => null),
        getCategoryDistribution(date).catch(() => null),
      ])
      if (ov) setOverview(ov)
      if (rk) setRanking(rk.list ?? [])
      if (cd) setCategoryData(Object.entries(cd).map(([name, value]) => ({ name, value })))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误'
      message.error('同步失败: ' + msg)
    } finally {
      setSyncing(false)
    }
  }, [])

  const groupedData = useMemo(() => {
    const sorted = [...categoryData].sort((a, b) => b.value - a.value)
    if (sorted.length <= 7) return sorted
    const top = sorted.slice(0, 6)
    const otherValue = sorted.slice(6).reduce((s, d) => s + d.value, 0)
    return [...top, { name: '其他', value: otherValue }]
  }, [categoryData])

  const pieTotal = groupedData.reduce((s, d) => s + d.value, 0)

  const pieOption = {
    backgroundColor: 'transparent',
    color: PIE_PALETTE,
    tooltip: {
      trigger: 'item' as const,
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: getThemeColor('--bg-card-solid') || 'rgba(25,25,50,0.92)',
      borderColor: getThemeColor('--border-card') || 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      textStyle: { color: getThemeColor('--text-primary') || '#e8e8f0', fontSize: 13 },
    },
    title: {
      text: '分区视频数量分布',
      left: 'left',
      top: 0,
      textStyle: { fontSize: 15, fontWeight: 600, color: getThemeColor('--text-primary') || '#e8e8f0' },
    },
    legend: {
      orient: 'vertical' as const,
      right: 0,
      top: 'middle',
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 14,
      textStyle: { fontSize: 12, color: getThemeColor('--text-secondary') || '#9a9ab0' },
    },
    graphic: [
      {
        type: 'text' as const,
        left: '30%',
        top: '45%',
        style: {
          text: formatCount(pieTotal),
          textAlign: 'center',
          fill: getThemeColor('--text-primary') || '#e8e8f0',
          fontSize: 22,
          fontWeight: 700,
        },
      },
      {
        type: 'text' as const,
        left: '30%',
        top: '45%',
        style: {
          text: '视频总数',
          textAlign: 'center',
          fill: getThemeColor('--text-secondary') || '#9a9ab0',
          fontSize: 11,
          y: 18,
        },
      },
    ],
    series: [
      {
        type: 'pie',
        radius: ['55%', '80%'],
        center: ['35%', '52%'],
        avoidLabelOverlap: false,
        animationType: 'scale',
        animationEasing: 'elasticOut',
        itemStyle: {
          borderRadius: 4,
          borderColor: getThemeColor('--bg-card-solid') || '#1a1a2e',
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: {
          scaleSize: 8,
          label: { show: false },
          itemStyle: {
            shadowBlur: 20,
            shadowOffsetX: 0,
            shadowColor: 'rgba(251,114,153,0.35)',
          },
        },
        data: groupedData,
      },
    ],
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  const getStatValue = (key: keyof OverviewData) => overview?.[key] ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="bili-banner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>B站热门视频分析平台</h2>
            <p>实时追踪热门视频数据 · 洞察流量趋势 · 发现优质UP主</p>
          </div>
          <Tooltip title="将 PostgreSQL 数据同步到 ClickHouse">
            <Button
              type="primary"
              icon={syncing ? <SyncOutlined spin /> : <CloudSyncOutlined />}
              loading={syncing}
              onClick={handleSync}
              style={{
                borderRadius: 8,
                height: 40,
                fontWeight: 500,
                boxShadow: syncing ? 'none' : '0 2px 8px rgba(251,114,153,0.3)',
              }}
            >
              {syncing ? '同步中...' : '同步数据'}
            </Button>
          </Tooltip>
        </div>
      </div>

      <Row gutter={20}>
        {STAT_CARDS.map((card, idx) => (
          <Col span={6} key={idx}>
            <div
              className={`stat-card animate-in animate-in-${idx + 1}`}
              style={{ '--card-accent': card.color } as React.CSSProperties}
            >
              <div className="stat-icon" style={{ background: card.bg, color: card.color }}>
                {card.icon}
              </div>
              <div className="stat-value">
                <AnimatedNumber
                  value={getStatValue(card.key)}
                  format={card.title === '总播放量' ? (v) => v.toLocaleString() : formatCount}
                />
                {card.suffix && (
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 6 }}>
                    {card.suffix}
                  </span>
                )}
              </div>
              <div className="stat-label">{card.title}</div>
              <span className="stat-bg-icon">{card.icon}</span>
            </div>
          </Col>
        ))}
      </Row>

      <Row gutter={20}>
        <Col span={16}>
          <div className="section-card">
            <div className="section-header">
              <div className="section-title">
                <span className="title-dot" />
                热门排行榜 Top 20
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Input
                  placeholder="搜索标题或UP主"
                  prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  allowClear
                  style={{ width: 180 }}
                />
                <Select
                  placeholder="分区"
                  value={filterPartition || undefined}
                  onChange={(val) => setFilterPartition(val ?? '')}
                  options={[{ label: '全部分区', value: '' }, ...partitionOptions]}
                  allowClear
                  style={{ width: 140 }}
                />
              </div>
            </div>
            <Table<VideoStat>
              dataSource={filteredRanking}
              columns={makeRankingColumns((v) => videoModal.open({
                bvid: v.bvid,
                title: v.title,
                uploaderName: v.uploader_name,
                viewCount: v.view_count,
              }))}
              rowKey="bvid"
              pagination={false}
              size="middle"
              style={{ fontSize: 13 }}
            />
          </div>
        </Col>

        <Col span={8}>
          <div className="section-card" style={{ height: '100%' }}>
            <ReactEChartsCore
              echarts={echarts}
              option={pieOption}
              style={{ height: 500 }}
              notMerge
              lazyUpdate
            />
          </div>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard

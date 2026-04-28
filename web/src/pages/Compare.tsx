import React, { useState, useCallback, useMemo } from 'react'
import { Tabs, Input, Spin, Empty, message, Row, Col } from 'antd'
import { FundOutlined, SearchOutlined, PlayCircleOutlined, UserOutlined } from '@ant-design/icons'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import dayjs from 'dayjs'
import {
  searchVideos,
  searchUploaders,
  getLaunchCurve,
  getVideoTrend,
  getUploaderDetail,
  type VideoStat,
  type UploaderStat,
  type LaunchCurveStat,
} from '../api'
import { useVideoModal } from './Player'
import { formatCount } from '../utils/format'

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
])

interface VideoCompareItem {
  bvid: string
  title: string
  uploader_name: string
  view_count: number
  like_count: number
  danmaku_count: number
  coin_count: number
  favorite_count: number
  share_count: number
  reply_count: number
}

interface UploaderCompareItem {
  mid: number
  name: string
  video_count: number
  total_views: number
  total_likes: number
  avg_views: number
}

const COMPARE_COLORS = ['#FB7299', '#23ADE5']

const Compare: React.FC = () => {
  const [activeTab, setActiveTab] = useState('video')
  const videoModal = useVideoModal()

  return (
    <div className="analytics-page">
      <div className="bili-banner">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FundOutlined style={{ color: '#FB7299' }} />
          数据对比
        </h2>
        <p>视频/UP主数据横向对比</p>
      </div>

      <div className="section-card">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'video', label: '视频对比', children: <VideoCompare /> },
            { key: 'uploader', label: 'UP主对比', children: <UploaderCompare /> },
          ]}
        />
      </div>
    </div>
  )
}

function VideoCompare() {
  const videoModal = useVideoModal()
  const [queryA, setQueryA] = useState('')
  const [queryB, setQueryB] = useState('')
  const [itemA, setItemA] = useState<VideoCompareItem | null>(null)
  const [itemB, setItemB] = useState<VideoCompareItem | null>(null)
  const [curveA, setCurveA] = useState<LaunchCurveStat[]>([])
  const [curveB, setCurveB] = useState<LaunchCurveStat[]>([])
  const [loading, setLoading] = useState(false)
  const [trendA, setTrendA] = useState<{ snapshot_date: string; view_count: number }[]>([])
  const [trendB, setTrendB] = useState<{ snapshot_date: string; view_count: number }[]>([])

  const searchAndSelect = useCallback(
    async (query: string, side: 'A' | 'B') => {
      if (!query.trim()) return
      setLoading(true)
      try {
        const res = await searchVideos(query.trim(), 1, 1)
        const first = (res.list ?? [])[0]
        if (!first) {
          message.info('未找到匹配的视频')
          return
        }
        const item: VideoCompareItem = {
          bvid: first.bvid,
          title: first.title,
          uploader_name: first.uploader_name,
          view_count: first.view_count,
          like_count: first.like_count,
          danmaku_count: first.danmaku_count,
          coin_count: first.coin_count,
          favorite_count: first.favorite_count,
          share_count: first.share_count,
          reply_count: first.reply_count,
        }
        if (side === 'A') setItemA(item)
        else setItemB(item)

        const end = dayjs().format('YYYY-MM-DD')
        const start = dayjs().subtract(30, 'day').format('YYYY-MM-DD')

        const [curveData, trendData] = await Promise.all([
          getLaunchCurve(first.bvid).catch(() => []),
          getVideoTrend(first.bvid, start, end).catch(() => []),
        ])

        const trendRows = (trendData as { snapshot_date?: string; view_count: number }[]).map((d) => ({
          snapshot_date: (d as Record<string, unknown>).snapshot_date as string ?? '',
          view_count: d.view_count,
        }))

        if (side === 'A') {
          setCurveA(curveData ?? [])
          setTrendA(trendRows)
        } else {
          setCurveB(curveData ?? [])
          setTrendB(trendRows)
        }
      } catch {
        message.error('搜索视频失败')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const trendOption = useMemo(() => {
    if (trendA.length === 0 && trendB.length === 0) return null
    const allDates = [...new Set([
      ...trendA.map((d) => d.snapshot_date),
      ...trendB.map((d) => d.snapshot_date),
    ])].sort()

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(25,25,50,0.92)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        textStyle: { color: '#e8e8f0', fontSize: 13 },
      },
      legend: {
        top: 0,
        textStyle: { fontSize: 13, color: '#9a9ab0' },
      },
      grid: { left: 60, right: 30, top: 40, bottom: 30 },
      xAxis: {
        type: 'category' as const,
        data: allDates.map((d) => dayjs(d).format('MM/DD')),
        boundaryGap: false,
        axisLabel: { fontSize: 11, color: '#5e5e78' },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { formatter: (v: number) => formatCount(v), color: '#5e5e78', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      series: [
        {
          name: itemA?.title?.slice(0, 15) ?? 'A',
          type: 'line' as const,
          smooth: true,
          data: allDates.map((d) => {
            const found = trendA.find((t) => t.snapshot_date === d)
            return found ? found.view_count : null
          }),
          lineStyle: { width: 2.5, color: COMPARE_COLORS[0] },
          itemStyle: { color: COMPARE_COLORS[0] },
          connectNulls: true,
        },
        {
          name: itemB?.title?.slice(0, 15) ?? 'B',
          type: 'line' as const,
          smooth: true,
          data: allDates.map((d) => {
            const found = trendB.find((t) => t.snapshot_date === d)
            return found ? found.view_count : null
          }),
          lineStyle: { width: 2.5, color: COMPARE_COLORS[1] },
          itemStyle: { color: COMPARE_COLORS[1] },
          connectNulls: true,
        },
      ],
    }
  }, [trendA, trendB, itemA, itemB])

  const statFields = [
    { key: 'view_count', label: '播放量' },
    { key: 'like_count', label: '点赞' },
    { key: 'danmaku_count', label: '弹幕' },
    { key: 'coin_count', label: '投币' },
    { key: 'favorite_count', label: '收藏' },
    { key: 'share_count', label: '分享' },
    { key: 'reply_count', label: '评论' },
  ] as const

  function StatCompareRow({ field, a, b }: { field: string; a: number; b: number }) {
    const total = a + b || 1
    const pctA = Math.round((a / total) * 100)
    const pctB = 100 - pctA
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ width: 80, textAlign: 'right', color: COMPARE_COLORS[0], fontWeight: 600, fontSize: 14 }}>
          {formatCount(a)}
        </span>
        <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${pctA}%`, background: COMPARE_COLORS[0], borderRadius: '4px 0 0 4px', transition: 'width 0.3s' }} />
          <div style={{ width: `${pctB}%`, background: COMPARE_COLORS[1], borderRadius: '0 4px 4px 0', transition: 'width 0.3s' }} />
        </div>
        <span style={{ width: 80, color: COMPARE_COLORS[1], fontWeight: 600, fontSize: 14 }}>
          {formatCount(b)}
        </span>
      </div>
    )
  }

  return (
    <div>
      <Row gutter={[16, 16]} className="analytics-mobile-two-col" style={{ marginBottom: 20 }}>
        <Col span={12}>
          <Input.Search
            placeholder="搜索视频A（输入标题或BV号）"
            value={queryA}
            onChange={(e) => setQueryA(e.target.value)}
            onSearch={(v) => searchAndSelect(v, 'A')}
            enterButton={<><SearchOutlined /> 搜索</>}
            allowClear
          />
        </Col>
        <Col span={12}>
          <Input.Search
            placeholder="搜索视频B（输入标题或BV号）"
            value={queryB}
            onChange={(e) => setQueryB(e.target.value)}
            onSearch={(v) => searchAndSelect(v, 'B')}
            enterButton={<><SearchOutlined /> 搜索</>}
            allowClear
          />
        </Col>
      </Row>

      <Spin spinning={loading}>
        {itemA || itemB ? (
          <>
            <Row gutter={[16, 16]} className="analytics-mobile-two-col" style={{ marginBottom: 20 }}>
              {[itemA, itemB].map((item, idx) => (
                <Col span={12} key={idx}>
                  {item ? (
                      <div
                        className="analytics-compare-card"
                        style={{
                          border: `2px solid ${COMPARE_COLORS[idx]}`,
                          cursor: 'pointer',
                        }}
                      onClick={() => videoModal.open({
                        bvid: item.bvid,
                        title: item.title,
                        uploaderName: item.uploader_name,
                        viewCount: item.view_count,
                      })}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <PlayCircleOutlined style={{ color: COMPARE_COLORS[idx], fontSize: 18 }} />
                        <span style={{ fontWeight: 600, color: COMPARE_COLORS[idx] }}>
                          {idx === 0 ? 'A' : 'B'}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4, color: 'var(--text-primary)' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {item.uploader_name} · 播放 {formatCount(item.view_count)}
                      </div>
                    </div>
                  ) : (
                    <div className="analytics-compare-card" style={{
                      padding: 40, border: '2px dashed var(--border-subtle)',
                      textAlign: 'center', color: 'var(--text-muted)',
                    }}>
                      <PlayCircleOutlined style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }} />
                      <div>搜索并选择视频 {idx === 0 ? 'A' : 'B'}</div>
                    </div>
                  )}
                </Col>
              ))}
            </Row>

            {itemA && itemB && (
              <div className="section-card" style={{ padding: 20 }}>
                <div className="section-title" style={{ marginBottom: 16 }}>
                  <span className="title-dot" />
                  数据对比
                </div>
                {statFields.map((f) => (
                  <div key={f.key}>
                    <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      {f.label}
                    </div>
                    <StatCompareRow field={f.key} a={itemA[f.key]} b={itemB[f.key]} />
                  </div>
                ))}
              </div>
            )}

            {trendOption && (
              <div className="section-card" style={{ marginTop: 20 }}>
                <div className="section-header">
                  <div className="section-title">
                    <span className="title-dot" style={{ background: '#23ADE5' }} />
                    播放量趋势对比
                  </div>
                </div>
                <div className="section-body">
                  <ReactEChartsCore
                    echarts={echarts}
                    option={trendOption}
                    style={{ height: 380 }}
                    notMerge
                    lazyUpdate
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Empty description="搜索两个视频进行数据对比" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        )}
      </Spin>
    </div>
  )
}

function UploaderCompare() {
  const [queryA, setQueryA] = useState('')
  const [queryB, setQueryB] = useState('')
  const [itemA, setItemA] = useState<UploaderCompareItem | null>(null)
  const [itemB, setItemB] = useState<UploaderCompareItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailA, setDetailA] = useState<{ stat_date: string; total_views: number }[]>([])
  const [detailB, setDetailB] = useState<{ stat_date: string; total_views: number }[]>([])

  const searchAndSelect = useCallback(
    async (query: string, side: 'A' | 'B') => {
      if (!query.trim()) return
      setLoading(true)
      try {
        const res = await searchUploaders(query.trim(), 1, 1)
        const first = (res.list ?? [])[0]
        if (!first) {
          message.info('未找到匹配的UP主')
          return
        }
        const item: UploaderCompareItem = {
          mid: first.uploader_mid,
          name: first.uploader_name,
          video_count: first.video_count,
          total_views: first.total_views,
          total_likes: first.total_likes,
          avg_views: first.avg_views,
        }
        if (side === 'A') setItemA(item)
        else setItemB(item)

        const end = dayjs().format('YYYY-MM-DD')
        const start = dayjs().subtract(30, 'day').format('YYYY-MM-DD')
        const detail = await getUploaderDetail(first.uploader_mid, start, end).catch(() => [])
        const rows = (detail as { stat_date?: string; total_views: number }[]).map((d) => ({
          stat_date: (d as Record<string, unknown>).stat_date as string ?? '',
          total_views: d.total_views,
        }))

        if (side === 'A') setDetailA(rows)
        else setDetailB(rows)
      } catch {
        message.error('搜索UP主失败')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const trendOption = useMemo(() => {
    if (detailA.length === 0 && detailB.length === 0) return null
    const allDates = [...new Set([
      ...detailA.map((d) => d.stat_date),
      ...detailB.map((d) => d.stat_date),
    ])].sort()

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(25,25,50,0.92)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        textStyle: { color: '#e8e8f0', fontSize: 13 },
      },
      legend: {
        top: 0,
        textStyle: { fontSize: 13, color: '#9a9ab0' },
      },
      grid: { left: 60, right: 30, top: 40, bottom: 30 },
      xAxis: {
        type: 'category' as const,
        data: allDates.map((d) => dayjs(d).format('MM/DD')),
        boundaryGap: false,
        axisLabel: { fontSize: 11, color: '#5e5e78' },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { formatter: (v: number) => formatCount(v), color: '#5e5e78', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      series: [
        {
          name: itemA?.name ?? 'A',
          type: 'line' as const,
          smooth: true,
          data: allDates.map((d) => {
            const found = detailA.find((t) => t.stat_date === d)
            return found ? found.total_views : null
          }),
          lineStyle: { width: 2.5, color: COMPARE_COLORS[0] },
          itemStyle: { color: COMPARE_COLORS[0] },
          connectNulls: true,
        },
        {
          name: itemB?.name ?? 'B',
          type: 'line' as const,
          smooth: true,
          data: allDates.map((d) => {
            const found = detailB.find((t) => t.stat_date === d)
            return found ? found.total_views : null
          }),
          lineStyle: { width: 2.5, color: COMPARE_COLORS[1] },
          itemStyle: { color: COMPARE_COLORS[1] },
          connectNulls: true,
        },
      ],
    }
  }, [detailA, detailB, itemA, itemB])

  const statFields = [
    { key: 'video_count' as const, label: '视频数' },
    { key: 'total_views' as const, label: '总播放' },
    { key: 'total_likes' as const, label: '总点赞' },
    { key: 'avg_views' as const, label: '平均播放' },
  ]

  function StatBar({ label, a, b }: { label: string; a: number; b: number }) {
    const total = a + b || 1
    const pctA = Math.round((a / total) * 100)
    const pctB = 100 - pctA
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 80, textAlign: 'right', color: COMPARE_COLORS[0], fontWeight: 600, fontSize: 14 }}>
            {formatCount(a)}
          </span>
          <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${pctA}%`, background: COMPARE_COLORS[0], borderRadius: '4px 0 0 4px', transition: 'width 0.3s' }} />
            <div style={{ width: `${pctB}%`, background: COMPARE_COLORS[1], borderRadius: '0 4px 4px 0', transition: 'width 0.3s' }} />
          </div>
          <span style={{ width: 80, color: COMPARE_COLORS[1], fontWeight: 600, fontSize: 14 }}>
            {formatCount(b)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Row gutter={[16, 16]} className="analytics-mobile-two-col" style={{ marginBottom: 20 }}>
        <Col span={12}>
          <Input.Search
            placeholder="搜索UP主A"
            value={queryA}
            onChange={(e) => setQueryA(e.target.value)}
            onSearch={(v) => searchAndSelect(v, 'A')}
            enterButton={<><SearchOutlined /> 搜索</>}
            allowClear
          />
        </Col>
        <Col span={12}>
          <Input.Search
            placeholder="搜索UP主B"
            value={queryB}
            onChange={(e) => setQueryB(e.target.value)}
            onSearch={(v) => searchAndSelect(v, 'B')}
            enterButton={<><SearchOutlined /> 搜索</>}
            allowClear
          />
        </Col>
      </Row>

      <Spin spinning={loading}>
        {itemA || itemB ? (
          <>
            <Row gutter={[16, 16]} className="analytics-mobile-two-col" style={{ marginBottom: 20 }}>
              {[itemA, itemB].map((item, idx) => (
                <Col span={12} key={idx}>
                  {item ? (
                    <div className="analytics-compare-card" style={{
                      border: `2px solid ${COMPARE_COLORS[idx]}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <UserOutlined style={{ color: COMPARE_COLORS[idx], fontSize: 18 }} />
                        <span style={{ fontWeight: 600, color: COMPARE_COLORS[idx] }}>
                          {idx === 0 ? 'A' : 'B'}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4, color: 'var(--text-primary)' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {item.video_count} 个视频 · 总播放 {formatCount(item.total_views)}
                      </div>
                    </div>
                  ) : (
                    <div className="analytics-compare-card" style={{
                      padding: 40, border: '2px dashed var(--border-subtle)',
                      textAlign: 'center', color: 'var(--text-muted)',
                    }}>
                      <UserOutlined style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }} />
                      <div>搜索并选择UP主 {idx === 0 ? 'A' : 'B'}</div>
                    </div>
                  )}
                </Col>
              ))}
            </Row>

            {itemA && itemB && (
              <div className="section-card" style={{ padding: 20 }}>
                <div className="section-title" style={{ marginBottom: 16 }}>
                  <span className="title-dot" />
                  数据对比
                </div>
                {statFields.map((f) => (
                  <StatBar
                    key={f.key}
                    label={f.label}
                    a={Math.round(itemA[f.key])}
                    b={Math.round(itemB[f.key])}
                  />
                ))}
              </div>
            )}

            {trendOption && (
              <div className="section-card" style={{ marginTop: 20 }}>
                <div className="section-header">
                  <div className="section-title">
                    <span className="title-dot" style={{ background: '#23ADE5' }} />
                    播放量趋势对比
                  </div>
                </div>
                <div className="section-body">
                  <ReactEChartsCore
                    echarts={echarts}
                    option={trendOption}
                    style={{ height: 380 }}
                    notMerge
                    lazyUpdate
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Empty description="搜索两位UP主进行数据对比" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        )}
      </Spin>
    </div>
  )
}

export default Compare

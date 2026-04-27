import React, { useState, useCallback } from 'react'
import { Input, Spin, Empty, message } from 'antd'
import { AimOutlined } from '@ant-design/icons'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, DataZoomComponent, MarkPointComponent, MarkLineComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { getLaunchCurve, searchVideos, type VideoStat, type LaunchCurveStat } from '../api'
import { formatCount } from '../utils/format'

echarts.use([LineChart, GridComponent, TooltipComponent, DataZoomComponent, MarkPointComponent, MarkLineComponent, CanvasRenderer])

const RankTracker: React.FC = () => {
  const getThemeColor = (varName: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<VideoStat[]>([])
  const [selectedVideo, setSelectedVideo] = useState<VideoStat | null>(null)
  const [curve, setCurve] = useState<LaunchCurveStat[]>([])

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) return
    try {
      const res = await searchVideos(query, 1, 5)
      setSearchResults(res.list ?? [])
    } catch { message.error('搜索失败') }
  }, [])

  const handleSelect = useCallback(async (video: VideoStat) => {
    setSelectedVideo(video)
    setSearchResults([])
    setLoading(true)
    try {
      const res = await getLaunchCurve(video.bvid)
      setCurve(res ?? [])
    } catch { message.error('加载排名数据失败') }
    finally { setLoading(false) }
  }, [])

  const chartOption = curve.length > 0 ? {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: getThemeColor('--bg-card-solid') || 'rgba(25,25,50,0.92)',
      textStyle: { color: getThemeColor('--text-primary') || '#e8e8f0', fontSize: 13 },
      formatter: (params: Array<{ name: string; value: number; seriesName: string }>) => {
        if (!params.length) return ''
        const p = params[0]
        return `${p.name}<br/>排名: #${p.value}<br/>播放: ${formatCount(curve.find((c) => String(c.snapshot_date).slice(5) === p.name)?.view_count ?? 0)}`
      },
    },
    grid: { left: 50, right: 20, top: 40, bottom: 60 },
    xAxis: {
      type: 'category' as const,
      data: curve.map((c) => String(c.snapshot_date).slice(5)),
      axisLabel: { color: getThemeColor('--text-muted') || '#5e5e78', fontSize: 11, rotate: 30 },
    },
    yAxis: {
      type: 'value' as const,
      inverse: true,
      min: 1,
      axisLabel: { color: getThemeColor('--text-muted') || '#5e5e78' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      name: '排名',
      nameTextStyle: { color: getThemeColor('--text-secondary') || '#9a9ab0' },
    },
    dataZoom: [{ type: 'inside' as const }],
    series: [{
      type: 'line' as const,
      data: curve.map((c) => c.rank_position ?? 999),
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: '#FB7299', width: 3 },
      itemStyle: { color: '#FB7299' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(251,114,153,0.15)' },
          { offset: 1, color: 'rgba(251,114,153,0.02)' },
        ]),
      },
      markPoint: curve.some((c) => c.rank_position && c.rank_position <= 3) ? {
        data: [{ type: 'min' as const, name: '最高排名', symbolSize: 40, label: { fontSize: 11 } }],
        itemStyle: { color: '#FFB027' },
      } : undefined,
    }],
  } : null

  return (
    <div>
      <div className="bili-banner" style={{ marginBottom: 20 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AimOutlined style={{ color: '#FB7299' }} />
          排名追踪
        </h2>
        <p>追踪视频在不同日期的排名变化趋势</p>
      </div>

      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 560 }}>
        <Input.Search
          placeholder="搜索视频标题..."
          enterButton="追踪"
          size="large"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onSearch={handleSearch}
        />
        {searchResults.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
            background: 'var(--bg-card-solid)', border: '1px solid var(--border-card)',
            borderRadius: 8, maxHeight: 200, overflow: 'auto',
          }}>
            {searchResults.map((v) => (
              <div key={v.bvid}
                onClick={() => { setSearchQuery(v.title); handleSelect(v) }}
                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >{v.title} <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>- {v.uploader_name}</span></div>
            ))}
          </div>
        )}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>}

      {selectedVideo && !loading && (
        <div className="section-card" style={{ marginBottom: 20 }}>
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{selectedVideo.title}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              {selectedVideo.uploader_name} · {selectedVideo.partition_name} · 播放 {formatCount(selectedVideo.view_count)}
            </div>
          </div>
        </div>
      )}

      {selectedVideo && !loading && curve.length === 0 && (
        <Empty description="该视频暂无排名变化数据" />
      )}

      {chartOption && !loading && (
        <div className="section-card">
          <div className="section-header">
            <div className="section-title"><span className="title-dot" />排名变化趋势（越低越好）</div>
          </div>
          <div className="section-body">
            <ReactEChartsCore echarts={echarts} option={chartOption} style={{ height: 400 }} notMerge lazyUpdate />
          </div>
        </div>
      )}

      {!selectedVideo && !loading && (
        <div className="section-card">
          <div style={{ padding: '80px 40px', textAlign: 'center' }}>
            <AimOutlined style={{ fontSize: 48, color: 'var(--text-muted)', opacity: 0.3 }} />
            <p style={{ color: 'var(--text-secondary)', marginTop: 16 }}>搜索并选择一个视频开始追踪排名变化</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default RankTracker

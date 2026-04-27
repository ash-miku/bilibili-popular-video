import React, { useState, useEffect, useMemo } from 'react'
import { Spin, Empty, message } from 'antd'
import { BarChartOutlined, VideoCameraOutlined, UserOutlined, CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import dayjs from 'dayjs'
import { getCategoryTrend } from '../api'
import { formatCount } from '../utils/format'

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  CanvasRenderer,
])

interface DailyRow {
  snapshot_date: string
  video_count: number
  total_views: number
}

const Stats: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [trendData, setTrendData] = useState<DailyRow[]>([])

  useEffect(() => {
    const end = dayjs().format('YYYY-MM-DD')
    const start = dayjs().subtract(30, 'day').format('YYYY-MM-DD')
    setLoading(true)
    getCategoryTrend(0, start, end)
      .then((raw) => {
        const rows = (raw ?? []).map((d) => ({
          snapshot_date: String(d.snapshot_date ?? d.date ?? d.ds ?? ''),
          video_count: Number(d.video_count ?? d.count ?? 0),
          total_views: Number(d.total_views ?? d.view_count ?? 0),
        })) as DailyRow[]
        setTrendData(rows)
      })
      .catch(() => {
        message.error('加载数据概览失败')
      })
      .finally(() => setLoading(false))
  }, [])

  const overviewStats = useMemo(() => {
    const totalVideos = trendData.reduce((s, d) => s + d.video_count, 0)
    const totalViews = trendData.reduce((s, d) => s + d.total_views, 0)
    const totalDays = trendData.length
    const latestDate = trendData.length > 0
      ? trendData[trendData.length - 1].snapshot_date
      : '—'
    return { totalVideos, totalViews, totalDays, latestDate }
  }, [trendData])

  const videoCountOption = useMemo(() => {
    if (trendData.length === 0) return null
    const dates = trendData.map((d) => dayjs(d.snapshot_date).format('MM/DD'))
    const values = trendData.map((d) => d.video_count)
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(25,25,50,0.92)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        textStyle: { color: '#e8e8f0', fontSize: 13 },
        formatter: (params: { axisValue: string; value: number }[]) => {
          const p = params[0]
          return `${p.axisValue}<br/><b style="color:#FB7299">${formatCount(p.value)}</b> 个视频`
        },
      },
      grid: { left: '3%', right: '4%', top: '8%', bottom: '12%', containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: dates,
        boundaryGap: false,
        axisLabel: { color: '#5e5e78', fontSize: 11, rotate: dates.length > 15 ? 30 : 0 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { formatter: (v: number) => formatCount(v), color: '#5e5e78' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' as const } },
      },
      dataZoom: dates.length > 15 ? [{ type: 'inside' as const, start: 0, end: 100 }] : [],
      series: [
        {
          type: 'line' as const,
          data: values,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2.5, color: '#FB7299' },
          itemStyle: { color: '#FB7299', borderWidth: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(251,114,153,0.30)' },
              { offset: 1, color: 'rgba(251,114,153,0.02)' },
            ]),
          },
        },
      ],
      animationDuration: 600,
      animationEasing: 'cubicOut' as const,
    }
  }, [trendData])

  const viewsOption = useMemo(() => {
    if (trendData.length === 0) return null
    const dates = trendData.map((d) => dayjs(d.snapshot_date).format('MM/DD'))
    const values = trendData.map((d) => d.total_views)
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(25,25,50,0.92)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        textStyle: { color: '#e8e8f0', fontSize: 13 },
        formatter: (params: { axisValue: string; value: number }[]) => {
          const p = params[0]
          return `${p.axisValue}<br/><b style="color:#23ADE5">${formatCount(p.value)}</b> 总播放`
        },
      },
      grid: { left: '3%', right: '4%', top: '8%', bottom: '12%', containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: dates,
        boundaryGap: false,
        axisLabel: { color: '#5e5e78', fontSize: 11, rotate: dates.length > 15 ? 30 : 0 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { formatter: (v: number) => formatCount(v), color: '#5e5e78' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' as const } },
      },
      dataZoom: dates.length > 15 ? [{ type: 'inside' as const, start: 0, end: 100 }] : [],
      series: [
        {
          type: 'line' as const,
          data: values,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2.5, color: '#23ADE5' },
          itemStyle: { color: '#23ADE5', borderWidth: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(35,173,229,0.30)' },
              { offset: 1, color: 'rgba(35,173,229,0.02)' },
            ]),
          },
        },
      ],
      animationDuration: 600,
      animationEasing: 'cubicOut' as const,
    }
  }, [trendData])

  const statCards = [
    { label: '累计视频数', value: formatCount(overviewStats.totalVideos), icon: <VideoCameraOutlined />, color: '#FB7299' },
    { label: '累计播放量', value: formatCount(overviewStats.totalViews), icon: <UserOutlined />, color: '#23ADE5' },
    { label: '数据采集天数', value: String(overviewStats.totalDays), icon: <CalendarOutlined />, color: '#FFB027' },
    { label: '最新数据日期', value: overviewStats.latestDate !== '—' ? dayjs(overviewStats.latestDate).format('YYYY-MM-DD') : '—', icon: <ClockCircleOutlined />, color: '#7B5FFF' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="bili-banner">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BarChartOutlined style={{ color: '#FB7299' }} />
          数据概览
        </h2>
        <p>跨日期趋势分析 · 数据采集健康度</p>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {statCards.map((card) => (
          <div
            key={card.label}
            className="stat-card"
            style={{ '--card-accent': card.color, flex: 1, minWidth: 180 } as React.CSSProperties}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ color: card.color, fontSize: 20 }}>{card.icon}</span>
              <div className="stat-label">{card.label}</div>
            </div>
            <div className="stat-value" style={{ fontSize: 26 }}>{card.value}</div>
          </div>
        ))}
      </div>

      <Spin spinning={loading}>
        {trendData.length === 0 && !loading ? (
          <div className="section-card" style={{ padding: 60, textAlign: 'center' }}>
            <Empty description="暂无趋势数据" />
          </div>
        ) : (
          <>
            <div className="section-card">
              <div className="section-header">
                <div className="section-title">
                  <span className="title-dot" />
                  每日视频数量趋势
                </div>
              </div>
              <div className="section-body">
                {videoCountOption && (
                  <ReactEChartsCore
                    echarts={echarts}
                    option={videoCountOption}
                    style={{ height: 340 }}
                    notMerge
                    lazyUpdate
                  />
                )}
              </div>
            </div>

            <div className="section-card">
              <div className="section-header">
                <div className="section-title">
                  <span className="title-dot" style={{ background: '#23ADE5' }} />
                  每日播放量趋势
                </div>
              </div>
              <div className="section-body">
                {viewsOption && (
                  <ReactEChartsCore
                    echarts={echarts}
                    option={viewsOption}
                    style={{ height: 340 }}
                    notMerge
                    lazyUpdate
                  />
                )}
              </div>
            </div>
          </>
        )}
      </Spin>
    </div>
  )
}

export default Stats

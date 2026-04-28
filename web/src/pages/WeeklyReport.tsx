import React, { useState, useEffect, useMemo } from 'react'
import { Spin, Empty, message, DatePicker } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import dayjs from 'dayjs'
import { getCategoryTrend, getCategoryDistribution, getHotTags, getTopUploaders, getStatsOverview } from '../api'
import { formatCount } from '../utils/format'

echarts.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const WeeklyReport: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState<string>(dayjs().subtract(7, 'day').format('YYYY-MM-DD'))
  const [weekEnd, setWeekEnd] = useState<string>(dayjs().format('YYYY-MM-DD'))
  const [dailyTrend, setDailyTrend] = useState<{ snapshot_date: string; video_count: number; total_views: number }[]>([])
  const [partitionDist, setPartitionDist] = useState<Record<string, number>>({})
  const [topTags, setTopTags] = useState<Record<string, number>>({})
  const [topUploaders, setTopUploaders] = useState<{ uploader_name: string; total_views: number; video_count: number }[]>([])
  const [overview, setOverview] = useState<{ total_videos: number; total_uploaders: number; total_days: number } | null>(null)

  useEffect(() => {
    setLoading(true)
    const ws = dayjs(weekStart)
    const we = dayjs(weekEnd)

    Promise.all([
      getCategoryTrend(0, ws.format('YYYY-MM-DD'), we.format('YYYY-MM-DD')).catch(() => []),
      getCategoryDistribution(we.subtract(1, 'day').format('YYYY-MM-DD')).catch(() => ({})),
      getHotTags(we.subtract(1, 'day').format('YYYY-MM-DD'), 10).catch(() => ({})),
      getTopUploaders({ date: we.subtract(1, 'day').format('YYYY-MM-DD'), pageSize: 10 }).catch(() => ({ list: [] })),
      getStatsOverview().catch(() => null),
    ]).then(([rawTrend, dist, tags, uploaders, ov]) => {
      const rows = (rawTrend ?? []).map((d: Record<string, unknown>) => ({
        snapshot_date: String(d.snapshot_date ?? ''),
        video_count: Number(d.video_count ?? 0),
        total_views: Number(d.total_views ?? 0),
      }))
      setDailyTrend(rows)
      setPartitionDist(dist as Record<string, number>)
      setTopTags(tags as Record<string, number>)
      setTopUploaders((uploaders?.list ?? []) as { uploader_name: string; total_views: number; video_count: number }[])
      if (ov) setOverview(ov as { total_videos: number; total_uploaders: number; total_days: number })
    }).finally(() => setLoading(false))
  }, [weekStart, weekEnd])

  const weekVideoCount = dailyTrend.reduce((s, d) => s + d.video_count, 0)
  const weekTotalViews = dailyTrend.reduce((s, d) => s + d.total_views, 0)
  const weekAvgViews = dailyTrend.length > 0 ? Math.round(weekTotalViews / dailyTrend.length) : 0
  const peakDay = dailyTrend.reduce<{ snapshot_date: string; video_count: number } | null>(
    (max, d) => (!max || d.video_count > max.video_count) ? d : max, null
  )

  const trendOption = useMemo(() => {
    if (dailyTrend.length === 0) return null
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
        data: ['视频数量', '总播放量'],
        textStyle: { color: '#9a9ab0' },
        top: 0,
      },
      grid: { left: 60, right: 60, top: 40, bottom: 30 },
      xAxis: {
        type: 'category' as const,
        data: dailyTrend.map((d) => d.snapshot_date.slice(5)),
        axisLabel: { color: '#5e5e78', fontSize: 11 },
      },
      yAxis: [
        {
          type: 'value' as const,
          name: '视频数',
          axisLabel: { color: '#5e5e78' },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
        },
        {
          type: 'value' as const,
          name: '播放量',
          axisLabel: { color: '#5e5e78', formatter: (v: number) => formatCount(v) },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '视频数量',
          type: 'bar' as const,
          data: dailyTrend.map((d) => d.video_count),
          itemStyle: { color: '#23ADE5', borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 32,
        },
        {
          name: '总播放量',
          type: 'line' as const,
          yAxisIndex: 1,
          smooth: true,
          data: dailyTrend.map((d) => d.total_views),
          lineStyle: { color: '#FB7299', width: 2.5 },
          itemStyle: { color: '#FB7299' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(251,114,153,0.20)' },
              { offset: 1, color: 'rgba(251,114,153,0.02)' },
            ]),
          },
        },
      ],
    }
  }, [dailyTrend])

  const partitionPieOption = useMemo(() => {
    const entries = Object.entries(partitionDist)
    if (entries.length === 0) return null
    const COLORS = ['#FB7299', '#23ADE5', '#FFB027', '#02B340', '#7B5FFF', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: 'rgba(25,25,50,0.92)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        textStyle: { color: '#e8e8f0', fontSize: 13 },
      },
      legend: {
        type: 'scroll' as const,
        orient: 'vertical' as const,
        right: 10,
        top: 'middle',
        textStyle: { color: '#9a9ab0', fontSize: 12 },
      },
      series: [{
        type: 'pie' as const,
        radius: ['30%', '65%'],
        center: ['35%', '50%'],
        label: { show: false },
        data: entries.slice(0, 10).map(([name, value], i) => ({
          name,
          value,
          itemStyle: { color: COLORS[i % COLORS.length] },
        })),
      }],
    }
  }, [partitionDist])

  const tagsBarOption = useMemo(() => {
    const entries = Object.entries(topTags).sort((a, b) => b[1] - a[1])
    if (entries.length === 0) return null
    const reversed = [...entries].reverse()
    const names = reversed.map(([n]) => n)
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' as const },
      grid: { left: 80, right: 20, top: 10, bottom: 20 },
      xAxis: {
        type: 'value' as const,
        axisLabel: { color: '#5e5e78' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      yAxis: {
        type: 'category' as const,
        data: names,
        axisLabel: { color: '#9a9ab0', fontSize: 12 },
      },
      series: [{
        type: 'bar' as const,
        data: reversed.map(([_, v]) => ({
          value: v,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: 'rgba(123,95,255,0.3)' },
              { offset: 1, color: '#7B5FFF' },
            ]),
          },
        })),
        barMaxWidth: 18,
      }],
    }
  }, [topTags])

  const uploadersBarOption = useMemo(() => {
    if (topUploaders.length === 0) return null
    const reversed = [...topUploaders].reverse()
    const names = reversed.map((u) => u.uploader_name)
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(25,25,50,0.92)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        textStyle: { color: '#e8e8f0', fontSize: 13 },
        formatter: (params: { name: string; value: number }[]) => {
          const u = topUploaders.find((u) => u.uploader_name === params[0].name)
          if (!u) return ''
          return `<b>${u.uploader_name}</b><br/>总播放: <b style="color:#FB7299">${formatCount(u.total_views)}</b><br/>视频数: ${u.video_count}`
        },
      },
      grid: { left: 80, right: 30, top: 10, bottom: 20 },
      xAxis: {
        type: 'value' as const,
        axisLabel: { color: '#5e5e78', formatter: (v: number) => formatCount(v) },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      yAxis: {
        type: 'category' as const,
        data: names,
        axisLabel: { color: '#9a9ab0', fontSize: 12 },
      },
      series: [{
        type: 'bar' as const,
        data: reversed.map((u) => ({
          value: u.total_views,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: 'rgba(255,176,39,0.3)' },
              { offset: 1, color: '#FFB027' },
            ]),
          },
        })),
        barMaxWidth: 18,
      }],
    }
  }, [topUploaders])

  const statCards = [
    { title: '本周视频总数', value: formatCount(weekVideoCount), color: '#23ADE5' },
    { title: '本周总播放', value: formatCount(weekTotalViews), color: '#FB7299' },
    { title: '日均播放', value: formatCount(weekAvgViews), color: '#FFB027' },
    { title: '峰值日', value: peakDay ? `${peakDay.snapshot_date.slice(5)} (${peakDay.video_count}视频)` : '-', color: '#02B340' },
    { title: '活跃分区', value: Object.keys(partitionDist).length, color: '#7B5FFF' },
    { title: '活跃UP主', value: topUploaders.length, color: '#FF6B6B' },
  ]

  return (
    <div className="analytics-page">
      <div className="bili-banner">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileTextOutlined style={{ color: '#FB7299' }} />
          周报汇总
        </h2>
        <p>本周数据汇总 · 一站式回顾</p>
      </div>

      <div className="analytics-toolbar">
        <span className="analytics-toolbar__label">选择周期:</span>
        <DatePicker
          value={dayjs(weekStart)}
          onChange={(d) => d && setWeekStart(d.format('YYYY-MM-DD'))}
          allowClear={false}
          placeholder="开始日期"
        />
        <span className="analytics-toolbar__label">~</span>
        <DatePicker
          value={dayjs(weekEnd)}
          onChange={(d) => d && setWeekEnd(d.format('YYYY-MM-DD'))}
          allowClear={false}
          placeholder="结束日期"
        />
      </div>

      <div className="analytics-stat-grid">
        {statCards.map((card, i) => (
          <div key={i} className="stat-card" style={{ '--card-accent': card.color, flex: 1, minWidth: 140 } as React.CSSProperties}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div className="stat-label">{card.title}</div>
            </div>
            <div className="stat-value" style={{ fontSize: 22 }}>{card.value}</div>
          </div>
        ))}
      </div>

      <Spin spinning={loading}>
        {dailyTrend.length === 0 && !loading ? (
          <div className="section-card" style={{ padding: 60, textAlign: 'center' }}>
            <Empty description="暂无周报数据" />
          </div>
        ) : (
          <>
            <div className="section-card">
              <div className="section-header">
                <div className="section-title">
                  <span className="title-dot" />
                  每日视频数 & 播放量趋势
                </div>
              </div>
              <div className="section-body">
                {trendOption && (
                  <ReactEChartsCore echarts={echarts} option={trendOption} style={{ height: 340 }} notMerge lazyUpdate />
                )}
              </div>
            </div>

            <div className="analytics-split-grid">
              <div className="section-card" style={{ flex: 1 }}>
                <div className="section-header">
                  <div className="section-title">
                    <span className="title-dot" style={{ background: '#23ADE5' }} />
                    分区分布
                  </div>
                </div>
                <div className="section-body">
                  {partitionPieOption ? (
                    <ReactEChartsCore echarts={echarts} option={partitionPieOption} style={{ height: 320 }} notMerge lazyUpdate />
                  ) : <Empty description="暂无分区数据" />}
                </div>
              </div>

              <div className="section-card" style={{ flex: 1 }}>
                <div className="section-header">
                  <div className="section-title">
                    <span className="title-dot" style={{ background: '#7B5FFF' }} />
                    热门标签
                  </div>
                </div>
                <div className="section-body">
                  {tagsBarOption ? (
                    <ReactEChartsCore echarts={echarts} option={tagsBarOption} style={{ height: 320 }} notMerge lazyUpdate />
                  ) : <Empty description="暂无标签数据" />}
                </div>
              </div>
            </div>

            <div className="section-card">
              <div className="section-header">
                <div className="section-title">
                  <span className="title-dot" style={{ background: '#FFB027' }} />
                  Top UP主排行
                </div>
              </div>
              <div className="section-body">
                {uploadersBarOption ? (
                  <ReactEChartsCore echarts={echarts} option={uploadersBarOption} style={{ height: Math.max(250, topUploaders.length * 30) }} notMerge lazyUpdate />
                ) : <Empty description="暂无UP主数据" />}
              </div>
            </div>
          </>
        )}
      </Spin>
    </div>
  )
}

export default WeeklyReport

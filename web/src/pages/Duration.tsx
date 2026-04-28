import React, { useState, useEffect } from 'react'
import { Spin, Empty, message } from 'antd'
import { FieldTimeOutlined } from '@ant-design/icons'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { PieChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { presets, presetToRange, type PresetKey } from '../utils/datePresets'
import dayjs from 'dayjs'
import { getHotRanking } from '../api'
import { formatCount } from '../utils/format'

echarts.use([PieChart, BarChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer])

const DurationPage: React.FC = () => {
  const getThemeColor = (varName: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  const [loading, setLoading] = useState(true)
  const [activePreset, setActivePreset] = useState<PresetKey>('7d')
  const [dateRange] = useState(() => presetToRange('7d'))
  const [durations, setDurations] = useState<number[]>([])

  useEffect(() => {
    setLoading(true)
    const [start, end] = dateRange
    const fetchAll = async () => {
      const allDurations: number[] = []
      let page = 1
      let total = Infinity
      while (allDurations.length < total) {
        const res = await getHotRanking({
          start: start.format('YYYY-MM-DD'),
          end: end.format('YYYY-MM-DD'),
          page,
          pageSize: 100,
        })
        total = res.total ?? 0
        for (const v of res.list ?? []) {
          if (((v as unknown) as Record<string, unknown>).duration) {
            allDurations.push(((v as unknown) as Record<string, unknown>).duration as number)
          }
        }
        page++
        if (page > 20) break
      }
      setDurations(allDurations)
    }
    fetchAll()
      .catch((err: Error) => message.error('加载数据失败: ' + err.message))
      .finally(() => setLoading(false))
  }, [dateRange])

  const buckets = React.useMemo(() => {
    const ranges = [
      { label: '0-1分钟', min: 0, max: 60, color: '#FB7299' },
      { label: '1-3分钟', min: 60, max: 180, color: '#23ADE5' },
      { label: '3-5分钟', min: 180, max: 300, color: '#FFB027' },
      { label: '5-10分钟', min: 300, max: 600, color: '#02B340' },
      { label: '10-20分钟', min: 600, max: 1200, color: '#7B5FFF' },
      { label: '20分钟+', min: 1200, max: Infinity, color: '#FF6B6B' },
    ]
    return ranges.map((r) => ({
      ...r,
      count: durations.filter((d) => d >= r.min && d < r.max).length,
    }))
  }, [durations])

  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0
  const medianDuration = durations.length > 0
    ? (() => { const sorted = [...durations].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2) })()
    : 0

  const fmtDur = (s: number) => {
    if (s < 60) return `${s}秒`
    const m = Math.floor(s / 60)
    const sec = s % 60
    if (m < 60) return sec > 0 ? `${m}分${sec}秒` : `${m}分钟`
    const h = Math.floor(m / 60)
    return `${h}小时${m % 60}分`
  }

  const pieOption = {
    backgroundColor: 'transparent',
    color: buckets.map((b) => b.color),
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
    title: {
      text: '时长分布',
      left: 'left',
      textStyle: { fontSize: 15, fontWeight: 600, color: getThemeColor('--text-primary') || '#e8e8f0' },
    },
    legend: {
      orient: 'vertical' as const, right: 0, top: 'middle',
      textStyle: { color: getThemeColor('--text-secondary') || '#9a9ab0', fontSize: 12 },
    },
    series: [{
      type: 'pie' as const,
      radius: ['45%', '75%'],
      center: ['35%', '52%'],
      label: { show: false },
      emphasis: { itemStyle: { shadowBlur: 20, shadowColor: 'rgba(251,114,153,0.35)' } },
      data: buckets.map((b) => ({ name: b.label, value: b.count })),
    }],
  }

  const barOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' as const },
    grid: { left: 60, right: 20, top: 40, bottom: 40 },
    xAxis: {
      type: 'category' as const,
      data: buckets.map((b) => b.label),
      axisLabel: { color: getThemeColor('--text-secondary') || '#9a9ab0', fontSize: 12 },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: getThemeColor('--text-muted') || '#5e5e78' },
    },
    series: [{
      type: 'bar' as const,
      data: buckets.map((b) => ({
        value: b.count,
        itemStyle: { color: b.color, borderRadius: [4, 4, 0, 0] },
      })),
    }],
  }

  return (
    <div className="analytics-page">
      <div className="bili-banner" style={{ marginBottom: 20 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FieldTimeOutlined style={{ color: '#FB7299' }} />
          时长分析
        </h2>
        <p>视频时长分布统计 · 了解热门视频的内容长度偏好</p>
      </div>

      <div className="analytics-stat-grid" style={{ marginBottom: 20 }}>
        {[
          { label: '视频总数', value: durations.length, color: '#23ADE5' },
          { label: '平均时长', value: fmtDur(avgDuration), color: '#FB7299' },
          { label: '中位时长', value: fmtDur(medianDuration), color: '#FFB027' },
          { label: '最常时长区间', value: buckets.reduce((a, b) => a.count > b.count ? a : b).label, color: '#02B340' },
        ].map((card, i) => (
          <div key={i} className="analytics-stat-panel">
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : durations.length === 0 ? (
        <Empty description="暂无数据" />
      ) : (
        <div className="analytics-split-grid">
          <div className="section-card">
            <div className="section-body">
              <ReactEChartsCore echarts={echarts} option={pieOption} style={{ height: 380 }} notMerge lazyUpdate />
            </div>
          </div>
          <div className="section-card">
            <div className="section-header">
              <div className="section-title"><span className="title-dot" />时长分布柱状图</div>
            </div>
            <div className="section-body">
              <ReactEChartsCore echarts={echarts} option={barOption} style={{ height: 350 }} notMerge lazyUpdate />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DurationPage

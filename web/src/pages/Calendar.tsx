import React, { useState, useEffect } from 'react'
import { Spin, Empty, message, Select } from 'antd'
import { CalendarOutlined } from '@ant-design/icons'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { HeatmapChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { getHeatmap, type HeatmapItem } from '../api'

echarts.use([HeatmapChart, GridComponent, TooltipComponent, VisualMapComponent, CanvasRenderer])

const CalendarPage: React.FC = () => {
  const getThemeColor = (varName: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<HeatmapItem[]>([])
  const [days, setDays] = useState(90)

  useEffect(() => {
    setLoading(true)
    getHeatmap(days)
      .then((d) => setData(d ?? []))
      .catch((err: Error) => message.error('加载日历数据失败: ' + err.message))
      .finally(() => setLoading(false))
  }, [days])

  const maxCount = Math.max(1, ...data.map((d) => d.video_count))

  const chartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      formatter: (params: { data: [string, number]; value: [string, number] }) => {
        const d = params.data || params.value
        if (!d) return ''
        const item = data.find((x) => x.date === d[0])
        return `${d[0]}<br/>视频数: ${d[1]}<br/>播放量: ${item?.total_views?.toLocaleString() ?? 0}`
      },
      backgroundColor: getThemeColor('--bg-card-solid') || 'rgba(25,25,50,0.92)',
      borderColor: getThemeColor('--border-card') || 'rgba(255,255,255,0.1)',
      textStyle: { color: getThemeColor('--text-primary') || '#e8e8f0', fontSize: 13 },
    },
    visualMap: {
      min: 0,
      max: maxCount,
      show: true,
      orient: 'horizontal' as const,
      left: 'center',
      bottom: 0,
      text: ['多', '少'],
      textStyle: { color: getThemeColor('--text-secondary') || '#9a9ab0' },
      inRange: {
        color: ['#1a1a2e', '#3d1a2e', '#7b2d4e', '#c44a6c', '#FB7299'],
      },
    },
    calendar: {
      top: 60,
      left: 40,
      right: 40,
      bottom: 60,
      cellSize: ['auto', 15],
      range: data.length > 0 ? [data[0]?.date, data[data.length - 1]?.date] : '2026',
      itemStyle: {
        borderWidth: 3,
        borderColor: getThemeColor('--bg-primary') || '#0f0f1a',
      },
      yearLabel: { show: false },
      dayLabel: {
        nameMap: 'ZH',
        color: getThemeColor('--text-muted') || '#5e5e78',
        fontSize: 11,
      },
      monthLabel: {
        nameMap: 'ZH',
        color: getThemeColor('--text-secondary') || '#9a9ab0',
        fontSize: 12,
      },
      splitLine: {
        lineStyle: { color: 'rgba(255,255,255,0.06)' },
      },
    },
    series: [{
      type: 'heatmap' as const,
      coordinateSystem: 'calendar' as const,
      data: data.map((d) => [d.date, d.video_count]),
    }],
  }

  const totalVideos = data.reduce((s, d) => s + d.video_count, 0)
  const totalViews = data.reduce((s, d) => s + d.total_views, 0)
  const activeDays = data.filter((d) => d.video_count > 0).length

  return (
    <div>
      <div className="bili-banner" style={{ marginBottom: 20 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CalendarOutlined style={{ color: '#FB7299' }} />
          数据日历
        </h2>
        <p>日历热力图展示每日数据采集量 · 直观发现数据趋势</p>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        {[
          { label: `${days} 天内视频总数`, value: totalVideos, color: '#23ADE5' },
          { label: '总播放量', value: totalViews, color: '#FB7299' },
          { label: '有数据天数', value: activeDays, color: '#FFB027' },
          { label: '日均视频数', value: activeDays > 0 ? Math.round(totalVideos / activeDays) : 0, color: '#02B340' },
        ].map((card, i) => (
          <div key={i} style={{
            flex: 1, padding: 20, borderRadius: 12,
            background: 'var(--bg-card)', border: '1px solid var(--border-card)',
          }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{card.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>
              {typeof card.value === 'number' && card.value > 9999
                ? (card.value / 10000).toFixed(1) + '万'
                : card.value?.toLocaleString?.() ?? card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="section-card">
        <div className="section-header">
          <div className="section-title">
            <span className="title-dot" />
            数据采集热力图
          </div>
          <Select
            value={days}
            onChange={setDays}
            options={[
              { label: '最近 30 天', value: 30 },
              { label: '最近 90 天', value: 90 },
              { label: '最近 180 天', value: 180 },
              { label: '最近 365 天', value: 365 },
            ]}
            style={{ width: 140 }}
          />
        </div>
        <div className="section-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}><Spin size="large" /></div>
          ) : data.length === 0 ? (
            <Empty description="暂无数据" />
          ) : (
            <ReactEChartsCore echarts={echarts} option={chartOption} style={{ height: 280 }} notMerge lazyUpdate />
          )}
        </div>
      </div>
    </div>
  )
}

export default CalendarPage

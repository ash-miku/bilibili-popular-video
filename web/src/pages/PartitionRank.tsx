import React, { useState, useEffect, useMemo } from 'react'
import { Select, Spin, Empty, message } from 'antd'
import { AppstoreOutlined } from '@ant-design/icons'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import dayjs from 'dayjs'
import { getPartitionList, getCategoryDistribution, getCategoryTrend } from '../api'
import { formatCount } from '../utils/format'
import { presets, presetToRange, type PresetKey } from '../utils/datePresets'

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

const PartitionRank: React.FC = () => {
  const getThemeColor = (varName: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  const [loading, setLoading] = useState(true)
  const [partitions, setPartitions] = useState<{ id: number; name: string }[]>([])
  const [dist, setDist] = useState<Record<string, number>>({})
  const [trend, setTrend] = useState<{ snapshot_date: string; video_count: number; total_views: number }[]>([])
  const [activePreset, setActivePreset] = useState<PresetKey>('7d')
  const [selectedPartition, setSelectedPartition] = useState<number>(0)

  useEffect(() => {
    getPartitionList().then(setPartitions).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const date = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
    Promise.all([
      getCategoryDistribution(date).catch(() => ({})),
    ]).then(([d]) => {
      setDist(d as Record<string, number>)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedPartition && selectedPartition !== 0) return
    const range = presetToRange(activePreset)
    getCategoryTrend(selectedPartition, range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD'))
      .then((raw) => {
        setTrend((raw ?? []).map((d: Record<string, unknown>) => ({
          snapshot_date: String(d.snapshot_date ?? ''),
          video_count: Number(d.video_count ?? 0),
          total_views: Number(d.total_views ?? 0),
        })))
      })
      .catch(() => setTrend([]))
  }, [selectedPartition, activePreset])

  const ranked = useMemo(() => {
    return Object.entries(dist)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [dist])

  const maxCount = ranked.length > 0 ? ranked[0].count : 1

  const barOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: getThemeColor('--bg-card-solid') || 'rgba(25,25,50,0.92)',
      textStyle: { color: getThemeColor('--text-primary') || '#e8e8f0', fontSize: 13 },
    },
    grid: { left: 100, right: 30, top: 10, bottom: 30 },
    xAxis: {
      type: 'value' as const,
      axisLabel: { color: getThemeColor('--text-muted') || '#5e5e78' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    yAxis: {
      type: 'category' as const,
      data: ranked.slice(0, 15).reverse().map((r) => r.name),
      axisLabel: { color: getThemeColor('--text-secondary') || '#9a9ab0', fontSize: 12 },
    },
    series: [{
      type: 'bar' as const,
      data: ranked.slice(0, 15).reverse().map((r) => ({
        value: r.count,
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: 'rgba(35,173,229,0.3)' },
            { offset: 1, color: '#23ADE5' },
          ]),
        },
      })),
      barMaxWidth: 22,
    }],
  }), [ranked])

  const COLORS = ['#FB7299', '#23ADE5', '#FFB027', '#02B340', '#7B5FFF']
  const trendOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['视频数', '播放量'], textStyle: { color: getThemeColor('--text-secondary') || '#9a9ab0' } },
    grid: { left: 60, right: 60, top: 40, bottom: 30 },
    xAxis: {
      type: 'category' as const,
      data: trend.map((d) => d.snapshot_date.slice(5)),
      axisLabel: { color: getThemeColor('--text-muted') || '#5e5e78', fontSize: 11, rotate: 30 },
    },
    yAxis: [
      { type: 'value' as const, name: '视频数', axisLabel: { color: getThemeColor('--text-muted') || '#5e5e78' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } } },
      { type: 'value' as const, name: '播放量', axisLabel: { color: getThemeColor('--text-muted') || '#5e5e78', formatter: (v: number) => formatCount(v) }, splitLine: { show: false } },
    ],
    series: [
      { name: '视频数', type: 'bar' as const, data: trend.map((d) => d.video_count), itemStyle: { color: COLORS[1], borderRadius: [3, 3, 0, 0] } },
      { name: '播放量', type: 'line' as const, yAxisIndex: 1, smooth: true, data: trend.map((d) => d.total_views), lineStyle: { color: COLORS[0], width: 2 }, itemStyle: { color: COLORS[0] } },
    ],
  }), [trend])

  return (
    <div>
      <div className="bili-banner" style={{ marginBottom: 20 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AppstoreOutlined style={{ color: '#FB7299' }} />
          分区热度排行
        </h2>
        <p>各分区视频数量排行 · 分区趋势对比分析</p>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        {[
          { label: '分区总数', value: ranked.length, color: '#23ADE5' },
          { label: '最热分区', value: ranked[0]?.name ?? '-', color: '#FB7299' },
          { label: '最热视频数', value: ranked[0]?.count ?? 0, color: '#FFB027' },
        ].map((card, i) => (
          <div key={i} style={{ flex: 1, padding: 20, borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border-card)' }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="section-card" style={{ marginBottom: 20 }}>
        <div className="section-header">
          <div className="section-title"><span className="title-dot" />分区视频数量排行 Top 15</div>
        </div>
        <div className="section-body">
          {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
            : ranked.length === 0 ? <Empty description="暂无数据" />
            : <ReactEChartsCore echarts={echarts} option={barOption} style={{ height: Math.max(300, ranked.slice(0, 15).length * 30) }} notMerge lazyUpdate />}
        </div>
      </div>

      <div className="section-card">
        <div className="section-header">
          <div className="section-title"><span className="title-dot" />分区趋势对比</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {presets.map((p) => (
              <button key={p.key} onClick={() => { setActivePreset(p.key) }}
                style={{
                  padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, transition: 'all 0.2s',
                  border: activePreset === p.key ? 'none' : '1px solid var(--border-subtle)',
                  background: activePreset === p.key ? 'var(--bili-pink)' : 'transparent',
                  color: activePreset === p.key ? '#fff' : 'var(--text-secondary)',
                  fontWeight: activePreset === p.key ? 500 : 400,
                }}>{p.label}</button>
            ))}
            <Select
              value={selectedPartition || undefined}
              onChange={(v) => setSelectedPartition(v)}
              placeholder="选择分区"
              options={[{ label: '全部分区', value: 0 }, ...partitions.map((p) => ({ label: p.name, value: p.id }))]}
              style={{ width: 160 }}
              allowClear
            />
          </div>
        </div>
        <div className="section-body">
          {trend.length === 0 ? <Empty description="选择分区查看趋势" />
            : <ReactEChartsCore echarts={echarts} option={trendOption} style={{ height: 350 }} notMerge lazyUpdate />}
        </div>
      </div>
    </div>
  )
}

export default PartitionRank

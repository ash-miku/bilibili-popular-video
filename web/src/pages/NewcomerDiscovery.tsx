import React, { useState, useEffect, useMemo } from 'react'
import { Spin, Empty, message, DatePicker, Select } from 'antd'
import { RocketOutlined } from '@ant-design/icons'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { BarChart, ScatterChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import dayjs from 'dayjs'
import { getTopUploaders } from '../api'
import { formatCount } from '../utils/format'

echarts.use([BarChart, ScatterChart, GridComponent, TooltipComponent, CanvasRenderer])

const NewcomerDiscovery: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [uploaders, setUploaders] = useState<{
    uploader_mid: number
    uploader_name: string
    video_count: number
    total_views: number
    total_likes: number
    avg_views: number
  }[]>([])
  const [date, setDate] = useState<string>(dayjs().subtract(1, 'day').format('YYYY-MM-DD'))
  const [sortBy, setSortBy] = useState('avg_views')

  useEffect(() => {
    setLoading(true)
    getTopUploaders({ date, sortBy, pageSize: 50 })
      .then((data) => {
        setUploaders(data?.list ?? [])
      })
      .catch(() => {
        message.error('加载UP主数据失败')
        setUploaders([])
      })
      .finally(() => setLoading(false))
  }, [date, sortBy])

  const risingStars = useMemo(() => {
    return [...uploaders]
      .filter((u) => u.video_count <= 3)
      .sort((a, b) => b.avg_views - a.avg_views)
      .slice(0, 20)
  }, [uploaders])

  const scatterOption = useMemo(() => {
    if (uploaders.length === 0) return null
    const maxViews = Math.max(...uploaders.map((u) => u.total_views), 1)
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: 'rgba(25,25,50,0.92)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        textStyle: { color: '#e8e8f0', fontSize: 13 },
        formatter: (params: { data: number[]; name: string }) => {
          const d = params.data
          return `<b>${params.name}</b><br/>视频数: ${d[0]}<br/>总播放: ${formatCount(d[1])}<br/>平均播放: ${formatCount(d[2])}`
        },
      },
      grid: { left: 60, right: 30, top: 30, bottom: 40 },
      xAxis: {
        type: 'value' as const,
        name: '视频数量',
        nameTextStyle: { color: '#9a9ab0' },
        axisLabel: { color: '#5e5e78' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      yAxis: {
        type: 'value' as const,
        name: '总播放量',
        nameTextStyle: { color: '#9a9ab0' },
        axisLabel: { color: '#5e5e78', formatter: (v: number) => formatCount(v) },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      series: [{
        type: 'scatter' as const,
        data: uploaders.map((u) => ({
          value: [u.video_count, u.total_views, u.avg_views],
          name: u.uploader_name,
          symbolSize: Math.max(8, Math.min(30, Math.sqrt(u.avg_views / 1000) * 3)),
          itemStyle: {
            color: u.video_count <= 3
              ? new echarts.graphic.LinearGradient(0, 0, 1, 1, [
                  { offset: 0, color: '#FB7299' },
                  { offset: 1, color: '#FF6B6B' },
                ])
              : 'rgba(35,173,229,0.5)',
            borderColor: u.video_count <= 3 ? '#FB7299' : 'transparent',
            borderWidth: u.video_count <= 3 ? 2 : 0,
          },
        })),
      }],
      animationDuration: 600,
    }
  }, [uploaders])

  const barOption = useMemo(() => {
    if (risingStars.length === 0) return null
    const reversed = [...risingStars].reverse()
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
          const u = risingStars.find((u) => u.uploader_name === params[0].name)
          if (!u) return ''
          return `<b>${u.uploader_name}</b><br/>平均播放: <b style="color:#FB7299">${formatCount(u.avg_views)}</b><br/>视频数: ${u.video_count}<br/>总播放: ${formatCount(u.total_views)}`
        },
      },
      grid: { left: 100, right: 30, top: 10, bottom: 30 },
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
          value: u.avg_views,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: 'rgba(251,114,153,0.3)' },
              { offset: 1, color: '#FB7299' },
            ]),
          },
        })),
        barMaxWidth: 20,
      }],
    }
  }, [risingStars])

  const totalNewcomers = uploaders.filter((u) => u.video_count <= 3).length
  const topNewcomer = risingStars[0]
  const avgNewcomerViews = risingStars.length > 0
    ? Math.round(risingStars.reduce((s, u) => s + u.avg_views, 0) / risingStars.length)
    : 0

  const statCards = [
    { title: '分析UP主总数', value: uploaders.length, color: '#23ADE5' },
    { title: '潜力新人', value: totalNewcomers, color: '#FB7299' },
    { title: '新人最高均播', value: topNewcomer ? formatCount(topNewcomer.avg_views) : '-', color: '#FFB027' },
    { title: '新人平均播放', value: formatCount(avgNewcomerViews), color: '#02B340' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="bili-banner">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <RocketOutlined style={{ color: '#FB7299' }} />
          新人UP主发现
        </h2>
        <p>低产量高播放的潜力UP主 · 新人崛起趋势</p>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {statCards.map((card, i) => (
          <div key={i} className="stat-card" style={{ '--card-accent': card.color, flex: 1, minWidth: 160 } as React.CSSProperties}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div className="stat-label">{card.title}</div>
            </div>
            <div className="stat-value" style={{ fontSize: 24 }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>选择日期:</span>
        <DatePicker
          value={dayjs(date)}
          onChange={(d) => d && setDate(d.format('YYYY-MM-DD'))}
          allowClear={false}
        />
        <span style={{ color: 'var(--text-secondary)', fontSize: 13, marginLeft: 16 }}>排序:</span>
        <Select
          value={sortBy}
          onChange={setSortBy}
          options={[
            { label: '平均播放', value: 'avg_views' },
            { label: '总播放', value: 'total_views' },
            { label: '视频数量', value: 'video_count' },
            { label: '总点赞', value: 'total_likes' },
          ]}
          style={{ width: 130 }}
        />
      </div>

      <Spin spinning={loading}>
        {uploaders.length === 0 && !loading ? (
          <div className="section-card" style={{ padding: 60, textAlign: 'center' }}>
            <Empty description="暂无UP主数据" />
          </div>
        ) : (
          <>
            <div className="section-card">
              <div className="section-header">
                <div className="section-title">
                  <span className="title-dot" />
                  UP主视频数 vs 播放量散点图
                </div>
              </div>
              <div className="section-body" style={{ color: '#5e5e78', fontSize: 12, marginBottom: 8 }}>
                💡 高亮圆点为"潜力新人"（视频数 ≤ 3），圆点越大代表平均播放越高
              </div>
              <div className="section-body">
                {scatterOption && (
                  <ReactEChartsCore
                    echarts={echarts}
                    option={scatterOption}
                    style={{ height: 420 }}
                    notMerge
                    lazyUpdate
                  />
                )}
              </div>
            </div>

            <div className="section-card">
              <div className="section-header">
                <div className="section-title">
                  <span className="title-dot" style={{ background: '#FFB027' }} />
                  潜力新人榜（视频数 ≤ 3）
                </div>
              </div>
              <div className="section-body">
                {risingStars.length === 0 ? (
                  <Empty description="暂无潜力新人数据" />
                ) : barOption ? (
                  <ReactEChartsCore
                    echarts={echarts}
                    option={barOption}
                    style={{ height: Math.max(300, risingStars.length * 30) }}
                    notMerge
                    lazyUpdate
                  />
                ) : null}
              </div>
            </div>
          </>
        )}
      </Spin>
    </div>
  )
}

export default NewcomerDiscovery

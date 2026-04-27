import React, { useState, useEffect, useMemo } from 'react'
import { Spin, Empty, message, DatePicker, Select } from 'antd'
import { InteractionOutlined } from '@ant-design/icons'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { BarChart, PieChart, RadarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import dayjs from 'dayjs'
import { getRanking } from '../api'
import { formatCount } from '../utils/format'

echarts.use([BarChart, PieChart, RadarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const { RangePicker } = DatePicker

const CHART_COLORS = ['#FB7299', '#23ADE5', '#FFB027']

interface VideoWithRate {
  bvid: string
  title: string
  uploader_name: string
  view_count: number
  like_rate: number
  coin_rate: number
  favorite_rate: number
  share_rate: number
  danmaku_rate: number
  reply_rate: number
  engagement_score: number
}

const InteractionAnalysis: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [videos, setVideos] = useState<VideoWithRate[]>([])
  const [date, setDate] = useState<string>(dayjs().subtract(1, 'day').format('YYYY-MM-DD'))
  const [partitionId, setPartitionId] = useState(0)
  const [sortBy, setSortBy] = useState<string>('engagement_score')

  useEffect(() => {
    setLoading(true)
    getRanking({ date, partitionId: partitionId || undefined, pageSize: 100 })
      .then((data) => {
        const items = (data?.list ?? []).map((v) => {
          const views = v.view_count || 1
          const like_rate = (v.like_count / views) * 100
          const coin_rate = (v.coin_count / views) * 100
          const favorite_rate = (v.favorite_count / views) * 100
          const share_rate = (v.share_count / views) * 100
          const danmaku_rate = (v.danmaku_count / views) * 100
          const reply_rate = (v.reply_count / views) * 100
          const engagement_score = like_rate * 2 + coin_rate * 3 + favorite_rate * 2.5 + share_rate * 4 + danmaku_rate * 1.5 + reply_rate * 2
          return {
            bvid: v.bvid,
            title: v.title,
            uploader_name: v.uploader_name,
            view_count: v.view_count,
            like_rate: Math.min(like_rate, 100),
            coin_rate: Math.min(coin_rate, 100),
            favorite_rate: Math.min(favorite_rate, 100),
            share_rate: Math.min(share_rate, 100),
            danmaku_rate: Math.min(danmaku_rate, 100),
            reply_rate: Math.min(reply_rate, 100),
            engagement_score,
          }
        })
        setVideos(items)
      })
      .catch(() => {
        message.error('加载数据失败')
        setVideos([])
      })
      .finally(() => setLoading(false))
  }, [date, partitionId])

  const sorted = useMemo(() => {
    return [...videos].sort((a, b) => {
      const keys: Record<string, keyof VideoWithRate> = {
        engagement_score: 'engagement_score',
        like_rate: 'like_rate',
        coin_rate: 'coin_rate',
        favorite_rate: 'favorite_rate',
        share_rate: 'share_rate',
      }
      const key = keys[sortBy] ?? 'engagement_score'
      return (b[key] as number) - (a[key] as number)
    })
  }, [videos, sortBy])

  const top10 = sorted.slice(0, 10)

  const engagementBarOption = useMemo(() => {
    if (top10.length === 0) return null
    const reversed = [...top10].reverse()
    const names = reversed.map((v) => v.title.length > 12 ? v.title.slice(0, 12) + '...' : v.title)
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
        data: ['点赞率', '投币率', '收藏率', '分享率'],
        textStyle: { color: '#9a9ab0' },
        top: 0,
      },
      grid: { left: 120, right: 30, top: 40, bottom: 20 },
      xAxis: {
        type: 'value' as const,
        axisLabel: { color: '#5e5e78', formatter: (v: number) => `${v.toFixed(1)}%` },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      yAxis: {
        type: 'category' as const,
        data: names,
        axisLabel: { color: '#9a9ab0', fontSize: 11 },
      },
      series: [
        {
          name: '点赞率', type: 'bar' as const, stack: 'rate',
          data: reversed.map((v) => +v.like_rate.toFixed(2)),
          itemStyle: { color: '#FB7299', borderRadius: [0, 0, 0, 0] },
          barMaxWidth: 18,
        },
        {
          name: '投币率', type: 'bar' as const, stack: 'rate',
          data: reversed.map((v) => +v.coin_rate.toFixed(2)),
          itemStyle: { color: '#FFB027' },
          barMaxWidth: 18,
        },
        {
          name: '收藏率', type: 'bar' as const, stack: 'rate',
          data: reversed.map((v) => +v.favorite_rate.toFixed(2)),
          itemStyle: { color: '#23ADE5' },
          barMaxWidth: 18,
        },
        {
          name: '分享率', type: 'bar' as const, stack: 'rate',
          data: reversed.map((v) => +v.share_rate.toFixed(2)),
          itemStyle: { color: '#02B340', borderRadius: [0, 4, 4, 0] },
          barMaxWidth: 18,
        },
      ],
    }
  }, [top10])

  const radarOption = useMemo(() => {
    if (top10.length === 0) return null
    const top3 = top10.slice(0, 3)
    const maxValues = {
      like_rate: Math.max(...videos.map((v) => v.like_rate), 1),
      coin_rate: Math.max(...videos.map((v) => v.coin_rate), 1),
      favorite_rate: Math.max(...videos.map((v) => v.favorite_rate), 1),
      share_rate: Math.max(...videos.map((v) => v.share_rate), 1),
      danmaku_rate: Math.max(...videos.map((v) => v.danmaku_rate), 1),
      reply_rate: Math.max(...videos.map((v) => v.reply_rate), 1),
    }
    return {
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: 'rgba(25,25,50,0.92)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        textStyle: { color: '#e8e8f0', fontSize: 13 },
      },
      legend: {
        data: top3.map((v) => v.title.length > 10 ? v.title.slice(0, 10) + '...' : v.title),
        textStyle: { color: '#9a9ab0' },
        top: 0,
      },
      radar: {
        indicator: [
          { name: '点赞率', max: maxValues.like_rate },
          { name: '投币率', max: maxValues.coin_rate },
          { name: '收藏率', max: maxValues.favorite_rate },
          { name: '分享率', max: maxValues.share_rate },
          { name: '弹幕率', max: maxValues.danmaku_rate },
          { name: '评论率', max: maxValues.reply_rate },
        ],
        shape: 'polygon' as const,
        splitNumber: 4,
        axisName: { color: '#9a9ab0', fontSize: 12 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        splitArea: { areaStyle: { color: ['rgba(251,114,153,0.02)', 'rgba(251,114,153,0.04)'] } },
      },
      series: [{
        type: 'radar' as const,
        data: top3.map((v, i) => ({
          name: v.title.length > 10 ? v.title.slice(0, 10) + '...' : v.title,
          value: [v.like_rate, v.coin_rate, v.favorite_rate, v.share_rate, v.danmaku_rate, v.reply_rate],
          lineStyle: { color: CHART_COLORS[i], width: 2 },
          itemStyle: { color: CHART_COLORS[i] },
          areaStyle: { color: `${CHART_COLORS[i]}20` },
        })),
      }],
    }
  }, [top10, videos])

  const avgPieOption = useMemo(() => {
    if (videos.length === 0) return null
    const avgLike = videos.reduce((s, v) => s + v.like_rate, 0) / videos.length
    const avgCoin = videos.reduce((s, v) => s + v.coin_rate, 0) / videos.length
    const avgFav = videos.reduce((s, v) => s + v.favorite_rate, 0) / videos.length
    const avgShare = videos.reduce((s, v) => s + v.share_rate, 0) / videos.length
    const avgDanmaku = videos.reduce((s, v) => s + v.danmaku_rate, 0) / videos.length
    const avgReply = videos.reduce((s, v) => s + v.reply_rate, 0) / videos.length
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: 'rgba(25,25,50,0.92)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        textStyle: { color: '#e8e8f0', fontSize: 13 },
        formatter: (params: { name: string; value: number; percent: number }) => {
          return `${params.name}<br/>平均 <b style="color:#FB7299">${params.value.toFixed(2)}%</b> (${params.percent}%)`
        },
      },
      legend: {
        orient: 'vertical' as const,
        right: 10,
        top: 'center',
        textStyle: { color: '#9a9ab0' },
      },
      series: [{
        type: 'pie' as const,
        radius: ['40%', '70%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        data: [
          { value: +avgLike.toFixed(2), name: '点赞率', itemStyle: { color: '#FB7299' } },
          { value: +avgCoin.toFixed(2), name: '投币率', itemStyle: { color: '#FFB027' } },
          { value: +avgFav.toFixed(2), name: '收藏率', itemStyle: { color: '#23ADE5' } },
          { value: +avgShare.toFixed(2), name: '分享率', itemStyle: { color: '#02B340' } },
          { value: +avgDanmaku.toFixed(2), name: '弹幕率', itemStyle: { color: '#7B5FFF' } },
          { value: +avgReply.toFixed(2), name: '评论率', itemStyle: { color: '#FF6B6B' } },
        ],
      }],
    }
  }, [videos])

  const avgEngagement = videos.length > 0
    ? (videos.reduce((s, v) => s + v.engagement_score, 0) / videos.length).toFixed(1)
    : '—'

  const statCards = [
    { title: '分析视频数', value: videos.length, color: '#23ADE5' },
    { title: '平均互动分', value: avgEngagement, color: '#FB7299' },
    { title: '最高互动分', value: top10[0]?.engagement_score?.toFixed(1) ?? '-', color: '#FFB027' },
    { title: '最高点赞率', value: videos.length > 0 ? `${Math.max(...videos.map(v => v.like_rate)).toFixed(1)}%` : '-', color: '#02B340' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="bili-banner">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <InteractionOutlined style={{ color: '#FB7299' }} />
          互动分析
        </h2>
        <p>视频互动率深度分析 · 点赞/投币/收藏/分享率对比</p>
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
            { label: '综合互动分', value: 'engagement_score' },
            { label: '点赞率', value: 'like_rate' },
            { label: '投币率', value: 'coin_rate' },
            { label: '收藏率', value: 'favorite_rate' },
            { label: '分享率', value: 'share_rate' },
          ]}
          style={{ width: 140 }}
        />
      </div>

      <Spin spinning={loading}>
        {videos.length === 0 && !loading ? (
          <div className="section-card" style={{ padding: 60, textAlign: 'center' }}>
            <Empty description="暂无数据" />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 16 }}>
              <div className="section-card" style={{ flex: 2 }}>
                <div className="section-header">
                  <div className="section-title">
                    <span className="title-dot" />
                    Top 10 视频互动率堆叠对比
                  </div>
                </div>
                <div className="section-body">
                  {engagementBarOption && (
                    <ReactEChartsCore
                      echarts={echarts}
                      option={engagementBarOption}
                      style={{ height: 380 }}
                      notMerge
                      lazyUpdate
                    />
                  )}
                </div>
              </div>

              <div className="section-card" style={{ flex: 1 }}>
                <div className="section-header">
                  <div className="section-title">
                    <span className="title-dot" style={{ background: '#FFB027' }} />
                    平均互动分布
                  </div>
                </div>
                <div className="section-body">
                  {avgPieOption && (
                    <ReactEChartsCore
                      echarts={echarts}
                      option={avgPieOption}
                      style={{ height: 380 }}
                      notMerge
                      lazyUpdate
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="section-card">
              <div className="section-header">
                <div className="section-title">
                  <span className="title-dot" style={{ background: '#7B5FFF' }} />
                  Top 3 视频互动雷达图
                </div>
              </div>
              <div className="section-body">
                {radarOption && (
                  <ReactEChartsCore
                    echarts={echarts}
                    option={radarOption}
                    style={{ height: 400 }}
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

export default InteractionAnalysis

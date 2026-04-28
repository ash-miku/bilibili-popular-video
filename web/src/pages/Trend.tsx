import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Input, DatePicker, Table, message, Spin, Empty, Space } from 'antd'
import { SearchOutlined, LineChartOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import ReactEChartsCore from 'echarts-for-react/lib/core'

import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import dayjs, { Dayjs } from 'dayjs'
import { getVideoTrend, getRankingChange, getLaunchCurve, VideoStat, LaunchCurveStat } from '../api'
import { formatCount } from '../utils/format'

interface TrendVideoStat extends VideoStat {
  snapshot_date?: string
}

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
])

const { RangePicker } = DatePicker

const SERIES_CONFIG = [
  { key: 'view_count', name: '播放量', color: '#FB7299' },
  { key: 'like_count', name: '点赞', color: '#23ADE5' },
  { key: 'danmaku_count', name: '弹幕', color: '#FFB027' },
  { key: 'reply_count', name: '评论', color: '#4ECDC4' },
  { key: 'favorite_count', name: '收藏', color: '#7B5FFF' },
] as const

const Trend: React.FC = () => {
  const [bvid, setBvid] = useState('')
  const [trendRange, setTrendRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ])
  const [rankRange, setRankRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(7, 'day'),
    dayjs(),
  ])

  const [trendData, setTrendData] = useState<TrendVideoStat[]>([])
  const [trendLoading, setTrendLoading] = useState(false)
  const [videoTitle, setVideoTitle] = useState('')

  const [rankData, setRankData] = useState<VideoStat[]>([])
  const [rankLoading, setRankLoading] = useState(false)

  const [launchData, setLaunchData] = useState<LaunchCurveStat[]>([])
  const [launchLoading, setLaunchLoading] = useState(false)

  const fetchRanking = useCallback(async () => {
    setRankLoading(true)
    try {
      const data = await getRankingChange(
        rankRange[0].format('YYYY-MM-DD'),
        rankRange[1].format('YYYY-MM-DD'),
        50,
      )
      setRankData(data ?? [])
    } catch {
      message.error('排名变化加载失败')
    } finally {
      setRankLoading(false)
    }
  }, [rankRange])

  useEffect(() => {
    fetchRanking()
  }, [fetchRanking])

  const fetchLaunchCurve = useCallback(async (bvidParam?: string) => {
    const targetBvid = bvidParam || bvid.trim()
    if (!targetBvid) return
    setLaunchLoading(true)
    try {
      const data = await getLaunchCurve(targetBvid)
      setLaunchData(data ?? [])
      if (!data || data.length === 0) {
        message.info('未找到该视频的爬坡曲线数据')
      }
    } catch {
      message.error('获取爬坡曲线数据失败')
    } finally {
      setLaunchLoading(false)
    }
  }, [bvid])

  const handleSearch = useCallback(async () => {
    const trimmed = bvid.trim()
    if (!trimmed) {
      message.warning('请输入BV号')
      return
    }
    setTrendLoading(true)
    try {
      const data = await getVideoTrend(
        trimmed,
        trendRange[0].format('YYYY-MM-DD'),
        trendRange[1].format('YYYY-MM-DD'),
      ) as TrendVideoStat[]
      if (!data || data.length === 0) {
        message.info('未找到该视频的趋势数据')
      } else {
        setVideoTitle(data![0].title)
      }
      setTrendData(data ?? [])
    } catch {
      message.error('获取视频趋势数据失败')
    } finally {
      setTrendLoading(false)
    }

    fetchLaunchCurve(trimmed)
  }, [bvid, trendRange, fetchLaunchCurve])

  const chartOption = useMemo(() => {
    if (trendData.length === 0) return null

    const dates = trendData.map((d: TrendVideoStat) => d.snapshot_date ?? '')
    const series = SERIES_CONFIG.map(({ key, name, color }) => ({
      name,
      type: 'line' as const,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2.5, color },
      itemStyle: { color, borderWidth: 2 },
      data: trendData.map((d: TrendVideoStat) => (d as unknown as Record<string, unknown>)[key] as number),
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: color + '30' },
          { offset: 1, color: color + '05' },
        ]),
      },
    }))

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(25,25,50,0.92)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        textStyle: { color: '#e8e8f0', fontSize: 13 },
        formatter(params: unknown[]) {
          const items = params as {
            axisValue: string
            marker: string
            seriesName: string
            value: number
          }[]
          if (!items || items.length === 0) return ''
          const date = items[0].axisValue
          const rows = items
            .map((p) => `${p.marker} ${p.seriesName}: <b style="color:#e8e8f0">${(p.value ?? 0).toLocaleString()}</b>`)
            .join('<br/>')
          return `<div style="font-weight:600;margin-bottom:6px;color:#FB7299">${date}</div>${rows}`
        },
      },
      legend: {
        top: 0,
        textStyle: { fontSize: 13, color: '#9a9ab0' },
      },
      grid: {
        left: 60,
        right: 30,
        top: 40,
        bottom: 60,
      },
      xAxis: {
        type: 'category' as const,
        data: dates,
        boundaryGap: false,
        axisLabel: { fontSize: 11, color: '#5e5e78' },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          fontSize: 11,
          color: '#5e5e78',
          formatter: (v: number) => formatCount(v),
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      dataZoom: [
        {
          type: 'inside' as const,
          start: 0,
          end: 100,
        },
        {
          type: 'slider' as const,
          start: 0,
          end: 100,
          height: 24,
          bottom: 8,
          borderColor: 'rgba(255,255,255,0.08)',
          fillerColor: 'rgba(251,114,153,0.15)',
          handleStyle: { color: '#FB7299' },
          textStyle: { color: '#5e5e78' },
        },
      ],
      series,
    }
  }, [trendData])

  const launchChartOption = useMemo(() => {
    if (launchData.length === 0) return null

    const dates = launchData.map((d) => d.snapshot_date)
    const views = launchData.map((d) => d.view_count)
    const baseView = launchData[0].view_count
    const cumulativeViews = views.map((v) => v - baseView)

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(25,25,50,0.92)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        textStyle: { color: '#e8e8f0', fontSize: 13 },
        formatter(params: unknown[]) {
          const items = params as { axisValue: string; value: number }[]
          if (!items || items.length === 0) return ''
          const date = items[0].axisValue
          const val = items[0].value ?? 0
          const abs = (val + baseView).toLocaleString()
          return `<div style="font-weight:600;margin-bottom:6px;color:#FB7299">${date}</div>
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#FB7299;margin-right:6px"></span>
            累计播放: <b style="color:#e8e8f0">${abs}</b><br/>
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#23ADE5;margin-right:6px"></span>
            增量: <b style="color:#23ADE5">${val.toLocaleString()}</b>`
        },
      },
      legend: {
        top: 0,
        textStyle: { fontSize: 13, color: '#9a9ab0' },
      },
      grid: {
        left: 60,
        right: 30,
        top: 40,
        bottom: 60,
      },
      xAxis: {
        type: 'category' as const,
        data: dates,
        boundaryGap: false,
        axisLabel: { fontSize: 11, color: '#5e5e78' },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          fontSize: 11,
          color: '#5e5e78',
          formatter: (v: number) => formatCount(v),
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      dataZoom: [
        {
          type: 'inside' as const,
          start: 0,
          end: 100,
        },
        {
          type: 'slider' as const,
          start: 0,
          end: 100,
          height: 24,
          bottom: 8,
          borderColor: 'rgba(255,255,255,0.08)',
          fillerColor: 'rgba(251,114,153,0.15)',
          handleStyle: { color: '#FB7299' },
          textStyle: { color: '#5e5e78' },
        },
      ],
      series: [
        {
          name: '播放增量',
          type: 'line' as const,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2.5, color: '#FB7299' },
          itemStyle: { color: '#FB7299', borderWidth: 2 },
          data: cumulativeViews,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#FB729930' },
              { offset: 1, color: '#FB729905' },
            ]),
          },
        },
      ],
    }
  }, [launchData])

  const launchMetrics = useMemo(() => {
    if (launchData.length < 2) return { h24: null as number | null, d3: null as number | null, d7: null as number | null }
    const base = launchData[0].view_count
    return {
      h24: launchData.length >= 2 ? launchData[1].view_count - base : null,
      d3: launchData.length >= 4 ? launchData[3].view_count - base : null,
      d7: launchData.length >= 8 ? launchData[7].view_count - base : null,
    }
  }, [launchData])

  const rankColumns: ColumnsType<VideoStat> = useMemo(
    () => [
      {
        title: '标题',
        dataIndex: 'title',
        key: 'title',
        ellipsis: true,
        render: (text: string, record: VideoStat) => (
          <a
            href={`https://www.bilibili.com/video/${record.bvid}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#FB7299' }}
          >
            {text}
          </a>
        ),
      },
      {
        title: 'UP主',
        dataIndex: 'uploader_name',
        key: 'uploader_name',
        width: 120,
        render: (text: string) => <span style={{ color: '#9a9ab0' }}>{text}</span>,
      },
      {
        title: '播放量',
        dataIndex: 'view_count',
        key: 'view_count',
        width: 110,
        sorter: (a: VideoStat, b: VideoStat) => a.view_count - b.view_count,
        render: (v: number) => <span style={{ color: '#FB7299', fontWeight: 500 }}>{formatCount(v)}</span>,
      },
      {
        title: '点赞',
        dataIndex: 'like_count',
        key: 'like_count',
        width: 100,
        sorter: (a: VideoStat, b: VideoStat) => a.like_count - b.like_count,
        render: (v: number) => <span style={{ color: '#23ADE5' }}>{formatCount(v)}</span>,
      },
      {
        title: '分区',
        dataIndex: 'partition_name',
        key: 'partition_name',
        width: 100,
        render: (text: string) => <span className="partition-tag">{text}</span>,
      },
    ],
    [],
  )

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <div className="section-card">
        <div className="section-header">
          <div className="section-title">
            <span className="title-dot" />
            视频趋势查询
          </div>
        </div>
          <div className="section-body">
            <div className="dark-search analytics-toolbar">
            <Input.Search
              placeholder="输入BV号，如 BV1xx411c7mD"
              value={bvid}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBvid(e.target.value)}
              onSearch={handleSearch}
              enterButton={
                <span>
                  <SearchOutlined /> 查询趋势
                </span>
              }
              style={{ width: 360 }}
              allowClear
            />
            <RangePicker
              value={trendRange}
              onChange={(dates: [Dayjs | null, Dayjs | null] | null) => {
                if (dates && dates[0] && dates[1]) {
                  setTrendRange([dates[0], dates[1]])
                }
              }}
            />
          </div>
        </div>
      </div>

      {trendLoading && (
        <div className="section-card">
          <div className="section-body" style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Spin tip="加载中..." />
          </div>
        </div>
      )}

      {!trendLoading && trendData.length > 0 && chartOption && (
        <div className="section-card">
          <div className="section-header">
            <div className="section-title">
              <LineChartOutlined style={{ color: '#FB7299' }} />
              <span>{videoTitle} — 趋势走势</span>
            </div>
          </div>
          <div className="section-body">
            <ReactEChartsCore
              echarts={echarts}
              option={chartOption}
              style={{ height: 420 }}
              notMerge
              lazyUpdate
            />
          </div>
        </div>
      )}

      {!trendLoading && trendData.length === 0 && bvid === '' && (
        <div className="section-card">
          <div className="section-body" style={{ padding: 60, textAlign: 'center' }}>
            <Empty
              description="输入BV号查询视频趋势数据"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        </div>
      )}

      {launchLoading && (
        <div className="section-card">
          <div className="section-body" style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Spin tip="加载爬坡曲线..." />
          </div>
        </div>
      )}

      {!launchLoading && launchData.length > 1 && launchChartOption && (
        <div className="section-card">
          <div className="section-header">
            <div className="section-title">
              <LineChartOutlined style={{ color: '#FB7299' }} />
              <span>{launchData[0].title} — 爬坡曲线</span>
            </div>
          </div>
            <div className="section-body">
              <div className="analytics-stat-grid" style={{ marginBottom: 20 }}>
              {[
                { label: '24h增长', value: launchMetrics.h24, color: '#FB7299' },
                { label: '3日增长', value: launchMetrics.d3, color: '#23ADE5' },
                { label: '7日增长', value: launchMetrics.d7, color: '#FFB027' },
              ].map((m) => (
                <div
                  key={m.label}
                  className="stat-card"
                  style={{ '--card-accent': m.color, flex: 1, minWidth: 160 } as React.CSSProperties}
                >
                  <div className="stat-value" style={{ fontSize: 22 }}>
                    {m.value !== null ? formatCount(m.value) : '—'}
                  </div>
                  <div className="stat-label">{m.label}</div>
                </div>
              ))}
            </div>
            <ReactEChartsCore
              echarts={echarts}
              option={launchChartOption}
              style={{ height: 380 }}
              notMerge
              lazyUpdate
            />
          </div>
        </div>
      )}

      <div className="section-card analytics-table-card">
        <div className="section-header">
          <div className="section-title">
            <span className="title-dot" style={{ background: '#23ADE5' }} />
            排行榜变动
          </div>
          <RangePicker
            value={rankRange}
            onChange={(dates: [Dayjs | null, Dayjs | null] | null) => {
              if (dates && dates[0] && dates[1]) {
                setRankRange([dates[0], dates[1]])
              }
            }}
          />
        </div>
        <Table<VideoStat>
          columns={rankColumns}
          dataSource={rankData}
          loading={rankLoading}
          rowKey="bvid"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }}
          scroll={{ x: 640 }}
          size="middle"
        />
      </div>
    </Space>
  )
}

export default Trend

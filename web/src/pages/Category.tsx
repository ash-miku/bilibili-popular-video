import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Row, Col, DatePicker, Select, Spin, Empty } from 'antd'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import dayjs, { Dayjs } from 'dayjs'
import {
  getCategoryDistribution,
  getCategoryTrend,
  getHotTags,
  getPartitionList,
} from '../api'

echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
])

const { RangePicker } = DatePicker

function formatCount(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万'
  return String(n)
}

interface PartitionOption {
  id: number
  name: string
}

const CHART_COLORS = [
  '#FB7299', '#23ADE5', '#02B340', '#FFB027', '#7B5FFF',
  '#FF6633', '#00D7D7', '#F54684', '#6FB1FF', '#A0D911',
  '#FF85C0', '#36CFC9', '#FFC53D', '#9254DE', '#40A9FF',
  '#FF7A45', '#73D13D', '#597EF7', '#F759AB', '#13C2C2',
]

const TAG_COLORS = [
  '#FF6B81', '#FB7299', '#F759AB', '#FF85C0',
  '#00A1D6', '#40A9FF', '#597EF7', '#6FB1FF',
  '#7B5FFF', '#9254DE', '#B37FEB',
  '#02B340', '#52C41A', '#73D13D', '#A0D911',
  '#FFB027', '#FFC53D', '#FFD666',
  '#FF6633', '#FF7A45', '#FF9C6E',
  '#00D7D7', '#13C2C2', '#36CFC9',
]

const Category: React.FC = () => {
  const [distDate, setDistDate] = useState<Dayjs>(dayjs().subtract(1, 'day'))
  const [distribution, setDistribution] = useState<Record<string, number>>({})
  const [distLoading, setDistLoading] = useState(false)

  const [tagsDate, setTagsDate] = useState<Dayjs>(dayjs().subtract(1, 'day'))
  const [hotTags, setHotTags] = useState<Record<string, number>>({})
  const [tagsLoading, setTagsLoading] = useState(false)

  const [trendRange, setTrendRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(29, 'day'),
    dayjs(),
  ])
  const [selectedPartition, setSelectedPartition] = useState<number>(0)
  const [partitionOptions, setPartitionOptions] = useState<PartitionOption[]>([
    { id: 0, name: '全站' },
  ])
  const [trendData, setTrendData] = useState<Record<string, unknown>[]>([])
  const [trendLoading, setTrendLoading] = useState(false)

  useEffect(() => {
    getPartitionList().then((list) => {
      if (list && list.length > 0) {
        setPartitionOptions([{ id: 0, name: '全站' }, ...list])
      }
    }).catch(() => {})
  }, [])

  const fetchDistribution = useCallback(async (date?: string) => {
    setDistLoading(true)
    try {
      const data = await getCategoryDistribution(date)
      setDistribution(data)
    } catch {
      setDistribution({})
    } finally {
      setDistLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDistribution(distDate.format('YYYY-MM-DD'))
  }, [distDate, fetchDistribution])

  const fetchHotTags = useCallback(async (date?: string) => {
    setTagsLoading(true)
    try {
      const data = await getHotTags(date, 20)
      setHotTags(data)
    } catch {
      setHotTags({})
    } finally {
      setTagsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHotTags(tagsDate.format('YYYY-MM-DD'))
  }, [tagsDate, fetchHotTags])

  const fetchTrend = useCallback(
    async (id: number, start: string, end: string) => {
      setTrendLoading(true)
      try {
        const data = await getCategoryTrend(id, start, end)
        setTrendData(data ?? [])
      } catch {
        setTrendData([])
      } finally {
        setTrendLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    const [start, end] = trendRange
    fetchTrend(selectedPartition, start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'))
  }, [selectedPartition, trendRange, fetchTrend])

  const barOption = useMemo(() => {
    const entries = Object.entries(distribution).sort((a, b) => a[1] - b[1])
    const names = entries.map(([k]) => k)
    const values = entries.map(([, v]) => v)

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        backgroundColor: 'rgba(25,25,50,0.92)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        textStyle: { color: '#e8e8f0', fontSize: 13 },
        formatter: (params: { name: string; value: number }[]) => {
          const p = params[0]
          return `${p.name}<br/><b style="color:#FB7299">${formatCount(p.value)}</b> 个视频`
        },
      },
      grid: {
        left: '3%',
        right: '12%',
        top: '3%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'value' as const,
        axisLabel: {
          formatter: (v: number) => formatCount(v),
          color: '#5e5e78',
        },
        splitLine: {
          lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' as const },
        },
      },
      yAxis: {
        type: 'category' as const,
        data: names,
        axisLabel: { color: '#9a9ab0', fontSize: 12 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar' as const,
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                {
                  offset: 0,
                  color: CHART_COLORS[i % CHART_COLORS.length] + '44',
                },
                {
                  offset: 1,
                  color: CHART_COLORS[i % CHART_COLORS.length],
                },
              ]),
              borderRadius: [0, 6, 6, 0],
            },
          })),
          barWidth: '60%',
          label: {
            show: true,
            position: 'right' as const,
            formatter: (p: { value: number }) => formatCount(p.value),
            color: '#9a9ab0',
            fontSize: 11,
          },
        },
      ],
      animationDuration: 800,
      animationEasing: 'cubicOut' as const,
    }
  }, [distribution])

  const lineOption = useMemo(() => {
    const dates = trendData.map((d) => {
      const raw = String(d.snapshot_date ?? d.date ?? d.ds ?? '')
      return raw ? dayjs(raw).format('MM/DD') : ''
    })
    const counts = trendData.map(
      (d) => Number(d.count ?? d.video_count ?? 0),
    )

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
      grid: {
        left: '3%',
        right: '4%',
        top: '8%',
        bottom: '12%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        data: dates,
        boundaryGap: false,
        axisLabel: {
          color: '#5e5e78',
          rotate: dates.length > 15 ? 30 : 0,
          fontSize: 11,
        },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          formatter: (v: number) => formatCount(v),
          color: '#5e5e78',
        },
        splitLine: {
          lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' as const },
        },
      },
      dataZoom: dates.length > 15
        ? [
            {
              type: 'inside' as const,
              start: 0,
              end: 100,
            },
          ]
        : [],
      series: [
        {
          type: 'line' as const,
          data: counts,
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

  const tagEntries = useMemo(() => {
    return Object.entries(hotTags).sort((a, b) => b[1] - a[1])
  }, [hotTags])

  const tagScale = useMemo(() => {
    if (tagEntries.length === 0) return { min: 0, max: 1 }
    const counts = tagEntries.map(([, c]) => c)
    return { min: Math.min(...counts), max: Math.max(...counts) }
  }, [tagEntries])

  function getTagSize(count: number): number {
    if (tagScale.max === tagScale.min) return 14
    const ratio = (count - tagScale.min) / (tagScale.max - tagScale.min)
    return Math.round(12 + ratio * 16)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Row gutter={20}>
        <Col span={12}>
          <div className="section-card">
            <div className="section-header">
              <div className="section-title">
                <span className="title-dot" />
                分区视频数量分布
              </div>
              <DatePicker
                size="small"
                value={distDate}
                onChange={(d) => d && setDistDate(d)}
                allowClear={false}
              />
            </div>
            <div className="section-body">
              <Spin spinning={distLoading}>
                {Object.keys(distribution).length === 0 && !distLoading ? (
                  <Empty description="暂无数据" />
                ) : (
                  <ReactEChartsCore
                    echarts={echarts}
                    option={barOption}
                    style={{ height: 480 }}
                    notMerge
                    lazyUpdate
                  />
                )}
              </Spin>
            </div>
          </div>
        </Col>

        <Col span={12}>
          <div className="section-card">
            <div className="section-header">
              <div className="section-title">
                <span className="title-dot" style={{ background: '#FFB027' }} />
                热门标签
              </div>
              <DatePicker
                size="small"
                value={tagsDate}
                onChange={(d) => d && setTagsDate(d)}
                allowClear={false}
              />
            </div>
            <div className="section-body">
              <Spin spinning={tagsLoading}>
                {tagEntries.length === 0 && !tagsLoading ? (
                  <Empty description="暂无数据" />
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 10,
                      padding: '12px 4px',
                      minHeight: 480,
                      alignContent: 'flex-start',
                    }}
                  >
                    {tagEntries.map(([tag, count], i) => (
                      <span
                        key={tag}
                        className="tag-cloud-tag"
                        style={{
                          fontSize: getTagSize(count),
                          lineHeight: 1.6,
                          fontWeight: count >= (tagScale.min + tagScale.max) / 2 ? 600 : 400,
                          background: TAG_COLORS[i % TAG_COLORS.length] + '22',
                          color: TAG_COLORS[i % TAG_COLORS.length],
                        }}
                      >
                        {tag}
                        <span
                          style={{
                            marginLeft: 6,
                            opacity: 0.65,
                            fontSize: getTagSize(count) - 2,
                          }}
                        >
                          {formatCount(count)}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </Spin>
            </div>
          </div>
        </Col>
      </Row>

      <div className="section-card">
        <div className="section-header">
          <div className="section-title">
            <span className="title-dot" style={{ background: '#23ADE5' }} />
            分区热度趋势
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <RangePicker
              size="small"
              value={trendRange}
              onChange={(vals) => {
                if (vals && vals[0] && vals[1]) {
                  setTrendRange([vals[0], vals[1]])
                }
              }}
            />
            <Select
              size="small"
              value={selectedPartition}
              onChange={setSelectedPartition}
              style={{ width: 120 }}
              options={partitionOptions.map((p) => ({
                value: p.id,
                label: p.name,
              }))}
            />
          </div>
        </div>
        <div className="section-body">
          <Spin spinning={trendLoading}>
            {trendData.length === 0 && !trendLoading ? (
              <Empty description="暂无数据" />
            ) : (
              <ReactEChartsCore
                echarts={echarts}
                option={lineOption}
                style={{ height: 380 }}
                notMerge
                lazyUpdate
              />
            )}
          </Spin>
        </div>
      </div>
    </div>
  )
}

export default Category

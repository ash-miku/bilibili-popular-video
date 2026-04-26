import React, { useState, useEffect, useCallback } from 'react'
import { Table, Select, DatePicker, Drawer, Spin, message } from 'antd'
import { UserOutlined, TrophyOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import dayjs, { Dayjs } from 'dayjs'
import { getTopUploaders, getUploaderDetail } from '../api'
import type { UploaderStat } from '../api'

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const { RangePicker } = DatePicker

const SORT_OPTIONS = [
  { label: '播放量', value: 'total_views' },
  { label: '视频数', value: 'video_count' },
  { label: '平均播放', value: 'avg_views' },
] as const

const formatCount = (n: number): string => {
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '亿'
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return n.toLocaleString()
}

const CHART_COLORS = {
  views: '#FB7299',
  likes: '#23ADE5',
  count: '#FFB027',
}

const AVATAR_COLORS = [
  '#FB7299', '#23ADE5', '#FFB027', '#02B340', '#7B5FFF',
  '#FF6B6B', '#4ECDC4', '#F7B731', '#EB3B5A', '#3867D6',
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const Uploader: React.FC = () => {
  const getThemeColor = (varName: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(varName).trim()

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<UploaderStat[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortBy, setSortBy] = useState<string>('total_views')
  const [date, setDate] = useState<Dayjs | undefined>(undefined)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [currentUploader, setCurrentUploader] = useState<UploaderStat | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailData, setDetailData] = useState<UploaderStat[]>([])
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ])

  const maxViews = React.useMemo(() => {
    if (data.length === 0) return 1
    return Math.max(1, ...data.map((d) => d.total_views))
  }, [data])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getTopUploaders({
        sortBy,
        page,
        pageSize,
        date: date?.format('YYYY-MM-DD'),
      })
      setData(res.list ?? [])
      setTotal(res.total ?? 0)
    } catch {
      message.error('获取UP主排行数据失败')
    } finally {
      setLoading(false)
    }
  }, [sortBy, page, pageSize, date])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const fetchDetail = useCallback(
    async (uploader: UploaderStat, range?: [Dayjs, Dayjs]) => {
      setDetailLoading(true)
      try {
        const [start, end] = range ?? dateRange
        const res = await getUploaderDetail(
          uploader.uploader_mid,
          start.format('YYYY-MM-DD'),
          end.format('YYYY-MM-DD'),
        )
        setDetailData(res)
      } catch {
        message.error('获取UP主详情失败')
      } finally {
        setDetailLoading(false)
      }
    },
    [dateRange],
  )

  const handleRowClick = (record: UploaderStat) => {
    setCurrentUploader(record)
    setDrawerOpen(true)
    fetchDetail(record)
  }

  const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      const range: [Dayjs, Dayjs] = [dates[0], dates[1]]
      setDateRange(range)
      if (currentUploader) {
        fetchDetail(currentUploader, range)
      }
    }
  }

  const columns: ColumnsType<UploaderStat> = [
    {
      title: '排名',
      key: 'rank',
      width: 72,
      align: 'center',
      render: (_: unknown, __: unknown, index: number) => {
        const rank = (page - 1) * pageSize + index + 1
        const cls = rank <= 3 ? `rank-${rank}` : 'rank-default'
        return <span className={`rank-badge ${cls}`}>{rank}</span>
      },
    },
    {
      title: 'UP主',
      dataIndex: 'uploader_name',
      key: 'uploader_name',
      render: (name: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            className="avatar-placeholder"
            style={{ background: getAvatarColor(name) }}
          >
            {name.charAt(0)}
          </span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
        </div>
      ),
    },
    {
      title: '视频数',
      dataIndex: 'video_count',
      key: 'video_count',
      align: 'right',
      sorter: true,
      render: (val: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', color: '#FFB027' }}>
          {val.toLocaleString()}
        </span>
      ),
    },
    {
      title: '总播放',
      dataIndex: 'total_views',
      key: 'total_views',
      align: 'right',
      sorter: true,
      render: (val: number) => (
        <div>
          <div style={{ fontVariantNumeric: 'tabular-nums', color: '#FB7299', fontWeight: 600, marginBottom: 4 }}>
            {formatCount(val)}
          </div>
          <div className="mini-progress">
            <div
              className="mini-progress-bar"
              style={{
                width: `${Math.round((val / maxViews) * 100)}%`,
                background: `linear-gradient(90deg, #FB7299, #e8456b)`,
              }}
            />
          </div>
        </div>
      ),
    },
    {
      title: '总点赞',
      dataIndex: 'total_likes',
      key: 'total_likes',
      align: 'right',
      sorter: true,
      render: (val: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', color: '#23ADE5', fontWeight: 500 }}>
          {formatCount(val)}
        </span>
      ),
    },
    {
      title: '平均播放',
      dataIndex: 'avg_views',
      key: 'avg_views',
      align: 'right',
      sorter: true,
      render: (val: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
          {formatCount(val)}
        </span>
      ),
    },
  ]

  const chartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: getThemeColor('--bg-card-solid') || 'rgba(25,25,50,0.92)',
      borderColor: getThemeColor('--border-card') || 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      textStyle: { color: getThemeColor('--text-primary') || '#e8e8f0', fontSize: 13 },
      axisPointer: { type: 'cross' as const, crossStyle: { color: getThemeColor('--border-card') || 'rgba(255,255,255,0.2)' } },
    },
    legend: {
      data: ['总播放', '总点赞', '视频数'],
      bottom: 0,
      textStyle: { color: getThemeColor('--text-secondary') || '#9a9ab0' },
      itemWidth: 16,
      itemHeight: 8,
      itemGap: 24,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '12%',
      top: '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category' as const,
      data: detailData.map((d) => d.stat_date ?? ''),
      axisLine: { lineStyle: { color: getThemeColor('--border-card') || 'rgba(255,255,255,0.08)' } },
      axisLabel: {
        color: getThemeColor('--text-muted') || '#5e5e78',
        fontSize: 11,
        formatter: (val: string) => (val ? dayjs(val).format('MM/DD') : ''),
      },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value' as const,
        name: '播放 / 点赞',
        nameTextStyle: { color: getThemeColor('--text-muted') || '#5e5e78' },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: getThemeColor('--border-subtle') || 'rgba(255,255,255,0.04)' } },
        axisLabel: {
          color: getThemeColor('--text-muted') || '#5e5e78',
          fontSize: 11,
          formatter: (val: number) => formatCount(val),
        },
      },
      {
        type: 'value' as const,
        name: '视频数',
        nameTextStyle: { color: getThemeColor('--text-muted') || '#5e5e78' },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: getThemeColor('--text-muted') || '#5e5e78',
          fontSize: 11,
        },
      },
    ],
    series: [
      {
        name: '总播放',
        type: 'line' as const,
        data: detailData.map((d) => d.total_views),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2.5, color: CHART_COLORS.views },
        itemStyle: { color: CHART_COLORS.views },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(251,114,153,0.25)' },
            { offset: 1, color: 'rgba(251,114,153,0.02)' },
          ]),
        },
      },
      {
        name: '总点赞',
        type: 'line' as const,
        data: detailData.map((d) => d.total_likes),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2.5, color: CHART_COLORS.likes },
        itemStyle: { color: CHART_COLORS.likes },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(35,173,229,0.2)' },
            { offset: 1, color: 'rgba(35,173,229,0.02)' },
          ]),
        },
      },
      {
        name: '视频数',
        type: 'line' as const,
        yAxisIndex: 1,
        data: detailData.map((d) => d.video_count),
        smooth: true,
        symbol: 'diamond',
        symbolSize: 6,
        lineStyle: { width: 2, color: CHART_COLORS.count, type: 'dashed' as const },
        itemStyle: { color: CHART_COLORS.count },
      },
    ],
  }

  return (
    <div>
      <div className="section-card">
        <div className="section-header">
          <div className="section-title">
            <TrophyOutlined style={{ color: '#FFB027' }} />
            TOP UP主排行
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Select
              value={sortBy}
              onChange={(val) => {
                setSortBy(val)
                setPage(1)
              }}
              options={SORT_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
              style={{ width: 120 }}
            />
            <DatePicker
              placeholder="选择日期"
              value={date}
              onChange={(d) => {
                setDate(d)
                setPage(1)
              }}
              allowClear
            />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              共 <span style={{ color: '#FB7299', fontWeight: 600 }}>{total}</span> 位UP主
            </span>
          </div>
        </div>

        <Table<UploaderStat>
          rowKey="uploader_mid"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (t) => `共 ${t} 条`,
          }}
          onChange={(pagination) => {
            setPage(pagination.current ?? 1)
            setPageSize(pagination.pageSize ?? 10)
          }}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { cursor: 'pointer' },
          })}
          size="middle"
        />
      </div>

      <Drawer
        title={
          currentUploader ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                className="avatar-placeholder"
                style={{ background: getAvatarColor(currentUploader.uploader_name) }}
              >
                {currentUploader.uploader_name.charAt(0)}
              </span>
              <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
                UP主详情 — {currentUploader.uploader_name}
              </span>
            </div>
          ) : null
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
        styles={{
          body: { padding: '16px 24px 24px' },
        }}
      >
        {currentUploader && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                marginBottom: 20,
              }}
            >
              {[
                { label: '总播放', value: formatCount(currentUploader.total_views), color: CHART_COLORS.views },
                { label: '总点赞', value: formatCount(currentUploader.total_likes), color: CHART_COLORS.likes },
                { label: '视频数', value: currentUploader.video_count.toLocaleString(), color: CHART_COLORS.count },
              ].map((item) => (
                <div
                  key={item.label}
                  className="stat-card"
                  style={{
                    '--card-accent': item.color,
                    padding: '16px 20px',
                  } as React.CSSProperties}
                >
                  <div className="stat-icon" style={{
                    background: item.color + '20',
                    color: item.color,
                    width: 36,
                    height: 36,
                    marginBottom: 10,
                    fontSize: 16,
                  }}>
                    {item.label === '总播放' ? <UserOutlined /> : item.label === '总点赞' ? <TrophyOutlined /> : <span>#</span>}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>
                    {item.value}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <RangePicker
                value={dateRange}
                onChange={handleDateRangeChange}
                style={{ width: '100%' }}
              />
            </div>

            <Spin spinning={detailLoading} tip="加载中...">
              <ReactEChartsCore
                echarts={echarts}
                option={chartOption}
                style={{ height: 360 }}
                notMerge
                lazyUpdate
              />
            </Spin>
          </>
        )}
      </Drawer>
    </div>
  )
}

export default Uploader

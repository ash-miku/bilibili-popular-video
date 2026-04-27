import React, { useState, useEffect, useMemo } from 'react'
import { Row, Col, Select, Spin, Empty, message } from 'antd'
import { SwapOutlined } from '@ant-design/icons'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import dayjs, { type Dayjs } from 'dayjs'
import { getRankingChange, type VideoStat } from '../api'
import { useVideoModal } from './Player'
import { formatCount } from '../utils/format'
import { presets, presetToRange, type PresetKey } from '../utils/datePresets'

echarts.use([
  BarChart,
  GridComponent,
  TooltipComponent,
  CanvasRenderer,
])

const RankingChange: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<VideoStat[]>([])
  const [activePreset, setActivePreset] = useState<PresetKey>('7d')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(presetToRange('7d'))
  const videoModal = useVideoModal()

  useEffect(() => {
    setLoading(true)
    const [start, end] = dateRange
    getRankingChange(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'), 20)
      .then((res) => setData(res ?? []))
      .catch(() => {
        message.error('加载排行变化数据失败')
        setData([])
      })
      .finally(() => setLoading(false))
  }, [dateRange])

  const barOption = useMemo(() => {
    if (data.length === 0) return null
    const top = data.slice(0, 20)
    const titles = top.map((d) => {
      const t = d.title ?? ''
      return t.length > 12 ? t.slice(0, 12) + '…' : t
    })
    const views = top.map((d) => d.view_count)
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        backgroundColor: 'rgba(25,25,50,0.92)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        textStyle: { color: '#e8e8f0', fontSize: 13 },
        formatter: (params: { name: string; value: number; dataIndex: number }[]) => {
          const p = params[0]
          const fullTitle = top[p.dataIndex]?.title ?? p.name
          return `${fullTitle}<br/><b style="color:#FB7299">${formatCount(p.value)}</b> 播放量`
        },
      },
      grid: { left: '3%', right: '12%', top: '3%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'value' as const,
        axisLabel: { formatter: (v: number) => formatCount(v), color: '#5e5e78' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' as const } },
      },
      yAxis: {
        type: 'category' as const,
        data: titles,
        axisLabel: { color: '#9a9ab0', fontSize: 12 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar' as const,
          data: views.map((_, i) => ({
            value: views[i],
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: 'rgba(251,114,153,0.2)' },
                { offset: 1, color: '#FB7299' },
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
  }, [data])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="bili-banner">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SwapOutlined style={{ color: '#FB7299' }} />
          排行变化
        </h2>
        <p>每日榜单变化追踪 · 新晋与落榜视频</p>
      </div>

      <div className="section-card">
        <div className="section-header">
          <div className="section-title">
            <SwapOutlined style={{ color: '#FB7299' }} />
            涨幅最大视频
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
              共 <span style={{ color: '#FB7299', fontWeight: 600 }}>{data.length}</span> 个视频
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {presets.map((p) => (
              <button
                key={p.key}
                onClick={() => { setActivePreset(p.key); setDateRange(presetToRange(p.key)) }}
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  border: activePreset === p.key ? 'none' : '1px solid var(--border-subtle)',
                  background: activePreset === p.key ? 'var(--bili-pink)' : 'transparent',
                  color: activePreset === p.key ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: activePreset === p.key ? 500 : 400,
                  transition: 'all 0.2s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Spin spinning={loading}>
        {data.length === 0 && !loading ? (
          <div className="section-card" style={{ padding: 60, textAlign: 'center' }}>
            <Empty description="暂无排行变化数据" />
          </div>
        ) : (
          <>
            <div className="section-card">
              <div className="section-header">
                <div className="section-title">
                  <span className="title-dot" />
                  涨幅排行 (Top 20)
                </div>
              </div>
              <div className="section-body">
                {barOption && (
                  <ReactEChartsCore
                    echarts={echarts}
                    option={barOption}
                    style={{ height: Math.max(300, Math.min(data.length, 20) * 32 + 60) }}
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
                  视频列表
                </div>
              </div>
              <div className="section-body">
                <Row gutter={[16, 16]}>
                  {data.map((item, idx) => (
                    <Col key={item.bvid} xs={24} sm={12} md={8} lg={6}>
                      <div
                        style={{
                          padding: 16,
                          borderRadius: 12,
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-card-solid)',
                          cursor: 'pointer',
                          transition: 'all 0.3s',
                        }}
                        onClick={() => videoModal.open({
                          bvid: item.bvid,
                          title: item.title,
                          uploaderName: item.uploader_name,
                          viewCount: item.view_count,
                        })}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(251,114,153,0.3)'
                          e.currentTarget.style.transform = 'scale(1.02)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-subtle)'
                          e.currentTarget.style.transform = 'scale(1)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{
                            fontSize: 14, fontWeight: 700, color: idx < 3 ? '#FB7299' : 'var(--text-secondary)',
                          }}>
                            #{idx + 1}
                          </span>
                          <span className="partition-tag">{item.partition_name}</span>
                        </div>
                        <div style={{
                          fontWeight: 600, fontSize: 14, color: 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          marginBottom: 8,
                        }}>
                          {item.title}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                          <span>{item.uploader_name}</span>
                          <span style={{ color: '#FB7299', fontWeight: 500 }}>{formatCount(item.view_count)}</span>
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </div>
            </div>
          </>
        )}
      </Spin>
    </div>
  )
}

export default RankingChange

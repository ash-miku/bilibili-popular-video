import React, { useState, useEffect, useMemo } from 'react'
import { Select, Spin, Empty, message, DatePicker, Tooltip } from 'antd'
import { TagOutlined } from '@ant-design/icons'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import dayjs from 'dayjs'
import { getHotTags } from '../api'
import { formatCount } from '../utils/format'

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

const TAG_COLORS = ['#FB7299', '#23ADE5', '#FFB027', '#02B340', '#7B5FFF', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']

const TagCloud: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [tags, setTags] = useState<Record<string, number>>({})
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().subtract(1, 'day').format('YYYY-MM-DD'))
  const [topN, setTopN] = useState(50)

  useEffect(() => {
    setLoading(true)
    getHotTags(selectedDate, topN)
      .then((data) => { setTags(data as Record<string, number>) })
      .catch(() => { message.error('加载标签数据失败'); setTags({}) })
      .finally(() => setLoading(false))
  }, [selectedDate, topN])

  const sortedTags = useMemo(() => {
    return Object.entries(tags)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [tags])

  const totalCount = sortedTags.reduce((s, t) => s + t.count, 0)
  const maxCount = sortedTags[0]?.count || 1

  const barOption = useMemo(() => {
    if (sortedTags.length === 0) return null
    const top20 = sortedTags.slice(0, 20)
    const names = [...top20].reverse().map((t) => t.name)
    const values = [...top20].reverse().map((t) => t.count)
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(25,25,50,0.92)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        textStyle: { color: '#e8e8f0', fontSize: 13 },
      },
      grid: { left: 100, right: 30, top: 10, bottom: 30 },
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
        data: values,
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: 'rgba(251,114,153,0.3)' },
            { offset: 1, color: '#FB7299' },
          ]),
        },
        barMaxWidth: 20,
      }],
    }
  }, [sortedTags])

  const statCards = [
    { title: '标签总数', value: sortedTags.length, color: '#23ADE5' },
    { title: '最热标签', value: sortedTags[0]?.name ?? '-', color: '#FB7299' },
    { title: '最热标签出现次数', value: sortedTags[0]?.count ?? 0, color: '#FFB027', format: formatCount },
    { title: '标签总出现次数', value: totalCount, color: '#02B340', format: formatCount },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="bili-banner">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TagOutlined style={{ color: '#FB7299' }} />
          标签云
        </h2>
        <p>热门视频标签可视化 · 标签热度排行</p>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {statCards.map((card, i) => (
          <div key={i} className="stat-card" style={{ '--card-accent': card.color, flex: 1, minWidth: 160 } as React.CSSProperties}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div className="stat-label">{card.title}</div>
            </div>
            <div className="stat-value" style={{ fontSize: 24 }}>
              {card.format ? card.format(card.value as number) : card.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>选择日期:</span>
        <DatePicker
          value={dayjs(selectedDate)}
          onChange={(d) => d && setSelectedDate(d.format('YYYY-MM-DD'))}
          allowClear={false}
        />
        <span style={{ color: 'var(--text-secondary)', fontSize: 13, marginLeft: 16 }}>标签数量:</span>
        <Select
          value={topN}
          onChange={setTopN}
          options={[
            { label: 'Top 20', value: 20 },
            { label: 'Top 50', value: 50 },
            { label: 'Top 100', value: 100 },
          ]}
          style={{ width: 120 }}
        />
      </div>

      <Spin spinning={loading}>
        {sortedTags.length === 0 && !loading ? (
          <div className="section-card" style={{ padding: 60, textAlign: 'center' }}>
            <Empty description="暂无标签数据" />
          </div>
        ) : (
          <>
            <div className="section-card">
              <div className="section-header">
                <div className="section-title">
                  <span className="title-dot" />
                  标签词云
                </div>
              </div>
              <div className="section-body">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', padding: '16px 0' }}>
                  {sortedTags.slice(0, 50).map((tag, i) => {
                    const ratio = tag.count / maxCount
                    const fontSize = Math.max(12, Math.round(ratio * 36))
                    const opacity = 0.5 + ratio * 0.5
                    const color = TAG_COLORS[i % TAG_COLORS.length]
                    return (
                      <Tooltip key={tag.name} title={`${tag.name}: ${tag.count} 次`}>
                        <span
                          style={{
                            fontSize,
                            fontWeight: ratio > 0.5 ? 700 : 400,
                            color,
                            opacity,
                            cursor: 'default',
                            padding: '2px 8px',
                            borderRadius: 6,
                            transition: 'transform 0.2s, opacity 0.2s',
                            display: 'inline-block',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.opacity = '1' }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = String(opacity) }}
                        >
                          {tag.name}
                        </span>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="section-card">
              <div className="section-header">
                <div className="section-title">
                  <span className="title-dot" style={{ background: '#FB7299' }} />
                  标签热度排行 Top 20
                </div>
              </div>
              <div className="section-body">
                {barOption && (
                  <ReactEChartsCore
                    echarts={echarts}
                    option={barOption}
                    style={{ height: Math.max(300, Math.min(sortedTags.length, 20) * 28) }}
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

export default TagCloud

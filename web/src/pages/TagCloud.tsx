import React, { useState, useEffect, useMemo } from 'react'
import { Select, Spin, Empty, message, DatePicker } from 'antd'
import { TagOutlined } from '@ant-design/icons'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { ScatterChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import dayjs from 'dayjs'
import { getHotTags, getCategoryDistribution } from '../api'
import { formatCount } from '../utils/format'

echarts.use([ScatterChart, TooltipComponent, CanvasRenderer])

const COLORS = ['#FB7299', '#23ADE5', '#FFB027', '#02B340', '#7B5FFF', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']

const TagCloud: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [tags, setTags] = useState<Record<string, number>>({})
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().subtract(1, 'day').format('YYYY-MM-DD'))
  const [topN, setTopN] = useState(50)

  useEffect(() => {
    setLoading(true)
    getHotTags(selectedDate, topN)
      .then((data) => {
        setTags(data as Record<string, number>)
      })
      .catch(() => {
        message.error('加载标签数据失败')
        setTags({})
      })
      .finally(() => setLoading(false))
  }, [selectedDate, topN])

  const sortedTags = useMemo(() => {
    return Object.entries(tags)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [tags])

  const totalCount = sortedTags.reduce((s, t) => s + t.count, 0)

  const scatterOption = useMemo(() => {
    if (sortedTags.length === 0) return null

    const maxCount = sortedTags[0]?.count || 1
    const data = sortedTags.map((tag, i) => {
      const fontSize = Math.max(12, Math.round((tag.count / maxCount) * 48))
      const angle = (i * 137.5 * Math.PI) / 180 // golden angle
      const radius = 20 + Math.sqrt(i) * 30
      return {
        value: [Math.cos(angle) * radius, Math.sin(angle) * radius, tag.count],
        name: tag.name,
        symbolSize: fontSize,
        label: {
          show: true,
          formatter: tag.name,
          fontSize,
          color: COLORS[i % COLORS.length],
          fontWeight: tag.count > maxCount * 0.5 ? 700 : 400,
        },
        itemStyle: {
          color: 'transparent',
        },
      }
    })

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: 'rgba(25,25,50,0.92)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        textStyle: { color: '#e8e8f0', fontSize: 13 },
        formatter: (params: { name: string; value: number[] }) => {
          return `<b>${params.name}</b><br/>出现 <b style="color:#FB7299">${params.value[2]}</b> 次`
        },
      },
      xAxis: {
        show: false,
        min: -200,
        max: 200,
      },
      yAxis: {
        show: false,
        min: -200,
        max: 200,
      },
      series: [{
        type: 'scatter' as const,
        data,
        emphasis: {
          scale: 1.2,
        },
      }],
      animationDuration: 800,
      animationEasing: 'cubicOut' as const,
    }
  }, [sortedTags])

  const barOption = useMemo(() => {
    if (sortedTags.length === 0) return null
    const top20 = sortedTags.slice(0, 20)
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
        data: top20.reverse().map((t) => t.name),
        axisLabel: { color: '#9a9ab0', fontSize: 12 },
      },
      series: [{
        type: 'bar' as const,
        data: top20.reverse().map((t) => ({
          value: t.count,
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
                {scatterOption && (
                  <ReactEChartsCore
                    echarts={echarts}
                    option={scatterOption}
                    style={{ height: 450 }}
                    notMerge
                    lazyUpdate
                  />
                )}
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

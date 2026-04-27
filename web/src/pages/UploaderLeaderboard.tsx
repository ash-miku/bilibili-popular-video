import React, { useState, useEffect, useMemo } from 'react'
import { Select, Spin, Empty, message } from 'antd'
import { TrophyOutlined } from '@ant-design/icons'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import dayjs from 'dayjs'
import { getTopUploaders, type UploaderStat } from '../api'
import { formatCount } from '../utils/format'

echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const COLORS = ['#FB7299', '#23ADE5', '#FFB027', '#02B340', '#7B5FFF', '#FF6B6B', '#4ECDC4', '#F7B731', '#EB3B5A', '#3867D6']

const UploaderLeaderboard: React.FC = () => {
  const getThemeColor = (varName: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<UploaderStat[]>([])
  const [sortBy, setSortBy] = useState('total_views')

  useEffect(() => {
    setLoading(true)
    getTopUploaders({ sortBy, page: 1, pageSize: 20, date: dayjs().format('YYYY-MM-DD') })
      .then((res) => setData(res.list ?? []))
      .catch((err: Error) => message.error('加载UP主排行失败: ' + err.message))
      .finally(() => setLoading(false))
  }, [sortBy])

  const chartOption = useMemo(() => {
    const top10 = data.slice(0, 10).reverse()
    const metricKey = sortBy as keyof UploaderStat
    const metricLabel = sortBy === 'total_views' ? '总播放' : sortBy === 'video_count' ? '视频数' : sortBy === 'avg_views' ? '平均播放' : '总点赞'
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: getThemeColor('--bg-card-solid') || 'rgba(25,25,50,0.92)',
        textStyle: { color: getThemeColor('--text-primary') || '#e8e8f0', fontSize: 13 },
      },
      grid: { left: 100, right: 30, top: 20, bottom: 30 },
      xAxis: {
        type: 'value' as const,
        axisLabel: {
          color: getThemeColor('--text-muted') || '#5e5e78',
          formatter: (v: number) => formatCount(v),
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      yAxis: {
        type: 'category' as const,
        data: top10.map((d) => d.uploader_name),
        axisLabel: { color: getThemeColor('--text-secondary') || '#9a9ab0', fontSize: 12 },
      },
      series: [{
        type: 'bar' as const,
        data: top10.map((d, i) => ({
          value: Number(d[metricKey] ?? 0),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: COLORS[i % COLORS.length] + '40' },
              { offset: 1, color: COLORS[i % COLORS.length] },
            ]),
            borderRadius: [0, 4, 4, 0],
          },
        })),
        barMaxWidth: 24,
      }],
    }
  }, [data, sortBy])

  const tableData = useMemo(() => {
    return data.map((d, i) => ({
      ...d,
      rank: i + 1,
      engagement: d.video_count > 0 ? Math.round(d.total_views / d.video_count) : 0,
    }))
  }, [data])

  return (
    <div>
      <div className="bili-banner" style={{ marginBottom: 20 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TrophyOutlined style={{ color: '#FB7299' }} />
          UP主排行榜
        </h2>
        <p>多维度UP主排行对比 · 发现最活跃的内容创作者</p>
      </div>

      <div className="section-card">
        <div className="section-header">
          <div className="section-title">
            <TrophyOutlined style={{ color: '#FFB027' }} />
            Top 20 UP主
          </div>
          <Select
            value={sortBy}
            onChange={setSortBy}
            options={[
              { label: '按播放量', value: 'total_views' },
              { label: '按视频数', value: 'video_count' },
              { label: '按平均播放', value: 'avg_views' },
              { label: '按总点赞', value: 'total_likes' },
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
            <>
              <ReactEChartsCore echarts={echarts} option={chartOption} style={{ height: 420 }} notMerge lazyUpdate />
              <div style={{ marginTop: 20 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>#</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>UP主</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>视频数</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>总播放</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>总点赞</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>平均播放</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((d) => (
                      <tr key={d.uploader_mid} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {d.rank <= 3 ? (
                            <span className={`rank-badge rank-${d.rank}`}>{d.rank}</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>{d.rank}</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>{d.uploader_name}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#FFB027' }}>{d.video_count}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#FB7299', fontWeight: 500 }}>{formatCount(d.total_views)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#23ADE5' }}>{formatCount(d.total_likes)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#02B340' }}>{formatCount(Math.round(d.avg_views))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default UploaderLeaderboard

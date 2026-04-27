import React, { useState, useEffect, useCallback } from 'react'
import { Table, Select, Spin, Empty, message } from 'antd'
import { FireOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { Dayjs } from 'dayjs'
import { getHotRanking, getCategoryDistribution, type VideoStat } from '../api'
import { useVideoModal } from './Player'
import { formatCount } from '../utils/format'
import { presets, presetToRange, type PresetKey } from '../utils/datePresets'

const Hot: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<VideoStat[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [activePreset, setActivePreset] = useState<PresetKey>('7d')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(presetToRange('7d'))
  const [partitionName, setPartitionName] = useState<string>('')
  const [partitions, setPartitions] = useState<{ label: string; value: string }[]>([])
  const videoModal = useVideoModal()
  useEffect(() => {
    getCategoryDistribution(dayjs().subtract(1, 'day').format('YYYY-MM-DD'))
      .then((dist) => {
        const items = Object.entries(dist)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([name, count]) => ({ label: `${name} (${count})`, value: name }))
        setPartitions(items)
      })
      .catch(() => { message.error('分区列表加载失败') })
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [start, end] = dateRange
      const res = await getHotRanking({
        start: start.format('YYYY-MM-DD'),
        end: end.format('YYYY-MM-DD'),
        partitionName: partitionName || undefined,
        page,
        pageSize,
      })
      setData(res.list ?? [])
      setTotal(res.total ?? 0)
    } catch (err: unknown) {
      message.error('加载综合热门失败: ' + (err instanceof Error ? err.message : ''))
    } finally {
      setLoading(false)
    }
  }, [dateRange, partitionName, page, pageSize])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const columns: ColumnsType<VideoStat> = [
    {
      title: '排名',
      key: 'rank',
      width: 68,
      align: 'center',
      render: (_: unknown, __: unknown, index: number) => {
        const rank = (page - 1) * pageSize + index + 1
        const cls = rank <= 3 ? `rank-${rank}` : 'rank-default'
        return <span className={`rank-badge ${cls}`}>{rank}</span>
      },
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 280,
      render: (text: string, record: VideoStat) => (
        <span
          onClick={() => videoModal.open({
            bvid: record.bvid,
            title: record.title,
            uploaderName: record.uploader_name,
            viewCount: record.view_count,
          })}
          style={{
            fontWeight: 500,
            color: 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'color 0.2s',
            display: 'inline-block',
            maxWidth: 280,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--bili-pink)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
        >
          {text}
        </span>
      ),
    },
    {
      title: 'UP主',
      dataIndex: 'uploader_name',
      key: 'uploader',
      width: 110,
      ellipsis: true,
      render: (text: string) => <span style={{ color: 'var(--text-secondary)' }}>{text}</span>,
    },
    {
      title: '分区',
      dataIndex: 'partition_name',
      key: 'partition',
      width: 100,
      render: (text: string) => <span className="partition-tag">{text}</span>,
    },
    {
      title: '播放',
      dataIndex: 'view_count',
      key: 'views',
      width: 90,
      align: 'right',
      sorter: (a, b) => a.view_count - b.view_count,
      render: (n: number) => <span style={{ color: '#FB7299', fontWeight: 500 }}>{formatCount(n)}</span>,
    },
    {
      title: '点赞',
      dataIndex: 'like_count',
      key: 'likes',
      width: 90,
      align: 'right',
      sorter: (a, b) => a.like_count - b.like_count,
      render: (n: number) => <span style={{ color: '#23ADE5', fontWeight: 500 }}>{formatCount(n)}</span>,
    },
    {
      title: '弹幕',
      dataIndex: 'danmaku_count',
      key: 'danmaku',
      width: 80,
      align: 'right',
      render: (n: number) => <span style={{ color: '#FFB027' }}>{formatCount(n)}</span>,
    },
  ]

  return (
    <div>
      <div className="bili-banner" style={{ marginBottom: 20 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FireOutlined style={{ color: '#FB7299' }} />
          综合热门
        </h2>
        <p>最近一段时间内各分区最热门的视频排行，按播放量排序</p>
      </div>

      <div className="section-card">
        <div className="section-header">
          <div className="section-title">
            <FireOutlined style={{ color: '#FB7299' }} />
            热门视频排行
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
              共 <span style={{ color: '#FB7299', fontWeight: 600 }}>{total}</span> 个视频
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {presets.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  setActivePreset(p.key)
                  setDateRange(presetToRange(p.key))
                  setPage(1)
                }}
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
            <Select
              value={partitionName}
              onChange={(val) => { setPartitionName(val); setPage(1) }}
              options={[{ label: '全部分区', value: '' }, ...partitions]}
              style={{ width: 160 }}
              placeholder="选择分区"
              showSearch
              optionFilterProp="label"
            />
          </div>
        </div>

        <Spin spinning={loading}>
          {data.length === 0 && !loading ? (
            <div style={{ padding: '60px 0' }}>
              <Empty description="暂无数据，请等待爬虫采集" />
            </div>
          ) : (
            <Table<VideoStat>
              rowKey="bvid"
              columns={columns}
              dataSource={data}
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
                setPageSize(pagination.pageSize ?? 20)
              }}
              size="middle"
            />
          )}
        </Spin>
      </div>
    </div>
  )
}

export default Hot

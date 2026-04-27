import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Table, Select, Spin, Empty, message } from 'antd'
import { HistoryOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getRanking, type VideoStat } from '../api'
import { useVideoModal } from './Player'
import { formatCount } from '../utils/format'

const HistoryRanking: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<VideoStat[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedDate, setSelectedDate] = useState(dayjs().subtract(1, 'day').format('YYYY-MM-DD'))
  const videoModal = useVideoModal()

  const dates = useMemo(() => {
    const today = dayjs()
    const result: string[] = []
    for (let i = 1; i <= 30; i++) {
      result.push(today.subtract(i, 'day').format('YYYY-MM-DD'))
    }
    return result
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getRanking({ date: selectedDate, page, pageSize })
      setData(res.list ?? [])
      setTotal(res.total ?? 0)
    } catch (err: unknown) {
      message.error('加载历史榜单失败: ' + (err instanceof Error ? err.message : ''))
    } finally {
      setLoading(false)
    }
  }, [selectedDate, page, pageSize])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const columns: ColumnsType<VideoStat> = [
    {
      title: '排名',
      key: 'rank',
      width: 64,
      align: 'center',
      render: (_: unknown, __: unknown, idx: number) => {
        const rank = (page - 1) * pageSize + idx + 1
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
            bvid: record.bvid, title: record.title,
            uploaderName: record.uploader_name, viewCount: record.view_count,
          })}
          style={{
            fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer',
            transition: 'color 0.2s', display: 'inline-block', maxWidth: 280,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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
      render: (t: string) => <span style={{ color: 'var(--text-secondary)' }}>{t}</span>,
    },
    {
      title: '分区',
      dataIndex: 'partition_name',
      key: 'partition',
      width: 100,
      render: (t: string) => <span className="partition-tag">{t}</span>,
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
  ]

  return (
    <div>
      <div className="bili-banner" style={{ marginBottom: 20 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HistoryOutlined style={{ color: '#FB7299' }} />
          历史榜单
        </h2>
        <p>回顾过去每天的排行榜快照 · 追踪视频排名变化</p>
      </div>

      <div className="section-card">
        <div className="section-header">
          <div className="section-title">
            <HistoryOutlined style={{ color: '#FB7299' }} />
            {selectedDate} 榜单
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
              共 <span style={{ color: '#FB7299', fontWeight: 600 }}>{total}</span> 个视频
            </span>
          </div>
          <Select
            value={selectedDate}
            onChange={(v) => { setSelectedDate(v); setPage(1) }}
            options={dates.map((d) => ({ label: d, value: d }))}
            style={{ width: 160 }}
            showSearch
            optionFilterProp="label"
          />
        </div>

        <Spin spinning={loading}>
          {data.length === 0 && !loading ? (
            <div style={{ padding: '60px 0' }}><Empty description={`${selectedDate} 暂无数据`} /></div>
          ) : (
            <Table<VideoStat>
              rowKey="bvid"
              columns={columns}
              dataSource={data}
              pagination={{
                current: page, pageSize, total,
                showSizeChanger: true, showQuickJumper: true,
                pageSizeOptions: ['10', '20', '50'],
                showTotal: (t) => `共 ${t} 条`,
              }}
              onChange={(p) => { setPage(p.current ?? 1); setPageSize(p.pageSize ?? 20) }}
              size="middle"
            />
          )}
        </Spin>
      </div>
    </div>
  )
}

export default HistoryRanking

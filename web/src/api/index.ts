import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
})

export interface ApiResponse<T> {
  code: number
  data: T
  message: string
}

async function request<T>(url: string, params?: Record<string, string | number>): Promise<T> {
  const res = await api.get<ApiResponse<T>>(url, { params })
  if (res.data.code !== 0) {
    throw new Error(res.data.message)
  }
  return res.data.data
}

export interface OverviewData {
  total_videos: number
  total_uploaders: number
  total_views: number
}

export interface VideoStat {
  bvid: string
  title: string
  uploader_name: string
  partition_name: string
  view_count: number
  danmaku_count: number
  like_count: number
  coin_count: number
  favorite_count: number
  share_count: number
  reply_count: number
  rank_position: number | null
}

export interface PaginatedData<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface UploaderStat {
  uploader_mid: number
  uploader_name: string
  video_count: number
  total_views: number
  total_likes: number
  avg_views: number
  stat_date?: string
}

export const getOverview = (date?: string) =>
  request<OverviewData>('/dashboard/overview', date ? { date } : {})

export const getRanking = (params?: { partitionId?: number; page?: number; pageSize?: number; date?: string }) =>
  request<PaginatedData<VideoStat>>('/dashboard/ranking', params as Record<string, string | number>)

export const getVideoTrend = (bvid: string, start: string, end: string) =>
  request<VideoStat[]>('/trend/video/' + bvid, { start, end })

export const getRankingChange = (start: string, end: string, limit?: number) =>
  request<VideoStat[]>('/trend/ranking-change', { start, end, ...(limit ? { limit } : {}) })

export const getTopUploaders = (params?: { sortBy?: string; page?: number; pageSize?: number; date?: string }) =>
  request<PaginatedData<UploaderStat>>('/uploader/top', params as Record<string, string | number>)

export const getUploaderDetail = (mid: number, start: string, end: string) =>
  request<UploaderStat[]>('/uploader/' + mid + '/detail', { start, end })

export const getCategoryDistribution = (date?: string) =>
  request<Record<string, number>>('/category/distribution', date ? { date } : {})

export const getCategoryTrend = (id: number, start: string, end: string) =>
  request<Record<string, unknown>[]>('/category/' + id + '/trend', { start, end })

export const getPartitionList = () =>
  request<{ id: number; name: string }[]>('/category/partitions')

export const getHotTags = (date?: string, limit?: number) =>
  request<Record<string, number>>('/tags/hot', { ...(date ? { date } : {}), ...(limit ? { limit } : {}) })

export const getHotRanking = (params?: { start?: string; end?: string; partitionName?: string; page?: number; pageSize?: number }) =>
  request<PaginatedData<VideoStat>>('/hot/ranking', params as Record<string, string | number>)

export const syncData = async (): Promise<{ status: string; date: string }> => {
  const res = await api.post<{ status: string; date: string }>('/admin/sync')
  return res.data
}

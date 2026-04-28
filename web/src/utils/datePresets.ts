import dayjs, { type Dayjs } from 'dayjs'

export type PresetKey = '24h' | 'today' | 'yesterday' | '7d' | '30d'

export const presets: { key: PresetKey; label: string }[] = [
  { key: '24h', label: '最近24小时' },
  { key: 'today', label: '今天' },
  { key: 'yesterday', label: '昨天' },
  { key: '7d', label: '最近7天' },
  { key: '30d', label: '最近30天' },
]

export function presetToRange(key: PresetKey): [Dayjs, Dayjs] {
  const today = dayjs().startOf('day')
  switch (key) {
    case '24h': return [dayjs().subtract(24, 'hour'), dayjs()]
    case 'today': return [today, dayjs()]
    case 'yesterday': return [today.subtract(1, 'day'), today.subtract(1, 'day')]
    case '7d': return [today.subtract(6, 'day'), dayjs()]
    case '30d': return [today.subtract(30, 'day'), dayjs()]
  }
}

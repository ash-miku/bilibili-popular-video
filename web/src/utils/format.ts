export function formatCount(n: number): string {
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1).replace(/\.0$/, '') + '亿'
  if (n >= 10_000) return (n / 10_000).toFixed(1).replace(/\.0$/, '') + '万'
  return n.toLocaleString()
}

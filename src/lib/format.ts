export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatRelativeTime(timestamp: number, now: number): string {
  const diff = now - timestamp
  if (diff < 30 * 1000) return 'just now'
  if (diff < 60 * 1000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h ago`
  const days = Math.floor(diff / 86400000)
  if (days < 7) return `${days}d ago`
  const d = new Date(timestamp)
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
}

/* ─── pixel shadow helper ─── */
export const px = (color: string, d = 3) =>
  `${d}px ${d}px 0 ${color}`

/* ─── dither pattern (2×2 checkerboard as data URI) ─── */
export const ditherBg = (color: string, alpha: number) => {
  const hex = color.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `radial-gradient(circle, rgba(${r},${g},${b},${alpha}) 1px, transparent 1px)`
}

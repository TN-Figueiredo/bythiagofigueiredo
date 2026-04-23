export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  const date = new Date(iso)
  const now = new Date()
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  }
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

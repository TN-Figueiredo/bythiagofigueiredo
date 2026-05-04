const STORAGE_KEY = 'btf_read_progress'

type Entry = { d: number; t: number }
type StoreData = Record<string, Entry>

export interface ReadProgress {
  depth: number
  timestamp: number
}

export class ReadProgressStore {
  private read(): StoreData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return {}
      return JSON.parse(raw) as StoreData
    } catch {
      return {}
    }
  }

  private write(data: StoreData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // storage full or unavailable
    }
  }

  getProgress(resourceId: string): ReadProgress | null {
    const data = this.read()
    const entry = data[resourceId]
    if (!entry) return null
    return { depth: entry.d, timestamp: entry.t }
  }

  setProgress(resourceId: string, depth: number): void {
    const data = this.read()
    const existing = data[resourceId]
    if (existing && existing.d >= depth) return
    data[resourceId] = { d: depth, t: Math.floor(Date.now() / 1000) }
    this.write(data)
  }

  isRead(resourceId: string): boolean {
    const p = this.getProgress(resourceId)
    return p !== null && p.depth >= 95
  }

  getAllRead(): Map<string, ReadProgress> {
    const data = this.read()
    const map = new Map<string, ReadProgress>()
    for (const [id, entry] of Object.entries(data)) {
      map.set(id, { depth: entry.d, timestamp: entry.t })
    }
    return map
  }

  cleanup(maxAgeDays: number): void {
    const data = this.read()
    const cutoff = Math.floor(Date.now() / 1000) - maxAgeDays * 86400
    let changed = false
    for (const [id, entry] of Object.entries(data)) {
      if (entry.t < cutoff) {
        delete data[id]
        changed = true
      }
    }
    if (changed) this.write(data)
  }
}

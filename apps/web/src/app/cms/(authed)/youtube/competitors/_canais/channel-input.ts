/** Pure parsing of the "Canal do YouTube" field (shared by the Canais dialog and the add action). */
/** "@handle", youtube.com/@handle, youtube.com/channel/UC…, or a bare UC… id (the old search modal sends those). */
export function parseChannelInput(raw: string): { kind: 'id'; id: string } | { kind: 'handle'; handle: string } | null {
  const v = raw.trim()
  if (/^UC[\w-]{22}$/.test(v)) return { kind: 'id', id: v }
  const ch = /^https:\/\/(?:www\.|m\.)?youtube\.com\/channel\/(UC[\w-]{22})(?:[/?#].*)?$/.exec(v)
  if (ch) return { kind: 'id', id: ch[1]! }
  const h = /^(?:https:\/\/(?:www\.|m\.)?youtube\.com\/)?@([\w.-]{3,100})(?:[/?#].*)?$/.exec(v)
  if (h) return { kind: 'handle', handle: '@' + h[1]! }
  return null
}


import { isBot } from './bot-patterns'

export type DeviceType = 'mobile' | 'desktop' | 'tablet' | 'bot'

const TABLET_RE = /iPad|Android(?!.*Mobile)/i
const MOBILE_RE = /Mobile|Android|iPhone|iPod/i

export function classifyDevice(userAgent: string | null | undefined): DeviceType | null {
  if (!userAgent) return null
  if (isBot(userAgent)) return 'bot'
  if (TABLET_RE.test(userAgent)) return 'tablet'
  if (MOBILE_RE.test(userAgent)) return 'mobile'
  return 'desktop'
}

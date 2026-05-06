import type { DeviceInfo, DeviceType } from '../types.js'

/**
 * Regex-based device/browser/OS classifier from user-agent string.
 * Lightweight — no external dependency.
 */
export function classifyDevice(userAgent: string): DeviceInfo {
  if (!userAgent) {
    return { deviceType: 'unknown', browser: 'Unknown', os: 'Unknown' }
  }

  const deviceType = detectDeviceType(userAgent)
  const browser = detectBrowser(userAgent)
  const os = detectOs(userAgent)

  return { deviceType, browser, os }
}

function detectDeviceType(ua: string): DeviceType {
  // iPad check before general mobile check
  if (/iPad/i.test(ua)) return 'tablet'
  // Android without "Mobile" = tablet
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return 'tablet'
  // Mobile devices
  if (/Mobile|iPhone|iPod|Android.*Mobile|webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua)) {
    return 'mobile'
  }
  // If it has a common desktop OS indicator, it's desktop
  if (/Windows NT|Macintosh|Linux x86_64|X11/i.test(ua)) return 'desktop'
  return 'unknown'
}

function detectBrowser(ua: string): string {
  // Order matters: Edge contains "Chrome", Opera contains "Chrome"
  if (/Edg\//i.test(ua)) return 'Edge'
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return 'Opera'
  if (/Firefox\//i.test(ua)) return 'Firefox'
  if (/Chrome\//i.test(ua) && /Safari\//i.test(ua)) return 'Chrome'
  if (/Safari\//i.test(ua) && /Version\//i.test(ua)) return 'Safari'
  if (/MSIE|Trident/i.test(ua)) return 'IE'
  return 'Unknown'
}

function detectOs(ua: string): string {
  if (/iPad/i.test(ua)) return 'iPadOS'
  if (/iPhone|iPod/i.test(ua)) return 'iOS'
  if (/Android/i.test(ua)) return 'Android'
  if (/Windows NT/i.test(ua)) return 'Windows'
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS'
  if (/Linux/i.test(ua)) return 'Linux'
  if (/CrOS/i.test(ua)) return 'ChromeOS'
  return 'Unknown'
}

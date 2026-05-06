import type { GeoInfo } from '../types.js'

/**
 * Contract for IP → geo resolution.
 * Implementors may use Cloudflare headers, MaxMind, or any geo DB.
 */
export interface IGeoResolver {
  resolve(ip: string): Promise<GeoInfo | null>
}

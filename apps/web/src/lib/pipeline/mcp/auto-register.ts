/**
 * Maps API_REGISTRY endpoints to MCP tool names for coverage tracking.
 *
 * Each of the real endpoints (course domain has 0) maps to one of 22 MCP tools.
 * Tests use this to verify MCP covers all API endpoints.
 */

import { API_REGISTRY, type ApiEndpointMeta } from '../api-registry'

export interface RegistryMapping {
  /** MCP tool that handles this endpoint */
  mcpTool: string
  /** HTTP method */
  method: ApiEndpointMeta['method']
  /** API route path */
  path: string
  /** Original endpoint summary */
  summary: string
  /** Which capability domain this belongs to */
  domain: string
}

type ToolMatcher = (ep: ApiEndpointMeta) => boolean

/**
 * Ordered rules — first match wins.
 * Each rule maps a subset of endpoints to one MCP tool name.
 */
const TOOL_RULES: Array<{ tool: string; match: ToolMatcher }> = [
  // ── Items & Sections ──────────────────────────────────────────────
  {
    tool: 'publish_item',
    match: (ep) => ep.path.endsWith('/publish'),
  },
  {
    tool: 'graduate_item',
    match: (ep) => ep.path.endsWith('/graduate'),
  },
  {
    tool: 'advance_item',
    match: (ep) =>
      ep.path.endsWith('/advance') || ep.path.endsWith('/retreat'),
  },
  {
    tool: 'manage_sections',
    match: (ep) =>
      ep.path.includes('/sections/') ||
      ep.path.endsWith('/batch-sections'),
  },
  {
    tool: 'bulk_items',
    match: (ep) =>
      ep.path === '/api/pipeline/items/bulk' ||
      ep.path === '/api/pipeline/items/batch-sections',
  },
  {
    tool: 'delete_item',
    match: (ep) =>
      ep.method === 'DELETE' && ep.path === '/api/pipeline/items/:id',
  },
  {
    tool: 'create_item',
    match: (ep) =>
      ep.method === 'POST' && ep.path === '/api/pipeline/items',
  },
  {
    tool: 'update_item',
    match: (ep) =>
      ep.path.startsWith('/api/pipeline/items/:id') &&
      !ep.path.includes('/sections') &&
      !ep.path.endsWith('/advance') &&
      !ep.path.endsWith('/retreat') &&
      !ep.path.endsWith('/graduate') &&
      !ep.path.endsWith('/publish') &&
      !ep.path.endsWith('/bulk') &&
      (ep.method === 'PATCH' || ep.method === 'POST'),
  },

  // ── Playlists & Graph ─────────────────────────────────────────────
  {
    tool: 'manage_edges',
    match: (ep) => ep.path.includes('/edges'),
  },
  {
    tool: 'manage_playlist',
    match: (ep) => ep.path.startsWith('/api/pipeline/playlists'),
  },

  // ── Libraries ─────────────────────────────────────────────────────
  {
    tool: 'match_audio',
    match: (ep) => ep.path.endsWith('/resolve'),
  },
  {
    tool: 'manage_broll',
    match: (ep) => ep.path.startsWith('/api/pipeline/broll-library'),
  },
  {
    tool: 'manage_audio',
    match: (ep) => ep.path.startsWith('/api/pipeline/audio-library'),
  },

  // ── Research strategy layer (must precede the generic research rule) ─
  {
    tool: 'manage_focos',
    match: (ep) => ep.path.startsWith('/api/pipeline/research/focos'),
  },
  {
    tool: 'manage_decisions',
    match: (ep) => ep.path.startsWith('/api/pipeline/research/decisoes'),
  },

  // ── Research ──────────────────────────────────────────────────────
  {
    tool: 'manage_research',
    match: (ep) => ep.path.startsWith('/api/pipeline/research'),
  },

  // ── YouTube ───────────────────────────────────────────────────────
  {
    tool: 'youtube_observatory',
    match: (ep) => ep.path.includes('/competitors/'),
  },
  {
    tool: 'youtube_analytics',
    match: (ep) =>
      ep.path.includes('/analytics/') ||
      ep.path.includes('/youtube/intelligence'),
  },
  {
    tool: 'youtube_videos',
    match: (ep) =>
      ep.path.startsWith('/api/pipeline/youtube/videos') ||
      ep.path.startsWith('/api/pipeline/youtube/categories'),
  },
  {
    tool: 'manage_ab_test',
    match: (ep) =>
      ep.path.includes('/ab-test') ||
      ep.path.includes('/ab-performance') ||
      ep.path.includes('/thumbnails/'),
  },

  // ── Utilities ─────────────────────────────────────────────────────
  {
    tool: 'manage_upnext',
    match: (ep) =>
      ep.path === '/api/pipeline/up-next' && ep.method === 'POST',
  },
  {
    tool: 'search_content',
    match: (ep) =>
      ep.path.startsWith('/api/pipeline/search') ||
      ep.path.startsWith('/api/pipeline/context') ||
      ep.path.startsWith('/api/pipeline/stats') ||
      ep.path.startsWith('/api/pipeline/topics') ||
      ep.path.startsWith('/api/pipeline/workflows') ||
      ep.path.startsWith('/api/pipeline/docs') ||
      (ep.path === '/api/pipeline/up-next' && ep.method === 'GET') ||
      (ep.path === '/api/pipeline/items' && ep.method === 'GET') ||
      ep.path === '/api/pipeline/items/:id' ||
      ep.path === '/api/pipeline/items/:id/history',
  },
]

export function getRegistryCoverage(): {
  mapped: RegistryMapping[]
  unmapped: string[]
} {
  const mapped: RegistryMapping[] = []
  const unmapped: string[] = []

  for (const domain of API_REGISTRY.capabilities) {
    for (const ep of domain.endpoints) {
      const rule = TOOL_RULES.find((r) => r.match(ep))
      if (rule) {
        mapped.push({
          mcpTool: rule.tool,
          method: ep.method,
          path: ep.path,
          summary: ep.summary,
          domain: domain.domain,
        })
      } else {
        unmapped.push(`${ep.method} ${ep.path}`)
      }
    }
  }

  return { mapped, unmapped }
}

/** All 22 MCP tool names in the pipeline server */
export const MCP_TOOL_NAMES = [
  'create_item',
  'update_item',
  'advance_item',
  'manage_sections',
  'delete_item',
  'graduate_item',
  'publish_item',
  'bulk_items',
  'manage_playlist',
  'manage_edges',
  'manage_audio',
  'match_audio',
  'manage_broll',
  'manage_research',
  'manage_decisions',
  'manage_focos',
  'manage_ab_test',
  'search_content',
  'manage_upnext',
  'youtube_observatory',
  'youtube_analytics',
  'youtube_videos',
] as const

export type McpToolName = (typeof MCP_TOOL_NAMES)[number]

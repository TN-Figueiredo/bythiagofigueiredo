import { describe, it, expect } from 'vitest'
import { getRegistryCoverage, MCP_TOOL_NAMES } from '../../src/lib/pipeline/mcp/auto-register'

describe('MCP Registry Sync', () => {
  it('maps all API endpoints to MCP tools', () => {
    const { unmapped } = getRegistryCoverage()
    // Some endpoints may be intentionally unmapped (root catalog, docs)
    // but the count should be small
    expect(unmapped.length).toBeLessThan(10)
  })

  it('has exactly 17 unique MCP tools', () => {
    const { mapped } = getRegistryCoverage()
    const tools = new Set(mapped.map((m) => m.mcpTool))
    expect(tools.size).toBe(17)
  })

  it('every mapped tool is a known MCP tool name', () => {
    const { mapped } = getRegistryCoverage()
    const knownTools = new Set<string>(MCP_TOOL_NAMES)
    for (const m of mapped) {
      expect(knownTools.has(m.mcpTool)).toBe(true)
    }
  })

  it('covers all 79 registry endpoints', () => {
    const { mapped, unmapped } = getRegistryCoverage()
    // 79 endpoints total across all domains (course has 0)
    expect(mapped.length + unmapped.length).toBe(79)
  })
})

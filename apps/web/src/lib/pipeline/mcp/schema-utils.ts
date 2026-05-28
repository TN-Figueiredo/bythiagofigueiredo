import { zodToJsonSchema } from 'zod-to-json-schema'
import type { ZodObject, ZodRawShape } from 'zod'

/**
 * Converts a Zod schema to an MCP-compatible JSON Schema (2020-12 draft).
 *
 * - Strips the top-level `$schema` key (MCP transports add their own)
 * - Inlines all definitions (no `$ref` / `$defs`)
 * - Preserves `description` on enums so LLMs understand each value
 */
export function zodToMcpSchema(schema: ZodObject<ZodRawShape>): Record<string, unknown> {
  const raw = zodToJsonSchema(schema, {
    $refStrategy: 'none',
    target: 'jsonSchema2019-09',
  }) as Record<string, unknown>

  // Strip meta keys that MCP does not expect at the tool-input level
  delete raw.$schema
  delete raw.$defs
  delete raw.definitions

  return raw
}

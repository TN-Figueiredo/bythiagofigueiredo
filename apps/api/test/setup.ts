import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Load .env.local into process.env for tests (Vitest doesn't auto-load it).
const envPath = resolve(__dirname, '../.env.local')
try {
  const content = readFileSync(envPath, 'utf8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
} catch {
  // .env.local not present — rely on process.env + CI fallback defaults below
}

// CI fallback — src/env.ts validates at module-load time and requires
// SUPABASE_SERVICE_ROLE_KEY. Tests that transitively import src/* (server,
// plugins/auth, plugins/health) would crash in CI where no .env.local exists.
// Inject a clearly-placeholder value so the schema parse succeeds; real DB
// work is gated behind HAS_LOCAL_DB and uses its own client setup.
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'ci-placeholder-service-role-key'
}

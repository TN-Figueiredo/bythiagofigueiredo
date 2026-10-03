import '@testing-library/jest-dom'
import { expect, vi } from 'vitest'

// The observatório suites evaluate the whole mockup oracle (dados.cjs, ~200 KB) inside a vm. That costs ~0.4 s on a
// laptop and 3–5 s on the CI runner, right at the default 5 s per-test limit: four different tests timed out there on
// 2026-10-03 (5031–5330 ms) while passing locally. One limit for that directory instead of chasing each test.
if (expect.getState().testPath?.includes('/test/youtube/observatorio/')) vi.setConfig({ testTimeout: 20_000 })

// DB-gated integration runs (HAS_LOCAL_DB=1): app code under test resolves
// Supabase via process.env (e.g. lib/supabase/service.ts). Default the vars to
// the published local Supabase CLI constants so integration tests work both
// locally and in CI without per-file vi.stubEnv boilerplate. Explicit env
// always wins (CI/dev overrides are respected).
if (process.env.HAS_LOCAL_DB === '1') {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://127.0.0.1:54321'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??=
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
  process.env.SUPABASE_SERVICE_ROLE_KEY ??=
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
}

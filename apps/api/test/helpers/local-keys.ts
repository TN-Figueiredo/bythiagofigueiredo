// Shared constants for tests that talk to the local Supabase demo stack.
// All literals are the Supabase CLI published defaults for local dev — not secrets.
// Do NOT use in prod.
import jwt from 'jsonwebtoken'
import { getLocalJwtSecret } from './db-skip'

export const SUPABASE_URL = 'http://127.0.0.1:54321'
export const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
export const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
export const PG_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

export type AdminJwtRole = 'super_admin' | 'admin' | 'editor' | 'author'

export function adminJwt(opts?: { sub?: string; role?: AdminJwtRole }): string {
  const sub = opts?.sub ?? '00000000-0000-0000-0000-000000000001'
  const role: AdminJwtRole = opts?.role ?? 'super_admin'
  return jwt.sign(
    {
      role: 'authenticated',
      sub,
      app_metadata: { role },
    },
    getLocalJwtSecret(),
    { expiresIn: '1h' }
  )
}

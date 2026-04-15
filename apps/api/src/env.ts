import { z } from 'zod'

const envSchema = z.object({
  SUPABASE_URL: z.string().url().default('http://127.0.0.1:54321'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_ANON_KEY: z.string().default(''),
  WEB_URL: z.string().url().default('http://localhost:3001'),
  PORT: z.coerce.number().int().positive().default(3333),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
  throw new Error(`[env] invalid environment:\n${issues}`)
}

export const env = parsed.data

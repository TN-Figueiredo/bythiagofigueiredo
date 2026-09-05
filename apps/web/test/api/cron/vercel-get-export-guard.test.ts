import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const webRoot = process.cwd()

interface VercelCron {
  path: string
  schedule: string
}

function loadCrons(): VercelCron[] {
  const raw = readFileSync(join(webRoot, 'vercel.json'), 'utf-8')
  return JSON.parse(raw).crons as VercelCron[]
}

function routeFileFor(cronPath: string): string {
  const withoutQuery = cronPath.split('?')[0]!
  const relative = withoutQuery.replace(/^\/api\//, '')
  return join(webRoot, 'src/app/api', relative, 'route.ts')
}

function exportsGet(source: string): boolean {
  return (
    /export\s+(async\s+)?function\s+GET\s*\(/.test(source) ||
    /export\s+const\s+GET\s*[:=]/.test(source) ||
    /export\s*\{[^}]*\bas\s+GET\b[^}]*\}/.test(source)
  )
}

describe('Vercel cron GET export guard', () => {
  const crons = loadCrons()

  it('vercel.json tem ao menos uma entrada de cron', () => {
    expect(crons.length).toBeGreaterThan(0)
  })

  for (const cron of crons) {
    it(`existe route.ts para ${cron.path}`, () => {
      const file = routeFileFor(cron.path)
      expect(existsSync(file), `Falta route.ts para ${cron.path} (esperado em ${file})`).toBe(true)
    })

    it(`${cron.path} exporta GET (o cron da Vercel dispara GET)`, () => {
      const file = routeFileFor(cron.path)
      if (!existsSync(file)) return
      const source = readFileSync(file, 'utf-8')
      expect(
        exportsGet(source),
        `${cron.path} -> ${file} nao exporta GET; o cron da Vercel dispara GET e esta rota nunca vai rodar`,
      ).toBe(true)
    })
  }
})

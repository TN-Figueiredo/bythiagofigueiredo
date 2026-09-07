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

describe('Ratchet de agenda dos crons do Instagram (C2)', () => {
  const crons = loadCrons()

  function scheduleFor(path: string): string | undefined {
    return crons.find((c) => c.path === path)?.schedule
  }

  // Aceitar também o valor antigo deixaria passar VERDE um revert acidental de
  // vercel.json — a única linha que C2 edita — e o "≤ 24 h" do objetivo 2
  // viraria "≤ 7 dias" em silêncio. Por PATH, porque '0 11 * * *' já existe em
  // outra entrada (/api/cron/ab-backfill).
  it("instagram-token-refresh roda '0 11 * * *' (08:00 America/Sao_Paulo)", () => {
    expect(scheduleFor('/api/cron/instagram-token-refresh')).toBe('0 11 * * *')
  })

  it("instagram-sync roda '0 13 * * *' (10:00 America/Sao_Paulo)", () => {
    expect(scheduleFor('/api/cron/instagram-sync')).toBe('0 13 * * *')
  })

  it('nenhum dos dois ficou com a agenda antiga', () => {
    expect(scheduleFor('/api/cron/instagram-token-refresh')).not.toBe('0 6 * * 1')
    expect(scheduleFor('/api/cron/instagram-sync')).not.toBe('0 8 * * *')
  })
})

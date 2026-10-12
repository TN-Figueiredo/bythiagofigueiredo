// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { schemaReady } from '@/lib/youtube/competitor-health'

type Fail = { message: string; code?: string }
// o falso responde por tabela; `failing[t]` = erro do banco, `weird[t]` = a forma devolvida no lugar de { data, error }
const sbOf = (failing: Record<string, Fail> = {}, weird: Record<string, unknown> = {}, throws: Record<string, boolean> = {}) => {
  const asked: string[] = []
  return {
    asked,
    sb: {
      from: (t: string) => ({
        select: (cols: string) => ({
          limit: () => {
            asked.push(t + ': ' + cols)
            if (throws[t]) return Promise.reject(new Error('fetch failed'))
            if (t in weird) return Promise.resolve(weird[t])
            return Promise.resolve(failing[t] ? { data: null, error: failing[t] } : { data: [], error: null })
          },
        }),
      }),
    } as never,
  }
}
describe('schemaReady (a ordem migration → código não pode falhar em verde)', () => {
  it('tudo no lugar: null, e a guarda da E1 não pergunta por tabela da MG2', async () => {
    const e1 = sbOf()
    expect(await schemaReady(e1.sb, 'e1')).toBeNull()
    expect(e1.asked.some(a => a.includes('tier') || a.includes('early') || a.includes('weekly_pass_date'))).toBe(false)
    expect(await schemaReady(sbOf().sb, 'e1e2')).toBeNull()
  })
  it('coluna da MG1 ausente: o texto diz qual migration e o erro do banco', async () => {
    expect(await schemaReady(sbOf({ competitor_videos: { code: '42703', message: 'column competitor_videos.miss_streak does not exist' } }).sb, 'e1')).toMatch(/MG1.*miss_streak/)
  })
  it('MG1 aplicada e MG2 não: a guarda completa acusa a MG2; a da E1 passa', async () => {
    const half = { competitor_video_tier_spans: { code: 'PGRST205', message: 'relation does not exist' } }
    expect(await schemaReady(sbOf(half).sb, 'e1')).toBeNull()
    expect(await schemaReady(sbOf(half).sb, 'e1e2')).toMatch(/MG2/)
  })
  it('nenhuma das duas aplicada: a MG1 é acusada primeiro, nas duas guardas, e nada além da primeira falta é perguntado', async () => {
    const none = () => sbOf({
      competitor_videos: { code: '42703', message: 'column competitor_videos.discovered_at does not exist' },
      competitor_channels: { code: '42703', message: 'column does not exist' },
      competitor_field_versions: { code: '42P01', message: 'relation does not exist' },
      competitor_raw: { code: '42P01', message: 'relation does not exist' },
      competitor_video_tier_spans: { code: '42P01', message: 'relation does not exist' },
    })
    const a = none()
    expect(await schemaReady(a.sb, 'e1')).toMatch(/MG1.*competitor_videos/)
    expect(a.asked).toHaveLength(1)
    expect(await schemaReady(none().sb, 'e1e2')).toMatch(/MG1/)
  })
  it('cada código de "coluna ou tabela que não existe" diz "migration … não aplicada"; erro sem código (rede) diz "não foi possível conferir o schema"', async () => {
    for (const code of ['42703', '42P01', 'PGRST204', 'PGRST205']) {
      expect(await schemaReady(sbOf({ competitor_raw: { code, message: 'x' } }).sb, 'e1')).toMatch(/^migration MG1 não aplicada \(competitor_raw\)/)
    }
    const net = await schemaReady(sbOf({ competitor_videos: { message: 'fetch failed' } }).sb, 'e1')
    expect(net).toMatch(/^não foi possível conferir o schema \(competitor_videos\): fetch failed/)
    expect(net).not.toMatch(/migration/)
  })
  describe('a PRÓPRIA leitura da guarda falha: nunca "pronto"', () => {
    it('a consulta lança (rede, timeout)', async () => {
      const r = await schemaReady(sbOf({}, {}, { competitor_videos: true }).sb, 'e1')
      expect(r).toMatch(/^não foi possível conferir o schema \(competitor_videos\): fetch failed/)
    })
    it('o banco devolve nulo no lugar do resultado', async () => {
      expect(await schemaReady(sbOf({}, { competitor_videos: null }).sb, 'e1')).toMatch(/não foi possível conferir o schema \(competitor_videos\)/)
      expect(await schemaReady(sbOf({}, { competitor_channels: undefined }).sb, 'e1e2')).toMatch(/não foi possível conferir o schema \(competitor_channels\)/)
    })
    it('sem erro mas sem a lista de linhas (data nulo, objeto, texto): não é "pronto"', async () => {
      for (const odd of [{ data: null, error: null }, { data: {}, error: null }, { data: 'ok', error: null }, {}]) {
        expect(await schemaReady(sbOf({}, { competitor_raw: odd }).sb, 'e1')).toMatch(/não foi possível conferir o schema \(competitor_raw\)/)
      }
    })
    it('a falha aparece também na MG2 (guarda completa)', async () => {
      expect(await schemaReady(sbOf({}, { competitor_video_early: { data: null, error: null } }).sb, 'e1e2')).toMatch(/não foi possível conferir o schema \(competitor_video_early\)/)
      expect(await schemaReady(sbOf({}, { competitor_video_early: { data: null, error: null } }).sb, 'e1')).toBeNull() // a da E1 não pergunta
    })
  })
})

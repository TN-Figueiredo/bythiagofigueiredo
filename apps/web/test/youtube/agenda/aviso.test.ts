// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const captureMessage = vi.fn()
const captureException = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => captureMessage(...a), captureException: (...a: unknown[]) => captureException(...a) }))

const createNotification = vi.fn()
vi.mock('@/lib/notifications/create', () => ({ createNotification: (...a: unknown[]) => createNotification(...a) }))

const getSiteOwners = vi.fn()
const logSemDestinatario = vi.fn()
vi.mock('@/lib/notifications/get-site-owners', () => ({
  getSiteOwners: (...a: unknown[]) => getSiteOwners(...a),
  logSemDestinatario: (...a: unknown[]) => logSemDestinatario(...a),
}))

import { avisarDono, type Aviso } from '@/lib/youtube/agenda/aviso'
import { link } from '@/lib/youtube/observatorio/links'

const NOW = Date.UTC(2026, 0, 15, 15, 0, 0) // 15 jan 2026, 12:00 em São Paulo (passado)
const S1 = '11111111-1111-4111-8111-111111111111'
const S2 = '22222222-2222-4222-8222-222222222222'
const aviso = (over: Partial<Aviso> = {}): Aviso => ({ siteId: S1, chave: 'leitura_horaria_parada', tarefa: 'Leitura horária', frase: 'Leitura horária: 3 horas seguidas sem ler nenhum vídeo', ...over })
const dono = (n: number) => ({ userId: `u${n}`, email: null })

/** O banco falso: `notifications.select('dedup_key').in('dedup_key', chaves)` devolve as linhas de `existentes` que estão nas chaves. */
function banco(existentes: string[] = [], opts: { falha?: boolean } = {}) {
  const idas: string[][] = []
  const sb = {
    from: vi.fn((tabela: string) => ({
      select: () => ({
        in: (_col: string, chaves: string[]) => {
          idas.push([tabela, ...chaves])
          if (opts.falha) return Promise.reject(new Error('banco caiu'))
          return Promise.resolve({ data: existentes.filter(k => chaves.includes(k)).map(dedup_key => ({ dedup_key })), error: null })
        },
      }),
    })),
  }
  return { sb: sb as unknown as SupabaseClient, idas, from: sb.from }
}
const O = { agoraMs: NOW, prazoMs: 5_000 }

beforeEach(() => {
  createNotification.mockReset().mockResolvedValue({ success: true, notificationId: 'n' })
  getSiteOwners.mockReset().mockResolvedValue([dono(1)])
  logSemDestinatario.mockReset()
  captureMessage.mockReset()
  captureException.mockReset()
  delete process.env.COMPETITOR_NOTIFICATIONS_ENABLED
})
afterEach(() => { vi.useRealTimers(); delete process.env.COMPETITOR_NOTIFICATIONS_ENABLED })

describe('avisarDono', () => {
  it('um aviso, um dono: um e-mail com defaultChannels email', async () => {
    const { sb } = banco()
    const r = await avisarDono(sb, [aviso()], O)
    expect(r).toEqual({ enviados: 1, suprimidos: 0, falharam: 0, semDestinatario: 0 })
    expect(createNotification).toHaveBeenCalledTimes(1)
    const arg = createNotification.mock.calls[0]![0]
    expect(arg.defaultChannels).toEqual(['email'])
    expect(arg.dedup_key).toBe(`obs-agenda-leitura_horaria_parada-Leitura horária-${S1}-2026-01-15`)
    expect(arg).toMatchObject({ site_id: S1, user_id: 'u1', type: 'youtube.observatorio_coleta', domain: 'youtube', priority: 3 })
    expect(arg.title).toBe('A leitura horária do Observatório parou')
    expect(arg.message).toContain('As horas sem leitura não são recuperadas')
    expect(arg.action_href).toBe(link.canais())
    expect(arg.message).toContain(link.canais())
  })

  it('o mesmo aviso no disparo seguinte não repete', async () => {
    const { sb } = banco([`obs-agenda-leitura_horaria_parada-Leitura horária-${S1}-2026-01-15`])
    const r = await avisarDono(sb, [aviso()], { agoraMs: NOW + 20 * 60_000, prazoMs: 5_000 })
    expect(createNotification).not.toHaveBeenCalled()
    expect(r).toEqual({ enviados: 0, suprimidos: 1, falharam: 0, semDestinatario: 0 })
  })

  it('o mesmo problema em 3 disparos seguidos do mesmo período: um e-mail só', async () => {
    const criadas = new Set<string>()
    createNotification.mockImplementation(async (i: { dedup_key: string }) => { criadas.add(i.dedup_key); return { success: true } })
    const sb = {
      from: () => ({ select: () => ({ in: (_c: string, chaves: string[]) => Promise.resolve({ data: chaves.filter(k => criadas.has(k)).map(dedup_key => ({ dedup_key })), error: null }) }) }),
    } as unknown as SupabaseClient
    const a = [aviso({ chave: 'tarefa_esgotada', tarefa: 'Comparações' })]
    const r1 = await avisarDono(sb, a, { agoraMs: NOW, prazoMs: 5_000 })
    const r2 = await avisarDono(sb, a, { agoraMs: NOW + 20 * 60_000, prazoMs: 5_000 })
    const r3 = await avisarDono(sb, a, { agoraMs: NOW + 40 * 60_000, prazoMs: 5_000 })
    expect([r1.enviados, r2.enviados, r3.enviados]).toEqual([1, 0, 0])
    expect([r2.suprimidos, r3.suprimidos]).toEqual([1, 1])
    expect(createNotification).toHaveBeenCalledTimes(1)
  })

  it('no dia seguinte avisa de novo', async () => {
    const { sb } = banco([`obs-agenda-leitura_horaria_parada-Leitura horária-${S1}-2026-01-15`])
    const r = await avisarDono(sb, [aviso()], { agoraMs: NOW + 24 * 3_600_000, prazoMs: 5_000 })
    expect(r.enviados).toBe(1)
    expect(createNotification.mock.calls[0]![0].dedup_key).toMatch(/2026-01-16$/)
  })

  it('a virada do dia é a de São Paulo', async () => {
    const { sb } = banco()
    await avisarDono(sb, [aviso()], { agoraMs: Date.UTC(2026, 0, 15, 2, 59, 0), prazoMs: 5_000 })
    await avisarDono(sb, [aviso()], { agoraMs: Date.UTC(2026, 0, 15, 3, 1, 0), prazoMs: 5_000 })
    const chaves = createNotification.mock.calls.map(c => c[0].dedup_key as string)
    expect(chaves[0]).toMatch(/2026-01-14$/)
    expect(chaves[1]).toMatch(/2026-01-15$/)
  })

  it('dois sites, dois donos cada', async () => {
    getSiteOwners.mockResolvedValue([dono(1), dono(2)])
    const { sb } = banco()
    const r = await avisarDono(sb, [aviso({ siteId: S1 }), aviso({ siteId: S2 })], O)
    expect(r.enviados).toBe(4)
    expect(createNotification).toHaveBeenCalledTimes(4)
  })

  it('dois sites com a mesma tarefa e o mesmo dia não se suprimem', async () => {
    const chaveS1 = `obs-agenda-leitura_horaria_parada-Leitura horária-${S1}-2026-01-15`
    const { sb } = banco([chaveS1])
    const r = await avisarDono(sb, [aviso({ siteId: S1 }), aviso({ siteId: S2 })], O)
    expect(r).toMatchObject({ enviados: 1, suprimidos: 1 })
    expect(createNotification).toHaveBeenCalledTimes(1)
    expect(createNotification.mock.calls[0]![0].site_id).toBe(S2)
    expect(createNotification.mock.calls[0]![0].dedup_key).toContain(S2)
  })

  it('site sem dono', async () => {
    getSiteOwners.mockResolvedValue([])
    const { sb } = banco()
    const r = await avisarDono(sb, [aviso()], O)
    expect(r).toEqual({ enviados: 0, suprimidos: 0, falharam: 0, semDestinatario: 1 })
    expect(logSemDestinatario).toHaveBeenCalledTimes(1)
    expect(createNotification).not.toHaveBeenCalled()
  })

  it('createNotification falha ou lança: conta, avisa o Sentry, não tenta de novo e não lança', async () => {
    getSiteOwners.mockResolvedValue([dono(1), dono(2)])
    createNotification.mockResolvedValueOnce({ success: false, error: 'rate limit exceeded' }).mockRejectedValueOnce(new Error('rede'))
    const { sb } = banco()
    const r = await avisarDono(sb, [aviso()], O)
    expect(r).toEqual({ enviados: 0, suprimidos: 0, falharam: 2, semDestinatario: 0 })
    expect(createNotification).toHaveBeenCalledTimes(2) // sem laço de nova tentativa
    expect(captureMessage.mock.calls.length + captureException.mock.calls.length).toBe(2)
    expect(captureMessage.mock.calls[0]![1]).toMatchObject({ level: 'warning' })
  })

  it('a falha de uma notificação não impede a seguinte', async () => {
    getSiteOwners.mockResolvedValue([dono(1), dono(2)])
    createNotification.mockResolvedValueOnce({ success: false, error: 'x' })
    const { sb } = banco()
    const r = await avisarDono(sb, [aviso()], O)
    expect(r).toMatchObject({ enviados: 1, falharam: 1 })
  })

  it('a consulta prévia falha: tenta criar assim mesmo (o índice único repete a trava)', async () => {
    const { sb } = banco([], { falha: true })
    const r = await avisarDono(sb, [aviso()], O)
    expect(r.enviados).toBe(1)
  })

  it('suppressed devolvido pelo createNotification conta como suprimido, não como enviado', async () => {
    createNotification.mockResolvedValue({ success: true, suppressed: true })
    const { sb } = banco()
    const r = await avisarDono(sb, [aviso()], O)
    expect(r).toMatchObject({ enviados: 0, suprimidos: 1 })
  })

  it('passou do prazo: resolve no prazo, avisa o Sentry e não lança', async () => {
    vi.useFakeTimers()
    getSiteOwners.mockReturnValue(new Promise(() => undefined))
    const { sb } = banco()
    const p = avisarDono(sb, [aviso()], { agoraMs: NOW, prazoMs: 3_000 })
    await vi.advanceTimersByTimeAsync(3_001)
    await expect(p).resolves.toEqual({ enviados: 0, suprimidos: 0, falharam: 0, semDestinatario: 0 })
    expect(captureMessage).toHaveBeenCalledWith('aviso ao dono passou do tempo', expect.objectContaining({ level: 'warning' }))
  })

  it('passou do prazo no meio: devolve o que já contou', async () => {
    vi.useFakeTimers()
    getSiteOwners.mockResolvedValueOnce([dono(1)]).mockReturnValueOnce(new Promise(() => undefined))
    const { sb } = banco()
    const p = avisarDono(sb, [aviso({ siteId: S1 }), aviso({ siteId: S2 })], { agoraMs: NOW, prazoMs: 3_000 })
    await vi.advanceTimersByTimeAsync(3_001)
    await expect(p).resolves.toMatchObject({ enviados: 1 })
  })

  it('prazo zero: não lança e não envia', async () => {
    const { sb } = banco()
    const r = await avisarDono(sb, [aviso()], { agoraMs: NOW, prazoMs: 0 })
    expect(r.enviados).toBe(0)
  })

  it('sem aviso, nada é consultado', async () => {
    const { sb, from } = banco()
    const r = await avisarDono(sb, [], O)
    expect(r).toEqual({ enviados: 0, suprimidos: 0, falharam: 0, semDestinatario: 0 })
    expect(from).not.toHaveBeenCalled()
    expect(getSiteOwners).not.toHaveBeenCalled()
    expect(createNotification).not.toHaveBeenCalled()
  })

  it('COMPETITOR_NOTIFICATIONS_ENABLED=false NÃO suprime o aviso: ele só desliga troca de título/miniatura, alarme sempre sai', async () => {
    const { sb } = banco()
    delete process.env.COMPETITOR_NOTIFICATIONS_ENABLED
    expect((await avisarDono(sb, [aviso()], O)).enviados).toBe(1)
    process.env.COMPETITOR_NOTIFICATIONS_ENABLED = 'false'
    createNotification.mockClear()
    const r = await avisarDono(sb, [aviso({ chave: 'tarefa_esgotada', tarefa: 'Comparações', frase: 'Comparações: sem tempo' }), aviso()], O)
    expect(createNotification).toHaveBeenCalledTimes(2)
    expect(r).toMatchObject({ enviados: 2, suprimidos: 0, falharam: 0 })
  })

  it('o texto só tem frase fixa, rótulo e número', async () => {
    const { sb } = banco()
    await avisarDono(sb, [aviso({ tarefa: 'Comparações', chave: 'tarefa_esgotada', frase: 'Comparações: não coube no disparo' }), aviso()], O)
    for (const c of createNotification.mock.calls) {
      const { title, message } = c[0] as { title: string; message: string }
      for (const t of [title, message]) {
        expect(t).not.toMatch(/[{}]/)
        expect(t).not.toContain('undefined')
        expect(t).not.toContain('null')
      }
    }
    const [esgotada, parada] = createNotification.mock.calls.map(c => c[0] as { title: string; message: string })
    expect(esgotada!.title).toBe('A tarefa Comparações do Observatório esgotou as tentativas')
    expect(esgotada!.message).toContain('Comparações: não coube no disparo')
    expect(parada!.message).toContain('Leitura horária')
  })

  it('texto de fora no rótulo e na frase é limpo de controles e cortado', async () => {
    const { sb } = banco()
    await avisarDono(sb, [aviso({ chave: 'tarefa_esgotada', tarefa: 'X\r\nBcc: a@b.c' + 'y'.repeat(500), frase: 'F\n' + 'z'.repeat(900) })], O)
    const { title, message } = createNotification.mock.calls[0]![0] as { title: string; message: string }
    expect(title).not.toMatch(/[\r\n]/)
    expect(title.length).toBeLessThanOrEqual(200)
    expect(message.length).toBeLessThanOrEqual(1_000)
    expect(message).toContain('…')
  })

  it('frase que já termina em ponto não ganha ponto duplo', async () => {
    const { sb } = banco()
    await avisarDono(sb, [aviso({ frase: 'Leitura horária: parou.' })], O)
    expect((createNotification.mock.calls[0]![0] as { message: string }).message).not.toContain('..')
  })

  it('nunca lança, nem com getSiteOwners lançando', async () => {
    getSiteOwners.mockRejectedValue(new Error('segredo-do-banco'))
    const { sb } = banco()
    const r = await avisarDono(sb, [aviso()], O)
    expect(r.falharam).toBe(1)
    const vistos = JSON.stringify([...captureMessage.mock.calls, ...captureException.mock.calls.map(c => [String((c[0] as Error).name)])])
    expect(vistos).not.toContain('segredo-do-banco')
  })
})

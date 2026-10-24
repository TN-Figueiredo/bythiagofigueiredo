// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { hrefDoAviso, dedupDoResumo, enviarAvisosDoNicho, fraseDeFalhas, planejarAvisos, type PendenteAviso } from '@/lib/youtube/observatorio/sinais/avisos'
import { rodarAvisos } from '@/lib/youtube/agenda/tarefas/avisos-pendentes'
import { REGRA_SINAIS } from '@/lib/youtube/observatorio/sinais/regra'
import type { ContextoTarefa } from '@/lib/youtube/agenda/tipos'
import { roteiro, ok } from '../../../helpers/banco-roteirizado'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))

const p = (n: number, forca: number, como: PendenteAviso['notificar_como'] = 'individual'): PendenteAviso => ({ id: `id-${String(n).padStart(2, '0')}`, forca, notificar_como: como, notificacao_tentativas: 0 })

describe('hrefDoAviso', () => {
  it('codifica os dois-pontos e leva de=sino', () => {
    expect(hrefDoAviso('nicho-resumo:2026-10-23:abc')).toBe('/cms/youtube/competitors/sugestoes?de=sino&aviso=nicho-resumo%3A2026-10-23%3Aabc')
  })
})

describe('planejarAvisos', () => {
  it('8 individuais e teto 5: os 5 de maior força vão um a um e os 3 restantes no resumo', () => {
    const lista = Array.from({ length: 8 }, (_, i) => p(i, 10 + i))
    const r = planejarAvisos(lista, 0, 5)
    expect(r.individuais).toEqual(['id-07', 'id-06', 'id-05', 'id-04', 'id-03'])
    expect(r.resumo.sort()).toEqual(['id-00', 'id-01', 'id-02'])
  })
  it('2 já enviados hoje: 3 individuais e 5 no resumo', () => {
    const r = planejarAvisos(Array.from({ length: 8 }, (_, i) => p(i, 10 + i)), 2, 5)
    expect(r.individuais).toHaveLength(3)
    expect(r.resumo).toHaveLength(5)
  })
  it('teto já estourado (ou passado): nenhum individual, tudo no resumo', () => {
    expect(planejarAvisos([p(1, 5), p(2, 6)], 7, 5)).toEqual({ individuais: [], resumo: ['id-01', 'id-02'] })
  })
  it('linha de base: 20 resumo → 0 individuais e 1 resumo com 20 ids', () => {
    const r = planejarAvisos(Array.from({ length: 20 }, (_, i) => p(i, 50, 'resumo')), 0, 5)
    expect(r.individuais).toEqual([])
    expect(r.resumo).toHaveLength(20)
  })
  it('quem é resumo (parecido) nunca entra em individuais, mesmo com a maior força', () => {
    const r = planejarAvisos([p(1, 99, 'resumo'), p(2, 1)], 0, 5)
    expect(r.individuais).toEqual(['id-02'])
    expect(r.resumo).toEqual(['id-01'])
  })
  it('empate de força desempata por id (estável)', () => {
    expect(planejarAvisos([p(2, 5), p(1, 5)], 0, 1).individuais).toEqual(['id-01'])
  })
})

describe('dedupDoResumo e frase de falhas', () => {
  const dia = new Date('2026-10-22T15:00:00.000Z')
  it('mesmo conjunto (em qualquer ordem) no mesmo dia SP dá a mesma chave; conjunto diferente, outra', () => {
    expect(dedupDoResumo(dia, ['b', 'a'])).toBe(dedupDoResumo(dia, ['a', 'b']))
    expect(dedupDoResumo(dia, ['a', 'b'])).not.toBe(dedupDoResumo(dia, ['a', 'c']))
    expect(dedupDoResumo(dia, ['a'])).toMatch(/^nicho-resumo:2026-10-22:[0-9a-f]{12}$/)
  })
  it('00:30 UTC ainda é o dia anterior em São Paulo', () => {
    expect(dedupDoResumo(new Date('2026-10-23T00:30:00.000Z'), ['a'])).toContain(':2026-10-22:')
  })
  it('frase: singular, plural e nada', () => {
    expect(fraseDeFalhas(0)).toBeNull()
    expect(fraseDeFalhas(1)).toBe('1 sugestão do nicho não chegou ao sino')
    expect(fraseDeFalhas(3)).toBe('3 sugestões do nicho não chegaram ao sino')
  })
  it('o teto vem da regra versionada', () => {
    expect(REGRA_SINAIS.tetoNotificacoesDia).toBe(5)
    expect(REGRA_SINAIS.tetoTentativas).toBe(3)
  })
})

describe('rodarAvisos + nicho', () => {
  const AGORA = Date.parse('2026-12-20T12:00:00.000Z')
  const ctx = (sb: ContextoTarefa['sb'], em: number = AGORA): ContextoTarefa => ({ t0: em, agora: () => em, apiKey: '', sb, linhas: null })
  const dia14 = new Date(AGORA - 14 * 86_400_000).toISOString()
  const linha = { id: 'r1', site_id: 's1', youtube_video_id: 'abcdefghijk', estado: 'em_andamento', primeira_vista: dia14, confirmado_em: dia14, created_at: dia14, resposta_dono: null, lembrete_notificado_em: null, notificacao_falhou_em: null, notificacao_tentativas: 0, updated_at: dia14 }
  const fanOk = { total: 1, sent: 1, suppressed: 0, errors: [] as string[] }

  it('erro forçado no nicho: o lembrete do dia 14 sai mesmo assim e a tarefa fica erro com nicho_falhou', async () => {
    const fan = vi.fn().mockResolvedValue(fanOk)
    const nicho = vi.fn().mockRejectedValue(new Error('x'))
    const r = roteiro({ ab_native_tests: [ok([]), ok([linha]), ok([{ id: 'r1' }])], niche_signals: [ok(null)] })
    const out = await rodarAvisos(ctx(r.sb), { fanOut: fan, nicho })
    expect(fan).toHaveBeenCalledTimes(1)
    expect(nicho).toHaveBeenCalledTimes(1)
    expect(out).toMatchObject({ estado: 'erro', motivo: 'nicho_falhou', detalhe: { lembrados: 1, nicho_enviados: 0, nicho_resumidos: 0, nicho_falhas: 0 } })
  })
  it('o nicho roda mesmo com o schema do nativo ausente (nenhuma saída antecipada o pula)', async () => {
    const nicho = vi.fn().mockResolvedValue({ enviados: 0, resumidos: 0, falhas: 0, sem_tempo: 0, adiados: 0 })
    const r = roteiro({ ab_native_tests: [{ data: null, error: { message: 'x', code: '42703' } }], niche_signals: [ok(null)] })
    const out = await rodarAvisos(ctx(r.sb), { nicho })
    expect(nicho).toHaveBeenCalledTimes(1)
    expect(out).toMatchObject({ estado: 'parcial', motivo: 'schema_ausente' })
  })
  it('nicho com falha de 3ª tentativa: erro nicho_falhou; contadores no detalhe', async () => {
    const nicho = vi.fn().mockResolvedValue({ enviados: 2, resumidos: 3, falhas: 1, sem_tempo: 0, adiados: 0 })
    const r = roteiro({ ab_native_tests: [ok([]), ok([])], niche_signals: [{ data: null, error: null }] })
    const out = await rodarAvisos(ctx(r.sb), { nicho })
    expect(out).toMatchObject({ estado: 'erro', motivo: 'nicho_falhou', detalhe: { nicho_enviados: 2, nicho_resumidos: 3, nicho_falhas: 1 } })
  })
  it('nicho com aviso adiado (falhou, ainda tem tentativa): erro nicho_adiado já na 1ª, sem desfazer o lembrete do dia 14', async () => {
    const fan = vi.fn().mockResolvedValue(fanOk)
    const nicho = vi.fn().mockResolvedValue({ enviados: 0, resumidos: 0, falhas: 0, sem_tempo: 0, adiados: 2 })
    const r = roteiro({ ab_native_tests: [ok([]), ok([linha]), ok([{ id: 'r1' }])], niche_signals: [{ data: null, error: null }] })
    const out = await rodarAvisos(ctx(r.sb), { fanOut: fan, nicho })
    expect(fan).toHaveBeenCalledTimes(1)
    expect(out).toMatchObject({ estado: 'erro', motivo: 'nicho_adiado', detalhe: { lembrados: 1, nicho_adiados: 2 } })
  })
  it('lembrete_desistiu do nativo não é trocado pelo nicho', async () => {
    const nicho = vi.fn().mockRejectedValue(new Error('x'))
    const fan = vi.fn().mockResolvedValue({ total: 0, sent: 0, suppressed: 0, errors: [] })
    const r = roteiro({ ab_native_tests: [ok([]), ok([{ ...linha, notificacao_tentativas: 2 }]), ok([{ id: 'r1' }])], niche_signals: [ok(null)] })
    expect(await rodarAvisos(ctx(r.sb, AGORA + 2 * 86_400_000), { fanOut: fan, nicho })).toMatchObject({ estado: 'erro', motivo: 'lembrete_desistiu' })
  })

  it('erro do nicho não apaga o sobrou do nativo: motivo combinado', async () => {
    const agoraIso = new Date(AGORA).toISOString()
    const muitas = Array.from({ length: 500 }, (_, i) => ({ ...linha, id: 'r' + i, primeira_vista: agoraIso, confirmado_em: agoraIso, created_at: agoraIso }))
    const r = roteiro({ ab_native_tests: [ok([]), ok(muitas)], niche_signals: [ok(null)] })
    const out = await rodarAvisos(ctx(r.sb), { nicho: vi.fn().mockRejectedValue(new Error('x')) })
    expect(out).toMatchObject({ estado: 'erro', motivo: 'sobrou_e_nicho_falhou', detalhe: { no_teto: 1 } })
  })
  it('prazo acabado no nicho: parcial com nicho_sem_tempo (nunca ok silencioso) e o número no detalhe', async () => {
    const nicho = vi.fn().mockResolvedValue({ enviados: 1, resumidos: 0, falhas: 0, sem_tempo: 2, adiados: 0 })
    const r = roteiro({ ab_native_tests: [ok([]), ok([])], niche_signals: [ok(null)] })
    const out = await rodarAvisos(ctx(r.sb), { nicho })
    expect(out).toMatchObject({ estado: 'parcial', motivo: 'nicho_sem_tempo', detalhe: { nicho_sem_tempo: 2 } })
  })
  it('o nicho recebe o relógio da tarefa: passa a ser "sem tempo" depois de t0 + 83 s', async () => {
    let semTempo: (() => boolean) | null = null
    const nicho = vi.fn(async (_sb: unknown, _a: Date, st: () => boolean) => { semTempo = st; return { enviados: 0, resumidos: 0, falhas: 0, sem_tempo: 0, adiados: 0 } })
    let agora = AGORA
    const r = roteiro({ ab_native_tests: [ok([]), ok([])], niche_signals: [ok(null)] })
    await rodarAvisos({ t0: AGORA, agora: () => agora, apiKey: '', sb: r.sb, linhas: null }, { nicho })
    expect(semTempo!()).toBe(false)
    agora = AGORA + 83_000
    expect(semTempo!()).toBe(true)
  })
})

describe('enviarAvisosDoNicho: prazo e escopo', () => {
  const sbVazio = () => roteiro({ 'rpc:niche_signals_expirar': [ok(0), ok(0)], niche_signals: [ok([]), ok([])] })
  it('sem tempo desde o início: nenhum site visitado, contador sem_tempo = nº de sites, nenhuma chamada ao banco', async () => {
    const r = sbVazio()
    const out = await enviarAvisosDoNicho(r.sb, new Date(), { sites: ['a', 'b'], semTempo: () => true })
    expect(out).toEqual({ enviados: 0, resumidos: 0, falhas: 0, sem_tempo: 2, adiados: 0 })
    expect(r.chamadas).toHaveLength(0)
  })
  it('o prazo acaba entre sites: o 1º é visitado, o 2º fica de fora e é contado', async () => {
    const r = sbVazio()
    let n = 0
    const out = await enviarAvisosDoNicho(r.sb, new Date(), { sites: ['a', 'b'], semTempo: () => n++ >= 1 })
    expect(out.sem_tempo).toBe(1)
    expect(r.chamadas.filter((c) => c.alvo === 'rpc:niche_signals_expirar')).toHaveLength(1)
  })
  it('sites informados: só eles são visitados e a lista de sites não é lida', async () => {
    const r = sbVazio()
    await enviarAvisosDoNicho(r.sb, new Date(), { sites: ['a'] })
    expect(r.chamadas.some((c) => c.alvo === 'competitor_channels')).toBe(false)
    expect(r.chamadas.filter((c) => c.alvo === 'rpc:niche_signals_expirar')).toHaveLength(1)
  })
})

describe('enviarAvisosDoNicho: falha transitória, blocos e sino', () => {
  const AGORA = new Date('2026-12-20T12:00:00.000Z')
  const pend = (n: number, tentativas = 0) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, kind: 'destino', forca: 10, notificar_como: 'resumo', notificacao_tentativas: tentativas }))
  const metodosIn = (chamadas: Array<{ alvo: string; metodos: string[] }>): number[] =>
    chamadas.filter((c) => c.alvo === 'niche_signals').flatMap((c) => c.metodos).filter((m) => m.startsWith('in("id"')).map((m) => (JSON.parse(m.slice('in("id",'.length, -1)) as string[]).length)

  it('sem admin (fan-out total 0) na 1ª: falhas 0, adiados 1, tentativa 1 gravada e notificado_em intocado', async () => {
    const fan = vi.fn().mockResolvedValue({ total: 0, sent: 0, suppressed: 0, errors: [] })
    const r = roteiro({
      'rpc:niche_signals_expirar': [ok(0)],
      niche_signals: [ok(pend(1)), ok(null)],
      niche_signals_estado: [ok({ baseline_em: '2026-12-01T00:00:00Z' })],
      notifications: [ok([])],
    })
    const out = await enviarAvisosDoNicho(r.sb, AGORA, { sites: ['s1'], fanOut: fan })
    expect(out).toMatchObject({ enviados: 0, resumidos: 0, falhas: 0, adiados: 1 })
    const upd = r.chamadas.filter((c) => c.alvo === 'niche_signals').flatMap((c) => c.metodos).find((m) => m.startsWith('update('))!
    expect(upd).toContain('"notificacao_tentativas":1')
    expect(upd).not.toContain('notificado_em')
  })
  it('1ª execução com 250 pendentes: 1 resumo, notificado_em em blocos de 200 (200 + 50) e baseline gravado', async () => {
    const fan = vi.fn().mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
    const r = roteiro({
      'rpc:niche_signals_expirar': [ok(0)], 'rpc:niche_signals_sincronizar_sino': [ok(null)],
      niche_signals: [ok(pend(250)), ok(null), ok(null)],
      niche_signals_estado: [ok({ baseline_em: null }), ok(null)],
    })
    const out = await enviarAvisosDoNicho(r.sb, AGORA, { sites: ['s1'], fanOut: fan })
    expect(fan).toHaveBeenCalledTimes(1)
    expect(out).toMatchObject({ resumidos: 250, adiados: 0 })
    expect(metodosIn(r.chamadas)).toEqual([200, 50])
    expect(r.chamadas.filter((c) => c.alvo === 'niche_signals_estado' && c.metodos.some((m) => m.startsWith('update(')))).toHaveLength(1)
  })
  it('falha com 450 pendentes: um update por bloco de 200 (200+200+50), nunca um por id', async () => {
    const fan = vi.fn().mockResolvedValue({ total: 0, sent: 0, suppressed: 0, errors: [] })
    const r = roteiro({
      'rpc:niche_signals_expirar': [ok(0)],
      niche_signals: [ok(pend(450)), ok(null), ok(null), ok(null)],
      niche_signals_estado: [ok({ baseline_em: null })],
    })
    const out = await enviarAvisosDoNicho(r.sb, AGORA, { sites: ['s1'], fanOut: fan })
    expect(out.adiados).toBe(450)
    expect(metodosIn(r.chamadas)).toEqual([200, 200, 50])
  })
  it('depois de enviar, ressincroniza o sino do site (corrida com o dispensar); sem envio, não chama', async () => {
    const fan = vi.fn().mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
    const r = roteiro({
      'rpc:niche_signals_expirar': [ok(0)], 'rpc:niche_signals_sincronizar_sino': [ok(null)],
      niche_signals: [ok(pend(1)), ok(null)],
      niche_signals_estado: [ok({ baseline_em: null }), ok(null)],
    })
    await enviarAvisosDoNicho(r.sb, AGORA, { sites: ['s1'], fanOut: fan })
    expect(r.chamadas.filter((c) => c.alvo === 'rpc:niche_signals_sincronizar_sino')).toHaveLength(1)
    const vazio = roteiro({ 'rpc:niche_signals_expirar': [ok(0)], niche_signals: [ok([])] })
    await enviarAvisosDoNicho(vazio.sb, AGORA, { sites: ['s1'], fanOut: fan })
    expect(vazio.chamadas.some((c) => c.alvo === 'rpc:niche_signals_sincronizar_sino')).toBe(false)
  })
  it('sitesDe de niche_signals filtra por status aberto', async () => {
    const r = roteiro({ niche_signals: [ok([])], competitor_channels: [ok([])] })
    await enviarAvisosDoNicho(r.sb, AGORA, {})
    const ns = r.chamadas.find((c) => c.alvo === 'niche_signals')!
    expect(ns.metodos).toContain('eq("status","aberto")')
    expect(r.chamadas.find((c) => c.alvo === 'competitor_channels')!.metodos.some((m) => m.startsWith('eq('))).toBe(false)
  })
})

describe('enviarAvisosDoNicho: adiadas (F3b)', () => {
  const AGORA = new Date('2026-12-20T12:00:00.000Z')
  const base = { kind: 'destino', forca: 10, notificar_como: 'individual', notificacao_tentativas: 0 }
  const montar = (pendentes: unknown[]) => roteiro({
    'rpc:niche_signals_expirar': [ok(0)], 'rpc:niche_signals_sincronizar_sino': [ok(null)],
    niche_signals: [ok(pendentes), ok(null), ok(null)],
    niche_signals_estado: [ok({ baseline_em: '2026-12-01T00:00:00Z' })],
    notifications: [ok([])],
  })

  it('a consulta dos pendentes exclui as adiadas (adiado_ate nulo ou já passado)', async () => {
    const r = montar([])
    await enviarAvisosDoNicho(r.sb, AGORA, { sites: ['s1'], fanOut: vi.fn() })
    const ms = r.chamadas.find((c) => c.alvo === 'niche_signals')!.metodos
    expect(ms).toContain(`or(${JSON.stringify(`adiado_ate.is.null,adiado_ate.lte.${AGORA.toISOString()}`)})`)
  })
  it('adiada que voltou vai no resumo, nunca como "Nova sugestão"; a nunca adiada segue individual', async () => {
    const fan = vi.fn().mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
    const r = montar([
      { id: 'volta', ...base, adiado_ate: '2026-12-19T00:00:00Z' },
      { id: 'nova', ...base, adiado_ate: null },
    ])
    const out = await enviarAvisosDoNicho(r.sb, AGORA, { sites: ['s1'], fanOut: fan })
    expect(out).toMatchObject({ enviados: 1, resumidos: 1 })
    const chaves = fan.mock.calls.map((c) => (c[0] as { dedupKey: string }).dedupKey)
    expect(chaves.some((k) => k === 'nicho:nova')).toBe(true)
    expect(chaves.some((k) => k === 'nicho:volta')).toBe(false)
    expect(chaves.some((k) => k.startsWith('nicho-resumo:'))).toBe(true)
  })
})


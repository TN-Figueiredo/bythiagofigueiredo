// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ schema: vi.fn() }))
vi.mock('@/lib/youtube/competitor-health', () => ({ schemaTablesReady: mocks.schema }))

import { rodarRegistro } from '@/lib/youtube/teste-youtube/registro/tarefa'
import type { Linha } from './banco-falso'
import { leitura, rodadas } from '../sintetico'
import { H, MIN, SITE, T0, avaliacaoSemente, contexto, ir, iso, mundo, registroSemente, vid, yt, type VideoCfg } from './mundo'

const textos = { A: 'Titulo A', B: 'Titulo B', D: 'Titulo D' }
let ids = 0
const novoId = (): string => `00000000-0000-4000-8000-${String(900000 + ++ids).padStart(12, '0')}`
const opcoes = { novoId }

/** 18 rodadas AAB de 4 em 4 h, a última a `fimHa` ms antes do T0. */
function mistura(fimHa: number, n = 18, padrao = 'AAB', video = yt(1)): ReturnType<typeof rodadas> {
  const inicio = T0 - fimHa - (n - 1) * 4 * H
  return rodadas({ inicio: iso(inicio), intervaloMs: 4 * H, padroes: Array.from({ length: n }, () => padrao), textos }).map(l => ({ ...l, youtubeVideoId: video }))
}
const evalOk = (n: number, id: number, haMin: number, extra: Partial<Linha> = {}): Linha => avaliacaoSemente(n, id, { avaliada_em: iso(T0 - haMin * MIN), estado_14: 'sem_leitura', ...extra })
const tab = (b: ReturnType<typeof mundo>, t: string): Linha[] => b.tabelas[t] ?? []

beforeEach(() => {
  mocks.schema.mockReset().mockResolvedValue(null)
  ids = 0
})

describe('guardas', () => {
  it('schema ausente: parcial schema_ausente e nenhuma escrita nem leitura', async () => {
    mocks.schema.mockResolvedValue({ tipo: 'ausente', texto: 'x', codigo: '42P01' })
    const b = mundo([{ n: 1 }])
    const { c } = contexto()
    expect(await rodarRegistro(c(b.sb), opcoes)).toMatchObject({ estado: 'parcial', motivo: 'schema_ausente', feitas: 0 })
    expect(b.pedidos).toHaveLength(0)
  })
  it('42P01 ao montar a lista também é schema_ausente', async () => {
    const b = mundo([{ n: 1 }], { falhar: p => (p.tabela === 'yt_watch_alvos' ? { code: '42P01' } : null) })
    const { c } = contexto()
    expect(await rodarRegistro(c(b.sb), opcoes)).toMatchObject({ estado: 'parcial', motivo: 'schema_ausente' })
  })
  it('schema não conferido: erro schema_nao_conferido', async () => {
    mocks.schema.mockResolvedValue({ tipo: 'erro', texto: 'x' })
    const b = mundo([{ n: 1 }])
    const { c } = contexto()
    expect(await rodarRegistro(c(b.sb), opcoes)).toMatchObject({ estado: 'erro', motivo: 'schema_nao_conferido' })
  })
})

describe('C-8c estado', () => {
  it('zero candidatos entre 40 alvos: ok, sem_candidatos 1, alvos_lidos 40, candidatos_total 0, feitas 0', async () => {
    const b = mundo(Array.from({ length: 40 }, (_, i) => ({ n: i + 1, rodadasPorDia: 1 as const })))
    const { c } = contexto()
    const r = await rodarRegistro(c(b.sb), opcoes)
    expect(r).toMatchObject({ estado: 'ok', feitas: 0, deixadas: 0 })
    expect(r.detalhe).toMatchObject({ sem_candidatos: 1, alvos_lidos: 40, candidatos_total: 0, antigos_fora: 40 })
  })
  it('zero alvos: ok com alvos_lidos 0 (a coleta nunca ligada fica distinguível)', async () => {
    const b = mundo([])
    const { c } = contexto()
    const r = await rodarRegistro(c(b.sb), opcoes)
    expect(r).toMatchObject({ estado: 'ok', feitas: 0 })
    expect(r.detalhe).toMatchObject({ sem_candidatos: 1, alvos_lidos: 0, candidatos_total: 0 })
  })
  it('falha ao montar a lista: parcial lista_falhou', async () => {
    const b = mundo([{ n: 1 }], { falhar: p => (p.tabela === 'youtube_videos' ? { code: 'XX000' } : null) })
    const { c } = contexto()
    expect(await rodarRegistro(c(b.sb), opcoes)).toMatchObject({ estado: 'parcial', motivo: 'lista_falhou' })
  })
  it('alvo sem youtube_videos: detalhe.sem_video 1', async () => {
    const b = mundo([{ n: 1, semVideo: true }])
    const { c } = contexto()
    const r = await rodarRegistro(c(b.sb), opcoes)
    expect(r.detalhe).toMatchObject({ sem_video: 1, sem_candidatos: 1 })
  })
  it('erro em 1 de 2 vídeos: parcial video_falhou; em todos: erro', async () => {
    const um = mundo([
      { n: 1, avaliacoes: [evalOk(1, 1001, 600)], leituras: mistura(30 * MIN) },
      { n: 2, avaliacoes: [evalOk(2, 1002, 600)], leituras: mistura(30 * MIN, 18, 'AAB', yt(2)) },
    ], { falhar: p => (p.tabela === 'yt_watch_readings' && p.filtros.includes(`eq:youtube_video_id,${yt(2)}`) ? { code: 'XX000' } : null) })
    const r1 = await rodarRegistro(contexto().c(um.sb), opcoes)
    expect(r1).toMatchObject({ estado: 'parcial', motivo: 'video_falhou', feitas: 1 })
    const todos = mundo([{ n: 1, avaliacoes: [evalOk(1, 1001, 600)], leituras: mistura(30 * MIN) }], { falhar: p => (p.tabela === 'yt_watch_readings' ? { code: 'XX000' } : null) })
    expect(await rodarRegistro(contexto().c(todos.sb), opcoes)).toMatchObject({ estado: 'erro', motivo: 'video_falhou' })
  })
})

describe('reprodução do passado (primeira avaliação)', () => {
  it('vídeo sem avaliação: uma única chamada de ab_native_reproduzir, retroativas true e 1 real', async () => {
    const b = mundo([{ n: 1, leituras: mistura(30 * MIN) }])
    const r = await rodarRegistro(contexto().c(b.sb), opcoes)
    const chamadas = b.rpcChamadas.filter(x => x.nome === 'ab_native_reproduzir')
    expect(chamadas).toHaveLength(1)
    const avs = chamadas[0]!.args.p_avaliacoes as Array<{ retroativa: boolean }>
    expect(avs.filter(a => a.retroativa).length).toBeGreaterThan(0)
    expect(avs.filter(a => !a.retroativa)).toHaveLength(1)
    expect(avs.at(-1)!.retroativa).toBe(false)
    expect(r).toMatchObject({ estado: 'ok', feitas: 1 })
    expect(r.detalhe).toMatchObject({ reproduzidos: 1, criados: 1 })
    expect(tab(b, 'ab_native_tests').filter(x => x.estado === 'em_andamento')).toHaveLength(1)
    // a retenção foi pedida: ultima_vista + 365 d
    expect(b.rpcChamadas.some(x => x.nome === 'yt_watch_reter')).toBe(true)
  })
  it('erro na 1ª tentativa não desliga a reprodução: 60 min depois reproduz e grava as retroativas (Phil D1)', async () => {
    let falha = true
    const b = mundo([{ n: 1, leituras: mistura(30 * MIN) }], { falhar: p => (falha && p.tabela === 'yt_watch_readings' ? { code: 'XX000' } : null) })
    const { c, state } = contexto()
    expect(await rodarRegistro(c(b.sb), opcoes)).toMatchObject({ estado: 'erro' })
    expect(tab(b, 'ab_native_avaliacoes')).toHaveLength(1)
    expect(tab(b, 'ab_native_avaliacoes')[0]).toMatchObject({ estado_14: 'erro', erro: 'banco', ate_lida_em: null, retroativa: false })
    falha = false
    ir(state, 60 * MIN)
    const r = await rodarRegistro(c(b.sb), opcoes)
    expect(r.estado).toBe('ok')
    expect(tab(b, 'ab_native_avaliacoes').filter(a => a.retroativa === true).length).toBeGreaterThan(0)
  })
  it('idempotente (Phil D2, Yannis D2): o rpc falha na 1ª vez; na 2ª reproduz; na 3ª não chama de novo; sem duplicata', async () => {
    const b = mundo([{ n: 1, leituras: mistura(30 * MIN) }], { reproduzirFalha: { vez: 1, code: 'XX000' } })
    const { c, state } = contexto()
    await rodarRegistro(c(b.sb), opcoes)
    expect(tab(b, 'ab_native_tests')).toHaveLength(0)
    ir(state, 60 * MIN)
    await rodarRegistro(c(b.sb), opcoes)
    const registros = tab(b, 'ab_native_tests')
    expect(registros.filter(x => x.estado === 'em_andamento')).toHaveLength(1)
    const antes = tab(b, 'ab_native_avaliacoes').length
    ir(state, 120 * MIN)
    await rodarRegistro(c(b.sb), opcoes)
    expect(b.rpcChamadas.filter(x => x.nome === 'ab_native_reproduzir')).toHaveLength(2)
    expect(tab(b, 'ab_native_avaliacoes').length).toBe(antes) // sem rodada nova e sem devido: nada novo
  })
  it('o rpc devolvendo 0 (já feita): detalhe.reproducao_ja_feita 1', async () => {
    const b = mundo([{ n: 1, leituras: mistura(30 * MIN) }], { reproduzirRetorna: 0 })
    const r = await rodarRegistro(contexto().c(b.sb), opcoes)
    expect(r.detalhe).toMatchObject({ reproducao_ja_feita: 1, reproduzidos: 0 })
  })
  it('no máximo 2 reproduções de alvo que saiu por disparo (nível 5); o resto fica em sobrou', async () => {
    const saiu = iso(T0 - 3 * 86_400_000)
    const b = mundo([1, 2, 3].map(n => ({ n, saiuEm: saiu, leituras: mistura(5 * H, 18, 'AAB', yt(n)) })))
    const r = await rodarRegistro(contexto().c(b.sb), opcoes)
    expect(r.detalhe).toMatchObject({ reproduzidos: 2, sobrou: 1 })
    expect(r).toMatchObject({ estado: 'parcial', motivo: 'sobrou', deixadas: 1 })
  })
})

describe('registro nas avaliações seguintes (C-2, C-4)', () => {
  const base = (extra: Partial<VideoCfg> = {}): VideoCfg => ({ n: 1, leituras: mistura(30 * MIN), avaliacoes: [evalOk(1, 1001, 600)], ...extra })

  it('C-2: duas execuções seguidas com as mesmas leituras: 1 registro, evidência sem duplicata, 1 avaliação a mais (zero na 2ª)', async () => {
    const b = mundo([base()])
    const { c, state } = contexto()
    const r1 = await rodarRegistro(c(b.sb), opcoes)
    expect(r1).toMatchObject({ estado: 'ok', feitas: 1 })
    expect(tab(b, 'ab_native_tests')).toHaveLength(1)
    const evidencia1 = JSON.stringify(tab(b, 'ab_native_tests')[0]!.evidencia)
    expect(tab(b, 'ab_native_avaliacoes')).toHaveLength(2)
    ir(state, 20 * MIN)
    const r2 = await rodarRegistro(c(b.sb), opcoes)
    expect(r2.feitas).toBe(0)
    expect(tab(b, 'ab_native_tests')).toHaveLength(1)
    expect(JSON.stringify(tab(b, 'ab_native_tests')[0]!.evidencia)).toBe(evidencia1)
    expect(tab(b, 'ab_native_avaliacoes')).toHaveLength(2)
  })
  it('C-4: lista vazia de leituras vira sem_leitura', async () => {
    const b = mundo([{ n: 1, ultimaRodadaEm: iso(T0 - 5 * MIN), avaliacoes: [evalOk(1, 1001, 60)] }])
    await rodarRegistro(contexto().c(b.sb), opcoes)
    const novas = tab(b, 'ab_native_avaliacoes').filter(a => (a.id as number) !== 1001)
    expect(novas).toHaveLength(1)
    expect(novas[0]).toMatchObject({ estado_14: 'sem_leitura' })
  })
  it('C-4: sem rodada nova há 9 h grava sem_rodada_nova; 3 h depois nada novo', async () => {
    const b = mundo([{ n: 1, ultimaRodadaEm: iso(T0 - 9 * H), avaliacoes: [evalOk(1, 1001, 8 * 60 + 50)] }])
    const { c, state } = contexto()
    await rodarRegistro(c(b.sb), opcoes)
    expect(tab(b, 'ab_native_avaliacoes').filter(a => a.estado_14 === 'sem_rodada_nova')).toHaveLength(1)
    expect(b.pedidos.some(p => p.tabela === 'yt_watch_readings')).toBe(false)
    ir(state, 3 * H)
    await rodarRegistro(c(b.sb), opcoes)
    expect(tab(b, 'ab_native_avaliacoes').filter(a => a.estado_14 === 'sem_rodada_nova')).toHaveLength(1)
  })
  it('C-4: erro de banco no 1º disparo e sucesso 60 min depois: linha de erro com ate_lida_em nulo e depois a boa', async () => {
    let falha = true
    const b = mundo([base()], { falhar: p => (falha && p.tabela === 'yt_watch_readings' ? { code: 'XX000' } : null) })
    const { c, state } = contexto()
    await rodarRegistro(c(b.sb), opcoes)
    const erro = tab(b, 'ab_native_avaliacoes').find(a => a.estado_14 === 'erro')!
    expect(erro).toMatchObject({ erro: 'banco', ate_lida_em: null })
    falha = false
    ir(state, 60 * MIN)
    await rodarRegistro(c(b.sb), opcoes)
    expect(tab(b, 'ab_native_avaliacoes').some(a => a.estado_14 === 'provavel_teste')).toBe(true)
  })
  it('C-4: mesmo erro duas vezes seguidas: 1 linha, avaliada_em atualizado', async () => {
    const b = mundo([base()], { falhar: p => (p.tabela === 'yt_watch_readings' ? { code: 'XX000' } : null) })
    const { c, state } = contexto()
    await rodarRegistro(c(b.sb), opcoes)
    ir(state, 56 * MIN)
    await rodarRegistro(c(b.sb), opcoes)
    const erros = tab(b, 'ab_native_avaliacoes').filter(a => a.estado_14 === 'erro')
    expect(erros).toHaveLength(1)
    expect(erros[0]!.avaliada_em).toBe(iso(T0 + 56 * MIN))
  })
  it('C-4: erro, ok, erro igual: 2 linhas de erro (Phil D3)', async () => {
    let falha = true
    const b = mundo([base()], { falhar: p => (falha && p.tabela === 'yt_watch_readings' ? { code: 'XX000' } : null) })
    const { c, state } = contexto()
    await rodarRegistro(c(b.sb), opcoes)
    falha = false
    ir(state, 60 * MIN)
    await rodarRegistro(c(b.sb), opcoes)
    // nova rodada para voltar a ser devido, e o erro volta
    const nova = rodadas({ inicio: iso(T0 + 2 * H), intervaloMs: 4 * H, padroes: ['AAB'], textos }).map(l => ({ ...l, youtubeVideoId: yt(1) }))
    const { linhasDeLeituras } = await import('./mundo')
    tab(b, 'yt_watch_readings').push(...linhasDeLeituras(nova, 1))
    tab(b, 'yt_watch_alvos')[0]!.ultima_rodada_em = nova.at(-1)!.lidaEm
    falha = true
    ir(state, 3 * H)
    await rodarRegistro(c(b.sb), opcoes)
    expect(tab(b, 'ab_native_avaliacoes').filter(a => a.estado_14 === 'erro')).toHaveLength(2)
  })
  it('C-4: erro, sem_rodada_nova, erro igual: 2 linhas de erro e a sem_rodada_nova intacta (Phil R2-1)', async () => {
    const srAvaliadaEm = iso(T0 - 5 * H)
    const b = mundo([{
      n: 1, leituras: mistura(30 * MIN),
      avaliacoes: [evalOk(1, 1001, 30 * 60), evalOk(1, 1002, 10 * 60, { estado_14: 'erro', erro: 'banco' }), evalOk(1, 1003, 5 * 60, { estado_14: 'sem_rodada_nova' })],
    }], { falhar: p => (p.tabela === 'yt_watch_readings' ? { code: 'XX000' } : null) })
    await rodarRegistro(contexto().c(b.sb), opcoes)
    const todas = tab(b, 'ab_native_avaliacoes')
    expect(todas.filter(a => a.estado_14 === 'erro')).toHaveLength(2)
    expect(todas).toHaveLength(4)
    expect(todas.find(a => a.id === 1003)!.avaliada_em).toBe(srAvaliadaEm)
  })
})

describe('C-5 instante sem fuso', () => {
  it('escrita sem fuso no 2º de 3 vídeos: erro escrita_sem_fuso só no 2º; estado parcial video_falhou', async () => {
    const videos: VideoCfg[] = [1, 2, 3].map(n => ({
      n, leituras: mistura(30 * MIN, 18, 'AAB', yt(n)), avaliacoes: [evalOk(n, 1000 + n, 600)],
      ...(n === 2 ? { winnerAppliedAt: '2026-10-17T10:00:00' } : {}),
    }))
    const b = mundo(videos)
    const r = await rodarRegistro(contexto().c(b.sb), opcoes)
    expect(r).toMatchObject({ estado: 'parcial', motivo: 'video_falhou', feitas: 2 })
    const erros = tab(b, 'ab_native_avaliacoes').filter(a => a.estado_14 === 'erro')
    expect(erros).toHaveLength(1)
    expect(erros[0]).toMatchObject({ video_id: vid(2), erro: 'escrita_sem_fuso' })
  })
})

describe('C-6 não escreve fora', () => {
  it('uma execução com criação, atualização, encerramento, reprodução e retenção só toca as tabelas e RPCs permitidas', async () => {
    const permitidasTabelas = new Set(['ab_native_tests', 'ab_native_avaliacoes'])
    const permitidasRpc = new Set(['yt_watch_reter', 'ab_native_ultimas', 'ab_native_poda', 'ab_native_reproduzir'])
    const escritas: string[] = []
    const videos: VideoCfg[] = [
      { n: 1, leituras: mistura(30 * MIN) },
      { n: 2, leituras: mistura(30 * MIN, 18, 'AAB', yt(2)), avaliacoes: [evalOk(2, 1002, 600)] },
      { n: 3, leituras: mistura(30 * MIN, 18, 'AAB', yt(3)), avaliacoes: [evalOk(3, 1003, 600)], aberto: registroSemente(3, 'r3') },
    ]
    const b = mundo(videos, {
      aoEscrever: (t, op) => {
        escritas.push(op === 'rpc' ? t : `${op}:${t}`)
        if (op === 'rpc') { if (!permitidasRpc.has(t.replace('rpc:', ''))) throw new Error('rpc fora da lista: ' + t) } else if (!permitidasTabelas.has(t)) throw new Error('escrita fora da lista: ' + t)
      },
    })
    const r = await rodarRegistro(contexto().c(b.sb), opcoes)
    expect(r.estado).toBe('ok')
    expect(escritas.some(e => e === 'insert:ab_native_tests')).toBe(true)
    expect(escritas.some(e => e === 'update:ab_native_tests')).toBe(true)
    expect(escritas.some(e => e === 'rpc:ab_native_reproduzir')).toBe(true)
    expect(escritas.some(e => e === 'insert:ab_native_avaliacoes')).toBe(true)
  })
})

describe('CAS e corrida', () => {
  const comAberto = (): VideoCfg => ({ n: 1, leituras: mistura(30 * MIN), avaliacoes: [evalOk(1, 1001, 600)], aberto: registroSemente(1, 'r1', { variantes_titulo: ['Titulo A'], votos_titulo: { '0': 1 } }) })

  it('C-7e CAS perdido uma vez: relê, reavalia e grava normalmente', async () => {
    let perdeu = false
    const b = mundo([comAberto()], {
      aoEscrever: (t, op) => {
        if (!perdeu && t === 'ab_native_tests' && op === 'update') { perdeu = true; tab(b, 'ab_native_tests')[0]!.updated_at = '2026-10-18T21:41:00.000009+00:00' }
      },
    })
    const r = await rodarRegistro(contexto().c(b.sb), opcoes)
    expect(perdeu).toBe(true)
    expect(r).toMatchObject({ estado: 'ok', feitas: 1 })
    expect(r.detalhe).toMatchObject({ cas_perdido: 0 })
    expect(tab(b, 'ab_native_avaliacoes')).toHaveLength(2)
  })
  it('C-7e CAS perdido duas vezes: registro intacto, avaliação não gravada, cas_perdido 1, parcial/erro video_falhou, segue devido', async () => {
    let n = 0
    const b = mundo([comAberto(), { n: 2, leituras: mistura(30 * MIN, 18, 'AAB', yt(2)), avaliacoes: [evalOk(2, 1002, 600)] }], {
      aoEscrever: (t, op) => {
        if (t === 'ab_native_tests' && op === 'update' && n < 2) { n++; tab(b, 'ab_native_tests')[0]!.updated_at = `2026-10-18T21:41:00.00001${n}+00:00` }
      },
    })
    const antes = JSON.stringify({ ...tab(b, 'ab_native_tests')[0]!, updated_at: 0 })
    const ctx = contexto()
    const r = await rodarRegistro(ctx.c(b.sb), opcoes)
    expect(r).toMatchObject({ estado: 'parcial', motivo: 'video_falhou' })
    expect(r.detalhe).toMatchObject({ cas_perdido: 1 })
    expect(JSON.stringify({ ...tab(b, 'ab_native_tests')[0]!, updated_at: 0 })).toBe(antes)
    expect(tab(b, 'ab_native_avaliacoes').filter(a => a.video_id === vid(1))).toHaveLength(1) // só a semente: a nova não foi gravada
    // continua devido no disparo seguinte
    ir(ctx.state, 20 * MIN)
    const r2 = await rodarRegistro(ctx.c(b.sb), opcoes)
    expect(r2.feitas).toBeGreaterThanOrEqual(1)
    expect(tab(b, 'ab_native_avaliacoes').filter(a => a.video_id === vid(1))).toHaveLength(2)
  })
  it('C-7f 23505 no insert: relê, atualiza e campos vira os dois', async () => {
    let injetou = false
    const concorrente = registroSemente(1, 'rc', { origem: 'confirmado', campos: ['miniatura'], variantes_titulo: null, votos_titulo: null, primeira_vista: null, ultima_vista: null, versao_regra: null, confirmado_em: iso(T0 - H) })
    const b = mundo([{ n: 1, leituras: mistura(30 * MIN), avaliacoes: [evalOk(1, 1001, 600)] }], {
      aoEscrever: (t, op) => { if (!injetou && t === 'ab_native_tests' && op === 'insert') { injetou = true; tab(b, 'ab_native_tests').push(concorrente) } },
    })
    const r = await rodarRegistro(contexto().c(b.sb), opcoes)
    expect(injetou).toBe(true)
    expect(r.estado).toBe('ok')
    const registros = tab(b, 'ab_native_tests')
    expect(registros).toHaveLength(1)
    expect([...(registros[0]!.campos as string[])].sort()).toEqual(['miniatura', 'titulo'])
  })
})

describe('variantes_demais e retenção', () => {
  it('variantes_demais: a avaliação traz o aviso e o detalhe conta', async () => {
    const aberto = registroSemente(1, 'r1', { variantes_titulo: ['Titulo A', 'Titulo B', 'Titulo C'], votos_titulo: { '0': 9, '1': 9, '2': 9 } })
    const b = mundo([{ n: 1, leituras: mistura(30 * MIN, 18, 'AAD'), avaliacoes: [evalOk(1, 1001, 600)], aberto }])
    const r = await rodarRegistro(contexto().c(b.sb), opcoes)
    expect(r.detalhe).toMatchObject({ variantes_demais: 1 })
    expect(tab(b, 'ab_native_avaliacoes').some(a => a.aviso === 'variantes_demais')).toBe(true)
  })
  it('retenção: yt_watch_reter devolve 0: retencao_sem_alvo 1 e o estado não piora', async () => {
    const b = mundo([{ n: 1, leituras: mistura(30 * MIN), avaliacoes: [evalOk(1, 1001, 600)] }], { reter: 0 })
    const r = await rodarRegistro(contexto().c(b.sb), opcoes)
    expect(r.estado).toBe('ok')
    expect(r.detalhe).toMatchObject({ retencao_sem_alvo: 1 })
  })
  it('retenção: RPC ausente (42883): retencao_sem_rpc 1 e segue', async () => {
    const b = mundo([{ n: 1, leituras: mistura(30 * MIN), avaliacoes: [evalOk(1, 1001, 600)] }], { reter: { erro: '42883' } })
    const r = await rodarRegistro(contexto().c(b.sb), opcoes)
    expect(r.estado).toBe('ok')
    expect(r.detalhe).toMatchObject({ retencao_sem_rpc: 1 })
  })
})

describe('teto de tempo', () => {
  it('com o relógio em t0 + 60 s no início, nenhuma ida ao banco depois de t0 + 83 s e parcial sobrou', async () => {
    const { c, state } = contexto(60_000)
    const instantes: number[] = []
    const videos: VideoCfg[] = [1, 2, 3, 4].map(n => ({ n, leituras: mistura(30 * MIN, 18, 'AAB', yt(n)), avaliacoes: [evalOk(n, 1000 + n, 600)] }))
    const b = mundo(videos, { falhar: () => { instantes.push(state.agora); state.agora += 3_000; return null } })
    const r = await rodarRegistro(c(b.sb), opcoes)
    expect(r).toMatchObject({ estado: 'parcial', motivo: 'sobrou' })
    expect((r.deixadas ?? 0)).toBeGreaterThan(0)
    expect(instantes.length).toBeGreaterThan(0)
    // as idas feitas depois de t0 + 83 s só podem ser as do vídeo que já tinha começado antes do teto (a lista e as leituras dele são anteriores)
    expect(instantes.filter(t => t >= T0 + 83_000 + 3_000)).toEqual([])
  })
})

describe('sufixo estável sem título oficial (r5, emenda do P-V)', () => {
  it('a S4 grava tituloOficial nulo: o registro encerra como sem_desfecho/oficial_nao_lido e não reabre no disparo seguinte', async () => {
    const mistas = rodadas({ inicio: iso(T0 - 140 * H), intervaloMs: 4 * H, padroes: Array.from({ length: 12 }, () => 'AAB'), textos }).map(l => ({ ...l, youtubeVideoId: yt(1) }))
    const estavel = rodadas({ inicio: iso(T0 - 90 * H), intervaloMs: 4 * H, padroes: Array.from({ length: 22 }, () => 'AAA'), textos }).map(l => ({ ...l, rodadaId: 'e' + l.rodadaId, youtubeVideoId: yt(1) }))
    const b = mundo([{ n: 1, leituras: [...mistas, ...estavel] }])
    const { c, state } = contexto()
    const r = await rodarRegistro(c(b.sb), opcoes)
    expect(r.estado).toBe('ok')
    const fechados = tab(b, 'ab_native_tests').filter(x => x.estado !== 'em_andamento')
    expect(fechados).toHaveLength(1)
    expect(fechados[0]).toMatchObject({ estado: 'sem_desfecho', desfecho_motivo: 'oficial_nao_lido', desfecho_estado: 'sem_dado', vencedor_titulo: null, titulo_oficial: null })
    expect(r.detalhe).toMatchObject({ encerrados: 1, encerrados_oficial_nao_lido: 1 })
    expect(tab(b, 'ab_native_tests').filter(x => x.estado === 'em_andamento')).toHaveLength(0)

    // uma rodada nova depois: nenhuma reabertura
    const nova = rodadas({ inicio: iso(T0 + 2 * H), intervaloMs: 4 * H, padroes: ['AAA'], textos }).map(l => ({ ...l, rodadaId: 'n' + l.rodadaId, youtubeVideoId: yt(1) }))
    const { linhasDeLeituras } = await import('./mundo')
    tab(b, 'yt_watch_readings').push(...linhasDeLeituras(nova, 1))
    tab(b, 'yt_watch_alvos')[0]!.ultima_rodada_em = nova.at(-1)!.lidaEm
    ir(state, 3 * H)
    const r2 = await rodarRegistro(c(b.sb), opcoes)
    expect(r2.detalhe).toMatchObject({ criados: 0 })
    expect(tab(b, 'ab_native_tests').filter(x => x.estado === 'em_andamento')).toHaveLength(0)
    void SITE; void leitura
  })
})

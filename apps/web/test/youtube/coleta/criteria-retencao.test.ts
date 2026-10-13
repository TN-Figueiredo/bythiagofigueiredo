// @vitest-environment node
// A5 · E8, Tarefa 10: o alarme da retenção. Cada regra tem uma entrada que o faz subir, uma que NÃO pode fazê-lo subir e o
// estado "tabela vazia". As funções SQL da MG5 não existem em banco nenhum aqui: o contrato é o do plano (apêndice B),
// o banco é o falso, e o contrato contra o banco de verdade é a Tarefa 9b.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { fakeSupabase, type FakeDb } from './fake-supabase'
import { atrasadosDaRetencao, criteriosRetencao, ALARME_RETENCAO } from '@/lib/youtube/coleta/criteria-retencao'
import { criarRelogio, type Relogio } from '@/lib/youtube/coleta/clock'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import type { FatoRetencao } from '@/lib/youtube/coleta/retencao-regra'
import type { ColetaChannel } from '@/lib/youtube/coleta/types'

// 2026-10-13 15:00 UTC = 08:00 em Los Angeles: o dia do Pacífico e o dia UTC são o mesmo.
const AGORA = '2026-10-13T15:00:00.000Z'
const HOJE = '2026-10-13'
const UTC = '2026-10-13'
const D = (n: number): string => addDays(HOJE, n)
const SITE = 'site-1'
const CANAL: ColetaChannel = {
  id: 'ch-1', channel_id: 'UC1', site_id: SITE, name: 'Canal A', sync_enabled: true, collection_status: 'ok', video_count: 35,
}
const OUTRO: ColetaChannel = { ...CANAL, id: 'ch-2', channel_id: 'UC2', name: 'Canal B' }
const FN = 'yt_own_retention_facts'

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(AGORA), toFake: ['Date', 'setTimeout', 'clearTimeout'] })
})
afterEach(() => {
  vi.useRealTimers()
})

/** Um vídeo com diário em dia, nunca tentado, sem linha, âncora nula: o estado "primeiro dia". */
function fato(ytId: string, o: Partial<FatoRetencao> = {}): FatoRetencao {
  return {
    youtube_video_id: ytId, video_id: `uuid-${ytId}`, site_id: SITE, duration_seconds: 600,
    publicado_dia_pt: D(-60), fonte_ate: D(-1), views_total: 100, ultimo_dia_com_view: D(-3),
    views_7d: null, views_30d: null,
    vida_window_end: null, vida_collected_at: null, vida_views_at_read: null, tem_7d: false, tem_30d: false,
    primeira_tent_dia: null, leva_ancora_dia: null,
    diario_tent_dia: null, diario_tent_resultado: null, diario_falhas_4d: 0,
    vida_tent_dia: null, vida_tent_resultado: null, vida_resposta_dia: null,
    d7_tent_dia: null, d7_tent_resultado: null, d7_resposta_dia: null,
    d30_tent_dia: null, d30_tent_resultado: null, d30_resposta_dia: null,
    ...o,
  }
}

/** Linha de vida gravada e respondida há `dias` dias; hoje há views novas (150 > 100) e a fonte andou (D−1 > D−dias−1). */
function comLinha(ytId: string, dias: number, o: Partial<FatoRetencao> = {}): FatoRetencao {
  return fato(ytId, {
    vida_window_end: D(-dias - 1),
    vida_collected_at: `${D(-dias)}T12:00:00.000Z`,
    vida_views_at_read: 100,
    views_total: 150,
    primeira_tent_dia: D(-dias),
    vida_tent_dia: D(-dias), vida_tent_resultado: 'ok', vida_resposta_dia: D(-dias),
    ...o,
  })
}

/** Sem linha, com resposta vazia (`sem_dado_na_janela`) há `dias` dias; o vídeo teve view depois dela. */
function comRespostaVazia(ytId: string, dias: number, o: Partial<FatoRetencao> = {}): FatoRetencao {
  return fato(ytId, {
    primeira_tent_dia: D(-dias),
    vida_tent_dia: D(-dias), vida_tent_resultado: 'sem_dado_na_janela', vida_resposta_dia: D(-dias),
    ultimo_dia_com_view: D(-1),
    ...o,
  })
}

const rodarPura = (fatos: FatoRetencao[]): string[] => atrasadosDaRetencao(fatos, { hojePt: HOJE, hojeUtc: UTC })

describe('A5 E8 · atrasadosDaRetencao (pura)', () => {
  it('o limite do alarme é 8 dias (um a mais que o vencimento da regra do passo)', () => {
    expect(ALARME_RETENCAO.dias).toBe(8)
  })

  describe('(A) tem linha de vida', () => {
    it('SOBE: linha de 9 dias com views novas e a fonte andou', () => {
      expect(rodarPura([comLinha('a', 9)])).toEqual(['a'])
    })
    it('SOBE: o limite é 8 dias ou mais (8 sobe, 7 não)', () => {
      expect(rodarPura([comLinha('a', 8)])).toEqual(['a'])
      expect(rodarPura([comLinha('a', 7)])).toEqual([])
    })
    it('NÃO sobe: linha de 9 dias SEM views novas (o NP-E8 ao pé da letra daria vermelho falso)', () => {
      expect(rodarPura([comLinha('a', 9, { views_total: 100 })])).toEqual([])
      expect(rodarPura([comLinha('a', 9, { views_total: 80 })])).toEqual([])
    })
    it('NÃO sobe: linha de 9 dias, views novas, e a fonte não andou (windowEnd igual)', () => {
      // o diário está em dia (fonte_ate = D−1), mas a linha já cobre até o mesmo dia (ou além): ler de novo não traria nada
      expect(rodarPura([comLinha('a', 9, { vida_window_end: D(-1) })])).toEqual([])
      expect(rodarPura([comLinha('a', 9, { vida_window_end: D(0) })])).toEqual([])
      // e andou um dia só: já é motivo
      expect(rodarPura([comLinha('a', 9, { vida_window_end: D(-2) })])).toEqual(['a'])
    })
    it('SOBE: views_at_read nulo conta como "há views novas" quando o total é conhecido', () => {
      expect(rodarPura([comLinha('a', 9, { vida_views_at_read: null, views_total: 3 })])).toEqual(['a'])
    })
    it('NÃO sobe: views_total desconhecido (nulo nunca vira zero nem "views novas")', () => {
      expect(rodarPura([comLinha('a', 9, { views_total: null })])).toEqual([])
    })
    it('a base é o mais recente entre o dia da coleta e a última resposta', () => {
      // coletada há 20 dias, mas respondida (vazio) há 3: a base é 3 dias, não vence
      expect(rodarPura([comLinha('a', 20, { vida_resposta_dia: D(-3), vida_tent_dia: D(-3) })])).toEqual([])
      // coletada há 3, respondida há 20: a base é 3
      expect(rodarPura([comLinha('a', 3, { vida_resposta_dia: D(-20), vida_tent_dia: D(-20) })])).toEqual([])
    })
    it('SOBE: linha com data de coleta ilegível (nulo) não é verde; as outras condições valem', () => {
      expect(rodarPura([comLinha('a', 9, { vida_collected_at: null, vida_resposta_dia: null, vida_tent_dia: null, vida_tent_resultado: null })])).toEqual(['a'])
      expect(rodarPura([comLinha('a', 9, { vida_collected_at: null, vida_resposta_dia: null, vida_tent_dia: null, vida_tent_resultado: null, views_total: 100 })])).toEqual([])
    })
    it('NÃO sobe: lido hoje', () => {
      expect(rodarPura([comLinha('a', 0, { vida_window_end: D(-2) })])).toEqual([])
    })
  })

  describe('(B) sem linha, com resposta vazia', () => {
    it('SOBE: resposta vazia há 9 dias e view depois dela', () => {
      expect(rodarPura([comRespostaVazia('a', 9)])).toEqual(['a'])
    })
    it('SOBE: 8 dias sobe, 7 não', () => {
      expect(rodarPura([comRespostaVazia('a', 8)])).toEqual(['a'])
      expect(rodarPura([comRespostaVazia('a', 7)])).toEqual([])
    })
    it('NÃO sobe: resposta vazia há 9 dias e nenhuma view depois', () => {
      expect(rodarPura([comRespostaVazia('a', 9, { ultimo_dia_com_view: D(-30) })])).toEqual([])
      expect(rodarPura([comRespostaVazia('a', 9, { ultimo_dia_com_view: null })])).toEqual([])
    })
    it('a margem da fonte é de 3 dias antes da resposta (inclusive)', () => {
      expect(rodarPura([comRespostaVazia('a', 9, { ultimo_dia_com_view: D(-12) })])).toEqual(['a'])
      expect(rodarPura([comRespostaVazia('a', 9, { ultimo_dia_com_view: D(-13) })])).toEqual([])
    })
  })

  describe('(C) a última tentativa não teve resposta, mas já houve resposta antes', () => {
    it('SOBE: última tentativa sem resposta há 2 dias, última resposta há 9, views novas (com linha)', () => {
      const f = comLinha('a', 9, { vida_tent_dia: D(-2), vida_tent_resultado: 'erro_http' })
      expect(rodarPura([f])).toEqual(['a'])
    })
    it('SOBE: o mesmo sem linha (resposta vazia há 9, view depois)', () => {
      const f = comRespostaVazia('a', 9, { vida_tent_dia: D(0), vida_tent_resultado: 'erro_http' })
      expect(rodarPura([f])).toEqual(['a'])
    })
    it('NÃO sobe: erro hoje com resposta há 3 dias', () => {
      const f = comLinha('a', 3, { vida_tent_dia: D(0), vida_tent_resultado: 'erro_http' })
      expect(rodarPura([f])).toEqual([])
      const g = comRespostaVazia('b', 3, { vida_tent_dia: D(0), vida_tent_resultado: 'erro_http' })
      expect(rodarPura([g])).toEqual([])
    })
    it('NÃO sobe: erro hoje, resposta há 9 dias, SEM views novas', () => {
      const f = comLinha('a', 9, { vida_tent_dia: D(0), vida_tent_resultado: 'erro_http', views_total: 100 })
      expect(rodarPura([f])).toEqual([])
    })
    it('NÃO sobe: erro hoje, resposta há 9 dias, views novas, mas a fonte não andou', () => {
      const f = comLinha('a', 9, { vida_tent_dia: D(0), vida_tent_resultado: 'erro_http', vida_window_end: D(-1) })
      expect(rodarPura([f])).toEqual([])
    })
    it('a resposta tem de ter MAIS de 8 dias: 8 exatos não sobe, 9 sobe', () => {
      expect(rodarPura([comLinha('a', 8, { vida_tent_dia: D(0), vida_tent_resultado: 'erro_http' })])).toEqual([])
      expect(rodarPura([comLinha('a', 9, { vida_tent_dia: D(0), vida_tent_resultado: 'erro_http' })])).toEqual(['a'])
      expect(rodarPura([comRespostaVazia('a', 8, { vida_tent_dia: D(0), vida_tent_resultado: 'erro_http' })])).toEqual([])
    })
    it('SOBE: linha gravada, só tentativas sem resposta registradas, linha de 9 dias: a linha é a resposta anterior', () => {
      const f = comLinha('a', 9, { vida_resposta_dia: null, vida_tent_dia: D(0), vida_tent_resultado: 'erro_http' })
      expect(rodarPura([f])).toEqual(['a'])
      const g = comLinha('b', 3, { vida_resposta_dia: null, vida_tent_dia: D(0), vida_tent_resultado: 'erro_http' })
      expect(rodarPura([g])).toEqual([])
    })
  })

  describe('(D) nunca teve resposta', () => {
    const ancora = (dias: number): Partial<FatoRetencao> => ({ leva_ancora_dia: D(-dias) })

    it('SOBE (I3): nenhuma tentativa de vídeo e a primeira execução do passo no canal foi há 9 dias: TODOS contam', () => {
      const fatos = ['a', 'b', 'c'].map(id => fato(id, ancora(9)))
      expect(rodarPura(fatos)).toEqual(['a', 'b', 'c'])
    })
    it('SOBE: só tentativas de orçamento há 9 dias, âncora há 9 dias', () => {
      const f = fato('a', {
        ...ancora(9), primeira_tent_dia: D(-9), vida_tent_dia: D(-9), vida_tent_resultado: 'nao_alcancado_orcamento',
      })
      expect(rodarPura([f])).toEqual(['a'])
    })
    it('NÃO sobe: âncora há 8 dias exatos', () => {
      expect(rodarPura([fato('a', ancora(8))])).toEqual([])
    })
    it('NÃO sobe (m-F6): âncora há 9 dias e a primeira tentativa do vídeo é de hoje, erro_http', () => {
      const f = fato('a', {
        ...ancora(9), primeira_tent_dia: D(0), vida_tent_dia: D(0), vida_tent_resultado: 'erro_http',
      })
      expect(rodarPura([f])).toEqual([])
    })
    it('a primeira tentativa de 8 dias não conta como "há pouco"? (8 dias exatos é pouco; 9 não)', () => {
      expect(rodarPura([fato('a', { ...ancora(20), primeira_tent_dia: D(-8), vida_tent_dia: D(-8), vida_tent_resultado: 'erro_http' })])).toEqual([])
      expect(rodarPura([fato('a', { ...ancora(20), primeira_tent_dia: D(-9), vida_tent_dia: D(-9), vida_tent_resultado: 'erro_http' })])).toEqual(['a'])
    })
    it('a primeira tentativa de uma janela de 7 dias também conta (primeira_tent_dia vale para os três kinds)', () => {
      expect(rodarPura([fato('a', { ...ancora(20), primeira_tent_dia: D(0), d7_tent_dia: D(0), d7_tent_resultado: 'erro_http' })])).toEqual([])
    })
    it('NÃO sobe: âncora há 3 dias, vídeo esperando o seu dia da leva', () => {
      expect(rodarPura([fato('a', ancora(3))])).toEqual([])
    })
    it('NÃO sobe: âncora nula, tabela vazia, primeiro dia (depois de o passo rodar)', () => {
      expect(rodarPura([])).toEqual([])
      expect(rodarPura([fato('a'), fato('b')])).toEqual([])
    })
    it('SOBE: o vídeo sem linha e só com tentativas falhas há 9 dias, âncora antiga', () => {
      const f = fato('a', { ...ancora(30), primeira_tent_dia: D(-12), vida_tent_dia: D(-1), vida_tent_resultado: 'erro_http' })
      expect(rodarPura([f])).toEqual(['a'])
    })
  })

  describe('quem NÃO é avaliado aqui (tem a nota própria do passo)', () => {
    const velho = { leva_ancora_dia: D(-30) }
    it('vídeo novo sem diário', () => {
      expect(rodarPura([fato('a', { ...velho, publicado_dia_pt: D(-2), fonte_ate: null })])).toEqual([])
    })
    it('vídeo de 5 dias ou mais sem diário em dia (fonte_ate nulo ou antiga)', () => {
      expect(rodarPura([fato('a', { ...velho, fonte_ate: null })])).toEqual([])
      expect(rodarPura([fato('a', { ...velho, fonte_ate: D(-8) })])).toEqual([])
      expect(rodarPura([comLinha('b', 20, { fonte_ate: D(-8) })])).toEqual([])
    })
    it('o limite do diário em dia é hoje − 7 (inclusive)', () => {
      expect(rodarPura([fato('a', { ...velho, fonte_ate: D(-7) })])).toEqual(['a'])
    })
    it('vídeo sem resposta do YouTube (4 de 4 dias)', () => {
      expect(rodarPura([fato('a', { ...velho, fonte_ate: D(-20), diario_falhas_4d: 4 })])).toEqual([])
    })
  })

  it('linha gravada sem nenhuma tentativa: de 3 dias, 0; de 9 dias com views novas, 1', () => {
    const sem = (dias: number): FatoRetencao => comLinha('a', dias, {
      primeira_tent_dia: null, vida_tent_dia: null, vida_tent_resultado: null, vida_resposta_dia: null,
    })
    expect(rodarPura([sem(3)])).toEqual([])
    expect(rodarPura([sem(9)])).toEqual(['a'])
  })

  it('ordem: do mais atrasado ao menos; empate pelo id; id repetido conta uma vez', () => {
    const fatos = [comLinha('c', 9), comLinha('a', 12), comRespostaVazia('b', 12), comLinha('d', 20), comLinha('a', 12)]
    expect(rodarPura(fatos)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('um fato que sobe não esconde o outro: cada vídeo é avaliado sozinho', () => {
    const fatos = [comLinha('ok', 2), comLinha('atrasado', 9), comRespostaVazia('vazio-sem-view', 9, { ultimo_dia_com_view: null })]
    expect(rodarPura(fatos)).toEqual(['atrasado'])
  })
})

// ───────────────────────────── o critério (com o banco falso) ─────────────────────────────

const naoAvaliou = (canal = 'Canal A', motivo?: string): string =>
  `critérios: não foi possível avaliar retenção de ${canal}${motivo ? ` (${motivo})` : ''}`
const nota = (canal: string, n: number, ids: string): string =>
  `retenção: ${canal}: ${n} vídeo(s) com leitura da curva vencida há mais de 8 dias (${ids})`

function dbCom(fatos: unknown, canal = CANAL): FakeDb {
  const db = fakeSupabase()
  db.rpcHandlers[FN] = (a) => ({ data: a.p_channel_id === canal.id ? fatos : [], error: null })
  return db
}

async function rodar(db: FakeDb, canais: ColetaChannel[] = [CANAL], relogio: Relogio = criarRelogio()) {
  const falhas: string[] = []
  await criteriosRetencao({ supabase: db.client, channels: canais, falhas, relogio })
  return falhas
}

function travando(db: FakeDb): void {
  db.rpcHandlers[FN] = () => new Promise(() => {})
}

describe('A5 E8 · criteriosRetencao', () => {
  describe('o que o faz subir, o que não, e o estado vazio', () => {
    it('SOBE: um vídeo vencido vira nota com o id; a rpc recebe o canal e o dia UTC', async () => {
      const db = dbCom([comLinha('abc', 9)])
      expect(await rodar(db)).toEqual([nota('Canal A', 1, 'abc')])
      expect(db.rpcCalls).toEqual([{ name: FN, args: { p_channel_id: 'ch-1', p_hoje_utc: UTC } }])
    })

    it('SOBE: o dia UTC e o dia do Pacífico são separados (23:30 UTC ainda é o mesmo dia no Pacífico, mas outro dia UTC à 00:30)', async () => {
      vi.setSystemTime(new Date('2026-10-14T00:30:00.000Z')) // 17:30 do dia 13 em Los Angeles
      const db = dbCom([])
      await rodar(db)
      expect(db.rpcCalls[0]!.args).toEqual({ p_channel_id: 'ch-1', p_hoje_utc: '2026-10-14' })
    })

    it('lista até 5 ids, do mais atrasado ao menos, e diz quantos ficaram de fora', async () => {
      const fatos = Array.from({ length: 7 }, (_, i) => comLinha(`v${i}`, 9 + i))
      const [n] = await rodar(dbCom(fatos))
      expect(n).toBe(nota('Canal A', 7, 'v6, v5, v4, v3, v2, e mais 2'))
    })

    it('exatamente 5 ids: sem "e mais"', async () => {
      const fatos = Array.from({ length: 5 }, (_, i) => comLinha(`v${i}`, 9 + i))
      expect(await rodar(dbCom(fatos))).toEqual([nota('Canal A', 5, 'v4, v3, v2, v1, v0')])
    })

    it('NÃO sobe: nada vencido (lido hoje, sem views novas)', async () => {
      const db = dbCom([comLinha('a', 0, { vida_window_end: D(-2) }), comLinha('b', 9, { views_total: 100 })])
      expect(await rodar(db)).toEqual([])
      expect(db.rpcCalls).toHaveLength(1) // leu de verdade: o verde veio de uma leitura
    })

    it('tabela vazia (lista vazia): sem nota, e a função foi chamada', async () => {
      const db = dbCom([])
      expect(await rodar(db)).toEqual([])
      expect(db.rpcCalls).toHaveLength(1)
    })

    it('primeiro dia: vídeos elegíveis, âncora nula, nenhuma tentativa: sem nota', async () => {
      const db = dbCom([fato('a'), fato('b')])
      expect(await rodar(db)).toEqual([])
      expect(db.rpcCalls).toHaveLength(1)
    })

    it('SOBE (I3): âncora de 9 dias e nenhuma tentativa de vídeo: a nota lista os vídeos', async () => {
      const db = dbCom([fato('a', { leva_ancora_dia: D(-9) }), fato('b', { leva_ancora_dia: D(-9) })])
      expect(await rodar(db)).toEqual([nota('Canal A', 2, 'a, b')])
    })

    it('executar duas vezes com a mesma lista não duplica a nota', async () => {
      const db = dbCom([comLinha('abc', 9)])
      const falhas: string[] = []
      const ctx = { supabase: db.client, channels: [CANAL], falhas, relogio: criarRelogio() }
      await criteriosRetencao(ctx)
      await criteriosRetencao(ctx)
      expect(falhas).toEqual([nota('Canal A', 1, 'abc')])
    })
  })

  describe('quais canais são avaliados', () => {
    it('canal desligado ou em reautorizar: não avalia, não chama a rpc, não anota', async () => {
      const db = dbCom([comLinha('abc', 9)])
      const falhas = await rodar(db, [
        { ...CANAL, sync_enabled: false }, { ...OUTRO, collection_status: 'reautorizar' },
      ])
      expect(falhas).toEqual([])
      expect(db.rpcCalls).toEqual([])
    })

    it('sem canais: nada a avaliar, nenhuma chamada', async () => {
      const db = dbCom([])
      expect(await rodar(db, [])).toEqual([])
      expect(db.rpcCalls).toEqual([])
    })

    it('dois canais: cada um com a sua nota; a falha de um não esconde o atraso do outro', async () => {
      const db = fakeSupabase()
      db.rpcHandlers[FN] = (a) => a.p_channel_id === 'ch-1'
        ? { data: null, error: { code: 'XX000', message: 'senha=hunter2' } }
        : { data: [comLinha('b1', 9)], error: null }
      const falhas = await rodar(db, [CANAL, OUTRO])
      expect(falhas).toEqual([
        `erro de banco ao ler ${FN}`,
        naoAvaliou('Canal A'),
        nota('Canal B', 1, 'b1'),
      ])
    })
  })

  describe('a leitura que não veio inteira nunca é verde', () => {
    it('erro de banco: "não foi possível avaliar" e nenhuma nota de atraso; o texto do Postgres não vai à nota', async () => {
      const db = fakeSupabase()
      db.errors[`rpc:${FN}`] = { code: 'XX000', message: 'senha=hunter2 relation secreta' }
      const falhas = await rodar(db)
      expect(falhas).toEqual([`erro de banco ao ler ${FN}`, naoAvaliou()])
      expect(falhas.join('|')).not.toMatch(/hunter2|secreta/)
    })

    it.each([['PGRST202'], ['42883'], ['42P01'], ['PGRST205']])('função ou tabela ausente (%s): vermelho com o nome da migration', async (code) => {
      const db = fakeSupabase()
      db.errors[`rpc:${FN}`] = { code, message: 'could not find' }
      const falhas = await rodar(db)
      expect(falhas).toEqual([
        `schema_ausente: ${FN}`,
        naoAvaliou('Canal A', `migration MG5 não aplicada: falta a função ${FN}`),
      ])
    })

    it('sem manipulador nenhum (a função não existe no falso): a mesma nota, nunca verde', async () => {
      const db = fakeSupabase()
      const falhas = await rodar(db)
      expect(falhas).toEqual([
        `schema_ausente: ${FN}`,
        naoAvaliou('Canal A', `migration MG5 não aplicada: falta a função ${FN}`),
      ])
    })

    it('a rpc lança: erro de banco, sem o texto da exceção', async () => {
      const db = fakeSupabase()
      db.rpcHandlers[FN] = () => { throw new Error('senha=hunter2') }
      const falhas = await rodar(db)
      expect(falhas).toEqual([`erro de banco ao ler ${FN}`, naoAvaliou()])
      expect(falhas.join('|')).not.toContain('hunter2')
    })

    it('a rpc rejeita: o mesmo', async () => {
      const db = fakeSupabase()
      db.rpcHandlers[FN] = () => Promise.reject(new Error('senha=hunter2'))
      const falhas = await rodar(db)
      expect(falhas).toEqual([`erro de banco ao ler ${FN}`, naoAvaliou()])
    })

    const lixo: Array<[string, unknown]> = [
      ['resposta nula', null],
      ['objeto no lugar da lista', { 0: comLinha('a', 9) }],
      ['texto no lugar da lista', 'vazio'],
      ['número', 0],
      ['item que não é objeto', ['a']],
      ['item nulo', [null]],
      ['chave faltando', [(() => { const f: Partial<FatoRetencao> = comLinha('a', 9); delete f.leva_ancora_dia; return f })()]],
      ['views_total como texto', [{ ...comLinha('a', 9), views_total: '150' }]],
      ['dia em formato errado', [{ ...comLinha('a', 9), fonte_ate: '13/10/2026' }]],
      ['tem_7d nulo', [{ ...comLinha('a', 9), tem_7d: null }]],
      ['um bom e um ruim', [comLinha('a', 9), { ...comLinha('b', 9), diario_falhas_4d: null }]],
    ]
    it.each(lixo)('forma inesperada (%s): "não foi possível avaliar" e nenhuma nota de atraso', async (_nome, resposta) => {
      const falhas = await rodar(dbCom(resposta))
      expect(falhas).toEqual([naoAvaliou()])
    })

    it('forma inesperada: o dado não vai à nota', async () => {
      const falhas = await rodar(dbCom([{ ...comLinha('SEGREDO', 9), views_total: 'SEGREDO' }]))
      expect(falhas.join('|')).not.toContain('SEGREDO')
    })
  })

  // B (conserto da revisão das Tarefas 9 e 10): `fatos = []` só é "tabela vazia" quando o canal de fato não tem vídeo. Com vídeo
  // cadastrado, a lista vazia é defeito da função (filtro quebrado, cliente sem service_role) e o alarme (D) não tem sobre quem disparar.
  describe('lista de fatos vazia: o canal tem vídeos? (verde falso)', () => {
    const video = (n: number, o: Record<string, unknown> = {}) =>
      ({ id: `uuid-${n}`, channel_id: 'ch-1', published_at: D(-30) + 'T10:00:00Z', ...o })
    const dbVazio = (videos: Array<Record<string, unknown>>): FakeDb => {
      const db = fakeSupabase({ youtube_videos: videos })
      db.rpcHandlers[FN] = () => ({ data: [], error: null })
      return db
    }
    const semAvaliar = (n: number): string => naoAvaliou('Canal A', `lista vazia, mas o canal tem ${n} ${n === 1 ? 'vídeo' : 'vídeos'}`)

    it('VERMELHO: lista vazia e 2 vídeos cadastrados: "não foi possível avaliar", com a contagem', async () => {
      expect(await rodar(dbVazio([video(1), video(2)]))).toEqual([semAvaliar(2)])
    })

    it('VERMELHO: 1 vídeo: singular', async () => {
      expect(await rodar(dbVazio([video(1)]))).toEqual([semAvaliar(1)])
    })

    it('VERDE legítimo: lista vazia e nenhum vídeo no canal (a contagem foi feita)', async () => {
      const db = dbVazio([])
      expect(await rodar(db)).toEqual([])
      expect(db.leituras.youtube_videos).toBe(1)
    })

    it('só conta o vídeo DESTE canal e com published_at (os da lista de fatos); o resto é verde', async () => {
      const db = dbVazio([video(1, { channel_id: 'ch-2' }), video(2, { published_at: null }), video(3, { published_at: undefined })])
      expect(await rodar(db)).toEqual([])
    })

    it('a lista de fatos NÃO vazia não olha youtube_videos', async () => {
      const db = fakeSupabase({ youtube_videos: [video(1)] })
      db.rpcHandlers[FN] = () => ({ data: [comLinha('a', 0, { vida_window_end: D(-2) })], error: null })
      expect(await rodar(db)).toEqual([])
      expect(db.leituras.youtube_videos).toBeUndefined()
    })

    it('a contagem falha (erro de banco): nunca verde, e o texto do Postgres não vai à nota', async () => {
      const db = dbVazio([video(1)])
      db.errors.youtube_videos = { code: 'XX000', message: 'senha=hunter2' }
      const falhas = await rodar(db)
      expect(falhas).toEqual(['erro de banco ao ler youtube_videos', naoAvaliou()])
      expect(falhas.join('|')).not.toContain('hunter2')
    })

    it('a tabela youtube_videos some (schema ausente): nunca verde', async () => {
      const db = dbVazio([])
      db.errors.youtube_videos = { code: '42P01', message: 'relation does not exist' }
      expect(await rodar(db)).toEqual(['schema_ausente: youtube_videos', naoAvaliou()])
    })

    it('a contagem vem ausente (nem número nem erro): nunca verde', async () => {
      const db = dbVazio([video(1)])
      const from = db.client.from.bind(db.client)
      vi.spyOn(db.client, 'from').mockImplementation((t: string) => {
        if (t === 'youtube_videos') return { select: () => ({ eq: () => ({ not: () => Promise.resolve({ data: null, error: null, count: null }) }) }) } as never
        return from(t)
      })
      expect(await rodar(db)).toEqual([naoAvaliou('Canal A', 'contagem de vídeos ausente')])
    })

    it('a contagem lança: erro de banco, sem o texto da exceção', async () => {
      const db = dbVazio([video(1)])
      const from = db.client.from.bind(db.client)
      vi.spyOn(db.client, 'from').mockImplementation((t: string) => {
        if (t === 'youtube_videos') throw new Error('senha=hunter2')
        return from(t)
      })
      const falhas = await rodar(db)
      expect(falhas).toEqual(['erro de banco ao ler youtube_videos', naoAvaliou()])
      expect(falhas.join('|')).not.toContain('hunter2')
    })

    it('a contagem não volta no prazo: "(sem tempo)", nunca verde', async () => {
      const db = dbVazio([video(1)])
      const from = db.client.from.bind(db.client)
      vi.spyOn(db.client, 'from').mockImplementation((t: string) => {
        if (t === 'youtube_videos') return { select: () => ({ eq: () => ({ not: () => new Promise(() => {}) }) }) } as never
        return from(t)
      })
      const falhas: string[] = []
      const p = criteriosRetencao({ supabase: db.client, channels: [CANAL], falhas, relogio: criarRelogio() })
      await vi.advanceTimersByTimeAsync(3_100)
      await p
      expect(falhas).toEqual([naoAvaliou('Canal A', 'sem tempo')])
    })

    it('a leitura da lista gastou o prazo: a contagem nem é pedida, "(sem tempo)"', async () => {
      const db = fakeSupabase({ youtube_videos: [video(1)] })
      db.rpcHandlers[FN] = () => Promise.resolve().then(() => { vi.setSystemTime(Date.now() + 3_500); return { data: [], error: null } })
      const falhas = await rodar(db)
      expect(falhas).toEqual([naoAvaliou('Canal A', 'sem tempo')])
      expect(db.leituras.youtube_videos).toBeUndefined()
    })

    it('dois canais: o vazio com vídeos fica vermelho, o vazio sem vídeo fica verde, e cada um é contado pelo seu id', async () => {
      const db = fakeSupabase({ youtube_videos: [video(1, { channel_id: 'ch-2' }), video(2, { channel_id: 'ch-2' })] })
      db.rpcHandlers[FN] = () => ({ data: [], error: null })
      expect(await rodar(db, [CANAL, OUTRO])).toEqual([naoAvaliou('Canal B', 'lista vazia, mas o canal tem 2 vídeos')])
    })

    it('executar duas vezes não duplica a nota', async () => {
      const db = dbVazio([video(1)])
      const falhas: string[] = []
      const ctx = { supabase: db.client, channels: [CANAL], falhas, relogio: criarRelogio() }
      await criteriosRetencao(ctx)
      await criteriosRetencao(ctx)
      expect(falhas).toEqual([semAvaliar(1)])
    })
  })

  describe('o tempo', () => {
    it('leitura que não volta em 3 s: "(sem tempo)" e nenhuma nota de atraso', async () => {
      const db = fakeSupabase()
      travando(db)
      const falhas: string[] = []
      const p = criteriosRetencao({ supabase: db.client, channels: [CANAL], falhas, relogio: criarRelogio() })
      await vi.advanceTimersByTimeAsync(3_100)
      await p
      expect(falhas).toEqual([naoAvaliou('Canal A', 'sem tempo')])
    })

    it('o prazo é um só para todos os canais: o segundo sai "(sem tempo)" sem chamar a rpc', async () => {
      const db = fakeSupabase()
      travando(db)
      const falhas: string[] = []
      const p = criteriosRetencao({ supabase: db.client, channels: [CANAL, OUTRO], falhas, relogio: criarRelogio() })
      await vi.advanceTimersByTimeAsync(3_100)
      await p
      expect(falhas).toEqual([naoAvaliou('Canal A', 'sem tempo'), naoAvaliou('Canal B', 'sem tempo')])
      expect(db.rpcCalls).toHaveLength(1)
    })

    it('prazo já vencido na entrada (relógio com 297 s): a mesma nota e a rpc NÃO é chamada', async () => {
      const db = dbCom([comLinha('a', 9)])
      const falhas = await rodar(db, [CANAL, OUTRO], criarRelogio(Date.now() - 297_000))
      expect(falhas).toEqual([naoAvaliou('Canal A', 'sem tempo'), naoAvaliou('Canal B', 'sem tempo')])
      expect(db.rpcCalls).toEqual([])
    })

    it('relógio com 300 s decorridos: o mesmo', async () => {
      const db = dbCom([])
      const falhas = await rodar(db, [CANAL], criarRelogio(Date.now() - 300_000))
      expect(falhas).toEqual([naoAvaliou('Canal A', 'sem tempo')])
      expect(db.rpcCalls).toEqual([])
    })

    it('relógio com 280 s (os 270 s do passo venceram, os critérios ainda têm prazo): lê normalmente', async () => {
      const db = dbCom([comLinha('abc', 9)])
      const falhas = await rodar(db, [CANAL], criarRelogio(Date.now() - 280_000))
      expect(falhas).toEqual([nota('Canal A', 1, 'abc')])
    })

    it('o prazo vence entre os canais: o primeiro foi avaliado, o segundo sai "(sem tempo)"', async () => {
      const db = fakeSupabase()
      db.rpcHandlers[FN] = (a) => {
        if (a.p_channel_id === 'ch-1') {
          // a leitura do primeiro canal volta (a tempo) mas gastou o prazo inteiro
          return Promise.resolve().then(() => {
            vi.setSystemTime(Date.now() + 3_500)
            return { data: [comLinha('a1', 9)], error: null }
          })
        }
        return { data: [comLinha('b1', 9)], error: null }
      }
      const falhas = await rodar(db, [CANAL, OUTRO])
      expect(falhas).toEqual([nota('Canal A', 1, 'a1'), naoAvaliou('Canal B', 'sem tempo')])
      expect(db.rpcCalls).toHaveLength(1)
    })
  })
})

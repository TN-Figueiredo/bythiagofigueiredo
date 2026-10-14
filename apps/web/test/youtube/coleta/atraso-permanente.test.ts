// @vitest-environment node
// Regra pura do fim do alarme (A5 E6/E8, Tarefa 2b). `youtubeNaoDevolveu` é a MESMA regra de
// `diario_falhas_4d` em `yt_own_retention_facts` (migration da Tarefa 1a, apêndice B do plano): os
// casos abaixo são os do teste de fatos em SQL (Tarefa 1a). Mudou um, mude o outro.
import { describe, it, expect } from 'vitest'
import {
  ATRASO,
  youtubeNaoDevolveu,
  separarPermanentes,
  type Atrasado,
  type TentativaDoDiario,
} from '@/lib/youtube/coleta/atraso-permanente'

const t = (outcome: string, http_status: number | null, error: string | null): TentativaDoDiario => ({
  outcome,
  http_status,
  error,
})

const v = (ytId: string, diasAtrasado: number, falhasDoDiario4d: number | null): Atrasado => ({
  ytId,
  diasAtrasado,
  falhasDoDiario4d,
})

const candidatos = (n: number, desde = 0): Atrasado[] =>
  Array.from({ length: n }, (_, i) => v(`c${desde + i}`, 3, 4))

describe('ATRASO', () => {
  it('3 dias de vermelho e 4 dias de tentativa', () => {
    expect(ATRASO).toEqual({ diasDeVermelho: 3, diasDeTentativa: 4 })
  })
})

describe('youtubeNaoDevolveu: sim (o YouTube não devolveu o vídeo)', () => {
  it.each<[string, TentativaDoDiario]>([
    ['sem_dado_na_janela', t('sem_dado_na_janela', null, null)],
    ['sem_dado_na_janela, mesmo com status e erro soltos', t('sem_dado_na_janela', 200, 'qualquer')],
    ['erro_http 404 com http_404', t('erro_http', 404, 'http_404')],
    ['erro_http 404 com http_404_notFound', t('erro_http', 404, 'http_404_notFound')],
    ['erro_http 404 com o formato antigo HTTP 404 notFound', t('erro_http', 404, 'HTTP 404 notFound')],
    ['erro_http 404 com error nulo', t('erro_http', 404, null)],
    ['erro_http 410', t('erro_http', 410, 'http_410')],
    ['erro_http 403 http_403_forbidden', t('erro_http', 403, 'http_403_forbidden')],
  ])('%s', (_nome, tentativa) => {
    expect(youtubeNaoDevolveu(tentativa)).toBe(true)
  })
})

describe('youtubeNaoDevolveu: não (falha nossa ou de cota)', () => {
  it.each<[string, TentativaDoDiario]>([
    ['erro_http sem status com erro_de_banco', t('erro_http', null, 'erro_de_banco')],
    ['forma_inesperada com status 200', t('forma_inesperada', 200, 'forma_inesperada')],
    ['forma_inesperada sem status', t('forma_inesperada', null, 'forma_inesperada')],
    ['excecao', t('excecao', null, 'excecao')],
    ['erro_http 500', t('erro_http', 500, 'http_500')],
    ['erro_http 429', t('erro_http', 429, 'http_429')],
    ['erro_http 400', t('erro_http', 400, 'http_400')],
    ['erro_http 403 http_403_quotaExceeded', t('erro_http', 403, 'http_403_quotaExceeded')],
    ['erro_http 403 http_403_rateLimitExceeded', t('erro_http', 403, 'http_403_rateLimitExceeded')],
    ['erro_http 403 http_403_userRateLimitExceeded', t('erro_http', 403, 'http_403_userRateLimitExceeded')],
    ['erro_http 403 http_403_concurrentLimitExceeded', t('erro_http', 403, 'http_403_concurrentLimitExceeded')],
    ['erro_http 403 formato antigo HTTP 403 dailyLimitExceeded', t('erro_http', 403, 'HTTP 403 dailyLimitExceeded')],
    ['erro_http 403 formato antigo HTTP 403 quotaExceeded', t('erro_http', 403, 'HTTP 403 quotaExceeded')],
    ['ok', t('ok', 200, null)],
    ['nao_alcancado_orcamento', t('nao_alcancado_orcamento', null, null)],
    ['sem_autorizacao', t('sem_autorizacao', null, null)],
    ['schema_ausente', t('schema_ausente', null, null)],
    ['outcome desconhecido', t('inventado', 404, 'http_404')],
    ['outcome vazio', t('', 404, null)],
  ])('%s', (_nome, tentativa) => {
    expect(youtubeNaoDevolveu(tentativa)).toBe(false)
  })

  it('erro_http com status 403 mas de cota continua falso; sem a palavra de cota, é verdadeiro', () => {
    expect(youtubeNaoDevolveu(t('erro_http', 403, 'http_403_quotaExceeded'))).toBe(false)
    expect(youtubeNaoDevolveu(t('erro_http', 403, 'http_403_forbidden'))).toBe(true)
  })
})

describe('separarPermanentes', () => {
  it('sobe (fica vermelho): atrasado há 2 dias, 4 falhas', () => {
    const a = v('a', 2, 4)
    expect(separarPermanentes([a], 35)).toEqual({ vermelho: [a], acaoDoDono: [], pane: false })
  })

  it.each([3, 2, 1, 0])('sobe: atrasado há 3 dias, só %i falha(s) (um dia sem tentativa ou de orçamento)', (falhas) => {
    const a = v('a', 3, falhas)
    expect(separarPermanentes([a], 35)).toEqual({ vermelho: [a], acaoDoDono: [], pane: false })
  })

  it('sobe: atrasado há 9 dias e falhasDoDiario4d nulo (não lido)', () => {
    const a = v('a', 9, null)
    expect(separarPermanentes([a], 35)).toEqual({ vermelho: [a], acaoDoDono: [], pane: false })
  })

  it('não sobe: atrasado há 3 dias, 4 falhas, 1 de 35', () => {
    const a = v('a', 3, 4)
    expect(separarPermanentes([a], 35)).toEqual({ vermelho: [], acaoDoDono: [a], pane: false })
  })

  it('não sobe: a fronteira é 3 dias (>=), e mais dias continuam ação do dono', () => {
    const tres = v('tres', 3, 4)
    const nove = v('nove', 9, 4)
    expect(separarPermanentes([tres, nove], 35)).toEqual({ vermelho: [], acaoDoDono: [tres, nove], pane: false })
  })

  it('pane: 18 candidatos de 35, todos em vermelho', () => {
    const lista = candidatos(18)
    const r = separarPermanentes(lista, 35)
    expect(r.pane).toBe(true)
    expect(r.vermelho).toEqual(lista)
    expect(r.acaoDoDono).toEqual([])
  })

  it('pane: os que não eram candidatos também ficam em vermelho, na ordem de entrada', () => {
    const lista = [v('x', 1, null), ...candidatos(18), v('y', 9, 3)]
    const r = separarPermanentes(lista, 35)
    expect(r.pane).toBe(true)
    expect(r.vermelho).toEqual(lista)
    expect(r.acaoDoDono).toEqual([])
  })

  it('não é pane: 17 de 35, os 17 em acaoDoDono', () => {
    const lista = candidatos(17)
    const r = separarPermanentes(lista, 35)
    expect(r.pane).toBe(false)
    expect(r.acaoDoDono).toEqual(lista)
    expect(r.vermelho).toEqual([])
  })

  it('não é pane: separa os candidatos dos demais, cada um no seu lugar e na ordem de entrada', () => {
    const c1 = v('c1', 5, 4)
    const n1 = v('n1', 1, 4)
    const c2 = v('c2', 3, 4)
    const n2 = v('n2', 8, null)
    expect(separarPermanentes([c1, n1, c2, n2], 35)).toEqual({ vermelho: [n1, n2], acaoDoDono: [c1, c2], pane: false })
  })

  it('canal par: 2 de 4 é metade, então pane; 1 de 4 não', () => {
    expect(separarPermanentes(candidatos(2), 4).pane).toBe(true)
    expect(separarPermanentes(candidatos(1), 4).pane).toBe(false)
  })

  it('canal de 1 vídeo com o vídeo candidato: vermelho, pane (1 de 1 é metade ou mais)', () => {
    const a = v('a', 3, 4)
    expect(separarPermanentes([a], 1)).toEqual({ vermelho: [a], acaoDoDono: [], pane: true })
  })

  it('lista vazia: três listas vazias, pane falso (com qualquer tamanho de canal)', () => {
    for (const elegiveis of [35, 1, 0, -3]) {
      expect(separarPermanentes([], elegiveis)).toEqual({ vermelho: [], acaoDoDono: [], pane: false })
    }
  })

  it('elegiveis 0 com candidato: vermelho (nunca ação do dono sem saber o tamanho do canal)', () => {
    const a = v('a', 3, 4)
    expect(separarPermanentes([a], 0)).toEqual({ vermelho: [a], acaoDoDono: [], pane: true })
  })

  it('elegiveis negativo ou NaN com candidato: vermelho', () => {
    const a = v('a', 3, 4)
    expect(separarPermanentes([a], -1)).toEqual({ vermelho: [a], acaoDoDono: [], pane: true })
    expect(separarPermanentes([a], Number.NaN)).toEqual({ vermelho: [a], acaoDoDono: [], pane: true })
  })

  it('diasAtrasado não numérico (NaN) nunca vira ação do dono', () => {
    const a = v('a', Number.NaN, 4)
    expect(separarPermanentes([a], 35)).toEqual({ vermelho: [a], acaoDoDono: [], pane: false })
  })

  it('não muda a lista de entrada e devolve os mesmos objetos (inclusive campos extras)', () => {
    const a = { ...v('a', 3, 4), titulo: 'extra' }
    const entrada = [a]
    const r = separarPermanentes(entrada, 35)
    expect(entrada).toEqual([a])
    expect(r.acaoDoDono[0]).toBe(a)
  })
})

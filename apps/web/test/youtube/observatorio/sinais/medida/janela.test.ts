// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { JANELA_DIAS } from '@/lib/youtube/coleta/e11-config'
import { ORIGEM_DE_BUSCA } from '@/lib/youtube/reporting/codigos'
import {
  CODIGO_DA_METRICA,
  FONTE_DA_METRICA,
  REGRA_D2,
  montarPares,
  contarProprios,
  type EntradaPares,
  type ProprioD2,
} from '@/lib/youtube/observatorio/sinais/medida/regra-d2'
import { janelasDoPar, prontoParaFechar, somarJanela } from '@/lib/youtube/observatorio/sinais/medida/janela'
import type { EstadoValor } from '@/lib/youtube/observatorio/proprio/dimensoes-estado'

const PUB = '2026-09-15T12:00:00Z' // dia PT 2026-09-15 -> pre [08-18, 09-14]
const prop = (id: string, publicadoEm: string, chaves: string[] = [], semLugar = false): ProprioD2 =>
  ({ id, youtubeId: `yt-${id}`, publicadoEm, chaves, semLugar })

function entrada(p: Partial<EntradaPares> = {}): EntradaPares {
  return {
    pares: [{ id: 'p1', chave: 'k1', publicadoEm: PUB, chavesEmEvento: ['k9'] }],
    vistosPorChave: new Map(),
    proprios: [prop('a', '2026-06-01T00:00:00Z', ['k1']), prop('c', '2026-06-02T00:00:00Z', ['k2'])],
    alvoDeEvidence: new Map([['p1', ['yt-a']]]),
    v0: '2026-06-01T00:00:00Z',
    hoje: '2026-10-28',
    ...p,
  }
}

describe('REGRA_D2', () => {
  it('constantes e nada de literal repetido da coleta', () => {
    expect(REGRA_D2.fechaAnalyticsEmDias).toBe(REGRA_D2.posDias + JANELA_DIAS + 1)
    expect(REGRA_D2.fechaAnalyticsEmDias).toBe(41)
    expect(REGRA_D2.fechaReportingEmDias).toBe(34)
    expect(`d2-v${REGRA_D2.versao}`).toBe('d2-v1')
  })
  it('códigos vêm de reporting/codigos', () => {
    expect(CODIGO_DA_METRICA.impressoes_busca).toBe(ORIGEM_DE_BUSCA)
    expect(CODIGO_DA_METRICA.impressoes_canal).toBe('4')
    expect(CODIGO_DA_METRICA.impressoes_sugeridos).toBe('7')
    expect(CODIGO_DA_METRICA.impressoes_inicio).toBe('3')
    expect(CODIGO_DA_METRICA.views_sugeridos).toBe('RELATED_VIDEO')
    expect(CODIGO_DA_METRICA.views_busca).toBe('YT_SEARCH')
    expect(CODIGO_DA_METRICA.views_inicio).toBe('SUBSCRIBER')
    expect(CODIGO_DA_METRICA.prova_related).toBe('7')
    expect(FONTE_DA_METRICA.views_total).toBe('R1')
    expect(FONTE_DA_METRICA.impressoes_total).toBe('R2')
    expect(FONTE_DA_METRICA.impressoes_busca).toBe('R3')
    expect(FONTE_DA_METRICA.views_sugeridos).toBe('R4')
    expect(FONTE_DA_METRICA.prova_related).toBe('R5')
  })
})

describe('montarPares', () => {
  it('par limpo: âncora é a publicação, alvo e controle, chaves_em_evento passa', () => {
    const [p] = montarPares(entrada())
    expect(p!.descarte).toBeNull()
    expect(p!.pubDia).toBe('2026-09-15')
    expect(p!.preInicio).toBe('2026-08-18')
    expect(p!.preFim).toBe('2026-09-14')
    expect(p!.posInicio).toBe('2026-09-16')
    expect(p!.posFim).toBe('2026-10-15')
    expect(p!.alvo).toEqual(['yt-a'])
    expect(p!.controle).toEqual(['yt-c'])
    expect(p!.chavesEmEvento).toEqual(['k9'])
  })
  it('outro da mesma chave em pub-10 -> pre_contaminado; em pub-29 -> limpo; no próprio dia não conta', () => {
    const v = (iso: string) => montarPares(entrada({ vistosPorChave: new Map([['k1', [iso]]]) }))[0]!
    expect(v('2026-09-05T12:00:00Z').descarte).toBe('pre_contaminado')
    expect(v('2026-08-17T12:00:00Z').descarte).toBeNull()
    expect(v(PUB).descarte).toBeNull()
    expect(v('2026-09-14T12:00:00Z').descarte).toBe('pre_contaminado')
  })
  it('pub-28 < V0-2 -> contaminacao_desconhecida; v0 nulo idem', () => {
    expect(montarPares(entrada({ v0: '2026-08-25T00:00:00Z' }))[0]!.descarte).toBe('contaminacao_desconhecida')
    expect(montarPares(entrada({ v0: '2026-08-20T00:00:00Z' }))[0]!.descarte).toBeNull() // 08-18 >= 08-18
    expect(montarPares(entrada({ v0: null }))[0]!.descarte).toBe('contaminacao_desconhecida')
  })
  it('vídeo nosso publicado em pub-5 fica fora dos dois braços', () => {
    const [p] = montarPares(entrada({ proprios: [prop('a', '2026-06-01T00:00:00Z', ['k1']), prop('c', '2026-06-02T00:00:00Z'), prop('n', '2026-09-10T12:00:00Z')],
      alvoDeEvidence: new Map([['p1', ['yt-a', 'yt-n']]]) }))
    expect(p!.alvo).toEqual(['yt-a'])
    expect(p!.controle).toEqual(['yt-c'])
  })
  it('alvo vem de evidence mesmo se a semente de lugar mudou (I6); D20: alvo não depende de desempenho', () => {
    const [p] = montarPares(entrada({ proprios: [prop('a', '2026-06-01T00:00:00Z', ['kNOVA']), prop('c', '2026-06-02T00:00:00Z', ['k2'])] }))
    expect(p!.alvo).toEqual(['yt-a'])
    expect(p!.controle).toEqual(['yt-c'])
  })
  it('sem alvo / sem controle', () => {
    expect(montarPares(entrada({ alvoDeEvidence: new Map() }))[0]!.descarte).toBe('sem_alvo')
    expect(montarPares(entrada({ alvoDeEvidence: new Map([['p1', ['yt-a']]]), proprios: [prop('a', '2026-06-01T00:00:00Z', ['k1'])] }))[0]!.descarte).toBe('sem_controle')
  })
  it('vídeo sem lugar fica fora e é contado', () => {
    const proprios = [prop('a', '2026-06-01T00:00:00Z', ['k1']), prop('c', '2026-06-02T00:00:00Z'), prop('s', '2026-06-03T00:00:00Z', [], true)]
    const [p] = montarPares(entrada({ proprios }))
    expect(p!.controle).toEqual(['yt-c'])
    expect(contarProprios(proprios).semLugar).toBe(1)
  })
})

describe('janelas e fecho', () => {
  const par = montarPares(entrada())[0]!
  it('janelas excluem o dia da publicação', () => {
    const j = janelasDoPar('2026-09-15')
    expect(j.pre).toHaveLength(28)
    expect(j.pre[0]).toBe('2026-08-18')
    expect(j.pre.at(-1)).toBe('2026-09-14')
    expect(j.pos).toHaveLength(30)
    expect(j.pos[0]).toBe('2026-09-16')
    expect(j.pos.at(-1)).toBe('2026-10-15')
  })
  it('fim do horário de verão: 2026-11-01T07:30Z cai no dia PT 2026-11-01, pré começa em 2026-10-04', () => {
    const [p] = montarPares(entrada({ pares: [{ id: 'q', chave: 'k1', publicadoEm: '2026-11-01T07:30:00Z', chavesEmEvento: [] }], alvoDeEvidence: new Map([['q', ['yt-a']]]), hoje: '2026-12-30' }))
    expect(p!.pubDia).toBe('2026-11-01')
    expect(p!.preInicio).toBe('2026-10-04')
  })
  const cob = (r: string | null, a: string | null) => ({ ateReporting: r, ateAnalytics: a })
  it('R2 coberto e R4 não em pub+34: views aguarda até pub+41', () => {
    const c = cob('2026-10-16', '2026-10-05')
    expect(prontoParaFechar(par, 'impressoes_total', '2026-10-19', c)).toBe('fecha')
    expect(prontoParaFechar(par, 'views_sugeridos', '2026-10-19', c)).toBe('aguarda')
    expect(prontoParaFechar(par, 'views_total', '2026-10-19', c)).toBe('aguarda')
    expect(prontoParaFechar(par, 'views_total', '2026-10-26', cob('2026-10-16', '2026-10-15'))).toBe('fecha')
    expect(prontoParaFechar(par, 'views_total', '2026-10-26', cob('2026-10-16', '2026-10-14'))).toBe('aguarda')
  })
  it('reporting: exige end_time >= pub+31 e hoje >= pub+34', () => {
    expect(prontoParaFechar(par, 'impressoes_busca', '2026-10-19', cob('2026-10-15', null))).toBe('aguarda')
    expect(prontoParaFechar(par, 'impressoes_busca', '2026-10-18', cob('2026-10-16', null))).toBe('aguarda')
    expect(prontoParaFechar(par, 'impressoes_busca', '2026-10-19', cob(null, null))).toBe('aguarda')
  })
  it('só R5 atrasado espera; pub+60 desiste', () => {
    const c = cob('2026-10-16', '2026-10-15')
    expect(prontoParaFechar(par, 'prova_related', '2026-10-19', cob('2026-10-10', '2026-10-15'))).toBe('aguarda')
    expect(prontoParaFechar(par, 'views_total', '2026-10-26', c)).toBe('fecha')
    expect(prontoParaFechar(par, 'prova_related', '2026-11-14', cob('2026-10-10', null))).toBe('desiste')
    expect(prontoParaFechar(par, 'views_total', '2026-11-13', cob(null, null))).toBe('aguarda')
    expect(prontoParaFechar(par, 'views_total', '2026-11-14', cob(null, null))).toBe('desiste')
  })
})

describe('somarJanela', () => {
  const dias = ['2026-09-16', '2026-09-17', '2026-09-18']
  const v = (views: number): EstadoValor => ({ tipo: 'valor', views, minutos: null })
  const serie = new Map([['2026-09-16', 10], ['2026-09-17', 20], ['2026-09-18', 5]])
  it('soma valores e zero medido', () => {
    const est = (d: string): EstadoValor => (d === '2026-09-18' ? { tipo: 'zero_medido' } : v(serie.get(d)!))
    expect(somarJanela(serie, dias, est)).toEqual({ soma: 30 })
  })
  it('sem linha e soma < base -> nao_medido limiar (nunca 0)', () => {
    const est = (d: string): EstadoValor => (d === '2026-09-18' ? { tipo: 'zero_ou_abaixo_do_limiar' } : v(serie.get(d)!))
    expect(somarJanela(serie, dias, est)).toEqual({ nao_medido: 'limiar', diasSemCobertura: 1 })
  })
  it('fora da cobertura, em revisão, antes do início -> cobertura, com contagem', () => {
    const est = (d: string): EstadoValor =>
      d === '2026-09-16' ? { tipo: 'nao_medido', motivo: 'fora_da_cobertura', desde: null }
        : d === '2026-09-17' ? { tipo: 'em_revisao' }
          : { tipo: 'zero_ou_abaixo_do_limiar' }
    expect(somarJanela(serie, dias, est)).toEqual({ nao_medido: 'cobertura', diasSemCobertura: 3 })
  })
  it('valor com views nulas não vira zero', () => {
    const est = (): EstadoValor => ({ tipo: 'valor', views: null, minutos: null })
    expect(somarJanela(new Map(), dias, est)).toEqual({ nao_medido: 'cobertura', diasSemCobertura: 3 })
  })
})

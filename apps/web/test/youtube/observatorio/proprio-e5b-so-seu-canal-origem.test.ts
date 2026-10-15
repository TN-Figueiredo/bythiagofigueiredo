// @vitest-environment node
// E5b Tarefa 12: as cinco linhas da origem no cartão "Só o seu canal mede" (modelo puro). Os números saem do MESMO `buildOrigem` da página do canal (7 dias).
import { describe, it, expect } from 'vitest'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { FRASE_ABERTURA, TEXTO_ERRO_LINHA, linhasDaOrigem, montarSoSeuCanalDado, type EntradaOrigemCartao, type LinhaSoSeuCanal } from '@/app/cms/(authed)/youtube/competitors/_comparar/so-seu-canal-model'
import { buildOrigem } from '@/app/cms/(authed)/youtube/competitors/_proprio/origem-model'
import type { OrigemLida } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados-origem'
import type { AlcanceCanal, DiarioCanal, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import type { Fmt } from '@/lib/youtube/observatorio/fmt'
import type { LinhaBasica } from '@/lib/youtube/observatorio/proprio/dimensoes-estado'
import { ATE, HOJE, LIGADO, SENT_SITE, SENT_TERMO, TIP7, conjunto, detalhe, dims, dmF, dmyF, nF, ok, per, type Dia } from './proprio-origem-fixture'

const orig = (dimensoes = dims()): OrigemLida => ({ dimensoes, diario: null as never, diarioInteiro: null, trechos: 1 })
function cartao(over: Partial<EntradaOrigemCartao> & { dimensoes?: ReturnType<typeof dims> } = {}): EntradaOrigemCartao {
  const { dimensoes, ...resto } = over
  return {
    origem: ok(orig(dimensoes)), termos: ok(detalhe()), periodo: per('7', '7 dias', TIP7[0]!, ATE), hojePt: HOJE, ligadoEm: LIGADO,
    publicacoes: new Map([['v1', '2020-01-01']]), podeEditar: true, dm: dmF, dmy: dmyF, n: nF, ...resto,
  }
}
const por = (ls: LinhaSoSeuCanal[]) => Object.fromEntries(ls.map(l => [l.chave, l])) as Record<string, LinhaSoSeuCanal>
const ERRO: Privado<never> = { acesso: 'erro' }
const alcVazio: AlcanceCanal = { canalId: 'c', relatorios: [], linhas: [], ultimoRelatorio: null } as unknown as AlcanceCanal
const diario: DiarioCanal = { canalId: 'c', ultimoDia: null, linhas: [], descartados: 0 }
const F = { int: nF } as Pick<Fmt, 'int'>
const monta = (origem?: EntradaOrigemCartao) => montarSoSeuCanalDado({ nome: 'Canal', alcance: ok(alcVazio), diario: ok(diario), longos: [], dm: dmF, F, hoje: HOJE, origem })

describe('E5b T12: cinco linhas da origem', () => {
  it('a frase de abertura é a do mockup', () => {
    expect(FRASE_ABERTURA).toBe('Impressões, taxa de clique, origem das views e termos de pesquisa só chegam ao dono do canal.')
  })
  it('dado típico: os mesmos números da página do canal em 7 dias', () => {
    const ls = por(linhasDaOrigem(cartao()))
    expect(Object.keys(ls)).toEqual(['origem', 'termos', 'aparelho', 'pais', 'inscritos'])
    const pagina = buildOrigem({
      tela: 'canal', nivel: 'tudo', origem: ok(orig()), termos: ok(detalhe()), periodos: [per('7', '7 dias', TIP7[0]!, ATE)], publicadoEm: null, hojePt: HOJE, ligadoEm: LIGADO,
      publicacoes: new Map([['v1', '2020-01-01']]), podeEditar: true, dm: dmF, dmy: dmyF, n: nF,
    }).periodos[0]!.grupo.blocos
    const pctOrigem = pagina.find(b => b.id === 'origem')!.linhas.filter(l => l.tipo === 'valor').sort((a, b) => b.valor - a.valor).slice(0, 2).map(l => l.pctTexto)
    expect(ls.origem!.valor).toBe(`${pctOrigem[0]} da pesquisa do YouTube, ${pctOrigem[1]} de vídeos sugeridos`)
    expect(ls.origem!.valor).toBe('42% da pesquisa do YouTube, 18% de vídeos sugeridos')
    expect(ls.origem!.barra!.length).toBeGreaterThan(1)
    expect(ls.aparelho!.valor).toBe('62% em celular')
    expect(ls.pais!.valor).toBe('70% do Brasil')
    expect(ls.inscritos!.valor).toBe('64% de quem não é inscrito')
    expect(ls.termos!.valor).toBe(`“${SENT_TERMO}”`)
    for (const l of Object.values(ls)) expect(l.estado).toBe('medido')
  })
  it('magro: o YouTube omitiu quase tudo e ainda assim há número', () => {
    const lista = TIP7.map((d): [string, Dia] => [d, { base: 100, linhas: { YT_SEARCH: 5 } }])
    const ls = por(linhasDaOrigem(cartao({ dimensoes: dims({ trafego: conjunto('trafego', lista) }) })))
    expect(ls.origem!.estado).toBe('medido')
    expect(ls.origem!.valor).toMatch(/^5% da pesquisa/)
    expect(ls.origem!.nota).toBe('o YouTube omitiu 95% das views')
    expect(ls.origem!.fraco).toBe(true)
  })
  it('zero: "Zero medido: nenhuma view veio da pesquisa" e o 0 é medido', () => {
    const lista = TIP7.map((d): [string, Dia] => [d, { base: 0, linhas: {} }])
    const l = por(linhasDaOrigem(cartao({ dimensoes: dims({ trafego: conjunto('trafego', lista) }) }))).origem!
    expect(l.estado).toBe('zero')
    expect(l.valor).toBe('0')
    expect(l.nota).toBe('Zero medido: nenhuma view veio da pesquisa')
  })
  it('não medido: sem número e sem zero', () => {
    const lista = TIP7.map((d): [string, Dia] => [d, { base: 455, linhas: {} }])
    const c = conjunto<LinhaBasica>('trafego', lista, () => ({}), { tipo: 'nao_coletado' }, '2026-10-14')
    for (const v of c.videos) for (const d of v.dias) d.coberto = false
    const l = por(linhasDaOrigem(cartao({ dimensoes: dims({ trafego: c }) }))).origem!
    expect(l.estado).toBe('nao_medido')
    expect(l.valor).toBeNull()
  })
  it('em revisão: rótulo de leitor "origem em revisão" e nenhuma divisão', () => {
    const lista = TIP7.map((d, i): [string, Dia] => [d, { base: i === 0 ? 100 : 121, linhas: { YT_SEARCH: i === 0 ? 100 : 121 } }])
    lista[3]![1] = { base: 121, linhas: { YT_SEARCH: 121, RELATED_VIDEO: 34 } }
    const l = por(linhasDaOrigem(cartao({ dimensoes: dims({ trafego: conjunto('trafego', lista) }) }))).origem!
    expect(l.estado).toBe('em_revisao')
    expect(l.rotuloLeitor).toBe('origem em revisão')
    expect(l.valor).toBeNull()
  })
  it('erro só na origem: as quatro linhas do alcance continuam e as cinco novas dizem "Não conseguimos ler agora"', () => {
    const v = monta(cartao({ origem: ERRO }))
    const view = v.view!
    expect(view.linhas.map(l => l.chave).slice(0, 4)).toEqual(['impressoes', 'cliques', 'taxa', 'assistido'])
    const novas = view.linhas.slice(4)
    expect(novas).toHaveLength(5)
    for (const l of novas) { expect(l.estado).toBe('erro'); expect(l.nota).toBe(TEXTO_ERRO_LINHA); expect(l.valor).toBeNull() }
  })
  it('sem a entrada da origem: o cartão tem só as quatro linhas de antes', () => {
    expect(monta(undefined).view!.linhas.map(l => l.chave)).toEqual(['impressoes', 'cliques', 'taxa', 'assistido'])
  })
  it('quem não edita: a linha de termos é o cadeado (sem termo e sem endereço) e as outras quatro têm número', () => {
    const ls = por(linhasDaOrigem(cartao({ podeEditar: false, termos: { acesso: 'negado' } })))
    expect(ls.termos!.estado).toBe('bloqueado')
    expect(ls.termos!.cadeado).toBe(true)
    expect(ls.termos!.valor).toBeNull()
    for (const k of ['origem', 'aparelho', 'pais', 'inscritos']) expect(ls[k]!.valor).not.toBeNull()
    const json = JSON.stringify(ls)
    expect(json).not.toContain(SENT_TERMO)
    expect(json).not.toContain(SENT_SITE)
  })
  it('quem edita e os termos falham: erro na linha de termos, nunca o cadeado', () => {
    const ls = por(linhasDaOrigem(cartao({ termos: ERRO })))
    expect(ls.termos!.estado).toBe('erro')
    expect(ls.termos!.cadeado).toBeUndefined()
    expect(ls.origem!.estado).toBe('medido')
  })
  it('vídeo-lista não usa dia futuro: o período é de 7 dias terminando em ATE', () => {
    expect(TIP7[0]).toBe(addDays(ATE, -6))
  })
})

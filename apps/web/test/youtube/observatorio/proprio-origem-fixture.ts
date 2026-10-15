// Fixture sintética da origem das views (os números do mockup 12), compartilhada entre os testes do modelo e do cartão. Copiada de proprio-origem-model.test.ts.
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { type ConjuntoDim, type DiaLido, type EstadoConjunto, type LinhaBasica } from '@/lib/youtube/observatorio/proprio/dimensoes-estado'
import type { ConjuntoLido, DetalheCanal, DimensoesCanal, LinhaDetalhe } from '@/lib/youtube/observatorio/proprio/ler-dimensoes'
import type { EntradaOrigem, PeriodoEntrada } from '@/app/cms/(authed)/youtube/competitors/_proprio/origem-model'
import type { OrigemLida } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados-origem'

export const HOJE = '2026-10-13', ATE = '2026-10-11', LIGADO = '2026-10-04'
export const dmF = (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7)
export const dmyF = (d: string) => dmF(d) + '/' + d.slice(0, 4)
export const nF = (x: number) => x.toLocaleString('pt-BR')
export const dias = (de: string, ate: string): string[] => { const o: string[] = []; for (let d = de; d <= ate; d = addDays(d, 1)) o.push(d); return o }

export type Dia = { base: number | null; linhas: Record<string, number> }
export function conjunto<L extends LinhaBasica>(c: ConjuntoDim, lista: Array<[string, Dia]>, extra: (v: string, n: number) => Partial<L> = () => ({}), estado: EstadoConjunto = { tipo: 'coletado' }, desde: string = LIGADO): ConjuntoLido<L> {
  const d = lista.map(([dia, x]): DiaLido<L> => ({
    dia, coberto: true, baseMedida: x.base !== null, base: x.base, antesDoInicio: false, desde,
    linhas: Object.entries(x.linhas).map(([v, views], i) => ({ valor: v, views, minutos: null, ...extra(v, i) } as unknown as L)),
  }))
  return { conjunto: c, estado, videos: [{ ytId: 'v1', dias: d }] }
}
export const MED = dias('2026-10-04', ATE) // 8 dias
export const TIP7 = dias(addDays(ATE, -6), ATE) // 7 dias
// 3.185 = 1.338 + 573 + 478 + 319 + 223 + 76 + 178 (omitido) em 7 dias, 455 por dia
export const dia7 = (i: number): Dia => i < 6
  ? { base: 455, linhas: { YT_SEARCH: 191, RELATED_VIDEO: 82, SUBSCRIBER: 68, SHORTS: 45, EXT_URL: 31, PLAYLIST: 10 } }
  : { base: 455, linhas: { YT_SEARCH: 192, RELATED_VIDEO: 81, SUBSCRIBER: 70, SHORTS: 49, EXT_URL: 37, PLAYLIST: 16 } }

export function dims(over: Partial<Record<ConjuntoDim, ConjuntoLido<LinhaBasica>>> = {}, lista: string[] = TIP7): DimensoesCanal {
  const t = lista.map((d, i): [string, Dia] => [d, dia7(i)])
  const aparelho = lista.map((d): [string, Dia] => [d, { base: 455, linhas: { 'MOBILE|ANDROID': 280, 'DESKTOP|WINDOWS': 100, 'TV|X': 55, 'TABLET|IOS': 10 } }])
  const pais = lista.map((d): [string, Dia] => [d, { base: 455, linhas: { BR: 320, PT: 45, US: 30, ES: 20, AR: 10, FR: 9, DE: 8, IT: 7, MX: 6 } }])
  const insc = lista.map((d): [string, Dia] => [d, { base: 455, linhas: { SUBSCRIBED: 160, UNSUBSCRIBED: 290 } }])
  const alc = lista.map((d): [string, Dia] => [d, { base: 5900, linhas: { 'YT_SEARCH|MOBILE|ANDROID': 3000, 'RELATED_VIDEO|MOBILE|ANDROID': 1800, 'EXT_URL|MOBILE|ANDROID': 100, 'SHORTS|MOBILE|ANDROID': 900 } }])
  const extraAlc = (): Partial<LinhaBasica> => ({})
  return {
    canalId: 'c', de: lista[0]!, ate: lista[lista.length - 1]!, descartados: 0,
    conjuntos: {
      trafego: over.trafego ?? conjunto('trafego', t), dispositivo: over.dispositivo ?? conjunto('dispositivo', aparelho), pais: over.pais ?? conjunto('pais', pais),
      inscrito: over.inscrito ?? conjunto('inscrito', insc), alcance_dim: over.alcance_dim ?? conjunto('alcance_dim', alc, extraAlc),
    } as DimensoesCanal['conjuntos'],
  }
}
export const SENT_TERMO = 'sentinela-termo-xyz', SENT_SITE = 'sentinela.example'
export function detalhe(lista: string[] = TIP7, vazio = false): DetalheCanal {
  const d = lista.map((dia): DiaLido<LinhaDetalhe> => ({
    dia, coberto: true, baseMedida: true, base: 455, antesDoInicio: false, desde: LIGADO,
    linhas: vazio ? [] : [
      { valor: '5|h1', sourceType: '5', detail: SENT_TERMO, rotulo: 'Pesquisa', catalogado: true, tipoDetalhe: 'termo' as never, views: 10, minutos: null },
      { valor: '9|h2', sourceType: '9', detail: SENT_SITE, rotulo: 'Site', catalogado: true, tipoDetalhe: 'site' as never, views: 5, minutos: null },
    ],
  }))
  return { canalId: 'c', de: lista[0]!, ate: lista[lista.length - 1]!, descartados: 0, conjunto: { conjunto: 'detalhe', estado: { tipo: 'coletado' }, videos: [{ ytId: 'v1', dias: d }] } }
}
export const ok = <T,>(dado: T) => ({ acesso: 'ok' as const, dado })
export const per = (id: string, rotulo: string, de: string, ate: string, total: number | null = 3185, v: PeriodoEntrada['videosDoTotal'] = { naConta: 1, fora: 0, parados: 0, paradosDesde: null, comBuraco: 0 }): PeriodoEntrada => ({ id, rotulo, de, ate, totalDoPeriodo: total, videosDoTotal: v })
export function entrada(over: Partial<EntradaOrigem> & { dimensoes?: DimensoesCanal } = {}): EntradaOrigem {
  const { dimensoes, ...resto } = over
  const origem: OrigemLida = { dimensoes: dimensoes ?? dims(), diario: null as never, diarioInteiro: null, trechos: 1 }
  return {
    tela: 'canal', nivel: 'tudo', origem: ok(origem), termos: ok(detalhe()), periodos: [per('7', '7 dias', TIP7[0]!, ATE)], publicadoEm: null, hojePt: HOJE, ligadoEm: LIGADO,
    publicacoes: new Map([['v1', '2020-01-01']]), podeEditar: true, dm: dmF, dmy: dmyF, n: nF, ...resto,
  }
}

// Fixture compartilhada dos testes das trocas (T22b): mesmas peças do proprio-trocas-model.test.ts, para a tela, os mundos e a ordem das seções.
import { addDays, dayPt } from '@/lib/youtube/coleta/day-pt'
import type { VersaoPropria, VersoesCanal } from '@/lib/youtube/observatorio/proprio-versoes/tipos'
import type { TesteAb } from '@/lib/youtube/observatorio/proprio/ler-testes-ab'
import type { AlcanceCanal, RelatorioDia } from '@/lib/youtube/observatorio/proprio/tipos'
import type { TrocasLidas } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados-trocas'
import type { EntradaTrocas } from '@/app/cms/(authed)/youtube/competitors/_proprio/trocas-model'

export const YT = 'abcdefghijk', C = 'canal-1'
export const HOJE = '2026-11-17'
export const REG = '2026-10-07'
export const dm = (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7)
export const dmy = (d: string) => dm(d) + '/' + d.slice(0, 4)

export const meio = (d: string): string => `${d}T20:00:00.000Z`
let seq = 0
export function versao(over: Partial<VersaoPropria> & { dia?: string } = {}): VersaoPropria {
  const { dia = '2026-11-03', ...resto } = over
  seq++
  return {
    id: 'v' + seq, ytId: YT, campo: 'title', texto: 'TITULO-' + seq, hash: 'h' + seq, thumb: null, primeiroDia: dia, ultimoDia: dia,
    vistaDesde: meio(dia), vistaAte: meio(dia), janela: { de: meio(addDays(dia, -1)), ate: meio(dia) }, precisao: '1d',
    origem: 'fora_do_sistema', eventoAb: null, abTestId: null, abVariantId: null, preRegistro: false, corrente: true, ...resto,
  }
}
export const base = (campo: 'title' | 'thumb' = 'title') => versao({ campo, dia: REG, origem: 'linha_de_base', janela: null, primeiroDia: REG })
export function canal(versoes: VersaoPropria[], estado: Partial<{ atrasoDias: number; conferidoAte: string; desde: string }> = {}): VersoesCanal {
  return {
    canalId: C, estado: { estado: 'registrando', desde: REG, conferidoAte: HOJE, atrasoDias: 0, ...estado },
    videos: [{ ytId: YT, versoes, registro: { title: { estado: 'com_trocas', conferidoAte: HOJE }, thumb: { estado: 'sem_versao', conferidoAte: null }, desc: { estado: 'sem_versao', conferidoAte: null } } }],
  }
}
/** Alcance com um dia a cada dia de `de` a `ate`, imp e taxa fixos (`ausentes`: dias sem linha mas com relatório = zero medido). */
export function alcance(de: string, ate: string, imp = 1000, ctr = 0.05, extra: Partial<AlcanceCanal> = {}): AlcanceCanal {
  const relatorios: RelatorioDia[] = [], linhas: AlcanceCanal['linhas'] = []
  for (let d = de; d <= ate; d = addDays(d, 1)) {
    relatorios.push({ dia: d, status: 'baixado', normalizado: true })
    if (imp > 0) linhas.push({ ytId: YT, dia: d, imp, ctr })
  }
  return { canalId: C, relatorios, linhas, ultimoRelatorio: ate, descartados: 0, ...extra }
}
export const testeVazio: TrocasLidas['testes'] = { acesso: 'ok', dado: { testes: [], descartados: 0 } }
export function lidas(versoes: VersaoPropria[], over: Partial<TrocasLidas> = {}, estado: Parameters<typeof canal>[1] = {}): TrocasLidas {
  return { versoes: canal(versoes, estado), testes: testeVazio, motivoTestes: null, alcance: null, ...over }
}
export function entrada(l: TrocasLidas | 'negado' | 'erro', over: Partial<EntradaTrocas> = {}): EntradaTrocas {
  return {
    lidas: l === 'negado' ? { acesso: 'negado' } : l === 'erro' ? { acesso: 'erro' } : { acesso: 'ok', dado: l }, ytId: YT, publicadoEm: '2026-09-22', hojePt: HOJE, podeEditar: true,
    dm, dmy, quandoSp: iso => ({ dia: dm(iso.slice(0, 10)), hora: '02:00' }), diaPt: iso => dayPt(new Date(iso)), n: x => String(x), ...over,
  }
}
export const comAlcance = (versoes: VersaoPropria[], a: AlcanceCanal, desde = addDays(HOJE, -60), extra: Partial<TrocasLidas> = {}) =>
  lidas(versoes, { alcance: { acesso: 'ok', dado: { alcance: a, desde, primeiroRelatorio: a.relatorios[0]?.dia ?? null } }, ...extra })
export const teste = (over: Partial<TesteAb> = {}): TesteAb => ({ id: 't1', tipo: 'title', inicio: meio('2026-10-20'), pausadoEm: null, concluidoEm: meio('2026-11-02'), motivo: null, vencedorAplicadoEm: null, tituloOriginal: null, ciclos: [], status: 'completed', ...over })
export const todasAsFrases = (v: unknown): string => JSON.stringify(v)

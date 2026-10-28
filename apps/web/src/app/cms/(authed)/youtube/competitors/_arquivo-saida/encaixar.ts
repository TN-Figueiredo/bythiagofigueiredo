import 'server-only'
import { Fragment, createElement } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NOME_DA_TABELA, type CartaoDoTipo, type LinhaDoMes, type ModeloPagina } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { TABELAS_DA_SAIDA, lerEstadoDoMes, lerInterruptor, type EstadoDoMes, type TabelaDaSaida } from '@/lib/youtube/observatorio/arquivo-mensal/saida'
import { PecaTirarMes } from './peca-tirar-mes'
import { PecaInterruptor } from './peca-interruptor'
import { simularSaida, tirarMes, liberarEspaco, trazerDeVolta } from './acoes'

const ACOES = { simular: simularSaida, tirar: tirarMes, liberar: liberarEspaco, trazer: trazerDeVolta }
export interface CtxEncaixe { sb: SupabaseClient; site: string; por: string; ehAdmin: boolean }
type Fora = 'online' | 'destacado' | 'descartado'
type Saida = { tabela: TabelaDaSaida; fora: Fora }
const ehTabelaDaSaida = (t: string): t is TabelaDaSaida => Object.prototype.hasOwnProperty.call(TABELAS_DA_SAIDA, t)
/** As tabelas que a linha comanda, cada uma com o SEU estado (M6a T12 r1, Phil C1). Linha de M5 antiga ou do ensaio: a tabela única `tabela`/`fora`. Sem mês, nada. */
const saidasDe = (l: LinhaDoMes): Saida[] => {
  if (!l.mes) return []
  const bruto = l.saidas ?? (l.tabela && l.fora ? [{ tabela: l.tabela, fora: l.fora }] : [])
  return bruto.filter((x): x is Saida => ehTabelaDaSaida(x.tabela))
}
const chaveDoEstado = (tabela: string, mes: string): string => `${tabela}|${mes}`

/** Lê o estado de cada mês que oferece ação: o online mais antigo DE CADA TABELA e os destacados. Nunca um por linha (T + destacados chamadas). */
async function lerEstados(linhas: LinhaDoMes[], c: CtxEncaixe): Promise<Map<string, EstadoDoMes | null>> {
  const alvos = new Map<string, { tabela: TabelaDaSaida; mes: string }>()
  const maisAntigo = new Map<TabelaDaSaida, string>()
  for (const l of linhas) {
    for (const s of saidasDe(l)) {
      if (s.fora === 'destacado') alvos.set(chaveDoEstado(s.tabela, l.mes!), { tabela: s.tabela, mes: l.mes! })
      if (s.fora === 'online') { const a = maisAntigo.get(s.tabela); if (a === undefined || l.mes! < a) maisAntigo.set(s.tabela, l.mes!) }
    }
  }
  for (const [tabela, mes] of maisAntigo) alvos.set(chaveDoEstado(tabela, mes), { tabela, mes })
  const lidos = await Promise.all([...alvos.entries()].map(async ([k, a]) => [k, await lerEstadoDoMes(c.sb, c.site, a.tabela, a.mes, c.por)] as const))
  return new Map(lidos)
}

/** D-M5-14: preenche os slots `acoes` da página da M5, no servidor, sem mutar o modelo recebido. */
export async function encaixarSaida(modelo: ModeloPagina, c: CtxEncaixe): Promise<ModeloPagina> {
  const hojeSP = modelo.hojeSP
  if (hojeSP === undefined) return modelo   // M5 sem o relógio do banco: a página fica como a M5 a entrega
  const todas = [...modelo.tipos.flatMap(t => t.linhas), ...(modelo.teste?.linhas ?? [])]
  const [estados, serie, horaria] = await Promise.all([lerEstados(todas, c), lerInterruptor(c.sb, c.site, 'serie'), lerInterruptor(c.sb, c.site, 'horaria')])
  const linhaComAcao = (l: LinhaDoMes): LinhaDoMes => {
    // descartado: sem bloco; online que não é o mais antigo da SUA tabela: sem botão (nunca bloco vazio)
    const com = saidasDe(l).filter(s => s.fora === 'destacado' || (s.fora === 'online' && estados.has(chaveDoEstado(s.tabela, l.mes!))))
    if (com.length === 0) return l
    const peca = (s: Saida) => createElement(PecaTirarMes, { key: s.tabela, tabela: s.tabela, mes: l.mes!, estado: estados.get(chaveDoEstado(s.tabela, l.mes!)) ?? null, hojeSP, pctDoBanco: null, ehAdmin: c.ehAdmin, esperaDias: l.esperaDias ?? null, contado: null, acoes: ACOES, soBloco: true })
    // uma tabela só (horária, ensaio, M5 antiga): a peça direta. A série tem duas: cada bloco leva o nome da sua tabela (decisão do dono, 28/10)
    if (!l.saidas || l.saidas.length < 2) return { ...l, acoes: peca(com[0]!) }
    return { ...l, acoes: createElement(Fragment, null, ...com.map(s => createElement('div', { key: s.tabela }, createElement('p', null, NOME_DA_TABELA[s.tabela]), peca(s)))) }
  }
  const cartao = (t: CartaoDoTipo): CartaoDoTipo => t.tipo === 'texto' ? t : {
    ...t, linhas: t.linhas.map(linhaComAcao),
    acoes: createElement(PecaInterruptor, { classe: t.tipo, estado: t.tipo === 'serie' ? serie : horaria, envOn: true, hojeSP, ehAdmin: c.ehAdmin }),
  }
  return { ...modelo, tipos: modelo.tipos.map(cartao), teste: modelo.teste && { ...modelo.teste, linhas: modelo.teste.linhas.map(linhaComAcao) } }
}

import 'server-only'
import { createElement } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CartaoDoTipo, LinhaDoMes, ModeloPagina } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { TABELAS_DA_SAIDA, lerEstadoDoMes, lerInterruptor, type EstadoDoMes, type TabelaDaSaida } from '@/lib/youtube/observatorio/arquivo-mensal/saida'
import { PecaTirarMes } from './peca-tirar-mes'
import { PecaInterruptor } from './peca-interruptor'
import { simularSaida, tirarMes, liberarEspaco, trazerDeVolta } from './acoes'

const ACOES = { simular: simularSaida, tirar: tirarMes, liberar: liberarEspaco, trazer: trazerDeVolta }
export interface CtxEncaixe { sb: SupabaseClient; site: string; por: string; ehAdmin: boolean }
type Alvo = LinhaDoMes & { tabela: TabelaDaSaida; mes: string; fora: 'online' | 'destacado' | 'descartado' }
const ehTabelaDaSaida = (t: string): t is TabelaDaSaida => Object.prototype.hasOwnProperty.call(TABELAS_DA_SAIDA, t)
const temTabela = (l: LinhaDoMes): l is Alvo => !!l.tabela && ehTabelaDaSaida(l.tabela) && !!l.mes && !!l.fora

/** Lê o estado de cada mês que oferece ação: o online mais antigo de cada tabela e os destacados. Nunca um por linha (T + destacados chamadas). */
async function lerEstados(linhas: LinhaDoMes[], c: CtxEncaixe): Promise<Map<string, EstadoDoMes | null>> {
  const alvos = new Map<string, Alvo>()
  const maisAntigo = new Map<string, Alvo>()
  for (const l of linhas.filter(temTabela)) {
    if (l.fora === 'destacado') alvos.set(l.chave, l)
    if (l.fora === 'online') { const a = maisAntigo.get(l.tabela); if (!a || l.mes < a.mes) maisAntigo.set(l.tabela, l) }
  }
  for (const l of maisAntigo.values()) alvos.set(l.chave, l)
  const lidos = await Promise.all([...alvos.values()].map(async l => [l.chave, await lerEstadoDoMes(c.sb, c.site, l.tabela, l.mes, c.por)] as const))
  return new Map(lidos)
}

/** D-M5-14: preenche os slots `acoes` da página da M5, no servidor, sem mutar o modelo recebido. */
export async function encaixarSaida(modelo: ModeloPagina, c: CtxEncaixe): Promise<ModeloPagina> {
  const hojeSP = modelo.hojeSP
  if (hojeSP === undefined) return modelo   // M5 sem o relógio do banco: a página fica como a M5 a entrega
  const todas = [...modelo.tipos.flatMap(t => t.linhas), ...(modelo.teste?.linhas ?? [])]
  const [estados, serie, horaria] = await Promise.all([lerEstados(todas, c), lerInterruptor(c.sb, c.site, 'serie'), lerInterruptor(c.sb, c.site, 'horaria')])
  const linhaComAcao = (l: LinhaDoMes): LinhaDoMes => {
    if (!temTabela(l) || l.fora === 'descartado' || (l.fora === 'online' && !estados.has(l.chave))) return l   // online que não é o mais antigo: sem botão
    return { ...l, acoes: createElement(PecaTirarMes, { tabela: l.tabela, mes: l.mes, estado: estados.get(l.chave) ?? null, hojeSP, pctDoBanco: null, ehAdmin: c.ehAdmin, esperaDias: l.esperaDias ?? null, contado: null, acoes: ACOES, soBloco: true }) }
  }
  const cartao = (t: CartaoDoTipo): CartaoDoTipo => t.tipo === 'texto' ? t : {
    ...t, linhas: t.linhas.map(linhaComAcao),
    acoes: createElement(PecaInterruptor, { classe: t.tipo, estado: t.tipo === 'serie' ? serie : horaria, envOn: true, hojeSP, ehAdmin: c.ehAdmin }),
  }
  return { ...modelo, tipos: modelo.tipos.map(cartao), teste: modelo.teste && { ...modelo.teste, linhas: modelo.teste.linhas.map(linhaComAcao) } }
}

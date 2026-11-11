import 'server-only'
/**
 * A4 R5 T8: o leitor da ação `consultar`. Do pedido já traduzido ao `ResultadoDaConsulta`: conjunto do motor (`Observatory`), as medidas só dos canais
 * do conjunto (`carregarMedidasDoSite`, cache das telas) e o mapa de lugares (um por cálculo). Nenhuma conta nova (ordem, agregados e células são
 * do modelo puro da R3) e nenhum leitor cru: fica fora de `_acesso-ia/` e `_contexto-ia/` porque só aqui se abre o cliente de serviço.
 * Sem relógio próprio: quem corre contra o prazo é o `executar`. O site vem da página aberta (sessão ou prova da chave), nunca do pedido.
 */
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { Abridor } from '../_chrome/abridor'
import type { ResultadoDaConsulta } from '../_contexto-ia/empacotar-consulta'
import { montarConjunto } from '@/lib/youtube/observatorio/consulta/conjunto'
import { ordenar } from '@/lib/youtube/observatorio/consulta/ordem'
import { agregar } from '@/lib/youtube/observatorio/consulta/agregados'
import type { EntradaDoConjunto, LinhaDaConsulta, PedidoDaConsulta } from '@/lib/youtube/observatorio/consulta/tipos'
import { carregarMedidasDoSite, type MedidasDoSite } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'
import { estadoDoLugar, lerMapaDeLugares, lugaresDe, marcadosDe, semLinha, situacaoDoSlug, type MapaDeLugares } from '@/lib/youtube/observatorio/lugar/leitura'
import { calculoLigadoNoAmbiente, lerEstadoDaAba } from '@/lib/youtube/observatorio/sinais/leitura'
import { spDmHm } from '@/lib/youtube/observatorio/time'
import type { Observatory } from '@/lib/youtube/observatorio'

export type RecusaDaConsulta = 'lugar_desconhecido' | 'lugar_sem_calculo' | 'lugar_falhou' | 'nicho_desconhecido' | 'canais_nao_encontrados'
export interface RecusaMontada { recusa: RecusaDaConsulta; frase: string; ids?: string[] }

export const FRASES_DA_CONSULTA = {
  lugar_desconhecido: 'lugar desconhecido; a lista de lugares com dados está em definicoes',
  lugar_nunca: 'lugares nunca calculados neste site',
  lugar_desligado: 'lugares não calculados: tarefa desligada',
  lugar_falhou: 'não medido: leitura de lugares falhou; tente de novo',
  lugares_nao_carregaram: 'lugares não carregaram agora; a coluna lugares sai "não lido"',
  nicho_desconhecido: 'nicho desconhecido',
} as const

const SEM_MEDIDAS = (): MedidasDoSite => ({ porCanal: new Map(), extras: { lido: false, causa: 'tempo_esgotado' }, falhas: [], esgotou: 0, lidoEmMaisAntigo: null })

const iso = (ms: number): string => new Date(ms).toISOString()
const dh = (isoStr: string): string => spDmHm(Date.parse(isoStr))

/** Casa o id pedido com um canal CONCORRENTE: pelo uuid (sem diferenciar caixa) ou pelo `UC…` do endereço do canal. O próprio nunca casa. */
function acharCanal(obs: Observatory, pedido: string): string | null {
  const baixo = pedido.toLowerCase()
  const c = obs.channels.find((x) => !x.own && (x.id.toLowerCase() === baixo || x.url.endsWith('/channel/' + pedido)))
  return c ? c.id : null
}

/** Os lugares não derrubam a consulta sem filtro: o estado da aba que falha lança? vira `null`, como o retorno de erro dela. */
async function abaSegura(db: ReturnType<typeof getSupabaseServiceClient>, siteId: string, agoraMs: number): Promise<Awaited<ReturnType<typeof lerEstadoDaAba>>> {
  try { return await lerEstadoDaAba(db, siteId, new Date(agoraMs)) } catch { return null }
}

const maisDeUm = (slugs: readonly string[]): boolean =>
  slugs.filter((s) => s.startsWith('local:')).length > 1 || slugs.filter((s) => s.startsWith('pais:')).length > 1

export async function montarConsulta(abrir: Abridor, p: PedidoDaConsulta, agoraMs: number): Promise<ResultadoDaConsulta | RecusaMontada> {
  const { siteId, obs } = await abrir.observatorio()

  // 1. canais pedidos: uuid e UC do mesmo canal contam uma vez; o próprio e o que não existe vão para "não encontrados"
  let canalIds: string[] | undefined
  const naoAchados: string[] = []
  if (p.canalIds && p.canalIds.length > 0) {
    const achados = new Set<string>()
    for (const id of p.canalIds) {
      const c = acharCanal(obs, id)
      if (c) achados.add(c)
      else naoAchados.push(id)
    }
    if (achados.size === 0) return { recusa: 'canais_nao_encontrados', frase: `canais não encontrados: ${naoAchados.join(', ')}`, ids: naoAchados }
    canalIds = [...achados]
  }
  // 2. nicho desconhecido recusa (não cai no nicho salvo)
  if (p.nicho && p.nicho !== 'todos' && !obs.niches.some((n) => n.id === p.nicho)) return { recusa: 'nicho_desconhecido', frase: FRASES_DA_CONSULTA.nicho_desconhecido }
  const pedido: PedidoDaConsulta = { ...p, ...(canalIds ? { canalIds } : {}) }

  // 3. lugares: o estado da aba SEMPRE (a coluna `lugares` também lê o mapa e 'nunca' não pode colidir com cálculo existente), junto do slug quando há filtro
  const db = getSupabaseServiceClient()
  const ligado = calculoLigadoNoAmbiente()
  const [aba, slug] = await Promise.all([abaSegura(db, siteId, agoraMs), pedido.lugar ? situacaoDoSlug(db, pedido.lugar) : Promise.resolve(null)])
  const estado = estadoDoLugar(aba, ligado)
  if (pedido.lugar) {
    if (slug === 'falhou') return { recusa: 'lugar_falhou', frase: FRASES_DA_CONSULTA.lugar_falhou }
    if (slug === 'nao_existe') return { recusa: 'lugar_desconhecido', frase: FRASES_DA_CONSULTA.lugar_desconhecido }
    if (estado === 'falhou') return { recusa: 'lugar_falhou', frase: FRASES_DA_CONSULTA.lugar_falhou }
    // tarefa desligada SEM cálculo recusa; COM cálculo o mapa serve (estado ok/atrasado) e o cabeçalho avisa (decisão do controlador, Phil M-3)
    if (estado === 'nunca') return { recusa: 'lugar_sem_calculo', frase: FRASES_DA_CONSULTA.lugar_nunca }
    if (estado === 'desligado') return { recusa: 'lugar_sem_calculo', frase: FRASES_DA_CONSULTA.lugar_desligado }
  }
  let mapa: MapaDeLugares | null = null
  let mapaFalhou = false
  if ((estado === 'ok' || estado === 'atrasado') && aba) {
    try { mapa = await lerMapaDeLugares(db, siteId, aba.computado_em) } catch (e) {
      mapaFalhou = true
      Sentry.captureException(e, { tags: { component: 'observatorio', step: 'consultar-lugares' } })
    }
  }
  if (pedido.lugar && mapa === null) return { recusa: 'lugar_falhou', frase: FRASES_DA_CONSULTA.lugar_falhou }

  // 4. o conjunto SEM medidas e SEM o filtro de lugar: quem entra (para contar os que chegaram depois do cálculo) e de quais canais
  const marcados = pedido.lugar && mapa ? marcadosDe(mapa, pedido.lugar) : null
  const vazias = SEM_MEDIDAS()
  const previa = montarConjunto(pedido, { obs, medidas: vazias, marcados: null, agoraMs })
  const previaTodas = [...previa.longos, ...previa.shorts]
  const semLugarCalculado = pedido.lugar && mapa ? semLinha(mapa, previaTodas.map((l) => l.id)).length : 0
  const doConjunto = marcados ? previaTodas.filter((l) => marcados.has(l.id)) : previaTodas
  const canaisDoConjunto = [...new Set(doConjunto.map((l) => l.canalId))]

  // 5. medidas só dos canais do conjunto; leitura que lança por inteiro: todo canal "não carregou", o Sentry sabe, o desfecho segue ok
  let medidas: MedidasDoSite = vazias
  if (canaisDoConjunto.length > 0) {
    try {
      medidas = await carregarMedidasDoSite(db, { siteId, obs, canais: canaisDoConjunto, agoraMs })
    } catch (e) {
      Sentry.captureException(e, { tags: { component: 'observatorio', step: 'consultar-medidas' } })
      medidas = { ...vazias, porCanal: new Map(canaisDoConjunto.map((id) => [id, { naoCarregou: 'erro_do_banco' as const }])) }
    }
  }

  // 6. conjunto final, ordem, agregados (do conjunto inteiro) e corte por bloco
  const entrada: EntradaDoConjunto = { obs, medidas, marcados, agoraMs }
  const conjunto = montarConjunto(pedido, entrada)
  const ctx = { canalAtrasado: (id: string): boolean => { const s = obs.channel(id)?.sync.state; return s === 'atrasado' || s === 'erro' } }
  const formatos: Array<'longos' | 'shorts'> = pedido.formato === 'longos' ? ['longos'] : pedido.formato === 'shorts' ? ['shorts'] : ['longos', 'shorts']
  const todasElegiveis: LinhaDaConsulta[] = []
  const blocos = formatos.map((formato) => {
    const todas = conjunto[formato]
    todasElegiveis.push(...todas)
    const linhas = ordenar(todas, pedido, ctx).slice(0, pedido.limite)
    return { formato, linhas, agregado: agregar(todas, pedido, entrada), cortadasPorLimite: Math.max(0, todas.length - linhas.length) }
  })
  // a coluna `lugares` das linhas devolvidas: `null` = o mapa não foi lido; `null` do mapa (vídeo sem linha) fica `null` ("não lido")
  for (const b of blocos) for (const l of b.linhas) l.lugares = mapa ? lugaresDe(mapa, l.id) : null

  // 7. as fontes e as ausências escritas
  const canaisUsados = [...new Set(todasElegiveis.map((l) => l.canalId))]
  const lasts = canaisUsados.map((id) => obs.channel(id)?.sync.last ?? null)
  const boas = lasts.filter((x): x is number => x != null)
  const motor = boas.length > 0 ? iso(Math.min(...boas)) : null
  const canaisSemSync = canaisUsados.filter((id) => obs.channel(id)?.sync.last == null).map((id) => obs.channel(id)!.name)
  const canaisSemMedida = canaisUsados.flatMap((id) => {
    const c = medidas.porCanal.get(id)
    const nome = obs.channel(id)?.name ?? id
    if (c === undefined) return [{ nome, causa: 'medidas do canal não carregadas' }]
    return 'naoCarregou' in c ? [{ nome, causa: c.naoCarregou }] : []
  })
  const lugaresIso = mapa && aba?.computado_em ? iso(Date.parse(aba.computado_em)) : null
  const leituras = [motor, medidas.lidoEmMaisAntigo, mapa ? iso(mapa.lidoEm) : null].filter((x): x is string => x !== null)
  const leituraMaisAntiga = leituras.length > 0 ? leituras.reduce((a, b) => (a < b ? a : b)) : null

  let lugaresNota: string | undefined
  if (!pedido.lugar) {
    if (estado === 'falhou' || mapaFalhou) lugaresNota = FRASES_DA_CONSULTA.lugares_nao_carregaram
    else if (estado === 'nunca') lugaresNota = FRASES_DA_CONSULTA.lugar_nunca
    else if (estado === 'desligado') lugaresNota = FRASES_DA_CONSULTA.lugar_desligado
    else if (aba?.computado_em && !ligado) lugaresNota = `tarefa de lugares desligada; lugares calculados em ${dh(aba.computado_em)}`
    else if (estado === 'atrasado' && aba?.computado_em) lugaresNota = `lugares desatualizados desde ${dh(aba.computado_em)} (mais de 36 h sem novo cálculo)`
  }

  const r: ResultadoDaConsulta = {
    pedido, blocos,
    dadosDe: { motor, medidas: medidas.lidoEmMaisAntigo, lugares: lugaresIso },
    canaisSemMedida, canaisNaoEncontrados: naoAchados,
    ...(naoAchados.length > 0 ? { naoEncontrados: { quantos: naoAchados.length, de: p.canalIds?.length ?? naoAchados.length } } : {}),
    ...(canaisSemSync.length > 0 ? { canaisSemSync } : {}),
    ...(lugaresNota ? { lugaresNota } : {}),
    leituraMaisAntiga,
  }
  if (pedido.lugar && mapa && aba) {
    r.lugar = {
      estado: 'marcado', calculadoEm: aba.computado_em, atrasado: estado === 'atrasado', emRecalculo: mapa.versoes > 1,
      semLugarCalculado, maisDeUmLugar: todasElegiveis.filter((l) => { const s = lugaresDe(mapa, l.id); return s !== null && maisDeUm(s) }).length,
      maisDeUmLugarSobre: 'marcados', ...(!ligado ? { desligado: true } : {}),
    }
  }
  return r
}

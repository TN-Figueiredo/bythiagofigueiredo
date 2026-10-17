// A5 · E17 degrau 1, Tarefa 9: o registro de telas do botão "Perguntar a uma IA". Para cada tela em `existe`, a função que chama o `montar…` da página
// (a MESMA que monta a tela) e o empacotador dela. A ação (`contexto-ia-actions.ts`) é quem guarda, segmenta e registra; aqui só se monta o modelo.
// O `siteId` nunca é parâmetro: vem da guarda, dentro de cada `montar…`. Tela que não existe devolve `null` ("não encontrado").
import { telaExiste } from '@/lib/youtube/observatorio/contexto-ia/telas'
import type { EstadoDoPrivado, PacoteModelo, TelaId } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { montarCanais } from '../_canais/montar'
import { assistidoDoCanal, montarCanal, origemDoCanal } from '../_canal/montar'
import { montarVideo } from '../_historico/montar'
import { montarComparar } from '../_comparar/montar'
import { buildPar } from '../_comparar/par-model'
import { montarOutliers } from '../_outliers/montar'
import { montarInsights } from '../_insights/montar'
import { montarMudancas } from '../_mudancas/montar'
import { montarFila } from '../_saiu/montar'
import { acessoPrivado } from '../_proprio/dados'
import { humanizeSyncError } from '@/lib/youtube/observatorio/channels'
import { mascararCrus } from '@/lib/youtube/observatorio/contexto-ia/mascarar'
import { empacotarCanais, modeloDeCanais } from './empacotar-canais'
import { empacotarCanal, modeloDeCanal } from './empacotar-canal'
import { projetarMedidas } from './empacotar-canal-medidas'
import { canalNaoCarregou } from '../_canal/medidas/canal-derivado-async'
import { contextoDoCanal, lerComentariosDoCanalParaOPacote, lerMedidasDoCanal } from '../_canal/medidas/contexto-do-canal'
import { empacotarCanalProprio, modeloDeCanalProprio } from './empacotar-canal-proprio'
import { empacotarVideo, modeloDeVideo } from './empacotar-video'
import { medidasDoVideoNaoCarregaram, medidasDoVideoSoEstourou, projetarMedidasDoVideo, type MedidasVideoIa } from './empacotar-video-medidas'
import { alvoDoHistorico, clienteDeServicoDoVideo, lerEstourouDoVideo, lerMedidasDoVideo } from '../_historico/medidas/ler-do-video'
import { lerSecaoDeComentarios, resolverProvas } from '../_historico/comentarios-de-destaque'
import { comentariosDoVideoNaoCarregaram, projetarComentariosDoVideo, type ComentariosVideoIa } from './empacotar-video-comentarios'
import * as Sentry from '@sentry/nextjs'
import { empacotarVideoProprio, modeloDeVideoProprio } from './empacotar-video-proprio'
import { empacotarComparar, modeloDeComparar } from './empacotar-comparar'
import { empacotarOutliers, modeloDeOutliers } from './empacotar-outliers'
import { empacotarInsights, modeloDeInsights } from './empacotar-insights'
import { empacotarMudancas, modeloDeMudancas } from './empacotar-mudancas'
import { empacotarFila, modeloDeFila } from './empacotar-fila'

export interface PedidoMontado { id?: string; sp: Record<string, string | undefined> }
export interface PacoteMontado { modelo: PacoteModelo; recente: string | null; estado: Record<string, string> }
export type Empacotador = (pedido: PedidoMontado) => Promise<PacoteMontado | null>

/**
 * A consulta da URL (`window.location.search`) em parâmetros planos, com a regra das páginas (`one()`): vale a PRIMEIRA ocorrência de cada chave.
 * Chave que é nome herdado de objeto (`__proto__`) nunca vira propriedade. Nada é decodificado além do que `URLSearchParams` faz.
 */
export function parametrosPlanos(consulta: string): Record<string, string | undefined> {
  const saida: Record<string, string | undefined> = Object.create(null) as Record<string, string | undefined>
  const bruta = consulta.startsWith('?') ? consulta.slice(1) : consulta
  for (const [k, v] of new URLSearchParams(bruta)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue
    if (!(k in saida)) saida[k] = v
  }
  return { ...saida }
}

// O estado que vai ao registro: só chaves que alguma tela conhece e só valores curtos, sem espaço (ids, números e listas fechadas).
// A busca livre (`q`) nunca entra: vira `tem_busca`. O texto cru da URL fora desta forma é descartado, nunca cortado e gravado.
const CHAVES_DE_ESTADO = new Set([
  'niche', 'fmt', 'sort', 'dir', 'tab', 'filter', 'direcao', 'scale', 'layout', 'channel', 'add', 'nicheEditor', 'ordr', 'ordi', 'aba', 'age', 'min', 'topic',
  'formula', 'reading', 'asof', 'view', 'heat', 'win', 'period', 'ver', 'n', 'video', 'nums', 'a', 'b', 'from', 'saved', 'heroes', 'mostrar',
])
const VALOR_DE_ESTADO = /^[A-Za-z0-9_.:,-]{1,36}$/

export function estadoDoRegistro(estado: Record<string, string>): string[] {
  const lista: string[] = []
  for (const k of Object.keys(estado).sort()) {
    if (!CHAVES_DE_ESTADO.has(k)) continue
    const v = estado[k]
    if (typeof v === 'string' && VALOR_DE_ESTADO.test(v)) lista.push(`${k}=${v}`)
  }
  return lista
}

const textoDe = (o: Record<string, string | undefined>): Record<string, string> => {
  const r: Record<string, string> = {}
  for (const [k, v] of Object.entries(o)) if (typeof v === 'string') r[k] = v
  return r
}

/** Negado sem motivo: pergunta uma vez por que, SÓ para a frase. A resposta nunca libera dado; uma leitura "voltada" fica `nao_conferido`. */
async function comNegativa(privado: EstadoDoPrivado, siteId: string): Promise<EstadoDoPrivado> {
  if (privado.negativa !== null) return privado
  const negado = Object.values(privado.acessoPorCanal).some((x) => x.diario === 'negado' || x.alcance === 'negado')
  if (!negado) return privado
  const a = await acessoPrivado(siteId)
  return a.negativa === null ? privado : { ...privado, negativa: a.negativa }
}

/**
 * As mensagens técnicas CRUAS da coleta que o pacote não leva: a de um canal em `erro` que `humanizeSyncError` não reconhece (devolve igual). As frases
 * conhecidas (404, cota, tempo) passam; o resto vira uma frase fixa em `mascararCrus` (portão do N3: Yannis Y2, Phil C3). A tela continua mostrando a crua.
 */
export const crusDaColeta = (obs: { channels: ReadonlyArray<{ sync: { state: string; msg: string | null } }> }): string[] =>
  obs.channels.flatMap((c) => (c.sync.state === 'erro' && c.sync.msg && humanizeSyncError(c.sync.msg) === c.sync.msg ? [c.sync.msg] : []))

const sem = (modelo: PacoteModelo, obs: Parameters<typeof crusDaColeta>[0]): PacoteModelo => mascararCrus(modelo, crusDaColeta(obs))

const EXIGE_ID = (id: string | undefined): string | null => (id === undefined || id === '' ? null : id)

export const EMPACOTAR: { [T in TelaId]?: Empacotador } = {
  canais: async ({ sp }) => {
    const m = await montarCanais(sp)
    const privado = await comNegativa(m.privado, m.pagina.siteId)
    return { modelo: sem(empacotarCanais(modeloDeCanais(m.view, m.ri), privado), m.pagina.obs), recente: m.recente, estado: textoDe(m.estado) }
  },
  canal: async ({ id, sp }) => {
    const alvo = EXIGE_ID(id)
    if (alvo === null) return null
    // a MESMA leitura de medidas da página (uma vez só); `lerMedidasDoCanal` nunca lança: defeito vira "não carregou"
    const m = await montarCanal(alvo, sp, { iniciarMedidas: lerMedidasDoCanal })
    if (m.tipo !== 'concorrente') return null
    const contexto = contextoDoCanal(m.obs, m.view, m.pagina.now, { siteId: m.pagina.siteId, provas: { leitura: m.pagina.leitura, edicao: null }, permissaoFalhou: m.pagina.negativa === 'nao_foi_possivel_conferir' })
    const promessa = m.medidas ?? Promise.resolve(canalNaoCarregou())
    const medidas = projetarMedidas(await promessa.catch(canalNaoCarregou), contexto, await lerComentariosDoCanalParaOPacote(promessa, contexto))
    return { modelo: sem(empacotarCanal(modeloDeCanal(m.view, m.leituraMv, medidas)), m.obs), recente: m.recente, estado: textoDe(m.estado) }
  },
  'canal-proprio': async ({ id, sp }) => {
    const alvo = EXIGE_ID(id)
    if (alvo === null) return null
    const m = await montarCanal(alvo, sp)
    if (m.tipo !== 'proprio') return null
    const [periodos, origem] = await Promise.all([m.periodosProps ? assistidoDoCanal(m.periodosProps) : Promise.resolve(null), origemDoCanal(m.origemProps)])
    const modelo = modeloDeCanalProprio(m.pv, m.comoEsta, { periodos, origem })
    return { modelo: sem(empacotarCanalProprio(modelo, m.privado), m.obs), recente: m.recente, estado: textoDe(m.estado) }
  },
  video: async ({ id, sp }) => {
    const alvo = EXIGE_ID(id)
    if (alvo === null) return null
    const m = await montarVideo(alvo, sp)
    if (m.tipo !== 'concorrente' || m.view.notFound) return null
    // as MESMAS medidas que a página lê (uma leitura só); defeito vira "não carregou" no pacote, nunca bloco vazio
    const { doMotor, sincrona } = alvoDoHistorico(m.view, m.pagina.obs, m.pagina.now)
    let medidas: MedidasVideoIa | null = null
    let comentarios: ComentariosVideoIa | null = null
    // vídeo acompanhado FORA de `obs.videos`: a tela pinta o "Estourou e parou" síncrono (e nada mais), então o pacote leva só ele (portão Phil M-3)
    if (!doMotor && sincrona !== null && sincrona !== 'ler') medidas = medidasDoVideoSoEstourou(sincrona)
    if (doMotor) {
      const pedido = { obterSb: clienteDeServicoDoVideo, siteId: m.pagina.siteId, obs: m.pagina.obs, agoraMs: m.pagina.now, view: m.view, video: doMotor }
      // as provas nascem ANTES da leitura das medidas, como na página (M2 do portão Yannis): a latência de `acessoPrivado` não soma em série
      const provas = resolverProvas(acessoPrivado(m.pagina.siteId))
      try {
        const lidas = await lerMedidasDoVideo(pedido)
        // a leitura de "Estourou e parou" falhar não apaga as medidas já lidas: só ela vira "não carregou" (I1 do portão Yannis)
        let estourou: Awaited<ReturnType<typeof lerEstourouDoVideo>> = null
        try {
          estourou = await lerEstourouDoVideo({ ...pedido, lidas })
        } catch (err) {
          Sentry.captureException(err, { tags: { component: 'observatorio-video', step: 'contexto-ia-estourou' } })
          estourou = { tipo: 'nao_carregou' }
        }
        medidas = lidas === null ? medidasDoVideoNaoCarregaram() : projetarMedidasDoVideo(lidas.d, estourou)
        // a seção de comentários só existe na tela quando o conjunto foi lido; o nível é o do leitor, com as mesmas provas da página (edição: nula, como na página)
        if (lidas !== null) {
          const canais = new Map(m.pagina.obs.channels.map((x) => [x.id, { nome: x.name }] as const))
          const canalNome = canais.get(doMotor.ch)?.nome ?? ''
          const lida = await lerSecaoDeComentarios({
            sb: lidas.sb, siteId: m.pagina.siteId, videoId: doMotor.id, agoraMs: m.pagina.now, canaisDoSite: canais, canalNome, provas,
            video: { t0Ms: lidas.t0Ms, descobertoEmMs: lidas.descobertoMs, canalId: doMotor.ch },
            origem: 'contexto-ia',
          })
          comentarios = projetarComentariosDoVideo(lida, canalNome)
        } else comentarios = comentariosDoVideoNaoCarregaram()
      } catch (err) {
        Sentry.captureException(err, { tags: { component: 'observatorio-video', step: 'contexto-ia-medidas' } })
        medidas = medidas ?? medidasDoVideoNaoCarregaram()
        comentarios = comentarios ?? comentariosDoVideoNaoCarregaram()
      }
    }
    return { modelo: sem(empacotarVideo(modeloDeVideo(m.view, medidas, comentarios)), m.pagina.obs), recente: m.recente, estado: textoDe(m.estado) }
  },
  'video-proprio': async ({ id, sp }) => {
    const alvo = EXIGE_ID(id)
    if (alvo === null) return null
    const m = await montarVideo(alvo, sp)
    if (m.tipo !== 'proprio') return null
    return { modelo: sem(empacotarVideoProprio(modeloDeVideoProprio(m.base.header, m.blocos), m.privado), m.pagina.obs), recente: m.recente, estado: textoDe(m.estado) }
  },
  comparar: async ({ sp }) => {
    const m = await montarComparar(sp)
    const privado = await comNegativa(m.privado, m.pagina.siteId)
    const par = m.inicial ? buildPar(m.pack, m.inicial.a, m.inicial.b) : null
    const modelo = par ? modeloDeComparar(m.pack, par) : null
    const estado: Record<string, string> = m.estado ? { a: m.estado.a, b: m.estado.b } : {}
    return { modelo: sem(empacotarComparar(modelo, privado), m.pagina.obs), recente: m.recente, estado }
  },
  outliers: async ({ sp }) => {
    const m = await montarOutliers(sp)
    return { modelo: sem(empacotarOutliers(modeloDeOutliers(m.view, m.pagina.obs.nicheLabel(m.view.query.niche))), m.pagina.obs), recente: m.recente, estado: textoDe(m.estado) }
  },
  insights: async ({ sp }) => {
    const m = await montarInsights(sp)
    return { modelo: sem(empacotarInsights(modeloDeInsights(m.view, m.pagina.obs.nicheLabel(m.estado.niche))), m.pagina.obs), recente: m.recente, estado: textoDe(m.estado) }
  },
  mudancas: async ({ sp }) => {
    const m = await montarMudancas(sp)
    return { modelo: sem(empacotarMudancas(modeloDeMudancas(m.view, m.pagina.obs.nicheLabel(m.view.filters.niche))), m.pagina.obs), recente: m.recente, estado: textoDe(m.estado) }
  },
  fila: async ({ sp }) => {
    const m = await montarFila(sp)
    // sem acesso de edição a fila não existe para quem pede ("não encontrado"); falha de leitura NUNCA vira "fila vazia": lança e a ação responde `falhou`
    if (m.view.estado === 'sem_acesso') return null
    if (m.view.estado === 'erro') throw new Error('contexto-ia: a fila não pôde ser lida')
    return { modelo: empacotarFila(modeloDeFila(m.view)), recente: m.recente, estado: textoDe(m.estado) }
  },
}

export { telaExiste }

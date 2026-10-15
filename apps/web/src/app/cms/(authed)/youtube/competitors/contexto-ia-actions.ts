'use server'
/**
 * "Perguntar a uma IA" (E17 degrau 1, Tarefa 9): monta o pacote de texto da tela em que a pessoa está, registra o acesso e só então o devolve.
 * Ordem (não muda): (0) o botão está ligado; (1) forma do pedido, sem leitura nenhuma; (2) guarda de visualização do site (o site vem do contexto, nunca
 * do pedido); (3) o empacotador da tela; (4) segmentar e medir; (5) registrar; (6) devolver. Falha ao registrar = sem pacote ("sem linha, sem dado").
 * Nada aqui recebe a pergunta: ela é digitada no navegador e nunca chega ao servidor. Só exporta a função (arquivo 'use server').
 */
import * as Sentry from '@sentry/nextjs'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { CONTEXTO_IA_RULES } from '@/lib/youtube/observatorio/contexto-ia/regras'
import { TELAS_IA, telaExiste } from '@/lib/youtube/observatorio/contexto-ia/telas'
import { resumir } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { registrarAcesso, type ParamsDoRegistro } from '@/lib/youtube/observatorio/contexto-ia/registrar-acesso'
import { segmentar, type RespostaDePacote } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import type { PedidoDePacote, TelaId } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { EMPACOTAR, estadoDoRegistro, parametrosPlanos } from './_contexto-ia'

const FORMA_DO_ID = /^[A-Za-z0-9_-]{1,64}$/
const TAGS = { component: 'observatorio-contexto-ia' } as const

const recusa = (motivo: Extract<RespostaDePacote, { ok: false }>['motivo']): RespostaDePacote => ({ ok: false, motivo })

/** O redirecionamento do Next viaja como exceção e tem de seguir adiante. */
const ehRedirecionamento = (e: unknown): boolean => {
  const digest = typeof e === 'object' && e !== null ? (e as { digest?: unknown }).digest : undefined
  return typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')
}

function pedidoValido(p: unknown): { tela: TelaId; id: string | undefined; consulta: string } | null {
  if (typeof p !== 'object' || p === null) return null
  const { tela, id, consulta } = p as Partial<PedidoDePacote>
  if (!telaExiste(tela) || TELAS_IA[tela].estado !== 'existe') return null
  if (typeof consulta !== 'string' || consulta.length > CONTEXTO_IA_RULES.consultaMax) return null
  if (TELAS_IA[tela].pedeId) {
    if (typeof id !== 'string' || !FORMA_DO_ID.test(id)) return null
    return { tela, id, consulta }
  }
  return { tela, id: undefined, consulta }
}

export async function gerarPacoteIa(pedido: PedidoDePacote): Promise<RespostaDePacote> {
  if (!CONTEXTO_IA_RULES.ligado) return recusa('pedido_invalido')
  const valido = pedidoValido(pedido)
  if (!valido) return recusa('pedido_invalido')
  const { tela, id, consulta } = valido

  const { siteId } = await getSiteContext()
  const guarda = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!guarda.ok) return recusa('sem_acesso')

  const empacotar = EMPACOTAR[tela]
  if (!empacotar) return recusa('pedido_invalido')

  const sp = parametrosPlanos(consulta)
  let montado: Awaited<ReturnType<typeof empacotar>>
  let pacote: ReturnType<typeof segmentar>
  let copiaCaracteres: number
  let completoCaracteres: number
  let totalSemCorte: number
  let degrau: number | null
  let pisoPassou: boolean
  let estado: Record<string, string>
  try {
    montado = await empacotar({ ...(id !== undefined ? { id } : {}), sp })
    if (montado === null) return recusa('nao_encontrado')
    estado = montado.estado
    pacote = segmentar(montado.modelo, { geradoEm: observatoryNow(), recente: montado.recente })
    const r = resumir(pacote, '')
    copiaCaracteres = r.copia.caracteres
    completoCaracteres = r.completo.caracteres
    totalSemCorte = r.copia.totalSemCorte
    degrau = r.copia.degrau
    // o piso é definido com a pergunta cheia (plano 5.2), não com a pergunta vazia
    pisoPassou = resumir(pacote, 'x'.repeat(CONTEXTO_IA_RULES.perguntaMax)).copia.pisoPassou
  } catch (e) {
    if (ehRedirecionamento(e)) throw e
    // sem a mensagem da exceção, sem o pedido, sem o pacote
    Sentry.captureException(new Error('contexto-ia: falha ao montar o pacote'), { tags: { ...TAGS, step: 'montar', tela }, extra: { siteId } })
    return recusa('falhou')
  }

  const lista = estadoDoRegistro(estado)
  const temBusca = typeof sp.q === 'string' && sp.q !== ''
  const privado = pacote.privado.estado === 'excluido' ? `excluido:${pacote.privado.motivo}` : pacote.privado.estado
  const params: ParamsDoRegistro = {
    tela,
    ...(id !== undefined ? { id } : {}),
    estado: lista,
    versao: pacote.versao,
    total: totalSemCorte, // caracteres do texto inteiro, sem corte e sem pergunta (a conferência e17d1-d7 lê isto)
    completo: completoCaracteres,
    ...(degrau !== null ? { degrau } : {}), // ausente = nenhuma linha de lista cortada; 0 = todas cortadas
    piso_passou: pisoPassou,
    tabelas: pacote.tabelas.length,
    medidos: pacote.numeros.medidos,
    zeros_medidos: pacote.numeros.zerosMedidos,
    nao_medidos: pacote.numeros.naoMedidos,
    privado,
    privado_medidos: pacote.numeros.privadosMedidos,
    comentarios: pacote.comentarios.estado,
    ...(temBusca ? { tem_busca: true } : {}),
  }
  const registro = await registrarAcesso({
    siteId,
    userId: guarda.user.id,
    tela,
    params,
    incluiuPrivado: pacote.privado.estado === 'incluido' || pacote.comentarios.estado === 'incluido',
    caracteres: copiaCaracteres,
  })
  if (!registro.ok) {
    Sentry.captureException(new Error('contexto-ia: o registro de acesso falhou'), { tags: { ...TAGS, step: 'registrar', tela }, extra: { siteId, code: registro.code } })
    return recusa('registro_falhou')
  }
  return { ok: true, pacote }
}

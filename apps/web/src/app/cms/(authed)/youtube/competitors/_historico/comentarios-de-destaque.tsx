/**
 * A5 E5a Tarefa C3 (mockup 20): a seção "Comentários de destaque" na página do vídeo de concorrente. Componente de servidor assíncrono, num
 * `Suspense` PRÓPRIO dentro dos blocos do Histórico: a seção não segura os blocos de cima. Recebe as PROVAS de quem vê (os dois tokens do passo 0
 * da E17); os tokens passam de servidor a servidor e nunca chegam a componente cliente nem ao RSC. Quem decide o nível é o leitor
 * (`lerComentariosDeDestaque` chama `nivelDeQuemVe`); esta tela não decide nível nenhum e nunca lê texto por conta própria.
 * Nunca lança: parte não lida vira o estado de erro da seção ("Não deu para abrir os comentários agora.").
 * `SecaoView` é dado deste componente: não é campo de `HistoricoView`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { lerComentariosDeDestaque } from '@/lib/youtube/observatorio/comentarios/leitor'
import type { ComentariosDoVideo, ProvasDeQuemVe } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'
import type { EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'
import type { AcessoPrivado } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { spDateOf } from '@/lib/youtube/observatorio/time'
import { FRASES } from '../_chrome/comentarios/frases'
import { EstadoDoPainel } from '../_chrome/comentarios/estados'
import { estadoDeErro, secaoDeComentarios, type SecaoView } from '../_chrome/comentarios/model'
import { SecaoDeComentarios } from '../_chrome/comentarios/secao'
import '../_chrome/comentarios/comentarios.css'

/** a faixa quando a conferência de permissão falhou; o nível cai para a contagem e a tela diz por quê (nunca sobe por falta de resposta). */
export const FAIXA_PERMISSAO_NAO_CONFERIDA = FRASES.permissaoNaoConferida

/** As provas de quem vê, já resolvidas, e se a conferência da permissão falhou. */
export interface ProvasResolvidas { provas: ProvasDeQuemVe | null; permissaoFalhou: boolean }

/**
 * Do acesso privado (que a página pede SEM esperar, para o cabeçalho sair na hora) às provas de quem vê. Nunca rejeita: que a prova lance (não
 * deveria) é nível contagem com a faixa de permissão, nunca texto. A página NÃO chama `provarEdicao` nem decide nível (quem decide é o leitor).
 * `edicao` é o campo do pedido P11 (passo 0 da E17): enquanto `AcessoPrivado` não o tiver, é sempre nulo (no máximo texto).
 */
export async function resolverProvas(acesso: Promise<AcessoPrivado>): Promise<ProvasResolvidas> {
  try {
    const a = await acesso
    const edicao = 'edicao' in a ? ((a as AcessoPrivado & { edicao?: EdicaoDoSite | null }).edicao ?? null) : null
    return { provas: { leitura: a.leitura, edicao }, permissaoFalhou: a.negativa === 'nao_foi_possivel_conferir' }
  } catch {
    return { provas: null, permissaoFalhou: true }
  }
}

export interface PropsComentariosDeDestaque {
  /** Cliente de serviço, chamado DEPOIS da guarda de leitura do site (a RLS devolveria zero linha com o cliente do usuário). */
  sb: SupabaseClient
  siteId: string
  /** As provas de quem vê, em promessa: a seção espera DENTRO do `Suspense` dela, não a página (portão Yannis I-1). */
  provas: Promise<ProvasResolvidas>
  videoId: string
  agoraMs: number
  canaisDoSite: ReadonlyMap<string, { nome: string }>
  video: { t0Ms: number; descobertoEmMs: number | null; canalId: string }
  canalNome: string
  /** `link.saiu`: o botão "Ver na fila “Saíram do YouTube”" só existe se este link existir. */
  hrefFilaSaiu?: string
  /** Quem pediu a leitura: vira tag do Sentry para separar a falha da tela da falha do pacote da IA (M5 do portão Yannis). */
  origem?: 'pagina' | 'contexto-ia'
}

/** O que a seção lê e monta, antes de virar tela: a página e o pacote "Perguntar a uma IA" usam o MESMO caminho (leitor, nível e modelo). */
export type SecaoLida =
  | { ok: false; titulo: string }
  | { ok: true; secao: SecaoView; dados: ComentariosDoVideo; permissaoFalhou: boolean }

/** Nunca lança: parte não lida vira `ok: false` com o título do estado de erro, e o motivo vai ao Sentry (sem texto nem id de autor). */
export async function lerSecaoDeComentarios(p: PropsComentariosDeDestaque): Promise<SecaoLida> {
  let lido: Awaited<ReturnType<typeof lerComentariosDeDestaque>>
  const { provas, permissaoFalhou } = await p.provas.catch((): ProvasResolvidas => ({ provas: null, permissaoFalhou: true }))
  try {
    lido = await lerComentariosDeDestaque(p.sb, {
      siteDaGuarda: p.siteId, provas, videoId: p.videoId, agoraMs: p.agoraMs, canaisDoSite: p.canaisDoSite, video: p.video,
    })
  } catch (err) {
    // por contrato o leitor não relata ("quem relata é a página"): quem relata é esta seção, com tags e sem id de autor nem texto (portão Yannis I-5)
    Sentry.captureException(err, { tags: { component: 'observatorio', step: 'comentarios-destaque', origem: p.origem ?? 'pagina' } })
    lido = { lido: false, causa: 'erro_do_banco', codigo: 'excecao' }
  }
  if (!lido.lido) {
    if (lido.codigo !== 'excecao') {
      Sentry.captureMessage('observatório: comentários de destaque não lidos', { level: 'warning', tags: { component: 'observatorio', step: 'comentarios-destaque', origem: p.origem ?? 'pagina' }, extra: { causa: lido.causa, codigo: lido.codigo } })
    }
    return { ok: false, titulo: estadoDeErro().titulo }
  }
  const v = secaoDeComentarios(lido.dados, { hojeSP: spDateOf(p.agoraMs), canalNome: p.canalNome, t0Ms: p.video.t0Ms, descobertoEmMs: p.video.descobertoEmMs })
  return { ok: true, secao: permissaoFalhou ? { ...v, faixa: FAIXA_PERMISSAO_NAO_CONFERIDA } : v, dados: lido.dados, permissaoFalhou }
}

export async function ComentariosDeDestaque(p: PropsComentariosDeDestaque) {
  const r = await lerSecaoDeComentarios(p)
  if (!r.ok) {
    return (
      <section className="cd-secao" aria-labelledby="cd-titulo" data-comentarios="erro">
        <h2 id="cd-titulo" className="cd-titulo">{FRASES.titulo}</h2>
        <EstadoDoPainel v={estadoDeErro()} />
      </section>
    )
  }
  return <SecaoDeComentarios v={r.secao} hrefFilaSaiu={p.hrefFilaSaiu} />
}

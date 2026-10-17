/**
 * A5 E5a Tarefa C3 (mockup 20): a seção "Comentários de destaque" na página do vídeo de concorrente. Componente de servidor assíncrono, num
 * `Suspense` PRÓPRIO dentro dos blocos do Histórico: a seção não segura os blocos de cima. Recebe as PROVAS de quem vê (os dois tokens do passo 0
 * da E17); os tokens passam de servidor a servidor e nunca chegam a componente cliente nem ao RSC. Quem decide o nível é o leitor
 * (`lerComentariosDeDestaque` chama `nivelDeQuemVe`); esta tela não decide nível nenhum e nunca lê texto por conta própria.
 * Nunca lança: parte não lida vira o estado de erro da seção ("Não deu para abrir os comentários agora. A leitura falhou.").
 * `SecaoView` é dado deste componente: não é campo de `HistoricoView`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { lerComentariosDeDestaque } from '@/lib/youtube/observatorio/comentarios/leitor'
import type { ProvasDeQuemVe } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'
import { spDateOf } from '@/lib/youtube/observatorio/time'
import { FRASES } from '../_chrome/comentarios/frases'
import { EstadoDoPainel } from '../_chrome/comentarios/estados'
import { estadoDeErro, secaoDeComentarios } from '../_chrome/comentarios/model'
import { SecaoDeComentarios } from '../_chrome/comentarios/secao'
import '../_chrome/comentarios/comentarios.css'

/** TEXTO-A-REVISAR: a faixa quando a conferência de permissão falhou; o nível cai para a contagem e a tela diz por quê (nunca sobe por falta de resposta). */
export const FAIXA_PERMISSAO_NAO_CONFERIDA = 'Não deu para conferir a sua permissão agora, então os comentários aparecem só em contagem. Tente de novo em instantes.'

export interface PropsComentariosDeDestaque {
  /** Cliente de serviço, chamado DEPOIS da guarda de leitura do site (a RLS devolveria zero linha com o cliente do usuário). */
  sb: SupabaseClient
  siteId: string
  provas: ProvasDeQuemVe | null
  /** A conferência de permissão falhou: a faixa diz isso. */
  permissaoFalhou?: boolean
  videoId: string
  agoraMs: number
  canaisDoSite: ReadonlyMap<string, { nome: string }>
  video: { t0Ms: number; descobertoEmMs: number | null; canalId: string }
  canalNome: string
  /** `link.saiu`: o botão "Ver na fila “Saíram do YouTube”" só existe se este link existir. */
  hrefFilaSaiu?: string
}

export async function ComentariosDeDestaque(p: PropsComentariosDeDestaque) {
  let lido: Awaited<ReturnType<typeof lerComentariosDeDestaque>>
  try {
    lido = await lerComentariosDeDestaque(p.sb, {
      siteDaGuarda: p.siteId, provas: p.provas, videoId: p.videoId, agoraMs: p.agoraMs, canaisDoSite: p.canaisDoSite, video: p.video,
    })
  } catch {
    lido = { lido: false, causa: 'erro_do_banco', codigo: 'excecao' }
  }
  if (!lido.lido) {
    return (
      <section className="cd-secao" aria-labelledby="cd-titulo" data-comentarios="erro">
        <h2 id="cd-titulo" className="cd-titulo">{FRASES.titulo}</h2>
        <EstadoDoPainel v={estadoDeErro()} />
      </section>
    )
  }
  const v = secaoDeComentarios(lido.dados, { hojeSP: spDateOf(p.agoraMs), canalNome: p.canalNome, t0Ms: p.video.t0Ms, descobertoEmMs: p.video.descobertoEmMs })
  return <SecaoDeComentarios v={p.permissaoFalhou ? { ...v, faixa: FAIXA_PERMISSAO_NAO_CONFERIDA } : v} hrefFilaSaiu={p.hrefFilaSaiu} />
}

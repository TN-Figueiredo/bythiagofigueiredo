/**
 * F3 T7: o bloco "Sugestões" do A/B Lab. Servidor assíncrono (vai dentro de <Suspense> na página). Não existe fronteira de erro por
 * componente no Next, então o bloco NUNCA lança: leitura com erro ou exceção viram o estado de erro do bloco (e Sentry).
 */
import * as Sentry from '@sentry/nextjs'
import type { ReactNode } from 'react'
import CmsLink from '../../../_shared/cms-link'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { link } from '@/lib/youtube/observatorio/links'
import { adiarSugestao, cancelarTitulos, dispensarSugestao, pedirTitulos } from '../../competitors/_sugestoes/actions'
import { abrirListaDaTela } from '../../competitors/_sugestoes/dados-da-tela'
import { SugestoesLista } from '../../competitors/_sugestoes/sugestoes-lista'
import { montarVistaDaLista, VISTA_COM_ERRO } from '../../competitors/_sugestoes/view-model'
import type { AcoesDaLista } from '../../competitors/_sugestoes/tipos'

const LINHAS = 3

/** Desvio 8 (M7): sem itens o bloco vira uma linha discreta (nunca um bloco vazio de 3 linhas). */
export const LINHA_SEM_SUGESTOES = 'Sugestões de vídeos para testar: nenhuma agora.'
export const LINHA_SUGESTOES_NAO_CALCULADAS = 'Sugestões de vídeos para testar: ainda não calculadas.'

function LinhaDiscreta({ texto }: { texto: string }): ReactNode {
  return (
    <p className="m-0 flex flex-wrap items-center gap-2.5 text-[13px] text-cms-text-muted" data-sugestoes-vazio="">
      <span>{texto}</span>
      <CmsLink href={link.sugestoes()} className="inline-flex min-h-11 items-center underline underline-offset-[3px]">Ver detalhes</CmsLink>
    </p>
  )
}

const comErro = (): ReactNode => <SugestoesLista modo="bloco" vista={VISTA_COM_ERRO} acoes={null} verTodasHref={link.sugestoes()} />

export async function BlocoSugestoes(): Promise<ReactNode> {
  try {
    const agora = new Date(observatoryNow())
    const leitura = await abrirListaDaTela(agora, LINHAS)
    if (leitura.estado === 'sem_acesso') return null
    if (leitura.estado === 'erro') return comErro()
    if (leitura.lista.itens.length === 0) {
      const nunca = leitura.lista.motivoVazio === 'nunca-calculado' || (leitura.lista.motivoVazio == null && leitura.lista.computado_em === null)
      return <LinhaDiscreta texto={nunca ? LINHA_SUGESTOES_NAO_CALCULADAS : LINHA_SEM_SUGESTOES} />
    }
    const vista = montarVistaDaLista({ lista: leitura.lista, amostra: leitura.amostra, agora, filtro: 'todas', saiuDoAviso: false, limite: LINHAS })
    const acoes: AcoesDaLista | null = leitura.podeResponder ? { dispensar: dispensarSugestao, adiar: adiarSugestao, pedirTitulos, cancelarTitulos } : null
    return <SugestoesLista modo="bloco" vista={vista} acoes={acoes} verTodasHref={link.sugestoes()} />
  } catch (e) {
    Sentry.captureException(e, { tags: { component: 'sugestoes', step: 'bloco-ab-lab' } })
    return comErro()
  }
}

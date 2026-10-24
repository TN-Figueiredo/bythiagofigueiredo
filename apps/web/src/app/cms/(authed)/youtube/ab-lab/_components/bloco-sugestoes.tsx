/**
 * F3 T7: o bloco "Sugestões" do A/B Lab. Servidor assíncrono (vai dentro de <Suspense> na página). Não existe fronteira de erro por
 * componente no Next, então o bloco NUNCA lança: leitura com erro ou exceção viram o estado de erro do bloco (e Sentry).
 */
import * as Sentry from '@sentry/nextjs'
import type { ReactNode } from 'react'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { link } from '@/lib/youtube/observatorio/links'
import { adiarSugestao, dispensarSugestao } from '../../competitors/_sugestoes/actions'
import { abrirListaDaTela } from '../../competitors/_sugestoes/dados-da-tela'
import { SugestoesLista } from '../../competitors/_sugestoes/sugestoes-lista'
import { montarVistaDaLista, VISTA_COM_ERRO } from '../../competitors/_sugestoes/view-model'
import type { AcoesDaLista } from '../../competitors/_sugestoes/tipos'

const LINHAS = 3

const comErro = (): ReactNode => <SugestoesLista modo="bloco" vista={VISTA_COM_ERRO} acoes={null} verTodasHref={link.sugestoes()} />

export async function BlocoSugestoes(): Promise<ReactNode> {
  try {
    const agora = new Date(observatoryNow())
    const leitura = await abrirListaDaTela(agora, LINHAS)
    if (leitura.estado === 'sem_acesso') return null
    if (leitura.estado === 'erro') return comErro()
    const vista = montarVistaDaLista({ lista: leitura.lista, amostra: leitura.amostra, agora, filtro: 'todas', saiuDoAviso: false, limite: LINHAS })
    const acoes: AcoesDaLista | null = leitura.podeResponder ? { dispensar: dispensarSugestao, adiar: adiarSugestao } : null
    return <SugestoesLista modo="bloco" vista={vista} acoes={acoes} verTodasHref={link.sugestoes()} />
  } catch (e) {
    Sentry.captureException(e, { tags: { component: 'sugestoes', step: 'bloco-ab-lab' } })
    return comErro()
  }
}

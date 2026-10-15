'use client'
/**
 * Fronteira de erro de Referências e Inscritos (portão Yannis m5): uma exceção de render nas seções não derruba a tela Canais.
 * Reaproveita o `TabErrorBoundary` do projeto; o erro vai ao Sentry com fingerprint próprio.
 */
import type { ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'
import { TabErrorBoundary } from '@/app/cms/(authed)/newsletters/_shared/tab-error-boundary'

const TEXTO_FALHA_RENDER = 'Não deu para mostrar as referências e os inscritos. Seus dados não mudaram. Recarregue a página.'

export function RiFronteira({ children }: { children: ReactNode }) {
  return (
    <TabErrorBoundary
      fallback={<p className="ri-aviso err" role="alert">{TEXTO_FALHA_RENDER}</p>}
      onError={(erro) => Sentry.captureException(erro, { fingerprint: ['canais-ri', 'render'], tags: { component: 'observatorio', step: 'canais-ri' } })}
    >
      {children}
    </TabErrorBoundary>
  )
}

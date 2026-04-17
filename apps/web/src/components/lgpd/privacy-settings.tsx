'use client'

// Sprint 5a Track D — D6: Top-level page content for /account/settings/privacy.
// Composes the consent revocation panel + request status cards + cookie
// banner re-open trigger. The *wrapper* lives in the page component; this
// file owns the layout + composition of the per-user privacy controls.

import Link from 'next/link'
import {
  ConsentRevocationPanel,
  type ConsentRecord,
} from './consent-revocation-panel'
import {
  LgpdRequestStatus,
  type LgpdRequestView,
} from './lgpd-request-status'
import { CookieBannerProvider } from './cookie-banner-context'
import { CookieBannerTrigger } from './cookie-banner-trigger'
import { CookieBanner } from './cookie-banner'

export interface PrivacySettingsProps {
  userEmail: string
  consents: ConsentRecord[]
  requests: LgpdRequestView[]
}

export function PrivacySettings({ userEmail, consents, requests }: PrivacySettingsProps) {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Privacidade</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Gerencie seus consentimentos, veja o histórico de solicitações LGPD e exerça seus direitos
          previstos no Art. 18 da LGPD.
        </p>
        <p className="text-xs text-[var(--text-tertiary)]">Conta: {userEmail}</p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Cookies</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Revise ou atualize suas preferências de cookies.
        </p>
        <CookieBannerProvider initialOpen={false}>
          <CookieBannerTrigger
            className="inline-flex w-fit items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium hover:bg-[var(--bg-subtle)]"
          />
          <CookieBanner />
        </CookieBannerProvider>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Consentimentos ativos</h2>
        <ConsentRevocationPanel consents={consents} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Histórico de solicitações</h2>
        {requests.length === 0 ? (
          <p className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-secondary)]">
            Nenhuma solicitação registrada.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {requests.map((req) => (
              <li key={req.id}>
                <LgpdRequestStatus request={req} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Direitos LGPD Art. 18</h2>
        <ul className="list-disc pl-6 text-sm">
          <li>
            <Link href="/account/export" className="text-[var(--accent)] underline underline-offset-2">
              Exportar meus dados
            </Link>
            {' '}(portabilidade — Art. 18 V)
          </li>
          <li>
            <Link href="/account/delete" className="text-[var(--accent)] underline underline-offset-2">
              Excluir minha conta
            </Link>
            {' '}(eliminação — Art. 18 VI)
          </li>
          <li>
            <a
              href="mailto:privacidade@bythiagofigueiredo.com"
              className="text-[var(--accent)] underline underline-offset-2"
            >
              Solicitar correção ou acesso a dados específicos
            </a>
          </li>
        </ul>
      </section>
    </div>
  )
}

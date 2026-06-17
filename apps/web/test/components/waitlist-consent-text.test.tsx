import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RenderConsentText } from '../../src/components/waitlists/consent-text'
import { FORM_STRINGS } from '../../src/components/waitlists/form-strings'

// RenderConsentText is the single source for the consent sentence shown on BOTH the
// public form and the CMS drawer preview. Its rendered text MUST stay byte-identical to
// FORM_STRINGS[locale].consentLabel (the LGPD proof-of-consent basis, M5/M12).
describe('RenderConsentText', () => {
  it.each(['en', 'pt-BR'] as const)('%s: bolds the name and renders the verbatim consent text', (locale) => {
    const name = 'Acme Launch'
    const { container } = render(
      <RenderConsentText name={name} strings={FORM_STRINGS[locale]} strongClassName="font-bold" />,
    )
    expect(container.querySelector('strong')?.textContent).toBe(name)
    // Reassembled visible text === the audited consentLabel, verbatim.
    expect(container.textContent).toBe(FORM_STRINGS[locale].consentLabel(name))
  })

  it('renders a name with spaces/quotes without corrupting the surrounding copy', () => {
    const name = 'Curso "Pró" · 2026'
    const { container } = render(<RenderConsentText name={name} strings={FORM_STRINGS.en} />)
    expect(container.textContent).toBe(FORM_STRINGS.en.consentLabel(name))
  })
})

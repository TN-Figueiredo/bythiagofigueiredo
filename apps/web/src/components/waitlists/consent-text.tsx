import type { WaitlistStrings } from './form-strings'

/**
 * Renders the launch-notification consent sentence with the product name bolded.
 * Sourced from FORM_STRINGS.consentLabel and split on the name so the displayed text
 * stays byte-identical to the LGPD-audited snapshot (textContent === consentLabel(name)).
 *
 * Shared by BOTH the public signup form and the CMS drawer preview so the two can never
 * drift from each other or from the ledgered consent text (WL-CQ-1, M5/M12).
 */
export function RenderConsentText({
  name,
  strings,
  strongClassName,
}: {
  name: string
  strings: WaitlistStrings
  strongClassName?: string
}) {
  const full = strings.consentLabel(name)
  const parts = full.split(name)
  return (
    <span>
      {parts.map((part, i) => (
        <span key={`${i}:${part.slice(0, 8)}`}>
          {part}
          {i < parts.length - 1 && <strong className={strongClassName}>{name}</strong>}
        </span>
      ))}
    </span>
  )
}

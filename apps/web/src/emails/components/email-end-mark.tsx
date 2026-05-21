import { Section } from '@react-email/components'
import { EMAIL_COLORS, EMAIL_FONTS } from './email-tokens'

export function EmailEndMark() {
  return (
    <Section style={{ textAlign: 'center', padding: '32px 48px 0' }}>
      <table cellPadding={0} cellSpacing={0} style={{ width: 180, margin: '0 auto' }}>
        <tbody>
          <tr>
            <td style={{ borderTop: `1px solid ${EMAIL_COLORS.line}`, width: '42%', verticalAlign: 'middle' }} />
            <td align="center" style={{
              color: EMAIL_COLORS.accent,
              fontFamily: EMAIL_FONTS.serif,
              fontSize: 18,
              verticalAlign: 'middle',
              padding: '0 14px',
              whiteSpace: 'nowrap' as const,
              lineHeight: '1',
            }}>
              ❦
            </td>
            <td style={{ borderTop: `1px solid ${EMAIL_COLORS.line}`, width: '42%', verticalAlign: 'middle' }} />
          </tr>
        </tbody>
      </table>
    </Section>
  )
}

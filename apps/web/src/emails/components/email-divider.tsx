import { Hr } from '@react-email/components'
import { EMAIL_COLORS } from './email-tokens'

export function EmailDivider() {
  return (
    <Hr
      className="email-line"
      style={{
        border: 'none',
        borderBottom: `1px solid ${EMAIL_COLORS.line}`,
        margin: '32px 48px',
      }}
    />
  )
}

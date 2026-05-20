import { Hr } from '@react-email/components'
import { EMAIL_COLORS } from './email-tokens'

export function EmailDivider() {
  return (
    <Hr
      className="email-divider"
      style={{
        borderColor: EMAIL_COLORS.line,
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        borderBottom: `1px solid ${EMAIL_COLORS.line}`,
        margin: '32px 32px',
      }}
    />
  )
}

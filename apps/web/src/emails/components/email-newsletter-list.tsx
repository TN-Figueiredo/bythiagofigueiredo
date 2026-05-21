import { Section, Text } from '@react-email/components'
import { EMAIL_COLORS, EMAIL_FONTS } from './email-tokens'

export interface NewsletterListItem {
  name: string
  tagline?: string
  color: string
}

interface EmailNewsletterListProps {
  items: NewsletterListItem[]
}

export function EmailNewsletterList({ items }: EmailNewsletterListProps) {
  if (items.length === 0) return null

  return (
    <Section style={{ margin: '20px 48px 4px' }}>
      {items.map((item, i) => (
        <div key={item.name} style={{
          borderLeft: `3px solid ${item.color}`,
          padding: '10px 0 10px 16px',
          marginBottom: i < items.length - 1 ? 10 : 0,
        }}>
          <Text className="email-ink" style={{
            fontFamily: EMAIL_FONTS.serif,
            fontSize: 16,
            fontWeight: 500,
            color: EMAIL_COLORS.ink,
            margin: '0 0 2px',
            lineHeight: '1.3',
            letterSpacing: '-0.01em',
          }}>
            {item.name}
          </Text>
          {item.tagline && (
            <Text className="email-faint" style={{
              fontFamily: EMAIL_FONTS.sans,
              fontSize: 12,
              color: EMAIL_COLORS.faint,
              margin: 0,
              letterSpacing: '0.02em',
              lineHeight: '1.4',
            }}>
              {item.tagline}
            </Text>
          )}
        </div>
      ))}
    </Section>
  )
}

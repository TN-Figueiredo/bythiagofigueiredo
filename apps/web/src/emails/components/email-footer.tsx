import { Section, Text, Link } from '@react-email/components'

interface EmailFooterProps {
  unsubscribeUrl: string
  archiveUrl: string
}

export function EmailFooter({ unsubscribeUrl, archiveUrl }: EmailFooterProps) {
  return (
    <Section style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #eee' }}>
      <Text style={{ fontSize: 12, color: '#999', margin: 0 }}>
        <Link href={archiveUrl} style={{ color: '#999' }}>View in browser</Link>
        {' · '}
        <Link href={unsubscribeUrl} style={{ color: '#999' }}>Unsubscribe</Link>
      </Text>
    </Section>
  )
}

import { Section, Text } from '@react-email/components'

interface EmailHeaderProps {
  typeName: string
  typeColor: string
}

export function EmailHeader({ typeName, typeColor }: EmailHeaderProps) {
  return (
    <Section style={{ borderBottom: `3px solid ${typeColor}`, paddingBottom: 16, marginBottom: 24 }}>
      <Text style={{ fontSize: 14, color: '#666', margin: 0 }}>{typeName}</Text>
    </Section>
  )
}

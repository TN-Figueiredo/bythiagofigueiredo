import { Section, Text } from '@react-email/components'
import { EmailShell } from './components/email-shell'
import { EmailMonogram } from './components/email-monogram'
import { EmailButton } from './components/email-button'
import { EmailDivider } from './components/email-divider'
import { EmailEndMark } from './components/email-end-mark'
import { EmailFooter } from './components/email-footer'
import { EMAIL_COLORS, EMAIL_FONTS } from './components/email-tokens'

export interface DeadlineItem {
  title: string
  stage: string
  format: string
  deadlineDate: string
  pubDate: string
  daysUntilDeadline: number
}

const COPY = {
  'pt-BR': {
    preheader: 'Itens do pipeline com prazo se aproximando',
    heading: 'Pipeline: Prazos',
    overdueLabel: 'Atrasado',
    tomorrowLabel: 'Amanha',
    upcomingLabel: 'Proximos 3 dias',
    overdueHeading: 'Atrasados',
    tomorrowHeading: 'Amanha',
    upcomingHeading: 'Em breve',
    button: 'Abrir Pipeline',
    footer: 'Este email e enviado automaticamente quando voce tem prazos se aproximando.',
    pubPrefix: 'pub:',
    stagePrefix: 'etapa:',
  },
  en: {
    preheader: 'Pipeline items with approaching deadlines',
    heading: 'Pipeline: Deadlines',
    overdueLabel: 'Overdue',
    tomorrowLabel: 'Tomorrow',
    upcomingLabel: 'Next 3 days',
    overdueHeading: 'Overdue',
    tomorrowHeading: 'Tomorrow',
    upcomingHeading: 'Coming up',
    button: 'Open Pipeline',
    footer: 'This email is sent automatically when you have approaching deadlines.',
    pubPrefix: 'pub:',
    stagePrefix: 'stage:',
  },
} as const

const URGENCY_COLORS = {
  overdue: '#ef4444',
  tomorrow: '#f59e0b',
  upcoming: '#6366f1',
}

interface PipelineDeadlineDigestProps {
  locale: string
  items: DeadlineItem[]
  dashboardUrl: string
}

function bucketItems(items: DeadlineItem[]) {
  const overdue: DeadlineItem[] = []
  const tomorrow: DeadlineItem[] = []
  const upcoming: DeadlineItem[] = []

  for (const item of items) {
    if (item.daysUntilDeadline < 0) overdue.push(item)
    else if (item.daysUntilDeadline <= 1) tomorrow.push(item)
    else upcoming.push(item)
  }

  return { overdue, tomorrow, upcoming }
}

function ItemRow({ item, label, color }: { item: DeadlineItem; label: string; color: string }) {
  return (
    <Section style={{
      borderLeft: `3px solid ${color}`,
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: 16,
      margin: '0 0 8px',
    }}>
      <Text className="email-ink" style={{
        fontFamily: EMAIL_FONTS.serif,
        fontSize: 15,
        fontWeight: 500,
        color: EMAIL_COLORS.ink,
        margin: 0,
        lineHeight: '1.3',
      }}>
        {item.title}
      </Text>
      <Text className="email-muted" style={{
        fontFamily: EMAIL_FONTS.sans,
        fontSize: 12,
        color: EMAIL_COLORS.muted,
        margin: '2px 0 0',
        lineHeight: '1.4',
      }}>
        {item.stage} &middot; {item.format} &middot; {label}
      </Text>
    </Section>
  )
}

function SectionHeading({ text, color }: { text: string; color: string }) {
  return (
    <Text className="email-ink" style={{
      fontFamily: EMAIL_FONTS.sans,
      fontSize: 11,
      fontWeight: 700,
      color,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.08em',
      margin: '20px 0 8px',
    }}>
      {text}
    </Text>
  )
}

export function PipelineDeadlineDigest({ locale, items, dashboardUrl }: PipelineDeadlineDigestProps) {
  const isPt = locale === 'pt-BR'
  const c = isPt ? COPY['pt-BR'] : COPY.en
  const { overdue, tomorrow, upcoming } = bucketItems(items)

  return (
    <EmailShell preheader={c.preheader} lang={locale}>
      <EmailMonogram />
      <EmailDivider />

      <Section style={{ padding: '40px 48px 44px' }}>
        <Text className="email-ink" style={{
          fontFamily: EMAIL_FONTS.serif,
          fontSize: 26,
          fontWeight: 500,
          color: EMAIL_COLORS.ink,
          margin: '0 0 8px',
          letterSpacing: '-0.02em',
          lineHeight: '1.2',
        }}>
          {c.heading}
        </Text>

        {overdue.length > 0 && (
          <>
            <SectionHeading text={c.overdueHeading} color={URGENCY_COLORS.overdue} />
            {overdue.map((item, i) => (
              <ItemRow key={i} item={item} label={c.overdueLabel} color={URGENCY_COLORS.overdue} />
            ))}
          </>
        )}

        {tomorrow.length > 0 && (
          <>
            <SectionHeading text={c.tomorrowHeading} color={URGENCY_COLORS.tomorrow} />
            {tomorrow.map((item, i) => (
              <ItemRow key={i} item={item} label={c.tomorrowLabel} color={URGENCY_COLORS.tomorrow} />
            ))}
          </>
        )}

        {upcoming.length > 0 && (
          <>
            <SectionHeading text={c.upcomingHeading} color={URGENCY_COLORS.upcoming} />
            {upcoming.map((item, i) => (
              <ItemRow key={i} item={item} label={c.upcomingLabel} color={URGENCY_COLORS.upcoming} />
            ))}
          </>
        )}

        <EmailButton href={dashboardUrl}>{c.button}</EmailButton>

        <Text className="email-faint" style={{
          fontFamily: EMAIL_FONTS.sans,
          fontSize: 12,
          color: EMAIL_COLORS.faint,
          margin: '28px 0 0',
          lineHeight: '1.5',
        }}>
          {c.footer}
        </Text>
      </Section>

      <EmailDivider />
      <EmailEndMark />
      <EmailFooter locale={locale} showPrefs={false} />
    </EmailShell>
  )
}

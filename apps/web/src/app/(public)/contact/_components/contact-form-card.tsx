import { Paper } from '@/components/pinboard/paper'
import { Tape } from '@/components/pinboard/tape'
import { ContactForm } from '@/components/contact-form'
import { submitContact } from '../actions'
import type { ContactPageSettings, ContactPageVisibility } from '@/lib/contact/types'

interface Props {
  settings: ContactPageSettings
  visibility: ContactPageVisibility
  locale: string
}

export function ContactFormCard({ settings, visibility, locale }: Props) {
  if (!visibility.show_contact_form) return null

  return (
    <div className="relative pt-3">
      <Tape
        style={{
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />

      <Paper
        rotation={0.3}
        padding="28px"
        style={{ marginTop: 6 }}
      >
        {/* Form title */}
        {settings.form_title && (
          <h2
            className="text-pb-ink mb-5"
            style={{
              fontFamily: 'var(--font-fraunces-var)',
              fontSize: 'clamp(1.15rem, 2vw + 0.25rem, 1.5rem)',
              fontWeight: 600,
              lineHeight: 1.25,
            }}
          >
            {settings.form_title}
          </h2>
        )}

        <ContactForm
          locale={locale}
          submitAction={submitContact}
          subjectOptions={
            visibility.show_subject_selector && settings.subject_options.length > 0
              ? settings.subject_options
              : undefined
          }
          showMarketing={visibility.show_marketing_consent}
        />
      </Paper>
    </div>
  )
}

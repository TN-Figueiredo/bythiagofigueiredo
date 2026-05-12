import type { ContactPageSettings, ContactPageVisibility } from './types'

export const DEFAULT_SETTINGS_PT: Omit<ContactPageSettings, 'id' | 'site_id' | 'locale'> = {
  hero_title: 'Vamos conversar?',
  hero_subtitle:
    'Se você quer conversar sobre código, conteúdo, collab, ou só dizer oi — email é o melhor caminho.',
  response_time_text: 'Respondo em 24-48h',
  form_title: 'Manda um salve',
  auto_reply_text: 'Obrigado por entrar em contato! Recebi sua mensagem e respondo em 24-48h.',
  subject_options: [
    '💼 Projeto / Freelance',
    '🤝 Collab / Parceria',
    '💬 Feedback',
    '🎙️ Podcast / Entrevista',
    '🐛 Bug report',
    '👋 Só um oi',
  ],
  faq_items: [
    { q: 'Qual o melhor canal pra falar comigo?', a: 'Email. Respondo em 24-48h. DM de Instagram funciona pra coisas rápidas.' },
    { q: 'Aceita freelance?', a: 'Depende do projeto. Manda um email descrevendo o escopo e prazo.' },
    { q: 'Posso mandar PR no seu repo?', a: 'Sim. Issues primeiro, PR depois.' },
    { q: 'Faz collab / participa de podcast?', a: 'Sim, se o tema combinar com o que eu faço.' },
  ],
}

export const DEFAULT_SETTINGS_EN: Omit<ContactPageSettings, 'id' | 'site_id' | 'locale'> = {
  hero_title: "Let's talk?",
  hero_subtitle:
    "Whether it's about code, content, a collab, or just saying hi — email is the best way.",
  response_time_text: 'I reply within 24-48h',
  form_title: 'Drop a line',
  auto_reply_text: 'Thanks for reaching out! I got your message and will reply within 24-48h.',
  subject_options: [
    '💼 Project / Freelance',
    '🤝 Collab / Partnership',
    '💬 Feedback',
    '🎙️ Podcast / Interview',
    '🐛 Bug report',
    '👋 Just saying hi',
  ],
  faq_items: [
    { q: "What's the best way to reach me?", a: 'Email. I reply within 24-48h. Instagram DMs work for quick things.' },
    { q: 'Do you take freelance?', a: 'Depends on the project. Send an email describing scope and timeline.' },
    { q: 'Can I send a PR to your repo?', a: 'Yes. Issues first, PR second.' },
    { q: 'Open to collabs / podcast guest?', a: 'Yes, if the topic aligns with what I do.' },
  ],
}

export function getDefaultSettings(locale: string) {
  return locale === 'pt-BR' ? DEFAULT_SETTINGS_PT : DEFAULT_SETTINGS_EN
}

export const DEFAULT_VISIBILITY: Omit<ContactPageVisibility, 'id' | 'site_id'> = {
  show_hero: true,
  show_social_links: true,
  show_contact_form: true,
  show_faq: true,
  show_avatar: true,
  show_bio: true,
  show_response_badge: true,
  social_order: ['email', 'instagram', 'youtube', 'x', 'github', 'rss'],
  social_visible: { email: true, instagram: true, youtube: true, x: true, github: true, rss: true },
  email_highlight: true,
  handwritten_note: true,
  show_subject_selector: true,
  show_marketing_consent: true,
}

import type { SponsorAd, HouseAd } from './types'

/**
 * Mock sponsor ads -- fictional brands coherent with dev/creator audience.
 * In production these would come from an API or CMS.
 */
export const SPONSORS: SponsorAd[] = [
  {
    id: 'railway-ghost',
    label_pt: 'PATROCINADO',
    label_en: 'SPONSORED',
    brand: 'Railway Ghost',
    brandColor: '#7B5BF7',
    headline_pt: 'Deploy sem stress, do dev ao prod',
    headline_en: "Deploys that don't keep you up at night",
    body_pt:
      'Hosting feito por dois desenvolvedores cansados de Heroku. Postgres, Redis, e um CLI que não te odeia. 14 dias grátis.',
    body_en:
      "Hosting built by two devs tired of Heroku. Postgres, Redis, and a CLI that doesn't hate you. 14 days free.",
    cta_pt: 'Conhecer o Railway Ghost →',
    cta_en: 'Try Railway Ghost →',
    url: '#sponsor-railway',
    tagline_pt: 'Indie hosting · Brasil/EU',
    tagline_en: 'Indie hosting · Brazil/EU',
    mark: `<svg viewBox="0 0 40 40" width="36" height="36">
      <rect x="3" y="3" width="34" height="34" rx="6" fill="#7B5BF7"/>
      <path d="M 12 14 L 12 26 L 28 26 L 28 14 Z" fill="none" stroke="#FFF" stroke-width="2"/>
      <circle cx="16" cy="20" r="1.5" fill="#FFF"/>
      <circle cx="20" cy="20" r="1.5" fill="#FFF"/>
      <circle cx="24" cy="20" r="1.5" fill="#FFF"/>
    </svg>`,
  },
  {
    id: 'ensaios-obsidian',
    label_pt: 'PATROCINADO',
    label_en: 'SPONSORED',
    brand: 'Ensaios de Obsidian',
    brandColor: '#3B5A4A',
    headline_pt: 'Um livro sobre escrever em público — sem performar',
    headline_en: 'A book about writing in public without performing',
    body_pt:
      'São 12 ensaios curtos sobre como manter uma prática de escrita honesta quando ninguém te paga pra escrever. Edição em português, lançada esse mês.',
    body_en:
      'Twelve short essays on keeping an honest writing practice when nobody pays you to write. Portuguese edition, out this month.',
    cta_pt: 'Comprar (R$ 39) →',
    cta_en: 'Buy (US$ 9) →',
    url: '#sponsor-obsidian',
    tagline_pt: 'Livro · 144 páginas',
    tagline_en: 'Book · 144 pages',
    mark: `<svg viewBox="0 0 40 40" width="36" height="36">
      <rect x="6" y="3" width="28" height="34" rx="1" fill="#3B5A4A"/>
      <rect x="6" y="3" width="3" height="34" fill="#2A4337"/>
      <line x1="14" y1="11" x2="29" y2="11" stroke="#D4C4A0" stroke-width="0.6"/>
      <line x1="14" y1="14" x2="29" y2="14" stroke="#D4C4A0" stroke-width="0.6"/>
      <line x1="14" y1="17" x2="25" y2="17" stroke="#D4C4A0" stroke-width="0.6"/>
      <text x="14" y="29" fill="#D4C4A0" font-family="Georgia, serif" font-size="6" font-style="italic">obsidian</text>
    </svg>`,
  },
  {
    id: 'convertkit',
    label_pt: 'PATROCINADO',
    label_en: 'SPONSORED',
    brand: 'Mailpond',
    brandColor: '#D4724B',
    headline_pt:
      'A plataforma de newsletter pra escritores que valorizam tipografia',
    headline_en:
      'A newsletter platform for writers who care about typography',
    body_pt:
      'Source Serif, Söhne, sua própria fonte custom. Sem templates plásticos. Lista de 1.000 grátis pra sempre.',
    body_en:
      'Source Serif, Söhne, your own custom font. No plastic templates. 1,000 subscribers free forever.',
    cta_pt: 'Migrar pra Mailpond →',
    cta_en: 'Move to Mailpond →',
    url: '#sponsor-mailpond',
    tagline_pt: 'Newsletter · grátis até 1k',
    tagline_en: 'Newsletter · free up to 1k',
    mark: `<svg viewBox="0 0 40 40" width="36" height="36">
      <rect x="3" y="3" width="34" height="34" rx="6" fill="#D4724B"/>
      <path d="M 8 14 L 20 24 L 32 14" stroke="#FFF" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 8 14 L 8 28 L 32 28 L 32 14" stroke="#FFF" stroke-width="2" fill="none" stroke-linejoin="round"/>
    </svg>`,
  },
]

/**
 * House ads -- own products (newsletter, video channel, related posts).
 */
export const HOUSE_ADS: HouseAd[] = [
  {
    id: 'house-newsletter',
    label_pt: 'DA CASA · NEWSLETTER',
    label_en: 'HOUSE · NEWSLETTER',
    kind: 'newsletter',
    brand: 'Caderno de Campo',
    brandColor: '#FF8240',
    headline_pt: 'Receba o próximo ensaio antes de virar público',
    headline_en: 'Get the next essay before it goes public',
    body_pt:
      'Uma carta a cada 15 dias, com o que estou escrevendo, lendo, e construindo. 1.247 leitores. Sem spam, sem afiliados.',
    body_en:
      'A letter every 15 days with what I\'m writing, reading, and building. 1,247 readers. No spam, no affiliates.',
    cta_pt: 'Assinar a newsletter →',
    cta_en: 'Subscribe →',
    url: 'newsletters.html',
    tagline_pt: 'Quinzenal · grátis',
    tagline_en: 'Bi-weekly · free',
    mark: `<svg viewBox="0 0 40 40" width="36" height="36">
      <rect x="6" y="9" width="28" height="22" rx="1" fill="#FF8240"/>
      <path d="M 6 9 L 20 21 L 34 9" stroke="#1A140C" stroke-width="1.6" fill="none"/>
      <rect x="6" y="9" width="28" height="22" rx="1" fill="none" stroke="#1A140C" stroke-width="1.4"/>
    </svg>`,
  },
  {
    id: 'house-youtube',
    label_pt: 'DA CASA · VÍDEO',
    label_en: 'HOUSE · VIDEO',
    kind: 'video',
    brand: 'Canal no YouTube',
    brandColor: '#C44B3D',
    headline_pt: 'Vejo sua dúvida em vídeo — toda quinta',
    headline_en: 'Your question, in video — every Thursday',
    body_pt:
      'Vídeos curtos sobre o que estou construindo. Esta semana: como o CMS gerencia vários sites com um post só.',
    body_en:
      "Short videos about what I'm building. This week: how the CMS manages multiple sites with one post.",
    cta_pt: 'Ver no YouTube →',
    cta_en: 'Watch on YouTube →',
    url: 'videos.html',
    tagline_pt: 'Vídeos · semanal',
    tagline_en: 'Videos · weekly',
    mark: `<svg viewBox="0 0 40 40" width="36" height="36">
      <rect x="3" y="9" width="34" height="22" rx="4" fill="#C44B3D"/>
      <path d="M 17 16 L 25 20 L 17 24 Z" fill="#FFF"/>
    </svg>`,
  },
  {
    id: 'house-related-post',
    label_pt: 'DA CASA · POST',
    label_en: 'HOUSE · POST',
    kind: 'post',
    brand: 'Leitura relacionada',
    brandColor: '#7A8A4D',
    headline_pt:
      'Por que abandonei o Notion para escrever — e o que veio depois',
    headline_en: 'Why I left Notion for writing — and what came next',
    body_pt:
      'Sobre fricção, atrito útil, e por que ferramentas "perfeitas" às vezes atrapalham. Ensaio de 12 minutos.',
    body_en:
      'On friction, useful resistance, and why "perfect" tools sometimes get in the way. A 12-minute essay.',
    cta_pt: 'Ler o ensaio →',
    cta_en: 'Read the essay →',
    url: 'post.html?p=notion',
    tagline_pt: 'Ensaio · 12 min',
    tagline_en: 'Essay · 12 min',
    mark: `<svg viewBox="0 0 40 40" width="36" height="36">
      <rect x="8" y="6" width="24" height="28" fill="#7A8A4D"/>
      <path d="M 13 14 L 27 14 M 13 19 L 27 19 M 13 24 L 22 24" stroke="#FFFCEE" stroke-width="1.6" stroke-linecap="round"/>
    </svg>`,
  },
]

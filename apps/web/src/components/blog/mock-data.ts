import type { AuthorData, MockComment, EngagementStats } from './types'

export const AUTHOR_THIAGO: AuthorData = {
  name: 'Thiago Figueiredo',
  role: 'Dev indie, BH',
  avatarUrl: null,
  initials: 'TF',
  bio: 'Construo software ha seis anos. Desde 2024, so pra mim mesmo: seis apps no forno, um canal no YouTube, um blog que virou o centro de tudo. Aqui voce me acha escrevendo uma vez por semana, filmando uma vez por semana, e quebrando coisa em producao com a frequencia que Deus achar justa.',
  links: [
    { label: 'YouTube', href: 'https://www.youtube.com/@bythiagofigueiredo' },
    { label: 'GitHub', href: 'https://github.com/tn-figueiredo' },
    { label: 'X', href: 'https://x.com/tnFigueiredo' },
    { label: 'RSS', href: '/rss.xml' },
  ],
}

export const MOCK_ENGAGEMENT: EngagementStats = {
  views: 2460,
  likes: 319,
  bookmarked: false,
}

export const MOCK_COMMENTS: MockComment[] = [
  {
    id: 'c1',
    authorName: 'Paula Reis',
    authorInitials: 'PR',
    avatarColor: '#C4956A',
    text: 'A promessa #3 e a mais honesta que eu li em muito tempo. Guardei aqui.',
    timeAgo: 'ha 2 dias',
    likes: 12,
    isAuthorReply: false,
    parentId: null,
  },
  {
    id: 'c1r1',
    authorName: 'Thiago Figueiredo',
    authorInitials: 'TF',
    avatarColor: 'var(--pb-accent)',
    text: 'Obrigado, Paula. Escrever essa parte foi a que mais travou — a gente sempre quer fingir que a coisa vai durar pra sempre.',
    timeAgo: 'ha 2 dias',
    likes: 7,
    isAuthorReply: true,
    parentId: 'c1',
  },
  {
    id: 'c2',
    authorName: 'Rafa Oliveira',
    authorInitials: 'RO',
    avatarColor: '#8BAA7A',
    text: 'Esperando o post sobre como funciona a junction table no detalhe. Tem link?',
    timeAgo: 'ha 3 dias',
    likes: 8,
    isAuthorReply: false,
    parentId: null,
  },
  {
    id: 'c3',
    authorName: 'Diego Souza',
    authorInitials: 'DS',
    avatarColor: '#7AA4B8',
    text: '+1, tambem curti o uso do rendered_at pra cache invalidation.',
    timeAgo: 'ha 2 dias',
    likes: 2,
    isAuthorReply: false,
    parentId: null,
  },
  {
    id: 'c4',
    authorName: 'Ana Costa',
    authorInitials: 'AC',
    avatarColor: '#B8A07A',
    text: 'Finalmente alguem que admite que 60 dos 83 drafts sao ruins. Isso e libertador.',
    timeAgo: 'ha 1 dia',
    likes: 15,
    isAuthorReply: false,
    parentId: null,
  },
]

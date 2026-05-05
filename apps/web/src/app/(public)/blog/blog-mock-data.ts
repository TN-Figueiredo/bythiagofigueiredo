export const MOCK_CATEGORIES = {
  code:    { pt: "Código",      en: "Code",      color: "#D65B1F", colorDark: "#E8752F" },
  product: { pt: "Produto",     en: "Product",   color: "#2F6B22", colorDark: "#4A8E3C" },
  essay:   { pt: "Ensaios",     en: "Essays",    color: "#1E4D7A", colorDark: "#3A7AB5" },
  diary:   { pt: "Diário",      en: "Journal",   color: "#8A4A8F", colorDark: "#A96DAE" },
  tools:   { pt: "Ferramentas", en: "Tools",     color: "#B87333", colorDark: "#D4914D" },
  career:  { pt: "Carreira",    en: "Career",    color: "#5B6E2B", colorDark: "#7A9340" },
} as const

export interface ArchivePost {
  id: string
  slug: string
  title: string
  excerpt: string
  category: string
  categoryColor: string
  categoryColorDark: string
  categoryLabel: string
  date: string
  isoDate: string
  readingTime: number
  tags: string[]
  coverUrl: string | null
  patternName: "dots" | "grid" | "diag" | "stripe" | "blur"
}

const PATTERNS = ["dots", "grid", "diag", "stripe", "blur"] as const

function pattern(i: number): ArchivePost["patternName"] {
  return PATTERNS[i % PATTERNS.length]!
}

function cat(key: keyof typeof MOCK_CATEGORIES) {
  const c = MOCK_CATEGORIES[key]
  return { category: key, categoryColor: c.color, categoryColorDark: c.colorDark, categoryLabel: c.pt }
}

export const MOCK_POSTS: ArchivePost[] = [
  {
    id: "mock-01",
    slug: "manifesto-bythiagofigueiredo",
    title: "Manifesto: por que construo em público",
    excerpt: "O que significa criar software, conteúdo e negócio à vista de todos — e por que decidi documentar cada passo.",
    ...cat("essay"),
    date: "24 Abr 2026",
    isoDate: "2026-04-24",
    readingTime: 9,
    tags: ["meta", "manifesto", "2026"],
    coverUrl: null,
    patternName: pattern(0),
  },
  {
    id: "mock-02",
    slug: "seis-apps-um-caderno",
    title: "Seis apps, um caderno e nenhum investidor",
    excerpt: "Reflexões sobre manter seis projetos paralelos sem equipe, sem funding — apenas disciplina e café.",
    ...cat("essay"),
    date: "20 Abr 2026",
    isoDate: "2026-04-20",
    readingTime: 8,
    tags: ["indie", "solo", "reflexão"],
    coverUrl: null,
    patternName: pattern(1),
  },
  {
    id: "mock-03",
    slug: "um-cms-para-governar",
    title: "Um CMS para governar todos os sites",
    excerpt: "Como desenhei um CMS multi-tenant com Supabase RLS, Next.js 15 e zero dependência de terceiros.",
    ...cat("code"),
    date: "17 Abr 2026",
    isoDate: "2026-04-17",
    readingTime: 6,
    tags: ["supabase", "nextjs", "cms"],
    coverUrl: null,
    patternName: pattern(2),
  },
  {
    id: "mock-04",
    slug: "onboarding-que-nao-pede",
    title: "Onboarding que não pede: o formulário invisível",
    excerpt: "Por que o melhor onboarding é aquele que o usuário nem percebe que está preenchendo.",
    ...cat("product"),
    date: "14 Abr 2026",
    isoDate: "2026-04-14",
    readingTime: 5,
    tags: ["ux", "produto"],
    coverUrl: null,
    patternName: pattern(3),
  },
  {
    id: "mock-05",
    slug: "semana-14-quase-desisti",
    title: "Semana 14: quase desisti (de novo)",
    excerpt: "O que acontece quando o burnout bate na porta e o único funcionário é você mesmo.",
    ...cat("diary"),
    date: "10 Abr 2026",
    isoDate: "2026-04-10",
    readingTime: 3,
    tags: ["diário", "solo"],
    coverUrl: null,
    patternName: pattern(4),
  },
  {
    id: "mock-06",
    slug: "custo-invisivel-contratar",
    title: "O custo invisível de contratar cedo demais",
    excerpt: "Por que adiei a primeira contratação e o que isso me ensinou sobre escalar sozinho.",
    ...cat("career"),
    date: "07 Abr 2026",
    isoDate: "2026-04-07",
    readingTime: 4,
    tags: ["solo", "gestão"],
    coverUrl: null,
    patternName: pattern(5),
  },
  {
    id: "mock-07",
    slug: "supabase-next15-dois-anos",
    title: "Supabase + Next.js 15: dois anos de lições",
    excerpt: "Tudo que aprendi rodando Supabase em produção com Next.js — do RLS ao realtime.",
    ...cat("code"),
    date: "02 Abr 2026",
    isoDate: "2026-04-02",
    readingTime: 7,
    tags: ["supabase", "nextjs"],
    coverUrl: null,
    patternName: pattern(6),
  },
  {
    id: "mock-08",
    slug: "cafezinho-deploy",
    title: "Um cafezinho entre deploys",
    excerpt: "Notas rápidas sobre o ritual de pausar, respirar e deixar o CI fazer o trabalho.",
    ...cat("diary"),
    date: "28 Mar 2026",
    isoDate: "2026-03-28",
    readingTime: 2,
    tags: ["diário", "deploy"],
    coverUrl: null,
    patternName: pattern(7),
  },
  {
    id: "mock-09",
    slug: "ferramentas-abril-2026",
    title: "Ferramentas que uso em abril de 2026",
    excerpt: "Stack completa: do editor ao deploy, passando por automações que me economizam horas.",
    ...cat("tools"),
    date: "25 Mar 2026",
    isoDate: "2026-03-25",
    readingTime: 5,
    tags: ["stack", "ferramentas"],
    coverUrl: null,
    patternName: pattern(8),
  },
  {
    id: "mock-10",
    slug: "produto-sem-mercado",
    title: "Produto sem mercado: a armadilha do builder",
    excerpt: "Construir é viciante. Mas sem validação, é só hobby disfarçado de negócio.",
    ...cat("essay"),
    date: "20 Mar 2026",
    isoDate: "2026-03-20",
    readingTime: 6,
    tags: ["produto", "validação"],
    coverUrl: null,
    patternName: pattern(9),
  },
  {
    id: "mock-11",
    slug: "analytics-minimalista",
    title: "Analytics minimalista: menos dados, mais decisão",
    excerpt: "Como reduzi meu painel de métricas a cinco números e passei a agir mais rápido.",
    ...cat("product"),
    date: "15 Mar 2026",
    isoDate: "2026-03-15",
    readingTime: 4,
    tags: ["produto", "métricas"],
    coverUrl: null,
    patternName: pattern(10),
  },
  {
    id: "mock-12",
    slug: "quando-escrever-codigo",
    title: "Quando parar de escrever código e começar a delegar",
    excerpt: "O momento em que o fundador técnico precisa trocar o teclado pelo telefone.",
    ...cat("career"),
    date: "10 Mar 2026",
    isoDate: "2026-03-10",
    readingTime: 5,
    tags: ["solo", "gestão"],
    coverUrl: null,
    patternName: pattern(11),
  },
  {
    id: "mock-13",
    slug: "bilingual-seo",
    title: "SEO bilíngue: hreflang sem dor de cabeça",
    excerpt: "Estratégia prática para ranquear em pt-BR e en sem duplicar conteúdo nem confundir crawlers.",
    ...cat("tools"),
    date: "05 Mar 2026",
    isoDate: "2026-03-05",
    readingTime: 6,
    tags: ["seo", "i18n"],
    coverUrl: null,
    patternName: pattern(12),
  },
  {
    id: "mock-14",
    slug: "roadmap-publico",
    title: "Roadmap público: transparência como estratégia",
    excerpt: "Por que publico meu roadmap aberto e como isso atrai colaboradores e confiança.",
    ...cat("essay"),
    date: "28 Fev 2026",
    isoDate: "2026-02-28",
    readingTime: 4,
    tags: ["indie", "gestão"],
    coverUrl: null,
    patternName: pattern(13),
  },
  {
    id: "mock-15",
    slug: "typescript-patterns",
    title: "Cinco patterns TypeScript que uso em todo projeto",
    excerpt: "Discriminated unions, branded types e outros truques que eliminam bugs em compile time.",
    ...cat("code"),
    date: "20 Fev 2026",
    isoDate: "2026-02-20",
    readingTime: 8,
    tags: ["typescript", "patterns"],
    coverUrl: null,
    patternName: pattern(14),
  },
  {
    id: "mock-16",
    slug: "primeiro-mil-leitores",
    title: "Os primeiros mil leitores: o que funcionou",
    excerpt: "Três canais, dois experimentos fracassados e a tática que finalmente trouxe audiência.",
    ...cat("product"),
    date: "12 Fev 2026",
    isoDate: "2026-02-12",
    readingTime: 5,
    tags: ["crescimento", "newsletter"],
    coverUrl: null,
    patternName: pattern(15),
  },
  {
    id: "mock-17",
    slug: "burnout-solo-dev",
    title: "Burnout de solo dev: sinais que ignorei",
    excerpt: "Trabalhei 90 dias seguidos. Aqui está o que quebrou e como reconstruí a rotina.",
    ...cat("diary"),
    date: "05 Fev 2026",
    isoDate: "2026-02-05",
    readingTime: 3,
    tags: ["diário", "saúde"],
    coverUrl: null,
    patternName: pattern(16),
  },
  {
    id: "mock-18",
    slug: "deploy-zero-downtime",
    title: "Deploy zero-downtime com edge functions",
    excerpt: "Como configuro deploys atômicos que nunca derrubam o site — mesmo em migração de schema.",
    ...cat("code"),
    date: "20 Jan 2026",
    isoDate: "2026-01-20",
    readingTime: 7,
    tags: ["devops", "deploy"],
    coverUrl: null,
    patternName: pattern(17),
  },
]

export interface MockAdCreative {
  id: string
  label: string
  brand: string
  brandColor: string
  headline: string
  body: string
  cta: string
  url: string
  tagline: string
}

export const MOCK_SPONSORS: MockAdCreative[] = [
  {
    id: "sponsor-railway",
    label: "PATROCINADO",
    brand: "Railway Ghost",
    brandColor: "#7B5BF7",
    headline: "Deploy sem stress, do dev ao prod",
    body: "Infra que escala com você. Zero config, logs em tempo real e preview environments automáticos.",
    cta: "Testar grátis",
    url: "https://railway.app",
    tagline: "Infra for builders",
  },
  {
    id: "sponsor-obsidian",
    label: "PATROCINADO",
    brand: "Ensaios de Obsidian",
    brandColor: "#3B5A4A",
    headline: "Um livro sobre escrever em público",
    body: "150 páginas sobre o processo de transformar notas soltas em ensaios publicados. Kindle + PDF.",
    cta: "Comprar agora",
    url: "https://ensaiosdeobsidian.com",
    tagline: "Da nota ao ensaio",
  },
  {
    id: "sponsor-mailpond",
    label: "PATROCINADO",
    brand: "Mailpond",
    brandColor: "#D4724B",
    headline: "A plataforma de newsletter pra escritores",
    body: "Editor limpo, analytics honestos e zero distração. Feita por quem escreve, para quem escreve.",
    cta: "Criar conta",
    url: "https://mailpond.io",
    tagline: "Newsletter sem ruído",
  },
]

export const MOCK_HOUSE_ADS: MockAdCreative[] = [
  {
    id: "house-newsletter",
    label: "DA CASA · NEWSLETTER",
    brand: "Caderno de Campo",
    brandColor: "#FF8240",
    headline: "Receba o próximo ensaio antes de virar público",
    body: "Uma vez por semana, direto no email. Sem spam, sem algoritmo — só texto que vale a pena ler.",
    cta: "Assinar grátis",
    url: "/newsletters/caderno-de-campo",
    tagline: "Toda segunda, 7h",
  },
  {
    id: "house-youtube",
    label: "DA CASA · YOUTUBE",
    brand: "Canal YouTube",
    brandColor: "#C44B3D",
    headline: "Vejo sua dúvida em vídeo — toda quinta",
    body: "Code reviews ao vivo, deep dives em arquitetura e respostas a perguntas de leitores.",
    cta: "Inscrever-se",
    url: "https://youtube.com/@tnfigueiredo",
    tagline: "Quintas às 19h",
  },
  {
    id: "house-related",
    label: "DA CASA · LEIA TAMBÉM",
    brand: "Post Relacionado",
    brandColor: "#7A8A4D",
    headline: "Por que abandonei o Notion para escrever",
    body: "Depois de dois anos, migrei tudo para Obsidian + Git. Aqui está o motivo e o processo completo.",
    cta: "Ler post",
    url: "/blog/pt-BR/por-que-abandonei-notion",
    tagline: "8 min de leitura",
  },
]

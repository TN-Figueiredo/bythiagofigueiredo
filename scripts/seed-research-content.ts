// scripts/seed-research-content.ts
// Usage:
//   npx tsx --env-file apps/web/.env.local scripts/seed-research-content.ts
//   npx tsx --env-file apps/web/.env.local scripts/seed-research-content.ts --unseed
//
// Seeds the Research CMS with the design-handoff sample content
// ("A transição Brasil → Ásia" world) so the redesign can be validated
// visually against realistic data. Mirrors design_files/research-data.js.
//
// Populates:
//   - research_themes  (6 canonical themes — only if missing)
//   - research_items   (7 pesquisas)
//   - research_decisions + research_decision_sources (5 decisões)
//   - research_focos + research_foco_themes + research_foco_sources (3 focos)
//
// IDEMPOTENT — every row uses a deterministic UUIDv5 derived from a fixed
// namespace + the handoff string id, so re-running upserts rather than
// duplicating. --unseed deletes exactly the rows this script created.
//
// Uses the service-role client (RLS-bypassing), same as seed-pipeline-content.ts.

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('Run with: npx tsx --env-file apps/web/.env.local scripts/seed-research-content.ts')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

const UNSEED = process.argv.includes('--unseed') || process.argv.includes('--clean')

// --- Deterministic UUIDv5 (RFC 4122, SHA-1 namespace) ---
// Implemented inline via node:crypto so the script has no external uuid dep
// and stays fully typed. Identical output to the `uuid` package's v5.
const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8' // RFC 4122 DNS namespace

function uuidv5(name: string, namespace: string): string {
  const nsBytes = Buffer.from(namespace.replace(/-/g, ''), 'hex')
  const hash = createHash('sha1')
  hash.update(nsBytes)
  hash.update(Buffer.from(name, 'utf8'))
  const bytes = hash.digest().subarray(0, 16)
  // Set version (5) and RFC 4122 variant bits.
  bytes[6] = (bytes[6]! & 0x0f) | 0x50
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// Stable namespace for deterministic ids. Derived once from a fixed string so
// the same handoff id always maps to the same UUID across every run / machine.
const NS = uuidv5('research-cms.seed.bythiagofigueiredo', DNS_NAMESPACE)

/** Deterministic UUID for a handoff entity, e.g. detId('item','r-custo'). */
function detId(kind: string, handoffId: string): string {
  return uuidv5(`${kind}:${handoffId}`, NS)
}

// ---------------------------------------------------------------------------
// Handoff data — faithful mirror of design_files/research-data.js
// ---------------------------------------------------------------------------

interface ThemeSeed {
  id: string
  label: string
  short: string
  color: string
  icon: string
  sort_order: number
}

const TEMAS: ThemeSeed[] = [
  { id: 'asia',  label: 'Ásia & Nomadismo',  short: 'Ásia',  color: '#22b8d6', icon: 'globe',    sort_order: 0 },
  { id: 'ia',    label: 'IA & Produção',     short: 'IA',    color: '#8b8cf6', icon: 'sparkles', sort_order: 1 },
  { id: 'dev',   label: 'Programação',       short: 'Dev',   color: '#22c55e', icon: 'blog',     sort_order: 2 },
  { id: 'games', label: 'Games & Pedigree',  short: 'Games', color: '#ec4899', icon: 'trophy',   sort_order: 3 },
  { id: 'grana', label: 'Monetização',       short: 'Grana', color: '#f59e0b', icon: 'dollar',   sort_order: 4 },
  { id: 'canal', label: 'Canal & Audiência', short: 'Canal', color: '#a855f7', icon: 'youtube',  sort_order: 5 },
]

// --- rich-HTML helpers (same shape research-data.js uses) ---
const h2 = (t: string) => `<h2>${t}</h2>`
const p = (t: string) => `<p>${t}</p>`
const note = (t: string) => `<blockquote><p>${t}</p></blockquote>`
const ul = (items: string[]) => `<ul>${items.map((i) => `<li><p>${i}</p></li>`).join('')}</ul>`
const ol = (items: string[]) => `<ol>${items.map((i) => `<li><p>${i}</p></li>`).join('')}</ol>`
const mark = (t: string) => `<mark>${t}</mark>`
const tasks = (items: [boolean, string][]) =>
  `<ul data-type="taskList">${items
    .map(
      ([d, t]) =>
        `<li data-type="taskItem" data-checked="${d}"><label><input type="checkbox"${
          d ? ' checked' : ''
        }><span></span></label><div><p>${t}</p></div></li>`
    )
    .join('')}</ul>`

interface PesquisaSeed {
  id: string
  tema: string
  status: 'fresca' | 'analise' | 'aplicada' | 'arquivada'
  source: 'cowork' | 'thiago' | 'dupla'
  title: string
  summary: string
  readMin: number
  pinned: boolean
  takeaways: string[]
  html: string
}

const PESQUISAS: PesquisaSeed[] = [
  {
    id: 'r-custo', tema: 'asia', status: 'aplicada', source: 'cowork',
    title: 'Custo de vida: Bangkok × Lisboa × São Paulo para um dev BR',
    summary:
      'Comparação honesta de moradia, comida, internet e visto. Bangkok ganha em custo/conforto, mas o gancho do vídeo é o contraste em dólar — o número que dói.',
    readMin: 7, pinned: true,
    takeaways: [
      'Bangkok roda ~40% mais barato que Lisboa com conforto superior para nômade.',
      'O número-âncora é aluguel + comida em dólar vs salário CLT médio no Brasil.',
      'Visto: o caminho realista é DTV (Destination Thailand Visa), não turista.',
    ],
    html: [
      p('Esta pesquisa compara três bases plausíveis para a temporada asiática, sempre pela lente do espectador brasileiro que sonha mas acha impossível. ' + mark('O ângulo do vídeo não é ‘é barato’ — é ‘dá pra fazer, e dói ver o quanto’.')),
      h2('O número que dói'),
      p('Em dólar, o combo aluguel + comida + transporte em Bangkok cabe em uma fração de um salário de dev sênior remoto. O choque vem ao colocar lado a lado com o custo equivalente em São Paulo somado ao que sobra no fim do mês.'),
      ul([
        'Moradia: studio bom em Sukhumvit sai por menos que um quarto decente em Pinheiros.',
        'Comida: comer fora todo dia é viável — o oposto da intuição brasileira.',
        'Internet: fibra simétrica barata e estável, ponto decisivo para quem faz deploy.',
      ]),
      h2('Lisboa como contraponto'),
      p('Lisboa é a rota ‘segura’ que todo dev BR considera. Serve de contraste: mais cara, mais saturada de brasileiros, menos ‘estrangeiro’ na thumbnail. Bangkok entrega o choque visual (placa em escrita não-latina) que a Lei da Thumbnail pede.'),
      note('Cuidado de DNA: nunca afirmar residência que não temos. O enquadramento é sempre ‘estou indo / antes de morar lá’, com passaporte brasileiro.'),
      h2('Visto — o caminho real'),
      ol([
        'DTV (Destination Thailand Visa): feito para nômades, 5 anos, múltiplas entradas.',
        'Comprovação de renda remota e reserva — listar os documentos no roteiro.',
        'Plano B: education/Muay Thai visa, citado mas não recomendado como principal.',
      ]),
    ].join(''),
  },
  {
    id: 'r-mmr', tema: 'games', status: 'analise', source: 'dupla',
    title: 'O arco MMR → MRR: de pro player a builder',
    summary:
      'Como ligar o pedigree gamer (top 1 BR) à narrativa de monetização sem soar saudosista. A ponte entre o pilar Games e o pilar Grana.',
    readMin: 6, pinned: true,
    takeaways: [
      '‘O jogo mudou — de MMR pra MRR’ é o arco-assinatura; usar como série, não vídeo único.',
      'O pedigree é credencial de escassez (top 1 BR), não nostalgia.',
      'Mostrar o número de MRR atual fecha o paralelo com o ranking antigo.',
    ],
    html: [
      p('O público que veio do gaming respeita resultado medido em ranking. A tese: traduzir essa régua para o mundo de produto — MMR vira MRR. ' + mark('Mesma obsessão por subir de patente, outra moeda.')),
      h2('Por que funciona'),
      ul([
        'Credencial rara: ‘fui top 1 do BR’ é escassez + aspiração, igual ao flex geográfico.',
        'Continuidade narrativa: o espectador acompanha uma subida, não um tutorial.',
        'Cross-tema: liga Games ao pilar dev/grana, justificando o carimbo TF como elo.',
      ]),
      h2('Riscos'),
      p('Saudosismo mata. Não pode virar ‘nos meus tempos de Dota’. O passado é trampolim para um número presente — o MRR de hoje na tela, ao lado do MMR de ontem.'),
      note('Sotaque do pilar: scanlines CRT, desalinho RGB no punch, patente no lugar da bandeira, badge AO VIVO roxo citando a Twitch. Nunca recriar logos de jogos.'),
    ].join(''),
  },
  {
    id: 'r-thumb', tema: 'canal', status: 'aplicada', source: 'thiago',
    title: 'Formatos de thumbnail para canal de temas misturados',
    summary:
      'Como o Nômade Raiz faz milhões sem tag de gênero, e o que isso significa para um canal que mistura viagem/IA/games/código.',
    readMin: 5, pinned: true,
    takeaways: [
      'Tag de gênero na thumb é poluição — a imagem entrega o tema sozinha.',
      'Dois formatos testáveis: (A) caixa de reação laranja, (B) nome do lugar gigante.',
      'O elo cross-tema é o carimbo TF, não uma tag.',
    ],
    html: [
      p('Referência observada (sem copiar): canais de viagem topo de funil vendem ‘é longe + é ele’ sem nenhuma tag. ' + mark('O tratamento invariável é a personalidade, não o tema.')),
      h2('As 5 âncoras, sempre'),
      ol([
        'Rosto recortado à direita, reação no olhar, rim-light laranja.',
        'Passaporte no topo-esquerdo: carimbo TF + etiqueta de origem (bandeira ou patente).',
        'Laranja #FF8240 em ≤10% da área (regra 60·30·10).',
        'Voz tipográfica: Archivo 900 + uma palavra Fraunces itálico (o número).',
        'Moldura + o estrangeiro nítido — a cena é a estrela, nunca borrada.',
      ]),
      h2('Os dois formatos a testar'),
      p('Nunca os dois juntos. ' + mark('Caixa de reação') + ' (frase curta em caixa laranja) versus ' + mark('nome do lugar gigante') + ' (país em Archivo 900 + número em Fraunces). O público escolhe pela retenção.'),
      note('Teste final: encolhida a ~168px, ao lado de outras, dá pra saber que é dele e que é longe sem ler o nome?'),
    ].join(''),
  },
  {
    id: 'r-stack', tema: 'ia', status: 'fresca', source: 'cowork',
    title: 'Stack de IA para produção de conteúdo em 2026',
    summary:
      'O que automatizar sem perder a voz: roteiro, corte, legenda, thumbnail. Onde a IA ajuda e onde ela ainda atrapalha.',
    readMin: 8, pinned: false,
    takeaways: [
      'IA é motor de produção, não de opinião — a tese sempre é do Thiago.',
      'Maior alavanca: transcrição → outline → variantes de título/thumb.',
      'Corte automático ainda exige passada humana para ritmo.',
    ],
    html: [
      p('Mapa do que a IA faz bem hoje no pipeline do estúdio, separando ganho real de hype. ' + mark('Regra: a IA acelera a produção; a direção continua humana.')),
      h2('Onde ganha'),
      ul([
        'Transcrição e outline a partir de um take bruto.',
        'Geração de 3 variantes de título/legenda por idioma (PT/EN).',
        'Rascunho de descrição, capítulos e posts derivados.',
      ]),
      h2('Onde ainda atrapalha'),
      ul([
        'Corte fino: ritmo e respiração ainda pedem ouvido humano.',
        'Thumbnail: gera ideias, mas a composição segue a Lei manualmente.',
      ]),
    ].join(''),
  },
  {
    id: 'r-news', tema: 'canal', status: 'analise', source: 'cowork',
    title: 'Newsletter bilíngue: cadência e formato',
    summary:
      'Semanal vs quinzenal, PT/EN no mesmo envio ou separados, e como a newsletter vira a memória do canal.',
    readMin: 6, pinned: false,
    takeaways: [
      'Separar PT e EN por canal/idioma — confirma a audiência, não dilui.',
      'Cadência semanal só se houver banco de pesquisa alimentando.',
      'A newsletter fecha o loop: pesquisa → decisão → conteúdo → carta.',
    ],
    html: [
      p('A newsletter não é resumo de vídeo — é o bastidor da decisão. ' + mark('‘Por que esse vídeo existe’ é o conteúdo.')),
      h2('Cadência'),
      p('Semanal exige um banco de pesquisa girando. Sem isso, vira tarefa e morre. A recomendação é quinzenal até o pilar de pesquisa estar redondo, depois semanal.'),
      h2('Estrutura por edição'),
      tasks([
        [true, 'Uma decisão da semana (o que mudou no plano e por quê).'],
        [false, 'Um número que dói (o contraste Brasil × lá).'],
        [false, 'Um bastidor de produção (a IA no pipeline, o erro do corte).'],
        [false, 'Um CTA honesto, sem clickbait.'],
      ]),
    ].join(''),
  },
  {
    id: 'r-nas', tema: 'dev', status: 'fresca', source: 'thiago',
    title: 'Self-hosting: vale um NAS para o estúdio nômade?',
    summary:
      'Backup de footage 4K, acesso remoto da Ásia e o trade-off entre carregar hardware e depender de cloud.',
    readMin: 5, pinned: false,
    takeaways: [
      'Footage 4K cresce rápido — cloud puro fica caro no longo prazo.',
      'NAS em casa + acesso remoto resolve, mas adiciona ponto de falha longe.',
      'Possível vídeo: ‘meu estúdio cabe numa mochila?’',
    ],
    html: [
      p('Questão prática que vira conteúdo: como um estúdio de uma pessoa só sobrevive a 17 mil km de distância do backup. ' + mark('O hardware é personagem, não especificação.')),
      h2('O trade-off'),
      ul([
        'Cloud: zero hardware para carregar, custo recorrente que escala com footage.',
        'NAS em casa: custo único, mas vira ponto de falha do outro lado do mundo.',
        'Híbrido: NAS como cofre + cloud como cache de trabalho ativo.',
      ]),
    ].join(''),
  },
  {
    id: 'r-titulo', tema: 'canal', status: 'arquivada', source: 'dupla',
    title: 'Títulos honestos que ainda dão clique',
    summary:
      'Anti-clickbait sem virar título morno. Como prometer o estrangeiro sem mentir sobre morar lá.',
    readMin: 4, pinned: false,
    takeaways: [
      'Iscas honestas: ‘com passaporte brasileiro’, ‘em dólar’, ‘sozinho’, ‘primeira vez’.',
      'O título completa a thumb, não repete.',
      'Nunca afirmar residência que não temos.',
    ],
    html: [
      p('Arquivo de princípios de título já incorporados à Lei. Mantido como referência. ' + mark('Honestidade é o diferencial competitivo, não uma limitação.')),
      h2('Iscas que funcionam'),
      ul([
        'Restrição de origem: ‘com passaporte brasileiro’.',
        'Moeda: ‘em dólar’, o contraste que dói.',
        'Vulnerabilidade: ‘sozinho’, ‘primeira vez’, ‘antes de morar lá’.',
      ]),
    ].join(''),
  },
]

interface HistoryEntry {
  label: string
  date: string
  note: string
}

interface DecisaoSeed {
  id: string
  statement: string
  horizon: 'agora' | 'proximo' | 'explorar'
  status: 'decidido' | 'testando' | 'revisar' | 'arquivado'
  tema: string
  date: string
  rationale: string
  context: string
  consequences: string[]
  metric: string
  revisit: string
  from: string[]
  drives: string[]
  history: HistoryEntry[]
}

const DECISOES: DecisaoSeed[] = [
  {
    id: 'd-arco',
    statement: 'Os próximos 3 meses giram em torno da transição Brasil → Ásia.',
    horizon: 'agora', status: 'decidido', tema: 'asia', date: '28 mai',
    rationale: 'É a credencial mais rara e aspiracional do canal. Concentra a narrativa em vez de pulverizar entre temas.',
    context: 'O canal mistura viagem, IA, games e código. Sem um eixo, cada vídeo recomeça do zero e a audiência não sabe o que esperar. A saída do Brasil rumo à Ásia como dev nômade é algo que a maioria dos brasileiros não pode fazer — escassez geográfica + aspiração. É a âncora natural do trimestre.',
    consequences: [
      'Todo roteiro do trimestre precisa amarrar no arco Brasil → Ásia, mesmo os de IA/código.',
      'O gancho é sempre o presente contínuo (‘estou indo’, ‘larguei tudo’) — nunca ‘moro lá’.',
      'Pilares fora do arco (games, NAS) entram como apoio, não como vídeo-âncora.',
    ],
    metric: 'Retenção média ≥ 45% nos vídeos do arco',
    revisit: 'Fim de ago 2026',
    from: ['r-custo'], drives: ['Roteiros', 'Newsletter', 'Thumbnails'],
    history: [
      { label: 'Decidido', date: '28 mai', note: 'Confirmado por você a partir da pesquisa de custo de vida.' },
      { label: 'Proposto', date: '27 mai', note: 'Cowork sugeriu a partir de 3 pesquisas de Ásia.' },
    ],
  },
  {
    id: 'd-formato',
    statement: 'Testar ‘caixa de reação’ × ‘nome do lugar gigante’ em 3 vídeos.',
    horizon: 'agora', status: 'testando', tema: 'canal', date: '30 mai',
    rationale: 'São os dois formatos de texto da Lei. O público decide pela retenção — testar nunca a DNA, só o gancho.',
    context: 'A Lei da Thumbnail fixa a DNA (rosto, passaporte, laranja, voz, estrangeiro), mas deixa o formato do texto em aberto entre dois caminhos. Em vez de escolher no achismo, rodar um teste A/B honesto: mesma DNA, gancho diferente, o público decide pela retenção.',
    consequences: [
      '3 vídeos seguidos saem com as duas variantes via YouTube Test & Compare.',
      'Só o formato do texto muda — a DNA permanece idêntica nas duas.',
      'A vencedora vira padrão; a perdedora é arquivada com o aprendizado registrado.',
    ],
    metric: 'CTR e retenção dos 30s iniciais nas 3 duplas',
    revisit: 'Após o 3º vídeo (meados jun)',
    from: ['r-thumb'], drives: ['Thumbnails'],
    history: [
      { label: 'Testando', date: '30 mai', note: 'Primeiro par no ar.' },
      { label: 'Decidido', date: '29 mai', note: 'Você aprovou rodar o teste.' },
    ],
  },
  {
    id: 'd-preco',
    statement: 'Todo vídeo de viagem mostra o contraste de preço em dólar.',
    horizon: 'agora', status: 'decidido', tema: 'grana', date: '29 mai',
    rationale: 'O número que dói é o gancho universal. Liga viagem a grana sem esforço.',
    context: 'Preço em dólar contra o salário CLT médio do Brasil é o número que toda audiência sente. Funciona como ponte entre o pilar viagem e o pilar grana sem precisar de transição forçada — o contraste já carrega a tensão.',
    consequences: [
      'Aluguel + comida sempre aparecem em dólar, com o comparativo Brasil na tela.',
      'O número-âncora entra na thumb quando for o gancho mais forte do vídeo.',
      'Evitar números redondos demais — a precisão é o que dá credibilidade.',
    ],
    metric: 'Aparição do contraste em 100% dos vídeos de viagem',
    revisit: 'Fim de ago 2026',
    from: ['r-custo'], drives: ['Roteiros'],
    history: [
      { label: 'Decidido', date: '29 mai', note: 'Confirmado a partir da pesquisa de custo de vida.' },
    ],
  },
  {
    id: 'd-news',
    statement: 'Newsletter quinzenal agora, semanal quando o banco de pesquisa girar.',
    horizon: 'proximo', status: 'revisar', tema: 'canal', date: '01 jun',
    rationale: 'Semanal sem pesquisa alimentando vira tarefa e morre. Escalar cadência depois.',
    context: 'A newsletter é a memória do canal, mas só sustenta cadência se houver banco de pesquisa girando. Começar semanal sem lastro vira obrigação e morre em um mês. Quinzenal protege a qualidade até o fluxo de pesquisa justificar acelerar.',
    consequences: [
      'Envio quinzenal fixo até o banco de pesquisa sustentar semanal.',
      'PT e EN separados por canal/idioma — confirma a audiência, não dilui.',
      'Reavaliar a cadência quando houver ≥ 4 pesquisas frescas por mês.',
    ],
    metric: 'Taxa de abertura ≥ 40% antes de acelerar',
    revisit: 'Set 2026',
    from: ['r-news'], drives: ['Newsletter'],
    history: [
      { label: 'Revisar', date: '01 jun', note: 'Aguardando o banco de pesquisa encher para decidir cadência.' },
    ],
  },
  {
    id: 'd-games',
    statement: 'Rodar 1 piloto da série Games ao vivo (MMR → MRR) para validar retenção.',
    horizon: 'explorar', status: 'revisar', tema: 'games', date: '02 jun',
    rationale: 'Aposta de pilar. Só vira série recorrente se a retenção do piloto justificar.',
    context: 'O arco-assinatura ‘o jogo mudou — de MMR pra MRR’ liga o pedigree gamer (top 1 BR) à narrativa de monetização. Tem potencial de série, mas é aposta: roda 1 piloto ao vivo e deixa a retenção decidir antes de virar formato recorrente.',
    consequences: [
      '1 piloto ao vivo gravado, sem compromisso de série ainda.',
      'Usar o pedigree como credencial de escassez, nunca como nostalgia.',
      'Só vira série se a retenção do piloto bater a média do canal.',
    ],
    metric: 'Retenção do piloto ≥ média do canal',
    revisit: 'Após o piloto',
    from: ['r-mmr'], drives: ['Roteiros'],
    history: [
      { label: 'Revisar', date: '02 jun', note: 'Aposta de pilar aguardando piloto.' },
    ],
  },
]

interface FocoSeed {
  id: string
  horizon: 'agora' | 'proximo' | 'explorar'
  active: boolean
  state: 'ativo' | 'proposto' | 'rascunho'
  author: 'thiago' | 'cowork'
  title: string
  window: string
  thesis: string
  temas: string[]
  metric: string
  basedOn: string[]
}

const FOCOS: FocoSeed[] = [
  {
    id: 'f-asia', horizon: 'agora', active: true, state: 'ativo', author: 'thiago',
    title: 'A transição Brasil → Ásia',
    window: 'Jun – Ago 2026',
    thesis:
      'O canal inteiro gira em torno de UMA narrativa nos próximos 3 meses: a saída do Brasil rumo à Ásia como dev nômade. O gancho é o presente contínuo — “estou indo”, “larguei tudo” —, nunca “moro lá”. Escassez geográfica + aspiração: algo que a maioria dos brasileiros não pode fazer.',
    temas: ['asia', 'grana', 'canal'],
    metric: '8 de 11 vídeos do trimestre',
    basedOn: ['r-custo', 'r-thumb'],
  },
  {
    id: 'f-ia', horizon: 'proximo', active: false, state: 'proposto', author: 'cowork',
    title: 'IA como motor de produção (mostrar, não falar)',
    window: 'Set – Out 2026',
    thesis:
      'Proposta do Cowork a partir das suas pesquisas: transformar o pilar IA de ‘assunto’ em ‘método visível’ — vídeos onde a IA constrói junto, em público, do código ao deploy. Revise, ajuste e confirme para virar o próximo foco.',
    temas: ['ia', 'dev'],
    metric: 'Série de 4 episódios em outline',
    basedOn: ['r-stack', 'r-mmr'],
  },
  {
    id: 'f-games', horizon: 'explorar', active: false, state: 'rascunho', author: 'thiago',
    title: 'Games ao vivo — o arco MMR → MRR',
    window: 'Aposta · sem data',
    thesis:
      'Testar uma série mensal ligando o pedigree gamer (top 1 BR, Dota/WYD) à narrativa de builder. ‘O jogo mudou — de MMR pra MRR.’ Sotaque CRT/scanline próprio, badge AO VIVO citando a Twitch.',
    temas: ['games', 'grana'],
    metric: '1 piloto para validar retenção',
    basedOn: ['r-mmr'],
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip HTML tags into plaintext for content_md (drives word_count trigger). */
function htmlToText(html: string): string {
  return html
    .replace(/<\/(h2|p|li|blockquote)>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n\n')
    .trim()
}

async function resolveSiteId(): Promise<{ siteId: string; domain: string }> {
  const targetDomain = process.env.NEXT_PUBLIC_DEV_SITE_HOSTNAME || 'bythiagofigueiredo.com'
  const { data: site, error } = await supabase
    .from('sites')
    .select('id')
    .contains('domains', [targetDomain])
    .single()
  if (error || !site) {
    throw new Error(`Could not resolve site for domain "${targetDomain}": ${error?.message}`)
  }
  return { siteId: site.id as string, domain: targetDomain }
}

// Deterministic id maps (handoff id -> UUID).
const itemUuid = (handoffId: string) => detId('item', handoffId)
const decisionUuid = (handoffId: string) => detId('decision', handoffId)
const focoUuid = (handoffId: string) => detId('foco', handoffId)

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed(siteId: string): Promise<void> {
  // ---- Themes: insert only if missing (don't clobber existing) -----------
  console.log('--- Themes ---')
  let themesInserted = 0
  for (const t of TEMAS) {
    const { data: existing } = await supabase
      .from('research_themes')
      .select('id')
      .eq('site_id', siteId)
      .eq('id', t.id)
      .maybeSingle()
    if (existing) {
      console.log(`  · ${t.id} already present — left untouched`)
      continue
    }
    const { error } = await supabase.from('research_themes').insert({
      id: t.id, site_id: siteId, label: t.label, short: t.short,
      color: t.color, icon: t.icon, sort_order: t.sort_order,
    })
    if (error) {
      console.error(`  ✗ ${t.id}: ${error.message}`)
      continue
    }
    themesInserted++
    console.log(`  ✓ ${t.id} inserted`)
  }

  // ---- Pesquisas → research_items ----------------------------------------
  console.log('\n--- Pesquisas (research_items) ---')
  let itemCount = 0
  for (const r of PESQUISAS) {
    const contentMd = htmlToText(r.html)
    const { error } = await supabase.from('research_items').upsert(
      {
        id: itemUuid(r.id),
        site_id: siteId,
        topic_id: null,
        theme_id: r.tema,
        title: r.title,
        summary: r.summary,
        status: r.status,
        source: r.source,
        content_md: contentMd,
        content_html: r.html,
        takeaways: r.takeaways,
        pinned: r.pinned,
        read_min: r.readMin,
      },
      { onConflict: 'id' }
    )
    if (error) {
      console.error(`  ✗ ${r.id}: ${error.message}`)
      continue
    }
    itemCount++
    console.log(`  ✓ ${r.id} [${r.status}] — ${r.title.slice(0, 50)}`)
  }

  // ---- Decisões → research_decisions + research_decision_sources ---------
  console.log('\n--- Decisões (research_decisions) ---')
  let decisionCount = 0
  let decisionSourceCount = 0
  for (const d of DECISOES) {
    const did = decisionUuid(d.id)
    const { error } = await supabase.from('research_decisions').upsert(
      {
        id: did,
        site_id: siteId,
        title: d.statement, // handoff `statement` → research_decisions.title
        rationale: d.rationale,
        horizon: d.horizon,
        status: d.status,
        theme_id: d.tema,
        date_label: d.date,
        drives: d.drives,
        context: d.context,
        consequences: d.consequences,
        metric: d.metric,
        revisit: d.revisit,
        history: d.history,
      },
      { onConflict: 'id' }
    )
    if (error) {
      console.error(`  ✗ ${d.id}: ${error.message}`)
      continue
    }
    decisionCount++

    // Junction: from[] research ids → research_decision_sources.
    // Replace exactly this decision's rows for idempotency.
    await supabase.from('research_decision_sources').delete().eq('decision_id', did)
    for (const srcHandoffId of d.from) {
      const { error: jErr } = await supabase.from('research_decision_sources').insert({
        decision_id: did,
        research_id: itemUuid(srcHandoffId),
      })
      if (jErr) {
        console.error(`    ✗ source ${d.id}←${srcHandoffId}: ${jErr.message}`)
        continue
      }
      decisionSourceCount++
    }
    console.log(`  ✓ ${d.id} [${d.status}] — ${d.statement.slice(0, 48)}`)
  }

  // ---- Focos → research_focos (+ themes + sources) -----------------------
  // Single-active invariant: deactivate any non-seed active foco first so the
  // partial unique index (site_id WHERE active) never collides on insert.
  console.log('\n--- Focos (research_focos) ---')
  const activeSeedFoco = FOCOS.find((f) => f.active)
  if (activeSeedFoco) {
    const keepId = focoUuid(activeSeedFoco.id)
    const { error: deactErr } = await supabase
      .from('research_focos')
      .update({ active: false, state: 'arquivado', ended_at: new Date().toISOString() })
      .eq('site_id', siteId)
      .eq('active', true)
      .neq('id', keepId)
    if (deactErr) console.error(`  ⚠ could not deactivate prior active foco: ${deactErr.message}`)
  }

  let focoCount = 0
  let focoThemeCount = 0
  let focoSourceCount = 0
  for (const f of FOCOS) {
    const fid = focoUuid(f.id)
    const { error } = await supabase.from('research_focos').upsert(
      {
        id: fid,
        site_id: siteId,
        title: f.title,
        description: f.thesis, // handoff `thesis` → research_focos.description
        state: f.state,
        horizon: f.horizon,
        active: f.active,
        author: f.author,
        metric: f.metric,
        window_label: f.window, // handoff `window` → window_label
        started_at: f.active ? new Date().toISOString() : null,
      },
      { onConflict: 'id' }
    )
    if (error) {
      console.error(`  ✗ ${f.id}: ${error.message}`)
      continue
    }
    focoCount++

    // Themes junction (temas[] → research_foco_themes).
    await supabase.from('research_foco_themes').delete().eq('foco_id', fid)
    for (const themeId of f.temas) {
      const { error: tErr } = await supabase.from('research_foco_themes').insert({
        foco_id: fid, theme_id: themeId, site_id: siteId,
      })
      if (tErr) { console.error(`    ✗ theme ${f.id}←${themeId}: ${tErr.message}`); continue }
      focoThemeCount++
    }

    // Sources junction (basedOn[] research ids → research_foco_sources.item_id).
    await supabase.from('research_foco_sources').delete().eq('foco_id', fid)
    for (const srcHandoffId of f.basedOn) {
      const { error: sErr } = await supabase.from('research_foco_sources').insert({
        foco_id: fid, item_id: itemUuid(srcHandoffId),
      })
      if (sErr) { console.error(`    ✗ source ${f.id}←${srcHandoffId}: ${sErr.message}`); continue }
      focoSourceCount++
    }

    console.log(`  ✓ ${f.id} [${f.state}${f.active ? ', ACTIVE' : ''}] — ${f.title.slice(0, 44)}`)
  }

  console.log('\n--- Done (seed) ---')
  console.log(`Themes inserted:           ${themesInserted} (of ${TEMAS.length}; existing left untouched)`)
  console.log(`Research items upserted:   ${itemCount}`)
  console.log(`Decisions upserted:        ${decisionCount}`)
  console.log(`Decision sources:          ${decisionSourceCount}`)
  console.log(`Focos upserted:            ${focoCount} (1 active)`)
  console.log(`Foco themes:               ${focoThemeCount}`)
  console.log(`Foco sources:              ${focoSourceCount}`)
}

// ---------------------------------------------------------------------------
// Unseed — delete exactly the rows this script created (by deterministic id).
// Junction rows cascade via ON DELETE CASCADE, but we delete them explicitly
// for an accurate count and to be robust if cascades are ever relaxed.
// ---------------------------------------------------------------------------

async function unseed(siteId: string): Promise<void> {
  const itemIds = PESQUISAS.map((r) => itemUuid(r.id))
  const decisionIds = DECISOES.map((d) => decisionUuid(d.id))
  const focoIds = FOCOS.map((f) => focoUuid(f.id))

  console.log('--- Unseed ---')

  // Junctions first.
  const dsDel = await supabase
    .from('research_decision_sources')
    .delete()
    .in('decision_id', decisionIds)
    .select('decision_id')
  console.log(`  decision sources removed: ${dsDel.data?.length ?? 0}`)

  const ftDel = await supabase
    .from('research_foco_themes')
    .delete()
    .in('foco_id', focoIds)
    .select('foco_id')
  console.log(`  foco themes removed:      ${ftDel.data?.length ?? 0}`)

  const fsDel = await supabase
    .from('research_foco_sources')
    .delete()
    .in('foco_id', focoIds)
    .select('foco_id')
  console.log(`  foco sources removed:     ${fsDel.data?.length ?? 0}`)

  // Parents.
  const focoDel = await supabase
    .from('research_focos')
    .delete()
    .eq('site_id', siteId)
    .in('id', focoIds)
    .select('id')
  console.log(`  focos removed:            ${focoDel.data?.length ?? 0}`)

  const decDel = await supabase
    .from('research_decisions')
    .delete()
    .eq('site_id', siteId)
    .in('id', decisionIds)
    .select('id')
  console.log(`  decisions removed:        ${decDel.data?.length ?? 0}`)

  const itemDel = await supabase
    .from('research_items')
    .delete()
    .eq('site_id', siteId)
    .in('id', itemIds)
    .select('id')
  console.log(`  research items removed:   ${itemDel.data?.length ?? 0}`)

  console.log('\n--- Done (unseed) ---')
  console.log('Themes are intentionally NOT removed (shared catalogue, may be in use).')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { siteId, domain } = await resolveSiteId()
  console.log(`Site: ${siteId} (domain: ${domain})`)
  console.log(`Mode: ${UNSEED ? 'UNSEED (delete seeded rows)' : 'SEED (upsert sample content)'}\n`)

  if (UNSEED) {
    await unseed(siteId)
  } else {
    await seed(siteId)
  }
}

main().catch((err: unknown) => {
  console.error('Failed:', err)
  process.exit(1)
})

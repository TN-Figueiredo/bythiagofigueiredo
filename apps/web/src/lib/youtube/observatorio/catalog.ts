// Port of dados.js:137-167 — title formula catalogue and theme catalogue (single source).
import type { Niche } from './types'
import { BUILTIN_NICHES } from './niche'

export interface Formula { id: string; label: string; short: string; test(t: string): boolean; niches: Niche[]; ex: string }

const PLACES = 'Pakistan|Lahore|Karachi|Peshawar|Hunza|Japan|Tokyo|Osaka|Kyoto|Okinawa|Hokkaido|Arima Onsen|Bangkok|Thailand|Koh Tao|Chiang Mai|Cambodia|Vietnam|Laos|Nepal|Georgia|Tbilisi|Bulgaria|Moldova|Transnistria|Lagos|Nigeria|Dhaka|Bangladesh|North Korea|Mongolia|Peru|Lima|Bolivia|Kazakhstan|Almaty|Uzbekistan|Tashkent|Kyrgyzstan|Afeganistão|Afghanistan|Japão|Tóquio|Quirguistão|Tajiquistão|Pamir|Turcomenistão|Ásia Central|América do Sul|Mongólia|Bolívia|Cusco|Chile|Lisboa|Paris|Marrocos|Índia|Seul|Cazaquistão|Osh|Paquistão|Vietnã|Nepal|Geórgia|Índia'
const PLACES_RE = new RegExp('\\b(' + PLACES + ')')

export const FORMULAS: ReadonlyArray<Formula> = [
  { id: 'preco', label: 'Preço no título', short: 'preço', test: t => /(R\$|US\$|\$|€)\s?\d/.test(t), niches: ['viagem', 'ia'], ex: 'Trying a $2.70 Pakistan\'s version of KFC' },
  { id: 'numero', label: 'Número ou lista', short: 'número', test: t => /(^|\s)\d+\s+(dias|days|hours|horas|things|coisas|apps|tools|ferramentas|ways|lugares|places|countries|países|minutes|minutos|seconds|segundos|AI)\b/i.test(t.replace(/(R\$|US\$|\$)\s?[\d.,]+k?/g, '')), niches: ['viagem', 'ia'], ex: 'I Tested 7 AI Video Tools' },
  { id: 'pergunta', label: 'Pergunta no título', short: 'pergunta', test: t => /\?/.test(t), niches: ['viagem', 'ia'], ex: 'Is Tbilisi Safe Right Now?' },
  { id: 'reacao-hiperbole', label: 'Reação com hipérbole', short: 'reação', test: t => /\b(INSANE|INSANELY|Crazy|Wild|Shocking|Scary|Go This Hard|Dangerous|Unreal|absurd[oa]|insan[oa]|bizarr[oa])\b/i.test(t), niches: ['ia'], ex: 'Claude Opus 5.5 Didn\'t Need to Go This Hard' },
  { id: 'superlativo', label: 'Superlativo', short: 'superlativo', test: t => /\b(Most|Best|Worst|Cheapest|Strangest|Slowest|Biggest|Fastest|Oldest|Last)\b|\bmais (barat|car|perigos|estranh|fechad|alt|lent|antig)\w*|\b(melhor|pior)\b/i.test(t), niches: ['viagem', 'ia'], ex: 'The Most Dangerous Market in Lagos' },
  { id: 'nome-do-lugar', label: 'Nome do lugar', short: 'lugar', test: t => PLACES_RE.test(t), niches: ['viagem'], ex: 'Ninja Training Dojo in Arima Onsen, Japan' },
  { id: 'primeira-pessoa', label: 'Primeira pessoa', short: '1ª pessoa', test: t => /^(I|I'm|I’ve|I've|My|How I|Eu|Fiquei|Fui|Testei|Comi|Dormi|Cruzei|Atravessei|Visitei|Gastei|Fiz|Cheguei)\b/.test(t), niches: ['viagem', 'ia'], ex: 'I Spent 24 Hours in Bangkok’s Strangest Hotel' },
  { id: 'nome-do-modelo', label: 'Nome do modelo de IA', short: 'modelo', test: t => /\b(GPT|Claude|Opus|Gemini|Grok|Llama|DeepSeek|Sora|Veo|Kling|Hailuo|Midjourney|Qwen|o4)\b/.test(t), niches: ['ia'], ex: 'GPT-6 Astra Is Finally Here' },
  { id: 'tutorial', label: 'Tutorial ou passo a passo', short: 'tutorial', test: t => /(passo a passo|tutorial|how to|como (criar|fazer|usar|ganhar)|step by step|in \d+ minutes|em \d+ minutos)/i.test(t), niches: ['ia'], ex: 'Como criar vídeos cinematográficos e virais com o Hailuo' },
]
export const FORMULA: Readonly<Record<string, Formula>> = Object.fromEntries(FORMULAS.map(f => [f.id, f]))
export const formulasOf = (t: string): string[] => FORMULAS.filter(f => f.test(t)).map(f => f.id)
/** As fórmulas universais: as que valem para todos os nichos de fábrica (preço, número, pergunta, superlativo, 1ª pessoa). */
const UNIVERSAL: ReadonlyArray<Formula> = FORMULAS.filter(f => BUILTIN_NICHES.every(n => f.niches.includes(n.id)))
const CATALOGUED = new Set(FORMULAS.flatMap(f => f.niches))
/**
 * Fórmulas de um nicho: as do catálogo para viagem/ia; para um nicho criado pelo dono, as universais.
 * Sem nicho (ou Todos) nenhuma fórmula é analisada, como sempre foi.
 */
export function formulasFor(niche: string | undefined): ReadonlyArray<Formula> {
  if (!niche || niche === 'todos') return []
  return CATALOGUED.has(niche) ? FORMULAS.filter(f => f.niches.includes(niche)) : UNIVERSAL
}

export interface Theme { id: string; niche: Niche; label: string }
export const THEMES: ReadonlyArray<Theme> = [
  { id: 'comida-de-rua', niche: 'viagem', label: 'Comida de rua barata' },
  { id: 'lugares-perigosos', niche: 'viagem', label: 'Lugares com fama de perigosos' },
  { id: 'trens-e-onibus', niche: 'viagem', label: 'Trens e ônibus de longa distância' },
  { id: 'rotina-nomade', niche: 'viagem', label: 'Rotina de nômade e chegada a um país' },
  { id: 'japao-fora-das-capitais', niche: 'viagem', label: 'Japão fora das capitais' },
  { id: 'custo-de-viagem', niche: 'viagem', label: 'Quanto custa viajar ou morar' },
  { id: 'lancamento-de-modelo', niche: 'ia', label: 'Lançamento de modelo' },
  { id: 'agentes-e-automacao', niche: 'ia', label: 'Agentes e automação' },
  { id: 'ferramentas-da-semana', niche: 'ia', label: 'Ferramentas de IA da semana' },
  { id: 'video-com-ia', niche: 'ia', label: 'Vídeo gerado por IA' },
  { id: 'negocio-solo-com-ia', niche: 'ia', label: 'Negócio solo com IA' },
  { id: 'ia-e-emprego', niche: 'ia', label: 'IA, emprego e lei' },
]
export const THEME: Readonly<Record<string, Theme>> = Object.fromEntries(THEMES.map(t => [t.id, t]))
/** O nicho tem lista de temas? (só os de fábrica, hoje: o catálogo de temas é fixo) */
export function hasThemes(niche: string): boolean { return THEMES.some(t => t.niche === niche) }

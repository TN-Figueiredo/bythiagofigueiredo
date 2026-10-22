// Tokens de tema para o "parecido" (F2 T5): mesma normalização do lugar + stopwords fixas pt/en.
import { normalizarLugar } from '../lugar/normalizar'

const STOPWORDS: ReadonlySet<string> = new Set([
  // pt
  'para', 'com', 'sem', 'uma', 'uns', 'umas', 'por', 'dos', 'das', 'nos', 'nas', 'que', 'como', 'mais', 'menos',
  'muito', 'muita', 'seu', 'sua', 'seus', 'suas', 'meu', 'minha', 'nao', 'sim', 'esta', 'este', 'esse', 'essa',
  'isso', 'isto', 'aqui', 'ali', 'ate', 'sobre', 'entre', 'depois', 'antes', 'tudo', 'todo', 'toda', 'todos',
  'todas', 'ser', 'ter', 'foi', 'vai', 'vou', 'tem', 'ele', 'ela', 'eles', 'elas', 'quando', 'onde', 'qual',
  'pelo', 'pela', 'num', 'numa', 'dia', 'dias', 'vlog', 'video',
  // en
  'the', 'and', 'for', 'with', 'you', 'your', 'our', 'are', 'was', 'were', 'this', 'that', 'these', 'those',
  'from', 'into', 'about', 'what', 'when', 'where', 'how', 'why', 'who', 'have', 'has', 'had', 'not', 'but',
  'all', 'can', 'will', 'just', 'out', 'its', 'his', 'her', 'they', 'them', 'than', 'then', 'there', 'here',
  'day', 'days',
])

/** Tokens únicos com ≥ 3 letras, sem stopwords. Entrada: título + tags (a descrição só entra no lugar). */
export function tokensDe(texto: string): string[] {
  const vistos = new Set<string>()
  for (const t of normalizarLugar(texto).split(' ')) {
    if (t.length >= 3 && !STOPWORDS.has(t)) vistos.add(t)
  }
  return [...vistos]
}

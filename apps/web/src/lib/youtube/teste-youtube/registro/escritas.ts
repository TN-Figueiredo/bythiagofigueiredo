import type { CampoTeste, EscritaConhecida } from '../tipos'

export interface LinhasEscrita {
  testes: Array<{ id: string; test_type: string; winner_applied_at: string | null }>
  ciclos: Array<{ test_id: string; started_at: string | null; ended_at: string | null; end_reason: string | null }>
  restauracoes: Array<{ test_id: string; campo: 'title' | 'thumbnail'; escreveu: boolean | null; em: string }>
}

export function camposDoTipo(testType: string): CampoTeste[] {
  switch (testType) {
    case 'title': return ['titulo']
    case 'combo': return ['titulo', 'miniatura']
    case 'thumbnail': return ['miniatura']
    default: return []
  }
}

/**
 * Escritas do próprio app (§6.3 peça 1). Não reescreve `em`: o texto do banco passa intacto e a regra valida o fuso
 * (instante inválido não é filtrado aqui, para falhar alto na regra e virar avaliação `erro` só daquele vídeo).
 */
export function escritasDoApp(l: LinhasEscrita, janela: { deMs: number; ateMs: number }): EscritaConhecida[] {
  const tipoDe = new Map(l.testes.map(t => [t.id, t.test_type]))
  const brutas: EscritaConhecida[] = []
  const doTeste = (testId: string, em: string | null): void => {
    if (em === null) return
    for (const campo of camposDoTipo(tipoDe.get(testId) ?? '')) brutas.push({ em, campo })
  }
  for (const t of l.testes) doTeste(t.id, t.winner_applied_at)
  for (const c of l.ciclos) {
    doTeste(c.test_id, c.started_at)
    if (c.end_reason !== null && c.end_reason !== 'rotacao') doTeste(c.test_id, c.ended_at)
  }
  for (const r of l.restauracoes) {
    if (r.escreveu !== true) continue
    brutas.push({ em: r.em, campo: r.campo === 'title' ? 'titulo' : 'miniatura' })
  }
  const vistos = new Set<string>()
  const out: Array<{ e: EscritaConhecida; ms: number }> = []
  for (const e of brutas) {
    const ms = Date.parse(e.em)
    if (!Number.isNaN(ms) && (ms < janela.deMs || ms > janela.ateMs)) continue
    const k = `${e.em}|${e.campo}`
    if (vistos.has(k)) continue
    vistos.add(k)
    out.push({ e, ms })
  }
  return out.sort((a, b) => (Number.isNaN(a.ms) || Number.isNaN(b.ms) ? 0 : a.ms - b.ms)).map(x => x.e)
}

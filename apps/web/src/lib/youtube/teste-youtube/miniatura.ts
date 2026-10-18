import { compararCodePoint } from './normalizar-titulo'
import { DHASH_MAX_SAME, hamming, thumbRepresentatives } from './dhash'
import { classeDe, IMAGEM_PADRAO_YT, instanteDoEtag, mesmaImagem } from './imagem'
import type { LeituraPreparada } from './preparar'
import type { EstadoCampoMiniatura, ImagemComparavel, LimiaresDeteccao, SinalFraco } from './tipos'

type Mini = LeituraPreparada['l']['miniaturas'][number]

/** Miniatura que pode votar: http 200, dimensão e dHash lidos (hex minúsculo) e não o cinza do 404. */
function utilizavel(m: Mini, o: LimiaresDeteccao): m is Mini & { dhash: string; largura: number; altura: number } {
  if (m.dhash === null || m.http !== 200 || m.largura === null || m.altura === null) return false
  return hamming(m.dhash, IMAGEM_PADRAO_YT) > o.dhashMaxSame
}

/**
 * Chave -> representante (o primeiro visto, guloso, comparando só com representantes abertos; `mesmaImagem` não é transitiva).
 * Com o limiar padrão usa `thumbRepresentatives`; com outro, ou com `forcarLocal` (gancho de teste), o laço local.
 * Chaves de uma só classe, hex minúsculo de 16 caracteres.
 */
export function representantes(chaves: readonly string[], dhashMaxSame: number, forcarLocal = false): Map<string, string> {
  if (dhashMaxSame === DHASH_MAX_SAME && !forcarLocal) return thumbRepresentatives(chaves)
  const rep = new Map<string, string>()
  const abertos: string[] = []
  const img = (dhash: string): ImagemComparavel => ({ variante: 'x', largura: 1, altura: 1, dhash })
  for (const k of chaves) {
    if (rep.has(k)) continue
    const hit = abertos.find(r => mesmaImagem(img(r), img(k), dhashMaxSame) === 'mesma')
    rep.set(k, hit ?? k)
    if (hit === undefined) abertos.push(k)
  }
  return rep
}

interface Voto {
  classe: string
  variante: string
  dhash: string
  etag: string | null
}

/** Votos utilizáveis na ordem do desempate das leituras, com o grupo (representante) já resolvido por classe. */
function agrupar(ls: readonly LeituraPreparada[], o: LimiaresDeteccao) {
  const porLeitura: Voto[][] = ls.map(p =>
    p.l.miniaturas.filter(m => utilizavel(m, o)).map(m => ({ classe: classeDe(m) as string, variante: m.variante, dhash: m.dhash as string, etag: m.etag })),
  )
  const chavesPorClasse = new Map<string, string[]>()
  for (const vs of porLeitura) {
    for (const v of vs) {
      const g = chavesPorClasse.get(v.classe)
      if (!g) chavesPorClasse.set(v.classe, [v.dhash])
      else if (!g.includes(v.dhash)) g.push(v.dhash)
    }
  }
  const repPorClasse = new Map<string, Map<string, string>>()
  for (const [classe, chaves] of chavesPorClasse) repPorClasse.set(classe, representantes(chaves, o.dhashMaxSame))
  const grupoDe = (v: Voto): string => repPorClasse.get(v.classe)!.get(v.dhash)!
  return { porLeitura, grupoDe }
}

export function classificarMiniatura(ls: readonly LeituraPreparada[], o: LimiaresDeteccao): { estado: EstadoCampoMiniatura; validasMiniatura: number } {
  const validasMiniatura = ls.filter(p => p.leuMiniatura).length
  if (validasMiniatura === 0) return { estado: { estado: 'nao_lido' }, validasMiniatura }
  if (validasMiniatura < o.minLeituras) return { estado: { estado: 'insuficiente', motivo: 'poucas_leituras' }, validasMiniatura }

  const { porLeitura, grupoDe } = agrupar(ls, o)
  // classe -> grupo -> votos, deduplicado por (leitura, classe, grupo)
  const votos = new Map<string, Map<string, number>>()
  for (const vs of porLeitura) {
    const vistos = new Set<string>()
    for (const v of vs) {
      const g = grupoDe(v)
      const chave = JSON.stringify([v.classe, g])
      if (vistos.has(chave)) continue
      vistos.add(chave)
      const porGrupo = votos.get(v.classe) ?? new Map<string, number>()
      porGrupo.set(g, (porGrupo.get(g) ?? 0) + 1)
      votos.set(v.classe, porGrupo)
    }
  }
  for (const porGrupo of votos.values()) {
    if ([...porGrupo.values()].filter(n => n >= o.minVotosPorVariante).length >= 2) {
      return { estado: { estado: 'nada_visivel', motivo: 'miniatura_variou' }, validasMiniatura }
    }
  }
  return { estado: { estado: 'nada_visivel', motivo: 'um_valor_so' }, validasMiniatura }
}

/** F6: reenvio da mesma imagem (ETag novo, dHash no mesmo grupo). Nunca muda o estado. */
export function sinaisFracos(ls: readonly LeituraPreparada[], o: LimiaresDeteccao): SinalFraco[] {
  const { porLeitura, grupoDe } = agrupar(ls, o)
  const porVariante = new Map<string, Voto[]>()
  for (const vs of porLeitura) {
    for (const v of vs) {
      const g = porVariante.get(v.variante)
      if (g) g.push(v)
      else porVariante.set(v.variante, [v])
    }
  }
  const out: Array<SinalFraco & { ms: number }> = []
  for (const [variante, vs] of porVariante) {
    const gruposPorClasse = new Map<string, Set<string>>()
    for (const v of vs) {
      const s = gruposPorClasse.get(v.classe) ?? new Set<string>()
      s.add(grupoDe(v))
      gruposPorClasse.set(v.classe, s)
    }
    if ([...gruposPorClasse.values()].some(s => s.size > 1)) continue
    const instantes = [...new Set(vs.map(v => instanteDoEtag(v.etag)).filter((x): x is string => x !== null))].sort(
      (a, b) => Date.parse(a) - Date.parse(b),
    )
    for (const em of instantes.slice(1)) out.push({ tipo: 'reenvio_mesma_imagem', em, variante, ms: Date.parse(em) })
  }
  return out
    .sort((a, b) => a.ms - b.ms || compararCodePoint(a.variante, b.variante))
    .map(({ tipo, em, variante }) => ({ tipo, em, variante }))
}

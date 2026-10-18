import { montarRodadas, prepararLeituras } from './preparar'
import { resolverOpcoes, type LeituraWatch, type OpcoesDeteccao } from './tipos'

export interface RodadaTitulo {
  chave: string
  rodadaId: string
  de: string
  ate: string
  votos: Record<string, number>
  textos: Record<string, string>
  longa: boolean
  emQuarentena: boolean
  mista: boolean
  misturada: boolean
}

/** Rodadas de título da regra (mesma montagem interna de `detectarTesteYoutube`), sem mudar veredito. */
export function rodadasDeTitulo(leituras: readonly LeituraWatch[], opts?: OpcoesDeteccao): RodadaTitulo[] {
  const o = resolverOpcoes(opts)
  const prep = prepararLeituras(leituras)
  return montarRodadas(prep.leituras, o).map(r => {
    const votos: Record<string, number> = {}
    for (const [k, v] of r.votos) votos[k] = v
    const textos: Record<string, string> = {}
    for (const p of r.leituras) {
      if (p.voto !== null && p.votoCru !== null && !(p.voto in textos)) textos[p.voto] = p.votoCru
    }
    return {
      chave: r.chave,
      rodadaId: r.leituras[0]!.l.rodadaId,
      de: new Date(r.deMs).toISOString(),
      ate: new Date(r.ateMs).toISOString(),
      votos,
      textos,
      longa: r.longa,
      emQuarentena: r.emQuarentena,
      mista: r.mista,
      misturada: !r.longa && r.votos.size >= 2,
    }
  })
}

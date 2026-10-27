/**
 * Fonte única do "o que está no ar" num teste concluído (M7b T2). Função pura: lê o `restore_status` atual e o histórico de
 * tentativas (`ab_test_restores`); nunca lê o YouTube. Painel, tela-v2, Concluídos, cabeçalho e MCP usam esta função.
 */
import type { DisplayLabel } from './ab-types'
import { camposDoTeste, paraRestoreStatus, type CampoNome, type EstadoCampo } from './ab-restore'

/** Mesma folga da E18 em `coleta/versoes-origem.ts` (FOLGA_REGISTRO_MS); repetida aqui para o módulo continuar folha. */
export const FOLGA_NO_AR_MS = 120_000

export interface TentativaNoAr { seq: number; campo: CampoNome; destino: string; estado: EstadoCampo; escreveu: boolean | null; em: string }

export type NoArConfirmado = { tipo: 'confirmado'; varianteId: string; letra: DisplayLabel; desde: string | null }
export type NoArLido =
  | NoArConfirmado
  | { tipo: 'misto'; porCampo: Partial<Record<CampoNome, DisplayLabel>> }
  | { tipo: 'desconhecido'; ultima: { letra: DisplayLabel; desde: string | null } | null }

export interface EntradaNoAr {
  test_type: 'thumbnail' | 'title' | 'combo'
  restore_status?: unknown
  restore_seq: number
  completed_at: string | null
  winner_variant_id: string | null
  winner_applied_at: string | null
  variantes: ReadonlyArray<{ id: string; label: DisplayLabel; is_original: boolean }>
}

type Campo =
  | { k: 'ok'; varianteId: string; letra: DisplayLabel; em: string | null }
  | { k: 'desc'; ultima: { letra: DisplayLabel; desde: string | null } | null }

const DESCONHECIDO: NoArLido = { tipo: 'desconhecido', ultima: null }

export function noArConfirmado(t: EntradaNoAr, historico: ReadonlyArray<TentativaNoAr>): NoArLido {
  const rs = paraRestoreStatus(t.restore_status)
  const campos = camposDoTeste(t.test_type)
  // O histórico não grava em_andamento: um campo em voo agora não tem versão lida.
  if (rs && campos.some(c => rs[c]?.estado === 'em_andamento')) return DESCONHECIDO
  const fim = t.completed_at ? Date.parse(t.completed_at) : NaN
  if (!Number.isFinite(fim)) return DESCONHECIDO
  const corte = fim - FOLGA_NO_AR_MS

  const destinoParaId = (d: string): string | null => {
    if (d === 'original') {
      const orig = t.variantes.filter(v => v.is_original)
      return orig.length === 1 ? orig[0]!.id : null
    }
    return t.variantes.some(v => v.id === d) ? d : null
  }
  const letraDe = (id: string): DisplayLabel | null => t.variantes.find(v => v.id === id)?.label ?? null

  const porCampo = new Map<CampoNome, Campo>()

  for (const campo of campos) {
    const linhas: TentativaNoAr[] = []
    const atual = rs?.[campo]
    const linhaAtual: TentativaNoAr | null = atual ? { seq: t.restore_seq, campo, destino: atual.destino, estado: atual.estado, escreveu: atual.escreveu, em: atual.em } : null
    if (linhaAtual) linhas.push(linhaAtual)
    for (const h of historico) if (h.campo === campo) linhas.push(h)
    linhas.sort((a, b) => b.seq - a.seq)
    const vistos = new Set<string>()
    const unicas = linhas.filter(l => {
      const chave = `${l.campo}|${l.em}|${l.destino}|${l.estado}`
      if (vistos.has(chave)) return false
      vistos.add(chave)
      return true
    })
    // A linha atual (o último restore_status gravado) sempre vale; a janela corta só o histórico anterior ao fim do teste.
    const validas = unicas.filter(l => l === linhaAtual || Date.parse(l.em) >= corte)

    const ultimaAntes = (resto: TentativaNoAr[]): { letra: DisplayLabel; desde: string | null } | null => {
      for (const l of resto) {
        if (l.estado !== 'ok') continue
        const id = destinoParaId(l.destino)
        const letra = id ? letraDe(id) : null
        if (letra) return { letra, desde: l.em }
      }
      return null
    }

    let resultado: Campo | null = null
    for (let i = 0; i < validas.length && !resultado; i++) {
      const l = validas[i]!
      if (l.estado === 'ok') {
        const id = destinoParaId(l.destino)
        const letra = id ? letraDe(id) : null
        resultado = id && letra ? { k: 'ok', varianteId: id, letra, em: l.em } : { k: 'desc', ultima: null }
      } else if (l.estado === 'pulado_sem_original' || ((l.estado === 'falhou' || l.estado === 'desistiu') && l.escreveu === false)) {
        continue
      } else if (l.estado === 'pulado_drift' || l.estado === 'pulado_teste_youtube') {
        resultado = { k: 'desc', ultima: ultimaAntes(validas.slice(i + 1)) }
      } else {
        // falhou/desistiu com escreveu !== false (null ou true), ou qualquer estado fora da lista: não se sabe o que ficou.
        resultado = { k: 'desc', ultima: ultimaAntes(unicas.slice(unicas.indexOf(l) + 1)) }
      }
    }
    if (!resultado) {
      // Janela esgotada sem fecho ok: o legado (teste concluído pelo caminho v1) ou nada.
      const w = t.winner_variant_id
      const letra = w && t.winner_applied_at ? letraDe(w) : null
      resultado = w && letra ? { k: 'ok', varianteId: w, letra, em: t.winner_applied_at } : { k: 'desc', ultima: null }
    }
    porCampo.set(campo, resultado)
  }

  const todos = campos.map(c => porCampo.get(c)!)
  if (todos.some(c => c.k === 'desc')) {
    const propria = todos.find((c): c is Extract<Campo, { k: 'desc' }> => c.k === 'desc' && c.ultima !== null)?.ultima
    const outra = todos.find((c): c is Extract<Campo, { k: 'ok' }> => c.k === 'ok')
    return { tipo: 'desconhecido', ultima: propria ?? (outra ? { letra: outra.letra, desde: outra.em } : null) }
  }
  const oks = todos as Array<Extract<Campo, { k: 'ok' }>>
  const primeiro = oks[0]!
  if (oks.every(c => c.varianteId === primeiro.varianteId)) {
    const desde = oks.reduce<string | null>((m, c) => (c.em && (m === null || Date.parse(c.em) > Date.parse(m)) ? c.em : m), null)
    return { tipo: 'confirmado', varianteId: primeiro.varianteId, letra: primeiro.letra, desde }
  }
  const mapa: Partial<Record<CampoNome, DisplayLabel>> = {}
  campos.forEach((c, i) => { mapa[c] = oks[i]!.letra })
  return { tipo: 'misto', porCampo: mapa }
}

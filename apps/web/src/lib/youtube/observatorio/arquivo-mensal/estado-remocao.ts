/**
 * Manutenção M3b, P38 (item 163, parte de idades): o estado e a cor da remoção de canal. Puro: lê a linha e o relógio,
 * nunca o banco, e não muda estado. Dado ausente (`decided_at` nulo, linha da vigia antes do clique) = sem idade, sem cor.
 */
export const IDADE = {
  pedidoAmbar: 30, pedidoVermelho: 60, nasAmbar: 30, nasVermelho: 60,
  b2DepoisSnapshotsAmbar: 15, b2SemSnapshotsAmbar: 30, blobAmbar: 14, blobVermelho: 30,
} as const
export type EstadoRemocao = 'sem_destino' | 'sem_arquivo' | 'guardado' | 'pedido' | 'apagado_nas' | 'apagado_b2' | 'concluido'
export type Cor = 'nenhuma' | 'ambar' | 'vermelho' | 'cinza'
export interface LinhaRemocao {
  estado: EstadoRemocao
  decided_at: string | null
  reappeared_at: string | null
  nas_absent_at: string | null
  b2_absent_at: string | null
  snapshots_clear_on: string | null
  blobs_pendentes: number
}

const DIA_MS = 86_400_000

function instante(v: string | null): number | null {
  if (v === null) return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : t
}
const idadeEm = (ref: number | null, agora: Date): number | null => (ref === null ? null : Math.floor((agora.getTime() - ref) / DIA_MS))

function corPorLimiar(idade: number, ambar: number, vermelho: number | null): Cor {
  if (vermelho !== null && idade >= vermelho) return 'vermelho'
  return idade >= ambar ? 'ambar' : 'nenhuma'
}

export function corDaRemocao(
  l: LinhaRemocao,
  o: { agora: Date; casaResponde: boolean; limpezaEmProducao: boolean },
): { cor: Cor; idadeDias: number | null; blob: Cor } {
  let idadeDias: number | null = null
  let cor: Cor = 'nenhuma'
  switch (l.estado) {
    case 'pedido': {
      const d = instante(l.decided_at)
      const r = instante(l.reappeared_at)
      const ref = d === null ? r : r === null ? d : Math.max(d, r)
      idadeDias = idadeEm(ref, o.agora)
      if (idadeDias !== null) cor = corPorLimiar(idadeDias, IDADE.pedidoAmbar, IDADE.pedidoVermelho)
      break
    }
    case 'apagado_nas': {
      idadeDias = idadeEm(instante(l.nas_absent_at), o.agora)
      if (idadeDias !== null) cor = corPorLimiar(idadeDias, IDADE.nasAmbar, IDADE.nasVermelho)
      break
    }
    case 'apagado_b2': {
      const comSnapshots = instante(l.snapshots_clear_on)
      if (comSnapshots !== null) {
        idadeDias = idadeEm(comSnapshots, o.agora)
        if (idadeDias !== null) cor = corPorLimiar(idadeDias, IDADE.b2DepoisSnapshotsAmbar, null)
      } else {
        idadeDias = idadeEm(instante(l.b2_absent_at), o.agora)
        if (idadeDias !== null) cor = corPorLimiar(idadeDias, IDADE.b2SemSnapshotsAmbar, null)
      }
      break
    }
    default:
      break // sem_destino, guardado, sem_arquivo, concluido: sem cor por idade
  }
  // Casa sem responder: a idade não prova atraso do dono (o âmbar "espera a casa" é da tela da M5).
  if (!o.casaResponde) cor = 'nenhuma'

  let blob: Cor = 'nenhuma'
  if (l.blobs_pendentes > 0) {
    if (!o.limpezaEmProducao) blob = 'cinza'
    else {
      const idadeBlob = idadeEm(instante(l.decided_at), o.agora)
      if (idadeBlob !== null) blob = corPorLimiar(idadeBlob, IDADE.blobAmbar, IDADE.blobVermelho)
    }
  }
  return { cor, idadeDias, blob }
}

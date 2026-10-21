'use client'
import { useRef, useState } from 'react'
import { useToast } from '../_chrome/toasts'
import { TXT, desfeitoCorpo, type CodigoTela } from './remover-model'

export type RespostaDesfazer = { ok: true; naoPedido: boolean; despausado: boolean } | { ok: false; codigo: CodigoTela; frase: string }

/**
 * "Desfazer" a remoção pedida (F2 do Remover canal), igual na lista e na página do canal. Em voo por canal: a linha e o toast usam a mesma função,
 * então um 2º clique (do outro botão) não chama de novo (I-9). `canal_nao_encontrado` e `naoPedido` são respostas normais (toast neutro + refresh);
 * só o erro de verdade fica vermelho, e sem refresh.
 */
export function useDesfazer(onDesfazer: (id: string) => Promise<RespostaDesfazer>, refresh: () => void) {
  const toast = useToast()
  const emVoo = useRef(new Set<string>())
  const [ocupados, setOcupados] = useState<ReadonlySet<string>>(new Set())
  const desfazer = async (id: string, nome: string) => {
    if (emVoo.current.has(id)) return
    emVoo.current.add(id); setOcupados(new Set(emVoo.current))
    try {
      let res: RespostaDesfazer
      try { res = await onDesfazer(id) } catch {
        toast('bad', TXT.incertoTitulo, 'Pode ter sido desfeito. Confira a lista antes de tentar de novo.')
        return
      }
      if (res.ok) {
        if (res.naoPedido) toast('', TXT.jaNaoAgendado(nome), '')
        else toast('ok', TXT.desfeitoTitulo, desfeitoCorpo(nome, res.despausado))
        refresh()
      } else if (res.codigo === 'canal_nao_encontrado') {
        toast('', res.frase, '')
        refresh()
      } else toast('bad', 'Não deu para desfazer', res.frase)
    } finally {
      emVoo.current.delete(id); setOcupados(new Set(emVoo.current))
    }
  }
  return { desfazer, ocupados }
}

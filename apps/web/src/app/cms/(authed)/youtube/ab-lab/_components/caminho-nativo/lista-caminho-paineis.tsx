'use client'
// Liga a lista aos painéis. `painel` e `responder` são funções, e função não atravessa a fronteira servidor -> cliente:
// por isso esta casca cliente os fornece à `ListaCaminho` que o servidor monta.
// SLOTS (preencher aqui): `painel` vista 'ficha' = ficha (T8/T9a); vista 's7' = cartão S7 (T10); `responder` = "Responder" do dia 14 (T10b).
import type { ReactElement } from 'react'
import { FaixaCaminho } from './faixa-caminho'
import { ListaCaminho, type ListaCaminhoProps, type SlotPainel } from './lista-caminho'

/** Provisório até a T8/T10: nada é inventado, só diz o que ainda não chegou e deixa fechar. */
const painelProvisorio: SlotPainel = (l, c) => (
  <div>
    <h2 tabIndex={-1} className="cn-titulo">{l.titulo}</h2>
    <FaixaCaminho tom="neutra" titulo={c.vista === 's7' ? 'O cartão deste teste chega na próxima atualização.' : 'A ficha deste vídeo chega na próxima atualização.'} />
    <button type="button" className="cn-btn" onClick={c.fechar}>Fechar</button>
  </div>
)

export function ListaCaminhoComPaineis(props: Omit<ListaCaminhoProps, 'painel' | 'responder'>): ReactElement {
  return <ListaCaminho {...props} painel={painelProvisorio} />
}

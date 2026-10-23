'use client'
// Bloco do conflito do dia 14 (F1a-tela-2, T7): o título que o Lab leu no ar e o que o dono disse, lado a lado, sem destaque
// (o Lab não escolhe entre os dois). Mockup M2 `index.html:547-551`. D-5: a letra do "No ar" vem do título lido; sem par, slot `unk`.
import { useId, type ReactElement } from 'react'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { letraDoNoAr, versaoDoRespondido, type PerguntaDoDia14 } from './dia-14-estado'
import { ChipSemVersao, ChipVersao } from './chip-versao'
import { SeloCaminho } from './selo-caminho'
import { Dia14Mudar } from './dia-14-mudar'
import type { Dia14BlocoProps } from './dia-14-respondido'
import '../caminho-nativo.css'
import '../dia-14-pergunta.css'

type Registro = NonNullable<LinhaDoCaminho['registro']>

/** A letra que o dono disse (a original é A); sem par entre as versões, o que a resposta é em palavras. */
export function letraQueDisse(reg: Registro, pergunta: PerguntaDoDia14): string {
  return versaoDoRespondido(reg, pergunta)?.letra ?? (reg.respostaDono === 'venceu_original' ? 'A' : 'outra versão')
}

export function Dia14Conflito({ linha, pergunta, acoes }: Dia14BlocoProps): ReactElement | null {
  const id = useId()
  const reg = linha.registro
  if (!reg) return null
  const noAr = letraDoNoAr(reg, pergunta)
  const disse = versaoDoRespondido(reg, pergunta)
  const letraDisse = letraQueDisse(reg, pergunta)
  // Data da resposta ATUAL: a troca, se houve; senão a 1ª resposta.
  const quando = new Date(reg.respostaMudadaEm ?? reg.respondidoEm ?? reg.updatedAt)
  const titulo = noAr ? FRASES.conflito.titulo(noAr.letra, letraDisse) : FRASES.conflito.tituloSemPar(letraDisse)
  const tituloNoAr = noAr?.titulo ?? reg.vencedorTitulo

  return (
    <Dia14Mudar linha={linha} pergunta={pergunta} acoes={acoes}>
      {(link) => (
        <section className="cn-d14 cn-d14-conflito" aria-labelledby={id}>
          <div className="cn-d14-res"><SeloCaminho tipo="mute-neq">{FRASES.conflito.selo}</SeloCaminho></div>
          <h3 id={id} tabIndex={-1} data-foco-bloco="" className="cn-d14-conflito-h">{titulo}</h3>
          <p className="cn-meta">{FRASES.conflito.meta}</p>
          <div className="cn-d14-cf">
            <div>
              <p className="cn-d14-who">{FRASES.conflito.cartaoNoAr(reg.desfechoEm ? new Date(reg.desfechoEm) : null)}</p>
              <div className="cn-d14-top">
                {noAr ? <ChipVersao letra={noAr.letra} /> : <ChipSemVersao rotulo={FRASES.conflito.seloSemPar} />}
                {tituloNoAr ? <q title={tituloNoAr}>{tituloNoAr}</q> : null}
              </div>
            </div>
            <div>
              <p className="cn-d14-who">{FRASES.conflito.cartaoVoce(letraDisse, quando)}</p>
              <div className="cn-d14-top">
                {disse ? <ChipVersao letra={disse.letra} /> : <ChipSemVersao rotulo={FRASES.conflito.seloSemPar} />}
                {disse?.titulo ? <q title={disse.titulo}>{disse.titulo}</q> : null}
              </div>
            </div>
          </div>
          <div className="cn-d14-acts">{link}</div>
        </section>
      )}
    </Dia14Mudar>
  )
}

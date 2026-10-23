'use client'
// Bloco "respondido" do dia 14 (F1a-tela-2, T7): o que o dono respondeu, com a versão no ar ou sem vencedor, e o link para mudar.
// Mockup M2 `index.html:541-546` (`ans`). Regra do sujeito (D-7): aparece UMA vez por bloco.
import { useId, type ReactElement, type ReactNode } from 'react'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import { foiTardia, prazoDoTeste, type LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { letraDoNoAr, mesmoDiaSP, resumoDoRespondido, respostaComVersao, type PerguntaDoDia14 } from './dia-14-estado'
import { ChipVersao } from './chip-versao'
import { SeloCaminho } from './selo-caminho'
import { Dia14Mudar } from './dia-14-mudar'
import type { AcoesDia14 } from './dia-14-pergunta'
import '../caminho-nativo.css'
import '../dia-14-pergunta.css'

type Registro = NonNullable<LinhaDoCaminho['registro']>
type SemVencedor = 'ficou_igual' | 'inconclusivo' | 'nao_vi'

export interface Dia14BlocoProps {
  linha: LinhaDoCaminho
  pergunta: PerguntaDoDia14
  acoes: AcoesDia14
}

const quandoRespondeu = (r: Registro): Date => new Date(r.respondidoEm ?? r.updatedAt)
/** Sem "depois do prazo" quando só a troca é tardia: só a 1ª resposta decide (D-6). */
const tardia = (r: Registro): boolean => r.respondidoEm !== null && foiTardia(r.inicio, r.respondidoEm)

/** Apoio de quem respondeu sem apontar versão: com veredito do Lab (`regra`/`data_api`) diz o que estava no ar; sem ele, a frase fixa. */
export function ApoioSemVencedor({ reg, pergunta }: { reg: Registro; pergunta: PerguntaDoDia14 }): ReactElement {
  if ((reg.vencedorFonte === 'regra' || reg.vencedorFonte === 'data_api') && reg.vencedorTitulo) {
    const noAr = letraDoNoAr(reg, pergunta)
    const lidoEm = reg.desfechoEm ? new Date(reg.desfechoEm) : null
    if (noAr) {
      // O texto vem de FRASES com um marcador no lugar da letra; o chip entra ali.
      const [antes, depois] = FRASES.respondido.apoioComVeredito('\u0000', lidoEm).split('\u0000')
      return <>{antes}<ChipVersao letra={noAr.letra} />{depois}</>
    }
    return <>{FRASES.respondido.apoioComVeredito(reg.vencedorTitulo, lidoEm)}</>
  }
  return <>{FRASES.resposta.apoioSemVencedor}</>
}

export function Dia14Respondido({ linha, pergunta, agora, acoes }: Dia14BlocoProps & { agora: Date }): ReactElement | null {
  const id = useId()
  const reg = linha.registro
  if (!reg || !reg.respostaDono || reg.respostaDono === ('sem_resposta' as string)) return null
  const quando = quandoRespondeu(reg)
  const hoje = mesmoDiaSP(quando, agora)
  const prazo = prazoDoTeste(reg.inicio)
  const mudada = reg.respostaMudadaEm ? (
    <p className="cn-meta">{FRASES.respondido.mudadaEm(new Date(reg.respostaMudadaEm))}</p>
  ) : null

  return (
    <Dia14Mudar linha={linha} pergunta={pergunta} acoes={acoes}>
      {(link): ReactNode => {
        if (respostaComVersao(reg.respostaDono)) {
          const r = resumoDoRespondido(reg, pergunta)
          const meta = tardia(reg) ? FRASES.respondido.metaTardia(quando, prazo) : FRASES.respondido.meta(quando, hoje)
          const alvoQ3 = r.frase !== null
          return (
            <section className="cn-d14" aria-labelledby={id}>
              <div className="cn-d14-res"><SeloCaminho tipo="ok">{r.selo}</SeloCaminho></div>
              {r.frase ? <p className="cn-d14-q3" id={id} tabIndex={-1} data-foco-bloco="">{r.frase}</p> : null}
              <p className="cn-meta" {...(alvoQ3 ? {} : { id, tabIndex: -1, 'data-foco-bloco': '' })}>{meta}</p>
              {mudada}
              <div className="cn-d14-acts">{link}</div>
            </section>
          )
        }
        const sem = reg.respostaDono as SemVencedor
        const meta = tardia(reg) ? FRASES.respondido.metaSemVencedorTardia(quando, prazo) : FRASES.respondido.metaSemVencedor(quando, hoje)
        return (
          <section className="cn-d14" aria-labelledby={id}>
            <div className="cn-d14-res"><SeloCaminho tipo="mute-neq">{FRASES.dia14.seloSemVencedor[sem]}</SeloCaminho></div>
            <p className="cn-d14-q3" id={id} tabIndex={-1} data-foco-bloco="">{sem === 'ficou_igual' ? FRASES.resposta.ficouIgual : sem === 'inconclusivo' ? FRASES.resposta.inconclusivo : FRASES.resposta.naoVi}</p>
            <p className="cn-meta">{meta}</p>
            <p className="cn-meta"><ApoioSemVencedor reg={reg} pergunta={pergunta} /></p>
            {mudada}
            <div className="cn-d14-acts">{link}</div>
          </section>
        )
      }}
    </Dia14Mudar>
  )
}

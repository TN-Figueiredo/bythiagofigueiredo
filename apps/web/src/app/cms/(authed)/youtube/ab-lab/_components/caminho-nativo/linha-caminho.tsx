'use client'
// Uma linha da lista "Vídeos do A/B Lab" (F1a-tela-1, T7). Mockup M2 `index.html:344-410` (R.l1..R.l10).
// Slots: `responder` (T10b: botão "Responder"/pergunta do dia 14 de ficha com 2 versões); o painel (ficha T8, cartão S7 T10) é da lista.
import type { ReactElement, ReactNode } from 'react'
import CmsLink from '@/app/cms/(authed)/_shared/cms-link'
import { FRASES, dataCurta } from '@/lib/youtube/teste-youtube/nativo/frases'
import { pisoPorDia } from '@/lib/youtube/teste-youtube/nativo/volume'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { rotuloRetomar, prazoDoTeste } from '@/lib/youtube/teste-youtube/nativo/lista'
import { SeloCaminho, type TipoSelo } from './selo-caminho'
import { Icone } from './icones'
import { FichaConfirmar } from './ficha-confirmar'
import { Dia14Pergunta, type AcoesDia14 } from './dia-14-pergunta'
import { Dia14Respondido, ApoioSemVencedor } from './dia-14-respondido'
import { Dia14Conflito, letraQueDisse } from './dia-14-conflito'
import { versoesDoDia14, letraDoNoAr, resumoDoRespondido } from './dia-14-estado'
import type { AcoesCaminho } from './lista-caminho'
import '../caminho-nativo.css'
import '../lista-caminho.css'

const DIA_MS = 86_400_000

/** `primario`: só UMA linha da lista (a primeira de "Precisa de você" com botão) pode ter o laranja; o slot respeita. */
export interface ControleResponder { primario: boolean; aberta: boolean; abrir: () => void; fechar: () => void }
export type SlotResponder = (l: LinhaDoCaminho, c: ControleResponder) => ReactNode

export interface LinhaCaminhoProps {
  l: LinhaDoCaminho
  agora: Date
  /** O dono trocou o caminho sugerido pelo nosso teste (só na tela, D-2). */
  escolhaNosso: boolean
  aoPreferir: (l: LinhaDoCaminho, nosso: boolean) => void
  aoAbrirPainel: (l: LinhaDoCaminho, vista: 'ficha' | 's7') => void
  aoIniciar: (l: LinhaDoCaminho) => void
  perguntaAberta: boolean
  aoRegistrar: () => void
  aoSeguirComNosso: (l: LinhaDoCaminho) => void
  aoFecharPergunta: () => void
  aoAtualizar: () => void
  jaIniciei: AcoesCaminho['jaIniciei']
  responder?: SlotResponder
  /** T10b: a action do dia 14 por props tipadas; sem ela (e sem `responder`) a linha não mostra o botão. */
  responderDia14?: AcoesCaminho['responderTesteDoYouTube']
  responderAberta: boolean
  responderPrimario: boolean
  aoMudarResponder: (aberta: boolean) => void
  /** F1a-tela-2 T7: "Mudar minha resposta" (action por props, como `responderDia14`). */
  mudarDia14?: AcoesCaminho['mudarRespostaDoTesteDoYouTube']
  /** T7: o bloco respondido/conflito abre na própria linha; sem `aoMudarBloco` o botão "Ver teste" não faz nada. */
  blocoAberto?: boolean
  aoMudarBloco?: (aberto: boolean) => void
  /** T7: relê depois de uma resposta; a lista guarda o foco para o link da linha respondida. */
  aoRespondeu?: () => void
  /** T7: região viva fora do bloco ("Resposta mudada para C."). */
  aoAnunciar?: (texto: string) => void
}

const Nm = (): ReactElement => <span className="cn-nm">não medido</span>
const SEL = (tipo: TipoSelo, texto: string): ReactElement => (
  <span tabIndex={-1} data-foco-selo=""><SeloCaminho tipo={tipo}>{texto}</SeloCaminho></span>
)

/** Frase da linha de Lab pausado (mockup `pausaLinha`). */
function PausaLinha({ ate, agora, confirmado }: { ate: string | null; agora: Date; confirmado: boolean }): ReactElement {
  const t = ate ? Date.parse(ate) : NaN
  const passou = Number.isFinite(t) && t <= agora.getTime()
  return (
    <p className="fr2">
      <Icone nome="pause" />
      <span>
        {Number.isFinite(t) && !passou
          ? (confirmado ? FRASES.s7.labPausadoConfirmado(rotuloRetomar(new Date(t))) : FRASES.s7.labPausado(rotuloRetomar(new Date(t))))
          : <>{confirmado ? FRASES.s7.labPausadoConfirmadoSemData : FRASES.s7.labPausadoSemData} {FRASES.s7.retomarEspera}</>}
      </span>
    </p>
  )
}

const BTN = 'cn-btn'

export function LinhaCaminho(p: LinhaCaminhoProps): ReactElement {
  const { l, agora } = p
  const idade = Math.max(0, Math.floor((agora.getTime() - Date.parse(l.publicadoEm)) / DIA_MS))
  const reg = l.registro
  const duasVersoes = reg?.variantes?.length === 2
  const iniciarDesabilitado = p.perguntaAberta

  const botaoIniciar = (rotulo = 'Iniciar teste'): ReactElement => (
    <button type="button" className={BTN} data-acao="iniciar" disabled={iniciarDesabilitado} onClick={() => p.aoIniciar(l)}>{rotulo}</button>
  )
  const botaoAbrir = (rotulo: string, vista: 'ficha' | 's7'): ReactElement => (
    <button type="button" className={BTN} data-acao="abrir" onClick={() => p.aoAbrirPainel(l, vista)}>{rotulo}</button>
  )

  // T7: as ações do bloco respondido/conflito; sem a action de resposta a linha não abre bloco.
  const acoesBloco: AcoesDia14 | null = p.responderDia14
    ? {
      responder: p.responderDia14, atualizar: p.aoRespondeu ?? p.aoAtualizar,
      ...(p.mudarDia14 ? { mudar: p.mudarDia14 } : {}), ...(p.aoAnunciar ? { anunciar: p.aoAnunciar } : {}),
    }
    : null
  const blocoVisivel = Boolean(p.blocoAberto && acoesBloco && reg)
  const botaoVer = (rotulo: string): ReactElement => (
    <button type="button" className={BTN} data-acao="ver-bloco" aria-expanded={blocoVisivel} onClick={() => p.aoMudarBloco?.(!blocoVisivel)}>{rotulo}</button>
  )

  let selo: ReactElement | null = null
  let meta: string | null = null
  let fr: ReactNode = null
  let apoio: ReactNode = null
  let fr2: ReactElement | null = null
  let ra: ReactNode = null
  let full: ReactNode = null
  let quente = false

  const respostaDaLinha = (): ReactNode => {
    if (!reg) return null
    if (p.responder) return p.responder(l, { primario: p.responderPrimario, aberta: p.responderAberta, abrir: () => p.aoMudarResponder(true), fechar: () => p.aoMudarResponder(false) })
    const acao = p.responderDia14
    if (!acao) return null
    if (p.responderAberta) {
      full = <Dia14Pergunta linha={l} pergunta={versoesDoDia14(reg)} modo="responder" acoes={{ responder: acao, atualizar: p.aoRespondeu ?? p.aoAtualizar }} aoFechar={() => p.aoMudarResponder(false)} />
    }
    return (
      <button
        type="button" className={`${BTN}${p.responderPrimario && !p.responderAberta ? ' pri' : ''}`} data-acao="responder"
        aria-expanded={p.responderAberta} onClick={() => p.aoMudarResponder(!p.responderAberta)}
      >{FRASES.dia14.responder}</button>
    )
  }

  switch (l.estado) {
    case 'sugerido_youtube':
      if (p.escolhaNosso) {
        meta = 'Caminho escolhido por você: nosso teste'
        fr = 'O nosso teste alterna título e miniatura por tempo e dá um indício, não o número do Studio.'
        ra = (<>{botaoIniciar()}<button type="button" className="cn-lnk" onClick={() => p.aoPreferir(l, false)}>Prefiro o teste do YouTube</button></>)
      } else {
        meta = 'Caminho sugerido: teste do YouTube'
        fr = <>{l.caminho.motivo} Impressões por dia: {l.impressoesPorDia !== null ? l.impressoesPorDia : <Nm />}</>
        ra = (<>{botaoAbrir('Testar no YouTube', 'ficha')}<button type="button" className="cn-lnk" onClick={() => p.aoPreferir(l, true)}>Prefiro outro caminho</button></>)
      }
      break
    case 'sugerido_nosso':
      meta = 'Caminho sugerido: nosso teste'
      fr = l.caminho.motivo
      ra = botaoIniciar()
      break
    case 'formato_nao_confirmado':
      selo = SEL('unk', 'Formato não confirmado')
      fr = `${l.caminho.motivo} Escolha o caminho:`
      full = (
        <div className="cn-two">
          <div className="opt2">{botaoAbrir('Testar no YouTube', 'ficha')}<p>Se for vídeo longo. Se for Short, o Studio não oferece o teste.</p></div>
          <div className="opt2">{botaoIniciar()}<p>Vale para qualquer formato. Dá um indício por tempo alternado.</p></div>
        </div>
      )
      break
    case 'sem_volume':
      selo = SEL('dim', 'Sem volume para teste')
      fr = l.impressoesPorDia !== null
        ? `Publicado há ${idade} dias, ${l.impressoesPorDia} impressões por dia; o piso é ${pisoPorDia(2)}.`
        : l.caminho.motivo
      ra = botaoIniciar('Trocar direto')
      break
    case 'em_preparo':
      selo = SEL('pen', 'Teste do YouTube em preparo')
      fr = 'Ficha salva. Falta ligar o teste no Studio.'
      ra = botaoAbrir('Continuar', 'ficha')
      break
    case 'em_teste_studio': {
      selo = SEL('yt', reg?.confirmadoEm ? FRASES.s7.selo2 : FRASES.s7.selo)
      const dia = reg?.diaDe14 ?? 0
      fr = reg?.confirmadoEm
        ? `Você confirmou em ${dataCurta(new Date(reg.confirmadoEm))}. Dia ${dia} de 14.`
        : `Parece haver um teste no Studio: o título alterna desde ${dataCurta(new Date(reg?.primeiraVista ?? reg?.updatedAt ?? agora))}. Dia ${dia} de 14.`
      if (l.nosso?.status === 'paused') fr2 = <PausaLinha ate={l.labPausadoAte} agora={agora} confirmado={Boolean(reg?.confirmadoEm)} />
      ra = botaoAbrir('Ver teste', 's7')
      break
    }
    case 'nosso_rodando':
      meta = `Nosso teste em andamento: dia ${l.nosso?.dia ?? 0} de 14`
      fr = 'O nosso teste alterna título e miniatura por tempo e dá um indício, não o número do Studio.'
      ra = l.nosso ? <CmsLink href={`/cms/youtube/ab-lab/${l.nosso.testId}`} className={`${BTN}`}>Ver teste</CmsLink> : null
      break
    case 'resultado_pronto': {
      selo = SEL('yts', 'Resultado do YouTube pronto')
      quente = true
      const fim = reg ? prazoDoTeste(reg.inicio) : agora
      fr = `Os 14 dias acabaram em ${dataCurta(fim)}.`
      ra = respostaDaLinha()
      break
    }
    case 'sem_resposta': {
      selo = SEL('mute-late', 'Sem resposta')
      quente = true
      fr = reg && !(p.responderAberta && !p.responder) ? FRASES.resposta.tardia(prazoDoTeste(reg.inicio)) : null
      ra = respostaDaLinha()
      break
    }
    case 'ficou_no_ar': {
      const r = reg ? resumoDoRespondido(reg, versoesDoDia14(reg)) : null
      if (r?.frase) {
        selo = SEL('ok', r.selo); fr = r.frase; apoio = <p className="cn-meta">{FRASES.dia14.oficial}</p>
      } else {
        selo = SEL('ok', 'Ficou no ar')
        fr = `Você respondeu em ${dataCurta(new Date(reg?.respondidoEm ?? reg?.updatedAt ?? agora))}.`
      }
      if (blocoVisivel && reg && acoesBloco) {
        selo = null; fr = null; apoio = null
        full = <Dia14Respondido linha={l} pergunta={versoesDoDia14(reg)} agora={agora} acoes={acoesBloco} />
      }
      ra = botaoVer(FRASES.conflito.verTeste)
      break
    }
    case 'respostas_diferentes': {
      selo = SEL('mute-neq', FRASES.conflito.selo)
      // Sem registro ou sem par de letra, a linha não afirma qual título está no ar.
      const p14 = reg ? versoesDoDia14(reg) : null
      const noAr = reg && p14 ? letraDoNoAr(reg, p14) : null
      const disse = reg && p14 ? letraQueDisse(reg, p14) : 'outra versão'
      fr = noAr ? FRASES.conflito.linha(noAr.letra, disse) : FRASES.conflito.linhaSemPar(disse)
      if (blocoVisivel && reg && acoesBloco && p14) full = <Dia14Conflito linha={l} pergunta={p14} acoes={acoesBloco} />
      ra = botaoVer(FRASES.conflito.verAsDuas)
      break
    }
    case 'respondido_sem_vencedor': {
      const r = reg?.respostaDono
      selo = SEL('mute-neq', r === 'ficou_igual' || r === 'inconclusivo' || r === 'nao_vi' ? FRASES.dia14.seloSemVencedor[r] : 'Sem vencedor registrado')
      fr = r === 'ficou_igual' ? FRASES.resposta.ficouIgual : r === 'inconclusivo' ? FRASES.resposta.inconclusivo : FRASES.resposta.naoVi
      apoio = <p className="cn-meta">{reg ? <ApoioSemVencedor reg={reg} pergunta={versoesDoDia14(reg)} /> : FRASES.resposta.apoioSemVencedor}</p>
      if (blocoVisivel && reg && acoesBloco) {
        selo = null; fr = null; apoio = null
        full = <Dia14Respondido linha={l} pergunta={versoesDoDia14(reg)} agora={agora} acoes={acoesBloco} />
      }
      ra = botaoVer(FRASES.conflito.verTeste)
      break
    }
    default: {
      const _x: never = l.estado
      return _x
    }
  }

  return (
    <li className={`cn-vrow${quente ? ' hot' : ''}`} data-linha={l.videoId} data-yt={l.ytId} data-estado={l.estado}>
      {l.miniaturaUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className="cn-th" src={l.miniaturaUrl} alt="" referrerPolicy="no-referrer" />
        : <span className="cn-th" aria-hidden="true" />}
      <div>
        <h4 title={l.titulo}>{l.titulo}</h4>
        <div className="st">{selo}{meta ? <span className="cn-meta">{meta}</span> : null}</div>
        {fr ? <p className="fr">{fr}</p> : null}
        {apoio}
        {fr2}
        {p.perguntaAberta && l.fichaId ? (
          <FichaConfirmar
            variante="linha"
            fichaId={l.fichaId}
            enviadaEm={new Date(l.fichaEnviadaEm ?? agora.toISOString())}
            completa={l.fichaCompleta === true}
            jaIniciei={p.jaIniciei}
            agora={() => agora}
            aoSeguirComNosso={() => p.aoSeguirComNosso(l)}
            aoFechar={p.aoFecharPergunta}
            aoRegistrar={p.aoRegistrar}
            aoAtualizar={p.aoAtualizar}
          />
        ) : null}
      </div>
      {ra !== null ? <div className="ra">{ra}</div> : <div />}
      {full ? <div className="full">{full}</div> : null}
    </li>
  )
}

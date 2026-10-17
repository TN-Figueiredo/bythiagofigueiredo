/**
 * E5a Tarefa C4: o bloco "O que o criador respondeu" com dado. Componente de servidor, sem estado. Texto de terceiros com `dir="auto"` e sem link
 * (endereço dentro do texto é texto). Nenhum nome de autor. O vídeo de cada item leva ao Histórico.
 */
import Link from 'next/link'
import { link } from '@/lib/youtube/observatorio/links'
import { RiInfo } from '../../_canais/ri-info'
import { PastilhaAusencia } from '../../_chrome/ausencia/pastilhas'
import type { CriadorDoFio } from '../../_chrome/comentarios/fio-model'
import { ZeroMedido } from '../../_chrome/medidas/marcas'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import type { BlocoDoCriador, CasaDoCriador } from './criador-model'
import type { ModeloDaLista } from './criador-lista-model'
import { GrupoDoCriador } from './grupo-do-criador'
import './canal-medidas.css'

const ITENS_DO_INFO = [
  `Base: vídeos longos publicados nos últimos ${MEASURE_RULES.comments.windowDays} dias que já têm retrato de 30 dias dos comentários (cerca de 12 comentários por vídeo, escolhidos pelo YouTube).`,
  `Conta: em quantos desses vídeos vimos pelo menos uma resposta do criador. Percentual só com ${MEASURE_RULES.comments.pctFromN} vídeos ou mais; menos de ${MEASURE_RULES.comments.minVideos}, não medido.`,
  'O retrato de 30 dias é tirado entre o 30º e o 37º dia de vida do vídeo; por isso já existe para vídeos que tinham essa idade quando a coleta começou.',
  'Piso: só vemos as respostas entre os comentários guardados; onde não vimos resposta, ele pode ter respondido fora dos comentários guardados.',
  'Cálculo do Observatório sobre dados públicos do YouTube. O texto dos comentários é de terceiros e aparece como veio; endereço dentro dele é texto, nunca link.',
]

const CLASSE: Record<CasaDoCriador, string> = { com: 'sim', sem: 'nao', espera: 'esp', sem_retrato: 'nm' }

/** O único lugar que desenha o estado do bloco, logo depois da frase do bloco (costura com a decisão 75). */
function EstadoDoBloco({ bloco }: { bloco: BlocoDoCriador }) {
  switch (bloco.tipo) {
    case 'nao_medido':
    case 'fora':
    case 'desligados':
      return <p className="pc-lc" data-estado-do-bloco><PastilhaAusencia estado="nao_medido" /></p>
    case 'nao_carregou':
      return <PastilhaAusencia estado="falhou" motivo="O que o criador respondeu" />
    default:
      return null
  }
}

export function CriadorResponde({ bloco, lista, canalId, criador }: { bloco: BlocoDoCriador; lista: ModeloDaLista | null; canalId?: string; criador: CriadorDoFio }) {
  const mostra = lista && !(bloco.semColeta && lista.tipo === 'vazia') ? lista : null
  return (
    <section className="pc-sec cf-cq" id="criador" aria-labelledby="hCri" data-criador={bloco.tipo}>
      <div className="pc-sh">
        <h2 id="hCri">O que o criador respondeu</h2>
        <RiInfo titulo="as respostas do criador" itens={ITENS_DO_INFO} rotuloBotao="Como ler as respostas do criador" />
      </div>
      {mostra && mostra.tipo === 'itens' ? <p className="pc-fr2" data-frase-da-lista><span><b>{mostra.frase.negrito}</b>{mostra.frase.resto}</span></p> : null}
      <p className="pc-fr2" data-frase-do-bloco>
        {bloco.tipo === 'zero' ? <ZeroMedido /> : null}
        <span>{bloco.frase.negrito ? <b>{bloco.frase.negrito}</b> : null}{bloco.frase.resto}</span>
      </p>
      <EstadoDoBloco bloco={bloco} />
      {bloco.casas.length > 0 ? (
        <div className="pc-rqs" role="img" aria-label={`${bloco.casas.filter(c => c === 'com').length} de ${bloco.nBase} vídeos com resposta vista; ${bloco.casas.filter(c => c === 'espera').length} ainda esperando os 30 dias; ${bloco.casas.filter(c => c === 'sem_retrato').length} sem retrato de 30 dias`}>
          <span className="pc-rql">{bloco.casas.map((c, i) => <i key={i} className={`pc-rq ${CLASSE[c]}`} data-casa={c} />)}</span>
          <span className="pc-rqt">{bloco.legenda.map(l => <span key={l.texto} data-leg={l.chave}><i className={`pc-rq ${CLASSE[l.chave]}`} /> {l.texto}</span>)}</span>
        </div>
      ) : null}
      {mostra ? <Lista m={mostra} canalId={canalId} criador={criador} /> : null}
    </section>
  )
}

function Lista({ m, canalId, criador }: { m: ModeloDaLista; canalId?: string; criador: CriadorDoFio }) {
  if (m.tipo === 'nao_carregou') return <p className="pc-fr2" data-lista-do-criador><span><b>{m.frase.negrito}</b>{m.frase.resto}</span></p>
  if (m.tipo === 'vazia') return <p className="pc-fr2" data-lista-do-criador><span><b>{m.frase.negrito}</b>{m.frase.resto}</span></p>
  if (m.tipo === 'contagem') {
    return (
      <div data-lista-do-criador="contagem">
        <p className="pc-fr2"><span><b>{m.frase.negrito}</b></span></p>
        <div className="pc-ro-box"><p><b>{m.aviso.negrito}</b>{m.aviso.resto}</p></div>
      </div>
    )
  }
  return (
    <div data-lista-do-criador="itens">
      <ul className="pc-grupos">
        {m.grupos.map(g => (
          <GrupoDoCriador key={g.videoId} fios={g.fios} criador={criador} cabeca={(
            <div className="pc-grupo-cab">
              <span className="pc-grupo-th" aria-hidden="true">
                {g.thumb ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={g.thumb} alt="" width={64} height={36} loading="lazy" /> : null}
              </span>
              <div className="pc-grupo-tx">
                <Link className="pc-grupo-tit" href={link.historico(g.videoId, { from: 'canais', canal: canalId })}>{g.titulo}</Link>
                <span className="pc-grupo-n">{g.respostasDele}</span>
              </div>
            </div>
          )} />
        ))}
      </ul>
    </div>
  )
}

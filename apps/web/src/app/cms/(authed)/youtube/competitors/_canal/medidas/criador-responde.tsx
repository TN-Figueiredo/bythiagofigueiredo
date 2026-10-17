/**
 * E5a Tarefa C4: o bloco "O que o criador respondeu" com dado. Componente de servidor, sem estado. Texto de terceiros com `dir="auto"` e sem link
 * (endereço dentro do texto é texto). Nenhum nome de autor. O vídeo de cada item leva ao Histórico.
 */
import Link from 'next/link'
import { link } from '@/lib/youtube/observatorio/links'
import { RiInfo } from '../../_canais/ri-info'
import { NaoCarregou, ZeroMedido } from '../../_chrome/medidas/marcas'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import type { BlocoDoCriador, CasaDoCriador } from './criador-model'
import type { ModeloDaLista } from './criador-lista-model'
import './canal-medidas.css'

const ITENS_DO_INFO = [
  `Base: vídeos longos publicados nos últimos ${MEASURE_RULES.comments.windowDays} dias que já têm retrato de 30 dias dos comentários (cerca de 12 comentários por vídeo, escolhidos pelo YouTube).`,
  `Conta: em quantos desses vídeos vimos pelo menos uma resposta do criador. Percentual só com ${MEASURE_RULES.comments.pctFromN} vídeos ou mais; menos de ${MEASURE_RULES.comments.minVideos}, não medido.`,
  'O retrato de 30 dias é tirado entre o 30º e o 37º dia de vida do vídeo; por isso já existe para vídeos que tinham essa idade quando a coleta começou.',
  'Piso: só vemos as respostas entre os comentários guardados; onde não vimos resposta, ele pode ter respondido fora dos comentários guardados.',
  'Cálculo do Observatório sobre dados públicos do YouTube. O texto dos comentários é de terceiros e aparece como veio; endereço dentro dele é texto, nunca link.',
]

const CLASSE: Record<CasaDoCriador, string> = { com: 'sim', sem: 'nao', espera: 'esp', sem_retrato: 'nm' }

export function CriadorResponde({ bloco, lista, canalId }: { bloco: BlocoDoCriador; lista: ModeloDaLista | null; canalId?: string }) {
  const semMedida = bloco.tipo === 'nao_medido' || bloco.tipo === 'nao_carregou' || bloco.tipo === 'desligados' || bloco.tipo === 'fora'
  return (
    <section className="pc-sec" id="criador" aria-labelledby="hCri" data-criador={bloco.tipo}>
      <div className="pc-sh">
        <h2 id="hCri">O que o criador respondeu</h2>
        <RiInfo titulo="as respostas do criador" itens={ITENS_DO_INFO} rotuloBotao="Como ler as respostas do criador" />
        {semMedida && bloco.tipo !== 'nao_carregou' && bloco.pastilha ? <span className="obs-ch-nm">{bloco.pastilha}</span> : null}
      </div>
      <p className="pc-fr2" data-frase-do-bloco>
        {bloco.tipo === 'zero' ? <ZeroMedido /> : null}
        <span><b>{bloco.frase.negrito}</b>{bloco.frase.resto}</span>
      </p>
      {bloco.tipo === 'nao_carregou' ? <NaoCarregou medida="O que o criador respondeu" /> : null}
      {bloco.casas.length > 0 ? (
        <div className="pc-rqs" role="img" aria-label={`${bloco.casas.filter(c => c === 'com').length} de ${bloco.nBase} vídeos com resposta vista; ${bloco.casas.filter(c => c === 'espera').length} ainda esperando os 30 dias; ${bloco.casas.filter(c => c === 'sem_retrato').length} sem retrato de 30 dias`}>
          <span className="pc-rql">{bloco.casas.map((c, i) => <i key={i} className={`pc-rq ${CLASSE[c]}`} data-casa={c} />)}</span>
          <span className="pc-rqt">{bloco.legenda.map(l => <span key={l.texto} data-leg={l.chave}><i className={`pc-rq ${CLASSE[l.chave]}`} /> {l.texto}</span>)}</span>
        </div>
      ) : null}
      {lista && !(bloco.semColeta && lista.tipo === 'vazia') ? <Lista m={lista} canalId={canalId} /> : null}
    </section>
  )
}

function Lista({ m, canalId }: { m: ModeloDaLista; canalId?: string }) {
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
      <h3 className="pc-sub">{m.subtitulo}</h3>
      <p className="pc-fr2"><span><b>{m.frase.negrito}</b>{m.frase.resto}</span></p>
      <ul className="pc-cm">
        {m.itens.map((x, i) => (
          <li key={i}>
            <p className="pc-cmv"><Link href={link.historico(x.videoId, { from: 'canais', canal: canalId })}>{x.titulo}</Link>{x.curtidas ? ` · ${x.curtidas}` : ''}</p>
            <div className="pc-cmb"><span className="pc-cma" aria-hidden="true">?</span><p dir="auto">{x.texto}{x.cortado ? ' …' : ''}</p></div>
            <div className="pc-cmr"><span className="chip own">criador</span><p dir="auto">{x.respostaTexto}{x.respostaCortada ? ' …' : ''}</p></div>
          </li>
        ))}
      </ul>
      {m.aMais > 0 ? <p className="pc-pgl">Mais {m.aMais} {m.aMais === 1 ? 'resposta guardada' : 'respostas guardadas'} não {m.aMais === 1 ? 'cabe' : 'cabem'} nesta lista.</p> : null}
    </div>
  )
}

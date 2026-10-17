/**
 * A5 · E5a, Tarefa 10a (mockup 14): o bloco "Estourou e parou" do Histórico do vídeo de concorrente.
 * `EstourouEParou` recebe a leitura já pronta (`leitura`) e não sabe de onde veio a série: a Tarefa 21 troca a origem sem editar este desenho.
 * O texto obrigatório só entra no estado `estourou_e_parou`. Componente de servidor: sem estado, sem efeito.
 */
import type { ReactNode } from 'react'
import { EstourouInfo } from './estourou-info'
import { EstourouCasas } from '../_chrome/medidas/estourou-casas'
import { TextoIndicio } from '../_chrome/medidas/texto-indicio'
import { dataBR, milhar, NOME_DA_LEITURA, pct, REGRAS_DA_LEITURA, vezes, type CartaoQuaseNada, type CartaoReacao, type CartaoViewsCedo, type Leitura, type PassaAExistir } from '../_chrome/medidas/estourou-model'

const R = REGRAS_DA_LEITURA
const IND = <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.8 13.4 4.6 4l2.4 8.2h8" /></svg>
const AVISO = <svg className="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.2 14.4 13.4H1.6Z" /><path d="M8 6.6v3.2M8 11.5v.1" /></svg>
const dmBR = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const NM = <span className="lm-nm">não medido</span>

function Cabeca({ rotulo, ainda = false }: { rotulo: boolean; ainda?: boolean }) {
  return (
    <header className="lm-h">
      <h2>{rotulo ? <><span className="lm-rot">Leitura:</span> </> : null}{NOME_DA_LEITURA}</h2>
      {ainda ? <span className="lm-ainda">ainda não medido</span> : <span className="lm-ind">{IND}indício</span>}
      <EstourouInfo />
    </header>
  )
}

// ───── a régua ─────

const lim100 = (x: number, max: number): number => Math.min(100, Math.max(0, (x / max) * 100))

function Regua({ valor, limite, normal, max, mais, tipo }: { valor: number; limite: number; normal: number | null; max: number; mais: boolean; tipo: 'n' | 'pct' }) {
  const f = (x: number): string => (tipo === 'pct' ? pct(x) : milhar(x))
  const pl = lim100(limite, max), pv = lim100(valor, max), pn = normal === null ? null : lim100(normal, max)
  const passou = valor > max, zero = valor === 0
  const lado = (mais ? valor >= limite : valor <= limite) ? 'do lado que bate' : 'do lado que não bate'
  const aria = `Régua. Este vídeo: ${f(valor)}${passou ? ' (passa do fim da régua)' : ''}. Limite: ${f(limite)}${normal === null ? '' : `. Normal do canal: ${f(normal)}`}. O vídeo está ${lado}.`
  return (
    <>
      <div className="lm-reg" role="img" aria-label={aria}>
        <div className="lm-trk" aria-hidden="true">
          <i className="lm-vale" style={mais ? { left: `${pl}%`, right: 0 } : { left: 0, width: `${pl}%` }} />
          {pn === null ? null : <i className="lm-nor" style={{ left: `${pn}%` }} />}
          <i className="lm-lim" style={{ left: `${pl}%` }} />
          <i className={`lm-mk${passou ? ' clip' : zero ? ' zero' : ''}`} style={{ left: `${pv}%` }} />
        </div>
      </div>
      <ul className={`lm-key${normal === null ? ' dois' : ''}`} aria-hidden="true">
        <li><span className="g pto" /><span className="k">Este vídeo</span><span className="vv">{f(valor)}</span></li>
        <li><span className="g lim" /><span className="k">Limite</span><span className="vv">{f(limite)}</span></li>
        {normal === null ? null : <li><span className="g nor" /><span className="k">Normal</span><span className="vv">{f(normal)}</span></li>}
      </ul>
    </>
  )
}

function Selo({ k, pequeno = false, texto }: { k: 'v' | 'n' | 'm'; pequeno?: boolean; texto?: string }) {
  return <span className={`lm-st ${k}${pequeno ? ' sm' : ''}`}>{texto ?? (k === 'v' ? '✓ bate' : k === 'n' ? '✕ não bate' : 'não medido')}</span>
}
const Igual = ({ f }: { f: boolean }) => (f ? <> <b>Igual ao limite: bate.</b></> : null)

// ───── os três cartões ─────

function Cartao1({ c }: { c: CartaoViewsCedo }) {
  return (
    <article className="lm-c" aria-label={`Muitas views cedo: ${c.vale ? 'bate' : 'não bate'}`}>
      <div className="lm-ch"><div className="lm-tt"><h3>Muitas views cedo</h3></div><Selo k={c.vale ? 'v' : 'n'} /></div>
      <p className="lm-n"><b className="num">{milhar(c.valor)}</b><span className="u">views nos 30 primeiros dias</span></p>
      <p className="lm-rz"><b>{vezes(c.razao)}</b> o normal do canal</p>
      <p className="lm-vl"><b>Bate</b> se tiver {milhar(c.limite)} views ou mais ({R.outlierMin}× o normal).<Igual f={c.igual} /></p>
      <Regua valor={c.valor} limite={c.limite} normal={c.normal} max={c.normal * 4} mais tipo="n" />
    </article>
  )
}

function Cartao2({ c }: { c: CartaoQuaseNada }) {
  const nb = (c.valeCauda ? 1 : 0) + (c.valeRende ? 1 : 0)
  const zeroCauda = c.cauda === 0, zeroRende = c.ganho === 0
  const seloCartao = `${c.vale ? '✓' : '✕'} ${nb} de 2 ${nb === 1 ? 'bate' : 'batem'}`
  return (
    <article className="lm-c" aria-label={`Quase nada depois: ${c.vale ? 'as duas condições batem' : `só ${nb} de 2 condições ${nb === 1 ? 'bate' : 'batem'}`}`}>
      <div className="lm-ch"><div className="lm-tt"><h3>Quase nada depois</h3></div><Selo k={c.vale ? 'v' : 'n'} texto={seloCartao} /></div>
      <p className="lm-n">
        {zeroCauda
          ? <><span className="lm-z" role="img" aria-label="zero medido">0</span><span className="u">nenhuma view depois dos 30 primeiros dias</span></>
          : <><b className="num">{pct(c.cauda)}</b><span className="u">das views vieram depois do dia 30</span></>}
      </p>
      <p className="lm-rz com-selo">
        <span>{zeroCauda ? <>O normal do canal é <b>{pct(c.normalCauda)}</b></> : <><b>{vezes(c.razaoCauda)}</b> o normal do canal</>}</span>
        <Selo k={c.valeCauda ? 'v' : 'n'} pequeno />
      </p>
      <p className="lm-vl"><b>Bate</b> se for até {pct(c.limiteCauda)} (metade do normal).<Igual f={c.igualCauda} /></p>
      <Regua valor={c.cauda} limite={c.limiteCauda} normal={c.normalCauda} max={c.normalCauda * 2} mais={false} tipo="pct" />
      <div className="lm-sub">
        <div className="lm-ch"><div className="lm-tt"><h3>E ainda rende pouco</h3></div><Selo k={c.valeRende ? 'v' : 'n'} /></div>
        <p className="lm-n">
          {zeroRende
            ? <><span className="lm-z" role="img" aria-label="zero medido">0</span><span className="u">view ganha nos últimos {R.stillDias} dias</span></>
            : <><b className="num">{pct(c.rende)}</b><span className="u">ganhos nos últimos {R.stillDias} dias ({milhar(c.ganho)} views)</span></>}
        </p>
        <p className="lm-vl"><b>Bate</b> se for até {pct(c.limiteRende)} das views dos 30 primeiros dias.<Igual f={c.igualRende} /></p>
        <Regua valor={c.rende} limite={c.limiteRende} normal={null} max={0.04} mais={false} tipo="pct" />
      </div>
    </article>
  )
}

function Cartao3({ c }: { c: CartaoReacao }) {
  return (
    <article className="lm-c" aria-label={`Pouca reação do público: ${c.vale ? 'bate' : 'não bate'}`}>
      <div className="lm-ch"><div className="lm-tt"><h3>Pouca reação do público</h3></div><Selo k={c.vale ? 'v' : 'n'} /></div>
      <p className="lm-n"><b className="num">{pct(c.taxa)}</b><span className="u">curtidas e comentários por view, aos 30 dias</span></p>
      <p className="lm-rz"><b>{vezes(c.razao)}</b> o normal do canal · {milhar(c.reacoes)} de {milhar(c.views)} views</p>
      <p className="lm-vl"><b>Bate</b> se for até {pct(c.limite)} (metade do normal).<Igual f={c.igual} /></p>
      <Regua valor={c.taxa} limite={c.limite} normal={c.normal} max={c.normal * 2} mais={false} tipo="pct" />
    </article>
  )
}

// ───── o que falta, e quando passa a existir ─────

function Passa({ p }: { p: PassaAExistir }): ReactNode {
  if (p.tipo === 'sem_promessa') return null
  const texto = p.tipo === 'data' ? `em ${dataBR(p.data)} (faltam ${p.faltam} ${p.faltam === 1 ? 'dia' : 'dias'}).` : p.tipo === 'nunca' ? `${p.texto}.` : `${p.texto}.`
  return <p className="q"><b>Passa a existir:</b> {texto}</p>
}

function NaoMedido({ l }: { l: Extract<Leitura, { tipo: 'nao_medido' }> }) {
  const f = l.falta
  return (
    <div className="lm-nmp" role="group" aria-label={`Não medido: ${l.curta}`}>
      <div className="lm-falta">{NM}{l.aoVivo ? <span className="lm-chip">ao vivo ou estreia</span> : null}<p className="t">{l.titulo}</p></div>
      {l.explica ? <p className="q">{l.explica}</p> : null}
      {f?.tipo === 'barra' ? (
        <div className="lm-falta">
          <span className="lm-bar" role="img" aria-label={`${f.legenda}`}><i style={{ width: `${Math.round(Math.min(1, f.feitos / f.total) * 100)}%` }} /></span>
          <span className="q"><b>{f.legenda}</b></span>
        </div>
      ) : null}
      {f?.tipo === 'bolas' ? (
        <div className="lm-falta">
          <span className="lm-bolas" role="img" aria-label={`${f.feitos} de ${f.total} vídeos`}>
            {Array.from({ length: f.total }, (_, i) => <i key={i} className={i < f.feitos ? 'on' : 'off'} />)}
          </span>
          <span className="q"><b>{f.legenda}</b></span>
        </div>
      ) : null}
      <Passa p={l.passaAExistir} />
    </div>
  )
}

function Cartoes({ l }: { l: Extract<Leitura, { tipo: 'nao_e_o_caso' | 'estourou_e_parou' }> }) {
  return (
    <div className="lm-cards">
      <Cartao1 c={l.cartoes.viewsCedo} />
      <Cartao2 c={l.cartoes.quaseNada} />
      <Cartao3 c={l.cartoes.reacao} />
    </div>
  )
}

/** A frase-resumo: a parte antes dos dois-pontos em negrito. No "estourou e parou" os dois-pontos ficam fora do negrito, como no mockup. */
function Frase({ texto, pico }: { texto: string; pico: boolean }) {
  const i = texto.indexOf(':')
  const cabeca = texto.slice(0, i), resto = texto.slice(i + 1)
  return pico ? <><b>{cabeca}</b>:{resto}</> : <><b>{cabeca}:</b>{resto}</>
}


/** O bloco, em cada estado da leitura. */
export function EstourouEParou({ leitura }: { leitura: Leitura }) {
  const sec = (filho: ReactNode, rotulo: boolean, ainda = false) => (
    <section className="lm" aria-label={NOME_DA_LEITURA} data-leitura={leitura.tipo}>
      <Cabeca rotulo={rotulo} ainda={ainda} />
      {filho}
    </section>
  )
  switch (leitura.tipo) {
    case 'ainda_nao_existe':
      return sec(
        <p className="lm-sd">
          <b>Ainda sem leitura.</b> Este vídeo faz {R.minDias} dias em {dmBR(leitura.esteVideoEm)}; a leitura sai nesse dia se houver {R.minVideos} vídeos do canal com {R.minDias} dias para comparar.
        </p>, true, true)
    case 'nao_carregou':
      return sec(
        <div className="lm-err" role="alert">
          {AVISO}
          <div className="tx"><b>Não foi possível calcular a leitura agora.</b><span>Isto não quer dizer que o vídeo não estourou: a leitura não foi calculada. Os números do vídeo acima estão certos.</span></div>
          {/* G-3 (NOTAS 14, linha "Erro"): recarrega a mesma página; o componente é de servidor, então um link basta */}
          <a className="btn" href="">Tentar de novo</a>
        </div>, true)
    case 'nao_medido':
      return sec(
        <>
          <p className="lm-fr"><EstourouCasas casas={leitura.casas} /><span><b>Não medido:</b> {leitura.curta}.</span></p>
          <NaoMedido l={leitura} />
        </>, true)
    case 'nao_e_o_caso':
      return sec(
        <>
          <p className="lm-fr"><EstourouCasas casas={leitura.casas} /><span><Frase texto={leitura.frase} pico={false} /></span></p>
          <Cartoes l={leitura} />
        </>, true)
    case 'estourou_e_parou':
      return sec(
        <>
          <p className="lm-fr"><EstourouCasas casas={leitura.casas} /><span><Frase texto={leitura.frase} pico /></span></p>
          <TextoIndicio />
          <Cartoes l={leitura} />
        </>, false)
  }
}

/** A reserva do `<Suspense>`: o título e a frase de espera (`aria-busy`). */
export function EstourouCarregando() {
  return (
    <section className="lm" aria-label={NOME_DA_LEITURA} data-leitura="carregando">
      <Cabeca rotulo />
      <div className="lm-sk" role="status" aria-busy="true" aria-label="Calculando a leitura">
        <p className="lm-fr"><EstourouCasas casas="ppp" rotulo="Calculando" /><span>Calculando a leitura...</span></p>
        <i />
      </div>
    </section>
  )
}

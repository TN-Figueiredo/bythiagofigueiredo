'use client'
/**
 * "Número a número" (spec 18.4): uma <table> de verdade (caption, th scope col/row/rowgroup, `role` explícito em cada elemento porque
 * `display:grid` em <tr> tira a semântica em alguns navegadores). Três grupos, até treze linhas, cada uma com nome, base, valor de A, valor
 * de B, o eixo (régua do nicho ou barras finas) e a relação, sempre nomeando o maior. Dado ausente: pastilha de hachura "não medido" e o
 * motivo na segunda linha, nunca zero. Linha sem dado nos dois lados não aparece (o rodapé conta). Cores só por `--c`; sem verde nem vermelho.
 */
import { useMemo, useRef, useState, useId, type CSSProperties, type ReactNode } from 'react'
import { Popover } from '../_chrome/flut/flut'
import { Icon } from '../_chrome/icons'
import { ReguaNicho } from '../_chrome/regua/regua-nicho'
import type { ReguaView } from '../_chrome/regua/regua-model'
import { corVar } from './lados'
import { LeituraRapida } from './leitura-rapida'
import type { Numero, NumeroId } from './numeros-model'
import type { CompararPack } from './pack'
import type { LinhaPar, ParView, Relacao } from './par-model'
import { reguaDaLinha } from './regua-da-linha'

const GRUPOS: Record<LinhaPar['grupo'], { nome: string; icone: ReactNode }> = {
  tamanho: { nome: 'Tamanho', icone: <svg className="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13.5V9M8 13.5V4.5M13 13.5V7" /></svg> },
  publicacao: { nome: 'Publicação', icone: <svg className="i" viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M2.5 6.8h11M5.5 2v3M10.5 2v3" /></svg> },
  desempenho: { nome: 'Desempenho', icone: <svg className="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 12l4-4.5 3 2.5 5-6M10.5 4h3.5v3.5" /></svg> },
}

/** O modelo entrega a relação em minúscula quando ela começa por uma frase ("praticamente igual", "os dois em 0"); o nome de um canal, nunca é mexido ("tnFigueiredo"). */
export function capitalizar(texto: string, nomes: readonly string[]): string {
  // o nome só conta quando é a primeira PALAVRA ("Ana Viaja: …", "tnLeo não …")
  if (!texto || nomes.some(n => n && (texto.startsWith(n + ' ') || texto.startsWith(n + ':')))) return texto
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

const vars = (cor: string): CSSProperties => ({ '--c': cor } as CSSProperties)

/** Na pilha de telas estreitas (≤ 820 px) o cabeçalho de coluna fica longe: cada valor leva a letra do lado, no chip da cor do lado. Some na tabela larga. */
function Rotulo({ lado }: { lado: 'A' | 'B' }) {
  return <span className="cp-lb" aria-hidden="true">{lado}</span>
}

function Celula({ n, pos, classe, cor }: { n: Numero; pos: LinhaPar['pos'][number]; classe: string; cor: string }) {
  const lado = classe === 'cA' ? 'A' : 'B'
  if (n.x == null) {
    return (
      <td role="cell" className={`nd ${classe}`} style={vars(cor)}>
        <Rotulo lado={lado} />
        <span className="obs-ch-nm">não medido</span>
        <small className="why">{n.motivo}</small>
      </td>
    )
  }
  return (
    <td role="cell" className={classe} style={vars(cor)}>
      <Rotulo lado={lado} />
      <span className="v1 num">{n.texto}</span>
      {pos ? <small className="pos">{pos.texto}</small> : null}
      {pos?.geral ? <small className="pos geral">{pos.geral}</small> : null}
      {n.nota ? <small className="sub">{n.nota}</small> : null}
    </td>
  )
}

/**
 * A posição escrita sob o valor. Onde há régua, o texto vem DA régua (a mesma conta do aria e dos traços; a posição escrita e a desenhada
 * não podem divergir); a posição geral apagada continua a do modelo do par. Sem régua (número fora das seis), vale a do modelo.
 */
function posDoLado(l: LinhaPar, regua: ReguaView | undefined, i: 0 | 1): LinhaPar['pos'][number] {
  const doModelo = l.pos[i]
  const daRegua = regua?.posicao[i === 0 ? 'A' : 'B']
  if (daRegua) return { texto: daRegua.texto, geral: doModelo?.geral ?? null }
  return doModelo
}

function CelulaRelacao({ linha, par }: { linha: LinhaPar; par: ParView }) {
  const r: Relacao | null = linha.relacao
  const nomes = [par.a.name, par.b.name]
  if (!r) {
    const ladoSemDado = linha.lados[0].x == null || linha.lados[1].x == null
    // inscritos em 30 dias não tem relação por regra; os outros só ficam sem ela quando um lado não foi medido
    return <td role="cell" className="rel off">{ladoSemDado ? <span className="obs-ch-sr">sem relação: um dos lados não foi medido</span> : null}</td>
  }
  switch (r.tipo) {
    case 'maior':
      return <td role="cell" className="rel"><span className="sy" style={vars(corVar(par.cores[r.lado]))} aria-hidden="true">▲</span><span className="obs-ch-sr">{r.quem} é maior. </span><span className="rt">{r.texto}</span></td>
    case 'recente':
      return <td role="cell" className="rel"><span className="sy" style={vars(corVar(par.cores[r.lado]))} aria-hidden="true">●</span><span className="obs-ch-sr">{r.quem} é o mais recente. </span><span className="rt">{r.texto}</span></td>
    case 'igual':
      return <td role="cell" className="rel"><span className="sy eq" aria-hidden="true">＝</span><span className="obs-ch-sr">Praticamente iguais. </span><span className="rt">{capitalizar(r.texto, [])}</span></td> // nunca começa por nome de canal: "praticamente igual", "os dois em 0", "nenhum dos dois…"
    case 'zero':
      return <td role="cell" className="rel dim"><span className="rt">{capitalizar(r.texto, nomes)}</span></td>
    default: { const nunca: never = r; return nunca }
  }
}

function CelulaEixo({ linha, par, regua, chave }: { linha: LinhaPar; par: ParView; regua: ReguaView | null; chave: string }) {
  const e = linha.eixo
  switch (e.tipo) {
    case 'regua':
      return <td role="cell" className="cN">{regua ? <ReguaNicho key={chave} regua={regua} cores={{ A: corVar(par.cores[0]), B: corVar(par.cores[1]) }} /> : null}</td>
    case 'barras':
      return (
        <td role="cell" className="cN">
          <span className="bars2" aria-hidden="true">
            {([0, 1] as const).map(i => (
              <span className="b2" key={i}>
                <span className="b2l" style={vars(corVar(par.cores[i]))}>{i ? 'B' : 'A'}</span>
                <span className="b2t"><i className={e.larguras[i] === 0 ? 'zero' : undefined} style={{ ...vars(corVar(par.cores[i])), width: `${e.larguras[i] * 100}%` }} /></span>
              </span>
            ))}
          </span>
          {e.aviso ? <small className="sub-n">{e.aviso}</small> : null}
        </td>
      )
    case 'nenhum':
      return <td role="cell" className="cN" />
    default: { const nunca: never = e; return nunca }
  }
}

export function NumeroANumero({ pack, par }: { pack: CompararPack; par: ParView }) {
  const titulo = useId(), dica = useId(), dicaTitulo = useId()
  const [aberta, setAberta] = useState(false)
  const botao = useRef<HTMLButtonElement>(null)
  const chaveDoPar = `${par.a.id}|${par.b.id}`
  // memoizada por par: a régua mantém o estado interno (traço ativo, letras) e não recalcula a cada render; a chave por par o zera na troca
  const reguas = useMemo(() => {
    const m = new Map<NumeroId, ReguaView>()
    for (const l of par.linhas) if (l.eixo.tipo === 'regua') { const r = reguaDaLinha(pack, par, l.id); if (r) m.set(l.id, r) }
    return m
  }, [pack, par])
  const grupos = (['tamanho', 'publicacao', 'desempenho'] as const).map(g => ({ g, linhas: par.linhas.filter(l => l.grupo === g) })).filter(x => x.linhas.length)
  const mediana = par.conjunto.tipo === 'nicho' ? 'No nicho' : 'No geral'
  const comprimidas = par.linhas.filter(l => reguas.get(l.id)?.comprimida).map(l => l.nome)
  const [ca, cb] = par.cores
  // "Views por dia nos longos": o canal seu mede 28 dias do diário e o concorrente, desde o começo da série dele; com um canal seu de um lado só, as janelas diferem
  const janelasDiferentes = par.a.own !== par.b.own && par.linhas.some(l => l.id === 'vpd')
  return (
    <section className="cp-sec" aria-labelledby={titulo}>
      <h2 id={titulo}>
        Número a número
        <button ref={botao} type="button" className="ibtn" aria-expanded={aberta} aria-controls={dica} aria-label="Como ler esta tabela" onClick={() => setAberta(o => !o)}>{Icon.info()}</button>
      </h2>
      <Popover open={aberta} anchor={() => botao.current} onClose={() => setAberta(false)} id={dica} role="dialog" labelledBy={dicaTitulo} className="cp-tip" pref="baixo" align="inicio" maxW={400}>
        <h3 id={dicaTitulo}>Como ler esta tabela</h3>
        <ul>
          <li><b>Os lados:</b> laranja é o seu canal, azul é o outro; quando nenhum dos dois é seu, o lado A é areia. Cada lado também tem a sua letra, A ou B, para não depender da cor.</li>
          <li><b>Régua:</b> um traço por canal {par.conjunto.tipo === 'nicho' ? `de ${par.conjunto.label}` : 'do site'}, do menor ao maior; os dois traços destacados e com letra são os lados A e B. A posição escrita ao lado de cada valor é a do mesmo número (1º = o maior). {comprimidas.length ? `Escala comprimida em ${listar(comprimidas.map(minuscula))}, para o maior canal não apagar os pequenos; ` : ''}{comprimidas.length ? 'as demais, em escala linear.' : 'Escala linear em todas as réguas.'} Lado sem dado não ganha traço, e a linha diz de quem falta.</li>
          <li><b>Barras finas:</b> nos números que só existem para os dois canais, uma barra por lado, no mesmo eixo, proporcional ao maior dos dois. Se a menor passa a ser menos de 3% da maior, ela ganha 3 px e a linha avisa.</li>
          <li><b>Relação:</b> a partir de 2× a frase usa “×”; abaixo, percentual. Diferença menor que 10% é “praticamente igual”. ▲ marca o lado maior, ＝ os praticamente iguais. Sem relação quando um lado não foi medido.</li>
          <li><b>Dias desde o último vídeo:</b> sem barra nem régua (menor é mais recente, e a barra cheia leria como vantagem).</li>
          <li><b>Não medido</b> (hachura): o dado não existe para esse lado; não é zero.</li>
          {par.fora.length ? <li><b>Ficaram de fora</b> porque nenhum dos dois tem o dado: {listar(par.fora.map(minuscula))}.</li> : null}
        </ul>
      </Popover>
      <LeituraRapida itens={par.leitura} cores={par.cores} />
      <div className="cp-tw">
        <table className="cp-t" role="table">
          <caption className="obs-ch-sr">{`Números de ${par.a.name} (lado A) e de ${par.b.name} (lado B), lado a lado. Depois dos dois valores vem a posição entre os canais ${par.conjunto.tipo === 'nicho' ? `de ${par.conjunto.label}` : 'do site'}, e a última coluna diz quem é maior.`}</caption>
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader" className="c0"><span className="obs-ch-sr">Número</span></th>
              <th scope="col" role="columnheader" className="cA" style={vars(corVar(ca))}><span className="cl lm">Lado A</span>{par.a.name}</th>
              <th scope="col" role="columnheader" className="cB" style={vars(corVar(cb))}><span className="cl lm">Lado B</span>{par.b.name}</th>
              <th scope="col" role="columnheader" className="cN"><span className="cl">{mediana}</span>do menor ao maior</th>
              <th scope="col" role="columnheader" className="cR">Relação</th>
            </tr>
          </thead>
          {grupos.map(({ g, linhas }) => (
            <tbody role="rowgroup" key={g}>
              <tr role="row" className="grp"><th scope="rowgroup" role="rowheader" colSpan={5}>{GRUPOS[g].icone}{GRUPOS[g].nome}</th></tr>
              {linhas.map(l => (
                <tr role="row" key={l.id}>
                  <th scope="row" role="rowheader" className="rl">{l.nome}<small>{l.base}</small></th>
                  <Celula n={l.lados[0]} pos={posDoLado(l, reguas.get(l.id), 0)} classe="cA" cor={corVar(ca)} />
                  <Celula n={l.lados[1]} pos={posDoLado(l, reguas.get(l.id), 1)} classe="cB" cor={corVar(cb)} />
                  <CelulaEixo linha={l} par={par} regua={reguas.get(l.id) ?? null} chave={`${chaveDoPar}|${l.id}`} />
                  <CelulaRelacao linha={l} par={par} />
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      {janelasDiferentes ? (
        <p className="cp-aviso" data-janelas-aviso="">
          <span className="cp-aviso-i" aria-hidden="true">{Icon.info()}</span>
          <span>As duas janelas de tempo são diferentes: 28 dias de um lado, desde {pack.serieDesde} do outro. Maior não quer dizer melhor: são canais de tamanhos diferentes.</span>
        </p>
      ) : null}
      <p className="cp-n">{par.rodape}</p>
    </section>
  )
}

const minuscula = (t: string) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t)
function listar(xs: readonly string[]): string {
  return xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`
}

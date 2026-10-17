'use client'
/**
 * E5a Tarefa 17: Lançamentos, como os vídeos novos começam. O vídeo escolhido é estado local (nenhuma ida à rede: a frase de cada vídeo já
 * vem pronta no modelo). Abre sempre pelo último vídeo. As 72 horas chegam como elemento pronto (`horas`), sem componente na prop.
 * O desenho é SVG dentro de `GraficoLegivel`; tudo o que ele diz existe como texto nos pontos e na tabela.
 */
import { useState, type ReactNode } from 'react'
import { GraficoLegivel } from '../../_chrome/medidas/grafico-legivel'
import { PastilhaAusencia } from '../../_chrome/ausencia/pastilhas'
import { RiInfo } from '../../_canais/ri-info'
import { ptn } from './formatos'
import type { ModeloDeLancamentos, PontoDoNormal, VideoDeLancamento } from './lancamentos-model'
import './canal-medidas.css'

const CLASSE: Record<VideoDeLancamento['faixa'], string> = { muito_acima: 'topo', acima: 'alto', perto: 'medio', abaixo: 'baixo', sem_normal: 'sem' }

const W = 640, H = 300, LM = 66, RM = 18, TM = 16, BM = 32
const PW = W - LM - RM, PH = H - TM - BM
const IDADES = [1, 2, 3, 5, 7, 14, 21, 30]

function Marcador({ cls, x, y, r, di }: { cls: string; x: number; y: number; r: number; di?: number }) {
  const extra = di === undefined ? {} : { 'data-i': di }
  if (cls === 'topo') return <polygon className={`pc-mk ${cls}`} points={`${x},${y - r - 1} ${x + r + 1},${y} ${x},${y + r + 1} ${x - r - 1},${y}`} {...extra} />
  if (cls === 'alto') return <rect className={`pc-mk ${cls}`} x={x - r} y={y - r} width={2 * r} height={2 * r} {...extra} />
  return <circle className={`pc-mk ${cls}`} cx={x} cy={y} r={r} {...extra} />
}

function Grafico({ m, sel }: { m: Extract<ModeloDeLancamentos, { tipo: 'curvas' }>; sel: number }) {
  const { ymax, rotulos } = m.escala
  const X = (a: number) => LM + (PW * a) / 30
  const Y = (v: number) => TM + PH * (1 - v / ymax)
  const ordem = m.videos.map((_, i) => i).sort((a, b) => Number(a === sel) - Number(b === sel))
  const pts = m.normal.filter((p): p is PontoDoNormal & { valor: number } => p.valor !== null)
  const v0 = m.videos[sel]
  return (
    <svg className="pc-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
      <defs>
        <pattern id="pcH" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" className="pc-hp-b" /><line x1="0" y1="0" x2="0" y2="6" className="pc-hp-l" /></pattern>
      </defs>
      {[0, 0.5, 1].map((f, k) => (
        <g key={f}>
          <line className="ic-grid" x1={LM} x2={W - RM} y1={Y(ymax * f)} y2={Y(ymax * f)} />
          <text className="ic-ax" x={LM - 6} y={Y(ymax * f) + 4} textAnchor="end">{rotulos[k]}</text>
        </g>
      ))}
      {IDADES.map(a => (
        <g key={a}>
          <line className="pc-tick" x1={X(a)} x2={X(a)} y1={TM + PH} y2={TM + PH + 4} />
          <text className="ic-ax" x={X(a)} y={TM + PH + 17} textAnchor="middle">{a}</text>
        </g>
      ))}
      <text className="ic-ax" x={W - RM} y={H - 2} textAnchor="end">dias desde a publicação</text>
      {ordem.map(i => {
        const v = m.videos[i]!
        const cls = CLASSE[v.faixa]
        const on = i === sel
        const d = [{ idadeDias: 0, views: 0 }, ...v.curva].map((p, k) => `${k ? 'L' : 'M'}${X(p.idadeDias).toFixed(1)} ${Y(p.views).toFixed(1)}`).join('')
        const fim = v.curva[v.curva.length - 1]!
        return (
          <g key={v.id}>
            <path className={`pc-ln ${cls}${on ? ' on' : ''}`} d={d} />
            <Marcador cls={cls} x={Number(X(fim.idadeDias).toFixed(1))} y={Number(Y(fim.views).toFixed(1))} r={on ? 6 : 4.5} di={i} />
            <text className={`pc-idx${on ? ' on' : ''}`} x={X(fim.idadeDias) + 9} y={Y(fim.views) - 4}>{v.ordem}</text>
          </g>
        )
      })}
      {pts.length ? (
        <>
          <path className="pc-ln med" d={pts.map((p, k) => `${k ? 'L' : 'M'}${X(p.idadeDias).toFixed(1)} ${Y(p.valor).toFixed(1)}`).join('')} />
          {pts.map(p => <circle key={p.idadeDias} className="pc-mk med" cx={X(p.idadeDias)} cy={Y(p.valor)} r={4.5} />)}
        </>
      ) : null}
      {v0 && v0.passou ? (
        <>
          <circle className="pc-pin" cx={X(v0.passou.dia)} cy={Y(v0.passou.valor)} r={10} />
          <text className="pc-pint" x={Math.min(X(v0.passou.dia) + 14, W - 70)} y={Y(v0.passou.valor) - 12}>dia {v0.passou.dia}: {v0.passou.razao.toFixed(1).replace('.', ',')}×</text>
        </>
      ) : null}
    </svg>
  )
}

function Swatch({ cls }: { cls: string }) {
  return (
    <svg className={`pc-sw2 ${cls}`} width="34" height="16" viewBox="0 0 34 16" aria-hidden="true">
      <path className={`pc-ln ${cls}`} d="M2 8H22" />
      <Marcador cls={cls} x={28} y={8} r={4} />
    </svg>
  )
}

export function Lancamentos({ modelo, horas }: { modelo: ModeloDeLancamentos; horas: ReactNode }) {
  const [sel, setSel] = useState(0)
  const itens = [
    'Linha do normal: em cada idade (1, 2, 3, 5, 7, 14, 21 e 30 dias), a mediana das views dos vídeos do canal publicados nos últimos 180 dias, no instante daquela idade (interpolação linear entre duas leituras vizinhas).',
    'Cada ponto leva o seu n: o número de vídeos medidos naquela idade; com menos de 3 o ponto não existe e a casa fica em hachura.',
    'Curvas: os 6 vídeos mais recentes com contagem por vídeo (desde 03/10/2026); cada um para na sua idade de hoje.',
    'Cor e forma: a cor e o desenho da ponta dizem o desempenho contra o normal na última idade com ponto: ◆ 2× ou mais, ■ 1,5× a 2×, ● perto do normal, ○ abaixo de dois terços. O normal de cada vídeo é calculado sem ele mesmo.',
    'Primeiras 72 horas: mediana, entre os vídeos, da parte das views das 72 horas que já aconteceu em cada hora; horário de São Paulo.',
  ]
  const cabeca = (
    <div className="pc-sh">
      <h2 id="hLan">Lançamentos: como os vídeos novos começam</h2>
      <RiInfo titulo="os lançamentos" itens={itens} rotuloBotao="Como ler os lançamentos" />
    </div>
  )
  const rodape = <div className="pc-72"><h3 id="h72t">Primeiras 72 horas</h3>{horas}</div>

  if (modelo.tipo === 'nao_carregou') {
    return (
      <section className="pc-sec" id="lancamentos" aria-labelledby="hLan">
        {cabeca}
        <div className="pc-lc"><PastilhaAusencia estado="falhou" motivo="lançamentos" /><p>{modelo.motivo}</p></div>
        {rodape}
      </section>
    )
  }
  if (modelo.tipo === 'vazio') {
    return (
      <section className="pc-sec" id="lancamentos" aria-labelledby="hLan">
        {cabeca}
        <p className="pc-fr2" data-frase-do-bloco><span><b>{modelo.frase}</b></span></p>
        <div className="pc-lc"><span className="obs-ch-nm">não medido</span><p>{modelo.explicacao}</p></div>
        {rodape}
      </section>
    )
  }
  const i = Math.min(sel, modelo.videos.length - 1)
  const frase = modelo.temNormal ? modelo.videos[i]!.frase : modelo.frase!
  // Sem normal: o leitor e a tabela dizem o fato do último ponto medido, não o aviso (que já está na frase do topo).
  const pontos = modelo.videos.map(v => ({
    rotulo: `Vídeo ${v.ordem}`,
    fala: modelo.temNormal ? `${v.titulo}: ${v.razao ?? 'sem ponto para comparar com o normal'}, ${v.faixaNome}` : `${v.titulo}: ${v.ultimoPonto?.texto ?? 'sem ponto medido'}`,
  }))
  const tabela = modelo.temNormal ? undefined : { cabecalho: ['Vídeo', 'Views no último ponto medido'], linhas: modelo.videos.map(v => [`Vídeo ${v.ordem}: ${v.titulo}`, v.ultimoPonto?.texto ?? 'sem ponto medido']) }
  const nome = modelo.soShorts ? 'Shorts' : 'vídeos'
  return (
    <section className="pc-sec" id="lancamentos" aria-labelledby="hLan">
      {cabeca}
      <p className="pc-fr2" data-frase-do-bloco><span><b>{frase.negrito}</b>{frase.resto}</span></p>
      <GraficoLegivel titulo="Views acumuladas nos 30 primeiros dias de cada vídeo recente, sobre a linha do normal do canal" pontos={pontos} tabela={tabela}>
        <div className="pc-chartw"><div className="pc-chart"><Grafico m={modelo} sel={i} /></div></div>
      </GraficoLegivel>
      {modelo.temNormal ? (
        <>
        <ol className="pc-nrow" aria-label={`Quantos ${nome} entram em cada ponto da linha do normal`}>
          {modelo.normal.map(p => (
            <li key={p.idadeDias} className={p.valor === null ? 'nm' : ''}>
              <span>dia {p.idadeDias}</span>
              <b className="num">{p.n === null ? '—' : ptn(p.n, 'vídeo', 'vídeos')}</b>
            </li>
          ))}
        </ol>
        <p className="pc-leg2">
          {modelo.temNormal ? <span className="pc-lg"><svg width="30" height="12" aria-hidden="true"><path className="pc-ln med" d="M2 6H20" /><circle className="pc-mk med" cx="25" cy="6" r="4" /></svg>o normal do canal</span> : null}
          {modelo.temCasaSemPonto ? <span className="pc-lg"><i className="nm-h" aria-hidden="true" />menos de 3 vídeos: sem ponto</span> : null}
        </p>
        </>
      ) : null}
      <ul className="pc-vl" aria-label="Vídeos recentes">
        {modelo.videos.map((v, k) => (
          <li key={v.id}>
            <button type="button" className={`pc-vb${k === i ? ' on' : ''}`} aria-pressed={k === i} onClick={() => setSel(k)}>
              <Swatch cls={CLASSE[v.faixa]} />
              <span className="pc-vt"><span className="pc-vn num">{v.ordem}</span> {v.titulo}<small>{v.legenda}</small></span>
              <span className="pc-vr">{v.razao ? <><b className="num">{v.razao}</b><small>{v.faixaNome}</small></> : modelo.temNormal ? <span className="obs-ch-nm">sem normal</span> : null}</span>
            </button>
          </li>
        ))}
      </ul>
      {rodape}
    </section>
  )
}

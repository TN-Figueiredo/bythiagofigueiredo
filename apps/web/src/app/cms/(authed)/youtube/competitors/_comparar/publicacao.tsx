'use client'
/**
 * "Publicação nos últimos 90 dias" (spec 18.7): uma faixa por canal, um traço por vídeo, no MESMO eixo de tempo (o do pacote: início, +30, +60 e
 * hoje), alto para longo, baixo para Short e de outra forma (tracejado, altura média) para o formato não confirmado: a cor do lado nunca é o
 * único sinal (chip com a letra, nome e a forma do traço). O bloco só existe quando algum dos dois tem datas; o lado sem datas troca a faixa pela frase
 * do pacote ("ainda sem vídeos sincronizados" em produção) e pela contagem de longos em 90 dias, sem faixa vazia. O desenho é `role="img"`
 * e o `aria-label` traz a contagem, o mais recente e todas as datas; a frase visível conta longos, Shorts e os de formato não confirmado.
 */
import type { CSSProperties } from 'react'
import { corVar } from './lados'
import type { CanalPack, CompararPack, Pub90Item } from './pack'
import type { ParView } from './par-model'

const KIND: Record<NonNullable<Pub90Item['fmt']> | 'nc', string> = { long: 'lg', short: 'sh', nc: 'nc' }

/** A posição de um traço no eixo, em % (0 = início dos 90 dias, 100 = hoje); a mesma conta nas duas faixas. */
const esquerda = (t: number, pack: CompararPack): number => {
  const total = pack.now - pack.inicio90
  return total > 0 ? Math.min(100, Math.max(0, ((t - pack.inicio90) / total) * 100)) : 0
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** O texto do desenho para o leitor de tela: quantos, o mais recente e todas as datas. */
function textoDaFaixa(c: CanalPack, pack: CompararPack): string {
  const itens = c.pub90
  if (!itens.length) return `${c.name}: nenhum vídeo nos últimos 90 dias (de ${pack.eixo[0]} a ${pack.eixo[3]}).`
  const maisRecente = itens.reduce((m, x) => (x.t >= m.t ? x : m), itens[0]!)
  return `${c.name}: ${plural(itens.length, 'vídeo', 'vídeos')} nos últimos 90 dias (de ${pack.eixo[0]} a ${pack.eixo[3]}); o mais recente em ${maisRecente.dataTexto}. Datas: ${itens.map(x => x.dataTexto).join(', ')}.`
}

function Faixa({ lado, canal, cor, pack }: { lado: 'A' | 'B'; canal: CanalPack; cor: ParView['cores'][number]; pack: CompararPack }) {
  const n = canal.numeros.longos90
  return (
    <div className="cp-pr" style={{ '--c': corVar(cor) } as CSSProperties}>
      <p className="cp-pl"><b><span className="lm">Lado {lado}</span>{canal.name}</b><span>{canal.pub90Nota}</span></p>
      {canal.comDatas ? (
        <div className="cp-strip" role="img" aria-label={textoDaFaixa(canal, pack)}>
          <i className="gl" style={{ left: `${(30 / 90) * 100}%` }} />
          <i className="gl" style={{ left: `${(60 / 90) * 100}%` }} />
          {canal.pub90.map((v, i) => <i key={i} className={`t ${KIND[v.fmt ?? 'nc']}`} style={{ left: `${esquerda(v.t, pack).toFixed(2)}%` }} />)}
        </div>
      ) : (
        // sem datas não há o que marcar no tempo: só a contagem, que pode ser "não medido" com o motivo
        <p className="cp-pv">Longos publicados em 90 dias: {n.x != null && n.texto ? n.texto : `não medido (${n.motivo ?? 'sem dado'})`}</p>
      )}
    </div>
  )
}

export function Publicacao({ par, pack }: { par: ParView; pack: CompararPack }) {
  if (!par.publicacao) return null // o rodapé da tela diz por quê
  return (
    <section className="cp-sec" aria-labelledby="cp-pub-t">
      <h2 id="cp-pub-t">Publicação nos últimos 90 dias</h2>
      <p className="cp-lead">Um traço por vídeo, no mesmo eixo para os dois canais. Traço alto: longo. Traço baixo: Short. Traço tracejado: formato não confirmado.</p>
      <Faixa lado="A" canal={par.a} cor={par.cores[0]} pack={pack} />
      <Faixa lado="B" canal={par.b} cor={par.cores[1]} pack={pack} />
      <div className="cp-pr cp-ax">
        <span className="cp-pl" aria-hidden="true" />
        <div className="cp-axis" aria-hidden="true">{pack.eixo.map((d, i) => <span key={i}>{d}</span>)}</div>
      </div>
    </section>
  )
}

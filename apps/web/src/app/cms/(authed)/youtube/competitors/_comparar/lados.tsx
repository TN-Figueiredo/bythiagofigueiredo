'use client'
/**
 * Os dois lados da comparação (spec 18.2): um cartão por lado (avatar, nome, selo "seu canal", nicho, inscritos), o seletor de cada lado,
 * o chip "Lado A"/"Lado B" e o "Abrir o canal …". A cor entra por `--c` (a do canal: o próprio é laranja em qualquer lado); a cor nunca é
 * o único sinal: o chip e o sublinhado de 3 px acompanham. O canal do outro lado vem `disabled` no seletor.
 */
import { useId, useMemo, type CSSProperties } from 'react'
import Link from 'next/link'
import { ChannelAvatar } from '../_chrome/channel-avatar'
import { Icon } from '../_chrome/icons'
import type { CanalPack, CompararPack } from './pack'
import type { CorLado } from './par-model'

export const corVar = (c: CorLado) => `var(--lado-${c})`

interface Grupo { label: string; canais: CanalPack[] }

/** "Seus canais", um grupo por nicho ("Concorrentes de Viagem, do maior ao menor") e "Concorrentes sem nicho"; a ordem do pacote já é a de inscritos. */
export function gruposDoSeletor(pack: CompararPack): Grupo[] {
  const por = new Map(pack.canais.map(c => [c.id, c] as const))
  const ordenados = pack.ordem.map(id => por.get(id)).filter((c): c is CanalPack => c != null)
  const out: Grupo[] = []
  const proprios = ordenados.filter(c => c.own)
  if (proprios.length) out.push({ label: 'Seus canais', canais: proprios })
  const nichos = new Map<string, CanalPack[]>()
  const semNicho: CanalPack[] = []
  for (const c of ordenados) {
    if (c.own) continue
    if (c.niche == null) { semNicho.push(c); continue }
    const l = nichos.get(c.niche); if (l) l.push(c); else nichos.set(c.niche, [c])
  }
  for (const l of nichos.values()) out.push({ label: `Concorrentes de ${l[0]!.nicheLabel ?? l[0]!.niche}, do maior ao menor`, canais: l })
  if (semNicho.length) out.push({ label: 'Concorrentes sem nicho', canais: semNicho })
  return out
}

function Lado({ lado, canal, outro, cor, grupos, onTrocar, titleId }: {
  lado: 'A' | 'B'; canal: CanalPack; outro: string; cor: CorLado; grupos: Grupo[]; onTrocar: (id: string) => void; titleId: string
}) {
  const selId = useId()
  const inscritos = canal.subsTexto ?? canal.numeros.inscritos.motivo
  return (
    <section className="cp-side" data-lado={lado} data-cor={cor} style={{ '--c': corVar(cor) } as CSSProperties} aria-labelledby={titleId}>
      <div className="cp-top">
        <label htmlFor={selId} className="cp-lado lm">Lado {lado}</label>
        <span className="sel">
          <select id={selId} value={canal.id} onChange={e => onTrocar(e.target.value)}>
            {grupos.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.canais.map(c => <option key={c.id} value={c.id} disabled={c.id === outro}>{c.name}{c.semVideos ? ' (sem vídeos)' : ''}</option>)}
              </optgroup>
            ))}
          </select>
          {Icon.chev()}
        </span>
      </div>
      <div className="cp-id">
        <ChannelAvatar src={canal.avatar} ini={canal.ini} color={canal.color} className="av" />
        <div className="cp-nm">
          <h2 id={titleId}>{canal.name}</h2>
          <p className="cp-m">
            {canal.own ? <span className="cp-seal">seu canal</span> : null}
            {canal.nicheLabel ? <span>{canal.nicheLabel}</span> : null}
            <span>{canal.subsTexto ? <><b className="num">{canal.subsTexto}</b> inscritos</> : inscritos}</span>
          </p>
        </div>
      </div>
      <p className="cp-open">
        {canal.href
          ? <Link className="lk" href={canal.href}>Abrir o canal {canal.name}</Link>
          : <span className="cp-semp">{canal.semVideos ? 'Sem vídeos: ainda sem página.' : 'Este canal ainda não tem página.'}</span>}
      </p>
    </section>
  )
}

export function Lados({ pack, a, b, cores, onTrocar }: {
  pack: CompararPack; a: CanalPack; b: CanalPack; cores: [CorLado, CorLado]; onTrocar: (lado: 'a' | 'b', id: string) => void
}) {
  const grupos = useMemo(() => gruposDoSeletor(pack), [pack])
  const ida = useId(), idb = useId()
  return (
    <div className="cp-sides">
      <Lado lado="A" canal={a} outro={b.id} cor={cores[0]} grupos={grupos} onTrocar={id => onTrocar('a', id)} titleId={ida} />
      <Lado lado="B" canal={b} outro={a.id} cor={cores[1]} grupos={grupos} onTrocar={id => onTrocar('b', id)} titleId={idb} />
    </div>
  )
}

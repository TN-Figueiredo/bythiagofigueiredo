'use client'
/**
 * Quem sobe e quem desce no nicho (mockup 17c). Nenhum texto é montado aqui: tudo vem de `direcaoDoNicho`. A leitura escolhida vai em `?leitura=` (só na
 * URL). A frase é um nó `aria-live` que NUNCA é recriado: trocar a leitura troca só o texto dele.
 */
import { useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { PastilhaAusencia } from '../_chrome/ausencia/pastilhas'
import { FRASE_FIXA_DA_FONTE } from '@/lib/youtube/observatorio/medidas-telas/frases'
import { LINHAS_POR_PAGINA, type DirecaoNichoView, type LeituraDaDirecao, type LeituraNoPainel, type LinhaDaDirecao } from './direcao-nicho-model'

const CLASSE = { sobe: 'up', desce: 'dn', estavel: 'eq' } as const
const GLIFO = { sobe: '▲', desce: '▼', estavel: '＝' } as const

function Info({ rotulo, linhas }: { rotulo: string; linhas: readonly string[] }) {
  return (
    <details className="q-info">
      <summary aria-label={rotulo}>ⓘ</summary>
      <ul>{linhas.map((t, i) => <li key={i} className={t === FRASE_FIXA_DA_FONTE ? 'nota' : undefined}>{t}</li>)}</ul>
    </details>
  )
}

function Simbolo({ simbolo, vazado }: { simbolo: keyof typeof CLASSE; vazado?: boolean }) {
  return <span className={'q-sy ' + CLASSE[simbolo] + (vazado ? ' vz' : '')} aria-hidden="true">{GLIFO[simbolo]}</span>
}

function Trilha({ l }: { l: LinhaDaDirecao }) {
  if (l.estado === 'medido' && l.simbolo && l.fracao !== null) {
    const ponta = l.fracao, esquerda = Math.min(ponta, 0.5), largura = Math.abs(ponta - 0.5)
    return (
      <span className="q-trk" role="img" aria-label={l.aria}>
        <span className="q-banda" /><span className="q-zero" />
        <span className={'q-bar ' + CLASSE[l.simbolo] + (largura === 0 ? ' q-bar-0' : '')} style={{ left: `${esquerda * 100}%`, width: `${largura * 100}%` }} />
        {l.fora ? <span className={'q-seta ' + (l.fora === 'acima' ? 'd' : 'e')} aria-hidden="true">{l.fora === 'acima' ? '›' : '‹'}</span> : null}
      </span>
    )
  }
  if (l.estado === 'nao_carregou') return <span className="q-trk q-erro-trk" role="img" aria-label={l.aria}><span className="q-nmw q-nmw-erro" /></span>
  return (
    <span className="q-trk" role="img" aria-label={l.aria}>
      <span className="q-nmw">{l.progresso ? <span className="q-prog" style={{ width: `${l.progresso * 100}%` }} /> : null}</span>
    </span>
  )
}

function Painel({ id, itens }: { id: string; itens: readonly LeituraNoPainel[] }) {
  return (
    <ul className="q-3" id={id}>
      {itens.map(p => (
        <li key={p.key} className={p.principal ? 'pr' : undefined} data-leitura={p.key}>
          <span className="q-ln">{p.nome} <small>{p.sub}</small>{p.principal ? <span className="q-pr">a que ordena a régua</span> : null}</span>
          <span className="q-lv">
            {p.simbolo && p.texto ? <><Simbolo simbolo={p.simbolo} vazado={!p.principal} /><b>{p.texto}</b></> : <span className="q-mot">{p.estado === 'nao_carregou' ? <PastilhaAusencia estado="falhou" /> : 'não medido'}</span>}
          </span>
          <span className="q-lb">{p.motivo && !p.texto ? <>{p.motivo}{p.base.length ? ' · ' : ''}</> : null}{p.base.join(' · ')}</span>
        </li>
      ))}
    </ul>
  )
}

function Linha({ l }: { l: LinhaDaDirecao }) {
  const [aberta, setAberta] = useState(false)
  const painel = `q-3-${l.id}`
  const medido = l.estado === 'medido' && l.simbolo
  return (
    <li className={'q-li' + (medido ? '' : ' q-nao')} data-canal={l.id} data-estado={l.estado}>
      <div className="q-main">
        <span className={'q-pos' + (medido ? '' : ' nada')}>
          {medido ? <><b>{l.posicao}</b>{l.empate ? <small>empate</small> : null}</> : <><span aria-hidden="true">–</span><span className="q-mt">sem posição</span></>}
        </span>
        <span className="q-nome"><Link href={l.href}>{l.name}</Link></span>
        <span className="q-sub">
          {l.base.map((b, i) => <span key={i} className={i ? 'q-b2' : 'q-b1'}>{b}</span>)}
          {l.unico ? <span className="q-b2">{l.unico}</span> : null}
        </span>
        <span className="q-reg"><Trilha l={l} /></span>
        <span className="q-dir">
          {medido && l.simbolo ? (
            <><Simbolo simbolo={l.simbolo} /><span className="q-dt"><b>{l.simbolo === 'sobe' ? 'subindo' : l.simbolo === 'desce' ? 'descendo' : 'estável'}</b><span className="num">{l.texto}</span></span></>
          ) : (
            <><PastilhaAusencia estado={l.estado === 'nao_carregou' ? 'falhou' : 'nao_medido'} />{l.motivo && l.estado !== 'nao_carregou' ? <span className="q-mot" title={l.motivoLongo ?? undefined}>{l.motivo}</span> : null}</>
          )}
        </span>
        <button type="button" className="q-mais" aria-expanded={aberta} aria-controls={painel} onClick={() => setAberta(a => !a)}>
          <span className="q-mt">As 3 leituras</span>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6l5 5 5-5" /></svg>
        </button>
      </div>
      {aberta ? <div className="q-det"><Painel id={painel} itens={l.leituras} /></div> : null}
    </li>
  )
}

export function DirecaoNicho({ v }: { v: DirecaoNichoView }) {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams()
  const [mostrar, setMostrar] = useState(LINHAS_POR_PAGINA)
  // trocar a leitura vai ao servidor (~2 s no dev): o botão marca na hora e a seção diz que está atualizando (Gio M-5)
  const [pendente, comecar] = useTransition()
  const [leituraOt, marcar] = useOptimistic(v.leitura)
  const escolher = (k: LeituraDaDirecao) => {
    const q = new URLSearchParams(search?.toString() ?? '')
    if (k === 'a') q.delete('leitura'); else q.set('leitura', k)
    const s = q.toString()
    comecar(() => {
      marcar(k)
      router.replace((pathname ?? '') + (s ? '?' + s : ''), { scroll: false })
    })
  }
  const semInfo = v.estado === 'sem-dado' || v.estado === 'erro'
  const visiveis = v.linhas.slice(0, mostrar), resto = v.linhas.length - visiveis.length
  return (
    <section className="q-cartao" id="direcaoCard" aria-labelledby="direcaoH" data-estado={v.estado} aria-busy={pendente || undefined} data-pendente={pendente ? '' : undefined}>
      <div className="q-ch">
        <h2 id="direcaoH">{v.titulo}</h2>
        {semInfo ? null : <Info rotulo="Como ler esta régua" linhas={v.info.regua} />}
        {semInfo ? null : <span className="q-meta">{v.meta}</span>}
      </div>
      {v.semDado ? (
        <div className="q-vazio"><div><b>{v.semDado.titulo}</b><span>{v.semDado.texto}</span></div></div>
      ) : v.erro ? (
        <div className="q-erro" role="alert">
          <div><b>{v.erro.titulo}</b><span>{v.erro.texto}</span></div>
          <button type="button" className="btn" onClick={() => router.refresh()}>Tentar de novo</button>
        </div>
      ) : (
        <>
          <p className="q-fr" aria-live="polite"><span data-frase="">{v.frase}</span></p>
          {v.sugestao ? <button type="button" className="q-lk" data-sugestao={v.sugestao.key} onClick={() => escolher(v.sugestao!.key)}>{v.sugestao.texto}</button> : null}
          {v.barra ? (
            <ul className="q-cont" role="img" aria-label={v.barra.aria}>
              {v.barra.segmentos.filter(s => s.n > 0).map(s => (
                <li key={s.tipo} className={s.tipo === 'sobe' ? 'up' : s.tipo === 'desce' ? 'dn' : s.tipo === 'estavel' ? 'eq' : s.tipo === 'nao_carregou' ? 'er' : 'nm'} style={{ flexGrow: s.n }}><span className="q-ct">{s.texto}</span></li>
              ))}
            </ul>
          ) : null}
          <div className="q-selw">
            <div className="q-sel" role="group" aria-label="Leitura da direção">
              {v.botoes.map(b => (
                <button type="button" key={b.key} className={'q-op' + (b.nenhum ? ' q-op-nenhum' : '')} data-leitura={b.key} aria-pressed={b.key === leituraOt} aria-label={`${b.aria}, ${b.janela}, ${b.contagem}`} onClick={() => escolher(b.key)}>
                  <span className="q-on"><span className="q-onl">{b.nome}</span><span className="q-onc">{b.curto}</span></span>
                  <small>{b.janela}</small>
                  <span className="q-oc">{b.contagem}</span>
                </button>
              ))}
            </div>
            <div className="q-cap">{v.legenda}<Info rotulo="As três leituras da direção" linhas={v.info.leituras} /></div>
            {v.avisos.map(a => <p key={a} className="q-aviso" data-aviso="contagem">{a}</p>)}
          </div>
          {v.eixo ? (
            <div className="q-eixo" aria-hidden="true">
              <div className="q-ea">
                <span className="q-ep"><span className="e1">descendo</span><span className="e2">estável</span><span className="e3">subindo</span></span>
                <span className="q-en"><span>−60%</span><span style={{ left: '41.667%' }}>−10%</span><span style={{ left: '58.333%' }}>+10%</span><span>+60%</span></span>
              </div>
            </div>
          ) : null}
          <ol className="q-lista">{visiveis.map(l => <Linha key={l.id} l={l} />)}</ol>
          {resto > 0 ? <button type="button" className="q-lk" data-mais="" onClick={() => setMostrar(m => m + LINHAS_POR_PAGINA)}>Mostrar mais {resto}</button> : null}
          {v.seuCanal.map(s => (
            <div key={s.nome} className="q-seu" data-seu-canal="">
              <span className="q-fora">{s.texto}</span>
              <Info rotulo="Por que o seu canal não aparece" linhas={v.info.seuCanal} />
            </div>
          ))}
        </>
      )}
    </section>
  )
}

'use client'

// Placar do teste A/B (S8-F3 T5). Desenho e cópia: mockup M4 r3.1 aprovado em 24/10.
// Só contagens do YouTube: sem líder, sem lift, sem intervalo, sem ordem por CTR (voltam na F4).
// Nulo quer dizer não medido: nunca vira 0 nem % aqui.
import React, { useId, useState } from 'react'
import { PRAZO_FECHAMENTO_DIAS, type DiaDaFaixa, type Placar, type PlacarVariante } from '@/lib/youtube/ab-gravacao/placar'
import { addDays, dayPt } from '@/lib/youtube/coleta/day-pt'
import { andamentoDoDia, rotuloDoDiaExtenso } from '@/lib/youtube/ab-rotulo-dia'
import type { AbTestStatus, TestType, FullChartVariant, VariantDbEntry, VariantThumb } from '@/lib/youtube/ab-types'
import { brDec } from '@/lib/youtube/format'
import { InfoDica } from '../../_components/info-dica'
import { NAO_MEDIDO } from './ab-constants'
import { casoDoPlacar, dataCurta, dataEHora, faixaDoPlacar, fraseDoPlacar, n, ordenarPorRotulo } from './placar-texto'
import './caminho-nativo.css'
import './placar-do-teste.css'

export interface PlacarDoTesteProps {
  placar: Placar | null
  faixaDias: DiaDaFaixa[]
  variants: FullChartVariant[]
  variantDb: VariantDbEntry[]
  thumbs: VariantThumb[]
  videoTitle: string
  status: AbTestStatus
  andamento?: { dayOf: number; total: number }
  titulo?: string
  /** Tipo do teste: só miniatura e combo desenham quadro de miniatura. Ausente = como antes. */
  testType?: TestType
  /** Início do teste (ISO); sem dia gravado, o texto do prazo sai dele. */
  inicio?: string | null
  /** Tela v2: o resumo e o andamento vêm antes do placar (blocos-v2), então a frase `pm4-sum` não é desenhada aqui. */
  modoV2?: boolean
  /** Letra da versão que ficou no ar (concluído com `noAr`): a linha dela ganha o selo "No ar". */
  noArLetra?: string | null
}

const Svg = ({ children, size = 14 }: { children: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" focusable="false">{children}</svg>
)
const IcRelogio = () => (
  <Svg><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M7 4v3.2l2 1.3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></Svg>
)
const IcAviso = () => (
  <Svg><path d="M7 1.5l6 10.5H1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M7 5.5v3M7 10.2v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></Svg>
)
const IcFora = () => (
  <Svg><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M3.2 10.8l7.6-7.6" stroke="currentColor" strokeWidth="1.5" /></Svg>
)
const IcVelho = () => (
  <Svg><path d="M2 7h10M8 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></Svg>
)
const IcChevron = () => (
  <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

type CodigoDia = 'm' | 'z' | 'a' | 'g' | 'n' | 'f'
const NOME_DIA: Record<CodigoDia, string> = {
  m: 'medido', z: 'zero medido', a: 'o YouTube não listou o dia', g: 'aguardando o YouTube', n: 'não medido', f: 'fora do placar',
}
function codigoDoDia(d: DiaDaFaixa): CodigoDia {
  switch (d.estado) {
    case 'fora_do_placar': return 'f'
    case 'zero_medido': return 'z'
    case 'ausente_no_relatorio': return 'a'
    case 'aguardando': return 'g'
    case 'nao_medido': return 'n'
    case 'medido': return d.impressoes === 0 ? 'z' : 'm'
  }
}
function simbolo(c: CodigoDia): React.ReactNode {
  switch (c) {
    case 'm': return '■'
    case 'z': return '0'
    case 'a': return '0*'
    case 'g': return <IcRelogio />
    case 'n': return '∅'
    case 'f': return <IcFora />
  }
}

function Expandido({ v }: { v: PlacarVariante }) {
  if (v.impressoes === null) return <>Sem dia fechado ainda: nada a mostrar.</>
  if (v.cliques === null) {
    return <><b>CTR: {NAO_MEDIDO}.</b> O YouTube trouxe {n(v.impressoes)} impressões nos dias medidos, mas não o CTR. Os cliques não podem ser estimados e não são mostrados como 0.</>
  }
  if (v.impressoes_com_ctr === 0) {
    return <><b>Cliques: —.</b> O YouTube informou 0 impressões nos dias medidos; sem impressões não há cliques a mostrar.</>
  }
  const com = v.impressoes_com_ctr ?? 0
  return (
    <>
      <b>{n(v.cliques)} {v.cliques === 1 ? 'clique' : 'cliques'} em {n(com)} impressões</b>
      {v.ctr !== null && <> (CTR ≈ {brDec(v.ctr * 100, 1)}%, dos dias válidos).</>}
      {(v.dias_zero > 0 || v.dias_ausentes > 0) && (
        <ul>
          {v.dias_zero > 0 && <li>{v.dias_zero} {v.dias_zero === 1 ? 'dia' : 'dias'} com 0 impressões informadas.</li>}
          {v.dias_ausentes > 0 && <li>{v.dias_ausentes} {v.dias_ausentes === 1 ? 'dia' : 'dias'} que o YouTube não listou (0*).</li>}
        </ul>
      )}
    </>
  )
}

function Apoio({ v }: { v: PlacarVariante | undefined }) {
  if (!v || (v.dias === 0)) return null
  return (
    <>
      <span>{v.dias_validos} {v.dias_validos === 1 ? 'válido' : 'válidos'}</span>
      {v.dias_aguardando > 0 && <span>{v.dias_aguardando} aguardando <IcRelogio /></span>}
      {v.dias_nao_medidos > 0 && <span>{v.dias_nao_medidos} {NAO_MEDIDO} ∅</span>}
    </>
  )
}

function rotulosDe(placar: Placar, db: readonly VariantDbEntry[]): Record<string, string> {
  const r: Record<string, string> = {}
  for (const v of placar.variantes) { const l = db.find(d => d.id === v.variant_id)?.label; if (l) r[v.variant_id] = l }
  return r
}

/** Sem dia gravado: o prazo vem do placar; sem ele, do dia do Pacífico do início + o prazo de fechamento (a mesma conta do placar). */
export function prazoDoPrimeiroDia(proximoFechamento: string | null, inicio: string | null): string {
  if (proximoFechamento) return `O primeiro dia fecha até ${dataCurta(proximoFechamento)}.`
  if (inicio) {
    const t = new Date(inicio)
    if (Number.isFinite(t.getTime())) return `O primeiro dia fecha até ${dataCurta(addDays(dayPt(t), PRAZO_FECHAMENTO_DIAS))}.`
  }
  return `O primeiro dia fecha até ${PRAZO_FECHAMENTO_DIAS} dias depois do início.`
}

export function PlacarDoTeste({ placar, faixaDias = [], variants, variantDb = [], thumbs, videoTitle, status, andamento, titulo = 'Placar por variante', modoV2 = false, testType, inicio = null, noArLetra = null }: PlacarDoTesteProps) {
  const [aberta, setAberta] = useState<string | null>(null)
  const idBase = useId()
  const ordenadas = ordenarPorRotulo(variants)
  const comMiniatura = testType === undefined || testType === 'thumbnail' || testType === 'combo'
  const idDe = (label: string) => variantDb.find(d => d.label === label)?.id
  const letraDe = (id: string | null) => variantDb.find(d => d.id === id)?.label ?? null

  const frase = placar
    ? fraseDoPlacar(placar, status, faixaDias, andamento, rotulosDe(placar, variantDb))
    : { principal: 'Ainda não há dados do YouTube para este teste.', apoio: '' }
  const faixa = placar ? faixaDoPlacar(placar, status) : null
  const caso = placar ? casoDoPlacar(placar) : 'sem_dia_fechado'

  const ultimoDia = faixaDias.length > 0 ? dataCurta(faixaDias.reduce((m, d) => (d.day_pt > m ? d.day_pt : m), faixaDias[0]!.day_pt)) : null
  const parado = placar !== null && (placar.atrasado || placar.desatualizado) && placar.atualizado_em !== null
  const upd = (() => {
    if (!placar || !placar.atualizado_em) return <span className="upd">Sem leitura ainda</span>
    const { data, hora } = dataEHora(placar.atualizado_em)
    // Atrasado: a mesma data da frase (último dia gravado); nunca duas datas diferentes na tela (Gio A2).
    if (placar.atrasado && ultimoDia !== null) return <span className="upd warn"><IcAviso />Dados parados em {ultimoDia}</span>
    return parado
      ? <span className="upd warn"><IcAviso />Dados parados desde {data} às {hora}</span>
      : <span className="upd">Atualizado em {data} às {hora}</span>
  })()

  const descartados = placar ? placar.dias_descartados + placar.dias_variante_desconhecida : 0
  const foraDoCtr = placar ? placar.variantes.reduce((s, v) => s + v.dias_fora_do_ctr, 0) : 0

  const cont: Partial<Record<CodigoDia, number>> = {}
  const celulas = faixaDias.map(d => ({ d, c: codigoDoDia(d) }))
  // Hoje, sem dia fechado: a faixa mostra o dia de hoje pendente (célula tracejada ◷), como no mockup.
  const hojePendente = celulas.length === 0 && placar !== null && faixa === 'sem_dia_fechado'
  for (const { c } of celulas) cont[c] = (cont[c] ?? 0) + 1
  const resumo = hojePendente ? '1 dia: 1 aguardando o YouTube' : `${faixaDias.length} ${faixaDias.length === 1 ? 'dia' : 'dias'}: ${(Object.keys(cont) as CodigoDia[]).map(k => `${cont[k]} ${NOME_DIA[k]}`).join(', ')}`

  return (
    <div className="cn-raiz pm4" data-testid="placar-do-teste">
      <div className="pm4-in">
        {placar?.regra === 'v1' && (
          <div className="pm4-selos"><span className="pm4-selo"><IcVelho />Regra antiga: encerra por duração</span></div>
        )}
        {!modoV2 && (
          <p className="pm4-sum" data-caso={caso}>
            {frase.principal}
            {frase.apoio !== '' && <small>{frase.apoio}</small>}
          </p>
        )}

        {faixa === 'atrasado' && (
          <div className="pm4-band warn" role="status">
            <span className="ic"><IcAviso /></span>
            <div>
              <h3>Dados do YouTube fora de hora</h3>
              <p>{placar && placar.dias_total > 0 && ultimoDia
                ? `O último dia gravado é ${ultimoDia}. Os números abaixo não incluem os dias mais recentes. Não há nada a fazer agora.`
                : 'Ainda não há nenhum dia gravado. Não há nada a fazer agora.'}</p>
            </div>
          </div>
        )}
        {faixa === 'sem_dia_fechado' && (
          <div className="pm4-band yt" role="status">
            <span className="ic"><IcRelogio /></span>
            <div>
              <h3>Sem dia fechado</h3>
              <p>{prazoDoPrimeiroDia(placar?.proximo_fechamento ?? null, inicio)}</p>
            </div>
          </div>
        )}

        <div className="pm4-sec">
          <div className="pm4-sh">
            <h3 style={{ margin: 0, font: 'inherit' }}>{titulo}</h3>
            <InfoDica rotulo="Como ler o placar" titulo="Como ler este placar" paragrafos={['São contagens do YouTube dos dias fechados. Cliques ≈ é impressões × CTR de cada dia, somado (estimado, exato até 9.999 impressões por dia). O CTR é cliques ÷ impressões dos dias válidos e só aparece ao abrir a variante. Contagens do YouTube; sem comparação entre variantes por enquanto. “Dados do YouTube” é a cópia diária dos números do YouTube.']} />
            {upd}
          </div>

          <div className="pm4-card">
            <div className="pm4-vhead" aria-hidden="true"><span>Variante</span><span>Impressões</span><span>Cliques ≈</span><span /></div>
            {ordenadas.length === 0 && <p className="dash" style={{ padding: 'var(--s4) 0' }}>Nenhuma variante cadastrada.</p>}
            {ordenadas.map(variant => {
              const id = idDe(variant.label)
              const v = placar?.variantes.find(x => x.variant_id === id)
              const thumb = thumbs.find(t => t.label === variant.label)
              const tituloLinha = thumb?.titleText || videoTitle || `Variante ${variant.label}`
              const podeAbrir = v !== undefined && v.impressoes !== null
              const painel = `${idBase}-x-${variant.label}`
              const aberto = aberta === variant.label && podeAbrir
              return (
                <div className="pm4-vrow" key={variant.label}>
                  <div className="pm4-vr" role="group" aria-label={`Variante ${variant.label}`}>
                    <div className="pm4-vh">
                      <span className={`pm4-chip pm4-c${variant.label}`}>{variant.label}</span>
                      {comMiniatura && (thumb?.thumbUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img className="pm4-th" src={thumb.thumbUrl} alt={`Miniatura ${variant.label}`} referrerPolicy="no-referrer" />
                        : <span className="pm4-th pm4-th-vazia">Sem miniatura</span>)}
                      <div className="pm4-vt">
                        <b title={tituloLinha}>{tituloLinha}{thumb?.isOriginal && <span className="dash" style={{ fontWeight: 400 }}> · original</span>}{noArLetra === variant.label && <span className="pm4-noar">No ar</span>}</b>
                        <div className="ap"><Apoio v={v} /></div>
                      </div>
                    </div>
                    <CelulasDaLinha v={v} />
                    {podeAbrir ? (
                      <button type="button" className="pm4-chev" aria-expanded={aberto} aria-controls={painel} aria-label={`Detalhes da variante ${variant.label}`} onClick={() => setAberta(a => (a === variant.label ? null : variant.label))}>
                        <IcChevron />
                      </button>
                    ) : <span className="pm4-chev" aria-hidden="true" />}
                  </div>
                  {podeAbrir && v && (
                    <div className="pm4-vx" id={painel} hidden={!aberto}><Expandido v={v} /></div>
                  )}
                </div>
              )
            })}
          </div>

          {(descartados > 0 || foraDoCtr > 0) && (
            <div className="pm4-apoio">
              {descartados > 0 && (
                <span>
                  <IcFora /> {descartados} {descartados === 1 ? 'dia' : 'dias'} de troca ou dia parcial, fora do placar
                  <InfoDica rotulo="Dia fora do placar" titulo="Dia fora do placar" paragrafos={['Dia de troca de variante ou dia parcial. Eles não entram nas contagens.']} />
                </span>
              )}
              {foraDoCtr > 0 && (
                <span>
                  {foraDoCtr} {foraDoCtr === 1 ? 'dia' : 'dias'} com impressões e sem CTR
                  <InfoDica rotulo="Impressões sem CTR" titulo="Impressões sem CTR" paragrafos={['As impressões desses dias contam no total, mas o CTR não as usa; por isso não viram cliques.']} />
                </span>
              )}
            </div>
          )}

          {(celulas.length > 0 || hojePendente) && (
            <div className="pm4-dias">
              <div className="pm4-sh">
                Dias do teste
                <InfoDica rotulo="Como ler os dias do teste" titulo="Faixa de dias" paragrafos={['Um quadrado por dia, com a letra da variante. 0* quer dizer que o YouTube não listou o dia: não é zero medido nem falha da tela.']} />
              </div>
              <div className="pm4-strip" role="list" aria-label={resumo}>
                {celulas.map(({ d, c }, i) => {
                  const letra = letraDe(d.variante)
                  return (
                    <div key={`${d.day_pt}-${d.variante ?? 'x'}-${i}`} className={`pm4-dc ${c}`} role="listitem" aria-label={`${dataCurta(d.day_pt)}, ${letra ? `variante ${letra}` : 'sem variante'}, ${NOME_DIA[c]}`} title={`${dataCurta(d.day_pt)}: ${NOME_DIA[c]}`}>
                      <span className={`pm4-l${letra ?? 'x'}`}>{letra ?? '–'}</span>
                      <i>{simbolo(c)}</i>
                    </div>
                  )
                })}
                {hojePendente && (
                  <div className="pm4-dc g" role="listitem" aria-label="hoje, sem variante, aguardando o YouTube" title="hoje: aguardando o YouTube">
                    <span className="pm4-lx">–</span>
                    <i><IcRelogio /></i>
                  </div>
                )}
              </div>
              <div className="pm4-leg">
                <span>■ medido</span><span>0 zero</span><span>0* o YouTube não listou o dia</span>
                <span><IcRelogio /> aguardando o YouTube</span><span>∅ {NAO_MEDIDO}</span><span><IcFora /> fora do placar</span>
              </div>
            </div>
          )}
        </div>
      {andamento && (status === 'active' || status === 'paused') && placar?.iniciado !== false && (() => {
        const { faltam: f, ultimo } = andamentoDoDia(andamento.dayOf, andamento.total)
        const pct = andamento.total > 0 ? Math.min(100, Math.round((andamento.dayOf / andamento.total) * 100)) : 0
        return (
          <div className="pm4-sec" data-section="andamento">
            <div className="pm4-sh">
              Andamento do teste
              <InfoDica rotulo="Como ler o andamento" titulo="Andamento" paragrafos={[`A barra mostra os dias já passados. ${placar?.regra === 'v1' ? 'Este teste termina por duração.' : 'O teste termina quando chega ao último dia planejado.'} Não indica quem está na frente.`]} />
            </div>
            <div className="pm4-ruler">
              <div className="pm4-rbar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
              <div className="pm4-mark"><span>{rotuloDoDiaExtenso(andamento.dayOf, andamento.total, { minusculo: true })}</span><span>{status === 'paused' ? 'pausado' : ultimo ? 'último dia' : `faltam ${f} ${f === 1 ? 'dia' : 'dias'}`}</span></div>
            </div>
          </div>
        )
      })()}
      </div>
    </div>
  )
}

function CelulasDaLinha({ v }: { v: PlacarVariante | undefined }) {
  return (
    <>
      <div className="pm4-vi"><span className="lb">Impressões</span><CelulaImp v={v} /></div>
      <div className="pm4-vc"><span className="lb">Cliques ≈</span><CelulaCli v={v} /></div>
    </>
  )
}

function CelulaImp({ v }: { v: PlacarVariante | undefined }) {
  if (!v || v.impressoes === null) return <span className="dash">—</span>
  return <span className="num"><span className="big">{n(v.impressoes)}</span></span>
}
function CelulaCli({ v }: { v: PlacarVariante | undefined }) {
  if (!v || v.impressoes === null) return <span className="dash">—</span>
  if (v.cliques === null) return <span className="pm4-nm">{NAO_MEDIDO}</span>
  if (v.impressoes_com_ctr === 0) return <span className="dash" title="sem impressões, sem cliques">—</span>
  return <span className="num"><span className="big">{n(v.cliques)}</span> <span className="de">de {n(v.impressoes_com_ctr ?? 0)}</span></span>
}

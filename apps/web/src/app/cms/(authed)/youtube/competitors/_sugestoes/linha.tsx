'use client'
// Uma linha da lista (F3 T5): sempre um <li class="sg-row"> com a mesma chave (id) em todos os estados; a confirmação ocupa o mesmo <li>.
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import CmsLink from '../../../_shared/cms-link'
import type { AcaoDaLinha, DesfechoDaLinha, TipoDeErro } from './estado-da-lista'
import { Ic } from './icones'
import { ReguaMult } from './regua-mult'
import type { MotivoDaTela } from './tipos'
import { dataSP, diaSP, type LinhaDaVista } from './view-model'

const MLAB: Record<MotivoDaTela, string> = { lugar_errado: 'lugar errado', nao_interessa: 'não me interessa', nao_e_parecido: 'não é parecido', ja_fiz: 'já fiz' }

export function Confirmacao(p: { id: string; desfecho: DesfechoDaLinha; motivo: MotivoDaTela | null; volta?: string | null }) {
  if (p.desfecho === 'adiada') {
    return (
      <li className="sg-row sg-done sg-adi" role="status" data-row={p.id} tabIndex={-1}>
        {Ic.wait(14)}<span><b>Adiada.</b>{p.volta ? ` Volta para esta lista em ${diaSP(p.volta)}.` : ' Volta para esta lista em 7 dias.'}</span>
      </li>
    )
  }
  const texto = p.desfecho === 'ja-saiu'
    ? <b>Esta sugestão já saiu da lista.</b>
    : p.motivo === 'ja_fiz' ? <><b>Marcada como já feita.</b> Não volta nos próximos 30 dias.</>
      : <><b>{`Dispensada: ${p.motivo ? MLAB[p.motivo] : 'motivo registrado'}.`}</b> Não volta nos próximos 30 dias.</>
  return <li className="sg-row sg-done" role="status" data-row={p.id} tabIndex={-1}>{Ic.ok()}<span>{texto}</span></li>
}

export interface PropsDaLinha {
  linha: LinhaDaVista
  podeDispensar: boolean
  aberta: boolean
  info: boolean
  expandida: boolean
  /** Motivo em gravação nesta linha (a chamada em voo). */
  salvando: AcaoDaLinha | null
  /** Alguma chamada em voo na lista (trava toque duplo em qualquer linha). */
  ocupada: boolean
  erro: { tipo: TipoDeErro; motivo: AcaoDaLinha; expiraEm?: string } | null
  onDispensar(e: MouseEvent<HTMLButtonElement>): void
  onMotivo(motivo: MotivoDaTela): void
  /** F3b: "Adiar 7 dias". */
  onAdiar(): void
  onCancelar(): void
  onInfo(): void
  onExpandir(): void
}

/** Põe o primeiro número (com × ou "vídeo(s)") em <b>; só antes do "(cálculo de ...)", para não pegar a hora. */
function ComNumero(p: { texto: string }) {
  const corte = p.texto.indexOf(' (cálculo')
  const fim = corte === -1 ? p.texto.length : corte
  const m = /\d+(?:,\d+)?(?:×| vídeos?)?/.exec(p.texto.slice(0, fim))
  if (!m) return <>{p.texto}</>
  return <>{p.texto.slice(0, m.index)}<b>{m[0]}</b>{p.texto.slice(m.index + m[0].length)}</>
}

function Seus(p: { l: LinhaDaVista }) {
  return <>{p.l.seus.naoMedido ? <><span className="sg-nm">não medido</span>{' '}{p.l.seus.texto}</> : <ComNumero texto={p.l.seus.texto} />}</>
}

export function Linha(p: PropsDaLinha) {
  const { linha: l } = p
  const [semFoto, setSemFoto] = useState(false)
  // O `error` da imagem pode disparar antes da hidratação (o onError não vê): confere ao montar.
  const img = useRef<HTMLImageElement | null>(null)
  useEffect(() => { const el = img.current; if (el && el.complete && el.naturalWidth === 0) setSemFoto(true) }, [])
  const m = l.puxadoPor
  const rotuloDoErro = p.erro ? (p.erro.motivo === 'adiar' ? 'Adiar 7 dias' : (l.motivos.find((x) => x.valor === p.erro!.motivo)?.rotulo ?? '')) : ''
  // Vence em até 7 dias: sem botão, a frase. A corrida (a lista velha ainda oferecia o botão) cai no mesmo desenho depois do erro.
  const naoAdia = l.naoAdia ?? (p.erro?.tipo === 'vence-antes' && p.erro.expiraEm ? { dia: diaSP(p.erro.expiraEm), data: dataSP(p.erro.expiraEm) } : null)
  const seloAdiada = l.adiadaEm ? <>{Ic.wait(14)}{`Adiada por você em ${l.adiadaEm}`}</> : null
  const semThumb = m === null
  const aoIniciar = p.salvando !== null || p.ocupada
  return (
    <li className={`sg-row${semThumb ? ' sg-noth' : ''}${p.expandida ? ' sg-open' : ''}`} data-row={l.id} tabIndex={-1} onKeyDown={(e) => { if (e.key === 'Escape' && p.aberta && !aoIniciar) { e.stopPropagation(); p.onCancelar() } }}>
      {!semThumb && (
        <div className="sg-thw">
          {m.miniatura === null || semFoto
            ? <div className="sg-th sg-fail">Miniatura indisponível</div>
            // eslint-disable-next-line @next/next/no-img-element -- miniatura de terceiro, sem otimizador (decisão do plano)
            : <img ref={img} className="sg-th" src={m.miniatura} width={96} height={54} loading="lazy" decoding="async" referrerPolicy="no-referrer" alt="" onError={() => setSemFoto(true)} />}
        </div>
      )}
      <div>
        <div className="sg-top">
          <span className="sg-chip">{l.chip.simbolo === 'alfinete' ? Ic.pin() : Ic.flame()}{l.chip.rotulo}</span>
          {seloAdiada && <span className="sg-selo sg-mute sg-ven1">{seloAdiada}</span>}
          {l.venceEm && <span className="sg-selo sg-mute sg-ven1">{Ic.late()}{l.venceEm}</span>}
          {l.regua && <span className="sg-vm">{l.regua.valor.toFixed(1).replace('.', ',')}×</span>}
        </div>
        <h4 className="sg-tg" onClick={p.onExpandir}>{l.titulo}</h4>
        {m && <p className="sg-pux"><span className="sg-pl">Puxado por</span><q>{m.titulo}</q>{m.canal && <span className="sg-pc">{`, de ${m.canal}`}</span>}</p>}
        {l.regua && (
          <div className="sg-rg">
            <ReguaMult valor={l.regua.valor} acimaDe20={l.regua.acimaDe20} limiar={l.regua.limiar} />
            <button type="button" className="sg-ib" aria-expanded={p.info} aria-label="Como esta sugestão foi calculada" onClick={p.onInfo}>i</button>
            <span className="sg-v"><ComNumero texto={l.regua.texto} /></span>
          </div>
        )}
        {(seloAdiada || l.venceEm) && (
          <p className="sg-venm">
            {seloAdiada && <span className="sg-selo sg-mute">{seloAdiada}</span>}
            {l.venceEm && <span className="sg-selo sg-mute">{Ic.late()}{l.venceEm}</span>}
          </p>
        )}
        <p className="sg-alv sg-desk">{Ic.vid()}<span><Seus l={l} /></span></p>
        <div className="sg-vsr">
          <p className="sg-vs">{Ic.vid()}<span><Seus l={l} /></span></p>
          <button type="button" className="sg-det" aria-expanded={p.expandida} onClick={p.onExpandir}>Detalhes{Ic.chev()}</button>
        </div>
      </div>
      <div className="sg-ra">
        <CmsLink href={l.primario.href} className={`sg-btn ${l.primario.cheio ? 'sg-pri' : 'sg-ol'}`}>
          {l.primario.texto.startsWith('Abrir o vídeo do concorrente') && Ic.ext()}{l.primario.texto}
        </CmsLink>
        {p.podeDispensar && (
          <>
            <button type="button" className="sg-btn sg-ghost sg-dis" aria-expanded={p.aberta} onClick={p.onDispensar}>Dispensar ou adiar</button>
            <button type="button" className="sg-btn sg-ghost sg-more-btn" aria-expanded={p.aberta} aria-label="Dispensar ou adiar" onClick={p.onDispensar}>{Ic.dots()}</button>
          </>
        )}
      </div>
      {p.info && (
        <div className="sg-info">
          <h5>Como esta sugestão foi calculada</h5>
          <dl>
            <dt>Vídeos que puxaram</dt><dd>{l.info.mults}</dd>
            <dt>Medida</dt><dd>{l.info.medida}</dd>
            <dt>Para virar sugestão</dt><dd>{l.info.regra}</dd>
            <dt>Surgiu</dt><dd>{`${l.info.surgiu}; vence em ${l.info.vence}`}</dd>
            <dt>Leitura</dt><dd>Pode ajudar. É associação, não causa.</dd>
          </dl>
        </div>
      )}
      {p.aberta && p.podeDispensar && (
        <div className="sg-dsp" role="group" aria-label="Dispensar ou adiar">
          <p>Por que dispensar?</p>
          {l.motivos.filter((x) => x.grupo === 'motivo').map((x) => <BotaoMotivo key={x.valor} {...p} valor={x.valor} rotulo={x.rotulo} />)}
          <span className="sg-sep" aria-hidden="true" />
          {l.motivos.filter((x) => x.grupo === 'feito').map((x) => <BotaoMotivo key={x.valor} {...p} valor={x.valor} rotulo={x.rotulo} />)}
          <span className={`sg-sep sg-sep2${naoAdia ? ' sg-sep-v' : ''}`} aria-hidden="true" />
          {naoAdia
            ? <p className="sg-vence">{Ic.late()}<span>{`Vence em ${naoAdia.dia}: não dá para adiar 7 dias.`}</span></p>
            : (
              <button type="button" className="sg-btn" disabled={aoIniciar} aria-busy={p.salvando === 'adiar' || undefined} onClick={p.onAdiar}>
                {p.salvando === 'adiar' ? 'Adiando…' : <>{Ic.wait(14)}Adiar 7 dias</>}
              </button>
            )}
          <button type="button" className="sg-lnk" disabled={aoIniciar} onClick={p.onCancelar}>Cancelar</button>
        </div>
      )}
      {p.erro && (
        <p className="sg-errl" role="alert">
          {Ic.warn()}
          {p.erro.tipo === 'sessao'
            ? <><span>Sua sessão expirou. Entre de novo para responder; a sugestão continua aberta.</span>
              <a className="sg-btn" href={`/cms/login?next=${encodeURIComponent(typeof window === 'undefined' ? '/cms' : window.location.pathname + window.location.search)}`}>Entrar de novo</a></>
            : p.erro.tipo === 'sem-permissao'
            ? <><span>Você não tem permissão para responder agora. Entre de novo ou fale com o admin do site.</span>
              <a className="sg-btn" href={`/cms/login?next=${encodeURIComponent(typeof window === 'undefined' ? '/cms' : window.location.pathname + window.location.search)}`}>Entrar de novo</a></>
            : p.erro.tipo === 'vence-antes'
            ? <span><b>Não adiou:</b>{` ela vence em ${p.erro.expiraEm ? dataSP(p.erro.expiraEm) : 'menos de 7 dias'}, antes dos 7 dias.`}</span>
            : <><span>{`Não salvou “${rotuloDoErro}”${p.erro.tipo === 'sem-conexao' ? ': sem conexão' : ''}. A sugestão continua aberta.`}</span>
              <button type="button" className="sg-btn" aria-busy={p.salvando === 'adiar' || undefined}
                onClick={() => { const m = p.erro!.motivo; if (m === 'adiar') p.onAdiar(); else p.onMotivo(m) }} disabled={p.ocupada}>
                {p.erro.motivo === 'adiar' && p.salvando === 'adiar' ? 'Adiando…' : `Tentar de novo “${rotuloDoErro}”`}
              </button></>}
        </p>
      )}
    </li>
  )
}

function BotaoMotivo(p: PropsDaLinha & { valor: MotivoDaTela; rotulo: string }) {
  const esteSalvando = p.salvando === p.valor
  return (
    <button type="button" className="sg-btn" disabled={p.salvando !== null || p.ocupada} aria-busy={esteSalvando || undefined} onClick={() => p.onMotivo(p.valor)}>
      {esteSalvando ? 'Salvando…' : p.rotulo}
    </button>
  )
}

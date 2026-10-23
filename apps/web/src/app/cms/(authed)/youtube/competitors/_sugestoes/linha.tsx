'use client'
// Uma linha da lista (F3 T5): sempre um <li class="sg-row"> com a mesma chave (id) em todos os estados; a confirmação ocupa o mesmo <li>.
import { useState, type MouseEvent } from 'react'
import CmsLink from '../../../_shared/cms-link'
import type { DesfechoDaLinha, TipoDeErro } from './estado-da-lista'
import { Ic } from './icones'
import { ReguaMult } from './regua-mult'
import type { MotivoDaTela } from './tipos'
import type { LinhaDaVista } from './view-model'

const MLAB: Record<MotivoDaTela, string> = { lugar_errado: 'lugar errado', nao_interessa: 'não me interessa', nao_e_parecido: 'não é parecido', ja_fiz: 'já fiz' }

export function Confirmacao(p: { id: string; desfecho: DesfechoDaLinha; motivo: MotivoDaTela | null }) {
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
  salvando: MotivoDaTela | null
  /** Alguma chamada em voo na lista (trava toque duplo em qualquer linha). */
  ocupada: boolean
  erro: { tipo: TipoDeErro; motivo: MotivoDaTela } | null
  onDispensar(e: MouseEvent<HTMLButtonElement>): void
  onMotivo(motivo: MotivoDaTela): void
  onCancelar(): void
  onInfo(): void
  onExpandir(): void
}

function Seus(p: { l: LinhaDaVista }) {
  return <>{p.l.seus.naoMedido && <><span className="sg-nm">não medido</span>{' '}</>}{p.l.seus.texto}</>
}

export function Linha(p: PropsDaLinha) {
  const { linha: l } = p
  const [semFoto, setSemFoto] = useState(false)
  const m = l.puxadoPor
  const rotuloDoErro = p.erro ? (l.motivos.find((x) => x.valor === p.erro!.motivo)?.rotulo ?? '') : ''
  const semThumb = m === null
  const aoIniciar = p.salvando !== null || p.ocupada
  return (
    <li className={`sg-row${semThumb ? ' sg-noth' : ''}${p.expandida ? ' sg-open' : ''}`} data-row={l.id} tabIndex={-1} onKeyDown={(e) => { if (e.key === 'Escape' && p.aberta && !aoIniciar) { e.stopPropagation(); p.onCancelar() } }}>
      {!semThumb && (
        <div className="sg-thw">
          {m.miniatura === null || semFoto
            ? <div className="sg-th sg-fail">Miniatura indisponível</div>
            // eslint-disable-next-line @next/next/no-img-element -- miniatura de terceiro, sem otimizador (decisão do plano)
            : <img className="sg-th" src={m.miniatura} width={96} height={54} loading="lazy" decoding="async" referrerPolicy="no-referrer" alt="" onError={() => setSemFoto(true)} />}
        </div>
      )}
      <div>
        <div className="sg-top">
          <span className="sg-chip">{l.chip.simbolo === 'alfinete' ? Ic.pin() : Ic.flame()}{l.chip.rotulo}</span>
          {l.venceEm && <span className="sg-selo sg-mute sg-ven1">{Ic.late()}{l.venceEm}</span>}
          {l.regua && <span className="sg-vm">{l.regua.valor.toFixed(1).replace('.', ',')}×</span>}
        </div>
        <h4 className="sg-tg" onClick={p.onExpandir}>{l.titulo}</h4>
        {m && <p className="sg-pux"><span className="sg-pl">Puxado por</span><q>{m.titulo}</q>{m.canal && <span className="sg-pc">{`, de ${m.canal}`}</span>}</p>}
        {l.regua && (
          <div className="sg-rg">
            <ReguaMult valor={l.regua.valor} acimaDe20={l.regua.acimaDe20} limiar={l.regua.limiar} />
            <button type="button" className="sg-ib" aria-expanded={p.info} aria-label="Como esta sugestão foi calculada" onClick={p.onInfo}>i</button>
            <span className="sg-v">{l.regua.texto}</span>
          </div>
        )}
        {l.venceEm && <p className="sg-venm"><span className="sg-selo sg-mute">{Ic.late()}{l.venceEm}</span></p>}
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
            <button type="button" className="sg-btn sg-ghost sg-dis" aria-expanded={p.aberta} onClick={p.onDispensar}>Dispensar</button>
            <button type="button" className="sg-btn sg-ghost sg-more-btn" aria-expanded={p.aberta} aria-label="Dispensar: escolher motivo" onClick={p.onDispensar}>{Ic.dots()}</button>
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
        <div className="sg-dsp" role="group" aria-label="Motivo para dispensar">
          <p>Por que dispensar?</p>
          {l.motivos.filter((x) => x.grupo === 'motivo').map((x) => <BotaoMotivo key={x.valor} {...p} valor={x.valor} rotulo={x.rotulo} />)}
          <span className="sg-sep" aria-hidden="true" />
          {l.motivos.filter((x) => x.grupo === 'feito').map((x) => <BotaoMotivo key={x.valor} {...p} valor={x.valor} rotulo={x.rotulo} />)}
          {!aoIniciar && <button type="button" className="sg-lnk" onClick={p.onCancelar}>Cancelar</button>}
        </div>
      )}
      {p.erro && (
        <p className="sg-errl" role="alert">
          {Ic.warn()}
          {p.erro.tipo === 'sem-permissao'
            ? <><span>Você não tem permissão para responder agora. Entre de novo ou fale com o admin do site.</span>
              <a className="sg-btn" href={`/cms/login?next=${encodeURIComponent(typeof window === 'undefined' ? '/cms' : window.location.pathname + window.location.search)}`}>Entrar de novo</a></>
            : <><span>{`Não salvou “${rotuloDoErro}”${p.erro.tipo === 'sem-conexao' ? ': sem conexão' : ''}. A sugestão continua aberta.`}</span>
              <button type="button" className="sg-btn" onClick={() => p.onMotivo(p.erro!.motivo)} disabled={p.ocupada}>{`Tentar de novo “${rotuloDoErro}”`}</button></>}
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

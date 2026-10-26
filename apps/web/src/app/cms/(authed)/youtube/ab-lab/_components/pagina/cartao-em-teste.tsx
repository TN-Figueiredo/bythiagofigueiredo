'use client'
// Cartão de "Em teste agora" (M7 T7). HTML válido: o cartão não é um <a>; o link é o h3 (::after esticado)
// e os botões são irmãos, acima do link (.lab-acima), nunca descendentes dele.
import { useState, type ReactElement } from 'react'
import Link from 'next/link'
import { rotuloDoDia } from '@/lib/youtube/ab-rotulo-dia'
import { duracaoPrevista } from '@/lib/youtube/ab-dia-do-teste'
import type { CartaoEmTeste, PainelDecisao } from '@/lib/youtube/ab-lab-pagina/tipos'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import './pagina-lab.css'

export interface CartaoEmTesteProps {
  cartao: CartaoEmTeste
  /** Só um cartão na seção = layout horizontal de largura cheia. */
  unico: boolean
  onAbrirPainel: (p: PainelDecisao, origem: HTMLElement) => void
  onAbrirDia14: (linha: LinhaDoCaminho, origem: HTMLElement) => void
}

const SELO = 'lab-selo inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#40382D] px-[9px] text-xs font-semibold leading-[18px] text-cms-text-muted'
const SEM_TITULO = 'sem título gravado'

function Miniatura({ src, rotulo, classe = '' }: { src: string | null; rotulo: string; classe?: string }): ReactElement {
  const [falhou, setFalhou] = useState(false)
  if (!src || falhou) return <div className={`lab-th vazia ${classe}`} role="img" aria-label={rotulo}>sem miniatura gravada</div>
  // eslint-disable-next-line @next/next/no-img-element
  return <div className={`lab-th ${classe}`}><img src={src} alt={rotulo} onError={() => setFalhou(true)} /></div>
}

function Versao({ letra, texto, noAr, destaque }: { letra: string; texto: string; noAr: boolean; destaque: boolean }): ReactElement {
  return (
    <div className="flex items-start gap-2.5 text-sm leading-[1.4]" data-versao={letra}>
      <span aria-hidden="true" className={`grid h-[22px] w-[22px] flex-none place-items-center rounded-[5px] border text-xs font-bold ${destaque ? 'border-cms-accent bg-cms-accent text-[#1A120A]' : 'border-[#40382D] bg-[#272219] text-cms-text-muted'}`}>{letra}</span>
      <span className="line-clamp-2 min-w-0" title={texto}>{texto}</span>
      {noAr ? <span className="whitespace-nowrap text-xs text-[#6FCF97]">● no ar</span> : null}
    </div>
  )
}

const rotuloDoTipo = (t: 'thumbnail' | 'title' | 'combo'): string => t === 'title' ? 'Título' : t === 'thumbnail' ? 'Miniatura' : 'Título e miniatura'

export function CartaoEmTesteView({ cartao, unico, onAbrirPainel, onAbrirDia14 }: CartaoEmTesteProps): ReactElement {
  const cls = `lab-pg lab-cartao${unico ? ' um' : ''}`

  if (cartao.tipo === 'studio') {
    const l = cartao.linha
    return (
      <article className={cls} data-cartao="studio">
        <div className="lab-corpo flex flex-1 flex-col gap-3 p-4">
          <div className="lab-principal flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={SELO}>Título</span>
              <span className={`${SELO} border-[#6B8199] text-[#9FB4C9]`}>No Studio</span>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Miniatura src={l.miniaturaUrl} rotulo="Miniatura atual do vídeo" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <h3 className="m-0 text-[15px] font-semibold leading-[1.35]">{l.titulo}</h3>
                {cartao.titulos.map(t => <Versao key={t.letra} letra={t.letra} texto={t.titulo ?? SEM_TITULO} noAr={false} destaque={t.letra === 'B'} />)}
              </div>
            </div>
          </div>
        </div>
        {cartao.dia14 ? (
          <div className="lab-rodape pend">
            <span>Com você: dizer o que o Studio escolheu</span>
            <button type="button" className="lab-btn lab-alvo lab-acima" onClick={e => onAbrirDia14(l, e.currentTarget)}>Dizer o que o Studio escolheu</button>
          </div>
        ) : null}
      </article>
    )
  }

  const { card, painel } = cartao
  const ativo = card.status === 'active'
  const dia = card.diaV2
    ? rotuloDoDia(card.diaV2.dia, card.diaV2.teto)
    : rotuloDoDia(card.dayOf, Math.max(card.dayOf, duracaoPrevista({ max_duration_days: card.durationDays })))
  const noAr = painel?.noArLetra ?? null
  const atual = card.variants.find(v => v.isOriginal)?.thumbUrl ?? card.leaderThumbUrl
  const nome = card.videoTitle ?? card.name
  const titulo = (
    <h3 className="m-0 text-[15px] font-semibold leading-[1.35]">
      <Link href={`/cms/youtube/ab-lab/${card.id}`}>{nome}</Link>
    </h3>
  )
  const mostrarPares = card.type === 'thumbnail'
  const estatisticas = ativo ? (
      <div className="lab-stats">
        <div>
          <div className="text-xs text-cms-text-muted">Líder</div>
          <div className="text-base font-semibold leading-[1.3]">{cartao.lider ? `${cartao.lider.letra} na frente` : 'Ainda sem líder'}</div>
          <div className="text-xs text-[#958A75] tabular-nums">{cartao.lider ? `${cartao.lider.ctrs[0]} contra ${cartao.lider.ctrs[1]} de CTR` : cartao.semLider}</div>
        </div>
        <div>
          <div className="text-xs text-cms-text-muted">Próxima troca</div>
          <div className="text-base font-semibold leading-[1.3] tabular-nums">{cartao.proximaTroca ?? 'não medida'}</div>
          <div className="text-xs text-[#958A75]">automática</div>
        </div>
      </div>
    ) : null

  return (
    <article className={cls} data-cartao="lab" data-tipo={card.type}>
      <div className="lab-corpo flex flex-1 flex-col gap-3 p-4">
        <div className="lab-principal flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={SELO}>{rotuloDoTipo(card.type)}</span>
            {ativo
              ? <span className={`${SELO} border-[#3E8F63] text-[#6FCF97] tabular-nums`}><span aria-hidden="true" className="h-2 w-2 flex-none rounded-full bg-[#6FCF97]" />{dia}</span>
              : <span className={SELO}>Na fila</span>}
          </div>
          {mostrarPares ? (
            <>
              {titulo}
              <div className="flex gap-2.5">
                {card.variants.map(v => (
                  <div key={v.id} className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Miniatura src={v.thumbUrl} rotulo={`Miniatura ${v.label}`} classe="!w-full" />
                    <div className="flex items-center gap-2.5 text-sm" data-versao={v.label}>
                      <span aria-hidden="true" className={`grid h-[22px] w-[22px] flex-none place-items-center rounded-[5px] border text-xs font-bold ${v.label === 'B' ? 'border-cms-accent bg-cms-accent text-[#1A120A]' : 'border-[#40382D] bg-[#272219] text-cms-text-muted'}`}>{v.label}</span>
                      {noAr === v.label ? <span className="text-xs text-[#6FCF97]">● no ar</span> : <span className="text-xs text-cms-text-muted">{v.isOriginal ? 'original' : 'nova'}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Miniatura src={atual} rotulo="Miniatura atual do vídeo" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {titulo}
                {card.variants.map(v => <Versao key={v.id} letra={v.label} texto={v.title ?? SEM_TITULO} noAr={noAr === v.label} destaque={v.label === 'B'} />)}
              </div>
            </div>
          )}
        </div>
        {unico ? estatisticas : null}
      </div>
      {unico ? null : estatisticas}
      {ativo && painel ? (
        <div className="lab-rodape neutro">
          <button type="button" className="lab-btn lab-alvo lab-acima" onClick={e => onAbrirPainel(painel, e.currentTarget)}>Encerrar e escolher</button>
        </div>
      ) : null}
    </article>
  )
}

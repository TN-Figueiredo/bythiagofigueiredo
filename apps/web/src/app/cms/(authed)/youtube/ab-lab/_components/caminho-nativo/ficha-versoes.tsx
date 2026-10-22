'use client'
// Bloco 1 da ficha: "Título · Miniatura · Os dois" e as versões A/B/C (F1a-tela-1, T8). Só desenha; a gravação é do hook.
// Mockup M2: `verRow`/`segCampos` (index.html:418-439). Título hostil: `overflow-wrap:anywhere`, contador por grafema.
import { useRef, type KeyboardEvent, type ReactElement } from 'react'
import { contarCaracteresDoTitulo, LIMITE_TITULO } from '@/lib/youtube/teste-youtube/nativo/titulo'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import type { FichaLida, FichaRascunho, VarianteFicha } from '@/lib/youtube/teste-youtube/nativo/ficha'
import { ChipVersao } from './chip-versao'
import { AvisoResolucao } from './aviso-resolucao'
import { Icone } from './icones'
import type { Alteracao, Campo, ChaveCampo } from './use-ficha-gravada'
import '../caminho-nativo.css'
import '../ficha-teste.css'

const LETRAS = ['A', 'B', 'C'] as const
const letraDe = (n: number): 'A' | 'B' | 'C' => LETRAS[n - 1] ?? 'C'

type Escolha = 'titulo' | 'miniatura' | 'ambos'
const escolhaDe = (c: Campo[]): Escolha => (c.length === 2 ? 'ambos' : c[0] === 'miniatura' ? 'miniatura' : 'titulo')
const camposDe = (e: Escolha): Campo[] => (e === 'ambos' ? ['titulo', 'miniatura'] : [e])
const OPCOES: ReadonlyArray<{ v: Escolha; rotulo: string }> = [
  { v: 'titulo', rotulo: FRASES.ficha.campoTitulo }, { v: 'miniatura', rotulo: FRASES.ficha.campoMiniatura }, { v: 'ambos', rotulo: FRASES.ficha.campoOsDois },
]

/** `?download=1` na URL da cópia no Blob (cabeçalho de download). */
export const urlDeDownload = (u: string): string => `${u}${u.includes('?') ? '&' : '?'}download=1`

export interface FichaVersoesProps {
  /** Ficha gravada: de onde sai o texto de `Copiar título` (exatamente o gravado). */
  gravada: FichaLida
  rascunho: FichaRascunho
  somenteLeitura: boolean
  alterar: (a: Alteracao) => void
  sair: (campo?: ChaveCampo) => Promise<void>
  copiarTitulo: (texto: string) => void
  enviarImagem: (n: number, arquivo: File) => void
  /** Versões cuja imagem não carregou (`onError`). */
  imagensComErro: number[]
  aoErroImagem: (n: number) => void
  /** Versão com envio de imagem em curso e frase do último envio recusado. */
  enviandoN: number | null
  erroImagem: { n: number; frase: string } | null
}

export function FichaVersoes(p: FichaVersoesProps): ReactElement {
  const { rascunho, gravada, somenteLeitura: ro } = p
  const escolha = escolhaDe(rascunho.campos)
  const temTitulo = rascunho.campos.includes('titulo')
  const temMini = rascunho.campos.includes('miniatura')
  const porN = new Map<number, VarianteFicha>(rascunho.variantes.map((v) => [v.n, v]))
  const gravadaPorN = new Map<number, VarianteFicha>(gravada.variantes.map((v) => [v.n, v]))
  const ns = [1, 2, ...(porN.has(3) ? [3] : [])]
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const escolher = (e: Escolha): void => {
    if (ro || e === escolha) return
    p.alterar({ atributo: 'campos', valor: camposDe(e) })
    void p.sair('campos')
  }
  const teclasRadio = (ev: KeyboardEvent<HTMLButtonElement>, i: number): void => {
    const d = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0
    if (d === 0) return
    ev.preventDefault()
    const j = (i + d + OPCOES.length) % OPCOES.length
    escolher(OPCOES[j]!.v)
    refs.current[j]?.focus()
  }

  return (
    <div>
      <div className="cn-segc" role="radiogroup" aria-label={FRASES.ficha.oQueTestar} aria-disabled={ro || undefined}>
        {OPCOES.map((o, i) => (
          <button
            key={o.v} type="button" role="radio" aria-checked={escolha === o.v} tabIndex={escolha === o.v ? 0 : -1} disabled={ro}
            ref={(el) => { refs.current[i] = el }} onClick={() => escolher(o.v)} onKeyDown={(ev) => teclasRadio(ev, i)}
          >
            {escolha === o.v ? <Icone nome="ok" /> : null}
            {o.rotulo}
          </button>
        ))}
      </div>
      <div className="cn-vers">
        {ns.map((n) => {
          const v = porN.get(n)
          const letra = letraDe(n)
          const original = n === 1
          const titulo = v?.titulo ?? ''
          const gravado = gravadaPorN.get(n)?.titulo
          const total = contarCaracteresDoTitulo(titulo.trim())
          const passou = total > LIMITE_TITULO
          const falhou = p.imagensComErro.includes(n)
          const img = v?.imagem
          const idCampo = `cn-t${n}`
          return (
            <div key={n} className={`cn-ver${original ? ' orig' : ''}`} data-versao={letra}>
              <div className="cn-vh">
                <ChipVersao letra={letra} />
                <b>{original ? FRASES.ficha.versaoA : FRASES.ficha.versao(letra)}</b>
                {original ? <span className="cn-meta">{FRASES.ficha.versaoA_nota}</span> : null}
              </div>
              <div className={`cn-vbody${temMini ? '' : ' nothumb'}`}>
                {temMini ? (
                  <div className="cn-vimg">
                    {original ? (
                      img && !falhou
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img className="cn-th" src={img.url} alt="" onError={() => p.aoErroImagem(n)} />
                        : <div className="cn-th nm" data-estado="nao-medido">{FRASES.ficha.naoMedidoOriginal}</div>
                    ) : img && !falhou ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="cn-th" src={img.url} alt="" onError={() => p.aoErroImagem(n)} />
                    ) : falhou ? (
                      <div className="cn-th fail" role="img" aria-label={FRASES.ficha.imagemNaoCarregou}><Icone nome="warn" /> {FRASES.ficha.imagemNaoCarregou}</div>
                    ) : (
                      <label className="cn-slot">
                        {FRASES.ficha.enviarImagem(letra)}<br />1280 × 720
                        <input type="file" className="cn-sr" accept="image/jpeg,image/png" disabled={ro || p.enviandoN === n}
                          aria-label={FRASES.ficha.enviarImagem(letra)} onChange={(ev) => { const f = ev.target.files?.[0]; if (f) p.enviarImagem(n, f); ev.target.value = '' }} />
                      </label>
                    )}
                  </div>
                ) : null}
                <div className="cn-vcampos">
                  {temTitulo ? (
                    original ? (
                      titulo ? <p className="cn-ro">{titulo}</p> : <p className="cn-meta">{FRASES.ficha.tituloOriginalNaoLido}</p>
                    ) : (
                      <div className="cn-fld">
                        <label htmlFor={idCampo}>
                          <span>{FRASES.ficha.tituloDaVersao(letra)}</span>
                          <span className={`cn-cnt${passou ? ' passou' : ''}`} aria-live="polite">{total}/{LIMITE_TITULO}</span>
                        </label>
                        <textarea
                          id={idCampo} rows={2} value={titulo} readOnly={ro} placeholder={FRASES.ficha.escrevaOTitulo}
                          aria-invalid={passou || undefined}
                          onChange={(ev) => p.alterar({ atributo: 'titulo', n, valor: ev.target.value })}
                          onBlur={() => { void p.sair(`${n}:titulo`) }}
                        />
                        {passou ? <p className="cn-errl" role="alert"><Icone nome="warn" /><span>{FRASES.ficha.tituloAcima(LIMITE_TITULO)}</span></p> : null}
                      </div>
                    )
                  ) : original ? <p className="cn-meta">{FRASES.ficha.versaoA_nota}</p> : null}

                  {!original && !temTitulo && !img && !falhou ? <p className="cn-meta">{FRASES.ficha.enviarImagem(letra)}.</p> : null}

                  {temMini && !original && img && !falhou ? <AvisoResolucao sujeito="enviada" medida={{ largura: img.largura, altura: img.altura }} /> : null}
                  {temMini && original && img && !falhou ? <AvisoResolucao sujeito="guardada" medida={{ largura: img.largura, altura: img.altura }} /> : null}
                  {falhou ? (
                    <p className="cn-errl" role="alert"><Icone nome="warn" /><span><b>{FRASES.ficha.imagemNaoCarregou}.</b> {FRASES.ficha.imagemFalhou(letra).apoio}</span></p>
                  ) : null}
                  {p.erroImagem && p.erroImagem.n === n ? <p className="cn-errl" role="alert"><Icone nome="warn" /><span>{p.erroImagem.frase}</span></p> : null}

                  {!original ? (
                    <div className="cn-vacts">
                      {temTitulo ? (
                        <button type="button" className="cn-btn" disabled={ro || !gravado} onClick={() => { if (gravado) p.copiarTitulo(gravado) }}>
                          <Icone nome="copy" />{FRASES.ficha.copiarTitulo}
                        </button>
                      ) : null}
                      {temMini && img && !falhou ? (
                        ro
                          ? <button type="button" className="cn-btn" disabled><Icone nome="down" />{FRASES.ficha.baixarImagem}</button>
                          : <a className="cn-btn" href={urlDeDownload(img.url)} download><Icone nome="down" />{FRASES.ficha.baixarImagem}</a>
                      ) : null}
                      {temMini && (falhou || img) ? (
                        <label className={`cn-btn${ro ? ' off' : ''}`}>
                          {falhou ? FRASES.ficha.enviarDeNovo : FRASES.ficha.trocarImagem}
                          <input type="file" className="cn-sr" accept="image/jpeg,image/png" disabled={ro || p.enviandoN === n}
                            aria-label={falhou ? `${FRASES.ficha.enviarDeNovo} (${FRASES.ficha.versao(letra)})` : FRASES.ficha.trocarImagemAria(letra)}
                            onChange={(ev) => { const f = ev.target.files?.[0]; if (f) p.enviarImagem(n, f); ev.target.value = '' }} />
                        </label>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
        {!porN.has(3) && !ro ? (
          <button type="button" className="cn-addv" onClick={() => { p.alterar({ atributo: 'versao', n: 3 }); void p.sair('3:versao') }}>
            {FRASES.ficha.adicionarC}
          </button>
        ) : null}
      </div>
    </div>
  )
}

'use client'
// "Ficha do teste": raiz do painel de ficha (F1a-tela-1, T8). Estado do rascunho vive AQUI (re-render por tecla fica fora da lista).
// ENCAIXES para as T9a/T9b (nada disso é implementado aqui): `encaixes.faixas` (faixas 0b/0c/restaurando/falhou/restaurada), `encaixes.acaoDoTopo`
// ("Abrir no Studio" / "Já iniciei" no topo), `encaixes.abrirNoStudio` (link do bloco 2), `encaixes.confirmar` (bloco 3 "Confirmar") e
// `encaixes.rodape` ("Lembrar no computador" no estreito). Todos recebem o `ContextoFicha` com `executar`/`adotar`, para a fila ser uma só.
import { useEffect, useState, type ReactElement, type ReactNode } from 'react'
import type { FichaLida } from '@/lib/youtube/teste-youtube/nativo/ficha'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { vistaDaFicha, ultimaAtividade, INATIVIDADE_DESCARTE_MS, type EntradaFicha, type Largura, type VistaFicha } from '@/lib/youtube/teste-youtube/nativo/ficha-tela'
import { FRASES, dataCurta } from '@/lib/youtube/teste-youtube/nativo/frases'
import type { AcoesCaminho } from './lista-caminho'
import { FaixaCaminho } from './faixa-caminho'
import { Icone } from './icones'
import { FichaVersoes } from './ficha-versoes'
import { useFichaGravada, type FichaGravada } from './use-ficha-gravada'
import '../caminho-nativo.css'
import '../ficha-teste.css'

export interface ContextoFicha {
  ficha: FichaLida
  vista: VistaFicha
  largura: Largura
  executar: FichaGravada['executar']
  adotar: FichaGravada['adotar']
  salvarAgora: FichaGravada['salvarAgora']
}
export interface EncaixesFicha {
  faixas?: (c: ContextoFicha) => ReactNode
  acaoDoTopo?: (c: ContextoFicha) => ReactNode
  abrirNoStudio?: (c: ContextoFicha) => ReactNode
  confirmar?: (c: ContextoFicha) => ReactNode
  rodape?: (c: ContextoFicha) => ReactNode
}
export type AcoesFicha = Pick<AcoesCaminho, 'salvarFicha' | 'enviarImagemDaFicha' | 'recomecarFicha'>

export interface FichaTesteProps {
  linha: Pick<LinhaDoCaminho, 'titulo' | 'miniaturaUrl' | 'nosso'>
  inicial: FichaLida
  acoes: AcoesFicha
  fechar: () => void
  agora?: () => Date
  largura?: Largura
  /** O que as T9a/T9b sabem e a T8 não: confirmação, teste nosso detalhado, registro detectado, etc. */
  entrada?: Partial<Pick<EntradaFicha, 'nosso' | 'registroDetectado' | 'studioAbertoNestaSessao' | 'criadaEmOutroAparelho' | 'confirmacao'>>
  encaixes?: EncaixesFicha
  /** Chamado com a ficha nova depois de "Começar outra ficha com estas versões". */
  aoRecomecar?: (nova: FichaLida) => void
  /** Ficha registrada como teste: os campos dos passos 1 e 2 ficam só para leitura (nada mais é gravado nela). */
  travada?: boolean
}

export const fmtHora = (d: Date): string => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)

/** "às 14:32" no mesmo dia (São Paulo); "em 08/10, 14:32" em outro. */
export function quandoSalvo(iso: string, agora: Date): string {
  const d = new Date(iso)
  return dataCurta(d) === dataCurta(agora) ? FRASES.ficha.salvoHoje(fmtHora(d)) : FRASES.ficha.salvoOutroDia(dataCurta(d), fmtHora(d))
}

export function useLargura(forcada?: Largura): Largura {
  const [l, setL] = useState<Largura>('larga')
  useEffect(() => {
    if (forcada || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const m = window.matchMedia('(max-width: 640px)')
    const ler = (): void => setL(m.matches ? 'estreita' : 'larga')
    ler()
    m.addEventListener?.('change', ler)
    return () => m.removeEventListener?.('change', ler)
  }, [forcada])
  return forcada ?? l
}

type ResultadoImagem = Awaited<ReturnType<AcoesCaminho['enviarImagemDaFicha']>>

export function FichaTeste(p: FichaTesteProps): ReactElement {
  const agora = (p.agora ?? (() => new Date()))()
  const largura = useLargura(p.largura)
  const g = useFichaGravada(p.inicial, { salvarFicha: p.acoes.salvarFicha })
  const [imagensComErro, setImagensComErro] = useState<number[]>([])
  const [erroCopiar, setErroCopiar] = useState(false)
  const [enviandoN, setEnviandoN] = useState<number | null>(null)
  const [erroImagem, setErroImagem] = useState<{ n: number; frase: string } | null>(null)

  const ficha = g.ficha
  const estreita = largura === 'estreita'
  const nossoDaLinha: EntradaFicha['nosso'] = p.linha.nosso
    ? { status: p.linha.nosso.status, dia: p.linha.nosso.dia, originalDeVolta: 'nao' }
    : null
  const salvamento: EntradaFicha['salvamento'] = g.status === 'sem_conexao' ? 'offline' : g.status === 'salvando' ? 'salvando' : 'ok'
  const vista = vistaDaFicha({
    ficha, agora, largura,
    nosso: p.entrada?.nosso !== undefined ? p.entrada.nosso : nossoDaLinha,
    registroDetectado: p.entrada?.registroDetectado ?? null,
    studioAbertoNestaSessao: p.entrada?.studioAbertoNestaSessao ?? false,
    criadaEmOutroAparelho: p.entrada?.criadaEmOutroAparelho ?? false,
    confirmacao: p.entrada?.confirmacao ?? 'fechada',
    salvamento,
    imagemFalhou: imagensComErro[0] ?? null,
  })
  const vencida = vista.idade === 'vencida'
  const ctx: ContextoFicha = { ficha, vista, largura, executar: g.executar, adotar: g.adotar, salvarAgora: g.salvarAgora }
  const semB = !vista.jaIniciouHabilitado && vista.motivoDesabilitado === (estreita ? FRASES.ficha.rodapeLembrete.semB : FRASES.ficha.faltaB)
  const nossoBloqueia = p.entrada?.nosso !== undefined ? p.entrada.nosso !== null && p.entrada.nosso.originalDeVolta !== 'sim' : nossoDaLinha !== null
  const faixaVencida = FRASES.ficha.faixaVencida(new Date(ultimaAtividade(ficha) + INATIVIDADE_DESCARTE_MS))
  const parada = vista.idade === 'parada'
  const faixaParada = FRASES.ficha.faixaParada(new Date(ultimaAtividade(ficha)), new Date(ultimaAtividade(ficha) + INATIVIDADE_DESCARTE_MS))
  const tres = g.rascunho.variantes.some((v) => v.n === 3)

  const copiarTitulo = (texto: string): void => {
    setErroCopiar(false)
    try {
      navigator.clipboard.writeText(texto).catch(() => setErroCopiar(true))
    } catch { setErroCopiar(true) }
  }

  const enviarImagem = (n: number, arquivo: File): void => {
    setEnviandoN(n); setErroImagem(null)
    const fd = new FormData()
    fd.append('file', arquivo)
    void (async () => {
      try {
        const r = await g.executar<ResultadoImagem>(() => p.acoes.enviarImagemDaFicha(g.ficha.id, fd))
        if (r.ok) {
          setImagensComErro((a) => a.filter((x) => x !== n))
          g.alterar({ atributo: 'imagem', n, valor: r.imagem })
          await g.salvarAgora()
        } else {
          const conhecida = r.error === FRASES.imagem.grande || r.error === FRASES.imagem.formato
          setErroImagem({ n, frase: conhecida ? r.error : FRASES.ficha.erroImagem })
        }
      } catch {
        setErroImagem({ n, frase: FRASES.ficha.erroImagem })
      } finally {
        setEnviandoN(null)
      }
    })()
  }

  const recomecar = (): void => {
    void (async () => {
      const r = await g.executar<Awaited<ReturnType<AcoesFicha['recomecarFicha']>>>(() => p.acoes.recomecarFicha(g.ficha.id))
      if (r.ok) p.aoRecomecar?.(r.ficha)
    })()
  }

  const linhaSalvo = ((): ReactElement => {
    if (vencida) return <p className="cn-save" role="status" aria-live="polite" />
    if (g.status === 'salvando') return <p className="cn-save" role="status" aria-live="polite">{FRASES.ficha.salvando}</p>
    if (g.status === 'sem_conexao') {
      return (
        <p className="cn-save off" role="status" aria-live="polite">
          <Icone nome="warn" />
          <span><b>{FRASES.ficha.naoSalvo}</b> {FRASES.ficha.naoSalvoApoio}</span>
          <button type="button" className="cn-lnk" onClick={() => { void g.salvarAgora() }}>{FRASES.ficha.tentarAgora}</button>
        </p>
      )
    }
    if (g.status === 'mudou' && g.mensagem === FRASES.ficha.naoSalvoConflito) {
      return (
        <p className="cn-save off" role="status" aria-live="polite">
          <Icone nome="warn" />
          <span><b>{FRASES.ficha.naoSalvoConflito}</b></span>
          <button type="button" className="cn-lnk" onClick={() => { void g.salvarAgora() }}>{FRASES.ficha.tentarAgora}</button>
        </p>
      )
    }
    if (g.status === 'recusado') {
      return (
        <p className="cn-save rec" role="alert">
          <Icone nome="warn" /><span>{g.mensagem}</span>
          {g.mensagem === FRASES.ficha.erroServidor
            ? <button type="button" className="cn-lnk" onClick={() => { void g.salvarAgora() }}>{FRASES.ficha.tentarAgora}</button>
            : null}
        </p>
      )
    }
    const aviso = g.mensagem
    return (
      <p className="cn-save" role="status" aria-live="polite">
        {aviso ? <span>{aviso} </span> : null}
        {FRASES.ficha.salvo(quandoSalvo(ficha.atualizada_em, agora))}
      </p>
    )
  })()

  const ledeBloco2 = estreita
    ? (p.entrada?.criadaEmOutroAparelho ? FRASES.ficha.bloco2.ledeEstreitaOutroAparelho : FRASES.ficha.bloco2.ledeEstreita)
    : vencida ? FRASES.ficha.bloco2.ledeVencida
      : nossoBloqueia ? FRASES.ficha.aberturaDepoisDaOriginal : null

  return (
    <section className="cn-ficha" aria-labelledby="cn-fh" data-idade={vista.idade}>
      <div className="cn-fin">
        <div className="cn-fbar">
          {estreita ? (
            <button type="button" className="cn-btn ghost" onClick={p.fechar}><Icone nome="back" />{FRASES.ficha.voltarALista}</button>
          ) : (
            <>
              <span className="cn-crumb">{FRASES.ficha.crumb}</span>
              <button type="button" className="cn-btn ghost" onClick={p.fechar} aria-label="Fechar a ficha (Esc)"><Icone nome="x" />{FRASES.ficha.fechar}</button>
            </>
          )}
        </div>
        <div className="cn-fhd">
          {p.linha.miniaturaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="cn-fth" src={p.linha.miniaturaUrl} alt="" />
          ) : null}
          <div className="cn-ttl">
            <p className="cn-crumb">{FRASES.ficha.testarNoYoutube}</p>
            <h2 id="cn-fh" tabIndex={-1}>{p.linha.titulo}</h2>
            <div className="cn-fst">{linhaSalvo}</div>
            {erroCopiar ? <p className="cn-errl" role="alert"><Icone nome="warn" /><span>{FRASES.ficha.erroCopiar}</span></p> : null}
          </div>
        </div>
        <p className="cn-fsum">
          {vista.frase}
          {vista.apoio ? <small>{vista.apoio}</small> : null}
        </p>

        {vencida ? (
          <FaixaCaminho
            tom="neutra" role="status"
            titulo={faixaVencida.titulo}
            acoes={<button type="button" className="cn-btn pri" onClick={recomecar}>{FRASES.ficha.comecarOutra}</button>}
          >
            {faixaVencida.apoio}
          </FaixaCaminho>
        ) : null}
        {parada ? <FaixaCaminho tom="neutra" role="status" titulo={faixaParada.titulo}>{faixaParada.apoio}</FaixaCaminho> : null}
        {p.encaixes?.faixas?.(ctx)}
        {!vencida && vista.acaoDoTopo ? p.encaixes?.acaoDoTopo?.(ctx) : null}

        <section className="cn-blk" aria-labelledby="cn-b1">
          <h3 id="cn-b1"><span className="n" aria-hidden="true">1</span>{FRASES.ficha.bloco1.titulo}</h3>
          <p className="cn-lede">{FRASES.ficha.bloco1.lede}</p>
          <FichaVersoes
            gravada={ficha} rascunho={g.rascunho} somenteLeitura={vencida || p.travada === true}
            alterar={g.alterar} sair={g.sair} copiarTitulo={copiarTitulo} enviarImagem={enviarImagem}
            imagensComErro={imagensComErro} aoErroImagem={(n) => setImagensComErro((a) => (a.includes(n) ? a : [...a, n]))}
            enviandoN={enviandoN} erroImagem={erroImagem}
          />
        </section>

        <section className="cn-blk" aria-labelledby="cn-b2">
          <h3 id="cn-b2"><span className="n" aria-hidden="true">2</span>{FRASES.ficha.bloco2.titulo}</h3>
          {ledeBloco2 ? (
            <p className="cn-lede">{ledeBloco2}</p>
          ) : (
            <>
              <ol className="cn-steps">{FRASES.ficha.bloco2.passos(tres).map((t) => <li key={t}>{t}</li>)}</ol>
              {semB ? null : p.encaixes?.abrirNoStudio?.(ctx)}
            </>
          )}
        </section>

        {p.encaixes?.confirmar && !vencida ? p.encaixes.confirmar(ctx) : null}
        {estreita && !vencida ? p.encaixes?.rodape?.(ctx) : null}
      </div>
    </section>
  )
}

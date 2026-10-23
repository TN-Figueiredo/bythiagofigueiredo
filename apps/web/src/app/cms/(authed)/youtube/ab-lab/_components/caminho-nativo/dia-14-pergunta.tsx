'use client'
// Pergunta do dia 14 com 2 ou 3 versões, de ficha ou derivada (F1a-tela-2, T6; nasceu como `Dia14Duas` na tela-1). Mockup M2 `index.html:539-565`
// (função `d14`). Sem botão primário: as versões têm o mesmo peso. A numeração e o pedido vêm de `dia-14-estado` (a mesma do servidor).
// `modo: 'mudar'` abre a mesma pergunta sobre uma resposta já gravada. As actions chegam por props (nenhum client importa `actions-nativo`).
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import * as Sentry from '@sentry/nextjs'
import type { PedidoRespostaDia14, ResultadoAcaoMudar, ResultadoAcaoResponder } from '../../actions-nativo'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import { prazoDoTeste, type LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import type { RespostaDono } from '@/lib/youtube/teste-youtube/nativo/versoes'
import { letraDaResposta, pedidoDaVersao, type PerguntaDoDia14, type VersaoDoDia14 } from './dia-14-estado'
import { ChipVersao } from './chip-versao'
import { Icone } from './icones'
import { FaixaCaminho } from './faixa-caminho'
import { SeloCaminho } from './selo-caminho'
import '../caminho-nativo.css'
import '../dia-14-pergunta.css'

/** Pedido do "Mudar minha resposta": o da primeira resposta mais o que a tela viu da gravada (CAS no servidor, T3). */
export type PedidoMudarDia14 = PedidoRespostaDia14 & { respostaVista: RespostaDono; varianteVista: number | null }
export interface AcoesDia14 {
  responder: (pedido: PedidoRespostaDia14) => Promise<ResultadoAcaoResponder>
  /** Só o modo mudar usa; a T7 passa `mudarRespostaDoTesteDoYouTube`. */
  mudar?: (pedido: PedidoMudarDia14) => Promise<ResultadoAcaoMudar>
  /** Relê a lista (a linha mudou por dentro ou por fora). */
  atualizar: () => void
  /** T7: região viva FORA do bloco (o bloco desmonta quando a linha relê). Com ela, a confirmação da troca não leva `role="status"` própria. */
  anunciar?: (texto: string) => void
  /** T7: o bloco que hospeda o modo mudar fica sabendo que a troca foi gravada (para voltar ao respondido quando a linha reler). */
  aoMudou?: () => void
}
export interface Dia14PerguntaProps {
  linha: LinhaDoCaminho
  pergunta: PerguntaDoDia14
  modo: 'responder' | 'mudar'
  respostaVista?: RespostaDono
  varianteVista?: number | null
  acoes: AcoesDia14
  aoFechar: () => void
}

type RespostaSemVencedor = 'ficou_igual' | 'inconclusivo' | 'nao_vi'
type Tela =
  | { t: 'pergunta' }
  | { t: 'no_ar'; original: boolean; letra: string }
  | { t: 'sem_vencedor'; resposta: RespostaSemVencedor }
  | { t: 'diferentes' }
  | { t: 'mudada'; texto: string }
  | { t: 'mudou'; ja: boolean }
  | { t: 'erro'; texto: string }
  | { t: 'sem_conexao'; pedido: PedidoRespostaDia14 | PedidoMudarDia14; toque: string; versao: VersaoDoDia14 | null }

type Falha = Extract<ResultadoAcaoResponder | ResultadoAcaoMudar, { ok: false }>

/** Desfecho que NÃO é sucesso: relê a linha (o teste mudou; `ja` = respondido em outra tela) ou mostra a frase de erro. Exaustivo sobre o tipo real. */
function falhaDaAction(r: Falha): 'mudou' | 'ja' | { texto: string } {
  switch (r.erro) {
    case 'ja_respondido':
      return 'ja'
    case 'estado_mudou': case 'nao_respondivel': case 'nao_encontrado': case 'nao_respondida':
      return 'mudou'
    case 'sem_permissao':
      return { texto: FRASES.semPermissao }
    case 'pedido_invalido': case 'variante_invalida':
      return { texto: FRASES.pedidoRecusado }
    case 'falha_escrita': case 'falha':
      return { texto: FRASES.dia14.falhou }
    default: {
      const _exaustivo: never = r
      return _exaustivo
    }
  }
}

/** Resultado de sucesso sem conflito: `venceu_*` vira "ficou no ar" (com a letra tocada); as outras três, "sem vencedor" (nunca "Ficou no ar"). */
export function telaDoSucesso(resposta: PedidoRespostaDia14['resposta'], letra: string): Tela {
  switch (resposta) {
    case 'venceu_original': return { t: 'no_ar', original: true, letra }
    case 'venceu_nova': return { t: 'no_ar', original: false, letra }
    case 'ficou_igual': case 'inconclusivo': case 'nao_vi': return { t: 'sem_vencedor', resposta }
    default: {
      const _exaustivo: never = resposta
      return _exaustivo
    }
  }
}

/** Confirmação da troca: com a versão tocada (letra, e "(original)" na A) ou, sem versão, pela resposta. */
function textoMudada(resposta: PedidoRespostaDia14['resposta'], v: VersaoDoDia14 | null): string {
  if (v) return FRASES.dia14.mudadaPara(v.letra, v.original)
  if (resposta === 'ficou_igual' || resposta === 'inconclusivo' || resposta === 'nao_vi') return FRASES.dia14.mudadaSemVersao[resposta]
  return FRASES.dia14.falhou
}

const OUTRAS: { resposta: RespostaSemVencedor; rotulo: string }[] = [
  { resposta: 'ficou_igual', rotulo: FRASES.dia14.ficouIgual },
  { resposta: 'inconclusivo', rotulo: FRASES.dia14.inconclusivo },
  { resposta: 'nao_vi', rotulo: FRASES.dia14.naoVi },
]

export function Dia14Pergunta({ linha, pergunta, modo, respostaVista, varianteVista, acoes, aoFechar }: Dia14PerguntaProps): ReactElement {
  const reg = linha.registro
  const mudar = modo === 'mudar'
  const [tela, setTela] = useState<Tela>({ t: 'pergunta' })
  const [ocupado, setOcupado] = useState(false)
  const [tocado, setTocado] = useState<string | null>(null)
  const [semImagem, setSemImagem] = useState<ReadonlySet<number>>(new Set())
  const emCurso = useRef(false)
  const resultadoRef = useRef<HTMLParagraphElement>(null)
  const tituloRef = useRef<HTMLHeadingElement>(null)
  const apoioRef = useRef<HTMLParagraphElement>(null)
  const alertaRef = useRef<HTMLDivElement & HTMLParagraphElement>(null)
  const origemFoco = useRef<Element | null>(null)
  const idQ = useId()

  // Resultado, ou o aviso de erro (que fica junto de "Outra resposta", longe do título), ou o título.
  useEffect(() => { if (tela.t !== 'pergunta') (resultadoRef.current ?? alertaRef.current ?? tituloRef.current ?? apoioRef.current)?.focus() }, [tela])
  // Quem abriu (o link "Mudar minha resposta") é guardado antes de o foco entrar na pergunta; ao sair, volta para ele.
  useEffect(() => {
    if (!mudar) return
    origemFoco.current = document.activeElement
    ;(tituloRef.current ?? apoioRef.current)?.focus()
  }, [mudar])

  const sair = (): void => {
    aoFechar()
    // O pai pode ter trocado o link por outro nó ao fechar: espera o ciclo e procura o link da mesma linha.
    setTimeout(() => {
      const o = origemFoco.current
      // O link da linha vem primeiro: ao abrir a pergunta ele saiu do DOM e o nó guardado pode ser o `body`.
      const alvo = document.querySelector<HTMLElement>(`li[data-linha="${linha.videoId}"] [data-acao="mudar-resposta"]`)
        ?? (o instanceof HTMLElement && o.isConnected && o !== document.body ? o : null)
      alvo?.focus()
    }, 0)
  }

  const versoes = pergunta.tipo === 'versoes' ? pergunta.versoes : []
  const derivada = pergunta.tipo === 'versoes' && pergunta.origem === 'derivada'
  const comMiniatura = pergunta.tipo === 'versoes' && !derivada && (reg?.campos === null || reg?.campos === undefined || reg.campos.includes('miniatura'))
  const confirmadoEm = reg?.confirmadoEm ?? reg?.primeiraVista ?? null
  const tardia = !mudar && linha.estado === 'sem_resposta' && reg
    ? FRASES.resposta.tardia(prazoDoTeste(reg.inicio))
    : null

  // A resposta atual (modo mudar): a versão pela mesma regra da linha respondida; sem par, pela posição gravada.
  const vistaResposta = respostaVista ?? reg?.respostaDono ?? null
  const vistaVariante = varianteVista !== undefined ? varianteVista : (reg?.varianteVencedora ?? null)
  const versaoAtual: VersaoDoDia14 | null = !mudar || pergunta.tipo !== 'versoes' || !reg ? null
    : letraDaResposta(reg, pergunta) ?? versoes.find((x) => x.n === (vistaResposta === 'venceu_original' ? 1 : vistaVariante)) ?? null

  async function enviar(pedido: PedidoRespostaDia14 | PedidoMudarDia14, chave: string, versao: VersaoDoDia14 | null): Promise<void> {
    if (emCurso.current) return
    emCurso.current = true; setOcupado(true); setTocado(chave)
    try {
      // O pedido da troca é o único com `respostaVista`; sem a action de troca no modo mudar, é erro (nunca cai na 1ª resposta).
      const r: ResultadoAcaoResponder | ResultadoAcaoMudar = 'respostaVista' in pedido
        ? (acoes.mudar ? await acoes.mudar(pedido) : { ok: false, erro: 'falha', error: '' })
        : await acoes.responder(pedido)
      if (r.ok) {
        if (r.conflito !== null) { setTela({ t: 'diferentes' }); acoes.atualizar(); return }
        const texto = textoMudada(pedido.resposta, versao)
        setTela(mudar ? { t: 'mudada', texto } : telaDoSucesso(pedido.resposta, versao?.letra ?? ''))
        if (mudar) { acoes.anunciar?.(texto); acoes.aoMudou?.() }
        acoes.atualizar()
        return
      }
      const f = falhaDaAction(r)
      if (f === 'mudou' || f === 'ja') { setTela({ t: 'mudou', ja: f === 'ja' }); return }
      Sentry.captureMessage('dia 14: resposta recusada', { level: 'warning', tags: { area: 'ab-nativo' }, extra: { motivo: r.erro } })
      setTela({ t: 'erro', texto: f.texto })
    } catch {
      // Rede caiu: nada foi registrado; o 2º toque reenvia o mesmo pedido (a action é idempotente por CAS).
      setTela({ t: 'sem_conexao', pedido, toque: chave, versao })
    } finally {
      emCurso.current = false; setOcupado(false); setTocado(null)
    }
  }

  const base = (resposta: PedidoRespostaDia14['resposta'], n: number | null, tituloVisto?: string | null): PedidoRespostaDia14 | PedidoMudarDia14 | null => {
    if (!reg) return null
    const p: PedidoRespostaDia14 = { registroId: reg.id, lido: reg.updatedAt, resposta, n, ...(tituloVisto !== undefined ? { tituloVisto } : {}) }
    if (!mudar) return p
    if (!vistaResposta) return null
    return { ...p, respostaVista: vistaResposta, varianteVista: vistaVariante }
  }
  const toqueVersao = (v: VersaoDoDia14) => (): void => {
    if (pergunta.tipo !== 'versoes') return
    const { resposta, n, tituloVisto } = pedidoDaVersao(v, pergunta)
    // Tocar na resposta que já vale não muda nada: só fecha, como "Manter a resposta atual".
    if (mudar && versaoAtual?.n === v.n) { sair(); return }
    const p = base(resposta, n, tituloVisto)
    if (p) void enviar(p, `v${v.n}`, v)
  }
  const toqueOutra = (resposta: RespostaSemVencedor) => (): void => {
    if (outraAtual(resposta)) { sair(); return }
    const p = base(resposta, null)
    if (p) void enviar(p, resposta, null)
  }

  // D-7(g): "Registrado: …" (ou "Registrado depois do prazo: …") para quem ouve; a tela mostra a frase do resultado.
  const confirmacao = (original: boolean, letra: string): string => (linha.estado === 'sem_resposta'
    ? (original ? FRASES.respondido.registradaTardiaOriginal : FRASES.respondido.registradaTardiaVersao(letra))
    : (original ? FRASES.respondido.registradaOriginal : FRASES.respondido.registradaVersao(letra)))

  if (tela.t === 'no_ar') {
    return (
      <section className="cn-d14" aria-labelledby={idQ}>
        <div className="cn-d14-res"><SeloCaminho tipo="ok">{tela.original ? FRASES.dia14.seloOriginal : FRASES.dia14.seloNoAr(tela.letra)}</SeloCaminho></div>
        <p className="cn-d14-q3" id={idQ} ref={resultadoRef} tabIndex={-1}>{tela.original ? FRASES.dia14.fraseOriginal(versoes.length) : FRASES.dia14.fraseNoAr(tela.letra)}</p>
        <p className="cn-meta">{FRASES.dia14.oficial}</p>
        <p className="cn-sr" role="status">{confirmacao(tela.original, tela.letra)}</p>
      </section>
    )
  }
  if (tela.t === 'sem_vencedor') {
    const frase = FRASES.dia14.registrada[tela.resposta]
    return (
      <section className="cn-d14" aria-labelledby={idQ}>
        <div className="cn-d14-res"><SeloCaminho tipo="mute-neq">{FRASES.dia14.seloSemVencedor[tela.resposta]}</SeloCaminho></div>
        <p className="cn-d14-q3" id={idQ} role="status" ref={resultadoRef} tabIndex={-1}>{frase}</p>
        <p className="cn-meta">{FRASES.resposta.apoioSemVencedor}</p>
      </section>
    )
  }
  if (tela.t === 'diferentes') {
    return (
      <section className="cn-d14" aria-labelledby={idQ}>
        <div className="cn-d14-res"><SeloCaminho tipo="mute-neq">{FRASES.dia14.respostasDiferentes}</SeloCaminho></div>
        <p className="cn-d14-q3" id={idQ} ref={resultadoRef} tabIndex={-1}>{FRASES.dia14.respostasDiferentesFrase}</p>
      </section>
    )
  }
  if (tela.t === 'mudada') {
    return (
      <section className="cn-d14" aria-labelledby={idQ}>
        <p className="cn-d14-q3" id={idQ} role={acoes.anunciar ? undefined : 'status'} ref={resultadoRef} tabIndex={-1}>{tela.texto}</p>
      </section>
    )
  }

  const semVersoes = pergunta.tipo === 'sem_versoes'
  const rotuloGrupo = semVersoes ? (mudar ? FRASES.dia14.mudarPara : FRASES.dia14.suaResposta) : FRASES.dia14.outra
  const apoio = semVersoes ? FRASES.dia14.apoioSemVersoes
    : derivada ? (pergunta.originalConhecido ? FRASES.dia14.apoioDerivada : FRASES.dia14.apoioDerivadaSemOriginal)
      : FRASES.dia14.apoio(confirmadoEm ? new Date(confirmadoEm) : null)
  const rotuloDe = (v: VersaoDoDia14): string =>
    v.original ? FRASES.dia14.originalFicou
      : derivada && !(pergunta.tipo === 'versoes' && pergunta.originalConhecido) ? FRASES.dia14.ficou(v.letra)
        : FRASES.dia14.venceu(v.letra)
  const outraAtual = (r: RespostaSemVencedor): boolean => mudar && vistaResposta === r
  const sc = tela.t === 'sem_conexao' ? tela : null

  return (
    <section
      className="cn-d14" {...(semVersoes ? { 'aria-label': rotuloGrupo.replace(/:$/, '') } : { 'aria-labelledby': idQ })}
      onKeyDown={mudar ? (e) => { if (e.key === 'Escape' && !ocupado) { e.stopPropagation(); sair() } } : undefined}
    >
      {semVersoes ? null : <h3 id={idQ} ref={tituloRef} tabIndex={-1}>{FRASES.dia14.pergunta}</h3>}
      {/* Sem versões não há título: o apoio recebe o foco ao abrir o modo mudar; o nome da seção é o rótulo curto do grupo. */}
      <p className="cn-meta" {...(semVersoes ? { ref: apoioRef, tabIndex: -1 } : {})}>{apoio}</p>
      {tardia ? <p className="cn-meta">{tardia}</p> : null}
      <p className="cn-meta cn-d14-aviso">{mudar ? FRASES.dia14.avisoMudar : FRASES.dia14.avisoResponder}</p>
      {semVersoes ? null : (
        <div
          className="cn-d14-grid" role="group" aria-label={FRASES.dia14.versoes} aria-busy={ocupado ? 'true' : undefined}
          data-n={versoes.length} data-derivada={derivada ? '' : undefined} style={{ '--n': versoes.length } as CSSProperties}
        >
          {versoes.map((v) => {
            const atual = versaoAtual?.n === v.n
            const resposta = pedidoDaVersao(v, pergunta as Extract<PerguntaDoDia14, { tipo: 'versoes' }>).resposta
            return (
              <button
                key={v.letra} type="button" className="cn-d14-vopt" disabled={ocupado} aria-disabled={ocupado || undefined}
                aria-pressed={mudar ? atual : undefined} data-resposta={resposta} data-atual={atual ? '' : undefined} onClick={toqueVersao(v)}
              >
                {comMiniatura
                  ? (v.imagem && semImagem.has(v.n)
                    ? <span className="cn-d14-th cn-d14-ph fail" role="img" aria-label={FRASES.ficha.imagemNaoCarregou}><Icone nome="warn" /> {FRASES.ficha.imagemNaoCarregou}</span>
                    : v.imagem
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img className="cn-d14-th" src={v.imagem.url} alt="" referrerPolicy="no-referrer" onError={() => setSemImagem((a) => new Set(a).add(v.n))} />
                    : <span className="cn-d14-th cn-d14-ph" data-testid="miniatura-nao-medida"><span className="cn-nm">{FRASES.dia14.naoMedido}</span></span>)
                  : null}
                <span className="cn-d14-tx">
                  <span className="cn-d14-top"><ChipVersao letra={v.letra} />{v.titulo ? <q title={v.titulo}>{v.titulo}</q> : null}</span>
                  <span className="cn-d14-lbl">
                    {tocado === `v${v.n}` ? FRASES.dia14.salvando : atual ? <><span aria-hidden="true">✓ </span>{FRASES.dia14.suaRespostaCartao}</> : rotuloDe(v)}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
      <div className="cn-d14-other" role="group" aria-label={rotuloGrupo.replace(/:$/, '')} aria-busy={ocupado ? 'true' : undefined}>
        <span>{rotuloGrupo}</span>
        {OUTRAS.map((o) => (
          <button
            key={o.resposta} type="button" className="cn-btn" disabled={ocupado} aria-disabled={ocupado || undefined}
            aria-pressed={mudar ? outraAtual(o.resposta) : undefined} data-resposta={o.resposta} onClick={toqueOutra(o.resposta)}
          >
            {tocado === o.resposta ? FRASES.dia14.salvando : <>{outraAtual(o.resposta) ? <span aria-hidden="true">✓ </span> : null}{o.rotulo}</>}
          </button>
        ))}
      </div>
      {mudar ? <button type="button" className="cn-lnk cn-d14-manter" disabled={ocupado} aria-disabled={ocupado || undefined} onClick={sair}>{FRASES.dia14.manter}</button> : null}
      {tela.t === 'mudou' ? (
        <div ref={alertaRef} tabIndex={-1}>
          <FaixaCaminho
            tom="warn" role="alert" titulo={tela.ja ? FRASES.respondido.jaTinhaRespondido : FRASES.guarda.estadoMudou}
            acoes={<button type="button" className="cn-btn" onClick={() => acoes.atualizar()}>{FRASES.guarda.atualizar}</button>}
          />
        </div>
      ) : null}
      {tela.t === 'erro' ? <p className="cn-errl" role="alert" ref={alertaRef} tabIndex={-1}>{tela.texto}</p> : null}
      {sc ? (
        <div className="cn-errl" role="alert" ref={alertaRef} tabIndex={-1}>
          <b>{mudar ? FRASES.dia14.semConexaoMudar : FRASES.dia14.semConexao}</b>{' '}
          <button type="button" className="cn-lnk" disabled={ocupado} aria-disabled={ocupado || undefined} onClick={() => { void enviar(sc.pedido, sc.toque, sc.versao) }}>{FRASES.dia14.tentarDeNovo}</button>
        </div>
      ) : null}
    </section>
  )
}

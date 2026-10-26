'use client'

// Teste v2 concluído pela regra (S8-F4 T12, T7): resumo, desfecho, régua final e placar. Aplicar e Voltar à original só reusam as actions.
// Sucesso = `resultado === 'feito'` (precisa_confirmar também é ok:true e NÃO é sucesso).
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AbTestDetailView } from '@/lib/youtube/ab-types'
import type { TelaV2 } from '@/lib/youtube/ab-gravacao/tela-v2'
import { MSG_EM_ANDAMENTO, MSG_FALHA_SAIDA, MSG_MUDOU, MSG_OUTRO_TESTE, type ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'
import { DetailHeader } from './detail-header'
import { ResumoV2, PisosV2, DesfechoV2, type AcaoEmCurso } from './blocos-v2'
import { PlacarDoTeste } from './placar-do-teste'
import { AbConfirmarDialog } from './ab-confirmar-dialog'
import { AbConfirmarTrocaDialog } from './ab-confirmar-troca-dialog'
import { dadosDoDialogoEncerrar, dataCurtaSp } from './encerrar-props'
import type { CampoNome } from '@/lib/youtube/ab-restore'

type Concluido = Extract<TelaV2, { fase: 'concluido' }>
type Pendencia = Array<{ campo: CampoNome; valor_atual: string }>

export interface ConcluidoV2DetailProps {
  view: AbTestDetailView & { v2: Concluido }
  /** `aplicarSugerido` com o id do teste, montada em page.tsx (nunca importada aqui). */
  aplicar: (varianteId: string, seqVisto: number, forcar?: boolean) => Promise<ResultadoAcaoSaida>
  /** `revertWinner` com o id do teste, idem. */
  voltar: (seqVisto: number) => Promise<ResultadoAcaoSaida>
}

const MSG_RECARREGUE = 'O teste mudou desde que você abriu a página. Recarregue para ver o estado atual.'
const MSG_PRAZO_VOLTAR = 'O prazo de 7 dias para voltar acabou.'
const MSG_SEM_RESPOSTA = 'Sem resposta do servidor. Recarregue para ver o que está no ar.'
const MSG_VOLTA_NAO_CONCLUIDA = 'Não consegui concluir a volta. Recarregue a página para ver o estado atual.'
const msgFalha = (tipo: 'aplicar' | 'voltar', letra: string): string =>
  tipo === 'aplicar' ? `Não consegui aplicar ${letra}. A original continua no ar.` : `Não consegui voltar à original. ${letra} continua no ar.`

/** Texto do que muda no YouTube, conforme o que o teste varia (miniatura, título ou os dois). */
function oQueMuda(flag: string, volta: boolean): string {
  if (flag === 'combo') return volta ? 'A miniatura e o título voltam a ser os de A agora no YouTube.' : 'A miniatura e o título mudam agora.'
  if (flag === 'title') return volta ? 'O título volta a ser o de A agora no YouTube.' : 'O título muda agora.'
  return volta ? 'A miniatura volta a ser a de A agora no YouTube.' : 'A miniatura muda agora no YouTube.'
}

/** Segunda linha do diálogo de aplicar: estado do desfecho e, na reaplicação, a nova janela de 7 dias. */
function notaAplicar(deNovo: boolean, provisorio: boolean): string | null {
  const desfecho = provisorio ? 'O desfecho ainda é provisório.' : deNovo ? 'Este desfecho já não muda.' : null
  const janela = deNovo ? 'A janela de 7 dias para voltar recomeça hoje.' : null
  return [desfecho, janela].filter(Boolean).join(' ') || null
}

type Dialogo = null | 'aplicar' | 'voltar' | 'troca'

export function ConcluidoV2Detail({ view, aplicar, voltar }: ConcluidoV2DetailProps) {
  const router = useRouter()
  const tela = view.v2
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<{ texto: string; recarregar: boolean; prazo: boolean } | null>(null)
  const [pendencia, setPendencia] = useState<Pendencia | null>(null)
  const [acao, setAcao] = useState<AcaoEmCurso | null>(null)
  const [focoNoAr, setFocoNoAr] = useState(false)
  const [isPending, startTransition] = useTransition()
  const voo = useRef(false)
  const noArRef = useRef<HTMLDivElement>(null)

  // Y9: o foco vai para a linha "No ar agora" quando o refresh termina (a linha já é a nova).
  useEffect(() => {
    if (focoNoAr && !isPending) {
      noArRef.current?.focus()
      setFocoNoAr(false)
    }
  }, [focoNoAr, isPending])

  // M1: depois do refresh (restoreSeq novo) o erro da leitura velha não vale mais.
  useEffect(() => { setAcao(null) }, [view.restoreSeq])

  const fechar = useCallback(() => { setDialogo(null); setErro(null); setPendencia(null) }, [])
  const recarregar = useCallback(() => { router.refresh(); fechar(); setAcao(null) }, [router, fechar])

  const revertExpiresAt = 'revertExpiresAt' in view ? (view.revertExpiresAt ?? null) : null

  const alvo = tela.aplicar ?? tela.aplicarDeNovo
  const deNovo = tela.aplicar === null && tela.aplicarDeNovo !== null
  const letraAlvo = alvo?.letra ?? ''
  const letraNoAr = tela.noAr.tipo === 'aplicada' ? tela.noAr.letra : ''

  // `forcar` (diálogo "mesmo assim") mostra erro dentro do diálogo; o resto fecha o diálogo e mostra espera/erro na página.
  const executar = useCallback(async (tipo: 'aplicar' | 'voltar', forcar: boolean) => {
    if (voo.current) return
    const naPagina = !forcar
    const falhar = (e: { texto: string; recarregar: boolean; prazo: boolean }, tentar = false) => {
      if (naPagina) setAcao({ tipo, fase: 'erro', texto: e.texto, recarregar: e.recarregar, tentar })
      else setErro(e)
    }
    if (naPagina) setDialogo(null)
    if (tipo === 'voltar' && revertExpiresAt && Date.parse(revertExpiresAt) <= Date.now()) {
      falhar({ texto: MSG_PRAZO_VOLTAR, recarregar: true, prazo: true })
      return
    }
    if (tipo === 'aplicar' && !alvo) return
    voo.current = true
    setEnviando(true)
    setErro(null)
    if (naPagina) setAcao({ tipo, fase: 'enviando' })
    try {
      let r: ResultadoAcaoSaida
      try {
        r = tipo === 'aplicar'
          ? (forcar ? await aplicar(alvo!.variant_id, view.restoreSeq, true) : await aplicar(alvo!.variant_id, view.restoreSeq))
          : await voltar(view.restoreSeq)
      } catch {
        // Exceção = a ação pode ter chegado ao servidor: não afirma o que está no ar nem repete às cegas.
        falhar({ texto: MSG_SEM_RESPOSTA, recarregar: true, prazo: false })
        return
      }
      if (r.ok && r.resultado === 'feito') {
        fechar()
        setAcao(null)
        setFocoNoAr(true)
        startTransition(() => router.refresh())
        return
      }
      if (r.ok && r.resultado === 'precisa_confirmar' && tipo === 'aplicar') {
        setAcao(null)
        setPendencia(r.campos)
        setDialogo('troca')
        return
      }
      if (r.ok) { falhar({ texto: tipo === 'voltar' ? MSG_VOLTA_NAO_CONCLUIDA : MSG_RECARREGUE, recarregar: true, prazo: false }); return }
      if (r.resultado === 'ja_encerrado') {
        falhar({ texto: r.error === MSG_OUTRO_TESTE ? r.error : MSG_RECARREGUE, recarregar: true, prazo: false })
        return
      }
      if (r.resultado === 'mudou') { falhar({ texto: MSG_MUDOU, recarregar: true, prazo: false }); return }
      if (r.resultado === 'em_andamento') { falhar({ texto: MSG_EM_ANDAMENTO, recarregar: false, prazo: false }, true); return }
      // Só a falha genérica do servidor repete (M5); o resto (sem permissão, volta ilegível, pedido inválido) não muda ao repetir.
      if (r.resultado === 'erro' && r.error === MSG_FALHA_SAIDA) {
        falhar({ texto: msgFalha(tipo, tipo === 'aplicar' ? letraAlvo : letraNoAr), recarregar: !naPagina, prazo: false }, true)
        return
      }
      falhar({ texto: r.error, recarregar: r.resultado === 'erro', prazo: false })
    } finally {
      voo.current = false
      setEnviando(false)
    }
  }, [aplicar, voltar, alvo, letraAlvo, letraNoAr, view.restoreSeq, revertExpiresAt, router, fechar])

  // O foco volta ao botão de tentar de novo quando o erro aparece na página.
  const tentarRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (acao?.fase === 'erro') tentarRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [acao])

  const { opcoes } = dadosDoDialogoEncerrar(view)
  const opcao = alvo ? opcoes.find(o => o.id === alvo.variant_id) ?? null : null
  const concluidoEm = view.completedAt ? dataCurtaSp(view.completedAt).slice(0, 5) : undefined
  const provisorio = tela.selo.tipo === 'vence' && tela.selo.provisorio

  return (
    <div data-testid="concluido-v2-detail">
      <div data-section="header">
        <DetailHeader
          title={view.videoTitle}
          flag={view.flag}
          status={view.status}
          roundNumber={1}
          totalRounds={view.totalRounds}
          hasPlayoff={view.hasPlayoff}
          lab={{ thumbUrl: view.variantThumbs.find(t => t.isOriginal)?.thumbUrl ?? view.variantThumbs[0]?.thumbUrl ?? null, concluidoEm }}
        />
      </div>

      <div className="cn-raiz pv2 mb-[8px]" data-testid="tela-v2">
        <ResumoV2 frase={tela.frase} />
        <div ref={tentarRef} style={{ display: 'contents' }}>
        <DesfechoV2
          tela={tela}
          acao={acao}
          atualizando={isPending}
          onTentarAcao={() => { if (acao) void executar(acao.tipo, false) }}
          onRecarregar={recarregar}
          noArRef={noArRef}
          onAplicar={() => { setErro(null); setDialogo('aplicar') }}
          onVoltar={() => { setErro(null); setDialogo('voltar') }}
          onTentarDeNovo={() => router.refresh()}
        />
        </div>
        {tela.pisos ? <PisosV2 linhas={tela.pisos} n={tela.n} final /> : null}
      </div>

      <section data-section="variant-performance" className="mb-[24px]">
        <PlacarDoTeste
          placar={view.placar ?? null}
          faixaDias={view.faixa_dias ?? []}
          variants={view.variants}
          variantDb={view.variantDb}
          thumbs={view.variantThumbs}
          videoTitle={view.videoTitle}
          status={view.status}
          modoV2
        />
      </section>

      {dialogo === 'aplicar' && alvo ? (
        <AbConfirmarDialog
          titulo={deNovo ? `Aplicar ${alvo.letra} de novo?` : `Aplicar ${alvo.letra} ao vídeo?`}
          lead={oQueMuda(view.flag, false)}
          nota={notaAplicar(deNovo, provisorio)}
          rotuloConfirmar={`Aplicar ${alvo.letra}`}
          enviando={enviando}
          erro={null}
          acaoSegura={null}
          onVoltar={fechar}
          onConfirmar={() => { void executar('aplicar', false) }}
        />
      ) : null}
      {dialogo === 'voltar' ? (
        <AbConfirmarDialog
          titulo="Voltar à original (A)?"
          lead={oQueMuda(view.flag, true)}
          nota="O resultado do teste não muda e continua visível aqui."
          rotuloConfirmar="Sim, voltar à original"
          enviando={enviando}
          erro={null}
          acaoSegura={null}
          onVoltar={fechar}
          onConfirmar={() => { void executar('voltar', false) }}
        />
      ) : null}
      {dialogo === 'troca' && pendencia && opcao && alvo ? (
        <AbConfirmarTrocaDialog
          campos={pendencia}
          opcao={opcao}
          rotuloConfirmar={`Aplicar ${alvo.letra} mesmo assim`}
          enviando={enviando}
          erro={erro?.texto}
          acaoSegura={erro?.recarregar ? { rotulo: 'Recarregar', onClick: recarregar } : null}
          onVoltar={fechar}
          onConfirmar={() => { void executar('aplicar', true) }}
        />
      ) : null}
    </div>
  )
}

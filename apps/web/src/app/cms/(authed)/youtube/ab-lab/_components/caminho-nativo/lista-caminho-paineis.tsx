'use client'
// Liga a lista aos painéis. `painel` e `responder` são funções, e função não atravessa a fronteira servidor -> cliente:
// por isso esta casca cliente os fornece à `ListaCaminho` que o servidor monta.
// `painel` vista 'ficha' = `FichaTeste` (T8; Studio/confirmar (T9a) e faixas/lembrete/pausa (T9b) entram pela `FichaComStudio`);
// vista 's7' = cartão S7 (T10: `CartaoTesteYoutube`); `responder` = "Responder" do dia 14 (T10b).
import { useContext, useEffect, useRef, useState, type ReactElement } from 'react'
import type { FichaLida } from '@/lib/youtube/teste-youtube/nativo/ficha'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import { FaixaCaminho } from './faixa-caminho'
import type { EncaixesFicha, FichaTesteProps } from './ficha-teste'
import { FichaComStudio, type AcoesFichaStudio } from './ficha-com-studio'
import { ContextoAssistente } from './assistente-contexto'
import { useDrenarFilaLembrete } from './fila-lembrete'
import { ListaCaminho, type AcoesCaminho, type ListaCaminhoProps, type SlotPainel } from './lista-caminho'
import { CartaoTesteYoutube } from './cartao-teste-youtube'

type Estado = { t: 'carregando' } | { t: 'erro' } | { t: 'ok'; ficha: FichaLida }

/** Registro visto de fora (ainda não confirmado) no vídeo: a faixa `0c` da ficha. */
const registroDetectado = (l: LinhaDoCaminho): { primeiraVista: string } | null =>
  l.registro && l.registro.confirmadoEm === null && l.registro.primeiraVista ? { primeiraVista: l.registro.primeiraVista } : null

/** Abre a ficha do vídeo: lê a aberta mais recente (vencida inclusive, só para consulta) e só cria uma nova se não existe nenhuma. */
function PainelFicha({ l, acoes, fechar, encaixes, entrada }: {
  l: LinhaDoCaminho; acoes: AcoesCaminho; fechar: () => void; encaixes?: EncaixesFicha; entrada?: FichaTesteProps['entrada']
}): ReactElement {
  const [est, setEst] = useState<Estado>({ t: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  const raiz = useRef<HTMLDivElement>(null)
  const ctrl = useContext(ContextoAssistente)

  useEffect(() => {
    let vivo = true
    setEst({ t: 'carregando' })
    void (async () => {
      try {
        const lida = await acoes.lerFichaDoVideo(l.videoId)
        if (!lida.ok) throw new Error('leitura')
        let ficha = lida.ficha
        if (!ficha) {
          const aberta = await acoes.abrirFicha(l.videoId)
          if (!aberta.ok) throw new Error('abrir')
          ficha = aberta.ficha
        }
        if (vivo) setEst({ t: 'ok', ficha })
      } catch {
        if (vivo) setEst({ t: 'erro' })
      }
    })()
    return () => { vivo = false }
  }, [acoes, l.videoId, tentativa])

  // O foco estava no h2 do esqueleto; ao chegar a ficha o h2 é outro elemento.
  useEffect(() => {
    if (est.t !== 'ok') return
    const ativo = document.activeElement
    if (!ativo || ativo === document.body || !raiz.current?.contains(ativo)) raiz.current?.querySelector<HTMLElement>('h2[tabindex="-1"]')?.focus()
  }, [est.t])

  if (est.t === 'ok') {
    return (
      <div ref={raiz}>
        <FichaComStudio
          key={est.ficha.id} linha={l} inicial={est.ficha} acoes={acoes as AcoesFichaStudio} fechar={fechar} encaixes={encaixes}
          entrada={{ registroDetectado: registroDetectado(l), ...entrada }}
          aoRecomecar={(nova) => setEst({ t: 'ok', ficha: nova })}
          aoRegistrar={ctrl.atualizar}
          aoRecarregar={ctrl.atualizar}
          aoAtualizar={() => { ctrl.atualizar(); setTentativa((x) => x + 1) }}
        />
      </div>
    )
  }
  return (
    <div ref={raiz} aria-busy={est.t === 'carregando'}>
      <h2 tabIndex={-1} className="cn-titulo">{l.titulo}</h2>
      {est.t === 'carregando'
        ? <p className="cn-meta" role="status">{FRASES.ficha.carregandoMeta}</p>
        : (
          <FaixaCaminho
            tom="err" role="alert" titulo={FRASES.ficha.erroAbrir}
            acoes={(
              <>
                <button type="button" className="cn-btn pri" onClick={() => setTentativa((x) => x + 1)}>{FRASES.ficha.tentarDeNovo}</button>
                <button type="button" className="cn-btn" onClick={fechar}>{FRASES.ficha.fechar}</button>
              </>
            )}
          />
        )}
    </div>
  )
}

/** Títulos do registro para o cartão: os do registrador; senão os das versões (quando há); senão nenhum (nada é inventado). */
function titulosDoRegistro(r: NonNullable<LinhaDoCaminho['registro']>): string[] {
  if (r.variantesTitulo && r.variantesTitulo.length > 0) return r.variantesTitulo
  return (r.variantes ?? []).map((v) => v.titulo).filter((t): t is string => t !== null)
}

/** Painel S7 (T10): o cartão do teste do YouTube do vídeo, com as actions que chegam por props. */
function PainelS7({ l, acoes, fechar, agora }: { l: LinhaDoCaminho; acoes: AcoesCaminho; fechar: () => void; agora?: () => Date }): ReactElement {
  const ctrl = useContext(ContextoAssistente)
  const r = l.registro
  return (
    <div>
      <h2 tabIndex={-1} className="cn-titulo">{l.titulo}</h2>
      {r ? (
        <CartaoTesteYoutube
          registro={{
            id: r.id, updatedAt: r.updatedAt, confirmadoEm: r.confirmadoEm, primeiraVista: r.primeiraVista,
            ultimaVista: r.ultimaVista ?? null, variantesTitulo: titulosDoRegistro(r), votosTitulo: r.votosTitulo ?? null,
          }}
          labPausadoAte={l.labPausadoAte}
          acoes={acoes}
          agora={agora}
          aoAtualizar={ctrl.atualizar}
          aoLiberado={fechar}
        />
      ) : null}
      <button type="button" className="cn-btn" onClick={fechar}>{FRASES.ficha.fechar}</button>
    </div>
  )
}

export function ListaCaminhoComPaineis(props: Omit<ListaCaminhoProps, 'painel' | 'responder'>): ReactElement {
  // Fila offline do "Lembrar no computador": drena ao montar a lista, em `online` e em `visibilitychange` visível.
  useDrenarFilaLembrete((id) => props.acoes.lembrarNoComputador(id), props.agora)
  const painel: SlotPainel = (l, c) => (
    c.vista === 'ficha'
      ? <PainelFicha l={l} acoes={props.acoes} fechar={c.fechar} />
      : <PainelS7 l={l} acoes={props.acoes} fechar={c.fechar} agora={props.agora} />
  )
  return <ListaCaminho {...props} painel={painel} />
}

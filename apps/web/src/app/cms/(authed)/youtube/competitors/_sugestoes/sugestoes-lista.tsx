'use client'
// Lista "Sugestões" (F3 T5). Linhas e N vêm SEMPRE da prop (estado-da-lista.ts); o que a pessoa fez fica no reducer.
// Toda troca por largura é CSS em @container sobre `.sg` (sem hook de largura). As ações chegam por prop.
import { useEffect, useReducer, useRef, useState, useTransition, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import CmsLink from '../../../_shared/cms-link'
import { contagens, estadoInicial, reduzirLista, vistaVisivel } from './estado-da-lista'
import { Ic } from './icones'
import { Confirmacao, Linha } from './linha'
import type { AcoesDaLista, MotivoDaTela } from './tipos'
import { VazioDaLista } from './vazio'
import { filtrarVista, type FiltroDaLista, type LinhaDaVista, type VistaDaLista } from './view-model'
import './sugestoes.css'

const TEMPO_LIMITE_MS = 15_000
const RECOLHE_MS = 5_000
const POR_PAGINA_NO_CELULAR = 10
const LINHAS_NO_BLOCO = 3

/** GET manual na própria página: redirect (resposta opaca) = sessão expirada; erro de rede ou resposta normal = não é sessão. */
async function sessaoExpirou(): Promise<boolean> {
  try {
    const r = await fetch(window.location.pathname, { method: 'HEAD', redirect: 'manual', credentials: 'same-origin', cache: 'no-store' })
    return r.type === 'opaqueredirect'
  } catch { return false }
}
async function redeResponde(): Promise<boolean> {
  try { await fetch(window.location.pathname, { method: 'HEAD', credentials: 'same-origin', cache: 'no-store' }); return true } catch { return false }
}

interface Ancora { linha: LinhaDaVista; indice: number }

export type PropsDaSugestoesLista = { vista: VistaDaLista; acoes: AcoesDaLista | null } & ({ modo: 'pagina'; verTodasHref?: string } | { modo: 'bloco'; verTodasHref: string })

export function SugestoesLista(p: PropsDaSugestoesLista) {
  const { acoes, modo } = p
  const router = useRouter()
  const [estado, dispatch] = useReducer(reduzirLista, undefined, estadoInicial)
  // Última leitura boa: atualizada durante o render (sem efeito, sem evento); entra em vistaVisivel só como parâmetro.
  const ultimaBoa = useRef<VistaDaLista | null>(null)
  if (p.vista.n !== null) ultimaBoa.current = p.vista
  const visivel = vistaVisivel(p.vista, estado, ultimaBoa.current)

  const [filtro, setFiltro] = useState<FiltroDaLista>(p.vista.filtro?.atual ?? 'todas')
  // O filtro escolhido sobrevive à queda de N: se o servidor deixou de mandar `filtro` (N <= 8), a escolha da pessoa continua valendo.
  const comFiltroLocal: VistaDaLista = modo === 'pagina' && visivel.filtro === null && filtro !== 'todas' && visivel.completas.length > 0
    ? { ...visivel, filtro: { atual: filtro, contagens: contagens(visivel.completas) } }
    : visivel
  const mostrada = comFiltroLocal.filtro !== null && modo === 'pagina' ? filtrarVista(comFiltroLocal, filtro) : comFiltroLocal
  const vivas = modo === 'bloco' ? mostrada.linhas.slice(0, LINHAS_NO_BLOCO) : mostrada.linhas

  const [aberta, setAberta] = useState<string | null>(null)
  const [infoId, setInfoId] = useState<string | null>(null)
  const [expId, setExpId] = useState<string | null>(null)
  const [metodo, setMetodo] = useState(false)
  const [mais, setMais] = useState(false)
  const [recolhidas, setRecolhidas] = useState<ReadonlySet<string>>(new Set())
  const [recarregando, recarregar] = useTransition()
  const gatilho = useRef<HTMLElement | null>(null)
  const raiz = useRef<HTMLElement | null>(null)
  const resumoRef = useRef<HTMLParagraphElement | null>(null)
  const ancoras = useRef(new Map<string, Ancora>())
  const ordem = useRef<string[]>([])
  ordem.current = vivas.map((l) => l.id)
  const foco = useRef<string | null>(null)
  const voo = useRef(0)
  const seq = useRef(0)
  const agendadas = useRef(new Set<string>())
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  useEffect(() => { if (new URLSearchParams(window.location.search).get('mais') === '1') setMais(true) }, [])
  // O aviso do sino (`de`/`aviso`) vale só para a 1ª renderização: sem isso, dispensar ou F5 refaria a faixa "algumas saíram". replaceState não pede nada ao servidor.
  useEffect(() => {
    if (modo !== 'pagina') return
    const u = new URL(window.location.href)
    if (!u.searchParams.has('de') && !u.searchParams.has('aviso')) return
    u.searchParams.delete('de'); u.searchParams.delete('aviso')
    window.history.replaceState(window.history.state, '', u.pathname + u.search)
  }, [modo])
  // A atualização do servidor pode devolver a URL sem `?filtro`: reaplica a escolha da pessoa.
  useEffect(() => {
    if (modo !== 'pagina' || filtro === 'todas') return
    const u = new URL(window.location.href)
    if (u.searchParams.get('filtro') === filtro) return
    u.searchParams.set('filtro', filtro)
    window.history.replaceState(window.history.state, '', u.pathname + u.search)
  }, [modo, filtro, visivel.n])
  useEffect(() => () => { for (const t of timers.current) clearTimeout(t) }, [])

  // Confirmação: recolhe 5 s depois; o foco vai à próxima linha (ou à frase-resumo) no momento da resposta.
  useEffect(() => {
    for (const id of estado.respondidas.keys()) {
      if (agendadas.current.has(id)) continue
      agendadas.current.add(id)
      const t = setTimeout(() => { timers.current.delete(t); setRecolhidas((r) => new Set(r).add(id)) }, RECOLHE_MS)
      timers.current.add(t)
    }
    const alvo = foco.current
    if (alvo === null) return
    foco.current = null
    if (alvo === '') { resumoRef.current?.focus(); return }
    const el = Array.from(raiz.current?.querySelectorAll<HTMLElement>('[data-row]') ?? []).find((x) => x.getAttribute('data-row') === alvo)
    el?.focus()
  }, [estado.respondidas])

  function dispensar(linha: LinhaDaVista, motivo: MotivoDaTela) {
    if (acoes === null || voo.current !== 0) return
    const meu = ++seq.current
    voo.current = meu
    const id = linha.id
    ancoras.current.set(id, { linha, indice: Math.max(0, ordem.current.indexOf(id)) })
    dispatch({ tipo: 'iniciar', id, motivo })
    let terminou = false
    const timer = setTimeout(() => { if (terminou) return; if (voo.current === meu) voo.current = 0; dispatch({ tipo: 'falha', id, motivo }) }, TEMPO_LIMITE_MS)
    const fim = () => { terminou = true; clearTimeout(timer); if (voo.current === meu) voo.current = 0 }
    let chamada: Promise<Awaited<ReturnType<AcoesDaLista['dispensar']>>>
    try { chamada = acoes.dispensar(id, motivo) } catch (e) { chamada = Promise.reject(e instanceof Error ? e : new Error('falhou')) }
    chamada.then(
      (resposta) => {
        fim()
        const saiu = resposta.ok || resposta.motivo === 'nao_aberto' || resposta.motivo === 'nao_encontrado'
        if (saiu) { const i = ordem.current.indexOf(id); foco.current = ordem.current[i + 1] ?? '' }
        setAberta(null)
        dispatch({ tipo: 'resposta', id, motivo, resposta })
      },
      () => {
        if (terminou) return
        fim(); setAberta(null)
        // Rejeição pode ser rede caída OU sessão expirada (a ação recebe o redirect do login): a sondagem separa as duas.
        void sessaoExpirou().then((expirou) => dispatch({ tipo: 'falha', id, motivo, causa: expirou ? 'sessao' : undefined }))
      },
    )
  }
  function fecharMotivos() { setAberta(null); gatilho.current?.focus() }
  function aoDispensar(id: string, e: MouseEvent<HTMLButtonElement>) {
    gatilho.current = e.currentTarget
    setAberta((a) => (a === id ? null : id))
  }
  function escolherFiltro(f: FiltroDaLista) {
    setFiltro(f)
    const u = new URL(window.location.href)
    if (f === 'todas') u.searchParams.delete('filtro'); else u.searchParams.set('filtro', f)
    window.history.replaceState(window.history.state, '', u.pathname + u.search)
  }
  function mostrarMais() {
    setMais(true)
    const u = new URL(window.location.href)
    u.searchParams.set('mais', '1')
    router.replace(u.pathname + u.search, { scroll: false })
  }

  // Lista a desenhar: linhas vivas + confirmações nas posições onde as linhas estavam.
  const itens: Array<{ tipo: 'viva'; linha: LinhaDaVista } | { tipo: 'conf'; id: string }> = vivas.map((linha) => ({ tipo: 'viva' as const, linha }))
  const confs = Array.from(ancoras.current.entries())
    .filter(([id]) => estado.respondidas.has(id) && !recolhidas.has(id))
    .sort((a, b) => a[1].indice - b[1].indice)
  confs.forEach(([id, a], k) => { itens.splice(Math.min(a.indice + k, itens.length), 0, { tipo: 'conf', id }) })

  const n = visivel.n
  const nTxt = n === null ? '?' : visivel.calculado === 'Nunca calculado' ? '—' : String(n)
  const Titulo = modo === 'pagina' ? 'h1' : 'h2'
  const semLeitura = n === null
  const vazio = mostrada.vazio !== null && vivas.length === 0 ? mostrada.vazio : null
  const erroSemLista = semLeitura && !vazio
  const verTodas = p.verTodasHref
  const [semRede, setSemRede] = useState(false)
  // Sem rede, `router.refresh` cai para navegação completa e troca a tela pela página de erro do navegador: sonda antes.
  const refaz = () => {
    setSemRede(false)
    void redeResponde().then((ok) => { if (ok) recarregar(() => router.refresh()); else setSemRede(true) })
  }
  const botaoRefazer = <button type="button" className="sg-btn" disabled={recarregando} onClick={refaz}>Tentar de novo</button>
  const f = comFiltroLocal.filtro

  return (
    <section className="sg" data-obs-screen="sugestoes" data-modo={modo} data-mais={mais ? '' : undefined} ref={raiz}>
      {modo === 'pagina' && <p className="sg-crumb">YouTube › Competidores</p>}
      <div className="sg-phd">
        <Titulo>Sugestões <span className="sg-cnt" aria-label={n === null ? 'sugestões: leitura falhou' : `${nTxt} sugestões`}>{nTxt}</span></Titulo>
        <div className="sg-fresh">
          {visivel.velho && <span className="sg-selo sg-warn">{Ic.warn()}Dados velhos</span>}
          {visivel.calculado && <span>{visivel.calculado}</span>}
          <button type="button" className="sg-ib" aria-expanded={metodo} aria-label="Como as sugestões são calculadas" onClick={() => setMetodo((m) => !m)}>i</button>
        </div>
      </div>
      {metodo && (
        <div className="sg-info" style={{ marginTop: 12 }}>
          <h5>Como as sugestões são calculadas</h5>
          <dl>
            <dt>Medida</dt><dd>{vivas[0]?.info.medida ?? 'views por dia na 1ª semana ÷ mediana do canal no mesmo formato'}</dd>
            <dt>Para virar sugestão</dt><dd>{vivas[0]?.info.regra ?? 'regra provisória, versionada'}</dd>
            <dt>Leitura</dt><dd>Pode ajudar. É associação, não causa.</dd>
          </dl>
        </div>
      )}
      <p className="sg-sum" tabIndex={-1} ref={resumoRef}>{semLeitura && !vazio ? 'Não deu para ler as sugestões.' : mostrada.resumo}{modo === 'pagina' && vivas.length > 0 && <small>Da mais forte para a mais fraca.</small>}</p>

      {visivel.faixa && (
        visivel.faixa.tipo === 'erro-com-lista'
          ? <div className="sg-band sg-err" role="alert"><span className="sg-ic">{Ic.warn()}</span><div><h3>{visivel.faixa.titulo}</h3><p>{visivel.faixa.texto}</p><div className="sg-acts">{botaoRefazer}</div></div></div>
          : <div className={`sg-band${visivel.faixa.tipo === 'velho' ? ' sg-warn' : ''}`} role="status">
            <span className="sg-ic">{Ic.warn()}</span>
            <div><h3>{visivel.faixa.titulo}</h3><p>{visivel.faixa.texto}{visivel.faixa.tipo === 'velho' && <>{' '}<CmsLink href="/cms/youtube/competitors" className="sg-lnk">Ver a coleta em Competidores</CmsLink></>}</p></div>
          </div>
      )}

      {semRede && <p className="sg-errl" role="alert">{Ic.warn()}<span>Sem conexão. A tela continua como está; tente de novo quando a rede voltar.</span></p>}

      {modo === 'pagina' && f !== null && (
        <div className="sg-flt" role="group" aria-label="Filtrar por origem">
          {([['todas', 'Todas'], ['destino', 'Destinos'], ['parecido', 'Concorrentes']] as const).map(([k, rot]) => (
            <button key={k} type="button" aria-pressed={filtro === k} onClick={() => escolherFiltro(k)}>{`${rot} (${f.contagens[k]})`}</button>
          ))}
        </div>
      )}

      {itens.length > 0 && (
        <ol className="sg-list">
          {itens.map((it) => it.tipo === 'conf'
            ? <Confirmacao key={it.id} id={it.id} desfecho={estado.respondidas.get(it.id)!} motivo={estado.motivoDe.get(it.id) ?? null} />
            : (
              <Linha
                key={it.linha.id}
                linha={it.linha}
                podeDispensar={acoes !== null}
                aberta={aberta === it.linha.id}
                info={infoId === it.linha.id}
                expandida={expId === it.linha.id}
                salvando={estado.pendente?.id === it.linha.id ? estado.pendente.motivo : null}
                ocupada={estado.pendente !== null}
                erro={estado.erros.get(it.linha.id) ?? null}
                onDispensar={(e) => aoDispensar(it.linha.id, e)}
                onMotivo={(m) => dispensar(it.linha, m)}
                onCancelar={fecharMotivos}
                onInfo={() => setInfoId((x) => (x === it.linha.id ? null : it.linha.id))}
                onExpandir={() => setExpId((x) => (x === it.linha.id ? null : it.linha.id))}
              />
            ))}
        </ol>
      )}
      {modo === 'pagina' && !mais && vivas.length > POR_PAGINA_NO_CELULAR && (
        <div className="sg-vmore"><button type="button" className="sg-btn" onClick={mostrarMais}>{`Mostrar mais (${vivas.length - POR_PAGINA_NO_CELULAR})`}</button></div>
      )}
      {modo === 'bloco' && n !== null && n > LINHAS_NO_BLOCO && (
        <p style={{ marginTop: 12 }}><CmsLink href={verTodas!} className="sg-btn">{`Ver todas (${n})`}</CmsLink></p>
      )}

      {vazio && (
        <VazioDaLista vazio={vazio} modo={modo} verTodasHref={verTodas}
          acao={f !== null && filtro !== 'todas' && vazio.texto === '' && modo === 'pagina'
            ? <button type="button" className="sg-btn" onClick={() => escolherFiltro('todas')}>{`Ver todas (${f.contagens.todas})`}</button>
            : undefined} />
      )}
      {erroSemLista && (
        <VazioDaLista alerta modo={modo} verTodasHref={verTodas}
          vazio={{ familia: 'problema', topo: 'Não deu para ler as sugestões.', titulo: 'A leitura falhou.', texto: 'Nada foi perdido. O número volta quando a leitura der certo.' }}
          acao={botaoRefazer} />
      )}
    </section>
  )
}

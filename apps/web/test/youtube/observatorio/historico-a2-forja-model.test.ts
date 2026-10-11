// @vitest-environment node
/**
 * A2, Tarefa 7: o modelo puro do cartão novo "Leitura da forja" do Histórico (spec 7.1, 7.2, 7.4 e o botão do cabeçalho de 6.5).
 * Cada linha das tabelas 7.2 e 7.4 tem o seu teste, com a frase do spec letra por letra. Dado ausente: cada campo é testado
 * com o valor nulo (leitura sem `sent`, pedido sem horário, leitura sem itens), nunca com um padrão.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { loadOracle, loadOracleOwns, datasetFromOracle, createTestObservatory } from './oracle'
import { plain } from './fase4-world'
import { SHOWCASE } from './forja-scenarios'
import { createObservatory, type Observatory } from '@/lib/youtube/observatorio'
import type { Dataset, ForjaRequest, FrozenReading } from '@/lib/youtube/observatorio/types'
import { buildForjaView } from '@/app/cms/(authed)/youtube/competitors/_chrome/forja-view-model'
import { REQUEST_STATES, ACTIVE_STATES } from '@/lib/youtube/observatorio/forja/states'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { buildForjaCard, headerAsk, type ForjaCardView, type HeaderAskView } from '@/app/cms/(authed)/youtube/competitors/_historico/forja-card-model'

const ID = SHOWCASE
const MIN = 6e4
const READING_ID = 'leitura-video-matt-opus55-20-10'
// as trocas de matt-opus55: title/1 11/10 15h, thumb/1 13/10 12h40, thumb/2 13/10 23h15, desc/1 14/10 15h, thumb/3 18/10 12h14, title/2 18/10 15h
const VAZIO_SPEC = 'Ainda não há leitura deste vídeo. Ninguém pediu uma até hoje.'
const AT_DEPOIS_DA_DESCRICAO = Date.parse('2026-10-14T16:00:00Z')
const AT_ANTES_DA_DESCRICAO = Date.parse('2026-10-14T14:00:00Z')

// O oráculo é lido UMA vez por arquivo (o CI tem limite de 60 s por executor); cada mundo trabalha numa cópia.
let base: Dataset | null = null
const baseDataset = (): Dataset => (base ??= plain(datasetFromOracle(loadOracle())))
function world(mut?: (ds: Dataset) => void): Observatory {
  const ds = plain(baseDataset())
  mut?.(ds)
  return createTestObservatory(ds)
}
/**
 * Com os cenários do gerador de teste a sessão começa vazia (`sem pedido`) e ignora `ds.requests`; os pedidos no formato do
 * banco só aparecem no motor de produção. `worldDb` é esse motor: os pedidos vêm do conjunto, como na tela de verdade.
 */
function worldDb(mut: (ds: Dataset) => void): Observatory {
  const ds = plain(baseDataset())
  mut(ds)
  return createObservatory(ds)
}
// o motor sem mutação serve a todos os testes que só trocam o estado do pedido (session.reset + setBase)
const shared = world()

function forjaOf(obs: Observatory) {
  const v = obs.video(ID)!
  return buildForjaView(obs, { screen: 'historico', niche: v.niche ?? 'todos', videoId: v.id })
}
/** `state`: um cenário do gerador de teste; null = sem pedido; 'db' = os pedidos que o conjunto já traz (sem tocar na sessão). */
function cardOf(obs: Observatory, state: string | null): ForjaCardView {
  if (state !== 'db') {
    obs.forja.session.reset()
    if (state) obs.forja.session.setBase(state, { type: 'leitura-video', video: ID })
  }
  const v = obs.video(ID)!
  return buildForjaCard(obs, v, obs.channel(v.ch)!)!
}
const sharedCard = (state: string | null) => cardOf(shared, state)

/** Um pedido no formato do banco (o que taskRowToRequest devolve), relativo ao NOW do conjunto. */
function dbReq(ds: Dataset, o: Partial<ForjaRequest> & { state: ForjaRequest['state'] }): ForjaRequest {
  return {
    id: 'db-lv-' + o.state, type: 'leitura-video', niche: 'ia', status: 'pending', video: ID, target: { kind: 'video', niche: 'ia', video: ID },
    createdAt: ds.now - 4 * MIN, claimedAt: null, startedAt: null, publishedAt: null, failedAt: null, attempt: 1, refusedReason: null, readingId: null,
    ...o,
  }
}
const withReq = (o: Partial<ForjaRequest> & { state: ForjaRequest['state'] }) => worldDb(ds => { ds.requests.push(dbReq(ds, o)) })
const readingOf = (ds: Dataset): FrozenReading => ds.readings.find(r => r.id === READING_ID)!

/**
 * TODA string que o cartão (ou o botão do cabeçalho) entrega, em qualquer profundidade; só ficam de fora os campos que não são
 * texto de tela (`href`, `id`, `canalId`). Não é uma lista escolhida à mão: campo novo entra na varredura sozinho.
 */
const SEM_TEXTO = new Set(['href', 'id', 'canalId'])
function strings(x: unknown, chave = '', out: string[] = []): string[] {
  if (typeof x === 'string') { if (!SEM_TEXTO.has(chave)) out.push(x) }
  else if (Array.isArray(x)) for (const e of x) strings(e, chave, out)
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) strings(v, k, out)
  return out
}

describe('tabela 7.2: Aguardando', () => {
  it.each([
    ['na fila', 'Aguardando: na fila desde 14:58.'],
    ['trabalhando', 'Aguardando: a forja está escrevendo desde 14:45. Leva de 10 a 25 minutos.'],
    ['nova tentativa', 'Aguardando: o texto citava números que não batem com os dados. A forja tenta de novo às 15:05.'],
    ['liberado pelo vigia', 'Aguardando: o pedido travou e voltou para a fila sozinho, às 14:56.'],
  ])('%s → situação "aguardando" com a frase e a etapa certas', (state, frase) => {
    const c = sharedCard(state)
    expect(c.situacao).toBe('aguardando')
    expect(c.frase).toBe(frase)
    expect(c.etapas).not.toBeNull()
    expect(c.etapas!.map(e => e.label)).toEqual(['Na fila', 'Escrevendo', 'Pronta'])
    expect(c.etapas!.map(e => e.id)).toEqual(['fila', 'escrevendo', 'pronta'])
  })
  it('as etapas: "na fila" e "liberado" ficam em Na fila; "trabalhando" e "nova tentativa" em Escrevendo (D6)', () => {
    const est = (s: string) => sharedCard(s).etapas!.map(e => e.estado)
    expect(est('na fila')).toEqual(['atual', 'futura', 'futura'])
    expect(est('liberado pelo vigia')).toEqual(['atual', 'futura', 'futura'])
    expect(est('trabalhando')).toEqual(['feita', 'atual', 'futura'])
    expect(est('nova tentativa')).toEqual(['feita', 'atual', 'futura'])
  })
  it('o texto das etapas: "em andamento" na atual; o detalhe da nova tentativa em Escrevendo (spec 7.4)', () => {
    expect(sharedCard('na fila').etapas![0]!.texto).toBe('em andamento')
    expect(sharedCard('na fila').etapas![1]!.texto).toBe('')
    expect(sharedCard('nova tentativa').etapas![1]!.texto).toBe('em andamento: o texto citava números que não batem; a forja tenta de novo às 15:05')
  })
  it('a linha do andamento: pedido feito há N min, às HH:MM, e o aviso de que pode sair da página', () => {
    expect(sharedCard('na fila').andamento).toBe('Pedido feito há 4 min, às 14:58. Pode sair desta página: o pedido continua.')
    expect(sharedCard('trabalhando').andamento).toBe('Pedido feito há 21 min, às 14:41. Pode sair desta página: o pedido continua.')
  })
  it('só "na fila", "atrasado", "sem máquina" e "liberado" oferecem Cancelar pedido; escrevendo não', () => {
    expect(['na fila', 'atrasado', 'sem máquina', 'liberado pelo vigia', 'trabalhando', 'nova tentativa'].map(s => sharedCard(s).cancelar))
      .toEqual([true, true, true, true, false, false])
  })
  it('com pedido em andamento não há botão de pedir', () => {
    for (const s of ['na fila', 'trabalhando', 'atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia']) expect([s, sharedCard(s).botao.visivel]).toEqual([s, false])
  })
})

describe('tabela 7.2: Aguardando, com atraso', () => {
  it('atrasado → "Aguardando, com atraso", etapa Na fila em estado "atrasada", com Cancelar pedido', () => {
    const c = sharedCard('atrasado')
    expect(c.situacao).toBe('atrasado')
    expect(c.frase).toBe('Aguardando, com atraso: esperando há 29 min, mais que o normal. Se passar de 15:25, a tela avisa aqui.')
    expect(c.etapas!.map(e => e.estado)).toEqual(['atrasada', 'futura', 'futura'])
    expect(c.etapas![0]!.texto).toBe('em andamento, com atraso')
    expect(c.cancelar).toBe(true)
  })
  it('sem máquina (a forja parada) → a frase com a hora da última consulta, etapa Na fila "atrasada"', () => {
    const c = sharedCard('sem máquina')
    expect(c.situacao).toBe('atrasado')
    expect(c.frase).toBe('Aguardando, com atraso: a forja está desligada ou sem internet desde 12:55. O pedido fica guardado e roda quando ela voltar.')
    expect(c.etapas![0]!.estado).toBe('atrasada')
    expect(c.cancelar).toBe(true)
  })
  it('sem máquina com a forja ligada (24 h sem pegar o pedido): não diz "desligada"', () => {
    const obs = withReq({ state: 'sem máquina', createdAt: shared.NOW - 26 * 60 * MIN })
    const c = cardOf(obs, 'db')
    expect(c.situacao).toBe('atrasado')
    expect(c.frase).toBe('Aguardando, com atraso: esperando há 26 h, mais que o normal. Se passar de 15:25, a tela avisa aqui.')
  })
  it('sem máquina e sem nenhuma consulta registrada: a frase não inventa a hora', () => {
    const obs = worldDb(ds => { ds.queue = { ...ds.queue, lastPollAt: null }; ds.requests.push(dbReq(ds, { state: 'sem máquina' })) })
    expect(cardOf(obs, 'db').frase).toBe('Aguardando, com atraso: a forja está desligada ou sem internet. O pedido fica guardado e roda quando ela voltar.')
  })
})

describe('pedido sem horário: a frase não inventa a hora', () => {
  it('trabalhando sem hora de início', () => {
    const c = cardOf(withReq({ state: 'trabalhando', status: 'running', claimedAt: null, startedAt: null }), 'db')
    expect(c.frase).toBe('Aguardando: a forja está escrevendo. Leva de 10 a 25 minutos.')
    expect(c.etapas!.map(e => e.estado)).toEqual(['feita', 'atual', 'futura'])
  })
  it('liberado sem hora de liberação', () => {
    const c = cardOf(withReq({ state: 'liberado pelo vigia', attempt: 2, releasedAt: null }), 'db')
    expect(c.frase).toBe('Aguardando: o pedido travou e voltou para a fila sozinho.')
  })
  it('nova tentativa sem consulta registrada, ou com a próxima consulta já vencida: "na próxima consulta"', () => {
    const sem = worldDb(ds => { ds.queue = { ...ds.queue, lastPollAt: null }; ds.requests.push(dbReq(ds, { state: 'nova tentativa', attempt: 2 })) })
    expect(cardOf(sem, 'db').frase).toBe('Aguardando: o texto citava números que não batem com os dados. A forja tenta de novo na próxima consulta.')
    expect(cardOf(sem, 'db').etapas![1]!.texto).toBe('em andamento: o texto citava números que não batem; a forja tenta de novo na próxima consulta')
    const vencida = worldDb(ds => { ds.queue = { ...ds.queue, lastPollAt: ds.now - 25 * MIN }; ds.requests.push(dbReq(ds, { state: 'nova tentativa', attempt: 2 })) })
    expect(cardOf(vencida, 'db').frase).toMatch(/A forja tenta de novo na próxima consulta\.$/)
  })
  it('atrasado com a forja sem consulta recente: sem "Se passar de…" quando o prazo já passou', () => {
    const obs = worldDb(ds => { ds.queue = { ...ds.queue, lastPollAt: ds.now - 40 * MIN }; ds.requests.push(dbReq(ds, { state: 'atrasado', createdAt: ds.now - 45 * MIN })) })
    expect(cardOf(obs, 'db').frase).toBe('Aguardando, com atraso: esperando há 45 min, mais que o normal.')
  })
  it('pedido publicado sem hora de publicação: usa a hora da leitura', () => {
    const obs = worldDb(ds => {
      readingOf(ds).generatedAt = ds.now - 5 * MIN
      ds.requests.push(dbReq(ds, { state: 'publicado', status: 'completed', createdAt: ds.now - 25 * MIN, publishedAt: null }))
    })
    expect(cardOf(obs, 'db').frase).toBe('Pronta: leitura publicada às 14:57.')
  })
})

describe('tabela 7.2: Pronta', () => {
  it('publicado → "Pronta: leitura publicada às …", sem etapas', () => {
    const c = sharedCard('publicado')
    expect(c.situacao).toBe('pronta')
    expect(c.frase).toBe('Pronta: leitura publicada às 14:50.')
    expect(c.etapas).toBeNull()
    expect(c.andamento).toBeNull()
    expect(c.acoes).toEqual([])
  })
  it('leitura de outro dia, sem pedido: a frase diz o dia', () => {
    const c = sharedCard(null)
    expect(c.situacao).toBe('pronta')
    expect(c.frase).toBe('Pronta: leitura publicada em 20/10 às 06:10.')
  })
  it('publicado com troca ou vídeo novo depois → "Pronta, mas desatualizada: …" e a ação "Ver as N trocas" que abre a aba Trocas do canal, já no vídeo', () => {
    const obs = world(ds => { readingOf(ds).generatedAt = AT_DEPOIS_DA_DESCRICAO })   // só título e thumbnail saíram depois (I6)
    const v = obs.video(ID)!
    const c = cardOf(obs, null)
    expect(c.situacao).toBe('desatualizada')
    expect(c.frase).toBe('Pronta, mas desatualizada: depois que ela foi escrita, saíram 2 trocas.')
    expect(c.acoes).toEqual([{ id: 'ver-trocas', label: 'Ver as 2 trocas', href: obs.link.canal(v.ch, { tab: 'trocas', video: ID }) }])
    expect(c.acoes[0]!.href).toContain('tab=trocas')
    expect(c.acoes[0]!.href).toContain('video=' + ID)
    expect(c.etapas).toBeNull()
    expect(c.botao.label).toBe('Pedir nova leitura deste vídeo à forja')
    expect(c.leitura!.doSite[0]).toBe('desde então, 2 trocas.')
  })
  it('uma troca só: "saiu 1 troca" e "Ver a troca"', () => {
    const obs = world(ds => { readingOf(ds).generatedAt = createTestObservatory(plain(baseDataset())).changes.filter(c => c.video === ID).sort((a, b) => a.at - b.at).at(-1)!.at - 36e5 })
    const c = cardOf(obs, null)
    expect(c.frase).toBe('Pronta, mas desatualizada: depois que ela foi escrita, saiu 1 troca.')
    expect(c.acoes[0]!.label).toBe('Ver a troca')
  })
  it('a leitura recém-publicada nunca é "desatualizada" (nada saiu depois dela)', () => {
    expect(sharedCard('publicado').situacao).toBe('pronta')
    expect(sharedCard('publicado').leitura!.doSite).toEqual([])
  })
})

describe('tabela 7.2: Precisa de você', () => {
  it('recusado (dado velho) → "Precisa de você: …", sem etapas, ação "Sincronizar este canal"', () => {
    const c = sharedCard('recusado (dado velho)')
    expect(c.situacao).toBe('precisa-de-voce')
    expect(c.frase).toBe('Precisa de você: os dados deste canal são de 23/10, antigos demais para ler.')
    expect(c.etapas).toBeNull()
    expect(c.acoes).toEqual([{ id: 'sincronizar', label: 'Sincronizar este canal', href: '' }])
    expect(c.botao).toMatchObject({ habilitado: false, motivo: 'Sincronize o canal primeiro. Depois, pode pedir de novo.' })
  })
  it('depois de o canal sincronizar: sem a ação, "Pode pedir de novo." e o botão aceso', () => {
    const obs = world(ds => { ds.channels.find(c => c.id === 'matt-wolfe')!.sync.last = ds.now - MIN })
    const c = cardOf(obs, 'recusado (dado velho)')
    expect(c.situacao).toBe('precisa-de-voce')
    expect(c.frase).toBe('Precisa de você: os dados deste canal são de 23/10, antigos demais para ler. Pode pedir de novo.')
    expect(c.acoes).toEqual([])
    expect(c.botao).toMatchObject({ habilitado: true, motivo: null })
  })
  it('recusa sem a data dos dados (a linha do banco não a traz): a frase não inventa a data', () => {
    const c = cardOf(withReq({ state: 'recusado (dado velho)', refusedAt: shared.NOW - 6 * MIN, refusedDataAsOf: null }), 'db')
    expect(c.frase).toBe('Precisa de você: os dados deste canal estão antigos demais para ler.')
  })
})

describe('tabela 7.2: Não deu', () => {
  it('falhou por números que não batem → a frase do spec e a etapa Escrevendo "parou aqui, ao conferir os números"', () => {
    const c = sharedCard('falhou')
    expect(c.situacao).toBe('nao-deu')
    expect(c.frase).toBe('Não deu: o texto citava números que não batem com os dados, em todas as tentativas. Pode pedir de novo.')
    expect(c.etapas!.map(e => e.estado)).toEqual(['feita', 'parou', 'futura'])
    expect(c.etapas![1]).toMatchObject({ label: 'Escrevendo', texto: 'parou aqui, ao conferir os números' })
    expect(c.botao).toMatchObject({ label: 'Pedir de novo', habilitado: true, visivel: true })
  })
  it('falhou por travamento → "Não deu: o pedido travou 3 vezes…" e a etapa Escrevendo "parou aqui"', () => {
    const c = cardOf(withReq({ state: 'falhou', status: 'failed', attempt: 3, failedAt: shared.NOW - 5 * MIN, failReason: 'travou-3x' }), 'db')
    expect(c.situacao).toBe('nao-deu')
    expect(c.frase).toBe('Não deu: o pedido travou 3 vezes. Pode pedir de novo.')
    expect(c.etapas![1]).toMatchObject({ estado: 'parou', texto: 'parou aqui' })
  })
  it('falhou por outro motivo: diz a hora e não mostra o código interno', () => {
    const c = cardOf(withReq({ state: 'falhou', status: 'failed', failedAt: shared.NOW - 5 * MIN, failReason: 'erro-xyz' }), 'db')
    expect(c.frase).toBe('Não deu: o pedido falhou às 14:57. Pode pedir de novo.')
    expect(c.frase).not.toContain('xyz')
    expect(c.etapas![1]).toMatchObject({ estado: 'parou', texto: 'parou aqui' })
  })
  it('falhou sem hora de falha nem motivo: a frase não inventa a hora', () => {
    const c = cardOf(withReq({ state: 'falhou', status: 'failed', failedAt: null, failReason: null }), 'db')
    expect(c.frase).toBe('Não deu: o pedido falhou. Pode pedir de novo.')
  })
  it('falhou e leitura sem evidências → "Escrevendo, parou aqui, ao conferir os números"', () => {
    // publicado agora, mas a leitura chegou sem itens: o texto não tem em que se apoiar
    const obs = worldDb(ds => {
      readingOf(ds).text.items = []; readingOf(ds).generatedAt = ds.now - 5 * MIN
      ds.requests.push(dbReq(ds, { state: 'publicado', status: 'completed', createdAt: ds.now - 25 * MIN, publishedAt: ds.now - 5 * MIN }))
    })
    const c = cardOf(obs, 'db')
    expect(c.situacao).toBe('nao-deu')
    // a leitura publicada hoje gastou o limite do dia: o "Pode pedir de novo." seria falso, a frase diz quando
    expect(c.frase).toBe('Não deu: a leitura saiu sem evidências. Já houve uma leitura deste vídeo hoje. Libera amanhã às 00:00.')
    expect(c.etapas![1]).toMatchObject({ estado: 'parou', texto: 'parou aqui, ao conferir os números' })
    expect(c.botao).toMatchObject({ label: 'Pedir de novo', habilitado: false, por: 'limite' })
  })
  it('leitura sem itens e sem pedido na tela: "Não deu", mas sem etapas (não há pedido)', () => {
    const obs = world(ds => { readingOf(ds).text.items = [] })
    const c = cardOf(obs, null)
    expect(c.situacao).toBe('nao-deu')
    expect(c.frase).toBe('Não deu: a leitura saiu sem evidências. Pode pedir de novo.')
    expect(c.etapas).toBeNull()
    expect(c.botao).toMatchObject({ label: 'Pedir de novo', habilitado: true })
  })
  it('publicado sem nenhuma leitura que se encontre: "Não deu", sem inventar uma leitura', () => {
    const obs = worldDb(ds => { ds.readings = ds.readings.filter(r => r.id !== READING_ID); ds.requests.push(dbReq(ds, { state: 'publicado', status: 'completed', publishedAt: ds.now - 3 * MIN })) })
    const c = cardOf(obs, 'db')
    expect(c.situacao).toBe('nao-deu')
    expect(c.leitura).toBeNull()
    // publicado hoje gasta o limite do dia: o "Pode pedir de novo." seria falso, a frase diz quando
    expect(c.frase).toBe('Não deu: o pedido terminou, mas a leitura não está aqui. Já houve uma leitura deste vídeo hoje. Libera amanhã às 00:00.')
    expect(c.etapas).toBeNull()
  })
})

describe('estados sem pedido', () => {
  it('sem pedido e sem leitura: vazio com a frase do spec, etapas null, botão do cartão aceso', () => {
    const obs = world(ds => { ds.readings = ds.readings.filter(r => r.id !== READING_ID) })
    const c = cardOf(obs, null)
    expect(c.situacao).toBeNull()
    expect(c.frase).toBeNull()
    expect(c.vazio).toBe('Ainda não há leitura deste vídeo. Ninguém pediu uma até hoje.')
    expect(c.etapas).toBeNull()
    expect(c.leitura).toBeNull()
    expect(c.botao).toEqual({ label: 'Pedir leitura deste vídeo à forja', habilitado: true, motivo: null, visivel: true, por: null })
    expect(c.explicacao.aberta).toBe(true)
  })
  it('apaga o estado: sem pedido não há etapa (etapas === null) mesmo havendo leitura antiga', () => {
    const c = sharedCard(null)
    expect(c.leitura).not.toBeNull()
    expect(c.etapas).toBeNull()
    expect(c.andamento).toBeNull()
    expect(c.cancelar).toBe(false)
    expect(c.vazio).toBeNull()
  })
  it('a explicação recolhe depois da primeira leitura publicada', () => {
    expect(sharedCard(null).explicacao).toEqual({
      aberta: false,
      texto: 'A forja é um computador nosso que lê estes números e escreve uma leitura com as evidências. Não muda nada no canal. Leva de 10 a 25 minutos; pode sair desta página.',
    })
  })
  it('o botão: primeira vez / depois', () => {
    expect(sharedCard(null).botao.label).toBe('Pedir nova leitura deste vídeo à forja')
    expect(cardOf(world(ds => { ds.readings = ds.readings.filter(r => r.id !== READING_ID) }), null).botao.label).toBe('Pedir leitura deste vídeo à forja')
  })
})

describe('a leitura', () => {
  it('"Leu este vídeo e M trocas, dados de dd/mm hh:mm" sai do que foi enviado', () => {
    const l = sharedCard(null).leitura!
    expect(l.leu).toBe('Leu este vídeo e 6 trocas, dados de 19/10 12:00')
  })
  it('sem os dados enviados o campo é null, nunca "Leu 0 vídeos" nem "0 trocas"', () => {
    const obs = world(ds => { const r = readingOf(ds) as unknown as Record<string, unknown>; delete r.effects; delete (r.sent as Record<string, unknown>).ids; delete (r.sent as Record<string, unknown>).nTitles; r.analysis = {} })
    const l = cardOf(obs, null).leitura!
    expect(l.leu).toBeNull()
  })
  it('um vídeo sem trocas lidas (a lista existe e está vazia) diz "nenhuma troca"', () => {
    const obs = world(ds => { readingOf(ds).effects = []; readingOf(ds).analysis = { patterns: [], effects: [] } })
    expect(cardOf(obs, null).leitura!.leu).toBe('Leu este vídeo e nenhuma troca, dados de 19/10 12:00')
  })
  it('uma troca: "1 troca"', () => {
    const obs = world(ds => { readingOf(ds).effects = readingOf(ds).effects!.slice(0, 1) })
    expect(cardOf(obs, null).leitura!.leu).toBe('Leu este vídeo e 1 troca, dados de 19/10 12:00')
  })
  it('selo único com "em treino" dentro; a frase do ⓘ é a do spec 7.1', () => {
    const l = sharedCard(null).leitura!
    expect(l.selo).toBe('forja · Gemma 12B · em treino · gerada 20/10 06:10 (SP)')
    expect(l.seloInfo).toBe('O modelo ainda não é especialista neste assunto. Leia como rascunho e confira as evidências.')
  })
  it('o modelo do selo vem da leitura; sem ele diz que não foi registrado', () => {
    const obs = world(ds => { const r = readingOf(ds); delete r.model; r.seal = 'forja' })
    expect(cardOf(obs, null).leitura!.selo).toBe('forja · modelo não registrado · em treino · gerada 20/10 06:10 (SP)')
  })
  it('leitura sem efeito medido: a leitura é mostrada como veio (o site não reescreve)', () => {
    const r = baseDataset().readings.find(x => x.id === READING_ID)!
    const l = sharedCard(null).leitura!
    expect(l.lead).toBe(r.text.lead)
    expect(l.itens.map(i => i.texto)).toEqual(r.text.items)
    expect(l.id).toBe(READING_ID)
    expect(l.rotulo).toBeNull()
  })
  it('índices: só quando a leitura traz evidência por item; sem ela, refs vazio', () => {
    const com = sharedCard(null).leitura!
    expect(com.itens.map(i => i.refs.length)).toEqual([1, 1, 1, 1, 1, 1])
    expect(com.itens[0]!.refs[0]).toEqual({ n: 1, href: shared.link.historico(ID, { troca: 'matt-opus55/title/1' }), label: 'Título (entre 11/10 06h e 12h)' })
    expect(com.itens[5]!.refs[0]!.n).toBe(6)
    // a evidência não casa com os itens (contagem diferente): nenhum índice, nunca um par errado
    const sem = cardOf(world(ds => { readingOf(ds).analysis = { patterns: [], effects: [] } }), null).leitura!
    expect(sem.itens.every(i => i.refs.length === 0)).toBe(true)
    // sem `analysis.effects` nenhum
    const sem2 = cardOf(world(ds => { readingOf(ds).analysis = {} }), null).leitura!
    expect(sem2.itens.every(i => i.refs.length === 0)).toBe(true)
    expect(sem2.itens.length).toBe(6)
  })
  it('índices: a evidência de outro vídeo ou fora de ordem não vira link', () => {
    const outro = world(ds => {
      const r = readingOf(ds), eff = (r.analysis.effects as Array<{ change: string }>).map(e => ({ ...e }))
      eff[2]!.change = 'matt-opus55/title/2'          // não casa com o texto do item 3 (uma thumbnail)
      r.analysis = { ...r.analysis, effects: eff }
    })
    expect(cardOf(outro, null).leitura!.itens.every(i => i.refs.length === 0)).toBe(true)
    const alheio = world(ds => {
      const r = readingOf(ds), eff = (r.analysis.effects as Array<{ change: string }>).map(e => ({ ...e }))
      eff[0]!.change = 'nao-existe/title/1'
      r.analysis = { ...r.analysis, effects: eff }
    })
    expect(cardOf(alheio, null).leitura!.itens.every(i => i.refs.length === 0)).toBe(true)
  })
  it('leitura sem itens (só o resumo): itens vazio e o resumo continua', () => {
    const obs = world(ds => { readingOf(ds).text.items = [] })
    const l = cardOf(obs, null).leitura!
    expect(l.itens).toEqual([])
    expect(l.lead).not.toBe('')
  })
  it('com um pedido em andamento, a leitura que existia aparece como "Leitura anterior"', () => {
    const c = sharedCard('na fila')
    expect(c.leitura!.id).toBe(READING_ID)
    expect(c.leitura!.rotulo).toBe('Leitura anterior')
    expect(c.anterior).toBeNull()
  })
  it('recém-publicada: a nova é a leitura e a que existia antes é a "anterior"', () => {
    const c = sharedCard('publicado')
    expect(c.leitura!.id).toBe('leitura-video-matt-opus55-24-10-cenario')
    expect(c.leitura!.rotulo).toBeNull()
    expect(c.anterior).toMatchObject({ id: READING_ID, rotulo: 'Leitura anterior', doSite: [] })
  })
})

describe('limite do dia, bloqueio e exclusão', () => {
  it('limite do dia usado: botão do cartão apagado com "Já houve uma leitura deste vídeo hoje. Libera amanhã às 00:00."', () => {
    const c = sharedCard('publicado')
    expect(c.botao).toEqual({ label: 'Pedir nova leitura deste vídeo à forja', habilitado: false, motivo: 'Já houve uma leitura deste vídeo hoje. Libera amanhã às 00:00.', visivel: true, por: 'limite' })
  })
  it('limite usado por outro vídeo do nicho: a frase diz o nicho, não "deste vídeo"', () => {
    const obs = worldDb(ds => {
      const outro = ds.videos.find(v => v.id !== ID && v.niche === 'ia' && v.tracked)!
      ds.requests.push({ ...dbReq(ds, { state: 'publicado', status: 'completed', publishedAt: ds.now - 3 * MIN }), id: 'db-outro', video: outro.id, target: { kind: 'video', niche: 'ia', video: outro.id } })
    })
    const c = cardOf(obs, 'db')
    expect(c.botao.habilitado).toBe(false)
    expect(c.botao.motivo).toBe('Já houve uma leitura de IA hoje. Libera amanhã às 00:00.')
  })
  it('falha e recusa não gastam o limite do dia: o botão segue aceso', () => {
    expect(sharedCard('falhou').botao.habilitado).toBe(true)
  })
  it('vídeo fora dos acompanhados: excluído, botão apagado com o motivo, sem inventar situação', () => {
    const obs = world(ds => { const v = ds.videos.find(x => x.id === ID)!; v.tracked = false })
    const v = obs.video(ID)!
    const c = buildForjaCard(obs, v, obs.channel(v.ch)!)!
    expect(c.excluido).toMatch(/^Vídeo fora dos acompanhados: não há dados para a forja ler/)
    expect(c.botao.habilitado).toBe(false)
    expect(c.botao.motivo).toBe(c.excluido)
  })
  it('a forja não anunciou o tipo: botão apagado com o motivo da forja', () => {
    const obs = world(ds => { ds.queue = { ...ds.queue, capabilities: ds.queue.capabilities.filter(c => c !== 'leitura-video') } })
    const c = cardOf(obs, null)
    expect(c.botao.habilitado).toBe(false)
    expect(c.botao.motivo).toBe(forjaOf(obs).incapableText)
    expect(c.botao.motivo).toMatch(/^A forja ainda não /)
  })
  it('outro vídeo do nicho com pedido em andamento: bloqueado, com o link para o outro vídeo', () => {
    const obs = worldDb(ds => {
      const outro = ds.videos.find(v => v.id !== ID && v.niche === 'ia' && v.tracked)!
      ds.requests.push({ ...dbReq(ds, { state: 'na fila' }), id: 'db-outro', video: outro.id, target: { kind: 'video', niche: 'ia', video: outro.id } })
    })
    const c = cardOf(obs, 'db')
    expect(c.bloqueado).not.toBeNull()
    expect(c.bloqueado!.href).toContain('/video/')
    expect(c.botao.habilitado).toBe(false)
    expect(c.botao.motivo).toBe(c.bloqueado!.text)
    // o conteúdo da frase (a do outro vídeo em "na fila" é "aguardando"), não só que os dois campos coincidem
    expect(c.bloqueado!.text).toBe('Já há uma leitura de vídeo de IA em andamento (aguardando), do vídeo “' + c.bloqueado!.title + '”.')
  })
})

describe('o resto do contrato', () => {
  it('canal próprio: null', () => {
    const own = createTestObservatory(datasetFromOracle(loadOracleOwns('2')))
    const v = own.videos.find(x => own.channel(x.ch)!.own && x.fmt === 'long')!
    expect(buildForjaCard(own, v, own.channel(v.ch)!)).toBeNull()
  })
  it('o bloco do nicho ("o que a leitura de padrões diz sobre este título") continua quando não há leitura do vídeo', () => {
    const semLeitura = world(ds => { ds.readings = ds.readings.filter(r => r.id !== READING_ID) })
    // O que o cartão antigo entregava (`forjaCard.niche`) para estes três vídeos, fixado ANTES de ele sair: o bloco não muda de conteúdo.
    const doCartaoAntigo: Record<string, unknown> = {
      "matt-opus55": {
        "text": "O que a leitura de padrões do nicho de 20/10 diz sobre as fórmulas deste título:",
        "items": [
          {
            "text": "Reação com hipérbole: mediana 1,4× com vs 1,0× sem (n = 25 vs 342). Matt Wolfe e Nate Herk assinam 4 dos 4 outliers com essa fórmula.",
            "label": "Ver os 4 outliers",
            "href": "/cms/youtube/competitors/outliers?fmt=long&formula=reacao-hiperbole&reading=padroes-titulo-ia-20-10&min=2"
          },
          {
            "text": "Nome do modelo de IA: sem diferença que passe a regra (1,0× com vs 0,9× sem, n = 128).",
            "label": "Ver os 8 outliers",
            "href": "/cms/youtube/competitors/outliers?fmt=long&formula=nome-do-modelo&reading=padroes-titulo-ia-20-10&min=2"
          }
        ],
        "foot": "Dados enviados à forja: 368 longos até 19/10 12:00 (6 canais, 6 meses). Desde então: +8 vídeos novos, 2 vídeos ganharam base de comparação, 11 saíram da janela de 6 meses, 1 com título trocado, Esq Unltd Daily: sem sincronização há 3 dias — uma nova leitura deixaria esse canal de fora. Peça nova leitura à forja para atualizar."
      },
      "nate-ai-agent-business": {
        "text": "A leitura de padrões do nicho de 20/10 06:10 não cita este título.",
        "items": [],
        "foot": null
      },
      "matt-gpt6-astra": {
        "text": "A leitura de padrões do nicho de 20/10 06:10 não viu diferença para as fórmulas deste título: nome do modelo de IA.",
        "items": [],
        "foot": null
      }
    }
    for (const id of [ID, 'nate-ai-agent-business', 'matt-gpt6-astra']) {
      const v = semLeitura.video(id)!
      semLeitura.forja.session.reset()
      const c = buildForjaCard(semLeitura, v, semLeitura.channel(v.ch)!)!
      expect(c.leitura).toBeNull()
      expect([id, c.doNicho]).toEqual([id, doCartaoAntigo[id]])
      // e é o mesmo que a tela recebe
      semLeitura.forja.session.reset()
      expect([id, buildHistoricoView(semLeitura, id, {}).forjaCard!.doNicho]).toEqual([id, doCartaoAntigo[id]])
    }
    const alguma = buildForjaCard(semLeitura, semLeitura.video(ID)!, semLeitura.channel(semLeitura.video(ID)!.ch)!)!
    expect(alguma.doNicho).not.toBeNull()
    // a primeira oração é a frase de vazio ao lado do botão aceso: o bloco não a repete
    expect(alguma.vazio).toBe(VAZIO_SPEC)
    expect(alguma.doNicho!.text).toMatch(/^O que a leitura de padrões do nicho de /)
  })
  it('com leitura do vídeo, o bloco do nicho não aparece (como hoje)', () => {
    expect(sharedCard(null).doNicho).toBeNull()
  })
  it('o Histórico entrega o cartão novo ao lado do de hoje: forjaCard', () => {
    shared.forja.session.reset()
    const h = buildHistoricoView(shared, ID, {})
    expect(h.forjaCard).not.toBeNull()
    // o conteúdo, não só o determinismo: é o cartão do vídeo certo, com a leitura e a frase de hoje
    expect(h.forjaCard).toMatchObject({ canalId: 'matt-wolfe', situacao: 'pronta', frase: 'Pronta: leitura publicada em 20/10 às 06:10.', leitura: { id: READING_ID } })
    expect(buildHistoricoView(shared, 'id-que-nao-existe', {}).forjaCard).toBeNull()
  })
})

describe('o botão do cabeçalho (spec 6.5)', () => {
  const ask = (state: string | null, obs: Observatory = shared) => headerAsk(cardOf(obs, state))
  const livre = world(ds => { ds.readings = ds.readings.filter(r => r.id !== READING_ID) })
  it('livre → "Pedir leitura à forja" (pede)', () => {
    expect(ask(null, livre)).toEqual({ label: 'Pedir leitura à forja', modo: 'pedir', frase: null, aviso: null })
  })
  it('em andamento → "Leitura em andamento: ver" (só rola)', () => {
    for (const s of ['na fila', 'trabalhando', 'atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia'])
      expect([s, ask(s)]).toEqual([s, { label: 'Leitura em andamento: ver', modo: 'so-rola', frase: null, aviso: 'A leitura da forja já tem uma situação; ela está logo abaixo.' }])
  })
  it('pronta → "Ver a leitura" (só rola)', () => {
    expect(ask(null)).toEqual({ label: 'Ver a leitura', modo: 'so-rola', frase: null, aviso: 'A leitura da forja já tem uma situação; ela está logo abaixo.' })
  })
  it('desatualizada → "Ver a leitura" (só rola)', () => {
    const obs = world(ds => { readingOf(ds).generatedAt = ds.now - 20 * 864e5 })
    expect(ask(null, obs)).toMatchObject({ label: 'Ver a leitura', modo: 'so-rola' })
  })
  it('depois de Não deu → "Pedir leitura à forja de novo" (pede)', () => {
    expect(ask('falhou')).toEqual({ label: 'Pedir leitura à forja de novo', modo: 'pedir', frase: null, aviso: null })
  })
  it('limite do dia → "Ver a leitura" com a frase', () => {
    expect(ask('publicado')).toEqual({
      label: 'Ver a leitura', modo: 'so-rola', frase: 'Já houve uma leitura deste vídeo hoje. Libera amanhã às 00:00.',
      aviso: 'A leitura da forja já tem uma situação; ela está logo abaixo.',
    })
  })
  it('precisa de você: apagado com o motivo enquanto o canal não sincronizar; depois, pede de novo', () => {
    expect(ask('recusado (dado velho)')).toEqual({ label: 'Pedir leitura à forja', modo: 'apagado', frase: 'Sincronize o canal primeiro. Depois, pode pedir de novo.', aviso: null })
    const sync = world(ds => { ds.channels.find(c => c.id === 'matt-wolfe')!.sync.last = ds.now - MIN })
    expect(ask('recusado (dado velho)', sync)).toMatchObject({ label: 'Pedir leitura à forja de novo', modo: 'pedir' })
  })
  it('sem leitura e sem como pedir (vídeo excluído): apagado com o motivo', () => {
    const obs = world(ds => { ds.readings = ds.readings.filter(r => r.id !== READING_ID); ds.videos.find(x => x.id === ID)!.tracked = false })
    const h = ask(null, obs)
    expect(h.modo).toBe('apagado')
    expect(h.label).toBe('Pedir leitura à forja')
    expect(h.frase).toMatch(/^Vídeo fora dos acompanhados/)
  })
})


/* ==================================================================== rodada de conserto 1 (revisão da Tarefa 7) */

/** Outro vídeo do nicho `ia` com um pedido em andamento no estado `state`: o vídeo aberto fica bloqueado. */
function comOutroEm(state: ForjaRequest['state'], mut?: (ds: Dataset) => void): Observatory {
  return worldDb(ds => {
    const outro = ds.videos.find(v => v.id !== ID && v.niche === 'ia' && v.tracked)!
    ds.requests.push({ ...dbReq(ds, { state, status: state === 'trabalhando' ? 'running' : 'pending', attempt: state === 'nova tentativa' || state === 'liberado pelo vigia' ? 2 : 1 }), id: 'db-outro', video: outro.id, target: { kind: 'video', niche: 'ia', video: outro.id } })
    mut?.(ds)
  })
}
const sincronizado = (ds: Dataset) => { ds.channels.find(c => c.id === 'matt-wolfe')!.sync.last = ds.now + MIN }
const falhou = (ds: Dataset) => dbReq(ds, { state: 'falhou', status: 'failed', failedAt: ds.now - 5 * MIN, failReason: 'validador' })
const recusado = (ds: Dataset) => dbReq(ds, { state: 'recusado (dado velho)', status: 'refused', refusedAt: ds.now - 5 * MIN })
const dbDe = (obs: Observatory) => cardOf(obs, 'db')
const semOTipo = (ds: Dataset) => { ds.queue = { ...ds.queue, capabilities: ds.queue.capabilities.filter(c => c !== 'leitura-video') } }
const foraDosAcompanhados = (ds: Dataset) => { ds.videos.find(v => v.id === ID)!.tracked = false }

/** Todos os cenários que mudam o que o cartão diz ou o que o botão faz. [nome, cartão, cabeçalho]. */
function cenarios(): Array<[string, ForjaCardView, HeaderAskView]> {
  const out: Array<[string, ForjaCardView]> = []
  for (const st of [null, ...REQUEST_STATES]) out.push(['sem bloqueio: ' + (st ?? 'sem pedido'), sharedCard(st)])
  out.push(['sem leitura nenhuma', cardOf(world(ds => { ds.readings = ds.readings.filter(r => r.id !== READING_ID) }), null)])
  // bloqueado por outro vídeo do nicho em cada estado ativo, com cada situação deste vídeo por baixo
  for (const outro of ACTIVE_STATES) {
    out.push(['bloqueado, outro em ' + outro + ', sem pedido', dbDe(comOutroEm(outro))])
    out.push(['bloqueado, outro em ' + outro + ', este falhou', dbDe(comOutroEm(outro, ds => { ds.requests.push(falhou(ds)) }))])
    out.push(['bloqueado, outro em ' + outro + ', este recusado e canal sincronizado', dbDe(comOutroEm(outro, ds => { sincronizado(ds); ds.requests.push(recusado(ds)) }))])
    out.push(['bloqueado, outro em ' + outro + ', este sem evidências', dbDe(comOutroEm(outro, ds => { readingOf(ds).text.items = [] }))])
  }
  // excluído (vídeo fora dos acompanhados), forja sem o tipo: com cada situação por baixo
  for (const [nome, cond] of [['excluído', foraDosAcompanhados], ['forja sem o tipo', semOTipo]] as const) {
    out.push([nome + ', sem pedido', dbDe(worldDb(cond))])
    out.push([nome + ', falhou', dbDe(worldDb(ds => { cond(ds); ds.requests.push(falhou(ds)) }))])
    out.push([nome + ', recusado e sincronizado', dbDe(worldDb(ds => { cond(ds); sincronizado(ds); ds.requests.push(recusado(ds)) }))])
  }
  // limite do dia
  out.push(['limite, leitura sem evidências publicada hoje', dbDe(worldDb(ds => { readingOf(ds).text.items = []; readingOf(ds).generatedAt = ds.now - 5 * MIN; ds.requests.push(dbReq(ds, { state: 'publicado', status: 'completed', createdAt: ds.now - 25 * MIN, publishedAt: ds.now - 5 * MIN })) }))])
  out.push(['limite, publicado sem leitura', dbDe(worldDb(ds => { ds.readings = ds.readings.filter(r => r.id !== READING_ID); ds.requests.push(dbReq(ds, { state: 'publicado', status: 'completed', publishedAt: ds.now - 3 * MIN })) }))])
  out.push(['limite, usado por outro vídeo', dbDe(worldDb(ds => {
    const outro = ds.videos.find(v => v.id !== ID && v.niche === 'ia' && v.tracked)!
    ds.requests.push({ ...dbReq(ds, { state: 'publicado', status: 'completed', publishedAt: ds.now - 3 * MIN }), id: 'db-outro', video: outro.id, target: { kind: 'video', niche: 'ia', video: outro.id } })
  }))])
  // com o botão aceso (o convite é verdadeiro)
  out.push(['precisa de você, canal sincronizado', cardOf(world(sincronizado), 'recusado (dado velho)')])
  out.push(['não deu por travamento', dbDe(worldDb(ds => { ds.requests.push(dbReq(ds, { state: 'falhou', status: 'failed', attempt: 3, failedAt: ds.now - 5 * MIN, failReason: 'travou-3x' })) }))])
  out.push(['não deu por outro código', dbDe(worldDb(ds => { ds.requests.push(dbReq(ds, { state: 'falhou', status: 'failed', failedAt: ds.now - 5 * MIN, failReason: 'erro-xyz' })) }))])
  out.push(['não deu sem evidências, sem pedido', cardOf(world(ds => { readingOf(ds).text.items = [] }), null)])
  // I3: pedido publicado cuja leitura não foi ligada, com uma leitura velha no vídeo
  out.push(['publicado sem leitura ligada, com leitura velha', dbDe(worldDb(ds => { ds.requests.push(dbReq(ds, { state: 'publicado', status: 'completed', createdAt: ds.now - 25 * MIN, publishedAt: ds.now - 3 * MIN, readingId: null })) }))])
  // I4: sem nicho
  out.push(['vídeo sem nicho', cardOf(world(ds => { ds.videos.find(v => v.id === ID)!.niche = null }), null)])
  out.push(['vídeo sem nicho, sem leitura', cardOf(world(ds => { ds.videos.find(v => v.id === ID)!.niche = null; ds.readings = ds.readings.filter(r => r.id !== READING_ID) }), null)])
  // I6: a descrição saiu depois da leitura
  out.push(['desatualizada só com título e thumbnail', cardOf(world(ds => { readingOf(ds).generatedAt = AT_DEPOIS_DA_DESCRICAO }), null)])
  out.push(['desatualizada com descrição', cardOf(world(ds => { readingOf(ds).generatedAt = AT_ANTES_DA_DESCRICAO }), null)])
  return out.map(([n, c]) => [n, c, headerAsk(c)])
}
const CENARIOS = cenarios()
const NOMES = CENARIOS.map(([n, c, h]) => [n, c, h] as const)

describe('I1: nenhuma palavra interna em tela, em NENHUM cenário', () => {
  const proibidas = /\b(cotas?|vigias?|validador(es)?|conferência)\b/i
  it('a varredura recursiva cobre muitos cenários (bloqueio, exclusão, cada estado)', () => {
    expect(CENARIOS.length).toBeGreaterThanOrEqual(45)
    expect(CENARIOS.some(([n]) => n.startsWith('bloqueado, outro em liberado pelo vigia'))).toBe(true)
  })
  it.each(NOMES)('%s', (_n, c, h) => {
    const todos = [...strings(c), ...strings(h)]
    expect(todos.length).toBeGreaterThan(3)
    expect(todos.filter(t => proibidas.test(t))).toEqual([])
  })
  it('o bloqueio por outro vídeo diz a situação dele com as palavras de tela do spec 7.2, nunca o estado do código', () => {
    const frase = (outro: ForjaRequest['state']) => dbDe(comOutroEm(outro)).bloqueado!.text.replace(/“.*”/, '“T”')
    for (const o of ['na fila', 'trabalhando', 'nova tentativa', 'liberado pelo vigia'] as const)
      expect([o, frase(o)]).toEqual([o, 'Já há uma leitura de vídeo de IA em andamento (aguardando), do vídeo “T”.'])
    for (const o of ['atrasado', 'sem máquina'] as const)
      expect([o, frase(o)]).toEqual([o, 'Já há uma leitura de vídeo de IA em andamento (aguardando, com atraso), do vídeo “T”.'])
  })
  it('o bloqueio guarda o título do outro vídeo entre aspas e o link para ele', () => {
    const c = dbDe(comOutroEm('liberado pelo vigia'))
    expect(c.bloqueado!.text).toContain('“' + c.bloqueado!.title + '”')
    expect(c.bloqueado!.href).toContain('/video/')
    expect(c.botao).toMatchObject({ habilitado: false, por: 'bloqueado', motivo: c.bloqueado!.text })
  })
})

describe('I2: "Pode pedir de novo." só quando o botão de pedir está de fato aceso', () => {
  it.each(NOMES)('invariante: %s', (_n, c, h) => {
    if (strings(c).some(t => t.includes('Pode pedir de novo'))) {
      expect(c.botao.habilitado).toBe(true)
      expect(c.botao.visivel).toBe(true)
      expect(h.modo).toBe('pedir')
    }
    // e, no sentido contrário, o cabeçalho só pede quando o botão do cartão deixa
    if (h.modo === 'pedir') expect(c.botao.habilitado).toBe(true)
  })
  it('a invariante enxerga os dois lados: há cenário com a frase e cenário sem ela', () => {
    expect(CENARIOS.filter(([, c]) => strings(c).some(t => t.includes('Pode pedir de novo'))).length).toBeGreaterThan(2)
    expect(CENARIOS.filter(([, c]) => c.situacao === 'nao-deu' && !c.botao.habilitado).length).toBeGreaterThan(3)
  })
  it('Não deu com outro vídeo do nicho em andamento: a frase termina com o bloqueio, sem convite', () => {
    const c = dbDe(comOutroEm('na fila', ds => { ds.requests.push(falhou(ds)) }))
    expect(c.situacao).toBe('nao-deu')
    expect(c.botao).toMatchObject({ habilitado: false, por: 'bloqueado' })
    expect(c.frase).toBe('Não deu: o texto citava números que não batem com os dados, em todas as tentativas. ' + c.bloqueado!.text)
  })
  it('Não deu com o vídeo fora dos acompanhados: a frase termina com o motivo da exclusão', () => {
    const c = dbDe(worldDb(ds => { foraDosAcompanhados(ds); ds.requests.push(falhou(ds)) }))
    expect(c.botao.por).toBe('excluido')
    expect(c.frase).toBe('Não deu: o texto citava números que não batem com os dados, em todas as tentativas. ' + c.excluido)
  })
  it('Não deu com a forja sem o tipo: a frase termina com o motivo da forja', () => {
    const c = dbDe(worldDb(ds => { semOTipo(ds); ds.requests.push(falhou(ds)) }))
    expect(c.botao.por).toBe('incapaz')
    expect(c.frase).toBe('Não deu: o texto citava números que não batem com os dados, em todas as tentativas. ' + c.botao.motivo)
  })
  it('Precisa de você, canal sincronizado, mas bloqueado por outro vídeo: sem "Pode pedir de novo."', () => {
    const c = dbDe(comOutroEm('trabalhando', ds => { sincronizado(ds); ds.requests.push(recusado(ds)) }))
    expect(c.situacao).toBe('precisa-de-voce')
    expect(c.acoes).toEqual([])
    expect(c.frase).toBe('Precisa de você: os dados deste canal estão antigos demais para ler. ' + c.bloqueado!.text)
  })
  it('o convite continua quando o botão está aceso (as frases do spec, intactas)', () => {
    expect(sharedCard('falhou').frase).toMatch(/ Pode pedir de novo\.$/)
    expect(sharedCard('falhou').botao.habilitado).toBe(true)
  })
})

describe('I3: pedido publicado cuja leitura não foi ligada', () => {
  const velha = () => dbDe(worldDb(ds => { ds.requests.push(dbReq(ds, { state: 'publicado', status: 'completed', createdAt: ds.now - 25 * MIN, publishedAt: ds.now - 3 * MIN, readingId: null })) }))
  it('não diz "Pronta" com a hora do pedido ao lado de uma leitura de semanas atrás', () => {
    const c = velha()
    expect(c.situacao).toBe('nao-deu')
    expect(c.frase).not.toMatch(/Pronta/)
    expect(c.frase).toBe('Não deu: o pedido terminou, mas a leitura não está aqui. Já houve uma leitura deste vídeo hoje. Libera amanhã às 00:00.')
  })
  it('a leitura velha aparece como anterior, com a data DELA', () => {
    const c = velha()
    expect(c.leitura).toMatchObject({ id: READING_ID, rotulo: 'Leitura anterior', selo: 'forja · Gemma 12B · em treino · gerada 20/10 06:10 (SP)' })
    expect(strings(c).join(' ')).not.toContain('14:59')    // a hora do pedido (publicado há 3 min) não vira a hora da leitura
  })
  it('com a leitura ligada (readingId), o pedido publicado continua "Pronta"', () => {
    const c = dbDe(worldDb(ds => {
      ds.readings.push({ ...readingOf(ds), id: 'nova', generatedAt: ds.now - 3 * MIN })
      ds.requests.push(dbReq(ds, { state: 'publicado', status: 'completed', createdAt: ds.now - 25 * MIN, publishedAt: ds.now - 3 * MIN, readingId: 'nova' }))
    }))
    expect(c.situacao).toBe('pronta')
    expect(c.frase).toBe('Pronta: leitura publicada às 14:59.')
  })
})

describe('I4: vídeo sem nicho', () => {
  const semNicho = (ler: boolean) => cardOf(world(ds => { ds.videos.find(v => v.id === ID)!.niche = null; if (!ler) ds.readings = ds.readings.filter(r => r.id !== READING_ID) }), null)
  it('nenhuma frase diz "de este nicho" nem inventa um nicho', () => {
    for (const ler of [true, false]) expect(strings(semNicho(ler)).filter(t => /este nicho|\bde este\b|undefined|null/.test(t))).toEqual([])
  })
  it('a frase do limite do dia fala do vídeo', () => {
    for (const ler of [true, false]) {
      const c = semNicho(ler)
      expect(c.botao.habilitado).toBe(false)
      expect(c.botao.motivo).toBe('Já houve uma leitura deste vídeo hoje. Libera amanhã às 00:00.')
    }
  })
})

describe('I5: a escolha de frase e de etapa cobre todos os estados do motor', () => {
  it.each(REQUEST_STATES.map(s => [s]))('%s tem situação e frase (nunca um cartão em branco)', state => {
    const c = sharedCard(state)
    expect(c.situacao).not.toBeNull()
    expect(c.frase).not.toBeNull()
    expect(c.vazio).toBeNull()
  })
  it('todo estado ativo tem uma etapa atual em Na fila ou Escrevendo; "publicado" e "recusado" não têm etapa', () => {
    for (const st of ACTIVE_STATES) {
      const e = sharedCard(st).etapas
      expect([st, e?.filter(x => x.estado === 'atual' || x.estado === 'atrasada').length]).toEqual([st, 1])
    }
    expect(sharedCard('publicado').etapas).toBeNull()
    expect(sharedCard('recusado (dado velho)').etapas).toBeNull()
  })
  it('a lista de ativos vem do motor e a escolha é exaustiva (`never`): a fonte não guarda cópia própria', () => {
    const fonte = readFileSync(resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_historico/forja-card-model.ts'), 'utf8')
    expect(fonte).not.toMatch(/new Set<string>/)
    expect(fonte).toMatch(/: never/)
  })
})

describe('I6: o número da frase e o da ação são o mesmo conjunto', () => {
  const noGrafico = '#hv-tlh'
  it('só título e thumbnail dentro dos 30 dias: "Ver as N trocas" abre a aba Trocas já no vídeo', () => {
    const c = cardOf(world(ds => { readingOf(ds).generatedAt = AT_DEPOIS_DA_DESCRICAO }), null)
    expect(c.frase).toBe('Pronta, mas desatualizada: depois que ela foi escrita, saíram 2 trocas.')
    expect(c.acoes).toEqual([{ id: 'ver-trocas', label: 'Ver as 2 trocas', href: '/cms/youtube/competitors/canal/matt-wolfe?tab=trocas&video=matt-opus55' }])
  })
  it('uma troca só: "saiu 1 troca" e "Ver a troca"', () => {
    const c = cardOf(world(ds => { readingOf(ds).generatedAt = Date.parse('2026-10-18T14:00:00Z') }), null)
    expect(c.frase).toBe('Pronta, mas desatualizada: depois que ela foi escrita, saiu 1 troca.')
    expect(c.acoes.map(a => [a.id, a.label])).toEqual([['ver-trocas', 'Ver a troca']])
  })
  it('a descrição entre as que saíram: a frase conta todas e diz o que são; a ação leva ao gráfico, não à aba', () => {
    const c = cardOf(world(ds => { readingOf(ds).generatedAt = AT_ANTES_DA_DESCRICAO }), null)
    expect(c.situacao).toBe('desatualizada')
    expect(c.frase).toBe('Pronta, mas desatualizada: depois que ela foi escrita, saíram 3 trocas, 1 de descrição.')
    expect(c.acoes).toEqual([{ id: 'ver-raias', label: 'Ver as trocas no gráfico', href: noGrafico }])
    expect(c.leitura!.doSite[0]).toBe('desde então, 3 trocas.')
  })
  it('só a descrição saiu: "saiu 1 troca, de descrição" e a ação leva ao gráfico', () => {
    const c = cardOf(world(ds => {
      readingOf(ds).generatedAt = AT_ANTES_DA_DESCRICAO
      // as duas trocas de 18/10 não existem neste mundo: depois da leitura só a descrição saiu
      const v = ds.videos.find(x => x.id === ID)!, corte = Date.parse('2026-10-18T00:00:00Z')
      v.titles = v.titles.filter(t => t.first_seen < corte)
      v.thumbs = v.thumbs.filter(t => t.first_seen < corte)
    }), null)
    expect(c.frase).toBe('Pronta, mas desatualizada: depois que ela foi escrita, saiu 1 troca, de descrição.')
    expect(c.acoes).toEqual([{ id: 'ver-raias', label: 'Ver as trocas no gráfico', href: noGrafico }])
  })
  it('troca de título ou thumbnail com mais de 30 dias: a frase conta e diz; a ação leva ao gráfico', () => {
    // 17 dias adiante a janela de 30 dias começa em 11/10 18h: title/1 (11/10 15h) fica fora da aba
    const c = cardOf(world(ds => { ds.now += 17 * 864e5; readingOf(ds).generatedAt = Date.parse('2026-10-10T00:00:00Z') }), null)
    expect(c.situacao).toBe('desatualizada')
    expect(c.frase).toBe('Pronta, mas desatualizada: depois que ela foi escrita, saíram 6 trocas, 1 de descrição e 1 de mais de 30 dias.')
    expect(c.acoes.map(a => a.id)).toEqual(['ver-raias'])
  })
  it('o número da frase é o da ação em TODOS os cenários com "Ver as N trocas"', () => {
    let vistos = 0
    for (const [n, c] of CENARIOS) {
      const ver = c.acoes.find(a => a.id === 'ver-trocas')
      if (!ver) continue
      vistos++
      const nf = /saíram (\d+) trocas/.exec(c.frase ?? '')?.[1] ?? (/saiu 1 troca/.test(c.frase ?? '') ? '1' : null)
      const na = /Ver as (\d+) trocas/.exec(ver.label)?.[1] ?? (ver.label === 'Ver a troca' ? '1' : null)
      expect([n, nf]).toEqual([n, na])
    }
    expect(vistos).toBeGreaterThan(0)
  })
  it('vídeos novos de outro canal não entram na conta de um cartão de vídeo', () => {
    const c = cardOf(world(ds => {
      readingOf(ds).generatedAt = AT_DEPOIS_DA_DESCRICAO
      const o = ds.videos.find(v => v.id !== ID && v.ch !== 'matt-wolfe' && v.tracked)!
      o.pub = ds.now - MIN
    }), null)
    expect(c.frase).toBe('Pronta, mas desatualizada: depois que ela foi escrita, saíram 2 trocas.')
  })
})

describe('menores', () => {
  it('headerAsk lê só o cartão (um parâmetro): o pedir do cabeçalho vem de `botao.habilitado`', () => {
    expect(headerAsk.length).toBe(1)
  })
})

describe('frase de vazio e bloco do nicho: a oração "Ainda não há leitura deste vídeo" sai uma vez só', () => {
  const diz = (c: ForjaCardView) => strings(c).join('\n').split('Ainda não há leitura deste vídeo').length - 1
  const semLeitura = (mut?: (ds: Dataset) => void) => worldDb(ds => { ds.readings = ds.readings.filter(r => r.id !== READING_ID); mut?.(ds) })
  it('botão aceso: a frase de vazio do spec 7.1 fica e o bloco do nicho não repete a oração', () => {
    const c = cardOf(semLeitura(), 'db')
    expect(c.vazio).toBe(VAZIO_SPEC)
    expect(c.doNicho).not.toBeNull()
    expect(diz(c)).toBe(1)
  })
  it('botão apagado pelo limite (a tela mostra o motivo no lugar do vazio): o bloco do nicho é quem diz', () => {
    const c = dbDe(semLeitura(ds => {
      const outro = ds.videos.find(v => v.id !== ID && v.niche === 'ia' && v.tracked)!
      ds.requests.push({ ...dbReq(ds, { state: 'publicado', status: 'completed', publishedAt: ds.now - 3 * MIN }), id: 'db-outro', video: outro.id, target: { kind: 'video', niche: 'ia', video: outro.id } })
    }))
    expect(c.botao.habilitado).toBe(false)
    expect(c.doNicho!.text).toMatch(/^Ainda não há leitura deste vídeo/)
  })
})

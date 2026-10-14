// @vitest-environment jsdom
// A5 · E5a, Tarefa 5: a lista de Canais com direção, estado e filtros (mockup 16): modelo da tela e tela montada.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const siteAdmin = vi.hoisted(() => ({ value: true }))
vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => siteAdmin.value,
}))
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { a3World } from './a3-fixture'
import { buildCanaisView, type CanaisParams } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen, type CanaisScreenProps } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'
import { quedaExisteEm } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { spDateOf } from '@/lib/youtube/observatorio/time'
import { naoMedido } from '@/lib/youtube/observatorio/medidas/tipos'
import { direcaoMedida, m8De, medidasDoMotor, EXTRAS_OK, type PorCanal } from './canais-e5a-fixture'
import { forbiddenVocabulary, noJunkText } from './audits'

const replace = vi.fn(), push = vi.fn()
let search = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh: vi.fn(), push, prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(search),
}))
beforeEach(() => { replace.mockReset(); push.mockReset(); search = '' })

const obs = createObservatory(datasetFromOracle(loadOracle()))
const concorrentes = obs.channels.filter(c => !c.own).map(c => c.id)
const rowsOf = (v: ReturnType<typeof buildCanaisView>) => [...v.list.ranked, ...v.list.unranked]
const vw = (p: Partial<CanaisParams> = {}, o = obs) => buildCanaisView(o, { niche: 'todos', limit: 75, fmt: 'longos', ...p })
const ok = async () => ({ ok: true })
function mount(p: Partial<CanaisParams> = {}, props: Partial<CanaisScreenProps> = {}, o = obs) {
  return render(<ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs=""><CanaisScreen view={vw(p, o)} canUnlock={false} onAdd={ok} onRemove={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} {...props} /></div></ChromeSyncContext.Provider></ToastProvider>)
}
const hojeSP = spDateOf(obs.NOW)

describe('E5a T5: dado ausente', () => {
  it('medidas não carregaram: toda célula de direção é "não carregou", a frase diz quantos e nenhuma casa mostra 0', () => {
    const v = vw({ medidas: null })
    const comps = rowsOf(v).filter(r => !r.own)
    expect(comps.length).toBe(concorrentes.length)
    for (const r of comps) expect(r.direcao.tipo).toBe('nao_carregou')
    expect(v.resumo.frase).toContain(`A direção não carregou em ${comps.length} canais`)
    expect(v.resumo.casas.map(c => c.n)).toEqual([null, null, null, null])
    const { container } = mount({ medidas: null })
    expect(container.querySelectorAll('.obs-cn-casa .obs-ch-zero').length).toBe(0)
    expect(container.querySelectorAll('.obs-cn-casa .obs-md-nc').length).toBe(4)
    // D3: com o estado também sem leitura, Parados e Saíram não dizem 0 medido: dizem "não carregou"
    const f = (ch: string) => v.resumo.filtros.find(x => x.chave === ch)!
    expect(f('parados').n).toBeNull()
    expect(f('sairam').n).toBeNull()
    expect(f('parados').leitor).toContain('não carregou')
    expect(container.querySelectorAll('.obs-cn-filtro .obs-ch-zero').length).toBe(0)
  })
  it('canal sem 56 dias: "fecha em dd/mm" na linha e a data na casa "não medido"', () => {
    const v = vw({ medidas: medidasDoMotor(obs, { 'matt-wolfe': { m3a: naoMedido('fecha_em', { fechaEm: '2026-10-17' }) } }) })
    const r = rowsOf(v).find(x => x.id === 'matt-wolfe')!
    expect(r.direcao).toMatchObject({ tipo: 'nao_medido', motivo: 'fecha_em', curta: 'fecha em 17/10' })
    expect(v.resumo.casas.find(c => c.chave === 'nao-medido')).toMatchObject({ n: 1, data: 'fecha em 17/10' })
  })
  it('sem o registro da borda: a data que faltou', () => {
    const v = vw({ medidas: medidasDoMotor(obs, { 'matt-wolfe': { m3a: naoMedido('sem_registro_na_borda', { desde: '2026-09-02' }) } }) })
    expect(rowsOf(v).find(x => x.id === 'matt-wolfe')!.direcao).toMatchObject({ curta: 'sem registro em 02/09' })
  })
  it('canal sem vídeo: estado "sem vídeos" e direção "sem views nos 56 dias para comparar"', () => {
    const w = a3World(ds => { ds.videos = ds.videos.filter(x => x.ch !== 'matt-wolfe') })
    const v = vw({ medidas: medidasDoMotor(w.obs, { 'matt-wolfe': { m3a: naoMedido('base_zero') } }) }, w.obs)
    const r = rowsOf(v).find(x => x.id === 'matt-wolfe')!
    expect(r.estado.pastilha).toBe('sem_videos')
    expect(r.direcao).toMatchObject({ curta: 'sem views nos 56 dias para comparar' })
  })
  it('inscritos ocultos: hachura e "não medido: oculto" no crescimento, nunca 0', () => {
    const v = vw({ medidas: medidasDoMotor(obs, { 'matt-wolfe': { extras: { subscribersHidden: true } } }) })
    const r = rowsOf(v).find(x => x.id === 'matt-wolfe')!
    expect(r).toMatchObject({ subsOculto: true, subs: 'Inscritos ocultos' })
    expect(r.cells.growth).toMatchObject({ kind: 'na', text: 'não medido: oculto' })
    const { container } = mount({ medidas: medidasDoMotor(obs, { 'matt-wolfe': { extras: { subscribersHidden: true } } }) })
    expect(container.querySelector('[data-subs-ocultos]')).not.toBeNull()
  })
  it('extras não lidos: a pastilha "Saiu do YouTube" não é inventada e a linha diz "não carregou"', () => {
    const v = vw({ medidas: medidasDoMotor(obs, {}, true) })
    const r = rowsOf(v).find(x => x.id === 'matt-wolfe')!
    expect(r.estado).toMatchObject({ pastilha: 'ativo', extrasNaoLidos: true })
    const { container } = mount({ medidas: medidasDoMotor(obs, {}, true) })
    expect(container.querySelector('[data-extras-nao-lidos]')?.textContent).toMatch(/Não carregou/)
    expect(container.textContent).not.toMatch(/Saiu do YouTube em/)
  })
  it('canal próprio: direção e estado dizem o motivo dele; fica fora das casas e da contagem; a frase não diz que um canal não carregou', () => {
    const v = vw({ medidas: medidasDoMotor(obs) })
    const proprio = rowsOf(v).find(x => x.own)!
    expect(proprio.direcao.tipo).toBe('canal_proprio')
    expect(proprio.estado.pastilha).toBe('canal_proprio')
    expect(v.resumo.direcao.canais).toBe(concorrentes.length)
    expect(v.resumo.contagem.todos).toBe(concorrentes.length)
    expect(v.resumo.frase).not.toMatch(/não carregou/)
    const { container } = mount({ medidas: medidasDoMotor(obs) })
    expect(container.textContent).toContain('o YouTube não dá esse número do seu canal')
  })
  it('estado não carregou: a sublinha, o painel e a pastilha não afirmam ativo nem parado; o painel usa a forma de erro, não a classe weak', () => {
    const medidas = medidasDoMotor(obs, { 'bald-and-bankrupt': 'nao_carregou' })
    const v = vw({ medidas, channel: 'bald-and-bankrupt' })
    const r = rowsOf(v).find(x => x.id === 'bald-and-bankrupt')!
    expect(r.estado.pastilha).toBe('nao_carregou')
    expect(r.paused).toBe('nao_carregou')
    expect(r.cells.cadence).toMatchObject({ kind: 'ok', sub: 'não carregou', paused: null })
    const ritmo = v.drawer!.stats[0]!
    expect(ritmo).toMatchObject({ sub: 'não carregou', subWeak: false, subErro: true })
    mount({ medidas, channel: 'bald-and-bankrupt' })
    const dlg = screen.getByRole('dialog')
    expect(dlg.querySelector('.dstats .l .weak')).toBeNull()
    expect(dlg.querySelector('.dstats .obs-md-nc')).not.toBeNull()
    expect(dlg.textContent).not.toMatch(/Parado: último vídeo/)
  })
  it('todos os canais com sem_registro_recente: a frase diz "sem retrato desde dd/mm" e o sinal para o Sentry existe uma vez', () => {
    const sobre: PorCanal = {}
    for (const id of concorrentes) sobre[id] = { m3a: naoMedido('sem_registro_recente'), extras: { lastOkSyncedAt: '2026-10-01T15:00:00Z' } }
    const v = vw({ medidas: medidasDoMotor(obs, sobre) })
    expect(v.resumo.semRetrato).toEqual({ desde: '2026-10-01' })
    expect(v.resumo.frase).toContain('Sem retrato desde 01/10.')
    expect(vw({ medidas: medidasDoMotor(obs) }).resumo.semRetrato).toBeNull()
  })
})

describe('E5a T5: calendário', () => {
  it('antes da data, "em queda" é ainda não existe com a data, e a contagem do filtro não é número', () => {
    expect(hojeSP < quedaExisteEm()).toBe(true)
    const v = vw({ medidas: medidasDoMotor(obs) })
    const f = v.resumo.filtros.find(x => x.chave === 'em-queda')!
    expect(f).toMatchObject({ n: null, ainda: quedaExisteEm() })
    expect(v.resumo.frase).toMatch(/só dá para medir a partir de \d\d\/\d\d/)
    const { container } = mount({ medidas: medidasDoMotor(obs) })
    expect(container.querySelector('.obs-cn-filtro .obs-md-ainda')?.textContent).toMatch(/^só a partir de \d\d\/\d\d$/)
  })
  it('o filtro "em queda" antes da data esvazia com a explicação, a data e os dias que faltam, e o botão de limpar', async () => {
    const user = userEvent.setup()
    const medidas = medidasDoMotor(obs)
    const v = vw({ medidas, filter: 'em-queda' })
    expect(v.resumo.vazio).toMatchObject({ forma: 'ainda_nao_existe', titulo: 'Em queda ainda não pode ser medido.' })
    expect(v.resumo.vazio!.apoio).toMatch(/daqui a \d+ dias/)
    mount({ medidas, filter: 'em-queda' })
    expect(screen.getByText('Em queda ainda não pode ser medido.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver todos os canais' }))
    expect(replace).toHaveBeenCalled()
    expect(replace.mock.calls.at(-1)![0]).not.toContain('filter=')
  })
  it('depois da data, 0 de N medidos em queda é zero medido (caixa vazada) e a frase diz N', () => {
    const w = a3World(ds => { ds.now = Date.parse('2026-12-20T15:00:00Z') }, '1')
    const comps = w.obs.channels.filter(c => !c.own).map(c => c.id)
    const sobre: PorCanal = {}
    for (const id of comps) sobre[id] = { m8: m8De('ativo', { queda: { estado: 'medido', valor: { janelas: [0.2, 0.2, 0.2] }, n: 4, janela: { de: null, ate: null, dias: 84 }, notas: [] } }) }
    const v = vw({ medidas: medidasDoMotor(w.obs, sobre) }, w.obs)
    expect(v.resumo.contagem.queda).toEqual({ tipo: 'numero', emQueda: 0, quedaMedidaEm: comps.length, canais: comps.length })
    expect(v.resumo.frase).toContain(`Nenhum dos ${comps.length} canais está em queda sustentada.`)
    const { container } = mount({ medidas: medidasDoMotor(w.obs, sobre) }, {}, w.obs)
    expect(container.querySelectorAll('.obs-cn-filtro .obs-ch-zero').length).toBeGreaterThan(0)
  })
  it('o aviso de contagem aparece enquanto a janela cruza e some no dia seguinte', () => {
    const cruza = { ...{ de: '2026-08-20', ate: '2026-10-14', dias: 56 } }
    const depois = { de: '2026-08-25', ate: '2026-10-19', dias: 56 }
    const a = vw({ medidas: medidasDoMotor(obs, Object.fromEntries(concorrentes.map(id => [id, { m3a: direcaoMedida(120, 100, cruza) }]))) })
    expect(a.resumo.avisoDeContagem).toEqual({ ate: '2026-10-18' })
    const b = vw({ medidas: medidasDoMotor(obs, Object.fromEntries(concorrentes.map(id => [id, { m3a: direcaoMedida(120, 100, depois) }]))) })
    expect(b.resumo.avisoDeContagem).toBeNull()
    const { container } = mount({ medidas: medidasDoMotor(obs, Object.fromEntries(concorrentes.map(id => [id, { m3a: direcaoMedida(120, 100, cruza) }]))) })
    expect(container.querySelector('[data-k="aviso-contagem"]')?.textContent).toContain('Até 18/10 os 56 dias cruzam a mudança de contagem de 24/08/2026.')
  })
})

describe('E5a T5: fronteira', () => {
  it('parado e em queda mostram a pastilha de parado e "Também em queda."', () => {
    const q = { estado: 'medido' as const, valor: { janelas: [-0.3, -0.4, -0.2] }, n: 4, janela: { de: null, ate: null, dias: 84 }, notas: [] }
    const { container } = mount({ medidas: medidasDoMotor(obs, { 'bald-and-bankrupt': { m8: m8De('parado', { dias: 60, queda: q }) } }) })
    const linha = container.querySelector('tr[data-id="bald-and-bankrupt"]')!
    expect(linha.textContent).toContain('Parado há 60 dias sem publicar')
    expect(linha.textContent).toContain('Também em queda.')
  })
  it('pastilha e painel dizem o mesmo estado para 35 dias sem publicar e intervalo de 20 (limite 80: ativo nos dois)', () => {
    const medidas = medidasDoMotor(obs, { 'bald-and-bankrupt': { m8: m8De('ativo', { dias: 35, limite: 80 }) } })
    const v = vw({ medidas, channel: 'bald-and-bankrupt' })
    const r = rowsOf(v).find(x => x.id === 'bald-and-bankrupt')!
    expect(r.estado.pastilha).toBe('ativo')
    expect(r.paused).toBe('nao')
    expect(r.cells.cadence).toMatchObject({ paused: null })
    expect(v.drawer!.stats[0]!.sub).toBe('longos + Shorts por semana')
  })
  it('ativo não tem pastilha e diz "Ativo, publicou há N dias"', () => {
    const { container } = mount({ medidas: medidasDoMotor(obs, { 'matt-wolfe': { m8: m8De('ativo', { dias: 4 }) } }) })
    const linha = container.querySelector('tr[data-id="matt-wolfe"]')!
    expect(linha.querySelector('.obs-md-pas')).toBeNull()
    expect(linha.textContent).toContain('Ativo, publicou há 4 dias')
  })
  it('filtro de estado e de direção somam; "problemas" dá a mesma lista de antes', () => {
    const medidas = medidasDoMotor(obs, {
      'matt-wolfe': { m8: m8De('parado', { dias: 60 }), m3a: direcaoMedida(200, 100) },
      'nate-herk': { m8: m8De('parado', { dias: 70 }), m3a: direcaoMedida(50, 100) },
    })
    expect(rowsOf(vw({ medidas, filter: 'parados' })).filter(r => !r.own).map(r => r.id).sort()).toEqual(['matt-wolfe', 'nate-herk'])
    expect(rowsOf(vw({ medidas, filter: 'parados', direcao: 'sobe' })).filter(r => !r.own).map(r => r.id)).toEqual(['matt-wolfe'])
    expect(rowsOf(vw({ medidas, direcao: 'desce' })).filter(r => !r.own).map(r => r.id)).toEqual(['nate-herk'])
    const antes = rowsOf(buildCanaisView(obs, { niche: 'todos', limit: 75, filter: 'problemas' })).map(r => r.id)
    expect(rowsOf(vw({ medidas, filter: 'problemas' })).map(r => r.id)).toEqual(antes)
  })
  it('filtro que esvazia: o vazio é explicado, com zero medido e o botão de limpar', () => {
    const v = vw({ medidas: medidasDoMotor(obs), filter: 'parados' })
    expect(v.resumo.vazio).toMatchObject({ forma: 'zero', titulo: 'Nenhum canal parado' })
    mount({ medidas: medidasDoMotor(obs), filter: 'parados' })
    expect(screen.getByText('Nenhum canal parado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver todos os canais' })).toBeInTheDocument()
  })
  it('as casas e os filtros são botões com aria-pressed e a contagem por extenso', () => {
    mount({ medidas: medidasDoMotor(obs), direcao: 'sobe' })
    const casas = screen.getByRole('group', { name: 'Filtrar canais por direção' })
    const subindo = within(casas).getByRole('button', { name: new RegExp(`^${concorrentes.length} subindo, filtro ligado$`) })
    expect(subindo).toHaveAttribute('aria-pressed', 'true')
    expect(within(casas).getAllByRole('button')).toHaveLength(4)
    const filtros = screen.getByRole('group', { name: 'Filtrar canais por estado' })
    expect(within(filtros).getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(
      expect.arrayContaining([`Todos: ${concorrentes.length}`, 'Parados: 0', 'Saíram do YouTube: 0']))
  })
  it('clicar em uma casa filtra pela URL (direcao) e clicar na ligada limpa', async () => {
    const user = userEvent.setup()
    mount({ medidas: medidasDoMotor(obs) })
    await user.click(screen.getByRole('button', { name: new RegExp(`^${concorrentes.length} subindo$`) }))
    expect(replace.mock.calls.at(-1)![0]).toContain('direcao=sobe')
    await user.click(screen.getByRole('button', { name: 'Parados: 0' }))
    expect(replace.mock.calls.at(-1)![0]).toContain('filter=parados')
  })
  it('canal que saiu do YouTube não tem ligação para o YouTube e continua na lista', () => {
    const medidas = medidasDoMotor(obs, { 'matt-wolfe': { m8: m8De('fora_do_ar'), m3a: naoMedido('sem_registro_recente'), extras: { missingSince: '2026-10-04T12:00:00Z' } } })
    const { container } = mount({ medidas })
    const linha = container.querySelector('tr[data-id="matt-wolfe"]')!
    expect(linha.textContent).toContain('Saiu do YouTube em 04/10')
    expect(linha.textContent).toContain('saiu do YouTube em 04/10')
    expect(linha.querySelector('a[href*="youtube.com"]')).toBeNull()
    expect(vw({ medidas, filter: 'sairam' }).list.ranked.concat(vw({ medidas, filter: 'sairam' }).list.unranked).filter(r => !r.own).map(r => r.id)).toEqual(['matt-wolfe'])
  })
  it('a 390 px (cartões) a lista tem semântica de lista, com role explícito', () => {
    const { container } = mount({ medidas: medidasDoMotor(obs), layout: 'cards' })
    const lista = container.querySelector('.cards')!
    expect(lista).toHaveAttribute('role', 'list')
    expect(lista.querySelectorAll('article[role="listitem"]').length).toBe(rowsOf(vw({ medidas: medidasDoMotor(obs), layout: 'cards' })).length)
  })
  it('78 canais: 20 por vez e "Mostrar mais 10"', async () => {
    const user = userEvent.setup()
    const w = a3World(ds => {
      const modelo = ds.channels.find(c => !c.own)!
      for (let i = 0; i < 70; i++) ds.channels.push({ ...modelo, id: `sintetico-${i}`, name: `Canal sintético ${i}`, handle: `@sint${i}` })
    }, '1')
    const medidas = medidasDoMotor(w.obs)
    mount({ medidas, limit: 120 }, {}, w.obs)
    const total = w.obs.channels.filter(c => !c.own).length
    expect(document.querySelectorAll('tbody tr.row:not(.you)').length).toBe(20)
    expect(screen.getByText(`Mostrando 20 de ${total} canais.`)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mostrar mais 10' }))
    expect(document.querySelectorAll('tbody tr.row:not(.you)').length).toBe(30)
  })
  it('as frases do resumo e da célula passam na auditoria de vocabulário e de texto solto', () => {
    const { container } = mount({ medidas: medidasDoMotor(obs, { 'matt-wolfe': { m3a: naoMedido('fecha_em', { fechaEm: '2026-10-17' }) } }) })
    expect(forbiddenVocabulary(container)).toEqual([])
    expect(noJunkText(container)).toEqual([])
  })
})

describe('E5a T5: só leitura', () => {
  it('as ações ficam desligadas, a frase do mockup aparece e todos os números são os mesmos', () => {
    const medidas = medidasDoMotor(obs)
    const a = mount({ medidas })
    const fraseA = a.container.querySelector('[data-k="resumo-frase"]')!.textContent
    const casasA = [...a.container.querySelectorAll('.obs-cn-casa')].map(x => x.getAttribute('aria-label'))
    a.unmount()
    const { container } = mount({ medidas }, { somenteLeitura: true })
    expect(container.querySelector('[data-k="so-leitura"]')?.textContent).toContain('Você só pode ler esta lista.')
    expect(container.querySelector('[data-k="so-leitura"]')?.textContent).toContain('Esta lista só tem números públicos do YouTube, então você vê tudo o que os outros veem.')
    expect(container.querySelector('a.btn-primary')).toHaveAttribute('aria-disabled', 'true')
    for (const b of container.querySelectorAll<HTMLButtonElement>('button.more')) expect(b.disabled).toBe(true)
    expect(container.querySelector('[data-k="resumo-frase"]')!.textContent).toBe(fraseA)
    expect([...container.querySelectorAll('.obs-cn-casa')].map(x => x.getAttribute('aria-label'))).toEqual(casasA)
  })
})

describe('E5a T5: toda célula não medida do modelo traz o código do motivo', () => {
  it('nas linhas da lista, a frase longa é a de FRASES_DE_MOTIVO', async () => {
    const { FRASES } = await import('@/lib/youtube/observatorio/medidas-telas/frases')
    const v = vw({ medidas: medidasDoMotor(obs, { 'matt-wolfe': { m3a: naoMedido('pouco_registro') }, 'nate-herk': { m3a: naoMedido('contagem_recuou') } }) })
    for (const r of rowsOf(v)) {
      if (r.direcao.tipo !== 'nao_medido') continue
      expect(r.direcao.longa).toBe(FRASES[r.direcao.motivo]({}).longa)
    }
    expect(rowsOf(v).filter(r => r.direcao.tipo === 'nao_medido').map(r => (r.direcao as { motivo: string }).motivo).sort()).toEqual(['contagem_recuou', 'pouco_registro'])
  })
})
void EXTRAS_OK

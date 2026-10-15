// @vitest-environment jsdom
// E5b Tarefa 11: os componentes da origem das views (barra, legenda, régua, seletor, erro, esqueleto, segurança). Fixtures sintéticas.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { Origem } from '../../../src/app/cms/(authed)/youtube/competitors/_proprio/origem'
import { OrigemEsqueleto } from '../../../src/app/cms/(authed)/youtube/competitors/_proprio/origem-esqueleto'
import { buildOrigem, CHAVE_ORIGEM, type BlocoView, type LinhaView, type OrigemView } from '../../../src/app/cms/(authed)/youtube/competitors/_proprio/origem-model'

let busca = ''
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(busca), useRouter: () => ({ refresh }) }))
let store = new Map<string, string>()
let falha = false
const armazenamento = {
  getItem: (k: string) => { if (falha) throw new Error('bloqueado'); return store.get(k) ?? null },
  setItem: (k: string, v: string) => { if (falha) throw new Error('bloqueado'); store.set(k, v) },
  removeItem: (k: string) => { if (falha) throw new Error('bloqueado'); store.delete(k) },
}
beforeEach(() => { busca = ''; store = new Map(); falha = false; refresh.mockClear(); vi.stubGlobal('localStorage', armazenamento) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const linha = (o: Partial<LinhaView> & { chave: string }): LinhaView => ({
  rotulo: o.chave, valor: 100, valorTexto: '100', pct: 50, pctTexto: '50%', semNumero: false, tipo: 'valor', rotuloLeitor: `${o.chave}: 50%, 100`, ...o,
})
const bloco = (o: Partial<BlocoView> = {}): BlocoView => ({
  id: 'origem', titulo: 'De onde vêm as views', estado: 'medido', frase: 'Frase sintética.', linhas: [], cobertura: '', regua: null, metodo: [],
  aviso: null, bloqueio: null, erro: null, rodape: null, linhasDeContagem: [], subListas: null, ...o,
})
const view = (blocos: BlocoView[], extra: Partial<OrigemView> = {}): OrigemView => ({
  nivel: 'tudo', padrao: '28', lembranca: 'Escolha salva neste navegador.', dica: 'Dados até 10/10.', semAcesso: null,
  periodos: [
    { id: '7', rotulo: '7 dias', grupo: { total: 'Total de 7 dias', blocos } },
    { id: '28', rotulo: '28 dias', grupo: { total: 'Total de 28 dias', blocos } },
    { id: '90', rotulo: '90 dias', grupo: { total: 'Total de 90 dias', blocos } },
  ], ...extra,
})
const comBarra = bloco({
  linhas: [
    linha({ chave: 'pesquisa', rotulo: 'Pesquisa do YouTube', rotuloLeitor: 'Pesquisa do YouTube: 60%, 600', valor: 600 }),
    linha({ chave: 'sugerido', rotulo: 'Vídeos sugeridos', semNumero: true, valorTexto: '—', pctTexto: '—', valor: 0, rotuloLeitor: 'Vídeos sugeridos: sem número do YouTube, pode estar no omitido' }),
    linha({ chave: 'omitido', rotulo: 'Omitido pelo YouTube', tipo: 'omitido', valor: 400, rotuloLeitor: 'Omitido pelo YouTube: 40%, 400' }),
  ],
})

describe('E5b T11: barra e legenda', () => {
  it('a barra tem role img e o rótulo lista cada origem com % e número', () => {
    render(<Origem view={view([comBarra])} />)
    const img = screen.getAllByRole('img').find(e => e.classList.contains('ov-pil'))!
    expect(img.getAttribute('aria-label')).toContain('Pesquisa do YouTube: 60%, 600')
    expect(img.getAttribute('aria-label')).toContain('Omitido pelo YouTube: 40%, 400')
  })
  it('origem sem número diz "sem número do YouTube, pode estar no omitido", nunca "0% (0)"', () => {
    const { container } = render(<Origem view={view([comBarra])} />)
    expect(container.innerHTML).toContain('sem número do YouTube, pode estar no omitido')
    expect(container.textContent).not.toContain('0% (0)')
  })
  it('a fatia do omitido é a última e tem a classe tracejada', () => {
    const { container } = render(<Origem view={view([comBarra])} />)
    const fatias = [...container.querySelectorAll('.ov-pil .ov-sg')]
    expect(fatias.at(-1)!.classList.contains('om')).toBe(true)
  })
  it('valor sem número aparece com o símbolo do mockup e aria-label "sem número informado"', () => {
    render(<Origem view={view([comBarra])} />)
    expect(screen.getAllByLabelText('sem número informado').length).toBeGreaterThan(0)
  })
})

describe('E5b T11: régua de cobertura', () => {
  const regua = (medidos: number, dias: number, parcial: boolean) => ({ medidos, dias, de: '2026-08-01', ate: '2026-10-10', parcial, marca: false, rotuloLeitor: `${medidos} de ${dias} dias medidos` })
  it('cobertura total: sem régua, só a linha de texto', () => {
    const { container } = render(<Origem view={view([bloco({ cobertura: 'Todos os dias medidos.', regua: regua(28, 28, false) })])} />)
    expect(container.querySelector('.ov-cob')).toBeNull()
    expect(container.textContent).toContain('Todos os dias medidos.')
  })
  it('cobertura parcial: régua', () => {
    const { container } = render(<Origem view={view([bloco({ regua: regua(10, 28, true) })])} />)
    expect(container.querySelector('.ov-cob')).not.toBeNull()
    expect(container.querySelector('.ov-quebra')).toBeNull()
  })
  it('mais de 60 dias antes da coleta: faixa quebrada', () => {
    const { container } = render(<Origem view={view([bloco({ regua: regua(10, 90, true) })])} />)
    expect(container.querySelector('.ov-quebra')).not.toBeNull()
  })
})

describe('E5b T11: seletor de período', () => {
  const ativos = () => screen.getAllByRole('button').filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.getAttribute('data-periodo'))
  it('o seletor troca o grupo sem navegar', async () => {
    render(<Origem view={view([bloco()])} />)
    expect(screen.getByRole('group', { name: 'Período' })).toBeTruthy()
    expect(ativos()).toEqual(['28'])
    await userEvent.click(screen.getByRole('button', { name: '7 dias' }))
    expect(ativos()).toEqual(['7'])
    expect(screen.getByText('Total de 7 dias')).toBeTruthy()
    expect(store.get(CHAVE_ORIGEM)).toBe('7')
  })
  it('?origem=90 vence o salvo', () => {
    busca = 'origem=90'; store.set(CHAVE_ORIGEM, '7')
    render(<Origem view={view([bloco()])} />)
    expect(ativos()).toEqual(['90'])
  })
  it('?assistido=28 na URL não muda o período da origem', () => {
    busca = 'assistido=7'
    render(<Origem view={view([bloco()])} />)
    expect(ativos()).toEqual(['28'])
  })
  it('localStorage que lança não quebra', async () => {
    falha = true
    render(<Origem view={view([bloco()])} />)
    await userEvent.click(screen.getByRole('button', { name: '90 dias' }))
    expect(ativos()).toEqual(['90'])
  })
  it('valor salvo que não existe nesta tela (28 no vídeo) é ignorado', () => {
    store.set(CHAVE_ORIGEM, '28')
    const v = view([bloco()], { padrao: '7', periodos: [{ id: '7', rotulo: '7 dias', grupo: { total: 't', blocos: [bloco()] } }, { id: 'tudo', rotulo: 'Tudo', grupo: { total: 't', blocos: [bloco()] } }] })
    render(<Origem view={v} />)
    expect(ativos()).toEqual(['7'])
  })
  it('volta ao padrão pela lembrança', async () => {
    store.set(CHAVE_ORIGEM, '90')
    render(<Origem view={view([bloco()])} />)
    await userEvent.click(screen.getByRole('button', { name: /^Voltar ao padrão \(/ }))
    expect(ativos()).toEqual(['28'])
    expect(store.has(CHAVE_ORIGEM)).toBe(false)
  })
})

describe('E5b T17: a faixa de duas células no topo do grupo do canal (Yannis I3)', () => {
  const faixa = { views: { rotulo: 'views no período', valor: '3.185', sub: '05/10 a 11/10' }, dias: { rotulo: 'dias com origem medida', valor: '0', sub: 'de 7 · a coleta começa em 14/10' } }
  const comFaixa = (): OrigemView => {
    const v = view([bloco()])
    return { ...v, periodos: v.periodos.map(p => ({ ...p, grupo: { ...p.grupo, faixa } })) }
  }
  it('as duas células vêm antes dos blocos, com rótulo, valor e subfrase; no lugar da linha de total', () => {
    const { container } = render(<Origem view={comFaixa()} />)
    const fx = container.querySelector('.ov-fx')!
    expect(fx.getAttribute('aria-label')).toBe('Números do período')
    expect([...fx.querySelectorAll('.ov-fx-c')].map(c => c.textContent)).toEqual(['views no período3.18505/10 a 11/10', 'dias com origem medida0de 7 · a coleta começa em 14/10'])
    expect(container.querySelector('.ov-grupo')!.firstElementChild).toBe(fx)
    expect(container.querySelector('.ov-vtot')).toBeNull()
  })
  it('sem faixa (tela do vídeo) a linha de total continua', () => {
    const { container } = render(<Origem view={view([bloco()])} />)
    expect(container.querySelector('.ov-fx')).toBeNull()
    expect(container.querySelector('.ov-vtot')!.textContent).toBe('Total de 28 dias')
  })
  it('Logan F3: com a célula de views o vídeo não mostra número solto, só a célula rotulada "views no período"', () => {
    const v = view([bloco()])
    v.periodos[1]!.grupo = { ...v.periodos[1]!.grupo, views: { rotulo: 'views no período', valor: '232', sub: '05/10 a 11/10' } }
    const { container } = render(<Origem view={v} />)
    expect(container.querySelector('.ov-vtot')).toBeNull()
    expect(container.querySelectorAll('.ov-fx-c')).toHaveLength(1)
    expect(container.querySelector('.ov-fx dt')!.textContent).toBe('views no período')
  })
})

describe('E5b T11: erro e esqueleto', () => {
  it('Tentar de novo chama refresh uma vez; terminada a transição o botão volta e o texto de espera some (a segunda falha não trava a tela)', async () => {
    render(<Origem view={view([bloco({ erro: 'Não conseguimos ler agora.' })])} />)
    const botao = () => screen.getByRole('button', { name: 'Tentar de novo' }) as HTMLButtonElement
    await userEvent.click(botao())
    expect(refresh).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(botao().disabled).toBe(false))
    expect(screen.queryByRole('status')).toBeNull()
    await userEvent.click(botao())
    expect(refresh).toHaveBeenCalledTimes(2)
  })
  it('esqueleto: nenhuma classe de hachura nem de pontilhado', () => {
    const html = renderToStaticMarkup(<OrigemEsqueleto />)
    expect(html).not.toMatch(/nmseg|hach|obs-ch-nm|dotted|ov-vz/)
    expect(html).toContain('Carregando…')
  })
})

describe('E5b T11: segurança e CSS', () => {
  const SENTINELA = 'sentinela-termo-secreto', ENDERECO = 'exemplo-secreto.test/pagina'
  const dir = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_proprio')
  const entradaBase = (nivel: 'tudo' | 'sem-termos' | 'so-aviso') => ({
    tela: 'canal' as const, nivel, podeEditar: nivel === 'tudo', hojePt: '2026-10-10', ligadoEm: '2026-08-01', publicacoes: new Map<string, string | null>(),
    periodos: [{ id: '28', rotulo: '28 dias', de: '2026-09-13', ate: '2026-10-10', totalDoPeriodo: 1000, videosDoTotal: null }], publicadoEm: null,
    origem: { acesso: 'negado' as const }, termos: { acesso: 'negado' as const },
    dm: (d: string) => d.slice(8) + '/' + d.slice(5, 7), dmy: (d: string) => d, n: (x: number) => String(x),
  })
  it('nível so-aviso: o HTML não contém o sentinela, o termo nem o endereço, em texto, title, aria-label ou data-*', () => {
    const v = buildOrigem(entradaBase('so-aviso') as Parameters<typeof buildOrigem>[0])
    const { container } = render(<Origem view={v} />)
    expect(container.innerHTML).not.toContain(SENTINELA)
    expect(container.innerHTML).not.toContain(ENDERECO)
    expect(container.querySelector('.ov-sem-acesso')).not.toBeNull()
    expect(container.querySelector('.ov-pil')).toBeNull()
  })
  it('nível sem-termos: contém os números da origem e NÃO contém o termo nem o endereço', () => {
    const b = bloco({ linhas: [linha({ chave: 'pesquisa', rotulo: 'Pesquisa do YouTube', valorTexto: '777' })] })
    const v = view([b], { nivel: 'sem-termos' })
    const { container } = render(<Origem view={v} />)
    expect(container.innerHTML).toContain('777')
    expect(container.innerHTML).not.toContain(SENTINELA)
    expect(container.innerHTML).not.toContain(ENDERECO)
  })
  it('o componente cliente não importa origem-model com dado, dados-origem nem dados-termos', () => {
    const src = fs.readFileSync(path.join(dir, 'origem-periodos.tsx'), 'utf8')
    const imports = src.match(/^import .* from .*$/gm) ?? []
    for (const i of imports) {
      expect(i).not.toMatch(/dados-origem|dados-termos|ler-diario|ler-dimensoes/)
      expect(i).not.toMatch(/origem-model/) // o modelo inteiro não vai para o navegador (m2)
    }
  })
  it('origem.css não contém color-mix(', () => {
    expect(fs.readFileSync(path.join(dir, 'origem.css'), 'utf8')).not.toContain('color-mix(')
  })
  it('alvos do seletor com 44 px de altura mínima declarada', () => {
    expect(fs.readFileSync(path.join(dir, 'origem.css'), 'utf8')).toMatch(/\.ov-pe\{[^}]*min-height:44px/)
  })
})

// @vitest-environment jsdom
// E5b N2, consertos dos portões de 15/10 (Naksu N1/N3, Gio F1): cada chave do modelo tem classe de cor e glifo; cada estado sem número tem forma.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import { Origem } from '../../../src/app/cms/(authed)/youtube/competitors/_proprio/origem'
import { CAMINHOS } from '../../../src/app/cms/(authed)/youtube/competitors/_proprio/origem-glifos'
import type { BlocoView, LinhaView, OrigemView } from '../../../src/app/cms/(authed)/youtube/competitors/_proprio/origem-model'
import { ORDEM_ORIGEM, ORDEM_APARELHO } from '../../../src/lib/youtube/observatorio/proprio/origem-grupos'

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(''), useRouter: () => ({ refresh: vi.fn() }) }))
afterEach(cleanup)

const PASTA = path.join(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_proprio')
const css = fs.readFileSync(path.join(PASTA, 'origem.css'), 'utf8')

const linha = (chave: string, o: Partial<LinhaView> = {}): LinhaView => ({
  chave, rotulo: chave, valor: 10, valorTexto: '10', pct: 10, pctTexto: '10%', semNumero: false, tipo: 'valor', rotuloLeitor: chave, ...o,
})
const bloco = (o: Partial<BlocoView> = {}): BlocoView => ({
  id: 'origem', titulo: 'T', estado: 'medido', frase: 'Frase.', linhas: [], cobertura: '', regua: null, metodo: [],
  aviso: null, bloqueio: null, erro: null, rodape: null, linhasDeContagem: [], subListas: null, ...o,
})
const view = (blocos: BlocoView[]): OrigemView => ({
  nivel: 'tudo', padrao: '28', lembranca: 'Salvo neste navegador', dica: '', semAcesso: null,
  periodos: [{ id: '28', rotulo: '28 dias', grupo: { total: 'x', blocos } }],
})

describe('Naksu N1: toda chave do modelo tem classe de cor e glifo', () => {
  const chaves = [...ORDEM_ORIGEM, 'nao_catalogado']
  it.each(chaves)('a chave %s tem a classe .o-%s no CSS e um glifo próprio', chave => {
    expect(css).toContain(`.o-${chave}{`)
    expect((CAMINHOS as Record<string, string>)[chave === 'nao_catalogado' ? 'outras' : chave]).toBeTruthy()
  })
  it('os aparelhos e os inscritos têm glifo', () => {
    for (const k of [...ORDEM_APARELHO, 'inscritos', 'nao_inscritos', 'omitido', 'pais']) expect((CAMINHOS as Record<string, string>)[k], k).toBeTruthy()
  })
  it('a barra e a lista emitem a classe da chave e um glifo dentro de cada quadrado', () => {
    const linhas = ORDEM_ORIGEM.map(c => linha(c))
    const { container } = render(<Origem view={view([bloco({ linhas })])} />)
    for (const c of ORDEM_ORIGEM) {
      expect(container.querySelector(`.ov-sw.o-${c} svg.ov-g`), c).not.toBeNull()
      expect(container.querySelector(`.ov-sg.o-${c} svg.ov-g`), c).not.toBeNull()
    }
  })
  it('as classes emitidas pelo TSX sempre existem no CSS (a fonte da verdade são as chaves do modelo)', () => {
    const linhas = [...ORDEM_ORIGEM.map(c => linha(c)), linha('nao_catalogado', { tipo: 'nao_catalogado' })]
    const { container } = render(<Origem view={view([bloco({ linhas })])} />)
    const usadas = new Set<string>()
    container.querySelectorAll('.ov-sw, .ov-sg').forEach(el => el.classList.forEach(c => { if (c.startsWith('o-')) usadas.add(c) }))
    expect(usadas.size).toBe(7)
    for (const c of usadas) expect(css, c).toContain(`.${c}{`)
  })
})

describe('Naksu N2: as variáveis de fonte existem', () => {
  it('origem.css não usa --mono nem --sans (nenhuma das duas é definida no app)', () => {
    expect(css).not.toMatch(/var\(--(mono|sans)\)/)
  })
})

describe('Naksu N3: estado sem número tem forma', () => {
  it('não medido leva hachura; zero leva a caixa vazada; erro leva ícone; bloqueio leva cadeado', () => {
    const { container } = render(<Origem view={view([
      bloco({ id: 'origem', estado: 'nao_medido', frase: 'Sem coleta.' }),
      bloco({ id: 'pais', estado: 'zero', frase: 'Zero.' }),
      bloco({ id: 'termos', estado: 'erro', erro: 'Falhou.', frase: '' }),
      bloco({ id: 'aparelho', estado: 'bloqueado', bloqueio: 'Você não vê este dado.' }),
    ])} />)
    expect(container.querySelector('[data-bloco="origem"] .ov-hach')).not.toBeNull()
    expect(container.querySelector('[data-bloco="pais"] .ov-zero')).not.toBeNull()
    expect(container.querySelector('[data-bloco="termos"] .ov-er .ov-er-i svg')).not.toBeNull()
    expect(container.querySelector('[data-bloco="aparelho"] .ov-bq .ov-bq-i svg')).not.toBeNull()
  })
  it('aparelho, país e inscritos usam a linha com trilha', () => {
    const { container } = render(<Origem view={view([bloco({ id: 'aparelho', linhas: [linha('celular', { pct: 70 }), linha('omitido', { tipo: 'omitido' })] })])} />)
    expect(container.querySelectorAll('.ov-hb')).toHaveLength(2)
    expect((container.querySelector('.ov-hb .ov-tr i') as HTMLElement).style.width).toBe('70%')
  })
  it('"não medido" na faixa é o chip do kit, não texto solto', () => {
    const v = view([bloco()])
    v.periodos[0]!.grupo.faixa = { views: { rotulo: 'views no período', valor: 'não medido', sub: 'x' }, dias: { rotulo: 'dias com origem medida', valor: '—', sub: 'de 7' } }
    const { container } = render(<Origem view={v} />)
    expect(container.querySelectorAll('.ov-fx .obs-ch-nm')).toHaveLength(2)
  })
})

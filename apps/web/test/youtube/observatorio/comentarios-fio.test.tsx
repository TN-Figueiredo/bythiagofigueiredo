// @vitest-environment jsdom
// Comentários em produção · T2: o componente FioDeComentario.
import { describe, it, expect, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { FioDeComentario } from '@/app/cms/(authed)/youtube/competitors/_chrome/comentarios/fio'
import type { AutorDaFala, CriadorDoFio, FalaView, FioView } from '@/app/cms/(authed)/youtube/competitors/_chrome/comentarios/fio-model'

afterEach(cleanup)

const criador: CriadorDoFio = { nome: 'Matheus Fonseca', avatar: 'https://yt3.ggpht.com/foto=s88', ini: 'M', color: '#336699' }
const semFoto: CriadorDoFio = { ...criador, avatar: null }
const fala = (autor: AutorDaFala, texto: string | null, data: string | null = '16/10'): FalaView => ({ autor, data, texto, cortado: false })
const fio = (over: Partial<FioView> = {}): FioView => ({
  id: 'cd-1-1',
  raiz: fala({ tipo: 'espectador' }, 'Gostei muito', '15/10'),
  respostas: [],
  respostaReservada: null,
  meta: { curtidas: null, regua: null, posicao: null, respostas: null },
  marcas: { entrou: null, saido: false },
  pastilha: null,
  ...over,
})
const doCriador = (t: string): FalaView => fala({ tipo: 'criador' }, t)
const montar = (v: FioView, c: CriadorDoFio = criador) => render(<ul><FioDeComentario v={v} criador={c} densidade="cartao" /></ul>)

describe('FioDeComentario · avatar e autor', () => {
  it('espectador: silhueta (svg aria-hidden) e o texto "Espectador"; nunca "?" nem img', () => {
    const { container } = montar(fio())
    const av = container.querySelector('.cf-av')!
    expect(av.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(av.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('Espectador')
    expect(container.textContent).not.toContain('?')
  })
  it('criador com avatar: ChannelAvatar desenha img alt vazio em .cf-av.cri; o selo é exatamente "Criador"', () => {
    const { container } = montar(fio({ respostas: [doCriador('valeu')] }))
    const img = container.querySelector('.cf-resp .cf-av.cri img')
    expect(img?.getAttribute('alt')).toBe('')
    expect(container.querySelector('.cf-resp .cf-selo')?.textContent).toBe('Criador')
  })
  it('criador sem foto: inicial; foto quebrada: cai na inicial (Foco 1)', () => {
    const a = montar(fio({ respostas: [doCriador('valeu')] }), semFoto)
    expect(a.container.querySelector('.cf-resp [data-avatar="ini"]')?.textContent).toBe('M')
    expect(a.container.querySelector('.cf-resp img')).toBeNull()
    cleanup()
    const b = montar(fio({ respostas: [doCriador('valeu')] }))
    fireEvent.error(b.container.querySelector('.cf-resp img')!)
    expect(b.container.querySelector('.cf-resp [data-avatar="ini"]')?.textContent).toBe('M')
  })
  it('identidade: foto sem Referer e nome; cai na inicial no erro; "até dd/mm"', () => {
    const v = fio({ raiz: fala({ tipo: 'identidade', nome: 'Ana Souza', fotoUrl: 'https://yt3.ggpht.com/ana', ate: '02/11' }, 'oi') })
    const { container } = montar(v)
    expect(container.querySelector('img[referrerpolicy="no-referrer"]')).not.toBeNull()
    expect(container.textContent).toContain('Ana Souza')
    expect(container.textContent).toContain('até 02/11')
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.cf-av')?.textContent).toBe('A')
  })
  it('proprio: selo "Seu canal"; grande: faixa e nenhum nome; reservado: sem texto de autor', () => {
    expect(montar(fio({ raiz: fala({ tipo: 'proprio' }, 'meu') })).container.querySelector('.cf-selo')?.textContent).toBe('Seu canal')
    cleanup()
    const g = montar(fio({ raiz: fala({ tipo: 'grande', faixa: '1m_10m' }, 'oi') }))
    expect(g.container.textContent).toContain('1 a 10 milhões')
    expect(g.container.querySelector('.cf-nome')?.textContent).not.toContain('Espectador')
    cleanup()
    const r = montar(fio({ raiz: fala({ tipo: 'reservado' }, null) }))
    expect(r.container.querySelector('.cf-nome')).toBeNull()
  })
  it('nome de 60 caracteres leva a classe de corte (Foco 5)', () => {
    const nome = 'N'.repeat(60)
    const { container } = montar(fio({ respostas: [doCriador('oi')] }), { ...criador, nome })
    const el = Array.from(container.querySelectorAll('.cf-nome')).find((e) => e.textContent === nome)
    expect(el).toBeDefined()
  })
})

describe('FioDeComentario · respostas, texto e meta', () => {
  it('5 respostas: 3 visíveis, "Ver as outras 2 respostas do criador"; clicar mostra 5 e vira "Recolher"; o foco fica no botão (Foco 2)', () => {
    const v = fio({ respostas: [1, 2, 3, 4, 5].map((i) => doCriador('r' + i)) })
    const { container, getByRole } = montar(v)
    expect(container.querySelectorAll('.cf-resp')).toHaveLength(3)
    const b = getByRole('button', { name: 'Ver as outras 2 respostas do criador' })
    expect(b.getAttribute('aria-expanded')).toBe('false')
    b.focus()
    fireEvent.click(b)
    expect(container.querySelectorAll('.cf-resp')).toHaveLength(5)
    expect(b.textContent).toBe('Recolher')
    expect(b.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(b)
    fireEvent.click(b)
    expect(container.querySelectorAll('.cf-resp')).toHaveLength(3)
  })
  it('até 3 respostas: nenhum botão', () => {
    const { container } = montar(fio({ respostas: [doCriador('a'), doCriador('b'), doCriador('c')] }))
    expect(container.querySelector('.cf-mais')).toBeNull()
  })
  it('HTML no texto vira texto literal; nenhum link dentro de .cf-txt; dir=auto', () => {
    const { container } = montar(fio({ raiz: fala({ tipo: 'espectador' }, '<b>x</b> veja https://exemplo.com') }))
    const t = container.querySelector('.cf-txt')!
    expect(t.textContent).toBe('<b>x</b> veja https://exemplo.com')
    expect(t.querySelector('b')).toBeNull()
    expect(container.querySelector('.cf-txt a[href]')).toBeNull()
    expect(t.getAttribute('dir')).toBe('auto')
  })
  it('respostaReservada aparece no lugar das respostas', () => {
    const { container } = montar(fio({ respostaReservada: 'O criador respondeu. O texto da resposta é reservado.' }))
    expect(container.textContent).toContain('O texto da resposta é reservado.')
    expect(container.querySelector('.cf-resp img, .cf-resp .cf-txt')).toBeNull()
  })
  it('nível contagem: sem .cf-txt e com "Texto reservado"', () => {
    const { container } = montar(fio({ raiz: fala({ tipo: 'espectador' }, null) }))
    expect(container.querySelector('.cf-txt')).toBeNull()
    expect(container.textContent).toContain('Texto reservado')
  })
  it('marcas e meta: "entrou no dia 7", "N respostas", zero medido e cf-saiu', () => {
    const v = fio({
      meta: { curtidas: '15 com 1 dia', regua: 60, posicao: '1 de 12', respostas: { n: 0, texto: '0 respostas' } },
      marcas: { entrou: 'entrou no dia 7', saido: true },
    })
    const { container } = montar(v)
    expect(container.querySelector('.cf-entrou')?.textContent).toBe('entrou no dia 7')
    expect(container.querySelector('.obs-ch-zero')?.textContent).toBe('0')
    expect(container.textContent).toContain('15 com 1 dia')
    expect(container.textContent).toContain('1 de 12')
    expect(container.querySelector('.cf-reg b')?.getAttribute('style')).toContain('60%')
    expect(container.querySelector('li.cf')?.className).toContain('cf-saiu')
    cleanup()
    const n = montar(fio({ meta: { curtidas: null, regua: null, posicao: null, respostas: { n: 4, texto: '4 respostas' } } }))
    expect(n.container.textContent).toContain('4 respostas')
    expect(n.container.querySelector('.obs-ch-zero')).toBeNull()
  })
  it('pastilha de motivo e o encaixe extra', () => {
    const v = fio({ pastilha: { chave: 'c', texto: 'Mais curtido' } })
    const { container } = render(<ul><FioDeComentario v={v} criador={criador} densidade="lista" extra={<p>aviso do vídeo</p>} /></ul>)
    expect(container.querySelector('.cf-motivo')?.textContent).toBe('Mais curtido')
    expect(container.querySelector('li.cf')?.className).toContain('m-c')
    expect(container.querySelector('.cf-extra')?.textContent).toBe('aviso do vídeo')
  })
})

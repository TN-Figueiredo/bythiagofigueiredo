// @vitest-environment jsdom
/** A5 · E9, Tarefa 10b: a tela montada (servidor desenhado em jsdom) e as regras de fronteira cliente/servidor. */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { FilaScreen } from '@/app/cms/(authed)/youtube/competitors/_saiu/fila-screen'
import { buildFilaView } from '@/app/cms/(authed)/youtube/competitors/_saiu/view-model'
import { buildChromeView } from '@/app/cms/(authed)/youtube/competitors/_chrome/view-model'
import { createObservatory } from '@/lib/youtube/observatorio'
import { loadOracle, datasetFromOracle } from './oracle'
import type { LeituraDaFila } from '@/lib/youtube/observatorio/saiu/modelo'
import { AGORA, apagando, canal, fila, grupo, respondidoApagado, respondidoMantido, video, voltouApagado } from './saiu-fixtures'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
afterEach(() => { cleanup(); refresh.mockClear() })

const R = { desfecho: 'mantido', frase: 'Mantido para análise.' }
const acoes = () => ({
  apagar: vi.fn(async () => R), manter: vi.fn(async () => R), volta: vi.fn(async () => R), tentar: vi.fn(async () => R), ignorarGrupo: vi.fn(async () => R),
})
const tela = (l: LeituraDaFila, mostrar = 10, a = acoes()) => {
  const view = buildFilaView(l, { agoraMs: AGORA, mostrar })
  return { a, ...render(<FilaScreen view={view} acoes={a} />) }
}

describe('A5 E9 T10b: tela da fila', () => {
  it('cada bloco só aparece com item', () => {
    tela(fila({ esperando: [] }))
    expect(screen.queryByText(/Voltaram ao ar/)).toBeNull()
    expect(screen.queryByText(/Apagando \(/)).toBeNull()
    expect(screen.queryByText(/Já respondidos/)).toBeNull()
    cleanup()
    tela(fila({ esperando: [video(1)], apagando: [apagando(1)], voltaram: [voltouApagado()], respondidos: [respondidoMantido(), respondidoApagado()], respondidosTotal: 2 }))
    expect(screen.getByText('Voltaram ao ar (1)')).toBeTruthy()
    expect(screen.getByText('Apagando (1)')).toBeTruthy()
    expect(screen.getByText('Já respondidos (2)')).toBeTruthy()
  })

  it('cartões: tipo com ícone e palavra, título, "Guardado" e os dois botões', () => {
    tela(fila({ esperando: [video(1), canal(), grupo()] }))
    expect(screen.getAllByText('Vídeo').length).toBeGreaterThan(0)
    expect(screen.getByText('Canal inteiro')).toBeTruthy()
    expect(screen.getByText('Comentários')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Manter para análise' })).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Apagar o canal…' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Apagar os textos…' })).toBeTruthy()
  })

  it('"Manter para análise" chama a ação com o tipo e o id do item', async () => {
    const { a } = tela(fila({ esperando: [video(1)] }))
    fireEvent.click(screen.getByRole('button', { name: 'Manter para análise' }))
    await waitFor(() => expect(a.manter).toHaveBeenCalledWith({ tipo: 'video', ids: [video(1).chave] }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('quem não administra: botões de resposta desabilitados e a frase aparece', () => {
    tela(fila({ esperando: [video(1)], podeResponder: false }))
    expect((screen.getByRole('button', { name: 'Manter para análise' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getAllByText('Só quem administra o site pode responder.').length).toBeGreaterThan(0)
  })

  it('volta: "Voltar a acompanhar" e "Ignorar" chamam a ação com o item e a decisão', async () => {
    const { a } = tela(fila({ esperando: [], voltaram: [voltouApagado()] }))
    fireEvent.click(screen.getByRole('button', { name: 'Voltar a acompanhar' }))
    await waitFor(() => expect(a.volta).toHaveBeenCalledWith({ itemId: 21, decisao: 'voltar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ignorar' }))
    await waitFor(() => expect(a.volta).toHaveBeenCalledWith({ itemId: 21, decisao: 'ignorar' }))
  })

  it('apagando: "Tentar de novo" chama a ação com o item', async () => {
    const { a } = tela(fila({ esperando: [], apagando: [apagando(5)] }))
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(a.tentar).toHaveBeenCalledWith({ itemId: 5 }))
  })

  it('"Mostrar mais" é um link que recarrega com ?mostrar=20', () => {
    tela(fila({ esperando: Array.from({ length: 13 }, (_, i) => video(i)) }))
    const l = screen.getByRole('link', { name: 'Mostrar mais 3' })
    expect(l.getAttribute('href')).toBe('/cms/youtube/competitors/saiu?mostrar=20')
  })

  it('erro: só a frase em role="alert", nenhum bloco de lista', () => {
    tela({ estado: 'erro', codigo: 'erro_de_banco' })
    expect(screen.getByRole('alert').textContent).toBe('Não foi possível ler a fila agora.')
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('a aba tem o contador; "?" quando a contagem falhou', () => {
    const obs = createObservatory(datasetFromOracle(loadOracle()))
    const com7 = buildChromeView(obs, { tab: 'saiu', niche: 'todos', fila: { n: 7 } }).tabs.at(-1)!
    expect([com7.key, com7.count, com7.current]).toEqual(['saiu', 7, true])
    expect(buildChromeView(obs, { tab: 'saiu', niche: 'todos', fila: { n: null } }).tabs.at(-1)!.countText).toBe('?')
  })

  it('nenhum componente cliente da pasta importa a ação de servidor', () => {
    const dir = join(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_saiu')
    for (const f of readdirSync(dir).filter(n => n.endsWith('.tsx'))) {
      const t = readFileSync(join(dir, f), 'utf8')
      if (/^['"]use client['"]/.test(t)) expect(t, f).not.toMatch(/from ['"][^'"]*\/actions['"]/)
    }
  })

  it('C-1 (portão 14/10): fila-screen.tsx é cliente, porque passa funções comuns a BotaoDeResposta', () => {
    const dir = join(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_saiu')
    for (const f of readdirSync(dir).filter(n => n.endsWith('.tsx'))) {
      const t = readFileSync(join(dir, f), 'utf8')
      const passaFuncao = /=\{\s*(async\s*)?\(/.test(t) && /<(BotaoDeResposta|PainelApagar)\b/.test(t)
      if (passaFuncao) expect(t, `${f} passa função a componente cliente sem 'use client'`).toMatch(/^(\/\*[\s\S]*?\*\/\s*)?['"]use client['"]/)
    }
    expect(readFileSync(join(dir, 'fila-screen.tsx'), 'utf8')).toMatch(/^(\/\*[\s\S]*?\*\/\s*)?['"]use client['"]/)
  })

  it('C-1: as ações que a página entrega são ações de servidor', () => {
    const base = join(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
    expect(readFileSync(join(base, '_saiu/actions.ts'), 'utf8')).toMatch(/^['"]use server['"]/)
    const pagina = readFileSync(join(base, 'saiu/page.tsx'), 'utf8')
    expect(pagina).toMatch(/from ['"]\.\.\/_saiu\/actions['"]/)
    expect(pagina).not.toMatch(/acoes=\{\{[^}]*=>/)
  })
})

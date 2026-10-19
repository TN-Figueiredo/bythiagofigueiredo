// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { montarFaixa, horaSP, type Faixa, type FaixaCompleta, type CtxFaixa } from '@/app/cms/(authed)/youtube/ab-lab/_components/faixa-restauracao-texto'
import { FaixaRestauracao } from '@/app/cms/(authed)/youtube/ab-lab/_components/faixa-restauracao'
import type { CampoRestauracao, RestoreStatus, ErroGravado } from '@/lib/youtube/ab-restore'

afterEach(cleanup)

const AGORA = new Date('2026-10-12T09:00:00Z') // 06:00 em SP
const ctx: CtxFaixa = { agora: AGORA, rotulo: id => (id === 'vb' ? 'B' : id), noArAntes: 'C', noArDesde: '2026-10-07T08:00:00Z', youtubeId: 'yt123',
  vigiaUltimaExecucao: '2026-10-11T20:00:00Z', podeAdministrar: true, bloqueio: null, inicioDoSim: {} }
const T0502 = '2026-10-12T08:02:00Z' // 12/10 05:02 SP
const T0500 = '2026-10-12T08:00:00Z'
const T1700 = '2026-10-12T20:00:00Z'

function campo(p: Partial<CampoRestauracao>): CampoRestauracao {
  return { estado: 'ok', destino: 'original', em: T0502, forcado: false, escreveu: true, erro: null, attempts: 1, ...p }
}
const recusa: ErroGravado = { status: 403, reason: 'forbidden', chamada: 'videos.update' }
const OK_THUMB = campo({})

const SEMENTES: Record<string, RestoreStatus> = {
  A1: { title: campo({ estado: 'em_andamento', em: '2026-10-12T08:58:00Z', escreveu: null }), thumbnail: campo({ estado: 'em_andamento', em: '2026-10-12T08:58:00Z', escreveu: null }) },
  A2: { title: campo({ estado: 'em_andamento', destino: 'vb', em: '2026-10-12T08:58:00Z', escreveu: null }), thumbnail: campo({ destino: 'vb', em: '2026-10-12T08:58:00Z' }) },
  A3: { title: campo({ estado: 'em_andamento', em: T0500, escreveu: null }) },
  B: { title: campo({}), thumbnail: campo({}) },
  C: { title: campo({ estado: 'falhou', erro: recusa }), thumbnail: OK_THUMB },
  D: { title: campo({ estado: 'falhou', destino: 'vb', forcado: true, erro: recusa }), thumbnail: campo({ destino: 'vb' }) },
  D2: { title: campo({ estado: 'falhou', destino: 'vb', erro: recusa }), thumbnail: campo({ destino: 'vb' }) },
  E: { title: campo({}), thumbnail: campo({ estado: 'pulado_drift' }) },
  F: { title: campo({}), thumbnail: campo({ estado: 'pulado_drift', motivo: 'sem_base_de_comparacao' }) },
  G: { title: campo({ estado: 'pulado_sem_original', em: T0502 }), thumbnail: OK_THUMB },
  J1: { title: campo({ estado: 'desistiu', motivo: 'video_inexistente', em: T1700 }), thumbnail: OK_THUMB },
  J2: { title: campo({ estado: 'desistiu', motivo: 'novo_teste', em: T1700 }), thumbnail: OK_THUMB },
}

function completa(f: Faixa | null): FaixaCompleta {
  if (!f || f.tom === 'ok') throw new Error('esperava faixa completa')
  return f
}
const STUDIO = 'https://studio.youtube.com/video/yt123/edit'

describe('estados da faixa: texto exato da tabela do plano', () => {
  it('A1', () => {
    expect(montarFaixa(SEMENTES.A1, ctx)).toMatchObject({
      tom: 'busy', lbl: 'Voltando ao original…', resumo: 'Título e thumbnail estão sendo trocados no YouTube.',
      linhas: [
        { campo: 'title', rotulo: 'Título', tom: 'busy', texto: 'Trocando desde 12/10 05:58.', hora: '12/10 05:58' },
        { campo: 'thumbnail', rotulo: 'Thumbnail', tom: 'busy', texto: 'Trocando desde 12/10 05:58.', hora: '12/10 05:58' },
      ],
      linkStudio: null, linkRotulo: null, ajuda: null, fine: null, papel: 'region',
    })
  })
  it('A2', () => {
    expect(montarFaixa(SEMENTES.A2, ctx)).toMatchObject({
      tom: 'busy', lbl: 'Trocando pela variante B…', resumo: 'O título está sendo trocado no YouTube.',
      linhas: [
        { campo: 'title', rotulo: 'Título', tom: 'busy', texto: 'Trocando desde 12/10 05:58.', hora: '12/10 05:58' },
        { campo: 'thumbnail', rotulo: 'Thumbnail', tom: 'ok', texto: 'Variante B aplicada em 12/10 05:58.', hora: '12/10 05:58' },
      ],
      linkStudio: null, linkRotulo: null, ajuda: null, fine: null, papel: 'region',
    })
  })
  it('A3', () => {
    expect(montarFaixa(SEMENTES.A3, ctx)).toMatchObject({
      tom: 'warn', icone: 'none', lbl: 'Atenção:', resumo: 'Não sabemos se voltou ao original.',
      linhas: [{ campo: 'title', rotulo: 'Título', tom: 'warn', icone: 'none', texto: 'Sem resposta desde 12/10 05:00. Não sabemos se a troca foi feita. Confira o título no YouTube Studio.', hora: '12/10 05:00' }],
      linkStudio: STUDIO, linkRotulo: 'Abrir no YouTube Studio', ajuda: null, fine: null, papel: 'region',
    })
  })
  it('A3: ícone é o círculo tracejado (não o triângulo) na faixa e na linha, cor de atenção', () => {
    const f = completa(montarFaixa(SEMENTES.A3, ctx))
    expect(f.icone).toBe('none')
    expect(f.linhas[0].icone).toBe('none')
    const { container } = render(<FaixaRestauracao faixa={f} />)
    for (const svg of Array.from(container.querySelectorAll('svg'))) {
      expect(svg.querySelector('circle[stroke-dasharray]')).not.toBeNull()
      expect(svg.querySelector('path[d^="M12 3L22"]')).toBeNull()
    }
    expect(container.querySelector('.fr-band.warn')).not.toBeNull()
    cleanup()
    // E (alguém editou por fora) segue com o triângulo
    const e = render(<FaixaRestauracao faixa={completa(montarFaixa(SEMENTES.E, ctx))} />)
    expect(e.container.querySelector('svg path[d^="M12 3L22"]')).not.toBeNull()
  })
  it('A3 na variante e na thumbnail', () => {
    const f = completa(montarFaixa({ thumbnail: campo({ estado: 'em_andamento', destino: 'vb', em: T0500 }) }, ctx))
    expect(f.resumo).toBe('Não sabemos se a variante B foi aplicada.')
    expect(f.linhas[0].texto).toBe('Sem resposta desde 12/10 05:00. Não sabemos se a troca foi feita. Confira a thumbnail no YouTube Studio.')
  })
  it('B: okline mostra "Horários de São Paulo"; destinos diferentes não viram "voltaram ao original"', () => {
    render(<FaixaRestauracao faixa={montarFaixa(SEMENTES.B, ctx) as Faixa} />)
    expect(screen.getByText('Horários de São Paulo')).toBeTruthy()
    cleanup()
    const misto = montarFaixa({ title: campo({}), thumbnail: campo({ destino: 'vb' }) }, ctx)
    expect(misto).toEqual({ tom: 'ok', okline: 'Título: Voltou ao original em 12/10 05:02. Thumbnail: Variante B aplicada em 12/10 05:02.' })
  })
  it('B', () => {
    expect(montarFaixa(SEMENTES.B, ctx)).toEqual({ tom: 'ok', okline: 'Título e thumbnail voltaram ao original em 12/10 05:02.' })
    expect(montarFaixa({ title: campo({}) }, ctx)).toEqual({ tom: 'ok', okline: 'O título voltou ao original em 12/10 05:02.' })
    expect(montarFaixa({ thumbnail: campo({}) }, ctx)).toEqual({ tom: 'ok', okline: 'A thumbnail voltou ao original em 12/10 05:02.' })
    expect(montarFaixa({ title: campo({ destino: 'vb' }), thumbnail: campo({ destino: 'vb' }) }, ctx)).toEqual({ tom: 'ok', okline: 'Variante B no ar desde 12/10 05:02.' })
  })
  it('C', () => {
    expect(montarFaixa(SEMENTES.C, ctx)).toMatchObject({
      tom: 'err', lbl: 'Erro:', resumo: 'o título não voltou ao original. O título no ar ainda é o da variante C.',
      linhas: [
        { campo: 'title', rotulo: 'Título', tom: 'err', texto: 'O YouTube recusou em 12/10 05:02. Nova tentativa automática por volta das 07:00 (horário de São Paulo), tentativa 2 de 3.', hora: '12/10 05:02' },
        { campo: 'thumbnail', rotulo: 'Thumbnail', tom: 'ok', texto: 'Voltou ao original em 12/10 05:02.', hora: '12/10 05:02' },
      ],
      linkStudio: STUDIO, linkRotulo: 'Abrir no YouTube Studio', ajuda: null, fine: null, papel: 'region',
    })
  })
  it('C na thumbnail troca "o título" por "a thumbnail"', () => {
    const f = completa(montarFaixa({ thumbnail: campo({ estado: 'falhou', erro: { status: 400, reason: 'x', chamada: 'thumbnails.set' } }) }, ctx))
    expect(f.resumo).toBe('a thumbnail não voltou ao original. A thumbnail no ar ainda é a da variante C.')
  })
  it('D', () => {
    expect(montarFaixa(SEMENTES.D, ctx)).toMatchObject({
      tom: 'err', lbl: 'Erro:', resumo: 'o título da variante B não foi aplicado. No ar continua o título editado por fora.',
      linhas: [
        { campo: 'title', rotulo: 'Título', tom: 'err', texto: 'O YouTube recusou em 12/10 05:02. Nova tentativa automática por volta das 07:00 (horário de São Paulo), sem perguntar de novo: ela repete a troca que você confirmou.', hora: '12/10 05:02' },
        { campo: 'thumbnail', rotulo: 'Thumbnail', tom: 'ok', texto: 'Variante B aplicada em 12/10 05:02.', hora: '12/10 05:02' },
      ],
      linkStudio: STUDIO, linkRotulo: 'Abrir no YouTube Studio', ajuda: null, fine: null, papel: 'region',
    })
  })
  it('D2', () => {
    const f = completa(montarFaixa(SEMENTES.D2, ctx))
    expect(f.resumo).toBe('o título da variante B não foi aplicado. No ar continua o da variante C.')
    expect(f.linhas[0].texto).toBe('O YouTube recusou em 12/10 05:02. Nova tentativa automática por volta das 07:00 (horário de São Paulo), tentativa 2 de 3.')
    expect(f.fine).toBeNull()
  })
  it('E', () => {
    expect(montarFaixa(SEMENTES.E, ctx)).toMatchObject({
      tom: 'warn', lbl: 'Atenção:', resumo: 'a thumbnail no ar não é de nenhuma variante deste teste: alguém editou por fora. Nada foi alterado.',
      linhas: [
        { campo: 'title', rotulo: 'Título', tom: 'ok', texto: 'Voltou ao original em 12/10 05:02.', hora: '12/10 05:02' },
        { campo: 'thumbnail', rotulo: 'Thumbnail', tom: 'warn', texto: 'Mantida como está no YouTube desde 12/10 05:02.', hora: '12/10 05:02' },
      ],
      linkStudio: STUDIO, linkRotulo: 'Abrir no YouTube Studio', ajuda: null, fine: null, papel: 'status',
    })
  })
  it('F', () => {
    expect(montarFaixa(SEMENTES.F, ctx)).toMatchObject({
      tom: 'warn', icone: 'none', lbl: 'Atenção:', resumo: 'não foi possível comparar a thumbnail no ar com as variantes. Nada foi alterado.',
      linhas: [
        { campo: 'title', rotulo: 'Título', tom: 'ok', texto: 'Voltou ao original em 12/10 05:02.', hora: '12/10 05:02' },
        { campo: 'thumbnail', rotulo: 'Thumbnail', tom: 'none', texto: 'Não medida: sem imagem de referência para comparar.' },
      ],
      linkStudio: STUDIO, linkRotulo: 'Abrir no YouTube Studio', ajuda: null, fine: null, papel: 'status',
    })
  })
  it('G', () => {
    expect(montarFaixa(SEMENTES.G, ctx)).toMatchObject({
      tom: 'warn', lbl: 'Atenção:', resumo: 'o título original não foi guardado quando o teste começou. Nada foi alterado.',
      linhas: [
        { campo: 'title', rotulo: 'Título', tom: 'warn', texto: 'Continua o da variante C, no ar desde 07/10 05:00.', hora: '07/10 05:00' },
        { campo: 'thumbnail', rotulo: 'Thumbnail', tom: 'ok', texto: 'Voltou ao original em 12/10 05:02.', hora: '12/10 05:02' },
      ],
      linkStudio: STUDIO, linkRotulo: 'Abrir no YouTube Studio para conferir', ajuda: null, fine: null, papel: 'status',
    })
  })
  it('G: "no ar desde" usa noArDesde, não a hora do campo; sem noArDesde a frase sai sem hora', () => {
    const f = completa(montarFaixa(SEMENTES.G, ctx))
    expect(f.linhas[0].texto).toBe('Continua o da variante C, no ar desde 07/10 05:00.')
    expect(f.linhas[0].texto).not.toContain('12/10')
    const sem = completa(montarFaixa(SEMENTES.G, { ...ctx, noArDesde: null }))
    expect(sem.linhas[0].texto).toBe('Continua o da variante C.')
    expect(sem.linhas[0].texto).not.toContain('no ar desde')
    expect(sem.linhas[0].hora).toBeUndefined()
  })
  it('J1', () => {
    expect(montarFaixa(SEMENTES.J1, ctx)).toMatchObject({
      tom: 'none', lbl: 'Sem nova tentativa:',
      resumo: 'o Lab parou de restaurar este vídeo porque ele não foi encontrado no YouTube. Se você o apagou, não há nada a fazer.',
      linhas: [
        { campo: 'title', rotulo: 'Título', tom: 'none', texto: 'Não foi restaurado. Parou em 12/10 17:00.', hora: '12/10 17:00' },
        { campo: 'thumbnail', rotulo: 'Thumbnail', tom: 'ok', texto: 'Voltou ao original em 12/10 05:02.', hora: '12/10 05:02' },
      ],
      linkStudio: STUDIO, linkRotulo: 'Abrir no YouTube Studio', ajuda: 'Se não foi você quem apagou, confira no YouTube Studio.', fine: null, papel: 'region',
    })
  })
  it('J2', () => {
    expect(montarFaixa(SEMENTES.J2, ctx)).toMatchObject({
      tom: 'none', lbl: 'Sem nova tentativa:',
      resumo: 'o Lab parou de restaurar este vídeo porque outro teste começou nele. O que está no ar agora segue o novo teste.',
      linhas: [
        { campo: 'title', rotulo: 'Título', tom: 'none', texto: 'Não foi restaurado antes de o novo teste começar. Parou em 12/10 17:00.', hora: '12/10 17:00' },
        { campo: 'thumbnail', rotulo: 'Thumbnail', tom: 'ok', texto: 'Voltou ao original em 12/10 05:02.', hora: '12/10 05:02' },
      ],
      linkStudio: null, linkRotulo: null, ajuda: null, fine: null, papel: 'region',
    })
  })
})

describe('regras', () => {
  it('J1/J2: sem botão, sem link de novo teste, tom none, resumo uma vez com os dois campos desistindo', () => {
    const duplo = completa(montarFaixa({ title: campo({ estado: 'desistiu', motivo: 'novo_teste' }), thumbnail: campo({ estado: 'desistiu', motivo: 'novo_teste' }) }, ctx))
    expect(duplo.linhas.map(l => l.texto)).toHaveLength(2)
    expect(duplo.linkStudio).toBeNull()
    render(<FaixaRestauracao faixa={duplo} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(document.body.textContent?.match(/Sem nova tentativa:/g)).toHaveLength(1)
    expect(document.body.textContent).not.toMatch(/Abrir o novo teste/)
  })

  it('F-D10: escrita → "O YouTube recusou"; leitura, {motivo}, string interna e ilegível → "Sem resposta desde"', () => {
    const comErro = (e: ErroGravado) => ({ title: campo({ estado: 'falhou', erro: e }) })
    expect(completa(montarFaixa(comErro({ status: 403, reason: 'x', chamada: 'videos.update' }), ctx)).linhas[0].texto).toMatch(/O YouTube recusou/)
    expect(completa(montarFaixa(comErro({ status: 403, reason: 'x', chamada: 'thumbnails.set' }), ctx)).linhas[0].texto).toMatch(/O YouTube recusou/)
    for (const e of [{ status: 503, reason: 'x', chamada: 'videos.list' as const }, { status: 500, reason: 'x' }, { motivo: 'tempo_esgotado' }, 'interrompido', null]) {
      const l = completa(montarFaixa(comErro(e), ctx)).linhas[0].texto
      expect(l).toMatch(/Sem resposta desde/)
      expect(l).not.toMatch(/O YouTube recusou/)
    }
  })

  it('em_andamento: 5:00 exato ainda é em andamento; passou disso, sem resposta', () => {
    const emAnd = (em: string) => completa(montarFaixa({ title: campo({ estado: 'em_andamento', em }) }, ctx))
    expect(emAnd('2026-10-12T08:55:00Z').tom).toBe('busy')
    expect(emAnd('2026-10-12T08:54:59Z').tom).toBe('warn')
  })

  it('nulo e {} → sem faixa (nunca "voltou ao original")', () => {
    expect(montarFaixa(null, ctx)).toBeNull()
    expect(montarFaixa({}, ctx)).toBeNull()
  })

  it('horaSP em São Paulo, inclusive na virada de dia', () => {
    expect(horaSP('2026-10-12T08:02:00Z')).toBe('12/10 05:02')
    expect(horaSP('2026-10-13T02:59:00Z')).toBe('12/10 23:59')
    expect(horaSP('2026-10-13T03:00:00Z')).toBe('13/10 00:00')
    expect(horaSP('lixo')).not.toMatch(/NaN|undefined/)
  })

  it('aria-live="polite" só no estado busy', () => {
    render(<FaixaRestauracao faixa={completa(montarFaixa(SEMENTES.A1, ctx))} />)
    expect(screen.getByRole('region', { name: 'Restauração do vídeo' }).getAttribute('aria-live')).toBe('polite')
    cleanup()
    render(<FaixaRestauracao faixa={completa(montarFaixa(SEMENTES.C, ctx))} />)
    expect(screen.getByRole('region', { name: 'Restauração do vídeo' }).hasAttribute('aria-live')).toBe(false)
  })

  it('a faixa não tem botão (eles vêm de `children`, Tarefa 8); o aviso agora se dispensa', () => {
    render(<FaixaRestauracao faixa={completa(montarFaixa(SEMENTES.C, ctx))} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(document.body.textContent).not.toMatch(/Tentar agora|dispensar aviso|não pode ser dispensado/i)
    expect(screen.getByText('Horários de São Paulo')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Restauração do vídeo' })).toBeTruthy()
    expect((screen.getByText('Abrir no YouTube Studio') as HTMLAnchorElement).getAttribute('href')).toBe(STUDIO)
  })

  it('E/F/G usam role status', () => {
    for (const e of ['E', 'F', 'G']) {
      render(<FaixaRestauracao faixa={completa(montarFaixa(SEMENTES[e], ctx))} />)
      expect(screen.getByRole('status', { name: 'Restauração do vídeo' })).toBeTruthy()
      cleanup()
    }
  })

  it('<script> no rótulo aparece como texto, não vira elemento', () => {
    const mau = '<script>alert(1)</script>'
    const f = completa(montarFaixa({ title: campo({ estado: 'falhou', destino: mau, erro: recusa }) }, { ...ctx, rotulo: id => id, noArAntes: mau }))
    const { container } = render(<FaixaRestauracao faixa={f} />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain(mau)
  })

  it('nenhum undefined, null ou NaN no texto de nenhum estado', () => {
    for (const [nome, rs] of Object.entries(SEMENTES)) {
      const f = montarFaixa(rs, ctx)
      expect(f, nome).not.toBeNull()
      render(<FaixaRestauracao faixa={f as Faixa} />)
      expect(document.body.textContent, nome).not.toMatch(/undefined|null|NaN/)
      cleanup()
    }
  })
})

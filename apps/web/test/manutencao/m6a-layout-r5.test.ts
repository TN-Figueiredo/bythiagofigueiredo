// @vitest-environment node
/** M6a layout r5 (consertos do Gio, 28/10): CSS e peças da saída de mês. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const C = resolve(__dirname, '../../src/app/cms/(authed)/youtube/competitors')
const css = readFileSync(`${C}/_arquivo/arquivo.css`, 'utf8')
const peca = readFileSync(`${C}/_arquivo-saida/peca-tirar-mes.tsx`, 'utf8')
const encaixe = readFileSync(`${C}/_arquivo-saida/encaixar.ts`, 'utf8')

describe('layout r5', () => {
  it('ⓘ da linha de efeito tem alvo de toque de 44px sem deslocar (margem negativa)', () => { expect(css).toMatch(/\.arq-efl \.dica-i\{width:44px;height:44px;margin:-8px/) })
  it('régua e frase do bloco não herdam o order da linha do mês (combinador filho)', () => { expect(css).toMatch(/\.arq-mes>\.arq-reg\{order:3\}/); expect(css).not.toMatch(/\.arq-mes \.arq-reg\{order/) })
  it('"Mês mais antigo no banco" usa classe própria, sem a grade da linha, e não quebra', () => { expect(peca).toContain('className="arq-mesb"'); expect(css).toMatch(/\.arq-mesb-r\{white-space:nowrap\}/) })
  it('trilho do contador tem cor literal no escuro e o CSS não usa color-mix fora de comentário', () => {
    expect(css).toMatch(/\[data-theme="dark"\] \.arq-trilho[^{]*\{background:rgba\(/)
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/color-mix/)
  })
  it('frases de elegível e bloqueio iguais às do mockup r4', () => { expect(peca).toContain('Pode sair agora.'); expect(peca).toContain('Cópia no NAS e no B2 conferida hoje.'); expect(peca).toContain('conferir o B2') })
  it('a simulação atualiza o contador do servidor sem recarregar', () => { expect(peca).toMatch(/router\.refresh\(\)/) })
  it('tabela com mês escondido não ganha bloco no próximo mês online', () => { expect(encaixe).toContain('comEscondido') })
})

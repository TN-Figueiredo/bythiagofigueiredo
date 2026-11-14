// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { TEXTOS_ERRO, CSS_ERRO, codigoDeErro, htmlDeErro, corpoDeErro, esc, type CodigoErro } from '@/lib/youtube/observatorio/acesso-ia/oauth/textos-erro'

const END = 'bythiagofigueiredo.com/api/mcp'
const LITERAIS: Record<CodigoErro, { titulo: string; texto: string; acao: string; tom: string }> = {
  cliente: { titulo: 'Esta conexão precisa ser refeita.', texto: 'O Observatório não reconhece mais o conector da sua IA. Isso acontece quando ele fica muito tempo sem uso.', acao: `Na sua IA, abra os conectores, remova o do Observatório e adicione de novo com o endereço ${END}. Depois toque em Conectar.`, tom: 'amber' },
  redirect: { titulo: 'Este pedido de conexão não é válido.', texto: 'Se você não acabou de tocar em Conectar na sua IA, feche esta página: o pedido não foi seu.', acao: `Se foi você: na sua IA, remova o conector do Observatório e adicione de novo com o endereço ${END}. Depois toque em Conectar.`, tom: 'amber' },
  pedido: { titulo: 'Este pedido não vale mais.', texto: 'O link desta página está incompleto.', acao: 'Volte à IA em que você tocou em Conectar e tente de novo.', tom: 'amber' },
  limite: { titulo: 'Muitas tentativas seguidas.', texto: 'Saíram muitos pedidos de conexão desta rede em pouco tempo, e o Observatório pausou novos pedidos por segurança. Tocar de novo agora não ajuda: cada toque conta como tentativa.', acao: 'Espere uma hora e toque em Conectar de novo na sua IA. Se ainda não der, tente amanhã.', tom: 'amber' },
  desligado: { titulo: 'A conexão está desligada por enquanto.', texto: 'O Thiago desligou a conexão de IAs ao Observatório.', acao: 'Tente de novo mais tarde ou fale com o Thiago.', tom: 'neutro' },
  falha: { titulo: 'Não deu para conectar agora.', texto: 'Foi um problema do nosso lado, não da sua IA.', acao: 'Tente de novo em instantes.', tom: 'red' },
}

describe('TEXTOS_ERRO', () => {
  for (const c of Object.keys(LITERAIS) as CodigoErro[]) {
    it(`${c}: título, texto, ação e tom literais do Logan`, () => {
      expect(TEXTOS_ERRO[c]).toEqual(LITERAIS[c])
    })
  }
  it('tem exatamente 6 códigos', () => expect(Object.keys(TEXTOS_ERRO).sort()).toEqual(Object.keys(LITERAIS).sort()))
})

describe('htmlDeErro', () => {
  for (const c of Object.keys(LITERAIS) as CodigoErro[]) {
    it(`${c}: lang pt-BR, rodapé e código c1-${c}`, () => {
      const h = htmlDeErro(c)
      expect(h).toContain('<html lang="pt-BR"')
      expect(h).toContain('Nada foi criado nem liberado. Pode fechar esta página.')
      expect(h).toContain(`c1-${c}`)
      expect(h).toContain(`<h1>${LITERAIS[c].titulo}</h1>`)
    })
  }
  it('falha tem o botão Tentar de novo (href vazio); os outros não', () => {
    expect(htmlDeErro('falha')).toContain('<a class="oe-btn" href="">Tentar de novo</a>')
    expect(htmlDeErro('cliente')).not.toContain('Tentar de novo')
  })
  it('corpoDeErro não traz documento inteiro e escapa texto', () => {
    expect(corpoDeErro('pedido')).not.toContain('<html')
  })
  it('esc escapa & < > " \'', () => {
    expect(esc('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;')
  })
})

describe('codigoDeErro', () => {
  it('desconhecido ou ausente cai em pedido; conhecidos passam (inclui falha)', () => {
    expect(codigoDeErro('xpto')).toBe('pedido')
    expect(codigoDeErro(null)).toBe('pedido')
    expect(codigoDeErro('falha')).toBe('falha')
    expect(codigoDeErro('limite')).toBe('limite')
  })
})

describe('CSS_ERRO', () => {
  it('sem color-mix', () => expect(CSS_ERRO).not.toContain('color-mix'))
  it('protege texto longo', () => expect(CSS_ERRO).toContain('overflow-wrap:anywhere'))
})

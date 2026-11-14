// Página de erro do OAuth: textos do Logan (c1/f2/erro-textos-logan.md) e visual da Naksu, no padrão do mockup M1.
// Uma fonte só para as duas páginas (HTML da rota e /oauth/erro). Nenhum valor vindo da requisição entra no HTML.
import { RECURSO } from './config'

export type CodigoErro = 'cliente' | 'redirect' | 'pedido' | 'limite' | 'desligado' | 'falha'
export type TomErro = 'amber' | 'neutro' | 'red'
type Icone = 'relogio' | 'alerta' | 'mao' | 'power'

const ENDERECO = RECURSO.replace(/^https:\/\//, '')

export const TEXTOS_ERRO: Readonly<Record<CodigoErro, { titulo: string; texto: string; acao: string; tom: TomErro }>> = {
  cliente: {
    titulo: 'Esta conexão precisa ser refeita.',
    texto: 'O Observatório não reconhece mais o conector da sua IA. Isso acontece quando ele fica muito tempo sem uso.',
    acao: `Na sua IA, abra os conectores, remova o do Observatório e adicione de novo com o endereço ${ENDERECO}. Depois toque em Conectar.`,
    tom: 'amber',
  },
  redirect: {
    titulo: 'Este pedido de conexão não é válido.',
    texto: 'Se você não acabou de tocar em Conectar na sua IA, feche esta página: o pedido não foi seu.',
    acao: `Se foi você: na sua IA, remova o conector do Observatório e adicione de novo com o endereço ${ENDERECO}. Depois toque em Conectar.`,
    tom: 'amber',
  },
  pedido: {
    titulo: 'Este pedido não vale mais.',
    texto: 'O link desta página está incompleto.',
    acao: 'Volte à IA em que você tocou em Conectar e tente de novo.',
    tom: 'amber',
  },
  limite: {
    titulo: 'Muitas tentativas seguidas.',
    texto: 'Saíram muitos pedidos de conexão desta rede em pouco tempo, e o Observatório pausou novos pedidos por segurança. Tocar de novo agora não ajuda: cada toque conta como tentativa.',
    acao: 'Espere uma hora e toque em Conectar de novo na sua IA. Se ainda não der, tente amanhã.',
    tom: 'amber',
  },
  desligado: {
    titulo: 'A conexão está desligada por enquanto.',
    texto: 'O Thiago desligou a conexão de IAs ao Observatório.',
    acao: 'Tente de novo mais tarde ou fale com o Thiago.',
    tom: 'neutro',
  },
  falha: {
    titulo: 'Não deu para conectar agora.',
    texto: 'Foi um problema do nosso lado, não da sua IA.',
    acao: 'Tente de novo em instantes.',
    tom: 'red',
  },
}

const ICONE_POR_CODIGO: Readonly<Record<CodigoErro, Icone>> = {
  cliente: 'relogio', redirect: 'alerta', pedido: 'relogio', limite: 'mao', desligado: 'power', falha: 'alerta',
}

const SVG = (corpo: string): string =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corpo}</svg>`
const ICONES: Readonly<Record<Icone, string>> = {
  relogio: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  alerta: SVG('<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4"/><path d="M12 17h.01"/>'),
  mao: SVG('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>'),
  power: SVG('<path d="M12 3v9"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/>'),
}

export function codigoDeErro(v: string | null | undefined): CodigoErro {
  return v === 'cliente' || v === 'redirect' || v === 'pedido' || v === 'limite' || v === 'desligado' || v === 'falha' ? v : 'pedido'
}

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// Tokens do mockup M1 (os mesmos de app/oauth/consentimento/estilo.ts); só hex e rgba, nunca color-mix. Escuro por prefers-color-scheme.
export const CSS_ERRO =
  '.oe-pg{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;box-sizing:border-box}' +
  '.oe,.oe-pg{--bg:#F7F1E8;--surface:#FBF6EC;--text:#1F1B17;--muted:#6A5F48;--line:#CEBFA0;--accent:#B94210;--on-accent:#FFFFFF;--amber:#92400E;--amber-soft:rgba(245,158,11,.18);--red:#B91C1C;--red-soft:rgba(185,28,28,.10);--neutral-soft:rgba(128,128,128,.14);--shadow:0 1px 2px rgba(31,27,23,.08),0 8px 24px rgba(31,27,23,.07)}' +
  '@media (prefers-color-scheme:dark){.oe,.oe-pg{--bg:#1A1714;--surface:#221E1A;--text:#F5EFE6;--muted:#958A75;--line:#332D25;--accent:#FF8240;--on-accent:#1A140C;--amber:#F59E0B;--amber-soft:rgba(245,158,11,.14);--red:#EF4444;--red-soft:rgba(239,68,68,.13);--shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35)}}' +
  '.oe-pg{background:var(--bg);color-scheme:light dark}' +
  '.oe{box-sizing:border-box;width:100%;max-width:480px;margin:0 auto;padding:24px;background:var(--surface);border:1px solid var(--line);border-radius:8px;box-shadow:var(--shadow);color:var(--text);font:14px/20px Inter,ui-sans-serif,system-ui,sans-serif;overflow-wrap:anywhere}' +
  '.oe *{box-sizing:border-box}' +
  '.oe-brand{color:var(--muted);font-size:13px;margin:0 0 12px}' +
  '.oe-hd{display:flex;align-items:center;gap:12px;margin:0 0 8px}' +
  '.oe-badge{width:36px;height:36px;flex:none;border-radius:50%;display:grid;place-items:center;background:var(--neutral-soft);color:var(--muted)}' +
  '.oe-amber .oe-badge{background:var(--amber-soft);color:var(--amber)}' +
  '.oe-red .oe-badge{background:var(--red-soft);color:var(--red)}' +
  '.oe h1{margin:0;flex:1;min-width:0;font-size:22px;line-height:28px;font-weight:700;letter-spacing:-.015em}' +
  '.oe p{margin:0}' +
  '.oe-acao{margin-top:12px!important;font-weight:600}' +
  '.oe-btn{display:flex;align-items:center;justify-content:center;height:48px;margin-top:16px;padding:0 16px;border-radius:6px;border:2px solid var(--accent);background:var(--accent);color:var(--on-accent);font:600 14px/20px Inter,ui-sans-serif,system-ui,sans-serif;text-decoration:none}' +
  '.oe-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}' +
  '.oe-code{font:12px/16px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;background:var(--neutral-soft);padding:2px 6px;border-radius:4px}' +
  '.oe-fine{margin-top:16px!important;padding-top:12px;border-top:1px solid var(--line);font-size:13px;line-height:18px;color:var(--muted)}' +
  '.oe-fine+.oe-fine{margin-top:4px!important;padding-top:0;border-top:0}' +
  '@media (max-width:520px){.oe{border-left:0;border-right:0;border-radius:0;box-shadow:none;padding:20px 16px;max-width:none}.oe-pg{display:block;padding:0}}'

export function corpoDeErro(codigo: CodigoErro): string {
  const t = TEXTOS_ERRO[codigo]
  const botao = codigo === 'falha' ? '<a class="oe-btn" href="">Tentar de novo</a>' : ''
  return (
    `<main class="oe oe-${t.tom}" lang="pt-BR">` +
    '<p class="oe-brand">bythiagofigueiredo.com</p>' +
    `<div class="oe-hd"><span class="oe-badge">${ICONES[ICONE_POR_CODIGO[codigo]]}</span><h1>${esc(t.titulo)}</h1></div>` +
    `<p>${esc(t.texto)}</p>` +
    `<p class="oe-acao">${esc(t.acao)}</p>` +
    botao +
    '<p class="oe-fine">Nada foi criado nem liberado. Pode fechar esta página.</p>' +
    `<p class="oe-fine">Se acontecer de novo, avise o Thiago e diga o código: <code class="oe-code">c1-${codigo}</code>.</p>` +
    '</main>'
  )
}

export function htmlDeErro(codigo: CodigoErro): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Conexão não concluída</title><style>body{margin:0}${CSS_ERRO}</style></head><body class="oe-pg">${corpoDeErro(codigo)}</body></html>`
}

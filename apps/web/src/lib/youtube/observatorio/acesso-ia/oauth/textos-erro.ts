export type CodigoErro = 'cliente' | 'redirect' | 'pedido' | 'limite' | 'desligado'

export const TEXTOS_ERRO: Readonly<Record<CodigoErro, string>> = {
  cliente: 'Esta conexão expirou ou não é reconhecida. Na sua IA, remova o conector e adicione de novo.',
  redirect: 'O endereço de retorno deste pedido não é permitido. Volte à sua IA e tente conectar de novo.',
  pedido: 'Não foi possível entender este pedido de conexão. Volte à sua IA e tente de novo.',
  limite: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.',
  desligado: 'A conexão com IAs está desligada no momento.',
}

export function codigoDeErro(v: string | null | undefined): CodigoErro {
  return v === 'cliente' || v === 'redirect' || v === 'pedido' || v === 'limite' || v === 'desligado' ? v : 'pedido'
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function htmlDeErro(codigo: CodigoErro): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conexão não concluída</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem"><h1>Conexão não concluída</h1><p>${esc(TEXTOS_ERRO[codigo])}</p></body></html>`
}

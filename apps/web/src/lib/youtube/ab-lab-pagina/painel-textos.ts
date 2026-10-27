/**
 * Textos do painel "O que fica no vídeo?" fora do mockup (M7b T7a, Logan 27/10). Puro: sem banco, sem relógio.
 * Vocabulário: "versão", "miniatura", "No ar agora", "Deixar X no ar", "Tentar de novo", "Fechar"; nunca "variante" nem "thumbnail".
 */
import type { PorqueRecusou } from '../ab-acao-saida'

export const FRASE_FIXA = 'O resultado do teste não muda com a sua escolha.'

export const tituloDaRecusa = (x: string | null): string => (x ? `Não consegui deixar a ${x} no ar.` : 'Não consegui deixar essa versão no ar.')

/** Detalhe do aviso `err` por `porque` (tabela B). `S` = versão que segue no ar; `X` = versão que se tentou deixar. */
export function detalheDaRecusa(porque: PorqueRecusou, v: { S: string | null; X: string | null }): string {
  switch (porque) {
    case 'youtube': return v.S ? `O YouTube recusou a troca e a versão ${v.S} continua no ar.` : 'O YouTube recusou a troca e a versão anterior continua no ar.'
    case 'drift': return 'O vídeo foi alterado no YouTube depois do teste. Nada foi trocado.'
    case 'sem_original': return 'Não temos a original guardada, então não dá voltar a ela daqui. Nada foi trocado.'
    case 'sem_tempo': return 'A troca demorou demais e foi cortada. Confira o que está no ar e tente de novo.'
    case 'arquivo_indisponivel': return v.X ? `O arquivo da miniatura ${v.X} não está mais disponível. Nada foi trocado.` : 'O arquivo da miniatura não está mais disponível. Nada foi trocado.'
  }
}

/** Repetir não resolve: só Fechar. */
export const RECUSA_SEM_RETENTATIVA: ReadonlySet<PorqueRecusou> = new Set<PorqueRecusou>(['sem_original', 'arquivo_indisponivel'])

/** A1: troca parcial em combo. */
export const fraseMisto = (t: string, m: string): string => `O título está na ${t} e a miniatura na ${m}. O vídeo está misturado.`
export const tituloParcial = (x: string): string => `Só uma parte da ${x} entrou.`
export const detalheParcial = (campoQueFalhou: 'título' | 'miniatura', m: string): string => `O ${campoQueFalhou} segue na ${m}. Tente de novo para completar a troca.`
export const linhaNoArMisto = (t: string, m: string): string => `No ar agora: título ${t}, miniatura ${m}.`

/** A2: nada confirmado ao abrir. */
export const FRASE_DESCONHECIDO = 'Não sabemos qual versão está no ar. Confira antes de trocar.'
export const LINHA_DESCONHECIDO = 'Não deu para ver o que está no ar. A troca vai sobrescrever o título e a miniatura atuais.'
export const SAI_NAO_CONFIRMADO = 'Não confirmado'
export const seloUltimaLeitura = (letra: string, ddmm: string | null): string => (ddmm ? `Última leitura: ${letra} em ${ddmm}` : `Última leitura: ${letra}`)

/** D1, D2, D3. */
export const fraseEscolhaApagada = (ddmm: string): string => `Sua escolha foi registrada em ${ddmm}, mas essa versão não existe mais.`
export const BLOQUEIO_ORIGINAL = {
  title: 'O título original não foi guardado; não dá para voltar a ele daqui.',
  thumbnail: 'A miniatura original não foi guardada; não dá para voltar a ela daqui.',
  combo: 'O título e a miniatura originais não foram guardados; não dá para voltar a eles daqui.',
} as const
export const AVISO_SEM_PERMISSAO = 'Só quem administra o site pode deixar uma versão no ar.'

/** C: conferência e leitura. */
export const AVISO_NAO_PROPAGOU = { titulo: 'A miniatura pode demorar a aparecer.', detalhe: 'O YouTube leva algumas horas para mostrar a nova. Não repetimos a troca sozinhos.' } as const
export const AVISO_NENHUMA_VERSAO = { titulo: 'O que está no ar não é de nenhuma versão.', detalhe: 'Alguém mudou o vídeo fora daqui. Deixe uma versão no ar para voltar ao teste.' } as const
/** Yannis I1: a conferência achou a versão no YouTube, mas o registro da escolha não fechou. O clique seguinte só registra. */
export const avisoNaoRegistrado = (x: string): { titulo: string; detalhe: string } => ({
  titulo: `A versão ${x} já está no YouTube, mas a escolha não ficou registrada.`,
  detalhe: 'Toque em Registrar para guardar.',
})
export const rotuloRegistrar = (x: string): string => `Registrar ${x}`
/** Gio G2: sessão expirada com o painel aberto. Nada foi gravado. */
export const AVISO_SESSAO_EXPIRADA = { titulo: 'Sua sessão expirou.', detalhe: 'Entre de novo para continuar.' } as const
/** Gio G3: o "Manter" não escreve no YouTube; a falha foi de chegar ao nosso servidor. */
export const AVISO_NAO_GUARDOU = { titulo: 'Não deu para guardar.', detalhe: 'Tente de novo.' } as const
/** Gio G4: a aba velha tenta guardar o que outra aba já guardou. */
export const tituloJaEstaNoAr = (x: string): string => `${x} já está no ar.`
export const AVISO_SEM_LEITURA = { titulo: 'Não deu para ler o vídeo no YouTube.', detalhe: 'Ele pode estar privado ou apagado, ou a conexão falhou. Não repetimos a troca sozinhos.' } as const
export const AVISO_SEM_CONEXAO = { titulo: 'Sem conexão para conferir.', detalhe: 'Não repetimos a troca sozinhos. Feche e abra de novo quando tiver rede.' } as const
export const AVISO_DEMORANDO = { titulo: 'Ainda escrevendo no YouTube.', detalhe: 'Não repetimos a troca sozinhos.' } as const
export const TEXTO_DEMORANDO = 'Está demorando. Pode fechar: o que estiver no ar aparece atualizado quando você voltar.'

/** A5: diálogo de confirmação (drift). */
export const TITULO_DRIFT = 'O vídeo mudou no YouTube'
export const corpoDrift = (campo: 'título' | 'miniatura', x: string): string => `Desde o teste, ${campo === 'miniatura' ? 'a miniatura foi alterada' : 'o título foi alterado'} fora daqui. Se continuar, a ${x} substitui o que está lá agora.`

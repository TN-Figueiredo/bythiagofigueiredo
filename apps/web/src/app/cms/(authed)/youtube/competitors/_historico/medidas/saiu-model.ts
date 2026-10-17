// A5 E5a, Tarefa 20 (mockup 13): o vídeo que saiu do YouTube e o ao vivo. Puro. Nenhuma pastilha é inventada: `saiuEm` nulo (não lido, ou
// ainda no ar) não escreve nada. O botão da fila só existe se a fila "Saíram do YouTube" deu o link (`link.saiu`, dependência 14).
import { dm } from './formatos'

export interface EntradaDoSaiu {
  /** `missing_since` em São Paulo (`AAAA-MM-DD`): o primeiro dia sem contagem. Nulo = ainda no ar, ou não lido. */
  saiuEm: string | null
  /** O vídeo foi mantido para análise (fixado). */
  mantido: boolean
  aoVivo: boolean
  /** `link.saiu` da fila "Saíram do YouTube"; ausente = o botão não existe. */
  linkSaiu: { href: string } | null
}

export interface Pastilha { tipo: 'saiu' | 'ao_vivo'; texto: string; mantido: boolean }

export interface CabecalhoDoSaiu {
  pastilhas: Pastilha[]
  /** "Abrir no YouTube" só existe com o vídeo no ar. */
  abrirNoYoutube: boolean
  semLink: string | null
  botaoDaFila: { texto: string; href: string } | null
}

export const TEXTO_SEM_LINK = 'Sem link: o vídeo não está mais no YouTube'
export const TEXTO_DO_BOTAO_DA_FILA = 'Responder em “Saíram do YouTube”'

export function cabecalhoDoSaiu(e: EntradaDoSaiu): CabecalhoDoSaiu {
  const pastilhas: Pastilha[] = []
  if (e.saiuEm !== null) {
    pastilhas.push({ tipo: 'saiu', mantido: e.mantido, texto: `saiu do YouTube em ${dm(e.saiuEm)}${e.mantido ? ' · mantido para análise' : ''}` })
  }
  if (e.aoVivo) pastilhas.push({ tipo: 'ao_vivo', mantido: false, texto: 'ao vivo ou estreia' })
  const saiu = e.saiuEm !== null
  return {
    pastilhas,
    abrirNoYoutube: !saiu,
    semLink: saiu ? TEXTO_SEM_LINK : null,
    // o botão só existe se a fila deu o link; esta tela não repete "Manter/Apagar"
    botaoDaFila: saiu && e.linkSaiu !== null ? { texto: TEXTO_DO_BOTAO_DA_FILA, href: e.linkSaiu.href } : null,
  }
}

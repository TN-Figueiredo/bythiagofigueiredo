/**
 * M6a T13: a frase do diálogo de remover canal quando algum mês do arquivo está fora das telas e ainda não foi apagado do banco (D7 e D7r do
 * mockup `remover-canal/rc.js:105-114`). Puro, sem I/O. O diálogo da M3b (`EntradaDialogo`) não existe neste ramo: o tipo daqui é o que ele
 * vai consumir. Campos opcionais: sem eles a frase cai na forma curta (sem a parte do papel), e nunca diz "pode remover".
 */
const MESES_R = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const nomeMes = (m: string): string => MESES_R[Number(m.slice(5, 7)) - 1] ?? m
const ddmm = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

export interface MesFora {
  meses: 1 | 2
  /** true = o diálogo já estava aberto e o banco recusou no clique (D7r). */
  recusadoNoClique: boolean
  /** AAAA-MM-01 dos meses (no máximo 2). */
  nomes?: string[]
  /** AAAA-MM-DD a partir de quando o espaço pode ser liberado. */
  liberarAPartir?: string
  podeAdministrar?: boolean
  /** O dia de hoje em São Paulo, AAAA-MM-DD. */
  hojeSP?: string
}

export const INFO_MES_FORA = 'Enquanto o mês pode voltar ao banco, remover o canal deixaria, na volta, registros dele sem canal a que pertencer. “Exportar” continua permitido.'

export function fraseDoMesFora(m: MesFora): { negrito: string; resto: string; linkArquivo: boolean; info: string } {
  const recus = m.recusadoNoClique ? 'O mês saiu das telas enquanto este diálogo estava aberto. ' : ''
  const n = m.nomes ?? []
  let meses: string
  if (n.length === 2) {
    const [a, b] = n as [string, string]
    meses = a.slice(0, 4) === b.slice(0, 4)
      ? `${cap(nomeMes(a))} e ${nomeMes(b)} de ${a.slice(0, 4)} saíram das telas e o espaço deles ainda não foi liberado.`
      : `${cap(nomeMes(a))} de ${a.slice(0, 4)} e ${nomeMes(b)} de ${b.slice(0, 4)} saíram das telas e o espaço deles ainda não foi liberado.`
  } else if (n.length === 1) {
    meses = `${cap(nomeMes(n[0]!))} de ${n[0]!.slice(0, 4)} saiu das telas e o espaço dele ainda não foi liberado.`
  } else {
    meses = m.meses === 2 ? 'Dois meses saíram das telas e o espaço deles ainda não foi liberado.' : 'Um mês saiu das telas e o espaço dele ainda não foi liberado.'
  }
  let resto = 'Enquanto isso não dá para remover canal nem apagar vídeo.'
  if (m.recusadoNoClique) resto += ' Nada foi removido.'
  let linkArquivo = false
  if (m.liberarAPartir && m.hojeSP && m.podeAdministrar !== undefined) {
    const depois = m.hojeSP >= m.liberarAPartir
    const antes = `O espaço só pode ser liberado a partir de ${ddmm(m.liberarAPartir)}; até lá, o que dá para fazer é trazer o mês de volta.`
    if (m.podeAdministrar) {
      resto += depois ? ' Você já pode liberar o espaço ou trazer o mês de volta.' : ` ${antes}`
      linkArquivo = depois
    } else {
      resto += depois ? ' O espaço já pode ser liberado, e o mês também pode voltar, por quem administra o site.' : ` ${antes} Quem só edita o site: peça a quem o administra.`
    }
  }
  return { negrito: recus + meses, resto, linkArquivo, info: INFO_MES_FORA }
}

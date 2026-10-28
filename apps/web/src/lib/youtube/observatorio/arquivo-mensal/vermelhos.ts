/** Manutenção M5, Tarefa 7 (Phil I1): a tabela prefixo do vermelho do pulso -> frase e forma. Frases em linguagem do dono; as sem equivalente no mockup
 *  (arq-dados.js não desenhou os prefixos do pulso) ficam marcadas "revisão Logan" e entram na Tarefa 15. Prefixo desconhecido -> linha genérica, nunca engolido. */
/** `tipo`: de que a linha fala. `mes` já está na linha do mês (não soma de novo no topo), `canal` é o bloco Canais removidos, `outro` é só desta lista. `n`: a contagem do canal. `ancora`: para onde o "ver" leva. */
import { NOME_DA_TABELA as NOME_DO_DADO } from './estado-do-mes'
import { nomeDoMes } from './frases-saida'

export interface LinhaDeProblema { prefixo: string | null; frase: string; forma: 'octogono' | 'triangulo'; bruto: string; tipo?: 'mes' | 'canal' | 'outro'; n?: number; ancora?: string }

type Regra = { prefixo: string; tipo?: 'mes' | 'canal'; forma: 'octogono' | 'triangulo'; frase: (resto: string) => string; /** o vermelho que começa por número ("3 canais removidos sem destino do arquivo") */ padrao?: RegExp }
const num = (s: string): string => s.match(/\d+/)?.[0] ?? ''
/** O número no fim do texto ("mês sem selo há mais de 30 dias: 2" -> 2). */
const fim = (s: string): string => s.match(/(\d+)\s*$/)?.[1] ?? ''
const qual = (s: string): string => s.replace(/^[^:]*:/, '').trim()

/** A ordem importa só entre prefixos que começam igual; todos os do pulso (obs_archive_vermelhos, m3b) estão aqui. */
const REGRAS: readonly Regra[] = [
  // arq-dados.js:120 (pa2): "Cópia atrasada há 32 dias"
  { prefixo: 'atraso de cópia', forma: 'octogono', tipo: 'mes', frase: () => 'Há cópia atrasada há mais de 30 dias. Veja os meses marcados.' },
  // revisão Logan: sem equivalente no mockup
  { prefixo: 'mês sem selo', forma: 'octogono', tipo: 'mes', frase: r => (fim(r) === '1' || !fim(r) ? 'Um mês está sem a cópia concluída há mais de 30 dias.' : `${fim(r)} meses estão sem a cópia concluída há mais de 30 dias.`) },
  // arq-dados.js (pn1 / m11b): arquivo do NAS ausente ou diferente
  { prefixo: 'NAS: ', tipo: 'mes', forma: 'octogono', frase: r => `${num(r) ? `${num(r)} arquivos` : 'Há arquivos'} do NAS ausentes ou diferentes. A cópia boa é a do B2.` },
  // arq-dados.js (pt1)
  { prefixo: 'B2: ', tipo: 'mes', forma: 'octogono', frase: r => `${num(r) ? `${num(r)} meses` : 'Há meses'} com a conferência do B2 retirada. Nada sai deles até uma conferência boa.` },
  // arq-dados.js (pr1): "está diferente do que o site guardou"
  { prefixo: 'conteúdo divergente', tipo: 'mes', forma: 'octogono', frase: r => `${num(r) ? `${num(r)} arquivos` : 'Há arquivos'} diferentes do que o site guardou. Nada sai desses meses até resolver.` },
  // revisão Logan
  { prefixo: 'mês descartado sem releitura', tipo: 'mes', forma: 'triangulo', frase: () => 'Um mês no arquivo está sem verificação há mais de 45 dias. A verificação roda na casa: veja se ela responde.' },
  // revisão Logan
  { prefixo: 'b2_atrasado', tipo: 'mes', forma: 'triangulo', frase: () => 'Um mês copiado ainda não chegou ao B2 depois de 7 dias. Nada se perde: a cópia do NAS continua. Veja a linha marcada.' },
  // revisão Logan
  { prefixo: 'B2 recusou o fileId', forma: 'octogono', frase: () => 'O B2 recusou o mesmo arquivo em 3 conferências seguidas. Nada sai desse mês até uma conferência boa.' },
  // revisão Logan
  { prefixo: 'canário do filho', forma: 'octogono', frase: () => 'A cópia de teste diária não chega ao B2 há 5 dias ou mais: as cópias novas podem não estar chegando.' },
  // revisão Logan
  { prefixo: 'canario_regravado:', forma: 'triangulo', frase: r => `O arquivo de teste (${qual(r) || '?'}) foi regravado; esperando um novo chegar ao B2.` },
  // arq-dados.js (m11b)
  { prefixo: 'nas_ilegivel:', tipo: 'mes', forma: 'octogono', frase: () => 'Um arquivo do NAS não pôde ser lido. Recupere do B2 (ver os comandos).' },
  // arq-dados.js (m11c)
  { prefixo: 'b2_ilegivel:', tipo: 'mes', forma: 'octogono', frase: () => 'Um arquivo do B2 não pôde ser lido. Rode a conferência de novo (ver o comando).' },
  // arq-dados.js (pn2): "O NAS está cheio"
  { prefixo: 'nas_80:', forma: 'triangulo', frase: () => 'O NAS passou de 80% do espaço. Libere espaço (ver os comandos).' },
  // M6a T12 r1 (Logan U2, Gio 2): `saida_particao_ausente:<tabela>:<AAAA-MM>[,<AAAA-MM>…]` (vários meses da mesma tabela chegam agrupados por `agruparVermelhos`)
  { prefixo: 'saida_particao_ausente:', forma: 'octogono', frase: r => {
    const resto = r.slice('saida_particao_ausente:'.length); const corte = resto.indexOf(':')
    const tabela = corte < 0 ? resto : resto.slice(0, corte); const meses = corte < 0 ? '' : resto.slice(corte + 1)
    const lista = meses.split(',').filter(m => /^\d{4}-\d{2}$/.test(m)).map(m => nomeDoMes(`${m}-01`))
    const nome = NOME_DO_DADO[tabela] ?? 'um tipo de dado'
    const aviso = 'Não apague do banco nem mostre de novo até avisar quem cuida do site. (código: saida_particao_ausente)'
    if (lista.length === 0) return `Há mês de "${nome}" que foi escondido das telas, mas o lugar onde ele ficou guardado não existe mais no banco. ${aviso}`
    return lista.length === 1
      ? `O mês ${lista[0]} de "${nome}" foi escondido das telas, mas o lugar onde ele ficou guardado não existe mais no banco. ${aviso}`
      : `${nome}: ${lista.length} meses sem o lugar onde ficaram guardados (${lista.join(', ')}). ${aviso}`
  } },
  // revisão Logan
  { prefixo: 'tabela_ausente:', forma: 'octogono', frase: r => `Falta no banco o lugar dos dados de ${NOME_DO_DADO[qual(r)] || 'um tipo de dado'}, que o arquivo copia. Nada desse tipo sai até ele voltar.` },
  // revisão Logan
  { prefixo: 'b2_piso_acima_do_teto', forma: 'triangulo', frase: () => 'O que o B2 recebe por dia já passa de metade do limite do mês.' },
  // revisão Logan
  { prefixo: 'b2_completo_atrasado', forma: 'triangulo', frase: r => `A conferência completa do B2 está aberta há ${num(r) || 'muitos'} dias: rode a conferência completa até fechar.` },
  // revisão Logan
  { prefixo: 'b2_teto_2_dias', forma: 'octogono', frase: () => 'O B2 passou do limite diário por 2 dias seguidos.' },
  // revisão Logan
  { prefixo: 'vigia da remoção: consulta', forma: 'triangulo', frase: () => 'A conferência da remoção de canais achou uma diferença. Não remova outro canal até ela passar.' },
  // revisão Logan: o vermelho da remoção que começa por número (obs_archive_vermelhos_remocao)
  { prefixo: 'canais removidos sem destino', tipo: 'canal', padrao: /^\d+ canais removidos sem destino do arquivo/, forma: 'octogono', frase: r => (num(r) === '1' ? '1 canal removido está sem destino do arquivo.' : `${num(r)} canais removidos estão sem destino do arquivo.`) },
]

/** Junta os `saida_particao_ausente:<tabela>:<mês>` da mesma tabela numa só linha (`...:<mês1>,<mês2>`); o resto passa como veio, na mesma ordem. */
export function agruparVermelhos(brutos: string[]): string[] {
  const P = 'saida_particao_ausente:'
  const porTabela = new Map<string, string[]>()
  const fora: string[] = []
  for (const b of brutos) {
    const m = b.startsWith(P) ? /^saida_particao_ausente:([^:]+):(\d{4}-\d{2})$/.exec(b) : null
    if (!m) { fora.push(b); continue }
    porTabela.set(m[1]!, [...(porTabela.get(m[1]!) ?? []), m[2]!])
  }
  return [...fora, ...[...porTabela].map(([t, ms]) => `${P}${t}:${[...ms].sort().join(',')}`)]
}

export const FRASE_VERMELHO_DESCONHECIDO = 'O arquivo tem um problema que esta página ainda não descreve.'

export function descreverVermelho(bruto: string): LinhaDeProblema {
  const r = REGRAS.find(x => (x.padrao ? x.padrao.test(bruto) : bruto.startsWith(x.prefixo)))
  if (!r) return { prefixo: null, frase: FRASE_VERMELHO_DESCONHECIDO, forma: 'octogono', bruto, tipo: 'outro' }
  const canal = r.tipo === 'canal'
  return { prefixo: r.prefixo, frase: r.frase(bruto), forma: r.forma, bruto, tipo: r.tipo ?? 'outro', ...(canal ? { n: Number(num(bruto)) || 1, ancora: 'canais-removidos' } : {}) }
}

/** Manutenção M5, Tarefa 7 (Phil I1): a tabela prefixo do vermelho do pulso -> frase e forma. Frases em linguagem do dono; as sem equivalente no mockup
 *  (arq-dados.js não desenhou os prefixos do pulso) ficam marcadas "revisão Logan" e entram na Tarefa 15. Prefixo desconhecido -> linha genérica, nunca engolido. */
export interface LinhaDeProblema { prefixo: string | null; frase: string; forma: 'octogono' | 'triangulo'; bruto: string }

type Regra = { prefixo: string; forma: 'octogono' | 'triangulo'; frase: (resto: string) => string; /** o vermelho que começa por número ("3 canais removidos sem destino do arquivo") */ padrao?: RegExp }
const num = (s: string): string => s.match(/\d+/)?.[0] ?? ''
const qual = (s: string): string => s.replace(/^[^:]*:/, '').trim()

/** A ordem importa só entre prefixos que começam igual; todos os do pulso (obs_archive_vermelhos, m3b) estão aqui. */
const REGRAS: readonly Regra[] = [
  // arq-dados.js:120 (pa2): "Cópia atrasada há 32 dias"
  { prefixo: 'atraso de cópia', forma: 'octogono', frase: r => `Há cópia atrasada há mais de 30 dias${num(r) ? ` (${num(r)} arquivos)` : ''}. Veja os meses marcados.` },
  // revisão Logan: sem equivalente no mockup
  { prefixo: 'mês sem selo', forma: 'octogono', frase: r => `${num(r) ? `${num(r)} mês(es)` : 'Um mês'} sem a cópia concluída há mais de 30 dias.` },
  // arq-dados.js (pn1 / m11b): arquivo do NAS ausente ou diferente
  { prefixo: 'NAS: ', forma: 'octogono', frase: r => `${num(r) ? `${num(r)} arquivos` : 'Há arquivos'} do NAS ausentes ou diferentes. A cópia boa é a do B2.` },
  // arq-dados.js (pt1)
  { prefixo: 'B2: ', forma: 'octogono', frase: r => `${num(r) ? `${num(r)} meses` : 'Há meses'} com a conferência do B2 retirada. Nada sai deles até uma conferência boa.` },
  // arq-dados.js (pr1): "está diferente do que o site guardou"
  { prefixo: 'conteúdo divergente', forma: 'octogono', frase: r => `${num(r) ? `${num(r)} arquivos` : 'Há arquivos'} diferentes do que o site guardou. Nada sai desses meses até resolver.` },
  // revisão Logan
  { prefixo: 'mês descartado sem releitura', forma: 'triangulo', frase: () => 'Há mês no arquivo sem verificação há mais de 45 dias. Religue a casa.' },
  // revisão Logan
  { prefixo: 'b2_atrasado', forma: 'triangulo', frase: () => 'Há mês copiado cujo arquivo ainda não chegou ao B2 há mais de 7 dias.' },
  // revisão Logan
  { prefixo: 'B2 recusou o fileId', forma: 'octogono', frase: () => 'O B2 recusou o mesmo arquivo em 3 conferências seguidas.' },
  // revisão Logan
  { prefixo: 'canário do filho', forma: 'octogono', frase: r => `O arquivo de teste ("${r.match(/filho (\S+)/)?.[1] ?? '?'}") não chega ao B2 há 5 dias ou mais.` },
  // revisão Logan
  { prefixo: 'canario_regravado:', forma: 'triangulo', frase: r => `O arquivo de teste (${qual(r) || '?'}) foi regravado; esperando um novo chegar ao B2.` },
  // arq-dados.js (m11b)
  { prefixo: 'nas_ilegivel:', forma: 'octogono', frase: () => 'Um arquivo do NAS não pôde ser lido. Recupere do B2 (ver os comandos).' },
  // arq-dados.js (m11c)
  { prefixo: 'b2_ilegivel:', forma: 'octogono', frase: () => 'Um arquivo do B2 não pôde ser lido. Rode a conferência de novo (ver o comando).' },
  // arq-dados.js (pn2): "O NAS está cheio"
  { prefixo: 'nas_80:', forma: 'triangulo', frase: () => 'O NAS passou de 80% do espaço. Libere espaço (ver os comandos).' },
  // revisão Logan
  { prefixo: 'tabela_ausente:', forma: 'octogono', frase: r => `Falta no banco a base de dados ${qual(r) || '?'}, que o arquivo copia.` },
  // revisão Logan
  { prefixo: 'b2_piso_acima_do_teto', forma: 'triangulo', frase: () => 'O que o B2 recebe por dia já passa de metade do limite do mês.' },
  // revisão Logan
  { prefixo: 'b2_completo_atrasado', forma: 'triangulo', frase: r => `A conferência completa do B2 está aberta há ${num(r) || 'muitos'} dias: rode a conferência completa até fechar.` },
  // revisão Logan
  { prefixo: 'b2_teto_2_dias', forma: 'octogono', frase: () => 'O B2 passou do limite diário por 2 dias seguidos.' },
  // revisão Logan
  { prefixo: 'vigia da remoção: consulta', forma: 'triangulo', frase: r => `A vigia da remoção de canais achou uma inconsistência (verificação ${r.match(/consulta (\d)/)?.[1] ?? '?'}). Não remova canal até resolver.` },
  // revisão Logan: o vermelho da remoção que começa por número (obs_archive_vermelhos_remocao)
  { prefixo: 'canais removidos sem destino', padrao: /^\d+ canais removidos sem destino do arquivo/, forma: 'octogono', frase: r => `${num(r)} canal(is) removido(s) sem destino do arquivo. Veja o bloco Canais removidos.` },
]

export const FRASE_VERMELHO_DESCONHECIDO = 'O arquivo tem um problema que esta página ainda não descreve.'

export function descreverVermelho(bruto: string): LinhaDeProblema {
  const r = REGRAS.find(x => (x.padrao ? x.padrao.test(bruto) : bruto.startsWith(x.prefixo)))
  if (!r) return { prefixo: null, frase: FRASE_VERMELHO_DESCONHECIDO, forma: 'octogono', bruto }
  return { prefixo: r.prefixo, frase: r.frase(bruto), forma: r.forma, bruto }
}

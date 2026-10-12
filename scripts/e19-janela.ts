// Uso: npx supabase db query --linked "<consulta por dia do plano da E19>" | npx tsx scripts/e19-janela.ts <desde AAAA-MM-DD> --falhas=<nenhuma | AAAA-MM-DD,AAAA-MM-DD>
import { montarJanela, type DiaLido } from '../apps/web/src/lib/pipeline/leitura-janela'

const [desde, argFalhas, ...resto] = process.argv.slice(2)
if (!desde || !/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
  console.error('informe o primeiro dia da janela (AAAA-MM-DD)')
  process.exit(2)
}
if (!argFalhas?.startsWith('--falhas=') || resto.length > 0) {
  console.error('informe --falhas=nenhuma (depois de buscar no Sentry por action:leitura_registro tipo:gravacao no período) ou --falhas=AAAA-MM-DD,AAAA-MM-DD')
  process.exit(2)
}
const valorFalhas = argFalhas.slice('--falhas='.length)
const diasComFalha = valorFalhas === 'nenhuma' ? [] : valorFalhas.split(',')
if (valorFalhas !== 'nenhuma' && (diasComFalha.length === 0 || diasComFalha.some(d => !/^\d{4}-\d{2}-\d{2}$/.test(d)))) {
  console.error('--falhas= aceita "nenhuma" ou dias AAAA-MM-DD separados por vírgula')
  process.exit(2)
}
let entrada = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (c: string) => { entrada += c })
process.stdin.on('end', () => {
  const ini = entrada.indexOf('{')
  const fim = entrada.lastIndexOf('}')
  if (ini < 0 || fim < ini) {
    console.error('a entrada não tem o JSON da consulta: nada foi concluído')
    process.exit(2)
  }
  const corpo = JSON.parse(entrada.slice(ini, fim + 1)) as { rows?: DiaLido[] }
  if (!Array.isArray(corpo.rows)) {
    console.error('a consulta não devolveu "rows": nada foi concluído')
    process.exit(2)
  }
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const j = montarJanela(corpo.rows, { desde, hoje, diasComFalha })
  for (const d of j.dias) {
    console.log(`${d.dia}  ${d.estado.padEnd(10)}  controle=${d.controle}  sem_read=${d.sem_read}  tarefas_forja=${d.tarefas_forja}${d.motivo ? `  (${d.motivo})` : ''}${d.teto ? '  (contagem cortada pelo teto)' : ''}`)
  }
  console.log(`dias medidos: ${j.dias_medidos}; com tarefa da forja: ${j.dias_com_tarefa}; falhas de gravação declaradas: ${valorFalhas}`)
  console.log(j.frase)
  process.exit(j.fechada && j.linhas_sem_read === 0 ? 0 : 1)
})

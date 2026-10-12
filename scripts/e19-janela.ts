// Veredito da janela de medição do modo aviso da E19 (só LÊ: stdin e console.log, sem rede nem escrita).
//
// 1. Imprimir a consulta (só select):   npx tsx scripts/e19-janela.ts --sql <desde AAAA-MM-DD>
// 2. Rodar (de dentro de uma sessão de agente; fora dela acrescente --agent=yes; sem -o, para vir {"rows":[...]}):
//      npx supabase db query --linked --agent=yes "$(npx tsx scripts/e19-janela.ts --sql <desde>)" \
//        | npx tsx scripts/e19-janela.ts <desde> --falhas=<nenhuma | AAAA-MM-DD,AAAA-MM-DD>
// --falhas: dias com falha de gravação no Sentry (action:leitura_registro tipo:gravacao). Saída: 0 janela fechada e zero
// sem_read; 1 caso contrário; 2 argumento ou entrada inválida.
// "tarefas_forja": tarefa concluída no dia por chave ATIVA sem read (result_summary->>'closed_by' junto de pipeline_api_keys);
// ver consultaDaJanela. O dia `desde` (o do envio, parcial) nunca conta; os 7 dias começam no dia seguinte. `desde` também
// vai na consulta (--sql): use o MESMO valor nos dois, a última linha da saída o repete. `desde` posterior a `avisoDesde`
// (leitura-modo.ts) deixa um vão sem medida: o script avisa e não fecha. Coluna ausente na entrada: saída 2.
// Dias com leituras perdidas (after_data.perdidas) saem "não medidos" sozinhos; --falhas= segue obrigatório porque a conta
// perdida vive em memória de instância e some se a instância morrer com o disjuntor aberto.
// Typecheck: a lógica vive em apps/web/src/lib/pipeline/leitura-janela*.ts (sob o typecheck do web); este arquivo é fino.
import { montarJanela } from '../apps/web/src/lib/pipeline/leitura-janela'
import { modoLeitura } from '../apps/web/src/lib/pipeline/leitura-modo'
import { consultaDaJanela, lerEntradaDaJanela, EntradaInvalida } from '../apps/web/src/lib/pipeline/leitura-janela-entrada'

const DIA = /^\d{4}-\d{2}-\d{2}$/
const args = process.argv.slice(2)

if (args[0] === '--sql') {
  try {
    console.log(consultaDaJanela(args[1] ?? ''))
    process.exit(0)
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    process.exit(2)
  }
}

const [desde, argFalhas, ...resto] = args
if (!desde || !DIA.test(desde)) {
  console.error('informe o primeiro dia da janela (AAAA-MM-DD)')
  process.exit(2)
}
if (!argFalhas?.startsWith('--falhas=') || resto.length > 0) {
  console.error('informe --falhas=nenhuma (depois de buscar no Sentry por action:leitura_registro tipo:gravacao no período) ou --falhas=AAAA-MM-DD,AAAA-MM-DD')
  process.exit(2)
}
const valorFalhas = argFalhas.slice('--falhas='.length)
const diasComFalha = valorFalhas === 'nenhuma' ? [] : valorFalhas.split(',')
if (valorFalhas !== 'nenhuma' && (diasComFalha.length === 0 || diasComFalha.some(d => !DIA.test(d)))) {
  console.error('--falhas= aceita "nenhuma" ou dias AAAA-MM-DD separados por vírgula')
  process.exit(2)
}
let entrada = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (c: string) => { entrada += c })
process.stdin.on('end', () => {
  let rows
  try {
    rows = lerEntradaDaJanela(entrada)
  } catch (e) {
    console.error(`${e instanceof EntradaInvalida ? e.message : String(e)}: nada foi concluído`)
    process.exit(2)
  }
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const envio = modoLeitura().avisoDesde
  const j = montarJanela(rows, { desde, hoje, diasComFalha, envio })
  if (desde > envio) console.error(`AVISO: desde (${desde}) é posterior ao envio (${envio}): o vão entre os dois não foi medido e a janela não fecha`)
  for (const d of j.dias) {
    console.log(`${d.dia}  ${d.estado.padEnd(10)}  controle=${d.controle}  sem_read=${d.sem_read}  tarefas_forja=${d.tarefas_forja}${d.perdidas > 0 ? `  perdidas=${d.perdidas}` : ''}${d.motivo ? `  (${d.motivo})` : ''}${d.teto ? '  (contagem cortada pelo teto)' : ''}`)
  }
  for (const f of j.sem_read_fora_da_janela) console.log(`${f.dia}  FORA DA JANELA (antes de desde)  sem_read=${f.sem_read}`)
  console.log(`dias medidos: ${j.dias_medidos}; com tarefa da forja: ${j.dias_com_tarefa}; falhas de gravação declaradas: ${valorFalhas}`)
  console.log(j.frase)
  console.log(`desde usado: ${desde} (envio em leitura-modo: ${envio})`)
  process.exit(j.fechada && j.linhas_sem_read === 0 ? 0 : 1)
})

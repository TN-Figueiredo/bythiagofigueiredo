// O comando do dono para o acesso do Observatório. `criar`/`estender` só inserem ou esticam a chave; `liberar`, `estender --liberacao` e `cortar` revogam, por funções SQL; decisão da C1, ledger.
//   ... observatorio-acesso.ts liberar --usuario <e-mail> [--dias N] [--site <uuid>] | liberar --cliente <claude|chatgpt|gemini> --usuario <e-mail> [--site <uuid>] | estender --liberacao <uuid> --dias N | cortar --usuario <e-mail> [--cliente X] [--site <uuid>]
//   npx tsx --tsconfig apps/web/tsconfig.json --require ./apps/web/scripts/_sem-server-only.cjs --env-file apps/web/.env.local apps/web/scripts/observatorio-acesso.ts criar --usuario <e-mail> [--dias N] [--site <uuid>]
//   ... observatorio-acesso.ts estender --chave <observatorio-AAAAMMDD-xxxx> [--dias N]   (mesma chave, nova validade; não imprime segredo)
// Nenhum agente roda este comando. A lógica vive em src/lib/youtube/observatorio/acesso-ia/criar-chave.ts (sob o typecheck e os testes).
// Antes de rodar: `git status` limpo, em `main`, igual a `origin/main` (as duas guardas são constantes do seu checkout; ver o runbook).
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { criarChaveDoPerfil, lerArgumentos } from '../src/lib/youtube/observatorio/acesso-ia/criar-chave'
import { estenderChaveDoPerfil, lerArgumentosDeEstender, descreverResultadoDeEstender } from '../src/lib/youtube/observatorio/acesso-ia/estender-chave'
import { e19ConferidaParaChave } from '../src/lib/youtube/observatorio/acesso-ia/interruptor'
import { ehSubcomandoDeLiberacao, executarSubcomando, lerSubcomando } from '../src/lib/youtube/observatorio/acesso-ia/liberacao'
import { ACESSO_IA_RULES } from '../src/lib/youtube/observatorio/acesso-ia/regras'

async function main(): Promise<number> {
  const sub = process.argv[2]
  if (ehSubcomandoDeLiberacao(process.argv.slice(2))) return liberacao()
  if (sub === 'estender') return estender()
  const args = lerArgumentos(process.argv.slice(2))
  if (!args.ok) { console.error(`recusado: ${args.recusa}. Uso: criar --usuario <e-mail> [--dias N] [--site <uuid>] | estender --chave <nome> [--dias N]`); return 2 }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !servico) { console.error('faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY'); return 2 }
  const sb = createClient(url, servico, { auth: { persistSession: false } })
  const r = await criarChaveDoPerfil(
    { sb, agora: Date.now, e19: e19ConferidaParaChave, excecaoEm: ACESSO_IA_RULES.excecaoDaPergunta47Em, aleatorio: (n) => randomBytes(n) },
    args.pedido,
  )
  if (!r.ok) { console.error(`recusado: ${r.recusa}${r.code ? ` (${r.code})` : ''}`); return 1 }
  console.log(`chave criada: ${r.nome}, vence em ${r.venceEm}`)
  console.log('Esta é a ÚNICA vez que o texto aparece. Guarde agora:')
  console.log(r.chave)
  console.log(`claude mcp add --scope user --transport http observatorio https://bythiagofigueiredo.com/api/mcp --header "Authorization: Bearer ${r.chave}"`)
  return 0
}

async function liberacao(): Promise<number> {
  const args = lerSubcomando(process.argv.slice(2))
  if (!args.ok) { console.error(`recusado: ${args.recusa}. Uso: liberar --usuario <e-mail> [--dias N] [--site <uuid>] | liberar --cliente <c> --usuario <e-mail> [--site <uuid>] | estender --liberacao <uuid> --dias N | cortar --usuario <e-mail> [--cliente X] [--site <uuid>]`); return 2 }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !servico) { console.error('faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY'); return 2 }
  const sb = createClient(url, servico, { auth: { persistSession: false } })
  const r = await executarSubcomando({ sb, agora: Date.now }, args.s)
  if (!r.ok) { console.error(`recusado: ${r.recusa}${r.code ? ` (${r.code})` : ''}${r.recusa === 'nao_conferido' ? '. O efeito pode ter sido gravado: confira no banco; rodar de novo é seguro' : ''}`); return 1 }
  for (const l of r.linhas) console.log(l)
  return 0
}

// exitCode (não process.exit): deixa a saída em pipe terminar de escrever antes do processo acabar (Yannis M-5)
async function estender(): Promise<number> {
  const args = lerArgumentosDeEstender(process.argv.slice(2))
  if (!args.ok) { console.error(`recusado: ${args.recusa}. Uso: estender --chave <observatorio-AAAAMMDD-xxxx> [--dias N]`); return 2 }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !servico) { console.error('faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY'); return 2 }
  const sb = createClient(url, servico, { auth: { persistSession: false } })
  const r = await estenderChaveDoPerfil({ sb, agora: Date.now, e19: e19ConferidaParaChave, excecaoEm: ACESSO_IA_RULES.excecaoDaPergunta47Em }, args.pedido)
  const { texto } = descreverResultadoDeEstender(r, args.pedido.chave)
  if (!r.ok) { console.error(texto); return 1 }
  console.log(texto)
  return 0
}

main().then((c) => { process.exitCode = c }, () => { console.error('falha inesperada: nada foi criado nem estendido, ou o resultado é desconhecido; confira as chaves no banco'); process.exitCode = 1 })

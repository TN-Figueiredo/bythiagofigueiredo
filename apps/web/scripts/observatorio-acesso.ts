// O comando do dono para criar a chave do perfil `observatorio_leitura` (A5 E17, degrau 2). SÓ `criar`: sem --permissao, sem --revogar, sem --apagar.
//   npx tsx --tsconfig apps/web/tsconfig.json --env-file apps/web/.env.local apps/web/scripts/observatorio-acesso.ts criar --usuario <e-mail> [--dias N] [--site <uuid>]
// Nenhum agente roda este comando. A lógica vive em src/lib/youtube/observatorio/acesso-ia/criar-chave.ts (sob o typecheck e os testes).
// Antes de rodar: `git status` limpo, em `main`, igual a `origin/main` (as duas guardas são constantes do seu checkout; ver o runbook).
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { criarChaveDoPerfil, lerArgumentos } from '../src/lib/youtube/observatorio/acesso-ia/criar-chave'
import { e19ConferidaParaChave } from '../src/lib/youtube/observatorio/acesso-ia/interruptor'
import { ACESSO_IA_RULES } from '../src/lib/youtube/observatorio/acesso-ia/regras'

async function main(): Promise<number> {
  const args = lerArgumentos(process.argv.slice(2))
  if (!args.ok) { console.error(`recusado: ${args.recusa}. Uso: criar --usuario <e-mail> [--dias N] [--site <uuid>]`); return 2 }
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

main().then((c) => process.exit(c), () => { console.error('falha inesperada: nada foi criado ou o resultado é desconhecido; confira as chaves no banco'); process.exit(1) })

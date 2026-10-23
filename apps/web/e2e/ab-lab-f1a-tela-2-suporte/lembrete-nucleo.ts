// Roda o NÚCLEO de `avisos_pendentes` (lembrete do dia 14) contra o banco local padrão e monta o e-mail com o adaptador REAL, mas com o endpoint do SES
// apontado para um sorvedouro local (AWS_ENDPOINT_URL_SESV2): nada sai da máquina (as credenciais também são falsas). Saída: uma linha JSON no stdout.
// Uso (da pasta apps/web): npx tsx --tsconfig tsconfig.json e2e/ab-lab-f1a-tela-2-suporte/lembrete-nucleo.ts <youtube_video_id>
import http from 'node:http'
import path from 'node:path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') })

async function main(): Promise<void> {
  const ytId = process.argv[2]
  if (!ytId) throw new Error('falta o youtube_video_id')
  const corpos: string[] = []
  const sorvedouro = http.createServer((req, res) => {
    const partes: Buffer[] = []
    req.on('data', (c: Buffer) => partes.push(c))
    req.on('end', () => { corpos.push(Buffer.concat(partes).toString('utf8')); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ MessageId: 'gio-local' })) })
  })
  await new Promise<void>((ok) => sorvedouro.listen(0, '127.0.0.1', ok))
  const porta = (sorvedouro.address() as { port: number }).port
  process.env.AWS_SES_REGION = 'sa-east-1'
  process.env.AWS_SES_ACCESS_KEY_ID = 'LOCALDUMMY'
  process.env.AWS_SES_SECRET_ACCESS_KEY = 'localdummy'
  process.env.AWS_ENDPOINT_URL_SESV2 = `http://127.0.0.1:${porta}`
  process.env.NTFY_URL = 'http://127.0.0.1:9'
  if (!/127\.0\.0\.1:54321/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')) throw new Error('recusando: Supabase não é o local padrão')

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { rodarAvisos } = await import('../../src/lib/youtube/agenda/tarefas/avisos-pendentes')
  const agora = Date.now()
  const resultado = await rodarAvisos({ t0: agora, agora: () => agora, apiKey: '', sb, linhas: null })

  const reg = (await sb.from('ab_native_tests').select('id,lembrete_notificado_em').eq('youtube_video_id', ytId)).data?.[0] as { id: string; lembrete_notificado_em: string | null } | undefined
  const notificacoes = reg ? ((await sb.from('notifications').select('*').eq('dedup_key', `lembrete-nativo:${reg.id}`)).data ?? []) : []
  const entregas = notificacoes.length ? ((await sb.from('notification_deliveries').select('channel,status').in('notification_id', notificacoes.map((n: { id: string }) => n.id))).data ?? []) : []

  const { EmailAdapter } = await import('../../src/lib/notifications/adapters/email')
  const envio = notificacoes[0] ? await new EmailAdapter().send(notificacoes[0] as never, { email: 'dono@exemplo.test' } as never) : null
  await new Promise<void>((ok) => sorvedouro.close(() => ok()))
  let html: string | null = null
  let assunto: string | null = null
  if (corpos[0]) { const j = JSON.parse(corpos[0]) as { Content?: { Simple?: { Subject?: { Data?: string }; Body?: { Html?: { Data?: string } } } } }; html = j.Content?.Simple?.Body?.Html?.Data ?? null; assunto = j.Content?.Simple?.Subject?.Data ?? null }
  process.stdout.write('\n@@RESULTADO@@' + JSON.stringify({ resultado, registro: reg, notificacoes, entregas, envio, enviosCapturados: corpos.length, html, assunto }) + '\n')
  process.exit(0)
}
main().catch((e) => { process.stderr.write(String(e instanceof Error ? e.stack : e) + '\n'); process.exit(1) })

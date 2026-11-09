// @vitest-environment node
/**
 * A2 · Tarefa 3 · inventário do banco com um `reporter` de verdade (a parte B do passo 0, que nunca foi feita), no bythiago_int, com a MG19:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run --no-file-parallelism test/integration/a2-reporter-banco.test.ts
 * 3a estrutural · 3b leitura por linhas · 3c escrita · 3d funções. Função sem EXECUTE para o papel NUNCA é chamada (SIGSEGV no Postgres local):
 * a consulta de 3b pula (e lista) a tabela cuja policy depende de função sem EXECUTE.
 * Cada exceção abaixo leva UMA frase. Item novo fora das listas derruba o teste: quem cria a policy/tabela/função decide e escreve a frase.
 * Achados da A2 (fora do escopo, para o dono/controlador): ver as frases que começam com "ACHADO".
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedRbacScenario, cleanupRbacScenario, type RbacScenario } from '../helpers/db-seed'
import { comoUsuario, tentar } from '../helpers/pg-como'

vi.setConfig({ testTimeout: 60_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const FRENTE = 'frente anon-views-expostas'
const JWT = 'is_staff() lê o JWT; app_metadata.role dela é nulo (P6, 09/11)'
const PUBLICO = 'leitura pública do que está publicado, por site_visible (conteúdo do site, sem dado de pessoa)'
const PROPRIA = 'linha própria da pessoa (user_id = auth.uid()); formulário público: insert filtrado por site_visible'

/** 3a. Relação legível por authenticated que NÃO fecha por can_*: o que é aberto de propósito (ou achado), uma frase. Chave = nome (partições: sem o sufixo de data). */
const ABERTO_DE_PROPOSITO: Record<string, string> = {
  // sem RLS / view sem security_invoker / matview
  cron_health: `sem RLS, tabela de saúde dos crons (sem dado de pessoa); ${FRENTE}`,
  linktree_events: `partições sem RLS no banco local (em produção têm RLS e 0 policy); ${FRENTE}`,
  link_clicks: `partições (em produção têm RLS e 0 policy); ${FRENTE}`,
  fan_scores: `matview; ${FRENTE}`,
  link_summary_v2: `view sem security_invoker em produção; ${FRENTE}`,
  linktree_daily_geo: `view sem security_invoker em produção; ${FRENTE}`,
  linktree_device_stats: `view sem security_invoker em produção; ${FRENTE}`,
  newsletter_click_events: `view sem security_invoker em produção; ${FRENTE}`,
  newsletter_click_events_unified: `view sem security_invoker em produção; ${FRENTE}`,
  v_cron_health: `view sem security_invoker em produção; ${FRENTE}`,
  youtube_channel_stats: `view sem security_invoker em produção; ${FRENTE}`,
  // policies de leitura pública por site_visible
  author_about_translations: PUBLICO, blog_posts: `${PUBLICO}; o rascunho só passa por can_edit_site (MG19)`, blog_tags: PUBLICO,
  campaign_translations: `${PUBLICO}; leitura de staff por is_staff(): ${JWT}`, campaigns: `${PUBLICO}; leitura de staff por is_staff(): ${JWT}`,
  contact_page_settings: PUBLICO, contact_page_visibility: PUBLICO, hashtags: PUBLICO, instagram_feed_slots: PUBLICO, instagram_posts: PUBLICO,
  media_assets: PUBLICO, newsletter_editions: PUBLICO, newsletter_types: `${PUBLICO}; a gestão é can_edit_site (MG19)`, page_content: PUBLICO,
  post_hashtags: PUBLICO, tracked_links: PUBLICO, waitlist_translations: PUBLICO, waitlists: PUBLICO, youtube_categories: PUBLICO,
  youtube_channels: PUBLICO, youtube_curated_comments: PUBLICO, youtube_videos: PUBLICO,
  link_in_bio_entries: `${PUBLICO}; escrita por is_staff(): ${JWT}`,
  social_templates: `leitura de modelos de post (sem dado de pessoa) por site_visible; escrita por is_staff(): ${JWT}`,
  fan_interactions: `ACHADO A2: leitura por site_visible para qualquer authenticated; escrita por is_staff() (${JWT}); fora da A2, vai para a ${FRENTE}`,
  // is_staff() (JWT)
  authors: `is_staff() lê o JWT; ${JWT}; leitura pública`, blog_translations: `${PUBLICO}; staff por is_staff(): ${JWT}`,
  campaign_submissions: `leitura por is_staff(): ${JWT}`, content_events: `leitura por is_staff(): ${JWT}; insert anônimo por site_visible`,
  content_metrics: `leitura por is_staff(): ${JWT}`, working_today: `${JWT}; insert da própria linha`,
  // true / leitura aberta a authenticated
  ad_campaigns: `ACHADO A2: leitura aberta a QUALQUER authenticated (using true); campanhas de anúncio, sem dado de pessoa; fora da A2, ${FRENTE}`,
  ad_inquiries: `ACHADO A2: leitura aberta a QUALQUER authenticated (using true) e insert (true); contatos de anunciantes (dado de pessoa); fora da A2, ${FRENTE}`,
  ad_media: `ACHADO A2: leitura aberta a authenticated (using true); mídia de anúncio; fora da A2, ${FRENTE}`,
  ad_placeholders: `ACHADO A2: leitura aberta a authenticated (using true); fora da A2, ${FRENTE}`,
  ad_revenue_daily: `ACHADO A2: leitura aberta a QUALQUER authenticated (using true): receita de anúncios (dinheiro); fora da A2, ${FRENTE}`,
  ad_slot_config: `leitura aberta (true): configuração pública de espaços de anúncio`,
  ad_slot_creatives: `ACHADO A2: leitura aberta a authenticated (using true); fora da A2, ${FRENTE}`,
  ad_events: `ACHADO A2: insert por authenticated (with check true), sem leitura; fora da A2, ${FRENTE}`,
  consent_texts: 'leitura pública do texto de consentimento (using true)',
  kill_switches: 'leitura de chaves de desligamento por authenticated (using true), sem dado de pessoa',
  notification_types: 'catálogo de tipos de notificação (using true), sem dado de pessoa',
  organizations: 'leitura pública de organizações (using true), nome e slug',
  pipeline_workflows: 'catálogo de fluxos do pipeline (using true), sem dado de pessoa',
  sites: 'leitura pública de sites (using true), domínio e nome',
  // linha própria / formulário público
  contact_submissions: 'formulário público: insert filtrado por site; leitura/edição por can_*',
  newsletter_subscriptions: 'formulário público: insert pendente filtrado por site_visible; leitura por can_*',
  campaign_submissions_insert: 'formulário público',
  site_memberships: 'o vínculo da própria pessoa (ela lê só a linha dela; o papel que o layout usa)',
  consents: PROPRIA, lgpd_requests: PROPRIA, push_subscriptions: PROPRIA, notifications: PROPRIA, notification_preferences: PROPRIA,
  competitor_user_prefs: 'preferência própria de nicho (user_id = auth.uid() e can_view_site); exceção E17-4',
  link_clicks_events: `evento público; ${FRENTE}`, linktree_events_default: `evento público; ${FRENTE}`,
  // storage.objects: chave = storage.objects:<policy>
  'storage.objects:author-avatars staff write': JWT,
  'storage.objects:campaign-files staff all': JWT,
  'storage.objects:content-files staff all': JWT,
  'storage.objects:link_assets_service_delete': `roles public, só bucket_id; escrita aberta a anon (P8e, 09/11); conserto na ${FRENTE} §9`,
  'storage.objects:link_assets_service_insert': `roles public, só bucket_id; escrita aberta a anon (P8e, 09/11); conserto na ${FRENTE} §9`,
  'storage.objects:link_assets_service_update': `roles public, só bucket_id; escrita aberta a anon (P8e, 09/11); conserto na ${FRENTE} §9`,
}
const nomeBase = (r: string) => r.replace(/_(\d{4}_\d{2}|default)$/, '')

/** 3b. Tabela com linha lida pelo reporter: uma frase por tabela. */
const LE_COMO_REPORTER: Record<string, string> = {
  ...Object.fromEntries(Object.entries(ABERTO_DE_PROPOSITO).filter(([k]) => !k.startsWith('storage.')).map(([k, v]) => [k, v])),
}

/** 3c. Tabelas com policy de escrita que olha algo além de can_*: o que o reporter pode escrever, uma frase. */
const ESCREVE_COMO_REPORTER: Record<string, string> = {
  ad_events: `ACHADO A2: insert (true) por authenticated; ${FRENTE}`,
  ad_inquiries: `ACHADO A2: insert (true) por anon/authenticated; formulário público; ${FRENTE}`,
  authors: JWT, blog_translations: JWT, campaign_translations: JWT, fan_interactions: JWT, link_in_bio_entries: JWT, social_templates: JWT, working_today: JWT,
  campaign_submissions: 'formulário público (insert filtrado por campanha publicada)',
  consents: PROPRIA, lgpd_requests: PROPRIA, push_subscriptions: PROPRIA, notifications: PROPRIA, notification_preferences: PROPRIA,
  competitor_user_prefs: 'preferência própria de nicho; exceção E17-4',
  contact_submissions: 'formulário público: insert filtrado por site_visible (a edição é can_admin_site_users)',
  newsletter_subscriptions: 'formulário público: insert pendente filtrado por site_visible',
  content_events: 'evento público: insert por site_visible', link_clicks: `evento público; ${FRENTE}`, linktree_events: `evento público; ${FRENTE}`,
  objects: 'storage: ver ABERTO_DE_PROPOSITO (is_staff/JWT) e a regra Y1',
  organizations: 'is_org_staff(id): papel de organização, não de site (o reporter não tem)',
  page_content: 'is_org_admin(site_id): exige org_admin',
  organization_members: 'is_org_admin(org_id)', invitations: 'is_org_admin(org_id)',
}

/** 3d. Funções security definer executáveis por authenticated, classificadas pela LEITURA do corpo (nunca chamadas). */
type Classe = 'so_responde_sobre_quem_chama' | 'confere_permissao_no_corpo' | 'devolve_dado_do_site_sem_conferir'
const FUNCOES_QUE_ELA_CHAMA: Record<string, Classe> = {
  accept_invitation_atomic: 'so_responde_sobre_quem_chama', can_admin_site_users: 'so_responde_sobre_quem_chama', can_edit_site: 'so_responde_sobre_quem_chama',
  can_publish_site: 'so_responde_sobre_quem_chama', can_view_observatorio: 'so_responde_sobre_quem_chama', can_view_private_site: 'so_responde_sobre_quem_chama',
  can_view_site: 'so_responde_sobre_quem_chama', is_member_editor: 'so_responde_sobre_quem_chama', is_member_staff: 'so_responde_sobre_quem_chama',
  is_org_admin: 'so_responde_sobre_quem_chama', is_super_admin: 'so_responde_sobre_quem_chama', merge_anonymous_consents: 'so_responde_sobre_quem_chama',
  org_role: 'so_responde_sobre_quem_chama', set_audit_context: 'so_responde_sobre_quem_chama', user_accessible_sites: 'so_responde_sobre_quem_chama',
  activate_research_foco: 'confere_permissao_no_corpo', batch_extend_link_expiry: 'confere_permissao_no_corpo', increment_invitation_resend: 'confere_permissao_no_corpo',
  reassign_content: 'confere_permissao_no_corpo', restore_playlist_snapshot: 'confere_permissao_no_corpo', save_research_foco_full: 'confere_permissao_no_corpo',
  update_campaign_atomic: 'confere_permissao_no_corpo', waitlist_signup_counts: 'confere_permissao_no_corpo',
  anonymize_contact_submission: 'confere_permissao_no_corpo', // is_staff(): depende da P6 (JWT sem papel)
  assign_week_slot: 'confere_permissao_no_corpo', // is_staff(): depende da P6
  get_site_branding: 'devolve_dado_do_site_sem_conferir', // marca pública do site (nome, logo)
}

describe.skipIf(skipIfNoLocalDb())('A2 · o reporter no banco (MG19)', () => {
  let pg: Client
  let admin: SupabaseClient
  let s: RbacScenario
  const semSemente: string[] = []
  const semente: Record<string, string> = {} // tabela -> id da linha própria semeada no site A

  async function semear(tabela: string, sql: string, params: unknown[]): Promise<void> {
    try {
      const r = await pg.query(sql, params)
      semente[tabela] = String(r.rows[0]?.id ?? '')
    } catch (e) {
      semSemente.push(`${tabela} (${(e as Error).message.slice(0, 60)})`)
    }
  }

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    s = await seedRbacScenario(admin)
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
    const A = s.siteAId
    const x = randomUUID().replace(/-/g, '')
    await semear('blog_posts', `insert into public.blog_posts (site_id, author_id, status, owner_user_id) values ($1,$2,'draft',$3) returning id`, [A, s.authorsByUser[s.reporterAId], s.reporterAId])
    await semear('contact_submissions', `insert into public.contact_submissions (site_id, name, email, message, consent_processing, consent_processing_text_version) values ($1,'Teste','a2@example.test','mensagem de teste A2',true,'v1') returning id`, [A])
    await semear('newsletter_subscriptions', `insert into public.newsletter_subscriptions (site_id, email, status, consent_text_version, newsletter_id) values ($1,'a2@example.test','pending_confirmation','v1','main-pt') returning id`, [A])
    await semear('content_pipeline', `insert into public.content_pipeline (site_id, code, format, stage) values ($1,$2,'video','idea') returning id`, [A, 'a2-' + x.slice(0, 8)])
    await semear('media_assets', `insert into public.media_assets (site_id, blob_url, blob_pathname, filename, mime_type, file_size, content_hash) values ($1,'https://x.test/a','a/a','a.png','image/png',1,$2) returning id`, [A, x + x])
    await semear('playlists', `insert into public.playlists (site_id, name_pt, slug) values ($1,'A2',$2) returning id`, [A, 'a2-' + x.slice(0, 8)])
    await semear('social_posts', `insert into public.social_posts (site_id, type, content) values ($1,'text','{}') returning id`, [A])
    await semear('tracked_links', `insert into public.tracked_links (site_id, code, destination_url) values ($1,$2,'https://x.test') returning id`, [A, 'a2' + x.slice(0, 8)])
    await semear('competitor_channels', `insert into public.competitor_channels (site_id, channel_id, channel_name) values ($1,$2,'A2') returning id`, [A, 'UCa2' + x.slice(0, 18)])
    await semear('youtube_channels', `insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug) values ($1,$2,'pt',$3,'A2',$4,$5) returning id`, [A, 'UC' + x.slice(0, 22), '@a2' + x.slice(0, 8), 'UU' + x.slice(2, 24), 'a2-' + x.slice(0, 8)])
    if (semente.youtube_channels) {
      await semear('youtube_videos', `insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at) values ($1,$2,$3,'A2', now()) returning id`, [A, semente.youtube_channels, 'a2' + x.slice(0, 9)])
      await semear('yt_own_video_daily', `insert into public.yt_own_video_daily (youtube_video_id, day_pt, site_id, channel_id, metric_version) values ($1, current_date, $2, $3, 'views_desde_2026-08-27') returning youtube_video_id as id`, ['a2' + x.slice(0, 9), A, semente.youtube_channels])
    }
    if (semente.youtube_videos) await semear('ab_tests', `insert into public.ab_tests (site_id, youtube_video_id, name, original_thumbnail_url) values ($1,$2,'A2','https://x.test/t.png') returning id`, [A, semente.youtube_videos])
  })
  afterAll(async () => {
    try {
      for (const [t, col] of [['ab_tests', 'site_id'], ['yt_own_video_daily', 'site_id'], ['youtube_videos', 'site_id'], ['youtube_channels', 'site_id'], ['competitor_channels', 'site_id'], ['tracked_links', 'site_id'], ['social_posts', 'site_id'], ['playlists', 'site_id'], ['media_assets', 'site_id'], ['content_pipeline', 'site_id']] as const) {
        await pg.query(`delete from public.${t} where ${col} = $1`, [s.siteAId]).catch(() => undefined)
      }
    } finally {
      await pg?.end()
      await cleanupRbacScenario(admin, s)
    }
  })

  // ───────────────────────── 3a · estrutural ─────────────────────────
  it('3a: toda relação legível por authenticated fecha por can_* ou está em ABERTO_DE_PROPOSITO (uma frase)', async () => {
    const rels = await pg.query(`
      select n.nspname s, c.relname r, c.relkind k, c.relrowsecurity rls,
             coalesce((select option_value from pg_options_to_table(c.reloptions) where option_name='security_invoker'),'') inv
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname in ('public','storage') and c.relkind in ('r','p','v','m','f')
         and has_table_privilege('authenticated', c.oid, 'select')`)
    const falhas: string[] = []
    for (const r of rels.rows) {
      const aberta = (r.k === 'r' || r.k === 'p') ? !r.rls : r.k === 'm' ? true : r.k === 'v' ? !['true', 'on'].includes(r.inv) : false
      if (aberta && !ABERTO_DE_PROPOSITO[nomeBase(r.r)]) falhas.push(`${r.s}.${r.r} (${r.k}): sem RLS / view sem security_invoker / matview`)
    }
    const pol = await pg.query(`
      select schemaname s, tablename t, policyname p, cmd, roles::text rl, coalesce(qual,'') q, coalesce(with_check,'') w from pg_policies
       where schemaname in ('public','storage') and roles::text !~ '^\\{service_role\\}$'`)
    for (const p of pol.rows) {
      const e = `${p.q} ${p.w}`
      const arriscada = /(is_member_staff\(\)|is_staff\(\)|site_visible\()/.test(e) || /(^|[^a-z_])true([^a-z_]|$)/.test(e)
      const comCan = /can_[a-z_]+\(/.test(e)
      const chave = p.s === 'storage' ? `storage.objects:${p.p}` : nomeBase(p.t)
      if (arriscada && !comCan && !ABERTO_DE_PROPOSITO[chave]) falhas.push(`${p.s}.${p.t} policy "${p.p}": ${p.cmd} sem can_* (is_staff/is_member_staff/site_visible/true)`)
      // regra extra de storage.objects (Y1): escrita sem nenhum dono/papel/permissão na expressão
      if (p.s === 'storage' && p.cmd !== 'SELECT' && /public|anon|authenticated/.test(p.rl) && !/(auth\.uid\(\)|is_[a-z_]+\(|can_[a-z_]+\()/.test(e) && !ABERTO_DE_PROPOSITO[chave]) {
        falhas.push(`storage.objects policy "${p.p}": escrita só por bucket_id (${p.rl})`)
      }
    }
    expect(falhas, 'falta uma frase em ABERTO_DE_PROPOSITO (ou um conserto)').toEqual([])
    // a MG19 fechou o newsletter-assets: nenhuma policy de storage com is_member_staff()
    const ns = await pg.query(`select policyname from pg_policies where schemaname='storage' and (coalesce(qual,'')||coalesce(with_check,'')) like '%is_member_staff()%'`)
    expect(ns.rows).toEqual([])
  })

  // ───────────────────────── 3b · por linhas ─────────────────────────
  it('3b: o reporter lê 0 nas tabelas do CMS e do Observatório; toda tabela com linha lida está em LE_COMO_REPORTER', async () => {
    const tabelas = await pg.query(`
      select c.relname r, c.oid,
        exists (select 1 from pg_policy pol join pg_depend d on d.classid = 'pg_policy'::regclass and d.objid = pol.oid and d.refclassid = 'pg_proc'::regclass
                 join pg_proc p on p.oid = d.refobjid
                 where pol.polrelid = c.oid and not has_function_privilege('authenticated', p.oid, 'execute')
                   and (0 = any(pol.polroles) or (select oid from pg_roles where rolname='authenticated') = any(pol.polroles))) as sem_exec
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r','p') and not c.relispartition and has_table_privilege('authenticated', c.oid, 'select')
       order by 1`)
    const lidas: Record<string, number> = {}
    const naoConsultadas: string[] = []
    let vazias = 0
    await comoUsuario(pg, s.reporterAId, async () => {
      for (const t of tabelas.rows) {
        if (t.sem_exec) { naoConsultadas.push(t.r); continue }
        const r = await tentar(pg, `select count(*)::int n from (select 1 from public."${t.r}" limit 1000) x`)
        if (r.code) { naoConsultadas.push(`${t.r} (${r.code})`); continue }
        const n = (await pg.query(`select count(*)::int n from public."${t.r}"`).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n as number
        if (n > 0) lidas[t.r] = n; else vazias++
      }
    })
    console.info(`3b: ${tabelas.rowCount} tabelas, ${vazias} sem linha visível ao reporter (vazia não prova nada), ${Object.keys(lidas).length} com linha, não consultadas: ${naoConsultadas.join(', ') || 'nenhuma'}; sem semente: ${semSemente.join('; ') || 'nenhuma'}`)
    // o Observatório e o CMS dela vêm do servidor: pela RLS é 0
    const fechadas = Object.keys(lidas).filter((t) => /^(competitor_|yt_own_|ab_test|content_pipeline|social_posts|playlists)/.test(t) && t !== 'competitor_user_prefs')
    expect(fechadas, 'tabelas do CMS/Observatório que o reporter lê pela RLS').toEqual([])
    // toda tabela com linha lida tem uma frase
    expect(Object.keys(lidas).filter((t) => !LE_COMO_REPORTER[t]), 'falta uma frase em LE_COMO_REPORTER').toEqual([])
    // semente: as tabelas semeadas têm linha para um editor (controle positivo: "0" do reporter vale algo)
    const ed = await comoUsuario(pg, s.editorAId, async () => {
      const out: Record<string, number> = {}
      for (const t of Object.keys(semente)) out[t] = (await pg.query(`select count(*)::int n from public.${t} where site_id = $1`, [s.siteAId]).catch(() => ({ rows: [{ n: -1 }] }))).rows[0].n
      return out
    })
    for (const t of ['blog_posts', 'contact_submissions', 'content_pipeline', 'media_assets', 'playlists', 'social_posts', 'competitor_channels', 'ab_tests']) {
      if (semente[t]) expect(ed[t], `${t}: o editor lê a linha semeada (controle positivo)`).toBeGreaterThanOrEqual(1)
    }
  })

  it('3b: yt_own_* privadas dão 0 sem concessão e a linha com concessão (can_view_private_site)', async () => {
    if (!semente.yt_own_video_daily) return console.info('3b: sem semente de yt_own_video_daily (ver lista acima)')
    const ler = () => comoUsuario(pg, s.reporterAId, async () => (await pg.query(`select count(*)::int n from public.yt_own_video_daily where site_id = $1`, [s.siteAId])).rows[0].n as number)
    expect(await ler()).toBe(0)
    await pg.query(`insert into public.site_private_viewers (site_id, user_id, granted_by) values ($1,$2,$3)`, [s.siteAId, s.reporterAId, s.superAdminId])
    try { expect(await ler()).toBe(1) } finally { await pg.query(`delete from public.site_private_viewers where site_id = $1`, [s.siteAId]) }
  })

  // ───────────────────────── 3c · escrita ─────────────────────────
  it('3c: policy de escrita que olha algo além de can_* está em ESCREVE_COMO_REPORTER (uma frase por tabela)', async () => {
    const pol = await pg.query(`
      select schemaname s, tablename t, policyname p, coalesce(qual,'')||' '||coalesce(with_check,'') e from pg_policies
       where schemaname in ('public','storage') and cmd <> 'SELECT' and roles::text !~ '^\\{service_role\\}$'`)
    const falhas = pol.rows.filter((p) => {
      const risco = /(reporter|owner_user_id|is_member_staff\(\)|is_staff\(\)|site_visible\()/.test(p.e) || /(^|[^a-z_])true([^a-z_]|$)/.test(p.e) || (/auth\.uid\(\)/.test(p.e) && !/can_[a-z_]+\(/.test(p.e))
      return risco && !ESCREVE_COMO_REPORTER[p.t]
    }).map((p) => `${p.s}.${p.t} "${p.p}"`)
    expect(falhas, 'policy de escrita nova fora da lista').toEqual([])
    // a MG19 tirou o ramo do reporter e do dono do blog
    const blog = await pg.query(`select policyname from pg_policies where tablename='blog_posts' and cmd<>'SELECT' and policyname like 'blog_posts\\_%' and (coalesce(qual,'')||coalesce(with_check,'')) ~ '(reporter|owner_user_id)'`)
    expect(blog.rows).toEqual([])
  })

  it('3c: como reporter_a, com uma linha própria semeada, insert/update/delete nas tabelas semeadas dão 0 linhas ou 42501', async () => {
    const out: string[] = []
    await comoUsuario(pg, s.reporterAId, async () => {
      // o rascunho do próprio reporter (owner_user_id): antes da emenda o UPDATE devolvia 1 linha
      const ownId = semente.blog_posts
      expect(ownId, 'semente do rascunho próprio').toBeTruthy()
      const u = await tentar(pg, `update public.blog_posts set site_id = $2 where id = $1`, [ownId, s.siteBId])
      if (u.rows !== 0 && !u.code) out.push('blog_posts update (rascunho próprio)')
      const d = await tentar(pg, `delete from public.blog_posts where id = $1`, [ownId])
      if (d.rows !== 0 && !d.code) out.push('blog_posts delete (rascunho próprio)')
      const i = await tentar(pg, `insert into public.blog_posts (site_id, author_id, status, owner_user_id) values ($1,$2,'draft',$3)`, [s.siteAId, s.authorsByUser[s.reporterAId], s.reporterAId])
      if (i.code !== '42501') out.push(`blog_posts insert (${i.code ?? 'passou'})`)
      for (const t of ['contact_submissions', 'newsletter_subscriptions', 'content_pipeline', 'media_assets', 'playlists', 'social_posts', 'tracked_links', 'competitor_channels', 'ab_tests', 'youtube_channels', 'youtube_videos']) {
        if (!semente[t]) continue
        const col = (await pg.query(`select attname from pg_attribute where attrelid = 'public.${t}'::regclass and attnum > 0 and not attisdropped order by attnum limit 1`)).rows[0].attname
        const up = await tentar(pg, `update public.${t} set "${col}" = "${col}" where site_id = $1`, [s.siteAId])
        if (up.rows !== 0 && !up.code) out.push(`${t} update`)
        const de = await tentar(pg, `delete from public.${t} where site_id = $1`, [s.siteAId])
        if (de.rows !== 0 && !de.code) out.push(`${t} delete`)
      }
    })
    expect(out).toEqual([])
  })

  it('3c: o que is_staff() abriria (documenta): com app_metadata.role=editor no JWT o reporter altera a própria linha de authors; sem papel, não', async () => {
    const alterar = (papel?: string) => comoUsuario(pg, s.reporterAId, async () => {
      const r = await tentar(pg, `update public.authors set name = name where id = $1`, [s.authorsByUser[s.reporterAId]])
      return r
    }, papel)
    const sem = await alterar()
    const com = await alterar('editor')
    console.info(`3c: authors sem papel no JWT = ${JSON.stringify(sem)}; com role=editor = ${JSON.stringify(com)}`)
    expect(com.rows).toBeGreaterThanOrEqual(sem.rows)
    expect(com.code).toBeNull()
  })

  // ───────────────────────── 3d · funções ─────────────────────────
  it('3d: toda função security definer executável por authenticated está classificada; função nova derruba; a classe "confere" confere de verdade', async () => {
    const fns = await pg.query(`
      select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosecdef and p.prokind = 'f' and has_function_privilege('authenticated', p.oid, 'execute') order by 1`)
    const nomes = [...new Set(fns.rows.map((f) => f.proname as string))]
    expect(nomes.filter((n) => !FUNCOES_QUE_ELA_CHAMA[n]), 'função nova sem classificação').toEqual([])
    for (const f of fns.rows) {
      if (FUNCOES_QUE_ELA_CHAMA[f.proname] === 'confere_permissao_no_corpo') {
        expect(f.prosrc, `${f.proname} confere permissão no corpo`).toMatch(/(can_[a-z_]+\(|is_staff\(\)|is_org_admin\(|is_super_admin\()/)
      }
    }
  })
})

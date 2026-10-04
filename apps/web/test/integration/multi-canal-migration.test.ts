// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite, insertAuthUser, deleteAuthUser, SUPABASE_URL, ANON_KEY } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const FACTORY = [
  { slug: 'viagem', label: 'Viagem', color_dark: '#5BBF8A', color_light: '#11692F' },
  { slug: 'ia', label: 'IA', color_dark: '#6EA8FE', color_light: '#1D4ED8' },
]
// Paleta aprovada dos nichos criados pelo dono (escuro / claro): ameixa, rosa, lima, ardósia.
const PALETTE = [
  ['#D29AE8', '#7B2A91'], ['#F293C2', '#A3216B'], ['#B9CB62', '#55650B'], ['#AAB4C0', '#4B5563'],
] as const

describe.skipIf(skipIfNoLocalDb())('migration multi_canal_nichos_slug', () => {
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let siteA: string
  let siteB: string
  const run = `${Date.now()}`
  let seq = 0

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    siteA = (await seedSite(sb)).siteId
    siteB = (await seedSite(sb)).siteId
  })

  afterAll(async () => {
    for (const siteId of [siteA, siteB]) {
      await sb.from('youtube_channels').delete().eq('site_id', siteId)
      await sb.from('sites').delete().eq('id', siteId)
    }
  })

  /** Um canal no formato que o código anterior à migration grava: sem slug. */
  const channel = (siteId: string, handle: string, extra: Record<string, unknown> = {}) => {
    seq += 1
    return {
      site_id: siteId,
      channel_id: `UCmc${run}${seq}`,
      locale: 'pt',
      handle,
      name: `Canal ${seq}`,
      uploads_playlist_id: `UUmc${run}${seq}`,
      ...extra,
    }
  }
  const insertChannel = async (siteId: string, handle: string, extra: Record<string, unknown> = {}) =>
    sb.from('youtube_channels').insert(channel(siteId, handle, extra)).select('id, slug, niche, locale').single()

  describe('nichos', () => {
    it('um site recém-criado nasce com viagem e ia, e só eles, com as cores do Observatório', async () => {
      const { data, error } = await sb.from('youtube_niches')
        .select('slug, label, color_dark, color_light').eq('site_id', siteA).order('sort_order')
      expect(error).toBeNull()
      expect(data).toEqual(FACTORY)
    })

    it('aceita um nicho do dono com cada uma das quatro cores da paleta', async () => {
      for (const [i, [dark, light]] of PALETTE.entries()) {
        const { error } = await sb.from('youtube_niches')
          .insert({ site_id: siteB, slug: `paleta-${i}`, label: `Paleta ${i}`, color_dark: dark, color_light: light })
        expect(error).toBeNull()
      }
    })

    it('a cor se repete a partir do quinto nicho (sem unicidade de cor)', async () => {
      const { error } = await sb.from('youtube_niches')
        .insert({ site_id: siteB, slug: 'paleta-4', label: 'Paleta 4', color_dark: PALETTE[0][0], color_light: PALETTE[0][1] })
      expect(error).toBeNull()
    })

    it('recusa cor fora da paleta, par trocado e cor de fábrica em nicho do dono', async () => {
      const tries = [
        { color_dark: '#A78BFA', color_light: '#6D28D9' }, // violeta = Cowork
        { color_dark: PALETTE[0][0], color_light: PALETTE[1][1] }, // escuro de uma, claro de outra
        { color_dark: '#5BBF8A', color_light: '#11692F' }, // a de Viagem
      ]
      for (const [i, c] of tries.entries()) {
        const { error } = await sb.from('youtube_niches').insert({ site_id: siteB, slug: `cor-ruim-${i}`, label: `Cor ruim ${i}`, ...c })
        expect(error?.message).toMatch(/check/i)
      }
    })

    it('recusa slug reservado ou mal formado e rótulo repetido com outra caixa', async () => {
      const [dark, light] = PALETTE[0]
      const base = { site_id: siteB, color_dark: dark, color_light: light }
      for (const slug of ['todos', 'Não Vale', 'a', '-jogos', 'jogos-']) {
        const { error } = await sb.from('youtube_niches').insert({ ...base, slug, label: `R ${slug}` })
        expect(error?.message, slug).toMatch(/check/i)
      }
      expect((await sb.from('youtube_niches').insert({ ...base, slug: 'rotulo-a', label: 'Mesmo Nome' })).error).toBeNull()
      const dup = await sb.from('youtube_niches').insert({ ...base, slug: 'rotulo-b', label: 'mesmo nome' })
      expect(dup.error?.message).toMatch(/duplicate|unique/i)
    })

    it('quem não é do site não lê nem escreve nichos (RLS)', async () => {
      const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
      const read = await anon.from('youtube_niches').select('slug').eq('site_id', siteA)
      expect(read.data ?? []).toEqual([])
      const write = await anon.from('youtube_niches')
        .insert({ site_id: siteA, slug: 'intruso', label: 'Intruso', color_dark: PALETTE[0][0], color_light: PALETTE[0][1] })
      expect(write.error).not.toBeNull()
      const after = await sb.from('youtube_niches').select('slug').eq('site_id', siteA).eq('slug', 'intruso')
      expect(after.data).toEqual([])
    })
  })

  describe('chave estrangeira de nicho', () => {
    const jogos = () => ({ site_id: siteA, slug: 'jogos', label: 'Jogos', color_dark: PALETTE[0][0], color_light: PALETTE[0][1] })

    it('nicho inexistente é recusado nas quatro colunas; null continua sendo "sem nicho"', async () => {
      const ch = await insertChannel(siteA, '@sem-nicho-ainda', { niche: 'jogos' })
      expect(ch.error?.message).toMatch(/foreign key/i)
      const comp = await sb.from('competitor_channels').insert({ site_id: siteA, channel_id: `UCcomp${run}x`, niche: 'jogos' })
      expect(comp.error?.message).toMatch(/foreign key/i)
      const task = await sb.from('youtube_intelligence_tasks')
        .insert({ site_id: siteA, task_type: 'temas', target_niche: 'nao-existe', trigger_type: 'manual', status: 'completed' })
      expect(task.error?.message).toMatch(/foreign key/i)
      const reading = await sb.from('competitor_readings')
        .insert({ site_id: siteA, task_type: 'temas', niche: 'jogos', model: 'm', generated_at: new Date().toISOString(), sent: {}, text: {} })
      expect(reading.error?.message).toMatch(/foreign key/i)

      const semNicho = await insertChannel(siteA, '@sem-nicho', { niche: null })
      expect(semNicho.error).toBeNull()
      expect(semNicho.data!.niche).toBeNull()
    })

    it('o nicho de um site não vale em outro', async () => {
      expect((await sb.from('youtube_niches').insert({ ...jogos(), site_id: siteB })).error).toBeNull()
      const ch = await insertChannel(siteA, '@jogos-de-outro-site', { niche: 'jogos' })
      expect(ch.error?.message).toMatch(/foreign key/i)
    })

    it('depois de criado, o nicho é aceito nas quatro colunas, e por mais de um canal', async () => {
      expect((await sb.from('youtube_niches').insert(jogos())).error).toBeNull()
      const a = await insertChannel(siteA, '@jogos-um', { niche: 'jogos' })
      const b = await insertChannel(siteA, '@jogos-cortes', { niche: 'jogos' })
      expect(a.error).toBeNull()
      expect(b.error).toBeNull()
      const comp = await sb.from('competitor_channels').insert({ site_id: siteA, channel_id: `UCcomp${run}j`, niche: 'jogos' })
      expect(comp.error).toBeNull()
      const task = await sb.from('youtube_intelligence_tasks')
        .insert({ site_id: siteA, task_type: 'temas', target_niche: 'jogos', trigger_type: 'manual', status: 'completed' })
      expect(task.error).toBeNull()
      const reading = await sb.from('competitor_readings')
        .insert({ site_id: siteA, task_type: 'temas', niche: 'jogos', model: 'm', generated_at: new Date().toISOString(), sent: {}, text: {} })
      expect(reading.error).toBeNull()
    })

    it('um nicho em uso não pode ser apagado', async () => {
      const { error } = await sb.from('youtube_niches').delete().eq('site_id', siteA).eq('slug', 'jogos')
      expect(error?.message).toMatch(/foreign key/i)
    })

    it('o que o código atual grava continua valendo: viagem, ia e null', async () => {
      const ch = await insertChannel(siteA, '@codigo-atual', { niche: 'viagem' })
      expect(ch.error).toBeNull()
      for (const niche of ['ia', null, 'viagem']) {
        expect((await sb.from('youtube_channels').update({ niche }).eq('id', ch.data!.id)).error).toBeNull()
      }
      const comp = await sb.from('competitor_channels').insert({ site_id: siteA, channel_id: `UCcomp${run}v`, niche: 'ia' })
      expect(comp.error).toBeNull()
      const task = await sb.from('youtube_intelligence_tasks')
        .insert({ site_id: siteA, task_type: 'padroes-titulo', target_niche: 'ia', trigger_type: 'manual', status: 'completed' })
      expect(task.error).toBeNull()
    })

    it('a tarefa continua exigindo nicho fora do diagnóstico', async () => {
      const { error } = await sb.from('youtube_intelligence_tasks')
        .insert({ site_id: siteA, task_type: 'temas', trigger_type: 'manual', status: 'completed' })
      expect(error?.message).toMatch(/check/i)
    })

    it('a preferência do usuário aceita todos e qualquer slug bem formado, mesmo sem o nicho existir', async () => {
      const user = await insertAuthUser(`mc-prefs-${run}@example.test`)
      await sb.from('competitor_user_prefs').delete().eq('user_id', user).eq('site_id', siteA)
      for (const niche of ['todos', 'viagem', 'nicho-que-nao-existe']) {
        const { error } = await sb.from('competitor_user_prefs').upsert({ user_id: user, site_id: siteA, niche })
        expect(error, niche).toBeNull()
      }
      const bad = await sb.from('competitor_user_prefs').upsert({ user_id: user, site_id: siteA, niche: 'Não Vale' })
      expect(bad.error?.message).toMatch(/check/i)
      const saved = await sb.from('competitor_user_prefs').select('niche').eq('user_id', user).eq('site_id', siteA).single()
      expect(saved.data!.niche).toBe('nicho-que-nao-existe')
      await deleteAuthUser(user)
    })
  })

  describe('slug do canal', () => {
    it.each([
      ['@tnFigueiredo', 'tnfigueiredo'],
      ['@Thiago-Figueiredo', 'thiago-figueiredo'],
      ['Viagem.BR', 'viagem-br'],
      ['Canal Ação & Cia', 'canal-acao-cia'],
      ['__@Pão_de_Queijo!!__', 'pao-de-queijo'],
      ['@Um-Handle.Muito_Comprido-Que-Passa-De-Trinta-E-Dois', 'um-handle-muito-comprido-que'],
      ['', 'canal'],
      ['   ', 'canal'],
      ['@@@', 'canal'],
      ['a', 'canal'],
    ])('normaliza %j em %j', async (handle, expected) => {
      const { data, error } = await sb.rpc('youtube_channel_slug_base', { p_handle: handle })
      expect(error).toBeNull()
      expect(data).toBe(expected)
    })

    it('insert no formato do código antigo (sem slug) recebe o slug do handle', async () => {
      const { data, error } = await insertChannel(siteB, '@Canal.Novo')
      expect(error).toBeNull()
      expect(data!.slug).toBe('canal-novo')
    })

    it('dois canais com o mesmo handle no mesmo site: o segundo ganha -2, o terceiro -3', async () => {
      const a = await insertChannel(siteB, '@Mesmo_Handle')
      const b = await insertChannel(siteB, '@mesmo.handle')
      const c = await insertChannel(siteB, 'MESMO HANDLE')
      expect([a.error, b.error, c.error]).toEqual([null, null, null])
      expect([a.data!.slug, b.data!.slug, c.data!.slug]).toEqual(['mesmo-handle', 'mesmo-handle-2', 'mesmo-handle-3'])
    })

    it('handles vazios no mesmo site e num único insert de várias linhas não colidem', async () => {
      const { data, error } = await sb.from('youtube_channels')
        .insert([channel(siteB, ''), channel(siteB, '@@'), channel(siteB, '  ')]).select('slug')
      expect(error).toBeNull()
      expect(data!.map((r) => r.slug).sort()).toEqual(['canal', 'canal-2', 'canal-3'])
    })

    it('o mesmo slug em sites diferentes passa; no mesmo site, slug informado repetido é recusado', async () => {
      const a = await insertChannel(siteA, '@entre-sites', { slug: 'compartilhado' })
      const b = await insertChannel(siteB, '@entre-sites', { slug: 'compartilhado' })
      expect([a.error, b.error]).toEqual([null, null])
      expect(a.data!.slug).toBe('compartilhado')
      const dup = await insertChannel(siteA, '@outro', { slug: 'compartilhado' })
      expect(dup.error?.message).toMatch(/duplicate|unique/i)
    })

    it('slug informado mal formado é recusado, na criação e na edição', async () => {
      const bad = await insertChannel(siteA, '@ok', { slug: 'Não Vale' })
      expect(bad.error?.message).toMatch(/check/i)
      const ok = await insertChannel(siteA, '@para-editar')
      expect(ok.error).toBeNull()
      const upd = await sb.from('youtube_channels').update({ slug: '' }).eq('id', ok.data!.id)
      expect(upd.error?.message).toMatch(/check/i)
    })

    it('trocar o handle depois não muda o slug', async () => {
      const ch = await insertChannel(siteA, '@handle-original')
      await sb.from('youtube_channels').update({ handle: '@handle-novo' }).eq('id', ch.data!.id)
      const { data } = await sb.from('youtube_channels').select('slug').eq('id', ch.data!.id).single()
      expect(data!.slug).toBe('handle-original')
    })

    it('a função que escolhe o slug livre não é chamável por anon', async () => {
      const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
      const { error } = await anon.rpc('youtube_channel_slug_pick', { p_site_id: siteA, p_handle: '@x' })
      expect(error).not.toBeNull()
    })
  })

  describe('idioma e canal duplicado', () => {
    it('dois canais do mesmo idioma no mesmo site são aceitos', async () => {
      const a = await insertChannel(siteA, '@idioma-um', { locale: 'en' })
      const b = await insertChannel(siteA, '@idioma-dois', { locale: 'en' })
      expect([a.error, b.error]).toEqual([null, null])
    })

    it('idioma fora de pt/en continua recusado', async () => {
      const { error } = await insertChannel(siteA, '@idioma-es', { locale: 'es' })
      expect(error?.message).toMatch(/check/i)
    })

    it('o mesmo canal do YouTube duas vezes no site continua recusado', async () => {
      const row = channel(siteA, '@repetido')
      expect((await sb.from('youtube_channels').insert(row)).error).toBeNull()
      const again = await sb.from('youtube_channels').insert({ ...row, locale: 'en', handle: '@repetido-en' })
      expect(again.error?.message).toMatch(/duplicate|unique/i)
    })
  })

  it('apagar o site leva junto os nichos e quem os usa', async () => {
    const tmp = (await seedSite(sb)).siteId
    const [dark, light] = PALETTE[2]
    await sb.from('youtube_niches').insert({ site_id: tmp, slug: 'culinaria', label: 'Culinária', color_dark: dark, color_light: light })
    expect((await sb.from('competitor_channels').insert({ site_id: tmp, channel_id: `UCtmp${run}`, niche: 'culinaria' })).error).toBeNull()
    expect((await sb.from('sites').delete().eq('id', tmp)).error).toBeNull()
    const left = await sb.from('youtube_niches').select('slug').eq('site_id', tmp)
    expect(left.data).toEqual([])
  })
})

describe('migration multi_canal_nichos_slug (arquivo)', () => {
  const dir = join(__dirname, '../../../../supabase/migrations')
  const file = readdirSync(dir).find((n) => n.endsWith('_multi_canal_nichos_slug.sql'))
  const sql = file ? readFileSync(join(dir, file), 'utf8') : ''
  const at = (needle: string) => {
    const i = sql.indexOf(needle)
    expect(i, needle).toBeGreaterThan(-1)
    return i
  }

  it('existe, e vem depois das migrations imutáveis do Observatório', () => {
    expect(file).toBeDefined()
    expect(file! > '20261003000005').toBe(true)
  })

  it('a ordem é: semear nichos, registrar órfãos, trocar CHECK por FK, preencher slug, exigir slug, derrubar a UNIQUE de locale', () => {
    const order = [
      at('create table if not exists youtube_niches'),
      at("from sites s cross join (values ('viagem'"),
      at('with usados as'),
      at('add constraint youtube_channels_niche_fkey'),
      at('add column if not exists slug text'),
      at('update youtube_channels set slug = public.youtube_channel_slug_pick'),
      at('alter column slug set not null'),
      at('create unique index if not exists youtube_channels_site_slug_key'),
      at('drop constraint if exists youtube_channels_site_id_locale_key'),
    ]
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('o backfill só toca canal sem slug (rodar de novo não reescreve) e não fixa os slugs de produção', () => {
    expect(sql).toMatch(/where slug is null or btrim\(slug\) = ''\s+order by site_id, created_at, id/)
    expect(sql.match(/update youtube_channels/g)).toHaveLength(1)
    expect(sql).not.toMatch(/'tnfigueiredo'|'thiago-figueiredo'/)
    expect(sql).not.toMatch(/set slug = locale/)
  })

  it('todo CHECK, FK, policy e trigger é derrubado com if exists antes de ser criado', () => {
    for (const m of sql.matchAll(/add constraint (\w+)/g)) {
      const name = m[1]!
      const drop = sql.indexOf(`drop constraint if exists ${name}`)
      expect(drop, name).toBeGreaterThan(-1)
      expect(drop, name).toBeLessThan(m.index!)
    }
    for (const m of sql.matchAll(/create (policy|trigger) "?(\w+)"?/g)) {
      const drop = sql.search(new RegExp(`drop ${m[1]} if exists "?${m[2]}"?`))
      expect(drop, m[2]).toBeGreaterThan(-1)
      expect(drop, m[2]).toBeLessThan(m.index!)
    }
    for (const old of ['youtube_channels_niche_check', 'competitor_channels_niche_check', 'competitor_readings_niche_check',
      'youtube_intelligence_tasks_target_check', 'competitor_user_prefs_niche_check']) {
      expect(sql).toContain(`drop constraint if exists ${old}`)
    }
  })

  it('não cria canal principal nem unicidade por nicho', () => {
    expect(sql).not.toMatch(/is_primary/)
    expect(sql).not.toMatch(/unique[^;]*\(site_id, niche\)/i)
  })
})

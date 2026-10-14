// @vitest-environment node
// O comando de criar a chave do perfil (degrau 2, Tarefa 15): núcleo com cliente injetado, só insere.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { criarChaveDoPerfil, lerArgumentos, type DepsDeCriar, type PedidoDeChave } from '@/lib/youtube/observatorio/acesso-ia/criar-chave'
import { e19ConferidaParaChave } from '@/lib/youtube/observatorio/acesso-ia/interruptor'
import { conferenciaDeVencimento } from '@/lib/youtube/observatorio/acesso-ia/vencimento'
import { ACESSO_IA_RULES } from '@/lib/youtube/observatorio/acesso-ia/regras'

const DIA = 86_400_000
/** Sempre 15:00 UTC do dia de hoje: datas relativas, nunca ano fixo (o guardião de higiene reprova). */
const AGORA = Math.floor(Date.now() / DIA) * DIA + 15 * 3_600_000
const ymd = (ms: number): string => new Date(ms - 3 * 3_600_000).toISOString().slice(0, 10)
const HOJE = ymd(AGORA).replace(/-/g, '')
const ANT = ymd(AGORA - 60 * DIA).replace(/-/g, '')
const ANTES = ymd(AGORA - 9 * DIA)
const MUITO_ANTES = ymd(AGORA - 70 * DIA)
const SITE_A = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10'
const SITE_B = '4a2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a11'
const ANA = '9a1b2c3d-0000-4000-8000-00000000aaaa'
const BIA = '9a1b2c3d-0000-4000-8000-00000000bbbb'
const CAI = '9a1b2c3d-0000-4000-8000-00000000cccc'
const EMAIL = 'ana@example.test'
const PERFIL = 'observatorio_leitura'

interface Chave { name?: string; site_id: string; user_id: string | null; expires_at: string | null; permissions: string[]; revoked_at: string | null }
const chave = (o: Partial<Chave> = {}): Chave => ({ name: `observatorio-${MUITO_ANTES.replace(/-/g, '')}-abcd`, site_id: SITE_A, user_id: ANA, expires_at: new Date(AGORA + 100 * DIA).toISOString(), permissions: [PERFIL], revoked_at: null, ...o })

interface Cenario {
  usuarios: Array<{ id: string; email: string }>
  /** quem vê quais sites */
  ve: Record<string, string[]>
  sites: string[]
  chaves: Chave[]
  paginaComErro: number | null
  rpcErro: boolean
  insertErro: boolean
  tamanhoDaPagina: number
}
function fazer(c: Partial<Cenario> = {}) {
  const cen: Cenario = { usuarios: [{ id: ANA, email: EMAIL }], ve: { [ANA]: [SITE_A] }, sites: [SITE_A], chaves: [], paginaComErro: null, rpcErro: false, insertErro: false, tamanhoDaPagina: 1000, ...c }
  const inserts: Array<Record<string, unknown>> = []
  const paginas: number[] = []
  const sb = {
    auth: { admin: { listUsers: async ({ page, perPage }: { page: number; perPage: number }) => {
      paginas.push(page)
      if (cen.paginaComErro === page) return { data: { users: [] }, error: { code: 'x', message: 'falhou' } }
      const todos = cen.usuarios
      return { data: { users: todos.slice((page - 1) * perPage, page * perPage) }, error: null }
    } } },
    rpc: async (nome: string, a: { p_user: string; p_site: string }) => {
      if (nome !== 'can_view_site_as') throw new Error(`rpc inesperado: ${nome}`)
      if (cen.rpcErro) return { data: null, error: { code: 'XX000' } }
      return { data: (cen.ve[a.p_user] ?? []).includes(a.p_site), error: null }
    },
    from: (tabela: string) => ({
      select: async () => ({ data: tabela === 'sites' ? cen.sites.map((id) => ({ id })) : cen.chaves, error: null }),
      insert: async (linha: Record<string, unknown>) => {
        if (tabela !== 'pipeline_api_keys') throw new Error('tabela inesperada')
        if (cen.insertErro) return { error: { code: '23505' } }
        inserts.push(linha)
        return { error: null }
      },
    }),
  }
  let n = 0
  const deps: DepsDeCriar = {
    sb: sb as never,
    agora: () => AGORA,
    e19: () => ({ ok: true }),
    excecaoEm: ANTES,
    aleatorio: (k) => Buffer.alloc(k, ++n === 1 ? 0xab : 0x01 * n),
  }
  return { cen, deps, inserts, paginas }
}
const pedido = (o: Partial<PedidoDeChave> = {}): PedidoDeChave => ({ email: EMAIL, ...o })

afterEach(() => { vi.restoreAllMocks() })

describe('criarChaveDoPerfil: o caminho feliz', () => {
  it('um insert, com permissions exatamente [observatorio_leitura], user_id, expires_at de 180 dias, created_by nulo e o nome sem dado pessoal; o hash gravado é o SHA-256 da chave devolvida', async () => {
    const { deps, inserts } = fazer()
    const r = await criarChaveDoPerfil(deps, pedido())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(inserts).toHaveLength(1)
    const l = inserts[0]!
    expect(l.permissions).toEqual([PERFIL])
    expect(l.user_id).toBe(ANA)
    expect(l.site_id).toBe(SITE_A)
    expect(l.created_by).toBeNull()
    expect(l.expires_at).toBe(new Date(AGORA + 180 * DIA).toISOString())
    expect(l.name).toMatch(new RegExp(`^observatorio-${HOJE}-[0-9a-f]{4}$`))
    expect(r.nome).toBe(l.name)
    expect(r.chave.startsWith('obs_')).toBe(true)
    expect(r.chave.length).toBe(4 + 43)
    expect(l.key_hash).toBe(createHash('sha256').update(r.chave).digest('hex'))
    expect(JSON.stringify(l)).not.toContain(r.chave)
    expect(JSON.stringify(l)).not.toContain('ana')
    expect(r.venceEm).toBe(l.expires_at)
    expect(r.siteId).toBe(SITE_A)
  })
  it('o nome de toda chave criada passa em conferenciaDeVencimento (não devolve null)', async () => {
    const { deps } = fazer()
    const r = await criarChaveDoPerfil(deps, pedido())
    if (!r.ok) throw new Error('esperava ok')
    expect(conferenciaDeVencimento(r.nome, r.venceEm)).not.toBeNull()
  })
  it('dois pedidos no mesmo dia geram nomes diferentes (o sufixo vem do aleatório)', async () => {
    const a = fazer(); const b = fazer()
    b.deps.aleatorio = (k) => Buffer.alloc(k, 0x77)
    const ra = await criarChaveDoPerfil(a.deps, pedido()); const rb = await criarChaveDoPerfil(b.deps, pedido())
    if (!ra.ok || !rb.ok) throw new Error('esperava ok')
    expect(ra.nome).not.toBe(rb.nome)
  })
  it('e-mail com maiúsculas e espaços acha a pessoa; --dias 1 e 366 são aceitos', async () => {
    const { deps } = fazer()
    expect((await criarChaveDoPerfil(deps, pedido({ email: '  ANA@Example.TEST ', dias: 1 }))).ok).toBe(true)
    expect((await criarChaveDoPerfil(fazer().deps, pedido({ dias: 366 }))).ok).toBe(true)
  })
})

describe('criarChaveDoPerfil: as recusas (cada uma com zero inserts)', () => {
  async function recusa(c: ReturnType<typeof fazer>, p: PedidoDeChave = pedido()) {
    const r = await criarChaveDoPerfil(c.deps, p)
    expect(c.inserts, JSON.stringify(r)).toHaveLength(0)
    return r.ok ? 'ok' : r.recusa
  }
  it('com o e19ConferidaParaChave REAL e a variável APAGADA: se a E19 não está conferida, recusa "travas"; senão a recusa, se houver, não é "travas"', async () => {
    delete process.env.OBSERVATORIO_IA_EXTERNA
    const c = fazer()
    c.deps.e19 = e19ConferidaParaChave
    const r = await criarChaveDoPerfil(c.deps, pedido())
    expect.assertions(2)
    if (!e19ConferidaParaChave().ok) {
      expect(r).toEqual({ ok: false, recusa: 'travas' })
      expect(c.inserts).toHaveLength(0)
    } else {
      expect(r.ok || r.recusa !== 'travas').toBe(true)
      expect(true).toBe(true)
    }
  })
  it('e19 simulada aceita, variável APAGADA, exceção preenchida: cria (a variável não entra na decisão)', async () => {
    delete process.env.OBSERVATORIO_IA_EXTERNA
    const c = fazer()
    expect((await criarChaveDoPerfil(c.deps, pedido())).ok).toBe(true)
  })
  it('e19 simulada em aviso, variável "on": recusa travas', async () => {
    vi.stubEnv('OBSERVATORIO_IA_EXTERNA', 'on')
    const c = fazer(); c.deps.e19 = () => ({ ok: false, motivo: 'e19_em_aviso' })
    expect(await recusa(c)).toBe('travas')
    vi.unstubAllEnvs()
  })
  it('e19 aceita e excecaoEm nula (ou vazia): excecao_ausente', async () => {
    const c = fazer(); c.deps.excecaoEm = null
    expect(await recusa(c)).toBe('excecao_ausente')
    const d = fazer(); d.deps.excecaoEm = ''
    expect(await recusa(d)).toBe('excecao_ausente')
  })
  it('e-mail que não existe, vazio ou em branco: email_ausente', async () => {
    expect(await recusa(fazer(), pedido({ email: 'ninguem@example.test' }))).toBe('email_ausente')
    expect(await recusa(fazer(), pedido({ email: '   ' }))).toBe('email_ausente')
  })
  it('dois usuários com o mesmo e-mail na listagem: email_ambiguo', async () => {
    const c = fazer({ usuarios: [{ id: ANA, email: EMAIL }, { id: BIA, email: EMAIL.toUpperCase() }] })
    expect(await recusa(c)).toBe('email_ambiguo')
  })
  it('a listagem vem em três páginas e a pessoa está na terceira: acha', async () => {
    const muitos = Array.from({ length: 2500 }, (_, i) => ({ id: `u-${i}`, email: `u${i}@example.test` }))
    muitos[2300] = { id: ANA, email: EMAIL }
    const c = fazer({ usuarios: muitos })
    const r = await criarChaveDoPerfil(c.deps, pedido())
    expect(r.ok).toBe(true)
    expect(c.paginas).toEqual([1, 2, 3])
  })
  it('uma página do meio dá erro: nao_conferido, não adivinha com as que leu', async () => {
    const muitos = Array.from({ length: 2500 }, (_, i) => ({ id: `u-${i}`, email: `u${i}@example.test` }))
    muitos[10] = { id: ANA, email: EMAIL }
    expect(await recusa(fazer({ usuarios: muitos, paginaComErro: 2 }))).toBe('nao_conferido')
  })
  it('a listagem não termina em 20 páginas: nao_conferido', async () => {
    const muitos = Array.from({ length: 20_000 }, (_, i) => ({ id: `u-${i}`, email: `u${i}@example.test` }))
    muitos[5] = { id: ANA, email: EMAIL }
    const c = fazer({ usuarios: muitos })
    expect(await recusa(c)).toBe('nao_conferido')
    expect(c.paginas).toHaveLength(20)
  })
  it('página vazia lida sem erro encerra a listagem (lista vazia lida não é falta de leitura)', async () => {
    expect(await recusa(fazer({ usuarios: [] }))).toBe('email_ausente')
  })
  it('a pessoa não vê o site; --site de outro site que ela não vê; --site que não é uuid', async () => {
    expect(await recusa(fazer({ ve: { [ANA]: [] } }))).toBe('sem_acesso_ao_site')
    expect(await recusa(fazer({ sites: [SITE_A, SITE_B] }), pedido({ siteId: SITE_B }))).toBe('sem_acesso_ao_site')
    expect(await recusa(fazer(), pedido({ siteId: 'site-1' }))).toBe('sem_acesso_ao_site')
  })
  it('a pessoa vê dois sites e --site não veio: site_ambiguo; com --site: cria naquele', async () => {
    const mk = () => fazer({ sites: [SITE_A, SITE_B], ve: { [ANA]: [SITE_A, SITE_B] } })
    expect(await recusa(mk())).toBe('site_ambiguo')
    const c = mk()
    const r = await criarChaveDoPerfil(c.deps, pedido({ siteId: SITE_B }))
    expect(r.ok && r.siteId).toBe(SITE_B)
  })
  it('can_view_site_as dá erro: nao_conferido', async () => {
    expect(await recusa(fazer({ rpcErro: true }))).toBe('nao_conferido')
  })
  it('o nome gerado já existe numa chave ativa, ou REVOGADA: nome_repetido', async () => {
    const c = fazer()
    // o aleatório injetado repete: primeiro valor 0xab 0xab -> abab
    const nome = `observatorio-${HOJE}-abab`
    c.cen.chaves.push(chave({ name: nome, site_id: SITE_B }))
    expect(await recusa(c)).toBe('nome_repetido')
    const d = fazer()
    d.cen.chaves.push(chave({ name: nome, revoked_at: new Date(AGORA - 70 * DIA).toISOString(), permissions: ['read'] }))
    expect(await recusa(d)).toBe('nome_repetido')
  })
  it('validade: dias 0, 367, 1,5, negativo, NaN: validade_invalida', async () => {
    for (const dias of [0, 367, 1.5, -3, Number.NaN]) expect(await recusa(fazer(), pedido({ dias })), String(dias)).toBe('validade_invalida')
  })
  it('a pessoa já tem chave do perfil ativa que vence em 15 dias: ja_tem_chave; em 14 dias: cria a segunda (renovação, fronteira)', async () => {
    const a = fazer(); a.cen.chaves.push(chave({ expires_at: new Date(AGORA + 15 * DIA).toISOString() }))
    expect(await recusa(a)).toBe('ja_tem_chave')
    const b = fazer(); b.cen.chaves.push(chave({ expires_at: new Date(AGORA + 14 * DIA).toISOString() }))
    expect((await criarChaveDoPerfil(b.deps, pedido())).ok).toBe(true)
  })
  it('a pessoa tem uma chave VENCIDA e não revogada: cria; vencendo exatamente agora conta como vencida', async () => {
    for (const exp of [AGORA - DIA, AGORA]) {
      const c = fazer(); c.cen.chaves.push(chave({ expires_at: new Date(exp).toISOString() }))
      expect((await criarChaveDoPerfil(c.deps, pedido())).ok, String(exp)).toBe(true)
    }
  })
  it('chave vencida não é ativa: duas outras pessoas ativas e a pessoa só com chave vencida (não é "renovando"): teto_de_chaves', async () => {
    const c = fazer()
    c.cen.chaves.push(chave({ expires_at: new Date(AGORA - DIA).toISOString() }), chave({ user_id: BIA, name: `observatorio-${ANT}-0001` }), chave({ user_id: CAI, name: `observatorio-${ANT}-0002` }))
    expect(await recusa(c)).toBe('teto_de_chaves')
  })
  it('a pessoa já tem duas ativas (renovou e a antiga ainda não venceu): ja_tem_chave', async () => {
    const c = fazer()
    c.cen.chaves.push(chave({ name: `observatorio-${ANT}-0001`, expires_at: new Date(AGORA + 5 * DIA).toISOString() }), chave({ name: `observatorio-${ANT}-0002` }))
    expect(await recusa(c)).toBe('ja_tem_chave')
  })
  it('o filtro de site: a mesma pessoa com chave ativa em outro site pode criar neste', async () => {
    const c = fazer(); c.cen.chaves.push(chave({ site_id: SITE_B, expires_at: new Date(AGORA + 100 * DIA).toISOString() }))
    expect((await criarChaveDoPerfil(c.deps, pedido())).ok).toBe(true)
  })
  it('chave revogada da pessoa não conta como ativa', async () => {
    const c = fazer(); c.cen.chaves.push(chave({ revoked_at: new Date(AGORA - 40 * DIA).toISOString() }))
    expect((await criarChaveDoPerfil(c.deps, pedido())).ok).toBe(true)
  })
  it('chave de outro perfil (read, intelligence, read+write+admin) não conta como ativa do perfil', async () => {
    const c = fazer(); c.cen.chaves.push(chave({ permissions: ['read'] }), chave({ permissions: ['intelligence'] }), chave({ permissions: ['read', 'write', 'admin'] }))
    expect((await criarChaveDoPerfil(c.deps, pedido())).ok).toBe(true)
  })
  it('já existem duas PESSOAS com chave ativa e chega a terceira: teto_de_chaves', async () => {
    const c = fazer({ ve: { [ANA]: [SITE_A], [BIA]: [SITE_A], [CAI]: [SITE_A] }, usuarios: [{ id: ANA, email: EMAIL }] })
    c.cen.chaves.push(chave({ user_id: BIA, name: `observatorio-${ANT}-0001` }), chave({ user_id: CAI, name: `observatorio-${ANT}-0002` }))
    expect(await recusa(c)).toBe('teto_de_chaves')
  })
  it('duas pessoas, uma delas renovando (três linhas ativas, duas pessoas): a renovação da segunda é aceita', async () => {
    const c = fazer()
    c.cen.chaves.push(
      chave({ user_id: ANA, expires_at: new Date(AGORA + 10 * DIA).toISOString(), name: `observatorio-${ANT}-0001` }),
      chave({ user_id: BIA, name: `observatorio-${ANT}-0002` }),
    )
    expect((await criarChaveDoPerfil(c.deps, pedido())).ok).toBe(true)
  })
  it('chave ativa com user_id NULO (pessoa apagada, chave não revogada) não conta no teto', async () => {
    const c = fazer()
    c.cen.chaves.push(chave({ user_id: BIA, name: `observatorio-${ANT}-0001` }), chave({ user_id: null, name: `observatorio-${ANT}-0002` }))
    expect((await criarChaveDoPerfil(c.deps, pedido())).ok).toBe(true)
  })
  it('duas pessoas com chave ativa mais uma linha de user_id nulo, e chega a terceira pessoa: teto_de_chaves', async () => {
    const c = fazer()
    c.cen.chaves.push(chave({ user_id: BIA, name: `observatorio-${ANT}-0001` }), chave({ user_id: CAI, name: `observatorio-${ANT}-0002` }), chave({ user_id: null, name: `observatorio-${ANT}-0003` }))
    expect(await recusa(c)).toBe('teto_de_chaves')
  })
  it('o insert falha: ok false e NENHUMA chave no retorno', async () => {
    const c = fazer({ insertErro: true })
    const r = await criarChaveDoPerfil(c.deps, pedido())
    expect(r.ok).toBe(false)
    expect(JSON.stringify(r)).not.toContain('obs_')
    expect(r).toEqual({ ok: false, recusa: 'nao_conferido', code: '23505' })
  })
})

describe('a casca: os argumentos', () => {
  it('os subcomandos aceitos são exatamente ["criar"]; revogar, alterar, apagar e vazio: subcomando', () => {
    expect(lerArgumentos(['criar', '--usuario', EMAIL]).ok).toBe(true)
    for (const s of ['revogar', 'alterar', 'apagar', 'listar', '']) expect(lerArgumentos([s, '--usuario', EMAIL]), s).toEqual({ ok: false, recusa: 'subcomando' })
    expect(lerArgumentos([])).toEqual({ ok: false, recusa: 'subcomando' })
  })
  it('--nome, --permissao, --revogar ou qualquer opção fora de --usuario, --dias e --site: opcao_desconhecida', () => {
    for (const o of ['--nome', '--permissao', '--revogar', '--apagar', '--created-by', '--x'])
      expect(lerArgumentos(['criar', '--usuario', EMAIL, o, 'v']), o).toEqual({ ok: false, recusa: 'opcao_desconhecida' })
    expect(lerArgumentos(['criar', 'ana@example.test'])).toEqual({ ok: false, recusa: 'opcao_desconhecida' })
    expect(lerArgumentos(['criar', '--usuario'])).toEqual({ ok: false, recusa: 'opcao_desconhecida' })
    expect(lerArgumentos(['criar', '--usuario', EMAIL, '--usuario', EMAIL])).toEqual({ ok: false, recusa: 'opcao_desconhecida' })
  })
  it('sem --usuario: email_ausente; --dias que não é inteiro: validade_invalida; completo vira o pedido', () => {
    expect(lerArgumentos(['criar'])).toEqual({ ok: false, recusa: 'email_ausente' })
    expect(lerArgumentos(['criar', '--usuario', EMAIL, '--dias', '1.5'])).toEqual({ ok: false, recusa: 'validade_invalida' })
    expect(lerArgumentos(['criar', '--usuario', EMAIL, '--dias', 'abc'])).toEqual({ ok: false, recusa: 'validade_invalida' })
    expect(lerArgumentos(['criar', '--usuario', EMAIL, '--dias', '30', '--site', SITE_A])).toEqual({ ok: true, pedido: { email: EMAIL, dias: 30, siteId: SITE_A } })
  })
})

describe('estrutura: o comando só insere, e o preparo não abre nada', () => {
  const RAIZ = join(__dirname, '../../..')
  const fontes = {
    nucleo: readFileSync(join(RAIZ, 'src/lib/youtube/observatorio/acesso-ia/criar-chave.ts'), 'utf8'),
    casca: readFileSync(join(RAIZ, 'scripts/observatorio-acesso.ts'), 'utf8'),
  }
  /** Tira comentários de linha e de bloco. */
  const codigo = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
  for (const [nome, texto] of Object.entries(fontes)) {
    it(`${nome}: não contém .update(, .delete(, .upsert( nem rpc de escrita`, () => {
      const c = codigo(texto)
      // `createHash(...).update(` é o hash da chave, não o banco
      expect(c.replace(/createHash\([^)]*\)\.update\(/g, '')).not.toMatch(/\.(update|delete|upsert)\s*\(/)
      for (const m of c.matchAll(/\.rpc\s*\(\s*['"]([a-z_]+)['"]/g)) expect(['can_view_site_as'], m[1]).toContain(m[1])
    })
    it(`${nome}: revoked_at só aparece como LEITURA de campo, nunca como atribuição (a leitura é o que decide "ativa")`, () => {
      const c = codigo(texto)
      for (const m of c.matchAll(/revoked_at/g)) {
        const antes = c.slice(Math.max(0, m.index! - 2), m.index!)
        const depois = c.slice(m.index! + 10, m.index! + 22)
        expect(antes.endsWith('.') || antes.endsWith("'") || antes.endsWith(' '), 'precedido de ponto, aspas ou espaço').toBe(true)
        expect(/^\s*(=[^=]|:\s*[^\s])/.test(depois) && !/^\s*:\s*(string|unknown)/.test(depois), `atribuição: ${depois}`).toBe(false)
      }
      expect(c).not.toMatch(/revoked_at\s*:\s*(new|now|Date|['"`])/)
    })
  }
  it('a casca não tem opção --permissao, --revogar nem --apagar, e só chama criarChaveDoPerfil', () => {
    const c = codigo(fontes.casca)
    expect(c).not.toMatch(/--permissao|--revogar|--apagar/)
    expect(c).toMatch(/criarChaveDoPerfil\(/)
  })
  it('hoje (excecaoDaPergunta47Em nula): a chave "observatorio:acesso" não existe nos scripts da raiz nem de apps/web, e o CLAUDE.md não traz a frase de exceção', () => {
    expect(ACESSO_IA_RULES.excecaoDaPergunta47Em).toBeNull()
    const raiz = JSON.parse(readFileSync(join(RAIZ, '../../package.json'), 'utf8')) as { scripts: Record<string, string> }
    const web = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
    expect(raiz.scripts['observatorio:acesso']).toBeUndefined()
    expect(web.scripts['observatorio:acesso']).toBeUndefined()
    expect(readFileSync(join(RAIZ, '../../CLAUDE.md'), 'utf8')).not.toContain('observatorio:acesso')
  })
  it('com a data preenchida, as duas coisas têm de existir (varredura sobre um package.json e um CLAUDE.md de fixture)', () => {
    const exige = (excecaoEm: string | null, pkg: { scripts: Record<string, string> }, claude: string): boolean => {
      const tem = pkg.scripts['observatorio:acesso'] !== undefined && claude.includes('observatorio:acesso')
      const nao = pkg.scripts['observatorio:acesso'] === undefined && !claude.includes('observatorio:acesso')
      return excecaoEm === null ? nao : tem
    }
    expect(exige(null, { scripts: {} }, 'sem a frase')).toBe(true)
    expect(exige(null, { scripts: { 'observatorio:acesso': 'x' } }, 'sem a frase')).toBe(false)
    expect(exige(ANTES, { scripts: { 'observatorio:acesso': 'x' } }, 'npm run observatorio:acesso')).toBe(true)
    expect(exige(ANTES, { scripts: {} }, 'npm run observatorio:acesso')).toBe(false)
    expect(exige(ANTES, { scripts: { 'observatorio:acesso': 'x' } }, 'sem a frase')).toBe(false)
  })
})

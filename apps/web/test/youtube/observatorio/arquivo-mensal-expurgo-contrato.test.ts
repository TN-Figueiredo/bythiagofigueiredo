// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  CorpoAbrir, CorpoBloquear, CorpoCanal, CorpoExpurgo, CorpoRegistrar, RespostaAbrir, RespostaBloquear, RespostaCanal, RespostaRegistrar,
} from '@/lib/youtube/observatorio/arquivo-mensal/expurgo-contrato'

const U = '6f1c1b9e-0000-4000-8000-000000000001'
const H = 'a'.repeat(64)
const unidade = { row_count: 3, control_sum: '27', hash_conteudo: H, schema_fp: H, sha256_bytes: H, csv_sha256: H, file_bytes: 120, partes: 1, min_key: null, max_key: null, parts: [] }
const vazia = { ...unidade, row_count: 0, control_sum: '0', sha256_bytes: null, csv_sha256: null, file_bytes: 0 }
const resumo = { versao: 3, vazio: false, canal_sha256: H, canal_bytes: 10, canal_rows: 1, video_sha256: H, video_bytes: 10, video_rows: 1, tabelas_lidas: ['competitor_video_daily'] }
const registrar = (alvos: unknown[]) => ({ passo: 'registrar', item_id: 'item:12', classe: 'serie', canal: U, mes: '2026-09', alvos, resumo })

describe('contrato C14 do expurgo', () => {
  it('corpos: um exemplo por passo passa; campo a mais falha (.strict)', () => {
    expect(CorpoAbrir.parse({ passo: 'abrir', item_id: 'item:12' })).toBeTruthy()
    expect(CorpoCanal.parse({ passo: 'canal', channel_ref: U })).toBeTruthy()
    expect(CorpoBloquear.parse({ passo: 'bloquear', item_id: `canal:${U}`, alvo_id: 4, motivo: 'contagem_divergente' })).toBeTruthy()
    expect(CorpoRegistrar.parse(registrar([{ alvo_id: 4, removidas: 2, unidade }]))).toBeTruthy()
    expect(CorpoExpurgo.parse({ passo: 'abrir', item_id: 'antiga:11111111-1111-4111-8111-111111111115' })).toBeTruthy()
    expect(() => CorpoAbrir.parse({ passo: 'abrir', item_id: 'item:12', extra: 1 })).toThrow()
    expect(() => CorpoRegistrar.parse({ ...registrar([]), extra: 1 })).toThrow()
    expect(() => CorpoAbrir.parse({ passo: 'abrir', item_id: 'item:x' })).toThrow()
  })
  it('unidade esvaziada: row_count 0 com shas nulos passa; coerência exigida', () => {
    expect(CorpoRegistrar.parse(registrar([{ alvo_id: 4, removidas: 3, unidade: vazia }]))).toBeTruthy()
    expect(() => CorpoRegistrar.parse(registrar([{ alvo_id: 4, removidas: 3, unidade: { ...vazia, sha256_bytes: H, csv_sha256: H } }]))).toThrow()
    expect(() => CorpoRegistrar.parse(registrar([{ alvo_id: 4, removidas: 3, unidade: { ...unidade, sha256_bytes: null, csv_sha256: null } }]))).toThrow()
    expect(() => CorpoRegistrar.parse(registrar([{ alvo_id: 4, removidas: 3, unidade: { ...unidade, csv_sha256: null } }]))).toThrow()
  })
  it('removidas e unidade andam juntos', () => {
    expect(CorpoRegistrar.parse(registrar([{ alvo_id: 4, removidas: 0, unidade: null }]))).toBeTruthy()
    expect(() => CorpoRegistrar.parse(registrar([{ alvo_id: 4, removidas: 3, unidade: null }]))).toThrow()
    expect(() => CorpoRegistrar.parse(registrar([{ alvo_id: 4, removidas: 0, unidade }]))).toThrow()
  })
  it('resposta de registrar copiada do SQL: arquivo_id texto u:/s:', () => {
    const ok = { status: 'ok', alvos: [{ alvo_id: 1, estado: 'aguardando_nova', arquivo_id: `u:${U}`, versao: 2 }, { alvo_id: 2, estado: 'sem_linhas' }], resumo: { arquivo_id: `s:${U}`, versao: 3 } }
    expect(RespostaRegistrar.parse(ok)).toBeTruthy()
    expect(RespostaRegistrar.parse({ ...ok, resumo: null })).toBeTruthy()
    expect(() => RespostaRegistrar.parse({ ...ok, alvos: [{ alvo_id: 1, estado: 'aguardando_nova', arquivo_id: 7, versao: 2 }] })).toThrow()
    expect(() => RespostaRegistrar.parse({ ...ok, resumo: { arquivo_id: 7, versao: 3 } })).toThrow()
    expect(() => RespostaRegistrar.parse({ ...ok, resumo: { arquivo_id: `x:${U}`, versao: 3 } })).toThrow()
  })
  it('recusa é um ramo próprio, distinto de corpo malformado', () => {
    expect(RespostaRegistrar.parse({ status: 'recusado', motivo: 'contagem_divergente', alvo_id: 4 })).toMatchObject({ status: 'recusado' })
    expect(RespostaRegistrar.parse({ status: 'recusado', motivo: 'base_mudou' })).toMatchObject({ motivo: 'base_mudou' })
    expect(() => RespostaRegistrar.parse({ status: 'recusado' })).toThrow()
    expect(RespostaBloquear.parse({ status: 'ok' })).toBeTruthy()
    expect(RespostaBloquear.parse({ status: 'recusado', motivo: 'alvo_fora_de_copiar' })).toBeTruthy()
    expect(() => RespostaBloquear.parse({ status: 'recusado', motivo: 'alvo_inexistente' })).toThrow()   // lista fechada (Yannis P3)
  })
  it('resposta de abrir: resumo é {versao, canal sha|null, video sha|null}', () => {
    const grupo = (r: unknown) => ({ grupos: [{ classe: 'serie', canal: U, mes: '2026-09', filho: 'numerico', alvos: [], outras: [], vazias: [], resumo: r, mes_online: false, dias_do_mes: 30 }], esperando: 0 })
    expect(RespostaAbrir.parse(grupo({ versao: 2, canal: H, video: null }))).toBeTruthy()
    expect(RespostaAbrir.parse(grupo(null))).toBeTruthy()
    expect(() => RespostaAbrir.parse(grupo({ versao: 2, canal: [{}], video: null }))).toThrow()
    expect(() => RespostaAbrir.parse(grupo({ versao: 2, canal: 'curto', video: null }))).toThrow()
  })
  it('resposta do canal', () => {
    expect(RespostaCanal.parse({ motivo: 'ok', prefixos: [{ filho: 'texto', prefixo: `texto/canais/${U}/` }] })).toBeTruthy()
    expect(() => RespostaCanal.parse({ motivo: 'talvez', prefixos: [] })).toThrow()
  })
})

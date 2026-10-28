// Prova da T19 (M7b envio 2): três testes de título descartáveis, em um vídeo próprio não listado.
// SÓ roda contra produção quando o controlador mandar. Uso (a partir da raiz do repo):
//   (cd apps/web && node --env-file=.env.local ../../node_modules/.bin/vite-node --config vitest.config.ts --options.deps.inline=@tn-figueiredo/auth-nextjs ../../scripts/ab-prova-m7b.mts criar --video <youtubeVideoId>)
//   (cd apps/web && node --env-file=.env.local ../../node_modules/.bin/vite-node --config vitest.config.ts --options.deps.inline=@tn-figueiredo/auth-nextjs ../../scripts/ab-prova-m7b.mts contar)
//   (cd apps/web && node --env-file=.env.local ../../node_modules/.bin/vite-node --config vitest.config.ts --options.deps.inline=@tn-figueiredo/auth-nextjs ../../scripts/ab-prova-m7b.mts vigia <testId>)
//   (cd apps/web && node --env-file=.env.local ../../node_modules/.bin/vite-node --config vitest.config.ts --options.deps.inline=@tn-figueiredo/auth-nextjs ../../scripts/ab-prova-m7b.mts limpar)
//   (cd apps/web && node --env-file=.env.local ../../node_modules/.bin/vite-node --config vitest.config.ts --options.deps.inline=@tn-figueiredo/auth-nextjs ../../scripts/ab-prova-m7b.mts registrar --video <youtubeVideoId>)  (antes de criar, para vídeo não listado)
//   (sem subcomando: imprime a ajuda e confere só que os módulos carregam; não toca banco nem rede)
// Roda pelo vite-node com a config do vitest: o alias `@/` e os pacotes só-ESM (@tn-figueiredo/social) não carregam pelo tsx em CJS.
// Nunca imprime escolha_por; não cria nem revoga chave.
const PREFIXO = '[prova M7b]'
const NOMES = [`${PREFIXO} descartável 1`, `${PREFIXO} descartável 2`, `${PREFIXO} descartável 3`] as const
const TITULOS = [
  ['[prova M7b] título B1', '[prova M7b] título C1'],
  ['[prova M7b] título B2', '[prova M7b] título C2'],
  ['[prova M7b] título B3', '[prova M7b] título C3'],
] as const

function sair(msg: string, code = 1): never {
  console.error(msg)
  process.exit(code)
}

async function main(): Promise<void> {
  const [cmd, ...resto] = process.argv.slice(2)
  const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
  const { startAbTestInternal } = await import('@/lib/youtube/ab-start')
  const { settleOnAir, ORIGINAL } = await import('@/lib/youtube/ab-settle')
  const { applyVariantToYouTube } = await import('@/lib/youtube/ab-apply')
  const { captureOriginalMetadata } = await import('@/lib/youtube/ab-metadata')
  const { ensureFreshToken } = await import('@/lib/social/token-refresh')
  const { channelAccountIdForVideo } = await import('@/lib/youtube/channel-account')
  const { AB_TEST_CONFIG_DEFAULTS } = await import('@/lib/youtube/ab-types')

  if (cmd !== 'registrar' && cmd !== 'criar' && cmd !== 'contar' && cmd !== 'vigia' && cmd !== 'limpar') {
    console.log('subcomandos: registrar --video <youtubeVideoId> | criar --video <youtubeVideoId> | contar | vigia <testId> | limpar')
    return
  }

  const sb = getSupabaseServiceClient()

  async function testesDaProva() {
    const { data, error } = await sb
      .from('ab_tests')
      .select('id, name, status, site_id, youtube_video_id, original_title, winner_variant_id, completed_reason, escolha_variant_id, escolha_em, restore_seq, restore_status, created_at')
      .like('name', `${PREFIXO}%`)
      .order('name')
    if (error) sair(`falha lendo testes da prova: ${error.message}`)
    return (data ?? []) as Array<{
      id: string; name: string; status: string; site_id: string; youtube_video_id: string; original_title: string | null
      winner_variant_id: string | null; completed_reason: string | null; escolha_variant_id: string | null
      escolha_em: string | null; restore_seq: number; restore_status: unknown; created_at: string
    }>
  }

  // ---------------------------------------------------------------- registrar
  // O sync lê a playlist de uploads com a chave pública e nunca vê vídeo não listado; por id ele aparece.
  // Grava a linha como o syncChannel grava (sem categoria), só se o vídeo for do canal próprio.
  if (cmd === 'registrar') {
    const i = resto.indexOf('--video')
    const ytId = i >= 0 ? resto[i + 1] : undefined
    if (!ytId) sair('informe --video <youtubeVideoId>')
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) sair('YOUTUBE_API_KEY ausente')
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${encodeURIComponent(ytId)}&key=${apiKey}`)
    const j = (await r.json()) as { items?: Array<{ snippet: { channelId: string }; status: { privacyStatus: string } }> }
    const item = j.items?.[0]
    if (!item) sair('vídeo não encontrado no YouTube')
    if (item.status.privacyStatus !== 'unlisted') sair(`vídeo não é não listado (${item.status.privacyStatus}); recusado`)
    const { data: canal } = await sb.from('youtube_channels').select('id, site_id').eq('channel_id', item.snippet.channelId).maybeSingle()
    if (!canal) sair('o vídeo não é de um canal próprio; recusado')
    const { fetchVideoDetails } = await import('@/lib/youtube/api-client')
    const [v] = await fetchVideoDetails([ytId], apiKey)
    if (!v) sair('detalhes do vídeo indisponíveis')
    const { error } = await sb.from('youtube_videos').upsert({
      site_id: canal.site_id, channel_id: canal.id, youtube_video_id: v.youtubeVideoId, title: v.title, description: v.description,
      duration: v.duration, duration_seconds: v.durationSeconds, published_at: v.publishedAt, thumbnail_url: v.thumbnailUrl,
      thumbnail_hq_url: v.thumbnailHqUrl, tags: v.tags, view_count: v.viewCount, like_count: v.likeCount, comment_count: v.commentCount,
    }, { onConflict: 'site_id,youtube_video_id' })
    if (error) sair(`falha gravando o vídeo: ${error.message}`)
    console.log(`registrado: ${ytId} "${v.title}" (canal ${canal.id})`)
    return
  }

  // ---------------------------------------------------------------- criar
  if (cmd === 'criar') {
    const i = resto.indexOf('--video')
    const ytId = i >= 0 ? resto[i + 1] : undefined
    if (!ytId) sair('informe --video <youtubeVideoId>')

    // Guarda: só vídeo do canal próprio (youtube_videos pertence a youtube_channels do site; concorrentes ficam em outras tabelas).
    const { data: video, error: ve } = await sb
      .from('youtube_videos')
      .select('id, site_id, youtube_video_id, title, thumbnail_hq_url, duration_seconds, channel_id')
      .eq('youtube_video_id', ytId)
      .maybeSingle()
    if (ve) sair(`falha lendo o vídeo: ${ve.message}`)
    if (!video) sair('vídeo não é do canal próprio (não está em youtube_videos); recusado')
    const { data: canal } = await sb.from('youtube_channels').select('id').eq('id', video.channel_id).eq('site_id', video.site_id).maybeSingle()
    if (!canal) sair('o canal do vídeo não é um canal próprio deste site; recusado')

    const existentes = (await testesDaProva()).filter((t) => t.status !== 'archived')
    if (existentes.length > 0) sair(`já há ${existentes.length} teste(s) "${PREFIXO}" não arquivado(s); rode "limpar" antes`)

    const siteId = video.site_id as string
    const channelAccountId = await channelAccountIdForVideo(sb as never, siteId, video.id as string)
    if (!channelAccountId) sair('canal do vídeo sem conta conectada')
    const { accessToken } = await ensureFreshToken(siteId, 'youtube', channelAccountId)
    const meta = await captureOriginalMetadata(ytId, accessToken)
    if (!meta) sair('não consegui ler o título atual do vídeo no YouTube')
    const tituloOriginal = meta.title

    const ids: string[] = []
    for (let n = 0; n < 3; n++) {
      // Um teste aberto por vídeo: cada descartável nasce, roda o ciclo 0 e encerra antes do seguinte.
      const nome = NOMES[n]!
      const config = { ...AB_TEST_CONFIG_DEFAULTS, teto_explicito: false }
      const { data: teste, error: te } = await sb
        .from('ab_tests')
        .insert({
          site_id: siteId, youtube_video_id: video.id, name: nome, status: 'draft', regra_duracao: 'v2', config,
          original_thumbnail_url: video.thumbnail_hq_url ?? null, test_type: 'title', original_title: tituloOriginal,
        })
        .select('id')
        .single()
      if (te || !teste) sair(`falha criando o teste ${n + 1}: ${te?.message ?? 'sem linha'}`)
      const testId = teste.id as string
      ids.push(testId)

      const linhas = [
        { test_id: testId, label: 'original', is_original: true, blob_url: video.thumbnail_hq_url ?? null, title_text: null, sort_order: 0 },
        { test_id: testId, label: 'B', is_original: false, title_text: TITULOS[n]![0], metadata: {}, sort_order: 1 },
        { test_id: testId, label: 'C', is_original: false, title_text: TITULOS[n]![1], metadata: {}, sort_order: 2 },
      ]
      const { data: vars, error: vi } = await sb.from('ab_test_variants').insert(linhas).select('id, label, is_original')
      if (vi || !vars) {
        await sb.from('ab_tests').delete().eq('id', testId)
        sair(`falha criando as variantes do teste ${n + 1}: ${vi?.message ?? 'sem linha'}`)
      }
      const porLabel = new Map((vars as Array<{ id: string; label: string }>).map((v) => [v.label, v.id]))
      const idOriginal = porLabel.get('original')!
      const idB = porLabel.get('B')!

      const ini = await startAbTestInternal(testId, siteId)
      if (!ini.ok) sair(`início do teste ${n + 1} recusado: ${ini.error ?? 'sem motivo'} (ids já criados: ${ids.join(', ')})`)

      // Mesma ordem do cron (decisao-v2-step): settle regra_v2 primeiro, depois a gravação do desfecho por RPC.
      const saida = await settleOnAir(testId, { siteId, destino: ORIGINAL, motivo: 'regra_v2' })
      if (saida.resultado !== 'feito') sair(`encerramento do teste ${n + 1} deu "${saida.resultado}" (ids: ${ids.join(', ')})`)

      const desfecho = n === 1 ? 'sem_diferenca_detectavel' : 'vencedor_provavel'
      const sugerida = n === 0 ? idB : n === 1 ? null : idOriginal
      const emDia = new Date().toISOString().slice(0, 10)
      const v2 = {
        desfecho, provisorio: false, desfecho_no_encerramento: desfecho, desfecho_final: desfecho, encerrado_em_dia: emDia,
        vencedor_sugerido: sugerida, tentativa_falhou: null,
      }
      const g = await sb.rpc('ab_test_v2_gravar', { p_test_id: testId, p_v2: v2, p_hist: [{ em: new Date().toISOString(), desfecho }] })
      if (g.error || g.data === -1) sair(`ab_test_v2_gravar falhou no teste ${n + 1}: ${g.error?.message ?? 'RPC -1'} (ids: ${ids.join(', ')})`)
    }
    console.log(`criados: ${ids.join(' ')}`)
    console.log('teste 1: sugerida B | teste 2: sem_diferenca_detectavel | teste 3: sugerida = original')
    return
  }

  // ---------------------------------------------------------------- contar
  if (cmd === 'contar') {
    const testes = await testesDaProva()
    if (testes.length === 0) console.log(`(nenhum teste "${PREFIXO}")`)
    const siteId = testes[0]?.site_id ?? process.env.AB_PROVA_SITE_ID
    if (!siteId) sair('sem teste da prova para descobrir o site; defina AB_PROVA_SITE_ID')
    const { getLearnings } = await import('../apps/web/src/app/cms/(authed)/youtube/ab-lab/queries')
    const { getAbLearnings } = await import('@/lib/pipeline/services/youtube')
    const l = await getLearnings(siteId)
    console.log(`getLearnings.totalTests: ${l === null ? 'null (menos de 3 ou erro)' : l.totalTests}`)
    const a = await getAbLearnings({ supabase: sb as never, siteId, permissions: ['read'] })
    console.log(`getAbLearnings.totalCompletedTests: ${a.data.totalCompletedTests}`)
    for (const t of testes) {
      console.log(JSON.stringify({
        id: t.id, name: t.name, status: t.status, completed_reason: t.completed_reason,
        winner_variant_id: t.winner_variant_id, escolha_variant_id: t.escolha_variant_id, escolha_em: t.escolha_em, restore_seq: t.restore_seq,
      }))
    }
    return
  }

  // ---------------------------------------------------------------- vigia
  if (cmd === 'vigia') {
    const testId = resto[0]
    if (!testId || !/^[0-9a-f-]{36}$/i.test(testId)) sair('informe <testId> (uuid)')
    const { data: t } = await sb.from('ab_tests').select('id, name, youtube_video_id').eq('id', testId).maybeSingle()
    if (!t || !String(t.name).startsWith(PREFIXO)) sair('o teste não é um descartável da prova')
    console.log('-- rodar antes e depois de duas execuções do vigia (esperado: nenhuma seq nova; iniciativa=dono em escolher/aplicar_sugerido)')
    console.log(`select seq, campo, estado, escreveu, motivo, iniciativa, em from ab_test_restores where test_id = '${testId}' order by seq;`)
    console.log("select ab_event, count(*) from yt_own_video_versions where origin='ab_lab' group by 1;")
    console.log(`-- do vídeo da prova: select ab_event, ab_test_id, ab_variant_id, value_text, first_seen_at from yt_own_video_versions where origin='ab_lab' and ab_test_id = '${testId}' order by first_seen_at;`)
    return
  }

  // ---------------------------------------------------------------- limpar
  const testes = await testesDaProva()
  if (testes.length === 0) {
    console.log(`(nenhum teste "${PREFIXO}")`)
    return
  }
  const primeiro = testes[0]!
  const { data: video } = await sb.from('youtube_videos').select('id, youtube_video_id, channel_id, site_id').eq('id', primeiro.youtube_video_id).maybeSingle()
  if (!video) sair('vídeo do teste não achado em youtube_videos; recusado')
  const original = testes.map((t) => t.original_title).find((x): x is string => !!x)
  if (!original) sair('nenhum original_title guardado; não sei qual título devolver')

  // Arquivar primeiro (sai do aprendizado); depois devolver o título pelo caminho de escrita do Lab.
  const aberto = testes.filter((t) => t.status !== 'archived').map((t) => t.id)
  if (aberto.length > 0) {
    const { error } = await sb.from('ab_tests').update({ status: 'archived' }).in('id', aberto)
    if (error) sair(`falha arquivando: ${error.message}`)
  }
  const channelAccountId = await channelAccountIdForVideo(sb as never, video.site_id as string, video.id as string)
  if (!channelAccountId) sair('canal sem conta conectada; arquivados, mas o título NÃO foi devolvido')
  const { accessToken } = await ensureFreshToken(video.site_id as string, 'youtube', channelAccountId)
  const atual = await captureOriginalMetadata(video.youtube_video_id as string, accessToken)
  if (atual && atual.title === original) {
    console.log('título já é o original; nada a escrever')
  } else {
    const r = await applyVariantToYouTube({
      youtubeVideoId: video.youtube_video_id as string, accessToken, testType: 'title', variant: { title_text: original }, originalTitle: original,
    })
    if (!r.ok) sair(`título NÃO devolvido: ${r.error ?? 'erro'}`)
    console.log('título original devolvido ao vídeo')
  }
  const final = await testesDaProva()
  console.log(`arquivados: ${final.filter((t) => t.status === 'archived').length}/${final.length}`)
  console.log('rode "contar" para a contagem final (deve voltar a X menos 2)')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})

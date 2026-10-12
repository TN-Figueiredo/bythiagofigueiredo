/** Sections of dados-teste.html not yet ported. Each P2/P4 task deletes the sections it ports. Task 32 emptied it. */
export const PENDING_SECTIONS = new Set<string>([])
/** Sections ported and enforced verbatim. A port task moves its section from PENDING_SECTIONS to here. */
export const PORTED_SECTIONS = new Set<string>(['nada depois de NOW', 'calendário', 'série diária', 'trocas: precisão', 'efeito', 'outliers', 'contagens das abas', 'exemplos do BRIEF', 'n possíveis pela cadência', 'limites e sincronização', 'catálogos',
  'vídeo-vitrine', 'forja', 'texto das leituras (singular/plural e status cru)', 'rodada final (reviews/final/*-F1.md, MOTOR)', 'rodada F2 (reviews/f2/*.md, MOTOR)',
  'rodada F3 (reviews/f3/*.md, MOTOR)', 'rodada F4 (CONVENCOES "RODADA F4", reviews/f4)', 'rodada F5 (reviews/f5/fixes.md, MOTOR)'])
/** Permanently out of the production port, with the reason. */
export const NOT_PORTED = new Map<string, string>([
  ['determinismo', 'tests the mockup PRNG generator (O._build); production data is not generated'],
])
/** Single tests that need a browser sessionStorage (mockup-only persistence; production state lives in the DB). The oracle fails these under node. */
export const BROWSER_ONLY_TESTS = new Set<string>([
  '[F8] runSync persiste em sessionStorage["obs-sync"] e é reaplicado na carga; resetSync limpa; seu canal intocado',
  '[F9] forja.session: estado único de pedidos — setBase, ask (só nichos livres, ordem dos cliques), cancel, current(nicho|todos), reset, persistência',
])
/** Single tests out of the production port, with the reason: browser storage, or the mockup's generator/simulation. */
export const NOT_PORTED_TESTS = new Map<string, string>([
  ...[...BROWSER_ONLY_TESTS].map(n => [n, 'browser sessionStorage (mockup-only persistence; production state lives in the DB)'] as [string, string]),
  ['[novo] channel.handle e channel.url: https://www.youtube.com/@<handle>, únicos, sem acento nem espaço, estáveis',
    'generator: handles/urls are invented by the mockup and checked stable across O._build(); production handles come from YouTube'],
  ['[F2] forja.byId já tem as leituras de cenário de 24/10 (sem chamar requestScenario antes)',
    'generator: rebuilds the mockup (O._build); the same load-time registration is checked on a fresh test facade in forja-since.test.ts'],
  ['[F2] thumb.text dos vídeos gerados = palavra-chave do título (preço, número + substantivo ou nome), até 2 palavras, sem "HOW"/"QUE"/"NINGUÉM"',
    'generator: v.thumb.text is the mockup\'s drawn thumbnail art; production thumbnails are real images'],
  ['[F3] thumb.text sem número + adjetivo ("5 LEGAL"); número de nome de modelo fica com o nome ("GROK 5")',
    'generator: v.thumb.text is the mockup\'s drawn thumbnail art; production thumbnails are real images'],
  ['[F6] runSync(): canais ok viram "agora"; erro/atrasado/buscando mantêm o estado e voltam como problema; resetSync restaura',
    'mockup simulation: runSync/resetSync mutate the in-memory channels in place of a real sync (dados.js:1962 "sincronização simulada do mockup"); production runs the sync job and re-reads the DB; the text is runSyncText (ported)'],
  ['[F7] runSync não mexe no seu canal (sincroniza pelo Painel): fora de ok e da contagem do texto',
    'mockup simulation: runSync/resetSync mutate the in-memory channels in place of a real sync; production runs the sync job and re-reads the DB; the text is runSyncText (ported)'],
  ['Vitrine: troca de título MEDIDA (≥ 7 d depois, antes ≥ 3 d) e outra aguardando',
    'R115: matt-opus55/title/1 has matt-opus55/thumb/1 two days later, so production gives inconclusivo (troca-seguinte); the rule is asserted in effect-neighbours.test.ts and the deviation in effect-parity.test.ts'],
  ['[F5] M-d: "antes" do efeito exclui o trecho de < 24 h da estreia (no observado e no esperado); vitrine segue medida com 3 dias antes',
    'R115: the showcase change matt-opus55/title/1 is inconclusivo (troca-seguinte) in production; the other two checks of this test (every before-bin ≥ 24 h, matt-fast-cheap/title/1 is sem-antes, 3 before-days on the showcase) are re-asserted in effect-neighbours.test.ts'],
  ['[F8] effect.inconclusiveKind: janela-dupla, versao-curta, antes-curto ou outro (só em inconclusivo)',
    'R115: production has a fifth kind, troca-seguinte; the closed list is enforced by the INC_TEXT record in _mudancas/view-model.ts and by mudancas-view-model.test.ts'],
  ['[final] quota.releasesAt: 00:00 do dia seguinte quando a cota foi usada; nula em falha e recusa',
    '11d: the daily quota is gone (owner decision 11/10): scenarios have no `quota` field; a new request needs new data (forja/novidade.ts, asserted in forja-novidade.test.ts)'],
  ['[F8] forja.compose: pedido novo compõe sobre o cenário (substitui o do mesmo nicho, mantém os outros)',
    '11d: the mockup test reads `quota.usedToday` of the composed scenario; the composition itself (replaces its niche, keeps the others) is asserted in forja-states.test.ts and forja-parity.test.ts'],
  ['[F9] falhou/recusado com outro pedido ativo: o texto diz quem segue e quando pedir de novo (nunca "Peça de novo" solto)',
    '11d: the status text lost the quota clause (\'não conta na cota; você pode pedir de novo...\' became \'não gerou leitura.\'); the rest of the sentence is compared with the oracle in forja-parity.test.ts (semCota) and the new sentence in forja-states.test.ts'],
  ['[F10] quota.byNiche em requestScenario/compose/session; com Todos, quota.text por nicho ("IA: cota livre (recusa não conta) · Viagem: cota usada pelo pedido das 14:50")',
    '11d: quota.byNiche and quota.text per niche no longer exist (no daily quota); the per-niche decision is forja.novidade, asserted in forja-novidade.test.ts and forja-novidade-tela.test.ts'],
  ['[F11] session.current(nicho) em falhou/recusado leva o motivo completo do próprio pedido',
    '11d: the failure sentence lost \'Falha não conta na cota.\'; the rest is compared with the oracle in forja-parity.test.ts (semCota) and the new sentence in forja-states.test.ts'],
])

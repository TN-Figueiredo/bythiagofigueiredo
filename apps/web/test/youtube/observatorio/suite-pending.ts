/** Sections of dados-teste.html not yet ported. Each P2/P4 task deletes the sections it ports. */
export const PENDING_SECTIONS = new Set<string>([
  'vídeo-vitrine', 'forja',
  'texto das leituras (singular/plural e status cru)', 'rodada final (reviews/final/*-F1.md, MOTOR)', 'rodada F2 (reviews/f2/*.md, MOTOR)',
  'rodada F3 (reviews/f3/*.md, MOTOR)', 'rodada F4 (CONVENCOES "RODADA F4", reviews/f4)', 'rodada F5 (reviews/f5/fixes.md, MOTOR)',
])
/** Sections ported and enforced verbatim. A port task moves its section from PENDING_SECTIONS to here. */
export const PORTED_SECTIONS = new Set<string>(['nada depois de NOW', 'calendário', 'série diária', 'trocas: precisão', 'efeito', 'outliers', 'contagens das abas', 'exemplos do BRIEF', 'n possíveis pela cadência', 'limites e sincronização', 'catálogos'])
/** Permanently out of the production port, with the reason. */
export const NOT_PORTED = new Map<string, string>([
  ['determinismo', 'tests the mockup PRNG generator (O._build); production data is not generated'],
])
/** Single tests that need a browser sessionStorage (mockup-only persistence; production state lives in the DB). */
export const NOT_PORTED_TESTS = new Set<string>([
  '[F8] runSync persiste em sessionStorage["obs-sync"] e é reaplicado na carga; resetSync limpa; seu canal intocado',
  '[F9] forja.session: estado único de pedidos — setBase, ask (só nichos livres, ordem dos cliques), cancel, current(nicho|todos), reset, persistência',
])

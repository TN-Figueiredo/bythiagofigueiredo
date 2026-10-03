/* =====================================================================================
   dados.js — FONTE CANÔNICA de dados do mockup do Observatório de Competidores.
   Todas as telas (canais, mudancas, outliers, insights, historico-video, moldura-forja)
   leem window.OBS. Nenhuma tela digita n, multiplicador, contagem, efeito ou data.

   Modelo de tempo: todo instante é epoch real (ms). Horários exibidos em America/Sao_Paulo
   (UTC−3 fixo; o Brasil não tem horário de verão desde 2019).
   Hoje = sábado 24/10/2026 15:02 (SP).
   Série diária de views por vídeo: 1 ponto às 12:00 (SP) por dia, de 03/10 (índice 0) a
   24/10 (índice 21). O ponto de 24/10 12:00 é o "parcial de hoje": o dia 24→25 fecha em 25/10 12h.
   Sincronização: diária às 09:00 até 02/10; a cada 6 h (00/06/12/18) desde 03/10.
   Thumbnails arquivadas (com minuto, pela mudança do arquivo da imagem) desde 03/10.
   Determinístico: PRNG mulberry32 com seeds fixas por canal/vídeo.
   ===================================================================================== */
(function (root) {
'use strict';

function build() {
/* ------------------------------------------------------------------ tempo */
const H = 36e5, DAY = 864e5, SP_OFF = 3 * H;
const sp = (y, mo, d, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h, mi) + SP_OFF;
const spIso = s => { const a = s.split(/[-T:]/).map(Number); return sp(a[0], a[1], a[2], a[3] || 0, a[4] || 0); };
const NOW = sp(2026, 10, 24, 15, 2);
const SERIES_START = sp(2026, 10, 3, 0, 0);         // coleta por vídeo + arquivo de thumbnails + sync 6 h
const OBS_START = sp(2026, 5, 31, 9, 0);             // observatório desde 31/05 (sync diário 09:00)
const SNAP0 = sp(2026, 10, 3, 12, 0);
const LAST_IDX = 21;
const SNAP = i => SNAP0 + i * DAY;
const snapIdxAtOrAfter = t => Math.ceil((t - SNAP0) / DAY - 1e-9);
const snapIdxAtOrBefore = t => Math.floor((t - SNAP0) / DAY + 1e-9);
const parts = ms => { const d = new Date(ms - SP_OFF); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), dow: d.getUTCDay() }; };
const p2 = n => (n < 10 ? '0' : '') + n;
const WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const WDS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MINUS = '−';

const date = {
  sp, spIso, parts,
  dm: ms => { const p = parts(ms); return p2(p.d) + '/' + p2(p.mo); },
  dmy: ms => { const p = parts(ms); return p2(p.d) + '/' + p2(p.mo) + '/' + p.y; },
  dmOrDmy: ms => { const p = parts(ms); return p2(p.d) + '/' + p2(p.mo) + (p.y !== 2026 ? '/' + p.y : ''); },
  hm: ms => { const p = parts(ms); return p2(p.h) + ':' + p2(p.mi); },
  hh: ms => p2(parts(ms).h) + 'h',
  dmhm: ms => date.dm(ms) + ' ' + date.hm(ms),
  weekday: ms => WD[parts(ms).dow],
  weekdayShort: ms => WDS[parts(ms).dow],
  /** "há 6 h", "há 3 dias", "há 12 min" — relativo a NOW */
  ago: ms => {
    const d = NOW - ms;
    if (d < 0) return 'no futuro';
    if (d < 6e4) return 'agora';
    if (d < H) return 'há ' + Math.max(1, Math.round(d / 6e4)) + ' min';
    if (d < 48 * H) return 'há ' + Math.round(d / H) + ' h';   // abaixo de 48 h, sempre em horas
    const n = Math.round(d / DAY); return 'há ' + n + (n === 1 ? ' dia' : ' dias');
  },
  agoHours: ms => 'há ' + Math.round((NOW - ms) / H) + ' h',
  daysAgo: ms => Math.floor((NOW - ms) / DAY),
  /** janela de sincronização: "entre 24/10 06h e 12h" / "entre 21/10 18h e 22/10 00h" / "entre 15/08 09h e 16/08 09h" */
  windowText: (a, b) => {
    const pa = parts(a), pb = parts(b);
    const same = pa.d === pb.d && pa.mo === pb.mo;
    return 'entre ' + date.dm(a) + ' ' + p2(pa.h) + 'h e ' + (same ? '' : date.dm(b) + ' ') + p2(pb.h) + 'h';
  },
  /** duração aproximada "≈ 4 d", "10 h 35 min" */
  dur: (ms, approx) => {
    if (approx) { const d = Math.round(ms / DAY); return d >= 1 ? '≈ ' + d + ' d' : '≈ ' + Math.round(ms / H) + ' h'; }
    const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / H), mi = Math.round((ms % H) / 6e4);
    return d ? d + ' d ' + h + ' h' : h ? h + ' h ' + mi + ' min' : mi + ' min';
  },
  snapTime: SNAP, snapIdxAtOrAfter, snapIdxAtOrBefore,
  isSaturday24: () => parts(NOW).dow === 6,
};

/* ------------------------------------------------------------------ números pt-BR */
const dec1t = x => { const r = Math.round(x * 10) / 10; return (r % 1 === 0 ? String(r) : r.toFixed(1)).replace('.', ',').replace('-', MINUS); };
const dec1 = x => (Math.round(x * 10) / 10).toFixed(1).replace('.', ',').replace('-', MINUS);
const fmt = {
  /** 1,5 mil · 207,6 mil · 382 mil · 1,9 mi · 7,4 mi */
  num: v => { if (v == null) return '—'; const a = Math.abs(v), s = v < 0 ? MINUS : ''; if (a < 1000) return s + Math.round(a); if (a < 1e6) return s + dec1t(a / 1e3) + ' mil'; return s + dec1t(a / 1e6) + ' mi'; },
  /** inscritos com 3 algarismos significativos, como o YouTube: "3,21 mil", "4,51 mi", "128 mil", "96,4 mil" */
  subs: v => { if (v == null) return '—'; if (v < 1000) return String(Math.round(v)); const big = v >= 1e6, x = big ? v / 1e6 : v / 1e3, d = Math.max(0, 2 - Math.floor(Math.log10(x)));
    let t = x.toPrecision(3); t = Number(t).toFixed(d).replace(/\.?0+$/, ''); return t.replace('.', ',') + (big ? ' mi' : ' mil'); },
  int: v => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
  mult: x => x == null ? '—' : (Math.round(x * 10) / 10).toFixed(1).replace('.', ',') + '×',
  pct: x => { if (x == null) return '—'; const r = Math.round(x * 100); return (r > 0 ? '+' : r < 0 ? MINUS : '') + Math.abs(r) + '%'; }, // x = fração
  pp: x => { if (x == null) return '—'; const r = Math.round(x); return (r > 0 ? '+' : r < 0 ? MINUS : '') + Math.abs(r) + ' pp'; },
  dec1,
  plural: (n, one, many) => n + ' ' + (n === 1 ? one : many),
  verVideos: n => n === 1 ? 'Ver o vídeo' : 'Ver os ' + n + ' vídeos',
  /** idade do vídeo pelos dias inteiros (a mesma de ageDays e dos filtros de idade): "há 30 dias", "há 1 dia", "há 5 h" */
  age: x => { const v = typeof x === 'string' ? (typeof V !== 'undefined' ? V[x] : null) : x; if (!v) return '—';
    const d = v.ageDays != null ? v.ageDays : Math.floor((NOW - v.pub) / DAY); if (d >= 1) return 'há ' + d + (d === 1 ? ' dia' : ' dias');
    return 'há ' + Math.max(0, Math.floor((NOW - v.pub) / H)) + ' h'; },
  lcfirst: t => t ? t.charAt(0).toLowerCase() + t.slice(1) : t,
  /** "rótulo — motivo" sem repetir o rótulo e com o motivo em minúscula */
  /** "rótulo — motivo"; se o motivo já começa pelo rótulo (ou é igual), devolve só o motivo; {sentence:true} põe maiúscula no início */
  labelReason: (label, reason, o) => { const r = (reason || '').trim(), low = r.toLowerCase(), l = (label || '').toLowerCase().trim();
    let out;
    if (!r) out = label;
    else if (l && low.startsWith(l + ':')) out = label + ' — ' + r.slice(l.length + 1).trim().replace(/^./, c => c.toLowerCase());   // prefixo = o próprio rótulo
    else if (l && (low === l || low.replace(/[.\s]+$/, '') === l || low.startsWith(l + ' ') || low.startsWith(l + ','))) out = r.charAt(0).toLowerCase() + r.slice(1);
    else if (/ — |: /.test(r)) out = label + '. ' + r.charAt(0).toUpperCase() + r.slice(1);   // o motivo já tem travessão ou dois-pontos: frase separada, nada encadeado
    else out = label + ' — ' + r.charAt(0).toLowerCase() + r.slice(1);
    return o && o.sentence ? out.charAt(0).toUpperCase() + out.slice(1) : out; },
};

/* ------------------------------------------------------------------ estatística + PRNG */
function rng(seed) { let a = 0; for (const ch of String(seed)) a = (Math.imul(a, 31) + ch.charCodeAt(0)) | 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quant = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), p = (s.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return s[lo] + (s[hi] - s[lo]) * (p - lo); };

/* ------------------------------------------------------------------ regras (fonte única) */
const RULES = {
  outlierMin: 2,               // outlier = ≥ 2×
  weakBase: 3,                 // n < 3 = base fraca
  effect: { afterDays: 7, maxBeforeDays: 7, minBeforeDays: 3, minN: 5, pp: 10, simultHours: 48 },
  pattern: { minN: 10, minDiff: 0.3 },
  attribution: { solo: 0.6, second: 0.2 },
  theme: { minCount: 3, minShare: 0.4, trend: { minDelta: 3, minPct: 0.25, text: '▲/▼ só quando a diferença entre os últimos 90 dias e os 90 anteriores é de 3 vídeos ou mais E de 25% ou mais; senão ≈' } },
  habit: { minCount: 3, minShare: 0.3, weeks: 13 },
  tiers: { mid: 2, high: 5, top: 10 },
  testCompareMaxDays: 14,      // A→B→A em ≤ 14 d = compatível com "Testar e comparar" do YouTube
  staleSyncHours: 24,          // canal sem sincronização há > 24 h fica fora de pedidos à forja
  videoLimitMax: 200,
  channelLimit: 75,            // limite de canais CONCORRENTES monitorados; o seu canal não ocupa vaga
};
const AGE_BANDS = [{ id: '0-7', lo: 0, hi: 7, label: '0–7 dias' }, { id: '8-30', lo: 8, hi: 30, label: '8–30 dias' }, { id: '31-90', lo: 31, hi: 90, label: '31–90 dias' }, { id: '91-365', lo: 91, hi: 365, label: '91–365 dias' }, { id: '365+', lo: 366, hi: 1e9, label: 'mais de 365 dias' }];
const bandOf = ageDays => AGE_BANDS.find(b => ageDays >= b.lo && ageDays <= b.hi) || AGE_BANDS[0];
const OUT_WINDOWS = [{ id: '0-30', lo: 0, hi: 30, label: '0–30 d' }, { id: '31-90', lo: 31, hi: 90, label: '31–90 d' }, { id: '91-180', lo: 91, hi: 180, label: '91–180 d' }, { id: '181-365', lo: 181, hi: 365, label: '181–365 d' }, { id: '365+', lo: 366, hi: 1e9, label: 'mais de 1 ano' }];
const winOf = ageDays => OUT_WINDOWS.find(w => ageDays >= w.lo && ageDays <= w.hi);
const DEFAULT_AGES = ['0-30', '31-90'];
const TAB_COUNTS = { todos: { canais: 14, mud: 18, out: 11 }, viagem: { canais: 8, mud: 8, out: 5 }, ia: { canais: 6, mud: 10, out: 6 } };
const NICHES = { viagem: { id: 'viagem', label: 'Viagem', color: { dark: '#5BBF8A', light: '#11692F' } }, ia: { id: 'ia', label: 'IA', color: { dark: '#6EA8FE', light: '#1D4ED8' } } };

/* ------------------------------------------------------------------ catálogo de fórmulas de título (único) */
const PLACES = 'Pakistan|Lahore|Karachi|Peshawar|Hunza|Japan|Tokyo|Osaka|Kyoto|Okinawa|Hokkaido|Arima Onsen|Bangkok|Thailand|Koh Tao|Chiang Mai|Cambodia|Vietnam|Laos|Nepal|Georgia|Tbilisi|Bulgaria|Moldova|Transnistria|Lagos|Nigeria|Dhaka|Bangladesh|North Korea|Mongolia|Peru|Lima|Bolivia|Kazakhstan|Almaty|Uzbekistan|Tashkent|Kyrgyzstan|Afeganistão|Afghanistan|Japão|Tóquio|Quirguistão|Tajiquistão|Pamir|Turcomenistão|Ásia Central|América do Sul|Mongólia|Bolívia|Cusco|Chile|Lisboa|Paris|Marrocos|Índia|Seul|Cazaquistão|Osh|Paquistão|Vietnã|Nepal|Geórgia|Índia';
const FORMULAS = [
  { id: 'preco', label: 'Preço no título', short: 'preço', test: t => /(R\$|US\$|\$|€)\s?\d/.test(t), niches: ['viagem', 'ia'], ex: 'Trying a $2.70 Pakistan\'s version of KFC' },
  { id: 'numero', label: 'Número ou lista', short: 'número', test: t => /(^|\s)\d+\s+(dias|days|hours|horas|things|coisas|apps|tools|ferramentas|ways|lugares|places|countries|países|minutes|minutos|seconds|segundos|AI)\b/i.test(t.replace(/(R\$|US\$|\$)\s?[\d.,]+k?/g, '')), niches: ['viagem', 'ia'], ex: 'I Tested 7 AI Video Tools' },
  { id: 'pergunta', label: 'Pergunta no título', short: 'pergunta', test: t => /\?/.test(t), niches: ['viagem', 'ia'], ex: 'Is Tbilisi Safe Right Now?' },
  { id: 'reacao-hiperbole', label: 'Reação com hipérbole', short: 'reação', test: t => /\b(INSANE|INSANELY|Crazy|Wild|Shocking|Scary|Go This Hard|Dangerous|Unreal|absurd[oa]|insan[oa]|bizarr[oa])\b/i.test(t), niches: ['ia'], ex: 'Claude Opus 5.5 Didn\'t Need to Go This Hard' },
  { id: 'superlativo', label: 'Superlativo', short: 'superlativo', test: t => /\b(Most|Best|Worst|Cheapest|Strangest|Slowest|Biggest|Fastest|Oldest|Last)\b|\bmais (barat|car|perigos|estranh|fechad|alt|lent|antig)\w*|\b(melhor|pior)\b/i.test(t), niches: ['viagem', 'ia'], ex: 'The Most Dangerous Market in Lagos' },
  { id: 'nome-do-lugar', label: 'Nome do lugar', short: 'lugar', test: t => new RegExp('\\b(' + PLACES + ')').test(t), niches: ['viagem'], ex: 'Ninja Training Dojo in Arima Onsen, Japan' },
  { id: 'primeira-pessoa', label: 'Primeira pessoa', short: '1ª pessoa', test: t => /^(I|I'm|I’ve|I've|My|How I|Eu|Fiquei|Fui|Testei|Comi|Dormi|Cruzei|Atravessei|Visitei|Gastei|Fiz|Cheguei)\b/.test(t), niches: ['viagem', 'ia'], ex: 'I Spent 24 Hours in Bangkok’s Strangest Hotel' },
  { id: 'nome-do-modelo', label: 'Nome do modelo de IA', short: 'modelo', test: t => /\b(GPT|Claude|Opus|Gemini|Grok|Llama|DeepSeek|Sora|Veo|Kling|Hailuo|Midjourney|Qwen|o4)\b/.test(t), niches: ['ia'], ex: 'GPT-6 Astra Is Finally Here' },
  { id: 'tutorial', label: 'Tutorial ou passo a passo', short: 'tutorial', test: t => /(passo a passo|tutorial|how to|como (criar|fazer|usar|ganhar)|step by step|in \d+ minutes|em \d+ minutos)/i.test(t), niches: ['ia'], ex: 'Como criar vídeos cinematográficos e virais com o Hailuo' },
];
const FORMULA = Object.fromEntries(FORMULAS.map(f => [f.id, f]));
const formulasOf = t => FORMULAS.filter(f => f.test(t)).map(f => f.id);

/* ------------------------------------------------------------------ temas (rótulos da forja: bge-m3 + rótulo 12B) */
const THEMES = [
  { id: 'comida-de-rua', niche: 'viagem', label: 'Comida de rua barata' },
  { id: 'lugares-perigosos', niche: 'viagem', label: 'Lugares com fama de perigosos' },
  { id: 'trens-e-onibus', niche: 'viagem', label: 'Trens e ônibus de longa distância' },
  { id: 'rotina-nomade', niche: 'viagem', label: 'Rotina de nômade e chegada a um país' },
  { id: 'japao-fora-das-capitais', niche: 'viagem', label: 'Japão fora das capitais' },
  { id: 'custo-de-viagem', niche: 'viagem', label: 'Quanto custa viajar ou morar' },
  { id: 'lancamento-de-modelo', niche: 'ia', label: 'Lançamento de modelo' },
  { id: 'agentes-e-automacao', niche: 'ia', label: 'Agentes e automação' },
  { id: 'ferramentas-da-semana', niche: 'ia', label: 'Ferramentas de IA da semana' },
  { id: 'video-com-ia', niche: 'ia', label: 'Vídeo gerado por IA' },
  { id: 'negocio-solo-com-ia', niche: 'ia', label: 'Negócio solo com IA' },
  { id: 'ia-e-emprego', niche: 'ia', label: 'IA, emprego e lei' },
];
const THEME = Object.fromEntries(THEMES.map(t => [t.id, t]));
THEMES.labeledAt = sp(2026, 10, 24, 3, 0);      // classificação de temas rodada pela forja em 24/10 03:00

/* ------------------------------------------------------------------ curva de views (cumulativa por dias de vida) */
const Gc = (fmtId, x) => { x = Math.max(0, x); return fmtId === 'short' ? 1.75 * (1 - Math.exp(-x / 2.5)) + 4 * (1 - Math.exp(-x / 16)) + 0.02 * x : 1.8 * (1 - Math.exp(-x / 3)) + 6.25 * (1 - Math.exp(-x / 25)) + 0.035 * x; };

/* ------------------------------------------------------------------ thumbnails placeholder (2 tons sólidos + texto + rosto) */
const TH = (text, bg, fg, face = 'r', ink = '#FFFFFF') => ({ text, bg, fg, face, ink });

/* ------------------------------------------------------------------ canais */
const sync6 = sp(2026, 10, 24, 12, 0);
const CHANNELS_CFG = [
  { id: 'tnfigueiredo', gender: 'm', name: 'tnFigueiredo', own: true, niche: 'viagem', lang: 'pt', subs: 3210, limit: 200, color: '#B8481A', ini: 'tF', rate: { long: .45, short: .5 }, B: { long: 300, short: 1500 }, maxAge: 420, growth30: .019, habit: { long: { dow: 3, h: 19, share: .6 }, short: { dow: 6, h: 11, share: .4 } } },
  { id: 'luke-damant', gender: 'm', name: 'Luke Damant', fullName: 'Travel with Luke Damant', niche: 'viagem', lang: 'en', subs: 1930000, limit: 200, color: '#3C7A8C', ini: 'LD', rate: { long: 1.5, short: 2.5 }, B: { long: 60000, short: 62000 }, growth30: .012, habit: { long: { dow: 3, h: 10, share: .6 }, short: { dow: 1, h: 7, share: .25 } } },
  { id: 'bald-and-bankrupt', gender: 'm', name: 'bald and bankrupt', niche: 'viagem', lang: 'en', subs: 4510000, limit: 100, color: '#6E6A5E', ini: 'bb', rate: { long: .6, short: 0 }, B: { long: 200000 }, pausedDays: 35, growth30: -.001, habit: { long: { dow: 5, h: 13, share: .5 } } },
  { id: 'dale-philip', gender: 'm', name: 'Dale Philip', niche: 'viagem', lang: 'en', subs: 3720000, limit: 200, color: '#8C3B3B', ini: 'DP', rate: { long: 1.3, short: 1.0 }, B: { long: 90000, short: 50000 }, growth30: .009, habit: { long: { dow: 6, h: 8, share: .75 }, short: { dow: 2, h: 8, share: .3 } } },
  { id: 'paddy-doyle', gender: 'm', name: 'Paddy Doyle', niche: 'viagem', lang: 'en', subs: 341000, limit: 120, color: '#2F6B4F', ini: 'PD', rate: { long: 1.2, short: 1.5 }, B: { long: 20000, short: 12000 }, growth30: .034, habit: { long: { dow: 5, h: 11, share: .5 }, short: { dow: 3, h: 11, share: .3 } },
    sync: { state: 'atrasado', last: sp(2026, 10, 23, 0, 0), msg: 'As 5 últimas tentativas esgotaram o tempo de resposta do YouTube.' } },
  { id: 'leo-khev', gender: 'm', name: 'Leo Khev', niche: 'viagem', lang: 'pt', subs: 1120000, limit: 150, color: '#9C6B2F', ini: 'LK', rate: { long: 1.0, short: 2.0 }, B: { long: 100000, short: 90000 }, growth30: .011, habit: { long: { dow: 2, h: 21, share: .5 }, short: { dow: 4, h: 12, share: .2 } } },
  { id: 'nomade-raiz', gender: 'm', name: 'Nômade Raiz', niche: 'viagem', lang: 'pt', subs: 612000, limit: 100, color: '#5A4A8C', ini: 'NR', rate: { long: .9, short: 1.2 }, B: { long: 30000, short: 25000 }, growth30: .015, habit: { long: { dow: 4, h: 21, share: .55 }, short: { dow: 0, h: 10, share: .2 } } },
  { id: 'matheus-fonseca', gender: 'm', name: 'Matheus Fonseca', niche: 'viagem', lang: 'pt', subs: 205000, limit: 200, color: '#2E5E86', ini: 'MF', rate: { long: .9, short: 2.5 }, B: { long: 12000, short: 20000 }, growth30: .022, habit: { long: { dow: 0, h: 18, share: .7 }, short: { dow: 3, h: 18, share: .3 } } },
  { id: 'vou-sem-volta', gender: 'n', name: 'Vou sem volta', niche: 'viagem', lang: 'pt', subs: 128000, limit: 50, color: '#7D5E3C', ini: 'VS', rate: { long: 1.0, short: .6 }, B: { long: 9000, short: 7000 }, growth30: null, habit: { long: { dow: 5, h: 20, share: .4 } },
    sync: { state: 'backfill', last: sp(2026, 10, 24, 14, 20), added: sp(2026, 10, 24, 14, 20), backfill: { done: 18, total: 50 } } },
  { id: 'matt-wolfe', gender: 'm', name: 'Matt Wolfe', niche: 'ia', lang: 'en', subs: 862000, limit: 120, color: '#2B4C7E', ini: 'MW', rate: { long: 4.5, short: .6 }, B: { long: 12500, short: 9000 }, growth30: .014, habit: { long: { dow: 2, h: 13, share: .3 }, short: { dow: 5, h: 16, share: .3 } } },
  { id: 'nate-herk', gender: 'm', name: 'Nate Herk', fullName: 'Nate Herk | AI Automation', niche: 'ia', lang: 'en', subs: 412000, limit: 100, color: '#3A6B5A', ini: 'NH', rate: { long: 2.1, short: 1.0 }, B: { long: 3600, short: 2000 }, growth30: .048, habit: { long: { dow: 1, h: 12, share: .45 }, short: { dow: 4, h: 12, share: .3 } } },
  { id: 'sabrina-ramonov', gender: 'f', name: 'Sabrina Ramonov', niche: 'ia', lang: 'en', subs: 298000, limit: 200, color: '#8C3A6B', ini: 'SR', rate: { long: 1.5, short: 5 }, B: { long: 2400, short: 3000 }, growth30: .027, habit: { long: { dow: 5, h: 10, share: .5 }, short: { dow: 1, h: 15, share: .15 } } },
  { id: 'the-ai-advantage', gender: 'n', name: 'The AI Advantage', niche: 'ia', lang: 'en', subs: 485000, limit: 100, color: '#2F5D8C', ini: 'AA', rate: { long: 1.9, short: .8 }, B: { long: 5000, short: 2000 }, growth30: .007, habit: { long: { dow: 4, h: 17, share: .5 }, short: { dow: 2, h: 17, share: .3 } } },
  { id: 'preguica-artificial', gender: 'n', name: 'Preguiça Artificial', niche: 'ia', lang: 'pt', subs: 284000, limit: 150, color: '#8C6A2F', ini: 'PA', rate: { long: 1.3, short: 2.4 }, B: { long: 7000, short: 6000 }, growth30: .051, habit: { long: { dow: 3, h: 15, share: .5 }, short: { dow: 6, h: 15, share: .2 } } },
  { id: 'esq-unltd-daily', gender: 'n', name: 'Esq Unltd Daily', niche: 'ia', lang: 'en', subs: 96400, limit: 120, color: '#4A4A6B', ini: 'EU', rate: { long: 5, short: 0 }, B: { long: 800 }, growth30: .003, habit: { long: { dow: 2, h: 6, share: .2 } },
    sync: { state: 'erro', last: sp(2026, 10, 21, 18, 0), errorSince: sp(2026, 10, 22, 0, 0), msg: 'Canal não encontrado no YouTube (404). Mudou de handle ou foi removido?' } },
];

/* ------------------------------------------------------------------ vídeos nomeados (exemplos do BRIEF e vitrine) */
/* ch: canal · fmt · pub (SP) · views alvo no último ponto (target) OU escala s · tema · versões (titles/thumbs/descs) com trocas */
const DESC_OPUS_1 = [
  "Anthropic just dropped Claude Opus 5.5 and OpenAI answered with GPT-6 Sol on the same day. Here's what actually changed.",
  '', 'Links:',
  'Claude Opus 5.5 announcement: https://anthropic.com/news/claude-opus-5-5',
  'GPT-6 Sol: https://openai.com/index/gpt-6-sol',
  'Future Tools newsletter: https://futuretools.io/newsletter',
  '', 'Chapters:', '0:00 Intro', '1:12 Benchmarks', '2:40 Coding test', '4:30 GPT-6 Sol quick look', '11:20 Final thoughts'];
const DESC_OPUS_2 = [
  "Claude Opus 5.5 is here and it's way more than an incremental update. I tested it on coding, agents and long research tasks.",
  'This video is sponsored by HubSpot — free guide to AI agents: https://clickhubspot.com/opus55',
  '', 'Links:',
  'Claude Opus 5.5 announcement: https://anthropic.com/news/claude-opus-5-5',
  'Future Tools newsletter: https://futuretools.io/newsletter?utm_source=youtube&utm_campaign=opus55',
  '', 'Chapters:', '0:00 Intro', '1:12 Benchmarks', '2:40 Coding test', '4:30 Agent test: 3 hours unattended', '9:05 Is it worth the price?', '11:20 Final thoughts'];
const DESC_NATE_1 = [
  'In this video I break down what Claude Code can actually do now, and why it matters.', '',
  'Join my free Skool community: https://skool.com/ai-automation-society',
  'Get my n8n templates: https://nateherk.com/templates?utm_medium=desc',
  'Newsletter: https://nateherk.com/news?utm_source=youtube&utm_campaign=cc-danger', '',
  '#claudecode #aiautomation #n8n'];
const DESC_NATE_2 = [
  'In this video I break down what Claude Code can actually do now, and why it matters.', '',
  'Claude Code Masterclass (new): https://nateherk.com/claude-code',
  '00:00 Intro, 02:14 The new agents, 09:30 What can go wrong, 17:45 My setup',
  'Get my n8n templates: https://nateherk.com/templates?utm_medium=description',
  'Newsletter: https://nateherk.com/news?utm_source=youtube&utm_campaign=cc-oct', '',
  '#claudecode #aiautomation #n8n'];
const DESC_PADDY_1 = ['Checked into the weirdest hotel in Bangkok for 24 hours.', '', 'Gear I use: https://paddydoyle.com/gear', '#bangkok #thailand'];
const DESC_PADDY_2 = ['Checked into the strangest hotel in Bangkok for 24 hours.', '', 'Hotel: The Mansion (not sponsored)', 'Map of every place in this video: https://paddydoyle.com/maps/bangkok', 'Gear I use: https://paddydoyle.com/gear', 'Patreon: https://patreon.com/paddydoyle', '#bangkok #thailand'];

const NAMED = [
  /* ===== IA ===== */
  { id: 'matt-fast-cheap', ch: 'matt-wolfe', fmt: 'long', pub: '2026-10-24T03:10', dur: '18:42', target: 1500, theme: 'lancamento-de-modelo',
    titles: [{ text: 'dev - The New AI model that has people talking' }, { text: 'This AI Model Is INSANELY Fast & Cheap', at: '2026-10-24T12:00', prec: '6h' }],
    thumbs: [{ art: TH('FAST & CHEAP', '#102040', '#5AD9C2') }] },
  { id: 'matt-opus55', ch: 'matt-wolfe', fmt: 'long', pub: '2026-10-06T13:00', dur: '24:18', target: 207600, theme: 'lancamento-de-modelo', showcase: true,
    titles: [
      { text: 'Opus 5.5 and GPT-6 Sol Launched on the Same Day' },
      { text: 'Opus 5.5 Is Crazy Good and GPT-6 Sol Launched Too', at: '2026-10-11T12:00', prec: '6h', F: 1.0 },
      { text: 'Claude Opus 5.5 Didn\'t Need to Go This Hard', at: '2026-10-18T12:00', prec: '6h', F: 1.12 }],
    thumbs: [
      { key: 'A', art: TH('OPUS 5.5 + GPT-6 SOL', '#14275E', '#E0662A') },
      { key: 'B', art: TH('TOO HARD?', '#1C0707', '#B3121B'), at: '2026-10-13T09:40' },
      { key: 'A', at: '2026-10-13T20:15' },
      { key: 'C', art: TH('WAY TOO HARD', '#F6C915', '#2A1458', 'r', '#140A2E'), at: '2026-10-18T09:14' }],
    descs: [{ lines: DESC_OPUS_1 }, { lines: DESC_OPUS_2, at: '2026-10-14T12:00', prec: '6h' }] },
  { id: 'matt-gpt6-astra', ch: 'matt-wolfe', fmt: 'long', pub: '2026-09-26T13:00', dur: '27:03', target: 500000, theme: 'lancamento-de-modelo',
    titles: [{ text: 'GPT-6 Astra Is Finally Here' }], thumbs: [{ art: TH('BIGGEST LEAP YET', '#0F1F3A', '#3D7BD9', 'l') }] },
  { id: 'matt-o4-insane', ch: 'matt-wolfe', fmt: 'long', pub: '2026-05-27T13:00', dur: '21:40', s: 3.2, theme: 'lancamento-de-modelo',
    titles: [{ text: 'o4 Is Here and It\'s INSANE' }], thumbs: [{ art: TH('O4 IS HERE', '#101828', '#E2B04A') }] },
  { id: 'nate-claude-code-danger', ch: 'nate-herk', fmt: 'long', pub: '2026-10-08T11:00', dur: '24:10', target: 58000, theme: 'agentes-e-automacao',
    titles: [{ text: 'No, Seriously. Claude Code is Starting To Get Dangerous' }], thumbs: [{ art: TH('DANGEROUS', '#1A1A1A', '#D9614A') }],
    descs: [{ lines: DESC_NATE_1 }, { lines: DESC_NATE_2, at: '2026-10-21T18:00', prec: '6h' }] },
  { id: 'nate-claude45-crazy', ch: 'nate-herk', fmt: 'long', pub: '2026-07-12T12:00', dur: '19:02', s: 3.6, theme: 'lancamento-de-modelo',
    titles: [{ text: 'Claude 4.5 Just Went Crazy' }], thumbs: [{ art: TH('WENT CRAZY', '#0E2A25', '#5CC3B2') }] },
  { id: 'nate-ai-agent-business', ch: 'nate-herk', fmt: 'long', pub: '2026-07-25T12:00', dur: '21:20', s: 1.2, theme: 'agentes-e-automacao',
    titles: [{ text: 'How I Automated My Entire Business With AI' }, { text: 'I Built an AI Agent That Runs My Business', at: '2026-08-20T09:00', prec: '1d' }],
    thumbs: [{ art: TH('RUNS MY BUSINESS', '#1A2A3A', '#7FB0E0') }] },
  { id: 'sabrina-1m', ch: 'sabrina-ramonov', fmt: 'long', pub: '2026-09-12T10:00', dur: '31:05', target: 19800, theme: 'negocio-solo-com-ia',
    titles: [{ text: 'How I Built a $1M Solo AI Business ($0 to $1M)' }, { text: 'I Forced Myself to Build $1M Business with AI', at: '2026-10-20T12:00', prec: '6h' }],
    thumbs: [{ art: TH('$0 TO $1M', '#3A0F2A', '#E85A9A') }] },
  { id: 'sabrina-40k', ch: 'sabrina-ramonov', fmt: 'long', pub: '2026-08-25T10:00', dur: '26:30', s: 4.4, theme: 'negocio-solo-com-ia',
    titles: [{ text: 'How I Make $40k/Month With One AI Agent' }], thumbs: [{ art: TH('$40K/MONTH', '#141414', '#FF6A8A') }] },
  { id: 'sabrina-nobody', ch: 'sabrina-ramonov', fmt: 'short', pub: '2026-10-18T15:00', dur: '0:41', s: 6, theme: 'ferramentas-da-semana',
    titles: [{ text: 'The AI tool nobody talks about' }], thumbs: [{ art: TH('NOBODY TALKS', '#141414', '#FF6A8A') }] },
  { id: 'aiadv-opus-back', ch: 'the-ai-advantage', fmt: 'long', pub: '2026-10-10T17:00', dur: '16:45', s: 4.6, theme: 'lancamento-de-modelo',
    titles: [{ text: 'Claude Opus 5.5 Is Back (and It\'s Different)' }], thumbs: [{ art: TH('OPUS 5.5', '#0B2A4A', '#F2B03A') }] },
  { id: 'aiadv-tools-pay', ch: 'the-ai-advantage', fmt: 'long', pub: '2026-08-28T12:00', dur: '18:05', s: 1.05, theme: 'ferramentas-da-semana',
    titles: [{ text: 'The AI Tools I Actually Pay For (2026)' }],
    thumbs: [{ art: TH('TOOLS I PAY FOR', '#1E293B', '#0EA5E9') }, { art: TH('$437/MONTH', '#0F172A', '#22C55E'), at: '2026-10-12T16:00', F: 1.38 }] },
  { id: 'preguica-veo-kling', ch: 'preguica-artificial', fmt: 'long', pub: '2026-08-15T15:00', dur: '17:12', s: 5, theme: 'video-com-ia',
    titles: [{ text: 'Testei o Veo 4 contra o Kling 3' }], thumbs: [{ art: TH('VEO VS KLING', '#2A1A3A', '#C25AD9') }] },
  { id: 'preguica-hailuo', ch: 'preguica-artificial', fmt: 'long', pub: '2026-05-23T15:00', dur: '14:20', target: 382000, theme: 'video-com-ia',
    titles: [{ text: 'Como criar vídeos cinematográficos e virais com o Hailuo' }], thumbs: [{ art: TH('HAILUO TUTORIAL', '#2A1A3A', '#E07AE0') }] },
  { id: 'esq-lawsuit', ch: 'esq-unltd-daily', fmt: 'long', pub: '2026-10-05T06:00', dur: '11:20', s: 1.2, theme: 'ia-e-emprego',
    titles: [{ text: 'OpenAI\'s New Lawsuit, Explained' }], thumbs: [{ art: TH('LAWSUIT', '#202A3A', '#8AA0C0') }] },
  /* ===== Viagem ===== */
  { id: 'luke-kfc', ch: 'luke-damant', fmt: 'short', pub: '2026-10-03T07:00', dur: '0:58', target: 1900000, theme: 'comida-de-rua',
    titles: [{ text: '$2.70 KFC in Pakistan??' }, { text: 'Trying a $2.70 Pakistan\'s version of KFC', at: '2026-10-22T06:00', prec: '6h' }],
    thumbs: [{ art: TH('$2.70 KFC', '#B8261B', '#F2A03D') }] },
  { id: 'luke-gun-market', ch: 'luke-damant', fmt: 'long', pub: '2026-09-20T10:00', dur: '26:12', s: 4.6, theme: 'lugares-perigosos',
    titles: [{ text: 'Inside Pakistan\'s Most Dangerous Gun Market' }], thumbs: [{ art: TH('GUN MARKET', '#5A3420', '#C78A3A') }] },
  { id: 'luke-food-street', ch: 'luke-damant', fmt: 'long', pub: '2026-08-14T07:00', dur: '27:48', s: 2.9, theme: 'comida-de-rua',
    titles: [{ text: 'I Ate at Pakistan\'s Most Dangerous Food Street' }],
    thumbs: [{ art: TH('PAKISTAN STREET FOOD', '#78350F', '#A16207', 'c') }, { art: TH('$1 DANGER?', '#7F1D1D', '#DC2626', 'l'), at: '2026-10-11T07:15', F: 1.34 }] },
  { id: 'luke-capsule-9', ch: 'luke-damant', fmt: 'long', pub: '2026-07-06T10:00', dur: '22:30', s: 3.8, theme: 'custo-de-viagem',
    titles: [{ text: 'Sleeping in Japan\'s $9 Capsule Hotel' }], thumbs: [{ art: TH('$9 HOTEL', '#20304A', '#7FB0E0') }] },
  { id: 'luke-hidden-village', ch: 'luke-damant', fmt: 'long', pub: '2026-07-30T07:00', dur: '29:10', s: 1.15, theme: 'rotina-nomade',
    titles: [{ text: 'Inside a Hidden Village in Pakistan\'s Mountains' }, { text: 'Pakistan\'s Hidden Mountain Village', at: '2026-09-02T09:00', prec: '1d' }],
    thumbs: [{ art: TH('HIDDEN VILLAGE', '#1E3A2A', '#E2B341') }] },
  { id: 'bald-transnistria', ch: 'bald-and-bankrupt', fmt: 'long', pub: '2026-09-19T13:00', dur: '31:00', s: 1.0, theme: 'trens-e-onibus',
    titles: [{ text: 'Last Train Out of Transnistria' }], thumbs: [{ art: TH('LAST TRAIN', '#3A2A20', '#B08A5A') }] },
  { id: 'bald-north-korea', ch: 'bald-and-bankrupt', fmt: 'long', pub: '2026-06-05T13:00', dur: '34:10', s: 4.2, theme: 'lugares-perigosos',
    titles: [{ text: 'Inside North Korea\'s Strangest Hotel' }], thumbs: [{ art: TH('STRANGEST HOTEL', '#2F3B45', '#8A9AA6') }] },
  { id: 'dale-ninja-dojo', ch: 'dale-philip', fmt: 'long', pub: '2025-12-30T08:00', dur: '19:55', target: 7400000, theme: 'japao-fora-das-capitais',
    titles: [{ text: 'Ninja Training Dojo in Arima Onsen, Japan' }],
    thumbs: [{ art: TH('NINJA', '#1C1C1C', '#7A2A2A') }, { art: TH('NINJA DOJO', '#1C2B4A', '#C23B3B'), at: '2026-10-15T08:12', F: 1.04 }],
    descs: [{ lines: null }, { lines: ['Training with a real ninja master in Arima Onsen.', '', 'Book the dojo: https://arima-ninja.jp', 'Where I stayed: https://daleph.com/arima', '#japan #ninja #onsen'], at: '2026-09-20T09:00', prec: '1d' }] },
  { id: 'dale-slow-train', ch: 'dale-philip', fmt: 'long', pub: '2026-08-22T08:00', dur: '23:40', s: 4.4, theme: 'trens-e-onibus',
    titles: [{ text: 'I Took the Slowest Train in Japan' }], thumbs: [{ art: TH('SLOWEST TRAIN', '#1C2B4A', '#C23B3B') }] },
  { id: 'dale-capsule-underground', ch: 'dale-philip', fmt: 'long', pub: '2026-06-20T08:00', dur: '20:15', s: 1.1, theme: 'japao-fora-das-capitais',
    titles: [{ text: 'I Slept in Japan\'s Underground Capsule Hotel' }, { text: 'Sleeping in a Capsule Hotel Underground', at: '2026-08-16T09:00', prec: '1d' }],
    thumbs: [{ art: TH('UNDERGROUND', '#202020', '#E0A040') }] },
  { id: 'dale-floating-hostel', ch: 'dale-philip', fmt: 'long', pub: '2026-10-20T08:00', dur: '21:05', s: 1.1, theme: 'japao-fora-das-capitais',
    titles: [{ text: 'Inside Tokyo\'s Last Floating Hostel' }], thumbs: [{ art: TH('FLOATING', '#204050', '#E0A040') }] },
  { id: 'paddy-bkk-hotel', ch: 'paddy-doyle', fmt: 'long', pub: '2026-10-04T11:00', dur: '25:33', s: 4.4, theme: 'lugares-perigosos',
    titles: [{ text: 'The Weirdest Hotel in Bangkok' }, { text: 'I Spent 24 Hours in Bangkok\'s Strangest Hotel', at: '2026-10-12T06:00', prec: '6h' }],
    thumbs: [{ art: TH('BANGKOK', '#7A2E8C', '#E6A13A') }],
    descs: [{ lines: DESC_PADDY_1 }, { lines: DESC_PADDY_2, at: '2026-10-11T12:00', prec: '6h' }] },
  { id: 'leo-asia-central', ch: 'leo-khev', fmt: 'long', pub: '2026-09-09T21:00', dur: '28:02', s: 1.68, theme: 'rotina-nomade',
    titles: [{ text: 'Por que ninguém visita esta cidade da Ásia Central' }], thumbs: [{ art: TH('NINGUÉM VAI', '#4A6B2F', '#D9B84A') }] },
  { id: 'nomade-fronteira', ch: 'nomade-raiz', fmt: 'long', pub: '2026-09-15T21:00', dur: '33:40', s: 4.8, theme: 'lugares-perigosos',
    titles: [{ text: 'Fiquei preso na fronteira do Afeganistão' }], thumbs: [{ art: TH('PRESO NA FRONTEIRA', '#3A2A1A', '#B0703A') }] },
  { id: 'nomade-turcomenistao', ch: 'nomade-raiz', fmt: 'long', pub: '2026-08-21T19:00', dur: '33:12', s: 1.3, theme: 'lugares-perigosos',
    titles: [{ text: 'Fui pro país mais fechado do mundo (Turcomenistão)' }],
    thumbs: [{ key: 'A', art: TH('PAÍS PROIBIDO', '#14532D', '#16A34A', 'l') }, { key: 'B', art: TH('PORTA DO INFERNO', '#1C1917', '#57534E'), at: '2026-10-07T10:05', F: 0.78 }, { key: 'A', at: '2026-10-16T12:40', F: 1.03 }] },
  { id: 'matheus-japao-semana', ch: 'matheus-fonseca', fmt: 'long', pub: '2026-08-02T18:00', dur: '22:10', s: 1.2, theme: 'custo-de-viagem',
    titles: [{ text: 'Japão: quanto gastei em 7 dias (custo real)' }, { text: 'Quanto custa viver uma semana no Japão', at: '2026-10-05T12:00', prec: '6h', F: 0.98 }],
    thumbs: [{ art: TH('R$ JAPÃO', '#C8324A', '#F0D0A0') }] },
  { id: 'matheus-toquio', ch: 'matheus-fonseca', fmt: 'short', pub: '2026-10-08T18:00', dur: '0:47', s: 3.6, theme: 'custo-de-viagem',
    titles: [{ text: 'Quanto custa um dia em Tóquio' }], thumbs: [{ art: TH('R$ TÓQUIO', '#C8324A', '#F0D0A0') }] },
  { id: 'matheus-konbini', ch: 'matheus-fonseca', fmt: 'short', pub: '2026-08-28T18:00', dur: '0:52', s: 1.1, theme: 'comida-de-rua',
    titles: [{ text: 'Konbini no Japão: quanto custa?' }, { text: 'Japão: o konbini mais barato', at: '2026-09-01T09:00', prec: '1d' }],
    thumbs: [{ art: TH('KONBINI', '#1E3A2A', '#E2B341') }] },
  { id: 'matheus-pais-perigoso', ch: 'matheus-fonseca', fmt: 'long', pub: '2026-05-17T18:00', dur: '30:20', s: 3.4, theme: 'lugares-perigosos',
    titles: [{ text: 'Visitei o país mais perigoso da América do Sul' }], thumbs: [{ art: TH('MAIS PERIGOSO', '#3A3020', '#D9B84A') }] },
  /* ===== seu canal ===== */
  { id: 'tnf-lisboa', ch: 'tnfigueiredo', fmt: 'long', pub: '2026-09-07T19:00', dur: '17:40', s: 1.15, theme: 'custo-de-viagem',
    titles: [{ text: 'Quanto custa 1 semana em Lisboa em 2026' }], thumbs: [{ art: TH('LISBOA R$', '#2A4F6E', '#E3B04B') }] },
  { id: 'tnf-apps-ia', ch: 'tnfigueiredo', fmt: 'long', pub: '2026-08-10T19:00', dur: '14:05', s: 1.0, theme: 'rotina-nomade',
    titles: [{ text: 'Testei 5 apps de IA para planejar viagem' }], thumbs: [{ art: TH('5 APPS IA', '#3B2A55', '#E86A3A') }] },
];

/* ------------------------------------------------------------------ geradores de título (preenchimento) */
const SLOTS = {
  placeEn: ['Lahore', 'Karachi', 'Hunza', 'Tbilisi', 'Lagos', 'Dhaka', 'Kyoto', 'Osaka', 'Okinawa', 'Chiang Mai', 'Laos', 'Nepal', 'Mongolia', 'Bolivia', 'Peru', 'Almaty', 'Tashkent', 'Moldova', 'Bulgaria', 'Cambodia', 'Hokkaido', 'Peshawar', 'Georgia', 'Kyrgyzstan'],
  placePt: ['Bolívia', 'Cusco', 'Mongólia', 'Quirguistão', 'Tajiquistão', 'Japão', 'Tóquio', 'Seul', 'Marrocos', 'Índia', 'Cazaquistão', 'Vietnã', 'Nepal', 'Geórgia', 'Paquistão', 'Chile', 'Osh', 'Pamir'],
  price: ['1', '2', '3', '4', '5', '7', '9', '10', '12', '15', '20'],
  n: ['3', '5', '7', '10', '12', '24', '48'],
  model: ['Gemini 4', 'Grok 5', 'Llama 5', 'DeepSeek V4', 'Qwen 4', 'Claude Haiku 5', 'GPT-6 Mini', 'Sora 3', 'Veo 4', 'Kling 3', 'Midjourney 8'],
  tool: ['n8n', 'Claude Code', 'Cursor', 'Lovable', 'Gumloop', 'Zapier', 'Perplexity', 'NotebookLM'],
  vtool: ['Kling', 'Veo', 'Hailuo', 'Sora', 'Runway', 'Pika'],
  things: ['Video Tools', 'Agents', 'Image Generators', 'Coding Tools', 'Chrome Extensions', 'Note Apps'],
  food: ['kebab', 'chai', 'ramen', 'dumplings', 'curry', 'noodles', 'biryani', 'samosa'],
  topic: ['Agents Everywhere', 'The Copyright Ruling', 'EU AI Act Changes', 'Deepfake Law Update', 'Who Owns AI Art', 'The Anthropic Settlement', 'AI Liability', 'Chatbots and the Bar', 'Data Centers and Zoning', 'Voice Clones in Court', 'Open Weights Debate', 'AI in Hiring', 'Model Licenses', 'Scraping Lawsuits', 'Robotaxi Rules', 'AI Disclosure Laws', 'Synthetic Media Labels', 'Teen Chatbot Rules', 'Agent Liability', 'AI Patents'],
};
const TPL = {
  viagem: {
    en: { long: [
      ['Eating {placeEn} Street Food for ${price}', 'comida-de-rua'], ['${price} Hotel in {placeEn}: Worth It?', 'custo-de-viagem'], ['{n} Hours on the Slowest Train in {placeEn}', 'trens-e-onibus'],
      ['The Most Dangerous Market in {placeEn}', 'lugares-perigosos'], ['First Day in {placeEn}', 'rotina-nomade'], ['Why Nobody Visits {placeEn}', 'lugares-perigosos'],
      ['I Spent {n} Days in {placeEn}', 'rotina-nomade'], ['{placeEn} Night Market Tour', 'comida-de-rua'], ['Is {placeEn} Safe Right Now?', 'lugares-perigosos'],
      ['Living on ${price} a Day in {placeEn}', 'custo-de-viagem'], ['Overnight Bus Across {placeEn}', 'trens-e-onibus'], ['Inside a Local Home in {placeEn}', 'rotina-nomade'],
      ['Walking Around Old {placeEn}', 'rotina-nomade'], ['What ${price} Buys You in {placeEn}', 'custo-de-viagem']],
      short: [['${price} {food} in {placeEn}', 'comida-de-rua'], ['{placeEn} in 30 seconds', 'rotina-nomade'], ['Is this the best {food}?', 'comida-de-rua'], ['Night bus reality in {placeEn}', 'trens-e-onibus'], ['Street barber in {placeEn}', 'rotina-nomade']] },
    pt: { long: [
      ['Comi a comida mais barata {de:placePt} (R$ {price})', 'comida-de-rua'], ['Quanto custa viajar {por:placePt}?', 'custo-de-viagem'], ['{n} dias {em:placePt} gastando pouco', 'custo-de-viagem'],
      ['O lugar mais perigoso {de:placePt}', 'lugares-perigosos'], ['Primeiro dia {em:placePt}', 'rotina-nomade'], ['Dormi num trem noturno {em:placePt}', 'trens-e-onibus'],
      ['Por que ninguém visita {art:placePt}?', 'lugares-perigosos'], ['Mercado de rua {em:placePt}', 'comida-de-rua'], ['Cheguei {em:placePt} sem reserva', 'rotina-nomade'],
      ['Ônibus de {n} horas {por:placePt}', 'trens-e-onibus'], ['Hotel de R$ {price}0 {em:placePt}: vale?', 'custo-de-viagem'], ['Um dia comum {em:placePt}', 'rotina-nomade']],
      short: [['Pão de R$ {price} {em:placePt}', 'comida-de-rua'], ['{Art:placePt} em 30 segundos', 'rotina-nomade'], ['Táxi mais barato {de:placePt}', 'custo-de-viagem'], ['Fronteira {de:placePt} em 1 minuto', 'lugares-perigosos'], ['Metrô {de:placePt}', 'trens-e-onibus']] },
  },
  ia: {
    en: { long: [
      ['{model} Is INSANE', 'lancamento-de-modelo'], ['{model} Just Dropped: First Look', 'lancamento-de-modelo'], ['I Tested {n} AI {things}', 'ferramentas-da-semana'],
      ['{n} Free AI Tools You Need Right Now', 'ferramentas-da-semana'], ['Build an AI Agent With {tool} in {n} Minutes', 'agentes-e-automacao'], ['How I Make ${price}k/Month With AI', 'negocio-solo-com-ia'],
      ['Is {model} Better Than GPT-6?', 'lancamento-de-modelo'], ['AI News: Everything That Happened This Week', 'lancamento-de-modelo'], ['My {tool} Setup for 2026', 'agentes-e-automacao'],
      ['Will AI Take Your Job?', 'ia-e-emprego'], ['The Best AI Video Generator Right Now', 'video-com-ia'], ['{vtool} vs Sora: Which Is Better?', 'video-com-ia'],
      ['{tool} Changed How I Work', 'agentes-e-automacao'], ['AI Tools I Use Every Week', 'ferramentas-da-semana']],
      short: [['{model} in 60 seconds', 'lancamento-de-modelo'], ['This AI trick saves hours', 'ferramentas-da-semana'], ['Free AI tool of the day: {tool}', 'ferramentas-da-semana'], ['{tool} shortcut you need', 'agentes-e-automacao'], ['AI voice clone test', 'video-com-ia']] },
    pt: { long: [
      ['Testei o {model} em português', 'lancamento-de-modelo'], ['Como criar vídeos com IA no {vtool} (passo a passo)', 'video-com-ia'], ['{n} ferramentas de IA grátis', 'ferramentas-da-semana'],
      ['O {model} é absurdo', 'lancamento-de-modelo'], ['Fiz um clipe só com IA', 'video-com-ia'], ['A IA vai acabar com o seu emprego?', 'ia-e-emprego'],
      ['Como ganhar R$ {price} mil por mês com IA', 'negocio-solo-com-ia'], ['Agente de IA no {tool}: do zero', 'agentes-e-automacao'], ['O melhor gerador de vídeo grátis', 'video-com-ia'],
      ['Como dublar vídeos com IA', 'video-com-ia'], ['{model} na prática', 'lancamento-de-modelo']],
      short: [['Truque do {vtool}', 'video-com-ia'], ['{model} em 30 segundos', 'lancamento-de-modelo'], ['Prompt de vídeo pronto', 'video-com-ia'], ['Legenda automática com IA', 'ferramentas-da-semana'], ['Voz clonada em 1 minuto', 'video-com-ia']] },
  },
  esq: { long: [['Daily AI Brief: {topic}', 'ia-e-emprego'], ['{topic}, Explained', 'ia-e-emprego'], ['Is {model} Legal to Use at Work?', 'ia-e-emprego']] },
};
const BOOST = { viagem: { preco: .6, superlativo: .1 }, ia: { 'reacao-hiperbole': .28, 'nome-do-modelo': .06 } };
/* palavra-chave da thumbnail: preço, número + substantivo, ou nome (lugar/modelo/ferramenta); no máximo 2 palavras */
const KW_STOP = new Set('tested testei changed dropped look need setup shortcut trick how what why the this that with from your you just will are is it its my i i\'m in on of for to a an and or vs best first inside walking living what\'s every right now que como quanto quanta custa por para pelo pela num numa uma um de do da dos das em no na o os as e é sem com seu sua ninguém visita vai mais dia dias'.split(' '));
const KW_NAMES = [].concat(SLOTS.placeEn, SLOTS.placePt, SLOTS.model, SLOTS.tool, SLOTS.vtool, SLOTS.topic.map(t => t.split(' ').slice(-1)[0])).sort((a, b) => b.length - a.length);
function thumbKeyword(title) {
  const up = s => s.toUpperCase();
  const price = (title.match(/(R\$|US\$|\$)\s?\d+[\d.,]*k?/) || [])[0];
  const name = KW_NAMES.find(n => n.length > 2 && new RegExp('(^|[^\\w])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\w])').test(title));
  const place = [].concat(SLOTS.placeEn, SLOTS.placePt).find(n => n.split(' ').length === 1 && new RegExp('(^|[^\\w])' + n + '($|[^\\w])').test(title));
  if (price) return up(price.replace(/\s+/g, '') + (place ? ' ' + place : ''));
  if (name && /\d/.test(name)) return up(name.split(' ').slice(0, 2).join(' '));   // "Grok 5", não "5 LEGAL"
  const num = title.match(/(?:^|\s)(\d+)\s+(?:(?:Free|AI|grátis|new|novos?|best|cheap|legal|melhores)\s+)*([A-Za-zÀ-ú]{3,})/i);
  if (num && !/^(de|do|da|em|no|na|por|the|of|in|on|and|with|com|legal|free|new|best|cheap|real|safe|better|grátis|barato|insane)$/i.test(num[2])) return up(num[1] + ' ' + num[2]);
  if (name) return up(name.split(' ').slice(0, 2).join(' '));
  const ws = title.split(/[\s:,?!.()]+/).filter(w => w.length >= 4 && !KW_STOP.has(w.toLowerCase()) && /^[A-Za-zÀ-ú0-9$'-]+$/.test(w));
  return up(ws.slice(0, 2).join(' ') || title.split(' ')[0]);
}
/* artigo de cada lugar em PT (país com artigo; cidade sem): para "da Mongólia", "pelo Japão", "em Cusco" */
const PLACE_ART = { 'Bolívia': 'a', 'Cusco': '', 'Mongólia': 'a', 'Quirguistão': 'o', 'Tajiquistão': 'o', 'Japão': 'o', 'Tóquio': '', 'Seul': '', 'Marrocos': 'o', 'Índia': 'a', 'Cazaquistão': 'o', 'Vietnã': 'o', 'Nepal': 'o', 'Geórgia': 'a', 'Paquistão': 'o', 'Chile': 'o', 'Osh': '', 'Pamir': 'o' };
const PREP = { de: { a: 'da', o: 'do', '': 'de' }, em: { a: 'na', o: 'no', '': 'em' }, por: { a: 'pela', o: 'pelo', '': 'por' }, art: { a: 'a', o: 'o', '': '' }, Art: { a: 'A', o: 'O', '': '' } };
const placeWith = (prep, place) => { const art = PLACE_ART[place] != null ? PLACE_ART[place] : ''; const w = PREP[prep][art]; return w ? w + ' ' + place : place; };
const fillTpl = (tpl, r) => tpl.replace(/\{(?:(de|em|por|art|Art):)?(\w+)\}/g, (_, prep, k) => { const v = SLOTS[k][Math.floor(r() * SLOTS[k].length)]; return prep ? placeWith(prep, v) : v; });

/* ------------------------------------------------------------------ montagem: canais */
const channels = [], CH = {};
for (const c of CHANNELS_CFG) {
  const s = c.sync || { state: 'ok', last: sync6 };
  const ch = {
    id: c.id, gender: c.gender, name: c.name, fullName: c.fullName || c.name, own: !!c.own, niche: c.niche, lang: c.lang, subs: c.subs,
    video_limit: c.limit, color: c.color, ini: c.ini,
    sync: { state: s.state, last: s.last, next: sp(2026, 10, 24, 18, 0), msg: s.msg || null, errorSince: s.errorSince || null,
      added: s.added || null, backfill: s.backfill || null },
    activity: c.pausedDays ? { state: 'parado', pausedDays: c.pausedDays } : { state: 'ativo' },
    _cfg: c,
  };
  // último ponto diário disponível para o canal
  ch.sync.label = ({ ok: 'sincronizado', atrasado: 'atrasado', erro: 'erro', backfill: 'buscando vídeos' })[s.state];
  ch.statusLabel = c.pausedDays && s.state === 'ok' ? 'parado' : ch.sync.label;
  ch.sync.stateLabel = ch.sync.label;
  ch.lastIdx = s.state === 'backfill' ? null : Math.min(LAST_IDX, snapIdxAtOrBefore(s.last));
  ch.syncAgeHours = (NOW - s.last) / H;
  channels.push(ch); CH[c.id] = ch;
}

/* ------------------------------------------------------------------ montagem: vídeos */
const videos = [], V = {};
function parseVersions(nv, pubMs) {
  const conv = arr => (arr || []).map(x => Object.assign({}, x, { atMs: x.at ? spIso(x.at) : null }));
  return { titles: conv(nv.titles), thumbs: conv(nv.thumbs), descs: conv(nv.descs) };
}
for (const ch of channels) {
  const c = ch._cfg;
  const lastKnown = ch.sync.state === 'backfill' ? NOW : ch.sync.last;
  const named = NAMED.filter(n => n.ch === ch.id).map(n => Object.assign({}, n, { pubMs: spIso(n.pub) }));
  const list = [];
  for (const fmtId of ['long', 'short']) {
    const rate = c.rate[fmtId]; if (!rate) continue;
    const r = rng(ch.id + '|' + fmtId);
    const iv = 7 / rate, hab = c.habit[fmtId] || { dow: 3, h: 12, share: 0 };
    const tEnd = c.pausedDays ? NOW - c.pausedDays * DAY - 0.5 * DAY : lastKnown;
    const maxAge = c.maxAge || 640;
    let t = tEnd - r() * Math.min(iv, 2) * DAY;
    const chosen = [];
    const namedSame = named.filter(n => n.fmt === fmtId).map(n => n.pubMs);
    let guard = 0;
    while (t > NOW - maxAge * DAY && guard++ < 2000) {
      let pubMs;
      const p = parts(t);
      if (r() < hab.share) {
        let back = (p.dow - hab.dow + 7) % 7;
        pubMs = sp(p.y, p.mo, p.d, hab.h, 0) - back * DAY;
      } else {
        pubMs = sp(p.y, p.mo, p.d, 7 + Math.floor(r() * 15), Math.floor(r() * 12) * 5);
      }
      if (pubMs > tEnd) pubMs -= DAY;
      const clash = namedSame.concat(chosen).some(x => Math.abs(x - pubMs) < 0.6 * DAY);
      if (!clash && pubMs < lastKnown && !(c.pausedDays && pubMs > NOW - c.pausedDays * DAY)) chosen.push(pubMs);
      t -= iv * (0.7 + r() * 0.6) * DAY;
    }
    for (const pubMs of chosen) list.push({ fmt: fmtId, pubMs, filler: true });
  }
  for (const n of named) list.push(Object.assign({}, n, { filler: false }));
  list.sort((a, b) => b.pubMs - a.pubMs);
  // títulos dos preenchimentos
  const used = new Set(named.map(n => n.titles[n.titles.length - 1].text));
  const tr = rng(ch.id + '|titles');
  const counters = { long: 0, short: 0 };
  let vlist = list;
  if (ch.sync.state === 'backfill') vlist = list.slice(0, ch.sync.backfill.done);
  vlist.forEach(item => {
    let v;
    if (!item.filler) {
      const ver = parseVersions(item, item.pubMs);
      v = { id: item.id, ch: ch.id, niche: ch.niche, fmt: item.fmt, pub: item.pubMs, dur: item.dur, named: true, showcase: !!item.showcase,
        theme: item.theme, target: item.target || null, s: item.s || null, _ver: ver };
    } else {
      const fmtId = item.fmt, k = counters[fmtId]++;
      const tplSet = ch.id === 'esq-unltd-daily' ? TPL.esq.long : TPL[ch.niche][ch.lang][fmtId];
      let title, theme, tries = 0;
      do { const pick = tplSet[Math.floor(tr() * tplSet.length)]; title = fillTpl(pick[0], tr); theme = pick[1]; } while (used.has(title) && tries++ < 25);
      if (used.has(title)) title = title + (ch.lang === 'pt' ? ' (parte 2)' : ' (Part 2)');
      used.add(title);
      // escala do vídeo: ruído + bônus da fórmula (para padrões reais), nunca chega a 2× da mediana
      let sc = Math.exp((tr() + tr() + tr() - 1.5) * 0.28); sc = Math.min(1.25, Math.max(0.74, sc));
      const fids = formulasOf(title); let boost = 0; for (const f of fids) boost += (BOOST[ch.niche][f] || 0);
      sc = Math.min(1.6, sc * (1 + boost));
      const kw = thumbKeyword(title);
      const words = title.replace(/[$R]\$?\s?\d+[\d.,k]*/g, m => m.toUpperCase()).split(/[\s:,?!.()]+/).filter(w => w.length > 2 && !/^(the|and|for|with|in|de|do|da|em|com|por|pela|num|uma|this)$/i.test(w));
      const pal = [['#24324A', '#D9614A'], ['#1E3A2A', '#E2B341'], ['#3A2440', '#E07A5F'], ['#20304A', '#7FB0E0'], ['#3A3020', '#D9B84A'], ['#2A2A2A', '#B0B0B0']][(k + fmtId.length) % 6];
      const durMin = fmtId === 'short' ? 0 : 8 + Math.floor(tr() * 24), durSec = fmtId === 'short' ? 15 + Math.floor(tr() * 44) : Math.floor(tr() * 60);
      v = { id: ch.id + '-' + (fmtId === 'long' ? 'l' : 's') + k, ch: ch.id, niche: ch.niche, fmt: fmtId, pub: item.pubMs, dur: durMin + ':' + p2(durSec), named: false, showcase: false,
        theme, target: null, s: sc,
        _ver: { titles: [{ text: title }], thumbs: [{ art: TH(kw, pal[0], pal[1], ['l', 'r', 'c', null][k % 4]) }], descs: [] } };
    }
    videos.push(v); V[v.id] = v;
  });
  ch.videos = videos.filter(v => v.ch === ch.id).sort((a, b) => b.pub - a.pub);
  ch.videos.forEach((v, i) => { v.tracked = i < ch.video_limit; });
}

/* ------------------------------------------------------------------ versões (títulos / thumbnails / descrições) */
const syncBefore = (ms) => { // sincronização anterior a um instante de 1ª observação
  if (ms <= SERIES_START) return ms - DAY;            // regime diário 09:00
  return ms - 6 * H;
};
function buildVersions(v) {
  const ch = CH[v.ch], lastSeen = ch.sync.last;
  const out = { titles: [], thumbs: [], descs: [] };
  // títulos
  v._ver.titles.forEach((t, i, arr) => {
    const first = i === 0 ? v.pub : t.atMs;
    const prec = i === 0 ? 'publicacao' : t.prec;
    const win = i === 0 ? null : [syncBefore(t.atMs), t.atMs];
    const next = arr[i + 1];
    out.titles.push({ id: 'T' + (i + 1), text: t.text, first_seen: first, last_seen: next ? syncBefore(next.atMs) : lastSeen, current: !next, prec, window: win, F: t.F || 1 });
  });
  // thumbnails: só existem como versões a partir do arquivo (03/10)
  const firstThumbSeen = Math.max(v.pub, SERIES_START);
  const arts = {};
  v._ver.thumbs.forEach((t, i, arr) => {
    const key = t.key || String.fromCharCode(65 + i);
    if (t.art) arts[key] = t.art;
    const first = i === 0 ? firstThumbSeen : t.atMs;
    const next = arr[i + 1];
    out.thumbs.push({ id: 'TH' + (i + 1), key, art: arts[key], archived: true, first_seen: first, last_seen: next ? next.atMs : lastSeen, current: !next,
      prec: i === 0 ? (v.pub >= SERIES_START ? 'publicacao' : 'desde-arquivo') : 'min', seenSinceArchive: i === 0 && v.pub < SERIES_START, F: t.F || 1 });
  });
  // descrições
  const dsrc = v._ver.descs.length ? v._ver.descs : [{ lines: genericDesc(v) }];
  dsrc.forEach((d, i, arr) => {
    const first = i === 0 ? v.pub : d.atMs;
    const next = arr[i + 1];
    // texto: só existe para versões vistas a partir de 03/10 (ou a atual, lida agora)
    const seenAfterStart = (next ? syncBefore(next.atMs) : lastSeen) >= SERIES_START;
    const hasText = !!d.lines && (seenAfterStart || !next);
    out.descs.push({ id: 'D' + (i + 1), lines: hasText ? d.lines : null, hasText, first_seen: first, last_seen: next ? syncBefore(next.atMs) : lastSeen, current: !next,
      prec: i === 0 ? 'publicacao' : d.prec, window: i === 0 ? null : [syncBefore(d.atMs), d.atMs], F: d.F || 1 });
  });
  return out;
}
function genericDesc(v) {
  const ch = CH[v.ch];
  return ch.lang === 'pt' ? ['Neste vídeo: ' + v._ver.titles[v._ver.titles.length - 1].text + '.', '', 'Me siga no Instagram: @' + ch.id.replace(/-/g, '')]
    : ['In this video: ' + v._ver.titles[v._ver.titles.length - 1].text + '.', '', 'Newsletter: https://' + ch.id.replace(/-/g, '') + '.com/news'];
}
videos.forEach(v => {
  const ver = buildVersions(v);
  v.titles = ver.titles; v.thumbs = ver.thumbs; v.descs = ver.descs;
  v.title = v.titles[v.titles.length - 1].text;
  v.thumb = v.thumbs[v.thumbs.length - 1].art;
  v.formulas = formulasOf(v.title);
  v.ageDays = Math.floor((NOW - v.pub) / DAY);
  delete v._ver;
});

/* ------------------------------------------------------------------ série diária de views */
function factorAt(v, i) { // produto dos F das trocas cujo 1º ponto pós-troca é ≤ i (intervalo i = SNAP(i)→SNAP(i+1))
  let f = 1;
  for (const arr of [v.titles, v.thumbs, v.descs]) arr.forEach((x, j) => { if (j > 0 && x.F !== 1 && x.first_seen >= SERIES_START && snapIdxAtOrAfter(x.first_seen) <= i) f *= x.F; });
  return f;
}
videos.forEach(v => {
  const ch = CH[v.ch], cfg = ch._cfg, B = cfg.B[v.fmt];
  const nr = rng('series|' + v.id);
  v.series = []; v.views = null; v.viewsAt = null; v.firstIdx = null;
  if (!v.tracked) return;
  if (ch.lastIdx == null) { // backfill: só a contagem da adição, sem série
    const x = (ch.sync.added - v.pub) / DAY; v.views = Math.round(B * (v.s || 1) * Gc(v.fmt, x)); v.viewsAt = ch.sync.added; return;
  }
  const f = Math.max(0, snapIdxAtOrAfter(v.pub));
  if (f > ch.lastIdx) return;          // publicado depois do último ponto do canal: ainda sem ponto diário
  v.firstIdx = f;
  const raw = []; let cum;
  const x0 = (SNAP(f) - v.pub) / DAY;
  cum = Gc(v.fmt, x0) * (v.pub >= SERIES_START ? (0.9 + 0.2 * nr()) : 1);
  raw.push(cum);
  for (let i = f; i < ch.lastIdx; i++) {
    const inc = (Gc(v.fmt, (SNAP(i + 1) - v.pub) / DAY) - Gc(v.fmt, (SNAP(i) - v.pub) / DAY)) * (0.9 + 0.2 * nr()) * factorAt(v, i);
    cum += inc; raw.push(cum);
  }
  const scale = v.target ? v.target / raw[raw.length - 1] : B * (v.s || 1);
  if (v.target) v.s = v.target / raw[raw.length - 1] / B;
  v.series = raw.map((y, j) => ({ idx: f + j, t: SNAP(f + j), views: Math.round(y * scale) }));
  if (v.target) v.series[v.series.length - 1].views = v.target;
  const last = v.series[v.series.length - 1]; v.views = last.views; v.viewsAt = last.t;
  // curtidas e comentários (vêm da Data API no sync)
  v.likes = Math.round(v.views * (0.025 + 0.02 * nr())); v.comments = Math.round(v.views * (0.0015 + 0.002 * nr()));
});
const S = (v, i) => { if (!v.series.length) return null; const p = v.series[i - v.firstIdx]; return p ? p.views : null; };
const ptTime = (v, i) => (i === v.firstIdx - 1 && v.pub >= SERIES_START) ? v.pub : SNAP(i);
const ptViews = (v, i) => (i === v.firstIdx - 1 && v.pub >= SERIES_START) ? 0 : S(v, i);
const earliestIdx = v => v.pub >= SERIES_START ? v.firstIdx - 1 : v.firstIdx;   // f−1 = ponto virtual da publicação (0 views)
const rate = (v, a, b) => { const va = ptViews(v, a), vb = ptViews(v, b); if (va == null || vb == null) return null; return (vb - va) / ((ptTime(v, b) - ptTime(v, a)) / DAY); };
/** views/dia desde 03/10 (ou desde a publicação) até o último ponto */
const vpdSince = v => { if (!v.series.length) return null; const a = earliestIdx(v), b = v.series[v.series.length - 1].idx; if (b - a < 1) return null; return rate(v, a, b); };
const vpd7 = v => { if (!v.series.length) return null; const b = v.series[v.series.length - 1].idx, a = b - 7; if (a < earliestIdx(v)) return null; return rate(v, a, b); };
videos.forEach(v => { v.vpd = vpdSince(v); v.vpd7 = vpd7(v); });

/* ------------------------------------------------------------------ comparação de descrição (linha a linha) */
const stripUtm = s => s.replace(/([?&])utm_[a-z]+=[^&\s]*/gi, '$1').replace(/[?&]+(?=\s|$)/g, '').replace(/\?&/g, '?');
function diffLines(a, b) {
  const A = a.map(stripUtm), Bn = b.map(stripUtm), n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === Bn[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === Bn[j]) { ops.push(a[i] === b[j] ? { op: 'ctx', text: b[j] } : { op: 'utm', from: a[i], text: b[j] }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { ops.push({ op: 'rem', text: a[i++] }); } else { ops.push({ op: 'add', text: b[j++] }); }
  }
  while (i < n) ops.push({ op: 'rem', text: a[i++] }); while (j < m) ops.push({ op: 'add', text: b[j++] });
  const add = ops.filter(o => o.op === 'add' && o.text.trim()).length, rem = ops.filter(o => o.op === 'rem' && o.text.trim()).length, utm = ops.filter(o => o.op === 'utm').length;
  return { lines: ops, add, rem, utm, label: '+' + add + ' ' + MINUS + rem + ' linhas' + (utm ? ' + ' + utm + ' UTM' : '') };
}

/* ------------------------------------------------------------------ trocas (por evento) */
const changes = [], CHG = {};
const TYPE_LABEL = { title: 'Título', thumb: 'Thumbnail', desc: 'Descrição' };
videos.forEach(v => {
  [['title', v.titles], ['thumb', v.thumbs], ['desc', v.descs]].forEach(([type, arr]) => {
    arr.forEach((ver, i) => {
      if (i === 0) return;
      const prev = arr[i - 1];
      const pre = ver.first_seen < SERIES_START;
      if (type === 'thumb' && pre) return;                         // thumbnails antes de 03/10 não são trocas confiáveis
      const c = { id: v.id + '/' + type + '/' + i, video: v.id, ch: v.ch, niche: v.niche, fmt: v.fmt, type, typeLabel: TYPE_LABEL[type], idx: i,
        at: ver.first_seen, prec: type === 'thumb' ? 'min' : (pre ? '1d' : '6h'), window: ver.window || null, preSeries: pre,
        before: null, after: null, fromId: prev.id, toId: ver.id };
      c.mid = c.window ? (c.window[0] + c.window[1]) / 2 : c.at;
      c.whenText = c.prec === 'min' ? date.dm(c.at) + ' ' + date.hm(c.at) : date.windowText(c.window[0], c.window[1]);
      c.agoMidText = date.ago(c.mid);
      c.agoShort = date.ago(c.at);   // "há 3 h" — a tela compõe e concorda ("vista", "visto", "vistas"…)
      c.agoText = c.window ? 'vista pela 1ª vez ' + date.ago(c.at) : date.ago(c.at);
      if (type === 'title') { c.before = prev.text; c.after = ver.text; }
      if (type === 'thumb') { c.before = { key: prev.key, art: prev.art }; c.after = { key: ver.key, art: ver.art }; c.prevLivedMs = prev.last_seen - prev.first_seen; c.nextLivedMs = ver.last_seen - ver.first_seen;
        // volta a um valor anterior (A→B→A)
        const earlier = arr.slice(0, i - 1).map(x => x.key); c.revertTo = earlier.includes(ver.key) ? ver.key : null;
        if (c.revertTo) { const left = arr.slice(0, i).reverse().find(x => x.key === ver.key && x !== ver); const leftAt = left ? left.last_seen : null; c.cycleMs = leftAt ? ver.first_seen - leftAt : null;
          c.testCompare = c.cycleMs != null && c.cycleMs <= RULES.testCompareMaxDays * DAY; } }
      if (type === 'desc') {
        if (prev.hasText && ver.hasText && !pre) { c.diff = diffLines(prev.lines, ver.lines); c.hasText = true; }
        else { c.diff = null; c.hasText = false; c.noTextReason = 'Antes de 03/10 a sincronização só registrava que a descrição mudou, sem guardar o texto.'; }
      }
      if (type !== 'thumb') { c.prevLivedMs = prev.last_seen - prev.first_seen; }
      changes.push(c); CHG[c.id] = c;
    });
  });
});
changes.forEach(c => { if (c.type === 'thumb' && c.revertTo) { const leg = changes.find(o => o.video === c.video && o.type === 'thumb' && o.idx === c.idx - 1); if (leg) { leg.revertedBy = c.id; leg.testCompare = c.testCompare; leg.cycleMs = c.cycleMs; } } });
changes.sort((a, b) => b.at - a.at);
// trocas do mesmo vídeo em campos diferentes na mesma janela ou a < 48 h
changes.forEach(c => {
  const sib = changes.filter(o => o !== c && o.video === c.video && o.type !== c.type);
  c.sameWindow = sib.filter(o => { const a = c.window || [c.at, c.at], b = o.window || [o.at, o.at]; return (c.prec === '6h' && o.prec === 'min' && o.at > a[0] && o.at <= a[1]) || (o.prec === '6h' && c.prec === 'min' && c.at > b[0] && c.at <= b[1]) || (c.window && o.window && c.window[1] === o.window[1]); }).map(o => o.id);
  c.within48h = sib.filter(o => Math.abs(o.mid - c.mid) < RULES.effect.simultHours * H).map(o => o.id);
});

/* ------------------------------------------------------------------ efeito da troca (mudanças e histórico usam o MESMO) */
const changedSince = v => [v.titles, v.thumbs, v.descs].some(arr => arr.some((x, j) => j > 0 && x.first_seen >= SERIES_START));
const firstRealIdx = v => v.firstIdx;   // 1º registro diário (o trecho publicação → 1º registro tem < 24 h e fica fora do "antes")
function ratioAt(u, k, b, Lcap) { // (views/dia nos 7 dias depois de k) / (views/dia nos b dias antes de k−1) − 1
  const end = k - 1, start = end - b;
  if (start < firstRealIdx(u) || k + 7 > Math.min(u.series[u.series.length - 1].idx, Lcap == null ? 1e9 : Lcap)) return null;
  const rb = rate(u, start, end), ra = rate(u, k, k + 7);
  if (rb == null || ra == null || rb <= 0) return null;
  return { r: ra / rb - 1, rb, ra };
}
const effectCache = {};
function effect(changeId) { return effectAt(changeId, null); }
function effectAt(changeId, Lcap) {
  const ckey = changeId + '@' + (Lcap == null ? '' : Lcap);
  if (effectCache[ckey]) return effectCache[ckey];
  const c = CHG[changeId]; if (!c) return null;
  const v = V[c.video], ch = CH[v.ch];
  const res = { id: c.id, type: c.type };
  const done = x => (effectCache[ckey] = Object.assign(res, x));
  if (c.preSeries) return done({ status: 'sem-serie', label: 'sem série', reason: 'Sem série antes da troca (coleta por vídeo desde 03/10).' });
  if (!v.series.length || ch.lastIdx == null) return done({ status: 'sem-serie', label: 'sem série', reason: 'Vídeo sem série diária de views.' });
  const k = snapIdxAtOrAfter(c.at), L = Lcap == null ? ch.lastIdx : Math.min(ch.lastIdx, Lcap);
  const beforeDays = Math.max(0, Math.min(RULES.effect.maxBeforeDays, (k - 1) - firstRealIdx(v)));   // sem o trecho de < 24 h da estreia
  const afterDays = Math.max(0, Math.min(7, L - k));
  const wdR = date.weekday(SNAP(k + 7));
  Object.assign(res, { k, beforeDays, afterDays, readyOn: SNAP(k + 7), readyText: null, readyTextIfPending: 'leitura ' + (/^(segunda|terça|quarta|quinta|sexta)/.test(wdR) ? 'na ' : 'no ') + wdR + ', ' + date.dm(SNAP(k + 7)), firstPointAfter: SNAP(k) });
  const dRow = i => ({ idx: i + 1, from: ptTime(v, i), to: ptTime(v, i + 1), vpd: rate(v, i, i + 1) });
  res.daily = { before: Array.from({ length: beforeDays }, (_, j) => dRow(k - 1 - beforeDays + j)), changeDay: k >= 1 && k - 1 >= earliestIdx(v) ? dRow(k - 1) : null, after: Array.from({ length: afterDays }, (_, j) => dRow(k + j)) };
  const simul = c.sameWindow.length ? 'same' : c.within48h.length ? '48h' : null;
  const simulTxt = simul === 'same' ? 'Dois campos do mesmo vídeo mudaram na mesma janela de sincronização: o efeito é dos dois e não dá para separar.'
    : simul === '48h' ? 'Outro campo do mesmo vídeo mudou a menos de 48 h: não dá para separar o efeito de cada um.' : null;
  if (beforeDays === 0) return done({ status: 'sem-antes', label: 'sem base', reason: 'A versão anterior durou menos de 1 dia, antes do primeiro registro diário: sem dias antes para comparar.' });
  if (afterDays < 7) {
    return done({ readyText: res.readyTextIfPending, status: 'aguardando', label: 'aguardando', collected: afterDays,
      reason: 'aguardando — ' + afterDays + ' de 7 dias coletados, leitura em ' + date.dm(SNAP(k + 7)),
      willBeInconclusive: simulTxt || (beforeDays <= 2 ? 'Antes: ' + beforeDays + (beforeDays === 1 ? ' dia' : ' dias') + ' — pouco para comparar.' : null),
      willBeInconclusiveShort: simul === 'same' ? 'dois campos do vídeo mudaram na mesma janela de sincronização' : simul === '48h' ? 'outro campo do vídeo mudou a menos de 48 h' : beforeDays <= 2 ? 'só ' + fmt.plural(beforeDays, 'dia', 'dias') + ' antes da troca' : null,
      waitText: 'Aguardando: ' + afterDays + ' de 7 dias coletados, ' + res.readyTextIfPending + '.' + ((simul || beforeDays <= 2) ? ' Vai sair inconclusivo: ' + (simul === 'same' ? 'dois campos do vídeo mudaram na mesma janela de sincronização' : simul === '48h' ? 'outro campo do vídeo mudou a menos de 48 h' : 'só ' + fmt.plural(beforeDays, 'dia', 'dias') + ' antes da troca') + '.' : '') });
  }
  // observado
  const ob = ratioAt(v, k, beforeDays, L);
  // esperado: vídeos NÃO trocados do mesmo canal, formato e faixa de idade, nos mesmos dias de vida
  const ageAtK = (SNAP(k) - v.pub) / DAY, band = bandOf(Math.floor(ageAtK));
  const sameDay = v.pub >= SERIES_START;
  const peers = ch.videos.filter(u => u !== v && u.fmt === v.fmt && u.series.length && !changedSince(u));
  const byBand = () => { const out = []; peers.forEach(u => {
      let best = null;
      for (let ku = firstRealIdx(u) + beforeDays + 1; ku + 7 <= L; ku++) {
        const a = Math.floor((SNAP(ku) - u.pub) / DAY); if (bandOf(a) !== band) continue;
        if (best == null || Math.abs(a - ageAtK) < Math.abs(Math.floor((SNAP(best) - u.pub) / DAY) - ageAtK)) best = ku;
      }
      if (best != null) { const x = ratioAt(u, best, beforeDays, L); if (x) out.push(x.r); } }); return out; };
  let rs = [], methodUsed = 'aproximação por faixa', sameDayN = null;
  if (sameDay) {
    peers.forEach(u => { if (u.pub < SERIES_START) return; const x = ratioAt(u, u.firstIdx + (k - v.firstIdx), beforeDays, L); if (x) rs.push(x.r); });
    sameDayN = rs.length;
    if (rs.length >= RULES.weakBase) methodUsed = 'mesmo dia de vida'; else rs = byBand();   // fallback: poucos vídeos com série desde o dia 0
  } else rs = byBand();
  const n = rs.length, exp = median(rs), q1 = quant(rs, .25), q3 = quant(rs, .75);
  res.noBaseText = n === 0 ? 'sem base de comparação: nenhum outro vídeo do canal na faixa ' + band.label + ' (n = 0)' : null;
  const eff = exp == null ? null : (ob.r - exp) * 100;
  Object.assign(res, { observed: ob.r, beforeAvg: ob.rb, afterAvg: ob.ra, expected: exp, iqr: [q1, q3], n, effectPp: eff, band: band.label,
    method: methodUsed, methodLabel: 'método: ' + methodUsed, methodFallback: sameDay && methodUsed !== 'mesmo dia de vida', sameDayN,
    fallbackText: sameDay && methodUsed !== 'mesmo dia de vida' ? 'método: aproximação por faixa — menos de 3 vídeos do canal com série desde o dia 0' : null,
    numbers: 'observado ' + fmt.pct(ob.r) + ' · esperado ' + fmt.pct(exp) + ' (n = ' + n + ')', numbersFlat: 'observado ' + fmt.pct(ob.r) + ' · esperado ' + fmt.pct(exp) + ' · n = ' + n });
  const nextVer = (c.type === 'title' ? v.titles : c.type === 'thumb' ? v.thumbs : v.descs)[c.idx];
  if (!nextVer.current && nextVer.last_seen - nextVer.first_seen < DAY) return done({ inconclusiveKind: 'versao-curta', status: 'inconclusivo', label: 'inconclusivo', reason: 'A nova versão ficou menos de 1 dia no ar (' + date.dur(nextVer.last_seen - nextVer.first_seen) + '): com um registro de views por dia não dá para isolar.' });
  if (c.prevLivedMs != null && c.prevLivedMs < DAY) return done({ inconclusiveKind: 'versao-curta', status: 'inconclusivo', label: 'inconclusivo', reason: 'A versão anterior ficou menos de 1 dia no ar (' + date.dur(c.prevLivedMs) + '): pouco para comparar.' });
  if (simulTxt) return done({ inconclusiveKind: 'janela-dupla', status: 'inconclusivo', label: 'inconclusivo', reason: simulTxt });
  if (beforeDays <= 2) return done({ inconclusiveKind: 'antes-curto', status: 'inconclusivo', label: 'inconclusivo', reason: 'Antes: ' + beforeDays + (beforeDays === 1 ? ' dia' : ' dias') + ' — pouco para comparar.' });
  if (n < RULES.effect.minN) return done({ inconclusiveKind: 'outro', status: 'inconclusivo', label: 'inconclusivo', reason: 'Poucos vídeos do canal para comparar (n = ' + n + ', mínimo ' + RULES.effect.minN + ').' });
  const out = ob.r < q1 || ob.r > q3;
  if (eff > RULES.effect.pp && out) return done({ status: 'ganhou', label: 'ganhou', reason: 'Efeito ' + fmt.pp(eff) + ': acima de +10 pp e fora da faixa normal (' + fmt.pct(q1) + ' a ' + fmt.pct(q3) + ').' });
  if (eff < -RULES.effect.pp && out) return done({ status: 'perdeu', label: 'perdeu', reason: 'Efeito ' + fmt.pp(eff) + ': abaixo de −10 pp e fora da faixa normal (' + fmt.pct(q1) + ' a ' + fmt.pct(q3) + ').' });
  const small = Math.abs(eff) < RULES.effect.pp;
  return done({ status: 'neutro', label: 'neutro', neutralWhy: small && !out ? 'ambos' : small ? 'menor-que-10pp' : 'dentro-da-faixa',
    reason: 'Efeito ' + fmt.pp(eff) + ': ' + (small && !out ? 'abaixo de 10 pp e dentro da faixa normal (' + fmt.pct(q1) + ' a ' + fmt.pct(q3) + ')'
      : small ? 'fora da faixa normal (' + fmt.pct(q1) + ' a ' + fmt.pct(q3) + '), mas abaixo de 10 pp'
      : 'acima de 10 pp, mas dentro da faixa normal (' + fmt.pct(q1) + ' a ' + fmt.pct(q3) + ')') + '.' });
}
/* contexto da troca: outras trocas do mesmo vídeo dentro dos 7 dias depois (ressalva, não muda o veredito) */
function caveats(changeId) {
  const c = CHG[changeId]; const v = V[c.video]; const k = snapIdxAtOrAfter(c.at);
  return changes.filter(o => o.video === v.id && o !== c && o.at > c.at && snapIdxAtOrAfter(o.at) < k + 7 && !c.within48h.includes(o.id))
    .map(o => o.typeLabel + ' mudou ' + (o.prec === 'min' ? 'em ' : '') + o.whenText + ', dentro dos 7 dias depois.');
}

/* ------------------------------------------------------------------ multiplicador ajustado pela idade */
function viewsAtAge(u, ageMs, tMax) { // views de u com a idade ageMs, se a série cobre (até o registro tMax)
  const T = u.pub + ageMs, lastI = Math.min(u.series[u.series.length - 1].idx, tMax == null ? 1e9 : tMax);
  if (T > SNAP(lastI) + 1) return null;
  let a = earliestIdx(u);
  for (let i = a; i <= lastI; i++) { if (ptTime(u, i) <= T) a = i; else break; }
  if (ptTime(u, a) === T || a === lastI) return ptViews(u, a);
  const b = a + 1, ta = ptTime(u, a), tb = ptTime(u, b);
  return ptViews(u, a) + (ptViews(u, b) - ptViews(u, a)) * (T - ta) / (tb - ta);
}
function multiplierAt(v, t) {
  const ch = CH[v.ch];
  if (t == null) t = ch.lastIdx;
  const own = (v.series.length && t != null) ? S(v, Math.min(t, v.series[v.series.length - 1].idx)) : v.views;
  if (own == null) return { value: null, method: null, n: 0, weak: true, reason: v.tracked ? 'sem série' : 'fora dos vídeos acompanhados' };
  const tTime = t != null ? SNAP(t) : v.viewsAt;
  const others = ch.videos.filter(u => u !== v && u.tracked && u.fmt === v.fmt && u.pub < tTime && (u.series.length ? S(u, t) != null : u.views != null));
  const totalOf = u => u.series.length ? S(u, t) : u.views;
  let dayFallbackN = null;
  if (v.pub >= SERIES_START && v.series.length) {
    // mesmo dia de vida: views dos outros vídeos na MESMA idade (em horas desde a publicação), interpolando entre registros diários
    const ageMs = tTime - v.pub, d = Math.floor(ageMs / DAY);
    const base = others.filter(u => u.pub >= SERIES_START && u.series.length).map(u => viewsAtAge(u, ageMs, t)).filter(x => x != null);
    if (base.length >= RULES.weakBase) {
      const m = median(base);
      return { ageAtRead: Math.floor((tTime - v.pub) / DAY), readAt: tTime, readNote: '', value: own / m, method: 'mesmo dia de vida', lifeDay: d, n: base.length, base: m, weak: false, fallback: false,
        label: fmt.mult(own / m) + ' vs vídeos do canal no mesmo dia de vida (dia ' + d + ', n = ' + base.length + ')' };
    }
    dayFallbackN = base.length;
  }
  const age = Math.floor((tTime - v.pub) / DAY), band = bandOf(age);
  const readDiff = bandOf(age) !== bandOf(v.ageDays), readNote = readDiff ? ' no registro de ' + date.dmhm(tTime) + ' (este tinha ' + fmt.plural(age, 'dia', 'dias') + ')' : '';
  const bb = others.filter(u => bandOf(Math.floor((tTime - u.pub) / DAY)) === band).map(totalOf);
  const m = median(bb), weak = bb.length < RULES.weakBase;
  return { value: bb.length ? own / m : null, method: 'aproximação por faixa', band: band.label, bandId: band.id, n: bb.length, base: m, weak,
    fallback: dayFallbackN != null, dayN: dayFallbackN,
    fallbackText: dayFallbackN != null ? 'método: aproximação por faixa — menos de 3 vídeos do canal com série desde o dia 0' : null,
    ageAtRead: age, readAt: tTime, readNote,
    label: bb.length ? fmt.mult(own / m) + ' vs vídeos do canal com ' + band.label + (readDiff ? readNote.replace(/\)$/, '; n = ' + bb.length + ')') : ' (n = ' + bb.length + ')') + (weak ? ' — base fraca' : '') : 'sem vídeos do canal nessa faixa' };
}
const multCache = {};
function multiplier(videoId) { if (!multCache[videoId]) multCache[videoId] = multiplierAt(V[videoId]); return multCache[videoId]; }
videos.forEach(v => { v.mult = multiplier(v.id); });

/* ------------------------------------------------------------------ estatísticas de canal */
function median7(ch, fmtId) { return median(ch.videos.filter(v => v.tracked && v.fmt === fmtId && v.vpd7 != null).map(v => v.vpd7)); }
function channelVpdMedian(ch, fmtId) { const a = ch.videos.filter(v => v.tracked && v.fmt === fmtId && v.vpd != null).map(v => v.vpd); return { value: median(a), n: a.length }; }

/* ------------------------------------------------------------------ outliers */
function phaseOf(v, o) {
  const ch = CH[v.ch]; const m7 = o && 'm7' in o ? o.m7 : median7(ch, v.fmt);
  if (ch.sync.state === 'atrasado' || ch.sync.state === 'erro') return { id: 'sem-ritmo', label: 'sem ritmo medido', why: 'sincronização ' + (ch.sync.state === 'erro' ? 'com erro' : 'atrasada') + ' desde ' + date.dm(ch.sync.last) + ' ' + date.hm(ch.sync.last) + ': o ritmo dos últimos 7 dias não está medido' };
  if (ch.sync.state === 'backfill') return { id: 'sem-ritmo', label: 'sem ritmo medido', why: 'canal ainda buscando vídeos: sem série diária' };
  if (v.vpd7 == null) return { id: 'novos', label: 'Novos', why: 'menos de 7 dias de série' };   // canal em dia, vídeo com menos de 7 dias de série
  if (m7 == null) {   // canal em dia sem mediana: fica na fase da idade (sem ritmo para comparar), nunca "sem ritmo medido"
    if (v.ageDays <= 90) return { id: 'recente', label: 'recentes', why: (v.ageDays <= 30 ? 'até 30 dias' : 'de 31 a 90 dias') + '; sem mediana de views/dia (7 d) no canal para comparar o ritmo', noMedian: true };
    return { id: 'antigo', label: 'antigos', why: 'mais de 90 dias; sem mediana de views/dia (7 d) no canal para comparar o ritmo', noMedian: true };
  }
  if (v.ageDays <= 30 && v.vpd7 >= 2 * m7) return { id: 'estourando', label: 'estourando agora', why: 'views/dia (7 d) ' + fmt.mult(RULES.outlierMin) + ' ou mais a mediana do canal' };
  if (v.ageDays <= 90) return { id: 'recente', label: 'recentes', why: v.ageDays <= 30 ? 'até 30 dias, mas views/dia (7 d) abaixo de 2× a mediana do canal' : 'de 31 a 90 dias; "estourando agora" só até 30 dias' };
  if (v.vpd7 >= m7) return { id: 'perene', label: 'perenes', why: 'mais de 90 dias e views/dia (7 d) ainda acima da mediana do canal' };
  return { id: 'antigo', label: 'antigos', why: 'mais de 90 dias e views/dia (7 d) abaixo da mediana do canal' };
}
const PHASES = [
  { id: 'estourando', label: 'estourando agora', why: 'até 30 dias e views/dia (7 d) ' + fmt.mult(RULES.outlierMin) + ' ou mais a mediana do canal' },
  { id: 'recente', label: 'recentes', why: 'até 90 dias' },
  { id: 'perene', label: 'perenes', why: 'mais de 90 dias e views/dia (7 d) ainda acima da mediana do canal' },
  { id: 'antigo', label: 'antigos', why: 'mais de 90 dias e views/dia (7 d) abaixo da mediana do canal' },
  { id: 'novos', label: 'Novos', why: 'menos de 7 dias de série' },
  { id: 'sem-ritmo', label: 'sem ritmo medido', why: 'canal com sincronização atrasada, com erro ou ainda buscando vídeos' },
];
function inNiche(niche, x) { return !niche || niche === 'todos' || niche === 'all' || x.niche === niche; }
function outliers(opts) {
  opts = Object.assign({ niche: 'todos', fmt: 'long', ages: DEFAULT_AGES, min: RULES.outlierMin, theme: null, formula: null, channel: null, channels: null, maxAge: null, includeOwn: false }, opts || {});
  if (opts.topic && !opts.theme) opts.theme = opts.topic;
  let scope = null;
  if (opts.reading) { scope = readingScope(opts.reading, { formula: opts.formula, theme: opts.theme, min: opts.min, channel: opts.channel }); if (!scope) opts.readingInvalid = true; if (scope) { opts.channels = opts.channels || scope.channels; opts.fmt = scope.fmt; opts.niche = scope.niche; if (!opts.agesExplicit) { opts.ages = scope.ages; opts.maxAge = scope.windowDays; } } }
  const ages = opts.ages === 'all' ? OUT_WINDOWS.map(w => w.id) : opts.ages;
  const pool = videos.filter(v => v.tracked && v.fmt === opts.fmt && inNiche(opts.niche, v) && (opts.includeOwn || !CH[v.ch].own) && (!opts.channel || v.ch === opts.channel) && (!opts.channels || opts.channels.includes(v.ch)) && (opts.maxAge == null || v.ageDays <= opts.maxAge));
  const passes = v => v.mult.value != null && (!v.mult.weak || opts.includeWeak) && v.mult.value >= opts.min && (!opts.theme || v.theme === opts.theme) && (!opts.formula || v.formulas.includes(opts.formula));
  const byAge = {}; OUT_WINDOWS.forEach(w => { byAge[w.id] = pool.filter(v => winOf(v.ageDays).id === w.id && passes(v) && !v.mult.weak).length; });
  const items = pool.filter(v => ages.includes(winOf(v.ageDays).id) && passes(v)).map(v => ({ id: v.id, video: v, mult: v.mult, weak: !!v.mult.weak, phase: phaseOf(v), window: winOf(v.ageDays).id, ageDays: v.ageDays }))
    .sort((a, b) => b.mult.value - a.mult.value);
  const byPhase = {}; items.forEach(x => { if (!x.weak) byPhase[x.phase.id] = (byPhase[x.phase.id] || 0) + 1; });
  const analyzed = pool.filter(v => ages.includes(winOf(v.ageDays).id)).length;
  const untracked = videos.filter(v => !v.tracked && v.fmt === opts.fmt && inNiche(opts.niche, v) && !CH[v.ch].own && (!opts.channel || v.ch === opts.channel) && ages.includes(winOf(v.ageDays).id)).length;
  const weak = pool.filter(v => ages.includes(winOf(v.ageDays).id) && v.mult.weak && v.mult.value != null && v.mult.value >= opts.min).length;
  /* ordem oficial de exibição (a mesma do outliers.html): ordenação estável sobre a ordem por multiplicador;
     min < 2 → grupos "2× ou mais" e "abaixo de 2×"; sort ≠ mult → lista única; senão grupos por fase na ordem de PHASES */
  const vpdKey = it => (['atrasado', 'erro'].includes(CH[it.video.ch].sync.state)) ? -2 : ((it.video.vpd7 != null ? it.video.vpd7 : it.video.vpd) != null ? (it.video.vpd7 != null ? it.video.vpd7 : it.video.vpd) : -1);
  const orderedGroups = sort => { sort = sort || 'mult'; const its = items.slice();
    if (sort === 'vpd') its.sort((a, b) => vpdKey(b) - vpdKey(a)); else if (sort === 'recent') its.sort((a, b) => b.video.pub - a.video.pub);
    const nm = opts.min != null && opts.min < RULES.outlierMin, flat = sort !== 'mult' || nm;
    const g = nm ? [{ k: 'above', items: its.filter(it => it.mult.value >= RULES.outlierMin) }, { k: 'below', items: its.filter(it => it.mult.value < RULES.outlierMin) }]
      : flat ? [{ k: 'flat', items: its }] : PHASES.map(p => ({ k: p.id, items: its.filter(it => it.phase.id === p.id) }));
    return g.filter(x => x.items.length).map(x => ({ k: x.k, ids: x.items.map(it => it.id) })); };
  const orderedIds = sort => orderedGroups(sort).flatMap(g => g.ids);
  return { orderedIds, orderedGroups, scope, readingInvalid: !!opts.readingInvalid, items, count: items.filter(x => !x.weak).length, countWithWeak: items.length, byAge, byPhase, analyzed, untracked, weakExcluded: weak, opts };
}

/* ------------------------------------------------------------------ trocas: filtros e contagens */
function changesIn(o) {
  o = Object.assign({ days: 30, niche: 'todos', type: null, channel: null, video: null, fmt: null }, o || {});
  return changes.filter(c => (o.days == null || c.at > NOW - o.days * DAY) && inNiche(o.niche, c) && (!o.type || c.type === o.type) && (!o.channel || c.ch === o.channel) && (!o.video || c.video === o.video) && (!o.fmt || c.fmt === o.fmt) && !CH[c.ch].own);
}
function tabCounts(niche) {
  niche = niche || 'todos';
  return { canais: channels.filter(c => !c.own && inNiche(niche, c)).length, mud: changesIn({ days: 30, niche }).length, out: outliers({ niche, fmt: 'long', ages: DEFAULT_AGES }).count };
}
const TAB_TITLES = {
  canais: n => n + ' canais monitorados',
  mud: n => n + ' trocas nos últimos 30 dias (título, thumbnail e descrição; longos e Shorts; contadas por evento)',
  out: n => n + ' vídeos longos de até 90 dias com 2× ou mais a mediana do canal',
};

/* ------------------------------------------------------------------ cadência e estatísticas por canal */
function cadence(channelId, fmtId) {
  const ch = CH[channelId]; fmtId = fmtId || 'long';
  const W = RULES.habit.weeks, from = NOW - W * 7 * DAY;
  const vs = ch.videos.filter(v => v.fmt === fmtId && v.pub > from);
  const weeks = Array.from({ length: W }, (_, w) => { const a = from + w * 7 * DAY, b = a + 7 * DAY; return { from: a, to: b, n: vs.filter(v => v.pub > a && v.pub <= b).length }; });
  const pw = Math.round(vs.length / W * 10) / 10;
  const pairs = {}; vs.forEach(v => { const p = parts(v.pub); const k = p.dow + '|' + p.h; pairs[k] = (pairs[k] || 0) + 1; });
  const best = Object.entries(pairs).sort((a, b) => b[1] - a[1])[0];
  let habit;
  if (best && best[1] >= RULES.habit.minCount && best[1] / vs.length >= RULES.habit.minShare) {
    const [dow, h] = best[0].split('|').map(Number);
    habit = { costuma: true, dow, hour: h, n: best[1], total: vs.length, share: best[1] / vs.length, text: 'costuma publicar ' + WD[dow] + ' às ' + p2(h) + ':00 (' + best[1] + ' de ' + vs.length + ')' };
  } else habit = { costuma: false, n: vs.length, text: vs.length ? 'horário variado (n = ' + vs.length + ')' : 'nenhum vídeo em 13 semanas' };
  const all = ch.videos.filter(v => v.fmt === fmtId);
  const last = all[0] || null;
  const partial = ch.sync.state === 'backfill', fetchedSince = partial && ch.videos.length ? ch.videos[ch.videos.length - 1].pub : null;
  return { channel: channelId, fmt: fmtId, weeks, pw, n: vs.length, habit, lastUpload: last ? last.pub : null, lastUploadAgo: last ? date.ago(last.pub) : null,
    partial, fetchedSince, partialText: partial ? 'ritmo parcial: só os ' + ch.sync.backfill.done + ' vídeos mais recentes foram buscados (desde ' + date.dmOrDmy(fetchedSince) + ')' : null };
}
function snapAt(ch, ms) { const s = ch.snapshots; let best = null; for (const x of s) { if (x.t <= ms) best = x; else break; } return best; }
function channelStats(channelId, fmtId) {
  const ch = CH[channelId]; fmtId = fmtId || 'long';
  const vp = channelVpdMedian(ch, fmtId);
  const outs = outliers({ niche: 'todos', fmt: fmtId, ages: DEFAULT_AGES, channel: channelId, includeOwn: ch.own });
  const now = ch.snapshots.length ? ch.snapshots[ch.snapshots.length - 1] : null, prev = now ? snapAt(ch, now.t - 30 * DAY) : null;
  const growth = (now && prev && now.t - prev.t >= 29 * DAY) ? { abs: now.subs - prev.subs, pct: (now.subs - prev.subs) / prev.subs, from: prev.t, to: now.t }
    : { abs: null, pct: null, pending: now ? 'faltam ' + Math.ceil(30 - (now.t - ch.snapshots[0].t) / DAY) + ' d (primeira contagem ' + date.dm(ch.snapshots[0].t) + ')' : 'sem contagem' };
  const mults = ch.videos.filter(v => v.tracked && v.fmt === fmtId && v.ageDays <= 90 && v.mult.value != null && !v.mult.weak).map(v => v.mult.value);
  return {
    channel: channelId, fmt: fmtId,
    vpdMedian: vp.value, vpdN: vp.n, vpdWindow: 'desde 03/10',
    perMilSubs: vp.value != null ? vp.value / (ch.subs / 1000) : null,
    typicalMult: median(mults), typicalMultN: mults.length,
    bestOutlier: outs.items[0] || null, outliers90: outs.count,
    changes30: changesIn({ days: 30, channel: channelId }).length,
    growth30: Object.assign(growth, roundingOf(ch, growth)),
    maxMultBelowMin: maxBelow(ch, fmtId),
    pctOutliers: pctOutliersOf(ch, fmtId), pctOutliersN: ch.videos.filter(v => v.tracked && v.fmt === fmtId && v.ageDays <= 90 && v.mult && v.mult.value != null && !v.mult.weak).length,
    vpd7Median: median7(ch, fmtId),
    engagement: engagementOf(ch, fmtId),
    tracked: ch.videos.filter(v => v.tracked).length, total: ch.videos.length, video_limit: ch.video_limit,
    syncText: syncText(ch),
  };
}
function syncText(ch) {
  const s = ch.sync;
  if (s.state === 'backfill') return 'adicionado ' + date.ago(s.added) + ' — ' + s.backfill.done + ' de ' + s.backfill.total + ' vídeos buscados';
  if (s.state === 'erro') return 'sem sincronização desde ' + date.dm(s.last) + ' ' + date.hm(s.last) + ' — ' + s.msg;
  if (s.state === 'atrasado') return 'atrasado: última sincronização ' + date.dm(s.last) + ' ' + date.hm(s.last) + ' (' + date.agoHours(s.last) + ')';
  return 'sincronizado ' + date.ago(s.last).replace(/^agora$/, 'agora');
}

/* ------------------------------------------------------------------ snapshots diários de canal (desde 31/05) */
function sig3(x) { if (x < 1000) return x; const u = Math.pow(10, Math.floor(Math.log10(x)) - 2); return Math.round(x / u) * u; }
channels.forEach(ch => {
  const g = ch._cfg.growth30, r = rng('chsnap|' + ch.id);
  ch.snapshots = [];
  const lastOk = ch.sync.last;
  const start = ch.sync.state === 'backfill' ? ch.sync.added : OBS_START;
  const totalViews = ch.videos.reduce((a, v) => a + (v.views || 0), 0) * (ch.video_limit < ch.videos.length ? 1.6 : 1.1) + ch.subs * 40;
  // regime: diário às 09:00 de 31/05 a 02/10; às 12:00 desde 03/10 (1 por dia), até a última sincronização ok
  const times = [];
  if (ch.sync.state === 'backfill') times.push(ch.sync.added);
  else {
    for (let t = start; t < SERIES_START; t += DAY) times.push(t);
    for (let i = 0; i <= ch.lastIdx; i++) times.push(SNAP(i));
  }
  for (const t of times) {
    const daysBefore = (NOW - t) / DAY;
    const subsRaw = g == null ? ch.subs : Math.round(ch.subs / Math.pow(1 + g, daysBefore / 30) * (1 + (r() - .5) * 0.0004));
    const subs = sig3(subsRaw);   // a API do YouTube devolve inscritos com 3 algarismos significativos
    const views = Math.round(totalViews * (1 - daysBefore * 0.0012));
    ch.snapshots.push({ t, date: date.dmy(t), subs, views });
  }
});

/* ------------------------------------------------------------------ forja: leituras congeladas */
/* idade única para leituras, "desde então" e Outliers: dias inteiros; hoje = video.ageDays (relativo a NOW) */
function ageAtIdx(v, t) { return t >= LAST_IDX ? v.ageDays : Math.floor((SNAP(t) - v.pub) / DAY); }
function baseAt(niche, t, windowDays, forceChannels, fmtId) {
  fmtId = fmtId || 'long';
  // dados enviados à forja: vídeos longos do nicho publicados até SNAP(t), com idade ≤ windowDays, de canais sincronizados há ≤ 24 h naquele momento
  const tTime = SNAP(t);
  const excluded = channels.filter(ch => !ch.own && inNiche(niche, ch) && (ch.sync.state === 'backfill' && ch.sync.added > tTime ? false : ch.lastIdx != null && ch.lastIdx < t - 1));
  const chs = forceChannels ? forceChannels.map(id => CH[id]) : channels.filter(ch => !ch.own && inNiche(niche, ch) && ch.lastIdx != null && ch.lastIdx >= t - 1);
  const vids = [];
  chs.forEach(ch => ch.videos.forEach(v => {
    if (!v.tracked || v.fmt !== fmtId || v.pub >= tTime || ageAtIdx(v, t) > windowDays || !v.series.length || S(v, Math.min(t, ch.lastIdx)) == null) return;
    const m = multiplierAt(v, Math.min(t, ch.lastIdx));
    if (m.value == null) return;
    const titleThen = [...v.titles].reverse().find(x => x.first_seen <= tTime) || v.titles[0];
    vids.push({ id: v.id, ch: v.ch, title: titleThen.text, theme: v.theme, formulas: formulasOf(titleThen.text), mult: m.value, weak: m.weak, method: m.method, n: m.n });
  }));
  return { fmt: fmtId, t, asOf: tTime, niche, windowDays, channels: chs.map(c => c.id), excluded: excluded.map(c => c.id), videos: vids };
}
function analyzePatterns(base) {
  const ok = base.videos.filter(v => !v.weak);
  const outs = ok.filter(v => v.mult >= RULES.outlierMin);
  const pats = FORMULAS.filter(f => f.niches.includes(base.niche)).map(f => {
    const use = ok.filter(v => v.formulas.includes(f.id)), not = ok.filter(v => !v.formulas.includes(f.id));
    const medUse = median(use.map(v => v.mult)), medNot = median(not.map(v => v.mult));
    const diff = medUse != null && medNot != null ? medUse - medNot : null;
    const ev = outs.filter(v => v.formulas.includes(f.id)).sort((a, b) => b.mult - a.mult);
    let verdict;
    if (use.length < RULES.pattern.minN) verdict = { id: 'recorrencia', text: f.label + ': ' + (use.length === 0 ? 'nenhum título com essa fórmula (n = 0)' : use.length === 1 ? 'caso isolado (n = 1) — pouco para concluir' : 'recorrência observada (n = ' + use.length + ') — pouco para concluir') };
    else if (diff >= RULES.pattern.minDiff) verdict = { id: 'padrao', text: f.label + ': mediana ' + fmt.mult(medUse) + ' com vs ' + fmt.mult(medNot) + ' sem (n = ' + use.length + ' vs ' + not.length + ')' };
    else verdict = { id: 'sem-diferenca', text: f.label + ': sem diferença que passe a regra (' + fmt.mult(medUse) + ' com vs ' + fmt.mult(medNot) + ' sem, n = ' + use.length + ')' };
    return { formula: f.id, label: f.label, nUse: use.length, nNot: not.length, medUse, medNot, diff, verdict, evidence: ev.map(v => v.id), attribution: ev.length ? attribution(ev, { one: 'outlier com essa fórmula', many: 'outliers com essa fórmula' }) : attribution(use, { one: 'vídeo com essa fórmula', many: 'vídeos com essa fórmula' }) };
  });
  return { patterns: pats, outliers: outs.map(v => v.id), nOutliers: outs.length, dominantTheme: dominantTheme(outs) };
}
function attribution(list, noun) { const a = attribution0(list, noun); if (a && a.text) { a.textMid = a.text; a.textStart = a.text.charAt(0).toUpperCase() + a.text.slice(1); } return a; }
function attribution0(list, noun) {
  noun = noun || { one: 'outlier', many: 'outliers' };
  const by = {}; list.forEach(v => { by[v.ch] = (by[v.ch] || 0) + 1; });
  const e = Object.entries(by).sort((a, b) => b[1] - a[1]); const tot = list.length;
  if (!tot) return { kind: 'vazio', text: 'nenhum vídeo' };
  const [c1, n1] = e[0], second = e[1], third = e[2];
  if (tot === 1) return { kind: 'unico', channel: c1, n: 1, n1: 1, total: 1, text: '1 ' + noun.one + ': ' + CH[c1].name };
  const tail = ' dos ' + tot + ' ' + noun.many;
  if (n1 / tot > RULES.attribution.solo) return { kind: 'solo', channel: c1, n: n1, n1, total: tot, text: (CH[c1].gender === 'f' ? CH[c1].name + ' sozinha assina ' : CH[c1].gender === 'm' ? CH[c1].name + ' sozinho assina ' : 'só ' + CH[c1].name + ' assina ') + n1 + tail };
  if (second && third && second[1] === third[1]) return { kind: 'varios', tie: true, n: e.length, n1, n2: second[1], total: tot, text: 'espalhado por ' + e.length + ' canais' };
  if (n1 / tot > RULES.attribution.solo) return { kind: 'solo', channel: c1, n: n1, n1, total: tot, text: (CH[c1].gender === 'f' ? CH[c1].name + ' sozinha assina ' : CH[c1].gender === 'm' ? CH[c1].name + ' sozinho assina ' : 'só ' + CH[c1].name + ' assina ') + n1 + ' dos ' + tot };
  if (second && second[1] / tot >= RULES.attribution.second) return { kind: 'dois', channels: [c1, second[0]], n: n1 + second[1], n1, n2: second[1], total: tot, text: CH[c1].name + ' e ' + CH[second[0]].name + ' assinam ' + (n1 + second[1]) + tail };
  return { kind: 'varios', n: e.length, n1, n2: second ? second[1] : 0, total: tot, text: 'espalhado por ' + e.length + ' canais' };
}
function dominantTheme(list) {
  const by = {}; list.forEach(v => { by[v.theme] = (by[v.theme] || 0) + 1; });
  const e = Object.entries(by).sort((a, b) => b[1] - a[1]);
  if (!e.length) return { theme: null, text: 'sem outliers' };
  const [t, n] = e[0];
  if (n >= RULES.theme.minCount && n / list.length >= RULES.theme.minShare) return { theme: t, n, total: list.length, text: THEME[t].label + ' em ' + n + ' dos ' + list.length + ' outliers' };
  return { theme: null, n, total: list.length, text: 'sem tema dominante (o mais comum aparece em ' + n + ' dos ' + list.length + ')' };
}
const READING_TYPES = [
  { id: 'padroes-titulo', label: 'Padrões de título dos outliers (6 meses)', windowDays: 182, fmt: 'long' },
  { id: 'temas', label: 'Temas dos outliers (90 dias)', aka: 'Temas emergentes', windowDays: 90, fmt: 'long' },
  { id: 'resumo-trocas', label: 'Resumo das trocas (30 dias)', windowDays: 30 },
];
const READING_TIMES = [sp(2026, 10, 13, 6, 10), sp(2026, 10, 20, 6, 10)];
const readings = [];
['ia', 'viagem'].forEach(niche => READING_TIMES.forEach(at => {
  const t = snapIdxAtOrBefore(at);
  const base = baseAt(niche, t, 182);
  const an = analyzePatterns(base);
  const passing = an.patterns.filter(p => p.verdict.id === 'padrao');
  const id = 'padroes-titulo-' + niche + '-' + date.dm(at).replace('/', '-');
  readings.push({
    id, type: 'padroes-titulo', typeLabel: READING_TYPES[0].label, niche, generatedAt: at,
    seal: 'forja · Gemma 12B · gerada ' + date.dm(at) + ' ' + date.hm(at) + ' (SP)',
    sent: { asOf: base.asOf, asOfIdx: t, nVideos: base.videos.length, nChannels: base.channels.length, channels: base.channels, excluded: base.excluded, nOutliers: an.nOutliers,
      text: 'dados enviados à forja: ' + base.videos.length + ' longos até ' + date.dm(base.asOf) + ' ' + date.hm(base.asOf) + ' (' + fmt.plural(base.channels.length, 'canal', 'canais') + ', 6 meses)' },
    base, analysis: an,
    text: {
      title: READING_TYPES[0].label + ' — ' + NICHES[niche].label,
      lead: fmt.plural(an.nOutliers, 'outlier', 'outliers') + ' (≥ 2×) em ' + fmt.plural(base.videos.length, 'vídeo longo', 'vídeos longos') + ' de ' + fmt.plural(base.channels.length, 'canal', 'canais') + ' nos últimos 6 meses. ' +
        (passing.length ? passing.length + (passing.length === 1 ? ' fórmula passa' : ' fórmulas passam') + ' a regra (n ≥ 10 e diferença ≥ 0,3×).' : 'Nenhuma fórmula passa a regra (n ≥ 10 e diferença ≥ 0,3×).'),
      items: an.patterns.map(p => p.verdict.text + (p.verdict.id === 'padrao' && p.evidence.length ? ' · ' + p.attribution.text : '')),
      theme: an.dominantTheme.text,
    },
  });
}));
// temas (90 d) — uma leitura por nicho em 20/10 06:10
['ia', 'viagem'].forEach(niche => {
  const at = READING_TIMES[1], t = snapIdxAtOrBefore(at), base = baseAt(niche, t, 90);
  const outs = base.videos.filter(v => !v.weak && v.mult >= RULES.outlierMin);
  readings.push({ id: 'temas-' + niche + '-20-10', type: 'temas', typeLabel: READING_TYPES[1].label, niche, generatedAt: at,
    seal: 'forja · Gemma 12B · gerada 20/10 06:10 (SP)',
    sent: { asOf: base.asOf, asOfIdx: t, nVideos: base.videos.length, nChannels: base.channels.length, channels: base.channels, excluded: base.excluded, nOutliers: outs.length,
      text: 'dados enviados à forja: ' + base.videos.length + ' longos até ' + date.dm(base.asOf) + ' ' + date.hm(base.asOf) + ' (' + fmt.plural(base.channels.length, 'canal', 'canais') + ', 90 dias)' },
    base, analysis: { patterns: [], dominantTheme: dominantTheme(outs), outliers: outs.map(v => v.id), nOutliers: outs.length },
    text: { title: READING_TYPES[1].label + ' — ' + NICHES[niche].label, lead: dominantTheme(outs).text, items: [], theme: dominantTheme(outs).text } });
});
/* =====================================================================================
   AMPLIAÇÕES (rodada de pedidos das telas — PEDIDOS-API.md). Só ADIÇÕES: nada renomeado.
   ===================================================================================== */
/* ---- Canais: arredondamento de inscritos (YouTube mostra 3 algarismos significativos) */
function roundingOf(ch, growth) {
  const unit = ch.subs < 1000 ? 1 : Math.pow(10, Math.floor(Math.log10(ch.subs)) - 2);
  const err = ch.subs < 1000 ? 0 : unit / 2;
  return { roundingUnit: unit, roundingError: err, roundingText: err ? '±' + fmt.num(err) : 'exato',
    withinRounding: growth.abs == null ? null : Math.abs(growth.abs) <= unit, uncertainty: ch.subs < 1000 ? 0 : unit,
    text: growth.abs == null ? null : Math.abs(growth.abs) <= unit ? '≈ 0 (dentro do arredondamento do YouTube, ±' + fmt.num(unit) + ')'
      : (growth.abs > 0 ? '+' : '') + fmt.num(growth.abs) + (unit > 1 ? ' (±' + fmt.num(unit) + ')' : '') };   // diferença de dois valores arredondados: ±1 unidade
}
/* ---- Canais: maior multiplicador abaixo de 2× (90 d, formato) */
function maxBelow(ch, fmtId, pool) {
  const cand = (pool || ch.videos).filter(v => v.tracked && v.fmt === fmtId && v.ageDays <= 90 && v.mult && v.mult.value != null && v.mult.value < RULES.outlierMin)
    .sort((a, b) => b.mult.value - a.mult.value)[0];
  return cand ? { id: cand.id, value: cand.mult.value, n: cand.mult.n, weak: cand.mult.weak, label: fmt.mult(cand.mult.value) + ' a mediana' } : null;
}
/* ---- engajamento: mediana de (curtidas + comentários) ÷ views, 90 d */
function pctOutliersOf(ch, fmtId) {
  const a = ch.videos.filter(v => v.tracked && v.fmt === fmtId && v.ageDays <= 90 && v.mult && v.mult.value != null && !v.mult.weak);
  return a.length ? a.filter(v => v.mult.value >= RULES.outlierMin).length / a.length : null;
}
function engagementOf(ch, fmtId) {
  const a = ch.videos.filter(v => v.tracked && v.fmt === fmtId && v.ageDays <= 90 && v.views > 0 && v.likes != null).map(v => (v.likes + v.comments) / v.views);
  return { median: median(a), n: a.length, window: '90 dias', label: a.length ? fmt.dec1(median(a) * 100) + '% (n = ' + a.length + ')' : 'sem vídeos com contagem' };
}
/* ---- Canais: trocar o nicho de um canal (demonstração do seletor) — recalcula tudo que depende de nicho */
const NICHE_ORIG = Object.fromEntries(channels.map(c => [c.id, c.niche]));
function setNiche(channelId, niche) {
  const ch = CH[channelId]; if (!ch || !NICHES[niche]) return null;
  const from = ch.niche; ch.niche = niche;
  ch.videos.forEach(v => { v.niche = niche; });
  changes.forEach(c => { if (c.ch === channelId) c.niche = niche; });
  return { channel: channelId, from, to: niche, tabCounts: { todos: tabCounts('todos'), viagem: tabCounts('viagem'), ia: tabCounts('ia') } };
}
function resetNiches() { Object.entries(NICHE_ORIG).forEach(([id, n]) => { if (CH[id].niche !== n) setNiche(id, n); }); }
/* ---- Cenários alternáveis do mockup (não alteram os dados reais) */
function scenario(id) {
  if (id === 'own-empty') {
    const ch = CH.tnfigueiredo, fmtId = 'long';
    const pool = ch.videos.filter(v => !(v.fmt === fmtId && v.ageDays <= 90));        // como se não houvesse longo em 90 d
    const lastLong = pool.find(v => v.fmt === fmtId) || null;
    const vp = pool.filter(v => v.tracked && v.fmt === fmtId && v.vpd != null).map(v => v.vpd);
    return { id, label: 'Seu canal sem vídeo longo nos últimos 90 dias', channel: ch.id, fmt: fmtId, simulated: true,
      lastLong: lastLong ? { id: lastLong.id, pub: lastLong.pub, ageDays: lastLong.ageDays } : null,
      text: 'Nenhum vídeo longo nos últimos 90 dias' + (lastLong ? ' (último em ' + date.dmOrDmy(lastLong.pub) + ', ' + date.ago(lastLong.pub) + ')' : '') + '.',
      cadence: { channel: ch.id, fmt: fmtId, weeks: cadence(ch.id, fmtId).weeks.map(w => ({ from: w.from, to: w.to, n: 0 })), pw: 0, n: 0,
        habit: { costuma: false, n: 0, text: 'nenhum vídeo em 13 semanas' }, lastUpload: lastLong ? lastLong.pub : null, lastUploadAgo: lastLong ? date.ago(lastLong.pub) : null },
      stats: { channel: ch.id, fmt: fmtId, vpdMedian: median(vp), vpdN: vp.length, vpdWindow: 'desde 03/10', typicalMult: null, typicalMultN: 0, bestOutlier: null, outliers90: 0,
        maxMultBelowMin: null, engagement: { median: null, n: 0, window: '90 dias', label: 'sem vídeos com contagem' } } };
  }
  return null;
}
const SCENARIOS = [{ id: 'own-empty', label: 'Seu canal sem vídeo longo nos últimos 90 dias' }];

/* ---- Histórico: média de views/dia num período (ponderada pelas horas de cada intervalo entre registros) */
function intervalsOf(v) {
  if (!v.series.length) return [];
  const out = []; const a0 = earliestIdx(v), last = v.series[v.series.length - 1].idx;
  for (let i = a0; i < last; i++) { const ta = ptTime(v, i), tb = ptTime(v, i + 1); out.push({ a: ta, b: tb, vpd: (ptViews(v, i + 1) - ptViews(v, i)) / ((tb - ta) / DAY), idxTo: i + 1 }); }
  return out;
}
function periodRate(videoId, fromMs, toMs) {
  const v = V[videoId]; if (!v) return null;
  if (toMs - fromMs < DAY) return { vpd: null, sharedDay: false, onlySinceDays: null, text: 'menos de 1 dia no ar, sem média' };
  const iv = intervalsOf(v);
  if (!iv.length) return { vpd: null, sharedDay: false, onlySinceDays: null, text: v.tracked ? 'aguardando o 2º registro diário' : 'fora dos vídeos acompanhados' };
  let s = 0, w = 0, shared = false;
  iv.forEach(x => { const o = Math.min(toMs, x.b) - Math.max(fromMs, x.a); if (o > 0) { s += x.vpd * o; w += o; if (o < x.b - x.a - 1) shared = true; } });
  if (w < DAY) return { vpd: null, sharedDay: shared, onlySinceDays: null, text: 'sem registro diário no período' };
  const vpd = s / w, coveredDays = Math.round(w / DAY);
  const onlySince = fromMs < iv[0].a ? coveredDays : null;
  return { vpd, sharedDay: shared, onlySinceDays: onlySince, coveredHours: w / H,
    text: '≈ ' + fmt.num(vpd) + (onlySince ? ' (só desde 03/10, ' + onlySince + ' dias)' : shared ? ' (inclui dia compartilhado)' : '') };
}
/* ---- Histórico: curva "esperado" por dia de vida (mediana dos outros vídeos do canal na mesma idade) */
function expectedCurve(videoId) {
  const v = V[videoId]; if (!v || !v.series.length) return [];
  const ch = CH[v.ch];
  const others = ch.videos.filter(u => u !== v && u.tracked && u.fmt === v.fmt && u.series.length && !changedSince(u));
  const iv = intervalsOf(v); if (!iv.length) return [];
  const rateAtAge = (u, a0, a1) => { const x0 = viewsAtAge(u, a0, ch.lastIdx), x1 = viewsAtAge(u, a1, ch.lastIdx); return x0 == null || x1 == null ? null : (x1 - x0) / ((a1 - a0) / DAY); };
  const firstA0 = iv[0].a - v.pub, firstA1 = iv[0].b - v.pub, firstOwn = iv[0].vpd;
  const out = [];
  out.method = v.pub >= SERIES_START ? 'mesmo dia de vida' : 'aproximação por faixa'; out.methodLabel = 'método: ' + out.method;
  out.band = v.pub >= SERIES_START ? null : bandOf(v.ageDays).label;
  iv.forEach((x, pos) => {
    const a0 = x.a - v.pub, a1 = x.b - v.pub;
    const raw = [], rel = [];
    others.forEach(u => { if (u.pub + a0 < (u.pub >= SERIES_START ? u.pub : SNAP0)) return; const r = rateAtAge(u, a0, a1); if (r == null) return; raw.push(r);
      const r0 = rateAtAge(u, firstA0, firstA1); if (r0 != null && r0 > 0 && u.pub + firstA0 >= (u.pub >= SERIES_START ? u.pub : SNAP0)) rel.push(r / r0); });
    const vpd = raw.length >= RULES.weakBase ? median(raw) : null, anch = rel.length >= RULES.weakBase ? median(rel) * firstOwn : null;
    if (vpd == null && anch == null) return;
    out.push({ idx: x.idxTo, t: x.b, from: x.a, lifeDay: v.pub >= SERIES_START ? pos : Math.floor(a0 / DAY), ageDaysFrom: a0 / DAY, vpd, n: raw.length, vpdAnchored: anch, nAnchored: rel.length, observed: x.vpd });
  });
  return out;
}

/* ---- Insights: mapa de calor dia × bloco de 2 h (SP), 90 d, concorrentes acompanhados */
const DOW_MON = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
function heatmap(niche, fmtId) {
  fmtId = fmtId || 'long';
  const excluded = channels.filter(c => !c.own && inNiche(niche, c) && c.sync.state === 'backfill').map(c => ({ id: c.id, partial: true, fetchedSince: c.videos.length ? c.videos[c.videos.length - 1].pub : null, reason: c.name + ': ainda buscando vídeos (' + c.sync.backfill.done + ' de ' + c.sync.backfill.total + ')' }));
  const exIds = excluded.map(x => x.id);
  const vs = videos.filter(v => v.tracked && !CH[v.ch].own && !exIds.includes(v.ch) && v.fmt === fmtId && v.ageDays <= 90 && inNiche(niche, v));
  const cells = Array.from({ length: 7 }, () => Array.from({ length: 12 }, () => ({ n: 0, ids: [], medMult: null, nMult: 0, dominantChannel: null })));
  vs.forEach(v => { const p = parts(v.pub); const c = cells[(p.dow + 6) % 7][Math.floor(p.h / 2)]; c.n++; c.ids.push(v.id); });
  const dom = ids => { const by = {}; ids.forEach(id => { by[V[id].ch] = (by[V[id].ch] || 0) + 1; }); const e = Object.entries(by).sort((a, b) => b[1] - a[1])[0]; return e ? { id: e[0], n: e[1] } : null; };
  let peak = null, best = null; const thin = [];
  cells.forEach((row, d) => row.forEach((c, b) => {
    const m = c.ids.map(id => V[id].mult).filter(x => x.value != null && !x.weak).map(x => x.value);
    c.nMult = m.length; c.medMult = m.length ? median(m) : null;
    if (c.n) { const d = dom(c.ids); if (d && d.n / c.n >= 0.8) c.dominantChannel = { id: d.id, name: CH[d.id].name, share: d.n / c.n, n: d.n, of: c.n }; }
    if (c.nMult < RULES.weakBase) thin.push({ dow: d, block: b });
    if (c.n && (!peak || c.n > peak.n)) peak = { dow: d, block: b, n: c.n };
    if (c.nMult >= RULES.weakBase && (!best || c.medMult > best.med)) best = { dow: d, block: b, med: c.medMult, n: c.nMult };
  }));
  if (peak) peak.dominantChannel = dom(cells[peak.dow][peak.block].ids);
  if (best) best.dominantChannel = dom(cells[best.dow][best.block].ids);
  return { excluded, niche: niche || 'todos', fmt: fmtId, window: '90 dias', days: DOW_MON, blocks: Array.from({ length: 12 }, (_, b) => p2(2 * b) + 'h–' + p2(2 * b + 2) + 'h'), cells, n: vs.length, peak, bestMult: best, thin };
}
/* ---- Insights: referência do nicho para "Você no nicho" (entre os canais concorrentes) */
function nicheStats(niche, fmtId, ownId) {
  fmtId = fmtId || 'long'; ownId = ownId || 'tnfigueiredo';
  const chs = channels.filter(c => !c.own && inNiche(niche, c));
  const agg = arr => { const a = arr.filter(x => x != null && isFinite(x)); return { median: median(a), min: a.length ? Math.min(...a) : null, max: a.length ? Math.max(...a) : null, n: a.length }; };
  const st = chs.map(c => channelStats(c.id, fmtId));
  return { niche: niche || 'todos', fmt: fmtId, channels: chs.map(c => c.id),
    pw: agg(chs.map(c => cadence(c.id, fmtId).pw)), perMilSubs: agg(st.map(x => x.perMilSubs)), typicalMult: agg(st.map(x => x.typicalMult)), engagement: agg(st.map(x => x.engagement.median)), pctOutliers: agg(st.map(x => x.pctOutliers)),
    own: ownVsNiche(ownId, fmtId, { pw: agg(chs.map(c => cadence(c.id, fmtId).pw)), perMilSubs: agg(st.map(x => x.perMilSubs)), typicalMult: agg(st.map(x => x.typicalMult)), engagement: agg(st.map(x => x.engagement.median)), pctOutliers: agg(st.map(x => x.pctOutliers)) }) };
}
/* seu canal contra a mediana do nicho: razão, veredito (▲ ≥ +15%, ▼ ≤ −15%, ≈ entre) e few quando o seu n < 10 */
const NICHE_VERDICT_THRESHOLD = 0.15, OWN_FEW_N = 10;
function ownVsNiche(ownId, fmtId, ref) {
  const ch = CH[ownId]; if (!ch) return null;
  const st = channelStats(ownId, fmtId), cad = cadence(ownId, fmtId);
  const vals = { pw: [cad.pw, cad.n], perMilSubs: [st.perMilSubs, st.vpdN], typicalMult: [st.typicalMult, st.typicalMultN], engagement: [st.engagement.median, st.engagement.n], pctOutliers: [st.pctOutliers, st.pctOutliersN] };
  const out = { channel: ownId, threshold: NICHE_VERDICT_THRESHOLD, fewN: OWN_FEW_N };
  Object.entries(vals).forEach(([k, [value, n]]) => {
    const med = ref[k].median, ratio = value != null && med ? value / med : null;
    const bothZero = value === 0 && med === 0, aboveZero = value > 0 && med === 0;
    const verdict = bothZero ? '≈' : aboveZero ? '▲' : ratio == null ? null : ratio >= 1 + NICHE_VERDICT_THRESHOLD ? '▲' : ratio <= 1 - NICHE_VERDICT_THRESHOLD ? '▼' : '≈';
    out[k] = { value, median: med, ratio, bothZero, verdict, verdictText: bothZero ? 'igual à mediana do nicho (as duas em 0%)' : aboveZero ? 'acima da mediana do nicho (a mediana está em 0)' : verdict === '▲' ? 'acima da mediana do nicho' : verdict === '▼' ? 'abaixo da mediana do nicho' : verdict === '≈' ? 'na mediana do nicho (±15%)' : 'sem dado',
      label: bothZero ? 'igual à mediana (as duas em 0%)' : aboveZero ? 'acima (mediana em 0)' : ratio == null ? 'sem dado' : fmt.mult(ratio) + ' a mediana do nicho', n, few: n < OWN_FEW_N };
  });
  return out;
}
/* ---- Insights: tendência de temas (≤ 90 d vs 91–180 d) */
function themeTrend(niche, fmtId) {
  fmtId = fmtId || 'long';
  // só compara canais com série nas DUAS janelas (≤ 90 d e 91–180 d): fora quem está buscando vídeos ou cujo video_limit não alcança 180 dias
  const excluded = [], okCh = new Set();
  channels.filter(c => !c.own && inNiche(niche, c)).forEach(c => {
    const tr = c.videos.filter(v => v.tracked && v.fmt === fmtId);
    if (c.sync.state === 'backfill') excluded.push({ id: c.id, reason: c.name + ': ainda buscando vídeos (' + c.sync.backfill.done + ' de ' + c.sync.backfill.total + '), sem série' });
    else if (!tr.length) excluded.push({ id: c.id, reason: c.name + ': sem ' + (fmtId === 'short' ? 'Shorts' : 'vídeos longos') + ' acompanhados' });
    else if (Math.max(...tr.map(v => v.ageDays)) < 180 && c.videos.some(v => !v.tracked && v.fmt === fmtId && v.ageDays <= 180)) excluded.push({ id: c.id, reason: c.name + ': os ' + c.video_limit + ' vídeos acompanhados só alcançam ' + Math.max(...tr.map(v => v.ageDays)) + ' dias — a janela de 91–180 dias ficaria incompleta' });
    else okCh.add(c.id);
  });
  const vs = videos.filter(v => v.tracked && okCh.has(v.ch) && v.fmt === fmtId && inNiche(niche, v));
  const res = THEMES.filter(t => !niche || niche === 'todos' || niche === 'all' || t.niche === niche).map(t => {
    const now = vs.filter(v => v.theme === t.id && v.ageDays <= 90), prev = vs.filter(v => v.theme === t.id && v.ageDays > 90 && v.ageDays <= 180);
    const m = now.map(v => v.mult).filter(x => x.value != null && !x.weak).map(x => x.value);
    const d = now.length - prev.length, pct = d / Math.max(prev.length, 1), tr = RULES.theme.trend;
    const trend = d >= tr.minDelta && pct >= tr.minPct ? '▲' : -d >= tr.minDelta && -pct >= tr.minPct ? '▼' : '≈';
    return { trend, trendText: trend === '▲' ? 'subindo' : trend === '▼' ? 'caindo' : 'estável', delta: d, deltaPct: prev.length ? d / prev.length : null, theme: t.id, label: t.label, now: now.length, prev: prev.length, channels: [...new Set(now.map(v => v.ch))], medMult: median(m), nMult: m.length,
      outliers: outliers({ niche: niche || 'todos', fmt: fmtId, theme: t.id }).count, ids: now.map(v => v.id) };
  }).sort((a, b) => b.now - a.now);
  res.excluded = excluded; res.channelsCompared = [...okCh];
  return res;
}
/* ---- Insights: cobertura do seu canal por tema (90 d) */
function ownCoverage(fmtId) {
  fmtId = fmtId || 'long';
  const vs = CH.tnfigueiredo.videos.filter(v => v.fmt === fmtId && v.ageDays <= 90);
  const byTheme = {}; vs.forEach(v => { byTheme[v.theme] = (byTheme[v.theme] || 0) + 1; });
  return { channel: 'tnfigueiredo', fmt: fmtId, window: '90 dias', n: vs.length, byTheme, ids: vs.map(v => v.id) };
}
/* ---- Insights: fórmulas "hoje" (mesmo cálculo das leituras, em LAST_IDX, 6 meses) */
function patternsNow(niche, fmtId) {
  fmtId = fmtId || 'long';
  const base = baseAt(niche, LAST_IDX, 182, null, fmtId);
  const an = analyzePatterns(base);
  return Object.assign({ niche, fmt: fmtId, asOf: base.asOf, nVideos: base.videos.length, channels: base.channels, excluded: base.excluded, base }, an);
}

/* ---- Forja: leitura por vídeo (congelada) */
READING_TYPES.push({ id: 'leitura-video', label: 'Leitura do vídeo', target: 'video', windowDays: null, fmt: null });
function videoReading(videoId, at) {
  const v = V[videoId], lastV = v.series.length ? v.series[v.series.length - 1].idx : 0, t = Math.min(snapIdxAtOrBefore(at), lastV), asOf = SNAP(t);   // canal atrasado: até o último ponto do vídeo
  const chs = changes.filter(c => c.video === videoId && c.at <= at).sort((a, b) => a.at - b.at);
  const effs = chs.map(c => ({ change: c.id, type: c.type, whenText: c.whenText, eff: effectAt(c.id, t) }));
  const titlesThen = v.titles.filter(x => x.first_seen <= at), thumbsThen = v.thumbs.filter(x => x.first_seen <= at), descsThen = v.descs.filter(x => x.first_seen <= at);
  const tc = chs.find(c => c.type === 'thumb' && c.testCompare && c.revertTo && c.at <= at);
  const nPts = v.series.filter(p => p.idx <= t).length;
  const days = Math.round((asOf - v.pub) / DAY);
  const nT = chs.filter(c => c.type === 'title').length, nTh = chs.filter(c => c.type === 'thumb').length, nD = chs.filter(c => c.type === 'desc').length;
  const kinds = [nT ? fmt.plural(nT, 'troca de título', 'trocas de título') : null, nTh ? fmt.plural(nTh, 'troca de thumbnail', 'trocas de thumbnail') : null, nD ? fmt.plural(nD, 'troca de descrição', 'trocas de descrição') : null].filter(Boolean);
  const kindsTxt = kinds.length > 1 ? kinds.slice(0, -1).join(', ') + ' e ' + kinds[kinds.length - 1] : kinds[0];
  const span = days < 1 ? 'menos de 1 dia' : fmt.plural(days, 'dia', 'dias');
  const lead = (kinds.length ? kindsTxt.charAt(0).toUpperCase() + kindsTxt.slice(1) + ' em ' + span + ' de vídeo' : 'Nenhuma troca de título, thumbnail ou descrição em ' + span + ' de vídeo') +
    (tc ? '; a thumbnail voltou para ' + tc.revertTo + ' depois de ' + date.dur(tc.cycleMs) + ' — compatível com Testar e comparar (teste A/B do YouTube), não confirmado.' : '.');
  const items = effs.map(e => {
    const c = CHG[e.change], idxTxt = c.type === 'thumb' ? c.before.key + ' → ' + c.after.key : (c.idx) + ' → ' + (c.idx + 1);
    const st = e.eff.status;
    const body = ['ganhou', 'perdeu', 'neutro'].includes(st) ? e.eff.label + ' — ' + e.eff.numbersFlat : fmt.labelReason(e.eff.label, e.eff.reason);
    return c.typeLabel + ' ' + idxTxt + ' (' + c.whenText + '): ' + body;
  });
  return {
    id: 'leitura-video-' + videoId + '-' + date.dm(at).replace('/', '-'), type: 'leitura-video', typeLabel: 'Leitura do vídeo', niche: v.niche, target: { kind: 'video', video: videoId },
    generatedAt: at, seal: 'forja · Gemma 12B · gerada ' + date.dm(at) + ' ' + date.hm(at) + ' (SP)',
    sent: { asOf, asOfIdx: t, nPoints: nPts, nTitles: titlesThen.length, nThumbs: thumbsThen.length, nDescs: descsThen.length,
      text: 'dados enviados à forja: ' + fmt.plural(titlesThen.length, 'título', 'títulos') + ', ' + fmt.plural(thumbsThen.length, 'período', 'períodos') + ' de thumbnail, ' + fmt.plural(descsThen.length, 'descrição', 'descrições') + ' e ' + fmt.plural(nPts, 'registro diário', 'registros diários') + ' de views, até ' + date.dm(asOf) + ' ' + date.hm(asOf) },
    effects: effs.map(e => ({ change: e.change, status: e.eff.status, numbers: e.eff.numbers || null, reason: e.eff.reason, collected: e.eff.collected != null ? e.eff.collected : null })),
    viewsThen: S(v, t),
    base: { videos: [], channels: [v.ch], excluded: [], windowDays: null, asOf },
    analysis: { patterns: [], effects: effs.map(e => ({ change: e.change, status: e.eff.status })) },
    text: { title: 'Leitura do vídeo — ' + v.title, lead, items },
  };
}
function sinceVideo(r) {
  const v = V[r.target.video], ch = CH[v.ch];
  const newPts = Math.max(0, ch.lastIdx - r.sent.asOfIdx);
  const newChanges = changes.filter(c => c.video === v.id && c.at > r.generatedAt).map(c => c.id);
  const moved = r.effects.map(e => { const now = effect(e.change); return { change: e.change, then: e.status, now: now.status, thenCollected: e.collected, nowCollected: now.collected != null ? now.collected : null }; })
    .filter(x => x.then !== x.now || x.thenCollected !== x.nowCollected);
  const parts_ = [], lbl = st => ({ 'sem-serie': 'sem série', 'sem-antes': 'sem base' })[st] || st;
  const flipped = moved.filter(x => x.then !== x.now), waiting = moved.filter(x => x.then === x.now);
  if (newPts) parts_.push('+' + fmt.plural(newPts, 'registro diário', 'registros diários'));
  if (flipped.length) parts_.push(fmt.plural(flipped.length, 'troca mudou', 'trocas mudaram') + ' de veredito');
  if (waiting.length) parts_.push(fmt.plural(waiting.length, 'troca ganhou', 'trocas ganharam') + ' dias de coleta');
  if (newChanges.length) parts_.push(fmt.plural(newChanges.length, 'troca nova', 'trocas novas'));
  const items = moved.map(x => { const c = CHG[x.change], idxTxt = c.type === 'thumb' ? c.before.key + ' → ' + c.after.key : c.idx + ' → ' + (c.idx + 1);
    return c.typeLabel + ' ' + idxTxt + ' (' + c.whenText + '): ' + (x.then === x.now ? 'aguardando, ' + x.thenCollected + ' → ' + x.nowCollected + ' de 7 dias' : lbl(x.then) + ' → ' + lbl(x.now)); });
  const sp_ = []; if (newPts) sp_.push('+' + fmt.plural(newPts, 'registro diário', 'registros diários')); if (flipped.length) sp_.push(fmt.plural(flipped.length, 'veredito mudou', 'vereditos mudaram'));
  if (waiting.length) sp_.push(waiting.length + (waiting.length === 1 ? ' ganhou dias de coleta' : ' ganharam dias de coleta')); if (newChanges.length) sp_.push('+' + fmt.plural(newChanges.length, 'troca nova', 'trocas novas'));
  return { shortText: 'desde então: ' + (sp_.length ? sp_.join(' · ') : 'nada mudou'), items, flipped: flipped.length, newVideos: [], leftWindow: [], nowVideos: 0, sentVideos: 0, readingId: r.id, newPoints: newPts, newChanges, moved, viewsThen: r.viewsThen, viewsNow: v.views,
    text: parts_.length ? 'Desde então: ' + parts_.join('; ') + '. Peça nova leitura à forja para atualizar.' : 'Nada mudou desde a leitura.' };
}
readings.push(videoReading('matt-opus55', sp(2026, 10, 20, 6, 10)));

/* ---- Shorts também são lidos (decisão do coordenador): leituras de padrões de título de Shorts, congeladas */
READING_TYPES.push({ id: 'padroes-titulo-shorts', label: 'Padrões de título dos outliers — Shorts (6 meses)', windowDays: 182, fmt: 'short' });
READING_TYPES.forEach(t => { t.shorts = t.fmt === 'short'; });
function patternReading(type, niche, at, fmtId) {
  const t = snapIdxAtOrBefore(at), base = baseAt(niche, t, 182, null, fmtId), an = analyzePatterns(base);
  const rt = READING_TYPES.find(x => x.id === type), unit = fmtId === 'short' ? 'Shorts' : 'longos', unitV = fmtId === 'short' ? 'Shorts' : 'vídeos longos';
  const passing = an.patterns.filter(p => p.verdict.id === 'padrao');
  return { id: type + '-' + niche + '-' + date.dm(at).replace('/', '-'), type, typeLabel: rt.label, niche, fmt: fmtId, generatedAt: at,
    seal: 'forja · Gemma 12B · gerada ' + date.dm(at) + ' ' + date.hm(at) + ' (SP)',
    sent: { asOf: base.asOf, asOfIdx: t, nVideos: base.videos.length, nChannels: base.channels.length, channels: base.channels, excluded: base.excluded, nOutliers: an.nOutliers,
      text: 'dados enviados à forja: ' + base.videos.length + ' ' + unit + ' até ' + date.dm(base.asOf) + ' ' + date.hm(base.asOf) + ' (' + fmt.plural(base.channels.length, 'canal', 'canais') + ', 6 meses)' },
    base, analysis: an,
    text: { title: rt.label + ' — ' + NICHES[niche].label,
      lead: fmt.plural(an.nOutliers, 'outlier', 'outliers') + ' (≥ 2×) em ' + base.videos.length + ' ' + (base.videos.length === 1 ? (fmtId === 'short' ? 'Short' : 'vídeo longo') : unitV) + ' de ' + fmt.plural(base.channels.length, 'canal', 'canais') + ' nos últimos 6 meses. ' +
        (passing.length ? passing.length + (passing.length === 1 ? ' fórmula passa' : ' fórmulas passam') + ' a regra (n ≥ 10 e diferença ≥ 0,3×).' : 'Nenhuma fórmula passa a regra (n ≥ 10 e diferença ≥ 0,3×).'),
      items: an.patterns.map(p => p.verdict.text + (p.verdict.id === 'padrao' && p.evidence.length ? ' · ' + p.attribution.text : '')), theme: an.dominantTheme.text } };
}
['ia', 'viagem'].forEach(niche => READING_TIMES.forEach(at => readings.push(patternReading('padroes-titulo-shorts', niche, at, 'short'))));

/* ---- Diff de título palavra a palavra (mesmo realce em todas as telas) */
function titleDiff(a, b) {
  const tok = s => s.split(/(\s+)/).filter(x => x.length);
  const A = tok(a), B = tok(b), norm = x => x.toLowerCase().replace(/[’']/g, "'");
  const n = A.length, m = B.length, L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = norm(A[i]) === norm(B[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const before = [], after = []; let i = 0, j = 0;
  while (i < n && j < m) { if (norm(A[i]) === norm(B[j])) { const cs = A[i] !== B[j] && A[i].trim() !== '' ; before.push({ text: A[i], op: cs ? 'case' : 'keep' }); after.push({ text: B[j], op: cs ? 'case' : 'keep' }); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) before.push({ text: A[i++], op: 'rem' }); else after.push({ text: B[j++], op: 'add' }); }
  while (i < n) before.push({ text: A[i++], op: 'rem' }); while (j < m) after.push({ text: B[j++], op: 'add' });
  // palavra que existe nos dois títulos (sem caixa, sem acento, sem pontuação/possessivo) não "saiu" nem "entrou": mudou de lugar ou só de caixa
  const w = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['’]s\b/g, '').replace(/[^a-z0-9$]+/g, '');
  const bag = arr => arr.filter(x => /\S/.test(x.text)).map(x => ({ x, k: w(x.text) })).filter(o => o.k);
  const raw = t => t.replace(/[^\p{L}\p{N}$]+/gu, '');
  // por contagem de ocorrências: só min(antes, depois) ocorrências da mesma palavra viram 'move'/'case'; as demais seguem 'saiu'/'entrou'
  const fix = (mine, others, op) => { const avail = {};
    bag(others).forEach(p => { (avail[p.k] = avail[p.k] || []).push(p); });
    bag(mine).filter(o => o.x.op !== op).forEach(o => { const a = avail[o.k]; if (a && a.length) a.shift(); });   // as que já casaram pelo LCS consomem
    bag(mine).forEach(o => { if (o.x.op !== op) return; const a = avail[o.k]; if (!a || !a.length) return; const hit = a.shift();
      o.x.op = raw(hit.x.text) !== raw(o.x.text) && raw(hit.x.text).toLowerCase() === raw(o.x.text).toLowerCase() ? 'case' : 'move'; }); };
  fix(before, after, 'rem'); fix(after, before, 'add');
  const OPL = { keep: null, rem: 'saiu', add: 'entrou', move: 'mudou de lugar', case: 'só maiúsculas/minúsculas' };
  const merge = arr => arr.reduce((o, x) => { const last = o[o.length - 1]; if (last && last.op === x.op) last.text += x.text; else if (/^\s+$/.test(x.text) && last) last.text += x.text; else o.push({ text: x.text, op: x.op, label: OPL[x.op] }); return o; }, []);
  const kept = before.filter(x => (x.op === 'keep' || x.op === 'case' || x.op === 'move') && /\w/.test(x.text)).length, caseOnly = after.filter(x => x.op === 'case').map(x => x.text.trim());
  return { before: merge(before), after: merge(after), full: kept === 0, keptWords: kept, caseChanges: caseOnly, hasCaseChange: caseOnly.length > 0, labels: OPL, removed: before.filter(x => x.op === 'rem' && /\S/.test(x.text)).map(x => x.text.trim()), added: after.filter(x => x.op === 'add' && /\S/.test(x.text)).map(x => x.text.trim()) };
}
changes.forEach(c => { if (c.type === 'title') c.titleDiff = titleDiff(c.before, c.after);
  if (c.type === 'title') { const v = V[c.video]; const earlier = v.titles.slice(0, c.idx - 1).map(x => x.text); c.revertTo = earlier.includes(c.after) ? c.after : (c.revertTo || null); } });

/* ---- Leitura "Resumo das trocas (30 dias)" — classificação das reescritas de título, congelada */
const REWRITE_GROUPS = [
  { id: 'reverteu', label: 'Voltou ao título anterior', test: c => !!c.revertTo },
  { id: 'tirou-segunda-noticia', label: 'Tirou a 2ª notícia', test: c => /\b(and|&|e)\b.+|\(and /i.test(c.before) && (c.before.match(/\b(and|e)\b/gi) || []).length > (c.after.match(/\b(and|e)\b/gi) || []).length && c.after.length <= c.before.length + 5 },
  { id: 'primeira-pessoa', label: 'Passou para primeira pessoa', test: c => FORMULA['primeira-pessoa'].test(c.after) && (!FORMULA['primeira-pessoa'].test(c.before) || /^how i\b/i.test(c.before)) },
  { id: 'reacao-no-lugar', label: 'Reação no lugar do nome do produto', test: c => FORMULA['reacao-hiperbole'].test(c.after) && !FORMULA['reacao-hiperbole'].test(c.before) },
  { id: 'encurtou', label: 'Encurtou e tirou o detalhe', test: c => c.after.length <= c.before.length * 0.85 },
  { id: 'sem-padrao', label: 'Sem padrão claro', test: () => true },
];
function classifyRewrite(c) { return REWRITE_GROUPS.find(g => g.test(c)).id; }
changes.forEach(c => { if (c.type === 'title') c.rewriteGroup = classifyRewrite(c); });
function changesReading(niche, at) {
  const win = 30, t = snapIdxAtOrBefore(at), asOfR = SNAP(t);
  const cs = changes.filter(c => inNiche(niche, c) && !CH[c.ch].own && c.at <= asOfR && c.at > asOfR - win * DAY);
  const titles = cs.filter(c => c.type === 'title');
  const groups = REWRITE_GROUPS.map(g => { const ids = titles.filter(c => c.rewriteGroup === g.id).map(c => c.id); const n = ids.length;
    return { id: g.id, label: g.label, changeIds: ids, n, verdict: g.id === 'sem-padrao' ? { id: 'sem-padrao', text: fmt.plural(n, 'troca', 'trocas') + ' sem padrão de reescrita' } : n >= RULES.pattern.minN ? { id: 'padrao', text: g.label + ': ' + n + ' trocas' } : { id: 'recorrencia', text: g.label + ': ' + (n === 1 ? 'caso isolado (n = 1)' : 'recorrência observada (n = ' + n + ') — pouco para concluir') },
      attribution: n ? attribution(ids.map(id => ({ ch: CHG[id].ch })), { one: 'troca', many: 'trocas desse tipo' }) : null }; }).filter(g => g.n);
  const reverts = cs.filter(c => c.revertTo).map(c => c.id);
  const byType = { title: titles.length, thumb: cs.filter(c => c.type === 'thumb').length, desc: cs.filter(c => c.type === 'desc').length };
  const eff = cs.map(c => ({ id: c.id, st: effectAt(c.id, t).status }));
  const byVerdict = {}; eff.forEach(e => { byVerdict[e.st] = (byVerdict[e.st] || 0) + 1; });
  const items = groups.map(g => g.verdict.text);
  if (reverts.length) items.push(reverts.length + (reverts.length === 1 ? ' troca voltou' : ' trocas voltaram') + ' a um valor anterior (inclui alternância de thumbnail compatível com Testar e comparar, o teste A/B do YouTube).');
  return { id: 'resumo-trocas-' + niche + '-' + date.dm(at).replace('/', '-'), type: 'resumo-trocas', typeLabel: READING_TYPES[2].label, niche, generatedAt: at,
    seal: 'forja · Gemma 12B · gerada ' + date.dm(at) + ' ' + date.hm(at) + ' (SP)',
    sent: { asOf: SNAP(t), asOfIdx: t, nChanges: cs.length, changeIds: cs.map(c => c.id), windowDays: win,
      text: 'dados enviados à forja: ' + fmt.plural(cs.length, 'troca', 'trocas') + ' (' + byType.title + ' de título, ' + byType.thumb + ' de thumbnail, ' + byType.desc + ' de descrição) de ' + date.dm(asOfR - win * DAY) + ' a ' + date.dm(asOfR) + ' ' + date.hm(asOfR) },
    base: { videos: [], channels: [...new Set(cs.map(c => c.ch))], excluded: [], windowDays: win, asOf: SNAP(t) },
    analysis: { patterns: [], groups, reverts, byType, byVerdict },
    text: { title: READING_TYPES[2].label + ' — ' + NICHES[niche].label,
      lead: fmt.plural(cs.length, 'troca', 'trocas') + ' em 30 dias: ' + byType.title + ' de título, ' + byType.thumb + ' de thumbnail, ' + byType.desc + ' de descrição. Nenhum tipo de reescrita chega a 10 trocas; tudo abaixo é recorrência, não padrão.'.replace('Nenhum tipo de reescrita chega a 10 trocas; tudo abaixo é recorrência, não padrão.', groups.some(g => g.verdict.id === 'padrao') ? 'Grupos com 10 ou mais trocas aparecem como padrão.' : 'Nenhum tipo de reescrita chega a 10 trocas; tudo abaixo é recorrência, não padrão.'),
      items } };
}
['ia', 'viagem'].forEach(niche => readings.push(changesReading(niche, READING_TIMES[1])));
function sinceChanges(r) {
  const now = changes.filter(c => inNiche(r.niche, c) && !CH[c.ch].own && c.at > r.generatedAt);
  const left = r.sent.changeIds.filter(id => CHG[id].at <= NOW - r.sent.windowDays * DAY);
  const parts_ = [];
  if (now.length) parts_.push('+' + now.length + (now.length === 1 ? ' troca nova' : ' trocas novas'));
  if (left.length) parts_.push(left.length + (left.length === 1 ? ' saiu' : ' saíram') + ' da janela de 30 dias');
  const staleNow = eligibleChannels(r.niche).out.filter(o => r.sent.changeIds.some(id => CHG[id].ch === o.id) || now.some(c => c.ch === o.id));
  if (staleNow.length) parts_.push(staleNow.map(o => o.reason.replace(' fica fora', '')).join('; ') + ' — uma nova leitura deixaria ' + (staleNow.length === 1 ? 'esse canal' : 'esses canais') + ' de fora');
  const sp2 = []; if (now.length) sp2.push('+' + fmt.plural(now.length, 'troca nova', 'trocas novas')); if (left.length) sp2.push(left.length + (left.length === 1 ? ' saiu da janela' : ' saíram da janela')); if (staleNow.length) sp2.push(fmt.plural(staleNow.length, 'canal fora', 'canais fora'));
  return { shortText: 'desde então: ' + (sp2.length ? sp2.join(' · ') : 'nada mudou'), staleNow, newVideos: [], nowVideos: 0, sentVideos: 0, leftWindowChanges: left, readingId: r.id, newChanges: now.map(c => c.id), leftWindow: [],
    text: parts_.length ? 'Desde então: ' + parts_.join(', ') + '. Peça nova leitura à forja para atualizar.' : 'Nada mudou desde a leitura.' };
}

const OUTLIER_READING_TYPES = ['padroes-titulo', 'padroes-titulo-shorts', 'temas'];
/* nº de canais no texto = canais que de fato têm vídeos na base (o mesmo de readingScope) */
function alignChannels(r) {
  if (!r.base || !r.base.videos || !r.base.videos.length || !OUTLIER_READING_TYPES.includes(r.type)) return r;
  const all_ = r.base.channels.length, withV = new Set(r.base.videos.map(v => v.ch)).size, fmtId = r.fmt || r.base.fmt || 'long';
  const word = fmtId === 'short' ? fmt.plural(withV, 'canal', 'canais') + ' com Shorts' : withV === all_ ? fmt.plural(withV, 'canal', 'canais') : fmt.plural(withV, 'canal', 'canais') + ' com vídeos longos';
  const old = fmt.plural(all_, 'canal', 'canais');
  r.sent.nChannelsInScope = all_; r.sent.nChannels = withV;
  r.sent.text = r.sent.text.replace('(' + old + ',', '(' + word + ',');
  r.text.lead = r.text.lead.replace(' de ' + old + ' nos', ' de ' + word + ' nos');
  return r;
}
readings.forEach(alignChannels);
const READ = Object.fromEntries(readings.map(r => [r.id, r]));
function since(readingId) {
  const r = READ[readingId]; if (!r) return null;
  if (r.type === 'leitura-video') return sinceVideo(r);
  if (r.type === 'resumo-trocas') return sinceChanges(r);
  const tNow = LAST_IDX;
  const now = baseAt(r.niche, tNow, r.base.windowDays, r.base.channels, r.fmt || r.base.fmt || 'long');   // mesmo conjunto de canais e mesmo formato da leitura
  const staleNow = eligibleChannels(r.niche).out.filter(o => r.base.channels.includes(o.id) && r.base.videos.some(x => x.ch === o.id));
  const sentIds = new Set(r.base.videos.map(v => v.id)), nowIds = new Set(now.videos.map(v => v.id));
  const newVideos = now.videos.filter(v => !sentIds.has(v.id));
  const leftWindow = r.base.videos.filter(v => !nowIds.has(v.id));
  const outNow = new Set(now.videos.filter(v => !v.weak && v.mult >= 2).map(v => v.id));
  const outThen = new Set(r.base.videos.filter(v => !v.weak && v.mult >= 2).map(v => v.id));
  const becameOut = [...outNow].filter(id => !outThen.has(id)), stoppedOut = [...outThen].filter(id => !outNow.has(id));
  const titleChanged = r.base.videos.filter(v => nowIds.has(v.id) && V[v.id].title !== v.title).map(v => v.id);
  const parts_ = [];
  const fresh = newVideos.filter(v => V[v.id].pub >= r.sent.asOf), older = newVideos.filter(v => V[v.id].pub < r.sent.asOf);
  const thenT = r.sent.asOfIdx, noBaseThen = older.filter(v => { const ch = CH[V[v.id].ch]; return multiplierAt(V[v.id], Math.min(thenT, ch.lastIdx)).value == null; });
  const foundOld = older.filter(v => !noBaseThen.includes(v));
  if (fresh.length) parts_.push('+' + fmt.plural(fresh.length, 'vídeo novo', 'vídeos novos'));
  if (noBaseThen.length) parts_.push(fmt.plural(noBaseThen.length, 'vídeo ganhou', 'vídeos ganharam') + ' base de comparação');
  if (foundOld.length) parts_.push(fmt.plural(foundOld.length, 'vídeo antigo entrou', 'vídeos antigos entraram') + ' na base (achados depois, pela sincronização)');
  if (leftWindow.length) parts_.push(leftWindow.length + (leftWindow.length === 1 ? ' saiu' : ' saíram') + ' da janela de ' + (r.base.windowDays === 182 ? '6 meses' : r.base.windowDays + ' dias'));
  if (becameOut.length) parts_.push('+' + becameOut.length + ' outlier' + (becameOut.length > 1 ? 's' : ''));
  if (stoppedOut.length) parts_.push(fmt.plural(stoppedOut.length, 'deixou', 'deixaram') + ' de ser outlier');
  if (titleChanged.length) parts_.push(titleChanged.length + ' com título trocado');
  if (staleNow.length) parts_.push(staleNow.map(o => o.reason.replace(' fica fora', '')).join('; ') + ' — uma nova leitura deixaria ' + (staleNow.length === 1 ? 'esse canal' : 'esses canais') + ' de fora');
  return { staleNow, readingId, newVideos: newVideos.map(v => v.id), leftWindow: leftWindow.map(v => v.id), becameOutlier: becameOut, stoppedOutlier: stoppedOut, titleChanged,
    nowVideos: now.videos.length, nowOutliers: outNow.size, sentVideos: r.base.videos.length, sentOutliers: outThen.size, freshVideos: fresh.map(v => v.id), noBaseThenVideos: noBaseThen.map(v => v.id), foundOldVideos: foundOld.map(v => v.id),
    countsText: 'vídeos: ' + r.base.videos.length + ' → ' + now.videos.length + ' · outliers: ' + outThen.size + ' → ' + outNow.size,
    shortText: (() => { const p = [];
      if (fresh.length) p.push('+' + fmt.plural(fresh.length, 'vídeo novo', 'vídeos novos'));
      if (noBaseThen.length) p.push(noBaseThen.length + (noBaseThen.length === 1 ? ' ganhou base' : ' ganharam base'));
      if (foundOld.length) p.push(foundOld.length + (foundOld.length === 1 ? ' antigo entrou' : ' antigos entraram'));
      if (leftWindow.length) p.push(leftWindow.length + (leftWindow.length === 1 ? ' saiu da janela' : ' saíram da janela'));
      if (becameOut.length) p.push('+' + fmt.plural(becameOut.length, 'outlier', 'outliers'));
      if (stoppedOut.length) p.push(stoppedOut.length + (stoppedOut.length === 1 ? ' deixou de ser outlier' : ' deixaram de ser outlier'));
      if (titleChanged.length) p.push(fmt.plural(titleChanged.length, 'título trocado', 'títulos trocados'));
      if (staleNow.length) p.push(fmt.plural(staleNow.length, 'canal fora', 'canais fora'));
      return 'desde então: ' + (p.length ? p.join(' · ') : 'nada mudou'); })(),
    text: parts_.length ? 'Desde então: ' + parts_.join(', ') + '. Peça nova leitura à forja para atualizar.' : 'Nada mudou desde a leitura.' };
}
function eligibleChannels(niche) {
  const list = channels.filter(c => !c.own && inNiche(niche, c));
  const inn = [], out = [];
  list.forEach(c => {
    if (c.sync.state === 'backfill') out.push({ id: c.id, reason: c.name + ' fica fora: ainda buscando vídeos (' + c.sync.backfill.done + ' de ' + c.sync.backfill.total + ')' });
    else if (c.syncAgeHours > RULES.staleSyncHours) { const d = Math.floor(c.syncAgeHours / 24); out.push({ id: c.id, reason: c.name + ' fica fora: sem sincronização ' + (c.syncAgeHours < 48 ? date.agoHours(c.sync.last) : date.ago(c.sync.last)) }); }
    else inn.push(c.id);
  });
  return { in: inn, out };
}
const forja = {
  readingTypes: READING_TYPES, readings, byId: READ, since, eligibleChannels,
  latest: (type, niche) => readings.filter(r => r.type === type && r.niche === niche).sort((a, b) => b.generatedAt - a.generatedAt)[0] || null,
  states: ['na fila', 'trabalhando', 'publicado', 'atrasado', 'sem máquina', 'nova tentativa', 'falhou', 'recusado (dado velho)'],
  queue: { LATE_AFTER_MINUTES: 25, UNSERVED_AFTER_HOURS: 24, STALE_RUNNING_MINUTES: 30, HEARTBEAT_DEAD_MINUTES: 30, quotaPerDayPerType: 1, maxAttempts: 3,
    lastPollAt: sp(2026, 10, 24, 14, 55), timingText: 'tempo deste tipo ainda não medido (2 leituras; mediana a partir de 5)',
    quotaNote: 'falha e recusa não contam na cota' },
  rules: { pattern: RULES.pattern, attribution: RULES.attribution, theme: RULES.theme },
};

/* =====================================================================================
   AMPLIAÇÕES — fila da forja (pedidos simulados por cenário), prévia, swipe file, URLs
   ===================================================================================== */
Object.assign(forja.queue, {
  tickMinutes: 10,
  quotaScope: { perType: true, perNiche: true, text: '1 pedido por dia por tipo e por nicho (Viagem e IA separados). Com nicho Todos, o pedido vira um por nicho. Falha e recusa não contam na cota.' },
});
const T = (h, mi) => sp(2026, 10, 24, h, mi);
const REQ_SCENARIOS = {
  'na fila': { createdAt: T(14, 58), status: 'pending', quota: 1 },
  'trabalhando': { createdAt: T(14, 41), claimedAt: T(14, 45), status: 'running', quota: 1 },
  'publicado': { createdAt: T(14, 31), claimedAt: T(14, 35), publishedAt: T(14, 50), status: 'completed', quota: 1 },
  'atrasado': { createdAt: T(14, 33), status: 'pending', quota: 1, busyWith: 'outro pedido em andamento desde 14:35', busySince: T(14, 35) },
  'sem máquina': { createdAt: T(14, 48), status: 'pending', quota: 1, lastPollAt: T(12, 55) },
  'nova tentativa': { createdAt: T(14, 42), claimedAt: T(14, 45), releasedAt: T(14, 57), attempt: 2, status: 'pending', quota: 1, releasedBy: 'validador',
    retryReason: 'o validador recusou a tentativa 1 às 14:57 porque o texto citava um número que não estava nos dados enviados', attempts: [{ claimedAt: T(14, 45), endedAt: T(14, 57), result: 'recusada pelo validador' }] },
  'liberado pelo vigia': { createdAt: T(14, 5), claimedAt: T(14, 25), releasedAt: T(14, 56), attempt: 2, status: 'pending', quota: 1, releasedBy: 'vigia',
    retryReason: 'o vigia liberou o pedido às 14:56 porque a tentativa 1 passou de 30 min rodando', attempts: [{ claimedAt: T(14, 25), endedAt: T(14, 56), result: 'liberada pelo vigia (travou > 30 min)' }] },
  'falhou': { createdAt: T(13, 50), claimedAt: T(13, 55), failedAt: T(14, 21), attempt: 3, status: 'failed', quota: 0, failReason: 'o validador recusou a saída da forja nas 3 tentativas',
    attempts: [{ claimedAt: T(13, 55), endedAt: T(14, 2) }, { claimedAt: T(14, 5), endedAt: T(14, 11) }, { claimedAt: T(14, 15), endedAt: T(14, 21) }] },
  'recusado (dado velho)': { createdAt: T(14, 50), claimedAt: T(14, 55), refusedAt: T(14, 56), status: 'refused', quota: 0,
    refusedReason: 'a máquina recebeu dados de 23/10 18:00, anteriores à sincronização das 12:00. Peça de novo.',
    refusedDataAsOf: sp(2026, 10, 23, 18, 0) },
};
const scenarioReadings = {};
function scenarioReading(type, niche, at, video, fmtId) {
  const base = [type, niche, video || '', fmtId || ''].join('|'), key = base + '|' + at;
  if (scenarioReadings[key]) return scenarioReadings[key];
  const sameDay = Object.keys(scenarioReadings).some(k => k.startsWith(base + '|'));   // outro horário do mesmo alvo: id ganha o HHMM
  let r;
  if (type === 'leitura-video') r = videoReading(video, at);
  else if (type === 'resumo-trocas') r = changesReading(niche, at);
  else if (type === 'padroes-titulo' || type === 'padroes-titulo-shorts') r = patternReading(type, niche, at, type === 'padroes-titulo-shorts' ? 'short' : 'long');
  else if (type === 'temas') { const t = snapIdxAtOrBefore(at), base = baseAt(niche, t, 90), outs = base.videos.filter(v => !v.weak && v.mult >= 2), dt = dominantTheme(outs);
    r = { id: 'temas-' + niche + '-' + date.dm(at).replace('/', '-'), type, typeLabel: READING_TYPES[1].label, niche, generatedAt: at, seal: 'forja · Gemma 12B · gerada ' + date.dm(at) + ' ' + date.hm(at) + ' (SP)',
      sent: { asOf: base.asOf, asOfIdx: t, nVideos: base.videos.length, nChannels: base.channels.length, channels: base.channels, excluded: base.excluded, nOutliers: outs.length, text: 'dados enviados à forja: ' + base.videos.length + ' longos até ' + date.dm(base.asOf) + ' ' + date.hm(base.asOf) + ' (' + fmt.plural(base.channels.length, 'canal', 'canais') + ', 90 dias)' },
      base, analysis: { patterns: [], dominantTheme: dt, outliers: outs.map(v => v.id), nOutliers: outs.length }, text: { title: READING_TYPES[1].label + ' — ' + NICHES[niche].label, lead: dt.text, items: [], theme: dt.text } }; }
  alignChannels(r);
  r.scenario = true; r.id += (sameDay ? '-' + date.hm(at).replace(':', '') : '') + '-cenario';
  scenarioReadings[key] = r; READ[r.id] = r;
  return r;
}
const requests0Id = (target, n, state) => 'req-' + target.type + '-' + n + (target.video ? '-' + target.video : '') + '-' + state.replace(/\W+/g, '-');
/** Pedido simulado de um estado do mockup. target: {type, niche ('ia'|'viagem'|'todos'), video, fmt}. Com 'todos' devolve um pedido por nicho. */
function requestScenario(state, target) {
  const sc0 = REQ_SCENARIOS[state]; if (!sc0) return null;
  target = Object.assign({ type: 'padroes-titulo', niche: 'ia' }, target || {});
  // horário de criação opcional: todos os outros horários derivam dele (claims caem nas consultas de 10 min, xx:x5)
  let sc = sc0;
  if (target.createdAt != null) {
    const d = target.createdAt - sc0.createdAt, sh = x => x == null ? x : x + d;
    sc = Object.assign({}, sc0, { createdAt: target.createdAt, publishedAt: sh(sc0.publishedAt), releasedAt: sh(sc0.releasedAt), failedAt: sh(sc0.failedAt), refusedAt: sh(sc0.refusedAt), busySince: sh(sc0.busySince),
      attempts: sc0.attempts ? sc0.attempts.map(a => Object.assign({}, a, { claimedAt: sh(a.claimedAt), endedAt: sh(a.endedAt) })) : null });
    if (sc0.claimedAt != null) { const tick = forja.queue.tickMinutes * 6e4, phase = 5 * 6e4; let c = sh(sc0.claimedAt); c = Math.ceil((c - phase) / tick) * tick + phase; const dc = c - sh(sc0.claimedAt);
      sc.claimedAt = c; ['publishedAt', 'releasedAt', 'failedAt', 'refusedAt'].forEach(k => { if (sc[k] != null) sc[k] += dc; }); }
    if (sc0.busySince != null) sc.busyWith = 'outro pedido em andamento desde ' + date.hm(sc.busySince);
    if (sc0.retryReason) sc.retryReason = sc0.retryReason.replace(/\d\d:\d\d/, date.hm(sc.releasedAt));
  }
  const niches = target.type === 'leitura-video' ? [V[target.video || SHOWCASE].niche] : target.niche === 'todos' || target.niche === 'all' ? ['ia', 'viagem'] : [target.niche];
  const ACTIVE = ['na fila', 'trabalhando', 'atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia'];
  const requests = niches.map((n, i) => {
    const off = 0;                            // com Todos, os dois pedidos nascem juntos
    const rq = { id: 'req-' + target.type + '-' + n + (target.video ? '-' + target.video : '') + '-' + state.replace(/\W+/g, '-'), scenario: true, type: target.type, niche: n,
      target: target.type === 'leitura-video' ? { kind: 'video', video: target.video || SHOWCASE } : { kind: 'niche', niche: n, fmt: target.fmt || (target.type === 'padroes-titulo-shorts' ? 'short' : 'long') },
      state, status: sc.status, attempt: sc.attempt || 1, maxAttempts: forja.queue.maxAttempts,
      createdAt: sc.createdAt + off, claimedAt: sc.claimedAt != null ? sc.claimedAt + off : null, startedAt: sc.claimedAt != null ? sc.claimedAt + off : null,
      publishedAt: sc.publishedAt != null ? sc.publishedAt + off : null, releasedAt: sc.releasedAt || null, releasedBy: sc.releasedBy || null,
      failedAt: sc.failedAt || null, failReason: sc.failReason || null, attempts: sc.attempts || null,
      refusedAt: sc.refusedAt || null, refusedReason: sc.refusedReason || null, refusedDataAsOf: sc.refusedDataAsOf || null, busyWith: sc.busyWith || null, busySince: sc.busySince || null, retryReason: sc.retryReason || null,
      waitingMinutes: sc.status === 'pending' ? Math.round((NOW - (sc.releasedAt || sc.createdAt + off)) / 6e4) : null, readingId: null };
    if (i > 0 && (ACTIVE.includes(state) || state === 'publicado')) {
      // a máquina pega um pedido por consulta: o 2º espera atrás do 1º
      const tick = forja.queue.tickMinutes * 6e4, phase = 5 * 6e4;
      Object.assign(rq, { attempt: 1, releasedAt: null, releasedBy: null, retryReason: null, attempts: null, busyWith: null, busySince: null, behind: requests0Id(target, niches[0], state) });
      if (state === 'publicado') { const c = Math.ceil((sc.publishedAt - phase) / tick) * tick + phase; Object.assign(rq, { state: 'trabalhando', status: 'running', claimedAt: c, startedAt: c, publishedAt: null, waitingMinutes: null, behind: null, behindAfter: requests0Id(target, niches[0], state) }); }
      else {
        const w = Math.round((NOW - rq.createdAt) / 6e4), dead = sc.lastPollAt && NOW - sc.lastPollAt > forja.queue.HEARTBEAT_DEAD_MINUTES * 6e4;
        Object.assign(rq, { state: dead ? 'sem máquina' : w > forja.queue.LATE_AFTER_MINUTES ? 'atrasado' : 'na fila', stateNote: 'atrás do de ' + NICHES[niches[0]].label, status: 'pending', claimedAt: null, startedAt: null, publishedAt: null, waitingMinutes: w });
      }
    } else if (i > 0 && (state === 'falhou' || state === 'recusado (dado velho)')) {
      // o 2º é processado depois do 1º: nunca no mesmo minuto
      const sh = (state === 'falhou' ? 30 : 10) * 6e4, mv = x => x == null ? x : x + sh;
      Object.assign(rq, { claimedAt: mv(rq.claimedAt), startedAt: mv(rq.startedAt), failedAt: mv(rq.failedAt), refusedAt: mv(rq.refusedAt), attempts: rq.attempts ? rq.attempts.map(a => Object.assign({}, a, { claimedAt: a.claimedAt + sh, endedAt: a.endedAt + sh })) : null });
      if ([rq.claimedAt, rq.failedAt, rq.refusedAt].some(x => x != null && x > NOW))   // ainda não chegou a vez dele: segue na fila atrás do 1º
        Object.assign(rq, { state: 'na fila', status: 'pending', stateNote: 'atrás do de ' + NICHES[niches[0]].label, behind: requests0Id(target, niches[0], state), claimedAt: null, startedAt: null, failedAt: null, refusedAt: null, refusedReason: null, refusedDataAsOf: null, failReason: null, attempts: null, attempt: 1, waitingMinutes: Math.round((NOW - rq.createdAt) / 6e4) });
    }
    // nada depois de NOW: horário derivado no futuro vira previsão explícita (forecast) e o campo fica nulo
    const TF = ['claimedAt', 'startedAt', 'publishedAt', 'releasedAt', 'failedAt', 'refusedAt', 'busySince'];
    rq.forecast = null;
    TF.forEach(k => { if (rq[k] != null && rq[k] > NOW) { (rq.forecast = rq.forecast || {})[k] = rq[k]; rq[k] = null; } });
    if (rq.attempts) rq.attempts = rq.attempts.filter(a => a.claimedAt <= NOW).map(a => a.endedAt > NOW ? Object.assign({}, a, { endedAt: null, endedAtForecast: a.endedAt }) : a);
    if (rq.publishedAt == null) rq.readingId = null;
    else if (rq.readingId == null && i === 0 && sc.publishedAt) rq.readingId = scenarioReading(target.type, n, sc.publishedAt + off, target.video || (target.type === 'leitura-video' ? SHOWCASE : null)).id;
    return rq;
  });
  const lastPollAt = sc.lastPollAt || forja.queue.lastPollAt;
  const alive = NOW - lastPollAt <= forja.queue.HEARTBEAT_DEAD_MINUTES * 6e4;
  const r0 = requests[0], ord = r0.attempt + ' de ' + r0.maxAttempts, split = requests.length > 1, nextPoll = lastPollAt + forja.queue.tickMinutes * 6e4;
  const at_ = k => r0[k] != null ? date.hm(r0[k]) : r0.forecast && r0.forecast[k] != null ? date.hm(r0.forecast[k]) + ' (previsto)' : '—';
  const statusText = ({
    'na fila': 'Na fila desde ' + date.hm(r0.createdAt) + '. A máquina consulta a cada ' + forja.queue.tickMinutes + ' min (próxima às ' + date.hm(lastPollAt + forja.queue.tickMinutes * 6e4) + ').',
    'trabalhando': 'Trabalhando desde ' + (r0.claimedAt ? date.hm(r0.claimedAt) : at_('claimedAt')) + '.',
    'publicado': r0.publishedAt ? 'Leitura publicada às ' + date.hm(r0.publishedAt) + '.' : 'Publicação prevista às ' + at_('publishedAt').replace(' (previsto)', '') + '.',
    'atrasado': 'Máquina ativa (última consulta ' + date.ago(lastPollAt) + '), mas o pedido está na fila há ' + r0.waitingMinutes + ' min — o limite é ' + forja.queue.LATE_AFTER_MINUTES + ' min.',
    'sem máquina': split ? 'Seus pedidos das ' + date.hm(r0.createdAt) + ' estão na fila e rodam quando a máquina voltar.' : 'Seu pedido das ' + date.hm(r0.createdAt) + ' está na fila e roda quando a máquina voltar.',
    'nova tentativa': 'Voltou para a fila (tentativa ' + ord + '). ' + (r0.retryReason ? r0.retryReason.charAt(0).toUpperCase() + r0.retryReason.slice(1) + '.' : ''),
    'liberado pelo vigia': 'O vigia liberou o pedido (travou > 30 min) — volta para a fila (tentativa ' + ord + ').',
    'falhou': 'Falhou nas ' + r0.attempt + ' tentativas: o validador recusou a saída em todas. Falha não conta na cota.'.replace(': o validador', '. O validador'),
    'recusado (dado velho)': r0.refusedReason ? r0.refusedReason.charAt(0).toUpperCase() + r0.refusedReason.slice(1) : '',
  })[state];
  let statusText2 = statusText;
  if (split && state !== 'sem máquina' && (ACTIVE.includes(state) || state === 'publicado')) {
    const n2 = NICHES[requests[1].niche].label, n1 = NICHES[r0.niche].label;
    statusText2 = statusText.replace(/^Na fila desde/, 'Pedido de ' + n1 + ' na fila desde').replace(/^Leitura publicada/, 'Leitura de ' + n1 + ' publicada') + (state === 'publicado' ? ' O pedido de ' + n2 + ' está em andamento desde ' + date.hm(requests[1].claimedAt) + '.' : ' O pedido de ' + n2 + ' espera na fila, atrás do de ' + n1 + ' (a máquina pega um por consulta).');
  }
  // Todos: o texto concorda com as linhas — cada nicho é citado com o estado da sua linha
  if (split) {
    const nm = q => NICHES[q.niche].label, others = requests.filter(q => q !== r0), names = requests.map(nm).join(' e ');
    const first = ({
      'na fila': 'Pedido de ' + nm(r0) + ' na fila desde ' + date.hm(r0.createdAt) + '. A máquina consulta a cada ' + forja.queue.tickMinutes + ' min (próxima às ' + date.hm(nextPoll) + ').',
      'trabalhando': 'Pedido de ' + nm(r0) + ' em andamento desde ' + (r0.claimedAt ? date.hm(r0.claimedAt) : at_('claimedAt')) + '.',
      'atrasado': 'Máquina ativa (última consulta ' + date.ago(lastPollAt) + '), mas o pedido de ' + nm(r0) + ' está na fila há ' + r0.waitingMinutes + ' min — o limite é ' + forja.queue.LATE_AFTER_MINUTES + ' min.',
      'sem máquina': 'Seus pedidos das ' + date.hm(r0.createdAt) + ' (' + names + ') estão na fila e rodam quando a máquina voltar.',
      'nova tentativa': 'O pedido de ' + nm(r0) + ' voltou para a fila (tentativa ' + ord + '). ' + (r0.retryReason ? r0.retryReason.charAt(0).toUpperCase() + r0.retryReason.slice(1) + '.' : ''),
      'liberado pelo vigia': 'O vigia liberou o pedido de ' + nm(r0) + ' (travou > 30 min) — volta para a fila (tentativa ' + ord + ').',
      'publicado': 'Leitura de ' + nm(r0) + ' publicada às ' + date.hm(r0.publishedAt) + '.',
      'falhou': others.every(q => q.state === 'falhou') ? 'Os ' + requests.length + ' pedidos (' + names + ') falharam nas ' + r0.attempt + ' tentativas. O validador recusou a saída em todas. Falha não conta na cota.'
        : 'O pedido de ' + nm(r0) + ' falhou nas ' + r0.attempt + ' tentativas. O validador recusou a saída em todas. Falha não conta na cota.',
      'recusado (dado velho)': 'O pedido de ' + nm(r0) + ' foi recusado. ' + (r0.refusedReason ? r0.refusedReason.charAt(0).toUpperCase() + r0.refusedReason.slice(1) : '').replace(/\s*Peça de novo\.?$/, ''),
    })[state];
    const tail = others.filter(q => !(state === 'sem máquina' && q.state === 'sem máquina') && !(state === 'falhou' && q.state === 'falhou' && others.every(o => o.state === 'falhou'))).map(q => {
      const behind = q.stateNote ? ', ' + q.stateNote : '';
      switch (q.state) {
        case 'na fila': return 'O pedido de ' + nm(q) + ' espera na fila desde ' + date.hm(q.createdAt) + behind + ' (a máquina pega um por consulta).';
        case 'atrasado': return 'O pedido de ' + nm(q) + ' está atrasado, na fila há ' + q.waitingMinutes + ' min' + behind + '.';
        case 'sem máquina': return 'O pedido de ' + nm(q) + ' também está na fila, sem máquina.';
        case 'trabalhando': return 'O pedido de ' + nm(q) + ' está em andamento desde ' + date.hm(q.claimedAt) + '.';
        case 'publicado': return 'A leitura de ' + nm(q) + ' foi publicada às ' + date.hm(q.publishedAt) + '.';
        case 'falhou': return 'O pedido de ' + nm(q) + ' falhou às ' + date.hm(q.failedAt) + '.';
        case 'recusado (dado velho)': return 'O pedido de ' + nm(q) + ' foi recusado às ' + date.hm(q.refusedAt) + '.';
        default: return 'O pedido de ' + nm(q) + ': ' + q.state + '.';
      } });
    statusText2 = [first].concat(tail).join(' ');
    // falhou/recusado com outro pedido ainda ativo: o botão está bloqueado → dizer quem segue e quando pedir de novo
    const other = others.find(q => ['na fila', 'trabalhando', 'atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia'].includes(q.state));
    if (other && (state === 'falhou' || state === 'recusado (dado velho)')) statusText2 = [first, againText(other, r0)].join(' ');
  }
  /* rótulo de cada pedido, com a hora do evento que ele nomeia */
  const hmOr = (q, k) => q[k] != null ? date.hm(q[k]) : q.forecast && q.forecast[k] != null ? date.hm(q.forecast[k]) + ' (previsto)' : '—';
  const labelOf = q => { const note = q.stateNote ? ' (' + q.stateNote + ')' : '';
    switch (q.state) {   // formato único (CONVENCOES, RODADA F3): hora do evento que o rótulo nomeia
      case 'na fila': return 'na fila · pedido ' + date.hm(q.createdAt) + note;
      case 'trabalhando': return 'trabalhando desde ' + hmOr(q, 'claimedAt');
      case 'atrasado': return 'atrasado · pedido ' + date.hm(q.createdAt) + note;
      case 'sem máquina': return 'sem máquina desde ' + date.hm(lastPollAt) + note;
      case 'nova tentativa': return 'nova tentativa · ' + date.hm(nextPoll);
      case 'liberado pelo vigia': return 'liberado pelo vigia · ' + date.hm(nextPoll);
      case 'publicado': return q.publishedAt ? 'publicado às ' + date.hm(q.publishedAt) : 'publicação prevista às ' + hmOr(q, 'publishedAt').replace(' (previsto)', '');
      case 'falhou': return 'falhou às ' + hmOr(q, 'failedAt');
      case 'recusado (dado velho)': return 'recusado às ' + hmOr(q, 'refusedAt');
    } return q.state; };
  // "atrás do de X" só enquanto o pedido da frente está ativo
  const ACT = ['na fila', 'trabalhando', 'atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia'];
  requests.forEach((q, i) => { if (i > 0 && q.stateNote && !ACT.includes(requests[0].state)) { q.stateNote = null; q.behind = null; } });
  requests.forEach(q => { q.statusLabel = labelOf(q); });
  const statusLabel = r0.statusLabel;
  const TERM = ['publicado', 'falhou', 'recusado (dado velho)'], anyActive = requests.some(q => !TERM.includes(q.state));
  const lineOf = q => NICHES[q.niche].label + ': ' + q.statusLabel;
  queueOrder(requests);   // ordem da fila: ativos por createdAt (o da frente primeiro), depois os terminados
  const statusLines = split ? requests.map(lineOf) : null;
  const statusLabelOut = split && TERM.includes(state) && anyActive ? 'pedido em andamento' : statusLabel;
  return { state, requests, request: requests[0], split, statusText: statusText2, statusLabel: statusLabelOut, statusLines, anyActive, terminal: !anyActive && TERM.includes(state) && !requests.some(q => q.forecast),
    machine: { lastPollAt, nextPollAt: lastPollAt + forja.queue.tickMinutes * 6e4, alive, tickMinutes: forja.queue.tickMinutes, text: (alive ? 'Máquina ativa (última consulta ' : 'Sem consulta da máquina desde ' + date.hm(lastPollAt) + ' (') + date.ago(lastPollAt) + ')' },
    quota: (() => { const used = sc.quota ? requests.length : 0, p = parts(NOW), rel = used ? sp(p.y, p.mo, p.d, 0, 0) + DAY : null;
      return { usedToday: used, perTypePerNiche: 1, note: forja.queue.quotaNote, releasesAt: rel,
        text: used ? 'cota de hoje usada; libera ' + date.weekday(rel) + ', ' + date.dm(rel) + ' às 00:00' : 'cota de hoje livre (' + forja.queue.quotaNote + ')' }; })(),
    future: requests.some(q => q.forecast != null), forecast: requests.some(q => q.forecast != null) ? requests.map(q => q.forecast) : null };
}
/* histórico de pedidos reais (os que publicaram as leituras congeladas) + um pedido por estado do mockup */
const REQUESTS = readings.map(r => ({ id: 'req-' + r.id, scenario: false, type: r.type, niche: r.niche, target: r.target || { kind: 'niche', niche: r.niche, fmt: r.fmt || 'long' }, state: 'publicado', status: 'completed',
  attempt: 1, createdAt: r.generatedAt - 9 * 6e4, claimedAt: r.generatedAt - 5 * 6e4, startedAt: r.generatedAt - 5 * 6e4, publishedAt: r.generatedAt, readingId: r.id }));
REQUESTS.push({ id: 'req-temas-ia-17-10', scenario: false, type: 'temas', niche: 'ia', target: { kind: 'niche', niche: 'ia', fmt: 'long' }, state: 'falhou', status: 'failed', attempt: 3, maxAttempts: 3,
  createdAt: sp(2026, 10, 17, 6, 2), claimedAt: sp(2026, 10, 17, 6, 5), startedAt: sp(2026, 10, 17, 6, 5), failedAt: sp(2026, 10, 17, 6, 41), publishedAt: null, readingId: null,
  failReason: 'o validador recusou a saída da forja nas 3 tentativas (rótulo de tema fora do catálogo)', quotaConsumed: false,
  attempts: [{ claimedAt: sp(2026, 10, 17, 6, 5), endedAt: sp(2026, 10, 17, 6, 13) }, { claimedAt: sp(2026, 10, 17, 6, 15), endedAt: sp(2026, 10, 17, 6, 24) }, { claimedAt: sp(2026, 10, 17, 6, 35), endedAt: sp(2026, 10, 17, 6, 41) }] });
REQUESTS.sort((a, b) => a.createdAt - b.createdAt);
Object.keys(REQ_SCENARIOS).forEach(s => REQUESTS.push(requestScenario(s, { type: 'padroes-titulo', niche: 'ia' }).request));
/* leituras de cenário (24/10) existem desde a carga: forja.byId as encontra sem precisar chamar requestScenario antes */
['ia', 'viagem'].forEach(n => ['padroes-titulo', 'padroes-titulo-shorts', 'temas', 'resumo-trocas'].forEach(t => requestScenario('publicado', { type: t, niche: n })));
requestScenario('publicado', { type: 'leitura-video', video: 'matt-opus55' });
function againText(active, done_) { const na = NICHES[active.niche].label, nd = NICHES[done_.niche].label;
  // F10: com Todos, o nicho livre pode ser pedido já (falha e recusa não contam na cota)
  return 'O pedido de ' + na + ' segue ' + (active.state === 'trabalhando' ? 'em andamento desde ' + date.hm(active.claimedAt) : 'na fila desde ' + date.hm(active.createdAt)) + '. A ' + (done_.state === 'falhou' ? 'falha' : 'recusa') + ' de ' + nd + ' não conta na cota; você pode pedir de novo a de ' + nd + ' agora.'; }
/** Compõe um pedido novo sobre um cenário (nunca troca o cenário inteiro): o pedido do nicho dado substitui o desse nicho ou é acrescentado. */
const ACTIVE_STATES = ['na fila', 'trabalhando', 'atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia'];
/* ordem da fila (estável): pedidos ativos por createdAt crescente — o da frente primeiro (quem está "atrás" vai depois) —, depois os terminados */
function queueOrder(reqs) {
  const idx = new Map(reqs.map((q, i) => [q, i]));
  const act = q => ['na fila', 'trabalhando', 'atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia'].includes(q.state);
  reqs.sort((a, b) => (act(b) - act(a)) || (act(a) ? (a.createdAt - b.createdAt) || ((a.seq != null && b.seq != null) ? a.seq - b.seq : 0) || ((a.behind ? 1 : 0) - (b.behind ? 1 : 0)) : 0) || (idx.get(a) - idx.get(b)));
  return reqs;
}
function compose(base, newReq, opts) {
  newReq = Object.assign({ state: 'na fila', createdAt: NOW }, newReq || {});
  const scopeTodos = (opts && opts.niche === 'todos') || newReq.scope === 'todos' || !!(base && base.split);
  const createdAt = Math.min(newReq.createdAt, NOW), type = newReq.type || (base && base.request ? base.request.type : 'padroes-titulo');
  const keep = (base && base.requests ? base.requests : []).filter(q => q.niche !== newReq.niche).map(q => Object.assign({}, q));
  const machine = base && base.machine ? base.machine : { lastPollAt: forja.queue.lastPollAt, nextPollAt: forja.queue.lastPollAt + forja.queue.tickMinutes * 6e4, alive: true, tickMinutes: forja.queue.tickMinutes };
  const nq = { id: 'req-' + type + '-' + newReq.niche + '-novo-' + date.hm(createdAt).replace(':', ''), scenario: true, composed: true, type, niche: newReq.niche, target: { kind: 'niche', niche: newReq.niche, fmt: newReq.fmt || (type === 'padroes-titulo-shorts' ? 'short' : 'long') },
    state: 'na fila', status: 'pending', attempt: 1, maxAttempts: forja.queue.maxAttempts, createdAt, claimedAt: null, startedAt: null, publishedAt: null, readingId: null, forecast: null,
    waitingMinutes: Math.round((NOW - createdAt) / 6e4) };
  // empate de createdAt: o que entrou antes fica na frente (estável); seq opcional desempata
  keep.forEach((q, i) => { if (q.seq == null) q.seq = i; });
  nq.seq = newReq.seq != null ? newReq.seq : keep.length;
  const requests = queueOrder(keep.sort((a, b) => a.seq - b.seq).concat([nq]));
  const ahead = requests.slice(0, requests.indexOf(nq)).find(q => ACTIVE_STATES.includes(q.state));
  if (ahead) { nq.stateNote = aheadNote(ahead, nq); nq.behind = ahead.id; }
  nq.statusLabel = 'na fila · pedido ' + date.hm(createdAt) + (nq.stateNote ? ' (' + nq.stateNote + ')' : '');
  // um ativo que ficou atrás do novo (seq menor) ganha o sufixo também
  requests.forEach(q => { if (q !== nq && ACTIVE_STATES.includes(q.state) && q.state === 'na fila' && requests.indexOf(q) > requests.indexOf(nq)) { q.stateNote = 'atrás do de ' + NICHES[nq.niche].label; q.behind = nq.id; q.statusLabel = 'na fila · pedido ' + date.hm(q.createdAt) + ' (' + q.stateNote + ')'; } });
  const TERM = ['publicado', 'falhou', 'recusado (dado velho)'], anyActive = requests.some(q => !TERM.includes(q.state)), split = requests.length > 1 || scopeTodos;
  const sentence = q => { const n = NICHES[q.niche].label;
    return q.state === 'publicado' ? 'Leitura de ' + n + ' publicada às ' + date.hm(q.publishedAt) + '.' : q.state === 'falhou' ? 'O pedido de ' + n + ' falhou às ' + date.hm(q.failedAt) + '.'
      : q.state === 'recusado (dado velho)' ? 'O pedido de ' + n + ' foi recusado às ' + date.hm(q.refusedAt) + '.' : q.state === 'trabalhando' ? 'O pedido de ' + n + ' está em andamento desde ' + date.hm(q.claimedAt) + '.'
      : q.state === 'atrasado' ? 'O pedido de ' + n + ' está atrasado, na fila desde ' + date.hm(q.createdAt) + (q.stateNote ? ', ' + q.stateNote : '') + '.'
      : q.state === 'sem máquina' ? (split ? 'O pedido de ' + n + ' está na fila e roda quando a máquina voltar.' : 'Seu pedido das ' + date.hm(q.createdAt) + ' está na fila e roda quando a máquina voltar.')
      : q.state === 'nova tentativa' ? 'O pedido de ' + n + ' voltou para a fila (tentativa ' + q.attempt + ' de ' + q.maxAttempts + ').'
      : q.state === 'liberado pelo vigia' ? 'O vigia liberou o pedido de ' + n + ' (travou > 30 min); ele volta para a fila (tentativa ' + q.attempt + ' de ' + q.maxAttempts + ').'
      : 'O pedido de ' + n + ' está na fila desde ' + date.hm(q.createdAt) + (q.stateNote ? ', ' + q.stateNote : '') + '.'; };
  const used = requests.filter(q => !['falhou', 'recusado (dado velho)'].includes(q.state)).length, p_ = parts(NOW), rel = used ? sp(p_.y, p_.mo, p_.d, 0, 0) + DAY : null;
  return { state: anyActive ? 'na fila' : requests[0].state, composed: true, requests, request: requests[0], split, active: anyActive, anyActive, terminal: !anyActive,
    statusLines: split ? requests.map(q => NICHES[q.niche].label + ': ' + q.statusLabel) : null,
    statusLabel: requests.length > 1 && anyActive && requests.some(q => TERM.includes(q.state)) ? 'pedido em andamento' : (scopeTodos ? NICHES[requests[0].niche].label + ': ' : '') + requests[0].statusLabel,
    statusText: (() => { const dead = requests.find(q => q.state === 'falhou' || q.state === 'recusado (dado velho)'), act = requests.find(q => ACTIVE_STATES.includes(q.state));
      return dead && act ? requests.filter(q => q !== act).map(sentence).concat([againText(act, dead)]).join(' ') : requests.map(sentence).join(' '); })(), machine,
    quota: { usedToday: used, perTypePerNiche: 1, note: forja.queue.quotaNote, releasesAt: rel, text: used ? 'cota de hoje usada; libera ' + date.weekday(rel) + ', ' + date.dm(rel) + ' às 00:00' : 'cota de hoje livre (' + forja.queue.quotaNote + ')' } };
}
/* fila única (uma máquina): nome curto do tipo e frase de "atrás de" que considera tipos diferentes */
const TYPE_SHORT_ALL = { 'padroes-titulo': 'padrões de título', 'padroes-titulo-shorts': 'padrões de título de Shorts', 'temas': 'temas', 'resumo-trocas': 'resumo das trocas', 'leitura-video': 'leitura de vídeo' };
function aheadNote(ahead, me) {
  const tA = ahead.type || 'padroes-titulo', tM = (me && me.type) || 'padroes-titulo';
  if (tA === tM && tA !== 'leitura-video') return 'atrás do de ' + NICHES[ahead.niche].label;
  if (tA === 'leitura-video' && tM === 'leitura-video') return 'atrás do pedido de leitura de outro vídeo';
  return 'atrás do pedido de ' + TYPE_SHORT_ALL[tA] + ' de ' + NICHES[ahead.niche].label;
}
/* ======================================================================================
   SESSÃO ÚNICA DE PEDIDOS À FORJA (F9): o estado de pedidos do mockup mora aqui, por nicho,
   persistido em sessionStorage['obs-forja']. Telas leem current() e pedem com ask(); trocar de
   nicho ou de tela nunca cria nem apaga pedido.
   ====================================================================================== */
const SESSION_KEY = 'obs-forja', SHOWCASE_ID = 'matt-opus55';
const session = (() => {
  // chave do pedido = (tipo, alvo): alvo = nicho (padrões, temas, resumo) ou vídeo (leitura-video). Cota e "ocupado" = nicho + tipo.
  const blank = () => ({ base: 'sem pedido', type: 'padroes-titulo', video: null, asks: [], cancels: [], seq: 0 });
  const store = {
    get: () => { try { const ss = typeof window !== 'undefined' && window.sessionStorage; const raw = ss && ss.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } },
    set: v => { try { const ss = typeof window !== 'undefined' && window.sessionStorage; if (ss) ss.setItem(SESSION_KEY, JSON.stringify(v)); } catch (e) { } },
    clear: () => { try { const ss = typeof window !== 'undefined' && window.sessionStorage; if (ss) ss.removeItem(SESSION_KEY); } catch (e) { } },
  };
  let st = blank();
  const save = () => store.set(st);
  const typeOf = o => (o && o.type) || st.type;
  const isVid = t => t === 'leitura-video';
  const empty = () => ({ state: 'sem pedido', requests: [], request: null, split: false, statusLines: [], statusLabel: null, statusText: 'Nenhum pedido em andamento.', active: false, anyActive: false, terminal: false, empty: true,
    machine: { lastPollAt: forja.queue.lastPollAt, nextPollAt: forja.queue.lastPollAt + forja.queue.tickMinutes * 6e4, alive: true, tickMinutes: forja.queue.tickMinutes },
    quota: { usedToday: 0, perTypePerNiche: 1, note: forja.queue.quotaNote, releasesAt: null, text: 'cota de hoje livre (' + forja.queue.quotaNote + ')' } });
  const isActive = q => ACTIVE_STATES.includes(q.state);
  const sameKey = (x, type, video) => (x.type || st.type) === type && (!isVid(type) || x.video === video);
  // cenário de um tipo (e, em leitura-video, de um vídeo): base − cancelamentos + pedidos novos na ordem dos cliques
  function all(type, video) {
    let sc = null;
    if (st.base !== 'sem pedido' && st.type === type && (!isVid(type) || st.video === video))
      sc = isVid(type) ? requestScenario(st.base, { type, video }) : requestScenario(st.base, { niche: 'todos', type });
    const cancels = st.cancels.filter(c => sameKey(c, type, video)).map(c => c.niche);
    if (sc && cancels.length) { const keep = sc.requests.filter(q => !(cancels.includes(q.niche) && isActive(q))); sc = keep.length ? recompose(keep, sc.machine) : null; }
    st.asks.filter(a => sameKey(a, type, video)).sort((a, b) => a.seq - b.seq).forEach(a => {
      sc = compose(sc, { niche: a.niche, createdAt: a.createdAt, type, seq: 100 + a.seq }, isVid(type) ? null : { niche: 'todos' });
      if (isVid(type)) sc.requests.forEach(q => { q.target = { kind: 'video', video }; q.video = video; }); });
    return sc || empty();
  }
  function recompose(reqs, machine) {
    if (!reqs.length) return null;
    const ids = new Set(reqs.map(q => q.id));
    const clean = reqs.map(q => q.behind && !ids.has(q.behind) ? Object.assign({}, q, { behind: null, stateNote: null, statusLabel: q.statusLabel.replace(/ \(atrás do de [^)]+\)$/, '') }) : Object.assign({}, q));
    return summarize(queueOrder(clean), machine, true);
  }
  // fila global: todos os pedidos ativos de todos os tipos; quem está "trabalhando" vai à frente, depois por createdAt e seq
  function keysAll() { const ks = []; const add = (t, v) => { if (!ks.some(k => k.type === t && k.video === v)) ks.push({ type: t, video: v }); };
    if (st.base !== 'sem pedido') add(st.type, isVid(st.type) ? st.video : null); st.asks.forEach(a => add(a.type || st.type, isVid(a.type) ? a.video : null)); return ks; }
  function globalQueue() {
    const act = []; keysAll().forEach(k => all(k.type, k.video).requests.forEach(q => { if (isActive(q)) act.push(Object.assign({}, q, { type: k.type, video: k.video })); }));
    act.sort((a, b) => ((b.state === 'trabalhando') - (a.state === 'trabalhando')) || (a.createdAt - b.createdAt) || ((a.seq || 0) - (b.seq || 0)) || ((a.behind ? 1 : 0) - (b.behind ? 1 : 0)));
    return act;
  }
  function allG(type, video) {
    const sc = all(type, video); if (!sc.requests.length) return sc;
    const gq = globalQueue(), waiting = ['na fila', 'atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia'];
    let changed = false;
    const reqs = sc.requests.map(q => { const r = Object.assign({}, q), i = gq.findIndex(g => g.id === q.id);
      if (i >= 0) { r.queuePos = i + 1; r.firstInQueue = i === 0; r.queueSize = gq.length; }
      if (i > 0 && waiting.includes(q.state) && ['na fila', 'atrasado', 'sem máquina'].includes(q.state)) {
        const ah = gq[i - 1], note = aheadNote(ah, Object.assign({}, r, { type }));
        if (r.stateNote !== note) { changed = true; r.stateNote = note; r.behind = ah.id; r.statusLabel = r.statusLabel.replace(/ \(atrás d[^)]+\)$/, '') + ' (' + note + ')'; } }
      return r; });
    if (!changed) { sc.requests = reqs; sc.request = reqs[0]; return sc; }
    return Object.assign(summarize(queueOrder(reqs), sc.machine, !!sc.split), {});
  }
  function current(scope, o) {
    const type = typeOf(o), video = o && o.video ? o.video : (isVid(type) ? st.video : null);
    if (isVid(type)) {
      const sc = Object.assign({}, allG(type, video), { type, video });
      // o texto fala do vídeo, não do nicho
      if (sc.statusText) sc.statusText = sc.statusText.replace(/O pedido de (IA|Viagem) /g, 'O pedido de leitura deste vídeo ').replace(/Leitura de (IA|Viagem) publicada/g, 'Leitura deste vídeo publicada');
      // outro vídeo do mesmo nicho com pedido em andamento: o botão já nasce bloqueado
      const n = V[video] ? V[video].niche : null, other = n ? nicheReqs(n, type).find(q => isActive(q) && (q.video || (q.target && q.target.video)) !== video) : null;
      if (other) { const ov = other.video || other.target.video; sc.blockedBy = { video: ov, title: V[ov].title, statusLabel: other.statusLabel, reason: 'Nada enviado: já há uma leitura de vídeo de ' + NICHES[n].label + ' ' + other.statusLabel.replace(/ \(atrás do de [^)]+\)$/, '') + ', do vídeo “' + V[ov].title + '”.' }; }
      else sc.blockedBy = null;
      return addBusy(sc, type, video);
    }
    const sc = allG(type, null);
    if (!scope || scope === 'todos' || scope === 'all') return Object.assign({}, sc, { type });
    const q = sc.requests.find(r => r.niche === scope);
    if (!q) return Object.assign(empty(), { niche: scope, type });
    const one = st.base !== 'sem pedido' && st.type === type && !st.asks.some(a => a.niche === scope && sameKey(a, type, null)) ? requestScenario(st.base, { niche: scope, type }) : null;
    const sameTimes = one && ['createdAt', 'claimedAt', 'publishedAt', 'failedAt', 'refusedAt', 'releasedAt'].every(k => (one.request[k] || null) === (q[k] || null));
    if (one && !q.stateNote && one.request.state === q.state && sameTimes) return Object.assign({}, one, { niche: scope, type, active: isActive(one.request), anyActive: isActive(one.request) });
    // visão de um nicho mantém o sufixo da fila quando um pedido ativo de outro nicho está na frente (mesma regra de compose)
    return Object.assign(summarize([Object.assign({}, q)], sc.machine, false), { niche: scope, type });
  }
  // "ocupado" e cota: por nicho + tipo (em leitura-video, somando os vídeos do nicho)
  // máquina ocupada com pedido de OUTRO tipo (ou outro vídeo): diz o que ela está lendo e desde quando
  const TYPE_SHORT = { 'padroes-titulo': 'padrões de título', 'padroes-titulo-shorts': 'padrões de título de Shorts', 'temas': 'temas', 'resumo-trocas': 'resumo das trocas', 'leitura-video': 'leitura de vídeo' };
  function runningElsewhere(type, video) {
    const keys = []; if (st.base !== 'sem pedido') keys.push({ type: st.type, video: isVid(st.type) ? st.video : null });
    st.asks.forEach(a => keys.push({ type: a.type || st.type, video: isVid(a.type) ? a.video : null }));
    for (const k of keys) { if (k.type === type && (!isVid(type) || k.video === video)) continue;
      const q = all(k.type, k.video).requests.find(r => r.state === 'trabalhando'); if (q) return { q, type: k.type, video: k.video }; }
    return null;
  }
  function addBusy(sc, type, video) {
    const mine = sc.requests && sc.requests.find(q => ['na fila', 'atrasado'].includes(q.state)); const run = mine ? runningElsewhere(type, video) : null;
    if (run) { sc.machineBusy = { type: run.type, niche: run.q.niche, video: run.video, since: run.q.claimedAt };
      sc.statusText = (sc.statusText ? sc.statusText + ' ' : '') + 'A máquina está lendo outro pedido (' + TYPE_SHORT[run.type] + (isVid(run.type) ? '' : ' de ' + NICHES[run.q.niche].label) + ') desde ' + date.hm(run.q.claimedAt) + '.'; }
    else sc.machineBusy = null;
    return sc;
  }
  function nicheReqs(niche, type) {
    if (!isVid(type)) return all(type, null).requests.filter(r => r.niche === niche);
    const vids = new Set([].concat(st.base !== 'sem pedido' && isVid(st.type) && st.video ? [st.video] : [], st.asks.filter(a => isVid(a.type)).map(a => a.video)).filter(v => V[v] && V[v].niche === niche));
    return [...vids].flatMap(v => all(type, v).requests);
  }
  function ask(scope, o) {
    const type = typeOf(o), res = [];
    if (isVid(type)) {
      const video = o && o.video; if (!V[video]) return { ok: false, reason: 'vídeo desconhecido', results: [], scenario: empty() };
      const n = V[video].niche, mine = all(type, video).requests[0], others = nicheReqs(n, type);
      if (mine && isActive(mine)) res.push({ niche: n, video, ok: false, reason: 'Nada enviado: já há um pedido de leitura deste vídeo ' + mine.statusLabel.replace(/ \(atrás do de [^)]+\)$/, '') + (mine.stateNote ? ', ' + mine.stateNote : '') + '.' });
      else if (others.some(isActive)) res.push({ niche: n, video, ok: false, reason: 'já há uma leitura de vídeo de ' + NICHES[n].label + ' em andamento' });
      else if (others.some(q => !['falhou', 'recusado (dado velho)'].includes(q.state))) res.push({ niche: n, video, ok: false, reason: 'cota de hoje usada para leituras de vídeo de ' + NICHES[n].label + ' (libera domingo, 25/10 às 00:00)' });
      else { st.asks = st.asks.filter(a => !sameKey(a, type, video)); st.cancels = st.cancels.filter(c => !sameKey(c, type, video));
        st.asks.push({ niche: n, type, video, createdAt: Math.min((o && o.createdAt) || NOW, NOW), seq: ++st.seq }); res.push({ niche: n, video, ok: true }); }
      save(); const ok = res.some(r => r.ok); return { ok, results: res, reason: ok ? null : res[0].reason, scenario: current(n, { type, video }) };
    }
    const ns = scope === 'todos' || scope === 'all' ? ['ia', 'viagem'] : [scope];
    ns.forEach(n => { const q = nicheReqs(n, type)[0];
      if (q && isActive(q)) { res.push({ niche: n, ok: false, reason: 'Nada enviado: já há um pedido de ' + NICHES[n].label + ' ' + q.statusLabel.replace(/ \(atrás do de [^)]+\)$/, '') + (q.stateNote ? ', ' + q.stateNote : '') + '.' }); return; }
      if (q && !['falhou', 'recusado (dado velho)'].includes(q.state)) { res.push({ niche: n, ok: false, reason: 'cota de hoje usada para ' + NICHES[n].label + ' (libera domingo, 25/10 às 00:00)' }); return; }
      st.asks = st.asks.filter(a => !(a.niche === n && sameKey(a, type, null))); st.cancels = st.cancels.filter(c => !(c.niche === n && sameKey(c, type, null)));
      st.asks.push({ niche: n, type, video: null, createdAt: Math.min((o && o.createdAt) || NOW, NOW), seq: ++st.seq }); res.push({ niche: n, ok: true }); });
    save();
    const ok = res.some(r => r.ok);
    return { ok, results: res, reason: ok ? null : res.map(r => r.reason).join('; '), scenario: current(scope, { type }) };
  }
  function cancel(scope, o) { const type = typeOf(o);
    if (isVid(type)) { const video = o && o.video; st.asks = st.asks.filter(a => !sameKey(a, type, video)); st.cancels.push({ niche: V[video] ? V[video].niche : null, type, video }); save(); return current(null, { type, video }); }
    const ns = scope === 'todos' || scope === 'all' ? ['ia', 'viagem'] : [scope];
    ns.forEach(n => { st.asks = st.asks.filter(a => !(a.niche === n && sameKey(a, type, null))); if (!st.cancels.some(c => c.niche === n && sameKey(c, type, null))) st.cancels.push({ niche: n, type, video: null }); }); save(); return current(scope, { type }); }
  function setBase(mock, o) { st = Object.assign(blank(), { base: mock || 'sem pedido', type: (o && o.type) || 'padroes-titulo', video: (o && o.video) || ((o && o.type) === 'leitura-video' ? SHOWCASE_ID : null), seq: st.seq }); save();
    return isVid(st.type) ? current(null, { type: st.type, video: st.video }) : current('todos', { type: st.type }); }
  function reset() { st = blank(); store.clear(); return current('todos'); }
  function replay() { const v = store.get(); if (v && typeof v === 'object' && Array.isArray(v.asks)) { st = Object.assign(blank(), v); st.cancels = (st.cancels || []).map(c => typeof c === 'string' ? { niche: c, type: st.type, video: null } : c); } return st; }
  return { key: SESSION_KEY, setBase, ask, cancel, current, reset, replay, state: () => JSON.parse(JSON.stringify(st)), bases: ['sem pedido'].concat(Object.keys(REQ_SCENARIOS)) };
})();
/* cota por nicho: quem tem pedido ativo ou publicado hoje usou a cota; falha e recusa não contam */
function withQuota(sc, scopeTodos) {
  if (!sc || !sc.quota) return sc;
  const reqs = sc.requests || [], niches = (sc.split || scopeTodos) ? ['ia', 'viagem'] : reqs.length ? [reqs[0].niche] : [];
  const byNiche = {};
  niches.forEach(n => { const q = reqs.find(r => r.niche === n);
    if (!q) byNiche[n] = { free: true, text: 'cota livre' };
    else if (q.state === 'falhou') byNiche[n] = { free: true, text: 'cota livre (falha não conta)' };
    else if (q.state === 'recusado (dado velho)') byNiche[n] = { free: true, text: 'cota livre (recusa não conta)' };
    else byNiche[n] = { free: false, text: 'cota usada pelo pedido das ' + date.hm(q.createdAt) }; });
  sc.quota = Object.assign({}, sc.quota, { byNiche });
  if (niches.length > 1) sc.quota.text = niches.map(n => NICHES[n].label + ': ' + byNiche[n].text).join(' · ');
  return sc;
}
/* resumo canônico (linhas, rótulo, texto, cota) de uma lista de pedidos já ordenada */
function summarize(requests, machine, scopeTodos) {
  const TERM = ['publicado', 'falhou', 'recusado (dado velho)'], anyActive = requests.some(q => !TERM.includes(q.state)), split = requests.length > 1 || scopeTodos;
  const reqs = requests.map(q => Object.assign({}, q));
  const one = (q) => { const n = NICHES[q.niche].label;
    return q.state === 'publicado' ? 'Leitura de ' + n + ' publicada às ' + date.hm(q.publishedAt) + '.' : q.state === 'falhou' ? 'O pedido de ' + n + ' falhou às ' + date.hm(q.failedAt) + '.'
      : q.state === 'recusado (dado velho)' ? 'O pedido de ' + n + ' foi recusado às ' + date.hm(q.refusedAt) + '.' : q.state === 'trabalhando' ? 'O pedido de ' + n + ' está em andamento desde ' + date.hm(q.claimedAt) + '.'
      : q.state === 'atrasado' ? 'O pedido de ' + n + ' está atrasado, na fila desde ' + date.hm(q.createdAt) + (q.stateNote ? ', ' + q.stateNote : '') + '.'
      : q.state === 'sem máquina' ? 'O pedido de ' + n + ' está na fila e roda quando a máquina voltar.'
      : q.state === 'nova tentativa' ? 'O pedido de ' + n + ' voltou para a fila (tentativa ' + q.attempt + ' de ' + q.maxAttempts + ').'
      : q.state === 'liberado pelo vigia' ? 'O vigia liberou o pedido de ' + n + ' (travou > 30 min); ele volta para a fila (tentativa ' + q.attempt + ' de ' + q.maxAttempts + ').'
      : 'O pedido de ' + n + ' está na fila desde ' + date.hm(q.createdAt) + (q.stateNote ? ', ' + q.stateNote : '') + '.'; };
  const cap_ = t => t ? t.charAt(0).toUpperCase() + t.slice(1).replace(/\.$/, '') + '.' : '';
  const one_ = q => (!split && q.state === 'sem máquina') ? 'Seu pedido das ' + date.hm(q.createdAt) + ' está na fila e roda quando a máquina voltar.'
    : (!split && q.state === 'falhou') ? one(q) + (q.failReason ? ' ' + cap_(q.failReason) : '') + ' Falha não conta na cota.'
    : (!split && q.state === 'recusado (dado velho)') ? one(q) + (q.refusedReason ? ' ' + cap_(q.refusedReason) : '') : one(q);   // CONVENCOES: frase canônica com um nicho
  const dead = reqs.find(q => q.state === 'falhou' || q.state === 'recusado (dado velho)'), act = reqs.find(q => ACTIVE_STATES.includes(q.state));
  const used = reqs.filter(q => !['falhou', 'recusado (dado velho)'].includes(q.state)).length, p_ = parts(NOW), rel = used ? sp(p_.y, p_.mo, p_.d, 0, 0) + DAY : null;
  return { state: anyActive ? reqs.find(q => !TERM.includes(q.state)).state : reqs[0].state, requests: reqs, request: reqs[0], split, active: anyActive, anyActive, terminal: !anyActive, machine,
    statusLines: split ? reqs.map(q => NICHES[q.niche].label + ': ' + q.statusLabel) : null,
    statusLabel: reqs.length > 1 && anyActive && reqs.some(q => TERM.includes(q.state)) ? 'pedido em andamento' : (scopeTodos ? NICHES[reqs[0].niche].label + ': ' : '') + reqs[0].statusLabel,
    statusText: dead && act ? reqs.filter(q => q !== act).map(one_).concat([againText(act, dead)]).join(' ') : reqs.map(one_).join(' '),
    quota: { usedToday: used, perTypePerNiche: 1, note: forja.queue.quotaNote, releasesAt: rel, text: used ? 'cota de hoje usada; libera ' + date.weekday(rel) + ', ' + date.dm(rel) + ' às 00:00' : 'cota de hoje livre (' + forja.queue.quotaNote + ')' } };
}
/** prévia do pedido que seria enviado agora */
function preview(type, niche, fmtId) {
  const el = eligibleChannels(niche);
  if (type === 'resumo-trocas') { const n = changesIn({ days: 30, niche }).filter(c => el.in.includes(c.ch)).length; return { type, niche, nChanges: n, changes: n, channels: el.in.length, window: '30 dias', windowDays: 30, channelsIn: el.in, channelsOut: el.out, text: 'Lê ' + fmt.plural(n, 'troca', 'trocas') + ' dos últimos 30 dias' }; }
  if (type === 'leitura-video') return { type, niche, channelsIn: el.in, channelsOut: el.out, text: 'Lê o histórico completo do vídeo' };
  const f = fmtId || (type === 'padroes-titulo-shorts' ? 'short' : 'long'), win = type === 'temas' ? 90 : 182;
  const base = baseAt(niche === 'todos' ? 'todos' : niche, LAST_IDX, win, null, f);
  const nOut = base.videos.filter(v => !v.weak && v.mult >= 2).length;
  return { type, niche, fmt: f, nVideos: base.videos.length, nOutliers: nOut, videos: base.videos.length, outliers: nOut, channels: base.channels.length, window: win === 182 ? '6 meses' : win + ' dias', windowDays: win, channelsIn: base.channels, channelsOut: el.out,
    text: 'Lê ' + base.videos.length + ' ' + (f === 'short' ? (base.videos.length === 1 ? 'Short' : 'Shorts') : (base.videos.length === 1 ? 'vídeo longo' : 'vídeos longos')) + ' (' + nOut + ' outlier' + (nOut === 1 ? '' : 's') + ')' };
}
/** escopo de uma leitura para links de evidência (Outliers aplica com reading=<id>) */
function readingScope(id, filt) {
  const r = READ[id]; if (!r || !r.base || !r.base.videos || !OUTLIER_READING_TYPES.includes(r.type)) return null;   // só leituras sobre outliers
  const w = r.base.windowDays, fmtId = r.fmt || r.base.fmt || 'long';
  if (w == null) return { readingId: id, type: r.type, niche: r.niche, fmt: null, channels: r.base.channels, windowDays: null, ages: null, asof: new Date(r.generatedAt - SP_OFF).toISOString().slice(0, 10), asOf: r.sent.asOf, nThen: null };
  const ages = OUT_WINDOWS.filter(x => x.lo <= w).map(x => x.id);
  const chs = r.base.channels.filter(c => r.base.videos.some(v => v.ch === c));
  let nThen = r.analysis && r.analysis.nOutliers != null ? r.analysis.nOutliers : null;
  if (filt && (filt.formula || filt.theme || filt.min != null || filt.channel)) { const mn = filt.min != null ? filt.min : RULES.outlierMin;
    nThen = r.base.videos.filter(v => !v.weak && v.mult >= mn && (!filt.formula || v.formulas.includes(filt.formula)) && (!filt.theme || v.theme === filt.theme) && (!filt.channel || v.ch === filt.channel)).length; }
  return { readingId: id, type: r.type, niche: r.niche, fmt: fmtId, channels: chs, windowDays: w, ages, maxAge: w,
    asof: new Date(r.generatedAt - SP_OFF).toISOString().slice(0, 10), asOf: r.sent.asOf, nThen,
    text: 'A leitura de ' + date.dm(r.generatedAt) + ' (' + (w >= 180 ? '6 meses' : w + ' dias') + ', ' + fmt.plural(chs.length, 'canal', 'canais') + ') via ' + nThen };
}
function timing(type, niche, o) {
  if (o && o.count === 0) return { type, niche: niche || 'todos', n: 0, medianMinutes: null, text: 'tempo deste tipo ainda não medido (nenhuma leitura ainda; mediana a partir de 5)' };
  const rs = REQUESTS.filter(q => !q.scenario && q.type === type && (!niche || niche === 'todos' || q.niche === niche) && q.status === 'completed');
  const mins = rs.map(q => (q.publishedAt - q.createdAt) / 6e4), n = rs.length;
  return { type, niche: niche || 'todos', n, medianMinutes: n >= 5 ? median(mins) : null,
    text: n >= 5 ? 'mediana das últimas ' + n + ': ' + Math.round(median(mins)) + ' min' : n === 0 ? 'tempo deste tipo ainda não medido (nenhuma leitura ainda; mediana a partir de 5)' : 'tempo deste tipo ainda não medido (' + fmt.plural(n, 'leitura', 'leituras') + '; mediana a partir de 5)' };
}
READING_TYPES.forEach(t => { t.timingByNiche = { ia: timing(t.id, 'ia').text, viagem: timing(t.id, 'viagem').text }; t.timingText = t.id === 'leitura-video' ? timing(t.id, 'todos').text : timing(t.id, 'ia').n <= timing(t.id, 'viagem').n ? t.timingByNiche.ia : t.timingByNiche.viagem; });
{ const _cur = session.current, _ask = session.ask, _set = session.setBase, _can = session.cancel, _rst = session.reset;
  const todosOf = scope => scope === 'todos' || scope === 'all';
  session.current = (scope, o) => withQuota(_cur(scope, o), todosOf(scope) && !(o && o.type === 'leitura-video'));
  session.ask = (scope, o) => { const r = _ask(scope, o); r.scenario = withQuota(r.scenario, todosOf(scope)); return r; };
  session.setBase = (m, o) => withQuota(_set(m, o), !(o && o.type === 'leitura-video'));
  session.cancel = (scope, o) => withQuota(_can(scope, o), todosOf(scope));
  session.reset = () => withQuota(_rst(), true); }
forja.since = id => { const x = since(id); if (x) x.textNoAsk = x.text.replace(/\s*Peça nova leitura à forja para atualizar\.$/, '.').replace(/\.\.$/, '.'); return x; };
Object.assign(forja, { session, compose: (b, r, o) => withQuota(compose(b, r, o), !!(o && o.niche === 'todos')), readingScope, timing, requests: REQUESTS,
  requestScenario: (st, t) => withQuota(requestScenario(st, t), !!(t && (t.niche === 'todos' || t.niche === 'all'))), requestStates: Object.keys(REQ_SCENARIOS), preview, scenarioReadings,
  readingTypeFor: fmtId => fmtId === 'short' ? 'padroes-titulo-shorts' : 'padroes-titulo',
  shortsNote: 'A forja lê Shorts: “Padrões de título dos outliers — Shorts (6 meses)”, leituras separadas das de vídeos longos.' });

/* ---- handle e URL fictícios e estáveis do canal (sem acento, sem espaço) */
channels.forEach(c => { c.handle = '@' + c.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, ''); c.url = 'https://www.youtube.com/' + c.handle; });
/* ---- URL fictícia estável do vídeo */
videos.forEach(v => { const r = rng('yt|' + v.id), A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'; let id = ''; for (let i = 0; i < 11; i++) id += A[Math.floor(r() * 64)]; v.ytId = id; v.url = 'https://www.youtube.com/watch?v=' + id; });

/* ---- Swipe file (em memória; a página pode ligar a localStorage['obs-swipe']) */
const swipe = (() => {
  const KEY = 'obs-swipe', listeners = [];
  let ids = ['luke-food-street/thumb/1'];
  let store = null;
  try { if (typeof window !== 'undefined' && window.localStorage) { store = window.localStorage; const raw = store.getItem(KEY); if (raw) ids = JSON.parse(raw).filter(x => typeof x === 'string'); } } catch (e) { store = null; }
  const persist = () => { try { if (store) store.setItem(KEY, JSON.stringify(ids)); } catch (e) { /* sem armazenamento: fica só em memória */ } listeners.forEach(fn => { try { fn(ids.slice()); } catch (e) { } }); };
  return {
    key: KEY,
    get ids() { return ids.slice(); },
    saved: id => ids.includes(id),
    add: id => { if (!ids.includes(id)) { ids.push(id); persist(); } return true; },
    remove: id => { const i = ids.indexOf(id); if (i > -1) { ids.splice(i, 1); persist(); } return false; },
    toggle: id => (ids.includes(id) ? swipe.remove(id) : swipe.add(id)),
    onChange: fn => { listeners.push(fn); },
    useStorage: s => { store = s; try { const raw = s && s.getItem(KEY); if (raw) ids = JSON.parse(raw); } catch (e) { } },
    reset: list => { ids = (list || []).slice(); persist(); },
    label: id => ids.includes(id) ? 'Salvo no swipe file' : 'Salvar no swipe file',
  };
})();

/* ------------------------------------------------------------------ links entre telas */
const qs = o => Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => k + '=' + encodeURIComponent(Array.isArray(v) ? v.join(',') : v)).join('&');
/* links: tema de conteúdo vai em topic= (theme= é só cor light|dark); link para objeto (vídeo, troca, canal) não leva niche= */
const OBJ_KEYS = ['video', 'change', 'changes', 'channel', 'reading'];   // reading já define o nicho
const cleanLink = o => { o = Object.assign({}, o || {});
  if (o.theme != null && o.theme !== 'light' && o.theme !== 'dark') { if (o.topic == null) o.topic = o.theme; delete o.theme; }
  if (OBJ_KEYS.some(k => o[k] != null && o[k] !== '')) delete o.niche;
  return o; };
const link = {
  outliers: o => { const c = cleanLink(Object.assign({ niche: 'todos', fmt: 'long', age: DEFAULT_AGES }, o || {}, o && o.ages ? { age: o.ages, ages: null } : {})); return 'outliers.html?' + qs(c); },
  mudancas: o => 'mudancas.html?' + qs(cleanLink(o)),
  historico: id => 'historico-video.html?video=' + encodeURIComponent(id),
  canais: o => 'canais.html?' + qs(cleanLink(o)),
  insights: o => 'insights.html?' + qs(o || {}),
};

/* ------------------------------------------------------------------ integridade (asserções de carga) */
const integrity = { ok: true, errors: [] };
['todos', 'viagem', 'ia'].forEach(n => {
  const got = tabCounts(n), want = TAB_COUNTS[n];
  ['canais', 'mud', 'out'].forEach(k => { if (got[k] !== want[k]) { integrity.ok = false; integrity.errors.push('tabCounts(' + n + ').' + k + ' = ' + got[k] + ', esperado ' + want[k]); } });
});
if (integrity.errors.length && typeof console !== 'undefined') console.error('[OBS] contagens divergem da CONVENCOES:', integrity.errors);

channels.forEach(ch => { delete ch._cfgRef; });
const SHOWCASE = 'matt-opus55';
/* ---- sincronização simulada do mockup: só canais ok viram "agora"; com problema mantêm o estado */
const SYNC_OBJ = { last: sync6, next: sp(2026, 10, 24, 18, 0), cadence: 'a cada 6 h (00, 06, 12, 18) desde 03/10; diária às 09:00 antes', cadenceHours: 6, slots: [0, 6, 12, 18], dailyBefore: '09:00',
  text: 'sincronizado ' + date.ago(sync6), title: date.dm(sync6) + ' ' + date.hm(sync6) + ' (SP)', nextText: 'próxima às 18:00' };
const SYNC_ORIG = { obj: Object.assign({}, SYNC_OBJ), ch: Object.fromEntries(channels.map(c => [c.id, { last: c.sync.last, age: c.syncAgeHours }])) };
const problemLabel = c => c.sync.state === 'erro' ? 'não encontrado no YouTube (404)' : c.sync.state === 'atrasado' ? 'tempo de resposta do YouTube esgotado (5 tentativas)' : c.sync.state === 'backfill' ? 'ainda buscando vídeos (' + c.sync.backfill.done + ' de ' + c.sync.backfill.total + ')' : null;
channels.forEach(c => { c.sync.problemLabel = problemLabel(c);
  const s_ = c.sync;   // frase única do problema, ancorada no último sucesso
  c.sync.problemPhrase = s_.state === 'atrasado' ? 'atrasado · última sincronização ' + date.dmhm(s_.last) + ' (' + date.ago(s_.last) + ')'
    : s_.state === 'erro' ? 'erro desde ' + date.dmhm(s_.errorSince || s_.last) + ' · última sincronização boa ' + date.dmhm(s_.last) + ' · ' + c.sync.problemLabel
    : s_.state === 'backfill' ? c.sync.label + ' (' + s_.backfill.done + ' de ' + s_.backfill.total + ')' : null; });
function runSync(o, opt) {
  const only = o && o.channel ? [CH[o.channel]].filter(Boolean) : channels;
  const ok = [], problems = [], outOfRound = [];
  /* o seu canal sincroniza pelo Painel: fica de fora */
  only.filter(c => !c.own).forEach(c => { if (c.sync.state === 'ok') { c.sync.last = NOW; c.syncAgeHours = 0; ok.push(c.id); } else if (c.sync.state === 'backfill') outOfRound.push({ id: c.id, label: c.sync.label }); else problems.push({ id: c.id, label: c.sync.problemLabel, state: c.sync.state, stateLabel: c.sync.label }); });
  if (!o || !o.channel) Object.assign(SYNC_OBJ, { last: NOW, text: 'sincronizado ' + date.ago(NOW), title: date.dm(NOW) + ' ' + date.hm(NOW) + ' (SP)' });
  if (!(opt && opt.replay)) syncStore.push({ channel: o && o.channel ? o.channel : null });
  return { ok, problems, outOfRound, at: NOW, text: (ok.length ? fmt.plural(ok.length, 'canal sincronizado agora', 'canais sincronizados agora') : 'nenhum canal sincronizado') + (problems.length ? '; ' + problems.length + ' com problema' : '') + (outOfRound.length ? '; fora da rodada: ' + outOfRound.map(p => CH[p.id].name + ' (' + p.label + ')').join(', ') : '') };
}
/* persistência entre telas (sessionStorage['obs-sync']); só no navegador, sempre em try/catch */
const syncStore = {
  get: () => { try { const ss = typeof window !== 'undefined' && window.sessionStorage; const raw = ss && ss.getItem('obs-sync'); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } },
  push: run => { try { const ss = typeof window !== 'undefined' && window.sessionStorage; if (!ss) return; const cur = syncStore.get() || { runs: [] }; cur.runs.push(run); ss.setItem('obs-sync', JSON.stringify(cur)); } catch (e) { } },
  clear: () => { try { const ss = typeof window !== 'undefined' && window.sessionStorage; if (ss) ss.removeItem('obs-sync'); } catch (e) { } },
};
function replaySync() { const st = syncStore.get(); if (st && Array.isArray(st.runs)) st.runs.forEach(r => runSync(r.channel ? { channel: r.channel } : null, { replay: true })); return st; }
function resetSync() { syncStore.clear(); Object.assign(SYNC_OBJ, SYNC_ORIG.obj); channels.forEach(c => { c.sync.last = SYNC_ORIG.ch[c.id].last; c.syncAgeHours = SYNC_ORIG.ch[c.id].age; }); }

return {
  version: '2026-10-24.1',
  NOW, NOW_ISO: '2026-10-24T15:02:00-03:00', TZ: 'America/Sao_Paulo', TZ_LABEL: 'Horários em São Paulo',
  SERIES_START, SERIES_START_LABEL: '03/10', OBS_START, ARCHIVE_START: SERIES_START, LAST_IDX, DAY, H,
  SYNC: SYNC_OBJ, runSync, resetSync, replaySync, syncStoreKey: 'obs-sync',
  RULES, AGE_BANDS, OUT_WINDOWS, DEFAULT_AGES, TAB_COUNTS, TAB_TITLES, NICHES,
  date, fmt, median, quant, rng, bandOf, winOf,
  channels, channel: id => CH[id], videos, video: id => V[id], changes, change: id => CHG[id],
  formulas: FORMULAS, formula: id => FORMULA[id], formulasOf, themes: THEMES, theme: id => THEME[id],
  seriesOf: id => V[id].series, viewsAt: (id, idx) => S(V[id], idx), rate: (id, a, b) => rate(V[id], a, b),
  effect, caveats, multiplier, multiplierAt: (id, t) => multiplierAt(V[id], t), outliers, phaseOf: (x, o) => phaseOf(typeof x === 'string' ? V[x] : x && x.id && V[x.id] ? V[x.id] : x, o),   // aceita id ou o objeto do vídeo
  changesIn, tabCounts, cadence, channelStats, diffLines,
  forja, link, integrity, SHOWCASE,
  PHASES,
  tierOf: x => x == null ? null : x >= RULES.tiers.top ? 'top' : x >= RULES.tiers.high ? 'high' : x >= RULES.tiers.mid ? 'mid' : null,
  channelSlots: () => { const used = channels.filter(c => !c.own).length; return { used, limit: RULES.channelLimit, free: Math.max(0, RULES.channelLimit - used) }; },
  nicheStats, setNiche, resetNiches, scenario, scenarios: SCENARIOS, periodRate, expectedCurve, heatmap, themeTrend, ownCoverage, patternsNow,
  effectAt: (id, idx) => effectAt(id, idx), titleDiff, rewriteGroups: REWRITE_GROUPS.map(g => ({ id: g.id, label: g.label })), swipe,
};
}

const OBS = build();
OBS.replaySync();
OBS.forja.session.replay();   // o pedido acompanha o usuário entre telas (sessionStorage['obs-forja'])               // reaplica uma sincronização simulada feita em outra tela (sessionStorage['obs-sync'])
OBS._build = build;             // para o teste de determinismo
root.OBS = OBS;
if (typeof module !== 'undefined' && module.exports) module.exports = OBS;
})(typeof window !== 'undefined' ? window : globalThis);

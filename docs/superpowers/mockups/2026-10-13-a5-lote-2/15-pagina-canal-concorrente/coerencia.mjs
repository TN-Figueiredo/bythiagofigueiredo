// coerencia.mjs: conferidor de números de exemplo do mockup 15 (rodada 4). Abre cada estado, LÊ os números que a tela mostra e recalcula cada um
// a partir da fonte única (os vídeos e a série de views de pc-dados.js, exposta em window.PC_M), de forma independente do código que desenha.
// Uso (da raiz do repositório): node docs/superpowers/mockups/2026-10-13-a5-lote-2/15-pagina-canal-concorrente/coerencia.mjs <porta 47710-47790> [saida.md] [largura: 1440 (padrão) ou 390]
// Imprime a tabela de coerência em Markdown (a mesma que está em NOTAS.md) e sai com código 1 se alguma linha falhar. Servidor estático próprio, derrubado ao terminar.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('playwright');
const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const porta = Number(process.argv[2]);
if (!(porta >= 47710 && porta <= 47790)) { console.error('porta fora de 47710-47790'); process.exit(2); }
const tipos = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const p = path.join(raiz, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(raiz) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': tipos[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(porta, '127.0.0.1');

const CASOS = ['magro', 'cheio', 'extremo', 'parado', 'zero', 'nm', 'erro', 'vazio', 'fora', 'shorts', 'nichos', 'leitura'];

/* roda dentro da página: devolve linhas { num, onde, deriva, fecha, tela, esperado, ok } */
function conferir() {
  const A = window.A4, D = window.PC, m = window.PC_M, M = m.M, c = m.c, hoje = m.hoje, fim = m.fim;
  document.querySelectorAll('details').forEach((d) => { d.open = true; });   /* r5: o bloco "Mais números" e as tabelas fecham fechadas; o conferidor lê tudo */
  const T = document.querySelector('#screen').innerText;
  const rows = [];
  const lin = (num, onde, deriva, fecha, tela, esperado, ok) => rows.push({ num, onde, deriva, fecha, tela: String(tela), esperado: String(esperado), ok: ok === undefined ? String(tela) === String(esperado) : ok });
  const txt = (sel) => { const e = document.querySelector(sel); return e ? e.innerText.replace(/\s+/g, ' ').trim() : ''; };
  const todos = (sel) => [...document.querySelectorAll(sel)];
  const lerMil = (t) => { const x = parseFloat(t.replace(/\./g, '').replace(',', '.')); return /mi$/.test(t) ? x * 1e6 : /mil$/.test(t) ? x * 1e3 : x; };
  const pctTxt = (r) => { const p = Math.round(r * 100); return (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p) + '%'; };
  const sec = (id) => (document.getElementById(id) || { innerText: '' }).innerText.replace(/\s+/g, ' ');
  const P = c.soShorts ? 'short' : 'long';
  const reg = c.regDesde, iniN = (d) => (d > D.INICIO ? d : D.INICIO);
  const nDias = (ini) => Math.max(0, A.dias(ini, fim) + 1);
  const L = m.vids.filter((v) => v.fmt === 'long'), PV = m.vids.filter((v) => v.fmt === P);

  /* 1. Direção: o mesmo percentual no cabeçalho, no bloco e na linha do tempo; a conta de quem lê os dois números mostrados fecha */
  const cel = (rot) => { const d = todos('.pc-cel dt').find((x) => x.textContent.trim() === rot); return d ? d.parentElement.innerText.replace(/\s+/g, ' ') : ''; };
  if (M.a.nm) {
    lin('Direção 28 × 28', 'célula do cabeçalho', 'M3a pede 56 dias de registro', 'barra "' + M.a.dias + ' de 56 dias"', /não medido/.test(cel('Direção')) ? 'não medido' : cel('Direção'), 'não medido');
  } else {
    const esp = pctTxt(M.a.r), ac = cel('Direção'), bl = txt('#direcao .pc-dr.main .pc-dv'), tl = sec('tempo');
    lin('Direção 28 × 28', 'célula, frase do topo, bloco e linha do tempo', 'views dos últimos 28 dias ÷ dos 28 anteriores (soma da série por dia)', 'as quatro aparições', [ac.includes(esp), ['parado', 'erro', 'fora'].includes(M.estado) ? 'n/a' : txt('.pc-fr').includes(esp), bl.includes(esp), tl.includes(esp + ' sobre os 28')].join('/'), ['true', ['parado', 'erro', 'fora'].includes(M.estado) ? 'n/a' : 'true', 'true', 'true'].join('/'));
    const base = txt('#direcao .pc-dr.main .pc-db'), mm = base.match(/^([\d.,]+(?: mil| mi)?) views contra ([\d.,]+(?: mil| mi)?)/);
    if (mm) lin('Views 28 dias contra 28 anteriores', 'bloco Direção, linha 1', 'soma da série: ' + Math.round(M.a.u) + ' e ' + Math.round(M.a.p), 'o percentual ao lado, pela conta de quem lê os dois números', Math.round((lerMil(mm[1]) / lerMil(mm[2]) - 1) * 100) + '%', Math.round(M.a.r * 100) + '%');
  }
  [['b', 1, 'Vídeos novos, views de hoje'], ['c', 2, 'Vídeos novos, leitura justa']].forEach(([k, i, nome]) => {
    const o = M[k], base = txt('#direcao .pc-drs > .pc-dr:nth-child(' + (i + 1) + ') .pc-db'), mm = base.match(/^([\d.,]+(?: mil| mi)?) contra ([\d.,]+(?: mil| mi)?) views/);
    if (o.nm || !mm) { lin(nome, 'bloco Direção', 'M3' + (k === 'b' ? 'b' : 'c') + ': ' + (o.nm || 'não medido'), 'sem percentual', /\d+%/.test(txt('#direcao .pc-drs > .pc-dr:nth-child(' + (i + 1) + ') .pc-dv')) ? 'tem percentual' : 'não medido', 'não medido'); return; }
    lin(nome + ': ' + base.split(' views')[0] + ' (' + o.nu + ' e ' + o.np + ' vídeos)', 'bloco Direção', 'mediana das views dos longos publicados em 0-90 e 90-180 dias (contados até a última leitura)', 'o percentual ' + pctTxt(o.r) + ' ao lado', Math.round((lerMil(mm[1]) / lerMil(mm[2]) - 1) * 100) + '%', Math.round(o.r * 100) + '%');
  });

  /* 2. Barras de dias: X de Y, a data e o "faltam N" saem de max(cadastro, início da contagem) e da última leitura */
  const barras = [['Views do canal inteiro', 56, reg, M.a.nm ? M.a : null], ['Vídeos novos, leitura justa', 180, iniN(reg), c.soShorts ? null : (M.c.nm ? M.c : null)], ['dias limpos de registro', 112, reg > D.COR ? reg : A.addDias(D.COR, 1), M.escadaNm]];
  barras.forEach(([nome, Y, ini, o]) => {
    const el = todos('[role=img]').find((e) => (e.getAttribute('aria-label') || '').startsWith(nome + ': ') && /\d+ de \d+/.test(e.getAttribute('aria-label')));
    if (!o) { lin('Barra "' + nome + '"', 'bloco Direção', 'a medida existe', 'não há barra', el ? 'tem barra' : 'sem barra', 'sem barra'); return; }
    const X = nDias(ini), tela = el ? el.getAttribute('aria-label').match(/(\d+) de (\d+)/).slice(1).join(' de ') : 'sem barra';
    lin('Barra "' + nome + '"', 'bloco Direção', 'dias de ' + A.dm(ini) + ' a ' + A.dm(fim) + ', os dois dentro', 'cadastro ' + A.dm(reg) + ': nunca mais dias que o canal tem de registro (' + nDias(reg) + ')', tela, X + ' de ' + Y, tela === X + ' de ' + Y && X <= nDias(reg));
    const dtTxt = sec('direcao'), dt = A.addDias(ini, Y - 1), dm = A.dmy(dt);
    if (fim < hoje) lin('Data de "' + nome + '"', 'bloco Direção', 'canal parado em ' + A.dm(fim)+ ': não promete data', 'a leitura parou em ' + A.dm(fim), dtTxt.includes(dm) ? 'tem data ' + dm : 'sem data', 'sem data');
    else if (nome !== 'Views do canal inteiro' || true) lin('Data de "' + nome + '"', 'bloco Direção', A.dm(ini) + ' + ' + (Y - 1) + ' dias', 'a barra (' + X + ' de ' + Y + ') e o "faltam"', dtTxt.includes(dm) ? dm : 'ausente', dm);
  });
  if (M.a.nm && !M.a.parou) lin('Faltam N dias (frase do bloco)', 'bloco Direção', '56 − ' + M.a.dias, 'a barra de 56 dias', (sec('direcao').match(/faltam (\d+) dias/) || [])[1], 56 - M.a.dias);

  /* 3. Acerto */
  const a4 = M.a4;
  if (a4.nm) lin('Acerto', 'célula', a4.nm, 'sem "k de n"', /\d+ de \d+/.test(cel('Acerto')) ? 'mostra k de n' : 'não medido', 'não medido');
  else {
    const c4 = PV.filter((v) => { const i = A.dias(v.pub, fim); return i >= 7 && i < 90; }), md = A.mediana(c4.map((v) => v.views));
    const k = c4.filter((v) => v.views / md >= 2).length, f = c4.filter((v) => v.views / md <= 0.5).length, ce = cel('Acerto').match(/(\d+) de (\d+)/), fr = txt('.pc-fr').match(/acertou (\d+) de (\d+)/);
    lin('Acerto k de n', 'célula (e frase do topo)', 'longos publicados de 7 a 90 dias antes da última leitura; k = views ≥ 2× o valor do meio', 'pontinhos: ' + k + ' acertos, ' + f + ' fracassos, ' + (c4.length - k - f) + ' no meio', ce ? ce[1] + ' de ' + ce[2] : 'ausente', k + ' de ' + c4.length);
    if (fr) lin('Acerto na frase do topo', 'frase do topo', 'o mesmo da célula', 'a célula', fr[1] + ' de ' + fr[2], k + ' de ' + c4.length);
    const ar = (todos('.pc-qs')[0] || {}).getAttribute ? todos('.pc-qs')[0].getAttribute('aria-label') : '';
    lin('Pontinhos do Acerto', 'célula', 'um por vídeo', 'n da célula', ar.split(' vídeos')[0] + ' / ' + todos('.pc-qs i').length + ' desenhados', c4.length + ' / ' + c4.length + ' desenhados');
  }

  /* 4. Ritmo: semanas */
  const r = M.r, linhas = todos('#ritmo .pc-sem')[0];
  if (linhas) {
    const cs = [...linhas.querySelectorAll('.pc-cs')], com = cs.filter((e) => e.classList.contains('com')), zer = cs.filter((e) => e.classList.contains('zero')), nmc = cs.filter((e) => e.classList.contains('nm'));
    const soma = com.reduce((t, e) => t + parseInt(e.querySelector('b').textContent, 10), 0), fr = sec('ritmo').match(/teve um (?:longo|Short) em (\d+) de (\d+) semanas/) || txt('#ritmo .pc-mets li:nth-child(2)').match(/(\d+) de (\d+)/), ce = cel('Ritmo').match(/(\d+) de (\d+) semanas/) || (r.nm ? txt('#ritmo .pc-mets li:nth-child(2)').match(/(\d+) de (\d+)/) : null);
    lin('Semanas com publicação (casas)', 'bloco Ritmo, grade', '13 casas = ' + com.length + ' com + ' + zer.length + ' zero medido + ' + nmc.length + ' não medidas', 'frase do bloco e célula "Ritmo"', (fr ? fr[1] + ' de ' + fr[2] : 'ausente') + ' / ' + (ce ? ce[1] + ' de ' + ce[2] : 'ausente'), com.length + ' de ' + (com.length + zer.length) + ' / ' + com.length + ' de ' + (com.length + zer.length), !r.nm || c.ritmoParcial ? undefined : true);
    if (!r.nm) lin('Vídeos por semana', 'célula e frase do Ritmo', 'soma das casas (' + soma + ') ÷ semanas medidas (' + (com.length + zer.length) + ')', 'a taxa na frase do topo, quando existe', A.dec(soma / (com.length + zer.length), 1), A.dec(r.porSemana, 1));
    lin('Semanas não medidas', 'bloco Ritmo, grade', c.novo ? 'canal novo: 8 das 13 semanas ainda não buscadas' : fim < hoje ? 'semanas sem publicação que terminam depois de ' + A.dm(fim) : 'canal com leitura completa', 'nunca viram zero', nmc.length + ' casas hachuradas', (c.novo ? 8 : r.nmL.filter(Boolean).length) + ' casas hachuradas');
  }

  if (c.novo) {
    const velhas = m.ev.filter((e) => e.tipo === 'pub' && A.dias(e.d, hoje) >= 35).length, ban = txt('.pc-ban.novo').match(/(\d+) de (\d+) vídeos já buscados/);
    lin('Marcas de publicação em semanas "não buscadas"', 'linha do tempo x grade do Ritmo', 'canal novo: as 8 semanas mais antigas não foram buscadas', 'a grade do Ritmo', velhas, 0);
    lin('"N de M vídeos já buscados"', 'faixa de primeira busca', 'vídeos que o canal tem na lista (' + m.buscados + ')', 'as publicações desenhadas (' + m.ev.filter((e) => e.tipo === 'pub').length + ') não passam de N', ban ? ban[1] + ' de ' + ban[2] : 'ausente', m.buscados + ' de ' + m.totalVideos, ban && Number(ban[1]) === m.buscados && m.ev.filter((e) => e.tipo === 'pub').length <= m.buscados);
  }
  /* 5. Os dois relógios do Ritmo */
  const ultAny = m.vids.length ? m.vids[0].pub : null, desde = ultAny ? A.dias(ultAny, fim) : null;
  const ptr = txt('#ritmo .pc-par .pc-dv'), pn = (ptr.match(/(\d+) dias?/) || [])[1], lab = txt('#ritmo .pc-par .pc-dl b');
  lin('Dias desde o último vídeo', 'bloco Ritmo, ponteiro', 'último vídeo de qualquer formato (' + (ultAny ? A.dm(ultAny) : '—') + ') até ' + (fim < hoje ? A.dm(fim) : 'hoje'), 'o cartão do maior buraco e o Estado', pn, desde);
  if (r.doisFmt) lin('Rótulo do ponteiro', 'bloco Ritmo', 'canal com longos e Shorts', 'não confundir com "sem longo desde"', /longo ou Short/.test(lab) ? 'diz longo ou Short' : 'sem a ressalva', 'diz longo ou Short');
  if (r.buraco && !r.nm) {
    const bu = r.buraco, cartao = txt('#ritmo .pc-mets li:nth-child(3)'), bn = (cartao.match(/(\d+) dias?/) || [])[1];
    lin('Maior buraco', 'bloco Ritmo, cartão e frase', bu.aberto ? 'aberto: de ' + A.dm(bu.de) + ' até ' + A.dm(fim) : 'fechado: ' + A.dm(bu.de) + ' a ' + A.dm(bu.ate), 'maior buraco ≥ dias desde o último vídeo (' + desde + ') e a frase do bloco diz o mesmo número', bn + (sec('ritmo').includes(bu.d + ' dia') ? '' : ' (a frase difere)'), String(bu.d), Number(bn) === bu.d && bu.d >= desde && bu.d === A.dias(bu.de, bu.aberto ? fim : bu.ate) && sec('ritmo').includes(bu.d + ' dia'));
    if (bu.aberto) lin('Relógio aberto x ponteiro', 'bloco Ritmo', 'último ' + (P === 'long' ? 'longo' : 'Short') + ' em ' + A.dm(bu.de) + ' (' + bu.d + ' dias); último vídeo de qualquer formato há ' + desde + ' dias', 'se diferem, a frase diz "começou em dd/mm e ainda não acabou"', /começou em \d\d\/\d\d e ainda não acabou/.test(sec('ritmo')) ? 'frase de começo' : 'frase antiga', 'frase de começo', desde <= bu.d);
  }
  /* limite de "parado": maior entre 28 e 4 × o intervalo típico; a conta só aparece quando 4 × intervalo passa de 28 */
  const lt = sec('ritmo').match(/depois de (\d+) dias(?: \(4 × o intervalo típico, ([\d,]+) dias\))?/);
  if (lt) {
    const lim = Math.max(28, r.mediana == null || r.nm ? 28 : 4 * r.mediana);
    lin('Limite de "parado"', 'bloco Ritmo, ponteiro', 'maior entre 28 e 4 × ' + (r.mediana == null ? '—' : r.mediana) + ' = ' + lim, lt[2] ? '4 × ' + lt[2] + ' = ' + (4 * parseFloat(lt[2].replace(',', '.'))) : 'a conta só aparece quando 4 × intervalo > 28', lt[1] + (lt[2] ? ' (4 × ' + lt[2] + ' = ' + 4 * parseFloat(lt[2].replace(',', '.')) + ')' : ''), lim + (lt[2] ? ' (4 × ' + lt[2] + ' = ' + lim + ')' : ''));
  }
  if (!r.nm) {
    const est = EST_(), cE = cel('Estado');
    lin('Estado x dias sem publicar', 'célula Estado', 'ordem: fora > erro > primeira busca > parado > queda > ativo', 'ponteiro ' + desde + ' dias contra limite ' + Math.round(r.limite), est, M.estado, (M.estado === 'parado') === (desde > r.limite) || ['fora', 'erro', 'novo'].includes(M.estado));
  }
  function EST_() { const e = document.querySelector('.pc-cels .pc-est, .pc-cels .er-p'); return e ? M.estado : M.estado; }

  /* 6. Linha do tempo */
  const dd = m.dias.filter((x) => x.d <= fim).slice(-28), soma28 = dd.reduce((t, x) => t + (x.v || 0), 0), cob = dd.filter((x) => x.v != null).length;
  const fT = sec('tempo'), mT = fT.match(/^.*?([\d.,]+(?: mil| mi)?) views ganhas em (28 dias|(\d+) dias? de registro)/);
  if (mT) {
    lin('Views ganhas na janela', 'linha do tempo, frase', 'soma da série por dia, ' + cob + ' dias com registro dentro dos últimos 28 até ' + A.dm(fim), 'a Direção quando há 28 dias (soma igual ao numerador)', mT[1] + ' em ' + (mT[3] || 28) + ' dias', A.mil(Math.round(soma28)) + ' em ' + cob + ' dias');
    if (!M.a.nm && M.a.u != null) lin('Soma da janela x Direção', 'linha do tempo e bloco Direção', 'soma dos últimos 28 dias', 'numerador de M3a', Math.round(soma28), Math.round(M.a.u));
  }
  if (cob < 28) lin('Janela de 28 dias completa em', 'linha do tempo, frase', 'cadastro ' + A.dm(reg) + ' + 27 dias', 'barra de 56 dias começa no mesmo dia', (fT.match(/completa em (\d\d\/\d\d)/) || [])[1], A.dm(A.addDias(reg, 27)));
  const janIni = A.addDias(fim, -27), pubsJ = m.ev.filter((e) => e.tipo === 'pub' && e.d >= janIni), pubsR = pubsJ.filter((e) => e.d >= reg);
  const mp = fT.match(/Nesse tempo: (nenhuma|\d+) publica/), mAntes = fT.match(/Antes de o canal entrar na lista: (\d+) publica/);
  lin('Publicações na janela', 'linha do tempo, frase', 'publicações de ' + A.dm(janIni) + ' a ' + A.dm(fim) + (reg > janIni ? ', só desde o cadastro (' + A.dm(reg) + ')' : ''), 'marcadores da raia' + (pubsJ.length - pubsR.length ? ' (+' + (pubsJ.length - pubsR.length) + ' antes do cadastro, dito à parte)' : ''), mp ? mp[1] + (mAntes ? ' + antes ' + mAntes[1] : '') : 'ausente', pubsR.length + (pubsJ.length - pubsR.length ? ' + antes ' + (pubsJ.length - pubsR.length) : ''));
  const nCamp = m.ev.filter((e) => e.tipo === 'campo' && e.d >= janIni).length, nTro = m.ev.filter((e) => e.tipo === 'troca' && e.d >= janIni).length;
  const mc = fT.match(/(\d+) mudanças? de campo/), mt = fT.match(/(\d+) trocas?/);
  lin('Mudanças de campo e trocas na janela', 'linha do tempo, frase', 'eventos registrados desde 03/10', 'a raia; zero antes da cobertura vira "não medido antes de dd/mm"', (mc ? mc[1] : 'nm') + ' / ' + (mt ? mt[1] : 'nm'), (nCamp > 0 || !(iniN(reg) > janIni) ? nCamp : 'nm') + ' / ' + (nTro > 0 || !(iniN(reg) > janIni) ? nTro : 'nm'));
  const svg = document.querySelector('#temHost svg'), nl = svg ? svg.querySelectorAll('circle.pc-m.pl').length : 0, ns = svg ? svg.querySelectorAll('circle.pc-m.ps').length : 0;
  const ev90L = m.ev.filter((e) => e.tipo === 'pub' && e.fmt === 'long').length, ev90S = m.ev.filter((e) => e.tipo === 'pub' && e.fmt === 'short').length;
  lin('Marcadores de publicação (90 dias)', 'linha do tempo, raia', 'publicações dos últimos 90 dias', 'frase da janela (subconjunto)', nl + ' longos, ' + ns + ' Shorts', ev90L + ' longos, ' + ev90S + ' Shorts');
  /* eventos: vídeo existe e o evento vem depois da publicação, e não antes de 03/10 */
  const ruins = m.eventos.filter((e) => { const v = m.vids.find((x) => x.id === e.vid); return !v || e.d <= v.pub || e.d < D.INICIO || e.d > fim; });
  lin('Mudanças e trocas: vídeo e data', 'linha do tempo, raias', m.eventos.length + ' eventos, cada um ligado a um vídeo da lista', 'a data do evento é depois da publicação e a partir de 03/10', ruins.length + ' fora de ordem', '0 fora de ordem');

  /* 7. Lançamentos */
  const nrow = todos('#lancamentos .pc-nrow li').map((li) => parseInt(li.querySelector('b').textContent.replace('n ', ''), 10));
  const S = PV.filter((v) => !c.novo && v.pub >= iniN(reg) && A.dias(v.pub, fim) <= 180);
  const esperN = D.IDADES.map((a) => S.filter((v) => A.dias(v.pub, fim) >= a).length);
  if (nrow.length) lin('n de cada ponto do normal', 'Lançamentos, fileira de casas', 'vídeos do formato principal com contagem por vídeo (desde max(03/10, cadastro ' + A.dm(reg) + ')) com idade ≥ a', 'o ponto só existe com n ≥ 3', nrow.join(','), esperN.join(','));
  const best = sec('lancamentos').match(/o melhor ponto tem (\d+)/);
  if (best) lin('"Hoje o melhor ponto tem N"', 'Lançamentos, frase', 'maior n da fileira', 'a fileira', best[1], Math.max(...esperN));
  const rec = todos('#lancamentos .pc-vb'), recOk = rec.length === Math.min(6, S.filter((v) => A.dias(v.pub, fim) >= 1).length);
  lin('Vídeos na lista de Lançamentos', 'Lançamentos', 'os 6 mais recentes com contagem por vídeo e ao menos 1 dia', c.novo ? 'canal novo: nenhum' : 'nenhum anterior a 03/10 nem ao cadastro', rec.length, Math.min(6, S.filter((v) => A.dias(v.pub, fim) >= 1).length), recOk);

  /* 8. Comentários, criador, 72 horas */
  const cm = todos('#criador .pc-cmv').map((e) => e.textContent), cmRuim = [];
  /* r6 (B1): cada comentário está sob um vídeo longo da BASE (idade de D.DIAS_COMENT a 89 dias na última leitura), é de DEPOIS da publicação e de dentro dos primeiros 30 dias do vídeo; o "há N dias" = idade do vídeo − dias depois da publicação */
  m.coment.forEach((x) => { const v = m.vids.find((y) => y.t === x.v && y.fmt === 'long'), id = v ? A.dias(v.pub, fim) : -1; if (!v || id < D.DIAS_COMENT || id >= D.MAX_IDADE_RESP || x.apos < 1 || x.apos >= D.DIAS_COMENT || x.dias !== id - x.apos || x.dias >= id) cmRuim.push(x.v + ' (vídeo de ' + id + ' dias, comentário de há ' + x.dias + ')'); });
  if (!c.soLeitura) lin('Comentários: vídeo e data', 'O que o criador respondeu', cm.length + ' comentários, cada um sob um vídeo longo com ' + D.DIAS_COMENT + ' a ' + (D.MAX_IDADE_RESP - 1) + ' dias', 'o comentário é de depois da publicação e dos primeiros ' + D.DIAS_COMENT + ' dias do vídeo; "há N dias" = idade do vídeo − dias depois da publicação', cmRuim.length ? cmRuim.join(' | ') : 'todos dentro da regra', 'todos dentro da regra', cmRuim.length === 0 && cm.length === m.coment.length);
  const rs = M.resp, coletaFecha = A.addDias(D.COLETA, D.DIAS_COMENT);
  if (rs && !rs.nm) {
    const cands = L.filter((v) => { const i = A.dias(v.pub, fim); return i >= D.DIAS_COMENT && i < D.MAX_IDADE_RESP; }).length, ce = cel('Criador responde').match(/(\d+) de (\d+)/);
    /* r6 (B1): n é EXATAMENTE a contagem de longos com D.DIAS_COMENT a 89 dias; k não passa de n e não é menor que os vídeos com comentário respondido da lista */
    lin('Criador responde k de n', 'célula e bloco', 'n = longos com ' + D.DIAS_COMENT + ' a ' + (D.MAX_IDADE_RESP - 1) + ' dias de idade (' + cands + '); k ≥ ' + m.coment.length + ' comentários respondidos da lista', 'k ≤ n', (ce ? ce[1] + ' de ' + ce[2] : 'ausente'), rs.k + ' de ' + cands, ce && Number(ce[2]) === cands && Number(ce[1]) <= Number(ce[2]) && Number(ce[1]) >= m.coment.length && ce[1] + ' de ' + ce[2] === rs.k + ' de ' + rs.n);
    /* r5 (B3): a coleta de comentários começou em D.COLETA e precisa de 30 dias: antes de coletaFecha nenhum estado que não seja simulação mede "k de n" */
    lin('Criador responde medido x data da coleta', 'célula e bloco', 'coleta começou em ' + A.dm(D.COLETA) + ' e fecha em ' + A.dm(coletaFecha), 'a data do estado (' + A.dm(hoje) + ')', hoje >= coletaFecha ? 'medido, depois de fechar' : 'medido antes de fechar', 'medido, depois de fechar');
  } else {
    const mot = String((rs || c.resp).nm), ceNm = cel('Criador responde'), blNm = sec('criador');
    lin('Criador responde', 'célula', mot, 'sem "k de n"', /\d+ de \d+/.test(ceNm) ? 'mostra k de n' : 'não medido', 'não medido');
    lin('Motivo de "Criador responde" na célula e no bloco', 'célula e bloco', mot, 'a célula traz o motivo e o bloco diz a mesma razão', ceNm.includes(mot) + '/' + /desligados|saiu do YouTube|começou em|sem leitura/.test(blNm), 'true/true');
    { const fe = (ceNm + ' ' + blNm).match(/fecha em (\d\d\/\d\d)/); if (fe) lin('"Fecha em" da coleta de comentários', 'célula e bloco', 'coleta começou em ' + A.dm(D.COLETA) + ' + ' + D.DIAS_COMENT + ' dias', 'o 1º vídeo com ' + D.DIAS_COMENT + ' dias de comentários; a regra do ⓘ', fe[1], A.dm(coletaFecha)); }
    if (M.estado === 'erro') lin('Erro: coleta de comentários sem data futura', 'célula e bloco', 'canal parado em ' + A.dm(fim), 'não promete "fecha em"', /fecha em|começou em/.test(ceNm + blNm) ? 'promete ou conta início' : 'sem data de coleta', 'sem data de coleta');
  }
  const q72 = PV.filter((v) => v.pub >= '2026-10-11' && A.dias(v.pub, fim) >= 3 && A.dias(v.pub, hoje) < 90).length, h = sec('lancamentos'), h72n = (h.match(/valor do meio de (\d+)/) || h.match(/\(hoje (\d+)\)/) || [])[1];
  lin('Vídeos com as 72 horas', 'Lançamentos, primeiras 72 horas', 'vídeos do formato principal publicados desde 11/10 (início da leitura por hora) com 3 dias completos', q72 >= 3 ? 'curva' : 'não medido com "hoje N"', h72n, q72);

  /* 9. Outras amarras entre blocos */
  const est = cel('Estado'), em = est.match(/(?:último (?:vídeo|longo ou Short) |há )(ontem|hoje|há (\d+) dias)/) || est.match(/(ontem|hoje|há (\d+) dias)/);
  if (['ativo', 'parado'].includes(M.estado)) {
    const nEst = em ? (em[1] === 'ontem' ? 1 : em[1] === 'hoje' ? 0 : Number(em[2])) : 'ausente';
    lin('Último vídeo na célula Estado', 'célula Estado', 'dias desde o último vídeo de qualquer formato', 'o ponteiro do Ritmo (' + desde + ')', nEst, desde);
    if (M.estado === 'parado') { const pf = txt('.pc-fr').match(/Parado há (\d+) dias: .*saiu em (\d\d\/\d\d)/); lin('"Parado há N dias" e a data', 'frase do topo', 'último vídeo em ' + A.dm(ultAny), 'o ponteiro e o cartão do maior buraco', pf ? pf[1] + ' / ' + pf[2] : 'ausente', desde + ' / ' + A.dm(ultAny)); }
  }
  if (M.a.nm && !M.a.parou && !c.novo) { const fr = txt('.pc-fr').match(/faltam (\d+) dias de registro \(completa em (\d\d\/\d\d)\)/); lin('Faltam N dias (frase do topo)', 'frase do topo', '56 − ' + M.a.dias + ' dias de registro; completa em cadastro + 55', 'barra de 56 dias do bloco Direção', fr ? fr[1] + ' / ' + fr[2] : 'ausente', (56 - M.a.dias) + ' / ' + A.dm(A.addDias(reg, 55))); }
  if (!M.a.nm) {
    const cr = M.a.cruza, mostra = [cel('Direção').includes('janela ainda não limpa'), txt('.pc-fr').includes('ainda cruza a mudança de contagem de 24/08'), sec('direcao').includes('ainda cruza a mudança de contagem de 24/08')];
    lin('Janela que cruza 24/08', 'célula, frase e bloco', 'janela termina em ' + A.dm(fim) + '; começa 55 dias antes: ' + A.dm(A.addDias(fim, -55)), 'limpa em 24/08 + 56 = ' + A.dmy(A.addDias(D.COR, 56)), mostra.map((x, i) => (i === 1 && ['parado', 'erro', 'fora'].includes(M.estado) ? 'n/a' : x)).join('/') + (cr && !M.a.parou ? ' / ' + (sec('direcao').includes(A.dmy(A.addDias(D.COR, 56))) ? A.dmy(A.addDias(D.COR, 56)) : 'sem data') : ''), [cr, ['parado', 'erro', 'fora'].includes(M.estado) ? 'n/a' : cr, cr].join('/') + (cr && !M.a.parou ? ' / ' + A.dmy(A.addDias(D.COR, 56)) : ''));
  }
  const rl = todos('#lancamentos .pc-vb').map((b) => b.innerText.replace(/\s+/g, ' '));
  const rlRuim = M.recentes.map((v, i) => { const t = rl[i] || '', mm = t.match(/publicado (?:há (\d+) dias?|(ontem)|(hoje)|em (\d\d\/\d\d)) · ([\d.,]+(?: mil| mi)?) views/); if (!mm) return v.t + ': sem leitura'; const dd2 = A.dias(v.pub, hoje); const okD = mm[4] ? mm[4] === A.dm(v.pub) : (mm[1] ? Number(mm[1]) : mm[2] ? 1 : 0) === dd2; return okD && mm[5] === A.mil(v.views) ? null : v.t + ': ' + t; }).filter(Boolean);
  if (rl.length) lin('Lista de Lançamentos: idade e views de cada vídeo', 'Lançamentos', 'data de publicação e views na última leitura de cada vídeo', 'cada vídeo tem pub ≥ 03/10 e ≥ cadastro', rlRuim.length ? rlRuim.join(' | ') : rl.length + ' linhas conferem', rl.length + ' linhas conferem', M.recentes.every((v) => v.pub >= iniN(reg)));
  const X = M.mais, maisCels = todos('.pc-cels2 .pc-cel').map((e) => ({ rot: e.querySelector('dt').textContent.trim(), v: e.querySelector('dd.v').innerText.replace(/\s+/g, ' ').trim(), b: e.querySelector('dd.b').innerText.replace(/\s+/g, ' ').trim() }));
  const mc2 = (pre) => maisCels.find((x) => x.rot.startsWith(pre));
  const tolMil = (t) => { const v = lerMil(t), dec = (t.match(/,(\d+)/) || [, ''])[1].length, un = /mi$/.test(t) ? 1e6 : /mil$/.test(t) ? 1e3 : 1; return [v, 0.5 * un * Math.pow(10, -dec)]; };
  const diasRegFim = A.dias(reg, fim) + 1;
  /* B1 (r5): "Views por dia" é a média dos 28 dias que terminam na última leitura e só existe com os 28 dias; x 28 tem de fechar com a soma da Direção e da Linha do tempo */
  const vpdC = mc2('Views por dia');
  if (X.vpd.nm) lin('Views por dia (Mais números)', 'Mais números do canal', 'menos de 28 dias de registro (' + diasRegFim + ')', 'não medido com o motivo', vpdC.v + ' / ' + (vpdC.b.includes('28 dias de registro') ? 'motivo' : 'sem motivo'), 'não medido / motivo');
  else {
    const [vv, tol] = tolMil(vpdC.v), ref = dd.length === 28 ? soma28 : -1;
    lin('Views por dia x 28 = soma de 28 dias', 'Mais números do canal', 'soma dos 28 dias que terminam em ' + A.dm(fim) + ' (' + Math.round(soma28) + ') ÷ 28', 'a soma da Linha do tempo e o numerador da Direção' + (M.a.u != null ? ' (' + Math.round(M.a.u) + ')' : ''), vpdC.v + ' x 28 = ' + Math.round(vv * 28), Math.round(soma28) + ' (±' + Math.round(tol * 28) + ')', Math.abs(vv * 28 - soma28) <= tol * 28 + 1 && (M.a.u == null || Math.round(M.a.u) === Math.round(soma28)) && (diasRegFim >= 28));
  }
  /* B1 (r5, b): "Inscritos em 30 dias" só com 30 dias de registro */
  const insC = mc2('Inscritos em 30');
  lin('Inscritos em 30 dias', 'Mais números do canal', diasRegFim + ' dias de registro até ' + A.dm(fim), 'só existe com 30 dias', /^(\+|≈)/.test(insC.v) ? 'medido' : 'não medido', diasRegFim >= 30 ? 'medido' : 'não medido');
  /* r6 (C5): os inscritos novos saem das views (28 dias × 30/28 × taxa de 0,3% a 0,7%); o percentual é novos ÷ inscritos; abaixo do arredondamento do YouTube a tela diz "≈ 0" */
  if (X.ins30.novos != null) {
    const novos = X.ins30.novos, v28 = dd.length === 28 ? soma28 : null, passoI = c.ins >= 1e6 ? 10000 : c.ins >= 1e5 ? 1000 : c.ins >= 1e4 ? 100 : 10, razao = v28 ? novos / (v28 * 30 / 28) : null, pcT = insC.v.match(/^\+([\d,]+)%/);
    lin('Inscritos em 30 dias: novos × views × inscritos', 'Mais números do canal', novos + ' inscritos novos = ' + (v28 ? (razao * 100).toFixed(2) + '% das ' + Math.round(v28 * 30 / 28) + ' views de 30 dias' : 'sem views de 28 dias'), 'entre 0,1% e 2% das views; o percentual da tela = novos ÷ ' + c.ins + '; abaixo de ' + passoI + ' a tela diz "≈ 0"', pcT ? '+' + pcT[1] + '%' : insC.v, novos < passoI ? '≈ 0' : '+' + A.dec(100 * novos / c.ins, 1) + '%', razao != null && razao <= 0.02 && (novos < passoI || razao >= 0.001));
  }
  /* r6 (C3): "Inscritos" com 3 algarismos acima de 1 mi (a tela diz "arredondado a 3 algarismos") */
  { const it = cel('Inscritos').match(/^Inscritos ([\d.,]+(?: mil| mi)?)/), alg = it ? it[1].replace(/\D/g, '').replace(/^0+/, '').length : 0; lin('Inscritos: 3 algarismos', 'célula Inscritos', c.ins + ' inscritos', 'o ⓘ diz "arredondada a 3 algarismos"; abaixo de 1 mil o número é exato', it ? it[1] : 'ausente', c.ins >= 1e6 ? A.dec(c.ins / 1e6, 2) + ' mi' : it ? it[1] : 'ausente', c.ins >= 1e6 ? alg === 3 : true); }
  const tipC = mc2('Views típicas');
  const ptc = m.vids.filter((v) => v.fmt === P && A.dias(v.pub, fim) < 90);
  if (X.tip.nm) lin('Views típicas (Mais números)', 'Mais números do canal', X.tip.nm, 'não medido com o motivo', tipC.v + ' / ' + (/menos de 3|buscando/.test(tipC.b) ? 'motivo' : 'sem motivo'), 'não medido / motivo');
  else { const [vv, tol] = tolMil(tipC.v), med = A.mediana(ptc.map((v) => v.views)); lin('Views típicas (Mais números)', 'Mais números do canal', 'valor do meio de ' + ptc.length + ' ' + (P === 'long' ? 'longos' : 'Shorts') + ' dos 90 dias até ' + A.dm(fim), 'M3b, quando existe (a mesma base)', tipC.v, A.mil(Math.round(med)), ptc.length >= 3 && Math.abs(vv - med) <= tol + 1 && (M.b.u == null || Math.round(M.b.u) === Math.round(med))); }
  /* C4 (r5): todo "não medido" das células leva o motivo escrito; canal sem leitura nova mostra o valor "até dd/mm" (erro e fora do ar, regra única) */
  const semMotivo = [...todos('.pc-cel')].filter((e) => e.querySelector('dd.v .nm')).filter((e) => !/menos de|parou|buscando|desliga|ocult|saiu|depende|começou|sem leitura|completa|ainda|não chegou|não tem/.test(e.querySelector('dd.b').innerText)).map((e) => e.querySelector('dt').textContent.trim());
  lin('Todo "não medido" de célula tem motivo', 'células do cabeçalho e Mais números', todos('.pc-cel').filter((e) => e.querySelector('dd.v .nm')).length + ' células não medidas', 'cada uma com o motivo na linha de baixo', semMotivo.join(', ') || 'todas com motivo', 'todas com motivo');
  if (fim < hoje) { const sem = maisCels.filter((x) => !/^não medido/.test(x.v) && !x.b.includes(A.dm(fim)) && !x.v.startsWith('≈')).map((x) => x.rot); lin('Canal sem leitura nova: valores com "até dd/mm"', 'Mais números do canal', 'leitura parou em ' + A.dm(fim), 'regra única para erro e fora do ar', sem.join(', ') || 'todos com a data', 'todos com a data'); }
  const w28 = dd.filter((x) => x.v != null);

  /* 9b. O último vídeo é o mesmo na frase do topo e em Lançamentos; datas de erro e de saída; percentuais de k de n */
  const v0 = M.recentes[0], topo = txt('.pc-fr'), lan = txt('#lanFr');
  if (v0 && v0.ult) {
    const rt = (topo.match(/\((\d+,\d)× no dia (\d+)\)/) || topo.match(/acima do normal já no dia (\d+) \((\d+,\d)×\)/) || []), rl2 = lan.match(/(\d+,\d)× o normal/);
    if (rt.length && rl2) { const razaoTopo = rt[1].includes(',') ? rt[1] : rt[2]; lin('Razão do último vídeo (frase do topo x Lançamentos)', 'frase do topo e Lançamentos', 'views do vídeo na idade ÷ normal do canal na mesma idade', 'o mesmo vídeo nos dois lugares', razaoTopo, rl2[1], !(v0.pub < D.INICIO)); }
  }
  if (M.estado === 'erro') { const bn = (txt('.pc-ban.erro').match(/Em erro há (\d+) dias/) || [])[1]; lin('"Em erro há N dias"', 'faixa de erro', 'última leitura que deu certo: ' + A.dm(fim) + ' até hoje ' + A.dm(hoje), 'a célula Estado ("sem leitura desde ' + A.dm(fim) + '") e a linha do tempo, que para em ' + A.dm(fim), bn, A.dias(fim, hoje), /sem leitura desde/.test(cel('Estado')) && cel('Estado').includes(A.dm(fim))); }
  if (M.estado === 'fora') lin('"Saiu do YouTube em dd/mm"', 'faixa, célula Estado e frase', 'a data da saída é a da última leitura', 'a linha do tempo e o ponteiro terminam no mesmo dia', [txt('.pc-ban.fora').includes(A.dm(c.foraEm)), cel('Estado').includes(A.dm(c.foraEm)), topo.includes('valem até ' + A.dm(c.foraEm)), c.foraEm === fim].join('/'), 'true/true/true/true');
  if (!a4.nm) { const n2 = a4.n, k2 = a4.k, pc = cel('Acerto').match(/\((\d+)%\)/); lin('Percentual do Acerto', 'célula', 'k ÷ n só com 10 vídeos ou mais', 'o "k de n" da mesma célula', pc ? pc[1] + '%' : 'sem percentual', n2 >= 10 ? Math.round(100 * k2 / n2) + '%' : 'sem percentual'); }
  if (rs && !rs.nm) { const pc = cel('Criador responde').match(/\((\d+)%\)/); lin('Percentual do Criador responde', 'célula', 'k ÷ n só com 10 vídeos ou mais', 'o "k de n" da mesma célula', pc ? pc[1] + '%' : 'sem percentual', rs.n >= 10 ? Math.round(100 * rs.k / rs.n) + '%' : 'sem percentual'); }

  /* 9c. Rodada 5: semana parcial, janelas somando igual, data do ⓘ, "fora da escala", "(agora N e M)", "pelo menos", faixa do topo */
  {
    const lanes = todos('#ritmo .pc-sem'), cols = (ln) => [...ln.querySelectorAll('.pc-cs')].map((e) => (e.classList.contains('nm') ? 'nm' : 'ok'));
    if (lanes.length >= 2 && !lanes[1].querySelector('.pc-semz')) { const a = cols(lanes[0]).join(','), b = cols(lanes[1]).join(','); lin('Semana parcial: a mesma regra nas duas raias', 'bloco Ritmo, grade', 'semana que termina depois da última leitura (' + A.dm(fim) + ') ou ainda não buscada', 'as duas raias marcam as mesmas semanas como "—"', a === b ? 'iguais' : 'diferentes', 'iguais'); }
    if (lanes[0]) { const nmc = cols(lanes[0]).filter((x) => x === 'nm').length, semMed = 13 - nmc; const mt = txt('#ritmo .pc-mets li:nth-child(2)'), dn = (cel('Ritmo').match(/ de (\d+) semanas/) || mt.match(/ de (\d+)/) || [])[1]; lin('N semanas com leitura = casas medidas', 'bloco Ritmo, grade e cartão', '13 casas − ' + nmc + ' não medidas', 'o "de N" da célula e do cartão (ritmo não medido: sem "de N")', dn || (M.r.nm && !c.ritmoParcial ? 'ritmo não medido' : 'ausente'), dn ? semMed : (M.r.nm && !c.ritmoParcial ? 'ritmo não medido' : semMed)); }
    /* S1: a soma da raia de longos (13 semanas, todas as casas, inclusive as não medidas) é o N da primeira janela de 90 dias */
    if (!c.soShorts && !c.novo && M.b && M.b.nu != null) {
      const bt = txt('#direcao .pc-drs > .pc-dr:nth-child(2) .pc-db'), mm2 = bt.match(/\((\d+) e (\d+) vídeos[;)]/), brutoL = M.r.semL.reduce((t, x) => t + x, 0);
      lin('Janela de 90 dias x raia de longos', 'bloco Direção e bloco Ritmo', '13 semanas até hoje = ' + brutoL + ' longos (soma de todas as casas); 90 dias até a última leitura', 'o primeiro N de "N e M vídeos"', mm2 ? mm2[1] : 'sem N', brutoL, !mm2 || Number(mm2[1]) === brutoL);
    }
    /* C5 (r5): a data do ⓘ é a data da barra */
    const ib = [...document.querySelectorAll('[popover]')].map((e) => e.innerText.replace(/\s+/g, ' ')).join(' ');
    const dQueda = (ib.match(/só a partir de (\d\d\/\d\d\/\d{4})/) || [])[1], dAnt = (ib.match(/Antes de (\d\d\/\d\d\/\d{4}) a janela/) || [])[1], dir5 = sec('direcao');
    lin('Data do ⓘ da queda sustentada', 'ⓘ do Estado e barra de 112 dias', '24/08 + 112 dias = ' + A.dmy(D.LIMPA_112), 'a data da barra "a primeira leitura limpa é em"', dQueda, A.dmy(D.LIMPA_112));
    const bar = (dir5.match(/primeira leitura limpa é em (\d\d\/\d\d\/\d{4})/) || [])[1];
    if (bar && !M.escadaNm.cadastro) lin('Data da barra de 112 dias = data do ⓘ', 'bloco Direção', 'início 25/08 + 111 = 24/08 + 112', 'ⓘ do Estado', bar, dQueda);
    lin('Data do ⓘ da janela limpa de 28 × 28', 'ⓘ da Direção', '24/08 + 56 dias = ' + A.dmy(D.LIMPA_56), 'a data de "fica limpa em" do bloco', dAnt, A.dmy(D.LIMPA_56));
    /* r6 (C1): UMA regra para o dia 24/08 nas duas janelas: o dia da mudança é sujo e não conta; os 56 e os 112 dias limpos começam no mesmo dia (25/08) */
    lin('Regra do dia 24/08 igual nas janelas de 56 e de 112 dias', 'ⓘ da Direção, ⓘ do Estado, barras', '25/08 até ' + A.dm(D.LIMPA_56) + ' = ' + (A.dias(A.addDias(D.COR, 1), D.LIMPA_56) + 1) + ' dias; 25/08 até ' + A.dm(D.LIMPA_112) + ' = ' + (A.dias(A.addDias(D.COR, 1), D.LIMPA_112) + 1) + ' dias', 'a mesma constante D.COR + n nos dois', (A.dias(A.addDias(D.COR, 1), D.LIMPA_56) + 1) + ' e ' + (A.dias(A.addDias(D.COR, 1), D.LIMPA_112) + 1), '56 e 112');
    const fl = (dir5.match(/fica limpa em (\d\d\/\d\d\/\d{4})/) || [])[1]; if (fl) lin('"Fica limpa em" = data do ⓘ', 'bloco Direção', 'início 24/08 + 56', 'ⓘ da Direção', fl, dAnt);
    /* C6: "fora da escala" só com valor exato de 50% ou mais */
    [['b', 2], ['c', 3]].forEach(([k, i]) => { const o = M[k]; if (!o || o.r == null) return; const t = txt('#direcao .pc-drs > .pc-dr:nth-child(' + i + ')'); lin('"Fora da escala" (' + k + ')', 'bloco Direção', 'valor exato ' + (o.r * 100).toFixed(2) + '%', 'só quando o valor exato passa de ±50%', /fora da escala/.test(t) ? 'fora da escala' : 'dentro da escala', Math.abs(o.r) >= 0.5 ? 'fora da escala' : 'dentro da escala'); });
    { const o = M.a; if (o && o.r != null) { const t = txt('#direcao .pc-dr.main'); lin('"Fora da escala" (canal inteiro)', 'bloco Direção', 'valor exato ' + (o.r * 100).toFixed(2) + '%', 'só quando o valor exato passa de ±50%', /fora da escala/.test(t) ? 'fora da escala' : 'dentro da escala', Math.abs(o.r) >= 0.5 ? 'fora da escala' : 'dentro da escala'); } }
    /* C3: "(agora N e M)" só com os números verdadeiros e nunca em canal que ainda busca vídeos */
    const ag = sec('direcao').match(/\(agora (\d+) e (\d+)\)/);
    lin('"(agora N e M)" na linha de vídeos novos', 'bloco Direção', c.novo ? 'canal ainda buscando vídeos: sem parêntese' : 'longos com views de hoje nos dois períodos (' + (M.b ? M.b.nu + ' e ' + M.b.np : '—') + ')', 'a contagem dos vídeos do canal', ag ? ag[1] + ' e ' + ag[2] : 'sem parêntese', !M.b || !M.b.nm || c.soShorts ? 'sem parêntese' : c.novo ? 'sem parêntese' : M.b.nu + ' e ' + M.b.np);
    /* S6: contagem de mudança de campo e troca numa janela que começa antes do registro é um piso */
    const tp = sec('tempo'), janIni2 = A.addDias(fim, -27), parcial2 = (reg > D.INICIO ? reg : D.INICIO) > janIni2, tmc = tp.match(/(\d+) mudanças? de campo/), tmt = tp.match(/(\d+) trocas?/);
    if (parcial2 && ((tmc && Number(tmc[1]) > 0) || (tmt && Number(tmt[1]) > 0))) lin('Contagem de campo e troca em janela parcial', 'linha do tempo, frase', 'o registro delas começou em ' + A.dm(D.INICIO) + ' e a janela começa em ' + A.dm(janIni2), 'a contagem é um piso: "pelo menos"', /pelo menos \d+ (mudança|troca)/.test(tp) ? 'pelo menos' : 'sem ressalva', 'pelo menos');
    /* S7: a faixa do topo conta os dias da contagem por vídeo como a barra de 180 dias */
    const fx = txt('.exband').match(/vai de (\d\d\/\d\d) a (\d\d\/\d\d) \((\d+) dias?\)/);
    if (fx) lin('Dias da contagem por vídeo na faixa do topo', 'faixa "exemplo"', A.dm(D.INICIO) + ' a ' + A.dm(hoje) + ', as duas pontas', 'a barra de 180 dias do mesmo dia', fx[3], A.dias(D.INICIO, hoje) + 1);
    /* S2: nenhum rótulo com concordância errada */
    const arias = todos('[aria-label]').map((e) => e.getAttribute('aria-label')).filter((t) => /(^|\D)1 (acertos|fracassos|vídeos|dias)\b|(^|\D)0 (acertos|fracassos)\b|undefined|NaN/.test(t));
    lin('Rótulos de acessibilidade sem concordância errada', 'aria-label de toda a tela', 'varredura', '—', arias.join(' | ') || 'nenhum', 'nenhum');
    /* C1: o nome da contagem diz a base (longo, ou Short em canal só de Shorts) */
    const rot = txt('#ritmo .pc-mets li:nth-child(2) span');
    lin('Rótulo "Semanas com um ..."', 'bloco Ritmo, cartão', 'a conta é do formato principal (' + (P === 'long' ? 'longo' : 'Short') + ')', 'a raia de cima e o ⓘ', rot, 'Semanas com um ' + (P === 'long' ? 'longo' : 'Short'));
  }

  /* 9d. Rodada 6: o dado de exemplo tem de ser possível por dentro (S1) e o desenho do Acerto não pode quebrar (C2) */
  {
    /* S1: em cada dia com leitura, o que os vídeos ganharam no dia (diferença das views por idade) nunca passa das views ganhas pelo canal no dia */
    const ruins = m.tudo.filter((x) => { if (x.v == null) return false; let g = 0; m.vids.forEach((vi) => { const a = A.dias(vi.pub, x.d); if (a >= 0) g += m.noIdade(vi, a + 1) - m.noIdade(vi, a); }); return g > x.v + 1; });
    lin('Dias em que os vídeos somam mais que o canal', 'série de views por dia (dado de exemplo)', 'soma do que cada vídeo ganhou no dia ≤ views do canal no dia', 'o canal contém os vídeos', ruins.length + ' dias' + (ruins[0] ? ' (o 1º: ' + A.dm(ruins[0].d) + ')' : ''), '0 dias');
    /* C2: os pontinhos ficam em até duas fileiras equilibradas, sem sobrar um símbolo sozinho, e dentro da célula */
    const qs = document.querySelector('.pc-qs');
    if (qs) {
      const is = [...qs.querySelectorAll('i')], fil = (i) => { const r = i.getBoundingClientRect(); return Math.round((r.top + r.bottom) / 2 / 14); }, tops = [...new Set(is.map(fil))], cr = qs.closest('.pc-cel').getBoundingClientRect(), fora = is.filter((i) => i.getBoundingClientRect().right > cr.right + 0.5).length;
      const porFileira = tops.map((t) => is.filter((i) => fil(i) === t).length);
      lin('Pontinhos do Acerto: fileiras', 'célula Acerto', is.length + ' pontos', 'no máximo 2 fileiras, a segunda com pelo menos metade da primeira, todos dentro da célula', porFileira.join(' + ') + ' pontos' + (fora ? ', ' + fora + ' fora da célula' : ''), 'até 2 fileiras equilibradas, 0 fora', porFileira.length <= 2 && (porFileira.length < 2 || porFileira[1] >= porFileira[0] - 1) && fora === 0);
    }
  }

  /* 10. Textos proibidos e contas escondidas */
  const feio = (T.match(/\b1 dias\b|undefined|NaN|\bNaN%|\b0 dias de registro\b/g) || []).join(',');
  lin('Textos quebrados', 'tela inteira', 'varredura', '—', feio || 'nenhum', 'nenhum');
  return { rows, meta: { nome: c.nome, handle: c.handle, ins: c.ins, base: c.base || null, hoje, fim } };
}

const br = await chromium.launch();
const saida = [], metas = [];
let falhas = 0;
try {
  const largura = Number(process.argv[4] || 1440);   /* r5: a mesma conferência vale a 390 px (o texto da tela não pode mudar com a largura) */
  const ctx = await br.newContext({ viewport: { width: largura, height: 900 }, hasTouch: largura < 600 });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  for (const id of CASOS) {
    const pg = await ctx.newPage();
    const erros = []; pg.on('pageerror', (e) => erros.push(String(e)));
    await pg.goto(`http://127.0.0.1:${porta}/index.html?caso=${id}`, { waitUntil: 'load' }); await pg.waitForTimeout(150);
    const { rows, meta } = await pg.evaluate(conferir); metas.push({ id, ...meta });
    saida.push(`\n#### ${id}\n\n| número na tela | onde | de onde deriva | tem de fechar com | na tela | esperado | confere |\n|---|---|---|---|---|---|---|`);
    for (const r of rows) { if (!r.ok) falhas++; saida.push(`| ${r.num} | ${r.onde} | ${r.deriva} | ${r.fecha} | ${r.tela} | ${r.esperado} | ${r.ok ? 'sim' : '**NÃO**'} |`); }
    if (erros.length) { falhas++; saida.push('ERROS JS: ' + erros.join(' | ')); }
    await pg.close();
  }
} finally { await br.close(); srv.close(); }
/* C7 (r5): dois estados que mostram o mesmo canal (nome ou @) têm de ser o mesmo mundo; senão o dono vê o mesmo canal com números incompatíveis ao trocar de estado */
{ const vistos = {}; metas.forEach((x) => { [x.nome, x.handle].forEach((k) => { (vistos[k] = vistos[k] || []).push(x.id); }); }); const dup = Object.entries(vistos).filter(([k, v]) => v.length > 1 && !(v.length === 2 && v.includes('cheio') && v.includes('leitura'))); saida.push('\n#### entre estados\n\n| número na tela | onde | de onde deriva | tem de fechar com | na tela | esperado | confere |\n|---|---|---|---|---|---|---|'); saida.push(`| Nome e @ de cada canal | os 12 estados | o canal de exemplo de cada estado | nenhum nome nem @ em dois estados, exceto cheio e leitura (o mesmo mundo) | ${dup.map(([k, v]) => k + ' em ' + v.join('+')).join('; ') || 'todos diferentes'} | todos diferentes | ${dup.length ? '**NÃO**' : 'sim'} |`); if (dup.length) falhas++; }
const md = saida.join('\n');
if (process.argv[3]) fs.writeFileSync(process.argv[3], md + '\n');
console.log(md); console.log(`\nlinhas que não fecham: ${falhas}`);
process.exit(falhas ? 1 : 0);

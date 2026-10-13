/* 11b.js: mockup 11b, "Retenção do vídeo próprio: seletor de janela e faixa do YouTube". Acrescenta ao bloco Retenção da página do vídeo (mockup 6 aprovado).
   Parâmetros: ?caso=tipico|aberta|short|antigo|serrilhada|vazia|sem-faixa|zero|nao-coletada|novo|erro|erro-sem|leitura
               ?janela=7|30|vida (sem o parâmetro vale o que ficou lembrado neste navegador; sem nada, vida inteira)   ?tema=claro
   Regras: toda diferença é feita sobre os números ARREDONDADOS que aparecem; a faixa do YouTube é classificada pelo valor com 2 casas (o que se vê).
   Tudo é exemplo (11b-dados.js). Só leitura: nenhum botão altera dado. */
(function(){
  'use strict';
  var A = window.A4, L = window.L1, D = window.RJD, q = A.q, esc = A.esc;
  var ORD = ['7', '30', 'vida'], PADRAO = 'vida', NA_MEDIA_PTS = 2, ZONA = { abaixo: .45, acima: .55 };
  var caso = D.CASOS[q.get('caso')] ? q.get('caso') : 'tipico', C = D.CASOS[caso], V = C.v;
  var J = { '7': { rot: 'Primeiros 7 dias', curto: '7 dias', de: 'Nos primeiros 7 dias', dias: 7 }, '30': { rot: 'Primeiros 30 dias', curto: '30 dias', de: 'Nos primeiros 30 dias', dias: 30 }, vida: { rot: 'Vida inteira', curto: 'Vida toda', de: 'Na vida inteira do vídeo' } };
  var salvo = (function(){ var s = lerSalvo(); return ORD.indexOf(s) >= 0 ? s : null; })();
  var janela = ORD.indexOf(q.get('janela')) >= 0 ? q.get('janela') : (salvo || PADRAO);
  var IC_LOCK = '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.2" y="7" width="9.6" height="6.6" rx="1.4"/><path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7"/></svg>';

  function lerSalvo(){ try { return window.localStorage.getItem('a5l2-janela'); } catch (e) { return null; } }
  function gravarSalvo(v){ try { window.localStorage.setItem('a5l2-janela', v); } catch (e) { /* sem armazenamento: a tela funciona igual */ } }

  /* ---------------------------------------------------------------- contas (sempre sobre o que aparece) */
  function zona(rel){ var r = Math.round(rel * 100) / 100; return r < ZONA.abaixo ? 'dn' : r > ZONA.acima ? 'up' : 'eq'; }
  var SIM = { up: '▲', dn: '▼', eq: '＝' };
  var ZNOME = { up: 'Acima', dn: 'Abaixo', eq: 'Na média' };
  function r2(x){ return A.dec(Math.round(x * 100) / 100, 2); }
  function meioSeg(pts){ var m = D.meio(pts); return m == null ? null : Math.round(m * V.dur); }
  function meioPct(pts){ var m = D.meio(pts); return m == null ? null : Math.round(m * 100); }
  function fimPct(pts){ return Math.round(pts[pts.length - 1] * 100); }
  function sinal(d){ return d === 0 ? '0' : (d > 0 ? '+' : '−') + Math.abs(d); }
  function dirPts(d){ return Math.abs(d) <= NA_MEDIA_PTS ? 'eq' : d > 0 ? 'up' : 'dn'; }
  function nome(w){ return w.e === 'lida' ? 'lida' : w.e; }
  function chipDir(k, txt, palavra){ return '<span class="cmp ' + k + '"><span class="pt">' + SIM[k] + (txt ? ' ' + txt : '') + '</span>' + (palavra ? '<span class="w">' + palavra + '</span>' : '') + '</span>'; }

  /* ---------------------------------------------------------------- miniatura da curva (cartão do seletor) */
  function spark(pts){
    var n = pts.length, mx = Math.max(1.05, Math.max.apply(null, pts)), W = 100, H = 30, d = pts.map(function(v, i){ return (i ? 'L' : 'M') + (i / (n - 1) * W).toFixed(1) + ' ' + (H - 3 - v / mx * (H - 6)).toFixed(1); }).join(''), m = D.meio(pts);
    return '<svg class="rj-sp" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="cv-area" d="' + d + 'L100 27L0 27Z"/><path class="rj-spl" d="' + d + '"/>' +
      (m != null ? '<line class="rj-spm" x1="' + (m * W).toFixed(1) + '" x2="' + (m * W).toFixed(1) + '" y1="2" y2="28"/>' : '') + '</svg>';
  }

  /* ---------------------------------------------------------------- o seletor */
  function cartao(k){
    var w = C.j[k], ativo = k === janela, spk, cap, st;
    if (C.soLeitura) { spk = '<span class="rj-nmbox rj-lockbox" aria-hidden="true">' + IC_LOCK + '</span>'; cap = '<span class="rj-v">Curva privada</span>'; st = 'só quem edita vê'; }
    else if (w.e === 'lida') {
      var m = meioSeg(w.pts); spk = '<span class="rj-spw">' + spark(w.pts) + '</span>';
      cap = '<span class="rj-v">' + (m == null ? 'Mais da metade fica até o fim' : 'Metade saiu aos <b class="num">' + A.dur(m) + '</b>') + '</span>';
      st = (w.erroEm ? L.IC.aviso : '') + 'Leitura de ' + A.dm(w.d);
    } else {
      spk = '<span class="rj-nmbox" aria-hidden="true"></span>'; cap = '<span class="rj-v">' + A.nm() + '</span>';
      st = w.e === 'aberta' ? 'fecha em ' + A.dm(w.fecha) : w.e === 'antes' ? 'fechou antes da coleta' : w.e === 'sem-dado' ? 'sem curva do YouTube' : w.e === 'erro' ? L.IC.aviso + 'falhou em ' + A.dm(w.erroEm) : w.novo ? 'primeira leitura em breve' : 'ainda não coletada';
    }
    return '<button type="button" role="radio" class="rj-c' + (ativo ? ' on' : '') + (C.soLeitura ? ' priv' : '') + '" data-j="' + k + '" aria-checked="' + ativo + '" tabindex="' + (ativo ? 0 : -1) + '"><span class="rj-t"><span class="l">' + J[k].rot + '</span><span class="s">' + J[k].curto + '</span></span>' + spk + cap + '<span class="rj-s">' + st + '</span></button>';
  }
  function seletor(){
    var ajuda = A.oculto('infoJan', 'Como a janela é contada', '<ul><li><b>Primeiros 7 dias e primeiros 30 dias:</b> do dia da publicação até o 7º ou o 30º dia. Cada uma é buscada uma vez, quando a janela fecha (o YouTube entrega o dado com 2 a 3 dias de atraso). Só existe para vídeo cuja janela fecha depois que a coleta começou.</li><li><b>Vida inteira:</b> da publicação até a data da leitura. É buscada de novo quando o vídeo tem views novas, no máximo uma vez por semana.</li><li><b>Não medido:</b> a janela ainda não fechou, ou fechou antes de começarmos a coletar. Não buscamos curvas do passado, então essa janela não volta.</li><li><b>Salvo neste navegador:</b> a janela escolhida vale para todos os vídeos neste navegador. Sem escolha, vale a vida inteira.</li><li><b>Dado de exemplo.</b></li></ul>');
    var html = '<div class="rj-sel"><p class="rj-lab" id="rjLab">Janela da curva ' + A.ibtn('infoJan', 'Como a janela é contada', true) + '</p><div class="rj-cs" role="radiogroup" aria-labelledby="rjLab">' + ORD.map(cartao).join('') + '</div>' +
      (janela === PADRAO ? '' : '<p class="rj-lem"><span class="rj-ok">' + L.IC.ok + '</span>Salvo neste navegador<span class="sep" aria-hidden="true"> · </span><button type="button" class="lk" data-padrao="1">Voltar ao padrão (vida inteira)</button></p>') + '</div>' + ajuda;
    return L.novo(html, 'novo', 'rj-novo');
  }

  /* ---------------------------------------------------------------- a faixa do YouTube */
  function faixa(w, pouco){
    var ibtn = A.ibtn('infoFx', 'Como o YouTube faz esta comparação', true);
    var ajuda = A.oculto('infoFx', 'Como o YouTube faz esta comparação', '<ul><li><b>É um cálculo do YouTube, não nosso.</b> O YouTube compara a curva deste vídeo com a de vídeos de duração parecida e devolve um valor de 0 a 1 (nome técnico: relativeRetentionPerformance). Nós só mostramos.</li><li><b>0,5 é o vídeo do meio:</b> metade dos vídeos parecidos tem curva melhor, metade pior.</li><li><b>Abaixo / na média / acima:</b> o corte é nosso, sobre o valor com duas casas. Abaixo de 0,45 é “abaixo”; de 0,45 a 0,55 é “na média”; acima de 0,55 é “acima”.</li><li><b>Não é o % assistido</b> da seção anterior: aquele compara com os outros vídeos do <i>seu canal</i>; este compara com vídeos de todo o YouTube.</li><li><b>Dado de exemplo.</b></li></ul>');
    if (w.rel == null) {
      return L.novo('<div class="rj-fx rj-fx-nm" role="group" aria-labelledby="rjFh"><div class="rj-fl"><p class="rj-fv">' + A.nm() + '<b id="rjFh">Sem a comparação do YouTube</b>' + ibtn + '</p><p class="rj-fs">O YouTube não devolveu a comparação com vídeos de duração parecida nesta leitura.</p></div><div class="rj-rg"><span class="rj-nmbar" aria-hidden="true"></span></div></div>' + ajuda, 'novo', 'rj-novo rj-novo-fx');
    }
    var k = zona(w.rel), v = Math.round(w.rel * 100) / 100, pos = v * 100;
    var frase = ZNOME[k] + ' de vídeos de duração parecida';
    var alt = 'Comparação feita pelo YouTube: ' + frase.toLowerCase() + '. Valor ' + r2(v) + ' numa régua de 0 a 1; 0,5 é o vídeo do meio. Abaixo de 0,45 é abaixo, de 0,45 a 0,55 é na média, acima de 0,55 é acima.';
    var html = '<div class="rj-fx rj-fx-' + k + '" role="group" aria-labelledby="rjFh"><div class="rj-fl">' +
      '<p class="rj-fv"><span class="rj-sim rj-sim-' + k + '" aria-hidden="true">' + SIM[k] + '</span><b id="rjFh">' + frase + '</b>' + ibtn + '</p>' +
      '<p class="rj-fs"><span class="chip rj-yt">cálculo do YouTube</span><span>valor <b class="num">' + r2(v) + '</b> numa régua de 0 a 1</span>' + (pouco ? '<span class="rj-av rj-av-p">' + L.IC.aviso + ' Só ' + A.n(V.views) + ' views: leia como indício.</span>' : '') + '</p></div>' +
      '<div class="rj-rg" role="img" aria-label="' + esc(alt) + '"><div class="rj-bw"><b class="num rj-ml" style="--p:' + pos + '%">' + r2(v) + '</b><span class="rj-mk" style="left:' + pos + '%"><i></i></span>' +
      '<div class="rj-bar"><span class="z dn' + (k === 'dn' ? ' on' : '') + '"></span><span class="z eq' + (k === 'eq' ? ' on' : '') + '"></span><span class="z up' + (k === 'up' ? ' on' : '') + '"></span><span class="rj-med"></span></div></div>' +
      '<div class="rj-zl" aria-hidden="true"><span class="dn' + (k === 'dn' ? ' on' : '') + '"><b>▼</b> abaixo</span><span class="eq' + (k === 'eq' ? ' on' : '') + '"><b>＝</b> média</span><span class="up' + (k === 'up' ? ' on' : '') + '"><b>▲</b> acima</span></div>' +
      '<div class="rj-tk num" aria-hidden="true"><span>0</span><span class="m">0,5</span><span>1</span></div></div></div>' + ajuda;
    return L.novo(html, 'novo', 'rj-novo rj-novo-fx');
  }

  /* ---------------------------------------------------------------- a curva (a do mockup 6, com a primeira leitura por baixo quando houver duas ou mais) */
  function curva(host, cfg){
    var W = Math.max(300, Math.floor(host.clientWidth || 640)), H = W < 520 ? 200 : 240, Lm = 40, R = 10, T = 14, B = 40, PW = W - Lm - R, PH = H - T - B, pts = cfg.pts, n = pts.length;
    var max = Math.max(1.2, Math.ceil((Math.max.apply(null, pts) + .04) * 10) / 10);
    function X(i){ return Lm + PW * i / (n - 1); } function Y(v){ return T + PH * (1 - Math.min(v, max) / max); }
    var s = '<svg class="curva" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(cfg.alt) + '">';
    [0, .5, 1].concat(max >= 1.4 ? [1.4] : []).forEach(function(f){ s += '<line class="ic-grid" x1="' + Lm + '" x2="' + (W - R) + '" y1="' + Y(f) + '" y2="' + Y(f) + '"/><text class="cv-t" x="' + (Lm - 6) + '" y="' + (Y(f) + 4) + '" text-anchor="end">' + Math.round(f * 100) + '%</text>'; });
    var d = pts.map(function(v, i){ return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join('');
    s += '<path class="cv-area" d="' + d + 'L' + X(n - 1) + ' ' + Y(0) + 'L' + X(0) + ' ' + Y(0) + 'Z"/>';
    (cfg.rea || []).forEach(function(r){ s += '<rect class="cv-re" x="' + X(r[0]) + '" y="' + T + '" width="' + (X(r[1]) - X(r[0])) + '" height="' + PH + '"/>'; });
    if (cfg.ant) s += '<path class="rj-ant" d="' + cfg.ant.map(function(v, i){ return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join('') + '"/>';
    s += '<path class="cv-l" d="' + d + '"/>';
    if (cfg.meio != null) { var mx = X(cfg.meio * (n - 1)), anchor = mx > W - 150 ? 'end' : 'start'; s += '<line class="cv-ml" x1="' + mx + '" x2="' + mx + '" y1="' + T + '" y2="' + (T + PH) + '"/><text class="cv-lb" x="' + (anchor === 'end' ? mx - 6 : mx + 6) + '" y="' + (T + 14) + '" text-anchor="' + anchor + '">metade já saiu aqui</text>'; }
    (cfg.saidas || []).forEach(function(i){ s += '<polygon class="cv-sa" points="' + (X(i) - 6) + ',' + (T + PH + 12) + ' ' + (X(i) + 6) + ',' + (T + PH + 12) + ' ' + X(i) + ',' + (T + PH + 3) + '"/>'; });
    [0, .25, .5, .75, 1].forEach(function(f, k){ s += '<text class="cv-t" x="' + (Lm + PW * f) + '" y="' + (H - 4) + '" text-anchor="' + (k === 0 ? 'start' : k === 4 ? 'end' : 'middle') + '">' + A.dur(cfg.dur * f) + '</text>'; });
    s += '</svg>';
    host.innerHTML = s + '<div class="cv-leg"><span><i class="l"></i>parte do público que ainda assiste</span>' + (cfg.ant ? '<span><i class="ant"></i>primeira leitura (' + A.dm(cfg.antD) + ')</span>' : '') + ((cfg.rea || []).length ? '<span><i class="re"></i>trecho revisto (muita gente voltou)</span>' : '') + ((cfg.saidas || []).length ? '<span><i class="sa"></i>maior saída</span>' : '') + '</div>';
  }

  /* ---------------------------------------------------------------- estados sem curva */
  function nmPainel(texto, extra){ return '<div class="rj-nmp"><span class="rj-band" aria-hidden="true"></span><div class="rj-nmc"><p class="rj-nmh">' + A.nm() + '</p><p class="rj-nmt">' + texto + '</p>' + (extra || '') + '</div></div>'; }
  function progresso(k, w){
    var N = J[k].dias, dec = Math.min(N, A.dias(V.pub, D.HOJE)), falta = A.dias(D.HOJE, w.fecha), pct = Math.round(dec / N * 100);
    return '<div class="rj-pg" role="img" aria-label="Dia ' + dec + ' de ' + N + ' da janela; faltam ' + falta + (falta === 1 ? ' dia' : ' dias') + '"><span class="rj-pgb"><i style="width:' + pct + '%"></i></span><span class="rj-pgt num">dia ' + dec + ' de ' + N + '</span></div>';
  }
  /* a frase-resumo dos estados sem curva (vai no topo da seção, antes do seletor) */
  function fraseSem(k, w){
    if (C.soLeitura) return 'Você não vê esta curva.';
    if (w.e === 'aberta') return J[k].rot + ': a janela ainda não fechou.';
    if (w.e === 'antes') return J[k].rot + ': a janela não existe para este vídeo.';
    if (w.e === 'sem-dado') return 'O YouTube não devolveu curva para este vídeo (poucas views).';
    if (w.e === 'erro') return 'A curva ainda não foi buscada.';
    return w.novo ? 'Vídeo novo: a primeira leitura vem nos próximos dias.' : 'Ainda não coletamos esta curva.';
  }
  function semCurva(k, w){
    var plural = function(n){ return n + (n === 1 ? ' dia' : ' dias'); };
    if (w.e === 'aberta') { var f = A.dias(D.HOJE, w.fecha); return nmPainel('Fecha em <b class="num">' + A.dm(w.fecha) + '</b> (faltam ' + plural(f) + '). A curva dessa janela é buscada uma vez, quando ela fecha.', progresso(k, w)); }
    if (w.e === 'antes') return nmPainel('Ela fechou em <b class="num">' + A.dmy(w.fecha) + '</b>, antes de começarmos a coletar. Não buscamos curvas do passado, então essa janela não volta.');
    if (w.e === 'sem-dado') return nmPainel('Tentamos em <b class="num">' + A.dm(w.tentou) + '</b>. ' + (k === 'vida' ? 'Tentamos de novo quando o vídeo tiver views novas, no máximo uma vez por semana.' : 'Esta janela é buscada uma vez só.'));
    if (w.e === 'erro') return banner(w, false) + nmPainel('Ainda não há leitura para mostrar.');
    return nmPainel(w.novo ? 'Quando ela chegar, esta seção mostra onde as pessoas saem do vídeo e onde voltam.' : 'Quando coletarmos, esta seção mostra onde as pessoas saem do vídeo e onde voltam.');
  }
  function banner(w, comLeitura){
    return '<div class="rj-erro" role="status">' + L.IC.aviso + '<p><b>' + (comLeitura ? 'A última' : 'A primeira') + ' tentativa falhou em ' + A.dm(w.erroEm) + '.</b> ' + (comLeitura ? 'A tela mostra a leitura de ' + A.dm(w.d) + '. ' : '') + 'Tentamos de novo em ' + A.dm(w.proxima) + '; você não precisa fazer nada.</p></div>';
  }
  function bloqueio(){
    return '<div class="rj-lock" role="note"><span class="rj-lki" aria-hidden="true">' + IC_LOCK + '</span><div><p class="rj-lkt">Ela vem do YouTube Analytics do canal e só quem edita o canal a vê. Os números públicos do vídeo, lá em cima, continuam à vista.</p><p class="rj-lkt">Para ver, peça acesso de edição a quem administra o canal.</p></div></div>';
  }

  /* ---------------------------------------------------------------- "como a curva mudou desde dd/mm" */
  function mudou(w){
    var ls = w.leituras || [];
    if (janela !== 'vida') return '<p class="rj-nota">' + L.IC.relogio + '<span>Esta janela é buscada uma vez só, quando fecha: ela não muda depois.</span></p>';
    if (ls.length < 2) return '<p class="rj-nota">' + L.IC.relogio + '<span>Só há uma leitura (' + A.dm(ls[0].d) + '). “Como a curva mudou” aparece a partir da segunda.</span></p>';
    var a = ls[0], b = ls[ls.length - 1], ma = meioSeg(a.pts), mb = meioSeg(b.pts), pa = meioPct(a.pts), pb = meioPct(b.pts), fa = fimPct(a.pts), fb = fimPct(b.pts);
    var tm = function(s){ return s == null ? '<span class="rj-tx">mais da metade fica</span>' : A.dur(s); }, linha = function(rot, x, y, ch){ return '<tr><th scope="row">' + rot + '</th><td class="num">' + x + '</td><td class="num">' + y + '</td><td>' + ch + '</td></tr>'; };
    var cm;
    if (ma == null && mb == null) cm = chipDir('eq', '', 'sem mudança');
    else if (mb == null) cm = chipDir('up', '', 'agora mais da metade fica');
    else if (ma == null) cm = chipDir('dn', '', 'antes mais da metade ficava');
    else { var dp = pb - pa, ds = mb - ma; cm = dirPts(dp) === 'eq' ? chipDir('eq', ds === 0 ? '' : (ds > 0 ? '+' : '−') + A.dur(Math.abs(ds)), ds === 0 ? 'igual' : 'quase igual (até ' + NA_MEDIA_PTS + ' pontos do vídeo)') : chipDir(dirPts(dp), (ds > 0 ? '+' : '−') + A.dur(Math.abs(ds)), dp > 0 ? 'mais tarde' : 'mais cedo'); }
    var df = fb - fa, cf = chipDir(dirPts(df), sinal(df) + (Math.abs(df) === 1 ? ' ponto' : ' pontos'), dirPts(df) === 'eq' ? (df === 0 ? 'igual' : 'quase igual (até ' + NA_MEDIA_PTS + ' pontos)') : df > 0 ? 'mais gente até o fim' : 'menos gente até o fim');
    var cy;
    if (a.rel == null || b.rel == null) cy = A.nm();
    else { var za = zona(a.rel), zb = zona(b.rel), ordem = { dn: 0, eq: 1, up: 2 }; cy = za === zb ? chipDir('eq', '', 'mesma faixa') : chipDir(ordem[zb] > ordem[za] ? 'up' : 'dn', '', ordem[zb] > ordem[za] ? 'subiu de faixa' : 'desceu de faixa'); }
    var fx = function(l){ return l.rel == null ? A.nm() : SIM[zona(l.rel)] + ' ' + r2(l.rel); };
    var tab = '<table class="rj-mt"><caption class="sr">Como a curva mudou entre a primeira e a última leitura</caption><thead><tr><th scope="col"><span class="sr">O que mudou</span></th><th scope="col">Leitura de ' + A.dm(a.d) + '</th><th scope="col">Leitura de ' + A.dm(b.d) + '</th><th scope="col">Mudou</th></tr></thead><tbody>' +
      linha('Metade já saiu aos', tm(ma), tm(mb), cm) + linha('Ainda assistem no fim', fa + '%', fb + '%', cf) + linha('Comparação do YouTube', fx(a), fx(b), cy) + '</tbody></table>';
    var todas = '<details class="rj-todas"><summary>Ver as ' + ls.length + ' leituras</summary><table class="rj-mt rj-mt2"><caption class="sr">Todas as leituras da vida inteira</caption><thead><tr><th scope="col">Leitura</th><th scope="col">Metade saiu aos</th><th scope="col">No fim</th><th scope="col">Comparação do YouTube</th></tr></thead><tbody>' +
      ls.slice().reverse().map(function(l, i){ return '<tr><th scope="row">' + A.dm(l.d) + (i === 0 ? ' <span class="chip">mais recente</span>' : '') + '</th><td class="num" data-r="Metade saiu aos">' + tm(meioSeg(l.pts)) + '</td><td class="num" data-r="No fim">' + fimPct(l.pts) + '%</td><td class="num" data-r="Comparação do YouTube">' + fx(l) + '</td></tr>'; }).join('') + '</tbody></table></details>';
    var ajuda = A.oculto('infoMud', 'Como a curva mudou', '<ul><li>Compara a <b>primeira</b> leitura da vida inteira (' + A.dm(a.d) + ') com a <b>mais recente</b> (' + A.dm(b.d) + ').</li><li><b>Mostra o que mudou, não por quê.</b> Os vídeos novos que chegaram, o público e a época também mudam.</li><li><b>＝</b> é até ' + NA_MEDIA_PTS + ' pontos, como no % assistido. A diferença é feita sobre os números arredondados que você vê.</li><li>Só a vida inteira muda: os primeiros 7 e 30 dias são buscados uma vez.</li><li><b>Dado de exemplo.</b></li></ul>');
    return L.novo('<div class="rj-mud"><p class="rj-mh" id="rjMh">Como a curva mudou desde <b class="num">' + A.dm(a.d) + '</b> ' + A.ibtn('infoMud', 'Como a curva mudou', true) + '</p>' + tab + todas + '</div>' + ajuda, 'novo', 'rj-novo rj-novo-mud');
  }

  /* ---------------------------------------------------------------- saídas e trechos revistos */
  function listas(w){
    if (w.poucas || (w.pts && V.views < 100)) return '<p class="alerta">' + A.INFO + ' Com tão poucas views a curva balança: não marcamos maiores saídas nem trechos revistos.</p>';
    var sa = D.saidas(w.pts), re = D.revistos(w.pts), dur = V.dur, t = function(i){ return A.dur(i / (w.pts.length - 1) * dur); };
    var li1 = sa.length ? sa.map(function(s){ return '<li><i class="rj-sa" aria-hidden="true"></i><span><b class="num">' + t(s.de) + '</b> a <b class="num">' + t(s.ate) + '</b>: de ' + Math.round(s.vDe * 100) + '% para ' + Math.round(s.vAte * 100) + '%</span></li>'; }).join('') : '<li><span class="rj-zero num">0</span><span>nenhuma saída marcada</span></li>';
    var li2 = re.length ? re.map(function(r){ return '<li><i class="rj-re" aria-hidden="true"></i><span><b class="num">' + t(r[0]) + '</b> a <b class="num">' + t(r[1]) + '</b></span></li>'; }).join('') : '<li><span class="rj-zero num">0</span><span>nenhum trecho revisto</span></li>';
    return '<div class="rj-ls"><div><h3>Maiores saídas</h3><ul>' + li1 + '</ul></div><div><h3>Trechos revistos</h3><ul>' + li2 + '</ul></div></div>';
  }

  /* ---------------------------------------------------------------- o detalhe da janela escolhida */
  /* a frase-resumo e os avisos: NO TOPO da seção, antes do seletor (muda com a janela escolhida) */
  function resumo(){
    var w = C.j[janela];
    if (C.soLeitura || w.e !== 'lida') return { txt: fraseSem(janela, w), html: '<div class="rj-fr"><p class="rj-fra"><span class="rj-ic" aria-hidden="true">' + (C.soLeitura ? IC_LOCK : L.IC.relogio) + '</span><span>' + fraseSem(janela, w) + '</span></p></div>' };
    var m = meioSeg(w.pts), mp = meioPct(w.pts), temMais = Math.max.apply(null, w.pts) > 1.0001, pouco = w.poucas || V.views < 100;
    var frase = m == null ? J[janela].de + ', mais da metade das pessoas ficou até o fim.' : J[janela].de + ', metade das pessoas já saiu aos <b class="num">' + A.dur(m) + '</b> (<b class="num">' + mp + '%</b> do vídeo).';
    var avisos = '<span class="chip rj-lt">' + L.IC.relogio + 'Leitura de ' + A.dm(w.d) + '</span>' + (w.views && !pouco ? '<span class="chip">' + A.n(w.views) + ' views na janela</span>' : '') +
      (temMais ? '<span class="rj-av"><span class="rj-avs" aria-hidden="true">▲</span> A curva passa de 100%: muita gente voltou e reviu o vídeo.</span>' : '') +
      (pouco ? '<span class="rj-av rj-av-p">' + L.IC.aviso + ' Só ' + A.n(V.views) + ' views: leia como indício, não como medida.</span>' : '');
    return { txt: frase.replace(/<[^>]+>/g, ''), html: '<div class="rj-fr"><p class="rj-fra"><span class="rj-ic" aria-hidden="true">' + L.IC.relogio + '</span><span>' + frase + '</span></p><div class="rj-chips">' + avisos + '</div></div>' };
  }

  /* ---------------------------------------------------------------- o detalhe da janela escolhida (abaixo do seletor) */
  function detalhe(){
    var w = C.j[janela];
    if (C.soLeitura) return bloqueio();
    if (w.e !== 'lida') return semCurva(janela, w);
    var pouco = w.poucas || V.views < 100;
    var tabelaPts = w.pts.length, linhas = '';
    for (var p = 0; p <= 10; p++) { var ix = Math.round(p / 10 * (tabelaPts - 1)); linhas += '<tr><th scope="row" class="num">' + A.dur(p / 10 * V.dur) + '</th><td class="num r">' + Math.round(w.pts[ix] * 100) + '%</td></tr>'; }
    return (w.erroEm ? banner(w, true) : '') + faixa(w, pouco) + '<div id="rjCurv" class="rj-curv"></div>' +
      '<details class="ic-tab rj-tabc"><summary>Ver a curva em números</summary><div class="ic-tw" role="region" tabindex="0" aria-label="Curva em números"><table><thead><tr><th scope="col">Ponto do vídeo</th><th scope="col" class="r">Ainda assistem</th></tr></thead><tbody>' + linhas + '</tbody></table></div></details>' +
      mudou(w) + listas(w);
  }

  /* ---------------------------------------------------------------- a seção toda */
  function secao(){
    var ajuda = A.oculto('infoRt', 'De onde vem a curva', '<ul><li><b>Curva:</b> a parte do público que ainda está assistindo em cada ponto do vídeo. Vem de uma consulta do YouTube Analytics por posição no vídeo.</li><li><b>Janela:</b> escolha acima se a curva é dos primeiros 7 dias, dos primeiros 30 dias ou da vida inteira. O % assistido da seção anterior é dos últimos dias: janela diferente.</li><li><b>Acima de 100%:</b> trecho que muita gente voltou para rever.</li><li><b>Dado de exemplo.</b></li></ul>');
    return '<h2 id="hRt">Retenção ' + A.ibtn('infoRt', 'De onde vem a curva', true) + '</h2><p class="exband"><span class="ex">exemplo</span> A curva e os números desta seção são de exemplo.</p>' + resumo().html + seletor() + '<div id="rjDet" class="rj-det">' + detalhe() + '</div>' + ajuda;
  }
  var sec, live = null, primeira = true;
  function desenhar(){
    document.querySelectorAll('body > .pop').forEach(function(p){ p.remove(); }); /* os popovers do desenho anterior */
    sec.innerHTML = secao(); A.ligarInfos(sec);
    if (!live) { live = document.createElement('div'); live.className = 'sr'; live.setAttribute('aria-live', 'polite'); live.setAttribute('role', 'status'); document.body.appendChild(live); }
    if (primeira) primeira = false; else live.textContent = resumo().txt;
    desenharCurva();
    sec.querySelectorAll('.rj-c').forEach(function(b){
      b.addEventListener('click', function(){ escolher(b.getAttribute('data-j'), true); });
      b.addEventListener('keydown', function(e){
        var i = ORD.indexOf(b.getAttribute('data-j')), alvo = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? ORD[(i + 1) % 3] : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? ORD[(i + 2) % 3] : null;
        if (alvo) { e.preventDefault(); escolher(alvo, true); }
      });
    });
    var pad = sec.querySelector('[data-padrao]'); if (pad) pad.addEventListener('click', function(){ escolher(PADRAO, true); });
  }
  function desenharCurva(){
    var host = document.getElementById('rjCurv'), w = C.j[janela]; if (!host || w.e !== 'lida') return;
    var m = meioSeg(w.pts), ant = janela === 'vida' && w.leituras && w.leituras.length >= 2 ? w.leituras[0] : null, pouco = w.poucas || V.views < 100;
    var re = pouco ? [] : D.revistos(w.pts), sa = pouco ? [] : D.saidas(w.pts).map(function(s){ return s.de; });
    curva(host, { pts: w.pts, dur: V.dur, meio: D.meio(w.pts), saidas: sa, rea: re, ant: ant && ant.pts, antD: ant && ant.d,
      alt: 'Curva de retenção de exemplo, ' + J[janela].rot.toLowerCase() + ': de 100% no início' + (m == null ? '; mais da metade do público fica até o fim.' : '; metade do público sai aos ' + A.dur(m) + '.') + (ant ? ' A linha tracejada é a primeira leitura.' : '') });
  }
  function escolher(k, foco){
    if (k === janela) return;
    janela = k; gravarSalvo(k);
    try { var u = new URL(location.href); u.searchParams.set('janela', k); history.replaceState(null, '', u); } catch (e) { /* sem história: a tela funciona igual */ }
    desenhar(); if (foco) { var b = sec.querySelector('.rj-c[data-j="' + k + '"]'); if (b) b.focus(); }
  }

  /* ---------------------------------------------------------------- casca */
  var cab = L.videoCab({ t: V.t, pub: V.pub, dur: V.dur, views: A.n(V.views), likes: V.likes, com: V.com, eng: V.views ? (V.likes + V.com) / V.views : null, normal: V.normal, normalSub: V.normalSub, normalMotivo: V.normalMotivo, idadeTxt: V.idadeTxt });
  if (V.tipo === 'short') cab = cab.replace('· vídeo longo', '· Short');
  var itensCaso = D.ORDEM.map(function(id){ var c = D.CASOS[id]; return { t: c.rot, href: A.href({ caso: id === 'tipico' ? null : id, janela: null }), atual: id === caso }; });
  var itensJan = [['vida', 'Vida inteira (padrão)'], ['30', 'Primeiros 30 dias'], ['7', 'Primeiros 7 dias']].map(function(i){ return { t: i[1], href: A.href({ janela: i[0] }), atual: i[0] === janela }; });
  var barra = { linhas: [{ rotulo: 'Estado', itens: itensCaso }, { rotulo: 'Janela', itens: itensJan }, A.tema()],
    nota: '<b>' + esc(C.rot) + ':</b> ' + esc(C.nota) + ' Tudo é exemplo (vídeos e números inventados). O acréscimo desta proposta leva contorno tracejado verde-água e “+ novo”; o resto é o bloco Retenção já aprovado (mockup 6). Sem o parâmetro ?janela, vale o que ficou lembrado neste navegador. Hoje, neste mockup, é 13/10/2026.' };
  var fora = '<table class="tb" style="max-width:760px"><caption>Cortes da comparação do YouTube (sobre o valor com duas casas)</caption><thead><tr><th scope="col">Valor</th><th scope="col">Símbolo</th><th scope="col">A tela diz</th></tr></thead><tbody><tr><th scope="row" class="num">0,00 a 0,44</th><td>▼</td><td>Abaixo de vídeos de duração parecida</td></tr><tr><th scope="row" class="num">0,45 a 0,55</th><td>＝</td><td>Na média de vídeos de duração parecida</td></tr><tr><th scope="row" class="num">0,56 a 1,00</th><td>▲</td><td>Acima de vídeos de duração parecida</td></tr></tbody></table>' +
    '<p class="nota" style="margin-top:10px">Os cortes de 0,45 e 0,55 são proposta (pergunta ao dono nas NOTAS). O “＝” da curva que mudou é “até 2 pontos”, como no % assistido do lote 1.</p>';
  A.moldura({ titulo: 'Retenção: janela e comparação do YouTube', barra: barra,
    corpo: A.migalha([['Canais', '#'], ['tnFigueiredo', '#'], ['Vídeo']]) + L.pager(36) + cab + '<section class="sec rj-sec" id="rjSec" aria-labelledby="hRt"></section>', fora: fora });
  sec = document.getElementById('rjSec');
  desenhar();
  var tmr; window.addEventListener('resize', function(){ clearTimeout(tmr); tmr = setTimeout(desenharCurva, 120); });
})();

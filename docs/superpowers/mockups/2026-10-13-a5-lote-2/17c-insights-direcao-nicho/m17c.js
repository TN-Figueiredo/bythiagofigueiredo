/* m17c.js: mockup 17c, aba Insights do Observatório: "Quem sobe e quem desce no nicho" (cartão novo, com todos os canais do nicho).
   Parâmetros: ?caso=tipico|leituras|videos|justa|extremo|zero|nao-medido|magro|um-canal|sem-dado|sem-dado-leitura|erro
               ?leitura=a|b|c  (a = canal inteiro, 28 dias; b = vídeos novos, 90 dias; c = vídeos novos na mesma idade, só em 2027)
               ?eq=neutro|ambar  (cor e palavra do "＝": neutro/"estável" como aprovado em Comparar canais, ou âmbar/"parado")   ?tema=claro
               ?base0=nao|sobe  (divisão por 0: padrão "nao" = não medido, sem base para comparar; "sobe" = a alternativa da rodada 0: ▲ "de 0" e ＝ "sem mudança")
   Regras: a direção de um canal é contra ele mesmo; a régua ordena, não julga; a posição é escrita (1º, 2º), nunca percentil. ▲ ≥ +10%, ▼ ≤ −10%, ＝ no meio,
   decidido sobre o PERCENTUAL ARREDONDADO que aparece. Todo número é de exemplo (dados em m17c-dados.js). */
(function(){
  'use strict';
  var A = window.A4, L = window.L1, D = window.Q17D, esc = A.esc, q = A.q;
  var HOJE = L.HOJE;                                   /* 2026-10-13 */
  var nomeCaso = D.CASOS[q.get('caso')] ? q.get('caso') : 'tipico', C = D.CASOS[nomeCaso];
  var eqAmbar = q.get('eq') === 'ambar';
  var base0Sobe = q.get('base0') === 'sobe';
  var leitura = ['a', 'b', 'c'].indexOf(q.get('leitura')) >= 0 ? q.get('leitura') : (C.leitura || 'a');
  var NICHO = D.NICHOS.filter(function(n){ return n.id === C.nicho; })[0];
  var MIN_DIAS = 56, ESCALA = 0.6, BANDA = 0.1, LIMITE_AVISO = '2026-10-19';
  var DATA_C = A.addDias('2026-10-03', 180);          /* 01/04/2027: 180 dias de registro dos vídeos novos */
  var JA = { de: A.addDias(HOJE, -27), ate: HOJE, deP: A.addDias(HOJE, -55), ateP: A.addDias(HOJE, -28) };
  var JB = { de: A.addDias(HOJE, -89), ate: HOJE, deP: A.addDias(HOJE, -179), ateP: A.addDias(HOJE, -90) };
  var SIM = { up: '▲', dn: '▼', eq: '＝' };
  var PAL = { up: 'subindo', dn: 'descendo', eq: eqAmbar ? 'parado' : 'estável' };
  var LEIT = {
    a: { nome: 'Canal inteiro', curto: 'Canal inteiro', sub: '28 dias contra 28', meta: 'Últimos 28 dias contra os 28 anteriores', obj: 'em views nos últimos 28 dias',
         cap: 'Inclui Shorts e vídeos apagados. O filtro de formato não vale aqui.' },
    b: { nome: 'Vídeos novos', curto: 'Vídeos novos', sub: '90 dias contra 90', meta: 'Últimos 90 dias contra os 90 anteriores', obj: 'nas views do vídeo típico dos longos publicados nos últimos 90 dias',
         cap: 'Só vídeos longos. Descer pode ser só idade: os mais velhos tiveram mais tempo.' },
    c: { nome: 'Vídeos novos, mesma idade', curto: 'Mesma idade', sub: 'views aos 30 dias', meta: 'Últimos 90 dias contra os 90 anteriores', obj: 'nas views do vídeo típico dos longos publicados nos últimos 90 dias, medidas aos 30 dias de vida',
         cap: 'Compara cada vídeo aos 30 dias de vida, sem o efeito do tempo.' }
  };
  var aberto = {};                                     /* linhas com "As 3 leituras" aberto */
  if (C.abrir) aberto[C.abrir] = true;

  /* ---------------------------------------------------------------- formatação */
  function sgn(r){ return r > 0 ? '+' + r + '%' : r < 0 ? '−' + Math.abs(r) + '%' : '0%'; }
  function vw(x){ return x === 0 ? '<span class="q-z num" role="img" aria-label="zero medido">0</span>' : '<b class="num">' + A.n(x) + '</b>'; }
  function lg(n){ return n + (n === 1 ? ' longo' : ' longos'); }
  function ord(n){ return n + 'º'; }

  /* ---------------------------------------------------------------- a medida de um canal numa leitura */
  function nmR(motivo, extra){ var o = { ok: false, motivo: motivo }; if (extra) Object.keys(extra).forEach(function(k){ o[k] = extra[k]; }); return o; }
  function medida(ch, lt){
    var rec, prev, linha1, linha2;
    if (lt === 'c') return nmR('fecha em ' + A.dmy(DATA_C), { fecha: DATA_C, linha2: 'precisa de 180 dias de registro dos vídeos novos' });
    if (lt === 'a') {
      var a = ch.a, dias = A.dias(a.reg, HOJE) + 1;
      if (a.semBorda) return nmR('sem o registro de ' + A.dm(HOJE), { linha2: 'volta a medir quando houver o dado de ' + A.dm(HOJE), semBorda: true });
      if (dias < MIN_DIAS) { var f = A.addDias(a.reg, MIN_DIAS - 1); return nmR('fecha em ' + A.dm(f), { fecha: f, prog: dias, linha2: dias + ' de ' + MIN_DIAS + ' dias de registro, desde ' + A.dm(a.reg) }); }
      rec = a.rec; prev = a.prev;
      linha1 = vw(rec) + ' views contra ' + vw(prev);
      linha2 = A.dm(JA.de) + ' a ' + A.dm(JA.ate) + ' contra ' + A.dm(JA.deP) + ' a ' + A.dm(JA.ateP);
    } else {
      var b = ch.b;
      if (b.n90 < 3 || b.nP < 3) return nmR(b.n90 < 3 ? lg(b.n90) + ' nos últimos 90 dias; precisa de 3' : lg(b.nP) + ' nos 90 anteriores; precisa de 3', { linha2: 'publicados de ' + A.dm(JB.de) + ' a ' + A.dm(JB.ate) });
      rec = b.m90; prev = b.mP;
      linha1 = 'vídeo típico: ' + vw(rec) + ' views (mediana de ' + lg(b.n90) + ') contra ' + vw(prev) + ' (' + b.nP + ')';
      linha2 = 'publicados de ' + A.dm(JB.de) + ' a ' + A.dm(JB.ate) + ' contra ' + A.dm(JB.deP) + ' a ' + A.dm(JB.ateP);
    }
    if (prev === 0 && !base0Sobe) {
      /* sem base para comparar: dividir por 0 não dá percentual, e 0 views em 28 dias seguidos pode ser dado ausente. Não medido, fora da posição e da contagem. */
      return nmR('sem base para comparar', { semBase: true, linha1: linha1,
        linha2: (lt === 'a' ? '0 views nos 28 dias anteriores (' + A.dm(JA.deP) + ' a ' + A.dm(JA.ateP) + ')' : 'vídeo típico de 0 views nos 90 dias anteriores (' + A.dm(JB.deP) + ' a ' + A.dm(JB.ateP) + ')') });
    }
    var r, k, key, novo = false, ambos0 = false;
    if (prev === 0 && rec === 0) { r = 0; k = 'eq'; key = 0; ambos0 = true; }
    else if (prev === 0) { novo = true; k = 'up'; key = Infinity; r = null; }
    else { r = Math.round((rec / prev - 1) * 100); k = r >= BANDA * 100 ? 'up' : r <= -BANDA * 100 ? 'dn' : 'eq'; key = r; }
    var x = novo ? ESCALA : r / 100;
    return { ok: true, rec: rec, prev: prev, r: r, k: k, key: key, novo: novo, ambos0: ambos0, x: Math.max(-ESCALA, Math.min(ESCALA, x)), fora: novo || Math.abs(x) > ESCALA, linha1: linha1, linha2: linha2 };
  }

  /* ---------------------------------------------------------------- peças de desenho */
  function simb(k, sz){ return '<span class="q-sy ' + k + (sz ? ' ' + sz : '') + '" aria-hidden="true">' + SIM[k] + '</span>'; }
  function simbVazio(k){ return '<span class="q-sy ' + k + ' vz" aria-hidden="true">' + SIM[k] + '</span>'; }
  function trilha(m){
    var base = '<i class="q-banda" aria-hidden="true"></i><i class="q-zero" aria-hidden="true"></i>';
    if (!m.ok) {
      var pg = m.prog ? '<i class="q-prog" style="width:' + (m.prog / MIN_DIAS * 100).toFixed(1) + '%"></i>' : '';
      return '<span class="q-trk nmt" aria-hidden="true">' + base + '<i class="q-nmw">' + pg + '</i></span>';
    }
    var w = Math.abs(m.x) / ESCALA * 50, esq = m.x < 0 ? 50 - w : 50;
    if (w < 0.8) w = 0.8, esq = m.x < 0 ? 50 - w : 50;
    return '<span class="q-trk" aria-hidden="true">' + base + '<i class="q-bar ' + m.k + (m.fora ? ' ult' : '') + '" style="left:' + esq.toFixed(2) + '%;width:' + w.toFixed(2) + '%"></i>' +
      (m.fora ? '<i class="q-seta ' + (m.x < 0 ? 'e' : 'd') + '" aria-hidden="true">' + (m.x < 0 ? '‹' : '›') + '</i>' : '') + '</span>';
  }
  function dirCelula(m){
    if (!m.ok) return '<span class="nm">não medido</span><small class="q-mot">' + esc(m.motivo) + '</small>';
    var pc = m.novo ? 'de 0' : m.ambos0 ? 'sem mudança' : sgn(m.r);
    return simb(m.k) + '<span class="q-dt"><b>' + PAL[m.k] + '</b><span class="num">' + pc + '</span></span>';
  }
  function rotuloAria(ch, m, pos, tot){
    if (!m.ok) return ch.nome + ': não medido, ' + m.motivo + '.';
    return ch.nome + ': ' + PAL[m.k] + (m.novo ? ', de 0 para ' + A.n(m.rec) + ' views' : ' ' + sgn(m.r)) + '. ' + (pos ? ord(pos.n) + ' de ' + tot + ' medidos' + (pos.emp ? ', empatado' : '') + '.' : '');
  }

  /* o painel "as 3 leituras" de um canal: a principal com símbolo cheio, as outras só de contorno */
  function painel(ch){
    var itens = ['a', 'b', 'c'].map(function(lt){
      var m = medida(ch, lt), principal = lt === leitura;
      var val = m.ok ? (principal ? simb(m.k, 'p') : simbVazio(m.k)) + '<span class="q-dt"><b>' + PAL[m.k] + '</b><span class="num">' + (m.novo ? 'de 0' : m.ambos0 ? 'sem mudança' : sgn(m.r)) + '</span></span>' : '<span class="nm">não medido</span>';
      var base = m.ok ? m.linha1 + '<span class="q-b2">' + m.linha2 + '</span>' : (m.semBase ? m.linha1 + '<span class="q-b2">' + esc(m.linha2) + '</span>' : esc(m.motivo) + (m.linha2 ? '<span class="q-b2">' + esc(m.linha2) + '</span>' : ''));
      return '<li' + (principal ? ' class="pr"' : '') + '><span class="q-ln">' + esc(LEIT[lt].nome) + '<small>' + esc(LEIT[lt].sub) + '</small>' + (principal ? '<span class="q-pr">a que ordena a régua</span>' : '') + '</span><span class="q-lv">' + val + '</span><span class="q-lb">' + base + '</span></li>';
    }).join('');
    return '<ul class="q-3" aria-label="As três leituras de ' + esc(ch.nome) + '">' + itens + '</ul>';
  }

  function linha(ch, m, pos, tot){
    var ab = !!aberto[ch.id];
    var posTxt = m.ok && pos ? '<span class="q-pos num" title="' + (pos.emp ? 'empate' : '') + '"><b>' + ord(pos.n) + '</b>' + (pos.emp ? '<small>empate</small>' : '') + '</span>' : '<span class="q-pos nada" aria-label="sem posição"><span aria-hidden="true">–</span></span>';
    var sub = m.ok ? '<span class="q-b1">' + m.linha1 + '</span><span class="q-b2">' + m.linha2 + '</span>' : m.semBase ? '<span class="q-b1">' + m.linha1 + '</span><span class="q-b2">' + esc(m.linha2) + '</span>' : '<span class="q-b1">' + esc(m.linha2 || '') + '</span>';
    var principalNm = !m.ok ? ' q-nao' : '';
    return '<li class="q-li' + principalNm + '" data-id="' + ch.id + '"><div class="q-main">' + posTxt +
      '<span class="q-nome"><a href="#" onclick="return false">' + esc(ch.nome) + '</a></span>' +
      '<span class="q-reg" role="img" aria-label="' + esc(rotuloAria(ch, m, pos, tot)) + '">' + trilha(m) + '</span>' +
      '<span class="q-dir">' + dirCelula(m) + '</span>' +
      '<span class="q-sub">' + sub + '</span>' +
      '<button type="button" class="q-mais" data-abrir="' + ch.id + '" aria-expanded="' + ab + '" aria-controls="p-' + ch.id + '"><span class="q-mt">As 3 leituras</span>' + A.CHEV + '</button></div>' +
      '<div class="q-det" id="p-' + ch.id + '"' + (ab ? '' : ' hidden') + '>' + painel(ch) + '</div></li>';
  }

  /* ---------------------------------------------------------------- o cartão por estado */
  function frase(ct, n, medidos){
    var partes = [];
    if (ct.up) partes.push(simb('up', 'f') + ' <b class="num">' + ct.up + '</b> ' + (ct.up === 1 ? 'sobe' : 'sobem'));
    if (ct.dn) partes.push(simb('dn', 'f') + ' <b class="num">' + ct.dn + '</b> ' + (ct.dn === 1 ? 'desce' : 'descem'));
    if (ct.eq) partes.push(simb('eq', 'f') + ' <b class="num">' + ct.eq + '</b> ' + (eqAmbar ? (ct.eq === 1 ? 'parado' : 'parados') : (ct.eq === 1 ? 'fica estável' : 'ficam estáveis')));
    var txt, obj = LEIT[leitura].obj, apoio = '';
    if (!medidos) {
      var datas = C.canais.map(function(ch){ return medida(ch, leitura).fecha; }).filter(Boolean).sort();
      txt = 'Nenhum canal do nicho ' + esc(NICHO.nome) + ' tem medida ' + obj + ' ainda' + (datas.length ? ': o primeiro fecha em <b class="num">' + A.dm(datas[0]) + (leitura === 'c' ? '/' + datas[0].slice(0, 4) : '') + '</b>.' : '.');
      /* o que existe: a outra leitura que já mede mais canais (S3) */
      var melhor = null;
      ['a', 'b', 'c'].forEach(function(lt){ if (lt === leitura) return; var k = C.canais.filter(function(ch){ return medida(ch, lt).ok; }).length; if (k && (!melhor || k > melhor.k)) melhor = { lt: lt, k: k }; });
      if (melhor) apoio = '<button type="button" class="q-lk" data-lt="' + melhor.lt + '">' + esc(LEIT[melhor.lt].nome) + ' já mede ' + melhor.k + ' de ' + n + '</button>';
    } else if (n === 1) {
      txt = 'Só <b class="num">1</b> canal no nicho ' + esc(NICHO.nome) + ', e ele ' + (ct.up ? 'sobe' : ct.dn ? 'desce' : eqAmbar ? 'está parado' : 'fica estável') + ' ' + simb(ct.up ? 'up' : ct.dn ? 'dn' : 'eq', 'f') + ' ' + obj + '. Sem outro canal, não há com quem comparar.';
    } else {
      var j = partes.length > 1 ? partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1] : partes[0];
      txt = j + ' ' + obj + ', no nicho ' + esc(NICHO.nome) + '.';
      if (ct.nm) txt += ' <b class="num">' + ct.nm + '</b> ' + (ct.nm === 1 ? 'canal ainda não pôde ser medido' : 'canais ainda não puderam ser medidos') + '.';
    }
    return '<p class="q-fr" id="q-fr" aria-live="polite"><span>' + txt + '</span>' + apoio + '</p>';
  }
  function barraCont(ct, total){
    var pl = function(n, a, b){ return n === 1 ? a : b; };
    var seg = [['up', ct.up, pl(ct.up, 'sobe', 'sobem')], ['dn', ct.dn, pl(ct.dn, 'desce', 'descem')], ['eq', ct.eq, eqAmbar ? pl(ct.eq, 'parado', 'parados') : pl(ct.eq, 'estável', 'estáveis')], ['nm', ct.nm, pl(ct.nm, 'não medido', 'não medidos')]].filter(function(s){ return s[1] > 0; });
    var aria = seg.map(function(s){ return s[1] + ' ' + s[2]; }).join(', ') + ', de ' + total + ' ' + (total === 1 ? 'canal' : 'canais');
    return '<ul class="q-cont" role="img" aria-label="' + esc(aria) + '">' + seg.map(function(s){
      return '<li class="' + s[0] + '" style="flex:' + s[1] + ' 1 0"><span class="q-cs" aria-hidden="true">' + (s[0] === 'nm' ? '◌' : SIM[s[0]]) + '</span><b class="num">' + s[1] + '</b><span class="q-cw">' + s[2] + '</span></li>'; }).join('') + '</ul>';
  }
  function seletor(){
    var itens = ['a', 'b', 'c'].map(function(lt){
      var med = C.canais.filter(function(ch){ return medida(ch, lt).ok; }).length;
      var tot = C.canais.length, cont = med ? med + ' de ' + tot + '<span class="q-ocw"> ' + (tot === 1 ? 'medido' : 'medidos') + '</span>' : '<span class="nm-h" aria-hidden="true"></span>nenhum<span class="q-ocw"> medido</span>';
      var nomeA = LEIT[lt].nome + ', ' + LEIT[lt].sub + ', ' + (med ? med + ' de ' + tot + (tot === 1 ? ' medido' : ' medidos') : 'nenhum medido');
      return '<button type="button" class="q-op" data-lt="' + lt + '" aria-pressed="' + (lt === leitura) + '" aria-label="' + esc(nomeA) + '"><span class="q-on"><span class="q-onl">' + esc(LEIT[lt].nome) + '</span><span class="q-onc" aria-hidden="true">' + esc(LEIT[lt].curto) + '</span></span><small>' + esc(LEIT[lt].sub) + '</small>' +
        '<span class="q-oc num">' + cont + '</span></button>'; }).join('');
    return '<div class="q-sel" role="group" aria-label="Leitura da direção">' + itens + '</div>';
  }
  function eixo(){
    return '<div class="q-eixo" aria-hidden="true"><span class="q-pad"></span><span class="q-pad"></span><span class="q-ea"><span class="q-ep"><span class="e1">descendo</span><span class="e2">estável</span><span class="e3">subindo</span></span><span class="q-en"><span style="left:2%">−60%</span><span style="left:41.7%">−10%</span><span style="left:58.3%">+10%</span><span style="left:98%">+60%</span></span></span></div>';
  }

  function cartaoDados(){
    var sem = C.canais.map(function(ch){ return { ch: ch, m: medida(ch, leitura) }; });
    var med = sem.filter(function(s){ return s.m.ok; }).sort(function(a, b){ return b.m.key - a.m.key; });
    var nao = sem.filter(function(s){ return !s.m.ok; }).sort(function(a, b){ return (a.m.fecha || 'z').localeCompare(b.m.fecha || 'z') || a.ch.nome.localeCompare(b.ch.nome); });
    var ct = { up: 0, dn: 0, eq: 0, nm: nao.length };
    med.forEach(function(s){ ct[s.m.k]++; s.pos = { n: 1 + med.filter(function(o){ return o.m.key > s.m.key; }).length, emp: med.filter(function(o){ return o.m.key === s.m.key; }).length > 1 }; });
    var n = sem.length, todos = !med.length;
    var linhas = med.map(function(s){ return linha(s.ch, s.m, n === 1 ? null : s.pos, med.length); }).concat(nao.map(function(s){ return linha(s.ch, s.m, null, med.length); })).join('');
    var ex = '<span class="ex">exemplo</span>';
    var aviso = leitura === 'a' && HOJE < LIMITE_AVISO ? '<p class="q-aviso">' + L.IC.aviso + '<span>Até ' + A.dm(A.addDias(LIMITE_AVISO, -1)) + ', os 28 dias anteriores incluem a mudança de contagem do YouTube (' + '24/08' + ').</span></p>' : '';
    var umCanalPos = n === 1 ? '<p class="q-unico">' + L.IC.canal + '<span>Único canal do nicho: sem posição.</span></p>' : '';
    var magro = n === 2 ? '<span class="chip q-magro">só 2 canais</span>' : '';
    return '<div class="q-ch"><h2 id="qh">Quem sobe e quem desce no nicho ' + esc(NICHO.nome) + '</h2>' + ex + magro + '<span class="q-meta">' + esc(LEIT[leitura].meta) + '</span>' + A.ibtn('infoQ', 'Como ler esta régua', true) + '</div>' +
      frase(ct, n, med.length) + (todos || n === 1 ? '' : barraCont(ct, n)) +
      '<div class="q-selw">' + seletor() + '<p class="q-cap"><span>' + esc(LEIT[leitura].cap) + '</span>' + A.ibtn('infoLeit', 'As três leituras', true) + '</p>' + aviso + '</div>' +
      (todos ? '' : eixo()) + '<ol class="q-lista" aria-labelledby="qh">' + linhas + '</ol>' + umCanalPos + seuCanal();
  }
  function seuCanal(){
    return '<div class="q-seu"><span class="chip own">seu canal</span><b>tnFigueiredo</b><span class="q-fora">fora desta régua</span>' + A.ibtn('infoSeu', 'Por que o seu canal não aparece', true) + '</div>';
  }
  function cartaoVazio(){
    var cab = '<div class="q-ch"><h2 id="qh">Quem sobe e quem desce no nicho ' + esc(NICHO.nome) + '</h2></div>';
    if (C.erro) {
      return cab + '<div class="q-erro" role="alert">' + L.IC.aviso + '<div><b>Não deu para carregar as views dos canais deste nicho.</b><span>Os outros cartões desta tela carregaram. Tente de novo; se o erro continuar, confira se a sincronização dos canais está atrasada.</span></div><span class="btn" role="button" tabindex="0">Tentar de novo</span></div>';
    }
    var leit = C.soLeitura;
    return cab + '<div class="q-vazio"><span class="q-vi">' + L.IC.canal + '</span><div><b>Nenhum canal neste nicho</b><span>Adicione um canal de ' + esc(NICHO.nome) + ' para ver quem sobe e quem desce.</span></div>' +
      (leit ? '<div class="q-leit"><span class="btn" role="button" aria-disabled="true" tabindex="0" aria-describedby="q-pq">Adicionar canal</span><small id="q-pq">Só quem edita este site adiciona canais.</small></div>'
            : '<span class="btn pri" role="button" tabindex="0">Adicionar canal</span>') + '</div>';
  }
  function cartao(){ return C.erro || !C.canais.length ? cartaoVazio() : cartaoDados(); }

  /* ---------------------------------------------------------------- casca: cabeçalho do Observatório com o nicho escolhido */
  function obs(){
    var total = D.NICHOS.reduce(function(s, n){ return s + C.contagem[n.id]; }, 0);
    var abas = [['Canais', total], ['Mudanças', 12], ['Outliers', 9], ['Insights', null]].map(function(t){ return '<span class="c2-otab"' + (t[0] === 'Insights' ? ' aria-current="page"' : '') + '>' + t[0] + (t[1] != null ? '<span class="c2-ct">' + t[1] + '</span>' : '') + '</span>'; }).join('');
    var nichos = [{ id: 'todos', nome: 'Todos', sw: '' }].concat(D.NICHOS).map(function(n){
      var cont = n.id === 'todos' ? total : C.contagem[n.id];
      return '<span' + (n.id === NICHO.id ? ' aria-pressed="true"' : '') + '>' + (n.sw ? '<i class="c2-sw ' + n.sw + '"></i>' : '') + n.nome + '<span class="c2-nn">' + cont + '</span></span>'; }).join('');
    return '<div class="c2-obs" aria-hidden="true"><div class="c2-oh"><div class="c2-ot"><h2>Observatório de Competidores</h2><p>O que os canais que você acompanha mudaram, o que está estourando agora e o que a forja leu disso, para decidir o próximo vídeo, título e thumbnail.</p></div>' +
      '<div class="c2-oa"><span class="c2-ob">' + L.IC.sync + '<span class="c2-lt">Sincronizar concorrentes</span></span><span class="c2-ob">' + L.IC.plus + '<span class="c2-lt">Adicionar canal</span></span><span class="c2-ob c2-mc"><span class="c2-lt">Meu canal</span><span class="c2-mn">: <b>tnFigueiredo</b></span></span><span class="c2-ob c2-ic">' + L.IC.dots + '</span></div></div>' +
      '<div class="c2-fr"><span class="c2-fresh"><span class="c2-fs"><i class="c2-dot"></i><b>' + total + ' canais</b></span><i class="c2-sp"></i><span class="c2-fs">sincronizado há 3 h</span><i class="c2-sp"></i><span class="c2-fs">todos em dia</span>' + L.IC.chev + '</span><span class="c2-tz">Horários em São Paulo</span></div>' +
      '<div class="c2-nav"><nav class="c2-otabs">' + abas + '</nav><div class="c2-niche"><span class="c2-nl">Nicho</span><span class="c2-segc">' + nichos + '</span><span class="c2-pin">' + L.IC.pin + '</span></div></div></div>';
  }
  function vizinho(titulo){ return '<div class="q-viz" aria-hidden="true"><b>' + titulo + '</b><span>já existe, não muda</span></div>'; }

  /* ---------------------------------------------------------------- ⓘ */
  var FIXA = 'Cálculo do Observatório sobre dados públicos do YouTube.';
  var info =
    A.oculto('infoQ', 'Como ler esta régua',
      '<ul><li><b>O que é:</b> cada canal contra ele mesmo, na leitura escolhida nos botões (o padrão é o canal inteiro: as views ganhas nos últimos 28 dias contra as dos 28 anteriores). A janela de cada leitura está escrita na frase do alto.</li>' +
      '<li><b>Símbolos:</b> ▲ subindo (+10% ou mais), ＝ ' + (eqAmbar ? 'parado' : 'estável') + ' (entre −10% e +10%), ▼ descendo (−10% ou menos). A regra usa o percentual arredondado que está na tela: 9,7% aparece como +10% e conta como ▲.</li>' +
      '<li><b>A régua:</b> vai de −60% a +60%, com a faixa tracejada do meio para o ＝. Passou disso, a barra encosta na borda e termina em seta; o número continua escrito.</li>' +
      '<li><b>Posição:</b> 1º é quem mais subiu. É uma ordem, não uma nota: ser 1º não quer dizer que o canal é melhor, e ser o último não quer dizer que é pior. O tamanho do canal não entra. Percentuais iguais empatam.</li>' +
      '<li><b>Não medido:</b> mostra o motivo e, quando existe, a data em que passa a existir. Canal sem medida não tem posição e não entra na contagem. Canal com 0 views no período anterior também fica não medido (“sem base para comparar”): a partir de zero não dá para dizer quanto mudou, e 0 views seguidas pode ser dado que não chegou.</li>' +
      '<li><b>Zero medido</b> (caixa vazada com 0) é uma medida: o YouTube registrou 0. Não é o mesmo que não medido.</li>' +
      '<li>' + FIXA + '</li></ul>') +
    A.oculto('infoLeit', 'As três leituras da direção',
      '<ul><li><b>Só uma ordena a régua por vez.</b> As outras ficam no botão “As 3 leituras” de cada linha, sem cor de destaque, para você ver se concordam.</li>' +
      '<li><b>Canal inteiro (28 dias):</b> views totais ganhas nos últimos 28 dias contra as dos 28 anteriores. Precisa de 56 dias de registro e do registro de hoje. Inclui Shorts e vídeos que saíram do YouTube. Até 18/10 a janela anterior cruza a mudança de contagem de 24/08.</li>' +
      '<li><b>Vídeos novos (90 dias):</b> mediana das views atuais dos vídeos longos publicados nos últimos 90 dias contra a dos 90 anteriores. Precisa de 3 longos em cada período. Descer pode ser só idade: os vídeos antigos tiveram mais tempo para juntar views; subir apesar disso é sinal forte.</li>' +
      '<li><b>Vídeos novos, mesma idade:</b> o mesmo, com as views de cada vídeo aos 30 dias de vida. Não tem o efeito do tempo. Só existe a partir de ' + A.dmy(DATA_C) + '.</li>' +
      '<li>' + FIXA + '</li></ul>') +
    A.oculto('infoSeu', 'Por que o seu canal não aparece',
      '<ul><li>O Observatório guarda o dia a dia público dos canais que você acompanha. O seu canal não está entre eles: a direção dele viria de outra fonte, que não é comparável com esta.</li>' +
      '<li>Se você quiser o seu canal na régua, ele passa a ser acompanhado como os outros (pergunta aberta no mockup).</li></ul>');

  /* ---------------------------------------------------------------- referência fora da tela: a conta de cada canal */
  function fora(){
    var leg = '<div class="tbw"><table class="tb" style="max-width:860px"><caption>Forma, cor e símbolo (iguais em toda tela)</caption><thead><tr><th scope="col">Significado</th><th scope="col">Forma</th><th scope="col">Regra</th></tr></thead><tbody>' +
      '<tr><th scope="row">Subindo</th><td>' + simb('up') + ' barra verde para a direita</td><td>percentual arredondado ≥ +10%</td></tr>' +
      '<tr><th scope="row">Descendo</th><td>' + simb('dn') + ' barra âmbar para a esquerda</td><td>percentual arredondado ≤ −10%</td></tr>' +
      '<tr><th scope="row">' + (eqAmbar ? 'Parado (＝)' : 'Estável (＝)') + '</th><td>' + simb('eq') + ' barra curta na faixa tracejada</td><td>entre −9% e +9%</td></tr>' +
      '<tr><th scope="row">Não medido</th><td><span class="nm-h" aria-hidden="true"></span> trilha pontilhada com hachura rosa</td><td>falta registro, falta vídeo ou ainda não existe</td></tr>' +
      '<tr><th scope="row">Zero medido</th><td><span class="q-z num">0</span> caixa vazada</td><td>o YouTube registrou 0</td></tr></tbody></table></div>';
    if (!C.canais.length) return L.fora('Referência', leg);
    var rows = C.canais.map(function(ch){
      var m = medida(ch, leitura);
      if (!m.ok) return '<tr><th scope="row">' + esc(ch.nome) + '</th><td colspan="5">não medido: ' + esc(m.motivo) + '</td></tr>';
      return '<tr><th scope="row">' + esc(ch.nome) + '</th><td class="r num">' + A.n(m.rec) + '</td><td class="r num">' + A.n(m.prev) + '</td><td class="r num">' + (m.novo || m.ambos0 ? 'indefinido (÷ 0)' : A.dec(m.rec / m.prev, 4)) + '</td><td class="r num">' + (m.novo || m.ambos0 ? '—' : sgn(m.r)) + '</td><td>' + SIM[m.k] + ' ' + PAL[m.k] + '</td></tr>'; }).join('');
    var conta = '<div class="tbw"><table class="tb" style="max-width:860px;margin-top:14px"><caption>A conta de cada canal neste estado (leitura “' + esc(LEIT[leitura].nome) + '”)</caption><thead><tr><th scope="col">Canal</th><th scope="col" class="r">Atual</th><th scope="col" class="r">Anterior</th><th scope="col" class="r">Razão</th><th scope="col" class="r">Mostrado</th><th scope="col">Direção</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="nota" style="margin-top:10px">Mostrado = (atual ÷ anterior − 1) arredondado ao inteiro; a direção sai do número mostrado. Ordem da lista: do maior mostrado para o menor; iguais empatam e dividem a posição.</p>';
    return L.fora('Referência', leg + conta);
  }

  /* ---------------------------------------------------------------- montagem */
  var estados = [['tipico', 'Com dado típico (7 canais)'], ['leituras', 'Linha aberta: as 3 leituras'], ['videos', 'Leitura: vídeos novos'], ['justa', 'Leitura: mesma idade (só em 2027)'],
    ['extremo', 'Com dado extremo'], ['zero', 'Zero medido'], ['nao-medido', 'Todos não medidos'], ['magro', 'Nicho magro (2 canais)'], ['um-canal', 'Nicho com 1 canal'],
    ['sem-dado', 'Sem dado'], ['sem-dado-leitura', 'Sem dado, só leitura'], ['erro', 'Erro']];
  var barra = L.barra([{ rotulo: 'Estado', param: 'caso', itens: estados, padrao: 'tipico', extra: { leitura: null } },
    { rotulo: 'Divisão por 0', param: 'base0', itens: [['nao', 'Não medido, “sem base para comparar” (padrão)'], ['sobe', 'Alternativa: ▲ “de 0” e ＝ “sem mudança”']], padrao: 'nao', extra: { caso: 'zero' } },
    { rotulo: 'Cor do ＝', param: 'eq', itens: [['neutro', 'Neutro, “estável” (como em Comparar canais)'], ['ambar', 'Âmbar, “parado” (se o dono responder que é isto)']], padrao: 'neutro' }],
    'Tudo é exemplo: canais e números inventados, “hoje” é 13/10/2026. Contorno tracejado verde-água e “+ novo” marcam o que o mockup acrescenta à aba Insights; o resto da tela já existe. A escolha da leitura dentro do cartão funciona de verdade (e vai para a URL em ?leitura=).');
  function montar(){
    return obs() +
      '<div class="q-fil" aria-hidden="true"><span class="q-fl">Formato</span><span class="q-seg"><span aria-pressed="true">Longos</span><span>Shorts</span></span></div>' +
      '<div class="q-pagina">' + vizinho('Leitura da forja') + vizinho('Você no nicho') +
      '<div class="c2-novo q-novo"><span class="c2-tag">+ novo</span><section class="q-cartao" id="q-cartao" aria-labelledby="qh">' + cartao() + '</section></div>' +
      vizinho('Cadência de publicação') + '</div>' + info;
  }
  A.moldura({ titulo: 'Insights: quem sobe e quem desce', barra: barra, corpo: montar(), fora: fora() });
  if (eqAmbar) document.documentElement.setAttribute('data-eq', 'ambar');
  A.ligarInfos();
  document.title = 'Insights: quem sobe e quem desce (mockup)';

  /* interações: trocar a leitura e abrir "As 3 leituras" */
  function redesenhar(foco){
    var host = document.getElementById('q-cartao');
    host.innerHTML = cartao();
    A.ligarInfos(host);
    if (foco) { var b = host.querySelector(foco); if (b) b.focus(); }
  }
  document.getElementById('q-cartao').addEventListener('click', function(e){
    var op = e.target.closest('[data-lt]');
    if (op) {
      leitura = op.getAttribute('data-lt');
      try { history.replaceState(null, '', A.href({ leitura: leitura === 'a' ? null : leitura })); } catch (err) { /* sem histórico: a tela funciona igual */ }
      redesenhar('.q-op[data-lt="' + leitura + '"]');
      return;
    }
    var ab = e.target.closest('[data-abrir]');
    if (ab) { var id = ab.getAttribute('data-abrir'); aberto[id] = !aberto[id]; redesenhar('[data-abrir="' + id + '"]'); }
  });
})();

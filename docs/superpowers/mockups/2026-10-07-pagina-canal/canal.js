/* Página do canal — mockup. Só desenha: todo número vem de dados.js (window.CANAL).
   Filtro, ordenação, busca e vista rodam no navegador sobre os campos brutos e são espelhados na URL. */
(function(){
  'use strict';
  var C = window.CANAL, F = C.fmt, $ = function(id){ return document.getElementById(id); };
  var screen = $('screen');
  var OWN = !!C.own, PAGE = OWN ? 'canal-proprio.html' : 'canal.html';   /* rodada 5: canal-proprio.html carrega dados-proprio.js, que troca o canal de window.CANAL pelo canal do dono */
  /* rodada 3: o múltiplo do canal passa a ser o MESMO da tela de histórico do vídeo (mediana dos outros vídeos do mesmo formato e da mesma faixa de idade), para o número não mudar entre as duas telas */
  if (window.HM) C.videos.forEach(function(v){
    var m = window.HM.mult(v.id);
    if (m.value != null){ v.mult = m.value; v.multMotivo = null; v.nivel = m.value >= 10 ? 'topo' : m.value >= 5 ? 'muito alto' : m.value >= 2 ? 'alto' : null; v.tier = m.value >= 10 ? 'top' : m.value >= 5 ? 'high' : m.value >= 2 ? 'mid' : null; v.multTxt = m.text; }
    else if (v.mult != null){ v.mult = null; v.nivel = null; v.tier = null; v.multMotivo = 'sem-base-faixa'; }
  });

  /* ---------------------------------------------------------------- ícones (SVG inline, nunca emoji) */
  function svg(d, cls){ return '<svg class="i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 16 16" aria-hidden="true">' + d + '</svg>'; }
  var I = {
    pin: svg('<path d="M9.5 2l4.5 4.5-2 .7-2.3 2.3.3 3L8.5 14 6 9.9 2 14l4.1-4L2 7.5 3.5 6l3 .3L8.8 4z"/>'),
    ext: svg('<path d="M6.5 3.5h-3v9h9v-3M9.5 2.5h4v4M13.5 2.5l-6 6"/>'),
    dots: svg('<circle cx="3.5" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="12.5" cy="8" r="1.3"/>', 'f'),
    info: svg('<circle cx="8" cy="8" r="6"/><path d="M8 7.2v3.6M8 5.1v.2"/>'),
    grid: svg('<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>'),
    list: svg('<path d="M2.5 4h11M2.5 8h11M2.5 12h11"/>'),
    warn: svg('<path d="M8 2.2l6.2 11H1.8zM8 6.5v3.2M8 11.6v.2"/>'),
    err: svg('<circle cx="8" cy="8" r="6"/><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4"/>'),
    clock: svg('<circle cx="8" cy="8" r="6"/><path d="M8 4.8V8l2.2 1.4"/>'),
    x: svg('<path d="M4 4l8 8M12 4l-8 8"/>'),
    up: svg('<path d="M8 12.5v-9M4.5 7L8 3.5 11.5 7"/>', 'arr'),
    down: svg('<path d="M8 3.5v9M4.5 9L8 12.5 11.5 9"/>', 'arr'),
    sync: svg('<path d="M13 8a5 5 0 0 1-9 3M3 8a5 5 0 0 1 9-3M12.5 2.5V5H10M3.5 13.5V11H6"/>'),
    trash: svg('<path d="M3 4.5h10M6.5 4.5v-2h3v2M4.5 4.5l.6 9h5.8l.6-9"/>'),
    swap: svg('<path d="M3 5.5h9.5L10 3M13 10.5H3.5L6 13"/>'),
    chev: svg('<path d="M4 6l4 4 4-4"/>')
  };
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------------------------------------------------------------- estado ⇄ URL (os padrões ficam fora da URL) */
  var LOTE = 40;   /* rodada 3: "Carregar mais" traz os antigos, sem contagem diária, de 40 em 40 */
  var DEF = { tab: 'videos', fmt: 'todos', sort: 'recentes', dir: 'desc', q: '', ver: 'capas', n: 0, nums: '' };   /* nums=1: "Todos os números" aberto (rodada 5) */   /* n = quantos dos antigos já foram carregados */
  var OK = { tab: OWN ? ['videos', 'trocas', 'leitura', 'retencao'] : ['videos', 'trocas', 'leitura'], fmt: OWN ? ['todos', 'longos', 'shorts'] : ['todos', 'longos', 'shorts', 'fixados'], sort: OWN ? ['recentes', 'vistos', 'multiplo', 'imp'] : ['recentes', 'vistos', 'multiplo', 'vpd'], dir: ['asc', 'desc'], ver: ['capas', 'lista'],
    estado: ['normal', 'carregando', 'erro', 'backfill', 'atrasada', 'vazio'], dens: ['conf', 'padrao', 'comp'], leitura: window.FORJA.VALIDOS };
  var st = {};
  function lerUrl(){
    /* a URL real é ?fmt=…; aberto direto do disco (file://) o navegador recusa pushState, então o mesmo estado vai no # */
    var p = new URLSearchParams(location.search.length > 1 ? location.search : location.hash.replace(/^#/, ''));
    ['tab', 'fmt', 'sort', 'dir', 'ver'].forEach(function(k){ var v = p.get(k); st[k] = OK[k].indexOf(v) >= 0 ? v : DEF[k]; });
    st.cliques = 'sempre';   /* rodada 7 (decisão do dono): sem corte, sempre a contagem, nunca percentual por vídeo */
    /* rodada 8: "Como o canal está" nasce RECOLHIDA. ?painel=1 abre, ?painel=0 fecha; sem parâmetro vale o que a pessoa deixou (pc:painel8); com ?comparar= a comparação precisa dele aberto */
    /* rodada 9: a comparação saiu daqui e mora em comparar.html. Link antigo ?comparar=<id> redireciona para a tela nova. */
    st.comparar = '';
    if (OWN && p.get('comparar')) location.replace('comparar.html?a=proprio&b=' + encodeURIComponent(p.get('comparar')));
    st.painel = p.get('painel') === '0' ? '0' : p.get('painel') === '1' ? '1' : (function(){ try { return localStorage.getItem('pc:painel8') === '1' ? '1' : '0'; } catch (e) { return '0'; } })();
    st.q = (p.get('q') || '').slice(0, 80); st.nums = p.get('nums') === '1' ? '1' : '';
    var n = parseInt(p.get('n'), 10); st.n = n > 0 ? Math.ceil(n / LOTE) * LOTE : DEF.n;
    st.video = p.get('video') || '';
    /* só do mockup */
    st.estado = OK.estado.indexOf(p.get('estado')) >= 0 ? p.get('estado') : 'normal';
    st.dens = OK.dens.indexOf(p.get('dens')) >= 0 ? p.get('dens') : 'padrao';
    st.leitura = OK.leitura.indexOf(p.get('leitura')) >= 0 ? p.get('leitura') : 'nunca';
  }
  function query(extra){
    var p = new URLSearchParams(), s = Object.assign({}, st, extra || {});
    ['tab', 'fmt', 'sort', 'dir', 'q', 'ver', 'nums'].forEach(function(k){ if (s[k] !== DEF[k]) p.set(k, s[k]); });
    if (s.n !== DEF.n) p.set('n', s.n);
    if (s.tab === 'trocas' && s.video) p.set('video', s.video);
    if (OWN && s.painel === '1') p.set('painel', '1');
    if (s.estado !== 'normal') p.set('estado', s.estado);
    if (s.dens !== 'padrao') p.set('dens', s.dens);
    if (s.leitura && s.leitura !== 'nunca') p.set('leitura', s.leitura);
    var q = p.toString(); return q ? '?' + q : '';
  }
  var HASH = location.protocol === 'file:', ultimoHash = null;
  function alvo(q){ return HASH ? q.replace(/^\?/, '#') : q; }       /* como um link para canal.html leva o estado */
  function gravarUrl(push){
    var q = query();
    if (!HASH){ try { history[push ? 'pushState' : 'replaceState']({ pc: 1 }, '', location.pathname + q); return; } catch (e) { HASH = true; } }
    var h = q ? '#' + q.slice(1) : '#'; ultimoHash = h === '#' ? '' : h;
    if ((location.hash || '') === ultimoHash) return;
    if (push) location.hash = h; else location.replace(h);
  }
  addEventListener('hashchange', function(){ if (!HASH || (location.hash || '') === ultimoHash) return; ultimoHash = location.hash; lerUrl(); render(); });

  /* ---------------------------------------------------------------- conjunto de dados por estado do mockup */
  var cacheDs = {};
  function ds(){
    if (st.estado === 'vazio') return { vids: [], base: {} };
    if (st.estado === 'backfill'){
      if (!cacheDs.b) cacheDs.b = C.construir(window.BRUTO.videos.slice(0, 12).map(function(r){ return Object.assign({}, r, { v: null, serie: null, pin: null, vm: 'ainda sincronizando' }); }));
      return cacheDs.b;
    }
    return { vids: C.videos, base: C.base };
  }
  function syncMs(){ return st.estado === 'atrasada' ? C.NOW - 34 * 36e5 : OWN ? C.reach.lidoEm : Date.parse(C.canal.syncAt); }

  /* ---------------------------------------------------------------- filtro, busca e ordenação */
  var FMT_NOME = { todos: 'Todos', longos: 'Longos', shorts: 'Shorts', fixados: 'Fixados' };
  var SORT_NOME = { recentes: 'Publicado', vistos: 'Views', multiplo: 'Múltiplo', vpd: 'Views/dia', imp: 'Impressões' };
  var SEM = {
    vistos: ['Sem contagem de views', 'o YouTube ainda não devolveu a contagem'],
    multiplo: ['Sem múltiplo ainda', 'formato não confirmado, fixado antigo ou sem contagem'],
    vpd: ['Sem views por dia ainda', 'fora dos ' + C.canal.limite + ' vídeos acompanhados, fixado antigo ou sem contagem'],
    recentes: ['', ''], imp: ['', '']
  };
  function passaFmt(v, f){ return f === 'todos' || (f === 'longos' && v.fmt === 'long') || (f === 'shorts' && v.fmt === 'short') || (f === 'fixados' && v.pinned); }
  function filtrar(f, q){
    var k = F.semAcento(q.trim());
    return ds().vids.filter(function(v){ return passaFmt(v, f) && (!k || F.semAcento(v.t).indexOf(k) >= 0); });
  }
  function chave(v){ return st.sort === 'recentes' ? v.pub : st.sort === 'vistos' ? v.views : st.sort === 'multiplo' ? v.mult : st.sort === 'imp' ? v.imp : v.vpd; }
  function grupos(lista){
    var semData = lista.filter(function(v){ return v.pub == null; }), com = lista.filter(function(v){ return v.pub != null; });
    var main = com.filter(function(v){ return chave(v) != null; }), sem = com.filter(function(v){ return chave(v) == null; });
    var s = st.dir === 'asc' ? 1 : -1;
    main.sort(function(a, b){ return s * (chave(a) - chave(b)) || b.pub - a.pub; });
    sem.sort(function(a, b){ return b.pub - a.pub; });
    semData.sort(function(a, b){ return (b.views || 0) - (a.views || 0); });
    return [{ k: 'main', itens: main }, { k: 'sem', titulo: SEM[st.sort][0], nota: SEM[st.sort][1], itens: sem },
      { k: 'semData', titulo: 'Sem data de publicação', nota: 'o YouTube não devolveu a data; ficam no fim em qualquer ordenação', itens: semData }];
  }

  /* ---------------------------------------------------------------- textos de cada número (o que falta diz por quê) */
  var PERIODO = OWN ? C.fmt.data(C.reach.de) + ' a ' + C.fmt.data(C.reach.ate) : '';
  var MIN_IMP = 10;   /* proposta do mockup (pergunta ao dono): abaixo de 10 impressões no período a tela não fala de cliques */
  function impTexto(v){
    if (!v.imp) return 'nenhuma nos relatórios lidos de ' + PERIODO + '.';
    return F.plural(v.imp, 'impressão', 'impressões') + ' de miniatura em ' + F.plural(v.impDias, 'dia', 'dias') + ', de ' + PERIODO + '. ' +
      (v.imp < MIN_IMP && st.cliques !== 'sempre' ? 'Poucas impressões para dizer algo sobre cliques.' : (v.cliques ? F.plural(v.cliques, 'clique estimado', 'cliques estimados') : 'Nenhum clique estimado') + ' (impressões × CTR de cada dia). É contagem, não percentual: com tão poucas impressões o CTR de um dia não diz nada.');
  }
  function linha3(v){
    if (!v.imp) return 'sem impressão no período';
    if (v.imp < MIN_IMP && st.cliques !== 'sempre') return 'poucas impressões para dizer algo';
    return (v.cliques ? F.plural(v.cliques, 'clique', 'cliques') : 'nenhum clique') + ' em ' + F.plural(v.impDias, 'dia', 'dias');
  }
  function vpdTexto(v){
    if (OWN) return 'ainda não medido. A coleta diária de views por vídeo começa em breve.';
    if (v.vpd != null) return F.taxa(v.vpd) + ' por dia, média de ' + F.plural(v.vpdDias, 'dia', 'dias') + ' (' + F.data(Date.parse(v.serie[0][0] + 'T15:00:00Z')) + ' a ' + F.data(Date.parse(v.serie[v.serie.length - 1][0] + 'T15:00:00Z')) + '; a contagem diária existe desde 03/10)';
    if (v.vpdMotivo === 'fixado-antigo') return 'fixado antigo: sem views/dia. Última contagem de views em ' + F.data(v.chk) + '.';
    if (v.vpdMotivo === 'um-dia') return 'primeira contagem diária em ' + F.data(Date.parse(v.serie[0][0] + 'T15:00:00Z')) + '. A média aparece no segundo dia.';
    if (v.vpdMotivo === 'sem-contagem') return 'sem contagem: ' + v.viewsMotivo + '.';
    return 'não medido. Este vídeo está fora dos ' + C.canal.limite + ' acompanhados, então não há contagem diária dele.';
  }
  function multTexto(v){
    var b = ds().base[v.fmt];
    if (v.mult != null && v.multTxt) return F.mult(v.mult) + (v.nivel ? ' ' + v.nivel : '') + ', ' + v.multTxt.replace(/^[^ ]+ /, '') + '.';
    if (v.multMotivo === 'sem-base-faixa') return 'sem outros vídeos do canal na mesma faixa de idade para comparar.';
    if (v.mult != null) return F.mult(v.mult) + (v.nivel ? ' ' + v.nivel : '') + ', contra ' + (v.fmt === 'long' ? 'os longos' : 'os Shorts') + ' do canal (mediana de ' + F.num(b.med) + ' views em ' + b.n + ' vídeos)';
    if (v.multMotivo === 'fixado-antigo') return 'fixado antigo: sem múltiplo.';
    if (v.multMotivo === 'formato-nao-confirmado') return 'não medido: formato não confirmado, então não há com quem comparar.';
    if (v.multMotivo === 'sem-data') return 'não medido: sem data de publicação.';
    if (v.multMotivo === 'poucos-videos') return 'poucos vídeos para comparar (' + (b ? b.n : 0) + '; precisa de ' + C.REGRA.minBase + ').';
    return 'sem contagem: ' + v.viewsMotivo + '.';
  }
  function viewsTexto(v){
    if (v.views == null) return 'sem contagem: ' + v.viewsMotivo + '.';
    if (OWN) return F.num(v.views) + ' (lido em ' + F.data(C.reach.lidoEm, true) + ')';
    var velha = v.chk != null && C.NOW - v.chk > 48 * 36e5;
    return F.num(v.views) + ' (contagem de ' + (velha ? F.data(v.chk, true) : F.dataHora(v.chk)) + ')';
  }
  function detalhe(v){
    var l = v.likes == null ? 'não medido (o YouTube não devolveu a contagem)' : F.num(v.likes);
    var c = v.comments == null ? 'não medido (o YouTube não devolveu a contagem)' : F.num(v.comments);
    return '<span><b>Views:</b> ' + esc(viewsTexto(v)) + '</span>' + (OWN ? '<span><b>Impressões:</b> ' + esc(impTexto(v)) + '</span>' : '') + '<span><b>Views/dia:</b> ' + esc(vpdTexto(v)) + '</span><span><b>Múltiplo:</b> ' + esc(multTexto(v)) + '</span>' +
      '<span><b>Curtidas:</b> ' + l + '</span><span><b>Comentários:</b> ' + c + '</span>' +
      (v.pinned && !v.serie && !v.pinAntigo ? '<span><b>Fixado:</b> aguardando a primeira sincronização.</span>' : '') +
      (v.pinned && v.pinAt && v.pinAntigo ? '<span><b>Fixado</b> em ' + F.data(v.pinAt) + '.</span>' : '');
  }

  /* ---------------------------------------------------------------- link para o vídeo (leva a vizinhança filtrada e ordenada) */
  var ordemAtual = [];
  function hrefVideo(v){
    if (OWN) return 'video-proprio.html?id=' + encodeURIComponent(v.id) + '&back=' + encodeURIComponent(query());   /* rodada 7: o histórico mínimo do vídeo próprio */
    var i = ordemAtual.indexOf(v.id), tot = ordemAtual.length, a = Math.max(0, Math.min(i - 50, tot - 100));
    var p = new URLSearchParams();
    p.set('id', v.id); p.set('from', 'canais'); p.set('canal', C.canal.id); p.set('back', query());
    p.set('ids', ordemAtual.slice(a, a + 100).join(',')); p.set('i0', a); p.set('tot', tot);
    return 'video.html?' + p.toString();
  }

  /* ---------------------------------------------------------------- cartão (Capas) */
  function selos(v){
    var tl = (v.pinned ? '<span class="seal">' + I.pin + 'fixado</span>' : '') + (v.pub == null ? '<span class="seal">sem data</span>' : '');
    var br = v.fmt === 'nc' ? '<span class="seal br">formato não confirmado</span>' : v.fmt === 'short' ? '<span class="seal br">Short</span>'
      : v.dur != null ? '<span class="seal br num">' + F.dur(v.dur) + '</span>' : '<span class="seal br">sem duração</span>';
    return (tl ? '<span class="seals-tl">' + tl + '</span>' : '') + (v.trocas ? '<span class="seal bl">' + F.plural(v.trocas, 'troca', 'trocas') + '</span>' : '') + br;
  }
  function quando(v){
    return v.pub == null ? '<span class="nodate">sem data de publicação</span>' : '<time datetime="' + F.iso(v.pub) + '">' + F.ha(v.pub) + '<span class="sr"> (' + F.data(v.pub, true) + ')</span></time>';
  }
  function cel(valor, rotulo, on, tier, sr){
    return '<span class="c' + (on ? ' on' : '') + '"><b' + (tier ? ' class="t-' + tier + '"' : '') + '>' + valor + '</b> <i' + (tier ? ' class="t-' + tier + '"' : '') + '>' + rotulo + '</i>' + (sr ? '<span class="sr">' + sr + '</span>' : '') + '</span>';
  }
  function nd(rotulo){ return '<span class="c nd"><span class="sr">' + rotulo + ': </span><b>não medido</b> <i aria-hidden="true">' + rotulo + '</i></span>'; }
  function nums(v){
    if (OWN) return cel(F.num(v.views), 'views', st.sort === 'vistos') + cel(F.num(v.imp), v.imp === 1 ? 'impressão' : 'impressões', st.sort === 'imp') +
      (v.mult != null ? cel(F.mult(v.mult), v.nivel || 'múltiplo', st.sort === 'multiplo', v.tier, v.nivel ? ' (múltiplo)' : '') : nd('múltiplo'));
    if (v.views == null) return '<span class="c s3 txt">sem contagem: ' + esc(v.viewsMotivo) + '</span>';
    var c1 = cel(F.num(v.views), 'views', st.sort === 'vistos');
    if (v.pinAntigo) return c1 + '<span class="c s2 txt">fixado antigo: sem views/dia nem múltiplo</span>';
    if (v.vpd == null && v.mult == null) return c1 + '<span class="c s2 txt">views/dia e múltiplo: não medido</span>';
    var c2 = v.vpd != null ? cel(F.taxa(v.vpd), 'views/dia', st.sort === 'vpd') : nd('views/dia');
    var c3 = v.mult != null ? cel(F.mult(v.mult), v.nivel || 'múltiplo', st.sort === 'multiplo', v.tier, v.nivel ? ' (múltiplo)' : '') : nd('múltiplo');
    return c1 + c2 + c3;
  }
  function botaoAcoes(v){
    return '<button type="button" class="abtn" data-acts="' + v.id + '" aria-haspopup="menu" aria-expanded="false" aria-label="Ações do vídeo: ' + esc(v.t) + '">' + I.dots + '</button>';
  }
  function card(v){
    return '<li class="card" data-id="' + v.id + '">' +
      '<a class="lnk" id="v-' + v.id + '" href="' + esc(hrefVideo(v)) + '" ' + (OWN ? 'data-own' : 'data-go') + '="' + v.id + '">' +
        '<span class="thumb"><img src="' + v.thumb + '" alt="" width="320" height="180" loading="lazy" decoding="async">' + selos(v) + '</span>' +
        '<span class="ttl">' + esc(v.t) + '</span></a>' +
      '<button type="button" class="amp" tabindex="-1" data-amp="' + v.id + ':" aria-label="Ampliar a thumbnail: ' + esc(v.t) + '">' + window.VIEWER_ICON + '</button>' +
      '<div class="meta">' + quando(v) + botaoAcoes(v) + '</div>' +
      '<p class="nums">' + nums(v) + '</p>' + (OWN ? '<p class="n3">' + linha3(v) + '</p>' : '') + '</li>';
  }
  function cardSk(){
    return '<li class="card sk"><span class="thumb"></span><span class="ttl"><span class="bone"></span><span class="bone"></span></span>' +
      '<div class="meta"><span class="bone"></span></div><p class="nums"><span class="c"><span class="bone"></span></span><span class="c"><span class="bone"></span></span><span class="c"><span class="bone"></span></span></p>' + (OWN ? '<p class="n3"><span class="bone"></span></p>' : '') + '</li>';
  }

  /* ---------------------------------------------------------------- linha (Lista) */
  var COLS = OWN ? [['recentes', 'Publicado'], ['vistos', 'Views'], ['imp', 'Impressões'], ['multiplo', 'Múltiplo']] : [['recentes', 'Publicado'], ['vistos', 'Views'], ['vpd', 'Views/dia'], ['multiplo', 'Múltiplo']];
  function thead(){
    var h = '<thead><tr><th scope="col">Vídeo</th>';
    COLS.forEach(function(c){
      var on = st.sort === c[0];
      h += '<th scope="col" class="r"' + (on ? ' aria-sort="' + (st.dir === 'asc' ? 'ascending' : 'descending') + '"' : '') + '><button type="button" data-sortcol="' + c[0] + '">' + c[1] + (on ? (st.dir === 'asc' ? I.up : I.down) : '') + '</button></th>';
    });
    return h + '<th scope="col" class="r">Curtidas</th><th scope="col" class="r">Comentários</th><th scope="col" class="r">' + (OWN ? 'Cliques' : 'Trocas') + '</th><th scope="col"><span class="sr">Ações</span></th></tr></thead>';
  }
  function td(rot, html, on, extra){ return '<td class="r num' + (on ? ' on' : '') + (extra || '') + '"><span class="lbl">' + rot + ': </span>' + html + '</td>'; }
  function ndl(t){ return '<span class="nd">' + t + '</span>'; }
  function linha(v){
    var marc = [];
    if (v.pinned) marc.push(v.pinAntigo ? 'fixado antigo' : 'fixado');
    if (v.fmt === 'nc') marc.push('formato não confirmado');
    if (v.fmt !== 'short' && v.fmt !== 'nc' && v.dur == null) marc.push('sem duração');
    var selo = v.fmt === 'short' ? '<span class="seal br">Short</span>' : v.dur != null ? '<span class="seal br num">' + F.dur(v.dur) + '</span>' : '';
    var views = v.views == null ? ndl('sem contagem: ' + esc(v.viewsMotivo)) : F.num(v.views);
    var vpd = v.vpd != null ? F.taxa(v.vpd) : ndl(v.views == null ? 'sem contagem' : v.pinAntigo ? 'fixado antigo' : 'não medido');
    var mu = v.mult != null ? '<span' + (v.tier ? ' class="t-' + v.tier + '"' : '') + '>' + F.mult(v.mult) + (v.nivel ? ' <span class="lv">' + v.nivel + '</span>' : '') + '</span>' : ndl(v.views == null ? 'sem contagem' : v.pinAntigo ? 'fixado antigo' : 'não medido');
    return '<tr class="row" data-id="' + v.id + '"><td class="v"><a class="lnk" id="v-' + v.id + '" href="' + esc(hrefVideo(v)) + '" ' + (OWN ? 'data-own' : 'data-go') + '="' + v.id + '">' +
      '<span class="thumb"><img src="' + v.thumb + '" alt="" width="320" height="180" loading="lazy" decoding="async">' + selo + '</span>' +
      '<span><span class="ttl">' + esc(v.t) + '</span>' + (marc.length ? '<span class="tags">' + marc.join(', ') + '</span>' : '') + '</span></a></td>' +
      '<td class="r' + (st.sort === 'recentes' ? ' on' : '') + '"><span class="lbl">Publicado: </span>' + (v.pub == null ? ndl('sem data') : '<time datetime="' + F.iso(v.pub) + '">' + F.ha(v.pub) + '</time>') + '</td>' +
      td('Views', views, st.sort === 'vistos') + (OWN ? td('Impressões', F.num(v.imp), st.sort === 'imp') : td('Views/dia', vpd, st.sort === 'vpd')) + td('Múltiplo', mu, st.sort === 'multiplo') +
      td('Curtidas', v.likes == null ? ndl('não medido') : F.num(v.likes)) + td('Comentários', v.comments == null ? ndl('não medido') : F.num(v.comments)) +
      (OWN ? td('Cliques', v.imp >= MIN_IMP || (st.cliques === 'sempre' && v.imp) ? String(v.cliques) : ndl(v.imp ? 'poucas impressões' : 'sem impressão')) : td('Trocas', String(v.trocas))) + '<td class="a">' + botaoAcoes(v) + '</td></tr>';
  }
  function linhaSk(){
    var c = '<td class="r"><span class="bone"></span></td>';
    return '<tr class="row sk"><td class="v"><span class="lnk"><span class="thumb"></span><span class="bone" style="width:60%;height:12px"></span></span></td>' + c + c + c + c + c + c + c + '<td class="a"></td></tr>';
  }

  /* ---------------------------------------------------------------- miolo da aba Vídeos */
  var carregando = false, esqueleto = false, primeiroNovo = null;
  function antigo(v){ if (OWN) return false; return !v.serie && !v.viewsMotivo && !v.pinAntigo; }   /* fora dos acompanhados e não fixado: só com "Carregar mais" */
  function miolo(){
    var m = $('miolo'), total = ds().vids.length;
    $('ctl').hidden = total === 0; $('skip').hidden = total === 0 || st.estado === 'erro';
    m.removeAttribute('aria-busy');
    if (st.estado === 'erro' && !carregando){
      m.innerHTML = '<div class="empty" role="alert"><p><b>Os vídeos não carregaram.</b> Os números do cabeçalho são de ' + F.dataHora(syncMs()) + '.</p><button type="button" class="btn" data-retry>Tentar de novo</button></div>';
      ordemAtual = []; return { n: 0 };
    }
    if (esqueleto){
      m.setAttribute('aria-busy', 'true');
      var sk = '<p class="sr">Carregando…</p>';
      if (st.ver === 'lista'){ sk += '<div class="tw" aria-hidden="true"><table class="lst">' + thead().replace(/<button/g, '<button tabindex="-1" disabled') + '<tbody>' + new Array(13).join(linhaSk()) + '</tbody></table></div>'; }
      else sk += '<ul class="grid" aria-hidden="true">' + new Array(16).join(cardSk()) + '</ul>';
      m.innerHTML = sk; return { n: 0 };
    }
    if (carregando) return { n: 0 };   /* até 100 ms: nada muda na tela */
    if (total === 0){
      m.innerHTML = '<div class="empty"><p>Este canal ainda não tem vídeos sincronizados.</p><button type="button" class="btn primary" data-sync>Sincronizar só este canal</button></div>';
      ordemAtual = []; return { n: 0 };
    }
    var lista = filtrar(st.fmt, st.q);
    if (!lista.length){ ordemAtual = []; m.innerHTML = vazio(); return { n: 0 }; }
    /* rodada 3: primeiro os acompanhados (e o fixado antigo); os antigos sem contagem diária só entram com "Carregar mais" */
    var rec = lista.filter(function(v){ return !antigo(v); }), velhos = lista.filter(antigo), g = grupos(rec), html = '';
    ordemAtual = [];
    var seg = (st.ver === 'lista') ? function(x, ver){ return '<tbody>' + (x.k !== 'main' ? '<tr class="grp"><th scope="rowgroup" colspan="9">' + x.titulo + ' (' + x.itens.length + ')<small>' + x.nota + '</small></th></tr>' : '') + ver.map(linha).join('') + '</tbody>'; }
      : function(x, ver){ return (x.k !== 'main' ? '<li class="div" role="presentation"><span>' + x.titulo + ' (' + x.itens.length + ')</span><small>' + x.nota + '</small></li>' : '') + ver.map(card).join(''); };
    g.forEach(function(x){ if (!x.itens.length) return; x.itens.forEach(function(v){ ordemAtual.push(v.id); }); html += seg(x, x.itens); });
    var carregados = 0;
    if (velhos.length && st.n > 0){
      var gv = grupos(velhos), todos = []; gv.forEach(function(x){ x.itens.forEach(function(v){ todos.push(v); }); });
      var ver = todos.slice(0, st.n); carregados = ver.length;
      ver.forEach(function(v){ ordemAtual.push(v.id); });
      html += seg({ k: 'velhos', titulo: 'Mais antigos, sem contagem diária', nota: 'a contagem de views deles é antiga (de junho a agosto); não há views por dia, e o múltiplo é o de quando foram contados', itens: velhos }, ver);
    }
    var falta = velhos.length - carregados;
    var sobra = (!rec.length && st.n === 0 && velhos.length) ? '<p class="m" style="margin:0 0 10px;color:var(--muted);font-size:13px">Nenhum dos vídeos acompanhados' + (st.q.trim() ? ' tem “' + esc(st.q.trim()) + '”' : ' está neste filtro') + '. Há ' + F.plural(velhos.length, 'vídeo antigo', 'vídeos antigos') + ', sem contagem diária.</p>' : '';
    var naTela = rec.length + carregados, prox = Math.min(LOTE, falta);
    var mais = falta > 0 ? '<div class="more" role="group" aria-label="Carregar mais vídeos">' +
      '<div class="more-bar" role="progressbar" aria-label="Vídeos na tela" aria-valuemin="0" aria-valuemax="' + lista.length + '" aria-valuenow="' + naTela + '"><i style="width:' + Math.round(naTela / lista.length * 100) + '%"></i></div>' +
      '<p class="more-t"><b>Mostrando ' + naTela + ' de ' + lista.length + ' vídeos</b></p>' +
      '<p class="more-s">' + (prox === falta ? 'Mais ' + F.plural(prox, 'vídeo antigo', 'vídeos antigos') + ', sem contagem diária. Depois deste lote não falta nenhum.' : 'Mais ' + prox + ' vídeos antigos, sem contagem diária. Depois deste lote faltam ' + (falta - prox) + '.') + '</p>' +
      '<button type="button" class="btn primary big" data-more>' + (prox === falta ? 'Carregar ' + (prox === 1 ? 'o último vídeo' : 'os últimos ' + prox + ' vídeos') : 'Carregar mais ' + prox + ' vídeos') + '</button></div>' : '';
    var b = ds().base, pe = '<p class="foot" id="foot"><b>Múltiplo</b> = views do vídeo ÷ mediana de views dos outros vídeos do mesmo formato e da mesma faixa de idade neste canal (o mesmo número da tela de histórico do vídeo; mediana geral: longos ' + F.num((ds().base.long || {}).med) + ', Shorts ' + F.num((ds().base.short || {}).med) + ')' +
      '. De 2× a 5×, “alto”; de 5× a 10×, “muito alto”; 10× ou mais, “topo”. <b>Views/dia</b> = média entre a primeira e a última contagem diária dos últimos 7 dias; a contagem diária existe desde 03/10 e só para os ' + C.canal.limite + ' vídeos acompanhados. O motivo de cada “não medido” está em “Ações do vídeo”.</p>';
    if (OWN) pe = '<p class="foot" id="foot"><b>Múltiplo</b> = views do vídeo ÷ mediana de views dos outros vídeos do seu canal na mesma faixa de idade (mediana geral: ' + F.num((ds().base.long || {}).med) + ' views). De 2× a 5×, “alto”; de 5× a 10×, “muito alto”; 10× ou mais, “topo”. ' +
      '<b>Impressões</b> = vezes em que a miniatura apareceu no YouTube, somadas de ' + PERIODO + ' (' + (C.reach.diasCom + C.reach.diasVazios) + ' relatórios lidos; ' + (C.reach.diasPeriodo - C.reach.diasCom - C.reach.diasVazios) + ' dias ainda sem relatório baixado). <b>Cliques</b> = impressões × CTR de cada dia, somados e arredondados' + (st.cliques === 'sempre' ? '; sempre em contagem, nunca em percentual. ' : '; aparecem só com ' + MIN_IMP + ' impressões ou mais. ') +
      '<b>Views por dia</b> de cada vídeo ainda não existem: a coleta diária começa em breve. O detalhe de cada vídeo está em “Ações do vídeo”.</p>';
    m.innerHTML = sobra + (st.ver === 'lista' ? '<div class="tw"><table class="lst" aria-describedby="foot"><caption class="sr">Vídeos de ' + esc(C.canal.nome) + '</caption>' + thead() + html + '</table></div>' : '<ul class="grid" aria-label="Vídeos de ' + esc(C.canal.nome) + '">' + html + '</ul>') + mais + pe;
    return { n: lista.length };
  }
  function vazio(){
    var q = st.q.trim();
    if (q){
      var emTodos = st.fmt !== 'todos' ? filtrar('todos', q).length : 0;
      return '<div class="empty"><p>Nenhum vídeo com “' + esc(q) + '”' + (st.fmt !== 'todos' ? ' em ' + FMT_NOME[st.fmt] : '') + '.</p>' +
        (emTodos ? '<p class="m">Em Todos, ' + (emTodos === 1 ? 'há 1 vídeo' : 'há ' + emTodos + ' vídeos') + ' com esse texto.</p>' : '') +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn" data-clearq>Limpar busca</button>' + (emTodos ? '<button type="button" class="btn" data-fmt="todos">Buscar em Todos</button>' : '') + '</div></div>';
    }
    var t = st.fmt === 'shorts' ? (OWN ? 'Seu canal não tem Shorts. Os 35 vídeos são longos.' : 'Nenhum Short neste canal.') : st.fmt === 'fixados' ? 'Nenhum vídeo fixado. Fixe um vídeo para acompanhá-lo mesmo quando sair dos mais recentes.' : st.fmt === 'longos' ? 'Nenhum vídeo longo neste canal.' : 'Este canal ainda não tem vídeos sincronizados.';
    return '<div class="empty"><p>' + t + '</p></div>';
  }

  /* ---------------------------------------------------------------- cabeçalho, abas, controles, faixas */
  /* ---------------------------------------------------------------- rodada 5: a faixa de números do cabeçalho.
     Cada célula: v = valor (ou null), n = "n = 2" ao lado do valor quando a base é fraca, f = frase curta quando não há valor
     (nunca zero nem traço sozinho), l = rótulo, b = a base do número (vai no ⓘ). A origem de cada um, com arquivo e linha, está no LEIAME. */
  var DIA = 864e5, SEM13 = 13, FRACA = 3;   /* RULES.habit.weeks e RULES.weakBase de produção (rules.ts) */
  function med(a){ if (!a.length) return null; var x = a.slice().sort(function(p, q){ return p - q; }), m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; }
  function pct1(x){ return F.dec(x * 100, 1) + '%'; }
  function fraca(n){ return n > 0 && n < FRACA ? 'n = ' + n : ''; }
  function idade(v){ return v.pub == null ? null : (C.NOW - v.pub) / DIA; }
  function engaj(V, fmt, dias){
    var a = V.filter(function(v){ return v.fmt === fmt && v.views != null && v.views > 0 && v.likes != null && (dias == null || (v.serie && idade(v) != null && idade(v) <= dias)); })
      .map(function(v){ return (v.likes + (v.comments || 0)) / v.views; });
    return { m: med(a), n: a.length };
  }
  function habito(vs){
    var pares = {}, DS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    vs.forEach(function(v){ var d = new Date(v.pub - 3 * 36e5), k = d.getUTCDay() + '|' + d.getUTCHours(); pares[k] = (pares[k] || 0) + 1; });
    var best = Object.keys(pares).sort(function(a, b){ return pares[b] - pares[a]; })[0];
    if (best && pares[best] >= 3 && pares[best] / vs.length >= 0.3){ var x = best.split('|'); return { v: DS[+x[0]] + ', ' + x[1] + ' h', b: pares[best] + ' de ' + vs.length + ' longos das últimas 13 semanas saíram nesse dia e hora.' }; }
    return { v: null, f: vs.length ? 'horário variado (' + F.plural(vs.length, 'longo', 'longos') + ')' : 'nenhum longo em 13 semanas', b: 'Só diz “costuma publicar” com 3 vídeos ou mais no mesmo dia e hora, e 30% ou mais dos longos de 13 semanas.' };
  }
  function numerosConcorrente(){
    var c = C.canal, h = C.cabecalho, V = ds().vids, de = C.NOW - SEM13 * 7 * DIA;
    var rec = V.filter(function(v){ return v.pub != null && v.pub > de; }), lg = rec.filter(function(v){ return v.fmt === 'long'; }), sh = rec.filter(function(v){ return v.fmt === 'short'; });
    var vpd = function(f){ var a = V.filter(function(v){ return v.fmt === f && v.vpd != null; }).map(function(v){ return v.vpd; }); return { m: med(a), n: a.length }; };
    var vL = vpd('long'), vS = vpd('short'), eL = engaj(V, 'long', 90), eS = engaj(V, 'short', 90);
    var m90 = V.filter(function(v){ return v.serie && v.mult != null && idade(v) != null && idade(v) <= 90; }), o90 = m90.filter(function(v){ return v.mult >= 2; });
    var top = m90.slice().sort(function(a, b){ return b.mult - a.mult; })[0], tip = med(m90.map(function(v){ return v.mult; }));
    var abs = h.inscritosAntes != null ? c.inscritos - h.inscritosAntes : null, un = c.inscritos < 1000 ? 1 : Math.pow(10, Math.floor(Math.log10(c.inscritos)) - 2);
    var ult = V.filter(function(v){ return v.pub != null; }).sort(function(a, b){ return b.pub - a.pub; })[0];
    var durs = V.filter(function(v){ return v.fmt === 'long' && v.dur != null; }).map(function(v){ return v.dur; });
    var acomp = V.filter(function(v){ return v.serie; }), soma = acomp.reduce(function(a, v){ return a + (v.views || 0); }, 0), B = ds().base, hb = habito(lg);
    var r1 = [
      { v: F.num(c.inscritos), l: 'inscritos', b: 'Contagem pública do YouTube, que arredonda a 3 algarismos (aqui, de 10 em 10).' },
      abs == null ? { f: 'sem contagem de 30 dias atrás', l: 'inscritos em 30 dias', b: 'Precisa de duas contagens com 30 dias entre elas.' }
        : { v: Math.abs(abs) <= un ? '≈ 0' : (abs > 0 ? '+' : '−') + F.dec(Math.abs(h.cresc30), 1) + '%', l: 'inscritos em 30 dias', b: 'De ' + h.inscritosAntes.toLocaleString('pt-BR') + ' em 07/09 para ' + c.inscritos.toLocaleString('pt-BR') + ' em 07/10 (' + (abs > 0 ? '+' : '') + abs + ', com ±' + un + ' de arredondamento do YouTube).' },
      { v: F.dec(Math.round(lg.length / SEM13 * 10) / 10, 1) + ' + ' + F.dec(Math.round(sh.length / SEM13 * 10) / 10, 1), l: 'longos + Shorts por semana', b: F.plural(lg.length, 'longo', 'longos') + ' e ' + F.plural(sh.length, 'Short', 'Shorts') + ' publicados nas últimas 13 semanas, divididos por 13.' },
      vL.m == null ? { f: 'sem contagem diária ainda', l: 'views/dia nos longos', b: 'Nenhum longo com dois registros diários.' }
        : { v: F.taxa(vL.m), n: fraca(vL.n), l: 'views/dia nos longos', b: 'Mediana das views ganhas por dia em ' + F.plural(vL.n, 'longo', 'longos') + ' com contagem diária, desde 03/10.' },
      eL.m == null ? { f: 'nenhum longo em 90 dias', l: 'engajamento nos longos', b: '(curtidas + comentários) ÷ views, por longo acompanhado de até 90 dias.' }
        : { v: pct1(eL.m), n: fraca(eL.n), l: 'engajamento nos longos', b: '(curtidas + comentários) ÷ views, mediana de ' + F.plural(eL.n, 'longo acompanhado', 'longos acompanhados') + ' de até 90 dias.' + (eL.n < FRACA ? ' Base fraca: menos de 3 vídeos.' : '') },
      !m90.length ? { f: 'nenhum vídeo com múltiplo em 90 dias', l: 'acima de 2× em 90 dias', b: 'Conta os vídeos acompanhados de até 90 dias com múltiplo de 2× ou mais.' }
        : { v: String(o90.length), l: 'acima de 2× em 90 dias', b: o90.length + ' de ' + m90.length + ': ' + F.plural(o90.length, 'vídeo', 'vídeos') + ' com 2× ou mais entre os ' + m90.length + ' acompanhados de até 90 dias que têm múltiplo (' + o90.filter(function(v){ return v.fmt === 'long'; }).length + ' longos, ' + o90.filter(function(v){ return v.fmt === 'short'; }).length + ' Shorts).' }
    ];
    var r2 = [
      { v: String(C.trocas.length), l: 'trocas em 30 dias', b: 'Trocas de título e de thumbnail vistas nos últimos 30 dias. Neste mockup as 7 são fabricadas (o canal real não tem nenhuma).' },
      vL.m == null || !c.inscritos ? { f: 'sem contagem diária ainda', l: 'views/dia por mil inscritos', b: 'Views/dia nos longos ÷ (inscritos ÷ 1.000).' }
        : { v: F.dec(vL.m / (c.inscritos / 1000), 1), l: 'views/dia por mil inscritos', b: 'Views/dia nos longos (' + F.taxa(vL.m) + ') ÷ ' + F.dec(c.inscritos / 1000, 2) + ' mil inscritos.' },
      vS.m == null ? { f: 'sem contagem diária ainda', l: 'views/dia nos Shorts', b: 'Nenhum Short com dois registros diários.' }
        : { v: F.taxa(vS.m), n: fraca(vS.n), l: 'views/dia nos Shorts', b: 'Mediana em ' + F.plural(vS.n, 'Short', 'Shorts') + ' com contagem diária, desde 03/10. Zero medido: a maioria não ganhou views nesses dias.' },
      eS.m == null ? { f: 'nenhum Short em 90 dias', l: 'engajamento nos Shorts', b: '(curtidas + comentários) ÷ views, por Short acompanhado de até 90 dias.' }
        : { v: pct1(eS.m), n: fraca(eS.n), l: 'engajamento nos Shorts', b: 'Mediana de ' + F.plural(eS.n, 'Short acompanhado', 'Shorts acompanhados') + ' de até 90 dias.' + (eS.n < FRACA ? ' Base fraca: menos de 3 vídeos.' : '') },
      tip == null ? { f: 'nenhum vídeo com múltiplo em 90 dias', l: 'múltiplo típico em 90 dias', b: 'Mediana dos múltiplos dos vídeos de até 90 dias.' }
        : { v: F.mult(tip), n: fraca(m90.length), l: 'múltiplo típico em 90 dias', b: 'Mediana dos múltiplos de ' + F.plural(m90.length, 'vídeo acompanhado', 'vídeos acompanhados') + ' de até 90 dias.' },
      !top ? { f: 'nenhum vídeo com múltiplo em 90 dias', l: 'maior múltiplo em 90 dias', b: 'O maior múltiplo entre os vídeos de até 90 dias.' }
        : { v: F.mult(top.mult), l: 'maior múltiplo em 90 dias', b: '“' + top.t + '”, ' + F.num(top.views) + ' views.' },
      !ult ? { f: 'sem vídeo com data', l: 'desde o último vídeo', b: '' } : { v: F.plural(Math.floor(idade(ult)), 'dia', 'dias'), l: 'desde o último vídeo', b: 'Publicado em ' + F.data(ult.pub, true) + ': “' + ult.t + '”.' },
      { v: hb.v, f: hb.f, l: 'dia e hora em que mais publica', b: hb.b },
      durs.length < C.REGRA.minBase ? { f: 'poucos longos: ' + durs.length + '; precisa de ' + C.REGRA.minBase, l: 'duração mediana dos longos', b: '' }
        : { v: F.dur(Math.round(med(durs))), l: 'duração mediana dos longos', b: 'Mediana de ' + durs.length + ' longos com duração conhecida.' },
      { v: F.num(soma), l: 'views somadas dos ' + acomp.length + ' acompanhados', b: 'Soma da última contagem de views dos ' + acomp.length + ' vídeos com contagem diária.' },
      { v: F.num((B.long || {}).med) + ' e ' + F.num((B.short || {}).med), l: 'mediana de views, longos e Shorts', b: 'Mediana em ' + (B.long || {}).n + ' longos e ' + (B.short || {}).n + ' Shorts. É a base do múltiplo geral.' },
      { f: 'sem tema ainda', l: 'tema dominante', b: 'A forja ainda não classificou os vídeos deste canal por tema. '+'Aparece quando um tema tem 3 vídeos ou mais e 40% ou mais dos vídeos com tema.' }
    ];
    return { r1: r1, r2: r2 };
  }
  function numerosProprio(){
    var V = ds().vids, R = C.reach, soma = V.reduce(function(a, v){ return a + (v.views || 0); }, 0), lidos = R.diasCom + R.diasVazios;
    var ult = V.filter(function(v){ return v.pub != null; }).sort(function(a, b){ return b.pub - a.pub; })[0], top = V.slice().sort(function(a, b){ return (b.views || 0) - (a.views || 0); })[0];
    var e90 = engaj(V.map(function(v){ return Object.assign({}, v, { serie: 1 }); }), 'long', 90), eT = engaj(V, 'long', null);
    var durs = V.filter(function(v){ return v.dur != null; }).map(function(v){ return v.dur; }), nS = V.filter(function(v){ return v.fmt === 'short'; }).length;
    var r1 = [
      { v: '1,16 mil', l: 'inscritos', b: 'Contagem do YouTube lida em 09/10/2026: 1.160 inscritos.' },
      { v: String(V.length), l: nS ? 'vídeos' : 'vídeos, todos longos', b: V.length + ' vídeos guardados, ' + (V.length - nS) + ' longos e ' + nS + ' Shorts.' },
      { v: F.num(soma), l: 'views somadas', b: 'Soma das views dos ' + V.length + ' vídeos, lidas em ' + F.data(R.lidoEm, true) + '.' },
      { v: F.num(R.imp), l: 'impressões de ' + PERIODO, b: 'Vezes em que a miniatura de um vídeo apareceu no YouTube, somadas de ' + PERIODO + ' (' + R.diasPeriodo + ' dias). ' + lidos + ' relatórios lidos; ' + (R.diasPeriodo - lidos) + ' dias ainda sem relatório baixado.' },
      { v: R.diasCom + ' de ' + lidos, l: 'dias com impressão', b: 'Dos ' + lidos + ' relatórios diários lidos, ' + R.diasCom + ' trouxeram impressões e ' + R.diasVazios + ' vieram vazios.' },
      !ult ? { f: 'sem vídeo com data', l: 'desde o último vídeo', b: '' } : { v: F.plural(Math.floor(idade(ult)), 'dia', 'dias'), l: 'desde o último vídeo', b: 'Publicado em ' + F.data(ult.pub, true) + ': “' + ult.t + '”.' }
    ];
    var r2 = [
      { v: String(R.cliques), l: 'cliques estimados no período', b: 'Impressões × CTR de cada dia e vídeo, somados. ' + R.imp + ' impressões e ' + F.plural(R.cliques, 'clique', 'cliques') + ' em ' + R.diasPeriodo + ' dias: pouco demais para falar em percentual.' },
      { v: R.videosCom + ' de ' + V.length, l: 'vídeos com alguma impressão', b: 'Vídeos que apareceram ao menos uma vez nos relatórios lidos.' },
      { v: F.num((ds().base.long || {}).med), l: 'mediana de views por vídeo', b: 'Mediana das views dos ' + V.length + ' vídeos. É a base do múltiplo geral.' },
      { v: F.num(top.views), l: 'views do vídeo mais visto', b: '“' + top.t + '”.' },
      e90.m == null ? { f: 'nenhum vídeo em 90 dias', l: 'engajamento em 90 dias', b: '(curtidas + comentários) ÷ views, por vídeo de até 90 dias. O último vídeo é de ' + F.data(ult.pub, true) + '.' } : { v: pct1(e90.m), n: fraca(e90.n), l: 'engajamento em 90 dias', b: '' },
      { v: pct1(eT.m), l: 'engajamento, todos os vídeos', b: '(curtidas + comentários) ÷ views, mediana dos ' + eT.n + ' vídeos, sem janela de tempo.' },
      { v: F.dur(Math.round(med(durs))), l: 'duração mediana', b: 'Mediana de ' + durs.length + ' vídeos.' },
      { f: 'parado: nenhum em 13 semanas', l: 'longos + Shorts por semana', b: 'Vídeos publicados nas últimas 13 semanas, divididos por 13.' },
      { f: 'a coleta começa em breve', l: 'views/dia por vídeo', b: 'A coleta diária de views por vídeo do canal próprio ainda não está em produção.' },
      { f: 'ainda não coletada (lote L3)', l: 'retenção e percentual assistido', b: 'Chega com o lote L3 da coleta.' },
      { f: 'sem contagem de 30 dias atrás', l: 'inscritos em 30 dias', b: 'Precisa de duas contagens com 30 dias entre elas; o site ainda não guarda a contagem diária de inscritos do seu canal.' }
    ];
    return { r1: r1, r2: r2 };
  }
  /* ---------------------------------------------------------------- rodada 6: posição do canal próprio no nicho e comparação lado a lado.
     Tudo calculado de canais-dados.js (13 concorrentes reais + o próprio). Posição = 1 + quantos canais têm valor maior; nunca inventada. */
  var NI = window.CANAIS || null;
  function posicao(k){
    var P = NI.proprio, todos = NI.canais.concat([P]).filter(function(c){ return c[k] != null; });
    if (P[k] == null) return null;
    return { pos: 1 + todos.filter(function(c){ return c[k] > P[k]; }).length, de: todos.length, emp: todos.filter(function(c){ return c[k] === P[k] && c !== P; }).map(function(c){ return c.nome; }) };
  }
  function linhaPosicao(){
    if (!OWN || !NI) return '';
    var itens = [['inscritos', 'em inscritos'], ['med', 'em mediana de views'], ['l90', 'em longos em 90 dias']].map(function(x){
      var r = posicao(x[0]);
      return '<a href="canais.html?sort=' + x[0] + '">' + r.pos + 'º ' + x[1] + (x[0] === 'l90' && NI.proprio.l90 === 0 ? ' (nenhum)' : r.emp.length ? ' (empate)' : '') + '</a>';
    });
    var acima = NI.canais.filter(function(c){ return c.med > NI.proprio.med; }).sort(function(a, b){ return a.med - b.med; })[0];
    var ops = NI.canais.slice().sort(function(a, b){ return (a === acima ? -1 : 0) - (b === acima ? -1 : 0) || b.inscritos - a.inscritos; });
    return '<p class="pos">Entre ' + (NI.canais.length + 1) + ' canais de ' + esc(NI.nicho) + ': ' + itens.join(', ') + '. <a href="canais.html?sort=vpm">Views/dia por mil inscritos: ainda não medido</a>.</p>';
  }
  /* rodada 9: o seletor "Comparar com…" agora LEVA à tela comparar.html (formulário GET: um select e um botão, duas paradas de Tab, sem navegar a cada seta). */
  function acimaDeVoce(){ return NI.canais.filter(function(c){ return c.inscritos > NI.proprio.inscritos; }).sort(function(a, b){ return a.inscritos - b.inscritos; })[0] || NI.canais.slice().sort(function(a, b){ return b.inscritos - a.inscritos; })[0]; }
  function seletorComparar(){
    if (!OWN || !NI) return '';
    var acima = acimaDeVoce();
    var ops = NI.canais.slice().sort(function(a, b){ return (a === acima ? -1 : 0) - (b === acima ? -1 : 0) || b.inscritos - a.inscritos; });
    return '<form class="cmpf" action="comparar.html" method="get"><input type="hidden" name="a" value="proprio"><span class="sel cmpsel"><label class="sr" for="cmpSel">Comparar o seu canal com um concorrente</label><select id="cmpSel" name="b">' +
      ops.map(function(c){ return '<option value="' + c.id + '"' + (c === acima ? ' selected' : '') + '>' + esc(c.nome) + (c === acima ? ' (logo acima de você)' : '') + '</option>'; }).join('') +
      '</select>' + I.chev + '</span><button type="submit" class="btn">Comparar</button></form>';
  }
  function comparacao(){ return ''; }
  /* ---------------------------------------------------------------- rodada 7: "Como o canal está" (só no canal próprio).
     Fica ACIMA das abas e é recolhível (lembra o estado em localStorage e na URL, ?painel=0): assim a grade de capas continua na
     primeira dobra. O que é característico aqui é o gráfico dos três estados (impressoes.js); o resto é texto quieto. */
  function painel(){
    var el = $('painel'); if (!el) return;
    if (!OWN || st.estado === 'backfill' || st.estado === 'vazio'){ el.hidden = true; el.innerHTML = ''; return; }
    var IM = window.IMPRESSOES, S = IM.serie(null), R = IM.resumo(S), aberto = st.painel === '1', p1 = posicao('inscritos');
    var top5 = C.videos.slice().filter(function(v){ return v.imp > 0; }).sort(function(a, b){ return b.imp - a.imp || b.cliques - a.cliques; }).slice(0, 5);
    el.hidden = false;
    el.innerHTML = '<div class="pn-h"><h2 id="pnH"><button type="button" id="pnBtn" aria-expanded="' + aberto + '" aria-controls="pnB">Como o canal está' + I.chev + '</button></h2>' +
      '<p class="pn-r">' + F.plural(R.imp, 'impressão', 'impressões') + ' e ' + F.plural(R.cl, 'clique estimado', 'cliques estimados') + ' em ' + R.dias + ' dias. ' + p1.pos + 'º de ' + p1.de + ' canais de ' + esc(NI.nicho) + ' em inscritos.</p></div>' +
      '<div class="pn-b" id="pnB"' + (aberto ? '' : ' hidden') + '>' +
      '<p class="pn-lead">Com ' + R.imp + ' impressões em ' + R.dias + ' dias, ainda é pouco para dizer qual vídeo ou qual capa funciona melhor. O que já dá para ver é em que dias o canal apareceu, e em quais não há dado.</p>' +
      '<div class="pn-g"><div class="pn-c"><h3>Impressões por dia, de ' + PERIODO + '</h3><div id="pnChart"></div></div>' +
      '<div class="pn-s"><h3>Vídeos que mais apareceram</h3><ol class="pn-top">' + top5.map(function(v){
        return '<li><a href="' + esc(hrefVideo(v)) + '"><img src="' + v.thumb + '" alt="" width="64" height="36" loading="lazy"><span><b>' + esc(v.t) + '</b><small>' + F.plural(v.imp, 'impressão', 'impressões') + ', ' + (v.cliques ? F.plural(v.cliques, 'clique', 'cliques') : 'nenhum clique') + ' em ' + F.plural(v.impDias, 'dia', 'dias') + '</small></span></a></li>';
      }).join('') + '</ol></div></div>' +
      '<div class="pn-g two"><div><h3>No nicho</h3>' + linhaPosicao() + '<p class="pn-cmp">' + seletorComparar() + '<a class="lk" href="canais.html">Ver a lista de Canais</a></p></div>' +
      '<div><h3>O que ainda não é medido</h3><dl class="pn-nm">' +
        '<div><dt>Views por dia de cada vídeo</dt><dd>a coleta diária entra nos próximos dias. Até lá a tela tem só o total de views.</dd></div>' +
        '<div><dt>Percentual assistido e retenção</dt><dd>chegam no lote seguinte da coleta.</dd></div>' +
        '<div><dt>Origem do tráfego</dt><dd>o relatório já é baixado todo dia, mas esta tela ainda não o lê.</dd></div></dl></div></div>' +
      comparacao() + '</div>';
    if (aberto) IM.render($('pnChart'), S, { titulo: 'Impressões por dia do canal', ph: 180 });
  }
  var NUMS = null, SLUG = F.semAcento(C.canal.nome).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function celula(x){
    return '<div class="nc"><dt>' + esc(x.l) + '</dt>' + (x.v != null ? '<dd><b class="num">' + esc(x.v) + '</b>' + (x.n ? ' <small class="num">' + x.n + '</small>' : '') + '</dd>' : '<dd class="nf">' + esc(x.f) + '</dd>') + '</div>';
  }
  function cabecalho(){
    var c = C.canal, V = ds().vids, sm = syncMs(), semNum = st.estado === 'backfill' || st.estado === 'vazio';
    var acomp = V.filter(function(v){ return v.serie || v.viewsMotivo; }).length, antigos = V.filter(function(v){ return v.pinAntigo; }).length, fora = V.length - acomp - antigos;
    NUMS = semNum ? null : OWN ? numerosProprio() : numerosConcorrente();
    var aberto = st.nums === '1' && !!NUMS;
    var faixaN = NUMS
      ? '<div class="nrow"><div class="nclip"><dl class="nstrip" aria-label="Números do canal">' + NUMS.r1.map(celula).join('') + '</dl></div></div>'
      : '<p class="l2">' + (c.inscritos != null ? '<span><b class="num">' + F.num(c.inscritos) + '</b> inscritos.</span> ' : '') + '<span>Os outros números do canal aparecem quando a primeira sincronização terminar.</span></p>';
    var l3, cls = '';
    if (st.estado === 'backfill') l3 = 'Primeira sincronização em andamento: 12 de 48 vídeos.';
    else if (st.estado === 'vazio') l3 = 'Ainda sem sincronização, nenhum vídeo.';
    else if (OWN && st.estado !== 'atrasada') l3 = '<span>Dados lidos em <time datetime="' + F.iso(sm) + '">' + F.data(sm, true) + '</time>. ' + V.length + ' vídeos, todos longos. Impressões de ' + PERIODO + ': ' + (C.reach.diasCom + C.reach.diasVazios) + ' relatórios lidos, ' + (C.reach.diasPeriodo - C.reach.diasCom - C.reach.diasVazios) + ' dias ainda sem relatório baixado.</span>';
    else {
      if (st.estado === 'atrasada') cls = ' warn';
      l3 = (st.estado === 'atrasada' ? I.warn + '<span>Sincronização atrasada: a última foi ' : '<span>Sincronizado ') + '<time datetime="' + F.iso(sm) + '">' + F.ha(sm) + ' (' + F.dataHora(sm) + ')</time>. ' +
        (OWN ? V.length + ' vídeos, todos longos.' : V.length + ' vídeos: ' + acomp + ' acompanhados' + (antigos ? ', ' + F.plural(antigos, 'fixado antigo', 'fixados antigos') : '') + (fora > 0 ? ', ' + fora + ' mais antigos sem contagem diária' : '') + '.') + '</span>';
    }
    $('chead').innerHTML =
      '<span class="av" aria-hidden="true">' + (c.avatar ? '<img src="' + esc(c.avatar) + '" alt="" width="44" height="44" onerror="this.replaceWith(document.createTextNode(\'' + esc(c.nome.slice(0, 1)) + '\'))">' : esc(c.nome.slice(0, 1).toUpperCase())) + '</span>' +
      '<div class="l1"><h1 tabindex="-1" id="h1">' + esc(c.nome) + '</h1>' +
        (OWN ? '<span class="own-seal">seu canal</span>' : '<span class="niche"><label class="sr" for="nicho">Nicho</label><select id="nicho"><option selected>Viagem</option><option>IA</option></select>' + I.chev + '</span>') +
        (c.handle ? '<a class="lk" href="https://www.youtube.com/' + esc(c.handle) + '" target="_blank" rel="noopener">' + esc(c.handle) + I.ext + '<span class="sr"> (abre em nova aba)</span></a>' : '') + '</div>' +
      '<div class="acts">' + (OWN ? '<a class="btn" href="comparar.html?a=proprio&b=' + acimaDeVoce().id + '" title="Abre a comparação com ' + esc(acimaDeVoce().nome) + ', o concorrente logo acima de você em inscritos">Comparar com…</a>' : '<a class="btn" href="comparar.html?a=proprio&b=' + SLUG + '">Comparar com o meu canal</a>') + '<a class="btn" href="https://www.youtube.com/channel/' + esc(c.ytId) + '" target="_blank" rel="noopener">Abrir no YouTube' + I.ext + '<span class="sr"> (abre em nova aba)</span></a>' +
        '<button type="button" class="btn icon" id="chMenu" aria-haspopup="menu" aria-expanded="false" aria-label="Ações do canal">' + I.dots + '</button></div>' +
      faixaN + '<div class="lrow"><p class="l3' + cls + '">' + l3 + '</p>' +
      (NUMS ? '<div class="ntools"><button type="button" class="ibtn" id="tipBtn" aria-expanded="false" aria-controls="tip" aria-label="De onde vêm os números do canal">' + I.info + '</button>' +
        '<button type="button" class="nmore" id="numsBtn" aria-expanded="' + aberto + '" aria-controls="nums2">Todos os números' + I.chev + '</button></div>' : '') + '</div>' +
      (NUMS ? '<div class="nclip n2" id="nums2"' + (aberto ? '' : ' hidden') + '><dl class="nstrip" aria-label="Mais números do canal">' + NUMS.r2.map(celula).join('') + '</dl></div>' : '');
    $('crumbCanal').textContent = c.nome;
    document.title = c.nome + ' — ' + (OWN ? 'Seu canal' : 'Canal') + ' — Observatório';
  }
  function abas(){
    var nT = st.estado === 'normal' || st.estado === 'atrasada' || st.estado === 'carregando' || st.estado === 'erro' ? C.trocas.length : 0;
    var t = OWN ? [['videos', 'Vídeos', String(ds().vids.length)], ['trocas', 'Trocas', ''], ['leitura', 'Leitura', ''], ['retencao', 'Retenção', '']]
      : [['videos', 'Vídeos', String(ds().vids.length)], ['trocas', 'Trocas', nT + ' em 30 d'], ['leitura', 'Leitura', '']];
    $('ctabs').innerHTML = t.map(function(x){
      return '<li><a href="' + PAGE + esc(query({ tab: x[0], video: '' })) + '" data-tab="' + x[0] + '"' + (st.tab === x[0] ? ' aria-current="page"' : '') + '>' + x[1] + (x[2] ? ' <span class="n">' + x[2] + '</span>' : '') + '</a></li>';
    }).join('');
  }
  function controles(){
    var V = ds().vids, n = { todos: V.length, longos: 0, shorts: 0, fixados: 0 };
    V.forEach(function(v){ if (v.fmt === 'long') n.longos++; if (v.fmt === 'short') n.shorts++; if (v.pinned) n.fixados++; });
    $('fFmt').innerHTML = OK.fmt.map(function(k){
      return '<button type="button" data-fmt="' + k + '" aria-pressed="' + (st.fmt === k) + '" aria-label="' + FMT_NOME[k] + ', ' + n[k] + '">' + FMT_NOME[k] + ' <span class="n" aria-hidden="true">' + n[k] + '</span></button>';
    }).join('');
    $('fVer').innerHTML = [['capas', 'Capas', I.grid], ['lista', 'Lista', I.list]].map(function(x){
      return '<button type="button" data-ver="' + x[0] + '" aria-pressed="' + (st.ver === x[0]) + '">' + x[2] + x[1] + '</button>';
    }).join('');
    $('fSort').value = st.sort;
    if (document.activeElement !== $('fQ')) $('fQ').value = st.q;
    $('fQClr').hidden = !st.q;
    return n;
  }
  function resultado(n, cont){
    var r = $('res'), q = st.q.trim(), V = ds().vids, nc = V.filter(function(v){ return v.fmt === 'nc'; }).length, txt = '';
    if (st.tab === 'videos' && !esqueleto && !carregando && st.estado !== 'erro' && V.length){
      if (q) txt = F.plural(n, 'vídeo', 'vídeos') + ' com “' + q + '”' + (st.fmt !== 'todos' ? ' em ' + FMT_NOME[st.fmt] : '');
      else if (OWN) txt = 'Views por dia e retenção ainda não são medidas no seu canal.';
      else if (nc && st.fmt === 'todos') txt = V.length + ' vídeos: ' + cont.longos + ' longos, ' + cont.shorts + ' Shorts, ' + nc + ' com formato não confirmado.';
    }
    r.textContent = txt; r.hidden = !txt;
  }
  function faixas(){
    var h = '';
    if (st.estado === 'backfill') h = '<div class="band info">' + I.sync + '<p><b>Sincronizando:</b> 12 de 48 vídeos. Os números aparecem quando a sincronização terminar.</p></div>';
    if (st.estado === 'atrasada') h = '<div class="band warn">' + I.warn + '<p><b>Atenção:</b> dados de ' + F.dataHora(syncMs()) + '. A sincronização está atrasada.</p><button type="button" class="btn" data-sync>Sincronizar só este canal</button></div>';
    $('faixa').innerHTML = h;
  }

  /* ---------------------------------------------------------------- aba Trocas: cada troca é um caminho para o histórico do vídeo */
  function hrefTroca(t, ids, tot){
    var p = new URLSearchParams();
    p.set('id', t.video); p.set('from', 'canais'); p.set('canal', C.canal.id); p.set('back', query()); if (t.ms != null) p.set('troca', t.ms);
    if (ids){ p.set('ids', ids.join(',')); p.set('i0', 0); p.set('tot', tot); }
    return 'video.html?' + p.toString();
  }
  /* rodada 3: a linha antecipa o que a tela especializada (Histórico do vídeo) tem: o efeito em 7 dias, com o mesmo motor dela, sem número inventado */
  function efeitoLinha(t){
    var vv = window.HM && window.HM.video(t.video), c = vv && vv.changes.filter(function(x){ return x.at === t.ms && (x.type === 'title') === (t.campo === 'titulo'); })[0];
    if (!c) return '';
    var e = window.HM.effect(c.id), txt = e.status === 'aguardando' ? e.waitText : e.label.charAt(0).toUpperCase() + e.label.slice(1) + ': ' + e.reason;
    txt = txt.charAt(0).toLowerCase() + txt.slice(1);
    return txt.charAt(txt.length - 1) === '.' ? txt : txt + '.';
  }
  function trocas(){
    if (OWN){ $('trocas').innerHTML = '<div class="empty"><p>Trocas dos seus vídeos ainda não são lidas nesta tela.</p><p class="m">Os testes de título e thumbnail do seu canal ficam no A/B Lab.</p></div>'; return; }
    var el = $('trocas'), T = st.estado === 'backfill' || st.estado === 'vazio' ? [] : C.trocas;
    if (!T.length){ el.innerHTML = '<div class="empty"><p>Nenhuma troca de título ou thumbnail nos últimos 30 dias.</p></div>'; return; }
    var alvoV = st.video && C.porId(st.video), L = alvoV ? T.filter(function(t){ return t.video === alvoV.id; }) : T, h = '';
    if (alvoV) h += '<p class="chip"><span>Só as trocas de “' + esc(alvoV.t) + '”: ' + L.length + ' de ' + T.length + '</span><a class="lk" href="' + PAGE + esc(query({ tab: 'trocas', video: '' })) + '" data-tab="trocas">Ver as ' + T.length + ' trocas do canal</a></p>';
    if (!L.length) h += '<div class="empty"><p>Este vídeo não teve troca de título nem de thumbnail nos últimos 30 dias.</p></div>';
    /* o pager do vídeo anda pelos vídeos que têm troca, na ordem da lista */
    var vids = []; L.forEach(function(t){ if (vids.indexOf(t.video) < 0) vids.push(t.video); });
    /* rodada 4: um cartão por VÍDEO (mesmo as trocas não vizinhas), na ordem da troca mais recente de cada um, e um botão por cartão.
       O botão abre o histórico do vídeo todo; com 2 ou mais trocas, cada troca tem o seu link "Abrir nesta troca", que chega já nela. */
    var porV = {}, ordV = []; L.forEach(function(t){ if (!porV[t.video]){ porV[t.video] = []; ordV.push(t.video); } porV[t.video].push(t); });
    h += '<ul class="swaps" aria-label="Trocas por vídeo, o vídeo com a troca mais recente primeiro">' + ordV.map(function(id){
      var v = C.porId(id), itens = porV[id], multi = itens.length > 1;
      var hGrupo = hrefTroca({ video: id, ms: multi ? null : itens[0].ms }, vids, vids.length), tG = multi ? '' : ' data-troca="' + itens[0].ms + '"';
      var go = 'data-go="" data-video="' + id + '"' + tG;
      return '<li class="swg' + (multi ? ' multi' : '') + '" data-href="' + esc(hGrupo) + '" data-video="' + id + '"' + tG + '>' +
        '<span class="twrap"><a class="thumb" href="' + esc(hGrupo) + '" tabindex="-1" aria-hidden="true" ' + go + '><img src="' + v.thumb + '" alt="" width="320" height="180" loading="lazy"></a>' +
        '<button type="button" class="amp" data-amp="' + id + ':" aria-label="Ampliar a thumbnail: ' + esc(v.t) + '">' + window.VIEWER_ICON + '</button></span>' +
        '<div class="gh"><h3><a href="' + esc(hGrupo) + '" ' + go + '>' + esc(v.t) + '</a></h3>' + (multi ? '<span class="mesmo">' + I.swap + F.plural(itens.length, 'troca', 'trocas') + ' neste vídeo</span>' : '') +
        '<a class="btn go" id="sg-' + id + '" href="' + esc(hGrupo) + '" ' + go + ' aria-label="Abrir histórico do vídeo: ' + esc(v.t) + '">Abrir histórico do vídeo ' + svg('<path d="M6 3.5L10.5 8 6 12.5"/>') + '</a></div>' +
        (multi ? '<p class="also">O botão abre o histórico do vídeo todo. Cada troca abaixo tem o seu link e abre o histórico já nela.</p>' : '') +
        '<ul class="swrows">' + itens.map(function(t){
          var tit = t.campo === 'titulo', hr = hrefTroca(t, vids, vids.length), nome = (tit ? 'troca de título' : 'troca de thumbnail') + ' de ' + F.data(t.ms);
          return '<li class="sw" data-href="' + esc(hr) + '" data-video="' + id + '" data-troca="' + t.ms + '"><div><p class="what">' + I.swap + '<b>' + (tit ? 'Título trocado' : 'Thumbnail trocada') + '</b><span>' + (tit ? 'visto pela 1ª vez ' : 'vista pela 1ª vez ') + '<time datetime="' + F.iso(t.ms) + '">' + F.ha(t.ms) + '</time>' +
            (tit ? ' (' + esc(t.janela) + ')' : ' (' + F.dataHora(t.ms) + ')') + '</span></p>' +
            (tit ? '<dl><dt>Antes</dt><dd>' + esc(t.de) + '</dd><dt>Agora</dt><dd>' + esc(t.para) + '</dd></dl>'
                 : '<dl><dt>Antes</dt><dd><span class="na">imagem anterior não arquivada</span></dd><dt>Agora</dt><dd>a thumbnail ao lado</dd></dl>') +
            '<p class="efeito"><b>No histórico, efeito em 7 dias:</b> ' + esc(efeitoLinha(t)) + '</p></div>' +
            (multi ? '<a class="rowgo" id="sw-' + t.ms + '" href="' + esc(hr) + '" data-go="" data-video="' + id + '" data-troca="' + t.ms + '" aria-label="Abrir o histórico do vídeo na ' + nome + ': ' + esc(v.t) + '">Abrir nesta troca ' + svg('<path d="M6 3.5L10.5 8 6 12.5"/>') + '</a>' : '') + '</li>';
        }).join('') + '</ul></li>';
    }).join('') + '</ul>';
    h += '<p style="margin:14px 0 0"><a class="lk" href="../2026-10-07-historico-muitas-versoes/mudancas.html">Ver as ' + T.length + ' trocas em Mudanças</a></p>';
    el.innerHTML = h;
  }

  /* ---------------------------------------------------------------- aba Leitura: o cartão da forja, escopo canal */
  function hrefEv(videoId, trocaMs){
    var p = new URLSearchParams(); p.set('id', videoId); p.set('from', 'canais'); p.set('canal', C.canal.id); p.set('back', query());
    if (trocaMs) p.set('troca', trocaMs);
    return 'video.html?' + p.toString();
  }
  function leitura(){
    if (OWN){ $('leitura').innerHTML = '<div class="empty"><p>A leitura da forja para o seu canal ainda não foi desenhada.</p><p class="m">Hoje a forja lê views públicas, títulos, thumbnails e trocas de concorrentes. Para o seu canal ela teria também impressões, e isso é uma decisão sua (pergunta no LEIAME).</p></div>'; return; }
    if (window.FORJA.estado() !== st.leitura) window.FORJA.set(st.leitura, { silencioso: true });
    window.FORJA.montar($('leitura'), function(){ return { escopo: 'canal', href: hrefEv, hrefTrocas: function(){ return PAGE + alvo(query({ tab: 'trocas', video: '' })); } }; });
  }

  /* ---------------------------------------------------------------- render */
  var perf = { sync: null, frame: null };
  function render(medir){
    var t0 = medir ? performance.now() : 0;
    screen.dataset.own = OWN ? '1' : '0'; screen.dataset.dens = st.dens; screen.dataset.ord = st.sort; screen.dataset.vista = st.ver;   /* nomes próprios: data-ver e data-fmt são dos botões */
    cabecalho(); painel(); abas(); faixas();
    $('tabVideos').hidden = st.tab !== 'videos'; $('tabTrocas').hidden = st.tab !== 'trocas'; $('tabLeitura').hidden = st.tab !== 'leitura';
    if ($('tabRetencao')) $('tabRetencao').hidden = st.tab !== 'retencao';
    var r = { n: 0 }, cont = controles();
    if (st.tab === 'videos') r = miolo();
    if (st.tab === 'trocas') trocas();
    if (st.tab === 'leitura') leitura();
    resultado(r.n, cont);
    mock();
    if (medir){
      perf.sync = performance.now() - t0; perf.frame = null;
      requestAnimationFrame(function(){ requestAnimationFrame(function(){ perf.frame = performance.now() - t0; window.__perf = perf; }); });
      window.__perf = perf;
    }
    return r;
  }

  /* ---------------------------------------------------------------- anúncios (role=status; a busca espera 500 ms) */
  var tAn = 0;
  function anunciar(txt, espera){
    clearTimeout(tAn);
    tAn = setTimeout(function(){ var s = $('status'); s.textContent = ''; setTimeout(function(){ s.textContent = txt; }, 30); }, espera || 0);
  }
  function contagem(n){ return F.plural(n, 'vídeo', 'vídeos'); }

  /* ---------------------------------------------------------------- aviso (toast): status, pelo menos 6 s, com fechar */
  var tToast = 0;
  function aviso(txt){
    var t = $('toast'); if (t) t.remove(); clearTimeout(tToast);
    t = document.createElement('div'); t.className = 'toast'; t.id = 'toast'; t.setAttribute('role', 'status');
    t.innerHTML = '<span>' + esc(txt) + '</span><button type="button" aria-label="Fechar aviso">' + I.x + '</button>';
    document.body.appendChild(t); t.querySelector('button').onclick = function(){ t.remove(); };
    tToast = setTimeout(function(){ t.remove(); }, 7000);
  }

  /* ---------------------------------------------------------------- menu de ações (padrão menu button) e dica */
  var menu = null, dono = null;
  function fecharMenu(devolver){
    if (!menu) return;
    var d = dono; FLUT.fechar(false);
    if (devolver && d) d.focus();
  }
  function abrirMenu(btn, rotulo, det, itens){
    fecharMenu(false);
    menu = document.createElement('div'); menu.className = 'pop menu'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', rotulo);
    if (det) menu.setAttribute('aria-describedby', 'menuDet');
    menu.innerHTML = (det ? '<p class="det" id="menuDet">' + det + '</p>' : '') + itens.map(function(it, i){
      var a = ' role="menuitem" tabindex="-1" data-i="' + i + '"' + (it.off ? ' aria-disabled="true"' : '') + (it.cls ? ' class="' + it.cls + '"' : '');
      var c = (it.ico || '') + '<span>' + it.txt + '</span>' + (it.nota ? '<small>' + it.nota + '</small>' : '');
      return it.href && !it.off ? '<a' + a + ' href="' + esc(it.href) + '"' + (it.ext ? ' target="_blank" rel="noopener"' : '') + '>' + c + (it.ext ? '<span class="sr"> (abre em nova aba)</span>' : '') + '</a>' : '<button type="button"' + a + '>' + c + '</button>';
    }).join('');
    dono = btn; FLUT.abrir(btn, menu, { pref: 'baixo', alinhar: 'fim', aoFechar: function(){ menu = null; dono = null; } });
    var els = [].slice.call(menu.querySelectorAll('[role="menuitem"]'));
    els[0].focus();
    menu.addEventListener('keydown', function(e){
      var i = els.indexOf(document.activeElement);
      if (e.key === 'ArrowDown'){ e.preventDefault(); els[(i + 1) % els.length].focus(); }
      else if (e.key === 'ArrowUp'){ e.preventDefault(); els[(i - 1 + els.length) % els.length].focus(); }
      else if (e.key === 'Home'){ e.preventDefault(); els[0].focus(); }
      else if (e.key === 'End'){ e.preventDefault(); els[els.length - 1].focus(); }
      else if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); fecharMenu(true); }
      else if (e.key === 'Tab'){ fecharMenu(true); }
    });
    menu.addEventListener('click', function(e){
      var el = e.target.closest('[role="menuitem"]'); if (!el) return;
      var it = itens[+el.dataset.i];
      if (it.off){ e.preventDefault(); return; }
      if (it.href && !it.tab){ fecharMenu(false); return; }
      e.preventDefault(); var d = dono; fecharMenu(false); it.fn(d);
    });
  }
  function menuVideo(btn){
    var v = null, V = ds().vids; for (var i = 0; i < V.length; i++) if (V[i].id === btn.dataset.acts) v = V[i];
    abrirMenu(btn, 'Ações do vídeo: ' + v.t, detalhe(v), OWN ? [
      { txt: 'Ampliar thumbnail', ico: window.VIEWER_ICON, fn: function(d){ window.VIEWER.open(v.id, null, d); } },
      { txt: 'Abrir no YouTube', ico: I.ext, href: v.url, ext: true }
    ] : [
      { txt: v.pinned ? 'Desafixar' : 'Fixar', ico: I.pin, fn: function(){
          v.pinned = !v.pinned; if (!v.pinned){ v.pinAntigo = false; } v.pinAt = v.pinned ? C.NOW : null;
          if (st.fmt === 'fixados' || true) render();
          var b = document.querySelector('[data-acts="' + v.id + '"]'); if (b) b.focus(); else $('fFmt').querySelector('[aria-pressed="true"]').focus();
          aviso(v.pinned ? 'Vídeo fixado' : 'Vídeo desafixado');
        } },
      { txt: 'Ampliar thumbnail', ico: window.VIEWER_ICON, fn: function(d){ window.VIEWER.open(v.id, null, d); } },
      { txt: 'Abrir no YouTube', ico: I.ext, href: v.url, ext: true },
      { txt: 'Ver trocas', ico: I.swap, off: !v.trocas, nota: v.trocas ? String(v.trocas) + ' em 30 d' : 'nenhuma em 30 d', href: PAGE + alvo(query({ tab: 'trocas', video: v.id })), tab: true,
        fn: function(){ st.tab = 'trocas'; st.video = v.id; gravarUrl(true); render(); $('hTrocas').setAttribute('tabindex', '-1'); $('hTrocas').focus(); } }
    ]);
  }
  function menuCanal(btn){
    abrirMenu(btn, 'Ações do canal', '', [
      { txt: 'Sincronizar só este canal', ico: I.sync, fn: function(d){ d.focus(); aviso('Sincronização iniciada'); } }
    ].concat(OWN ? [] : [
      { txt: 'Remover canal…', ico: I.trash, cls: 'del', nota: 'só para quem administra', fn: function(d){ d.focus(); aviso('No mockup, nada é removido.'); } }
    ]));
  }
  var dica = null, donoDica = null;
  function fecharDica(devolver){
    if (!dica) return;
    var d = donoDica; FLUT.fechar(false);
    if (devolver && d) d.focus();
  }
  function abrirDica(btn, html){
    if (donoDica === btn){ fecharDica(true); return; }
    fecharMenu(false); fecharDica(false);
    dica = document.createElement('div'); dica.className = 'pop tip'; dica.id = 'tip'; dica.setAttribute('role', 'note'); dica.innerHTML = html;
    donoDica = btn; FLUT.abrir(btn, dica, { pref: 'baixo', alinhar: 'fim', descreve: true, aoFechar: function(){ dica = null; donoDica = null; } });
  }
  function dicaCanal(){
    if (!NUMS) return '<h3>De onde vêm os números do canal</h3><p>Aparecem quando a primeira sincronização terminar.</p>';
    function li(x){ return x.b ? '<li><b>' + esc(x.l.charAt(0).toUpperCase() + x.l.slice(1)) + ':</b> ' + esc(x.b) + '</li>' : ''; }
    return '<h3>De onde vêm os números do canal</h3><ul>' + NUMS.r1.map(li).join('') + '</ul>' +
      (st.nums === '1' ? '<h3>Todos os números</h3><ul>' + NUMS.r2.map(li).join('') + '</ul>' : '<p class="m">Abra “Todos os números” para ver a base dos outros ' + NUMS.r2.length + '.</p>');
  }

  /* ---------------------------------------------------------------- ações da tela */
  function mudar(mud, opt){
    opt = opt || {};
    Object.assign(st, mud);
    if (!opt.manterN) st.n = DEF.n;
    gravarUrl(!opt.replace);
    return render(true);
  }
  var tBusca = 0;
  $('fQ').addEventListener('input', function(){
    var r = mudar({ q: this.value }, { replace: true });
    anunciar(st.q.trim() ? (r.n ? contagem(r.n) + ' com “' + st.q.trim() + '”' : 'Nenhum vídeo com “' + st.q.trim() + '”') : contagem(r.n), 500);
  });
  $('fQ').addEventListener('keydown', function(e){ if (e.key === 'Escape' && this.value){ e.preventDefault(); limparBusca(); } });
  function limparBusca(){ $('fQ').value = ''; var r = mudar({ q: '' }, { replace: true }); $('fQ').focus(); anunciar('Busca limpa, ' + contagem(r.n)); }
  $('fQClr').addEventListener('click', limparBusca);
  $('fSort').addEventListener('change', function(){
    var r = mudar({ sort: this.value, dir: 'desc' });
    anunciar('Ordenado por ' + SORT_NOME[st.sort] + ', decrescente, ' + contagem(r.n));
  });
  function simular(ms){
    carregando = true; esqueleto = false; render();
    var t1 = setTimeout(function(){ if (carregando){ esqueleto = true; render(); } }, 100);   /* nada até 100 ms; depois, esqueleto */
    setTimeout(function(){ clearTimeout(t1); carregando = false; esqueleto = false; render(); anunciar(contagem(ordemAtual.length) + ' carregados'); }, ms);
  }
  document.addEventListener('click', function(e){
    var t = e.target, b;
    if (menu && !t.closest('.pop.menu') && !t.closest('[aria-haspopup="menu"]')) fecharMenu(false);
    if (dica && !t.closest('.pop.tip') && !t.closest('.ibtn')) fecharDica(false);
    if ((b = t.closest('[data-acts]'))){ if (dono === b) fecharMenu(true); else menuVideo(b); return; }
    if ((b = t.closest('#chMenu'))){ if (dono === b) fecharMenu(true); else menuCanal(b); return; }
    if ((b = t.closest('#tipBtn'))){ abrirDica(b, dicaCanal()); return; }
    if ((b = t.closest('#numsBtn'))){
      st.nums = st.nums === '1' ? '' : '1'; gravarUrl(false); fecharDica(false); cabecalho(); $('numsBtn').focus();
      anunciar(st.nums === '1' ? 'Todos os números do canal, ' + NUMS.r2.length + ' a mais.' : 'Números recolhidos.'); return;
    }
    if (t.closest('#pnBtn')){
      st.painel = st.painel === '0' ? '1' : '0'; try { localStorage.setItem('pc:painel8', st.painel); } catch (x) {}
      gravarUrl(false); painel(); $('pnBtn').focus(); anunciar(st.painel === '0' ? 'Como o canal está: recolhido.' : 'Como o canal está: aberto.'); return;
    }
    if ((b = t.closest('[data-cliques]'))){ st.cliques = b.dataset.cliques; gravarUrl(false); render(); return; }
    if ((b = t.closest('a[data-own]'))){
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      return;
    }
    if ((b = t.closest('[data-fmt]'))){
      var r = mudar({ fmt: b.dataset.fmt });
      var nb = $('fFmt').querySelector('[data-fmt="' + st.fmt + '"]'); if (nb) nb.focus();
      anunciar(FMT_NOME[st.fmt] + ', ' + contagem(r.n)); return;
    }
    if ((b = t.closest('[data-ver]'))){
      var r2 = mudar({ ver: b.dataset.ver }, { manterN: true });
      $('fVer').querySelector('[data-ver="' + st.ver + '"]').focus();
      anunciar('Vista ' + (st.ver === 'lista' ? 'Lista' : 'Capas') + ', ' + contagem(r2.n)); return;
    }
    if ((b = t.closest('[data-sortcol]'))){
      var k = b.dataset.sortcol, r3 = mudar(st.sort === k ? { dir: st.dir === 'asc' ? 'desc' : 'asc' } : { sort: k, dir: 'desc' });
      var hb = document.querySelector('[data-sortcol="' + k + '"]'); if (hb) hb.focus();
      anunciar('Ordenado por ' + SORT_NOME[k] + ', ' + (st.dir === 'asc' ? 'crescente' : 'decrescente') + ', ' + contagem(r3.n)); return;
    }
    if ((b = t.closest('[data-more]'))){
      var antes = ordemAtual.length;
      mudar({ n: st.n + LOTE }, { manterN: true, replace: true });
      var alvoN = $('v-' + ordemAtual[antes]); if (alvoN) alvoN.focus({ preventScroll: true });     /* foco no primeiro cartão novo; a rolagem não se mexe */
      var novos = ordemAtual.length - antes, resta = (C.videos.length - ordemAtual.length);
      anunciar('Mostrando ' + ordemAtual.length + ' de ' + filtrar(st.fmt, st.q).length + ' vídeos. ' + F.plural(novos, 'vídeo antigo carregado', 'vídeos antigos carregados') + (document.querySelector('[data-more]') ? '.' : '. Não falta nenhum.')); return;
    }
    if (t.closest('[data-clearq]')){ limparBusca(); return; }
    if (t.closest('[data-retry]')){ st.estado = 'normal'; gravarUrl(false); simular(800); return; }
    if (t.closest('[data-sync]')){ aviso('Sincronização iniciada'); return; }
    if ((b = t.closest('a[data-tab]'))){
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault(); st.tab = b.dataset.tab; st.video = ''; gravarUrl(true); render();
      var a = $('ctabs').querySelector('[aria-current="page"]'); if (a) a.focus();
      anunciar('Seção ' + a.textContent.trim()); return;
    }
    if ((b = t.closest('a[data-go]'))){ try { sessionStorage.setItem('pc:veio', '1'); sessionStorage.setItem('pc:ultimo', b.dataset.video || b.dataset.go); sessionStorage.setItem('pc:troca', b.dataset.troca || ''); } catch (x) {} return; }
    /* troca: a linha inteira é clicável; o teclado usa os links dentro dela */
    if ((b = t.closest('[data-href]')) && !t.closest('a, button')){
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      try { sessionStorage.setItem('pc:veio', '1'); sessionStorage.setItem('pc:ultimo', b.dataset.video); sessionStorage.setItem('pc:troca', b.dataset.troca || ''); } catch (x) {}
      location.href = b.dataset.href;
    }
  });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && dica){ fecharDica(true); } });
  addEventListener('popstate', function(){ lerUrl(); render(); });

  /* ---------------------------------------------------------------- voltar do vídeo: foco e rolagem no cartão do último vídeo visto */
  function retorno(){
    var id, tm; try { id = sessionStorage.getItem('pc:ultimo'); tm = sessionStorage.getItem('pc:troca'); if (sessionStorage.getItem('pc:voltou') !== '1') return; sessionStorage.removeItem('pc:voltou'); } catch (x) { return; }
    if (!id) return;
    var topo = parseFloat(getComputedStyle(screen).getPropertyValue('--sticky-h')) || 0;
    if (st.tab === 'trocas'){
      /* volta para a troca que a pessoa abriu (ou a mais recente do último vídeo visto), com foco */
      var ta = tm ? $('sw-' + tm) : null; if (!ta || ta.dataset.video !== id){ ta = $('sg-' + id) || document.querySelector('.btn.go[data-video="' + id + '"]'); }
      if (!ta) return;
      ta.focus({ preventScroll: true });
      var r0 = ta.getBoundingClientRect(); if (r0.top < topo + 8 || r0.bottom > innerHeight - 8) ta.scrollIntoView({ block: 'center' });
      window.__retorno = ta.id; return;
    }
    if (st.tab !== 'videos') return;
    var i = ordemAtual.indexOf(id); if (i < 0) return;

    var el = $('v-' + id); if (!el) return;
    el.focus({ preventScroll: true });
    var r = el.getBoundingClientRect();
    if (r.top < topo + 8 || r.bottom > innerHeight - 8) el.scrollIntoView({ block: 'center' });
    window.__retorno = id;
  }
  addEventListener('pageshow', function(){ setTimeout(retorno, 0); });

  /* ---------------------------------------------------------------- barra do mockup */
  var EST = [['normal', 'Normal'], ['carregando', 'Carregando'], ['erro', 'Erro de carga'], ['backfill', 'Canal em primeira sincronização'], ['atrasada', 'Sincronização atrasada'], ['vazio', 'Canal sem vídeos']];
  var BUSCA_VAZIA = 'groenlândia';
  function mock(){
    var busca = st.q === BUSCA_VAZIA;
    $('mkEstados').innerHTML = EST.map(function(x){ return '<button type="button" data-estado="' + x[0] + '" aria-pressed="' + (st.estado === x[0] && !(x[0] === 'normal' && busca)) + '">' + x[1] + '</button>'; }).join('') +
      '<button type="button" data-estado="busca" aria-pressed="' + busca + '">Busca sem resultado</button>';
    $('mkDens').innerHTML = [['conf', '4 (capa maior)'], ['padrao', '5 (proposto)'], ['comp', '6 (compacto)']].map(function(x){ return '<button type="button" data-dens="' + x[0] + '" aria-pressed="' + (st.dens === x[0]) + '">' + x[1] + '</button>'; }).join('');
    if ($('mkCliques')) $('mkCliques').innerHTML = [['corte', 'Com corte: abaixo de 10 impressões, “poucas impressões para dizer algo”'], ['sempre', 'Sempre a contagem, sem corte']].map(function(x){ return '<button type="button" data-cliques="' + x[0] + '" aria-pressed="' + (st.cliques === x[0]) + '">' + x[1] + '</button>'; }).join('');
    if (!$('mkLeitura')) return;
    var e = window.FORJA.estado();
    function bt(x){ return '<button type="button" data-leitura="' + x[0] + '" aria-pressed="' + (e === x[0]) + '">' + x[1] + '</button>'; }
    $('mkLeitura').innerHTML = window.FORJA.ESTADOS.map(bt).join('');
    $('mkVar').innerHTML = window.FORJA.VARIANTES.map(bt).join('');
    if (!$('mkCasos').children.length) $('mkCasos').innerHTML = C.casos.map(function(c){ return '<button type="button" data-caso="' + c.video + '">' + c.rotulo + '</button>'; }).join('');
  }
  $('mock').addEventListener('click', function(e){
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.estado){
      var k = b.dataset.estado; carregando = false; esqueleto = false;
      if (k === 'busca'){ st.estado = 'normal'; st.tab = 'videos'; st.q = BUSCA_VAZIA; $('fQ').value = st.q; }
      else { st.estado = k; if (st.q === BUSCA_VAZIA){ st.q = ''; $('fQ').value = ''; } if (k !== 'normal') st.tab = 'videos'; }
      st.n = DEF.n; gravarUrl(false);
      if (k === 'carregando'){ carregando = true; render(); setTimeout(function(){ if (st.estado === 'carregando'){ esqueleto = true; render(); } }, 100); }
      else render();
    }
    if (b.dataset.dens){ st.dens = b.dataset.dens; gravarUrl(false); render(); }
    if (b.dataset.leitura){ st.leitura = b.dataset.leitura; st.tab = 'leitura'; st.video = ''; window.FORJA.set(b.dataset.leitura, { silencioso: true }); gravarUrl(false); render(); }
    if (b.id === 'mkLoad') simular(800);
    if (b.id === 'mkLoadFast') simular(60);
    if (b.dataset.caso){
      Object.assign(st, { estado: 'normal', tab: 'videos', fmt: 'todos', q: '', sort: 'recentes', dir: 'desc', n: 120 }); carregando = esqueleto = false;
      $('fQ').value = ''; gravarUrl(false); render();
      var el = $('v-' + b.dataset.caso); if (el){ el.scrollIntoView({ block: 'center' }); el.focus({ preventScroll: true }); }
    }
  });

  /* ---------------------------------------------------------------- partida */
  window.FORJA.init({ say: function(t){ anunciar(t); }, toast: function(t){ aviso(t); }, onChange: function(e){ st.leitura = e; gravarUrl(false); mock(); } });
  lerUrl();
  window.FORJA.set(st.leitura, { silencioso: true });
  if (st.estado === 'carregando'){ carregando = true; render(); setTimeout(function(){ esqueleto = true; render(); }, 100); }
  else render();
  window.__pc = { st: st, render: render, ordem: function(){ return ordemAtual; } };
})();

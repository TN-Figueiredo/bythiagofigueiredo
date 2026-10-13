/* lista.js: mockup 16 da A5 (lote 2), a Lista de Canais com direção, estado e filtros "parados" e "em queda".
   Parâmetros: ?caso=tipico|completo|extremo|zero|magro|erro|fora|carregando|leitura|muitos  ?filtro=todos|parados|queda|fora|erro  ?nicho=Viagem|IA|Humor  ?tema=claro
   Tudo é exemplo (canais e números inventados). Colunas e cabeçalho do Observatório: os da produção (mockup 8 e lote 1, tela C, ambos aprovados).
   O que é ACRÉSCIMO leva "+ novo" e contorno tracejado verde-água. Sem color-mix(). */
(function(){
  'use strict';
  var A = window.A4, L = window.L1, D = window.L16, esc = A.esc, q = A.q;
  var EST = { filtro: q.get('filtro') || 'todos', nicho: q.get('nicho') || '', dir: q.get('dir') || '', mais: 0 };
  var NOMES_EST = { todos: 'Todos', parados: 'Parados', queda: 'Em queda', fora: 'Saíram do YouTube', erro: 'Em erro' };
  var ROT_DIR = { up: 'subindo', eq: 'sem mudança', dn: 'descendo', nm: 'não medido' };
  var CASO = D.caso(q.get('caso')), PASSO = 10, INICIAL = CASO.caso === 'muitos' ? 20 : 999;
  L.HOJE = CASO.hoje;

  var IC = L.IC;
  var IC_FORA = '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8"/></svg>';
  var IC_LOCK = '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.2" y="7" width="9.6" height="6.4" rx="1.4"/><path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7"/></svg>';
  var SIM = { up: '▲', dn: '▼', eq: '＝' }, PAL = { up: 'subindo', dn: 'descendo', eq: 'sem mudança' };

  function pl(n, a, b){ return n + ' ' + (n === 1 ? a : b); }
  function sg(pc){ return pc > 0 ? '+' + pc + '%' : pc < 0 ? '−' + Math.abs(pc) + '%' : '0%'; }
  function dias(d){ return pl(d, 'dia', 'dias'); }
  function diasAte(iso){ return A.dias(CASO.hoje, iso); }

  /* ---------------------------------------------------------------- erro (a forma do lote 1, tela C, sem redesenho) */
  var MOT = { demora: { t: 'O YouTube demorou demais para responder.', quem: 'sozinho' } };
  function estagio(h){ return h < 12 ? 'novo' : h < 72 ? 'alarme' : 'aviso'; }
  var AGORA = Date.parse(CASO.hoje + 'T14:32:00Z');
  function inicioDia(h){ return new Date(AGORA - h * 36e5).toISOString().slice(0, 10); }
  function emails(h){ var d3 = A.addDias(inicioDia(h), 3); if (d3 > CASO.hoje) return { ult: null, prox: d3, primeiro: d3 }; var u = d3; while (A.addDias(u, 7) <= CASO.hoje) u = A.addDias(u, 7); return { ult: u, prox: A.addDias(u, 7), primeiro: d3 }; }
  function idade(h){ return h < 24 ? L.pl(h, 'hora', 'horas') : L.pl(Math.floor(h / 24), 'dia', 'dias'); }
  function pastErro(h){ var s = estagio(h), ic = s === 'aviso' ? IC.envelope : s === 'novo' ? IC.relogio : IC.aviso; return '<span class="er-p ' + s + '">' + ic + '<span>' + (s === 'novo' ? 'Erro há ' : 'Em erro há ') + idade(h) + '</span></span>'; }
  function linhaEmail(h){ var m = emails(h), s = estagio(h); if (s === 'novo') return 'Tentando de novo às 18:00'; if (s === 'alarme') return 'Se continuar, e-mail em ' + A.dm(m.prox); return 'E-mail em ' + A.dm(m.ult) + ' · próximo em ' + A.dm(m.prox); }
  function linhaMotivo(e){ var m = MOT[e[1]], s = estagio(e[0]); if (s === 'novo') return '<span class="er-quem sozinho"><i class="er-qs" aria-hidden="true"></i>Passa sozinho:</span> ' + m.t.charAt(0).toLowerCase() + m.t.slice(1); return m.t + ' Já são ' + idade(e[0]) + '.'; }
  function botaoSync(cls){
    if (CASO.leitura) return '<span class="btn er-btn er-bn ' + cls + '" role="button" tabindex="0" aria-disabled="true" aria-describedby="ls-ro-t" title="Só quem edita pode sincronizar">' + IC_LOCK + 'Sincronizar agora</span>';
    return L.novo('<span class="btn er-btn" role="button" tabindex="0">' + IC.sync + 'Sincronizar agora</span>', 'novo', 'er-bn ' + cls);
  }
  function celSync(c){
    if (c.er) return '<div class="er-cel">' + pastErro(c.er[0]) + '<span class="er-mot">' + linhaMotivo(c.er) + '</span><span class="er-sub">' + linhaEmail(c.er[0]) + '</span>' + botaoSync('er-bn-m') + '</div>';
    if (c.fo) return '<div class="ls-sy off"><span class="ls-sy-i" aria-hidden="true">' + IC.relogio + '</span><span>Última leitura em ' + A.dm(A.addDias(c.fo, -1)) + '</span></div>';
    return '<div class="c2-st"><span class="c2-dot" aria-hidden="true"></span>Sincronizado ' + c.sy + '</div>';
  }

  /* ---------------------------------------------------------------- peças novas */
  function nmSw(txt){ return '<span class="nm">' + esc(txt || 'não medido') + '</span>'; }
  /* a régua: de −50% a +50%, faixa "sem mudança" entre −10% e +10%, barra a partir do zero; passou do limite: ponta em triângulo */
  function regua(pc, k){
    var v = Math.max(-50, Math.min(50, pc)), esq = Math.min(50, 50 + v), larg = Math.max(2.5, Math.abs(v));
    var clip = Math.abs(pc) > 50 ? '<i class="ls-clip ' + (pc > 0 ? 'r' : 'l') + '" aria-hidden="true"></i>' : '';
    return '<span class="ls-rg ' + k + '" role="img" aria-label="Régua de menos 50% a mais 50%: ' + sg(pc).replace('−', 'menos ') + (Math.abs(pc) > 50 ? ', passa do limite da régua' : '') + '"><i class="ls-rg-b" aria-hidden="true"></i><i class="ls-rg-0" aria-hidden="true"></i><i class="ls-rg-v" aria-hidden="true" style="left:' + esq + '%;width:' + larg + '%"></i>' + clip + '</span>';
  }
  function celDirecao(c){
    if (c.dir == null) {
      return '<div class="ls-dir nmx"><span class="ls-dn">' + nmSw() + '</span><span class="ls-cap">' + esc(c.nm.txt) + '</span></div>';
    }
    var d = c.dir;
    return '<div class="ls-dir ' + d.k + '"><span class="ls-dl"><span class="ls-sy2" aria-hidden="true">' + SIM[d.k] + '</span><b class="num">' + sg(d.pc) + '</b><span class="ls-w">' + PAL[d.k] + '</span></span>' + regua(d.pc, d.k) +
      '<span class="ls-cap num" aria-label="' + D.fv(d.a) + ' views nos últimos 28 dias, contra ' + D.fv(d.b) + ' nos 28 anteriores">' + D.fv(d.a) + ' × ' + D.fv(d.b) + '</span></div>';
  }
  /* o estado sob o nome do canal: uma pastilha (a pior) e, quando preciso, uma frase curta */
  function celEstado(c){
    if (c.fo) return '<div class="ls-est"><span class="ls-p fo">' + IC_FORA + '<span>Saiu do YouTube em ' + A.dm(c.fo) + '</span></span><span class="ls-ec">Sem resposta do YouTube em 2 leituras.</span></div>';
    if (c.vid === 0) return '<div class="ls-est"><span class="ls-p sv">' + IC.video + '<span>Sem vídeos</span></span><span class="ls-ec">Ainda não publicou nada.</span></div>';
    if (c.par) {
      var rit = c.med ? 'Publica a cada ' + dias(c.med) + '.' : 'Sem ritmo medido: passou de 28 dias.';
      return '<div class="ls-est"><span class="ls-p par">' + IC.pausa + '<span>Parado há ' + dias(c.ult) + ' sem publicar</span></span><span class="ls-ec">' + (c.qd ? '<span class="ls-qs" aria-hidden="true">▼</span> Também em queda.' : rit) + '</span></div>';
    }
    if (c.qd) return '<div class="ls-est"><span class="ls-p qd"><span class="ls-qs" aria-hidden="true">▼</span><span>Em queda sustentada</span></span><span class="ls-ec">3 períodos de 28 dias.</span></div>';
    return '<div class="ls-est"><span class="ls-at">' + IC.video + '<span>Ativo, publicou há ' + dias(c.ult) + '</span></span></div>';
  }
  function strip(c){
    if (c.vid === 0) return '';
    var s = '<svg class="c2-strip" width="84" height="22" viewBox="0 0 104 26" role="img" aria-label="Uploads por semana nas últimas 13 semanas">'; c.rit.forEach(function(n, i){ var x = i * 8; s += n ? '<rect x="' + x + '" y="' + (26 - Math.min(n, 3) * 7) + '" width="5" height="' + Math.min(n, 3) * 7 + '" rx="1" class="b"/>' : '<rect x="' + x + '" y="24" width="5" height="2" class="z"/>'; }); return s + '</svg>';
  }
  function linha(c, i){
    var neg = c.cr.charAt(0) === '−', sv = c.vid === 0, oc = c.ins == null;
    var cls = [c.er ? 'er-lin ' + estagio(c.er[0]) : '', c.fo ? 'ls-fo' : ''].join(' ').trim();
    var ini = esc(c.nome.slice(0, 2));
    var insTxt = oc ? '<span class="nm" title="O canal esconde o número de inscritos">inscritos ocultos</span>' : '<span class="num">' + A.mil(c.ins) + '</span>';
    return '<tr data-canal="' + c.id + '" class="' + cls + '"><td class="c2-pos num ls-pos" data-l="Posição">' + (i + 1) + 'º</td>' +
      '<td class="ls-c" data-l="Canal"><div class="ch"><span class="av" aria-hidden="true">' + ini + '</span><div class="ls-id"><div class="ls-nm">' + (c.fo ? '<span class="cn ls-nolink">' + esc(c.nome) + '</span>' : '<a class="cn" href="#" onclick="return false" title="' + esc(c.nome) + '">' + esc(c.nome) + '</a>') + (c.own ? ' <span class="chip own">seu canal</span>' : '') + '</div>' +
      '<div class="c2-sub"><span class="c2-nicho">' + esc(c.nicho) + '</span>' + insTxt + '</div>' + celEstado(c) + '</div></div></td>' +
      '<td class="ls-d" data-l="Direção"><span class="sr">Direção: </span>' + celDirecao(c) + '</td>' +
      '<td class="ls-rit" data-l="Ritmo">' + (sv ? '<div class="nml">' + nmSw() + '<p>sem vídeos</p></div>' : '<div class="c2-cad">' + strip(c) + '<span><span class="num c2-big">' + c.pw + '</span> <span class="mut c2-u">longos/sem</span></span></div>') + '</td>' +
      '<td class="r ls-vpd" data-l="Views/dia">' + (sv ? nmSw() : '<span class="num c2-big">' + A.n(c.vpd) + '</span><span class="c2-cap">n = ' + c.vn + '</span>') + '</td>' +
      '<td class="ls-out" data-l="Outliers">' + (sv ? nmSw() : '<span class="c2-out"><b class="num ' + (parseFloat(c.out.replace(',', '.')) >= 2 ? 'm' : '') + '">' + c.out + '</b> <span class="c2-cap" style="display:inline">' + c.outn + '</span></span>') + '</td>' +
      '<td class="ls-tt" data-l="Trocas"><span class="num c2-big">' + c.tt + '</span> <span class="mut c2-u">' + (c.tt === 1 ? 'troca' : 'trocas') + '</span></td>' +
      '<td class="r ls-cr" data-l="Crescimento">' + (oc ? nmSw('oculto') : '<span class="num c2-big ' + (neg ? 'dn' : 'up') + '">' + (neg ? '▼ ' : '▲ ') + c.cr + '</span><span class="c2-cap">em 30 d</span>') + '</td>' +
      '<td class="ls-sync" data-l="Sincronização">' + celSync(c) + '</td>' +
      '<td class="c2-cmpc ls-cmp" data-l="Com o meu canal">' + (c.own ? '<span aria-hidden="true" class="mut">–</span><span class="sr">seu canal, sem comparação</span>' : '<a class="c2-cmp" href="#" onclick="return false" aria-label="Comparar ' + esc(c.nome) + ' com o meu canal">Comparar</a>') + '</td>' +
      '<td class="c2-act ls-act"><div class="er-act"><button type="button" class="c2-more" aria-label="Mais ações para ' + esc(c.nome) + '"' + (CASO.leitura ? ' aria-disabled="true"' : '') + '>' + IC.dots + '</button></div></td></tr>';
  }
  function cab(t, u, cls, extra){ return '<th scope="col" class="' + (cls || '') + '"><span class="c2-sb">' + t + '</span>' + (extra || '') + (u ? '<span class="c2-u2">' + u + '</span>' : '') + '</th>'; }
  function tabela(rows, total){
    var thDir = '<th scope="col" class="ls-thd c2-novo"><span class="c2-tag">+ novo</span><span class="c2-sb">Direção ' + A.ibtn('infoDir', 'Como a direção é calculada', true) + '</span><span class="c2-u2">views, 28 dias × 28 anteriores</span></th>';
    var thCanal = '<th scope="col"><span class="c2-sb">Canal</span><span class="c2-u2">nicho, inscritos, <span class="ls-nv">estado' + L.tag('novo') + '</span></span></th>';
    return '<div class="ls-tw"><table class="ls-t" aria-label="Canais acompanhados" aria-rowcount="' + (total + 1) + '"><thead><tr><th scope="col" class="c2-pos"><span class="sr">Posição</span></th>' + thCanal + thDir + cab('Ritmo', 'uploads por semana, 13 sem') + cab('Views/dia&nbsp;▼', 'mediana nos longos', 'r') + cab('Outliers', '2× ou mais, até 90 dias') + cab('Trocas', 'título e thumbnail, 30 d') + cab('Crescimento', 'inscritos, 30 d', 'r') + cab('Sincronização', 'e vídeos acompanhados') + '<th scope="col" class="c2-cmpc"><span class="c2-sb">Com o meu canal</span></th><th scope="col"><span class="sr">Ações</span></th></tr></thead><tbody>' + rows.map(linha).join('') + '</tbody></table></div>';
  }

  /* ---------------------------------------------------------------- contagens, frase, barra */
  function filtrados(){
    return CASO.canais.filter(function(c){ return !EST.nicho || c.nicho === EST.nicho; });
  }
  function conta(set){
    var o = { n: set.length, par: 0, qd: 0, qdDn: 0, fo: 0, er: 0, up: 0, dn: 0, eq: 0, nm: 0, fecha: [] };
    set.forEach(function(c){ if (c.par) o.par++; if (c.qd) { o.qd++; if (c.dir && c.dir.k === 'dn') o.qdDn++; } if (c.fo) o.fo++; if (c.er) o.er++; if (c.dir) o[c.dir.k]++; else { o.nm++; if (c.nm.fecha) o.fecha.push(c.nm.fecha); } });
    o.fecha.sort(); return o;
  }
  function frase(n){
    var pt = n.par ? '<b>' + pl(n.par, 'canal parado', 'canais parados') + '</b>' : '';
    var up = n.up ? '<b>' + n.up + ' subindo</b>' : '';
    var dn = n.dn ? '<b>' + n.dn + ' descendo</b>' : '', qdTxt = n.qd ? '<b>' + n.qd + ' em queda sustentada</b>' : '';
    if (CASO.queda && n.qd) { if (n.dn && n.qd === n.qdDn) dn += ' (' + qdTxt + ')'; else dn = [dn, qdTxt].filter(Boolean).join(', '); }
    var s, partes = [pt, up, dn].filter(Boolean);
    if (CASO.caso === 'magro') {
      s = (pt ? pt + '. ' : '') + 'Direção medida em <b>' + (n.n - n.nm) + ' de ' + n.n + '</b> canais.';
    } else if (!partes.length) {
      s = 'Nenhum canal parado, subindo nem descendo' + (CASO.queda ? ' ou em queda sustentada' : '') + '.';
    } else if (!n.par && !n.dn && !n.qd) {
      s = 'Nenhum canal parado, descendo' + (CASO.queda ? ' ou em queda sustentada' : '') + '; ' + up + '.';
    } else {
      s = partes.join(', ') + (!n.up ? ', nenhum subindo' : '') + '.';
    }
    if (!CASO.queda) s += (CASO.caso === 'magro' ? ' Em queda sustentada: só a partir de <b>' : ' Em queda sustentada (3 períodos de 28 dias seguidos) só dá para medir a partir de <b>') + A.dm(D.QUEDA_INICIO) + '</b>.';
    if (n.fo) { var fd = CASO.canais.filter(function(c){ return c.fo; }); s += n.fo === 1 ? ' <b>1 canal saiu do YouTube</b> em ' + A.dm(fd[0].fo) + '.' : ' <b>' + n.fo + ' canais saíram do YouTube</b>.'; }
    if (n.er) s += ' <b>' + pl(n.er, 'canal em erro', 'canais em erro') + '</b>.';
    if (EST.nicho) s = 'Em ' + esc(EST.nicho) + ': ' + s.charAt(0).toLowerCase() + s.slice(1);
    return s;
  }
  /* a casa da barra: quadrado com o símbolo e o número, a palavra logo abaixo (a cor nunca fala sozinha) e botão de filtro por direção */
  function casa(k, n, extra){
    var on = EST.dir === k, cls = n ? k : 'z', glifo = k === 'nm' ? '' : '<span class="ls-sgl" aria-hidden="true">' + SIM[k] + '</span>';
    if (k === 'nm') cls = n ? 'nmx' : 'z nm-z';
    var rot = ROT_DIR[k] + (extra ? '<span class="ls-sx">' + extra + '</span>' : '');
    return '<li class="ls-sg ' + cls + '"' + (n ? ' style="flex:' + n + ' 1 0"' : '') + '><button type="button" class="ls-sbt" data-dir="' + k + '" aria-pressed="' + on + '" aria-label="' + n + ' ' + ROT_DIR[k] + (on ? ', filtro ligado' : '') + '"><span class="ls-sb" aria-hidden="true">' + glifo + '<b class="num">' + n + '</b></span><span class="ls-sl" aria-hidden="true">' + rot + (on ? '<span class="ls-off-x"> ×</span>' : '') + '</span></button></li>';
  }
  function resumo(n){
    var fecha = CASO.caso === 'magro' && n.fecha.length ? 'fecham de ' + A.dm(n.fecha[0]) + ' a ' + A.dm(n.fecha[n.fecha.length - 1]) : '';
    var bar = '<ul class="ls-bar" aria-label="Canais por direção, de ' + n.n + ' canais. Cada casa filtra a lista.">' + casa('up', n.up) + casa('eq', n.eq) + casa('dn', n.dn) + casa('nm', n.nm, fecha) + '</ul>';
    return L.novo('<div class="ls-res"><p class="ls-fr"><span>' + frase(n) + '</span>' + A.ibtn('infoDir', 'Como o resumo e o estado são calculados') + '</p>' + bar + filtros(n) + '</div>', 'novo', 'ls-rn');
  }
  /* ---------------------------------------------------------------- filtros de estado */
  function chip(k, n, c){
    var on = EST.filtro === k && !(k === 'todos' && EST.dir), ic = k === 'parados' ? IC.pausa : k === 'queda' ? '<span class="ls-qs" aria-hidden="true">▼</span>' : k === 'fora' ? IC_FORA : k === 'erro' ? IC.aviso : '';
    var cls = 'ls-f ' + k + (on ? ' on' : '');
    var num;
    if (k === 'queda' && !CASO.queda) num = '<span class="nm-h" aria-hidden="true"></span><span class="sr">não medido até ' + A.dm(D.QUEDA_INICIO) + '</span>';
    else if (k !== 'todos' && n === 0) num = '<b class="num ls-z">0</b>';
    else num = '<b class="num">' + n + '</b>';
    return '<button type="button" class="' + cls + '" data-filtro="' + k + '" aria-pressed="' + on + '">' + ic + '<span>' + NOMES_EST[k] + '</span>' + num + '</button>';
  }
  function filtros(n){
    return '<div class="ls-fg" role="group" aria-label="Filtrar canais por estado">' + chip('todos', n.n) + chip('parados', n.par) + chip('queda', n.qd) + chip('fora', n.fo) + chip('erro', n.er) + '</div>';
  }
  function toolbar(n){
    return '<div class="c2-tool ls-tool"><span class="c2-busca"><svg class="i" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>Buscar canal</span><span class="c2-seg" aria-hidden="true"><b>Todos</b><span>Longos</span><span>Shorts</span></span><span class="c2-seg" aria-hidden="true"><b>Absoluto</b><span>Por mil inscritos</span></span><span class="c2-seg" aria-hidden="true"><b>Tabela</b><span>Cards</span></span>' + '<span class="c2-gap"></span><span class="ex">números de exemplo</span><span class="c2-quota"><span class="num">' + CASO.quota.split(' de ')[0] + '</span> de <span class="num">' + CASO.quota.split(' de ')[1].replace(' canais', '') + '</span> canais</span></div>';
  }
  /* faixa da base: uma linha + legenda dos símbolos; o método completo fica no ⓘ */
  function faixaBase(){
    var cruza = CASO.hoje < D.CRUZA_ATE ? '<p class="ls-bs-av">' + IC.aviso + '<span>Até <b>' + A.dm(D.CRUZA_ATE) + '</b> os 56 dias cruzam a mudança de contagem de 24/08/2026.</span></p>' : '';
    return '<div class="ls-bs c2-novo"><span class="c2-tag">+ novo</span><p class="ls-bs-t"><b>Direção:</b> views dos últimos 28 dias contra os 28 anteriores, cada canal contra ele mesmo.</p><ul class="ls-lg"><li><span class="ls-sy2 up" aria-hidden="true">▲</span>subindo, +10% ou mais</li><li><span class="ls-sy2 eq" aria-hidden="true">＝</span>sem mudança</li><li><span class="ls-sy2 dn" aria-hidden="true">▼</span>descendo, −10% ou menos</li><li><span class="nm-h" aria-hidden="true"></span>não medido, com o motivo</li></ul>' + cruza + '</div>';
  }
  /* ---------------------------------------------------------------- estados vazios e de carregamento */
  function vazio(n){
    var f = EST.filtro, t, d, ic, btn = '<button type="button" class="btn big" data-filtro="todos">Ver todos os ' + n.n + ' canais</button>';
    if (n.n === 0) { return '<div class="ls-vz"><span class="ls-vz-i"><b class="num ls-z">0</b></span><div><p class="ls-vt">Nenhum canal neste nicho</p><p class="ls-vd">Os canais acompanhados em ' + esc(EST.nicho) + ' aparecem aqui quando você adiciona um.</p></div></div>'; }
    if (EST.dir && !(f === 'queda' && !CASO.queda)) {
      var VD = { up: ['Nenhum canal subindo', 'ganhou 10% ou mais de views neste período'], eq: ['Nenhum canal sem mudança', 'ficou entre −10% e +10% neste período'], dn: ['Nenhum canal descendo', 'perdeu 10% ou mais de views neste período'], nm: ['Nenhum canal sem direção medida', 'tem menos de 56 dias de registro'] }[EST.dir];
      t = VD[0]; ic = '<b class="num ls-z">0</b>';
      d = f === 'todos' ? 'Nenhum dos ' + n.n + ' canais ' + VD[1] + '.' : 'Entre os canais do filtro “' + NOMES_EST[f] + '”, nenhum ' + VD[1].replace(/ neste período$/, '') + ' neste período.';
    } else if (f === 'queda' && !CASO.queda) {
      var d62 = diasAte(D.QUEDA_INICIO);
      t = 'Em queda ainda não pode ser medido'; ic = '<span class="nm-h big" aria-hidden="true"></span>';
      d = 'Essa leitura pede 3 períodos de 28 dias seguidos depois da mudança de contagem de 24/08/2026. O primeiro dia possível é <b>' + A.dmy(D.QUEDA_INICIO) + '</b>, daqui a ' + dias(d62) + '. Até lá, só dá para ver quem está descendo (▼) neste período: ' + n.dn + ' ' + (n.dn === 1 ? 'canal' : 'canais') + '.';
    } else if (f === 'parados') { t = 'Nenhum canal parado'; ic = '<b class="num ls-z">0</b>'; d = 'Todos os ' + n.n + ' canais publicaram dentro do prazo habitual de cada um.'; }
    else if (f === 'queda') { t = 'Nenhum canal em queda'; ic = '<b class="num ls-z">0</b>'; d = 'Nenhum canal ficou com ▼ por 3 períodos de 28 dias seguidos.'; }
    else if (f === 'fora') { t = 'Nenhum canal saiu do YouTube'; ic = '<b class="num ls-z">0</b>'; d = 'O YouTube respondeu por todos os canais nas duas últimas leituras.'; }
    else { t = 'Nenhum canal em erro'; ic = '<b class="num ls-z">0</b>'; d = 'Todos os canais sincronizaram na última rodada.'; }
    return '<div class="ls-vz' + (f === 'queda' && !CASO.queda ? ' nmv' : '') + '" role="status"><span class="ls-vz-i">' + ic + '</span><div><p class="ls-vt">' + t + '</p><p class="ls-vd">' + d + '</p><p class="ls-va">' + btn + '</p></div></div>';
  }
  function carregando(){
    var rows = ''; for (var i = 0; i < 6; i++) rows += '<li class="ls-sk-r"><span class="ls-sk av"></span><span class="ls-sk-c"><span class="ls-sk w1"></span><span class="ls-sk w2"></span></span><span class="ls-sk-d"><span class="ls-sk w3"></span><span class="ls-sk w4"></span></span><span class="ls-sk w5 ls-sk-x"></span><span class="ls-sk w5 ls-sk-x"></span></li>';
    return L.novo('<div class="ls-res" aria-busy="true"><p class="ls-fr"><span>Contando os canais e lendo a direção de cada um…</span></p><ul class="ls-bar ls-bar-sk" aria-hidden="true"><li class="ls-sg sk"><span class="ls-sb"></span></li><li class="ls-sg sk"><span class="ls-sb"></span></li><li class="ls-sg sk"><span class="ls-sb"></span></li><li class="ls-sg sk"><span class="ls-sb"></span></li></ul></div>', 'novo', 'ls-rn') +
      '<div class="c2-tool ls-tool"><span class="c2-busca"><svg class="i" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>Buscar canal</span>' + L.novo('<div class="ls-fg" role="group" aria-label="Filtrar canais por estado" aria-busy="true">' + ['Todos', 'Parados', 'Em queda', 'Saíram do YouTube', 'Em erro'].map(function(t){ return '<span class="ls-f ls-f-sk"><span>' + t + '</span><b class="num">…</b></span>'; }).join('') + '</div>', 'novo', 'ls-fn') + '</div>' +
      '<div class="ls-tw ls-sk-w" role="status" aria-live="polite"><p class="sr">Carregando a lista de canais</p><ul class="ls-sk-l" aria-hidden="true">' + rows + '</ul></div>';
  }

  /* ---------------------------------------------------------------- cabeçalho do Observatório (o de produção; o filtro de nicho é interativo) */
  function cabecalho(set, nAll){
    var n = nAll;
    var freshExtra = '';
    if (n.er) freshExtra += '<i class="c2-sp"></i><span class="c2-fs er-fs">' + IC.aviso + '<b>' + L.pl(n.er, 'canal em erro', 'canais em erro') + '</b></span>';
    if (n.fo) freshExtra += '<i class="c2-sp"></i><span class="c2-fs er-fs">' + IC_FORA + '<b>' + n.fo + (n.fo === 1 ? ' saiu' : ' saíram') + ' do YouTube</b></span>';
    var fresh = '<span class="c2-fresh' + (n.er ? ' er-fresh' : '') + '"><span class="c2-fs"><i class="c2-dot"></i><b>' + L.pl(n.n, 'canal', 'canais') + '</b></span><i class="c2-sp"></i><span class="c2-fs">sincronizado há 3 h</span>' + (freshExtra || '<i class="c2-sp"></i><span class="c2-fs">todos em dia</span>') + IC.chev + '</span>';
    var h = L.obs({ aba: 'Canais', nCanais: CASO.canais.length, fresh: fresh, fila: n.fo ? n.fo : undefined });
    var i = h.indexOf('<div class="c2-niche">');
    var nichos = ['Viagem', 'IA', 'Humor'].filter(function(t){ return CASO.canais.length > 20 || CASO.nicho[t] != null; });
    var sw = { Viagem: '<i class="c2-sw v"></i>', IA: '<i class="c2-sw a"></i>', Humor: '<i class="c2-sw h"></i>' };
    var btns = '<button type="button" class="ls-nb" data-nicho="" aria-pressed="' + (!EST.nicho) + '">Todos<span class="c2-nn">' + CASO.canais.length + '</span></button>' + nichos.map(function(t){ return '<button type="button" class="ls-nb" data-nicho="' + t + '" aria-pressed="' + (EST.nicho === t) + '">' + sw[t] + t + '<span class="c2-nn">' + (CASO.nicho[t] || 0) + '</span></button>'; }).join('');
    h = h.slice(0, i) + '<div class="c2-niche"><span class="c2-nl" id="ls-nl">Nicho</span><span class="ls-nbg" role="group" aria-labelledby="ls-nl">' + btns + '</span></div></div></div>';
    h = h.replace('<div class="c2-obs" aria-hidden="true">', '<div class="c2-obs">').replace('<div class="c2-oh">', '<div class="c2-oh" aria-hidden="true">').replace('<div class="c2-fr">', '<div class="c2-fr" aria-hidden="true">').replace('<nav class="c2-otabs"', '<nav class="c2-otabs" aria-hidden="true"');
    if (CASO.leitura) { var k = h.indexOf('<div class="c2-fr"'); h = h.slice(0, k) + avisoLeitura() + h.slice(k); }
    if (CASO.leitura) h = h.replace('<span class="c2-ob">' + IC.sync, '<span class="c2-ob ls-off">' + IC.sync).replace('<span class="c2-ob">' + IC.plus, '<span class="c2-ob ls-off">' + IC.plus);
    return h;
  }
  function metodo(){
    return A.oculto('infoDir', 'Como a direção e o estado são calculados', '<ul><li><b>Direção:</b> views que o canal ganhou nos últimos 28 dias, divididas pelas dos 28 dias anteriores, de cada canal contra ele mesmo. ▲ se subiu 10% ou mais, ▼ se caiu 10% ou mais, ＝ no meio. Os dois números ao lado do percentual são os que entram na conta. A régua vai de −50% a +50%; a faixa tracejada no meio é o “sem mudança” (−10% a +10%); passou do limite, a ponta vira triângulo.</li><li><b>Parado:</b> dias sem publicar acima do maior entre 28 dias e 4 vezes o intervalo habitual do canal. Canal que publica por temporada pode parecer parado.</li><li><b>Em queda:</b> ▼ em 3 períodos de 28 dias seguidos. Pede 3 períodos de 28 dias seguidos depois da mudança de contagem de 24/08/2026; o primeiro dia possível é 14/12/2026.</li><li><b>Saiu do YouTube:</b> o YouTube não achou o canal em duas leituras seguidas; os números param na data.</li><li><b>Não medido:</b> menos de 56 dias de registro, dia sem registro, ou a contagem não existe. No seu canal, o YouTube não dá o número por dia.</li><li>Inclui Shorts e vídeos depois apagados. Inscritos não entram: o YouTube os arredonda.</li><li>Cálculo do Observatório sobre dados públicos do YouTube.</li></ul>');
  }
  function avisoLeitura(){
    if (!CASO.leitura) return '';
    return '<div class="ls-ro" id="ls-ro">' + IC_LOCK + '<p id="ls-ro-t"><b>Você só pode ler esta lista.</b> Sincronizar, adicionar e remover canais ficam desligados. Esta lista só tem números públicos do YouTube, então você vê tudo o que os outros veem.</p></div>';
  }

  /* ---------------------------------------------------------------- montagem */
  function corpo(){
    var nSet = filtrados(), nAll = conta(nSet);
    var lista = nSet.filter(function(c){ return EST.filtro === 'parados' ? c.par : EST.filtro === 'queda' ? c.qd : EST.filtro === 'fora' ? !!c.fo : EST.filtro === 'erro' ? !!c.er : true; }).filter(function(c){ return !EST.dir || (c.dir ? c.dir.k === EST.dir : EST.dir === 'nm'); });
    var mostrar = Math.min(lista.length, INICIAL + EST.mais * PASSO);
    var cab = cabecalho(nSet, conta(CASO.canais));
    if (CASO.carregando) return cab + carregando() + metodo();
    var meio;
    if (!lista.length) meio = vazio(nAll);
    else {
      meio = tabela(lista.slice(0, mostrar), lista.length) +
        (lista.length > mostrar ? '<p class="ls-mais"><span>Mostrando <b class="num">' + mostrar + '</b> de <b class="num">' + lista.length + '</b> canais.</span><button type="button" class="btn big" data-mais="1">Mostrar mais ' + Math.min(PASSO, lista.length - mostrar) + '</button></p>' : (EST.filtro !== 'todos' || EST.nicho || EST.dir ? '<p class="ls-mais"><span>Mostrando <b class="num">' + lista.length + '</b> de <b class="num">' + CASO.canais.length + '</b> canais.</span></p>' : ''));
    }
    return cab + resumo(nAll) + toolbar(nAll) + (lista.length ? faixaBase() : '') + meio + metodo();
  }
  var CASOS = [['tipico', 'Típico, 13/10 (15 canais)'], ['completo', 'Dezembro: queda já medida'], ['extremo', 'Extremo (nada subindo)'], ['zero', 'Zero parados e em queda'], ['magro', 'Magro: não medido'], ['erro', 'Canais em erro'], ['fora', 'Canal saiu do YouTube'], ['carregando', 'Carregando'], ['leitura', 'Só leitura'], ['muitos', '78 canais']];
  var FILTROS = [['todos', 'Todos'], ['parados', 'Parados'], ['queda', 'Em queda'], ['fora', 'Saíram do YouTube'], ['erro', 'Em erro']];
  function fora(){
    return '<div class="tbw" style="max-width:1000px"><table class="tb"><caption>As pastilhas de estado e o que cada uma diz</caption><thead><tr><th scope="col">Estado (M8)</th><th scope="col">Forma</th><th scope="col">Quando aparece</th><th scope="col">Linha de apoio</th></tr></thead><tbody>' +
      '<tr><th scope="row">Ativo</th><td data-l="Forma"><span class="ls-at">' + IC.video + '<span>Ativo, publicou há 3 dias</span></span></td><td data-l="Quando aparece">nenhum dos outros vale</td><td data-l="Linha de apoio">sem pastilha: o normal fica quieto</td></tr>' +
      '<tr><th scope="row">Parado</th><td data-l="Forma"><span class="ls-p par">' + IC.pausa + '<span>Parado há 52 dias sem publicar</span></span></td><td data-l="Quando aparece">dias sem publicar acima do maior entre 28 e 4 vezes o intervalo habitual</td><td data-l="Linha de apoio">“Publica a cada 9 dias.”</td></tr>' +
      '<tr><th scope="row">Em queda</th><td data-l="Forma"><span class="ls-p qd"><span class="ls-qs" aria-hidden="true">▼</span><span>Em queda sustentada</span></span></td><td data-l="Quando aparece">▼ em 3 períodos de 28 dias seguidos (só a partir de 14/12/2026)</td><td data-l="Linha de apoio">“3 períodos de 28 dias.”</td></tr>' +
      '<tr><th scope="row">Saiu do YouTube</th><td data-l="Forma"><span class="ls-p fo">' + IC_FORA + '<span>Saiu do YouTube em 04/10</span></span></td><td data-l="Quando aparece">o YouTube não achou o canal em 2 leituras seguidas</td><td data-l="Linha de apoio">“Sem resposta do YouTube em 2 leituras.”</td></tr>' +
      '<tr><th scope="row">Em erro</th><td data-l="Forma"><span class="er-p alarme">' + IC.aviso + '<span>Em erro há 2 dias</span></span></td><td data-l="Quando aparece">a sincronização falhou (a escada do lote 1, sem mudança)</td><td data-l="Linha de apoio">motivo, e-mail e “Sincronizar agora”</td></tr>' +
      '<tr><th scope="row">Sem vídeos</th><td data-l="Forma"><span class="ls-p sv">' + IC.video + '<span>Sem vídeos</span></span></td><td data-l="Quando aparece">o canal ainda não publicou</td><td data-l="Linha de apoio">“Ainda não publicou nada.”</td></tr>' +
      '<tr><th scope="row">Inscritos ocultos</th><td data-l="Forma"><span class="nm">inscritos ocultos</span></td><td data-l="Quando aparece">o canal esconde o número</td><td data-l="Linha de apoio">no lugar do número de inscritos; nunca um 0</td></tr></tbody></table></div>';
  }
  function montar(){
    var y = window.scrollY, foco = document.activeElement && document.activeElement.getAttribute && (document.activeElement.getAttribute('data-filtro') != null ? '[data-filtro="' + document.activeElement.getAttribute('data-filtro') + '"]' : document.activeElement.hasAttribute('data-dir') ? '[data-dir="' + document.activeElement.getAttribute('data-dir') + '"]' : document.activeElement.hasAttribute('data-nicho') ? '[data-nicho="' + document.activeElement.getAttribute('data-nicho') + '"]' : document.activeElement.hasAttribute('data-mais') ? '[data-mais]' : null);
    var aberta = document.getElementById('mock') && document.getElementById('mock').open;
    document.querySelectorAll('.pop').forEach(function(p){ p.remove(); });
    var barra = L.barra([{ rotulo: 'Caso', param: 'caso', itens: CASOS, padrao: 'tipico' }, { rotulo: 'Filtro de estado', param: 'filtro', itens: FILTROS, padrao: 'todos' }],
      'A tela é a Lista de Canais já aprovada (mockup 8 e lote 1, tela C), com canais de exemplo. Contorno verde-água e “+ novo” = o que esta proposta acrescenta: o resumo com a barra de direção, os filtros de estado, a faixa da base, a coluna Direção e a linha de estado sob o nome. A linha em erro é a do lote 1. Os botões de filtro e de nicho dentro da tela funcionam. <b>Hoje é ' + A.dmy(CASO.hoje) + '</b>' + (CASO.hoje > D.HOJE_TIPICO ? ' (exemplo de como a lista fica depois de 14/12/2026, quando a queda passa a ser medida).' : '.'));
    A.moldura({ titulo: 'Lista de Canais com direção e estado', barra: barra, corpo: corpo(), fora: fora() });
    if (aberta) document.getElementById('mock').open = true;
    A.ligarInfos();
    window.scrollTo(0, y);
    if (foco) { var e = document.querySelector(foco); if (e) e.focus({ preventScroll: true }); }
  }
  function lembrar(){ try { var p = new URLSearchParams(location.search); if (EST.filtro !== 'todos') p.set('filtro', EST.filtro); else p.delete('filtro'); if (EST.nicho) p.set('nicho', EST.nicho); else p.delete('nicho'); if (EST.dir) p.set('dir', EST.dir); else p.delete('dir'); history.replaceState(null, '', location.pathname.split('/').pop() + (p.toString() ? '?' + p.toString() : '')); q.delete('filtro'); q.delete('nicho'); q.delete('dir'); if (EST.filtro !== 'todos') q.set('filtro', EST.filtro); if (EST.nicho) q.set('nicho', EST.nicho); if (EST.dir) q.set('dir', EST.dir); } catch (e) { /* sem histórico: a tela funciona igual */ } }
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-filtro],[data-nicho],[data-mais],[data-dir]'); if (!b) return;
    if (b.hasAttribute('data-dir')) { var kd = b.getAttribute('data-dir'); EST.dir = EST.dir === kd ? '' : kd; EST.mais = 0; }
    else if (b.hasAttribute('data-filtro')) { EST.filtro = b.getAttribute('data-filtro'); if (EST.filtro === 'todos') EST.dir = ''; EST.mais = 0; }
    else if (b.hasAttribute('data-nicho')) { EST.nicho = b.getAttribute('data-nicho'); EST.mais = 0; }
    else if (b.hasAttribute('data-mais')) { EST.mais++; }
    lembrar(); montar();
  });
  if (!{ todos: 1, parados: 1, queda: 1, fora: 1, erro: 1 }[EST.filtro]) EST.filtro = 'todos';
  montar();
})();

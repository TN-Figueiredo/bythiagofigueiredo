/* m13.js: mockup 13 da A5 (lote 2), Histórico do vídeo de concorrente. Parâmetros: ?caso=cheio|extremo|magro|recente|zero|naomedido|semanal|saiu|mantido|aovivo|vazio|carregando|erro|leitura  ?tema=claro
   Tudo é EXEMPLO (canais e vídeos inventados). Os casos "magro" e "recente" reproduzem a situação real de hoje (13/10/2026) com dados inventados: a subida e a curva de 30 dias só existem a partir de novembro, por isso
   os casos "cheio", "extremo", "semanal" e "leitura" vivem num dia de exemplo (11/11/2026) e a tela diz isso no topo.
   Regras que a tela cumpre: frase-resumo por bloco; régua (pares de barras e régua de 72 horas); cor estável (azul = o vídeo, areia = o normal do canal, verde só para subida, rosa hachurado = não medido,
   caixa vazada = zero medido, pontilhado = ainda não existe); símbolo junto da cor; método no ⓘ; sem color-mix(); nada afirma causa. */
(function(){
  'use strict';
  var A = window.A4, L = window.L1, D = window.M13D, G = window.M13G, q = A.q, esc = A.esc, vn = G.vn;
  var caso = q.get('caso') || 'cheio', HOJE = '2026-10-13', FUT = '2026-11-11';
  function pad(n){ return ('0' + n).slice(-2); }
  function hm(h, m){ return pad(h) + ':' + pad(m); }
  function dec1(x){ return A.dec(x, 1); }
  function vezes(r){ return dec1(r) + (r < 2 ? ' vez' : ' vezes'); }
  function xr(r){ return r >= 1.1 ? dec1(r) + '× o normal' : r <= .9 ? dec1(r) + '× o normal, abaixo' : '＝ perto do normal'; }
  var VZ_DESC = [18, 0]; /* r9-S3: hora da descoberta do vídeo do estado vazio */
  function soN(n, zero){ return n === 0 ? zero : 'só ' + n + ' ' + (n === 1 ? 'vídeo' : 'vídeos'); } /* r9-S1: zero medido não vira "só 0" */
  function idadeTxt(a){ return a === 1 ? '1 dia' : a + ' dias'; }
  function ex(){ return '<span class="ex">exemplo</span>'; }
  var IC = L.IC;
  var ICN = {
    sumiu: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.6 8s2.4-4.4 6.4-4.4S14.4 8 14.4 8s-2.4 4.4-6.4 4.4S1.6 8 1.6 8Z"/><circle cx="8" cy="8" r="1.8"/><path d="M2.4 13.6 13.6 2.4"/></svg>',
    erro: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><path d="M8 4.6v3.8M8 11v.1"/></svg>',
    cadeado: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="6.6" rx="1.6"/><path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7"/></svg>',
    live: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2"/><path d="M4.6 4.6a4.8 4.8 0 0 0 0 6.8M11.4 4.6a4.8 4.8 0 0 1 0 6.8"/></svg>',
    meio: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 2v12" /><path d="M8 2a6 6 0 0 1 0 12Z" fill="currentColor"/></svg>'
  };
  var GV = '<svg class="hv-g" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="var(--lado-b)"/></svg>';
  var GN = '<svg class="hv-g" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="1.8" y="1.8" width="10.4" height="10.4" rx="1.5" fill="none" stroke="var(--lado-n)" stroke-width="2.2"/></svg>';

  /* ---------------------------------------------------------------- os casos (exemplo) */
  /* FONTE ÚNICA do n do normal do canal (r3, varredura de coerência): as datas de publicação dos OUTROS vídeos do canal. O n de cada idade é a contagem dos que já chegaram a ela
     (publicados desde 03/10, quando a contagem por dia começou, e com publicação + idade até o dia da tela). Nenhum n é digitado em outro lugar. */
  var PUBS_OUTROS = ['2026-10-03', '2026-10-06', '2026-10-07', '2026-10-11', '2026-10-12', '2026-10-15', '2026-10-18', '2026-10-22', '2026-10-25', '2026-10-28', '2026-10-31', '2026-11-03', '2026-11-06', '2026-11-08'];
  function nsEm(hoje){ return D.IDADES.map(function(a){ return PUBS_OUTROS.filter(function(d){ return d >= D.INICIO_DIARIA && D.addDias(d, a) <= hoje; }).length; }); }
  /* teto do n das 72 horas: só vídeos publicados desde a contagem por hora (04/10) e com 3 dias completos até o dia da tela */
  function teto72(hoje){ return PUBS_OUTROS.filter(function(d){ return d >= D.INICIO_HORA && D.addDias(d, 3) <= hoje; }).length; }
  var NECESSARIOS = 15;  /* leituras por dia para medir a subida: 7 antes + o dia + 7 depois (M5); fonte única do texto, da conta e do aviso */
  var CASOS = {
    cheio: { agora: FUT, futuro: 1, nMud: 31, t: 'Chiang Mai por 600 euros: dá?', canal: 'Nômade Raiz', av: 'N', nicho: 'Viagem', dur: 862, pub: ['2026-10-08', 20, 40], esc: 1, p: { seed: 7, A: 300, tau: 26, B: 35, burst: { s: 183, peak: 520, ramp: 12, tb: 130 } },
      m14: { q25: 9, q50: 20, q75: 41 },
      trocas: [{ d: '2026-10-11', tipo: 't', campos: ['título'], prec: '6h', a: '06:00', b: '12:00', de: 'Chiang Mai por 600 euros', para: 'Chiang Mai por 600 euros: dá?' }, { d: '2026-10-13', tipo: 'm', campos: ['miniatura'], prec: '1d' }, { d: '2026-10-18', tipo: 'o', campos: ['descrição'], prec: '6h', a: '12:00', b: '18:00' }, { d: '2026-11-02', tipo: 'o', campos: ['tags', 'categoria'], prec: '1d' }] },
    extremo: { agora: FUT, futuro: 1, nMud: 31, t: 'O erro de R$ 4.000 que quase estragou minha viagem a Lisboa (e como evitar)', canal: 'Lucas Bigodinho', av: 'L', nicho: 'Viagem', dur: 1214, pub: ['2026-10-09', 18, 20], esc: 1.4, p: { seed: 21, A: 2400, tau: 30, B: 260, burst: { s: 182, peak: 5200, ramp: 10, tb: 150 } },
      m14: { q25: 6, q50: 14, q75: 33 },
      trocas: [['2026-10-10', 't'], ['2026-10-10', 'm'], ['2026-10-11', 'm'], ['2026-10-11', 't'], ['2026-10-12', 'm'], ['2026-10-12', 'm'], ['2026-10-13', 't'], ['2026-10-13', 'o', 'descrição'], ['2026-10-14', 'm'], ['2026-10-14', 't'], ['2026-10-15', 'o', 'tags'], ['2026-10-16', 'm'], ['2026-10-25', 'o', 'capítulos'], ['2026-11-03', 't']].map(function(x){ return { d: x[0], tipo: x[1], campos: [x[1] === 't' ? 'título' : x[1] === 'm' ? 'miniatura' : x[2]], prec: '1d' }; }) },
    magro: { agora: HOJE, t: 'Tailândia em 10 dias: o roteiro completo', canal: 'Nômade Raiz', av: 'N', nicho: 'Viagem', dur: 1122, pub: ['2026-09-03', 10, 0], esc: 1, antes03: 1, semHoras: 1, p: { seed: 11, A: 70, tau: 200, B: 9, horas: false },
      trocas: [{ d: '2026-10-09', tipo: 't', campos: ['título'], prec: '1d', de: 'Tailândia em 10 dias', para: 'Tailândia em 10 dias: o roteiro completo' }] },
    recente: { agora: HOJE, t: 'Os 5 piores erros em Bangkok', canal: 'Nômade Raiz', av: 'N', nicho: 'Viagem', dur: 665, pub: ['2026-10-10', 11, 20], esc: 1, m14: { q25: null, q50: null, q75: null }, p: { seed: 5, A: 330, tau: 24, B: 40 },
      trocas: [{ d: '2026-10-12', tipo: 'm', campos: ['miniatura'], prec: '6h', a: '00:00', b: '06:00' }] },
    zero: { agora: HOJE, t: 'Mochilão pelo sul da Itália, parte 2', canal: 'Leo', av: 'L', nicho: 'Viagem', dur: 1480, pub: ['2026-10-04', 9, 10], esc: .03, m14: { q25: null, q50: null, q75: null }, p: { seed: 3, A: 1.6, tau: 16, B: .03 }, trocas: [] },
    naomedido: { agora: HOJE, t: 'Quanto custa viver em Chiang Mai em 2026', canal: 'Dale Philip', av: 'D', nicho: 'Viagem', dur: 934, pub: ['2026-10-05', 8, 0], esc: .8, desde: '2026-10-08', buraco: '2026-10-11', m14: { q25: null, q50: null, q75: null }, p: { seed: 9, A: 260, tau: 22, B: 30, descoberto: 76, buracos: ['2026-10-11'] }, trocas: [{ d: '2026-10-11', tipo: 'm', campos: ['miniatura'], prec: 'gap', a: '2026-10-10', b: '2026-10-12' }] },
    semanal: { agora: FUT, futuro: 1, nMud: 31, t: 'Vietnã de moto: 12 dias e 1.800 km', canal: 'Paddy Doyle', av: 'P', nicho: 'Viagem', dur: 2210, pub: ['2026-08-11', 17, 30], esc: .6, semanal: 1, p: { seed: 14, A: 90, tau: 60, B: 30, burst: { s: 1660, peak: 34, ramp: 30, tb: 90 } }, trocas: [{ d: '2026-10-21', tipo: 't', campos: ['título'], prec: '1d' }] },
    saiu: { agora: HOJE, t: 'Cuidado com este golpe em Bangkok', canal: 'Lodir', av: 'L', nicho: 'Viagem', dur: 548, pub: ['2026-10-04', 16, 0], esc: 1, m14: { q25: null, q50: null, q75: null }, saiu: '2026-10-09', p: { seed: 17, A: 240, tau: 20, B: 28, fimDia: '2026-10-08' }, trocas: [{ d: '2026-10-06', tipo: 't', campos: ['título'], prec: '1d' }] },
    aovivo: { agora: HOJE, t: 'Ao vivo: tire suas dúvidas sobre morar fora', canal: 'Aldinho', av: 'A', nicho: 'Viagem', dur: 5420, pub: ['2026-10-08', 19, 0], esc: 1.1, live: 1, m14: { q25: null, q50: null, q75: null }, p: { seed: 25, A: 190, tau: 30, B: 60 }, trocas: [{ d: '2026-10-09', tipo: 't', campos: ['título'], prec: '6h', a: '06:00', b: '12:00' }] },
    vazio: { agora: HOJE, t: 'Como é ser nômade digital em Lisboa', canal: 'Nômade Raiz', av: 'N', nicho: 'Viagem', dur: 1015, pub: ['2026-10-13', 17, 10], esc: 1, vazio: 1, trocas: [] },
    carregando: { agora: HOJE, t: 'Os 5 piores erros em Bangkok', canal: 'Nômade Raiz', av: 'N', nicho: 'Viagem', dur: 665, pub: ['2026-10-10', 11, 20], esc: 1, carregando: 1 },
    erro: { agora: HOJE, t: 'Os 5 piores erros em Bangkok', canal: 'Nômade Raiz', av: 'N', nicho: 'Viagem', dur: 665, pub: ['2026-10-10', 11, 20], esc: 1, erro: 1 }
  };
  CASOS.mantido = JSON.parse(JSON.stringify(CASOS.saiu)); CASOS.mantido.mantido = 1; CASOS.mantido.t = 'Cuidado com este golpe em Bangkok';
  CASOS.leitura = JSON.parse(JSON.stringify(CASOS.cheio)); CASOS.leitura.leitura = 1;
  /* R3-C3: as datas das leituras semanais saem de UMA lista; o texto do bloco de idade e o gráfico semanal leem a mesma primeira data */
  var SEM_DATAS = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09'];
  var c = CASOS[caso] || CASOS.cheio; c.caso = caso; c.ns = nsEm(c.agora); if (c.m14) c.m14.n = teto72(c.agora); /* r6-C3: o n do normal das 72 horas SÓ sai da lista do canal; nenhum n digitado */
  c.pubD = c.pub[0]; c.pubH = c.pub[1]; c.pubM = c.pub[2]; c.pubTxt = hm(c.pubH, c.pubM);
  c.thumb = L.cor(c.t);

  /* r9-S6: a data em que a contagem diária alcança o vídeo que entrou tarde sai de pub + descoberto (horas); nada de 76 ou 08/10 digitado em outro lugar */
  if (c.desde && c.p && c.p.descoberto != null) c.desde = D.addDias(c.pubD, Math.floor((c.pubH + c.pubM / 60 + c.p.descoberto) / 24));
  var P = Object.assign({ pub: c.pubD, h: c.pubH, m: c.pubM, agora: c.agora }, c.p || {});
  if (c.vazio || c.carregando || c.erro) P = null;
  if (c.saiu) P.agora = c.p.fimDia;
  var v = P ? D.gerar(P) : null; c.v = v;
  if (c.p && c.p.horas === false) c.semHoras = 1;
  c.normal = D.normalCurva(c.esc, c.ns);
  c.trocas = (c.trocas || []).map(function(t, i){ t.n = i + 1; return t; }).sort(function(a, b){ return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; }).map(function(t, i){ t.n = i + 1; return t; });

  /* a série por dia que a tela mostra: nunca antes de 03/10 (a contagem por dia começou lá); dia sem contagem fica "não medido" com o motivo */
  var dias = [];
  if (v) {
    dias = v.dias.filter(function(x){ return x.d >= D.INICIO_DIARIA || x.e === 'pub'; });
    if (c.antes03) { dias = dias.filter(function(x){ return x.e !== 'pub'; }); dias[0] = { d: dias[0].d, v: null, e: 'nm', motivo: 'primeira contagem: o vídeo já tinha ' + A.n(dias[0].cum) + ' views quando a contagem por dia começou (' + A.dm(D.INICIO_DIARIA) + ')', cum: dias[0].cum, primeira: 1 }; }
    if (c.desde) dias.forEach(function(x){ if (x.e !== 'pub' && x.d <= c.desde) { x.e = 'nm'; x.motivo = x.d < c.desde ? 'entrou tarde na contagem: o vídeo só entrou em ' + A.dm(c.desde) : 'primeira contagem do vídeo (' + A.n(x.cum) + ' views no total); sem a anterior, não dá para dizer quanto ganhou no dia'; x.v = null; } });
    dias.forEach(function(x){ if (x.e === 'nm' && !x.motivo && x.junto != null) x.motivo = 'a contagem das 12:00 de ' + A.dm(c.buraco) + ' não veio, e sem ela os dois dias não se separam.'; });
  }
  c.dias = dias;
  var ultD = dias.length ? dias[dias.length - 1] : null;
  function viewsAgora(){ return v ? v.total : c.vazio ? 312 : c.carregando || c.erro ? null : 0; }
  var total = viewsAgora();

  /* ---------------------------------------------------------------- idades (M1/M2) */
  function fechaEm(a){ var noon0 = (24 - (c.pubH + c.pubM / 60)) + 12; return A.dm(D.addDias(c.pubD, Math.max(0, Math.ceil((a * 24 - noon0) / 24)) + 1)); }
  function idadeEstado(a){
    if (!v) return { st: 'fut', quando: fechaEm(a) };
    /* r3: o motivo "antes de 03/10" vale só para a idade cujo instante cai até 03/10 (a 1ª contagem é às 12:00 desse dia); idade que cai depois segue a regra normal (existe ou ainda não existe) */
    if (c.antes03 && D.addDias(c.pubD, a) <= D.INICIO_DIARIA) return { st: 'nm', mot: 'publicado antes de ' + A.dm(D.INICIO_DIARIA) + ': a contagem por dia começou em ' + A.dm(D.INICIO_DIARIA) + '', curto: 'publicado antes de ' + A.dm(D.INICIO_DIARIA) + '' };
    if (c.semanal) return { st: 'nm', mot: 'o vídeo já tinha mais de 30 dias quando a contagem começou', curto: 'contagem por semana' };
    if (a * 24 > v.tLast + 1e-6) return c.saiu ? { st: 'nm', mot: 'o vídeo saiu do YouTube antes desta idade' } : { st: 'fut', quando: fechaEm(a) };
    if (c.desde) {
      if (a === 1) return { st: 'nm', mot: 'entrou tarde na contagem: ' + c.p.descoberto + ' horas depois de publicado', curto: 'entrou tarde na contagem' };
      var te = a * 24, j = Math.floor((te - v.noon0) / 24), r0 = v.dias[j + 1], r1 = v.dias[j + 2];
      if (!r0 || r0.e === 'nm' || (r1 && r1.e === 'nm') || r0.d <= c.desde) { var tarde = r0 && r0.d <= c.desde; return { st: 'nm', curto: tarde ? 'entrou tarde na contagem' : 'contagens a mais de 36 h', mot: tarde ? 'entrou tarde na contagem: antes da primeira contagem (' + A.dm(c.desde) + ')' : 'contagens vizinhas a mais de 36 horas (falta a contagem de ' + A.dm(c.buraco) + ')' }; }
    }
    var val = v.cumNaIdade(a); return val == null ? { st: 'nm', mot: 'sem contagem nesta idade' } : { st: 'ok', v: val };
  }
  /* B3: a frase sai pronta daqui e ninguém concatena " o normal" depois; "＝" marca o "perto do normal" (como no lote 1) */
  function razao(r){ return r >= 1.1 ? vezes(r) + ' o normal' : r <= .9 ? vezes(r) + ' o normal, abaixo' : 'perto do normal'; }
  function razaoS(r){ return (r > .9 && r < 1.1 ? '＝ ' : '') + razao(r); }
  var IDADES = D.normalCurva(c.esc, c.ns).map(function(nm){
    var a = nm.idade, e = idadeEstado(a), x = { a: a, rot: a + ' d', vst: e.st, v: e.v, nor: c.live ? null : nm.v, n: nm.n, mot: e.mot, curto: e.curto, quando: e.quando };
    var cab = 'Com ' + idadeTxt(a) + ': ';
    var ne = c.live ? '' : (nm.v == null ? ' O normal do canal: não medido, ' + soN(nm.n, 'nenhum vídeo chegou a esta idade') + ' (o mínimo é 3).' : ' O normal do canal: ' + A.n(nm.v) + ' views (' + nm.n + ' vídeos).');
    x.fala = e.st === 'ok' ? cab + 'o vídeo tinha ' + A.n(e.v) + ' views.' + (nm.v != null && !c.live ? ' O normal do canal: ' + A.n(nm.v) + ' (' + nm.n + ' vídeos): ' + razao(e.v / nm.v) + '.' : ne)
      : e.st === 'fut' ? cab + 'ainda não existe; fecha em ' + e.quando + '.' + (a > 30 ? ' O primeiro vídeo do canal chega a esta idade depois.' : '') : cab + 'não medido: ' + e.mot + '.' + ne;
    return x;
  });
  function idadeDe(a){ return IDADES.filter(function(x){ return x.a === a; })[0]; }

  /* ---------------------------------------------------------------- peças comuns */
  function info(id, titulo, html){ return A.ibtn(id, titulo) + A.oculto(id, titulo, html); }
  function novo(html, rot, cls){ return L.novo(html, rot || 'novo', 'hv-novo ' + (cls || '')); }
  function pastNm(){ return A.nm(); }
  function aindaNao(tit, linhas, quando){
    return '<section class="hv-vz" aria-label="' + esc(tit) + ': ainda não existe"><div class="hv-h"><h2>' + esc(tit) + '</h2><span class="ex" style="border-style:dotted">ainda não existe</span></div>' + linhas.map(function(l){ return '<p>' + l + '</p>'; }).join('') + (quando ? '<span class="q">' + IC.relogio + quando + '</span>' : '') + '</section>';
  }
  function naoMedido(tit, motivo, extra, idInfo, infoHtml){
    return '<section class="hv-card" aria-label="' + esc(tit) + '"><div class="hv-h"><h2>' + esc(tit) + '</h2>' + (idInfo ? info(idInfo, idInfo === 'iIdade' ? 'Como ler a curva por idade' : idInfo === 'iHoras' ? 'Como ler as 72 horas' : 'Como esta parte é calculada', infoHtml) : '') + '</div><div class="hv-nmb2"><div class="faixa" role="img" aria-label="não medido: ' + esc(motivo.replace(/<[^>]+>/g, '')) + '"></div><div class="mot">' + A.nm() + '<span>' + motivo + '</span></div>' + (extra ? '<p class="hv-mut" style="margin:0;font-size:13.5px;line-height:20px">' + extra + '</p>' : '') + '</div></section>';
  }

  /* ---------------------------------------------------------------- cabeçalho do vídeo (já existe na produção; o que é acréscimo leva a marca) */
  function pastilhaSaiu(){
    if (!c.saiu) return '';
    var d = A.dm(c.saiu);
    return novo('<span class="hv-st' + (c.mantido ? ' mant' : '') + '">' + (c.mantido ? IC.pin : ICN.sumiu) + 'saiu do YouTube em ' + d + (c.mantido ? ' · mantido para análise' : '') + '</span>', 'novo', '');
  }
  function acoes(){
    var dis = c.leitura ? ' aria-disabled="true" tabindex="0"' : '';
    var fix = '<span class="btn" role="button"' + (c.leitura ? dis : ' tabindex="0"') + '>' + IC.pin + 'Fixar vídeo</span>';
    var fora = c.saiu ? '<span class="hv-sem-link">' + ICN.sumiu + 'Sem link: o vídeo não está mais no YouTube</span>' : '<span class="btn" role="button" tabindex="0">Abrir no YouTube</span>';
    var forja = '<span class="btn" role="button"' + (c.leitura ? dis : ' tabindex="0"') + '>Pedir leitura da forja</span>';
    var resp = c.saiu && !c.mantido ? '<a class="btn" href="../../2026-10-13-a5-lote-1/e-sairam-do-youtube.html">Responder em “Saíram do YouTube”</a>' : '';
    return '<div class="hv-acoes">' + (c.saiu ? '' : fix) + fora + (c.saiu ? '' : forja) + resp + '</div>';
  }
  function cab(){
    var idade = c.vazio ? 'publicado hoje' : 'há ' + idadeTxt(D.diasEntre(c.pubD, c.agora));
    var vws = c.carregando || c.erro ? '' : '<span><b class="mono">' + (c.saiu ? A.n(total) : vn(total)) + '</b> views' + (c.saiu ? ' na última contagem (' + A.dm(c.p.fimDia) + ')' : '') + '</span>';
    var st = c.live ? '<span class="hv-st live">' + ICN.live + 'ao vivo ou estreia</span>' : '';
    return '<section class="hv-cab" aria-label="Vídeo"><span class="th" style="background:' + c.thumb + '"></span><div><h1 id="vt" tabindex="-1">' + esc(c.t) + '</h1>' +
      '<div class="hv-fatos"><span class="chip" style="gap:7px"><span class="hv-av" aria-hidden="true">' + c.av + '</span>' + esc(c.canal) + '</span><span>' + esc(c.nicho) + '</span><span>vídeo longo · ' + A.dur(c.dur) + '</span><span>publicado <b>' + A.dmy(c.pubD) + ' às ' + c.pubTxt + '</b> (' + idade + ')</span>' + vws + st + ex() + '</div>' +
      (c.saiu ? '<div class="hv-pst">' + pastilhaSaiu() + '</div>' : '') + acoes() + '</div></section>';
  }

  /* ---------------------------------------------------------------- resumo e faixa de números */
  function celula(rot, st, sub){ return { rot: rot, st: st, sub: sub }; }
  function faixa(cells){
    return '<dl class="nstrip hv-faixa" aria-label="Números do vídeo">' + cells.map(function(x){
      var dd;
      if (x.st.t === 'ok') dd = '<b class="num">' + esc(x.st.txt) + '</b>' + (x.st.rz ? '<span class="rz">' + esc(x.st.rz) + '</span>' : '');
      else if (x.st.t === 'zero') dd = '<span class="hv-z" role="img" aria-label="zero medido">0</span><span class="rz">medido: nenhuma view</span>';
      else if (x.st.t === 'fut') dd = '<span class="ex" style="border-style:dotted">ainda não existe</span>';
      else if (x.st.t === 'neu') dd = '<span class="hv-neu">' + IC.relogio + esc(x.st.txt) + '</span>';
      else dd = A.nm();
      return '<div class="nc"><dt>' + esc(x.rot) + (x.sub ? '<span class="nsub">' + esc(x.sub) + '</span>' : '') + '</dt><dd>' + dd + '</dd></div>';
    }).join('') + '</dl>';
  }
  function cel(a){
    var x = idadeDe(a), rot = 'Com ' + idadeTxt(a);
    if (x.vst === 'ok') { if (x.v === 0) return celula(rot, { t: 'zero' }, x.nor != null ? 'normal do canal: ' + vn(x.nor) + ' (' + x.n + ' vídeos)' : ''); return celula(rot, { t: 'ok', txt: vn(x.v), rz: x.nor != null ? xr(x.v / x.nor) : '' }, x.nor != null ? 'normal do canal: ' + vn(x.nor) + ' (' + x.n + ' vídeos)' : c.live ? 'fora do normal do canal' : 'normal: não medido, só ' + x.n); }
    if (x.vst === 'fut') return celula(rot, { t: 'fut' }, 'fecha em ' + x.quando);
    return celula(rot, { t: 'nm' }, x.curto || x.mot.split(':')[0]);
  }
  /* C3: a segunda metade da pergunta do dono (algo mudou antes de subir?) vai para o resumo; lista de coincidências, sem causa */
  var ART = { 'título': 'o título', 'miniatura': 'a miniatura', 'descrição': 'a descrição', 'tags': 'as tags', 'categoria': 'a categoria', 'duração': 'a duração', 'capítulos': 'os capítulos' };
  function fraseAntes(){
    var s = v && v.subida; if (!s) return '';
    var antes = c.trocas.filter(function(t){ return t.d >= D.addDias(s.d, -14) && t.d < s.d; });
    if (!antes.length) return ' Nenhuma mudança registrada nos 14 dias antes.';
    if (antes.length > 4) return ' O canal fez ' + c.trocas.length + ' mudanças no vídeo, ' + antes.length + ' delas nos 14 dias antes (a lista está no fim da página).';
    var por = {}, ordem = [];
    antes.forEach(function(t){ var k = t.tipo === 't' ? 'título' : t.tipo === 'm' ? 'miniatura' : nomeCampos(t); if (!por[k]) { por[k] = []; ordem.push(k); } por[k].push(A.dm(t.d)); });
    ordem.sort(function(a, b){ var r = { 'título': 0, 'miniatura': 1 }; return (r[a] == null ? 2 : r[a]) - (r[b] == null ? 2 : r[b]); });
    var itens = ordem.map(function(k){ var ds = por[k]; return (ART[k] || k) + ' (' + (ds.length > 1 ? ds.slice(0, -1).join(', ') + ' e ' + ds[ds.length - 1] : ds[0]) + ')'; });
    return ' Nos 14 dias antes, o canal mudou ' + (itens.length > 1 ? itens.slice(0, -1).join(', ') + ' e ' + itens[itens.length - 1] : itens[0]) + '.';
  }
  /* r9-C1: "N dias de contagem" (dias com leitura das 12:00) é outra unidade que "Com N dias" (idade do vídeo); sai da mesma lista que desenha as barras */
  function nDiasContagem(){ var n = dias.filter(function(x){ return x.e === 'com' || x.e === 'zero'; }).length; return n + (n === 1 ? ' dia' : ' dias'); }
  function fraseResumo(){
    if (c.vazio) return '<span>O vídeo tem <b class="num">' + A.n(total) + '</b> views agora. Ainda não há histórico: a primeira contagem por dia é às 12:00 de amanhã.</span>';
    if (c.saiu) return '<span>' + ICN.sumiu + ' O vídeo saiu do YouTube em <b>' + A.dm(c.saiu) + '</b>. A última contagem, em ' + A.dm(c.p.fimDia) + ', foi de <b class="num">' + A.n(total) + '</b> views, depois de ' + nDiasContagem() + ' de contagem. <b>A contagem termina em ' + A.dm(c.p.fimDia) + '</b>.</span>';
    var ref = null; [30, 7, 3, 1].forEach(function(a){ var x = idadeDe(a); if (!ref && x && x.vst === 'ok' && x.nor != null) ref = x; });
    var sub = v && v.subida ? ' <span class="hv-up">▲ Subiu em ' + A.dm(v.subida.d) + '.</span>' + fraseAntes() : '';
    if (c.live) return '<span>' + ICN.live + ' Vídeo ao vivo ou estreia: tem <b class="num">' + vn(total) + '</b> views e <b>fica fora do normal do canal</b>, que só conta vídeos comuns.' + sub + '</span>';
    if (c.antes03) return '<span>O vídeo tem <b class="num">' + vn(total) + '</b> views agora. Foi publicado antes de ' + A.dm(D.INICIO_DIARIA) + ', então <b>a contagem por dia só existe desde ' + A.dm(D.INICIO_DIARIA) + '</b> e a comparação por idade não dá.</span>';
    if (c.semanal) return '<span>O vídeo tem <b class="num">' + vn(total) + '</b> views e <b>uma contagem por semana</b>: o que sobe e desce dentro da semana não aparece.</span>';
    if (c.desde) return '<span>O vídeo tem <b class="num">' + vn(total) + '</b> views agora, mas <b>entrou na contagem só em ' + A.dm(c.desde) + '</b> e falta a de ' + A.dm(c.buraco) + ': quase tudo abaixo é “não medido”, cada um com o motivo.</span>';
    if (caso === 'zero') return '<span>O vídeo tem só <b class="num">' + A.n(total) + '</b> views. Em <b>' + dias.filter(function(x){ return x.e === 'zero'; }).length + ' dos ' + dias.filter(function(x){ return x.e !== 'pub'; }).length + ' dias não ganhou nenhuma view</b> (medido: 0), e em <b>' + v.horas.filter(function(x){ return x.e === 'zero'; }).length + ' das ' + v.horas.filter(function(x){ return x.e !== 'nm'; }).length + ' horas medidas</b> também não.</span>';
    if (ref) { var r = ref.v / ref.nor; return '<span>Com ' + idadeTxt(ref.a) + ', o vídeo tinha <b class="num">' + vn(ref.v) + '</b> views ' + GV + 'e o normal do canal, <b class="num">' + vn(ref.nor) + '</b> ' + GN + '(' + ref.n + ' vídeos): <b>' + razaoS(r) + '</b>.' + sub + '</span>'; }
    return '<span>O vídeo tem <b class="num">' + vn(total) + '</b> views com ' + idadeTxt(D.diasEntre(c.pubD, c.agora)) + '.' + sub + '</span>';
  }
  function resumo(){
    var cells = [celula('Views agora', { t: 'ok', txt: c.saiu ? A.n(total) : vn(total) }, c.saiu ? 'última contagem, ' + A.dm(c.p.fimDia) : 'contagem de hoje')];
    [1, 7, 30].forEach(function(a){ cells.push(cel(a)); });
    var s = v && v.subida;
    var nD = v ? D.diasEntre(c.pubD, c.agora) : 0, precisa = c.antes03 || c.desde || !v || nD < NECESSARIOS;
    cells.push(c.semanal ? celula('Subida', { t: 'neu', txt: 'contagem por semana' }, 'não dá para ver o dia') : s ? celula('Subida', { t: 'ok', txt: A.dm(s.d), rz: '▲ ' + xr(s.razao).replace(' o normal', '') + ' o ritmo' }, '7 dias depois contra 7 antes') : precisa ? celula('Subida', { t: 'nm' }, subidaMotivo().curto) : celula('Subida', { t: 'ok', txt: 'nenhuma', rz: '＝' }, 'em ' + nD + ' dias'));
    return '<section class="hv-card" aria-label="Resumo do vídeo"><div class="hv-h"><h2 class="sr">Resumo</h2></div><p class="hv-fr">' + fraseResumo() + '</p>' + faixa(cells) + '</section>';
  }
  function subidaMotivo(){
    if (c.semanal) return { curto: 'contagem por semana', txt: 'inconclusivo: contagem por semana' };
    var nDias = dias.filter(function(x){ return x.e !== 'pub'; }).length;
    /* R4-B1: "precisa de N", "são M" e "fecha em" nascem do mesmo NECESSARIOS e da mesma contagem (hoje + o que falta) */
    var primeira = A.dm(D.addDias(c.agora, NECESSARIOS - nDias));
    var preciso = 'Precisa de ' + NECESSARIOS + ' dias de contagem por dia (7 antes, o dia da subida e 7 depois)';
    if (!v) return { curto: 'fecha em ' + primeira, txt: preciso };
    if (c.saiu) return { curto: 'o vídeo saiu antes', txt: preciso + '; o vídeo saiu do YouTube com ' + nDias + ' dias de contagem, então a subida não vai ser medida' };
    if (c.antes03) return { curto: 'fecha em ' + primeira, txt: preciso + '; são ' + nDias + ' (começou em ' + A.dm(D.INICIO_DIARIA) + '). Faltam ' + (NECESSARIOS - nDias) + ': fecha em ' + primeira };
    if (c.desde) return { curto: 'faltam dias', txt: 'faltam contagens por dia (o vídeo entrou tarde na contagem e uma contagem se perdeu): sem 7 dias antes e 7 depois seguidos, não dá' };
    return { curto: 'fecha em ' + primeira, txt: preciso + '; são ' + nDias + '. Faltam ' + (NECESSARIOS - nDias) + ': fecha em ' + primeira };
  }

  /* ---------------------------------------------------------------- bloco A: curva por idade e pares */
  function blocoIdade(){
    var tit = 'Views por idade: o vídeo contra o normal do canal';
    var infoHtml = '<ul><li><b>Cada ponto:</b> views do vídeo no instante “publicação + N dias”, calculadas entre as duas contagens vizinhas.</li><li><b>O normal do canal:</b> mediana das views dos outros vídeos longos do canal na mesma idade, entre os publicados nos últimos 180 dias. Cada ponto mostra o n; com menos de 3 vídeos fica “não medido”.</li><li><b>Fora do normal:</b> vídeos ao vivo e estreias.</li><li><b>Limite:</b> as idades altas só têm os vídeos mais velhos; a curva não é de um mesmo grupo.</li><li>Cálculo do Observatório sobre dados públicos do YouTube.</li></ul>';
    if (c.vazio) return novo(aindaNao(tit, ['O primeiro ponto (1 dia de idade) aparece em ' + fechaEm(1) + ', depois das 12:00.'], null), 'novo');
    if (c.antes03 || c.semanal) return novo(naoMedido(tit, c.semanal ? 'o vídeo já tinha ' + D.diasEntre(c.pubD, D.INICIO_DIARIA) + ' dias quando a contagem começou (' + A.dm(D.INICIO_DIARIA) + '), e a primeira contagem dele é de ' + A.dm(SEM_DATAS[0]) + ': a comparação por idade só vale para os primeiros 30 dias' : 'publicado em ' + A.dmy(c.pubD) + ', antes de ' + A.dm(D.INICIO_DIARIA) + ': a contagem por dia começou em ' + A.dm(D.INICIO_DIARIA) + ', então não sabemos quantas views o vídeo tinha nas idades até 30 dias',
      'O normal do canal continua existindo para os vídeos publicados desde ' + A.dm(D.INICIO_DIARIA) + ': ' + (c.ns[0] >= 3 ? c.ns[0] + ' vídeos com 1 dia' : 'ainda poucos vídeos') + '.', 'iIdade', infoHtml), 'novo');
    var ok = IDADES.filter(function(x){ return x.vst === 'ok'; }), ult = ok[ok.length - 1], rz = ult && ult.nor != null ? ult.v / ult.nor : null;
    var pares = [1, 7, 30].map(function(a){ return par(idadeDe(a)); }).join('');
    var host = '<div id="g-idade"></div>';
    var h = '<div class="hv-h"><h2>' + tit + '</h2>' + info('iIdade', 'Como ler a curva por idade', infoHtml) + (c.futuro ? ex() : '') + '</div>';
    var fr = '<p class="hv-fr">' + frIdade() + '</p>';
    var corpo = '<div class="hv-2c"><div>' + host + '</div><div><p class="hv-pares-t">Os mesmos pontos, lado a lado:</p><ul class="hv-pares" aria-label="O vídeo contra o normal do canal, com 1, 7 e 30 dias">' + pares + '</ul></div></div>';
    return novo('<section class="hv-card" aria-labelledby="hIdade">' + h.replace('<h2>', '<h2 id="hIdade">') + fr + corpo + '</section>', 'novo');
  }
  function frIdade(){
    var ok = IDADES.filter(function(x){ return x.vst === 'ok'; }), ult = ok[ok.length - 1];
    if (c.live) return '<span>Ao vivo ou estreia: a linha é só deste vídeo, <b>sem comparação</b> com o normal do canal (vídeos ao vivo ou estreia não entram na conta do normal).</span>';
    if (!ult) return '<span>Ainda não há ponto: o primeiro (1 dia de idade) aparece em ' + A.dm(D.addDias(c.pubD, 1)) + '.</span>';
    var prox = IDADES.filter(function(x){ return x.vst === 'fut'; })[0], pt = prox ? ' O próximo ponto, ' + idadeTxt(prox.a) + ', fecha em ' + prox.quando + '.' : '';
    if (c.desde) {
      var nmN = IDADES.filter(function(x){ return x.vst === 'nm'; }).length, futN = IDADES.filter(function(x){ return x.vst === 'fut'; }).length;
      return '<span>Só <b>' + ok.length + ' dos ' + (ok.length + nmN) + ' pontos que já existem</b> ' + (ok.length === 1 ? 'tem' : 'têm') + ' contagem; ' + (nmN === 1 ? 'o outro é' : 'os outros ' + nmN + ' são') + ' “não medido”, cada um com o motivo. ' + (futN === 1 ? 'O ponto de idade maior ainda não existe.' : 'Os ' + futN + ' pontos de idades maiores ainda não existem.') + '</span>';
    }
    if (ult.nor == null) return '<span>Com ' + idadeTxt(ult.a) + ' o vídeo tinha <b class="num">' + vn(ult.v) + '</b> views' + GV + '. O normal do canal <b>ainda não existe</b> nessa idade: ' + soN(ult.n, 'nenhum vídeo chegou a ela') + ' (o mínimo é 3).' + pt + '</span>';
    return '<span>Com ' + idadeTxt(ult.a) + ', <b class="num">' + vn(ult.v) + '</b> views ' + GV + 'contra <b class="num">' + vn(ult.nor) + '</b> ' + GN + 'do normal do canal (' + ult.n + ' vídeos): <b>' + razaoS(ult.v / ult.nor) + '</b>.' + pt + '</span>';
  }
  function par(x){
    var rot = '<div class="hv-pl">' + idadeTxt(x.a) + '</div>';
    if (x.vst !== 'ok') return '<li class="hv-par" aria-label="' + idadeTxt(x.a) + ': ' + (x.vst === 'fut' ? 'ainda não existe' : 'não medido') + '">' + rot + '<div class="hv-pb"><div class="hv-bl">' + (x.vst === 'fut' ? '<span class="ex" style="border-style:dotted">ainda não existe</span><span class="hv-bv m">fecha em ' + x.quando + '</span>' : '<span class="hv-nmb" role="img" aria-label="não medido"></span>') + '</div>' + (x.vst === 'nm' ? '<div class="hv-bv m">' + esc(x.mot) + '</div>' : '') + '</div></li>';
    var max = Math.max(x.v, x.nor || 0, 1), wv = x.v / max, wn = (x.nor || 0) / max; /* R2-B1: largura = (espaço livre) x valor/máximo, proporcional de verdade */
    var vv = x.v === 0 ? '<span class="hv-bar vz"></span><span class="hv-bv">0, medido</span>' : '<span class="hv-bar" style="width:calc((100% - 120px) * ' + wv.toFixed(4) + ')"></span><span class="hv-bv">' + vn(x.v) + '</span>';
    var nn = c.live ? '<div class="hv-bl"><span class="hv-bv m">fora do normal do canal (ao vivo ou estreia)</span></div>' : x.nor == null ? '<div class="hv-bl"><span class="hv-nmb" style="max-width:140px" role="img" aria-label="não medido"></span></div><div class="hv-bv m">normal do canal não medido: só ' + x.n + ' ' + (x.n === 1 ? 'vídeo' : 'vídeos') + '</div>' : '<div class="hv-bl">' + GN + '<span class="hv-bar n" style="width:calc((100% - 120px) * ' + wn.toFixed(4) + ')"></span><span class="hv-bv">' + vn(x.nor) + '</span></div><div class="hv-bv m">normal do canal, ' + x.n + ' vídeos</div>';
    var rz = x.nor != null && !c.live && x.v > 0 ? '<div class="hv-rz">' + razaoS(x.v / x.nor) + '</div>' : '';
    return '<li class="hv-par" aria-label="' + idadeTxt(x.a) + ': ' + esc(x.fala) + '">' + rot + '<div class="hv-pb"><div class="hv-bl">' + GV + vv + '</div>' + nn + '</div>' + rz + '</li>';
  }

  /* ---------------------------------------------------------------- bloco B: 72 horas */
  function blocoHoras(){
    var tit = 'As primeiras 72 horas, hora a hora';
    var infoHtml = '<ul><li><b>Cada barra:</b> views ganhas naquela hora, em horário de São Paulo (diferença entre duas contagens seguidas, uma por hora cheia). O eixo é o tempo real: a primeira barra é parcial, da hora da publicação até a primeira hora cheia.</li><li><b>O total das 72 horas</b> para na última hora cheia antes de o vídeo completar 3 dias; por isso pode ficar um pouco abaixo do “Com 3 dias” da curva por idade.</li><li><b>Começa na primeira contagem depois que o vídeo é descoberto</b> (a descoberta roda de 6 em 6 horas); antes disso fica “não medido”.</li><li><b>1/2 das views:</b> a primeira hora em que o vídeo chega à metade do que tinha com 72 horas. A linha no gráfico fica no fim dessa hora; o número de horas na régua é arredondado para hora inteira.</li><li><b>O normal do canal:</b> mediana dos outros vídeos do canal com as 72 horas completas na contagem por hora, com o n (por isso o n é menor que o da curva por idade); o YouTube segura e corrige o contador, então a hora não é o minuto em que a pessoa assistiu.</li><li>Só vídeos publicados a partir de ' + A.dm(D.INICIO_HORA) + '. Cálculo do Observatório sobre dados públicos do YouTube.</li></ul>';
    if (c.vazio) return novo(aindaNao(tit, ['O vídeo foi descoberto às ' + hm(VZ_DESC[0], VZ_DESC[1]) + ', com ' + A.n(total) + ' views. A primeira contagem por hora entra às ' + hm(VZ_DESC[0] + 1, 0) + ' de hoje; a curva ganha uma barra por hora, até 72 horas depois de publicar.'], null), 'novo');
    if (c.semHoras || c.semanal) return novo(naoMedido(tit, 'publicado em ' + A.dmy(c.pubD) + ', antes de ' + A.dm(D.INICIO_HORA) + ': a contagem por hora começou nesse dia e só vale para vídeos publicados depois', null, 'iHoras', infoHtml), 'novo');
    var hs = v.horas;
    if (v.jFirst >= 71) return novo(naoMedido(tit, 'entrou tarde na contagem: o vídeo só entrou ' + c.p.descoberto + ' horas depois de publicado, quando as 72 horas já tinham passado', 'A contagem por dia, a partir de ' + A.dm(c.desde) + ', continua abaixo.', 'iHoras', infoHtml), 'novo');
    var primeira = v.primeiraLeitura, atraso = primeira.t, atrasoTxt = Math.floor(atraso) + ' h ' + pad(Math.round((atraso % 1) * 60)) + ' min', ate = hm(primeira.hc, 0);
    var zeros = hs.filter(function(x){ return x.e === 'zero'; }).length, medidas = hs.filter(function(x){ return x.e !== 'nm'; }).length;
    var meia = v.q50;
    var fr;
    if (caso === 'zero') fr = '<span>Em <b>' + zeros + ' das ' + medidas + ' horas medidas</b> o vídeo não ganhou nenhuma view (medido: 0, caixa vazada). Em ' + (medidas - zeros) + ' horas ganhou algumas.</span>';
    else if (meia != null) fr = '<span>Metade das views das 72 horas veio nas <b>primeiras ' + meia + ' horas</b>. A curva começa ' + atrasoTxt + ' depois de publicar (primeira contagem às ' + ate + '), com <b class="num">' + A.n(primeira.cum) + '</b> views já.</span>';
    else fr = '<span>A curva começa ' + atrasoTxt + ' depois de publicar, com <b class="num">' + A.n(primeira.cum) + '</b> views já; <b>metade das views</b> ainda não dá para dizer (o vídeo já tinha mais da metade quando a contagem por hora começou).</span>';
    var mj = meia != null ? Math.max(0, Math.round(meia - (60 - c.pubM) / 60)) : null;
    function hhf(x){ return hm(x.hc, 0) + ' a ' + hm((x.hc + 1) % 24, 0); }
    var reg = regua72();
    var h = '<div class="hv-h"><h2 id="hHoras">' + tit + '</h2>' + info('iHoras', 'Como ler as 72 horas', infoHtml) + (c.futuro ? ex() : '') + '</div>';
    var sub = '<p class="ic-meta" style="margin:0"><span>Horário de São Paulo. Primeira contagem às ' + ate + ' de ' + A.dm(primeira.d) + '.</span></p>';
    return novo('<section class="hv-card" aria-labelledby="hHoras">' + h + '<p class="hv-fr">' + fr + '</p>' + sub + '<div id="g-horas"></div>' + reg + '</section>', 'novo');
  }
  function regua72(){
    var v_ = v, N = c.m14 || { q25: null, q50: null, q75: null, n: 0 };
    var SIM = ['1/4', '1/2', '3/4'];
    /* C6: quartil que não existe vira marca hachurada rosa na ponta de 0 h (nunca some em silêncio); o motivo vai por escrito logo abaixo */
    function marcas(q25, q50, q75, cls){
      var qs = [q25, q50, q75], vazios = [];
      var reais = qs.map(function(q, k){ if (q == null) { vazios.push(SIM[k]); return ''; } return '<span class="hv-rk' + cls + '" style="left:' + Math.min(97, Math.max(3, q / 72 * 100)).toFixed(2) + '%"><span>' + SIM[k] + '</span><i aria-hidden="true"></i><span data-f="' + SIM[k] + '">' + q + ' h</span></span>'; }).join('');
      var fantasma = vazios.length && vazios.length < 3 ? '<span class="hv-rk nmk' + cls + '"><span>' + vazios.join(' ') + '</span><i aria-hidden="true"></i><span>não medido</span></span>' : '';
      return fantasma + reais;
    }
    function aria(q25, q50, q75, quem){
      var p = []; if (q25 != null) p.push('um quarto das views em ' + q25 + ' horas'); if (q50 != null) p.push('metade em ' + q50); if (q75 != null) p.push('três quartos em ' + q75);
      var f = []; if (q25 == null) f.push('um quarto'); if (q50 == null) f.push('metade'); if (q75 == null) f.push('três quartos');
      return quem + ': ' + p.join(', ') + (f.length ? '; ' + f.join(' e ') + ': não medido' : '');
    }
    var alguma = v_.q25 != null || v_.q50 != null || v_.q75 != null;
    var linhaV = alguma ? '<div class="hv-rt" role="img" aria-label="' + esc(aria(v_.q25, v_.q50, v_.q75, 'O vídeo')) + '">' + marcas(v_.q25, v_.q50, v_.q75, '') + '</div>' : '<div class="hv-rt nmr" role="img" aria-label="não medido"></div>';
    var normal = c.live ? '<div class="hv-vz" style="padding:6px 10px;border-radius:5px"><span class="hv-mut" style="font-size:12.5px">fora do normal do canal: ao vivo ou estreia</span></div>' : N.q50 != null && N.n >= 3 ? '<div class="hv-rt" role="img" aria-label="' + esc(aria(N.q25, N.q50, N.q75, 'O normal do canal')) + '">' + marcas(N.q25, N.q50, N.q75, ' n') + '</div>' : '<div class="hv-rt nmr" role="img" aria-label="não medido"></div>';
    var normalTx = N.q50 != null && N.n >= 3 ? 'normal do canal (' + N.n + ' vídeos)' : 'normal do canal';
    var motivoN = c.live || (N.q50 != null && N.n >= 3) ? '' : '<p class="hv-mut" style="margin:0;font-size:13px">' + A.nm() + ' Normal do canal: ' + soN(N.n, 'nenhum vídeo') + ' com as 72 horas completas (o mínimo é 3), e a contagem por hora começou em ' + A.dm(D.INICIO_HORA) + '.</p>';
    var vaz = []; if (v_.q25 == null) vaz.push('1/4'); if (v_.q50 == null) vaz.push('1/2'); if (v_.q75 == null) vaz.push('3/4');
    var pl = v_.primeiraLeitura, atr = pl ? Math.floor(pl.t) + ' h ' + pad(Math.round((pl.t % 1) * 60)) + ' min' : '';
    var motivoV = alguma && vaz.length ? '<p class="hv-mut" style="margin:0;font-size:13px">' + A.nm() + ' Deste vídeo, ' + vaz.join(' e ') + ' não medido: o vídeo já tinha mais de ' + (v_.q75 == null ? '3/4' : v_.q50 == null ? 'metade' : '1/4') + ' das views quando a contagem por hora começou (' + atr + ' depois de publicar).</p>' : '';
    return '<div class="hv-reg" aria-label="Quando o vídeo chegou a um quarto, à metade e a três quartos das views das 72 horas"><div class="hv-rl"><span>' + GV + 'este vídeo</span>' + linhaV + '</div><div class="hv-rl"><span>' + GN + normalTx + '</span>' + normal + '</div><div class="hv-ra" aria-hidden="true"><span>0 h</span><span>24 h</span><span>48 h</span><span>72 h</span></div>' + motivoV + motivoN + '</div>';
  }
  /* C7 + R3-B1: quando dois rótulos se tocam, o segundo desce. Se só a hora toca a hora vizinha, só a hora desce (segunda linha); se a FRAÇÃO ("1/4", "1/2") toca a fração
     vizinha, a marca inteira desce: o rótulo de baixo passa a ler "1/2 · 12 h" e a fração de cima some (fica só o ponto na régua). Folga mínima entre caixas: 6 px. */
  function separaRotulos(){
    document.querySelectorAll('.hv-rt').forEach(function(rt){
      var marcas = [].slice.call(rt.querySelectorAll('.hv-rk')); if (!marcas.length) return;
      rt.classList.remove('dois'); marcas.forEach(function(m){ m.classList.remove('dn', 'dn2'); });
      var fimF = -1e9, fim = [-1e9, -1e9], dois = false;
      marcas.sort(function(a, b){ return a.getBoundingClientRect().left - b.getBoundingClientRect().left; }).forEach(function(m){
        var f = m.firstElementChild.getBoundingClientRect(), r = m.lastElementChild.getBoundingClientRect();
        if (m.classList.contains('nmk')) { fim[0] = Math.max(fim[0], r.right); return; }
        if (f.left < fimF + 6) { m.classList.add('dn', 'dn2'); dois = true; var r2 = m.lastElementChild.getBoundingClientRect(); fim[1] = Math.max(fim[1], r2.right); return; }
        fimF = f.right;
        if (r.left >= fim[0] + 6) fim[0] = r.right;
        else { m.classList.add('dn'); dois = true; fim[1] = Math.max(fim[1], r.right); }
      });
      if (dois) rt.classList.add('dois');
    });
  }

  /* ---------------------------------------------------------------- bloco C: dia a dia, mudanças e subida */
  function nomeCampos(t){ return t.campos.join(' e '); }
  function quandoMuda(t){
    if (t.prec === '6h') return 'em ' + A.dm(t.d) + ', entre ' + t.a + ' e ' + t.b;
    if (t.prec === 'gap') return 'em algum momento entre ' + A.dm(t.a) + ' e ' + A.dm(t.b) + ' (a contagem ficou parada)';
    return 'em ' + A.dm(t.d);
  }
  /* os tipos que de fato aparecem na lista (r3: antes a frase sempre dizia "título, miniatura e outras") */
  function tiposTxt(){
    var t = [c.trocas.some(function(x){ return x.tipo === 't'; }) ? 'título' : '', c.trocas.some(function(x){ return x.tipo === 'm'; }) ? 'miniatura' : '', c.trocas.some(function(x){ return x.tipo === 'o'; }) ? 'outras' : ''].filter(Boolean);
    return t.length > 1 ? t.slice(0, -1).join(', ') + ' e ' + t[t.length - 1] : t[0];
  }
  /* R4-S3: a marca é sempre a dos que estão FORA dos 14 dias antes (uma convenção só), e a frase acima da lista diz quantos estão dentro */
  function listaMudancas(dentro, temSubida){
    var tr = c.trocas; if (!tr.length) return '';
    var ic = { t: 't', m: 'm', o: 'o' };
    return '<ol class="hv-muda' + (tr.length > 6 ? ' cols' : '') + '" aria-label="Mudanças do vídeo, na ordem">' + tr.map(function(t){
      var tipoTxt = t.tipo === 't' ? 'Título' : t.tipo === 'm' ? 'Miniatura' : 'Outras: ' + nomeCampos(t);
      var d = t.de ? ' <span class="hv-mq">de “' + esc(t.de) + '” para “' + esc(t.para) + '”</span>' : '';
      return '<li><span class="hv-mi ' + t.tipo + '" aria-hidden="true">' + t.n + '</span><div><b>' + tipoTxt + '</b> ' + quandoMuda(t) + d + (temSubida && dentro.indexOf(t.n) < 0 ? '<span class="dentro">fora dos 14 dias antes</span>' : '') + '</div></li>';
    }).join('') + '</ol>';
  }
  function cartaoSubida(){
    var s = v && v.subida;
    var infoHtml = '<ul><li><b>Subida:</b> o primeiro dia em que o ritmo dos 7 dias seguintes é pelo menos 2 vezes o dos 7 anteriores <b>e</b> o ganho nesses 7 dias é de pelo menos 1.000 views.</li><li><b>A lista:</b> todas as mudanças registradas nos 14 dias antes desse dia (título, miniatura, descrição, tags, categoria, duração e capítulos).</li><li><b>O que ela não diz:</b> o que causou a subida. Não vê o que acontece fora do YouTube nem o que o YouTube recomenda, e mudanças no mesmo dia não se separam.</li><li>Cálculo do Observatório sobre dados públicos do YouTube.</li></ul>';
    if (c.semanal) infoHtml = '<ul><li><b>Contagem por semana:</b> uma contagem a cada semana, em vez de uma por dia.</li>' + infoHtml.slice(4);
    var ib = info('iSub', 'Como a subida é calculada', infoHtml);
    if (c.semanal) return '<div class="hv-incl">' + IC.relogio.replace('<svg', '<svg') + '<b>inconclusivo: contagem por semana</b><span class="hv-mut" style="font-size:13px">Com uma contagem por semana não dá para dizer se uma mudança veio antes de uma subida.</span>' + ib + '</div>';
    if (c.vazio || c.carregando) return '';
    if (!s) {
      var m = subidaMotivo(), nDias = D.diasEntre(c.pubD, c.agora);
      if (c.antes03 || c.desde || nDias < NECESSARIOS) return '<div class="hv-incl" style="border-style:solid;border-color:var(--nm-line)">' + A.nm() + '<span style="font-size:13.5px"><b>Subida: não medido.</b> ' + esc(m.txt.charAt(0).toUpperCase() + m.txt.slice(1)) + '.</span>' + ib + '</div>';
      return '<div class="hv-incl">' + '<b>＝ Sem subida</b><span class="hv-mut" style="font-size:13px">Nenhum dia teve o ritmo dos 7 dias seguintes em 2 vezes o dos 7 anteriores com ganho de 1.000 views ou mais.</span>' + ib + '</div>';
    }
    var antes = c.trocas.filter(function(t){ return t.d >= D.addDias(s.d, -14) && t.d < s.d; }), nums = antes.map(function(t){ return t.n; });
    var porCampo = {}, ordem = []; antes.forEach(function(t){ var k = t.tipo === 't' ? 'título' : t.tipo === 'm' ? 'miniatura' : nomeCampos(t); if (!porCampo[k]) { porCampo[k] = []; ordem.push(k); } porCampo[k].push(A.dm(t.d)); });
    ordem.sort(function(a, b){ var r = { 'título': 0, 'miniatura': 1 }; return (r[a] == null ? 2 : r[a]) - (r[b] == null ? 2 : r[b]); });
    function juntar(xs){ return xs.length > 1 ? xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1] : xs[0]; }
    var lista = ordem.map(function(k){ return k + ' em ' + juntar(porCampo[k]); });
    var txt = antes.length > 4 ? antes.length + ' mudanças nos 14 dias antes da subida (a lista está logo abaixo).' : antes.length ? 'Mudanças nos 14 dias antes: ' + juntar(lista) + '.' : 'Nenhuma mudança registrada nos 14 dias antes.';
    return '<div class="hv-sub" role="group" aria-label="Subida"><p class="hv-fr"><span class="hv-up">▲ Subida em ' + A.dm(s.d) + '</span><span>: nos 7 dias seguintes o vídeo ganhou <b class="num">' + A.n(s.ganho) + '</b> views, <b>' + vezes(s.razao) + ' o ritmo</b> dos 7 dias antes (' + A.n(Math.round(s.depois)) + ' contra ' + A.n(Math.round(s.antes)) + ' por dia).</span></p>' +
      '<p class="hv-lista">' + esc(txt) + '</p><p class="hv-nota">É só uma lista de coincidências: não diz o que causou a subida.' + ib + '</p></div>';
  }
  function blocoDias(){
    var tit = c.semanal ? 'Views por semana, uma contagem por semana' : 'Views por dia e cada mudança';
    var infoHtml = '<ul><li><b>Cada barra:</b> views ganhas nas 24 horas até as 12:00 (São Paulo) daquele dia. A primeira barra conta desde a publicação. A soma dos dias com a primeira contagem dá o total do cabeçalho.</li><li><b>Raias:</b> título, miniatura e “outras” (descrição, tags, categoria, duração e capítulos). Marcas muito juntas na mesma raia viram uma só, com “×N”; a lista abaixo diz todas. O número é a ordem.</li><li><b>Quando a mudança foi feita:</b> a janela entre duas contagens (de 6 em 6 horas, ou de dia em dia); quando a contagem ficou parada, a tela diz “em algum momento entre” as duas datas, e a marca fica na divisa entre os dois dias da janela.</li><li><b>Faixa verde:</b> os 7 dias da subida. <b>Faixa tracejada:</b> os 14 dias antes dela. A barra do próprio dia da subida (a contagem das 12:00 que a marca) fica entre as duas faixas.</li><li>Cálculo do Observatório sobre dados públicos do YouTube.</li></ul>';
    if (c.semanal) infoHtml = '<ul><li><b>Cada ponto:</b> média de views por dia na semana que termina na data (soma das views da semana dividida por 7). Uma contagem por semana: o que sobe e desce dentro da semana não aparece, e uma mudança não pode ser ligada a uma subida. A lista de mudanças aparece abaixo, sem marca de subida.</li><li><b>Pontilhado:</b> semanas sem contagem, antes de ' + A.dm(SEM_DATAS[0]) + '. <b>Hachura:</b> o ponto de ' + A.dm(SEM_DATAS[0]) + ' é a primeira contagem do vídeo, sem a anterior para tirar a diferença (não medido).</li><li><b>Views agora</b> inclui os dias depois da última semana fechada (de ' + A.dm(SEM_DATAS[SEM_DATAS.length - 1]) + ' a ' + A.dm(c.agora) + ').</li><li><b>Linha tracejada de 24/08:</b> o YouTube mudou a regra de contar views.</li><li>Cálculo do Observatório sobre dados públicos do YouTube.</li></ul>';
    if (c.vazio) return novo(aindaNao(tit, ['A primeira barra aparece amanhã, depois das 12:00. As mudanças de título, miniatura e descrição entram aqui à medida que o canal as fizer.'], null), 'novo');
    var fr, h = '<div class="hv-h"><h2 id="hDias">' + tit + '</h2>' + info('iDias', c.semanal ? 'Como ler a contagem por semana' : 'Como ler o dia a dia e as mudanças', infoHtml) + (c.futuro ? ex() : '') + '</div>';
    var com = dias.filter(function(x){ return x.e === 'com'; }), melhor = com.slice().sort(function(a, b){ return b.v - a.v; })[0];
    var nTr = c.trocas.length;
    if (c.semanal) fr = '<span><b>Uma contagem por semana</b>: cada ponto é a média de views por dia da semana. Sem barra por dia e sem dizer se uma mudança “funcionou”.</span>';
    else if (c.desde) fr = '<span>Dos <b>' + dias.filter(function(x){ return x.e !== 'pub'; }).length + ' dias</b> desde a publicação, <b>' + dias.filter(function(x){ return x.e === 'nm'; }).length + ' estão “não medido”</b>: o vídeo entrou tarde na contagem e uma contagem se perdeu. ' + G.passe() + ' cada barra hachurada para ver o motivo.</span>';
    else if (c.saiu) fr = '<span>O vídeo ganhou <b class="num">' + A.n(total) + '</b> views em ' + com.length + ' dias com contagem. <b>A contagem termina em ' + A.dm(c.p.fimDia) + '</b>, o último dia em que o vídeo respondeu.</span>';
    else if (c.antes03) fr = '<span>A contagem por dia só existe <b>desde ' + A.dm(D.INICIO_DIARIA) + '</b> (' + dias.length + ' dias). Melhor dia: <b>' + A.dm(melhor.d) + '</b>, com <b class="num">' + A.n(melhor.v) + '</b> views. ' + (nTr ? 'Houve ' + nTr + ' mudança registrada.' : 'Nenhuma mudança registrada.') + '</span>';
    else if (caso === 'zero') fr = '<span>Dos ' + dias.filter(function(x){ return x.e !== 'pub'; }).length + ' dias, <b>' + dias.filter(function(x){ return x.e === 'zero'; }).length + ' tiveram zero view</b> (caixa vazada, medido) e o melhor teve ' + A.n(melhor.v) + '. Nenhuma mudança registrada.</span>';
    else fr = '<span>O melhor dia foi <b>' + A.dm(melhor.d) + '</b>, com <b class="num">' + A.n(melhor.v) + '</b> views.' + (v.subida ? ' <span class="hv-up">▲ Subida em ' + A.dm(v.subida.d) + '.</span>' : '') + ' ' + (nTr ? 'O canal mudou o vídeo <b>' + nTr + ' ' + (nTr === 1 ? 'vez' : 'vezes') + '</b> (' + tiposTxt() + ').' : 'Nenhuma mudança registrada.') + '</span>';
    var s = v && v.subida, dentro = s ? c.trocas.filter(function(t){ return t.d >= D.addDias(s.d, -14) && t.d < s.d; }).map(function(t){ return t.n; }) : [];
    var corpo = '<p class="hv-fr">' + fr + '</p><div id="g-dias"></div>' + cartaoSubida();
    var lst = '<div><h3 class="ic-t" style="margin:6px 0 4px">Mudanças deste vídeo</h3>' + (s && c.trocas.length ? '<p class="hv-mut" style="margin:0 0 6px;font-size:13px">' + (dentro.length === c.trocas.length ? (c.trocas.length === 1 ? 'A mudança está' : 'As ' + c.trocas.length + ' mudanças estão todas') + ' nos 14 dias antes da subida.' : dentro.length + ' das ' + c.trocas.length + ' mudanças estão nos 14 dias antes da subida; as outras levam a marca “fora dos 14 dias antes”.') + '</p>' : '') + (c.trocas.length ? listaMudancas(dentro, !!s) : '<p class="hv-mut" style="margin:0;font-size:13.5px">Nenhuma mudança registrada desde ' + A.dm(D.INICIO_DIARIA) + ' (o histórico de mudanças começou nesse dia).</p>') + '</div>';
    return novo('<section class="hv-card" aria-labelledby="hDias">' + h + corpo + lst + '</section>', 'novo: mudanças e subida');
  }

  /* ---------------------------------------------------------------- estados inteiros */
  function carregando(){
    return '<div class="hv" aria-busy="true"><p class="hv-mut" role="status" style="margin:0;font-size:14px">Carregando o histórico do vídeo.</p>' + [0, 1, 2].map(function(){ return '<section class="hv-card" aria-hidden="true"><div class="hv-skel" style="width:40%"></div><div class="hv-skel" style="width:85%"></div><div class="hv-skel g"></div></section>'; }).join('') + '</div>';
  }
  function erro(){
    return '<div class="hv-erro" role="alert">' + ICN.erro + '<div class="tx"><h2>Não deu para abrir o histórico deste vídeo</h2><p>O servidor não respondeu. Tente de novo; se continuar assim, avise.</p></div><span class="btn pri big" role="button" tabindex="0">Tentar de novo</span></div>' +
      '<section class="hv-vz"><div class="hv-h"><h2>O que dá para ver enquanto isso</h2></div><p>O título, o canal e a data de publicação acima vieram da lista, não do histórico. Os números e os gráficos aparecem quando o histórico abrir.</p></section>';
  }
  function leituraAviso(){
    return '<div class="hv-lei" role="note">' + ICN.cadeado + '<div><b>Você só pode ver este histórico.</b> Fixar o vídeo e pedir leitura da forja pedem permissão de editor. Os números e os gráficos são os mesmos que o editor vê.</div></div>';
  }
  function encaixe(){
    return '<div class="hv-enc" aria-label="Espaço reservado">' + IC.comentario + '<span>Aqui entra a seção <b>Comentários de destaque</b> deste vídeo (mockup 20).</span><span class="ex" style="border-style:dotted">fora deste mockup</span></div>';
  }

  /* ---------------------------------------------------------------- montagem */
  var CASOS_BARRA = [['cheio', 'Com dado típico (subida)'], ['extremo', 'Com dado extremo (viral, 14 mudanças)'], ['recente', 'Vídeo novo, 3 dias (o real de hoje)'], ['magro', 'Magro: publicado antes de ' + A.dm(D.INICIO_DIARIA) + ''], ['zero', 'Zero medido'], ['naomedido', 'Não medido, com motivo'], ['semanal', 'Uma contagem por semana'], ['saiu', 'Saiu do YouTube'], ['mantido', 'Saiu do YouTube, mantido para análise'], ['aovivo', 'Ao vivo ou estreia'], ['vazio', 'Sem dado'], ['carregando', 'Carregando'], ['erro', 'Erro'], ['leitura', 'Só leitura']];
  var barra = L.barra([{ rotulo: 'Estado', param: 'caso', itens: CASOS_BARRA, padrao: 'cheio' }],
    'Contorno verde-água e “+ novo” = o acréscimo desta fase. O cabeçalho do vídeo e o gráfico “views por dia e cada mudança” já existem na produção; a curva por idade, as 72 horas, a subida, a faixa de números, o “saiu do YouTube” e o estado “uma contagem por semana” são novos. Tudo aqui é exemplo (nomes, números e datas). Os estados “vídeo novo” e “magro” reproduzem a situação real de hoje (13/10) com dados inventados.');

  var aviso = c.futuro ? '<div class="hv-aviso" role="note">' + ex() + '<span><b>Este estado mostra como a tela fica em novembro</b> (dia de exemplo: <b>11/11/2026</b>). <span class="aviso-2">Hoje (13/10) nenhum vídeo tem ' + NECESSARIOS + ' dias de contagem por dia, então a subida e a curva de 30 dias ainda não existem; a situação de hoje está nos estados “vídeo novo” e “magro”.</span></span></div>'
    : c.vazio || c.carregando || c.erro ? '<div class="hv-aviso" role="note">' + ex() + '<span>Nomes, números e datas são de exemplo. <span class="aviso-2">Hoje é <b>13/10/2026</b>.</span></span></div>' : '<div class="hv-aviso" role="note">' + ex() + '<span>Nomes, números e datas são de exemplo. <span class="aviso-2">Hoje é <b>13/10/2026</b>; a contagem por dia começou em ' + A.dm(D.INICIO_DIARIA) + ' e a contagem por hora em ' + A.dm(D.INICIO_HORA) + '.</span></span></div>';

  var corpoV;
  if (c.carregando) corpoV = carregando();
  else if (c.erro) corpoV = '<div class="hv">' + erro() + '</div>';
  else corpoV = '<div class="hv">' + (c.leitura ? leituraAviso() : '') + resumo() + blocoIdade() + blocoHoras() + blocoDias() + encaixe() + '</div>';

  /* R4-C2: o total da aba Mudanças e do pager vem de UM número por estado; o extremo (14 mudanças em UM vídeo) precisa de um total maior que 14 */
  /* r5-C3: o vídeo do estado vazio só existe para o sistema desde as 18:00 (descoberta); agora são cerca de 18:20, então a última sincronização foi há 20 min */
  /* r9-S3: descoberta (18:00) e hora de agora (18:20) saem de UMA constante; o chip "sincronizado há N min" é a diferença */
  var VZ_AGORA = [18, 20];
  var FRESCO_VAZIO = '<span class="c2-fresh"><span class="c2-fs"><i class="c2-dot"></i><b>7 canais</b></span><i class="c2-sp"></i><span class="c2-fs">sincronizado há ' + ((VZ_AGORA[0] - VZ_DESC[0]) * 60 + VZ_AGORA[1] - VZ_DESC[1]) + ' min</span><i class="c2-sp"></i><span class="c2-fs">todos em dia</span>' + L.IC.chev + '</span>';
  var nMud = c.nMud || 12;
  var corpo = L.obs({ aba: 'Mudanças', nMud: nMud, fresh: c.vazio ? FRESCO_VAZIO : undefined }) + A.migalha([['Mudanças', '#'], ['Histórico do vídeo', '']]) + (c.vazio || (!c.erro && !c.carregando && !c.trocas.length) ? '' : L.pager(nMud, true)) + aviso + cab() + corpoV;
  corpo = corpo.replace(/(milhão|milhões)((?:<\/[a-z]+>)*) views/g, '$1$2 de views'); /* "1,04 milhão de views" */
  var fora = '<table class="tb" style="max-width:880px"><caption>Cores e símbolos desta tela (valem nos dois temas)</caption><thead><tr><th scope="col">O que é</th><th scope="col">Cor</th><th scope="col">Forma</th></tr></thead><tbody>' +
    '<tr><th scope="row">Este vídeo</th><td>azul (lado “outro”; o laranja é do seu canal)</td><td>círculo, linha cheia, barra cheia</td></tr>' +
    '<tr><th scope="row">O normal do canal</th><td>areia (neutro)</td><td>quadrado vazado, linha tracejada</td></tr>' +
    '<tr><th scope="row">Subida</th><td>verde (só para direção)</td><td>▲ e faixa de 7 dias</td></tr>' +
    '<tr><th scope="row">Zero medido</th><td>azul-acinzentado</td><td>caixa vazada com o 0 dentro</td></tr>' +
    '<tr><th scope="row">Não medido</th><td>rosa</td><td>hachura de 135 graus, sempre com o motivo</td></tr>' +
    '<tr><th scope="row">Ainda não existe</th><td>cinza</td><td>contorno pontilhado</td></tr>' +
    '<tr><th scope="row">Mudança de campo</th><td>neutro (sem matiz)</td><td>losango = título, triângulo = miniatura, círculo = outras; o número é a ordem</td></tr>' +
    '<tr><th scope="row">Saiu do YouTube</th><td>neutro; verde-água se “mantido”</td><td>ícone de olho cortado; alfinete se mantido</td></tr></tbody></table>';

  A.moldura({ titulo: 'Histórico do vídeo de concorrente', barra: barra, corpo: corpo, fora: fora });
  A.ligarInfos();
  separaRotulos(); window.addEventListener('resize', separaRotulos);

  /* ---------------------------------------------------------------- gráficos */
  function el(id){ return document.getElementById(id); }
  if (el('g-idade')) G.idade(el('g-idade'), { id: 'gi', idades: IDADES, semNormal: !!c.live });
  if (el('g-horas') && v && v.horas) {
    var hs = v.horas, mj = v.q50 != null ? Math.max(0, hs.findIndex(function(x){ return x.cum >= .5 * v.tot72; })) : null;
    G.horas(el('g-horas'), { id: 'gh', horas: hs, pub: { d: c.pubD }, pubTxt: c.pubTxt, metadeJ: mj, hh: function(x){ return hm(x.hc, 0); },
      rot: function(x){ return A.dm(x.hc === 0 ? D.addDias(x.d, -1) : x.d) + ' ' + (x.j === 0 ? c.pubTxt : hm((x.hc + 23) % 24, 0)) + ' a ' + hm(x.hc, 0); },
      fala: function(j){ var x = hs[j], ini = j === 0 ? c.pubTxt : hm((x.hc + 23) % 24, 0), fim = hm(x.hc, 0), cab = A.ds(x.hc === 0 ? D.addDias(x.d, -1) : x.d) + ', ' + ini + ' a ' + fim + ': ';
        if (x.e === 'nm') return cab + 'não medido: ' + (j < v.jFirst ? 'antes da primeira contagem, que foi às ' + hm(hs[v.jFirst].hc, 0) + ' (' + Math.floor(hs[v.jFirst].t) + ' h ' + pad(Math.round((hs[v.jFirst].t % 1) * 60)) + ' min depois de publicar)' : 'primeira contagem, sem a anterior para tirar a diferença; o vídeo já tinha ' + A.n(x.cum) + ' views') + '.';
        return cab + (x.e === 'zero' ? '0 views (medido).' : A.n(x.v) + (x.v === 1 ? ' view.' : ' views.')) + ' Total até aqui: ' + A.n(x.cum) + '.'; } });
  }
  if (el('g-dias')) {
    if (c.semanal) {
      var eixo = D.faixaDiasEixo = (function(){ var r = [], d = c.pubD; while (d <= c.agora) { r.push(d); d = D.addDias(d, 1); } return r; })();
      var rd = {}; v.dias.forEach(function(x){ rd[x.d] = x; });
      var datas = SEM_DATAS, sem = datas.map(function(d, k){ var x = rd[d], p = k ? rd[datas[k - 1]] : null; return { d: d, taxa: p ? (x.cum - p.cum) / 7 : null, cum: x.cum }; });
      G.semanas(el('g-dias'), { id: 'gs', dias: eixo, semanas: sem, inicio: datas[0], corte: D.CORTE, pub: c.pubD,
        fala: function(k){ var s = sem[k]; return s.taxa == null ? 'Semana de ' + A.dm(s.d) + ': primeira contagem do vídeo (' + A.n(s.cum) + ' views no total). Sem a anterior, não dá para dizer o ritmo da semana: não medido.' : 'Semana que termina em ' + A.dm(s.d) + ': em média ' + A.n(Math.round(s.taxa)) + ' views por dia (uma contagem só, por semana). Sem veredito.'; } });
    } else {
      var linhas = dias.map(function(x){ return x; }), sub = v.subida;
      if (c.saiu) { var xd = D.addDias(c.p.fimDia, 1); for (var k = 0; k < 2; k++) linhas.push({ d: D.addDias(c.p.fimDia, k + 1), v: null, e: 'fora' }); }
      /* R8-C1: mudança com a contagem parada ('gap') não tem dia certo: vale para todos os dias da janela (depois de a, até b), e a frase diz a janela */
      function tardia(t){ return t.prec === '6h' && t.a >= '12:00'; } /* r9-S2: cada barra de dia fecha às 12:00; mudança entre 12:00 e 24:00 vem depois da barra do próprio dia */
      function trDia(d){ return c.trocas.filter(function(t){ return t.prec === 'gap' ? (d > t.a && d <= t.b) : t.d === d; }); }
      G.dias(el('g-dias'), { id: 'gd', dias: linhas, trocas: c.trocas, trDia: trDia, subida: sub, fim: c.saiu ? { d: D.addDias(c.p.fimDia, 1) } : null, pub: c.pubD, pubTxt: c.pubTxt,
        fala: function(i){ var x = linhas[i], cab = A.ds(x.d) + ': ', nomeT = function(t){ return (t.tipo === 't' ? 'título' : t.tipo === 'm' ? 'miniatura' : nomeCampos(t)) + ' (mudança ' + t.n + ')'; }, tx = trDia(x.d).filter(function(t){ return t.prec !== 'gap' && !tardia(t); }).map(nomeT), txT = trDia(x.d).filter(tardia).map(nomeT), gp = trDia(x.d).filter(function(t){ return t.prec === 'gap'; });
          var m = (tx.length ? ' Mudou neste dia: ' + tx.join(' e ') + '.' : '') + (txT.length ? ' Mudou neste dia, depois da contagem das 12:00: ' + txT.join(' e ') + '.' : '') + gp.map(function(t){ return ' Mudou entre ' + A.dm(t.a) + ' e ' + A.dm(t.b) + ', em momento que a contagem parada não mostra: ' + nomeT(t) + '.'; }).join(''), s = sub && x.d === sub.d ? ' A subida começa neste dia.' : '';
          if (x.e === 'pub') return cab + 'publicado às ' + c.pubTxt + ', sem contagem das 12:00 nesse dia.' + m;
          if (x.e === 'fora') return cab + 'o vídeo não está mais no YouTube: não há contagem.';
          if (x.e === 'nm') return cab + 'não medido: ' + (x.motivo || 'sem contagem neste dia') + (x.junto != null ? ' Os dois dias juntos ganharam ' + A.n(x.junto) + ' views.' : '') + m;
          return cab + (x.e === 'zero' ? '0 views (medido).' : A.n(x.v) + (x.v === 1 ? ' view.' : ' views.')) + s + m; } });
    }
  }
  window.M13_DEBUG = { c: c, v: v, dias: dias, IDADES: IDADES, teto72: teto72(c.agora), PUBS_OUTROS: PUBS_OUTROS }; /* só para a conferência de coerência (varredura r3); a tela não usa */
})();

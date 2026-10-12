/* a4-dados.js: os "mundos" do mockup de 12/10/2026.
   REAL (caso magro e sem-dado): o canal tnFigueiredo como ele é, lido em 09/10/2026 (dados-real.js: 35 vídeos com título, data, views, curtidas, comentários e duração,
   mais as impressões e o CTR de miniatura por vídeo e dia de 09/09 a 07/10).
   EXEMPLO (marcado "exemplo" na tela): tudo o que ainda não existe em produção ou não veio na exportação: views por dia do diário, percentual assistido, curva de retenção,
   e o canal inteiro do caso cheio. O exemplo é gerado com semente fixa: é sempre o mesmo. Nada daqui vai para o banco. */
(function(){
  'use strict';
  var A = window.A4, R = window.REAL, D = window.A4D = {};

  /* ------------------------------------------------------------------ caso MAGRO (real + exemplo do diário) */
  function magro(){
    var hoje = '2026-10-09', ult = '2026-10-07';
    var por = {}; var vids = R.videos.map(function(v){ var o = { id: v.id, t: v.t, ytId: v.id, dur: v.d, pub: v.p, views: v.v, likes: v.l, com: v.c, imp: 0, cl: 0, impDias: 0 }; por[v.id] = o; return o; });
    var dia = {}; R.reach.forEach(function(r){ var o = por[r[1]]; if (o) { o.imp += r[2]; o.cl += r[2] * r[3]; o.impDias++; } var x = dia[r[0]] || (dia[r[0]] = { imp: 0, cl: 0 }); x.imp += r[2]; x.cl += r[2] * r[3]; });
    vids.forEach(function(o){ o.clR = Math.round(o.cl); });
    var imp = A.faixaDias(R.periodo[0], R.periodo[1]).map(function(d){ return dia[d] ? { d: d, v: dia[d].imp, e: 'com', cl: dia[d].cl } : R.diasVazios.indexOf(d) >= 0 ? { d: d, v: 0, e: 'zero', cl: 0 } : { d: d, v: null, e: 'nm' }; });
    /* diário de views (EXEMPLO): quase tudo zero, como é o canal parado. Os dias 17 e 18/09 vêm sem linha. */
    var ini = A.addDias(ult, -27), dias28 = A.faixaDias(ini, ult), sem = ['2026-09-17', '2026-09-18'];
    var pontos = { 'S1iMQVIOFL4': { '2026-09-24': [1, .18], '2026-09-30': [1, .31] }, 'r_3QZBKHqU8': { '2026-09-25': [1, .22], '2026-09-30': [2, .27] }, 'L7AAl8-2eAw': { '2026-09-30': [1, .12] }, 'BKczyNOMdoc': { '2026-09-25': [1, .4] } };
    vids.forEach(function(o){
      var p = pontos[o.id] || {}; o.vd = dias28.map(function(d){ return sem.indexOf(d) >= 0 ? { d: d, v: null, e: 'nm' } : p[d] ? { d: d, v: p[d][0], e: 'com', pc: p[d][1] } : { d: d, v: 0, e: 'zero' }; });
      var com = o.vd.filter(function(x){ return x.e !== 'nm'; }), s = com.reduce(function(a, x){ return a + x.v; }, 0); o.views28 = s; o.diasLinha = com.length;
      o.vpd = com.length >= 7 ? s / com.length : null;
      var pv = o.vd.filter(function(x){ return x.e === 'com'; }); o.pct = pv.length ? { p: pv.reduce(function(a, x){ return a + x.pc * x.v; }, 0) / s, n: s } : null;
    });
    var viewsCanal = dias28.map(function(d, i){ var c = vids.filter(function(o){ return o.vd[i].e !== 'nm'; }); return c.length ? { d: d, v: c.reduce(function(a, o){ return a + o.vd[i].v; }, 0), e: c.reduce(function(a, o){ return a + o.vd[i].v; }, 0) > 0 ? 'com' : 'zero' } : { d: d, v: null, e: 'nm' }; });
    return { caso: 'magro', hoje: hoje, ult: ult, nome: 'tnFigueiredo', ini: 'tF', inscritos: 1160, exemplo: false, videos: vids, imp: imp, viewsDias: viewsCanal, periodoImp: R.periodo, ultimoVideoDias: 666,
      feat: 'S1iMQVIOFL4', lido: 'lido em 09/10/2026' };
  }

  /* ------------------------------------------------------------------ caso CHEIO (tudo exemplo) */
  var TIT = ['Quanto custa uma semana em Hanói?', 'Trem noturno Bangkok a Chiang Mai: vale a pena?', 'O mercado flutuante que ninguém te conta', 'Moto em Phuket: o que o seguro não cobre', 'Ilhas da Tailândia fora da temporada',
    'Visto para o Vietnã em 2026: passo a passo', 'Comi só street food por 48 horas', 'Hostel ou hotel: a conta real de 30 dias', 'Chiang Rai em um dia', 'O que levar na mochila para o Sudeste Asiático', 'Cartão de viagem: qual compensa', 'Bali ou Tailândia para trabalhar'];
  function cheio(){
    var hoje = '2026-10-12', ult = '2026-10-10', r = A.rnd(20261012), vids = [], pubs = ['2026-09-22', '2026-09-08', '2026-08-25', '2026-08-11', '2026-07-28', '2026-07-14', '2026-06-30', '2026-06-16', '2026-06-02', '2026-05-19', '2026-05-05', '2026-04-21'];
    var ini = A.addDias(ult, -27), dias28 = A.faixaDias(ini, ult);
    TIT.forEach(function(t, k){
      var pub = pubs[k], dur = [886, 1240, 612, 745, 1030, 540, 702, 1180, 498, 905, 366, 1320][k], idade = A.dias(pub, ult), base = 700 * Math.exp(-k * .22) * (0.8 + r() * .5);
      var vd = dias28.map(function(d){ var dd = A.dias(pub, d); if (dd < 0) return { d: d, v: 0, e: 'zero' }; var v = Math.round((base * Math.exp(-dd / 5) * 3.2 + base * .18) * (0.7 + r() * .6)); return { d: d, v: v, e: 'com', pc: Math.max(.2, Math.min(.65, .43 + (r() - .5) * .08 - k * .006)) }; });
      var s28 = vd.reduce(function(a, x){ return a + x.v; }, 0), pctP = vd.filter(function(x){ return x.v > 0; }).reduce(function(a, x){ return a + x.pc * x.v; }, 0) / s28;
      var imp = Math.round(s28 * (14 + r() * 4)), ctr = .038 + r() * .028;
      vids.push({ id: 'ex' + k, t: t, ytId: null, dur: dur, pub: pub, views: Math.round(s28 * (1 + Math.min(idade, 120) / 40)), likes: 0, com: 0, vd: vd, views28: s28, diasLinha: 28, vpd: s28 / 28, pct: { p: pctP, n: s28 }, imp: imp, ctr: ctr, cl: imp * ctr, clR: Math.round(imp * ctr), impDias: 28 });
    });
    vids.forEach(function(o){ o.likes = Math.round(o.views * (.035 + r() * .02)); o.com = Math.round(o.views * (.003 + r() * .004)); });
    /* o vídeo em destaque (o mais novo) tem as séries completas e a curva */
    var f = vids[0], pdia = A.faixaDias(f.pub, ult), impD = pdia.map(function(d, i){ var dd = i, v = Math.round((9200 * Math.exp(-dd / 4.2) + 1100) * (0.8 + r() * .4)), c = .053 - dd * .00055 + (r() - .5) * .006; return { d: d, v: v, e: 'com', cl: v * c, ctr: c }; });
    impD[impD.length - 1] = { d: impD[impD.length - 1].d, v: null, e: 'nm' };
    f.impSerie = impD; f.imp = impD.reduce(function(a, x){ return a + (x.e === 'com' ? x.v : 0); }, 0); f.cl = impD.reduce(function(a, x){ return a + (x.e === 'com' ? x.cl : 0); }, 0); f.clR = Math.round(f.cl); f.impDias = impD.filter(function(x){ return x.e === 'com'; }).length;
    var vdF = pdia.map(function(d, i){ var imp = impD[i].e === 'com' ? impD[i].cl : impD[i - 1].cl; var v = Math.round(imp * 1.4 * (0.9 + r() * .2)); return { d: d, v: v, e: 'com', pc: .43 + (r() - .5) * .05 }; });
    f.vdSerie = vdF; f.views = vdF.reduce(function(a, x){ return a + x.v; }, 0); f.views28 = f.views; f.diasLinha = vdF.length; f.vpd = f.views / vdF.length;
    f.pct = { p: vdF.reduce(function(a, x){ return a + x.pc * x.v; }, 0) / f.views, n: f.views };
    f.likes = Math.round(f.views * .047); f.com = Math.round(f.views * .0048);
    var ptsN = 100, pts = []; for (var i = 0; i < ptsN; i++) { var x = i / (ptsN - 1); var v = 1 - .34 * (1 - Math.exp(-x / .035)) - .36 * x + .14 * Math.exp(-Math.pow((x - .38) / .035, 2)) + .1 * Math.exp(-Math.pow((x - .62) / .02, 2)) + (r() - .5) * .012; pts.push(i === 0 ? 1 : v); }
    f.curva = pts;
    var impCanal = [], base = 12800; var cd = A.faixaDias(A.addDias(ult, -29), ult); cd.forEach(function(d, i){ var v = Math.round(base * (0.75 + r() * .5) + (d === '2026-09-22' || d === '2026-09-23' ? 9000 : 0) + (d > '2026-09-23' && d < '2026-09-28' ? 3500 : 0)); impCanal.push(i >= cd.length - 2 ? { d: d, v: null, e: 'nm' } : { d: d, v: v, e: 'com', cl: v * (.044 + r() * .006) }); });
    var viewsCanal = dias28.map(function(d, i){ var s = vids.reduce(function(a, o){ return a + o.vd[i].v; }, 0); return { d: d, v: s, e: 'com' }; });
    return { caso: 'cheio', hoje: hoje, ult: ult, nome: 'Mochila na Estrada', ini: 'ME', inscritos: 12400, exemplo: true, videos: vids, imp: impCanal, viewsDias: viewsCanal, periodoImp: [impCanal[0].d, impCanal[impCanal.length - 1].d], ultimoVideoDias: 20,
      feat: 'ex0', totalVideos: 41, lido: 'dados de exemplo' };
  }

  /* ------------------------------------------------------------------ caso SEM DADO (tnFigueiredo, coleta ainda não rodou) */
  function semDado(){
    var m = magro(); m.caso = 'sem-dado'; m.imp = []; m.viewsDias = []; m.videos.forEach(function(o){ o.imp = null; o.cl = null; o.clR = null; o.impDias = 0; o.vd = null; o.vpd = null; o.pct = null; o.views28 = null; });
    m.lido = 'coleta ainda não rodou'; return m;
  }
  /* ------------------------------------------------------------------ caso NOVO (canal sem vídeos) */
  function novo(){ return { caso: 'novo', hoje: '2026-10-12', nome: 'Thiago Figueiredo', ini: 'TF', inscritos: 3, exemplo: false, videos: [], imp: [], viewsDias: [], ultimoVideoDias: null }; }

  D.mundo = function(caso){ return caso === 'cheio' ? cheio() : caso === 'sem-dado' ? semDado() : caso === 'novo' ? novo() : magro(); };
  D.CASOS = [['magro', 'Magro (tnFigueiredo, real)'], ['cheio', 'Cheio (exemplo)'], ['sem-dado', 'Sem dado (coleta não rodou)'], ['novo', 'Canal novo, sem vídeos']];

  /* resumo de impressões de uma série de dias */
  D.resumoImp = function(dias){
    var r = { imp: 0, cl: 0, com: 0, zero: 0, nm: 0 }; dias.forEach(function(d){ r[d.e]++; if (d.e === 'com') { r.imp += d.v; r.cl += d.cl || 0; } }); r.clR = Math.round(r.cl); return r;
  };
  D.thumb = function(o){ return o.ytId ? 'https://i.ytimg.com/vi/' + encodeURIComponent(o.ytId) + '/mqdefault.jpg' : null; };
  D.cor = function(o){ var h = 0; for (var i = 0; i < o.t.length; i++) h = (h * 31 + o.t.charCodeAt(i)) % 360; return 'linear-gradient(135deg,hsl(' + h + ' 38% 30%),hsl(' + ((h + 40) % 360) + ' 42% 20%))'; };
})();

/* ov-dados.js: números de EXEMPLO do mockup 12 (origem das views). Nada aqui é dado real do dono.
   Tudo fecha por construção: cada origem é arredondada, e o "omitido pelo YouTube" é o total menos a soma (nunca é redistribuído).
   Datas supostas (o mockup avisa): hoje 13/10/2026; último dia entregue 11/10 (o YouTube atrasa 2 a 3 dias);
   coleta de origem, aparelho, país e inscritos começa em 04/10 (dia do deploy menos 10 dias, regra do spec 7.3);
   relatórios em lote (termos, sites, impressões por origem) valem desde 08/09. */
(function(){
  'use strict';
  var A = window.A4, D = window.OVD = {};
  D.HOJE = '2026-10-13'; D.ULT = '2026-10-11'; D.COLETA = '2026-10-04'; D.LOTE = '2026-09-08'; D.MUDA = '2026-08-24'; D.CANAL_INI = '2015-04-08';
  /* r3: fontes únicas das datas e taxas que antes estavam digitadas em mais de um lugar */
  D.COLETA_FUT = '2026-10-14';   /* estado "não medido": a coleta só começa depois de hoje, então NENHUM dia está medido */
  D.VAZIO_PUB = '2026-10-12';   /* vídeo novo demais: publicado depois do último dia entregue */
  D.VAZIO_VIEWS = 187;   /* r6 (C1-r5): views de ontem do vídeo novo; não repete nenhum número do vídeo típico (212 curtidas) */
  D.PRIMEIRA = A.addDias(D.VAZIO_PUB, 3);   /* o YouTube entrega 2 a 3 dias depois: 15/10 */
  D.TAXA = 0.048;   /* taxa de clique de exemplo do cartão da comparação */
  /* r6: % assistido por perfil (antes uma constante 51 em todos os cartões, inclusive o magro e o extremo) */
  D.ASSIST_PERFIL = { tipico: 51, magro: 38, extremo: 58 };
  /* r6 (B1-r5): UMA mediana de views dos outros vídeos do canal tnFigueiredo; a razão "o normal do canal" do vídeo é views da vida ÷ esta mediana, nunca um literal */
  D.MEDIANA_OUTROS = 2764;
  D.normalDoCanal = function(vida){ return Math.round(vida / D.MEDIANA_OUTROS * 10) / 10; };
  /* r6 (S5-r5): país por mês (só atrás de ?pais=mes, só no canal típico): julho a setembro = 92 dias fechados x views por dia antes da coleta */
  D.PAIS_MES_DIAS = 92;
  D.INSCRITOS_CANAL = 18400; D.VIDEOS_CANAL = 35;
  /* r5: identidade do canal numa fonte só (migalha, título e sigla do avatar leem daqui). O vídeo é sempre do canal típico. */
  D.CANAL = { tipico: { nome: 'tnFigueiredo', sigla: 'TF' }, extremo: { nome: 'tnFigueiredo Viagens', sigla: 'TV' }, magro: { nome: 'Aldeia Digital Lab', sigla: 'AD' } };
  D.canalDe = function(estado){ return D.CANAL[estado === 'extremo' ? 'extremo' : estado === 'magro' ? 'magro' : 'tipico']; };
  /* r5: no canal magro, 80% das views da semana viram "cliques estimados" (clique que não vira view não existe: cliques <= views da mesma janela) */
  D.MAG_CLIQUE_POR_VIEW = 0.8;

  /* origens: ordem fixa, cor/símbolo/textura estáveis (PLANO.md) */
  D.ORIG = [
    { k: 'pesq', n: 'Pesquisa do YouTube', de: 'da pesquisa do YouTube' },
    { k: 'sug', n: 'Vídeos sugeridos', de: 'de vídeos sugeridos' },
    { k: 'nav', n: 'Início e inscrições', de: 'do início e das inscrições' },
    { k: 'sh', n: 'Feed de Shorts', de: 'do feed de Shorts' },
    { k: 'ext', n: 'Sites e apps de fora', de: 'de sites e apps de fora do YouTube' },
    { k: 'out', n: 'Outras origens', de: 'de outras origens' }
  ];
  D.APAR = [{ k: 'cel', n: 'Celular' }, { k: 'pc', n: 'Computador' }, { k: 'tv', n: 'TV' }, { k: 'tab', n: 'Tablet' }, { k: 'outro', n: 'Outros aparelhos' }];

  function dias(a, b){ return A.dias(a, b) + 1; }
  D.periodo = function(tela, p, pub){
    var ate = D.ULT, de = p === 'tudo' ? (tela === 'canal' ? D.CANAL_INI : pub) : A.addDias(ate, -(Number(p) - 1));
    if (pub && de < pub) de = pub;
    return { p: p, de: de, ate: ate, dias: dias(de, ate) };
  };
  /* cobertura de um conjunto: quantos dos dias pedidos foram medidos (a coleta começou em `desde`) */
  D.cob = function(per, desde){
    var ini = desde > per.de ? desde : per.de, ok = ini > per.ate ? 0 : dias(ini, per.ate);
    return { total: per.dias, ok: ok, antes: per.dias - ok, desde: desde, de: per.de, ate: per.ate, ini: ini };
  };
  function repart(total, pesos){ var v = {}, s = 0; Object.keys(pesos).forEach(function(k){ v[k] = Math.round(total * pesos[k]); s += v[k]; }); return { v: v, om: total - s, total: total }; }

  /* perfis de exemplo */
  var P = {
    canalTip: { R: 455, Rant: 400, tudo: 1842600, imp: 5900, idFrac: .62, idSite: .85,
      o: { pesq: .42, sug: .18, nav: .15, sh: .10, ext: .07, out: .024 }, ap: { cel: .62, pc: .21, tv: .09, tab: .03, outro: .01 },
      pa: [['BR', 'Brasil', .70], ['PT', 'Portugal', .12], ['US', 'Estados Unidos', .04], ['AO', 'Angola', .02], ['MZ', 'Moçambique', .01]], paOutros: .06, paZZ: .01, in: { sub: .37, nsub: .58 },
      im: { nav: .38, sug: .34, pesq: .12, sh: .09, out: .04 } },
    videoTip: { R: 118, Rant: 209, imp: 1650, idFrac: .60, idSite: .80,
      o: { pesq: .31, sug: .34, nav: .17, sh: .04, ext: .05, out: .03 }, ap: { cel: .66, pc: .19, tv: .08, tab: .03, outro: .01 },
      pa: [['BR', 'Brasil', .74], ['PT', 'Portugal', .10], ['US', 'Estados Unidos', .03], ['AO', 'Angola', .02], ['MZ', 'Moçambique', .01]], paOutros: .05, paZZ: .01, in: { sub: .29, nsub: .66 },
      im: { nav: .31, sug: .39, pesq: .14, sh: .08, out: .05 } },
    ext: { R: 51608, Rant: 40100, tudo: 18742300, imp: 380000, idFrac: .71, idSite: .92,
      o: { pesq: .10, sug: .21, nav: .14, sh: .46, ext: .03, out: .03 }, ap: { cel: .71, pc: .13, tv: .11, tab: .02, outro: .01 },
      pa: [['BR', 'Brasil', .33], ['US', 'Estados Unidos', .12], ['PT', 'Portugal', .08], ['NL', 'Países Baixos', .05], ['CD', 'República Democrática do Congo', .04]], paOutros: .30, paZZ: .03, in: { sub: .22, nsub: .73 },
      im: { nav: .27, sug: .30, pesq: .08, sh: .31, out: .02 } }
  };
  D.P = P;
  /* canal magro (r3): as views vêm de UMA fonte, dia a dia. Os 8 últimos dias medidos (04/10 a 11/10) somam 14; os 82 dias de antes somam 22; o canal não tinha views antes disso (90 dias = 36).
     Qualquer janela (7, 28, 90 ou desde 2015) é soma deste desenho, então o cabeçalho, o total da barra e o rodapé nunca discordam. */
  D.MAG_DIA = [2, 1, 3, 2, 1, 2, 2, 1]; D.MAG_ANTES = 22; D.MAG_DIAS_ANTES = 82;
  D.viewsMag = function(k){
    if (k <= D.MAG_DIA.length) return D.MAG_DIA.slice(D.MAG_DIA.length - k).reduce(function(a, b){ return a + b; }, 0);
    return D.MAG_DIA.reduce(function(a, b){ return a + b; }, 0) + Math.round(D.MAG_ANTES * Math.min(k - D.MAG_DIA.length, D.MAG_DIAS_ANTES) / D.MAG_DIAS_ANTES);
  };

  /* termos e sites de exemplo: proporção do que o YouTube informou (soma 1). A cauda some sozinha abaixo de 3 views (limiar do YouTube) */
  var TERMOS = [['hanói o que fazer', .26], ['quanto custa viajar para o vietnã', .20], ['tnfigueiredo', .13], ['hotel bairro antigo hanói', .10], ['viajar sozinho sudeste asiático', .08], ['vietnã vale a pena', .06], ['chip de celular vietnã', .05], ['thiago figueiredo vlog', .04], ['hanói em 3 dias', .03], ['comida de rua hanói', .02], ['trem noturno hanói sapa', .015], ['câmbio dong real', .01], ['hanói chuva outubro', .005]];
  var TERMOS_X = [['como fazer um mochilão pelo sudeste asiático gastando pouco em 2026 roteiro completo com preços e dicas de segurança', .21], ['hanói o que fazer', .16], ['quanto custa viajar para o vietnã', .13], ['tnfigueiredo', .1], ['thiago figueiredo mochilão sudeste asiático', .08], ['vietnã vale a pena em 2026?', .07], ['visto vietnã brasileiro eletrônico', .06], ['你好 hanói', .04], ['chip celular vietnã viettel vinaphone', .035], ['café com ovo hanói', .03], ['hanoi old quarter hotel', .02]];
  var SITES = [['pt.wikipedia.org/wiki/Hanói', .30], ['reddit.com/r/vietnam', .22], ['blog.mochilaoseasia.com.br/roteiro-vietna', .17], ['tripadvisor.com.br/Tourism-g293924-Hanoi', .12], ['t.co', .09], ['facebook.com', .06], ['news.ycombinator.com', .03], ['pinterest.com', .01]];
  var SITES_X = [['pt.wikipedia.org/wiki/Hanói_(capital_do_Vietnã)_e_arredores_historia_economia_e_turismo_no_sudeste_asiático', .24], ['reddit.com/r/solotravel', .19], ['blog.mochilaoseasia.com.br/roteiro-vietna-cambodja-laos-2026-completo', .14], ['tripadvisor.com.br', .1], ['t.co', .09], ['instagram.com', .08], ['facebook.com', .06], ['news.google.com', .04], ['youtube.com/redirect', .02]];
  function lista(base, soma){ var out = [], s = 0; base.forEach(function(b){ var v = Math.round(soma * b[1]); if (v >= 3) { out.push({ t: b[0], v: v }); s += v; } }); return { itens: out, soma: s }; }

  /* o cenário completo de uma tela. estado: tipico | extremo | magro | zero | nao-medido | vazio | erro | leitura */
  D.cenario = function(tela, estado, p){
    var ext = estado === 'extremo', mag = estado === 'magro', zero = estado === 'zero', novo = estado === 'vazio';
    var nmd = estado === 'nao-medido', pub = tela === 'video' ? (zero ? '2019-05-14' : novo ? D.VAZIO_PUB : '2026-09-20') : null;
    var per = D.periodo(tela, p, pub), perf = ext ? P.ext : tela === 'video' ? P.videoTip : P.canalTip;
    /* cOr/cLr: cobertura REAL, que gera as views do dia a dia (as views existem, medidas ou não pela coleta nova).
       cO/cL: cobertura da coleta de origem e do relatório em lote; no estado "não medido" as duas são 0 dias, e TUDO que a tela mostra deriva delas */
    var cOr = D.cob(per, D.COLETA), cLr = D.cob(per, D.LOTE);
    var cO = nmd ? D.cob(per, D.COLETA_FUT) : cOr, cL = nmd ? D.cob(per, D.COLETA_FUT) : cLr, c = { per: per, pub: pub, cO: cO, cL: cL, estado: estado, tela: tela, coleta: nmd ? D.COLETA_FUT : D.COLETA };
    var R = ext ? (tela === 'canal' ? P.ext.R : 38200) : perf.R, Rant = ext ? (tela === 'canal' ? P.ext.Rant : 30500) : perf.Rant;
    if (zero) { R = 0; Rant = 3; }
    /* views do dia a dia: o total que as partes têm de fechar */
    function viewsEm(okDias, totalDias){ return okDias * R + (totalDias - okDias) * Rant; }
    c.totalPeriodo = tela === 'canal' && p === 'tudo' && perf.tudo ? perf.tudo : viewsEm(cOr.ok, per.dias);
    c.totalMedido = viewsEm(cO.ok, cO.ok);
    if (mag) { c.totalPeriodo = D.viewsMag(per.dias); c.totalMedido = D.viewsMag(cO.ok); }
    if (zero) { c.totalPeriodo = tela === 'video' && p === 'tudo' ? 41200 : 0; c.totalMedido = 0; }
    if (novo) { c.totalPeriodo = D.VAZIO_VIEWS; c.totalMedido = 0; }
    var viewsL = mag ? D.viewsMag(cLr.ok) : zero ? 0 : viewsEm(cOr.ok, cLr.ok);
    /* origem das views */
    var o = repart(c.totalMedido, mag ? { pesq: 3 / 14, sug: 2 / 14 } : perf.o);
    c.orig = { v: o.v, om: o.om, total: c.totalMedido };
    /* impressões por origem (lote): janela própria */
    var impDia = mag ? 91 : perf.imp, impTot = zero ? 0 : cL.ok * impDia;
    var im = repart(impTot, mag ? { nav: .41, sug: .33, pesq: .1, sh: .02, out: .05 } : perf.im);
    c.imp = { v: im.v, om: im.om, total: impTot, cob: cL };
    /* aparelho, país, inscritos (mesma cobertura da origem) */
    var ap = repart(c.totalMedido, mag ? { cel: 4 / 14 } : perf.ap);
    c.apar = { v: ap.v, om: ap.om, total: c.totalMedido };
    var pesos = {}; perf.pa.forEach(function(x){ pesos[x[0]] = x[2]; }); pesos.OUTROS = perf.paOutros; pesos.ZZ = perf.paZZ;
    var pa = repart(c.totalMedido, mag ? { BR: 5 / 14 } : pesos);
    c.pais = { v: pa.v, om: pa.om, total: c.totalMedido, nomes: perf.pa };
    var ins = repart(c.totalMedido, mag ? { sub: 1 / 14, nsub: 4 / 14 } : perf.in);
    c.insc = { v: ins.v, om: ins.om, total: c.totalMedido };
    /* termos e sites: janela do lote; só comparam com a origem quando os dois cobrem os mesmos dias */
    var mesmaJanela = cL.ok === cO.ok;
    var pesqL = Math.round(viewsL * (ext ? P.ext.o.pesq : perf.o.pesq)), extL = Math.round(viewsL * (ext ? P.ext.o.ext : perf.o.ext));
    var t = lista(ext ? TERMOS_X : TERMOS, pesqL * perf.idFrac), s = lista(ext ? SITES_X : SITES, extL * perf.idSite);
    if (mag) { t = { itens: [], soma: 0 }; s = { itens: [], soma: 0 }; pesqL = Math.round(viewsL * 3 / 14); extL = 0; }
    if (zero) { t = { itens: [], soma: 0 }; s = { itens: [], soma: 0 }; pesqL = 0; extL = 0; }
    c.termos = { itens: t.itens, soma: t.soma, base: pesqL, cmp: mesmaJanela, cob: cL };
    c.sites = { itens: s.itens, soma: s.soma, base: extL, cmp: mesmaJanela, cob: cL };
    c.viewsL = viewsL;
    /* linhas antigas do cartão da comparação (impressões, cliques, taxa, % assistido): derivam do MESMO perfil, na janela de 7 dias do cartão (r3) */
    var imp7 = zero || novo ? 0 : per.dias * impDia, taxa = D.TAXA;
    /* r5 (B3): no magro os cliques derivam das views da janela (12 views x 0,8 = 10 cliques) e a taxa é cliques ÷ impressões; nos outros a taxa é a fixa */
    var cliMag = mag ? Math.round(c.totalPeriodo * D.MAG_CLIQUE_POR_VIEW) : null;
    if (mag && imp7) taxa = cliMag / imp7;
    var meia = imp7 ? 1.96 * Math.sqrt(taxa * (1 - taxa) / imp7) : 0;
    c.card = { imp: imp7, cliques: mag ? cliMag : imp7 >= 1000 ? Math.round(imp7 * taxa / 10) * 10 : Math.round(imp7 * taxa), views: c.totalPeriodo, taxa: taxa, lo: taxa - meia, hi: taxa + meia, n: imp7, assist: zero || novo ? null : D.ASSIST_PERFIL[mag ? 'magro' : ext ? 'extremo' : 'tipico'] };
    return c;
  };

  /* inteiros que somam 100 (maior resto): a lista e a frase nunca discordam */
  D.pcts = function(vals){
    var tot = vals.reduce(function(a, b){ return a + b; }, 0); if (!tot) return vals.map(function(){ return 0; });
    var raw = vals.map(function(v){ return v / tot * 100; }), fl = raw.map(Math.floor), resto = 100 - fl.reduce(function(a, b){ return a + b; }, 0);
    raw.map(function(r, i){ return [r - fl[i], i]; }).sort(function(a, b){ return b[0] - a[0]; }).slice(0, resto).forEach(function(x){ fl[x[1]]++; });
    return fl;
  };
})();

/* 3b-dados.js: os "mundos" de exemplo da tela 3b (vídeo próprio com faixa "em teste A/B" e faixa "antes do início do registro").
   TUDO é exemplo inventado (títulos, números, datas de teste). Nada vem do canal real do dono. Semente fixa: o desenho é sempre o mesmo.
   Regras de leitura (as do mockup 3 aprovado, mais as da E18, spec 05-canal-proprio.md 7.5.5):
   - lados: até 7 dias de cada lado da troca; ficam de fora o dia anterior e o dia da troca (a troca é lida às 09:00 e o dia do YouTube é do Pacífico), o dia da publicação,
     e os dias além da troca vizinha (de QUALQUER origem, inclusive o ciclo de um teste A/B);
   - dia medido sem linha = zero medido; dia que o YouTube ainda não entregou = não medido (fora da soma);
   - limiar: 100 impressões por lado, senão "ainda não dá para dizer". */
(function(){
  'use strict';
  var A = window.A4, D = window.B3D = {};
  D.REG = '2026-10-07';      /* início do registro de versões (spec 7.5.4) */
  D.REACH = '2026-09-08';    /* impressões por dia existem desde esta data */
  var J = A.JANELA, MIN = A.MIN_IMP;

  /* ------------------------------------------------------------------ série de impressões e cliques por dia */
  function serie(o){
    var r = A.rnd(o.seed), out = [];
    A.faixaDias(o.ini, o.fim).forEach(function(d){
      if (d > o.ultFechado || (o.nm || []).indexOf(d) >= 0) { out.push({ d: d, v: null, e: 'nm' }); return; }
      var b = o.nivel(d), v = b <= 0 ? 0 : Math.max(0, Math.round(b * (.78 + r() * .44)));
      if (!v) { out.push({ d: d, v: 0, e: 'zero', cl: 0 }); return; }
      var c = o.ctr(d) * (.92 + r() * .16); out.push({ d: d, v: v, e: 'com', cl: v * c, ctr: c });
    });
    return out;
  }
  function viewsDe(imp, seed){ var r = A.rnd(seed), acc = 0;
    /* r8/S1: views do dia = cliques estimados do dia x 1,3 a 2,5 (o resto vem de fora das impressões: busca, inscritos), nunca acima das impressões do dia; o resto fracionário passa para o dia seguinte, para o total fechar com os cliques */
    return imp.map(function(x){ if (x.e === 'nm') return { d: x.d, v: null, e: 'nm' }; var v = 0; if (x.v > 0) { acc += (x.cl || 0) * (1.3 + r() * 1.2); v = Math.min(x.v, Math.floor(acc)); acc -= v; } return v ? { d: x.d, v: v, e: 'com' } : { d: x.d, v: 0, e: 'zero' }; }); }

  /* ------------------------------------------------------------------ eventos (trocas e ciclos de teste), para cortar as janelas */
  function eventos(M){
    var ev = M.trocas.map(function(t){ return { d: t.d, tipo: 'troca', n: t.n }; });
    M.testes.forEach(function(te){ (te.ciclos || []).forEach(function(c){ ev.push({ d: c, tipo: 'ciclo', teste: te }); }); });
    return ev.sort(function(a, b){ return a.d < b.d ? -1 : 1; });
  }
  function soma(S, a, b){
    var r = { dias: 0, imp: 0, cl: 0, de: null, ate: null, zeros: 0, nm: [] }, pul = [];
    for (var j = a; j <= b; j++) { var x = S[j]; if (x && x.e === 'nm') { pul.push(x.d); continue; } if (!x) continue; r.dias++; if (!r.de) r.de = x.d; r.ate = x.d; if (x.e === 'com') { r.imp += x.v; r.cl += x.cl || 0; } else r.zeros++; }
    /* r6/B1: dias não medidos DENTRO do intervalo (entre o primeiro e o último dia medido); o rótulo do lado os cita, para N dias fechar com as datas */
    r.nm = pul.filter(function(d){ return r.de && d > r.de && d < r.ate; });
    r.cliques = Math.round(r.cl); return r;
  }
  /* um lado da troca: st = ok | pouca | zero | nm | sem | cortada; por = quem cortou; motivo de "sem" */
  function lado(M, k, quem){
    var S = M.serie, ids = S.map(function(x){ return x.d; }), t = M.trocas[k], i = ids.indexOf(t.d), ev = eventos(M).filter(function(e){ return !(e.tipo === 'troca' && e.n === t.n); });
    var ult = ids.indexOf(M.ultFechado), pi = ids.indexOf(M.pub), prev = null, next = null;
    ev.forEach(function(e){ if (e.d < t.d) prev = e; else if (e.d > t.d && !next) next = e; });
    var nome = function(e){ return e.tipo === 'ciclo' ? { tipo: 'ciclo', d: e.d, teste: e.teste } : { tipo: 'troca', n: e.n, d: e.d }; };
    var r;
    if (quem === 'antes') {
      var lo = Math.max(i - 1 - J, pi + 1, 0), hi = i - 2;
      if (hi < lo || i - 2 < 0) return { st: 'sem', dias: 0, imp: 0, motivo: pi + 1 > hi ? 'pub' : 'registro', de: null };
      var lo2 = prev ? Math.max(lo, ids.indexOf(prev.d) + 1) : lo;
      if (lo2 > hi) return { st: 'cortada', dias: 0, imp: 0, por: nome(prev), lado: 'antes' };
      r = soma(S, lo2, hi);
    } else {
      var lo3 = i + 1, hi3 = i + J;
      if (lo3 > ult) return { st: 'nm', dias: 0, imp: 0, dia1: A.addDias(t.d, 1), primeiro: A.addDias(t.d, 3), cheia: A.addDias(t.d, 3 + J - 1), depois: true };
      var hi4 = next ? Math.min(hi3, ids.indexOf(next.d) - 2) : hi3;
      if (lo3 > hi4) return { st: 'cortada', dias: 0, imp: 0, por: nome(next), lado: 'depois' };
      r = soma(S, lo3, Math.min(hi4, ult));
    }
    if (!r.dias) return { st: 'nm', dias: 0, imp: 0, depois: quem === 'depois', dia1: A.addDias(t.d, 1), primeiro: A.addDias(t.d, 3), cheia: A.addDias(t.d, 3 + J - 1) };
    r.st = r.imp === 0 ? 'zero' : r.imp < MIN ? 'pouca' : 'ok'; r.cheia = r.dias >= J; return r;
  }
  /* leitura da troca k: k = sobe | cai | igual | poucas | nm | sem | cortada | semorigem */
  D.leitura = function(M, k){
    var t = M.trocas[k], a = lado(M, k, 'antes'), d = lado(M, k, 'depois'), r = { a: a, d: d, vr: null };
    if (t.origem === 'desconhecida') r.k = 'semorigem';
    else if (d.st === 'nm') r.k = 'nm';
    else if (a.st === 'sem') r.k = 'sem';
    else if (a.st === 'cortada' || d.st === 'cortada') r.k = 'cortada';
    else if (a.st === 'nm') r.k = 'nm';
    else if (a.imp < MIN || d.imp < MIN) r.k = 'poucas';
    else { r.vr = A.veredito({ cliques: a.cliques, imp: a.imp }, { cliques: d.cliques, imp: d.imp }); r.k = r.vr.k; }
    return r;
  };

  /* ------------------------------------------------------------------ os mundos */
  var CAPA = function(tom){ return { tom: tom }; };
  var LONGO = 'Eu morei 30 dias em Hanói gastando só o que um brasileiro gasta em casa: o custo real, dia a dia, sem pacote, sem enrolação e sem patrocínio';
  function base(id, o){
    var M = Object.assign({ id: id, testes: [], trocas: [], pre: null, registro: { ok: true }, leitor: 'dono', exemplo: true }, o);
    M.ultFechado = A.addDias(M.hoje, -2); M.fim = A.addDias(M.hoje, -1);
    return M;
  }
  D.mundo = function(id){
    var M;
    if (id === 'tipico' || id === 'leitura') {
      M = base(id, { hoje: '2026-11-17', pub: '2026-09-22', janelaIni: '2026-10-12', futuro: true,
        viewsAntes: 0, lr: .0456, cr: .0056, mediana: 300,
        video: { t: 'Quanto custa uma semana em Bangkok?', pub: '2026-09-22', dur: 812 }, /* r4/S4: outro vídeo que os de 14/07, para as datas não se contradizerem ao alternar os estados */
        testes: [{ id: 't1', de: '2026-10-20', ate: '2026-11-02', ciclos: ['2026-10-20', '2026-10-23', '2026-10-26', '2026-10-29', '2026-11-01'], fim: 'o vencedor foi aplicado em 03/11' }],
        trocas: [{ n: 1, d: '2026-11-03', tipo: 't', origem: 'vencedor', teste: 't1', antes: 'Bangkok: o custo de uma semana, sem enrolação', depois: 'Quanto custa uma semana em Bangkok?' },
          { n: 2, d: '2026-11-09', tipo: 'm', origem: 'fora', antes: CAPA(0), depois: CAPA(1) }],
        leitor: id === 'leitura' ? 'leitura' : 'dono' });
      M.serie = serie({ ini: M.pub, fim: M.fim, ultFechado: M.ultFechado, seed: 1117, nivel: function(d){ return 150 * Math.exp(-A.dias(M.pub, d) / 20) + 58; }, ctr: function(d){ return d >= '2026-11-10' ? .058 : .041; } });
    } else if (id === 'extremo') {
      M = base(id, { hoje: '2026-11-17', pub: '2026-08-04', janelaIni: '2026-10-12', futuro: true,
        viewsAntes: 0, lr: .0453, cr: .0071, mediana: 3300,
        video: { t: LONGO, pub: '2026-08-04', dur: 1840 },
        testes: [{ id: 'ta', de: '2026-10-14', ate: '2026-10-19', ciclos: ['2026-10-14', '2026-10-16', '2026-10-18'], fim: 'o vencedor foi aplicado em 20/10' },
          { id: 'tb', de: '2026-11-08', ate: '2026-11-11', ciclos: ['2026-11-08', '2026-11-10'], fim: 'o teste foi parado em 12/11 e o original voltou', parado: '2026-11-12' }],
        trocas: [{ n: 1, d: '2026-10-20', tipo: 't', origem: 'vencedor', teste: 'ta', antes: 'Eu morei 30 dias em Hanói: o custo real, dia a dia', depois: 'Eu morei 30 dias em Hanói (e a conta final me surpreendeu)' },
          { n: 2, d: '2026-10-30', tipo: 'm', origem: 'fora', antes: CAPA(0), depois: CAPA(1) },
          { n: 3, d: '2026-11-05', tipo: 't', origem: 'fora', antes: 'Eu morei 30 dias em Hanói (e a conta final me surpreendeu)', depois: LONGO },
          { n: 4, d: '2026-11-06', tipo: 'm', origem: 'fora', antes: CAPA(1), depois: CAPA(0) },
          { n: 5, d: '2026-11-12', tipo: 't', origem: 'restauro', teste: 'tb', antes: 'Teste B: «Hanói: o preço de tudo»', depois: LONGO },
          { n: 6, d: '2026-11-14', tipo: 'm', origem: 'desconhecida', antes: CAPA(0), depois: CAPA(1) }] });
      M.serie = serie({ ini: M.pub, fim: M.fim, ultFechado: M.ultFechado, seed: 3030, nivel: function(d){ return 5200 * Math.exp(-A.dias(M.pub, d) / 70) + 1900; },
        ctr: function(d){ return d < '2026-10-31' ? .028 : d < '2026-11-05' ? .075 : .06; } });
    } else if (id === 'hoje' || id === 'erro' || id === 'vazio' || id === 'so-teste' || id === 'so-reconstruido') {
      M = base(id, { hoje: '2026-10-13', pub: id === 'so-reconstruido' ? '2026-05-18' : '2026-07-14', janelaIni: '2026-09-14', futuro: false,
        viewsAntes: id === 'so-reconstruido' ? 212 : 84, lr: id === 'so-reconstruido' ? .03 : .06, cr: id === 'so-reconstruido' ? .004 : .008,
        video: { t: id === 'so-reconstruido' ? 'Bali ou Tailândia: onde o dinheiro rende mais' : 'Quanto custa uma semana em Hanói?', pub: id === 'so-reconstruido' ? '2026-05-18' : '2026-07-14', dur: 886, normal: null, normalMotivo: 'a mediana dos outros vídeos ainda não foi medida' } });
      M.serie = serie({ ini: M.janelaIni, fim: M.fim, ultFechado: M.ultFechado, seed: 1013 + id.length, nm: ['2026-09-27', '2026-09-28'], nivel: function(d){ return d > '2026-10-06' ? 1.7 : 1.1; }, ctr: function(d){ return .07 + (d.charCodeAt(9) % 3) * .02; } });
      if (id === 'hoje' || id === 'erro') M.trocas = [{ n: 1, d: '2026-10-09', tipo: 't', origem: 'fora', antes: 'Hanói: quanto um brasileiro gasta em 7 dias', depois: M.video.t }];
      if (id === 'hoje') M.trocas.push({ n: 2, d: '2026-10-12', tipo: 'm', origem: 'fora', antes: CAPA(0), depois: CAPA(1) });
      if (id === 'erro') M.registro = { ok: false, falhaDe: '2026-10-12', ultima: '2026-10-11' };
      if (id === 'so-teste') M.testes = [{ id: 'ts', de: '2026-10-03', ate: null, ciclos: ['2026-10-03', '2026-10-06', '2026-10-09', '2026-10-12'], fim: null }];
      if (id === 'so-reconstruido') M.pre = { teste: 'de 31/05 a 07/06/2026', itens: [
        { quando: null, ciclo: 'título original', titulo: 'Bali ou Tailândia: qual é mais barata?' },
        { quando: '2026-05-31T14:00', ciclo: 'ciclo 1 de 4', titulo: 'Bali ou Tailândia: onde o dinheiro rende mais' },
        { quando: '2026-06-02T14:00', ciclo: 'ciclo 2 de 4', titulo: 'Bali x Tailândia: a conta de 15 dias' },
        { quando: '2026-06-04T14:00', ciclo: 'ciclo 3 de 4', titulo: 'Bali ou Tailândia: onde o dinheiro rende mais' },
        { quando: '2026-06-06T14:00', ciclo: 'ciclo 4 de 4', titulo: 'Bali x Tailândia: a conta de 15 dias' }] };
    } else if (id === 'semnumero') {
      M = base(id, { hoje: '2026-10-13', pub: '2026-10-06', janelaIni: '2026-10-06', futuro: false,
        viewsAntes: 0, lr: .0625, cr: 0,
        video: { t: 'Hanói em 7 dias: o custo real, dia a dia', pub: '2026-10-06', dur: 702, normal: null, normalMotivo: 'o vídeo é novo' },
        trocas: [{ n: 1, d: '2026-10-08', tipo: 't', origem: 'fora', antes: 'Quanto custa Hanói em 7 dias', depois: 'Hanói em 7 dias: o custo real' },
          { n: 2, d: '2026-10-10', tipo: 'm', origem: 'fora', antes: CAPA(0), depois: CAPA(1) },
          { n: 3, d: '2026-10-12', tipo: 't', origem: 'fora', antes: 'Hanói em 7 dias: o custo real', depois: 'Hanói em 7 dias: o custo real, dia a dia' }] });
      M.serie = serie({ ini: M.pub, fim: M.fim, ultFechado: M.ultFechado, seed: 777, nivel: function(){ return 9; }, ctr: function(){ return .05; } });
    } else if (id === 'zero') {
      M = base(id, { hoje: '2026-10-20', pub: '2026-07-14', janelaIni: '2026-09-21', futuro: false,
        viewsAntes: 101, lr: .06, cr: .008,
        video: { t: 'Quanto custa uma semana em Hanói?', pub: '2026-07-14', dur: 886, normal: null, normalMotivo: 'a mediana dos outros vídeos ainda não foi medida' },
        trocas: [{ n: 1, d: '2026-10-09', tipo: 't', origem: 'fora', antes: 'Hanói: quanto um brasileiro gasta em 7 dias', depois: 'Quanto custa uma semana em Hanói?' }] });
      M.serie = serie({ ini: M.janelaIni, fim: M.fim, ultFechado: M.ultFechado, seed: 5, nm: ['2026-09-30', '2026-10-15'], nivel: function(d){ return d < '2026-09-28' ? 1.6 : 0; }, ctr: function(){ return .06; } });
    } else return D.mundo('tipico');
    M.views = viewsDe(M.serie, 99);
    /* FONTE ÚNICA do cabeçalho (r3): views do vídeo = views de antes da série + soma dos dias medidos + estimativa dos dias ainda não entregues; curtidas, comentários,
       engajamento, "o normal do canal" e a idade saem daí. Nenhum número do cabeçalho é digitado, então ele nunca contradiz o gráfico. */
    (function(){
      var v = M.video, ms = M.views.filter(function(x){ return x.e !== 'nm'; }), tot = ms.reduce(function(a, x){ return a + x.v; }, 0), nmN = M.views.length - ms.length;
      M.viewsMedidos = tot; M.viewsNm = nmN;
      v.views = (M.viewsAntes || 0) + tot + Math.round((ms.length ? tot / ms.length : 0) * nmN);
      v.likes = Math.round(v.views * M.lr); v.com = Math.round(v.views * M.cr); v.eng = v.views ? (v.likes + v.com) / v.views : null;
      if (M.mediana) { v.normal = v.views / M.mediana; v.normalSub = 'mediana dos outros vídeos: ' + A.n(M.mediana) + ' views'; }
      v.idadeTxt = A.dias(v.pub, M.hoje) + (A.dias(v.pub, M.hoje) === 1 ? ' dia' : ' dias');
    })();
    M.vistaImp = M.serie.filter(function(x){ return x.d >= M.janelaIni; });
    M.vistaViews = M.views.filter(function(x){ return x.d >= M.janelaIni; });
    return M;
  };
})();

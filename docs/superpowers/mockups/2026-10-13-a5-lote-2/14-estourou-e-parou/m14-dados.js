/* m14-dados.js: dados de exemplo e a conta da leitura M10 (mockup 14). TUDO É EXEMPLO: canais, vídeos e números inventados.
   O mundo do exemplo é 20/04/2027 (a leitura só passa a existir a partir de 01/01/2027). A conta é a do spec (04, linha 22):
   (i) V30 >= 2x a mediana de V30 do canal; (ii) cauda <= metade da mediana de cauda do canal E "ainda rende" <= 2%; (iii) engajamento aos 30 dias <= metade da mediana.
   Igual ao limite VALE (>= e <=); a comparação usa tolerância de 1e-9 só para não depender de ponto flutuante. */
(function(){
  'use strict';
  var A = window.A4, M = window.M14 = {};
  M.HOJE = '2027-04-20';
  M.MIN_V30 = 1000; M.MIN_VIDEOS = 5; M.IDADE_MIN = 90; M.RENDE_MAX = 0.02; M.FATOR_V30 = 2; M.FATOR_METADE = 0.5;
  var EPS = 1e-9;

  /* canais fictícios (medianas do canal, só de vídeos longos com a medida dos 30 dias e 90 dias de idade) */
  M.CANAIS = {
    nomade: { nome: 'Nômade Raiz', medV30: 54000, medCauda: 0.34, medEng: 0.022, nElegiveis: 14 },
    lucas:  { nome: 'Lucas Bigodinho', medV30: 41500, medCauda: 0.34, medEng: 0.022, nElegiveis: 11 },
    dale:   { nome: 'Dale Philip', medV30: 52000, medCauda: 0.30, medEng: 0.020, nElegiveis: 9 },
    paddy:  { nome: 'Paddy Doyle', medV30: 47000, medCauda: 0.36, medEng: 0.019, nElegiveis: 8 },
    lodir:  { nome: 'Lodir', medV30: 520, medCauda: 0.28, medEng: 0.031, nElegiveis: 7 },
    aldinho:{ nome: 'Aldinho', medV30: 31000, medCauda: 0.31, medEng: 0.024, nElegiveis: 6 },
    leo:    { nome: 'Leo', medV30: 38000, medCauda: 0.33, medEng: 0.021, nElegiveis: 3 }
  };

  /* v30 = views aos 30 dias; hoje = views de hoje; g28 = views ganhas nos últimos 28 dias; r30 = curtidas + comentários aos 30 dias */
  M.VIDEOS = {
    tipico:  { canal: 'nomade', t: '12 países para morar com 2 mil reais por mês', pub: '2027-01-06', dur: 1124, v30: 183640, hoje: 201480, g28: 2190, r30: 1102, likes: 3120, com: 410 },
    extremo: { canal: 'nomade', t: 'Aluguei a ilha inteira por um dia', pub: '2027-01-14', dur: 874, v30: 2386000, hoje: 2391200, g28: 1900, r30: 380, likes: 910, com: 96 },
    borda:   { canal: 'lucas', t: 'A passagem mais barata do mundo (eu testei)', pub: '2027-01-09', dur: 968, v30: 83000, hoje: 100000, g28: 1660, r30: 913, likes: 1420, com: 188 },
    zero:    { canal: 'nomade', t: 'Dormi 7 noites num hotel cápsula', pub: '2027-01-11', dur: 1041, v30: 120480, hoje: 120480, g28: 0, r30: 600, likes: 640, com: 95 },
    nao:     { canal: 'dale', t: 'Vietnã de moto em 10 dias', pub: '2027-01-08', dur: 1302, v30: 150400, hoje: 170900, g28: 2256, r30: 2406, likes: 3870, com: 530 },
    'nao-rende': { canal: 'paddy', t: 'O voo que ninguém quer pegar', pub: '2027-01-12', dur: 755, v30: 141200, hoje: 160000, g28: 4378, r30: 1100, likes: 1900, com: 240 },
    'nm-semv30': { canal: 'nomade', t: 'Bangkok em 48 horas sem gastar nada', pub: '2026-09-20', dur: 702, v30: null, hoje: 96200, g28: 1400, r30: null, likes: 2210, com: 301 },
    'nm-v30baixo': { canal: 'lodir', t: 'Cheguei em Lisboa sem reserva', pub: '2027-01-15', dur: 640, v30: 640, hoje: 830, g28: 20, r30: 31, likes: 41, com: 7 },
    'nm-canal': { canal: 'leo', t: 'Trem noturno de Hanói a Sapa', pub: '2027-01-07', dur: 1190, v30: 91000, hoje: 98500, g28: 900, r30: 940, likes: 1500, com: 210 },
    'nm-semreacao': { canal: 'aldinho', t: 'Mochila de 7 kg para 3 meses', pub: '2027-01-13', dur: 980, v30: 98200, hoje: 105600, g28: 1100, r30: null, likes: null, com: null, curtidasOcultas: true, comentariosOff: true },
    'nm-aovivo': { canal: 'nomade', t: 'AO VIVO: respondendo suas dúvidas de visto', pub: '2027-01-10', dur: 5400, v30: 240000, hoje: 252000, g28: 800, r30: 1900, likes: 4100, com: 2800, aoVivo: true },
    'nm-cedo': { canal: 'lucas', t: 'Quanto custa uma semana em Chiang Mai?', pub: '2027-02-18', dur: 1011, v30: 91000, hoje: 119000, g28: 15000, r30: 1300, likes: 2200, com: 310 }
  };

  function eh(x, lim, mais){ return mais ? x >= lim - EPS : x <= lim + EPS; }

  /* devolve: res ('pico' | 'nao' | 'nm'), motivo (se nm), idade, c1, c2 (a e b), c3, falha (qual não bateu) */
  M.avaliar = function(chave){
    var v = M.VIDEOS[chave], ch = M.CANAIS[v.canal], r = { chave: chave, v: v, ch: ch, idade: A.dias(v.pub, M.HOJE) };
    var motivo = null;
    if (v.aoVivo) motivo = 'aovivo';
    else if (v.v30 == null) motivo = 'semv30';
    else if (v.v30 < M.MIN_V30) motivo = 'v30baixo';
    else if (ch.nElegiveis < M.MIN_VIDEOS) motivo = 'canal';
    else if (r.idade < M.IDADE_MIN) motivo = 'cedo';
    var semReacao = !!(v.curtidasOcultas && v.comentariosOff);
    if (!motivo && semReacao) motivo = 'semreacao';
    r.motivo = motivo;
    if (v.v30 != null && v.v30 >= M.MIN_V30) {
      var lim1 = M.FATOR_V30 * ch.medV30;
      r.c1 = { val: v.v30, med: ch.medV30, lim: lim1, razao: v.v30 / ch.medV30, vale: eh(v.v30, lim1, true), igual: Math.abs(v.v30 - lim1) < EPS };
      var cauda = (v.hoje - v.v30) / v.hoje, lim2 = ch.medCauda * M.FATOR_METADE, rende = v.g28 / v.v30;
      r.c2 = { cauda: cauda, medCauda: ch.medCauda, limCauda: lim2, razao: cauda / ch.medCauda, valeCauda: eh(cauda, lim2, false), igualCauda: Math.abs(cauda - lim2) < EPS,
        rende: rende, limRende: M.RENDE_MAX, valeRende: eh(rende, M.RENDE_MAX, false), igualRende: Math.abs(rende - M.RENDE_MAX) < EPS, ganho: v.g28, hoje: v.hoje, v30: v.v30 };
      r.c2.vale = r.c2.valeCauda && r.c2.valeRende;
      if (!semReacao && v.r30 != null) {
        var eng = v.r30 / v.v30, lim3 = ch.medEng * M.FATOR_METADE;
        r.c3 = { eng: eng, med: ch.medEng, lim: lim3, razao: eng / ch.medEng, vale: eh(eng, lim3, false), igual: Math.abs(eng - lim3) < EPS, r30: v.r30, v30: v.v30 };
      }
    }
    if (motivo) { r.res = 'nm'; return r; }
    var vales = [r.c1.vale, r.c2.vale, r.c3.vale];
    r.n = vales.filter(Boolean).length;
    r.res = r.n === 3 ? 'pico' : 'nao';
    r.falha = !r.c3.vale ? 'c3' : !r.c2.vale ? 'c2' : 'c1';
    return r;
  };

  /* as nove linhas do Outliers por caso: res, quais sinais valem e o motivo curto de "não medido" */
  var OUT = [
    { t: '12 países para morar com 2 mil reais por mês', canal: 'Nômade Raiz', idade: 104, x: 3.4, th: 0 },
    { t: 'A passagem mais barata do mundo (eu testei)', canal: 'Lucas Bigodinho', idade: 101, x: 2.0, th: 1 },
    { t: 'Vietnã de moto em 10 dias', canal: 'Dale Philip', idade: 102, x: 2.9, th: 2 },
    { t: 'O voo que ninguém quer pegar', canal: 'Paddy Doyle', idade: 98, x: 3.0, th: 3 },
    { t: 'Bangkok em 48 horas sem gastar nada', canal: 'Nômade Raiz', idade: 212, x: 2.6, th: 4 },
    { t: 'Quanto custa uma semana em Chiang Mai?', canal: 'Lucas Bigodinho', idade: 61, x: 2.2, th: 5 },
    { t: 'AO VIVO: respondendo suas dúvidas de visto', canal: 'Nômade Raiz', idade: 100, x: 4.4, th: 6 },
    { t: 'Ilhas da Tailândia fora da temporada', canal: 'Paddy Doyle', idade: 97, x: 3.2, th: 7 },
    { t: 'Trem noturno de Hanói a Sapa', canal: 'Leo', idade: 103, x: 2.4, th: 8 }
  ];
  function lin(i, res, sinais, motivo, idade){ var o = OUT[i]; return { t: o.t, canal: o.canal, idade: idade || o.idade, x: o.x, th: o.th, res: res, sinais: sinais, motivo: motivo || null }; }
  /* sinais: um caractere por condição (muitas views cedo, quase nada depois, pouca reação): v = bate, n = não bate, m = não medido.
     Regra: o mesmo vídeo tem o mesmo resultado em `cheio` e `zero` (e no Histórico); a primeira casa NUNCA é n (todo outlier tem 2× ou mais). No `magro` (canal novo na leitura) o vídeo sem a medida dos 30 dias tem sempre 199 dias ou mais (só vídeo publicado antes de 03/10/2026 não a tem; hoje = 20/04/2027), por isso a idade é passada à parte; o motivo 'cedo' só vale abaixo de 90 dias, 'v30baixo' só com múltiplo menor que 2× (nenhuma linha do Outliers) e 'canal' é o mesmo do Histórico. `zero` só troca as duas linhas que eram com a leitura por 'não é o caso' com a primeira casa 'v'. */
  M.OUTLIERS = {
    cheio: [lin(0, 'pico', 'vvv'), lin(1, 'pico', 'vvv'), lin(2, 'nao', 'vvn'), lin(3, 'nao', 'vnv'), lin(4, 'nm', 'mmm', 'semv30'), lin(5, 'nm', 'mmm', 'cedo'),
      lin(6, 'nm', 'mmm', 'aovivo'), lin(7, 'nao', 'vvn'), lin(8, 'nm', 'mmm', 'canal')],
    magro: [lin(0, 'pico', 'vvv'), lin(1, 'nm', 'mmm', 'semv30', 205), lin(2, 'nm', 'mmm', 'semv30', 210), lin(3, 'nm', 'mmm', 'semv30', 230), lin(4, 'nm', 'mmm', 'semv30'), lin(5, 'nm', 'mmm', 'cedo'),
      lin(6, 'nm', 'mmm', 'aovivo'), lin(7, 'nm', 'mmm', 'semv30', 215), lin(8, 'nm', 'mmm', 'canal')],
    zero: [lin(0, 'nao', 'vvn'), lin(1, 'nao', 'vnv'), lin(2, 'nao', 'vvn'), lin(3, 'nao', 'vnv'), lin(4, 'nm', 'mmm', 'semv30'), lin(5, 'nm', 'mmm', 'cedo'),
      lin(6, 'nm', 'mmm', 'aovivo'), lin(7, 'nao', 'vvn'), lin(8, 'nm', 'mmm', 'canal')]
  };
  M.contar = function(linhas){ var c = { pico: 0, nao: 0, nm: 0 }; linhas.forEach(function(l){ c[l.res]++; }); return c; };
})();

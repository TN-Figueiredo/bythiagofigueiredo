/* pc-dados.js: dados de EXEMPLO da página do canal de concorrente (mockup 15). Nomes e números inventados; nenhum dado real do dono.
   Tudo é calculado a partir da mesma lista de vídeos (A.rnd com semente: o exemplo é sempre o mesmo), então as partes fecham com o total:
   a linha do tempo soma as views dos vídeos, a direção M3 sai da linha do tempo, "3 de 12" sai da lista de vídeos.
   Cada caso tem a sua "data de hoje" (cfg.hoje): o caso padrão é o real de 13/10/2026; "cheio" e "extremo" são SIMULAÇÕES de 12/05/2027.
   Regras de medida (spec 04, 6.1.1): M2 ponto com menos de 3 vídeos não existe; M3a pede 56 dias de registro; M3c só existe a partir de abril/2027;
   M4 pede 5 vídeos e mostra % só com 10; M6 pede 4 publicações; M8 queda pede 112 dias limpos (contagem muda em 24/08/2026). */
(function(){
  'use strict';
  var A = window.A4, D = window.PC = {};
  D.COR = '2026-08-24';      /* o YouTube mudou a contagem de views */
  D.INICIO = '2026-10-03';   /* a contagem diária por vídeo começou */
  D.COLETA = '2026-10-11';   /* a coleta de comentários e a leitura por hora começaram */
  /* r6 (C1): UMA regra para as duas janelas: o dia da mudança (24/08) é sujo e NÃO conta; o primeiro dia limpo é 25/08. limpaEm(n) = a primeira data em que n dias limpos já passaram. */
  D.limpaEm = function(n){ return A.addDias(D.COR, n); };
  D.LIMPA_56 = D.limpaEm(56);           /* 19/10/2026: 25/08 a 19/10 são 56 dias */
  D.LIMPA_112 = D.limpaEm(112);         /* 14/12/2026: 25/08 a 14/12 são 112 dias */
  D.DIAS_COMENT = 30;                   /* r6 (B1): o vídeo só entra na base de "Criador responde" quando já tem 30 dias de comentários guardados */
  D.MAX_IDADE_RESP = 90;                /* ... e ainda é dos últimos 90 dias (idade de 30 a 89 dias) */
  D.IDADES = [1, 2, 3, 5, 7, 14, 21, 30];
  D.MIN_N = 3;
  var TL = ['Uma semana em Lisboa gastando só 50 euros', 'Mochilão pelo Vietnã: o roteiro completo', 'Cartagena de Indias: vale a pena?', 'Os erros que todo mochileiro comete na primeira viagem', 'Dormi em 7 hostels em Buenos Aires', 'Quanto custa viver em Chiang Mai', 'Peru em 15 dias: roteiro e custos', 'A cidade mais barata da Europa', 'Tóquio com 100 dólares por dia', 'Como achar passagem barata em 2027', 'O que ninguém conta sobre morar em Medellín', 'Machu Picchu sem agência: passo a passo', '24 horas em Istambul', 'Viajei sozinho para o Marrocos', 'Ilhas gregas fora de temporada', 'Seguro viagem: qual eu uso', 'O Rio de Janeiro visto por um gringo', 'O trem mais bonito do mundo', 'Cinco países em um mês', 'Camping na Patagônia chilena', 'Mercado de rua em Bangkok: o que vale comer', 'Voo de 19 horas na classe econômica', 'Hostel ou apartamento: a conta real', 'Cusco, Arequipa e o Colca em 9 dias', 'Aluguei uma moto em Bali', 'Praga no inverno: o que fazer', 'Como não perder dinheiro no câmbio', 'Salar de Uyuni em 3 dias', 'Fiquei sem bateria no meio da trilha', 'O bairro de Lisboa que ninguém visita'];
  var TS = ['Isso custou R$ 4 em Hanói', 'Aeroporto às 4 da manhã', 'O quarto mais barato de Praga', 'Café da manhã em Medellín', 'Perdi o ônibus em Cusco', 'O trem lotado de Tóquio', 'Banho gelado em Bali', 'Mochila de 7 kg: o que levei', 'Preço do táxi em Bangkok', 'A fila do museu em Paris', 'Meu quarto de hostel por R$ 30', 'Lanche de rua em Istambul', 'O que cabe em uma mala de mão', 'Metrô de Londres em 20 segundos', 'Pedi o prato mais barato em Lisboa', 'Chuva em Hanói, e agora?', 'Dormi no aeroporto de Doha', 'Cartão que não cobra IOF', 'Ônibus noturno no Peru', 'A vista de graça em Lisboa'];
  var TLIA = ['Como usei IA para montar um roteiro em 10 minutos', 'Os 5 agentes que eu uso todo dia', 'Testei três modelos de linguagem na mesma tarefa', 'Automatizei meu e-mail com IA: o passo a passo', 'IA para estudar: o método que funcionou comigo', 'O que muda com os novos modelos de código', 'Montei um assistente de voz em casa', 'Prompt bom e prompt ruim: a diferença real', 'IA no trabalho: o que vale a pena pagar', 'Rodei um modelo local no meu notebook', 'Como resumir 100 páginas em 2 minutos', 'Erros que todo iniciante comete com IA', 'Criei um site inteiro só com IA', 'Planilhas com IA: do zero ao relatório', 'O que a IA ainda não faz direito', 'Comparei assistentes de código lado a lado', 'IA para fotos: edição em lote', 'Como treinei um modelo pequeno do zero', 'Meu fluxo de trabalho com agentes', 'Vale a pena aprender programação em 2027?', 'Transcrição automática: qual ferramenta usar', 'Tradução em tempo real: testei de verdade', 'Segurança e privacidade ao usar IA', 'Como pedir revisão de texto para uma IA', 'O custo real de rodar um agente o dia todo', 'Dados públicos e IA: um exemplo prático', 'Cinco automações para quem trabalha sozinho', 'IA e planilhas: o erro mais comum', 'Montei um bot de atendimento em uma tarde', 'O que aprendi com 100 horas de IA'];
  var TSIA = ['Prompt de 10 segundos que resume qualquer texto', 'Atalho para pedir código melhor', 'Isso a IA ainda erra', 'Um truque para planilhas', 'Teste rápido de modelo local', 'Como pedir uma tabela perfeita', 'Revisão de texto em 15 segundos', 'O erro de prompt que todo mundo faz', 'Transcrever áudio sem pagar', 'O comando que mudou meu fluxo', 'Resumo de reunião em 30 segundos', 'Pergunta certa, resposta melhor', 'Corrigi um bug só descrevendo', 'Três atalhos para o assistente', 'IA lendo um PDF de 200 páginas', 'O que não colar no chat', 'Voz para texto em dois toques', 'Comparei duas respostas lado a lado', 'Meu primeiro agente em 1 minuto', 'Quando a IA inventa um dado'];
  var AUTORES = ['M', 'R', 'J', 'A', 'L'];

  function mediana(a){ return A.mediana(a); }
  function iso(d){ return d; }

  /* ---------------------------------------------------------------- o mundo de um canal */
  function mundo(c){
    var R = A.rnd(c.seed), hoje = c.hoje, fim = c.leituraAte || hoje;       /* fim: último dia com leitura (erro, fora do ar) */
    var m = { c: c, hoje: hoje, fim: fim, vids: [], dias: [], tudo: [] };
    /* 1. publicações dos últimos 240 dias */
    var ini = A.addDias(hoje, -240), d, i, k = 0, ultimaL = null;
    for (d = ini; d <= fim; d = A.addDias(d, 1)) {
      var sem = A.dias(d, hoje);
      if (c.semPub && sem >= 0 && sem < c.semPub) continue;                      /* canal parado: nada nos últimos N dias */
      if (c.pausas && c.pausas.some(function(p){ return sem >= p[0] && sem < p[1]; })) continue;
      var pl = c.soShorts ? 0 : c.pubL / 7, ps = c.pubS / 7;
      /* r5 (S1): sem publicação na faixa em que a grade de 13 semanas (até hoje) e as janelas de 90 dias (até a última leitura) divergem; assim as duas contas somam o mesmo */
      var faixa = sem >= 90 && sem <= 90 + A.dias(fim, hoje);
      if (R() < pl) { var rl = R(); if (!faixa) m.vids.push({ fmt: 'long', pub: d, r: rl }); }
      if (R() < ps) { var rs0 = R(); if (!faixa) m.vids.push({ fmt: 'short', pub: d, r: rs0 }); }
    }
    if (c.ajustaPub) c.ajustaPub(m.vids, hoje);
    /* r4: canal novo, primeira busca em andamento: o canal só tem os vídeos já buscados (os mais novos); as semanas mais antigas são "não buscadas" e não têm marca de publicação */
    if (c.novo) m.vids = m.vids.filter(function(v){ return A.dias(v.pub, hoje) < 35; });
    m.buscados = m.vids.length; m.totalVideos = c.totalVideos || 48;
    m.vids.forEach(function(v, n){
      var idade = A.dias(v.pub, hoje);
      var qq = Math.exp((R() + R() + R() - 1.5) * (c.disp || 0.9)) * Math.exp((c.inclina || 0) * (idade / 240 - 0.5));
      if (c.tetoQ) qq = Math.min(Math.max(qq, 0.6), c.tetoQ);
      v.q = qq; v.t = c.nicho === 'IA' ? (v.fmt === 'long' ? TLIA[(n * 7 + c.seed) % TLIA.length] : TSIA[(n * 3 + c.seed) % TSIA.length]) : (v.fmt === 'long' ? TL[(n * 7 + c.seed) % TL.length] : TS[(n * 3 + c.seed) % TS.length]);
      v.id = 'v' + n;
      v.serie = !c.novo && v.pub >= (c.regDesde > D.INICIO ? c.regDesde : D.INICIO);        /* tem contagem diária do vídeo: só desde o início da contagem e do cadastro do canal (r4: canal cadastrado em 12/10 não tem contagem de vídeo de antes disso) */
      v.dur = v.fmt === 'long' ? 420 + Math.floor(R() * 900) : 28 + Math.floor(R() * 30);
    });
    if (c.destaques) c.destaques.forEach(function(x){ var L = m.vids.filter(function(v){ return v.fmt === 'long' && A.dias(v.pub, hoje) >= x[0]; }); if (L.length > x[1]) { L.sort(function(a, b){ return b.pub < a.pub ? -1 : 1; }); L[x[1]].q = x[2]; } });
    m.vids.sort(function(a, b){ return a.pub < b.pub ? 1 : a.pub > b.pub ? -1 : 0; });
    /* r6 (B1): os comentários do exemplo são de vídeos longos da BASE de "Criador responde" (idade de 30 a 89 dias na última leitura) e vieram DEPOIS da publicação,
       dentro dos primeiros 30 dias do vídeo (x.apos = dias depois da publicação, de 1 a 29). O "há N dias" sai da conta: idade do vídeo − apos. */
    m.coment = []; var usados = {};
    (c.comentarios || []).forEach(function(x){
      var cand = m.vids.filter(function(v){ var i = A.dias(v.pub, fim); return v.fmt === 'long' && !usados[v.id] && i >= D.DIAS_COMENT && i < D.MAX_IDADE_RESP; })[0];
      if (!cand) return;
      m.vids.forEach(function(o){ if (o !== cand && o.t === x.v) o.t = cand.t; });
      cand.t = x.v; usados[cand.id] = 1;
      m.coment.push({ v: x.v, quem: x.quem, texto: x.texto, resp: x.resp, apos: x.apos, dias: A.dias(cand.pub, fim) - x.apos, pub: cand.pub, idadeVideo: A.dias(cand.pub, fim) });
    });
    /* r4: mudança de campo e troca são de um vídeo que existe e vieram DEPOIS da publicação (a troca de miniatura de um vídeo que ainda não saiu era o erro); o registro começa em 03/10 */
    var evs = [], ordem = {};
    (c.eventos || []).slice().sort(function(a, b){ return a.d < b.d ? -1 : 1; }).forEach(function(x, ix){
      if (x.d < D.INICIO || x.d > fim) return;
      var cand = m.vids.filter(function(v){ return A.dias(v.pub, x.d) >= 1; })[x.k != null ? x.k : ix % 3]; if (!cand) return;
      var e = Object.assign({}, x, { t: cand.t, vid: cand.id });
      if (e.tipo === 'troca') { ordem[cand.id] = (ordem[cand.id] || 0) + 1; e.n = ordem[cand.id]; }
      evs.push(e);
    });
    m.eventos = evs;
    /* 2. views por idade: V30 = escala x q; a curva sobe rápido nos primeiros dias */
    m.vids.forEach(function(v){
      v.v30 = Math.round((v.fmt === 'long' ? c.vscale : c.sscale) * v.q);
      v.tau = v.fmt === 'long' ? 6 : 2; v.cauda = c.cauda != null ? c.cauda : v.fmt === 'long' ? 0.28 : 0.1;   /* c.cauda: canal cujos vídeos antigos quase não ganham views (estado zero medido) */
    });
    function noIdade(v, a){
      if (a <= 0) return 0;
      var f = (1 - Math.exp(-a / v.tau)) / (1 - Math.exp(-30 / v.tau));
      return a <= 30 ? v.v30 * f : v.v30 * (1 + v.cauda * Math.log(1 + (a - 30) / 30));
    }
    m.noIdade = noIdade;
    m.vids.forEach(function(v){ v.idade = A.dias(v.pub, fim); v.views = Math.round(noIdade(v, v.idade)); v.v30m = v.serie && v.idade >= 30; });
    /* 3. views ganhas por dia do canal: soma dos vídeos + o acervo antigo (acervo com inclinação) */
    var reg = c.regDesde, falta = c.diasSemRegistro || [];
    for (d = A.addDias(hoje, -119); d <= hoje; d = A.addDias(d, 1)) {
      var e = 'com', v = 0;
      if (d > fim || d < reg) { m.tudo.push({ d: d, v: null, e: d > fim ? (c.foraEm ? 'fora' : 'nm') : 'nm' }); continue; }
      if (falta.indexOf(d) >= 0) { m.tudo.push({ d: d, v: null, e: 'nm' }); continue; }
      var idx = A.dias(A.addDias(hoje, -89), d);  /* pode ser negativo: o acervo segue a mesma tendência */
      var base = c.acervo * (1 + (c.tendencia || 0) * (idx / 89 - 0.5)) * (0.86 + R() * 0.28) * (1 + 0.12 * Math.sin(idx * 2 * Math.PI / 7));
      m.vids.forEach(function(vi){ var a = A.dias(vi.pub, d); if (a >= 0) v += noIdade(vi, a + 1) - noIdade(vi, a); });
      var vp = Math.round(v * (1 + R() * 0.08)), bp = Math.max(0, Math.round(base));        /* r6 (S1): vp = o que os vídeos ganharam no dia; bp = o acervo antigo; o canal é a soma, então nunca tem menos que os vídeos */
      v = bp + vp;
      if (c.muitoZero && R() < c.muitoZero && vp === 0) { v = 0; bp = 0; }      /* dia de zero medido: só onde nenhum vídeo ganhou nada naquele dia */
      m.tudo.push({ d: d, v: v, vp: vp, bp: bp, e: v === 0 ? 'zero' : 'com' });
    }
    if (c.janelas) {                                                              /* o exemplo conta a história pedida: ajusta cada janela de 28 dias para a razão desejada (mais recente primeiro) */
      var at = fim === hoje ? m.tudo.length : A.dias(A.addDias(hoje, -119), fim) + 1, W = [], alvoJ = [], kk;
      function somaJ(a, b){ var t = 0; for (var q = a; q < b; q++) { if (!m.tudo[q] || m.tudo[q].v == null) return null; t += m.tudo[q].v; } return t; }
      for (kk = 0; kk < 4; kk++) W.push(somaJ(at - 28 * (kk + 1), at - 28 * kk));
      var nw = 0; while (nw < 4 && W[nw] != null) nw++;
      if (nw >= 2) {
        alvoJ[nw - 1] = W[nw - 1]; for (kk = nw - 2; kk >= 0; kk--) alvoJ[kk] = alvoJ[kk + 1] * (1 + c.janelas[kk]);
        /* r6 (S1): o ajuste mexe só no acervo antigo (bp); o que os vídeos ganharam (vp) fica como está, então a identidade "canal ≥ soma dos vídeos" vale em todo dia */
        for (kk = 0; kk < nw; kk++) {
          var bs = 0, vs = 0, q;
          for (q = at - 28 * (kk + 1); q < at - 28 * kk; q++) { bs += m.tudo[q].bp; vs += m.tudo[q].vp; }
          var fat = bs ? Math.max(0, (alvoJ[kk] - vs) / bs) : 1; m.ajuste = (m.ajuste || []).concat([{ k: kk, fat: fat, alvo: alvoJ[kk], vids: vs, acervo: bs }]);
          for (q = at - 28 * (kk + 1); q < at - 28 * kk; q++) { var x = m.tudo[q]; if (x && x.v != null) { x.bp = Math.round(x.bp * fat); x.v = x.bp + x.vp; x.e = x.v === 0 ? 'zero' : 'com'; } }
        }
      }
    }
    m.dias = m.tudo.slice(30);                                                    /* a linha do tempo mostra 90 dias; a escada de M8 precisa de 120 */
    /* 4. mudanças registradas: eventos { d, tipo: 'pub'|'campo'|'troca', ... } (histórico de campo só desde a E1, 03/10) */
    m.ev = [];
    m.vids.forEach(function(v){ if (v.pub >= A.addDias(hoje, -89) && v.pub <= fim) m.ev.push({ d: v.pub, tipo: 'pub', fmt: v.fmt, t: v.t }); });
    m.eventos.forEach(function(x){ if (x.d >= A.addDias(hoje, -89) && x.d <= fim) m.ev.push(x); });
    /* 5. medidas */
    medidas(m);
    return m;
  }

  function soma(dias, a, b){ var s = 0, ok = true; for (var i = a; i < b; i++) { if (!dias[i] || dias[i].v == null) ok = false; else s += dias[i].v; } return ok ? s : null; }

  function medidas(m){
    var c = m.c, hoje = m.hoje, fim = m.fim, n = m.tudo.length, M = m.M = {};
    /* M3a: 28 x 28 dias, a partir dos dias de cima */
    var dre = Math.floor(A.dias(c.regDesde, fim));
    var ate = fim === hoje ? n : A.dias(A.addDias(hoje, -119), fim) + 1;           /* índice do último dia lido + 1 */
    var u = soma(m.tudo, ate - 28, ate), p = soma(m.tudo, ate - 56, ate - 28);
    if (dre + 1 < 56 || u == null || p == null) {
      M.a = { nm: 'menos de 56 dias de registro', quando: fim < hoje ? null : A.addDias(c.regDesde, 55), dias: dre + 1, parou: fim < hoje };
    } else {
      M.a = { u: u, p: p, r: u / p - 1, cruza: A.addDias(fim, -55) <= D.COR, limpa: fim < hoje ? null : D.LIMPA_56, parou: fim < hoje };
    }
    /* M3b: mediana de views dos longos novos, 90 dias contra os 90 anteriores */
    var L = m.vids.filter(function(v){ return v.fmt === 'long'; });
    function jan(a, b, campo){ return L.filter(function(v){ var i = A.dias(v.pub, fim); return i >= a && i < b && v[campo] != null && (campo !== 'v30' || v.v30m); }).map(function(v){ return v[campo]; }); }
    var b1 = jan(0, 90, 'views'), b0 = jan(90, 180, 'views');
    M.b = (b1.length >= 3 && b0.length >= 3) ? { u: mediana(b1), p: mediana(b0), nu: b1.length, np: b0.length, r: mediana(b1) / mediana(b0) - 1 } : { nm: 'menos de 3 vídeos longos em um dos períodos', nu: b1.length, np: b0.length };
    var c1 = jan(0, 90, 'v30'), c0 = jan(90, 180, 'v30');
    /* r4 (B1): a barra de 180 dias conta desde max(cadastro, início da contagem por vídeo), com o último dia lido dentro; canal parado (erro, fora do ar) conta só até a última leitura e não promete data */
    var iniC = c.regDesde > D.INICIO ? c.regDesde : D.INICIO, diasC = Math.max(0, A.dias(iniC, fim) + 1), parou = fim < hoje;
    if (diasC < 180) M.c = { nm: 'depende da contagem por vídeo', quando: parou ? null : A.addDias(iniC, 179), dias: diasC, de: 180, desdeIni: iniC, parou: parou };
    else M.c = (c1.length >= 3 && c0.length >= 3) ? { u: mediana(c1), p: mediana(c0), nu: c1.length, np: c0.length, r: mediana(c1) / mediana(c0) - 1 } : { nm: 'menos de 3 vídeos longos com 30 dias medidos', nu: c1.length, np: c0.length };
    /* três janelas de 28 dias seguidas (M8, queda sustentada) */
    var limpoDesde = c.regDesde > D.COR ? c.regDesde : A.addDias(D.COR, 1), dl = A.dias(limpoDesde, fim) + 1;   /* r6 (C1): o dia 24/08 não conta; o primeiro dia limpo é 25/08 (ou o cadastro, se for depois). Hoje conta; a barra fecha em início + 111 */
    if (dl >= 112) {
      var w = []; for (var k = 0; k < 4; k++) w.push(soma(m.tudo, ate - 28 * (k + 1), ate - 28 * k));
      M.escada = w.every(function(x){ return x != null; }) ? [w[0] / w[1] - 1, w[1] / w[2] - 1, w[2] / w[3] - 1] : null;
      if (!M.escada) M.escadaNm = { dias: dl, de: 112, quando: fim < hoje ? null : A.addDias(limpoDesde, 111), cadastro: c.regDesde > D.COR, desdeIni: limpoDesde, parou: fim < hoje };
    } else M.escadaNm = { dias: Math.max(0, dl), de: 112, quando: fim < hoje ? null : A.addDias(limpoDesde, 111), cadastro: c.regDesde > D.COR, desdeIni: limpoDesde, parou: fim < hoje };
    /* M4: acerto (longos dos últimos 90 dias, com 7 dias ou mais) */
    var alvo = (c.soShorts ? m.vids.filter(function(v){ return v.fmt === 'short'; }) : L), c4 = alvo.filter(function(v){ var i = A.dias(v.pub, fim); return i >= 7 && i < 90; });
    if (c.soShorts) M.a4 = { nm: 'este canal não tem vídeos longos', soShorts: true };
    else if (c4.length < 5) M.a4 = { nm: 'menos de 5 vídeos', n: c4.length };
    else {
      var md = mediana(c4.map(function(v){ return v.views; }));
      c4.forEach(function(v){ v.mult = v.views / md; });
      M.a4 = { n: c4.length, k: c4.filter(function(v){ return v.mult >= 2; }).length, f: c4.filter(function(v){ return v.mult <= 0.5; }).length, lista: c4.slice().sort(function(a, b){ return b.mult - a.mult; }) };
    }
    /* M6: ritmo (13 semanas, o formato principal) e o maior buraco em 26 */
    var fmtP = c.soShorts ? 'short' : 'long', P = m.vids.filter(function(v){ return v.fmt === fmtP; });
    function semanas(fmt){ var s = []; for (var i = 12; i >= 0; i--) { var a = i * 7, b = a + 7; s.push(m.vids.filter(function(v){ var x = A.dias(v.pub, hoje); return v.fmt === fmt && x >= a && x < b; }).length); } return s; }
    var wl = semanas(fmtP), ws = semanas(fmtP === 'long' ? 'short' : 'long');
    var pubs13 = P.filter(function(v){ return A.dias(v.pub, hoje) < 91; }).map(function(v){ return v.pub; }).sort();
    var ints = []; for (var j = 1; j < pubs13.length; j++) ints.push(A.dias(pubs13[j - 1], pubs13[j]));
    /* B1 (r2): o maior buraco usa o formato principal (a mesma base da grade) e conta o intervalo ainda aberto, do último vídeo até hoje (ou até a última leitura) */
    var pubsP = P.filter(function(v){ return A.dias(v.pub, hoje) < 182; }).map(function(v){ return v.pub; }).sort(), bur = null;
    for (j = 1; j < pubsP.length; j++) { var g = A.dias(pubsP[j - 1], pubsP[j]); if (!bur || g > bur.d) bur = { d: g, de: pubsP[j - 1], ate: pubsP[j], aberto: false }; }
    if (pubsP.length) { var gA = A.dias(pubsP[pubsP.length - 1], fim); if (!bur || gA >= bur.d) bur = { d: gA, de: pubsP[pubsP.length - 1], ate: fim, aberto: true }; }
    var ultima = P.length ? P[0].pub : null, ultAny = m.vids.length ? m.vids[0].pub : null, desde = ultAny ? A.dias(ultAny, fim) : null;
    /* semana "não medida": canal novo (as mais antigas ainda não foram buscadas) ou semana que termina depois da última leitura (r5, C2: a mesma regra nas duas raias, com ou sem vídeo na semana; o vídeo continua na Linha do tempo) */
    function semNm(arr){ return arr.map(function(k, idx){ var fimSem = A.addDias(hoje, -((12 - idx) * 7)); return !!((c.novo && idx < 8) || fimSem > fim); }); }
    var nmL = semNm(wl), nmS = semNm(ws), semMed = 13 - nmL.filter(Boolean).length;
    /* B2 (r2): só as semanas medidas entram nas contas; a semana desenhada como "—" não conta publicação */
    var npMed = wl.reduce(function(a, k, i){ return a + (nmL[i] ? 0 : k); }, 0), semCom = wl.filter(function(k, i){ return !nmL[i] && k > 0; }).length;
    var ultP = P.length ? P[0].pub : null, doisFmt = m.vids.some(function(v){ return v.fmt === 'long' && A.dias(v.pub, hoje) < 182; }) && m.vids.some(function(v){ return v.fmt === 'short' && A.dias(v.pub, hoje) < 182; });
    M.r = { doisFmt: doisFmt, ultimaP: ultP, desdeP: ultP ? A.dias(ultP, fim) : null, fmt: fmtP, semL: wl, semS: ws, nmL: nmL, nmS: nmS, semMed: semMed, pubs: npMed, porSemana: semMed ? npMed / semMed : 0, semCom: semCom, mediana: ints.length ? mediana(ints) : null, buraco: bur, desde: desde, ultima: ultAny };
    if (npMed < 4 || c.ritmoParcial) M.r.nm = c.ritmoParcial ? 'o canal ainda está buscando vídeos' : 'menos de 4 ' + (fmtP === 'long' ? 'longos' : 'Shorts') + ' na janela';
    M.r.limite = Math.max(28, M.r.mediana == null || M.r.nm ? 28 : 4 * M.r.mediana);
    /* M8 */
    if (c.novo) { M.estado = 'novo'; M.a4 = { nm: 'ainda buscando vídeos' }; M.b = { nm: 'o canal ainda está buscando vídeos', nu: 0, np: 0 }; }
    else if (c.foraEm) M.estado = 'fora';
    else if (c.erroHoras) M.estado = 'erro';
    else if (desde != null && desde > M.r.limite) M.estado = 'parado';
    else if (M.escada && M.escada.every(function(x){ return x <= -0.1; })) M.estado = 'queda';
    else M.estado = 'ativo';
    /* M2: a linha do normal, de cada idade, sobre os vídeos com contagem diária */
    var S = alvo.filter(function(v){ return v.serie && A.dias(v.pub, fim) <= 180; });
    M.normal = D.IDADES.map(function(a){
      var xs = S.filter(function(v){ return v.idade >= a; }).map(function(v){ return noIdadeR(m, v, a); });
      return { a: a, n: xs.length, v: xs.length >= D.MIN_N ? mediana(xs) : null };
    });
    M.recentes = S.filter(function(v){ return v.idade >= 1; }).slice(0, 6);   /* os 6 mais recentes que já completaram um dia de contagem */
    M.recentes.forEach(function(v){
      v.pts = []; for (var a = 0; a <= Math.min(30, v.idade); a++) v.pts.push(noIdadeR(m, v, a));
      v.rel = null; var ult = null;
      D.IDADES.forEach(function(a){ var nm = M.normal.filter(function(x){ return x.a === a; })[0]; if (nm.v != null && v.idade >= a) { ult = { a: a, r: noIdadeR(m, v, a) / nm.v }; if (v.rel == null && ult.r >= 1.5) v.rel = { a: a, r: ult.r }; } });
      v.ult = ult;
    });
    /* M14: 72 horas. A leitura por hora começou em 11/10/2026; só conta o vídeo que já completou 72 horas na última leitura (r4: o "hoje N" vem dos vídeos, não de um número digitado) */
    var q72 = P.filter(function(v){ return v.pub >= '2026-10-11' && A.dias(v.pub, fim) >= 3 && A.dias(v.pub, hoje) < 90; }).length;
    if (c.erroHoras || c.foraEm) M.h72 = { nm: c.h72Motivo, n: q72 };
    else if (q72 < 3) M.h72 = { nm: 'a leitura por hora começou em 11/10', n: q72 };
    else M.h72 = { metade: 14, n: q72 };
    /* quem responde (M11), r6 (B1): a base são os vídeos longos dos últimos 90 dias que já têm 30 dias de comentários guardados (idade de 30 a 89 dias na última leitura).
       n É essa contagem (não é digitado); só k vem do exemplo, limitado a n e ao mínimo de vídeos que têm um comentário com resposta na lista. */
    var cands = L.filter(function(v){ var i = A.dias(v.pub, fim); return i >= D.DIAS_COMENT && i < D.MAX_IDADE_RESP; }).length;
    M.resp = c.resp && c.resp.k != null ? { n: cands, k: Math.max(Math.min(c.resp.k, cands), m.coment.length), cands: cands } : null;
    if (c.erroHoras) M.resp = { nm: 'sem leitura desde ' + A.dm(fim) + ': a coleta de comentários não chegou a este canal' };   /* r5 (B2): canal que parou de ser lido antes da coleta não tem data de coleta */
    /* r5 (B1, C4): "Mais números do canal" sai da mesma série. Cada média usa os 28 dias que terminam na última leitura e só existe com os 28 dias; cada percentual de 30 dias só com 30 dias de registro; todo "não medido" traz o motivo; canal sem leitura nova mostra o valor "até dd/mm" */
    var diasReg = A.dias(c.regDesde, fim) + 1, parou = fim < hoje, jan28 = m.tudo.slice(ate - 28, ate), completa = jan28.length === 28 && jan28.every(function(x){ return x.v != null; });
    var faltam = function(k){ return 'menos de ' + k + ' dias de registro' + (parou ? '; a leitura parou em ' + A.dm(fim) : '; completa em ' + A.dm(A.addDias(c.regDesde, k - 1))); };
    var soma28 = completa ? jan28.reduce(function(t, x){ return t + x.v; }, 0) : null;
    var pt = m.vids.filter(function(v){ return v.fmt === fmtP && A.dias(v.pub, fim) < 90; });
    /* r6 (C5): os inscritos novos em 30 dias saem das views (views de 28 dias × 30/28 × taxa de inscrição por view, de 0,3% a 0,7%, ou c.taxaIns) e o percentual é novos ÷ inscritos;
       abaixo do passo de arredondamento do YouTube (10 mil, 1 mil, 100 ou 10 inscritos) a tela diz "≈ 0": a mudança não aparece no número público */
    var passo = D.passoIns(c.ins), taxa = c.taxaIns != null ? c.taxaIns : (3 + c.seed % 5) / 1000;
    if (M.a && M.a.r != null && M.a.r <= -0.1 && c.taxaIns == null) taxa = taxa / 3;                    /* canal em queda de views ganha inscritos mais devagar */
    var novos = soma28 != null ? Math.round(soma28 * 30 / 28 * taxa) : null;
    M.mais = {
      ins30: diasReg < 30 ? { nm: faltam(30) } : novos == null ? { nm: faltam(28) } : novos < passo ? { zero: true, novos: novos, passo: passo } : { v: 100 * novos / c.ins, novos: novos, passo: passo },
      vpd: completa ? { v: soma28 / 28, soma: soma28 } : { nm: faltam(28) },
      eng: c.novo ? { nm: 'o canal ainda está buscando vídeos' } : c.seed % 5 === 0 ? { nm: 'curtidas ocultas pelo canal' } : { v: 2 + (c.seed % 9) / 5 },
      tip: c.novo ? { nm: 'o canal ainda está buscando vídeos' } : pt.length >= 3 ? { v: mediana(pt.map(function(v){ return v.views; })), n: pt.length } : { nm: 'menos de 3 ' + (fmtP === 'long' ? 'vídeos longos' : 'Shorts') + ' nos últimos 90 dias (hoje ' + pt.length + ')', n: pt.length },
      ate: parou ? fim : null
    };
    return m;
  }
  D.passoIns = function(ins){ return ins >= 1e6 ? 10000 : ins >= 1e5 ? 1000 : ins >= 1e4 ? 100 : 10; };   /* o YouTube arredonda a 3 algarismos */
  function noIdadeR(m, v, a){ return Math.round(m.noIdade(v, a)); }

  /* ---------------------------------------------------------------- os casos */
  var HOJE = '2026-10-13', FUT = '2027-05-12';
  var RESP_COLETA = { nm: 'a coleta de comentários começou em ' + A.dm(D.COLETA) + '; fecha em ' + A.dm(A.addDias(D.COLETA, D.DIAS_COMENT)), quando: A.addDias(D.COLETA, D.DIAS_COMENT) };
  var COMENT = [
    { v: 'Quanto custa viver em Chiang Mai', quem: 'M', texto: 'Mostrou o aluguel de verdade, sem enrolação. Fechei o orçamento por causa disso.', resp: 'Valeu! Atualizei o valor do aluguel na descrição.', apos: 4 },
    { v: 'Peru em 15 dias: roteiro e custos', quem: 'R', texto: 'E o trem para Machu Picchu, dá para ir de ônibus mesmo?', resp: 'Dá sim, mas leva o dobro do tempo. Deixei a conta no vídeo do trem.', apos: 9 },
    { v: 'A cidade mais barata da Europa', quem: 'J', texto: 'مدينة جميلة وسعرها ممتاز. Thanks for the tip!', resp: 'De nada! Boa viagem.', apos: 14 }
  ];
  var CASOS = {
    /* o caso real de hoje: canal que o dono acompanha, 10 dias de contagem por vídeo */
    magro: { id: 'magro', nome: 'Lucas Bigodinho', handle: '@lucasbigodinho', ins: 325000, nicho: 'Viagem', seed: 41, hoje: HOJE, regDesde: '2026-08-14', pubL: 1.4, pubS: 0.9, vscale: 21000, sscale: 5200, acervo: 1650, tendencia: 0.08, disp: 1.5, inclina: -0.1, janelas: [0.12, 0.05, -0.04], diasSemRegistro: ['2026-08-16'],
      resp: RESP_COLETA, comentarios: [],
      eventos: [{ d: '2026-10-06', tipo: 'campo', campo: 'descrição', t: 'Peru em 15 dias: roteiro e custos' }, { d: '2026-10-09', tipo: 'troca', troca: 'm', n: 1, t: 'Cartagena de Indias: vale a pena?' }] },
    /* simulação: a mesma tela em 12/05/2027, com dado de sete meses */
    cheio: { id: 'cheio', nome: 'Nômade Raiz', handle: '@nomaderaiz', ins: 2080000, nicho: 'Viagem', seed: 17, hoje: FUT, regDesde: '2026-08-14', pubL: 1.8, pubS: 1.6, vscale: 188000, sscale: 41000, acervo: 38000, janelas: [0.18, 0.06, -0.05], tendencia: 0.2, disp: 1.5, inclina: -0.3, simulacao: true,
      destaques: [[3, 0, 3.3], [10, 1, 2.6], [25, 0, 2.4], [100, 0, 3.0], [100, 1, 2.8]],
      resp: { k: 5 }, comentarios: COMENT,
      eventos: [{ d: '2027-03-02', tipo: 'campo', campo: 'tags', t: 'Peru em 15 dias: roteiro e custos' }, { d: '2027-03-16', tipo: 'troca', troca: 't', n: 1, t: 'Cartagena de Indias: vale a pena?' }, { d: '2027-04-04', tipo: 'campo', campo: 'descrição', t: 'Quanto custa viver em Chiang Mai' }, { d: '2027-04-20', tipo: 'troca', troca: 'm', n: 2, t: 'A cidade mais barata da Europa' }, { d: '2027-04-27', tipo: 'campo', campo: 'categoria', t: 'Tóquio com 100 dólares por dia' }] },
    extremo: { id: 'extremo', nome: 'Aventuras Extremas ao Redor do Mundo com Jorge Albuquerque', handle: '@aventurasextremasjorge', ins: 9840000, nicho: 'Viagem', seed: 23, hoje: FUT, regDesde: '2026-08-14', pubL: 1.4, pubS: 3.2, vscale: 2400000, sscale: 650000, acervo: 910000, janelas: [-0.34, -0.21, -0.14], tendencia: -0.9, disp: 1.5, inclina: 1.4, simulacao: true, destaques: [[60, 1, 0.45]],
      resp: { k: 1 }, comentarios: [COMENT[1]],
      eventos: [{ d: '2027-03-11', tipo: 'troca', troca: 't', n: 1, t: 'O trem mais bonito do mundo' }, { d: '2027-04-08', tipo: 'troca', troca: 'm', n: 2, t: 'Cinco países em um mês' }] },
    parado: { id: 'parado', nome: 'Dale Philip', handle: '@dalephilip', ins: 3740000, nicho: 'Viagem', seed: 8, hoje: HOJE, regDesde: '2026-08-14', pubL: 0.9, pubS: 0.3, vscale: 62000, sscale: 9000, acervo: 3500, janelas: [-0.2, -0.04, 0.03], tendencia: -0.1, disp: 1.5, semPub: 63, resp: RESP_COLETA, comentarios: [], eventos: [] },
    zero: { id: 'zero', nome: 'Leo Khev', handle: '@leokhev', ins: 1530, nicho: 'Viagem', seed: 61, hoje: HOJE, regDesde: '2026-08-14', pubL: 1.1, pubS: 0.2, vscale: 30, sscale: 6, acervo: 6, taxaIns: 0.001, cauda: 0.03, janelas: [0.0, 0.08, -0.05], tendencia: 0, disp: 0.3, tetoQ: 1.6, muitoZero: 0.7, pausas: [[0, 22]], resp: RESP_COLETA, comentarios: [], eventos: [{ d: '2026-10-05', tipo: 'campo', campo: 'duração' }] },
    nm: { id: 'nm', nome: 'Paddy Doyle', handle: '@paddydoyle', ins: 341000, nicho: 'Viagem', seed: 5, hoje: HOJE, regDesde: '2026-09-18', pubL: 0.22, pubS: 0.1, vscale: 9000, sscale: 2000, acervo: 600, tendencia: 0, disp: 0.4, resp: { nm: 'comentários desligados pelo canal', desligados: true }, comentarios: [], eventos: [] },
    erro: { id: 'erro', nome: 'Lodir Mundo Afora', handle: '@lodirmundoafora', ins: 187000, nicho: 'Viagem', seed: 52, hoje: HOJE, leituraAte: '2026-10-04', erroHoras: 219, regDesde: '2026-07-30', pubL: 1.4, pubS: 0.9, vscale: 6500, sscale: 1600, acervo: 4500, janelas: [0.07, 0.05, -0.02], tendencia: 0.08, disp: 1.5, inclina: -0.1, resp: null, comentarios: [], eventos: [], h72Motivo: 'o canal está em erro: sem leitura nova desde 04/10' },
    vazio: { id: 'vazio', nome: 'Aldinho Viaja', handle: '@aldinhoviaja', ins: 48200, nicho: 'Viagem', seed: 77, hoje: HOJE, regDesde: '2026-10-12', pubL: 0.6, pubS: 0.3, vscale: 4000, sscale: 900, acervo: 120, tendencia: 0, disp: 0.4, novo: true, ritmoParcial: true, resp: RESP_COLETA, comentarios: [], eventos: [] },
    fora: { id: 'fora', nome: 'Vou sem volta', handle: '@vousemvolta', ins: 593000, nicho: 'Viagem', seed: 29, hoje: HOJE, leituraAte: '2026-10-09', foraEm: '2026-10-09', regDesde: '2026-08-14', pubL: 1.0, pubS: 0.4, vscale: 4500, sscale: 1100, acervo: 2200, janelas: [0.09, 0.04, 0.02], tendencia: -0.1, disp: 1.5, resp: { nm: 'o canal saiu do YouTube', quando: null }, comentarios: [], h72Motivo: 'o canal saiu do YouTube em 09/10', eventos: [] },
    shorts: { id: 'shorts', nome: 'Viagem em 30 Segundos', handle: '@viagememtrinta', ins: 212000, nicho: 'Viagem', seed: 12, hoje: HOJE, regDesde: '2026-08-14', pubL: 0, pubS: 5.2, vscale: 0, sscale: 7400, acervo: 1900, janelas: [0.14, 0.05, 0.0], tendencia: 0.12, disp: 0.7, soShorts: true, resp: RESP_COLETA, comentarios: [], eventos: [] },
    nichos: { id: 'nichos', nome: 'Dale e as Máquinas', handle: '@daleasmaquinas', ins: 764000, nicho: 'IA', seed: 17, hoje: FUT, regDesde: '2026-08-14', pubL: 1.8, pubS: 0.4, vscale: 94000, sscale: 20000, acervo: 14000, janelas: [0.04, 0.02, 0.07], tendencia: 0.1, disp: 1.5, inclina: -0.2, simulacao: true, destaques: [[5, 0, 2.4]], nichoDiferente: true,
      resp: { k: 0 }, comentarios: [], eventos: [{ d: '2027-03-30', tipo: 'campo', campo: 'tags', t: 'Como achar passagem barata em 2027' }] },
    leitura: { id: 'leitura', base: 'cheio', soLeitura: true }
  };
  D.CASOS = CASOS;
  D.carregar = function(id){
    var c = CASOS[id] || CASOS.magro;
    if (c.base) { var b = Object.assign({}, CASOS[c.base]); Object.keys(c).forEach(function(k){ b[k] = c[k]; }); c = b; }
    return mundo(c);
  };
})();

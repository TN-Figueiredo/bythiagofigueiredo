/* 11b-dados.js: dados de EXEMPLO do mockup 11b (nomes e números inventados; nada é dado real do dono).
   Um "caso" = um vídeo + o estado de cada uma das três janelas ('7', '30', 'vida').
   Estado de janela: lida | aberta | antes | sem-dado | nao-coletada | erro
     lida          tem curva (pts), data da leitura, a comparação do YouTube (rel, ou null se o YouTube não a devolveu)
     aberta        a janela ainda não fechou: "não medido: fecha em dd/mm"
     antes         a janela fechou antes de começarmos a coletar: não volta (sem retroação)
     sem-dado      o YouTube respondeu sem nenhum ponto (tentativa sem_dado_na_janela): poucas views
     nao-coletada  nenhuma linha (estado real de hoje)
     erro          a última tentativa falhou (com ou sem leitura anterior)
   Curvas: geradas com A.rnd(seed), então o exemplo é sempre o mesmo. */
(function(){
  'use strict';
  var A = window.A4, D = window.RJD = {};
  D.HOJE = '2026-10-13';
  D.COLETA = '2026-08-15'; /* a coleta das janelas começou nesta data em todos os casos, menos 'nao-coletada' (retrato de antes de ela ligar) */
  D.N = 100; /* pontos por curva */

  /* ---------------------------------------------------------------- gerador de curva */
  /* p: { seed, end (onde termina), a (parte da queda que é rápida), k (rapidez), bumps: [[centro 0..1, largura, altura]], noise, suave }  */
  D.curva = function(p){
    var r = A.rnd(p.seed), out = [], ru = 0, n = D.N, i, t, base, v, b;
    for (i = 0; i < n; i++) {
      t = i / (n - 1);
      base = p.end + (1 - p.end) * (p.a * Math.exp(-p.k * t) + (1 - p.a) * (1 - t));
      v = base;
      (p.bumps || []).forEach(function(bp){ v += bp[2] * Math.exp(-Math.pow((t - bp[0]) / bp[1], 2)); });
      ru = ru * (p.suave == null ? .6 : p.suave) + (r() - .5) * (p.noise || .004);
      out.push(i === 0 ? 1 : Math.max(.02, v + ru));
    }
    return out;
  };
  /* ponto onde a curva cruza 50%: razão 0..1 do vídeo, ou null se nunca cruza */
  D.meio = function(pts){ for (var i = 0; i < pts.length; i++) if (pts[i] < .5) return i / (pts.length - 1); return null; };
  /* as duas maiores quedas em 5 pontos (≈5% do vídeo), distantes uma da outra */
  D.saidas = function(pts){
    var tmp = [], out = [], j;
    for (j = 0; j + 5 < pts.length; j++) tmp.push([pts[j] - pts[j + 5], j]);
    tmp.sort(function(a, b){ return b[0] - a[0]; });
    tmp.forEach(function(t){ if (out.length < 2 && out.every(function(s){ return Math.abs(s[1] - t[1]) > 12; })) out.push(t); });
    out.sort(function(a, b){ return a[1] - b[1]; });
    return out.map(function(s){ return { de: s[1], ate: s[1] + 5, vDe: pts[s[1]], vAte: pts[s[1] + 5] }; });
  };
  /* trechos em que a curva sobe (gente que voltou para rever): subidas seguidas com alta total de pelo menos 1,5 ponto */
  D.revistos = function(pts){
    var runs = [], i = 1, ini, fim, alta;
    while (i < pts.length) {
      if (pts[i] > pts[i - 1]) { ini = i - 1; while (i < pts.length && pts[i] > pts[i - 1]) i++; fim = i - 1; alta = pts[fim] - pts[ini]; if (fim - ini >= 3 && alta >= .015) runs.push([ini, fim]); } else i++;
    }
    return runs;
  };

  /* ---------------------------------------------------------------- vídeos de exemplo */
  var V = {
    hanoi:  { t: 'Quanto custa uma semana em Hanói?', pub: '2026-08-30', dur: 1022, tipo: 'longo', views: 3214, likes: 187, com: 23, normal: 1.4, normalSub: 'mediana dos outros vídeos: 2,3 mil views' },
    short:  { t: 'Café com leite condensado em Saigon', pub: '2026-09-28', dur: 38, tipo: 'short', views: 48213, likes: 3120, com: 214, normal: 20.9, normalSub: 'mediana dos outros vídeos: 2,3 mil views' },
    antigo: { t: 'Meu primeiro mês no Sudeste Asiático', pub: '2015-03-14', dur: 760, tipo: 'longo', idadeTxt: '11 anos', views: 1892, likes: 64, com: 9, normal: .8, normalSub: 'mediana dos outros vídeos: 2,3 mil views' },
    poucas: { t: 'Hostel em Chiang Mai: o que eu faria diferente', pub: '2026-08-25', dur: 312, tipo: 'longo', views: 41, likes: 3, com: 0, normal: null, normalMotivo: 'poucas views para comparar' },
    zero:   { t: 'Trem noturno Bangkok a Chiang Mai', pub: '2026-08-12', dur: 912, tipo: 'longo', views: 1730, likes: 96, com: 11, normal: .8, normalSub: 'mediana dos outros vídeos: 2,3 mil views' },
    aberta: { t: 'Moto em Phuket: o que o seguro não cobre', pub: '2026-09-25', dur: 744, tipo: 'longo', views: 905, likes: 51, com: 6, normal: .4, normalSub: 'mediana dos outros vídeos: 2,3 mil views' },
    recente:{ t: 'Visto para o Vietnã em 2026', pub: '2026-09-30', dur: 585, tipo: 'longo', views: 612, likes: 30, com: 4, normal: .3, normalSub: 'mediana dos outros vídeos: 2,3 mil views' },
    novo:   { t: 'Ilhas da Tailândia fora da temporada', pub: '2026-10-12', dur: 868, tipo: 'longo', views: 212, likes: 9, com: 1, normal: null, normalMotivo: 'o vídeo tem menos de 3 dias' },
    seis:   { t: 'Hostel ou hotel: a conta real de 30 dias', pub: '2026-10-07', dur: 1105, tipo: 'longo', views: 340, likes: 18, com: 2, normal: null, normalMotivo: 'o vídeo tem menos de 7 dias' }
  };

  function lida(d, pts, rel, extra){ var o = { e: 'lida', d: d, pts: pts, rel: rel }; if (extra) Object.keys(extra).forEach(function(k){ o[k] = extra[k]; }); return o; }
  var LONGO = { a: .55, k: 8, bumps: [[.38, .02, .035], [.62, .016, .03]], noise: .004 };
  function longo(seed, end, ex){ var p = { seed: seed, end: end, a: LONGO.a, k: LONGO.k, bumps: LONGO.bumps, noise: LONGO.noise }; if (ex) Object.keys(ex).forEach(function(k){ p[k] = ex[k]; }); return D.curva(p); }

  /* leituras da vida inteira do vídeo típico: a curva melhora um pouco a cada leitura (exemplo) */
  var leitHanoi = [
    { d: '2026-09-14', pts: longo(11, .20, { k: 9.5 }), rel: .49 },
    { d: '2026-09-28', pts: longo(12, .25, { k: 8.8 }), rel: .54 },
    { d: '2026-10-12', pts: longo(13, .31, { k: 8 }), rel: .62 }
  ];

  D.CASOS = {
    tipico: { rot: 'Típico (vídeo longo, 3 janelas)', v: V.hanoi, nota: 'Vídeo de 44 dias. As janelas de 7 e 30 dias já fecharam e foram lidas uma vez; a vida inteira tem 3 leituras.',
      j: { '7': lida('2026-09-08', longo(21, .30, { k: 10 }), .57, { views: 1480 }), '30': lida('2026-10-01', longo(22, .29, { k: 9 }), .60, { views: 2790 }),
        vida: lida('2026-10-12', leitHanoi[2].pts, .62, { leituras: leitHanoi }) } },
    aberta: { rot: 'Janela de 30 dias ainda aberta', v: V.aberta, padraoJ: '30', nota: 'Vídeo de 18 dias. A janela de 7 dias fechou e foi buscada; a de 30 dias fecha em 25/10: não medido, com a data.',
      j: { '7': lida('2026-10-05', longo(31, .33, { k: 9 }), .52, { views: 640 }), '30': { e: 'aberta', fecha: '2026-10-25' },
        vida: lida('2026-10-12', longo(33, .35, { k: 8.6 }), .52, { leituras: [{ d: '2026-10-05', pts: longo(32, .34, { k: 9 }), rel: .51 }, { d: '2026-10-12', pts: longo(33, .35, { k: 8.6 }), rel: .52 }] }) } },
    short: { rot: 'Extremo: Short, curva acima de 100%', v: V.short, nota: 'Short de 38 segundos: muita gente revê, então a curva passa de 100% e nunca cruza 50%. A comparação do YouTube encosta em 1.',
      j: { '7': lida('2026-10-07', D.curva({ seed: 41, end: .86, a: .2, k: 4, bumps: [[.96, .05, .5], [.5, .06, .04]], noise: .006 }), .97, { views: 31400 }), '30': { e: 'aberta', fecha: '2026-10-28' },
        vida: lida('2026-10-12', D.curva({ seed: 42, end: .9, a: .2, k: 4, bumps: [[.96, .05, .42], [.5, .06, .04]], noise: .006 }), .97, { leituras: [{ d: '2026-10-05', pts: D.curva({ seed: 43, end: .82, a: .2, k: 4, bumps: [[.96, .05, .36], [.5, .06, .03]], noise: .006 }), rel: .94 }, { d: '2026-10-12', pts: D.curva({ seed: 42, end: .9, a: .2, k: 4, bumps: [[.96, .05, .42], [.5, .06, .04]], noise: .006 }), rel: .97 }] }) } },
    antigo: { rot: 'Vídeo de 2015 (janelas que não voltam)', v: V.antigo, nota: 'As janelas de 7 e 30 dias fecharam em 2015, muito antes de começarmos a coletar: não medido, e não volta. A vida inteira tem a primeira leitura.',
      j: { '7': { e: 'antes', fecha: '2015-03-21' }, '30': { e: 'antes', fecha: '2015-04-13' },
        vida: lida('2026-10-12', longo(51, .22, { k: 7, bumps: [[.3, .02, .02]] }), .38, { leituras: [{ d: '2026-10-12', pts: longo(51, .22, { k: 7, bumps: [[.3, .02, .02]] }), rel: .38 }] }) } },
    serrilhada: { rot: 'Poucas views: curva serrilhada', v: V.poucas, nota: 'Só 41 views: o YouTube devolveu a curva, mas ela balança. Sem trechos revistos nem saídas marcadas.',
      j: { '7': lida('2026-09-05', D.curva({ seed: 61, end: .3, a: .5, k: 6, noise: .22, suave: .35 }), .47, { views: 38 }), '30': lida('2026-09-28', D.curva({ seed: 62, end: .28, a: .5, k: 6, noise: .2, suave: .35 }), .44, { views: 41 }),
        vida: lida('2026-10-12', D.curva({ seed: 62, end: .28, a: .5, k: 6, noise: .2, suave: .35 }), .44, { leituras: [{ d: '2026-10-12', pts: D.curva({ seed: 62, end: .28, a: .5, k: 6, noise: .2, suave: .35 }), rel: .44 }], poucas: true }) } },
    vazia: { rot: 'Poucas views: o YouTube não devolveu curva', v: V.poucas, nota: 'O YouTube respondeu sem nenhum ponto (tentativa sem_dado_na_janela). Nada de curva reta em zero.',
      j: { '7': { e: 'sem-dado', tentou: '2026-09-05' }, '30': { e: 'sem-dado', tentou: '2026-09-28' }, vida: { e: 'sem-dado', tentou: '2026-10-12' } } },
    'sem-faixa': { rot: 'YouTube sem a comparação', v: V.hanoi, nota: 'A curva veio, mas o YouTube não devolveu a comparação com vídeos de duração parecida nesta leitura (métrica recusada).',
      j: { '7': lida('2026-09-08', longo(21, .30, { k: 10 }), null, { views: 1480 }), '30': lida('2026-10-01', longo(22, .29, { k: 9 }), null, { views: 2790 }),
        vida: lida('2026-10-12', leitHanoi[2].pts, null, { leituras: [{ d: '2026-10-12', pts: leitHanoi[2].pts, rel: null }] }) } },
    zero: { rot: 'Zero medido (nenhum trecho revisto)', v: V.zero, nota: 'A curva foi buscada e nenhum trecho sobe: "0 trechos revistos" é uma medida (caixa vazada), não ausência. A comparação do YouTube é a mais baixa da escala.',
      j: { '7': lida('2026-08-21', longo(71, .16, { k: 11, bumps: [] }), .05, { views: 1100 }), '30': lida('2026-09-16', longo(72, .15, { k: 11, bumps: [] }), .03, { views: 1590 }),
        vida: lida('2026-10-11', longo(73, .14, { k: 11, bumps: [], noise: .0008 }), .02, { leituras: [{ d: '2026-09-20', pts: longo(74, .15, { k: 11, bumps: [], noise: .0008 }), rel: .03 }, { d: '2026-10-11', pts: longo(73, .14, { k: 11, bumps: [], noise: .0008 }), rel: .02 }] }) } },
    'nao-coletada': { rot: 'Não coletada (estado real de hoje)', v: V.recente, nota: 'Nenhuma leitura ainda. Retrato do estado real de hoje, antes de a coleta ligar (nos outros casos a coleta já roda desde 15/08/2026): a janela de 7 dias fechou antes de começarmos a coletar; a de 30 dias fecha em 30/10.',
      j: { '7': { e: 'antes', fecha: '2026-10-07' }, '30': { e: 'aberta', fecha: '2026-10-30' }, vida: { e: 'nao-coletada' } } },
    novo: { rot: 'Vazio (vídeo novo, de ontem)', v: V.novo, nota: 'Vídeo publicado ontem: as três janelas ainda não existem.',
      j: { '7': { e: 'aberta', fecha: '2026-10-19' }, '30': { e: 'aberta', fecha: '2026-11-11' }, vida: { e: 'nao-coletada', novo: true } } },
    erro: { rot: 'Erro de coleta (com leitura anterior)', v: V.hanoi, nota: 'A tentativa de 12/10 falhou. A leitura de 28/09 continua na tela, com o aviso.',
      j: { '7': lida('2026-09-08', longo(21, .30, { k: 10 }), .57, { views: 1480 }), '30': lida('2026-10-01', longo(22, .29, { k: 9 }), .60, { views: 2790 }),
        vida: lida('2026-09-28', leitHanoi[1].pts, .54, { leituras: [leitHanoi[0], leitHanoi[1]], erroEm: '2026-10-12', proxima: '2026-10-19' }) } },
    'erro-sem': { rot: 'Erro de coleta (sem leitura)', v: V.seis, nota: 'Vídeo de 6 dias: a primeira leitura falhou, e não há nenhuma anterior.',
      j: { '7': { e: 'aberta', fecha: '2026-10-14' }, '30': { e: 'aberta', fecha: '2026-11-06' }, vida: { e: 'erro', erroEm: '2026-10-12', proxima: '2026-10-19' } } },
    leitura: { rot: 'Só leitura (sem direito ao dado privado)', v: V.hanoi, soLeitura: true, nota: 'Quem só lê não vê a curva (vem do YouTube Analytics do canal). A tela diz isso e mostra o que existe, sem ficar muda.',
      j: { '7': lida('2026-09-08', longo(21, .30, { k: 10 }), .57), '30': lida('2026-10-01', longo(22, .29, { k: 9 }), .60), vida: lida('2026-10-12', leitHanoi[2].pts, .62, { leituras: leitHanoi }) } }
  };
  D.ORDEM = ['tipico', 'aberta', 'short', 'antigo', 'serrilhada', 'vazia', 'sem-faixa', 'zero', 'nao-coletada', 'novo', 'erro', 'erro-sem', 'leitura'];
})();

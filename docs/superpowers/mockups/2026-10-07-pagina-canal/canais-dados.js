/* canais-dados.js — rodadas 6 e 7 (09/10/2026).
   DADOS REAIS de produção lidos em 09/10/2026: os 13 concorrentes do nicho Viagem (inscritos, longos acompanhados, longos publicados
   em 90 dias, mediana de views dos longos, mediana de views/dia nos longos desde 03/10, views/dia por mil inscritos) e os DOIS canais
   próprios: tnFigueiredo (1.160 inscritos, 35 longos, mediana calculada das 35 contagens de canal-proprio-dados-reais.json; views/dia
   por vídeo ainda não medidas) e Thiago Figueiredo (3 inscritos, nenhum vídeo).
   FICTÍCIOS (rodada 7, só com ?n=70): 57 canais gerados aqui embaixo por um gerador determinístico de semente fixa, com nomes
   inventados e números coerentes com a distribuição dos 13 reais. Servem para testar a lista longa; levam `ficticio: true`
   e a tela marca cada um com a palavra "exemplo". Gerado por script; não edite os números à mão. */
window.CANAIS = {"nicho":"Viagem","lidoEm":"2026-10-09","canais":[{"id":"bald-and-bankrupt","nome":"bald and bankrupt","inscritos":4540000,"acomp":49,"l90":2,"med":3013751.0,"vpd":1306.1,"vpm":0.29},{"id":"dale-philip","nome":"Dale Philip","inscritos":3740000,"acomp":10,"l90":4,"med":157550.0,"vpd":175.4,"vpm":0.05},{"id":"nomade-raiz","nome":"Nômade Raiz","inscritos":2080000,"acomp":50,"l90":7,"med":2028448.0,"vpd":2175.4,"vpm":1.05},{"id":"vou-sem-volta","nome":"Vou sem volta","inscritos":593000,"acomp":50,"l90":14,"med":213582.0,"vpd":146.5,"vpm":0.25},{"id":"por-onde-indo-rony-bruna","nome":"Por Onde INDO 🌏 Rony & Bruna","inscritos":430000,"acomp":49,"l90":28,"med":198815.0,"vpd":618.9,"vpm":1.44},{"id":"sonhe-alto-viagens","nome":"Sonhe Alto Viagens","inscritos":389000,"acomp":9,"l90":9,"med":16701.0,"vpd":null,"vpm":null},{"id":"paddy-doyle","nome":"Paddy Doyle","inscritos":341000,"acomp":45,"l90":13,"med":65952.0,"vpd":118.4,"vpm":0.35},{"id":"lucas-bigodinho","nome":"Lucas Bigodinho","inscritos":325000,"acomp":50,"l90":14,"med":339314.0,"vpd":1055.5,"vpm":3.25},{"id":"matheus-fonseca","nome":"Matheus Fonseca","inscritos":43400,"acomp":50,"l90":13,"med":59477.0,"vpd":192.1,"vpm":4.43},{"id":"aldinho","nome":"Aldinho","inscritos":37300,"acomp":50,"l90":14,"med":8948.0,"vpd":30.8,"vpm":0.83},{"id":"lodir-negrini","nome":"Lodir Negrini","inscritos":15400,"acomp":20,"l90":12,"med":5708.0,"vpd":85.6,"vpm":5.56},{"id":"esq-unltd-daily","nome":"Esq Unltd Daily","inscritos":5870,"acomp":37,"l90":0,"med":7880.0,"vpd":3.3,"vpm":0.56},{"id":"leo-khev","nome":"Leo Khev","inscritos":1530,"acomp":34,"l90":2,"med":493.0,"vpd":0.2,"vpm":0.13}],"proprio":{"id":"proprio","nome":"tnFigueiredo","own":true,"inscritos":1160,"acomp":35,"l90":0,"med":135,"vpd":null,"vpm":null,"dias":666},"proprios":[{"id":"proprio","nome":"tnFigueiredo","own":true,"inscritos":1160,"acomp":35,"l90":0,"med":135,"vpd":null,"vpm":null,"dias":666},{"id":"proprio-2","nome":"Thiago Figueiredo","own":true,"semVideos":true,"inscritos":3,"acomp":null,"l90":null,"med":null,"vpd":null,"vpm":null}]};

(function(){
  'use strict';
  var D = window.CANAIS, NOMES = ["Mochila e Mapa", "Rota Sem Pressa", "Vida de Estrada", "Passaporte Carimbado", "Destino Incerto", "Pé na Trilha", "Mala Pronta", "Fui e Voltei", "Horizonte Aberto", "Mundo a Dois", "Viajo Logo Existo", "Carona pelo Mundo", "Sem Fronteiras TV", "Rumo ao Leste", "Bússola Quebrada", "Janela do Avião", "Trem das Onze Horas", "Casal Nômade", "Mapa Dobrado", "Estrada Afora", "Milhas e Histórias", "Cidade por Cidade", "Latitude Zero", "Asia de Mochila", "Praia Deserta Vlogs", "Cozinha de Rua", "Hostel e Café", "Fronteira Seca", "Ilhas do Sul", "Montanha Russa de Viagem", "Viajante Lento", "Diário de Bordo BR", "Volta ao Mundo em Casa", "Trilhas do Norte", "Ponte Aérea Vlog", "Embarque Imediato", "Mundo de Bike", "Kombi Azul", "Vagão Leito", "Roteiro Curto", "Dois na Estrada", "Sotaque Viajante", "Terra à Vista", "Do Outro Lado do Mapa", "Barraca e Fogareiro", "Escala Longa", "Visto Negado", "Porto Seguro Não", "Sudeste Asiático a Pé", "Check-in Tardio", "Bagagem de Mão", "Rodoviária Internacional", "Motorhome dos Sonhos", "Feira Livre do Mundo", "Caminho de Santiago BR", "Aeroporto Vazio", "Ônibus Noturno"];
  /* mulberry32, semente fixa: a lista longa é sempre a mesma */
  var a = 20261009;
  function rnd(){ a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  function logu(lo, hi){ return Math.exp(Math.log(lo) + rnd() * (Math.log(hi) - Math.log(lo))); }
  function sig3(x){ var p = Math.pow(10, Math.floor(Math.log10(x)) - 2); return Math.round(x / p) * p; }
  D.ficticios = NOMES.map(function(nome, i){
    /* faixas tiradas dos 13 reais: inscritos de 1,5 mil a 4,5 mi; mediana de views de 0,04 a 1,4 vez os inscritos;
       views/dia por mil inscritos de 0,05 a 5,6 (canal menor tende a render mais por inscrito); 0 a 28 longos em 90 dias */
    var ins = sig3(logu(3000, 5000000)), med = Math.round(ins * logu(0.04, 1.4));
    var vpm = Math.round(logu(0.05, 5.6) * (ins > 1e6 ? 0.5 : 1) * 100) / 100, l90 = Math.floor(Math.pow(rnd(), 1.6) * 29), acomp = rnd() < 0.6 ? 50 : 9 + Math.floor(rnd() * 41);
    var espera = i === 11 || i === 40;   /* dois ainda sem o 2º registro diário, como a Sonhe Alto Viagens */
    return { id: 'ficticio-' + (i + 1), nome: nome, ficticio: true, inscritos: ins, acomp: acomp, l90: l90, med: med,
      vpd: espera ? null : Math.round(vpm * ins / 1000 * 10) / 10, vpm: espera ? null : vpm };
  });
})();

/* Rodada 12: SHORTS por canal, para o filtro "Todos | Longos | Shorts" da lista.
   REAL: Leo Khev (71 Shorts em dados.js: mediana de views 1.398, 1 Short em 90 dias, 16 com contagem diária, views/dia mediana 0) e tnFigueiredo (0 Shorts nos 35 vídeos: `shorts: null`, "sem Shorts").
   Thiago Figueiredo não tem vídeos. FABRICADO (marcado `shortsFab: true`, e a tela avisa): os Shorts dos outros 12 concorrentes reais e dos 57 fictícios, gerados por um gerador de
   semente fixa PRÓPRIA (não mexe nos números dos fictícios da rodada 7), a partir dos números de longos de cada canal. ~1 em 5 canais "sem Shorts" (shorts: null). */
(function(){
  'use strict';
  var D = window.CANAIS;
  var a = 20261012;
  function rnd(){ a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  function logu(lo, hi){ return Math.exp(Math.log(lo) + rnd() * (Math.log(hi) - Math.log(lo))); }
  function sig3(x){ if (x < 100) return Math.round(x * 10) / 10; var p = Math.pow(10, Math.floor(Math.log10(x)) - 2); return Math.round(x / p) * p; }
  function fabricar(c){
    c.shortsFab = true;
    if (rnd() < 0.2){ c.shorts = null; return; }
    var s = { med: Math.round(sig3((c.med || 3000) * logu(0.4, 6))), l90: Math.floor((c.l90 || 0) * logu(0.5, 5) + rnd() * 3), acomp: rnd() < 0.6 ? 50 : 9 + Math.floor(rnd() * 41) };
    if (c.vpd == null){ s.vpd = null; s.vpm = null; }
    else { s.vpd = Math.round(c.vpd * logu(0.5, 5) * 10) / 10; s.vpm = Math.round(s.vpd / c.inscritos * 1000 * 100) / 100; }
    c.shorts = s;
  }
  D.canais.forEach(function(c){
    if (c.id === 'leo-khev'){ c.shorts = { med: 1398, l90: 1, acomp: 16, vpd: 0, vpm: 0 }; c.shortsFab = false; }
    else fabricar(c);
  });
  D.ficticios.forEach(fabricar);
  D.proprios.concat([D.proprio]).forEach(function(c){ c.shorts = null; c.shortsFab = false; });   /* tnFigueiredo: 0 Shorts (real); Thiago Figueiredo: sem vídeos */
})();

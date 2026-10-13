/* q-dados.js: dados de exemplo do mockup 17b (Outliers: ordenar por views aos 7 ou 30 dias).
   TUDO É EXEMPLO: canais, títulos e números inventados (nenhum dado real do dono). Hoje = 2026-10-13 (L.HOJE).
   HOJE: os 11 outliers de "Até 90 dias" no estado real de hoje: V7 só para quem foi publicado de 03/10 em diante e já tem 7 dias; V30 de ninguém.
   FUT: exemplo de como fica em 20/12/2026, quando V30 já existe para quase todos.
   Campos: id, t (título), c (canal), n (nicho), pub, dur (s), views (hoje), m (multiplicador), b (vídeos do canal na base), vpd (views por dia),
   f (fase: est, rec, sem), v7 / v30 (números medidos; 0 = zero medido; ausente = não medido), tarde (descoberto com mais de 24 h), live (ao vivo ou estreia), atrasado. */
(function(){
  'use strict';
  var Q = window.Q = {};
  Q.INICIO = '2026-10-03';            /* a contagem diária começou aqui */
  Q.HOJE = '2026-10-13';
  Q.FUT_HOJE = '2026-12-20';
  Q.HOJE_LISTA = [
    { id: 'a1', t: 'Vendi tudo e fui morar em Chiang Mai', c: 'Nômade Raiz', n: 'Viagem', pub: '2026-10-04', dur: 1290, views: 118600, m: 4.6, b: 14, vpd: 9500, f: 'est', v7: 82400 },
    { id: 'a2', t: 'Testei 5 agentes de IA que fazem o seu orçamento', c: 'Lucas Bigodinho', n: 'IA', pub: '2026-10-05', dur: 1068, views: 64300, m: 3.3, b: 12, vpd: 6100, f: 'est', v7: 51700 },
    { id: 'a3', t: 'Ao vivo: perdido em Tbilisi, sem plano e sem mapa', c: 'Leo', n: 'Viagem', pub: '2026-10-06', dur: 8045, views: 29100, m: 2.4, b: 9, vpd: 3200, f: 'est', v7: 24800, live: true },
    { id: 'a4', t: 'O trem mais lento do Japão e por que valeu a pena', c: 'Dale Philip', n: 'Viagem', pub: '2026-08-22', dur: 1420, views: 412000, m: 5.8, b: 9, vpd: 2900, f: 'rec' },
    { id: 'a5', t: 'Fiquei preso na fronteira do Afeganistão', c: 'Nômade Raiz', n: 'Viagem', pub: '2026-08-18', dur: 2020, views: 560000, m: 4.9, b: 14, vpd: 4100, f: 'rec' },
    { id: 'a6', t: 'Ganhei R$ 4 mil por mês com uma IA só?', c: 'Aldinho', n: 'IA', pub: '2026-08-27', dur: 1590, views: 233000, m: 4.2, b: 11, vpd: 1800, f: 'rec' },
    { id: 'a7', t: 'Hostel de R$ 20 em Lisboa: vale a pena?', c: 'Lodir', n: 'Viagem', pub: '2026-09-05', dur: 852, views: 98000, m: 3.6, b: 10, vpd: 1100, f: 'rec' },
    { id: 'a8', t: 'Comi no pior restaurante de Hanói', c: 'Dale Philip', n: 'Viagem', pub: '2026-09-14', dur: 1100, views: 76500, m: 3.1, b: 8, vpd: 2600, f: 'est' },
    { id: 'a9', t: 'Fiz o roteiro de um vídeo inteiro só com IA', c: 'Lucas Bigodinho', n: 'IA', pub: '2026-10-11', dur: 1380, views: 21400, m: 2.2, b: 12, vpd: 10700, f: 'est' },
    { id: 'a10', t: 'O prompt que dobrou a minha produtividade', c: 'Aldinho', n: 'IA', pub: '2026-10-09', dur: 740, views: 38900, m: 2.7, b: 11, vpd: 9700, f: 'est' },
    { id: 'a11', t: 'Dormi 24 horas na rodoviária de Bangkok', c: 'Paddy Doyle', n: 'Viagem', pub: '2026-10-05', dur: 1458, views: 47200, m: 3.2, b: 3, vpd: null, f: 'sem', tarde: true, atrasado: true }
  ];
  Q.FUT_LISTA = [
    { id: 'f1', t: 'Passei 30 dias sem gastar nada em Lisboa', c: 'Nômade Raiz', n: 'Viagem', pub: '2026-11-02', dur: 1500, views: 241000, m: 5.1, b: 14, vpd: 4800, v7: 61200, v30: 188400 },
    { id: 'f2', t: 'Esse agente de IA trabalha por mim de madrugada', c: 'Lucas Bigodinho', n: 'IA', pub: '2026-11-20', dur: 1130, views: 121000, m: 4.4, b: 12, vpd: 6400, v7: 48800, v30: 121000 },
    { id: 'f3', t: 'Cruzei o Marrocos de ônibus', c: 'Dale Philip', n: 'Viagem', pub: '2026-11-08', dur: 1710, views: 128000, m: 3.9, b: 9, vpd: 2300, v7: 33100, v30: 97300 },
    { id: 'f4', t: 'Hotel cápsula em Tóquio por R$ 80', c: 'Lodir', n: 'Viagem', pub: '2026-11-25', dur: 905, views: 74400, m: 3.5, b: 10, vpd: 3100, v7: 29800 },
    { id: 'f5', t: 'Ao vivo: seis horas rodando o Algarve de carro', c: 'Leo', n: 'Viagem', pub: '2026-12-01', dur: 21600, views: 31000, m: 2.3, b: 9, vpd: 1500, v7: 18900, live: true },
    { id: 'f6', t: 'Montei um app em um fim de semana com IA', c: 'Aldinho', n: 'IA', pub: '2026-11-14', dur: 1620, views: 84000, m: 3.3, b: 11, vpd: 1700, v7: 27400, v30: 71900 },
    { id: 'f7', t: 'O pior hostel do Vietnã', c: 'Paddy Doyle', n: 'Viagem', pub: '2026-11-10', dur: 1240, views: 79000, m: 3.1, b: 9, vpd: 1500, v7: 22900, v30: 64100 },
    { id: 'f8', t: 'Quanto ganha um nômade digital no Brasil', c: 'Nômade Raiz', n: 'Viagem', pub: '2026-11-29', dur: 1380, views: 52000, m: 2.9, b: 14, vpd: 2200, v7: 21200 },
    { id: 'f9', t: 'Aprendi sozinho a editar vídeo em 10 dias', c: 'Lucas Bigodinho', n: 'IA', pub: '2026-10-28', dur: 1450, views: 90100, m: 2.8, b: 12, vpd: 900, v7: 17900, v30: 58800 },
    { id: 'f10', t: 'Dormi no aeroporto de Istambul', c: 'Dale Philip', n: 'Viagem', pub: '2026-10-22', dur: 1180, views: 77300, m: 2.6, b: 9, vpd: 800, v7: 15300, v30: 49000 },
    { id: 'f11', t: 'O prompt de R$ 0 que vira um site', c: 'Aldinho', n: 'IA', pub: '2026-12-05', dur: 690, views: 20100, m: 2.5, b: 11, vpd: 1300, v7: 14600 },
    { id: 'f12', t: 'Hostel em Tbilisi com vista para a cidade', c: 'Lodir', n: 'Viagem', pub: '2026-10-17', dur: 960, views: 62000, m: 2.4, b: 10, vpd: 700, v7: 12100, v30: 40200 },
    { id: 'f13', t: 'Trem noturno da Romênia, de primeira classe', c: 'Paddy Doyle', n: 'Viagem', pub: '2026-11-12', dur: 1320, views: 51000, m: 2.2, b: 9, vpd: 1100, tarde: true },
    { id: 'f14', t: 'O que a IA ainda não faz bem', c: 'Lucas Bigodinho', n: 'IA', pub: '2026-10-24', dur: 1260, views: 70000, m: 2.1, b: 12, vpd: 800, v7: 11000, v30: 36800 }
  ];
})();

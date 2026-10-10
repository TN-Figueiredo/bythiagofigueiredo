/* comparar-leo.js — rodada 9. Guarda uma FOTO dos dados do concorrente Leo Khev (dados.js + hist-dados.js) antes de dados-proprio.js
   trocar o canal de window.CANAL pelo canal próprio. comparar.html carrega os dois conjuntos de vídeos ao mesmo tempo; este arquivo
   precisa rodar entre os dois. O múltiplo de cada vídeo é o MESMO de canal.html (HM.mult, mesma regra de canal.js): sem base na faixa de idade, fica nulo. */
(function(){
  'use strict';
  var C = window.CANAL, HM = window.HM, mult = {};
  C.videos.forEach(function(v){ var m = HM.mult(v.id); mult[v.id] = m && m.value != null ? m.value : null; });
  window.LEO = { NOW: C.NOW, canal: C.canal, videos: C.videos, mult: mult, trocas: C.trocas.length, inscritos30: window.BRUTO.inscritos30 || null };
})();

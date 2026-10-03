/* =====================================================================================
   segundo-canal.js — SÓ DESTES MOCKUPS (2026-10-03-observatorio-seus-canais).
   Carregar ANTES de ../2026-10-02-observatorio/dados.js.

   O motor (dados.js) monta os canais de uma lista interna e não tem como registrar um
   canal depois de pronto. Para os canais próprios extras terem série diária, multiplicador,
   ritmo e contagem de inscritos calculados PELO MOTOR (e não digitados aqui), a
   configuração deles entra na lista no instante em que o motor começa a percorrê-la.
   O gancho se desfaz sozinho assim que é usado; dados.js não é alterado.

   Cada canal segue o mesmo formato do canal próprio que já existe (linha ~178 de dados.js):
   só a configuração é declarada; vídeos, views e todo o resto saem do gerador do motor.
   Aqui entram TODOS os canais próprios que os mockups podem mostrar; quais aparecem em cada
   estado (1, 2, 5 canais…) é escolha da barra de estados, em mockup.js.
   ===================================================================================== */
(function () {
  'use strict';
  var COR = '#B8481A';   // a mesma do canal próprio que já existe: sem cor nova
  var EXTRAS = [
    // iniciais do nome SEM o sufixo de idioma: os dois "tnFigueiredo" mostram "tF"; quem identifica é o nome
    { id: 'tnfigueiredo-en', gender: 'm', name: 'tnFigueiredo EN', own: true, niche: 'viagem', lang: 'en', subs: 412, limit: 200, color: COR, ini: 'tF',
      rate: { long: .22, short: .3 }, B: { long: 30, short: 150 }, maxAge: 150, growth30: .031,
      habit: { long: { dow: 4, h: 16, share: .5 }, short: { dow: 0, h: 12, share: .4 } } },
    { id: 'thiago-na-estrada', gender: 'm', name: 'Thiago na Estrada', own: true, niche: 'viagem', lang: 'pt', subs: 18400, limit: 200, color: COR, ini: 'TE',
      rate: { long: 1.1, short: 1.4 }, B: { long: 900, short: 2600 }, maxAge: 400, growth30: .024,
      habit: { long: { dow: 0, h: 18, share: .55 }, short: { dow: 2, h: 12, share: .3 } } },
    { id: 'slow-roads', gender: 'm', name: 'Slow Roads', own: true, niche: 'viagem', lang: 'en', subs: 2150, limit: 200, color: COR, ini: 'SR',
      rate: { long: .5, short: .8 }, B: { long: 180, short: 700 }, maxAge: 260, growth30: .012,
      habit: { long: { dow: 6, h: 9, share: .45 }, short: { dow: 3, h: 9, share: .3 } } },
    { id: 'thiago-testa-ia', gender: 'm', name: 'Thiago testa IA', own: true, niche: 'ia', lang: 'pt', subs: 5300, limit: 200, color: COR, ini: 'TI',
      rate: { long: .8, short: .6 }, B: { long: 420, short: 1100 }, maxAge: 300, growth30: .04,
      habit: { long: { dow: 1, h: 20, share: .5 }, short: { dow: 5, h: 12, share: .3 } } },
    { id: 'mochila-leve', gender: 'f', name: 'Mochila Leve', own: true, niche: 'viagem', lang: 'pt', subs: 860, limit: 200, color: COR, ini: 'ML',
      rate: { long: .3, short: 0 }, B: { long: 60 }, maxAge: 200, growth30: .008,
      habit: { long: { dow: 5, h: 19, share: .4 } } }
  ];
  var proto = Array.prototype, original = proto[Symbol.iterator], feito = false;
  proto[Symbol.iterator] = function () {
    var a = this[0];
    if (!feito && a && a.id === 'tnfigueiredo' && a.own === true && a.rate && a.B) {
      feito = true; proto[Symbol.iterator] = original;
      this.splice.apply(this, [1, 0].concat(EXTRAS));          // logo depois do canal próprio que já existe
    }
    return original.call(this);
  };
  (typeof window !== 'undefined' ? window : globalThis).__SEGUNDO_CANAL = { id: EXTRAS[0].id, ids: EXTRAS.map(function (c) { return c.id; }), desfazer: function () { proto[Symbol.iterator] = original; } };
})();

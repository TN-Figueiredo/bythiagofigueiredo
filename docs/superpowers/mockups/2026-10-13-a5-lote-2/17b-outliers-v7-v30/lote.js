/* lote.js: peças comuns dos cinco mockups do lote 1 da A5 (13/10/2026). Usa a4-comum.js (A4) tal como foi aprovado em 12/10.
   Tudo que é ACRÉSCIMO leva o contorno tracejado verde-água e a marca "+ novo" (classes .c2-novo e .c2-tag, do a4.css); o que já existe na produção aparece normal. */
(function(){
  'use strict';
  var A = window.A4, esc = A.esc, L = window.L1 = {};
  L.HOJE = '2026-10-13';

  /* ---------------------------------------------------------------- ícones (traço, sem emoji) */
  function svg(c){ return '<svg class="i" viewBox="0 0 16 16" aria-hidden="true">' + c + '</svg>'; }
  L.IC = {
    aviso: svg('<path d="M8 2.2 14.4 13.4H1.6Z"/><path d="M8 6.6v3.2M8 11.5v.1"/>'),
    sino: svg('<path d="M4 11V7.2a4 4 0 0 1 8 0V11l1 1.2H3Z"/><path d="M6.6 14h2.8"/>'),
    semSino: svg('<path d="M4 11V7.2a4 4 0 0 1 6.2-3.3M12 7.2V11l1 1.2H3"/><path d="M6.6 14h2.8M2 2l12 12"/>'),
    relogio: svg('<circle cx="8" cy="8" r="6"/><path d="M8 4.6V8l2.3 1.5"/>'),
    envelope: svg('<rect x="1.8" y="3.4" width="12.4" height="9.2" rx="1.6"/><path d="M2.2 4.6 8 9l5.8-4.4"/>'),
    ok: svg('<path d="M3 8.4 6.4 12 13 4.6"/>'),
    x: svg('<path d="M4 4l8 8M12 4l-8 8"/>'),
    pausa: svg('<rect x="3.6" y="3" width="3" height="10" rx=".6"/><rect x="9.4" y="3" width="3" height="10" rx=".6"/>'),
    video: svg('<rect x="1.8" y="3.2" width="12.4" height="9.6" rx="2"/><path d="M6.8 6l3.2 2-3.2 2Z"/>'),
    canal: svg('<circle cx="8" cy="5.6" r="2.6"/><path d="M2.8 13.6c.6-2.6 2.6-4 5.2-4s4.6 1.4 5.2 4"/>'),
    comentario: svg('<path d="M2.4 3.4h11.2v7H8.6L5.4 13v-2.6H2.4Z"/>'),
    sync: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.6-4.5M4 13a8 8 0 0 0 14.6 4.5"/><path d="M4 4v4h4M20 20v-4h-4"/></svg>',
    plus: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    dots: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>',
    chev: '<svg class="i c2-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    pin: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/></svg>'
  };
  L.cor = function(t){ var h = 0; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360; return 'linear-gradient(135deg,hsl(' + h + ' 38% 30%),hsl(' + ((h + 40) % 360) + ' 42% 20%))'; };
  L.novo = function(html, texto, cls){ return '<div class="c2-novo ' + (cls || '') + '"><span class="c2-tag">+ ' + esc(texto || 'novo') + '</span>' + html + '</div>'; };
  L.tag = function(texto){ return '<span class="c2-tag">+ ' + esc(texto || 'novo') + '</span>'; };
  L.pl = function(n, um, varios){ return n + ' ' + (n === 1 ? um : varios); };
  L.hm = function(h, m){ return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; };
  /* lembrar uma escolha: só no navegador, sempre com try/catch (pode vir vazio ou lançar) */
  L.lembrar = {
    ler: function(k){ try { return window.localStorage.getItem('a5l1-' + k); } catch (e) { return null; } },
    gravar: function(k, v){ try { window.localStorage.setItem('a5l1-' + k, v); } catch (e) { /* sem armazenamento: a tela funciona igual */ } }
  };

  /* ---------------------------------------------------------------- o cabeçalho do Observatório (igual ao da produção; o que é novo leva a marca) */
  L.obs = function(o){
    o = o || {};
    var abas = [['Canais', o.nCanais == null ? 7 : o.nCanais], ['Mudanças', 12], ['Outliers', 9], ['Insights', null]];
    var html = abas.map(function(t){ return '<span class="c2-otab"' + (o.aba === t[0] ? ' aria-current="page"' : '') + '>' + t[0] + (t[1] != null ? '<span class="c2-ct">' + t[1] + '</span>' : '') + '</span>'; }).join('');
    if (o.fila != null) {
      var fila = '<span class="c2-otab c2-novo l1-aba"' + (o.aba === 'fila' ? ' aria-current="page"' : '') + '><span class="c2-tag">+ novo</span>Saíram do YouTube<span class="c2-ct' + (o.fila ? ' l1-ct-on' : '') + '">' + o.fila + '</span></span>';
      html += fila;
    }
    var nichos = [['Todos', 7, '', true], ['Viagem', 7, 'v', false], ['IA', 0, 'a', false]].map(function(n){ return '<span' + (n[3] ? ' aria-pressed="true"' : '') + '>' + (n[2] ? '<i class="c2-sw ' + n[2] + '"></i>' : '') + n[0] + '<span class="c2-nn">' + n[1] + '</span></span>'; }).join('');
    return '<div class="c2-obs" aria-hidden="true"><div class="c2-oh"><div class="c2-ot"><h2>Observatório de Competidores</h2><p>O que os canais que você acompanha mudaram, o que está estourando agora e o que a forja leu disso, para decidir o próximo vídeo, título e thumbnail.</p></div>' +
      '<div class="c2-oa"><span class="c2-ob">' + L.IC.sync + '<span class="c2-lt">Sincronizar concorrentes</span></span><span class="c2-ob">' + L.IC.plus + '<span class="c2-lt">Adicionar canal</span></span><span class="c2-ob c2-mc"><span class="c2-lt">Meu canal</span><span class="c2-mn">: <b>tnFigueiredo</b></span></span><span class="c2-ob c2-ic">' + L.IC.dots + '</span></div></div>' +
      '<div class="c2-fr">' + (o.fresh || '<span class="c2-fresh"><span class="c2-fs"><i class="c2-dot"></i><b>7 canais</b></span><i class="c2-sp"></i><span class="c2-fs">sincronizado há 3 h</span><i class="c2-sp"></i><span class="c2-fs">todos em dia</span>' + L.IC.chev + '</span>') + '<span class="c2-tz">Horários em São Paulo</span></div>' +
      '<div class="c2-nav"><nav class="c2-otabs" style="display:flex;flex-wrap:wrap">' + html + '</nav><div class="c2-niche"><span class="c2-nl">Nicho</span><span class="c2-segc">' + nichos + '</span><span class="c2-pin">' + L.IC.pin + '</span></div></div></div>';
  };

  /* ---------------------------------------------------------------- a tela do vídeo próprio (cabeçalho como o de video.js, aprovado) */
  L.videoCab = function(v){
    var idade = v.idadeTxt || (A.dias(v.pub, L.HOJE) + (A.dias(v.pub, L.HOJE) === 1 ? ' dia' : ' dias'));
    var cells = [{ v: String(v.views), l: 'views' }, { v: String(v.likes), l: 'curtidas' }, { v: String(v.com), l: 'comentários' },
      v.eng == null ? { v: null, l: 'engajamento', sub: 'curtidas + comentários por view' } : { v: A.pct(v.eng, 1), l: 'engajamento', sub: 'curtidas + comentários por view' },
      v.normal == null ? { v: null, l: 'o normal do canal', sub: v.normalMotivo || 'ainda não dá para comparar' } : { v: A.dec(v.normal, 1) + '×', l: 'o normal do canal', sub: v.normalSub },
      { v: A.dur(v.dur), l: 'duração' }];
    return '<div class="vh"><span class="th" style="background:' + L.cor(v.t) + '"></span><div><h1 id="vt" tabindex="-1">' + esc(v.t) + '</h1><p class="l2"><span class="chip own">seu canal</span><span class="ex">exemplo</span>' +
      '<span>Publicado em ' + A.dmy(v.pub) + ' (há ' + idade + ') · vídeo longo</span></p><div class="nrow">' + A.faixa(cells, 'Números do vídeo') + A.ibtn('infoV', 'De onde vêm os números') + '</div>' +
      '<p style="margin:0;display:flex;gap:8px;flex-wrap:wrap"><span class="btn">Abrir no YouTube</span><span class="btn">Ampliar thumbnail</span></p></div></div>' +
      A.oculto('infoV', 'De onde vêm os números', '<ul><li><b>Views, curtidas e comentários:</b> totais do vídeo, na última sincronização.</li><li><b>Engajamento:</b> (curtidas + comentários) ÷ views.</li><li><b>O normal do canal:</b> views deste vídeo ÷ mediana de views dos outros vídeos.</li></ul>');
  };
  L.pager = function(total){ return '<p class="pager"><span class="d">' + A.L + ' Anterior</span><span>vídeo 1 de ' + total + ', na ordem da lista: do mais novo ao mais antigo</span><a href="#" onclick="return false">Próximo ' + A.R + '</a></p>'; };

  /* ---------------------------------------------------------------- a barra "Estados do mockup": um grupo de estados e o tema */
  L.barra = function(grupos, nota){
    return { linhas: grupos.map(function(g){ return { rotulo: g.rotulo, itens: A.opcoes(g.param, g.itens, g.padrao, g.extra) }; }).concat([A.tema()]), nota: nota || '' };
  };
  L.fora = function(titulo, html){ return '<h2 class="fora-h">' + esc(titulo) + '</h2>' + html; };
})();

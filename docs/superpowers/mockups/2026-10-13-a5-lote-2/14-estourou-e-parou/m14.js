/* m14.js: mockup 14, a leitura M10 em duas telas.
   ?tela=historico (padrão) | outliers
   ?caso= (histórico) tipico | extremo | borda | zero | nao | nao-rende | nm-semv30 | nm-v30baixo | nm-canal | nm-semreacao | nm-aovivo | nm-cedo | sem-dado | erro | carregando
   ?caso= (outliers)  cheio | magro | zero | sem-dado | erro | carregando       ?filtro=todos|com|nao|nm (outliers)
   ?nome=a (Estourou e parou, padrão) | b (Muitas views, pouco sinal de que agradou) | ambos (lado a lado)       ?tema=claro
   Regras: só exemplo até 2027; todo número leva "exemplo"; sem nota, sem percentual de "chance", sem selo de veredito.
   O texto obrigatório só aparece quando o resultado é pico_sem_cauda (nas outras situações ele afirmaria o que não bate). */
(function(){
  'use strict';
  var A = window.A4, L = window.L1, M = window.M14, q = A.q, esc = A.esc;
  var tela = q.get('tela') === 'outliers' ? 'outliers' : 'historico';
  var nome = ['a', 'b', 'ambos'].indexOf(q.get('nome')) >= 0 ? q.get('nome') : 'a';
  var padraoCaso = tela === 'outliers' ? 'cheio' : 'tipico';
  var caso = q.get('caso') || padraoCaso;
  var NOMES = { a: 'Estourou e parou', b: 'Muitas views, pouco sinal de que agradou' };
  var EX = '<span class="ex">exemplo</span>';

  /* ---------------------------------------------------------------- formatos (sobre o que aparece) */
  function n(x){ return A.n(x); }
  function pc(x){ var p = x * 100, s = A.dec(p, p !== 0 && p < 0.1 ? 2 : 1); return s.replace(/,0$/, '') + '%'; }
  function rz(x){ return x < 0.05 ? 'menos de 0,1×' : A.dec(x, 1) + '×'; }
  function vz(x, tipo){ return tipo === 'pct' ? pc(x) : n(x); }
  var SVG_IND = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.8 13.4 4.6 4l2.4 8.2h8"/></svg>';
  var SVG_AVISO = '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.2 14.4 13.4H1.6Z"/><path d="M8 6.6v3.2M8 11.5v.1"/></svg>';
  var SVG_RELOGIO = '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.6V8l2.3 1.5"/></svg>';
  /* os três símbolos do texto obrigatório: o que vimos (círculo cheio), hipótese nossa (círculo tracejado com ?), o que ninguém de fora vê (círculo riscado) */
  var SI_DADO = '<svg class="si" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="7.5" fill="currentColor" stroke="none"/></svg>';
  var SI_HIP = '<svg class="si" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="8" stroke-dasharray="3 3"/><path d="M8.6 8.8a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.2.8-1.2 1.6M11 15.3v.1"/></svg>';
  var SI_NAO = '<svg class="si" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M5.6 16.4 16.4 5.6"/></svg>';

  /* ---------------------------------------------------------------- as três casas */
  var CS_TXT = { v: 'bate', n: 'não bate', m: 'não medido', p: 'ainda não existe' };
  function casas(s, pequeno, rotulo){
    var lab = rotulo || ('Três sinais: ' + s.split('').map(function(c, i){ return ['muitas views cedo', 'quase nada depois', 'pouca reação'][i] + ' ' + CS_TXT[c]; }).join('; '));
    return '<span class="lm-casas" role="img" aria-label="' + esc(lab) + '">' + s.split('').map(function(c){ return '<i class="lm-cs ' + c + (pequeno ? ' sm' : '') + '" aria-hidden="true"></i>'; }).join('') + '</span>';
  }

  /* ---------------------------------------------------------------- régua */
  function pos(x, max){ return Math.min(100, Math.max(0, x / max * 100)); }
  function regua(o){
    var pl = pos(o.lim, o.max), pn = o.nor == null ? null : pos(o.nor, o.max), pv = pos(o.val, o.max), clip = o.val > o.max, zero = o.val === 0;
    var vale = o.mais ? 'left:' + pl + '%;right:0' : 'left:0;width:' + pl + '%';
    var lado = o.mais ? (o.val >= o.lim ? 'do lado que bate' : 'do lado que não bate') : (o.val <= o.lim ? 'do lado que bate' : 'do lado que não bate');
    var aria = 'Régua. Este vídeo: ' + vz(o.val, o.tipo) + (clip ? ' (passa do fim da régua)' : '') + '. Limite: ' + vz(o.lim, o.tipo) + (o.nor == null ? '' : '. Normal do canal: ' + vz(o.nor, o.tipo)) + '. O vídeo está ' + lado + '.';
    return '<div class="lm-reg" role="img" aria-label="' + esc(aria) + '"><div class="lm-trk" aria-hidden="true"><i class="lm-vale" style="' + vale + '"></i>' +
      (pn == null ? '' : '<i class="lm-nor" style="left:' + pn + '%"></i>') + '<i class="lm-lim" style="left:' + pl + '%"></i>' +
      '<i class="lm-mk' + (clip ? ' clip' : zero ? ' zero' : '') + '" style="left:' + pv + '%"></i></div></div>' +
      '<ul class="lm-key' + (o.nor == null ? ' dois' : '') + '" aria-hidden="true"><li><span class="g mk"></span><span class="k">Este vídeo</span><span class="vv">' + vz(o.val, o.tipo) + '</span></li>' +
      '<li><span class="g lim"></span><span class="k">Limite</span><span class="vv">' + vz(o.lim, o.tipo) + '</span></li>' +
      (o.nor == null ? '' : '<li><span class="g nor"></span><span class="k">Normal</span><span class="vv">' + vz(o.nor, o.tipo) + '</span></li>') + '</ul>';
  }
  function st(k){ return '<span class="lm-st ' + k + '">' + (k === 'v' ? '✓ bate' : k === 'n' ? '✕ não bate' : 'não medido') + '</span>'; }
  function cabCard(titulo, k, ex, selo, sub){ return '<div class="lm-ch"><div class="lm-tt"><h3>' + titulo + '</h3>' + (ex === false ? '' : EX) + (sub ? '<span class="lm-sb">' + sub + '</span>' : '') + '</div>' + (selo || st(k)) + '</div>'; }
  function igual(f){ return f ? ' <b>Igual ao limite: bate.</b>' : ''; }

  /* ---------------------------------------------------------------- os três cartões */
  function card1(r){
    var c = r.c1, k = c.vale ? 'v' : 'n';
    return '<article class="lm-c" aria-label="Muitas views cedo: ' + (c.vale ? 'bate' : 'não bate') + '">' + cabCard('Muitas views cedo', k) +
      '<p class="lm-n"><b class="num">' + n(c.val) + '</b><span class="u">views nos 30 primeiros dias</span></p>' +
      '<p class="lm-rz"><b>' + rz(c.razao) + '</b> o normal do canal</p>' +
      '<p class="lm-vl"><b>Bate</b> se tiver ' + n(c.lim) + ' views ou mais (2× o normal).' + igual(c.igual) + '</p>' +
      regua({ val: c.val, lim: c.lim, nor: c.med, max: c.med * 4, mais: true, tipo: 'n' }) + '</article>';
  }
  function card2(r){
    var c = r.c2, k = c.vale ? 'v' : 'n', nb = (c.valeCauda ? 1 : 0) + (c.valeRende ? 1 : 0);
    var seloCard = '<span class="lm-st ' + k + '">' + (c.vale ? '✓ ' : '✕ ') + nb + ' de 2 ' + (nb === 1 ? 'bate' : 'batem') + '</span>';
    var zeroCauda = c.cauda === 0, zeroRende = c.ganho === 0;
    var numCauda = zeroCauda ? '<span class="lm-z" role="img" aria-label="zero medido">0</span><span class="u">nenhuma view depois dos 30 primeiros dias</span>' :
      '<b class="num">' + pc(c.cauda) + '</b><span class="u">das views vieram depois do dia 30</span>';
    var numRende = zeroRende ? '<span class="lm-z" role="img" aria-label="zero medido">0</span><span class="u">view ganha nos últimos 28 dias</span>' :
      '<b class="num">' + pc(c.rende) + '</b><span class="u">ganhos nos últimos 28 dias (' + n(c.ganho) + ' views)</span>';
    return '<article class="lm-c" aria-label="Quase nada depois: ' + (c.vale ? 'as duas condições batem' : 'só ' + nb + ' de 2 condições ' + (nb === 1 ? 'bate' : 'batem')) + '">' + cabCard('Quase nada depois', k, true, seloCard) +
      '<p class="lm-n">' + numCauda + '</p>' +
      '<p class="lm-rz com-selo"><span>' + (zeroCauda ? 'O normal do canal é <b>' + pc(c.medCauda) + '</b>' : '<b>' + rz(c.razao) + '</b> o normal do canal') + '</span>' + st(c.valeCauda ? 'v' : 'n').replace('lm-st', 'lm-st sm') + '</p>' +
      '<p class="lm-vl"><b>Bate</b> se for até ' + pc(c.limCauda) + ' (metade do normal).' + igual(c.igualCauda) + '</p>' +
      regua({ val: c.cauda, lim: c.limCauda, nor: c.medCauda, max: c.medCauda * 2, mais: false, tipo: 'pct' }) +
      '<div class="lm-sub">' + cabCard('E ainda rende pouco', c.valeRende ? 'v' : 'n')  +
      '<p class="lm-n">' + numRende + '</p>' +
      '<p class="lm-vl"><b>Bate</b> se for até ' + pc(c.limRende) + ' das views dos 30 primeiros dias.' + igual(c.igualRende) + '</p>' +
      regua({ val: c.rende, lim: c.limRende, nor: null, max: 0.04, mais: false, tipo: 'pct' }) + '</div></article>';
  }
  function card3(r){
    var c = r.c3, k = c.vale ? 'v' : 'n';
    return '<article class="lm-c" aria-label="Pouca reação do público: ' + (c.vale ? 'bate' : 'não bate') + '">' + cabCard('Pouca reação do público', k) +
      '<p class="lm-n"><b class="num">' + pc(c.eng) + '</b><span class="u">curtidas e comentários por view, aos 30 dias</span></p>' +
      '<p class="lm-rz"><b>' + rz(c.razao) + '</b> o normal do canal · ' + n(c.r30) + ' de ' + n(c.v30) + ' views</p>' +
      '<p class="lm-vl"><b>Bate</b> se for até ' + pc(c.lim) + ' (metade do normal).' + igual(c.igual) + '</p>' +
      regua({ val: c.eng, lim: c.lim, nor: c.med, max: c.med * 2, mais: false, tipo: 'pct' }) + '</article>';
  }
  function card3nm(r){
    return '<article class="lm-c" aria-label="Pouca reação do público: não medido">' + cabCard('Pouca reação do público', 'm') +
      '<p class="lm-n">' + A.nm('sem reação pública para comparar') + '</p>' +
      '<p class="lm-rz">Curtidas ocultas e comentários desligados: <b>nenhum número de reação</b>, nem zero.</p>' +
      '<p class="lm-rz"><b>Passa a existir:</b> se o canal mostrar as curtidas ou ligar os comentários.</p></article>';
  }

  /* ---------------------------------------------------------------- texto obrigatório (inteiro, no corpo) */
  function texto(){
    return '<div class="lm-txt" role="note" aria-label="Indício, não medição"><p class="lm-txt-t">Indício, não medição.</p><ul>' +
      '<li>' + SI_DADO + '<span class="k">O que vimos</span><p class="f">Este vídeo teve muitas views nos primeiros 30 dias, quase nenhuma depois, e pouca reação do público (curtidas e comentários).</p></li>' +
      '<li>' + SI_HIP + '<span class="k">Hipótese nossa</span><p class="f">Isso costuma acontecer quando o YouTube para de recomendar um vídeo; essa é uma hipótese nossa sobre como a recomendação funciona, não um dado.</p></li>' +
      '<li>' + SI_NAO + '<span class="k">O que ninguém de fora vê</span><p class="f">O YouTube não mostra a ninguém de fora quanto tempo as pessoas assistiram ao vídeo de outro canal.</p></li></ul></div>';
  }

  /* ---------------------------------------------------------------- ⓘ do método */
  function infoM(id){
    return A.oculto(id, 'Como a leitura é calculada',
      '<p>Cálculo do Observatório sobre dados públicos do YouTube. É um indício, não uma medição.</p><ul>' +
      '<li><b>Base:</b> só vídeos com 90 dias ou mais e com a medida dos 30 primeiros dias. O normal do canal é a mediana dos vídeos longos (Shorts à parte) que têm essa medida; o canal precisa de 5 deles.</li>' +
      '<li><b>Muitas views cedo:</b> as views dos 30 primeiros dias são 2× o normal do canal ou mais.</li>' +
      '<li><b>Quase nada depois:</b> a parte das views que veio depois do dia 30 é no máximo metade do normal do canal, e o vídeo ganhou no máximo 2% das views dos 30 primeiros dias nos últimos 28 dias. As duas precisam bater juntas.</li>' +
      '<li><b>Pouca reação:</b> (curtidas + comentários) ÷ views aos 30 dias é no máximo metade do normal do canal. Sem curtidas e sem comentários visíveis, a leitura não é dada.</li>' +
      '<li>Igual ao limite bate. Se só 2 dos 3 sinais batem, não é o caso. Ao vivo e estreia ficam de fora.</li>' +
      '<li>Os limites são nossos, valem para este canal e são só um ponto de partida: vamos conferi-los contra vídeos reais.</li></ul>');
  }

  /* ---------------------------------------------------------------- partes do bloco */
  function cab(nm, extra, rotulo){
    return '<header class="lm-h"><h2>' + (rotulo ? '<span class="lm-rot">Leitura:</span> ' : '') + esc(NOMES[nm]) + '</h2><span class="lm-ind">' + SVG_IND + 'indício</span>' + A.ibtn('info-' + nm, 'Como a leitura ' + NOMES[nm] + ' é calculada') + (extra === false ? '' : EX) + '</header>' + infoM('info-' + nm);
  }
  function banner(){
    return '<div class="lm-ban" role="note">' + SVG_RELOGIO + '<div><b>Só exemplo até 2027.</b> A leitura passa a existir em janeiro de 2027 e, num canal com cerca de 5 vídeos longos a cada 90 dias, em abril de 2027.' +
      '<small>' + (caso === 'sem-dado' ? 'Este estado mostra o dia de hoje de verdade (13/10/2026); o vídeo e os números do cabeçalho são de exemplo.' : 'Todo número e toda data desta tela são de exemplo (no exemplo, hoje é ' + A.dmy(M.HOJE) + ').') + ' Esta faixa é só do mockup.</small></div></div>';
  }
  function sinaisDe(r){
    if (r.res === 'nm') return r.motivo === 'semreacao' ? (r.c1.vale ? 'v' : 'n') + (r.c2.vale ? 'v' : 'n') + 'm' : 'mmm';
    return [r.c1.vale, r.c2.vale, r.c3.vale].map(function(b){ return b ? 'v' : 'n'; }).join('');
  }

  var MOTIVOS = {
    semv30: { curto: 'este vídeo não tem a medida dos 30 primeiros dias', t: 'Este vídeo não tem a medida dos 30 primeiros dias.', q: 'Os vídeos publicados antes de 03/10/2026 não a têm: começamos a guardá-la nessa data.', quando: 'nunca para este vídeo' },
    v30baixo: { curto: 'o vídeo teve menos de 1.000 views nos 30 primeiros dias', t: 'Poucas views para comparar.', q: '', quando: 'nunca para este vídeo (a medida dos 30 primeiros dias não muda)' },
    canal: { curto: 'o canal tem menos de 5 vídeos longos para comparar', t: 'O canal ainda tem poucos vídeos para servir de normal.', q: '', quando: 'quando o canal tiver 5 vídeos longos com 90 dias e a medida dos 30 dias' },
    aovivo: { curto: 'ao vivo e estreia ficam de fora', t: 'Ao vivo e estreia ficam de fora.', q: 'O pico desses vídeos vem da data marcada, então a leitura não se aplica a eles.', quando: 'nunca para este vídeo' },
    cedo: { curto: 'o vídeo ainda não tem 90 dias', t: 'O vídeo ainda não tem 90 dias.', q: '', quando: '' },
    semreacao: { curto: 'sem reação pública para comparar', t: '', q: '', quando: '' }
  };
  function painelNm(r){
    var m = MOTIVOS[r.motivo], v = r.v, corpo = '';
    var selo = r.motivo === 'aovivo' ? '<span class="chip">ao vivo ou estreia</span>' : '';
    if (r.motivo === 'v30baixo') {
      var f = Math.round(v.v30 / M.MIN_V30 * 100);
      corpo = '<p class="q">Nos 30 primeiros dias o vídeo teve <b>' + n(v.v30) + ' views</b>' + EX + '; a leitura pede <b>' + n(M.MIN_V30) + '</b>.</p>' +
        '<div class="lm-falta"><span class="lm-bar" role="img" aria-label="' + n(v.v30) + ' de ' + n(M.MIN_V30) + ' views necessárias"><i style="width:' + f + '%"></i></span><span class="q"><b>' + n(v.v30) + ' de ' + n(M.MIN_V30) + '</b></span></div>';
    } else if (r.motivo === 'canal') {
      var tem = r.ch.nElegiveis, bolas = '';
      for (var i = 0; i < M.MIN_VIDEOS; i++) bolas += '<i class="' + (i < tem ? 'on' : 'off') + '"></i>';
      corpo = '<p class="q">' + esc(r.ch.nome) + ' tem <b>' + tem + ' vídeos longos</b> com 90 dias e a medida dos 30 dias' + EX + '; a leitura compara com o canal e pede <b>' + M.MIN_VIDEOS + '</b>.</p>' +
        '<div class="lm-falta"><span class="lm-bolas" role="img" aria-label="' + tem + ' de ' + M.MIN_VIDEOS + ' vídeos">' + bolas + '</span><span class="q"><b>' + tem + ' de ' + M.MIN_VIDEOS + '</b>, faltam ' + (M.MIN_VIDEOS - tem) + '</span></div>';
    } else if (r.motivo === 'cedo') {
      var faltam = M.IDADE_MIN - r.idade, quando = A.addDias(v.pub, M.IDADE_MIN);
      corpo = '<p class="q">O vídeo tem <b>' + r.idade + ' dias</b>' + EX + '; a leitura pede <b>90</b>.</p>' +
        '<div class="lm-falta"><span class="lm-bar" role="img" aria-label="' + r.idade + ' de 90 dias"><i style="width:' + Math.round(r.idade / 90 * 100) + '%"></i></span><span class="q"><b>' + r.idade + ' de 90 dias</b>, faltam ' + faltam + '</span></div>' +
        '<p class="q"><b>Passa a existir:</b> em ' + A.dmy(quando) + ' (faltam ' + faltam + ' dias).</p>';
    } else {
      corpo = (m.q ? '<p class="q">' + m.q + '</p>' : '');
    }
    if (r.motivo !== 'cedo') corpo += '<p class="q"><b>Passa a existir:</b> ' + m.quando + '.</p>';
    return '<div class="lm-nmp" role="group" aria-label="Não medido: ' + esc(m.curto) + '"><div class="lm-falta">' + A.nm() + selo + '<p class="t">' + esc(m.t) + '</p></div>' + corpo + '</div>';
  }

  function frase(r, nm){
    if (r.res === 'pico') return '<b>Os 3 sinais batem</b>: muitas views cedo, quase nada depois e pouca reação do público.' + EX;
    if (r.res === 'nao') {
      var qual = r.falha === 'c3' ? 'a reação do público (' + pc(r.c3.eng) + ' das views) ficou acima do limite de ' + pc(r.c3.lim) :
        r.falha === 'c2' ? (r.c2.valeCauda ? 'o vídeo ainda rende ' + pc(r.c2.rende) + ' nos últimos 28 dias, acima do limite de ' + pc(r.c2.limRende) : 'a parte das views depois do dia 30 (' + pc(r.c2.cauda) + ') ficou acima do limite de ' + pc(r.c2.limCauda)) :
        'as views dos 30 primeiros dias não chegaram a 2× o normal';
      return '<b>Só 2 dos 3 sinais batem, então não é o caso:</b> ' + qual + '.' + EX;
    }
    return '<b>Não medido:</b> ' + MOTIVOS[r.motivo].curto + '.';
  }

  /* o bloco de um vídeo, em cada estado */
  function bloco(nm){
    var h = '<section class="lm c2-novo" aria-label="' + esc(NOMES[nm]) + '"><span class="c2-tag">+ novo</span>';
    if (caso === 'sem-dado') {
      var D0 = '2026-10-13', FIM = '2027-04-30', tot = A.dias(D0, FIM), p1 = A.dias(D0, '2027-01-01') / tot * 100, p2 = A.dias(D0, '2027-04-15') / tot * 100;
      return h + cab(nm, false, true) + '<div class="lm-sd"><div class="lm-fr">' + casas('ppp', false, 'Três sinais: ainda não existem') + '<span><b>Esta leitura ainda não existe para nenhum vídeo.</b> Ela precisa de 90 dias de vídeo e da medida dos 30 primeiros dias.</span></div>' +
        '<div class="lm-tl" role="img" aria-label="Linha do tempo: hoje, 13/10/2026; a leitura passa a existir em janeiro de 2027 para o primeiro vídeo e por volta de abril de 2027 num canal mediano"><i class="trk"></i>' +
        '<i class="m" style="left:0"></i><span class="l" style="left:0">hoje, ' + A.dm(D0) + '</span>' +
        '<i class="m ex2" style="left:' + p1 + '%"></i><span class="l c" style="left:' + p1 + '%">janeiro</span>' +
        '<i class="m ex2" style="left:' + p2 + '%"></i><span class="l r" style="left:' + p2 + '%">abril</span></div>' +
        '<p class="lm-rz"><b>Janeiro de 2027:</b> o primeiro vídeo chega aos 90 dias. <b>Abril de 2027:</b> um canal com cerca de 5 vídeos longos a cada 90 dias passa a ter 5 para comparar.</p></div></section>';
    }
    if (caso === 'carregando') return h + cab(nm, false, true) + '<div class="lm-sk" role="status" aria-busy="true" aria-label="Calculando a leitura"><p class="lm-fr">' + casas('ppp', false, 'Calculando') + '<span>Calculando a leitura...</span></p><i></i></div></section>';
    if (caso === 'erro') return h + cab(nm, false, true) + '<div class="lm-err" role="alert">' + SVG_AVISO + '<div class="tx"><b>Não foi possível calcular a leitura agora.</b><span>Isto não quer dizer que o vídeo não estourou: a leitura não foi calculada. Os números do vídeo acima estão certos.</span></div><button type="button" class="btn big">Tentar de novo</button></div></section>';
    var r = M.avaliar(caso);
    var s = sinaisDe(r);
    var out = h + cab(nm, true, r.res !== 'pico') + '<p class="lm-fr">' + casas(s) + '<span>' + frase(r, nm) + '</span></p>';
    if (r.res === 'nm' && r.motivo !== 'semreacao') return out + painelNm(r) + '</section>';
    if (r.res === 'pico') out += texto();
    out += '<div class="lm-cards">' + card1(r) + card2(r) + (r.c3 ? card3(r) : card3nm(r)) + '</div>';
    return out + '</section>';
  }

  /* ---------------------------------------------------------------- hospedeiro 1: Histórico do vídeo */
  function historico(){
    var chave = ['sem-dado', 'erro', 'carregando'].indexOf(caso) >= 0 ? 'tipico' : caso;
    if (!M.VIDEOS[chave]) { caso = 'tipico'; chave = 'tipico'; }
    var r = M.avaliar(chave), v = r.v, ch = r.ch;
    var idadeTxt = r.idade + ' dias';
    var cells = [{ v: n(v.hoje), l: 'views hoje' }, { v: v.likes == null ? null : n(v.likes), l: 'curtidas', nm: 'ocultas' }, { v: v.com == null ? null : n(v.com), l: 'comentários', nm: 'desligados' }, { v: A.dur(v.dur), l: 'duração' }, { v: String(r.idade), l: 'dias no ar' }];
    var cab1 = '<div class="vh lm-vh"><span class="th" style="background:' + L.cor(v.t) + '"></span><div><h1 id="vt" tabindex="-1">' + esc(v.t) + '</h1><p class="l2"><span class="chip">' + esc(ch.nome) + '</span>' + EX +
      '<span>Publicado em ' + A.dmy(v.pub) + ' (há ' + idadeTxt + ') · ' + (v.aoVivo ? 'ao vivo' : 'vídeo longo') + '</span></p><div class="nrow">' + A.faixa(cells, 'Números do vídeo') + '</div>' +
      '<p style="margin:0;display:flex;gap:8px;flex-wrap:wrap"><span class="btn">Abrir no YouTube</span></p></div></div>';
    var viz = '<div class="lm-viz" aria-hidden="true">Aqui fica a curva do vídeo por idade e as primeiras 72 horas (mockup 13). Esta tela só acrescenta o bloco abaixo.</div>';
    var corpo = nome === 'ambos' ?
      '<div class="lm-dois"><div><p class="lm-opt"><b>Opção A</b>nome mais curto</p>' + bloco('a') + '</div><div><p class="lm-opt"><b>Opção B</b>nome mais cauteloso</p>' + bloco('b') + '</div></div>' : bloco(nome);
    return banner() + A.migalha([['Canais', '#'], [ch.nome, '#'], ['Vídeo']]) + cab1 + viz + corpo;
  }

  /* ---------------------------------------------------------------- hospedeiro 2: Outliers */
  var MOTIVO_LIN = { semv30: 'sem a medida dos 30 primeiros dias', cedo: 'ainda não tem 90 dias', aovivo: 'ao vivo ou estreia', v30baixo: 'menos de 1.000 views em 30 dias', semreacao: 'sem reação pública para comparar', canal: 'canal com menos de 5 vídeos' };
  var NOME_SINAIS = ['muitas views cedo', 'quase nada depois', 'pouca reação'];
  function linha(l, nm){
    var cel;
    if (caso === 'erro') cel = '<span class="tx"><span class="mu">' + SVG_AVISO.replace('class="i"', 'class="i" style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.5;vertical-align:-2px;color:var(--danger)"') + ' leitura indisponível agora</span></span>';
    else if (l.res === 'pico') cel = casas(l.sinais, true) + '<span class="tx"><span><a href="' + A.href({ tela: null, caso: 'tipico', filtro: null }) + '">' + esc(NOMES[nm === 'ambos' ? 'a' : nm]) + '</a> <span class="lm-ind">' + SVG_IND + 'indício</span></span><span class="mu">3 de 3 sinais</span></span>';
    else if (l.res === 'nao') { var falhas = NOME_SINAIS.filter(function(_, i){ return l.sinais.charAt(i) === 'n'; }); cel = casas(l.sinais, true) + '<span class="tx"><span>Não é o caso</span><span class="mu">não bateu: ' + falhas.join(' e ') + '</span></span>'; }
    else cel = casas(l.sinais, true) + '<span class="tx"><span>' + A.nm() + '</span><span class="mu">' + MOTIVO_LIN[l.motivo] + '</span></span>';
    return '<li class="lm-li"><span class="th" style="background:' + L.cor(l.t) + '" aria-hidden="true"></span><div class="lt"><b>' + esc(l.t) + '</b><span class="lc"><span>' + esc(l.canal) + '</span><span>há ' + l.idade + ' dias</span>' + EX + '</span></div>' +
      '<div class="lm-x"><b>' + A.dec(l.x, 1) + '×</b><span>o normal do canal</span></div><div class="ll">' + cel + '</div></li>';
  }
  /* a mensagem da lista vazia depende do filtro: nunca repete a de "Com a leitura" nos outros dois */
  function vazioFiltro(filtro, c, tot){
    function q(k, um, varios){ return k + ' ' + (k === 1 ? um : varios); }
    if (filtro === 'nao') return ['Nenhum dos ' + tot + ' outliers deu “não é o caso”.', q(c.pico, 'tem a leitura', 'têm a leitura') + ' e ' + q(c.nm, 'não foi medido', 'não foram medidos') + '. Zero aqui é um resultado: houve medida, e nenhum vídeo ficou de fora.'];
    if (filtro === 'nm') return ['Todos os ' + tot + ' outliers foram medidos.', q(c.pico, 'tem a leitura', 'têm a leitura') + ' e ' + q(c.nao, 'não é o caso', 'não são o caso') + '. Zero aqui é um resultado, não falta de dado.'];
    return ['Nenhum dos ' + tot + ' outliers tem a leitura.', c.nao + ' ' + (c.nao === 1 ? 'foi medido e não é' : 'foram medidos e não são') + ' o caso; ' + q(c.nm, 'não foi medido', 'não foram medidos') + '. Zero aqui é um resultado, não falta de dado.'];
  }
  function chaveFiltro(){ var f = q.get('filtro'); return ['todos', 'com', 'nao', 'nm'].indexOf(f) >= 0 ? f : (caso === 'zero' ? 'com' : 'todos'); }
  function outliers(){
    var base = M.OUTLIERS[caso] ? caso : 'cheio', linhas = M.OUTLIERS[base], c = M.contar(linhas), tot = linhas.length, filtro = chaveFiltro();
    function blocoO(nm){
      var h = '<section class="lm c2-novo" aria-label="' + esc(NOMES[nm]) + ' nos outliers"><span class="c2-tag">+ novo</span>';
      if (caso === 'sem-dado') {
        return h + '<header class="lm-h"><h2>' + esc(NOMES[nm]) + '</h2><span class="lm-ind">' + SVG_IND + 'indício</span>' + A.ibtn('info-o-' + nm, 'Como a leitura ' + NOMES[nm] + ' é calculada') + '</header>' + infoM('info-o-' + nm) +
          '<div class="lm-sd"><div class="lm-fr">' + casas('ppp', false, 'Três sinais: ainda não existem') + '<span><b>Esta leitura ainda não existe para nenhum vídeo.</b> A lista de outliers segue como hoje, sem a coluna Leitura.</span></div><p class="lm-rz"><b>Janeiro de 2027:</b> o primeiro vídeo chega aos 90 dias. <b>Abril de 2027:</b> um canal com cerca de 5 vídeos longos a cada 90 dias passa a ter 5 para comparar.</p></div></section>';
      }
      var head = '<header class="lm-h"><h2>' + esc(NOMES[nm]) + '</h2><span class="lm-ind">' + SVG_IND + 'indício</span>' + A.ibtn('info-o-' + nm, 'Como a leitura ' + NOMES[nm] + ' é calculada') + EX + '</header>' + infoM('info-o-' + nm);
      if (caso === 'carregando') return h + head + '<div class="lm-sk" role="status" aria-busy="true" aria-label="Calculando a leitura dos outliers"><p class="lm-fr">' + casas('ppp', false, 'Calculando') + '<span>Calculando a leitura dos ' + tot + ' outliers...</span></p><i></i><i></i></div></section>';
      var fr;
      if (caso === 'erro') fr = '<div class="lm-err" role="alert">' + SVG_AVISO + '<div class="tx"><b>Não foi possível calcular a leitura agora.</b><span>A lista de outliers está completa; só a coluna Leitura falta. Isto não quer dizer que nenhum vídeo estourou e parou.</span></div><button type="button" class="btn big">Tentar de novo</button></div>';
      else fr = '<p class="lm-fr"><span><b>' + c.pico + ' dos ' + tot + ' outliers ' + (c.pico === 1 ? 'tem' : 'têm') + ' a leitura</b>; ' + c.nao + ' não são o caso e ' + c.nm + ' não foram medidos.' + EX + '</span></p>';
      var cob = '';
      if (caso !== 'erro') {
        cob = '<div class="lm-cob" role="img" aria-label="' + c.pico + ' com a leitura, ' + c.nao + ' não são o caso, ' + c.nm + ' não medidos, de ' + tot + ' outliers">' +
          (c.pico ? '<i class="p" style="width:' + c.pico / tot * 100 + '%"></i>' : '') + (c.nao ? '<i class="n" style="width:' + c.nao / tot * 100 + '%"></i>' : '') + (c.nm ? '<i class="m" style="width:' + c.nm / tot * 100 + '%"></i>' : '') + '</div>';
      }
      function f(k, rot, qtd, cs){
        var cnt = qtd === 0 ? '<span class="lm-z" role="img" aria-label="zero medido">0</span>' : '<span class="num">' + qtd + '</span>';
        return '<a class="lm-f" href="' + A.href({ filtro: k === 'todos' ? null : k }) + '"' + (filtro === k ? ' aria-current="true"' : '') + '>' + (cs ? casas(cs, true, rot) : '') + rot + ' ' + cnt + '</a>';
      }
      var seg = caso === 'erro' ? '' : '<nav class="lm-seg" aria-label="Filtrar pela leitura">' + f('todos', 'Todos', tot, '') + f('com', 'Com a leitura', c.pico, 'v') + f('nao', 'Não é o caso', c.nao, 'n') + f('nm', 'Não medido', c.nm, 'm') + '</nav>';
      var mostrar = caso === 'erro' ? linhas : linhas.filter(function(l){ return filtro === 'todos' || (filtro === 'com' && l.res === 'pico') || (filtro === 'nao' && l.res === 'nao') || (filtro === 'nm' && l.res === 'nm'); });
      /* o texto obrigatório só aparece quando a lista VISÍVEL tem linha com a leitura, e fica logo abaixo da última delas (as com a leitura vêm primeiro) */
      var ordem = { pico: 0, nao: 1, nm: 2 };
      mostrar = mostrar.map(function(l, i){ return { l: l, i: i }; }).sort(function(a, b){ return (ordem[a.l.res] - ordem[b.l.res]) || (a.i - b.i); }).map(function(o){ return o.l; });
      var com = caso === 'erro' ? [] : mostrar.filter(function(l){ return l.res === 'pico'; }), resto = mostrar.slice(com.length);
      function ul(arr, rot){ return '<ul class="lm-lista" aria-label="' + rot + '">' + arr.map(function(l){ return linha(l, nm); }).join('') + '</ul>'; }
      var lista;
      if (!mostrar.length) {
        var ve = vazioFiltro(filtro, c, tot);
        lista = '<div class="lm-vazio"><span class="lm-z" role="img" aria-label="zero medido">0</span><div class="tx"><b>' + ve[0] + '</b><span>' + ve[1] + '</span></div><a class="btn big" href="' + A.href({ filtro: null }) + '">Ver todos os ' + tot + '</a></div>';
      }
      else lista = (com.length ? ul(com, 'Outliers com a leitura') + '<p class="lm-ant">Sobre cada vídeo marcado com <b>' + esc(NOMES[nm]) + '</b> acima:</p>' + texto() : '') +
        (resto.length ? ul(resto, com.length ? 'Os outros outliers e a leitura de cada um' : 'Outliers e a leitura de cada um') : '');
      return h + head + fr + cob + seg + lista + '</section>';
    }
    var filtros = '<div class="lm-fil" aria-hidden="true"><span>Vídeos longos</span><span>Idade: hoje</span><span>Múltiplo: 2× ou mais</span><span>Nicho: Todos</span></div>';
    var corpo = nome === 'ambos' ? '<div class="lm-dois"><div><p class="lm-opt"><b>Opção A</b>nome mais curto</p>' + blocoO('a') + '</div><div><p class="lm-opt"><b>Opção B</b>nome mais cauteloso</p>' + blocoO('b') + '</div></div>' : blocoO(nome);
    return banner() + L.obs({ aba: 'Outliers' }) + filtros + corpo;
  }

  /* ---------------------------------------------------------------- referência fora da tela */
  function fora(){
    return L.fora('Como cada estado é desenhado', '<table class="tb"><thead><tr><th>Estado</th><th>Casas</th><th>O que a tela diz</th></tr></thead><tbody>' +
      '<tr><td>Os 3 sinais batem</td><td>' + casas('vvv', true) + '</td><td>Frase, três cartões e o texto obrigatório inteiro</td></tr>' +
      '<tr><td>Só 2 de 3 (não é o caso)</td><td>' + casas('vvn', true) + '</td><td>Frase com o sinal que não bateu e os três números; sem o texto obrigatório</td></tr>' +
      '<tr><td>Não medido</td><td>' + casas('mmm', true) + '</td><td>Motivo da lista fechada e quando passa a existir</td></tr>' +
      '<tr><td>Sem reação pública</td><td>' + casas('vvm', true) + '</td><td>Dois cartões medidos e o terceiro não medido; o resultado continua não medido</td></tr>' +
      '<tr><td>Ainda não existe</td><td>' + casas('ppp', true) + '</td><td>Contorno pontilhado e a data em que passa a existir</td></tr></tbody></table>');
  }

  /* ---------------------------------------------------------------- barra de estados */
  var HIST_COM = [['tipico', 'Os 3 sinais batem (típico)'], ['extremo', 'Valores extremos'], ['borda', 'Igual ao limite'], ['zero', 'Zero medido']];
  var HIST_NAO = [['nao', 'Só 2 de 3: reação'], ['nao-rende', 'Só 2 de 3: ainda rende']];
  var HIST_NM = [['nm-semv30', 'Falta a medida dos 30 dias'], ['nm-v30baixo', 'Menos de 1.000 views'], ['nm-canal', 'Canal com menos de 5 vídeos'], ['nm-semreacao', 'Sem reação pública'], ['nm-aovivo', 'Ao vivo ou estreia'], ['nm-cedo', 'Menos de 90 dias']];
  var OUTROS = [['sem-dado', 'Ainda não existe'], ['erro', 'Erro'], ['carregando', 'Carregando']];
  var grupos = [{ rotulo: 'Tela', param: 'tela', padrao: 'historico', itens: [['historico', 'Histórico do vídeo'], ['outliers', 'Outliers']], extra: { caso: null, filtro: null } }];
  if (tela === 'historico') {
    grupos.push({ rotulo: 'Com a leitura', param: 'caso', padrao: 'tipico', itens: HIST_COM }, { rotulo: 'Não é o caso', param: 'caso', padrao: 'tipico', itens: HIST_NAO },
      { rotulo: 'Não medido, por motivo', param: 'caso', padrao: 'tipico', itens: HIST_NM }, { rotulo: 'Outros', param: 'caso', padrao: 'tipico', itens: OUTROS });
  } else {
    grupos.push({ rotulo: 'Com dados', param: 'caso', padrao: 'cheio', itens: [['cheio', 'Cheio (2 com a leitura)'], ['magro', 'Magro (o real por meses)'], ['zero', 'Zero medido']], extra: { filtro: null } },
      { rotulo: 'Outros', param: 'caso', padrao: 'cheio', itens: OUTROS, extra: { filtro: null } });
  }
  grupos.push({ rotulo: 'Nome da leitura', param: 'nome', padrao: 'a', itens: [['a', 'A: Estourou e parou'], ['b', 'B: Muitas views, pouco sinal de que agradou'], ['ambos', 'Os dois lado a lado']] });

  A.moldura({ titulo: 'A leitura Estourou e parou', barra: L.barra(grupos, 'Só leitura: esta tela não tem número privado (curtidas, comentários e views são públicos), então quem só lê vê o mesmo que quem edita.'),
    corpo: tela === 'outliers' ? outliers() : historico(), fora: fora() });
  A.ligarInfos(document);
  document.addEventListener('click', function(e){ var a = e.target.closest && e.target.closest('a[href="#"]'); if (a) e.preventDefault(); });
})();

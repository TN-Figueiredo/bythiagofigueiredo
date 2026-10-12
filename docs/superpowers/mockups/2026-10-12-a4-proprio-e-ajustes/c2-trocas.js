/* c2-trocas.js: troca de descrição visível na lista de Canais e no painel lateral (pedido do dono, 12/10). Números de exemplo; nomes de canais reais do mockup aprovado.
   ?canal=nomade|lucas|dale|vou|leo|paddy|proprio escolhe o canal aberto no painel. ?tema=claro. */
(function(){
  'use strict';
  var A = window.A4, esc = A.esc, q = A.q, atual = q.get('canal') || 'nomade';
  var CH = [
    { id: 'nomade', nome: 'Nômade Raiz', ins: 2080000, tt: 6, vt: 4, last: 'título trocado, visto pela 1ª vez há 2 d', desc: { n: 3, v: 2, sem: [1, 1, 0, 1] }, ev: [
      { t: 'multi', q: 'há 2 d', v: 'Tailândia em 10 dias: o roteiro completo', vw: '184 mil views', a: 'Tailândia em 10 dias', d: 'Tailândia em 10 dias: o roteiro completo' },
      { t: 'desc', q: 'há 6 d', v: 'Os 5 piores erros em Bangkok', vw: '96 mil views', chip: '+3 linhas, −1 linha' },
      { t: 'titulo', q: 'há 9 d', v: 'Quanto custa viajar pelo Vietnã', vw: '71 mil views', a: 'Vietnã barato?', d: 'Quanto custa viajar pelo Vietnã' },
      { t: 'desc', q: 'há 15 d', v: 'Chiang Mai para nômades digitais', vw: '203 mil views', chip: '+1 linha' },
      { t: 'desc', q: 'há 23 d', v: 'Os 5 piores erros em Bangkok', vw: '96 mil views', semTexto: true }] },
    { id: 'lucas', nome: 'Lucas Bigodinho', ins: 325000, tt: 4, vt: 3, last: 'thumbnail trocada, vista pela 1ª vez há 5 d', desc: null, ev: [
      { t: 'thumb', q: 'há 5 d', v: 'Comi só no 7-Eleven por 3 dias', vw: '412 mil views' }, { t: 'titulo', q: 'há 12 d', v: 'A pior estrada do Laos', vw: '188 mil views', a: 'Estrada do Laos', d: 'A pior estrada do Laos' }] },
    { id: 'dale', nome: 'Dale Philip', ins: 3740000, tt: 0, vt: 0, last: null, desc: { n: 2, v: 2, sem: [0, 0, 1, 1] }, ev: [
      { t: 'desc', q: 'há 4 d', v: 'Um dia em Osaka', vw: '1,2 mi views', chip: '+2 linhas' }, { t: 'desc', q: 'há 11 d', v: 'Kyoto sem multidão', vw: '860 mil views', chip: '+1 linha, −1 linha' }] },
    { id: 'vou', nome: 'Vou sem volta', ins: 593000, tt: 2, vt: 2, last: 'título trocado, visto pela 1ª vez há 13 d', desc: { n: 1, v: 1, sem: [0, 0, 0, 1] }, ev: [
      { t: 'desc', q: 'há 3 d', v: 'Meio ano em Bali', vw: '240 mil views', chip: '+1 linha' }, { t: 'titulo', q: 'há 13 d', v: 'Voltei para o Brasil?', vw: '305 mil views', a: 'Voltei?', d: 'Voltei para o Brasil?' }] },
    { id: 'paddy', nome: 'Paddy Doyle', ins: 341000, tt: 3, vt: 3, last: 'título e thumbnail trocados na mesma janela, vistos há 1 d', desc: { n: 5, v: 1, sem: [1, 2, 1, 1] }, ev: [
      { t: 'desc', q: 'há 1 d', v: 'Irlanda de carro em 7 dias', vw: '58 mil views', chip: '+1 linha' }, { t: 'desc', q: 'há 5 d', v: 'Irlanda de carro em 7 dias', vw: '58 mil views', chip: '+1 linha, −1 linha' }, { t: 'desc', q: 'há 9 d', v: 'Irlanda de carro em 7 dias', vw: '58 mil views', chip: '−1 linha' }] },
    { id: 'leo', nome: 'Leo Khev', ins: 1530, tt: 0, vt: 0, last: null, desc: null, ev: [] },
    { id: 'proprio', nome: 'tnFigueiredo', ins: 1160, own: true, ev: [] }
  ];
  var por = {}; CH.forEach(function(c){ por[c.id] = c; });
  function sem(c){ return c.desc ? c.desc.sem.filter(Boolean).length : 0; }
  function habito(c){ return sem(c) >= 3 && c.desc.v >= 2; }
  function nTr(n, um, vs){ return n + ' ' + (n === 1 ? um : vs); }
  function pal(n, um, vs){ return n === 1 ? um : vs; }
  function marcas(c){
    var lbl = 'Semanas, da mais antiga à mais recente: ' + c.desc.sem.map(function(x){ return x ? (x > 1 ? 'mais de uma troca' : 'com troca') : 'sem troca'; }).join(', ');
    return '<span class="sem" role="img" aria-label="' + esc(lbl) + '">' + c.desc.sem.map(function(x){ return x > 1 ? '<i class="rep">2+</i>' : x ? '<i class="on">1</i>' : '<i></i>'; }).join('') + '</span><span class="sem-ax" aria-hidden="true"><span>antiga</span><span>recente</span></span>';
  }
  function fraseSem(c){ var s = sem(c); return s === 4 ? 'nas 4 últimas semanas' : 'em ' + s + ' das 4 últimas semanas'; }
  /* ---------------------------------------------------------------- A célula da lista (estreita: 104 a 170 px) */
  function celula(c){
    if (c.own) return '<span class="mut" style="font-size:12.5px">Suas trocas ficam no A/B Lab.</span>';
    var d = c.desc ? '<div class="hab"><div class="d">Descrição: ' + nTr(c.desc.n, 'troca', 'trocas') + (c.desc.v === 1 && c.desc.n > 1 ? ' no mesmo vídeo' : ' em ' + nTr(c.desc.v, 'vídeo', 'vídeos')) + '</div>' + marcas(c) + '<div class="d z">' + fraseSem(c) + '</div>' + (habito(c) ? '<span class="habito">costuma trocar</span>' : '') + '</div>' : '';
    return '<div class="cel"><div class="k">' + c.tt + '</div><div class="l">' + (c.tt ? esc(c.last) : 'nenhuma de título ou thumbnail em 30 d') + '</div>' + d + '</div>';
  }
  /* ---------------------------------------------------------------- O resumo no topo da aba do painel */
  function resumo(c){
    if (c.own) return '<p class="sech">Suas trocas de título e thumbnail ficam no A/B Lab.</p>';
    if (!c.tt && !c.desc) return '<div class="resumo"><p style="margin:0">Nenhuma troca de título, thumbnail ou descrição nos últimos 30 dias.</p></div>';
    var l1 = '<div class="ln"><b class="num">' + c.tt + '</b><span>' + (c.tt ? pal(c.tt, 'troca', 'trocas') + ' de título ou thumbnail, em ' + nTr(c.vt, 'vídeo', 'vídeos') + '. <span class="rot">É o número da lista.</span>' : 'trocas de título ou thumbnail.') + '</span></div>';
    var l2 = c.desc ? '<div class="ln"><b class="num">' + c.desc.n + '</b><span>' + pal(c.desc.n, 'troca', 'trocas') + ' de descrição' + (c.desc.v === 1 && c.desc.n > 1 ? ', todas no mesmo vídeo' : ', em ' + nTr(c.desc.v, 'vídeo', 'vídeos')) + ', ' + fraseSem(c) + '. ' + (habito(c) ? '<span class="habito">costuma trocar</span>' : '') + '<br>' + marcas(c) + '</span></div>' : '';
    return '<div class="resumo">' + l1 + l2 + (c.desc ? '<p class="sem-leg" style="margin:0"><span><i class="n0"></i>semana sem troca</span><span><i class="n1">1</i>uma troca</span><span><i class="n2">2+</i>mais de uma</span></p>' : '') + '</div>';
  }
  function cartao(e){
    var rot = { multi: ['Título e thumbnail trocados', ''], titulo: ['Título trocado', ''], thumb: ['Thumbnail trocada', ''], desc: ['Descrição trocada', 'desc'] }[e.t];
    var corpo = '';
    if (e.t === 'desc') corpo = e.semTexto ? '<p class="mut" style="margin:8px 0 0;font-size:12.5px">A descrição mudou. Antes de 03/10 só registramos que mudou, sem o texto.</p>' : '<div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="chip num">' + esc(e.chip) + '</span><span class="btn" style="min-height:30px">Ver comparação</span></div>';
    else if (e.t === 'thumb') corpo = '<div class="ba"><div><div class="lab">Antes</div>capa anterior</div><div><div class="lab">Depois</div>capa atual</div></div>';
    else corpo = '<div class="ba"><div><div class="lab">Antes</div>' + esc(e.a) + '</div><div><div class="lab">Depois</div>' + esc(e.d) + '</div></div>';
    return '<div class="swapcard' + (e.t === 'desc' ? ' desc' : '') + '"><div class="when"><span><strong>' + rot[0] + '</strong>, visto pela 1ª vez ' + e.q + '</span><span>' + esc(e.vw) + '</span></div><div class="vt">' + esc(e.v) + '</div>' + corpo + '</div>';
  }
  function painel(c){
    var tem = c.ev && c.ev.length;
    return '<aside class="drawer" aria-label="Painel de ' + esc(c.nome) + '"><h2>' + esc(c.nome) + '</h2><p class="sech" style="margin-top:0">' + A.mil(c.ins) + ' inscritos · últimos 30 dias · <span class="ex">números de exemplo</span></p>' +
      '<div class="ctabs" style="margin:0 0 10px"><ul><li><a href="#" aria-current="page">Trocas' + (c.tt != null ? ' <span class="n">' + c.tt + '</span>' : '') + '</a></li><li><a href="#">Outliers</a></li><li><a href="#">Leitura</a></li></ul></div>' +
      resumo(c) + (tem ? '<p class="sech">Da mais recente para a mais antiga. As trocas de descrição têm um filete violeta à esquerda e não entram no número da lista.</p>' + c.ev.map(cartao).join('') + '<span class="btn">Ver as trocas em Mudanças</span>' : '') + '</aside>';
  }
  function tabela(){
    return '<div class="tbw"><table class="tl"><caption class="sr">Canais, com a coluna Trocas</caption><thead><tr><th scope="col">Canal</th><th scope="col" class="r">Inscritos</th><th scope="col">Trocas <span class="mut" style="font-weight:400">título e thumbnail, 30 d</span></th></tr></thead><tbody>' + CH.map(function(c){
      return '<tr data-canal="' + c.id + '"' + (c.id === atual ? ' class="hl"' : '') + '><td data-l="Canal"><div class="ch"><span class="av" aria-hidden="true">' + esc(c.nome.slice(0, 2)) + '</span><a class="cn" href="' + A.href({ canal: c.id }) + '">' + esc(c.nome) + '</a>' + (c.own ? ' <span class="chip own">seu canal</span>' : '') + '</div></td><td class="r num" data-l="Inscritos">' + A.mil(c.ins) + '</td><td data-l="Trocas">' + celula(c) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function estados(){
    var itens = [
      ['Nenhuma troca', 'leo', 'Nenhuma troca de título, thumbnail ou descrição nos últimos 30 dias.'],
      ['Só descrição', 'dale', 'Zero de título ou thumbnail no número principal; a descrição aparece à parte, com a conta dela.'],
      ['As duas', 'vou', 'O número principal bate com a lista; a linha da descrição vem logo abaixo, sem hábito (1 semana de 4).'],
      ['As duas, com hábito', 'nomade', 'Descrição em 3 das 4 últimas semanas e em 2 ou mais vídeos: aparece o selo “costuma trocar”.'],
      ['Mesmo vídeo, várias vezes', 'paddy', '5 trocas de descrição em 1 vídeo: a frase diz “no mesmo vídeo” e o selo não aparece, porque hábito é mexer em vários vídeos, não ajustar um só.'],
      ['Só título ou thumbnail', 'lucas', 'Sem linha de descrição: o silêncio é a informação.'],
      ['Canal próprio', 'proprio', 'Suas trocas ficam no A/B Lab (como hoje).']];
    return '<ul class="lista-estados">' + itens.map(function(i){ var c = por[i[1]]; return '<li><div class="lb"><b style="color:var(--text);font-weight:600">' + i[0] + '</b><br>' + esc(c.nome) + '</div><div style="display:grid;gap:10px;min-width:0"><div>' + celula(c) + '</div><div class="mut" style="font-size:12.5px;max-width:60ch">' + i[2] + '</div></div></li>'; }).join('') + '</ul>';
  }
  var barra = { linhas: [{ rotulo: 'Canal no painel', itens: CH.map(function(c){ return { t: c.nome, href: A.href({ canal: c.id }), atual: atual === c.id }; }) }, A.tema()],
    nota: 'Proposta em duas camadas: o <b>número principal</b> continua título + thumbnail (6 na lista e no painel, igual à comparação); a <b>descrição</b> vem à parte, nos dois lugares, com a conta dela e quatro marcas de semana para mostrar o hábito. Nomes de canais reais; <b>os números são de exemplo</b>.' };
  A.moldura({ titulo: 'Troca de descrição', barra: barra, corpo: A.migalha([['Canais', 'index.html']]).replace('</ol>', '<li aria-current="page">Lista de Canais</li></ol>') +
    '<div class="c2-grid"><div>' + tabela() + '</div><div>' + painel(por[atual]) + '</div></div>',
    fora: '<section class="cenario"><h3>A frase de cada estado, na célula da lista</h3>' + estados() + '</section>' });
})();

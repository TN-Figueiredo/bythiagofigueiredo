/* ov.js: mockup 12, "De onde vêm as views" nas páginas do vídeo e do canal próprios, e as novas linhas do cartão "Só o seu canal mede".
   Parâmetros:  ?tela=video|canal|cartao   ?estado=tipico|extremo|magro|zero|nao-medido|vazio|erro|leitura
                ?periodo=7|28|90|tudo  (lembrado no navegador)   ?pais=dia|mes   ?leitura=sem-termos|so-total   ?tema=claro
   TODO número é exemplo (ov-dados.js). A data de início da coleta (04/10) é suposta. */
(function(){
  'use strict';
  var A = window.A4, L = window.L1, D = window.OVD, q = A.q, esc = A.esc, n = A.n;

  /* ------------------------------------------------------------ parâmetros */
  var ESTADOS = [['tipico', 'Com dado típico'], ['extremo', 'Com dado extremo'], ['magro', 'Magro: 36 views em 90 dias'], ['zero', 'Zero medido'], ['nao-medido', 'Não medido'], ['vazio', 'Sem dado ainda'], ['erro', 'Erro de leitura'], ['leitura', 'Só leitura'], ['carregando', 'Carregando'], ['revisao', 'Origem em revisão']];
  var estado = q.get('estado') || 'tipico'; if (!ESTADOS.some(function(e){ return e[0] === estado; })) estado = 'tipico';
  var tela = q.get('tela') || 'video';
  if (estado === 'extremo' || estado === 'magro' || estado === 'carregando') tela = tela === 'cartao' ? 'cartao' : 'canal';
  if (estado === 'zero' || estado === 'vazio') tela = tela === 'cartao' ? 'cartao' : 'video';
  var paisMes = q.get('pais') === 'mes', leit = q.get('leitura') === 'so-total' ? 'so-total' : 'sem-termos';
  var PER = tela === 'video' ? [['7', '7 dias', 'Últimos 7 dias'], ['tudo', 'Desde a publicação', 'Desde a publicação']] : [['7', '7 dias', 'Últimos 7 dias'], ['28', '28 dias', 'Últimos 28 dias'], ['90', '90 dias', 'Últimos 90 dias'], ['tudo', 'Desde 2015', 'Desde 2015, o começo do canal']];
  var KEY = 'a5l2-12-periodo';
  function ler(){ try { return window.localStorage.getItem(KEY); } catch (e) { return null; } }
  function gravar(v){ try { if (v == null) window.localStorage.removeItem(KEY); else window.localStorage.setItem(KEY, v); } catch (e) { /* sem armazenamento: a tela funciona igual */ } }
  var lembrado = ler(), padrao = estado === 'extremo' ? 'tudo' : (estado === 'magro' || estado === 'carregando') ? '90' : '7';
  function valido(p){ return PER.some(function(x){ return x[0] === p; }); }
  var pUrl = q.get('periodo'), p = valido(pUrl) ? pUrl : (estado === 'tipico' || estado === 'leitura' || estado === 'erro' || estado === 'nao-medido') && valido(lembrado) ? lembrado : padrao;
  var salvo = !valido(pUrl) && p === lembrado && estado !== 'extremo' && estado !== 'magro' && estado !== 'carregando' && p !== '7';
  var C = D.cenario(tela === 'cartao' ? 'canal' : tela, estado, tela === 'cartao' ? '7' : p);
  var COL = C.coleta, PRIM = A.dm(D.PRIMEIRA);   /* r3: data da coleta e da primeira leitura vêm de ov-dados.js, nunca digitadas aqui */
  var nmd = estado === 'nao-medido', LOTE_DESDE = nmd ? 'o primeiro relatório do YouTube, que ainda não chegou' : A.dmy(D.LOTE);

  /* ------------------------------------------------------------ símbolos (traço, 14 px, sem emoji) */
  var G = {
    pesq: '<circle cx="6" cy="6" r="3.7"/><path d="M8.8 8.8 12.2 12.2"/>',
    sug: '<path d="M7 1.6 12.4 7 7 12.4 1.6 7Z"/>',
    nav: '<path d="M1.8 7 7 2.2 12.2 7"/><path d="M3.4 6v5.6h7.2V6"/>',
    sh: '<path d="M8.2 1.4 3.4 8h3.2l-.8 4.6 4.8-6.6H7.4Z"/>',
    ext: '<path d="M6 3H2.8v8.2H11V8"/><path d="M8 1.8h4.2V6M12.2 1.8 6.8 7.2"/>',
    out: '<circle cx="3" cy="7" r=".9"/><circle cx="7" cy="7" r=".9"/><circle cx="11" cy="7" r=".9"/>',
    om: '<path d="M1.2 7c1.6-3 4-4.3 5.8-4.3S11.2 4 12.8 7c-1.6 3-4 4.3-5.8 4.3S2.8 10 1.2 7Z"/><circle cx="7" cy="7" r="1.6"/><path d="M2 12 12 2"/>',
    cel: '<rect x="4" y="1.6" width="6" height="10.8" rx="1.3"/><path d="M6.4 10.6h1.2"/>',
    pc: '<rect x="2" y="3" width="10" height="6.4" rx="1"/><path d="M1 11.4h12"/>',
    tv: '<rect x="1.6" y="2.6" width="10.8" height="7.2" rx="1"/><path d="M5 12.2h4"/>',
    tab: '<rect x="2.6" y="1.8" width="8.8" height="10.4" rx="1.3"/><path d="M6.4 10.4h1.2"/>',
    outro: '<circle cx="7" cy="7" r="5"/><path d="M5.4 5.6a1.7 1.7 0 1 1 2.3 1.6c-.5.2-.7.6-.7 1.1M7 10v.1"/>',
    sub: '<circle cx="5.4" cy="4.4" r="2.1"/><path d="M1.6 12c.3-2.4 1.7-3.6 3.8-3.6S8.9 9.6 9.2 12M9.6 6.6l1.4 1.4 2.4-2.6"/>',
    nsub: '<circle cx="7" cy="4.4" r="2.3"/><path d="M2.6 12.4c.4-2.6 2-3.9 4.4-3.9s4 1.3 4.4 3.9"/>',
    lock: '<rect x="2.6" y="6.2" width="8.8" height="6" rx="1.2"/><path d="M4.6 6.2V4.4a2.4 2.4 0 0 1 4.8 0v1.8M7 8.6v1.6"/>',
    relogio: '<circle cx="7" cy="7" r="5.2"/><path d="M7 4v3.2l2 1.3"/>',
    carga: '<path d="M12 7a5 5 0 1 1-1.8-3.8"/><path d="M11.6 1.6v2.8H8.8"/>',
    aviso: '<path d="M7 1.8 12.8 12H1.2Z"/><path d="M7 5.6v3M7 10.2v.1"/>'
  };
  function gl(k, cls){ return '<svg class="ov-g' + (cls ? ' ' + cls : '') + '" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false">' + G[k] + '</svg>'; }

  /* ------------------------------------------------------------ pequenos helpers */
  function pl(v, um, vs){ return n(v) + ' ' + (v === 1 ? um : vs); }
  /* valor 0 numa lista que tem "omitido": o YouTube pode ter escondido essa linha, então não é zero medido: mostra traço */
  function vN(v, om){ return v === 0 && om > 0 ? '<span class="ov-sem" title="O YouTube não informou: pode estar dentro do omitido" aria-label="sem número informado">—</span>' : n(v); }
  function pT(pc, v, om){ return v === 0 && om > 0 ? '<span class="ov-sem" aria-hidden="true">—</span>' : pctTxt(pc, v); }
  function pctTxt(pc, v){ return v > 0 && pc === 0 ? '<1%' : pc + '%'; }
  function pctDito(pc, v){ return v > 0 && pc === 0 ? 'menos de 1%' : pc + '%'; }
  var PRE = function(cb){ return cb.ok < cb.total ? 'Nos ' + cb.ok + ' ' + (cb.ok === 1 ? 'dia medido' : 'dias medidos') + ' (' + A.dm(cb.ini) + ' a ' + A.dm(cb.ate) + '), ' : ''; };
  function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
  function fr(simbolo, html){ return '<p class="ov-fr">' + (simbolo || '') + '<span>' + html + '</span></p>'; }
  function ib(id, rot){ return A.ibtn(id, rot, true); }
  var ORIG = {}; D.ORIG.forEach(function(o){ ORIG[o.k] = o; });

  /* ------------------------------------------------------------ cobertura: quantos dos dias pedidos foram medidos */
  function cobertura(cb, canalTudo){
    var muda = cb.de <= D.MUDA && D.MUDA <= cb.ate || canalTudo, nmIni = cb.ok === 0;
    var pos = canalTudo ? null : muda ? Math.round(A.dias(cb.de, D.MUDA) / cb.total * 1000) / 10 : null;
    var seg = canalTudo
      ? '<i class="ov-nmseg" style="flex:1 1 0"></i><b class="ov-quebra" aria-hidden="true">//</b><i class="ov-okseg" style="flex:0 0 ' + Math.max(18, Math.round(cb.ok / cb.total * 100)) + '%"></i>'
      : (cb.antes ? '<i class="ov-nmseg" style="flex:' + cb.antes + ' 1 0"></i>' : '') + (cb.ok ? '<i class="ov-okseg" style="flex:' + cb.ok + ' 1 0"></i>' : '');
    if (canalTudo) { seg = seg.replace('flex:0 0 ' + Math.max(18, Math.round(cb.ok / cb.total * 100)) + '%', 'flex:0 0 22%'); }
    var alt = 'Origem medida em ' + n(cb.ok) + ' de ' + n(cb.total) + ' dias, de ' + A.dmy(cb.de) + ' a ' + A.dmy(cb.ate) + '.' + (cb.antes ? ' Não medido antes de ' + A.dmy(cb.ini) + ', quando a coleta começou.' : '') + (muda ? ' Marca em 24/08/2026: o YouTube mudou como conta views.' : '');
    var marca = muda ? '<i class="ov-mk" style="left:' + (canalTudo ? 'calc((78% - 14px) * .9)' : pos + '%') + '" aria-hidden="true"><svg viewBox="0 0 14 14" width="14" height="14" focusable="false"><path d="M7 1.4 12.6 7 7 12.6 1.4 7Z"/></svg></i>' : '';
    var leg = '<ul class="ov-cl">' + (cb.antes ? '<li><span class="nm-h" aria-hidden="true"></span>Não medido: a coleta começou em ' + A.dm(cb.ini) + '</li>' : '') + '<li><span class="ov-okdot" aria-hidden="true"></span>' + (cb.ok === cb.total ? 'Medido nos ' + cb.total + ' dias' : cb.ok ? 'Medido' : 'Nenhum dia medido ainda') + '</li>' + (muda ? '<li><svg class="ov-mkl" viewBox="0 0 14 14" width="12" height="12" aria-hidden="true"><path d="M7 1.4 12.6 7 7 12.6 1.4 7Z"/></svg>24/08/2026: o YouTube mudou como conta views</li>' : '') + '</ul>';
    if (cb.antes === 0 && !muda && !nmIni) return '<div class="ov-cob"><p class="ov-cb"><b><span class="num">' + cb.ok + '</span> de <span class="num">' + n(cb.total) + '</span></b> dias com a origem medida, de ' + A.dm(cb.de) + ' a ' + A.dm(cb.ate) + '</p></div>';
    return '<div class="ov-cob' + (canalTudo ? ' tudo' : '') + '"><p class="ov-cb"><b><span class="num">' + cb.ok + '</span> de <span class="num">' + n(cb.total) + '</span></b> ' + (cb.total === 1 ? 'dia' : 'dias') + ' com a origem medida</p>' +
      '<div class="ov-trk" role="img" aria-label="' + esc(alt) + '">' + seg + marca + '</div>' +
      '<div class="ov-ext" aria-hidden="true"><span>' + (canalTudo ? A.dmy(cb.de) : A.dm(cb.de)) + '</span><span>' + A.dm(cb.ate) + '</span></div>' + leg + '</div>';
  }
  function cobLinha(cb, nome){
    return '<p class="ov-cb1">' + (cb.antes ? '<span class="nm-h" aria-hidden="true"></span>' : '<span class="ov-okdot" aria-hidden="true"></span>') + '<span>' + (cb.ok === cb.total ? 'Medido nos ' + cb.total + ' dias' : 'Medido em ' + cb.ok + ' de ' + n(cb.total) + ' dias; antes de ' + A.dm(cb.ini) + ' não medido') + '</span></p>';
  }

  /* ------------------------------------------------------------ barra empilhada e lista-legenda de origem */
  function pilha(segs, om, alt, minGl){
    var h = segs.filter(function(s){ return s.v > 0; }).map(function(s){ return '<i class="ov-sg ' + s.cls + '" style="--v:' + s.v + '">' + (s.pc >= (minGl || 8) ? gl(s.g) : '') + '</i>'; }).join('');
    if (om > 0) h += '<i class="ov-sg om" style="--v:' + om + '">' + (om / (segs.reduce(function(a, s){ return a + s.v; }, 0) + om) >= .08 ? gl('om') : '') + '</i>';
    return '<div class="ov-pil" role="img" aria-label="' + esc(alt) + '">' + h + '</div>';
  }
  function origemLista(o, total, ctx){
    var ks = D.ORIG.map(function(x){ return x.k; }).filter(function(k){ return ctx.skip ? ctx.skip.indexOf(k) < 0 : true; });
    var vals = ks.map(function(k){ return o.v[k] || 0; }).concat([o.om]), pc = D.pcts(vals);
    var segs = ks.map(function(k, i){ return { cls: 'o-' + k, v: o.v[k] || 0, g: k, pc: pc[i] }; });
    var alt = ctx.alt + ks.map(function(k, i){ return ORIG[k].n + (vals[i] === 0 && o.om > 0 ? ': sem número do YouTube, pode estar no omitido' : ' ' + pctDito(pc[i], vals[i]) + ' (' + n(vals[i]) + ')'); }).join('; ') + '; omitido pelo YouTube ' + pctDito(pc[ks.length], o.om) + ' (' + n(o.om) + ').';
    var lista = '<ul class="ov-lg">' + ks.map(function(k, i){ return '<li class="ov-r"><span class="ov-sw o-' + k + '">' + gl(k) + '</span><span class="ov-n">' + ORIG[k].n + '</span><b class="num ov-v">' + vN(vals[i], o.om) + '</b><span class="num ov-p">' + pT(pc[i], vals[i], o.om) + '</span></li>'; }).join('') +
      '<li class="ov-r om"><span class="ov-sw om">' + gl('om') + '</span><span class="ov-n">Omitido pelo YouTube<small>' + (ctx.omTxt || 'O YouTube contou estas views, mas não disse de onde vieram.') + (o.om > 0 && ks.some(function(k){ return !o.v[k]; }) ? ' Onde há “—”, o YouTube não deu número: pode estar aqui dentro.' : '') + '</small></span><b class="num ov-v">' + n(o.om) + '</b><span class="num ov-p">' + pctTxt(pc[ks.length], o.om) + '</span></li>' +
      '<li class="ov-r tot"><span class="ov-sw" aria-hidden="true"></span><span class="ov-n">' + ctx.totRot + '</span><b class="num ov-v">' + n(total) + '</b><span class="num ov-p">100%</span></li></ul>';
    return { pil: pilha(segs, o.om, alt), lista: lista, pc: pc, vals: vals, ks: ks };
  }

  /* ------------------------------------------------------------ formas dos estados (iguais em todos os blocos) */
  function nmBloco(motivo, frase, aria){
    return (frase ? fr('<span class="ov-sw g nmsw" aria-hidden="true">' + A.nmSw() + '</span>', frase) : '') + '<div class="ov-nm"><div class="ov-hach" role="img" aria-label="' + (aria || 'não medido') + '"></div><div class="nml">' + A.nm() + '<p>' + motivo + '</p></div></div>';
  }
  function zeroBloco(txt){ return '<div class="ov-zero-w"><div class="ov-zero" role="img" aria-label="zero medido"><b class="num">0</b></div><p class="ov-zt"><b>Zero medido.</b> ' + txt + '</p></div>'; }
  function vazioBloco(txt){ return '<div class="ov-vz"><span class="ov-vz-i" aria-hidden="true">' + gl('relogio') + '</span><p><b>Ainda não existe.</b> ' + txt + '</p></div>'; }
  /* carregando: esqueleto cinza liso com o mesmo contorno da barra e da lista. Não é a hachura rosa ("não chegou") nem o pontilhado ("ainda não existe") */
  function cargaBloco(rotulo, vivo){
    return '<div class="ov-sk"' + (vivo ? ' role="status" aria-live="polite"' : '') + ' aria-busy="true"><p class="ov-sk-t"><span class="ov-sk-i" aria-hidden="true">' + gl('carga') + '</span>' + rotulo + '</p><div class="ov-sk-bar" aria-hidden="true"></div><ul class="ov-sk-l" aria-hidden="true"><li><i></i></li><li><i></i></li><li><i></i></li></ul></div>';
  }
  function bloqBloco(txt, quais){ return '<div class="ov-bq"><span class="ov-bq-i" aria-hidden="true">' + gl('lock') + '</span><div><p><b>Você não vê este dado.</b> ' + txt + '</p>' + (quais ? '<p class="ov-bq-q">' + quais + '</p>' : '') + '</div></div>'; }

  /* ------------------------------------------------------------ como cada bloco se decide: medido | zero | nm | vazio | bloq */
  function est(grupo){
    if (estado === 'vazio') return 'vazio';
    if (estado === 'carregando') return 'carga';
    if (estado === 'leitura') return leit === 'so-total' || grupo === 'privado' ? 'bloq' : 'seguir';
    if (estado === 'nao-medido') return 'nm';
    return 'seguir';
  }
  var COLETA_TXT = A.dm(COL);

  function resolve(grupo, cb, total){
    var e = est(grupo); if (e !== 'seguir') return e;
    if (cb.ok === 0) return 'nm';
    if (total === 0) return 'zero';
    return 'medido';
  }
  function motivoNm(grupo, objeto){
    if (estado === 'nao-medido') return grupo === 'lote' ? 'Quando o relatório do YouTube chegar, ' + (objeto || 'esta lista aparece sozinha') + '. Não é zero.' : 'A coleta começa em ' + A.dm(COL) + '. Antes dessa data não guardamos ' + (objeto || 'a origem') + '; não é zero.';
    return 'A coleta começa em ' + A.dm(COL) + '.';
  }

  /* ------------------------------------------------------------ bloco 1: de onde vêm as views (+ impressões por origem) */
  function infoOrigem(){
    return A.oculto('infoOrig', 'Como a origem é calculada', '<ul><li><b>Fonte:</b> YouTube Analytics do seu canal, views de cada dia por tipo de origem. Cálculo do Observatório, somando só os dias medidos do período.</li><li><b>Porcentagem:</b> views da origem ÷ views desses mesmos dias (as do dia a dia do vídeo ou do canal). ' + (estado === 'revisao' ? 'Aqui a soma das origens passou do total, por isso a divisão não aparece até conferir.' : nmd ? 'Quando a coleta começar, a soma das origens mais o omitido será igual ao total.' : 'O total sempre fecha: a soma das origens mais o omitido é igual ao total.') + '</li><li><b>Omitido pelo YouTube:</b> o YouTube não informa origens com poucas views. A diferença entre o total e a soma das origens aparece como barra própria e nunca é repartida entre as outras.</li><li><b>Dias medidos:</b> ' + (nmd ? 'a coleta começa em ' + A.dmy(COL) + ' (exemplo): até lá nenhum dia é medido, e nenhum vira zero.' : 'a coleta começou em ' + A.dmy(COL) + ' (exemplo) e vai para a frente; os dias antes disso ficam como não medido, nunca como zero.') + ' A contagem de dias vai até ' + A.dm(D.ULT) + ', o último dia entregue' + (tela === 'video' ? '; a idade do vídeo conta até hoje' : '') + '.</li>' + (D.MUDA >= C.per.de && D.MUDA <= C.per.ate ? '<li><b>24/08/2026:</b> o YouTube mudou como conta views. Períodos que cruzam essa data não se comparam direto.</li>' : '') + '<li><b>Cores:</b> valem só dentro destes blocos. Em outras telas as mesmas cores indicam faixas de desempenho; aqui o símbolo e a ordem fixa dizem qual é a origem.</li></ul>');
  }
  function infoImp(){
    return A.oculto('infoImp', 'Como as impressões por origem são calculadas', '<ul><li><b>Fonte:</b> relatório de alcance do YouTube, por dia, aparelho e origem. Cálculo do Observatório, somando os dias do período.</li><li><b>Janela própria:</b> ' + (nmd ? 'vai valer desde o primeiro relatório do YouTube, que ainda não chegou.' : 'vale desde ' + LOTE_DESDE + ', antes do começo da coleta de views por origem.') + ' Por isso as duas janelas podem ser diferentes na mesma tela.</li><li><b>Sites de fora:</b> não aparecem aqui porque o YouTube não mostra miniatura fora dele.</li><li><b>Omitido:</b> impressões que o relatório não separou por origem.</li><li><b>Cores:</b> as mesmas da origem das views, só dentro destes blocos.</li></ul>');
  }
  function blocoOrigem(){
    var cb = C.cO, o = C.orig, e = estado === 'revisao' ? 'rev' : resolve('origem', cb, o.total), canalTudo = p === 'tudo' && cb.antes > 60;   /* r3: vale também para o vídeo antigo (zero medido desde 2019): a régua proporcional virava um fio de 0,3% */
    var head = '<div class="ov-h"><h2 id="ovO">De onde vêm as views ' + ib('infoOrig', 'Como a origem é calculada') + '</h2></div>';
    var corpo;
    if (e === 'bloq') corpo = bloqBloco('A origem das views e os outros detalhes são do dono do canal e de quem tem o direito de ver o desempenho privado.');
    else if (e === 'carga') corpo = cargaBloco('Carregando a origem das views de ' + PER.filter(function(x){ return x[0] === p; })[0][1].toLowerCase() + '…', true);
    else if (e === 'rev') corpo = nmBloco('Em revisão: as origens somaram mais views do que o total do dia a dia, então não mostramos a divisão até conferir. Não é zero.', 'Não mostramos de onde vêm as views por enquanto: a origem está em revisão.', 'origem em revisão');
    else if (e === 'vazio') corpo = vazioBloco('O YouTube entrega a origem das views 2 a 3 dias depois da publicação. Primeira leitura em ' + PRIM + '.');
    else if (e === 'nm') corpo = nmBloco(nmd ? 'Antes dessa data não guardamos a origem; não é zero.' : motivoNm('origem'), 'Ainda não sabemos de onde vêm as views: a coleta começa em ' + COLETA_TXT + '.');
    else if (e === 'zero') corpo = fr('', 'Nenhuma view nos ' + cb.ok + ' dias medidos (' + A.dm(cb.ini) + ' a ' + A.dm(cb.ate) + '): não há o que repartir.') + cobertura(cb, canalTudo) + zeroBloco('O YouTube mandou os ' + cb.ok + ' dias e nenhuma view foi contada.');
    else {
      var t = origemLista(o, o.total, { alt: 'De ' + n(o.total) + ' views nos dias medidos: ', totRot: 'Total de views nos dias medidos' });
      var ordem = t.ks.map(function(k, i){ return { k: k, v: t.vals[i], pc: t.pc[i] }; }).filter(function(x){ return x.v > 0; }).sort(function(a, b){ return b.v - a.v; });
      var frase, simb = '';
      if (ordem.length >= 2) {
        frase = PRE(cb) + '<b>' + pctDito(ordem[0].pc, ordem[0].v) + '</b> das views vieram ' + ORIG[ordem[0].k].de + ' e <b>' + pctDito(ordem[1].pc, ordem[1].v) + '</b> ' + ORIG[ordem[1].k].de + (o.om ? '; ' + pctDito(t.pc[t.ks.length], o.om) + ' foram omitidos pelo YouTube.' : '.');
        simb = '<span class="ov-sw g o-' + ordem[0].k + '" aria-hidden="true">' + gl(ordem[0].k) + '</span>';
      } else if (ordem.length === 1) { frase = PRE(cb) + 'O YouTube só disse a origem de ' + pl(ordem[0].v, 'view', 'views') + ', ' + ORIG[ordem[0].k].de + '. As outras ' + n(o.om) + ' foram omitidas.'; simb = '<span class="ov-sw g o-' + ordem[0].k + '" aria-hidden="true">' + gl(ordem[0].k) + '</span>'; }
      else frase = PRE(cb) + 'O YouTube não disse a origem de nenhuma das ' + n(o.om) + ' views: foram todas omitidas.';
      var dominaOm = o.om / o.total >= .5;
      if (dominaOm) frase = PRE(cb) + 'o YouTube disse a origem de só <b>' + pl(o.total - o.om, 'view', 'views') + '</b> das ' + n(o.total) + ', e <b>' + n(o.om) + '</b> foram omitidas: com poucas views por origem ele esconde quase tudo.';
      if (dominaOm) { frase = cap(frase); simb = '<span class="ov-sw g om" aria-hidden="true">' + gl('om') + '</span>'; }
      corpo = fr(simb, frase) + cobertura(cb, canalTudo) + t.pil + t.lista +
        '<p class="ov-vtot">Views no período todo: <b class="num">' + n(C.totalPeriodo) + '</b>' + (cb.antes ? '. A divisão acima usa só as ' + n(o.total) + ' views dos dias medidos.' : '.') + '</p>';
    }
    return '<section class="sec ov-sec" aria-labelledby="ovO">' + head + corpo + infoOrigem() + blocoImpressoes() + '</section>';
  }
  function blocoImpressoes(){
    var cb = C.cL, im = C.imp, e = resolve('lote-imp', cb, im.total), head = '<h3 class="ov-h3" id="ovI">Impressões por origem ' + ib('infoImp', 'Como as impressões por origem são calculadas') + '</h3>';
    var corpo;
    if (e === 'bloq') corpo = bloqBloco('As impressões são dados do alcance do seu canal.');
    else if (e === 'carga') corpo = cargaBloco('Carregando as impressões por origem…');
    else if (e === 'vazio') corpo = vazioBloco('As impressões chegam 2 a 3 dias depois da publicação. Primeira leitura em ' + PRIM + '.');
    else if (e === 'nm') corpo = nmd ? nmBloco(motivoNm('lote', 'este bloco aparece sozinho'), 'Ainda não temos as impressões por origem: o relatório do YouTube não chegou.') : nmBloco('A coleta começa em ' + A.dm(D.LOTE) + '.');
    else if (e === 'zero') corpo = zeroBloco('O YouTube mandou os ' + cb.ok + ' dias e o vídeo não foi mostrado a ninguém: 0 impressões.');
    else {
      var t = origemLista(im, im.total, { skip: ['ext'], alt: 'De ' + n(im.total) + ' impressões: ', totRot: 'Total de impressões', omTxt: 'Impressões que o relatório não separou por origem.' });
      var ord = t.ks.map(function(k, i){ return { k: k, v: t.vals[i], pc: t.pc[i] }; }).sort(function(a, b){ return b.v - a.v; });
      var ONDE = { nav: 'no início e nas inscrições', sug: 'em vídeos sugeridos', pesq: 'na pesquisa do YouTube', sh: 'no feed de Shorts', out: 'em outras origens' };
      var f = 'Nos ' + cb.ok + ' ' + (cb.ok === 1 ? 'dia medido' : 'dias medidos') + ', ' + (tela === 'video' ? 'este vídeo foi mostrado' : 'seus vídeos foram mostrados') + ' <b>' + n(im.total) + '</b> vezes; <b>' + pctDito(ord[0].pc, ord[0].v) + '</b> ' + ONDE[ord[0].k] + '.';
      corpo = fr('<span class="ov-sw g o-' + ord[0].k + '" aria-hidden="true">' + gl(ord[0].k) + '</span>', f) + cobLinha(cb) + t.pil + t.lista;
    }
    return '<div class="ov-sub">' + head + corpo + infoImp() + '</div>';
  }

  /* ------------------------------------------------------------ cartões pequenos: aparelho, país, inscritos */
  function linhaBarra(ic, nome, v, pc, total, om){
    return '<li class="ov-hb"><span class="ov-ic" aria-hidden="true">' + ic + '</span><span class="ov-n">' + nome + '</span><b class="num ov-v">' + vN(v, om) + '</b><span class="num ov-p">' + pT(pc, v, om) + '</span><span class="ov-tr" aria-hidden="true"><i style="width:' + Math.max(v > 0 ? 1.5 : 0, pc) + '%"></i></span></li>';
  }
  function linhaOm(v, pc){ return '<li class="ov-hb om"><span class="ov-ic" aria-hidden="true">' + gl('om') + '</span><span class="ov-n">Omitido pelo YouTube</span><b class="num ov-v">' + n(v) + '</b><span class="num ov-p">' + pctTxt(pc, v) + '</span><span class="ov-tr om" aria-hidden="true"><i style="width:' + Math.max(v > 0 ? 1.5 : 0, pc) + '%"></i></span></li>'; }
  function cartao(id, titulo, infoHtml, grupo, cb, total, corpoFn, opts){
    opts = opts || {};
    var rot = opts.rot || ('Como ' + titulo.toLowerCase() + ' é calculado');
    var e = resolve(grupo, cb, total), h = '<h2 id="' + id + '">' + titulo + ' ' + ib(id + 'i', rot) + '</h2>' + (opts.chip || '');
    var corpo;
    if (e === 'bloq') corpo = bloqBloco('É dado do dono do canal.');
    else if (e === 'vazio') corpo = vazioBloco('Primeira leitura em ' + PRIM + '.');
    else if (e === 'carga') corpo = cargaBloco('Carregando…');
    else if (e === 'nm') corpo = nmBloco(motivoNm('origem', opts.objeto));
    else if (e === 'zero') corpo = '<p class="ov-zero-m"><b class="num">0</b><span><b>Zero medido.</b> Nenhuma view nos ' + cb.ok + ' dias medidos.</span></p>';
    else corpo = corpoFn() + (opts.semCob ? '' : cobLinha(cb));
    return '<section class="sec ov-sec ov-card" aria-labelledby="' + id + '">' + h + corpo + A.oculto(id + 'i', rot, infoHtml) + '</section>';
  }
  function omFrase(om, pcOm){ return om ? '; ' + pctDito(pcOm, om) + ' omitido pelo YouTube.' : '.'; }

  function cartaoAparelho(){
    var a = C.apar;
    return cartao('ovA', 'Em que aparelho', '<ul><li><b>Fonte:</b> YouTube Analytics do seu canal, views por dia, tipo de aparelho e sistema. Cálculo do Observatório sobre os dias medidos.</li><li><b>Porcentagem:</b> views do aparelho ÷ views dos mesmos dias. Omitido pelo YouTube = o que falta para fechar o total.</li><li><b>Barras:</b> cada barra é a fatia do total (66% = dois terços da largura).</li></ul>', 'origem', C.cO, a.total, function(){
      var ks = D.APAR.map(function(x){ return x.k; }), vals = ks.map(function(k){ return a.v[k] || 0; }).concat([a.om]), pc = D.pcts(vals);
      var ord = ks.map(function(k, i){ return { k: k, v: vals[i], pc: pc[i] }; }).sort(function(x, y){ return y.v - x.v; })[0];
      var nome = D.APAR.filter(function(x){ return x.k === ord.k; })[0].n;
      var fa = a.total ? PRE(C.cO) + '<b>' + pctDito(ord.pc, ord.v) + '</b> das views vieram de ' + (ord.k === 'cel' ? 'celular' : ord.k === 'pc' ? 'computador' : ord.k === 'tv' ? 'TV' : ord.k === 'tab' ? 'tablet' : 'outros aparelhos') + omFrase(a.om, pc[ks.length]) : '';
      return fr('<span class="ov-sw g ov-own" aria-hidden="true">' + gl(ord.k) + '</span>', cap(fa)) + '<ul class="ov-lg2">' + ks.map(function(k, i){ return linhaBarra(gl(k), D.APAR[i].n, vals[i], pc[i], a.total, a.om); }).join('') + linhaOm(a.om, pc[ks.length]) + '</ul>';
    }, { rot: 'Como o aparelho é calculado', objeto: 'o aparelho' });
  }
  function cartaoPais(){
    var a = C.pais, mes = paisMes && tela === 'canal' && estado === 'tipico';   /* r6: só o canal típico tem 3 meses fechados de histórico */
    var total = mes ? D.PAIS_MES_DIAS * D.P.canalTip.Rant : a.total;
    var cbp = mes ? { total: 3, ok: 3, antes: 0, ini: '2026-07-01', ate: '2026-09-30', de: '2026-07-01' } : C.cO;
    var chip = mes ? '<span class="chip ov-mes">por mês</span>' : '';
    return cartao('ovP', 'De que país', '<ul><li><b>Fonte:</b> YouTube Analytics do seu canal, views por dia e país. Cálculo do Observatório sobre os dias medidos. As siglas são as de duas letras da ISO.</li><li><b>Outros países:</b> soma dos países que não estão na lista. <b>Não identificado:</b> views sem país.</li><li><b>Barras:</b> cada barra é a fatia do total.</li>' + (mes ? '<li><b>Por mês:</b> o YouTube não separou país por dia nesse trecho antigo; os números são de meses fechados e o mês em andamento entra quando fechar.</li>' : '') + '</ul>', 'origem', cbp, total, function(){
      var base = a, ks = a.nomes.map(function(x){ return x[0]; }).concat(['OUTROS', 'ZZ']);
      var vals = ks.map(function(k){ return base.v[k] || 0; });
      if (mes) { var f = total / (a.total || 1); vals = vals.map(function(v){ return Math.round(v * f); }); }
      var om = mes ? total - vals.reduce(function(x, y){ return x + y; }, 0) : a.om;
      var pc = D.pcts(vals.concat([om])), nomes = a.nomes.map(function(x){ return x[1]; }).concat(['Outros países', 'Não identificado']), sig = a.nomes.map(function(x){ return x[0]; }).concat(['…', '?']);
      var top = vals.slice(0, 5).map(function(v, i){ return [v, i]; }).sort(function(x, y){ return y[0] - x[0]; });
      var pre = mes ? 'De julho a setembro, ' : PRE(C.cO);
      var fa = pre + '<b>' + pctDito(pc[top[0][1]], top[0][0]) + '</b> das views vieram ' + dePais(nomes[top[0][1]]) + (top[1][0] > 0 ? ' e <b>' + pctDito(pc[top[1][1]], top[1][0]) + '</b> ' + dePais(nomes[top[1][1]]) : '') + omFrase(om, pc[ks.length]);
      return fr('<span class="ov-sw g ov-own ov-sig" aria-hidden="true">' + sig[top[0][1]] + '</span>', cap(fa)) + (mes ? '<p class="ov-cb1"><span class="ov-okdot" aria-hidden="true"></span><span>Medido por mês: julho, agosto e setembro de 2026. Outubro entra quando fechar.</span></p>' : '') +
        '<ul class="ov-lg2">' + ks.map(function(k, i){ return linhaBarra('<span class="ov-sig">' + sig[i] + '</span>', nomes[i], vals[i], pc[i], total, om); }).join('') + linhaOm(om, pc[ks.length]) + '</ul>';
    }, { chip: chip, semCob: mes, rot: 'Como o país é calculado', objeto: 'o país' });
  }
  function cartaoInscritos(){
    var a = C.insc;
    return cartao('ovS', 'Inscritos e não inscritos', '<ul><li><b>Fonte:</b> YouTube Analytics do seu canal, views por dia e situação de quem assistia (inscrito ou não). Cálculo do Observatório sobre os dias medidos.</li><li><b>Atenção:</b> mostra se quem assistiu era inscrito naquele momento, não quantas pessoas se inscreveram.</li><li><b>Destaque:</b> a faixa cheia é a que trouxe mais views; a contornada é a menor. O símbolo da pessoa diz qual é qual.</li></ul>', 'origem', C.cO, a.total, function(){
      var vals = [a.v.sub || 0, a.v.nsub || 0, a.om], pc = D.pcts(vals), alt = 'De ' + n(a.total) + ' views nos dias medidos: inscritos ' + pctDito(pc[0], vals[0]) + ', não inscritos ' + pctDito(pc[1], vals[1]) + ', omitido pelo YouTube ' + pctDito(pc[2], vals[2]) + '.';
      var ns = vals[1] >= vals[0], fa = PRE(C.cO) + '<b>' + pctDito(ns ? pc[1] : pc[0], ns ? vals[1] : vals[0]) + '</b> das views vieram de quem ' + (ns ? 'não é inscrito' : 'é inscrito') + omFrase(a.om, pc[2]);
      var cl = [ns ? 'i-vaz' : 'i-cheio', ns ? 'i-cheio' : 'i-vaz'];
      var pil = pilha([{ cls: cl[0], v: vals[0], g: 'sub', pc: pc[0] }, { cls: cl[1], v: vals[1], g: 'nsub', pc: pc[1] }], a.om, alt, 5);
      return fr('<span class="ov-sw g ov-own" aria-hidden="true">' + gl(ns ? 'nsub' : 'sub') + '</span>', cap(fa)) + pil +
        '<ul class="ov-lg">' + [[cl[0], 'sub', 'Inscritos', 0], [cl[1], 'nsub', 'Não inscritos', 1]].map(function(x){ return '<li class="ov-r"><span class="ov-sw ' + x[0] + '">' + gl(x[1]) + '</span><span class="ov-n">' + x[2] + '</span><b class="num ov-v">' + vN(vals[x[3]], a.om) + '</b><span class="num ov-p">' + pT(pc[x[3]], vals[x[3]], a.om) + '</span></li>'; }).join('') +
        '<li class="ov-r om"><span class="ov-sw om">' + gl('om') + '</span><span class="ov-n">Omitido pelo YouTube</span><b class="num ov-v">' + n(a.om) + '</b><span class="num ov-p">' + pctTxt(pc[2], a.om) + '</span></li></ul>';
    }, { rot: 'Como inscritos e não inscritos são calculados', objeto: 'quem é inscrito' });
  }

  /* ------------------------------------------------------------ termos e sites (privado) */
  /* r5: preposição certa por país ("do Brasil", "dos Estados Unidos"), antes saía "de Brasil" */
  function dePais(nome){ var m = { 'Brasil': 'do Brasil', 'Estados Unidos': 'dos Estados Unidos', 'Países Baixos': 'dos Países Baixos', 'República Democrática do Congo': 'da República Democrática do Congo', 'Outros países': 'de outros países', 'Não identificado': 'de país não identificado' }; return m[nome] || 'de ' + nome; }
  function semComparar(ehSite){ return '<div class="ov-mini"><p class="ov-cb1"><span class="nm-h" aria-hidden="true"></span><span>Sem comparar com o total ' + (ehSite ? 'de sites de fora' : 'da pesquisa') + ': a origem foi medida em ' + C.cO.ok + ' dos ' + C.cL.ok + ' dias desta lista.</span></p></div>'; }
  function listaTS(rotulo, ts, ehSite){
    var itens = ts.itens, topo = itens.length ? itens[0].v : 1, e;
    var vazio = !itens.length;
    var cab = '<h3 class="ov-h3">' + rotulo + '</h3>';
    /* zero medido só quando o dia chegou e o YouTube não omitiu nada (origem com total 0). Com omitido na origem, 0 aqui seria afirmar o que a tela não sabe */
    var podeZero = C.orig.total === 0 && C.orig.om === 0;
    if (ts.base === 0 && podeZero) return '<div class="ov-ts">' + cab + zeroBloco(ehSite ? 'Nenhuma view veio de sites de fora nos ' + ts.cob.ok + ' dias desta lista.' : 'Nenhuma view veio da pesquisa nos ' + ts.cob.ok + ' dias desta lista.') + '</div>';
    if (ts.base === 0) return '<div class="ov-ts">' + cab + '<div class="ov-om-b"><span class="ov-sw om" aria-hidden="true">' + gl('om') + '</span><p><b>Nenhum ' + (ehSite ? 'site' : 'termo') + ' apareceu.</b> O YouTube só mostra ' + (ehSite ? 'sites' : 'termos') + ' que trouxeram várias views.</p></div></div>';
    if (vazio) {
      /* r5 (B2): se esta lista cobre mais dias que a origem lá em cima, o número é outro (3 lá, 5 aqui); a frase diz a janela e a linha "sem comparar" explica */
      var outraJanela = !ts.cmp, qtd = n(ts.base) + ' views ' + (ehSite ? 'de fora do YouTube' : 'da pesquisa') + (outraJanela ? ' dos ' + ts.cob.ok + ' dias desta lista' : '');
      return '<div class="ov-ts">' + cab + '<div class="ov-om-b"><span class="ov-sw om" aria-hidden="true">' + gl('om') + '</span><p><b>Nenhum ' + (ehSite ? 'site' : 'termo') + ' apareceu.</b> O YouTube só mostra ' + (ehSite ? 'sites' : 'termos') + ' que trouxeram várias views; as ' + qtd + ' ficaram sem ' + (ehSite ? 'endereço' : 'termo') + ' (omitido pelo YouTube).</p></div>' + (outraJanela ? semComparar(ehSite) : '') + '</div>';
    }
    var rows = itens.map(function(x){ return '<li class="ov-tm"><span class="ov-n' + (ehSite ? ' url' : '') + '" title="' + esc(x.t) + '">' + (ehSite ? esc(x.t) : '“' + esc(x.t) + '”') + '</span><b class="num ov-v">' + n(x.v) + '</b><span class="ov-tr" aria-hidden="true"><i style="width:' + Math.max(2, Math.round(x.v / topo * 100)) + '%"></i></span></li>'; }).join('');
    var mini;
    if (estado === 'revisao') mini = '<div class="ov-mini"><p class="ov-cb1"><span class="nm-h" aria-hidden="true"></span><span>Sem comparar com o total ' + (ehSite ? 'de sites de fora' : 'da pesquisa') + ': a origem está em revisão.</span></p></div>';
    else if (ts.cmp) {
      var sem = ts.base - ts.soma, alt = 'Das ' + n(ts.base) + ' views ' + (ehSite ? 'de sites de fora' : 'da pesquisa') + ': ' + n(ts.soma) + ' com ' + (ehSite ? 'endereço' : 'termo') + ' e ' + n(sem) + ' sem, omitidas pelo YouTube.';
      mini = '<div class="ov-mini"><p>Das <b class="num">' + n(ts.base) + '</b> views ' + (ehSite ? 'de sites de fora' : 'da pesquisa') + ': <b class="num">' + n(ts.soma) + '</b> com ' + (ehSite ? 'endereço' : 'termo') + ', <b class="num">' + n(sem) + '</b> omitidas pelo YouTube.</p>' + pilha([{ cls: 'ov-own', v: ts.soma, g: ehSite ? 'ext' : 'pesq', pc: 0 }], sem, alt) + '</div>';
    } else mini = semComparar(ehSite);
    var f = ehSite ? 'O site que mais trouxe gente foi <b>' + esc(itens[0].t) + '</b>, com ' + pl(itens[0].v, 'view', 'views') + '.' : 'A busca que mais trouxe gente foi <b>“' + esc(itens[0].t) + '”</b>, com ' + pl(itens[0].v, 'view', 'views') + '.';
    return '<div class="ov-ts">' + cab + fr('<span class="ov-sw g ov-own" aria-hidden="true">' + gl(ehSite ? 'ext' : 'pesq') + '</span>', f) + '<ul class="ov-lg2 tm">' + rows + '</ul>' + mini + '</div>';
  }
  function blocoTermos(){
    var e = est('privado'), cb = C.cL;
    var priv = '<span class="chip ov-priv">' + gl('lock') + 'só quem edita o site</span>';
    var h = '<div class="ov-h"><h2 id="ovT">O que pesquisaram e de que sites vieram ' + ib('infoTs', 'Como termos e sites são calculados') + '</h2>' + priv + '</div>';
    var info = A.oculto('infoTs', 'Como termos e sites são calculados', '<ul><li><b>Fonte:</b> relatório do YouTube sobre pesquisa e sites, por dia, ' + (nmd ? 'a partir do primeiro que chegar' : 'desde ' + LOTE_DESDE) + '. Cálculo do Observatório somando os dias do período.</li><li><b>Quem vê:</b> só quem edita o site. Nada disto sai do painel.</li><li><b>Endereços:</b> guardamos o site sem o que vem depois do “?” (e-mail e identificador de campanha ficam de fora).</li><li><b>Termos:</b> uma busca pode ser o nome de uma pessoa. Por isso ficam só aqui, nunca somados numa tela de leitura.</li><li><b>Barras:</b> aqui a barra cheia é o termo ou o site com mais views e as outras são proporcionais a ele; em aparelho, país e inscritos a barra é a fatia do total.</li><li><b>Cor:</b> a lupa e a seta são laranja aqui porque esta lista é só do seu canal; no bloco de origem a cor diz de onde vieram as views.</li><li><b>Omitido pelo YouTube:</b> termos e sites com poucas views não aparecem. A barra compara com o total da origem só quando as duas medidas cobrem os mesmos dias.</li></ul>');
    var corpo;
    if (estado === 'carregando') corpo = cargaBloco('Carregando termos e sites…');
    else if (estado === 'vazio') corpo = vazioBloco('Termos e sites chegam 2 a 3 dias depois da publicação. Primeira leitura em ' + PRIM + '.');
    else if (e === 'bloq') corpo = bloqBloco('Termos de pesquisa e sites de fora ' + (leit === 'sem-termos' ? 'só aparecem para quem edita o site.' : 'são do dono do canal.'), 'Aqui há duas listas que você não vê: <b>o que pesquisaram</b> e <b>de que sites vieram</b>. O resto desta página continua à sua vista' + (leit === 'sem-termos' ? '.' : ' quando o direito for concedido.'));
    else if (estado === 'nao-medido') corpo = nmBloco(motivoNm('lote'), 'Ainda não temos termos nem sites: o relatório do YouTube não chegou.');
    else corpo = '<div class="ov-dois">' + listaTS('Termos de pesquisa', C.termos, false) + listaTS('Sites de fora do YouTube', C.sites, true) + '</div>' + cobLinha(cb);
    return '<section class="sec ov-sec ov-wide" aria-labelledby="ovT">' + h + corpo + info + '</section>';
  }

  /* ------------------------------------------------------------ cabeçalho da página (aprovado em 12/10; aqui só o que muda com o estado) */
  /* quarta célula do canal (r3, B1): o que ela diz tem de concordar com o cartão logo abaixo. Não medido: o marcador de não medido, nunca um 7 de 7 nem a caixa do zero. Erro e carregando: traço, porque ainda não sabemos */
  function diasCelula(){
    var l = 'dias com origem medida', de = 'de ' + n(C.per.dias);
    if (nmd) return { v: null, l: l, sub: '0 ' + de + ' · a coleta começa em ' + A.dm(COL) };
    if (estado === 'erro') return { v: '—', l: l, sub: de + ' · não conseguimos ler agora' };
    if (estado === 'carregando') return { v: '—', l: l, sub: de + ' · carregando' };
    return { v: String(C.cO.ok), l: l, sub: de + (estado === 'revisao' ? ' · origem em revisão' : '') };
  }
  function cabecalho(){
    if (tela === 'video') {
      /* views da vida inteira = o total do cenário "desde a publicação" (fonte única); curtidas e comentários só entram na conta do engajamento */
      var vida = D.cenario('video', estado === 'zero' ? 'zero' : estado === 'vazio' ? 'vazio' : 'tipico', 'tudo').totalPeriodo;
      var V = estado === 'zero' ? { t: 'Mochilão pelo Vietnã em 2019', pub: '2019-05-14', likes: 1900, com: 340, normal: D.normalDoCanal(vida), normalSub: 'views ÷ mediana dos outros vídeos', dur: 1803 }
        : estado === 'vazio' ? { t: 'Hanói à noite: o que ver depois das 22h', pub: D.VAZIO_PUB, likes: 9, com: 1, normal: null, normalMotivo: 'o vídeo é novo demais', dur: 947, idadeTxt: '1 dia' }
        : { t: 'Quanto custa uma semana em Hanói?', pub: '2026-09-20', likes: 212, com: 31, normal: D.normalDoCanal(vida), normalSub: 'views ÷ mediana dos outros vídeos', dur: 947 };
      V.idadeTxt = V.idadeTxt || (n(A.dias(V.pub, D.HOJE)) + (A.dias(V.pub, D.HOJE) === 1 ? ' dia' : ' dias'));   /* r5 (C2): milhar com ponto, como o resto da tela */
      var lk = V.likes, cm = V.com; V.eng = (lk + cm) / vida; V.views = n(vida); V.likes = n(lk); V.com = n(cm);
      return A.migalha([['Canais', '#'], [D.CANAL.tipico.nome, '#'], ['Vídeo']]) + L.videoCab(V);
    }
    var mag = estado === 'magro', ext = estado === 'extremo';
    var cel = [{ v: mag ? '27' : ext ? A.mil(1240000) : A.mil(D.INSCRITOS_CANAL), l: 'inscritos' }, { v: mag ? '3' : ext ? '412' : String(D.VIDEOS_CANAL), l: 'vídeos' }, { v: n(C.totalPeriodo), l: 'views no período', sub: A.dm(C.per.de) + ' a ' + A.dm(C.per.ate) }, diasCelula()];
    var cn = D.canalDe(estado);   /* r5 (B1): migalha, título e sigla do avatar leem da mesma constante */
    return A.migalha([['Canais', '#'], [cn.nome]]) + '<header class="chead"><span class="av" aria-hidden="true">' + cn.sigla + '</span><div class="l1"><h1 id="vt" tabindex="-1">' + cn.nome + '</h1><span class="chip own">seu canal</span><span class="ex">exemplo</span></div><p class="sub">Dados de exemplo.</p></header><div class="nrow">' + A.faixa(cel, 'Números do canal') + '</div>';
  }

  /* ------------------------------------------------------------ seletor de período */
  function seletor(){
    var itens = PER.map(function(x){ var on = x[0] === p; return '<a class="ov-pe" href="' + esc(A.href({ periodo: x[0] })) + '" data-p="' + x[0] + '" aria-label="' + esc(x[2]) + '"' + (on ? ' aria-current="true"' : '') + '>' + (on ? '<svg class="i" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8.4 6.4 12 13 4.6"/></svg>' : '') + x[1] + '</a>'; }).join('');
    return '<div class="ov-bar"><div class="ov-pes" role="group" aria-label="Período"><span class="ov-pl">Período</span>' + itens + '</div><p class="ov-lem">' + (salvo ? 'Escolha salva neste navegador. <button type="button" class="lk" id="ovVolta">Voltar ao padrão</button>' : 'Dados até ' + A.dm(D.ULT) + ': o YouTube entrega com 2 a 3 dias de atraso.') + '</p></div>';
  }

  /* ------------------------------------------------------------ erro */
  function erro(){
    return '<div class="ov-er" role="alert"><span class="ov-er-i" aria-hidden="true">' + gl('aviso') + '</span><div><p class="ov-er-t"><b>Não conseguimos ler a origem das views agora.</b></p><p>O YouTube não respondeu à consulta das 14:32. O total de views da página continua certo; faltam origem, impressões por origem, aparelho, país, inscritos, termos e sites. A última consulta que deu certo foi a de 12/10, às 06:10.</p><p class="ov-er-b"><button type="button" class="btn big" id="ovTenta">Tentar de novo</button><span id="ovTentaMsg" class="mut" role="status" aria-live="polite"></span></p></div></div>';
  }
  function soTotal(){
    return '<section class="sec ov-sec" aria-labelledby="ovTot"><h2 id="ovTot">Views no período</h2>' + A.faixa([{ v: n(C.totalPeriodo), l: 'views', sub: A.dm(C.per.de) + ' a ' + A.dm(C.per.ate) }], 'Total de views') + '</section>';
  }

  /* ------------------------------------------------------------ o cartão "Só o seu canal mede" com as linhas novas */
  function cartaoComparar(){
    var ver = !(estado === 'leitura' && leit === 'so-total'), ve = estado !== 'leitura' || leit !== 'so-total';
    var o = C.orig, K = C.card, vzm = estado === 'vazio', zm = estado === 'zero';
    /* r3: as quatro linhas "como já era" derivam do mesmo perfil do estado (antes eram texto fixo: 41.300 impressões numa tela de zero views) */
    function z0(txt){ return '<span class="ov-zero-m"><b class="num">0</b><span>' + txt + '</span></span>'; }
    function vz(){ return '<span class="ov-vz-m">' + gl('relogio') + '<span>Ainda não existe</span></span>'; }
    function semNum(txt){ return '<span class="vl">—<small>' + txt + '</small></span>'; }
    var dp = K.n >= 1e6 ? 2 : 1, pc = function(x){ return (x * 100).toFixed(dp).replace('.', ',') + '%'; };
    var antigas = '<li><div class="rt">Impressões<small>de ' + A.dm(C.per.de) + ' a ' + A.dm(C.per.ate) + '</small></div><div>' + (vzm ? vz() : zm ? z0('Zero medido') : '<span class="vl">' + n(K.imp) + '</span>') + '</div></li>' +
      '<li><div class="rt">Cliques estimados<small>impressões × taxa de cada dia</small></div><div>' + (vzm ? vz() : zm ? z0('Zero medido') : '<span class="vl">' + n(K.cliques) + '</span>') + '</div></li>' +
      '<li><div class="rt">Taxa de clique<small>com intervalo de 95%</small></div><div>' + (vzm ? vz() : zm ? semNum('sem impressões para dividir') : '<span class="vl">' + pc(K.taxa) + '<small>entre ' + pc(K.lo) + ' e ' + pc(K.hi) + '</small></span>') + '</div></li>' +
      '<li><div class="rt">% assistido<small>média pelas views, 28 dias</small></div><div>' + (vzm ? vz() : zm ? semNum('sem views no período') : '<span class="vl">' + K.assist + '%</span>') + '</div></li>';
    function linha(rot, sub, val){ return '<li class="ov-nl"><div class="rt">' + L.tag('novo') + '<span class="ov-rt">' + rot + '</span><small>' + sub + '</small></div><div>' + val + '</div></li>'; }
    function bl(txt){ return '<span class="ov-bq-m">' + gl('lock') + '<span>' + txt + '</span></span>'; }
    var eO = resolve('origem', C.cO, o.total), eT = est('privado');
    /* erro e carregando valem para as cinco linhas novas (r3): antes o cartão mostrava os números cheios num estado em que a leitura falhou ou ainda não voltou */
    function er(){ return '<span class="ov-er-m">' + gl('aviso') + '<span>Não conseguimos ler agora</span></span>'; }
    function ca(){ return '<span class="ov-ca-m" role="status">' + gl('carga') + '<span>Carregando…</span></span>'; }
    function valOrigem(){
      if (!ver) return bl('Dado do dono do canal. Você não vê.');
      if (estado === 'erro') return er(); if (estado === 'carregando') return ca();
      if (estado === 'revisao') return '<span class="ov-nm-m"><span class="nm-h" role="img" aria-label="origem em revisão"></span><span>Não medido: a origem está em revisão</span></span>';
      if (eO === 'vazio') return '<span class="ov-vz-m">' + gl('relogio') + '<span>Ainda não existe: primeira leitura em ' + PRIM + '</span></span>';
      if (eO === 'nm') return '<span class="ov-nm-m">' + A.nmSw() + '<span>' + (nmd ? 'Não medido: a coleta começa em ' + A.dm(COL) : 'Não medido') + '</span></span>';
      if (eO === 'zero') return '<span class="ov-zero-m"><b class="num">0</b><span>Zero medido: nenhuma view nos dias medidos</span></span>';
      var t = origemLista(o, o.total, { alt: 'Origem das views: ', totRot: '' }), ord = t.ks.map(function(k, i){ return { k: k, pc: t.pc[i], v: t.vals[i] }; }).sort(function(a, b){ return b.v - a.v; });
      var mini = t.pil.replace('class="ov-pil"', 'class="ov-pil ovmn"');
      var txt = o.om / o.total >= .5 ? 'O YouTube omitiu a origem de ' + pctDito(t.pc[t.ks.length], o.om) + ' das views' : '<b>' + pctDito(ord[0].pc, ord[0].v) + '</b> ' + ORIG[ord[0].k].de + ', <b>' + pctDito(ord[1].pc, ord[1].v) + '</b> ' + ORIG[ord[1].k].de;
      return '<span class="vl">' + txt + '</span>' + mini + '<small class="ov-m-s">' + (C.cO.ok < C.cO.total ? 'medido em ' + C.cO.ok + ' de ' + C.cO.total + ' dias' : 'medido nos ' + C.cO.total + ' dias') + '</small>';
    }
    function valTermos(){
      if (!ver || eT === 'bloq') return bl(estado === 'leitura' ? 'Só quem edita o site vê.' : 'Só quem edita o site vê.');
      if (estado === 'erro') return er(); if (estado === 'carregando') return ca();
      if (estado === 'vazio') return '<span class="ov-vz-m">' + gl('relogio') + '<span>Ainda não existe</span></span>';
      if (estado === 'nao-medido') return '<span class="ov-nm-m">' + A.nmSw() + '<span>Não coletada: o relatório do YouTube ainda não chegou</span></span>';
      if (zm && C.orig.total === 0 && C.orig.om === 0) return z0('Zero medido: nenhuma view veio da pesquisa');
      if (!C.termos.itens.length) return '<span class="ov-om-m">' + gl('om') + '<span>Nenhum termo apareceu: o YouTube omite os de poucas views</span></span>';
      return '<span class="vl">“' + esc(C.termos.itens[0].t) + '”<small>a busca que mais trouxe gente, ' + pl(C.termos.itens[0].v, 'view', 'views') + '</small></span>';
    }
    function valSimples(bloco, fn){
      if (!ver) return bl('Dado do dono do canal. Você não vê.');
      if (estado === 'erro') return er(); if (estado === 'carregando') return ca();
      if (eO === 'vazio') return '<span class="ov-vz-m">' + gl('relogio') + '<span>Ainda não existe</span></span>';
      if (eO === 'nm') return '<span class="ov-nm-m">' + A.nmSw() + '<span>Não medido: a coleta começa em ' + A.dm(COL) + '</span></span>';
      if (eO === 'zero') return '<span class="ov-zero-m"><b class="num">0</b><span>Zero medido</span></span>';
      return fn();
    }
    var ap = C.apar, ins = C.insc, pa = C.pais;
    var rows = linha('De onde vêm as views', 'tipos de origem, dias medidos', valOrigem()) + linha('Termos de pesquisa', 'só para quem edita', valTermos()) +
      linha('Aparelho', 'dias medidos', valSimples('ap', function(){ var vs = D.APAR.map(function(x){ return ap.v[x.k] || 0; }).concat([ap.om]), pc = D.pcts(vs); return '<span class="vl"><b>' + pctDito(pc[0], vs[0]) + '</b> em celular' + (ap.om / ap.total >= .5 ? '. O YouTube omitiu ' + pctDito(pc[5], ap.om) : '') + '</span>'; })) +
      linha('País', 'dias medidos', valSimples('pa', function(){ var ks = pa.nomes.map(function(x){ return x[0]; }).concat(['OUTROS', 'ZZ']), vs = ks.map(function(k){ return pa.v[k] || 0; }).concat([pa.om]), pc = D.pcts(vs); return '<span class="vl"><b>' + pctDito(pc[0], vs[0]) + '</b> do Brasil' + (pa.om / pa.total >= .5 ? '. O YouTube omitiu ' + pctDito(pc[ks.length], pa.om) : '') + '</span>'; })) +
      linha('Inscritos e não inscritos', 'dias medidos', valSimples('in', function(){ var vs = [ins.v.sub || 0, ins.v.nsub || 0, ins.om], pc = D.pcts(vs); return '<span class="vl"><b>' + pctDito(pc[1], vs[1]) + '</b> de quem não é inscrito' + (ins.om / ins.total >= .5 ? '. O YouTube omitiu ' + pctDito(pc[2], ins.om) : '') + '</span>'; }));
    var lead = ver ? 'Impressões, taxa de clique, origem das views e termos de pesquisa só chegam ao dono do canal. Leo Khev não tem esses números aqui porque o YouTube não os entrega, <b>não porque sejam zero</b>.' : 'Estes números só chegam ao dono do canal e a quem ele deu o direito de ver o desempenho privado. <b>Você não vê os valores</b>; o que cada linha mede continua descrito.';
    return A.migalha([['Canais', '#'], ['Comparar']]) + '<section class="so" aria-labelledby="hSo"><h2 id="hSo">Só o seu canal mede ' + A.ibtn('infoSo', 'De onde vêm estes números', true) + '</h2><p class="lead">' + lead + '</p><ul class="linhas">' + (ver ? antigas : '') + rows + '</ul></section>' +
      A.oculto('infoSo', 'De onde vêm estes números', '<ul><li><b>Impressões, cliques e % assistido:</b> como já era.</li><li><b>Origem, aparelho, país e inscritos:</b> views por dia do YouTube Analytics do seu canal, só nos dias medidos (' + (nmd ? 'a coleta começa em ' : 'a coleta começou em ') + A.dmy(COL) + ', exemplo).</li><li><b>Termos de pesquisa:</b> relatório do YouTube sobre pesquisa, só para quem edita o site.</li></ul>');
  }

  /* ------------------------------------------------------------ montagem da tela */
  var BLOCOS = ['origem das views', 'impressões por origem', 'termos de pesquisa', 'sites de fora', 'aparelho', 'país', 'inscritos'];
  function oQueFalta(){
    return '<section class="sec ov-sec ov-falta" aria-labelledby="ovF"><h2 id="ovF">O que ainda não é medido</h2><ul class="ainda"><li><b>Curva de retenção:</b> ainda não é coletada.</li></ul></section>';
  }
  function corpo(){
    if (tela === 'cartao') return cartaoComparar();
    var grupo;
    if (estado === 'erro') grupo = seletor() + erro();
    else if (estado === 'leitura' && leit === 'so-total') grupo = (tela === 'canal' ? '' : soTotal()) + blocoOrigem().replace('<section', '<section') + '';
    else grupo = seletor() + blocoOrigem() + blocoTermos() + '<div class="ov-grade">' + cartaoAparelho() + cartaoPais() + cartaoInscritos() + '</div>';
    if (estado === 'leitura' && leit === 'so-total') grupo = (tela === 'canal' ? '' : soTotal()) + '<section class="sec ov-sec" aria-labelledby="ovB"><h2 id="ovB">Dado que você não vê</h2>' + bloqBloco('De onde vêm as views, o que pesquisaram, aparelho, país, inscritos e impressões por origem são do dono do canal.', 'São <b>' + BLOCOS.length + ' blocos</b> nesta página: ' + BLOCOS.slice(0, -1).join(', ') + ' e ' + BLOCOS[BLOCOS.length - 1] + '. O total acima continua à sua vista.') + '</section>';
    return cabecalho() + L.novo(grupo, 'novo', 'ov-novo') + oQueFalta();
  }

  /* referência fora da tela: a conta que fecha */
  function fora(){
    var o = C.orig, soma = D.ORIG.reduce(function(a, x){ return a + (o.v[x.k] || 0); }, 0);
    var lin = function(a, b){ return '<tr><th scope="row">' + a + '</th><td class="r num">' + b + '</td></tr>'; };
    var conta = estado === 'vazio' || estado === 'carregando' || estado === 'nao-medido' || estado === 'erro' ? '' : estado === 'revisao' ? '<h2 class="fora-h">A conta que fecha neste estado</h2><div class="tbw"><table class="tb"><caption>Origem das views (origem em revisão, ' + (tela === 'cartao' ? 'canal' : tela) + ', ' + n(C.per.dias) + ' dias' + ')</caption><tbody>' + lin('Views dos dias medidos (dia a dia)', n(o.total)) + lin('Soma das origens (exemplo)', n(o.total + 34)) + lin('Resultado', 'A soma passou do total em 34: em revisão, a divisão não aparece') + '</tbody></table></div>' : '<h2 class="fora-h">A conta que fecha neste estado</h2><div class="tbw"><table class="tb"><caption>Origem das views (' + estado + ', ' + (tela === 'cartao' ? 'canal' : tela) + ', ' + n(C.per.dias) + ' dias' + ')</caption><tbody>' +
      lin('Período', A.dmy(C.per.de) + ' a ' + A.dmy(C.per.ate) + ' (' + n(C.per.dias) + ' dias)') + lin('Dias com origem medida', C.cO.ok + ' (desde ' + A.dmy(D.COLETA) + ')') + lin('Views do período todo', n(C.totalPeriodo)) + lin('Views dos dias medidos', n(o.total)) +
      lin('Soma das origens', n(soma)) + lin('Omitido pelo YouTube', n(o.om)) + lin('Soma + omitido', n(soma + o.om) + (soma + o.om === o.total ? ' (fecha)' : ' (NÃO fecha)')) + '</tbody></table></div>' +
      '';
    return conta + '<h2 class="fora-h">Cor, símbolo e textura por origem (estáveis em toda tela)</h2><ul class="ov-lg ov-ref">' + D.ORIG.map(function(x){ return '<li class="ov-r"><span class="ov-sw o-' + x.k + '">' + gl(x.k) + '</span><span class="ov-n">' + x.n + '</span></li>'; }).join('') + '<li class="ov-r om"><span class="ov-sw om">' + gl('om') + '</span><span class="ov-n">Omitido pelo YouTube (quantidade conhecida, nunca repartida)</span></li></ul>' +
      '<h2 class="fora-h">Os cinco “vazios” são cinco formas</h2><ul class="ov-lg ov-ref"><li class="ov-r"><span class="ov-zero ovmn"><b class="num">0</b></span><span class="ov-n">Zero medido: o YouTube mandou o dia e deu 0</span></li><li class="ov-r"><span class="nm-h big" aria-hidden="true"></span><span class="ov-n">Não medido: o dado não chegou, com motivo e data</span></li><li class="ov-r"><span class="ov-sw om">' + gl('om') + '</span><span class="ov-n">Omitido: o YouTube contou e não disse onde</span></li><li class="ov-r"><span class="ov-vzs">' + gl('relogio') + '</span><span class="ov-n">Ainda não existe: contorno pontilhado</span></li><li class="ov-r"><span class="ov-bqs">' + gl('lock') + '</span><span class="ov-n">Dado que você não vê: cadeado</span></li></ul>';
  }

  /* ------------------------------------------------------------ barra "Estados do mockup" */
  function hrefEstado(k){ var m = { estado: k === 'tipico' ? null : k, periodo: null, leitura: null }; if (k === 'extremo' || k === 'magro' || k === 'carregando') m.tela = 'canal'; if (k === 'zero' || k === 'vazio') m.tela = 'video'; return A.href(m); }
  var barra = { linhas: [
    { rotulo: 'Estado', itens: ESTADOS.map(function(e){ return { t: e[1], href: hrefEstado(e[0]), atual: estado === e[0] }; }) },
    { rotulo: 'Tela', itens: [['video', 'Página do vídeo'], ['canal', 'Página do canal'], ['cartao', 'Cartão da comparação']].filter(function(x){ return x[0] === 'cartao' || ((estado === 'extremo' || estado === 'magro' || estado === 'carregando') ? x[0] === 'canal' : (estado === 'zero' || estado === 'vazio') ? x[0] === 'video' : true); }).map(function(x){ return { t: x[1], href: A.href({ tela: x[0] === 'video' ? null : x[0] }), atual: tela === x[0] }; }) },
  ].concat(estado === 'leitura' ? [{ rotulo: 'Quem lê', itens: [['sem-termos', 'Sem editar: vê o total e os detalhes, não vê termos nem sites'], ['so-total', 'Sem o direito de ver desempenho privado: vê só o total']].map(function(x){ return { t: x[1], href: A.href({ leitura: x[0] === 'sem-termos' ? null : x[0] }), atual: leit === x[0] }; }) }] : []).concat([A.tema()]),
    nota: 'Todo número, termo, site e país é <b>exemplo</b>. Datas supostas: hoje 13/10/2026; último dia entregue 11/10; a coleta de origem, aparelho, país e inscritos começa em 04/10; termos, sites e impressões por origem valem desde 08/09. No estado Não medido a coleta e o relatório só começam em 14/10, então nenhum dia está medido. Dado extremo, magro e carregando mostram a página do canal; zero medido e sem dado, a do vídeo; por isso a linha Tela só lista o que vale para o estado escolhido.' };

  A.moldura({ titulo: 'Origem das views', barra: barra, corpo: corpo(), fora: fora() });
  document.querySelectorAll('body > .pop').forEach(function(x){ x.remove(); });
  A.ligarInfos();

  var pes = document.querySelectorAll('a.ov-pe'); for (var i = 0; i < pes.length; i++) pes[i].addEventListener('click', function(e){ gravar(e.currentTarget.getAttribute('data-p') === '7' ? null : e.currentTarget.getAttribute('data-p')); });
  var volta = document.getElementById('ovVolta'); if (volta) volta.addEventListener('click', function(){ gravar(null); location.href = A.href({ periodo: '7' }); });
  var tenta = document.getElementById('ovTenta'); if (tenta) tenta.addEventListener('click', function(){ document.getElementById('ovTentaMsg').textContent = 'Tentando de novo… (no mockup a leitura continua falhando)'; });
})();

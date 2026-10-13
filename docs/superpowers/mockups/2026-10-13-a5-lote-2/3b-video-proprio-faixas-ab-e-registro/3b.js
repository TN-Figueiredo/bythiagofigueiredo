/* 3b.js: a tela do VÍDEO próprio com as duas peças novas da E18 (faixa "em teste A/B" e faixa "antes do início do registro").
   Parâmetros: ?caso=tipico|hoje|extremo|semnumero|zero|so-reconstruido|so-teste|vazio|erro|leitura   ?novo=nao (esconde as marcas "+ novo")   ?tema=claro
   Tudo é exemplo inventado (3b-dados.js). Os blocos que não mudam em relação ao mockup 3 (% assistido, retenção, "este vídeo no canal") ficam fora do desenho.
   Prefixo das peças novas: vb-. */
(function(){
  'use strict';
  var A = window.A4, L = window.L1, D = window.B3D, esc = A.esc, q = A.q;
  var caso = q.get('caso') || 'tipico', M = D.mundo(caso), leitor = M.leitor === 'leitura', semNovo = q.get('novo') === 'nao';
  var CASOS = [['tipico', 'Com dado típico'], ['extremo', 'Com dado extremo'], ['hoje', 'Dado de hoje (poucas impressões)'], ['zero', 'Zero medido'], ['semnumero', 'Não medido, sem antes, sem dias para comparar'],
    ['so-teste', 'Só teste A/B'], ['so-reconstruido', 'Só versões reconstruídas'], ['vazio', 'Sem troca'], ['erro', 'Erro na leitura das trocas'], ['leitura', 'Só leitura (sem o número privado)']];
  var trocas = M.trocas, testes = M.testes, hoje = M.hoje, REG = D.REG;
  var LE = trocas.map(function(t, k){ return D.leitura(M, k); });
  var NOME = function(t){ return t.tipo === 't' ? 'título' : 'thumbnail'; };
  var DM = A.dm, DMY = A.dmy;
  var plural = function(n, um, varios){ return n + ' ' + (n === 1 ? um : varios); };
  function svg(c){ return '<svg class="i" viewBox="0 0 16 16" aria-hidden="true">' + c + '</svg>'; }
  var IC = {
    troca: svg('<path d="M2 5h10M9 2l3 3-3 3M14 11H4M7 8l-3 3 3 3"/>'),
    fora: svg('<path d="M9 2.5H3.5v10H13V7"/><path d="M8 8l6-6M10 2h4v4"/>'),
    interr: svg('<circle cx="8" cy="8" r="6"/><path d="M6.2 6.4a1.9 1.9 0 1 1 2.7 1.7c-.6.3-.9.7-.9 1.3M8 11.6v.1"/>'),
    corte: svg('<path d="M3 2v12"/><path d="M13 8H6M8.5 5.5 6 8l2.5 2.5"/>'),
    sem: '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.6" stroke-dasharray="1.8 2.2"/></svg>',
    cad: svg('<rect x="3.2" y="7" width="9.6" height="6.4" rx="1.4"/><path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7"/>')
  };
  var PEQ = A.fantasmas;
  /* fora do ar: cabeçalho de "+ novo" dos blocos que a proposta acrescenta */
  function novo(html, texto, cls){ return semNovo ? html : '<div class="c2-novo ' + (cls || '') + '"><span class="c2-tag">+ ' + esc(texto || 'novo') + '</span>' + html + '</div>'; }
  var nvTag = semNovo ? '' : '<span class="vb-nv">+ novo</span>';

  /* ------------------------------------------------------------ rótulos da leitura (um rótulo por estado, usados no chip, no resumo e na legenda) */
  var CURTO = { sobe: 'taxa subiu', cai: 'taxa caiu', igual: 'sem diferença firme', poucas: 'ainda não dá para dizer', nm: 'depois ainda não medido', sem: 'sem antes', cortada: 'sem dias para comparar', semorigem: 'origem não sabida' };
  var CHIP = { sobe: ['up', '▲ taxa subiu'], cai: ['dn', '▼ taxa caiu'], igual: ['sep', '≈ sem diferença firme'], poucas: ['poucas', '… ainda não dá para dizer'], nm: ['nmc', '? depois ainda não medido'],
    sem: ['sem', IC.sem + 'sem antes'], cortada: ['cort', IC.corte + 'sem dias para comparar'], semorigem: ['sorig', IC.interr + 'origem não sabida'] };
  function chipDe(k, le){ var c = CHIP[k]; if (leitor && k !== 'semorigem') return ''; /* r3/B1: quem só lê não vê veredito de taxa nem de impressões; a origem é pública */ return '<span class="tr-dv ' + c[0] + '">' + (k === 'nm' && le && le.a.st === 'nm' && le.d.st !== 'nm' ? '? antes ainda não medido' : c[1]) + '</span>'; }

  /* ------------------------------------------------------------ cabeçalho */
  function cabecalho(){
    var v = Object.assign({}, M.video); v.views = v.views >= 1000 ? A.mil(v.views) : String(v.views); v.likes = A.n(v.likes); v.com = A.n(v.com); /* r4/S2 */ /* r3/C3: como no vídeo aprovado (482 mil, não 482310) */
    var html = L.videoCab(v), ult = null; trocas.forEach(function(t){ if (t.tipo === 'm' && t.depois && t.depois.tom != null) ult = t; });
    /* r6/S2: a miniatura do cabeçalho é a do "depois" da última troca de thumbnail (o que está no ar agora), não um placeholder à parte */
    return ult ? html.replace(/<span class="th" style="[^"]*"><\/span>/, '<span class="th">' + capa(ult.depois.tom, 'Thumbnail no ar agora (depois da troca ' + ult.n + ')') + '</span>') : html;
  }
  /* r8/N3: com falha de leitura a frase do topo carrega o aviso (símbolo + texto), com as datas de M.registro; o aviso completo fica no bloco abaixo */
  function avisoFalha(){
    if (M.registro.ok !== false) return '';
    return '<span class="vb-rs-av"><span class="vb-rsy" aria-hidden="true">' + L.IC.aviso + '</span>A leitura de ' + DM(M.registro.falhaDe) + ' e a de ' + DM(hoje) + ' falharam' + (trocas.length ? ': pode haver troca nova' : '') + ' (aviso abaixo).</span>';
  }
  function resumoTrocas(){
    var falha = M.registro.ok === false;
    if (falha && !trocas.length) return '<p class="tr-res"><span class="ex">exemplo</span><span class="tr-res-t"><b>Trocas deste vídeo:</b> não foi possível atualizar. ' + avisoFalha() + '</span></p>';
    if (!trocas.length && !testes.length) {
      /* r7/N2: sem troca e sem teste a frase-resumo continua no topo; com faixa reconstruída ela avisa que o teste antigo está mais abaixo */
      var pre = M.pre ? '; um teste A/B ' + M.pre.teste.replace(/\/\d{4}$/, '') + ' foi reconstruído (mais abaixo)' : '';
      return '<p class="tr-res"><span class="ex">exemplo</span><span class="tr-res-t"><b>Trocas deste vídeo:</b> nenhuma desde ' + DM(REG) + esc(pre) + '.</span></p>';
    }
    var its = trocas.map(function(t, i){ return NOME(t) + ' (' + t.n + ') em ' + DM(t.d) + (leitor && LE[i].k !== 'semorigem' ? '' : ', ' + CURTO[LE[i].k]); }); /* r3/B1 */
    var te = testes.map(function(x){ return 'teste A/B ' + (x.ate ? 'de ' + DM(x.de) + ' a ' + DM(x.ate) : 'desde ' + DM(x.de) + ', em andamento'); });
    var txt = [].concat(its, te).join('; ');
    if (trocas.length > 3) {
      /* r2/C2: com mais de 3 itens a linha vira contagem e símbolos; o detalhe fica no bloco abaixo */
      var SIM = { sobe: '▲', cai: '▼', igual: '≈', poucas: '…', nm: '?', sem: IC.sem, cortada: IC.corte, semorigem: IC.interr }, RT = { sobe: 'taxa subiu', cai: 'taxa caiu', igual: 'sem diferença firme', poucas: 'ainda não dá para dizer', nm: 'depois ainda não medido', sem: 'sem antes', cortada: 'sem dias para comparar', semorigem: 'origem não sabida' };
      var cont = {}; LE.forEach(function(l){ cont[l.k] = (cont[l.k] || 0) + 1; });
      var ks = ['sobe', 'cai', 'igual', 'poucas', 'nm', 'sem', 'cortada', 'semorigem'].filter(function(k){ return cont[k]; }), parts = ks.map(function(k, i2){ return '<span class="vb-rs"><span class="vb-rsy" aria-hidden="true">' + SIM[k] + '</span>' + cont[k] + ' ' + RT[k] + '' + '</span>'; });
      return '<p class="tr-res"><span class="ex">exemplo</span><span class="tr-res-t"><b>' + plural(trocas.length, 'troca', 'trocas') + (testes.length ? ' e ' + plural(testes.length, 'teste A/B', 'testes A/B') : '') + '</b> desde ' + DM(REG) + (leitor ? '.' : ': ' + parts.join(' ') + '.') + (falha ? ' ' + avisoFalha() : '') + '</span><a class="lk tr-res-lk" href="#trocas">Ver antes e depois</a></p>';
    }
    return '<p class="tr-res"><span class="ex">exemplo</span><span class="tr-res-t"><b>Trocas deste vídeo' + (falha ? ' até ' + DM(M.registro.ultima) : '') + ':</b> ' + esc(txt) + '.' + (falha ? ' ' + avisoFalha() : '') + '</span>' + (trocas.length ? '<a class="lk tr-res-lk" href="#trocas">Ver antes e depois</a>' : '') + '</p>'; /* r4/S5: sem troca não há antes e depois para ver */
  }

  /* ------------------------------------------------------------ seções dos gráficos */
  function faixasGrafico(){
    var f = testes.map(function(x){
      return { k: 'ab', de: x.de, ate: x.ate, ciclos: x.ciclos, rot: 'em teste A/B' + (x.ate ? '' : ' (em andamento)'), rotCurto: 'teste A/B', fala: 'Neste dia o vídeo estava em teste A/B: as trocas de ciclo não são marcadas aqui' };
    });
    if (M.janelaIni <= A.addDias(REG, -1)) f.push({ k: 'reg', ate: A.addDias(REG, -1), rot: 'antes do início do registro (' + DM(REG) + '): trocas não registradas', rotCurto: 'antes do registro', rotMin: 'antes do registro', /* r8/S4: dois nomes só, o longo (quando cabe) e o curto, igual em todo lugar */ fala: 'Este dia é anterior ao início do registro de trocas (' + DMY(REG) + '): o sistema não sabe se houve troca' });
    return f;
  }
  function resumoImp(S){ var r = { imp: 0, cl: 0, clI: 0, ge1: 0, com: 0, zero: 0, nm: 0 }; S.forEach(function(x){ if (x.e === 'com') { r.imp += x.v; r.cl += x.cl; r.clI += Math.round(x.cl); r.com++; if (x.cl >= 1) r.ge1++; } else r[x.e]++; });
    /* r4/B1: com número escrito em cada dia (1 clique ou mais), o total é a soma desses números; se todo dia tem menos de 1 (nenhum número escrito), o total é a soma exata arredondada e a frase diz "cerca de" */
    r.menos1 = r.ge1 === 0; r.clR = r.menos1 ? Math.round(r.cl) : r.clI; return r; }
  function marcas(){ return trocas.map(function(t){ return { d: t.d, tipo: t.tipo, n: t.n }; }); }
  function secViews(){ return '<section class="sec" aria-labelledby="hVw"><h2 id="hVw">Views por dia</h2><div id="gVw"></div></section>'; }
  function secImp(){
    if (leitor) return '<section class="sec" aria-labelledby="hIm"><h2 id="hIm">Impressões e cliques</h2><div class="vb-priv"><span class="vb-cad">' + IC.cad + '</span><div><p class="vb-priv-t"><b>Você não vê impressões nem cliques.</b></p><p class="vb-priv-s">Esses números são privados do canal e só aparecem para quem administra. Você vê o que é público: views, títulos, thumbnails e as trocas.</p></div></div></section>';
    return '<section class="sec" aria-labelledby="hIm"><h2 id="hIm">Impressões e cliques</h2><div id="gIm"></div></section>';
  }
  /* r5/B1: UMA frase para o dia não medido, nos dois gráficos. "ainda" só para o dia que o YouTube vai entregar (depois do último fechado); para os de antes, "não entregou". */
  /* r6/S3: a legenda desenha o dia da publicação (▾); a fala do dia também o diz */
  function diaPub(d){ return d.d === M.video.pub ? '. Dia da publicação do vídeo' : ''; }
  function falaNm(d){ return (d.d > M.ultFechado ? 'o YouTube ainda não entregou este dia' : 'o YouTube não entregou este dia') + ' (não medido)'; }
  function graficos(){
    var fx = faixasGrafico(), lab = function(S){ return A.dm(S[0].d) + ' a ' + A.dm(S[S.length - 1].d); };
    var vv = M.vistaViews, tot = vv.reduce(function(a, x){ return a + (x.v || 0); }, 0), dm = vv.filter(function(x){ return x.e !== 'nm'; }).length;
    var fraseV = tot ? '<b>' + A.n(tot) + (tot === 1 ? ' view' : ' views') + '</b> em ' + dm + ' dias medidos (' + (tot / dm < .1 ? 'menos de 0,1' : A.dec(tot / dm, tot / dm < 10 ? 1 : 0)) + ' por dia).' /* r8: 1 view em 26 dias não é "0,0 por dia" */ : '<b>Nenhuma view</b> nos ' + dm + ' dias medidos. É zero medido: o YouTube entregou os dias e ninguém viu.';
    var cfgBase = { legNm: 'não medido: o YouTube não entregou o dia', nvTag: nvTag, semTitulo: true, trocas: marcas(), bordaFinal: true, faixas: fx, legAb: 'em teste A/B: as trocas de ciclo não são contadas', legReg: 'antes do registro (' + DM(REG) + '): o sistema não registra trocas' };
    A.serieDia(document.getElementById('gVw'), Object.assign({}, cfgBase, { id: 'gvv', titulo: 'Views do vídeo, dia a dia', frase: fraseV, meta: 'de ' + lab(vv) + ' · ' + vv.length + ' dias · dia do YouTube', dias: vv, um: ['view', 'views'], pub: M.video.pub,
      legBarra: 'views do dia', legZero: 'zero medido: ninguém viu neste dia',
      fala: function(d){ return A.ds(d.d) + ': ' + (d.e === 'nm' ? falaNm(d) : d.v === 0 ? 'nenhuma view (zero medido)' : A.n(d.v) + (d.v === 1 ? ' view' : ' views')) + diaPub(d); },
      ajuda: ajudaGrafico() }));
    if (leitor) return;
    var S = M.vistaImp, ri = resumoImp(S);
    var fraseI = ri.imp ? '<b>' + A.n(ri.imp) + (ri.imp === 1 ? ' impressão' : ' impressões') + '</b> e ' + (ri.menos1 ? 'cerca de ' : '') + (ri.clR === 1 ? '1 clique estimado' : A.n(ri.clR) + ' cliques estimados') + ' em ' + S.length + ' dias: ' + ri.com + ' com impressão, ' + ri.zero + ' medidos em zero e ' + ri.nm + ' não ' + (ri.nm === 1 ? 'medido' : 'medidos') + '.'
      : '<b>Nenhuma impressão</b> nos ' + (ri.zero) + ' dias medidos. É zero medido: o YouTube entregou os dias e o vídeo não apareceu para ninguém.';
    A.serieDia(document.getElementById('gIm'), Object.assign({}, cfgBase, { id: 'gim', titulo: 'Impressões e cliques por dia', frase: fraseI, meta: 'de ' + lab(S) + ' · dia do YouTube', dias: S, um: ['impressão', 'impressões'], cliques: true, escalonar: true, folgaNum: 2, pub: M.video.pub,
      fala: function(d){ var cl = d.cl; return A.ds(d.d) + ': ' + (d.e === 'nm' ? falaNm(d) : d.e === 'zero' ? 'o YouTube enviou o dia sem impressões deste vídeo (zero medido)' : A.n(d.v) + (d.v === 1 ? ' impressão, ' : ' impressões, ') + (cl < 1 ? 'menos de 1 clique estimado' : Math.round(cl) === 1 ? '1 clique estimado' : A.n(Math.round(cl)) + ' cliques estimados')) + diaPub(d); },
      ajuda: ajudaGrafico(true) }));
  }
  /* r5/S2: posição do vídeo na lista derivada da idade (um vídeo a cada 5 dias em média, 35 no canal); só o mais novo é o 1 */
  function pager(){ var N = 35, pos = Math.min(N, 1 + Math.floor(A.dias(M.video.pub, M.hoje) / 5));
    return '<p class="pager">' + (pos > 1 ? '<a href="#" onclick="return false">' + A.L + ' Anterior</a>' : '<span class="d">' + A.L + ' Anterior</span>') + '<span>vídeo ' + pos + ' de ' + N + ', na ordem da lista: do mais novo ao mais antigo</span><a href="#" onclick="return false">Próximo ' + A.R + '</a></p>'; }
  function ajudaGrafico(imp){
    return '<p>Cada coluna é um dia do YouTube (fecha no horário do Pacífico), com 2 a 3 dias de atraso. <b>Caixa vazada</b>: o dia veio e não teve nada. <b>Hachura rosa</b>: o dia não veio; não é zero.</p>' +
      '<p><b>Colchete cheio com fundo suave:</b> o vídeo estava em teste A/B. Os dentes do colchete são os ciclos do teste. Cada ciclo troca o título ou a thumbnail, mas essas trocas não ganham losango nem triângulo: comparar ciclos é o trabalho do A/B Lab.</p>' +
      '<p><b>Números sobre as barras:</b> aparecem quando cabem; os dois gráficos têm a tabela e a leitura dia a dia.</p>' +
      '<p><b>Colchete pontilhado, sem fundo:</b> dias antes do início do registro de trocas (' + DMY(REG) + '). Gráfico sem marca nesses dias não quer dizer que não houve troca: o sistema não sabia olhar.</p>' +
      '<p><b>Losango</b>: troca de título. <b>Triângulo</b>: troca de thumbnail. O número é a ordem em “Trocas deste vídeo”.</p><p>Use os botões abaixo do gráfico para ler um dia de cada vez.</p>' +
      (imp ? '<p><b>Cliques estimados:</b> impressões do dia × taxa de clique do dia. O total da frase é a soma dos cliques de cada dia: os números aparecem sob as barras quando cabem; senão, leia dia a dia ou na tabela. Quando todo dia tem menos de 1 clique, o total é a soma exata arredondada (“cerca de”). Cálculo do Observatório sobre os dados do YouTube Analytics do seu canal; impressões e cliques não são públicos.</p>' : '');
  }

  /* ------------------------------------------------------------ antes × depois (cada lado tem a sua forma; uma forma só por estado, em toda a tela) */
  function capa(tom, rot){
    var fundo = tom ? ['#C2410C', '#F59E0B'] : ['#3B4A5C', '#566579'], id = 'cg' + tom + Math.round(Math.random() * 1e5);
    return '<span class="tr-img"><svg viewBox="0 0 160 90" role="img" aria-label="' + esc(rot) + '" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + fundo[0] + '"/><stop offset="1" stop-color="' + fundo[1] + '"/></linearGradient></defs><rect width="160" height="90" fill="url(#' + id + ')"/>' +
      (tom ? '<circle cx="112" cy="46" r="26" fill="#FDE7C8"/><circle cx="104" cy="42" r="3" fill="#7C2D12"/><circle cx="120" cy="42" r="3" fill="#7C2D12"/><path d="M103 54q9 8 18 0" stroke="#7C2D12" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="8" y="12" width="64" height="14" rx="3" fill="#FFF"/><rect x="8" y="30" width="48" height="14" rx="3" fill="#FFF"/>'
        : '<circle cx="118" cy="52" r="16" fill="#8794A5"/><rect x="10" y="62" width="70" height="6" rx="3" fill="#A6B2C2"/><rect x="10" y="72" width="44" height="6" rx="3" fill="#A6B2C2"/>') + '</svg></span>';
  }
  /* r6/B1: dia não medido dentro do intervalo é dito no rótulo: "6 dias medidos (10/10 a 16/10, sem 15/10)"; N sempre fecha com as datas */
  function semDias(r){ var n = (r.nm || []).map(DM); return n.length ? 'sem ' + (n.length > 1 ? n.slice(0, -1).join(', ') + ' e ' + n[n.length - 1] : n[0]) : ''; }
  function rotLado(nome, r, curto){
    if (r.st === 'nm') return nome + ': ainda sem dia medido';
    if (r.st === 'sem' || r.st === 'cortada') return nome + ': sem dias para comparar';
    var iv = (r.dias > 1 ? DM(r.de) + ' a ' + DM(r.ate) : DM(r.de)), sd = semDias(r), tem = !!sd;
    /* r7/S4: a forma curta mantém a contagem de dias ("7 dias, 22/10 a 28/10") */
    return nome + ': ' + (curto ? plural(r.dias, 'dia', 'dias') + (tem ? ' medidos' : '') + ', ' + iv + (tem ? ', ' + sd : '') : plural(r.dias, 'dia', 'dias') + (tem ? ' medidos' : '') + ' (' + iv + (tem ? ', ' + sd : '') + ')') + ', ' + A.n(r.imp) + (r.imp === 1 ? ' impressão' : ' impressões');
  }
  /* r6/B1: o rótulo completo (com "dias medidos" e "sem dd/mm") é mais longo; se não cabe na linha (~6,6 px por caractere), usa a forma curta (só as datas) */
  function rotFit(nome, r, larg){
    var t = rotLado(nome, r, false); if (t.length * 6.6 <= larg) return [t];
    t = rotLado(nome, r, true); if (t.length * 6.6 <= larg) return [t];
    /* r7/S4: último recurso são duas linhas ("Depois: 6 dias medidos (10/10 a 16/10, sem 15/10)" e "0 impressões"), nunca sem a contagem de dias */
    var m = rotLado(nome, r, false).match(/^(.*\)), ([\d.]+ impress(?:ões|ão))$/); return m ? [m[1], m[2]] : [t];
  }
  function causaSem(r){ return r.motivo === 'pub' ? 'o vídeo saiu logo antes da troca' : 'as impressões só existem desde ' + DM(D.REACH); }
  function textoCorte(r){
    var p = r.por, onde = r.lado === 'antes' ? 'antes' : 'depois'; if (!p) return 'sem dias para comparar';
    return p.tipo === 'ciclo' ? 'um teste A/B vem logo ' + onde : 'a troca (' + p.n + ') vem logo ' + onde;
  }
  function antesDepois(host, t, le, top, uid){
    var W = Math.max(280, Math.floor(host.clientWidth || 560)), Lm = 10, R = 10, s = '', y = 0, clamp = function(v, a, b){ return Math.max(a, Math.min(b, v)); };
    function X(f){ return Lm + (W - Lm - R) * (f * 100 / top); }
    function caixa(cls, txt, extra){ s += '<rect class="' + cls + '" x="' + Lm + '" y="' + (y + 2) + '" width="' + (W - Lm - R) + '" height="26" rx="3"' + (extra || '') + '/>'; }
    function linha(l, cls, nome){
      rotFit(nome, l, W - Lm - R).forEach(function(ln){ s += '<text class="ctr-lab" x="' + Lm + '" y="' + (y + 12) + '">' + esc(ln) + '</text>'; y += 16; }); y += 2;
      var cx0 = Lm + (W - Lm - R) / 2, w = W - Lm - R;
      if (l.st === 'nm') { caixa('ctr-nmbox', '', ' fill="url(#' + uid + 'nm)"'); s += '<text class="ctr-nmt" x="' + cx0 + '" y="' + (y + 19) + '" text-anchor="middle">não medido: ainda sem dia fechado</text>'; y += 38; return; }
      if (l.st === 'sem') { caixa('vb-sembox', ''); s += '<text class="ctr-lim" x="' + cx0 + '" y="' + (y + 19) + '" text-anchor="middle">' + esc(causaSem(l)) + '</text>'; y += 38; return; }
      if (l.st === 'cortada') {
        caixa('vb-cortebox', ''); var bx = l.lado === 'antes' ? Lm : Lm + w - 5; s += '<rect class="vb-corte" x="' + bx + '" y="' + (y + 2) + '" width="5" height="26"/><text class="ctr-lim" x="' + (cx0 + (l.lado === 'antes' ? 3 : -3)) + '" y="' + (y + 19) + '" text-anchor="middle">' + esc(textoCorte(l)) + '</text>'; y += 38; return;
      }
      if (l.st === 'zero') { caixa('ic-zero-box', ''); s += '<text class="vb-zn" x="' + (Lm + 14) + '" y="' + (y + 21) + '">0</text><text class="ctr-lim" x="' + (cx0 + 8) + '" y="' + (y + 19) + '" text-anchor="middle">zero medido: o vídeo não apareceu</text>'; y += 38; return; }
      if (l.st === 'pouca') { caixa('ctr-vazio', ''); s += '<text class="ctr-lim" x="' + cx0 + '" y="' + (y + 19) + '" text-anchor="middle">só ' + A.n(l.imp) + (l.imp === 1 ? ' impressão' : ' impressões') + ': sem faixa</text>'; y += 38; return; }
      var wl = A.wilson(l.cliques, l.imp), p = l.cliques / l.imp, x0 = X(wl[0]), x1 = Math.max(X(wl[1]), x0 + 3), cx = X(p);
      s += '<text class="ctr-num" x="' + clamp(cx, Lm + 18, W - R - 18) + '" y="' + (y + 11) + '" text-anchor="middle">' + A.pct(p, 1) + '</text>'; y += 16;
      s += '<rect class="ctr-int ' + cls + '" x="' + x0 + '" y="' + y + '" width="' + (x1 - x0) + '" height="22" rx="3"/><rect class="ctr-intb ' + cls + '" x="' + x0 + '" y="' + y + '" width="' + (x1 - x0) + '" height="22" rx="3"/><circle class="ctr-pt ' + cls + '" cx="' + cx + '" cy="' + (y + 11) + '" r="6"/>'; y += 22;
      s += x1 - x0 >= 84 ? '<text class="ctr-lim" x="' + x0 + '" y="' + (y + 14) + '" text-anchor="start">' + A.pct(wl[0], 1) + '</text><text class="ctr-lim" x="' + x1 + '" y="' + (y + 14) + '" text-anchor="end">' + A.pct(wl[1], 1) + '</text>'
        : '<text class="ctr-lim" x="' + clamp((x0 + x1) / 2, Lm + 40, W - R - 40) + '" y="' + (y + 14) + '" text-anchor="middle">' + A.pct(wl[0], 1) + ' a ' + A.pct(wl[1], 1) + '</text>';
      y += 22;
    }
    linha(le.a, 'ref', 'Antes'); y += 4; linha(le.d, '', 'Depois');
    var temFaixa = le.a.st === 'ok' || le.d.st === 'ok', yAx = y + 6;
    if (temFaixa) s = '<line class="ctr-fio" x1="' + Lm + '" x2="' + (W - R) + '" y1="' + yAx + '" y2="' + yAx + '"/>' + [0, top / 2, top].map(function(tt, i){ return '<line class="ctr-fio" x1="' + X(tt / 100) + '" x2="' + X(tt / 100) + '" y1="' + (yAx - 4) + '" y2="' + (yAx + 4) + '"/><text class="ctr-ax" x="' + X(tt / 100) + '" y="' + (yAx + 19) + '" text-anchor="' + (i === 0 ? 'start' : i === 2 ? 'end' : 'middle') + '">' + A.dec(tt, tt % 1 ? 1 : 0) + '%</text>'; }).join('') + s;
    var H = temFaixa ? yAx + 26 : y;
    s = '<defs><pattern id="' + uid + 'nm" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="ic-hb"/><line x1="0" y1="0" x2="0" y2="6" class="ic-hl"/></pattern></defs>' + s;
    var alt = 'Taxa de clique antes e depois da troca de ' + NOME(t) + ' em ' + DM(t.d) + ': ' + rotLado('antes', le.a) + '; ' + rotLado('depois', le.d) + '. Leitura: ' + CURTO[le.k] + '.';
    host.innerHTML = '<svg class="ctr-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(alt) + '">' + s + '</svg>';
    /* r3/S4: fundo sólido atrás do texto da caixa hachurada, para as listras não atravessarem as letras */
    [].forEach.call(host.querySelectorAll('.ctr-nmt'), function(tx){ var b = tx.getBBox(), r = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); r.setAttribute('class', 'vb-nmfundo'); r.setAttribute('x', b.x - 6); r.setAttribute('y', b.y - 2); r.setAttribute('width', b.width + 12); r.setAttribute('height', b.height + 4); r.setAttribute('rx', 3); tx.parentNode.insertBefore(r, tx); });
    if (!host._ro && window.ResizeObserver) { host._ro = 1; var ult = host.clientWidth; new ResizeObserver(function(){ if (Math.abs(host.clientWidth - ult) > 2) { ult = host.clientWidth; antesDepois(host, t, le, top, uid); } }).observe(host); }
  }

  /* ------------------------------------------------------------ texto de cada leitura */
  function fraseLeitura(t, le){
    var a = le.a, d = le.d, k = le.k, x = le.vr, p = function(r){ return A.pct(r.cliques / r.imp, 1); };
    if (k === 'semorigem') return '<b>Sem comparação.</b> O sistema não conseguiu ler o A/B Lab neste dia, então não sabe se a troca foi sua ou de um ciclo de teste. Comparar ciclos é do A/B Lab.';
    if (k === 'nm') return '<b>Ainda não dá para comparar.</b> ' + (d.st === 'nm' ? 'O primeiro dia depois da troca (' + DM(d.dia1) + ') só chega do YouTube em ' + DM(d.primeiro) + '. Leitura completa em ' + DM(d.cheia) + '.' : 'Os dias antes da troca ainda não foram entregues.');
    if (k === 'sem') return '<b>Sem antes para comparar.</b> ' + (a.motivo === 'pub' ? 'O vídeo foi publicado em ' + DM(M.video.pub) + ', ' + plural(A.dias(M.video.pub, t.d), 'dia', 'dias') + ' antes da troca.' : 'As impressões por dia só existem desde ' + DMY(D.REACH) + '.') + (d.st === 'cortada' ? ' O depois também ficou sem dias.' : '');
    if (k === 'cortada') {
      /* r3/C2: cada lado cortado diz por quê, sem "cortado" e sem "nenhum dia inteiro"; dois lados cortados viram uma frase só */
      var dist = function(c){ return Math.abs(A.dias(t.d, c.por.d)); };
      var desc = function(c){
        if (c.por.tipo === 'ciclo') return c.lado === 'antes' ? 'antes desta troca o vídeo estava em teste A/B (o último ciclo começou em ' + DM(c.por.d) + ')' : 'um ciclo de teste A/B começa em ' + DM(c.por.d) + ', ' + plural(dist(c), 'dia', 'dias') + ' depois desta';
        return 'a troca (' + c.por.n + ') vem ' + plural(dist(c), 'dia', 'dias') + ' ' + (c.lado === 'antes' ? 'antes' : 'depois') + ' desta';
      };
      var cs = [a, d].filter(function(r){ return r.st === 'cortada'; }), cap = function(x){ return x.charAt(0).toUpperCase() + x.slice(1); }, temCiclo = cs.some(function(c){ return c.por.tipo === 'ciclo'; }), soTroca = cs.every(function(c){ return c.por.tipo !== 'ciclo'; });
      var corpo = cs.length === 2
        ? (soTroca ? cap('a troca (' + a.por.n + ') vem ' + plural(dist(a), 'dia', 'dias') + ' antes desta e a troca (' + d.por.n + '), ' + plural(dist(d), 'dia', 'dias') + ' depois') + ': não sobra dia inteiro para nenhum dos lados.' : cap(desc(a)) + ' e ' + desc(d) + ': não sobra dia para nenhum dos lados.')
        : cap(desc(cs[0])) + (cs[0].por.tipo === 'ciclo' ? '.' : ': não sobra dia inteiro desse lado.');
      return '<b>Sem dias para comparar.</b> ' + corpo + (temCiclo ? ' Comparar ciclos é do A/B Lab.' : '');
    }
    if (k === 'poucas') return '<b>Ainda não dá para dizer.</b> ' + (a.st === 'zero' && d.st === 'zero' ? 'Nos dias medidos o vídeo teve 0 impressões antes e 0 depois: o YouTube entregou os dias e ele não apareceu para ninguém.' : 'São ' + A.n(a.imp) + (a.imp === 1 ? ' impressão' : ' impressões') + ' antes e ' + A.n(d.imp) + ' depois: com menos de ' + A.MIN_IMP + ' de um lado, qualquer taxa seria chute.');
    if (k === 'igual') return 'De ' + p(a) + ' para ' + p(d) + ', mas as faixas se cruzam: a diferença pode ser só acaso.';
    return '<b>' + (k === 'sobe' ? 'Subiu' : 'Caiu') + '</b> de ' + p(a) + ' para ' + p(d) + '. As faixas ' + (x.gap < .004 ? 'quase se tocam: a diferença é pequena.' : 'não se cruzam.');
  }
  var ORIGEM = {
    fora: { ic: IC.fora, t: 'Fora do A/B Lab', d: 'feita no Studio ou por outra ferramenta; o sistema não sabe qual' },
    vencedor: { ic: IC.troca, t: 'Vencedor do teste A/B', d: null },
    restauro: { ic: IC.troca, t: 'Teste parado, o original voltou', d: null },
    desconhecida: { ic: IC.interr, t: 'Origem não sabida', d: 'o sistema não conseguiu ler o A/B Lab neste dia e não afirma de onde veio' }
  };
  function linkTeste(te, curto){ return leitor ? '<span class="vb-sem-acesso">' + IC.cad + 'sem acesso ao A/B Lab</span>' : '<a class="lk vb-lk" href="#" onclick="return false">' + (curto || 'Ver o teste no A/B Lab') + '</a>'; }
  function origemLinha(t){
    var o = ORIGEM[t.origem], te = testes.filter(function(x){ return x.id === t.teste; })[0], det = o.d;
    if (t.origem === 'vencedor') det = 'aplicado em ' + DM(t.d) + ', no fim do teste de ' + DM(te.de) + ' a ' + DM(te.ate);
    if (t.origem === 'restauro') det = 'o teste de ' + DM(te.de) + ' foi parado em ' + DM(t.d) + ' e o título de antes voltou';
    return '<p class="vb-or"><span class="vb-orc">' + o.ic + o.t + '</span>' + nvTag + '<span class="vb-ord">' + esc(det) + '</span>' + (te ? linkTeste(te, 'Ver o teste') : '') + '</p>';
  }

  /* ------------------------------------------------------------ régua das versões: linha do tempo de 07/10 até hoje com testes e trocas */
  function linhaVersoes(host){
    var W = Math.max(280, Math.floor(host.clientWidth || 600)), Lm = 12, R = 12, n = A.dias(REG, hoje) + 1, cw = (W - Lm - R) / n, X = function(d){ return Lm + cw * (A.dias(REG, d) + .5); };
    var rows = [], fim = []; trocas.forEach(function(t){ var x = X(t.d), r = 0; while (fim[r] != null && x - fim[r] < 27) r++; fim[r] = x; rows.push(r); });
    var nr = rows.length ? Math.max.apply(null, rows) + 1 : 0, temTeste = testes.length, yBr = 4, yM0 = (temTeste ? 34 : 14) + 14, yAx = yM0 + (Math.max(nr, 1) - 1) * 28 + 22, H = yAx + 34, s = '';
    /* testes: fundo suave e colchete (mesma forma do gráfico) */
    testes.forEach(function(te){
      var d0 = te.de < REG ? REG : te.de, corta = te.de < REG, d1 = te.ate && te.ate < hoje ? te.ate : hoje, aberta = !te.ate, x0 = Lm + cw * A.dias(REG, d0), x1 = Lm + cw * (A.dias(REG, d1) + 1);
      s += '<rect class="ic-abf" x="' + x0 + '" y="' + (yBr + 17) + '" width="' + (x1 - x0) + '" height="' + (yAx - yBr - 17) + '"/>';
      s += '<path class="ic-abk' + (corta ? ' sem-cap' : '') + '" d="M' + x0 + ' ' + (yBr + 23) + 'V' + (yBr + 17) + 'H' + x1 + (aberta ? '' : 'V' + (yBr + 23)) + '"/>';
      (te.ciclos || []).forEach(function(c){ if (c > d0 && c <= d1) s += '<line class="ic-abt" x1="' + (Lm + cw * A.dias(REG, c)) + '" x2="' + (Lm + cw * A.dias(REG, c)) + '" y1="' + (yBr + 17) + '" y2="' + (yBr + 24) + '"/>'; });
      if (aberta) s += '<path class="ic-abk seta" d="M' + (x1 - 5) + ' ' + (yBr + 13) + 'L' + (x1 + 1) + ' ' + (yBr + 17) + 'L' + (x1 - 5) + ' ' + (yBr + 21) + '"/>';
      s += '<path class="ic-abi" d="M' + (x0 + 3) + ' ' + (yBr + 5) + 'h9m-3-3 3 3-3 3M' + (x0 + 14) + ' ' + (yBr + 11) + 'h-9m3-3-3 3 3 3"/>';
      var rot = 'teste A/B' + (corta ? ' (começou em ' + DM(te.de) + ')' : ''), curto = 'teste A/B', lg = x1 - x0 - 24; s += '<text class="ic-bkl" x="' + (x0 + 21) + '" y="' + (yBr + 12) + '">' + (lg >= rot.length * 6.4 ? rot : lg >= curto.length * 6.4 ? curto : '') + '</text>';
    });
    s += '<line class="vb-eixo" x1="' + Lm + '" x2="' + (W - R) + '" y1="' + yAx + '" y2="' + yAx + '"/>';
    s += '<line class="vb-eixo" x1="' + Lm + '" x2="' + Lm + '" y1="' + (yAx - 6) + '" y2="' + (yAx + 6) + '"/><line class="vb-eixo" x1="' + (W - R) + '" x2="' + (W - R) + '" y1="' + (yAx - 6) + '" y2="' + (yAx + 6) + '"/>';
    s += '<text class="ic-ax" x="' + Lm + '" y="' + (yAx + 22) + '" text-anchor="start">' + DM(REG) + ' início do registro</text><text class="ic-ax" x="' + (W - R) + '" y="' + (yAx + 22) + '" text-anchor="end">hoje, ' + DM(hoje) + '</text>';
    trocas.forEach(function(t, i){
      var x = X(t.d), cy = yM0 + rows[i] * 28, c = t.tipo === 't' ? 'ic-trt' : 'ic-trm';
      s += '<line class="ic-trl ' + c + '" x1="' + x + '" x2="' + x + '" y1="' + cy + '" y2="' + yAx + '"/><polygon class="ic-trp ' + c + '" points="' + (t.tipo === 't' ? [x, cy - 13, x + 13, cy, x, cy + 13, x - 13, cy].join(' ') : [x, cy - 12, x + 13, cy + 11, x - 13, cy + 11].join(' ')) + '"/><text class="ic-trn" x="' + x + '" y="' + (cy + (t.tipo === 't' ? 4 : 8)) + '" text-anchor="middle">' + t.n + '</text>';
    });
    var alt = 'Régua das versões, de ' + DM(REG) + ' a ' + DM(hoje) + ': ' + (testes.map(function(te){ return 'teste A/B ' + (te.ate ? 'de ' + DM(te.de) + ' a ' + DM(te.ate) : 'desde ' + DM(te.de) + ', em andamento'); }).concat(trocas.map(function(t){ return 'troca ' + t.n + ' de ' + NOME(t) + ' em ' + DM(t.d); })).join('; ')) + '.';
    host.innerHTML = '<svg class="vb-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(alt) + '">' + s + '</svg>';
    if (!host._ro && window.ResizeObserver) { host._ro = 1; var ult = host.clientWidth; new ResizeObserver(function(){ if (Math.abs(host.clientWidth - ult) > 2) { ult = host.clientWidth; linhaVersoes(host); } }).observe(host); }
  }

  /* ------------------------------------------------------------ faixa das versões reconstruídas (pre_registro) */
  function faixaPre(){
    if (!M.pre) return '';
    var itens = M.pre.itens.map(function(x){
      var q = x.quando ? DM(x.quando.slice(0, 10)) + ' às ' + x.quando.slice(11, 16) : 'antes do teste';
      return '<li class="vb-pi"><span class="vb-pm" aria-hidden="true"></span><span class="vb-pq num">' + esc(q) + '</span><span class="vb-pc">' + esc(x.ciclo) + '</span><span class="vb-pt">' + esc(x.titulo) + '</span></li>';
    }).join('');
    return novo('<section class="vb-pre" aria-labelledby="hPre"><h3 id="hPre" class="vb-pre-h">' + PEQ('vb-fan') + '<span class="vb-pre-tt">Antes do início do registro (' + DMY(REG) + '), reconstruído do A/B Lab' + A.ibtn('infoPre', 'O que é esta faixa', true) + '</span></h3>' +
      '<p class="vb-pre-s">Teste A/B ' + esc(M.pre.teste) + '. São títulos do passado: o que está no ar agora é o do cabeçalho.</p><ol class="vb-pl">' + itens + '</ol>' +
      '<p class="vb-pre-n"><span class="vb-nz">sem antes e depois</span><span class="vb-nz">a thumbnail original não dá para recuperar</span></p></section>' +
      A.oculto('infoPre', 'O que é esta faixa', '<ul><li><b>Reconstruído:</b> o sistema só passou a registrar títulos e thumbnails em ' + DMY(REG) + '. Para os vídeos que tiveram teste no A/B Lab antes disso, os títulos de cada ciclo foram refeitos a partir do que o A/B Lab guardou.</li><li><b>Sem antes e depois:</b> as impressões por dia só existem desde ' + DMY(D.REACH) + ', então não há como medir o que aconteceu naquelas semanas.</li><li><b>Nunca é a versão atual:</b> estas versões são do passado e não aparecem como o título ou a thumbnail em vigor.</li><li><b>O que falta:</b> a imagem original (o endereço guardado hoje mostra a imagem atual) e os ciclos que o A/B Lab não registrou por completo.</li></ul>'), 'novo', 'vb-novo-pre');
  }

  /* ------------------------------------------------------------ bloco "Trocas deste vídeo" */
  function secTrocas(){
    var contaK = {}; LE.forEach(function(l){ contaK[l.k] = (contaK[l.k] || 0) + 1; });
    var ordem = ['sobe', 'cai', 'igual', 'poucas', 'nm', 'sem', 'cortada', 'semorigem'];
    var nT = trocas.length, nA = testes.length;
    var frase;
    if (!nT && !nA) frase = '<b>0 trocas</b> registradas desde ' + DMY(REG) + ', quando o registro começou.';
    else if (!nT) frase = '<b>0 trocas</b> fora do A/B Lab desde ' + DMY(REG) + ' e <b>' + plural(nA, 'teste A/B', 'testes A/B') + '</b> em andamento, que não conta como troca.';
    else frase = '<b>' + plural(nT, 'troca', 'trocas') + '</b>' + (nA ? ' e <b>' + plural(nA, 'teste A/B', 'testes A/B') + '</b>' : '') + ' neste vídeo desde ' + DMY(REG) + (nA ? '. Os ciclos de teste não contam como troca.' : '.');
    var tally = nT && !leitor ? '<ul class="vb-tally" aria-label="Leitura das trocas">' + ordem.filter(function(k){ return contaK[k]; }).map(function(k){ return '<li>' + chipDe(k) + '<b class="num">' + contaK[k] + '</b></li>'; }).join('') + '</ul>' : '';
    if (leitor && nT) tally = '<ul class="vb-tally" aria-label="Leitura das trocas"><li><span class="tr-dv sorig">' + IC.cad + 'taxa de clique: só para quem administra</span></li></ul>';
    var topo = A.topoTaxa([].concat.apply([], LE.map(function(x){ return [{ cliques: x.a.cliques || 0, imp: x.a.imp }, { cliques: x.d.cliques || 0, imp: x.d.imp }]; })));
    /* erro */
    var err = '';
    if (M.registro.ok === false) err = '<div class="vb-erro" role="alert"><span class="vb-erro-i">' + L.IC.aviso + '</span><div><p class="vb-erro-t"><b>Não foi possível atualizar as trocas.</b> A leitura de ' + DM(M.registro.falhaDe) + ' e a de ' + DM(hoje) + ' falharam.</p><p class="vb-erro-s">As trocas até ' + DM(M.registro.ultima) + ' estão certas. Se você trocou algo depois disso, ainda não aparece aqui. O sistema tenta de novo amanhã às 09:00.</p></div></div>';
    /* itens, em ordem de data */
    var linhas = [];
    testes.forEach(function(te){ linhas.push({ d: te.de, h: 0, te: te }); });
    trocas.forEach(function(t, i){ linhas.push({ d: t.d, h: 1, t: t, i: i }); });
    linhas.sort(function(a, b){ return a.d < b.d ? -1 : a.d > b.d ? 1 : a.h - b.h; });
    var itens = linhas.map(function(x){
      if (x.te) { var te = x.te, nC = te.ciclos.length; return '<li class="vb-teste-li">' + novo('<div class="vb-teste"><div class="tr-cab"><span class="vb-tic">' + IC.troca + '</span><h3>Teste A/B</h3><span class="qd">' + (te.ate ? 'de ' + DM(te.de) + ' a ' + DM(te.ate) : 'desde ' + DM(te.de) + ', em andamento') + '</span><span class="vb-ciclos">' + plural(nC, 'ciclo', 'ciclos') + '</span></div>' +
        '<p class="vb-ts">As ' + (te.ate ? nC + ' trocas de ciclo' : 'trocas de ciclo') + ' não entram aqui. ' + (te.fim ? 'Resultado: ' + esc(te.fim) + '. ' : '') + linkTeste(te) + '</p></div>', 'teste A/B', 'vb-novo-te') + '</li>'; }
      var t = x.t, le = LE[x.i], k = le.k;
      var mud = t.tipo === 't' ? '<dl class="tr-mud"><dt>Antes</dt><dd class="vel">' + esc(t.antes) + '</dd><dt>Depois</dt><dd>' + esc(t.depois) + '</dd></dl>'
        : '<div class="tr-th"><figure>' + capa(t.antes.tom, 'Thumbnail antes da troca (imagem de exemplo)') + '<figcaption>antes</figcaption></figure><figure>' + capa(t.depois.tom, 'Thumbnail depois da troca (imagem de exemplo)') + '<figcaption>depois</figcaption></figure></div>';
      var taxa = k === 'semorigem' ? '' : leitor ? '<div class="vb-priv vb-priv-m"><span class="vb-cad">' + IC.cad + '</span><p class="vb-priv-s">Taxa de clique antes e depois: só para quem administra o canal.</p></div>'
        : '<div class="tr-taxa"><h4>Taxa de clique' + (k === 'sobe' || k === 'cai' || k === 'igual' ? ' <span class="qd" style="font-weight:400;color:var(--muted)">com intervalo de 95%</span>' : '') + '</h4><div id="trx' + t.n + '"></div></div>';
      var marca = '<span class="tr-mk ' + t.tipo + '" aria-hidden="true">' + t.n + '</span>';
      return '<li class="tr-it" id="troca' + t.n + '"><div class="tr-cab">' + marca + '<h3>Troca de ' + NOME(t) + '</h3><span class="qd">' + A.ds(t.d) + '</span>' + chipDe(k, le) + '</div>' + origemLinha(t) + mud + taxa +
        (leitor ? '' : '<p class="tr-v">' + fraseLeitura(t, le) + '</p>') + '</li>';
    }).join('');
    var vazia = !nT && !nA && !M.pre ? '' : '';
    var lista = (itens ? '<ol class="tr-lista">' + itens + '</ol>' : '');
    var divReg = M.pre ? '<p class="vb-divreg"><span>' + DMY(REG) + ': o registro começa</span></p>' : '';
    var zero = !nT ? '<p class="tr-vazia vb-vazia" id="vzero"><span class="tr-zero"><b class="num">0</b> trocas</span></p>' : '';
    var linha = (nT || nA) ? '<div class="vb-regua"><p class="vb-regua-t">O que esteve no ar desde ' + DMY(REG) + '</p><div id="vLinha"></div></div>' : '';
    return '<section class="sec tr" id="trocas" aria-labelledby="hTr"><h2 id="hTr">Trocas deste vídeo ' + A.ibtn('infoTr', 'Como ler antes e depois', true) + '</h2>' +
      '<p class="exband"><span class="ex">exemplo</span> ' + (M.futuro ? 'Todos os números e títulos desta tela são inventados, como ficaria mais de um mês depois do início do registro (hoje, ' + DM(hoje) + ').' : 'Todos os números e títulos desta tela são inventados; as datas seguem o dia de hoje (' + DM(hoje) + ').') + '</p>' +
      '<p class="fr"><span>' + frase + '</span></p>' + tally + err + (nT || nA ? novo(linha, 'régua das versões', 'vb-novo-rg') : '') + faixaPre() + divReg + zero + lista +
      A.oculto('infoTr', 'Como ler antes e depois', infoTr()) + '</section>';
  }
  function infoTr(){
    if (leitor) return '<ul><li><b>Início do registro:</b> o sistema só registra títulos e thumbnails desde ' + DMY(REG) + '. Antes dessa data ele não sabe se houve troca; por isso um gráfico sem marca ali não prova que não houve.</li>' +
      '<li><b>Quais trocas contam:</b> as feitas fora do A/B Lab, o vencedor de um teste e o original que volta quando um teste para. As trocas de ciclo de um teste A/B ficam de fora.</li>' +
      '<li><b>Origem não sabida:</b> o sistema não conseguiu ler o A/B Lab naquele dia. A troca aparece, mas sem afirmar de onde veio.</li>' +
      '<li><b>Fonte:</b> cálculo do Observatório sobre dados públicos do YouTube (títulos e thumbnails). Impressões, cliques e a comparação antes e depois são privados do canal e você não os vê.</li></ul>';
    return '<ul><li><b>Antes e depois:</b> até ' + A.JANELA + ' dias de cada lado da troca, parando na troca vizinha, de qualquer origem. Ficam de fora o dia anterior e o dia da troca (o sistema olha o vídeo uma vez por dia, às 09:00, e o dia do YouTube é do horário do Pacífico) e o dia da publicação (o pico de lançamento não é comparável com uma semana comum).</li>' +
      '<li><b>Início do registro:</b> o sistema só registra títulos e thumbnails desde ' + DMY(REG) + '. Antes dessa data ele não sabe se houve troca; por isso um gráfico sem marca ali não prova que não houve, e um “antes” que começa antes de ' + DM(REG) + ' pode misturar versões que o sistema não registrou.</li>' +
      '<li><b>Atraso:</b> o YouTube entrega as impressões com 2 a 3 dias de atraso. O primeiro dia depois da troca aparece cerca de 3 dias depois; a leitura completa, cerca de ' + (3 + A.JANELA - 1) + ' dias depois da troca.</li>' +
      '<li><b>Menos de ' + A.MIN_IMP + ' impressões num lado:</b> sem taxa e sem faixa, só “ainda não dá para dizer”.</li>' +
      '<li><b>Quais trocas contam:</b> as feitas fora do A/B Lab (Studio ou outra ferramenta; o sistema não sabe qual), o vencedor de um teste e o original que volta quando um teste para. As trocas de ciclo de um teste A/B ficam de fora: comparar ciclos é o trabalho do A/B Lab, com o método dele.</li>' +
      '<li><b>Origem não sabida:</b> o sistema não conseguiu ler o A/B Lab naquele dia. A troca aparece, mas sem comparação, porque pode ter sido um ciclo de teste.</li>' +
      '<li><b>Não é teste A/B:</b> as duas versões não ficaram no ar ao mesmo tempo, ninguém sorteou quem via qual e a troca pode ter sido feita porque o vídeo ia mal. A faixa mede só o acaso da amostra. Para saber a causa, use o A/B Lab.</li>' +
      '<li><b>Fonte:</b> cálculo do Observatório sobre os dados do YouTube Analytics do seu canal (impressões e cliques não são públicos). Os cliques são estimados: impressões × taxa do dia. O total é a soma dos cliques de cada dia: os números aparecem sob as barras quando cabem; senão, leia dia a dia ou na tabela. Quando todo dia tem menos de 1 clique, o total é a soma exata arredondada (“cerca de”).</li></ul>';
  }

  /* ------------------------------------------------------------ montagem */
  var hojeImp = (function(){ var H = D.mundo('hoje'); return { imp: H.vistaImp.reduce(function(a, x){ return a + (x.e === 'com' ? x.v : 0); }, 0), dias: H.vistaImp.length }; })();
  var barra = L.barra([{ rotulo: 'Estado', param: 'caso', itens: CASOS, padrao: 'tipico' }, { rotulo: 'Marcas “+ novo”', param: 'novo', itens: [['sim', 'Mostrar o que é novo'], ['nao', 'Esconder']], padrao: 'sim' }],
    '<b>Tudo é exemplo inventado.</b> “Dado de hoje” usa o fato real de que os dois canais somaram 158 impressões em 30 dias. Neste vídeo do estado “hoje”: ' + hojeImp.imp + ' impressões em ' + hojeImp.dias + ' dias. Quase toda troca dá “ainda não dá para dizer”. Cada estado é um mundo à parte: o mesmo vídeo pode ter histórias diferentes de um estado para outro. Os estados com “mais de um mês depois” mostram a tela quando houver registro de semanas. O desenho completo do que é novo está nas NOTAS.md.');
  var fora = L.fora('Legenda das formas desta tela', '<table class="vb-ref"><thead><tr><th scope="col">Situação</th><th scope="col">Forma</th><th scope="col">Quando aparece</th></tr></thead><tbody>' +
    '<tr><th scope="row">Teste A/B</th><td><span class="vb-amo vb-amo-ab">' + IC.troca + 'em teste A/B</span></td><td>O vídeo está (ou esteve) em rotação no A/B Lab. Os ciclos não são trocas.</td></tr>' +
    '<tr><th scope="row">Antes do início do registro</th><td><span class="vb-amo vb-amo-rg">' + PEQ('vb-fan') + 'antes do registro</span></td><td>Dias anteriores a ' + DMY(REG) + ': o sistema não sabe se houve troca.</td></tr>' +
    '<tr><th scope="row">Depois ainda não medido</th><td><span class="tr-dv nmc">? depois ainda não medido</span></td><td>Nenhum dia fechado depois da troca. Hachura rosa: o dado ainda vai chegar.</td></tr>' +
    '<tr><th scope="row">Sem antes</th><td><span class="tr-dv sem">' + IC.sem + 'sem antes</span></td><td>Não existe dia antes da troca para comparar. Contorno pontilhado: ainda não existe.</td></tr>' +
    '<tr><th scope="row">Sem dias para comparar</th><td><span class="tr-dv cort">' + IC.corte + 'sem dias para comparar</span></td><td>Outra troca (ou um ciclo de teste) fecha a janela do lado.</td></tr>' +
    '<tr><th scope="row">Poucas impressões</th><td><span class="tr-dv poucas">… ainda não dá para dizer</span></td><td>Menos de ' + A.MIN_IMP + ' impressões num lado. Contorno tracejado.</td></tr>' +
    '<tr><th scope="row">Origem não sabida</th><td><span class="tr-dv sorig">' + IC.interr + 'origem não sabida</span></td><td>O A/B Lab não pôde ser lido no dia da troca. Sem comparação.</td></tr></tbody></table>' +
    '<p class="vb-ref-n">Seções que não mudam e ficam fora do desenho: % assistido, retenção e “este vídeo no canal” (mockup 3, aprovado).</p>');
  A.moldura({ titulo: 'Vídeo próprio: faixas de teste A/B e de registro', barra: barra,
    corpo: A.migalha([['Canais', '#'], ['tnFigueiredo', '#'], ['Vídeo']]) + pager() + cabecalho() + resumoTrocas() + secViews() + secImp() + secTrocas(), fora: fora });
  if (semNovo) document.getElementById('app').classList.add('c2-sem-novo');
  A.ligarInfos();
  graficos();
  var lh = document.getElementById('vLinha'); if (lh) linhaVersoes(lh);
  trocas.forEach(function(t, i){ var h = document.getElementById('trx' + t.n); if (h) antesDepois(h, t, LE[i], topo(), 'b3' + t.n); });
  function topo(){ return A.topoTaxa([].concat.apply([], LE.map(function(x){ return [{ cliques: x.a.cliques || 0, imp: x.a.imp }, { cliques: x.d.cliques || 0, imp: x.d.imp }]; }))); }
  window.__b3 = { M: M, LE: LE.map(function(l){ return { k: l.k, a: l.a.st, d: l.d.st }; }) };
})();

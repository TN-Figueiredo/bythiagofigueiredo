/* pc.js: mockup 15 da A5 (lote 2), página do canal de concorrente: cabeçalho com direção e estado, Lançamentos e Linha do tempo.
   ?caso=magro|cheio|extremo|parado|zero|nm|erro|vazio|fora|shorts|nichos|leitura   ?tema=claro   ?v=N (vídeo escolhido em Lançamentos, 0 a 5)
   Padrão: "magro" = o caso real de hoje (13/10/2026). "cheio", "extremo" e "nichos" SIMULAM 12/05/2027 (a contagem por vídeo começou em 03/10/2026).
   Nomes e números: EXEMPLO (pc-dados.js). O que o dono já aprovou (lista de vídeos, abas) aparece só como vizinho no pé; o que a A5 acrescenta leva o contorno "+ novo".
   Sem color-mix(): cores só pelos tokens de a4.css. */
(function(){
  'use strict';
  var A = window.A4, L = window.L1, D = window.PC, q = A.q, esc = A.esc;
  var ID = q.get('caso') || 'magro'; if (!D.CASOS[ID]) ID = 'magro';
  var m = D.carregar(ID), c = m.c, M = m.M, hoje = m.hoje, fim = m.fim, RO = !!c.soLeitura, EST = M.estado;
  window.PC_M = m;       /* só para o conferidor coerencia.mjs ler o modelo */
  var FRASE_FIXA = 'cálculo do Observatório sobre dados públicos do YouTube';
  var NS = 'http://www.w3.org/2000/svg';
  var SEL_V = q.get('v') == null ? -1 : Math.max(0, Math.min(5, parseInt(q.get('v'), 10) || 0));
  var DIA_SEL = q.get('dia') != null ? parseInt(q.get('dia'), 10) : -1;

  /* ---------------------------------------------------------------- pequenos ajudantes */
  function mil(x){ return x == null ? '' : A.mil(Math.round(x)); }
  function n(x){ return A.n(Math.round(x)); }
  /* r4 (S9): dois números mostrados lado a lado têm de dar, pela conta de quem lê, o mesmo percentual que a tela diz. Aumenta as casas até fechar (5,4 mi contra 4,6 mi dava +17% e a tela dizia +18%). */
  function lerMil(t){ var x = parseFloat(t.replace(/\./g, '').replace(',', '.')); return /mi$/.test(t) ? x * 1e6 : /mil$/.test(t) ? x * 1e3 : x; }
  function milD(x, d){ return x >= 1e6 ? A.dec(x / 1e6, d) + ' mi' : x >= 1000 ? A.dec(x / 1000, d) + ' mil' : String(Math.round(x)); }
  function milPar(u, p){
    var alvo = Math.round((u / p - 1) * 100), fs = [mil, function(x){ return milD(x, 2); }, function(x){ return milD(x, 3); }], i;
    for (i = 0; i < fs.length; i++) { var a = fs[i](u), b = fs[i](p); if (Math.round((lerMil(a) / lerMil(b) - 1) * 100) === alvo) return [a, b]; }
    return [fs[2](u), fs[2](p)];
  }
  function umDia(v){ return A.dec(v, 1).replace(/,0$/, ''); }
  function eixoV(v){ if (!v) return '0'; var t = function(x){ return A.dec(x, 1).replace(/,0$/, ''); }; return v >= 1e6 ? t(v / 1e6) + ' mi' : v >= 1000 ? t(v / 1000) + ' mil' : String(v); }
  function dir(r){
    var p = Math.round(r * 100), cls = p >= 10 ? 'up' : p <= -10 ? 'dn' : 'eq';
    return { p: p, r: r, sat: Math.abs(r) >= 0.5, cls: cls, sym: cls === 'up' ? '▲' : cls === 'dn' ? '▼' : '＝', txt: (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p) + '%', nome: cls === 'up' ? 'subindo' : cls === 'dn' ? 'descendo' : 'sem mudança' };
  }
  function quando(iso){ if (fim < hoje) return 'em ' + A.dm(iso); var d = A.dias(iso, hoje); return d === 0 ? 'hoje' : d === 1 ? 'ontem' : 'há ' + d + ' dias'; }
  function ptn(k, um, varios){ return k + ' ' + (k === 1 ? um : varios); }
  function ptz(k, um, varios){ return k + ' ' + (k <= 1 ? um : varios); }   /* em português 0 e 1 levam o singular */
  function fmtLong(){ return c.soShorts ? 'Shorts' : 'vídeos longos'; }
  /* o ⓘ de cada medida: base, janela, conta, viés e a frase fixa (item de aceite 35) */
  var infos = [];
  function info(id, titulo, linhas, vies){
    var h = '<ul>' + linhas.map(function(x){ return '<li><b>' + x[0] + ':</b> ' + x[1] + '</li>'; }).join('') + '</ul>' + (vies ? '<p>' + vies + '</p>' : '') + '<p class="pc-fonte">' + FRASE_FIXA + '.</p>';
    infos.push(A.oculto(id, titulo, h));
    return A.ibtn(id, 'Como é calculado: ' + titulo);
  }
  function fr2(h, id){ var ok = /^<span class="pc-(sim|zero)/.test(h); return '<p class="pc-fr2"' + (id ? ' id="' + id + '"' : '') + '>' + (ok ? h : '<span>' + h + '</span>') + '</p>'; }
  function sim(cls, t){ return '<span class="pc-sim ' + cls + '" aria-hidden="true">' + t + '</span>'; }
  function motivoNm(txt, quando2){ return A.nml(txt + (quando2 ? '; passa a existir em <b class="num">' + A.dmy(quando2) + '</b>' : '')); }

  /* ---------------------------------------------------------------- pastilha de estado (M8) */
  var ICBAIXO = '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v9M4 8.5 8 12.5 12 8.5"/></svg>';
  function horasErro(){ return c.erroHoras ? Math.floor(c.erroHoras / 24) : 0; }
  function pastilha(){
    if (EST === 'ativo') return '<span class="pc-est ativo">' + L.IC.ok + '<span>Ativo</span></span>';
    if (EST === 'parado') return '<span class="pc-est parado">' + L.IC.pausa + '<span>Parado</span></span>';
    if (EST === 'queda') return '<span class="pc-est queda">' + ICBAIXO + '<span>Em queda sustentada</span></span>';
    if (EST === 'novo') return '<span class="pc-est novo">' + L.IC.sync + '<span>Primeira busca</span></span>';
    if (EST === 'fora') return '<span class="pc-est fora">' + L.IC.x + '<span>Saiu do YouTube em ' + A.dm(c.foraEm) + '</span></span>';
    return '<span class="er-p aviso">' + L.IC.envelope + '<span>Em erro há ' + horasErro() + ' dias</span></span>';
  }

  /* ---------------------------------------------------------------- frase-resumo do topo */
  /* B1: a segunda metade da pergunta de 3 segundos (o último vídeo foi acima do normal?) vai na frase do topo, com a mesma regra de faixa de Lançamentos */
  function ultimoVideo(){
    var quem = c.soShorts ? 'Short' : M.r.doisFmt ? 'vídeo longo' : 'vídeo', uv = m.vids.filter(function(v){ return v.fmt === M.r.fmt; })[0];
    if (c.novo) return 'Sem leitura do último ' + quem + ': a primeira busca ainda não terminou.';
    if (!uv) return '';
    var i = REC.indexOf(uv), pre = fim < hoje ? 'Até ' + A.dm(fim) + ', o' : 'O', ini = pre + ' último ', ant = '';
    if (i < 0 && uv.pub >= D.INICIO && REC.length) { ant = pre + ' último ' + quem + ' saiu ' + quando(uv.pub) + ' e ainda não completou um dia de contagem. '; ini = 'O anterior, '; i = 0; quem = ''; }   /* o último saiu agora: a resposta vem do anterior */
    if (i < 0) return 'Sem leitura do último ' + quem + ': ' + (uv.pub < D.INICIO ? 'ele saiu antes de a contagem por vídeo começar (03/10).' : 'ele ainda não completou um dia de contagem.');
    var v = REC[i], nome = '“' + esc(v.t) + '”', suj = ini + (quem ? quem + ', ' : '') + nome + ', ';
    if (ant) suj = 'O anterior, ' + nome + ', ';
    if (v.rel) return ant + suj + 'saiu acima do normal já no dia ' + v.rel.a + ' (' + A.dec(v.rel.r, 1) + '×).';
    if (!v.ult) return ant + suj + 'ainda não tem normal para comparar: faltam vídeos medidos na mesma idade.';
    return ant + suj + 'está ' + tier(v).nome + ' (' + A.dec(v.ult.r, 1) + '× no dia ' + v.ult.a + ').';
  }
  function ressalva(){ return M.a && M.a.cruza ? ' <span class="pc-ress">(a janela ainda cruza a mudança de contagem de 24/08)</span>' : ''; }
  function frase(){
    var a = M.a, r = M.r, ult = r.ultima, uv = ultimoVideo(), fimUv = uv ? ' ' + uv : '';
    if (EST === 'fora') return { cls: 'eq', sym: L.IC.x, t: '<b>Os números valem até ' + A.dm(c.foraEm) + ';</b> o YouTube não diz o motivo.' + fimUv };
    if (EST === 'erro') return { cls: 'eq', sym: L.IC.aviso, t: '<b>Os números abaixo são de ' + A.dm(fim) + ',</b> a última leitura que deu certo.' + fimUv };
    if (c.novo) return { cls: 'eq', sym: L.IC.sync, t: '<b>Canal novo na lista:</b> os números aparecem aos poucos.' + fimUv };
    if (EST === 'parado') return { cls: 'dn', sym: L.IC.pausa, t: '<b>Parado há ' + r.desde + ' dias:</b> o último vídeo' + (r.doisFmt ? ' (longo ou Short)' : '') + ' saiu em ' + A.dm(r.ultima) + '. Ele costumava publicar ' + (r.doisFmt ? 'um longo ' : '') + 'a cada ' + (r.mediana ? umDia(r.mediana) : '—') + ' dias.' };
    if (EST === 'queda') { var e = M.escada.map(dir); return { cls: 'dn', sym: '▼', t: '<b>Em queda sustentada:</b> as três últimas janelas de 28 dias ganharam menos views que a anterior (' + e.map(function(x){ return x.txt; }).join(', ') + ').' + fimUv }; }
    if (c.soShorts) return { cls: a.nm ? 'eq' : dir(a.r).cls, sym: a.nm ? '＝' : dir(a.r).sym, t: '<b>Canal só de Shorts:</b> publica ' + A.dec(r.porSemana, 1) + ' Shorts por semana' + (a.nm ? '.' : ', e as views do canal ' + (dir(a.r).cls === 'up' ? 'subiram ' : dir(a.r).cls === 'dn' ? 'caíram ' : 'ficaram iguais, ') + dir(a.r).txt + ' em 28 dias' + ressalva() + '.') + fimUv };
    if (a.nm) return { cls: 'eq', sym: '?', t: '<b>Ainda não dá para dizer para onde o canal anda:</b> faltam ' + (56 - a.dias) + ' dias de registro (completa em ' + A.dm(a.quando) + '). Ele publicou ' + (r.fmt === 'short' ? ptn(r.pubs, 'Short', 'Shorts') : ptn(r.pubs, 'vídeo longo', 'vídeos longos')) + (r.semMed < 13 ? ' nas ' + ptn(r.semMed, 'semana', 'semanas') + ' com leitura.' : ' nas últimas 13 semanas.') + fimUv };
    var d = dir(a.r), ac = M.a4;
    var verbo = d.cls === 'up' ? 'ganhou mais views do que' : d.cls === 'dn' ? 'ganhou menos views do que' : d.p === 0 ? 'ganhou as mesmas views que' : 'ganhou quase as mesmas views que';
    return { cls: d.cls, sym: d.sym, t: '<b>' + d.nome.charAt(0).toUpperCase() + d.nome.slice(1) + ' ' + d.txt + ':</b> nos últimos 28 dias o canal ' + verbo + ' nos 28 anteriores' + ressalva() + '. Publica ' + A.dec(r.porSemana, 1) + (r.doisFmt ? ' vídeos longos' : ' vídeos') + ' por semana' + (ac.nm ? '.' : ' e acertou <b class="num">' + ac.k + ' de ' + ac.n + '</b> vídeos recentes.') + fimUv };
  }

  /* ---------------------------------------------------------------- as seis células */
  function cel(rot, val, base, cls){ return '<div class="pc-cel ' + (cls || '') + '"><dt>' + rot + '</dt><dd class="v">' + val + '</dd><dd class="b">' + base + '</dd></div>'; }
  function celulas(){
    var a = M.a, r = M.r, ac = M.a4, out = [];
    out.push(cel('Inscritos', '<b class="num">' + (c.ins >= 1e6 ? milD(c.ins, 2) : mil(c.ins)) + '</b>', 'arredondado pelo YouTube'));
    if (a.nm) out.push(cel('Direção', A.nm(), esc(a.nm) + (a.parou ? '; a leitura parou em ' + A.dm(fim) : ''), 'novo'));
    else { var d = dir(a.r); out.push(cel('Direção', sim(d.cls, d.sym) + '<b class="num ' + d.cls + '">' + d.txt + '</b>', 'views do canal, 28 × 28 dias' + (a.cruza ? '<span class="pc-av"><svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.2 14.4 13.4H1.6Z"/><path d="M8 6.6v3.2M8 11.5v.1"/></svg>janela ainda não limpa</span>' : ''), 'novo')); }
    if (EST === 'erro') out.push(cel('Estado', A.nm('não confirmado'), 'sem leitura desde ' + A.dm(fim), 'novo'));
    else out.push(cel('Estado', pastilha(), EST === 'novo' ? 'a primeira busca ainda não terminou' : EST === 'ativo' ? (r.doisFmt ? 'último longo ou Short ' : 'último vídeo ') + quando(r.ultima) : EST === 'parado' ? (r.doisFmt ? 'último longo ou Short há ' : 'último vídeo há ') + r.desde + ' dias' : EST === 'queda' ? 'três janelas de 28 dias seguidas' : 'números valem até essa data', 'novo'));
    if (ac.nm) out.push(cel('Acerto', A.nm(), esc(ac.nm) + (ac.soShorts || !/^menos de 5/.test(ac.nm) ? '' : ' em 90 dias'), 'novo'));
    else {
      var cont = ac.lista.map(function(v){ return '<i class="pc-q ' + (v.mult >= 2 ? 'a' : v.mult <= 0.5 ? 'f' : 'm') + '"></i>'; }).join('');
      var pc = ac.n >= 10 ? ' <span class="pc-pc">(' + Math.round(100 * ac.k / ac.n) + '%)</span>' : '';
      out.push(cel('Acerto', ac.k === 0 ? '<span class="pc-zero num" aria-hidden="true">0</span><b class="num">0 de ' + ac.n + '</b>' + pc : '<b class="num">' + ac.k + ' de ' + ac.n + '</b>' + pc, '<span class="pc-qs" style="--cols:' + (ac.n <= 8 ? ac.n : Math.ceil(ac.n / 2)) + '" role="img" aria-label="' + ptn(ac.n, 'vídeo', 'vídeos') + ': ' + ptz(ac.k, 'acerto', 'acertos') + ', ' + ptz(ac.f, 'fracasso', 'fracassos') + ', ' + (ac.n - ac.k - ac.f) + ' no meio">' + cont + '</span>2× ou mais · 90 dias', 'novo'));
    }
    if (r.nm) out.push(cel('Ritmo', A.nm('parcial'), esc(r.nm), 'novo'));
    else out.push(cel('Ritmo', '<b class="num">' + A.dec(r.porSemana, 1) + '</b><span class="un">por semana</span>', 'com ' + (r.fmt === 'long' ? 'um longo' : 'um Short') + ' em ' + r.semCom + ' de ' + r.semMed + ' semanas' + (r.semMed < 13 ? ' com leitura' : ''), 'novo'));
    var rs = M.resp || c.resp;
    if (rs.nm) out.push(cel('Criador responde', A.nm(), esc(rs.nm), 'novo'));
    else out.push(cel('Criador responde', rs.k === 0 ? '<span class="pc-zero num" aria-hidden="true">0</span><b class="num">0 de ' + rs.n + '</b>' + (rs.n >= 10 ? ' <span class="pc-pc">(0%)</span>' : '') : '<b class="num">' + rs.k + ' de ' + rs.n + '</b>' + (rs.n >= 10 ? ' <span class="pc-pc">(' + Math.round(100 * rs.k / rs.n) + '%)</span>' : ''), 'vídeos com resposta vista · 90 dias', 'novo'));
    return out.join('');
  }
  function passoIns(){ return c.ins >= 1e6 ? '10 mil' : c.ins >= 1e5 ? '1 mil' : c.ins >= 1e4 ? '100' : '10'; }   /* o YouTube arredonda a 3 algarismos */
  function todosNumeros(){
    /* r5 (B1, C4): tudo sai de M.mais (pc-dados.js). Sem o prazo completo o número é "não medido" com o motivo na linha de baixo; canal sem leitura nova mostra o valor "até dd/mm" */
    var X = M.mais, ate = X.ate ? ' · até ' + A.dm(X.ate) : '';
    function cl(rot, o, valor, base){ return o.nm ? [rot, A.nm(), esc(o.nm)] : [rot, valor, base]; }
    var linhas = [
      X.ins30.zero ? ['Inscritos em 30 dias', '<b class="num">≈ 0</b>', 'menos que ' + passoIns() + ' inscritos, o arredondamento do YouTube' + ate] :
        cl('Inscritos em 30 dias', X.ins30, '<b class="num">+' + A.dec(X.ins30.v || 0, 1) + '%</b>', 'de ' + passoIns() + ' em ' + passoIns() + ' pelo arredondamento' + ate),
      cl('Views por dia no canal', X.vpd, '<b class="num">' + mil(X.vpd.v || 0) + '</b>', 'média dos ' + (X.ate ? '28 dias até ' + A.dm(X.ate) : 'últimos 28 dias')),
      cl('Engajamento nos ' + fmtLong(), X.eng, '<b class="num">' + A.dec(X.eng.v || 0, 1) + '%</b>', '(curtidas + comentários) ÷ views' + ate),
      cl('Views típicas, ' + fmtLong(), X.tip, '<b class="num">' + mil(X.tip.v || 0) + '</b>', 'valor do meio dos publicados nos ' + (X.ate ? '90 dias até ' + A.dm(X.ate) : 'últimos 90 dias'))
    ];
    return linhas.map(function(l){ return '<div class="pc-cel"><dt>' + l[0] + '</dt><dd class="v">' + l[1] + '</dd><dd class="b">' + l[2] + '</dd></div>'; }).join('');
  }

  /* ---------------------------------------------------------------- cabeçalho */
  function cabecalho(){
    var f = frase(), acts = '';
    var yt = EST === 'fora' ? '' : '<a class="btn" href="#" onclick="return false">Abrir no YouTube <svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3H3v10h10v-3M9 3h4v4M13 3 7.5 8.5"/></svg><span class="sr"> (abre em nova aba)</span></a>';
    acts = '<a class="btn" href="#" onclick="return false">Comparar com o meu canal</a>' + yt + (RO ? '' : '<button type="button" class="btn icon" aria-label="Ações do canal" aria-haspopup="menu">' + L.IC.dots + '</button>');
    var handle = EST === 'fora' ? '<span class="pc-h mut">' + esc(c.handle) + '</span>' : '<a class="lk pc-h" href="#" onclick="return false">' + esc(c.handle) + '</a>';
    var nicho = '<span class="chip">' + esc(c.nicho) + '</span>' + (c.nichoDiferente ? '<span class="chip pc-outro" title="O seu canal é de Viagem">outro nicho: o seu é Viagem</span>' : '');
    var ro = RO ? '<span class="chip pc-ro">' + L.IC.canal + 'você só lê este site: sem o menu de ações do canal</span>' : '';
    var h1 = '<header class="pc-cab"><span class="pc-avt" aria-hidden="true">' + esc(c.nome.slice(0, 1)) + '</span><div class="pc-id"><h1 tabindex="-1">' + esc(c.nome) + '</h1><p class="pc-id2">' + handle + nicho + ro + '</p></div><div class="pc-acts">' + acts + '</div></header>';
    var fr = '<p class="pc-fr ' + f.cls + '">' + sim(f.cls, f.sym) + '<span>' + f.t + '</span></p>';
    var strip = L.novo('<div class="pc-faixa"><dl class="pc-cels" aria-label="Números do canal">' + celulas() + '</dl></div><p class="pc-como"><span>Base e janela de cada número</span>' + info('iCab', 'os números do canal', [
      ['Inscritos', 'contagem pública do YouTube, arredondada a 3 algarismos pelo próprio YouTube'],
      ['Direção', 'views totais ganhas pelo canal nos últimos 28 dias ÷ nos 28 anteriores; ▲ se +10% ou mais, ▼ se −10% ou menos, ＝ no meio. Pede 56 dias de registro. Inclui Shorts e vídeos apagados. Antes de ' + A.dmy(D.LIMPA_56) + ' a janela ainda cruza a mudança de contagem de ' + A.dmy(D.COR)],
      ['Estado', 'ativo, parado (mais dias sem publicar que o maior entre 28 e 4 vezes o intervalo mediano), em queda sustentada (três janelas de 28 dias seguidas com −10% ou menos; só a partir de ' + A.dmy(D.LIMPA_112) + ') ou fora do ar (o YouTube não devolveu o canal em duas leituras seguidas)'],
      ['Acerto', 'vídeos longos dos últimos 90 dias, com 7 dias ou mais, que tiveram 2× ou mais as views típicas do próprio canal; mede regularidade, não tamanho. Os pontinhos: ◆ 2× ou mais · ● no meio · × 0,5× ou menos. Percentual só com 10 vídeos ou mais; menos de 5, não medido'],
      ['Ritmo', 'publicações por semana nas últimas 13 semanas e quantas dessas semanas tiveram publicação'],
      ['Criador responde', 'entre os vídeos longos dos últimos 90 dias que já têm ' + D.DIAS_COMENT + ' dias de comentários guardados, em quantos vimos uma resposta dele entre os comentários guardados; é um piso: não vimos resposta não quer dizer que não respondeu']
    ], 'Cada número leva a sua base e a sua janela escritas na célula.') + '</p>', 'novo: 5 das 6 células', 'pc-faixaw');
    var mais = '<details class="pc-mais"><summary>Mais números do canal<span class="mut"> (' + 4 + ')</span></summary><dl class="pc-cels pc-cels2" aria-label="Mais números do canal">' + todosNumeros() + '</dl></details>';
    return h1 + fr + strip + mais;
  }

  /* ---------------------------------------------------------------- bloco: direção */
  function regua(r, rotulo){
    var d = dir(r), p = Math.max(-50, Math.min(50, d.r * 100)), left = p + 50, sat = d.sat;   /* r5 (C6): a posição e o "fora da escala" vêm do valor exato, não do arredondado (−49,8% fica dentro da escala) */
    return '<div class="pc-rg" role="img" aria-label="' + esc(rotulo + ': ' + d.nome + ', ' + d.txt + '. A faixa do meio, de −10% a +10%, é sem mudança.') + '"><span class="pc-rg-band"></span><span class="pc-rg-line"></span>' +
      '<span class="pc-rg-m ' + d.cls + '" style="left:' + left + '%"><i>' + d.sym + (sat ? (d.p > 0 ? '›' : '‹') : '') + '</i><b></b></span>' +
      '<span class="pc-rg-t" style="left:0">−50%</span><span class="pc-rg-t" style="left:40%">−10%</span><span class="pc-rg-t" style="left:60%">+10%</span><span class="pc-rg-t" style="left:100%">+50%</span></div>';
  }
  function progresso(feitos, de, rotulo, unid){
    var pc = Math.max(2, Math.min(100, 100 * feitos / de));
    return '<div class="pc-pg" role="img" aria-label="' + esc(rotulo + ': ' + feitos + ' de ' + de + (unid === '' ? '' : ' ' + (unid || 'dias'))) + '"><span class="pc-pg-f" style="width:' + pc + '%"></span><span class="pc-pg-r"></span></div>';
  }
  function linhaDir(o){
    var val, graf, base = o.base || '';
    if (o.nm) {
      val = A.nm();
      graf = o.prog ? '<div class="pc-nmw">' + progresso(o.prog[0], o.prog[1], o.nome) + '<p class="pc-pgl"><b class="num">' + o.prog[0] + ' de ' + o.prog[1] + ' dias</b> · ' + esc(o.nm) + (o.quando ? '; passa a existir em <b class="num">' + A.dmy(o.quando) + '</b>' : o.parou ? '; a leitura parou em ' + A.dm(fim) : '') + '</p></div>' : '<div class="pc-nmw"><div class="pc-nmbar" aria-hidden="true"></div><p class="pc-pgl">' + esc(o.nm) + '</p></div>';
      base = '';
    } else {
      var d = dir(o.r); val = sim(d.cls, d.sym) + '<b class="num ' + d.cls + '">' + d.txt + '</b>' + (d.sat ? '<span class="pc-sat">' + (d.r > 0 ? 'ou mais' : 'ou menos') + ', fora da escala</span>' : ''); graf = regua(o.r, o.nome);
    }
    return '<div class="pc-dr ' + (o.main ? 'main' : '') + '"><div class="pc-dl"><b>' + o.nome + '</b><span>' + o.sub + '</span></div><div class="pc-dg">' + graf + '</div><div class="pc-dv">' + val + '</div>' + (base ? '<p class="pc-db">' + base + '</p>' : '') + '</div>';
  }
  function direcao(){
    var a = M.a, b = M.b, cc = M.c, long = c.soShorts, rows = '';
    var fr;
    if (a.nm) fr = '<b>Sem veredito ainda:</b> faltam ' + (56 - a.dias) + ' dias de registro para comparar 28 dias com os 28 anteriores.';
    else { var d = dir(a.r); fr = sim(d.cls, d.sym) + '<span><b>' + d.nome.charAt(0).toUpperCase() + d.nome.slice(1) + ' ' + d.txt + ' em 28 dias.</b>' + (long ? '' : ' As linhas abaixo dizem se os vídeos novos vão na mesma direção.') + '</span>'; }
    rows += linhaDir(a.nm ? { nm: a.nm, nome: 'Views do canal inteiro', sub: '28 dias contra os 28 anteriores', main: true, quando: a.quando, parou: a.parou, prog: [a.dias, 56] } :
      { r: a.r, nome: 'Views do canal inteiro', sub: '28 dias contra os 28 anteriores', main: true, base: '<b class="num">' + milPar(a.u, a.p)[0] + '</b> views contra <b class="num">' + milPar(a.u, a.p)[1] + '</b>' + (a.cruza ? '<span class="pc-av"><svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.2 14.4 13.4H1.6Z"/><path d="M8 6.6v3.2M8 11.5v.1"/></svg>' + (a.limpa ? 'a janela ainda cruza a mudança de contagem de 24/08; fica limpa em ' + A.dmy(a.limpa) : 'a janela termina em ' + A.dm(fim) + ' e ainda cruza a mudança de contagem de 24/08') + '</span>' : '') });
    rows += linhaDir(long ? { nm: 'este canal não tem vídeos longos', nome: 'Vídeos novos, views de hoje', sub: 'valor do meio dos longos: 90 dias contra os 90 anteriores' } :
      b.nm ? { nm: b.nm + (c.novo ? '' : ' (agora ' + b.nu + ' e ' + b.np + ')'), nome: 'Vídeos novos, views de hoje', sub: 'valor do meio dos longos: 90 dias contra os 90 anteriores' } :
      { r: b.r, nome: 'Vídeos novos, views de hoje', sub: 'valor do meio dos longos: 90 dias contra os 90 anteriores', base: '<b class="num">' + milPar(b.u, b.p)[0] + '</b> contra <b class="num">' + milPar(b.u, b.p)[1] + '</b> views (' + b.nu + ' e ' + b.np + ' vídeos' + notaSemLeitura(b.nu) + ')' + (dir(b.r).cls === 'dn' ? '<span class="pc-av">descer pode ser só idade: os vídeos mais antigos tiveram mais tempo</span>' : '') });
    rows += linhaDir(long ? { nm: 'este canal não tem vídeos longos', nome: 'Vídeos novos, leitura justa', sub: 'a mesma conta, com as views dos 30 primeiros dias' } :
      cc.nm ? { nm: cc.nm, nome: 'Vídeos novos, leitura justa', sub: 'a mesma conta, com as views dos 30 primeiros dias', quando: cc.quando, parou: cc.parou, prog: [cc.dias, cc.de] } :
      { r: cc.r, nome: 'Vídeos novos, leitura justa', sub: 'a mesma conta, com as views dos 30 primeiros dias', base: '<b class="num">' + milPar(cc.u, cc.p)[0] + '</b> contra <b class="num">' + milPar(cc.u, cc.p)[1] + '</b> views aos 30 dias (' + cc.nu + ' e ' + cc.np + ' vídeos)' });
    /* escada de M8 */
    var esc3;
    if (M.escada) esc3 = M.escada.map(function(r, i){ var d = dir(r); return '<li class="pc-ca ' + d.cls + '"><span class="pc-cn">' + ['janela atual', 'a anterior', 'antes dela'][i] + '</span><span class="pc-cv">' + d.sym + ' <b class="num">' + d.txt + '</b></span></li>'; }).join('');
    else esc3 = [0, 1, 2].map(function(i){ return '<li class="pc-ca nm"><span class="pc-cn">' + ['janela atual', 'a anterior', 'antes dela'][i] + '</span><span class="pc-cv">não medido</span></li>'; }).join('');
    var nmE = M.escadaNm;
    var escada = '<div class="pc-esc"><div class="pc-dl"><b>Queda sustentada</b><span>três janelas de 28 dias seguidas, cada uma contra a anterior</span></div><ol class="pc-cas" aria-label="As três janelas de 28 dias">' + esc3 + '</ol><div class="pc-dv">' + (EST === 'queda' ? pastilha() : M.escada ? '<span class="pc-est ativo">' + L.IC.ok + '<span>Fora da queda</span></span>' : A.nm()) + '</div>' +
      (nmE ? '<div class="pc-nmw pc-escp">' + progresso(nmE.dias, nmE.de, 'dias limpos de registro') + '<p class="pc-pgl"><b class="num">' + nmE.dias + ' de ' + nmE.de + ' dias</b> ' + (nmE.cadastro ? 'desde ' + A.dm(nmE.desdeIni) + ', o cadastro do canal' : 'depois da mudança de contagem de 24/08') + (nmE.quando ? '; a primeira leitura limpa é em <b class="num">' + A.dmy(nmE.quando) + '</b>' : '; a leitura parou em ' + A.dm(fim)) + '</p></div>' : '<p class="pc-db">É “em queda sustentada” quando as três ficam em ▼ −10% ou menos.</p>') + '</div>';
    var leg = '<p class="pc-leg"><span><b class="up">▲</b> subindo: +10% ou mais</span><span><b class="eq">＝</b> sem mudança</span><span><b class="dn">▼</b> descendo: −10% ou menos</span></p>';
    var corpo = '<div class="pc-sh"><h2 id="hDir">Para onde o canal anda</h2>' + info('iDir', 'a direção do canal', [
      ['Três leituras', 'cada uma compara o canal com ele mesmo, nunca com outro canal'],
      ['Views do canal inteiro', 'views ganhas nos últimos 28 dias ÷ nos 28 anteriores, pelo contador público do canal. Inclui Shorts e vídeos apagados. Pede 56 dias de registro'],
      ['Vídeos novos, views de hoje', 'mediana das views de hoje dos vídeos longos publicados nos últimos 90 dias ÷ a dos 90 dias anteriores. Pede 3 vídeos em cada período. Descer pode ser só idade; subir apesar disso é um bom sinal'],
      ['Leitura justa', 'a mesma conta com as views dos 30 primeiros dias de cada vídeo, sem o viés de idade. Só existe depois de 180 dias de contagem por vídeo, contados desde 03/10/2026 ou desde o cadastro do canal, o que vier depois'],
      ['Queda sustentada', 'três janelas de 28 dias seguidas, cada uma com −10% ou menos contra a anterior; pede 112 dias limpos, contados a partir de 25/08/2026 (o dia 24/08 não conta): só a partir de ' + A.dmy(D.LIMPA_112)],
      ['Faixa do meio', 'de −10% a +10% é “sem mudança”, em cinza; o âmbar não é usado para isso'],
      ['Entre nichos', 'a direção compara o canal consigo mesmo, então vale entre nichos diferentes; o tamanho absoluto não']
    ], 'Antes de ' + A.dmy(D.LIMPA_56) + ' a janela de 28 × 28 dias ainda cruza a mudança de contagem de ' + A.dmy(D.COR) + '.') + '</div>' +
      fr2(fr) + '<div class="pc-drs">' + rows + escada + '</div>' + leg;
    return '<section class="pc-sec" id="direcao" aria-labelledby="hDir">' + corpo + '</section>';
  }

  /* ---------------------------------------------------------------- bloco: lançamentos */
  var TIERS = { topo: { nome: 'muito acima do normal', cls: 'topo' }, alto: { nome: 'acima do normal', cls: 'alto' }, medio: { nome: 'perto do normal', cls: 'medio' }, baixo: { nome: 'abaixo do normal', cls: 'baixo' }, sem: { nome: 'sem normal para comparar', cls: 'sem' } };
  function tier(v){ if (!v.ult) return TIERS.sem; var r = v.ult.r; return r >= 2 ? TIERS.topo : r >= 1.5 ? TIERS.alto : r < 1 / 1.5 ? TIERS.baixo : TIERS.medio; }
  var REC = M.recentes.filter(function(v){ return v.idade >= 1; });
  var ESC_V = (SEL_V >= 0 && REC[SEL_V]) ? SEL_V : 0;     /* abre sempre pelo último vídeo (B1); o notável fica na lista com o seu selo */
  function marcador(cls, x, y, r){
    x = +x; y = +y;
    if (cls === 'topo') return '<polygon class="pc-mk ' + cls + '" points="' + x + ',' + (y - r - 1) + ' ' + (x + r + 1) + ',' + y + ' ' + x + ',' + (y + r + 1) + ' ' + (x - r - 1) + ',' + y + '"/>';
    if (cls === 'alto') return '<rect class="pc-mk ' + cls + '" x="' + (x - r) + '" y="' + (y - r) + '" width="' + 2 * r + '" height="' + 2 * r + '"/>';
    return '<circle class="pc-mk ' + cls + '" cx="' + x + '" cy="' + y + '" r="' + r + '"/>';
  }
  function fraseLanc(){
    if (!REC.length) return '<b>Nenhum ' + (c.soShorts ? 'Short' : 'vídeo longo') + ' com contagem por vídeo ainda.</b>';
    var v = REC[ESC_V], t = tier(v), nome = '“' + esc(v.t) + '”';
    var pior = M.normal.filter(function(x){ return x.v != null; }).length === 0;
    if (pior) { var mx = Math.max.apply(null, M.normal.map(function(x){ return x.n; })); return '<b>Ainda não há “normal” para comparar.</b> Cada ponto da linha pede 3 ' + (c.soShorts ? 'Shorts' : 'vídeos') + ' medidos na mesma idade; hoje o melhor ponto tem ' + mx + '. As curvas abaixo já mostram como cada vídeo novo começou.'; }
    if (v.rel) { var nm = M.normal.filter(function(x){ return x.a === v.rel.a; })[0]; return '<b>' + nome + ' saiu acima do normal já no dia ' + v.rel.a + ':</b> ' + mil(Math.round(nm.v * v.rel.r)) + ' views, ' + A.dec(v.rel.r, 1) + '× o normal do canal (' + mil(nm.v) + ').'; }
    if (!v.ult) return '<b>' + nome + ' ainda não tem um ponto para comparar com o normal.</b> Ele tem ' + ptn(v.idade, 'dia', 'dias') + ' e a linha do normal começa no dia 1.';
    return '<b>' + nome + ' está ' + t.nome + ':</b> ' + A.dec(v.ult.r, 1) + '× o normal do canal no dia ' + v.ult.a + '.';
  }
  function lancamentos(){
    var lista = REC.map(function(v, i){
      var t = tier(v), r = v.ult ? A.dec(v.ult.r, 1) + '× no dia ' + v.ult.a : '';
      return '<li><button type="button" class="pc-vb' + (i === ESC_V ? ' on' : '') + '" data-v="' + i + '" aria-pressed="' + (i === ESC_V) + '"><svg class="pc-sw2 ' + t.cls + '" width="34" height="16" viewBox="0 0 34 16" aria-hidden="true"><path class="pc-ln ' + t.cls + '" d="M2 8H22"/>' + marcador(t.cls, 28, 8, 4) + '</svg><span class="pc-vt"><span class="pc-vn num">' + (i + 1) + '</span> ' + esc(v.t) + '<small>' + (i === 0 ? (REC[0] === m.vids.filter(function(x){ return x.fmt === M.r.fmt; })[0] ? (M.r.doisFmt ? 'o último longo · ' : 'o último · ') : 'o mais recente com contagem · ') : '') + 'publicado ' + quando(v.pub) + ' · ' + mil(v.views) + ' views</small></span><span class="pc-vr">' + (v.ult ? '<b class="num">' + r + '</b><small>' + t.nome + '</small>' : A.nm('sem normal')) + '</span></button></li>';
    }).join('');
    var nrow = '<ol class="pc-nrow" aria-label="Quantos ' + (c.soShorts ? 'Shorts' : 'vídeos') + ' entram em cada ponto da linha do normal">' + M.normal.map(function(x){ return '<li class="' + (x.v == null ? 'nm' : '') + '"><span>dia ' + x.a + '</span><b class="num">n ' + x.n + '</b></li>'; }).join('') + '</ol>';
    var h72;
    if (M.h72.nm) { var hoje3 = M.h72.n != null ? ' (hoje ' + M.h72.n + ')' : '', mot = esc(M.h72.nm); h72 = A.nml(/^menos de 3 vídeos/.test(M.h72.nm) ? mot + hoje3 + '.' : mot + '. Precisa de 3 vídeos com as 72 primeiras horas acompanhadas' + hoje3 + '.'); }
    else h72 = '<p class="pc-fr3"><b>Metade das views das primeiras 72 horas chega em ' + M.h72.metade + ' horas</b> (valor do meio de ' + M.h72.n + ' ' + (c.soShorts ? 'Shorts' : 'vídeos') + ').</p><div id="h72host" class="pc-h72"></div>';
    var temNormal = M.normal.some(function(x){ return x.v != null; }), miolo;
    if (!REC.length) miolo = '<div class="pc-lc">' + A.nm() + '<p>As curvas aparecem quando o primeiro ' + (c.soShorts ? 'Short' : 'vídeo') + ' completar um dia de contagem; a linha do normal, quando houver 3 medidos na mesma idade.</p></div>';
    else miolo = '<div class="pc-chartw"><div id="lanHost" class="pc-chart"></div></div>' + nrow +
      '<p class="pc-leg2">' + (temNormal ? '<span class="pc-lg"><svg width="30" height="12" aria-hidden="true"><path class="pc-ln med" d="M2 6H20"/><circle class="pc-mk med" cx="25" cy="6" r="4"/></svg>o normal do canal</span>' : '') + (M.normal.some(function(x){ return x.v == null; }) ? '<span class="pc-lg"><i class="nm-h" aria-hidden="true"></i>menos de 3 vídeos: sem ponto</span>' : '') + '</p>' +
      '<ul class="pc-vl" aria-label="Vídeos recentes">' + lista + '</ul>';
    var corpo = '<div class="pc-sh"><h2 id="hLan">Lançamentos: como os vídeos novos começam</h2>' + info('iLan', 'os lançamentos', [
      ['Linha do normal', 'em cada idade (1, 2, 3, 5, 7, 14, 21 e 30 dias), a mediana das views dos ' + (c.soShorts ? 'Shorts' : 'vídeos longos') + ' do canal publicados nos últimos 180 dias, no instante daquela idade (interpolação linear entre duas leituras vizinhas)'],
      ['Cada ponto leva o seu n', 'o número de vídeos medidos naquela idade; com menos de 3 o ponto não existe e a casa fica em hachura'],
      ['Curvas', 'os ' + (c.soShorts ? '6 Shorts' : '6 vídeos longos') + ' mais recentes com contagem por vídeo (desde 03/10/2026); cada um para na sua idade de hoje'],
      ['Cor e forma', 'a cor e o desenho da ponta dizem o desempenho contra o normal na última idade com ponto: ◆ 2× ou mais, ■ 1,5× a 2×, ● perto do normal, ○ abaixo de dois terços'],
      ['Primeiras 72 horas', 'mediana, entre os vídeos, da parte das views das 72 horas que já aconteceu em cada hora; horário de São Paulo']
    ], 'Os pontos de idade alta só têm os vídeos mais velhos: a linha não é de um mesmo grupo. “Acima do normal” é uma conta nossa (1,5× ou mais), não um dado do YouTube.') + '</div>' +
      fr2(fraseLanc(), 'lanFr') + miolo +
      '<div class="pc-72"><h3 id="h72t">Primeiras 72 horas</h3>' + h72 + '</div>';
    return '<section class="pc-sec" id="lancamentos" aria-labelledby="hLan">' + corpo + '</section>';
  }
  function nice(mx){ var e = Math.pow(10, Math.floor(Math.log10(mx))), f = mx / e, g = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 3 ? 3 : f <= 4 ? 4 : f <= 5 ? 5 : f <= 8 ? 8 : 10; return g * e; }
  function mk(tag, at, txt){ var e = document.createElementNS(NS, tag); Object.keys(at || {}).forEach(function(k){ e.setAttribute(k, at[k]); }); if (txt != null) e.textContent = txt; return e; }
  function defs(id){ return '<defs><pattern id="' + id + '" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="pc-hp-b"/><line x1="0" y1="0" x2="0" y2="6" class="pc-hp-l"/></pattern></defs>'; }
  function desenharLanc(){
    var host = document.getElementById('lanHost'); if (!host) return;
    var W = Math.max(280, Math.floor(host.clientWidth || 600)), H = W < 520 ? 250 : 300, Lm = 58, Rm = 18, Tm = 16, Bm = 32, PW = W - Lm - Rm, PH = H - Tm - Bm;
    var mx = 10; REC.forEach(function(v){ mx = Math.max(mx, v.pts[v.pts.length - 1]); }); M.normal.forEach(function(x){ if (x.v) mx = Math.max(mx, x.v); });
    var ym = nice(mx * 1.06);
    function X(a){ return Lm + PW * a / 30; } function Y(v){ return Tm + PH * (1 - v / ym); }
    var s = '<svg class="pc-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc('Views acumuladas nos 30 primeiros dias de cada vídeo recente, pela idade em dias, sobre a linha do normal do canal. ' + ptn(REC.length, 'vídeo', 'vídeos') + '.') + '">' + defs('pcH');
    [0, .5, 1].forEach(function(f){ s += '<line class="ic-grid" x1="' + Lm + '" x2="' + (W - Rm) + '" y1="' + Y(ym * f) + '" y2="' + Y(ym * f) + '"/><text class="ic-ax" x="' + (Lm - 6) + '" y="' + (Y(ym * f) + 4) + '" text-anchor="end">' + eixoV(ym * f) + '</text>'; });
    D.IDADES.forEach(function(a){ var rotulo = W >= 520 || [1, 7, 14, 21, 30].indexOf(a) >= 0; s += '<line class="pc-tick" x1="' + X(a) + '" x2="' + X(a) + '" y1="' + (Tm + PH) + '" y2="' + (Tm + PH + 4) + '"/>' + (rotulo ? '<text class="ic-ax" x="' + X(a) + '" y="' + (Tm + PH + 17) + '" text-anchor="middle">' + a + '</text>' : ''); });
    s += '<text class="ic-ax" x="' + (W - Rm) + '" y="' + (H - 2) + '" text-anchor="end">dias desde a publicação</text>';
    var tem = M.normal.some(function(x){ return x.v != null; });
    if (!tem) s += '<rect x="' + (Lm + 8) + '" y="' + (Tm + 8) + '" width="' + (PW - 8) + '" height="24" fill="url(#pcH)" class="pc-hb"/><text class="pc-hbt" x="' + (Lm + 16) + '" y="' + (Tm + 24) + '">' + (W < 520 ? 'sem a linha do normal' : 'sem a linha do normal: faltam vídeos medidos na mesma idade') + '</text>';
    /* curvas: primeiro as não escolhidas, por último a escolhida */
    var ordem = REC.map(function(v, i){ return i; }).sort(function(a, b){ return (a === ESC_V) - (b === ESC_V); });
    ordem.forEach(function(i){
      var v = REC[i], t = tier(v), on = i === ESC_V, d = v.pts.map(function(p, k){ return (k ? 'L' : 'M') + X(k).toFixed(1) + ' ' + Y(p).toFixed(1); }).join('');
      s += '<path class="pc-ln ' + t.cls + (on ? ' on' : '') + '" d="' + d + '"/>';
      var k2 = v.pts.length - 1; s += marcador(t.cls, X(k2).toFixed(1), Y(v.pts[k2]).toFixed(1), on ? 6 : 4.5);
      s += '<text class="pc-idx' + (on ? ' on' : '') + '" x="' + (X(k2) + 9).toFixed(1) + '" y="' + (Y(v.pts[k2]) - 4).toFixed(1) + '">' + (i + 1) + '</text>';
    });
    /* a linha do normal por cima, grossa */
    var pts = M.normal.filter(function(x){ return x.v != null; });
    if (pts.length) { s += '<path class="pc-ln med" d="' + pts.map(function(x, k){ return (k ? 'L' : 'M') + X(x.a).toFixed(1) + ' ' + Y(x.v).toFixed(1); }).join('') + '"/>'; pts.forEach(function(x){ s += '<circle class="pc-mk med" cx="' + X(x.a).toFixed(1) + '" cy="' + Y(x.v).toFixed(1) + '" r="4.5"/>'; }); }
    var v0 = REC[ESC_V];
    if (v0 && v0.rel) { var nm0 = M.normal.filter(function(x){ return x.a === v0.rel.a; })[0], px = X(v0.rel.a), py = Y(nm0.v * v0.rel.r); s += '<circle class="pc-pin" cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="10"/><text class="pc-pint" x="' + Math.min(px + 14, W - 70) + '" y="' + (py - 12).toFixed(1) + '">dia ' + v0.rel.a + ': ' + A.dec(v0.rel.r, 1) + '×</text>'; }
    s += '</svg>';
    host.innerHTML = s;
  }
  function desenhar72(){
    var host = document.getElementById('h72host'); if (!host) return;
    var W = Math.max(280, Math.floor(host.clientWidth || 600)), H = 120, Lm = 46, Rm = 12, Tm = 10, Bm = 28, PW = W - Lm - Rm, PH = H - Tm - Bm, mid = M.h72.metade;
    var lo = 1, hi = 80; for (var k = 0; k < 40; k++) { var tau = (lo + hi) / 2, f = (1 - Math.exp(-mid / tau)) / (1 - Math.exp(-72 / tau)); if (f > 0.5) lo = tau; else hi = tau; }
    function F(h){ return (1 - Math.exp(-h / tau)) / (1 - Math.exp(-72 / tau)); }
    function X(h){ return Lm + PW * h / 72; } function Y(v){ return Tm + PH * (1 - v); }
    var d = ''; for (var h = 0; h <= 72; h += 2) d += (h ? 'L' : 'M') + X(h).toFixed(1) + ' ' + Y(F(h)).toFixed(1);
    var s = '<svg class="pc-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc('Parte das views das primeiras 72 horas que já aconteceu em cada hora. Metade em ' + mid + ' horas.') + '">';
    [0, .5, 1].forEach(function(f2){ s += '<line class="ic-grid" x1="' + Lm + '" x2="' + (W - Rm) + '" y1="' + Y(f2) + '" y2="' + Y(f2) + '"/><text class="ic-ax" x="' + (Lm - 6) + '" y="' + (Y(f2) + 4) + '" text-anchor="end">' + Math.round(f2 * 100) + '%</text>'; });
    s += '<path class="pc-ln med" d="' + d + '"/><line class="pc-pub" x1="' + X(mid) + '" x2="' + X(mid) + '" y1="' + Y(.5) + '" y2="' + (Tm + PH) + '"/><circle class="pc-mk med" cx="' + X(mid) + '" cy="' + Y(.5) + '" r="5"/>';
    [0, 24, 48, 72].forEach(function(hh, i){ s += '<text class="ic-ax" x="' + X(hh) + '" y="' + (H - 8) + '" text-anchor="' + (i === 0 ? 'start' : i === 3 ? 'end' : 'middle') + '">' + (hh + ' h') + '</text>'; });
    host.innerHTML = s + '</svg>';
  }

  /* ---------------------------------------------------------------- bloco: linha do tempo */
  var IDX_SEL = DIA_SEL;
  var EVS = {}; m.ev.forEach(function(e){ (EVS[e.d] = EVS[e.d] || []).push(e); });
  function evTexto(e){ return e.tipo === 'pub' ? 'Publicou ' + (e.fmt === 'short' ? 'o Short ' : 'o vídeo ') + '“' + e.t + '”' : e.tipo === 'campo' ? 'Mudou ' + (e.campo === 'descrição' || e.campo === 'categoria' || e.campo === 'duração' ? 'a ' : 'as ') + e.campo + ' de “' + e.t + '”' : (e.troca === 't' ? 'Trocou o título' : 'Trocou a miniatura') + ' de “' + e.t + '” (troca ' + e.n + ')'; }
  function somaUltimos(k){ var xs = m.dias.filter(function(x){ return x.v != null && x.d <= fim; }).slice(-k); return xs.reduce(function(t, x){ return t + x.v; }, 0); }
  function fraseTempo(){
    var a = M.a, jan = m.dias.filter(function(x){ return x.d <= fim; }).slice(-28), cob = jan.filter(function(x){ return x.v != null; }).length;
    var vistas = jan.reduce(function(t, x){ return t + (x.v || 0); }, 0);
    var reg = c.regDesde, dentro = function(tp, soReg){ return m.ev.filter(function(e){ return e.tipo === tp && A.dias(e.d, fim) < 28 && (!soReg || e.d >= reg); }).length; };
    /* r4 (C2): "nesse tempo" conta só os dias com registro; o que saiu antes de o canal entrar na lista vem à parte */
    var pubsJ = m.ev.filter(function(e){ return e.tipo === 'pub' && A.dias(e.d, fim) < 28; }), pubsR = pubsJ.filter(function(e){ return e.d >= reg; });
    var npub = pubsR.length, antes = pubsJ.length - npub, ntro = dentro('troca'), ncam = dentro('campo');
    var nL = pubsR.filter(function(e){ return e.fmt === 'long'; }).length, nS = npub - nL;
    /* o registro de mudanças de campo e trocas começou em 03/10: onde ele não cobre a janela inteira, zero é "não medido" (B3) */
    var campoDesde = c.regDesde > D.INICIO ? c.regDesde : D.INICIO, parcial = campoDesde > jan[0].d, pnm = A.nm('não medido antes de ' + A.dm(campoDesde));
    var piso = parcial ? 'pelo menos ' : '';   /* r5 (S6): o registro de campo e troca começou em 03/10, então a contagem de uma janela que começa antes é um piso */
    var cam = ncam > 0 || !parcial ? piso + ptn(ncam, 'mudança de campo', 'mudanças de campo') : null, tro = ntro > 0 || !parcial ? piso + ptn(ntro, 'troca', 'trocas') : null;
    var pubs = ptn(npub, 'publicação', 'publicações') + (M.r.doisFmt && npub > 0 ? (nL && nS ? ' (' + ptn(nL, 'longo', 'longos') + ' e ' + ptn(nS, 'Short', 'Shorts') + ')' : nL ? ' (só longos)' : ' (só Shorts)') : ''), r, cauda = antes > 0 ? ' Antes de o canal entrar na lista: ' + ptn(antes, 'publicação', 'publicações') + (c.novo ? ', pelo que já foi buscado' : '') + '.' : '';
    if (cam == null && tro == null) r = pubs + '. Mudanças de campo e trocas: ' + pnm + '.';
    else { var itens = [pubs]; if (cam) itens.push(cam); if (tro) itens.push(tro); r = (itens.length === 3 ? itens[0] + ', ' + itens[1] + ' e ' + itens[2] : itens.join(' e ')) + '.' + (cam ? '' : ' Mudanças de campo: ' + pnm + '.') + (tro ? '' : ' Trocas: ' + pnm + '.'); }
    r += cauda;
    if (cob < 28) return '<b>' + mil(vistas) + ' views ganhas em ' + ptn(cob, 'dia', 'dias') + ' de registro</b> (a janela de 28 dias completa em ' + A.dm(A.addDias(c.regDesde, 27)) + '), sem os 28 anteriores para comparar. Nesse tempo: ' + r;
    if (a.nm || a.u == null) return '<b>' + mil(vistas) + ' views ganhas em 28 dias</b>, sem os 28 anteriores para comparar. Nesse tempo: ' + r;
    var d = dir(a.r);
    return sim(d.cls, d.sym) + '<span><b>' + mil(a.u) + ' views ganhas em 28 dias, ' + d.txt + ' sobre os 28 anteriores.</b> Nesse tempo: ' + r + (EST === 'erro' ? ' A linha termina em ' + A.dm(fim) + ', quando a leitura parou.' : '') + '</span>';
  }
  function tempo(){
    var temCorte = m.dias.some(function(x){ return x.d === D.COR; });
    var legs = '<span class="pc-lg"><i class="ic-sw imp" aria-hidden="true"></i>dia com views</span><span class="pc-lg"><i class="ic-sw zero" aria-hidden="true"></i>zero medido</span><span class="pc-lg"><i class="nm-h" aria-hidden="true"></i>sem registro</span>' +
      (EST === 'fora' ? '<span class="pc-lg"><i class="pc-sw pf" aria-hidden="true"></i>depois que saiu do YouTube</span>' : '') +
      '<span class="pc-lg"><i class="pc-sw pl" aria-hidden="true"></i>vídeo publicado</span><span class="pc-lg"><i class="pc-sw ps" aria-hidden="true"></i>Short publicado</span><span class="pc-lg"><i class="pc-sw pc2" aria-hidden="true"></i>mudança de campo</span>' +
      (m.ev.some(function(e){ return e.troca === 't'; }) ? '<span class="pc-lg"><i class="ic-sw trt" aria-hidden="true"></i>troca de título</span>' : '') + (m.ev.some(function(e){ return e.troca === 'm'; }) ? '<span class="pc-lg"><i class="ic-sw trm" aria-hidden="true"></i>troca de miniatura</span>' : '') +
      (temCorte ? '<span class="pc-lg"><i class="ic-sw pub" aria-hidden="true"></i>24/08: o YouTube mudou a contagem</span>' : '');
    var tabela = '<details class="ic-tab"><summary>Ver como tabela</summary><div class="ic-tw" role="region" tabindex="0" aria-label="Views ganhas por dia, tabela"><table><thead><tr><th scope="col">Dia</th><th scope="col" class="r">Views ganhas</th><th scope="col">Situação</th><th scope="col">O que aconteceu</th></tr></thead><tbody>' + m.dias.slice().reverse().map(function(x){
      return '<tr><th scope="row" class="num">' + A.dm(x.d) + '</th><td class="r num">' + (x.v == null ? A.nm('sem registro') : n(x.v)) + '</td><td>' + (x.e === 'com' ? 'com views' : x.e === 'zero' ? 'zero medido' : x.e === 'fora' ? 'saiu do YouTube' : 'sem registro') + '</td><td>' + (EVS[x.d] || []).map(function(e){ return esc(evTexto(e)); }).join('; ') + '</td></tr>'; }).join('') + '</tbody></table></div></details>';
    var corpo = '<div class="pc-sh"><h2 id="hTem">Linha do tempo: views por dia e o que mudou</h2>' + info('iTem', 'a linha do tempo', [
      ['Barras', 'views que o canal inteiro ganhou em cada dia, pela diferença do contador público (a mesma conta da direção). Inclui Shorts e vídeos apagados'],
      ['Janela', 'os últimos 90 dias; as marcas vêm das publicações, das mudanças de título, miniatura, descrição, tags, categoria e duração, registradas desde 03/10/2026'],
      ['Corte de 24/08/2026', 'o YouTube mudou a forma de contar views; antes dessa data os dias não se comparam com os de depois'],
      ['Sem playlists', 'esta fase não registra playlists, então não há raia delas'],
      ['Coincidência, não causa', 'a tela lista o que mudou perto de uma subida; não afirma que uma coisa causou a outra']
    ], 'Mudanças simultâneas não se separam, e o que acontece fora do YouTube não aparece.') + '</div>' +
      fr2(fraseTempo()) + '<div class="pc-chartw"><div id="temHost" class="pc-chart"></div></div><div class="pc-leg3" role="group" aria-label="Legenda da linha do tempo">' + legs + '</div>' +
      '<div class="ic-step"><button type="button" data-p="-1" aria-label="Dia anterior">' + A.L + '</button><p class="ic-out vazio" id="temOut" role="status" aria-live="polite"><span class="m">Passe o mouse sobre o gráfico ou use as setas para ler um dia.</span><span class="t">Use os botões para ler um dia de cada vez.</span></p><button type="button" data-p="1" aria-label="Dia seguinte">' + A.R + '</button></div>' + tabela;
    return '<section class="pc-sec" id="tempo" aria-labelledby="hTem">' + corpo + '</section>';
  }
  function falaDia(i){
    var x = m.dias[i], t = A.ds(x.d) + ': ' + (x.e === 'nm' ? 'sem registro neste dia' : x.e === 'fora' ? 'depois que o canal saiu do YouTube' : x.e === 'zero' ? 'nenhuma view ganha (zero medido)' : n(x.v) + ' views ganhas');
    var ev = (EVS[x.d] || []).map(evTexto); return t + (ev.length ? '. ' + ev.join('; ') + '.' : '.');
  }
  function desenharTempo(){
    var host = document.getElementById('temHost'); if (!host) return;
    var W = Math.max(280, Math.floor(host.clientWidth || 600)), N = m.dias.length, Lm = 58, Rm = 10, laneH = 17, T0 = 4, Tm = T0 + laneH * 3 + 8, BH = W < 520 ? 130 : 170, Bm = 26, PW = W - Lm - Rm, H = Tm + BH + Bm;
    var mx = 10; m.dias.forEach(function(x){ if (x.v) mx = Math.max(mx, x.v); }); var ym = nice(mx * 1.05);
    function X(i){ return Lm + PW * (i + 0.5) / N; } function Y(v){ return Tm + BH * (1 - v / ym); }
    var bw = Math.max(1.6, PW / N - (W < 520 ? 0.7 : 1.4));
    var s = '<svg class="pc-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc('Views que o canal ganhou por dia nos últimos 90 dias, com as publicações, as mudanças de campo e as trocas marcadas acima. Os dias estão na tabela abaixo.') + '">' + defs('pcH2');
    [0, .5, 1].forEach(function(f){ s += '<line class="ic-grid" x1="' + Lm + '" x2="' + (W - Rm) + '" y1="' + Y(ym * f) + '" y2="' + Y(ym * f) + '"/><text class="ic-ax" x="' + (Lm - 6) + '" y="' + (Y(ym * f) + 4) + '" text-anchor="end">' + eixoV(ym * f) + '</text>'; });
    /* trechos sem registro e depois da saída: um retângulo por trecho */
    var i = 0;
    while (i < N) {
      var e = m.dias[i].e; if (e !== 'nm' && e !== 'fora') { i++; continue; }
      var j = i; while (j + 1 < N && m.dias[j + 1].e === e) j++;
      var x0 = X(i) - PW / N / 2, w = X(j) - X(i) + PW / N;
      s += '<rect x="' + x0.toFixed(1) + '" y="' + Tm + '" width="' + w.toFixed(1) + '" height="' + BH + '" class="' + (e === 'nm' ? 'pc-nmr' : 'pc-forar') + '"' + (e === 'nm' ? ' fill="url(#pcH2)"' : '') + '/>';
      if (w > 56) s += '<text class="pc-nmt' + (e === 'fora' ? ' fora' : '') + '" x="' + (x0 + w / 2).toFixed(1) + '" y="' + (Tm + BH / 2 + 4) + '" text-anchor="middle">' + (e === 'nm' ? (EST === 'erro' && i > 40 ? (w > 120 ? 'sem registro: canal em erro' : 'sem registro') : 'sem registro') : 'saiu do YouTube em ' + A.dm(c.foraEm)) + '</text>';
      i = j + 1;
    }
    m.dias.forEach(function(x, k){
      if (x.e === 'com') s += '<rect class="ic-bar" x="' + (X(k) - bw / 2).toFixed(1) + '" y="' + Y(x.v).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, Tm + BH - Y(x.v)).toFixed(1) + '"/>';
      else if (x.e === 'zero') s += '<rect class="ic-zero" x="' + (X(k) - bw / 2).toFixed(1) + '" y="' + (Tm + BH - 5) + '" width="' + bw.toFixed(1) + '" height="4"/>';
    });
    var kc = m.dias.findIndex(function(x){ return x.d === D.COR; });
    if (kc >= 0) { var xc = X(kc) - PW / N / 2; s += '<line class="ic-pub" x1="' + xc.toFixed(1) + '" x2="' + xc.toFixed(1) + '" y1="' + Tm + '" y2="' + (Tm + BH) + '"/><text class="ic-publ pc-cutl" x="' + (xc + 5).toFixed(1) + '" y="' + (Tm + 13) + '">24/08</text>'; }
    /* raias: publicações, mudanças de campo, trocas */
    var ly = [T0 + laneH / 2, T0 + laneH * 1.5, T0 + laneH * 2.5];
    function pl(x, y){ return '<circle class="pc-m pl" cx="' + x + '" cy="' + y + '" r="4"/>'; } function ps(x, y){ return '<circle class="pc-m ps" cx="' + x + '" cy="' + y + '" r="3"/>'; } function pc(x, y){ return '<rect class="pc-m pc2" x="' + (x - 4) + '" y="' + (y - 4) + '" width="8" height="8"/>'; }
    function tt(x, y){ return '<polygon class="pc-m tr" points="' + x + ',' + (y - 5.5) + ' ' + (x + 5.5) + ',' + y + ' ' + x + ',' + (y + 5.5) + ' ' + (x - 5.5) + ',' + y + '"/>'; } function tm(x, y){ return '<polygon class="pc-m tr" points="' + x + ',' + (y - 5) + ' ' + (x + 5.5) + ',' + (y + 4.5) + ' ' + (x - 5.5) + ',' + (y + 4.5) + '"/>'; }
    ['Vídeos', 'Campos', 'Trocas'].forEach(function(t, k){ s += '<text class="ic-ax" x="4" y="' + (ly[k] + 4) + '" aria-hidden="true">' + t + '</text>'; });   /* r5 (S3): rótulo da raia no lugar das cinco marcas de exemplo */
    [0, 1, 2].forEach(function(k){ s += '<line class="ic-grid" x1="' + Lm + '" x2="' + (W - Rm) + '" y1="' + (T0 + laneH * (k + 1)) + '" y2="' + (T0 + laneH * (k + 1)) + '"/>'; });
    m.dias.forEach(function(x, k){
      (EVS[x.d] || []).forEach(function(e){ var xx = +X(k).toFixed(1); s += e.tipo === 'pub' ? (e.fmt === 'short' ? ps(xx, ly[0]) : pl(xx, ly[0])) : e.tipo === 'campo' ? pc(xx, ly[1]) : e.troca === 't' ? tt(xx, ly[2]) : tm(xx, ly[2]); });
    });
    for (var k2 = N - 1; k2 >= 0; k2 -= (W < 520 ? 21 : 15)) { var ult = k2 === N - 1; s += '<text class="ic-ax" x="' + X(k2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (ult ? 'end' : 'middle') + '">' + A.dm(m.dias[k2].d) + '</text>'; }
    /* colunas de leitura de um dia */
    m.dias.forEach(function(x, k){ s += '<rect class="ic-hit" data-i="' + k + '" x="' + (X(k) - PW / N / 2).toFixed(1) + '" y="' + T0 + '" width="' + (PW / N).toFixed(1) + '" height="' + (Tm + BH - T0) + '"/>'; });
    host.innerHTML = s + '</svg>';
    var out = document.getElementById('temOut'), hits = host.querySelectorAll('.ic-hit');
    function pr(i){ if (i < 0 || i >= N) return; IDX_SEL = i; hits.forEach(function(h, k){ h.classList.toggle('on', k === i); }); out.classList.remove('vazio'); out.textContent = falaDia(i); }
    hits.forEach(function(h){ h.addEventListener('click', function(){ pr(+h.getAttribute('data-i')); }); h.addEventListener('mousemove', function(){ pr(+h.getAttribute('data-i')); }); });
    if (!host._kb) { host._kb = true; host.setAttribute('tabindex', '0'); host.setAttribute('role', 'group'); host.setAttribute('aria-label', 'Linha do tempo: as setas andam de dia em dia'); host.addEventListener('keydown', function(ev){ var d = ev.key === 'ArrowLeft' ? -1 : ev.key === 'ArrowRight' ? 1 : 0; if (!d) return; ev.preventDefault(); pr(Math.max(0, Math.min(N - 1, (IDX_SEL < 0 ? N : IDX_SEL) + d))); }); }
    if (IDX_SEL >= 0) pr(IDX_SEL);
    var passo = document.querySelectorAll('#tempo .ic-step button');
    passo.forEach(function(b){ if (b._ok) return; b._ok = true; b.addEventListener('click', function(){ pr(Math.max(0, Math.min(N - 1, (IDX_SEL < 0 ? N : IDX_SEL) + (+b.getAttribute('data-p'))))); }); });
  }

  /* ---------------------------------------------------------------- bloco: ritmo */
  function casaSemana(k, mx, nmv){
    if (nmv) { var por = c.novo ? 'ainda não buscada' : 'sem leitura desde ' + A.dm(fim); return '<li class="pc-cs nm" title="' + por + '"><span class="pc-nmg" aria-hidden="true">—</span><span class="sr">não medido: ' + por + '</span></li>'; }
    if (k === 0) return '<li class="pc-cs zero"><span class="pc-zero num" aria-hidden="true">0</span><span class="sr">nenhuma publicação</span></li>';
    return '<li class="pc-cs com"><b class="num">' + k + '</b><span class="pc-csb" style="height:' + (6 + 34 * k / mx).toFixed(0) + 'px"></span></li>';
  }
  /* r6 (S6): nos canais que pararam de ser lidos, a semana sem leitura aparece como "—" em Ritmo; o vídeo dela conta nos 90 dias, e a frase diz isso */
  function notaSemLeitura(nu){
    if (c.novo) return '';
    var vis = 0; M.r.semL.forEach(function(k, i){ if (!M.r.nmL[i]) vis += k; });
    return nu > vis ? '; ' + (nu - vis === 1 ? '1 deles' : (nu - vis) + ' deles') + ' na semana sem leitura' : '';
  }
  function ritmo(){
    var r = M.r, mx = Math.max(3, Math.max.apply(null, r.semL.concat(r.semS)));
    /* B2: semana sem publicação que termina depois da última leitura (erro, fora do ar) ou que o canal novo ainda não buscou é "não medido", nunca zero */
    var linhaF = function(rot, arr, nmA){ return '<div class="pc-sem"><b class="pc-semr">' + rot + '</b><ol class="pc-cs-l" aria-label="' + esc('Publicações por semana, ' + rot + ', das 13 últimas semanas') + '">' + arr.map(function(k, i){ return casaSemana(k, mx, nmA[i]); }).join('') + '</ol></div>'; };
    var principal = r.fmt === 'long' ? 'Longos' : 'Shorts', outro = r.fmt === 'long' ? 'Shorts' : 'Longos', semOutro = r.semS.every(function(x){ return x === 0; });
    var linhas = linhaF(principal, r.semL, r.nmL) + (semOutro && c.soShorts ? '<div class="pc-sem"><b class="pc-semr">Longos</b><p class="pc-semz"><span class="pc-zero num" aria-hidden="true">0</span>nenhum vídeo longo nas 13 semanas</p></div>' : linhaF(outro, r.semS, r.nmS));
    var fr, fmtUm = r.fmt === 'long' ? 'um longo' : 'um Short', fmtUm1 = r.fmt === 'long' ? 'longo' : 'Short', fmtPl = r.fmt === 'long' ? 'longos' : 'Shorts';
    if (r.nm) fr = '<b>Ritmo ' + (c.ritmoParcial ? 'parcial' : 'ainda sem base') + ':</b> ' + esc(r.nm) + '. As casas abaixo mostram o que já foi buscado.';
    else fr = '<b>' + (EST === 'parado' ? 'Publicou ' : 'Publica ') + A.dec(r.porSemana, 1) + ' ' + (r.fmt === 'long' ? 'vídeos longos' : 'Shorts') + ' por semana' + (EST === 'parado' ? ' nas últimas 13 semanas' : '') + ',</b> e teve ' + fmtUm + ' em <b class="num">' + r.semCom + ' de ' + r.semMed + '</b> semanas' + (r.semMed < 13 ? ' com leitura' : '') + '. ' + (r.buraco ? (r.buraco.aberto ? 'O maior intervalo sem publicar ' + fmtUm + ', em 26 semanas, é o que começou em ' + A.dm(r.buraco.de) + ' e ainda não acabou: ' + ptn(r.buraco.d, 'dia', 'dias') + (fim < hoje ? ', até ' + A.dm(fim) : '') + '.' : 'O maior intervalo sem publicar ' + fmtUm + ', em 26 semanas, foi de ' + ptn(r.buraco.d, 'dia', 'dias') + '.') : '');
    /* régua de dias sem publicar contra o limite de "parado" */
    var desde = r.desde, lim = r.limite, esc2 = Math.max(lim * 1.25, (desde || 0) * 1.12), passou = desde != null && desde > lim;
    var reguaP = desde == null ? '' : '<div class="pc-par"><div class="pc-dl"><b>Dias desde o último vídeo' + (r.doisFmt ? ' (longo ou Short)' : '') + '</b><span>vira “parado” depois de ' + lim + ' dias' + (r.mediana && !r.nm && 4 * r.mediana > 28 ? ' (4 × o intervalo típico, ' + umDia(r.mediana) + ' dias)' : '') + '</span></div><div class="pc-rp" role="img" aria-label="' + esc(ptn(desde, 'dia', 'dias') + (r.doisFmt ? ' sem publicar longo nem Short' : ' sem publicar') + (fim < hoje ? ', até ' + A.dm(fim) : '') + '; o limite para “parado” é ' + lim + ' dias') + '"><span class="pc-rp-f' + (passou ? ' dn' : '') + '" style="width:' + Math.min(100, 100 * desde / esc2).toFixed(1) + '%"></span><span class="pc-rp-l" style="left:' + (100 * lim / esc2).toFixed(1) + '%"><i></i><em>' + lim + ' dias</em></span></div><div class="pc-dv">' + (passou ? sim('dn', '‖') : '') + '<span class="pc-dvx"><b class="num' + (passou ? ' dn' : '') + '">' + desde + (desde === 1 ? ' dia' : ' dias') + '</b>' + (fim < hoje ? '<small>até ' + A.dm(fim) + '</small>' : c.novo ? '<small>pelo que já foi buscado</small>' : '') + '</span></div></div>';
    var mets = '<ul class="pc-mets"><li><span>Intervalo típico (valor do meio)</span>' + (r.mediana == null || r.nm ? A.nm('não medido') : '<b class="num">' + umDia(r.mediana) + ' ' + (r.mediana === 1 ? 'dia' : 'dias') + '</b>') + '</li><li><span>Semanas com ' + fmtUm + '</span>' + (r.nm && !c.ritmoParcial ? A.nm() : '<b class="num">' + r.semCom + ' de ' + r.semMed + '</b>' + (r.semMed < 13 ? '<small>semanas com leitura</small>' : '')) + '</li><li><span>Maior buraco entre ' + fmtPl + ' (26 semanas)</span>' + (r.buraco && !r.nm ? '<b class="num">' + ptn(r.buraco.d, 'dia', 'dias') + '</b><small class="num">' + (r.buraco.aberto ? 'sem ' + fmtUm1 + ' desde ' + A.dm(r.buraco.de) + (fim < hoje ? ', até ' + A.dm(fim) : '') : A.dm(r.buraco.de) + ' a ' + A.dm(r.buraco.ate)) + '</small>' : A.nm()) + '</li></ul>';
    var corpo = '<div class="pc-sh"><h2 id="hRit">Ritmo e regularidade</h2>' + info('iRit', 'o ritmo e a regularidade', [
      ['Casas', 'uma por semana, das 13 últimas, com o número de publicações do formato da raia; caixa vazada com 0 é semana medida sem publicação; hachura com “—” é semana não medida (ainda não buscada, ou que termina depois da última leitura)'],
      ['Intervalo mediano', 'mediana dos dias entre uma publicação e a seguinte, no formato principal, nas últimas 13 semanas'],
      ['Semanas com um longo (ou um Short)', 'quantas das 13 semanas tiveram pelo menos um vídeo do formato principal: longo, ou Short em canal só de Shorts. O outro formato aparece na raia de baixo e não entra nesta conta. A semana que termina depois da última leitura fica fora, nas duas raias'],
      ['Maior buraco', 'o maior intervalo, em dias, entre duas publicações do formato principal (longos, ou Shorts em canal só de Shorts) nas últimas 26 semanas; conta também o intervalo ainda aberto, do último vídeo até hoje (ou até a última leitura), então nunca fica menor que os dias desde o último vídeo'],
      ['Parado', 'dias desde o último vídeo maiores que o maior entre 28 e 4 vezes o intervalo mediano; sem ritmo medido, vale só o piso de 28 dias'],
      ['Não medido', 'menos de 4 vídeos do formato principal na janela (3 intervalos), ou canal ainda buscando vídeos']
    ], 'Vídeo apagado some da conta nos dados anteriores a 03/10/2026; a estreia conta pela data de publicação. Canal sazonal parece parado.') + '</div>' +
      fr2(fr) + '<div class="pc-sems">' + linhas + '<p class="pc-eixo"><span>há 13 semanas</span><span>' + (fim < hoje ? 'semana de ' + A.dm(A.addDias(hoje, -6)) : 'esta semana') + '</span></p></div>' + reguaP + mets;
    return '<section class="pc-sec" id="ritmo" aria-labelledby="hRit">' + corpo + '</section>';
  }

  /* ---------------------------------------------------------------- bloco: o que o criador respondeu */
  function criador(){
    var rs = M.resp || c.resp, corpo, cab = '<div class="pc-sh"><h2 id="hCri">O que o criador respondeu</h2>' + info('iCri', 'as respostas do criador', [
      ['Base', 'vídeos longos publicados nos últimos 90 dias que já têm ' + D.DIAS_COMENT + ' dias de comentários guardados (idade de ' + D.DIAS_COMENT + ' a ' + (D.MAX_IDADE_RESP - 1) + ' dias; cerca de 12 comentários por vídeo, escolhidos pelo YouTube)'],
      ['Conta', 'em quantos desses vídeos vimos pelo menos uma resposta do criador. Percentual só com 10 vídeos ou mais; menos de 5, não medido'],
      ['Piso', 'só vemos as respostas entre os comentários guardados: “não vimos resposta” não quer dizer que ele não respondeu']
    ], 'O texto dos comentários é de terceiros e aparece como veio; endereço dentro dele é texto, nunca link.') + '</div>';
    if (rs.nm) {
      var desl = rs.desligados;
      /* uma frase e a pastilha; o motivo só vem separado quando a frase não o diz (C4) */
      corpo = fr2('<b>' + (desl ? 'Os comentários estão desligados pelo canal.' : EST === 'fora' ? 'Sem comentários para ler: o canal saiu do YouTube.' : 'Ainda não dá para dizer se o criador responde.') + '</b>') + (desl || EST === 'fora' ? A.nm() : A.nml(esc(rs.nm) + (rs.quando ? ' (precisa de 5 vídeos com ' + D.DIAS_COMENT + ' dias de comentários)' : '')));
    } else if (rs.k === 0) {
      corpo = fr2('<span class="pc-zero num" aria-hidden="true">0</span><span><b>Não vimos resposta do criador em nenhum dos ' + rs.n + ' vídeos.</b> É um zero medido: os comentários guardados foram conferidos e nenhum traz resposta dele.</span>');
    } else {
      var casas = ''; for (var i = 0; i < rs.n; i++) casas += '<i class="pc-rq ' + (i < rs.k ? 'sim' : 'nao') + '"></i>';
      corpo = fr2('<b>Vimos resposta do criador em <span class="num">' + rs.k + ' de ' + rs.n + '</span> vídeos.</b> É um piso: só conta o que aparece entre os comentários guardados.') + '<div class="pc-rqs" role="img" aria-label="' + rs.k + ' de ' + rs.n + ' vídeos com resposta vista"><span class="pc-rql">' + casas + '</span><span class="pc-rqt"><i class="pc-rq sim"></i>resposta vista <i class="pc-rq nao"></i>não vimos resposta</span></div>';
      if (RO) corpo += '<div class="pc-ro-box">' + L.IC.canal + '<p><b>Você vê a contagem, não o texto.</b> O texto dos comentários e das respostas só aparece para quem edita o site ou tem o direito de ver desempenho privado.</p></div>';
      else corpo += '<ul class="pc-cm">' + m.coment.map(function(x){ return '<li><p class="pc-cmv">' + esc(x.v) + ' · comentário de há ' + ptn(x.dias, 'dia', 'dias') + '</p><div class="pc-cmb"><span class="pc-cma" aria-hidden="true">' + x.quem + '</span><p dir="auto">' + esc(x.texto) + '</p></div><div class="pc-cmr"><span class="chip own">criador</span><p dir="auto">' + esc(x.resp) + '</p></div></li>'; }).join('') + '</ul>';
    }
    return '<section class="pc-sec" id="criador" aria-labelledby="hCri">' + cab + corpo + '</section>';
  }

  /* ---------------------------------------------------------------- casca, faixas de aviso e referência */
  function faixas(){
    var s = '';
    var ex = c.simulacao ? '<span class="ex">simulação</span><span>Como esta tela ficará em ' + A.dmy(hoje) + ', com sete meses de dados. Hoje (13/10/2026) quase tudo que é novo aqui está “não medido”: veja o caso Magro. Nomes e números inventados.</span>' : '<span class="ex">exemplo</span><span>Nomes e números inventados. Hoje, 13/10/2026, a contagem por vídeo vai de ' + A.dm(D.INICIO) + ' a ' + A.dm(hoje) + ' (' + ptn(A.dias(D.INICIO, hoje) + 1, 'dia', 'dias') + ')' + (c.regDesde > D.INICIO ? '; neste canal, só desde ' + A.dm(c.regDesde) + ' (' + ptn(A.dias(c.regDesde, fim) + 1, 'dia', 'dias') + ')' : '') + ', por isso o que é novo aparece quase todo “não medido”.</span>';
    s += '<p class="exband">' + ex + '</p>';
    if (EST === 'erro') s += '<div class="pc-ban erro" role="status"><span class="er-p aviso">' + L.IC.envelope + '<span>Em erro há ' + horasErro() + ' dias</span></span><p><span class="er-quem voce"><i class="er-qs" aria-hidden="true"></i>Precisa de você:</span> o YouTube diz que este canal não existe (erro 404). Pode ter sido apagado ou ter mudado de endereço. Os números valem até ' + A.dm(fim) + '.</p>' + (RO ? '' : '<span class="btn">Sincronizar agora</span>') + '</div>';
    if (EST === 'fora') s += '<div class="pc-ban fora" role="status"><span class="pc-est fora">' + L.IC.x + '<span>Saiu do YouTube em ' + A.dm(c.foraEm) + '</span></span><p>O YouTube não diz o motivo. O canal continua aqui com tudo o que tínhamos, sem link para o YouTube.</p><span class="btn">Ver em “Saíram do YouTube”</span></div>';
    if (c.novo) s += '<div class="pc-ban novo" role="status"><div class="pc-bw"><p><b>Primeira busca em andamento:</b> <span class="num">' + m.buscados + ' de ' + m.totalVideos + '</span> vídeos já buscados.</p>' + progresso(m.buscados, m.totalVideos, 'vídeos buscados', 'vídeos') + '</div></div>';
    return s;
  }
  function pe(){
    var cores = '<table class="pc-ref"><caption>Cor e símbolo por significado (o mesmo em toda tela)</caption><thead><tr><th scope="col">Significado</th><th scope="col">Forma</th><th scope="col">Onde aparece nesta tela</th></tr></thead><tbody>' +
      '<tr><td>Subindo</td><td><b class="pc-sim up">▲</b> verde</td><td>direção, frase do topo</td></tr><tr><td>Sem mudança</td><td><b class="pc-sim eq">＝</b> cinza</td><td>de −10% a +10%</td></tr><tr><td>Descendo e parado</td><td><b class="pc-sim dn">▼</b> âmbar (sem vermelho)</td><td>direção; estado “parado”: <span class="pc-est parado">' + L.IC.pausa + '<span>Parado</span></span></td></tr>' +
      '<tr><td>Não medido</td><td><span class="nm-h"></span> rosa com hachura</td><td>célula, trecho do eixo, casa da semana, casa do n</td></tr><tr><td>Zero medido</td><td><span class="pc-zero num">0</span> caixa vazada</td><td>semana sem publicação, 0 de N</td></tr><tr><td>Ainda não chegou</td><td><span class="pc-pg" style="width:140px;height:10px"><span class="pc-pg-f" style="width:30%"></span><span class="pc-pg-r"></span></span> contorno pontilhado</td><td>resto da barra de progresso</td></tr>' +
      '<tr><td>Desempenho de um vídeo novo</td><td>◆ topo · ■ alto · ● normal · ○ abaixo</td><td>curvas e lista de Lançamentos (○ só aqui)</td></tr><tr><td>Acerto de um vídeo</td><td>◆ 2× ou mais · ● no meio · × 0,5× ou menos</td><td>pontinhos da célula Acerto</td></tr><tr><td>Erro</td><td><span class="er-p aviso">' + L.IC.envelope + '<span>Em erro há 9 dias</span></span></td><td>faixa do erro (a tela C do lote 1)</td></tr><tr><td>Fora do ar</td><td><span class="pc-est fora">' + L.IC.x + '<span>Saiu do YouTube</span></span> tracejado neutro</td><td>pastilha e faixa (a tela E do lote 1)</td></tr></tbody></table>';
    return L.fora('Cores, símbolos e telas vizinhas', cores + vizinho());
  }
  function vizinho(){ return '<p class="pc-viz"><b>Vídeos do canal</b> continuam logo abaixo da tela, como já existem na página aprovada em 07/10: abas, filtros e lista de vídeos. Este mockup não os redesenha.</p>'; }
  function nav(){ return '<nav class="pc-nav" aria-label="Nesta página"><a href="#direcao">Direção</a><a href="#lancamentos">Lançamentos</a><a href="#tempo">Linha do tempo</a><a href="#ritmo">Ritmo</a><a href="#criador">O que o criador respondeu</a></nav>'; }

  /* ---------------------------------------------------------------- montar */
  var CASOS = [['magro', 'Magro (hoje, o caso real)'], ['cheio', 'Cheio (simulação mai/2027)'], ['extremo', 'Extremo: queda sustentada'], ['parado', 'Parado'], ['zero', 'Zero medido'], ['nm', 'Não medido'], ['erro', 'Erro'], ['vazio', 'Sem dado: recém-cadastrado'], ['fora', 'Fora do ar'], ['shorts', 'Só Shorts'], ['nichos', 'Nichos diferentes'], ['leitura', 'Só leitura']];
  var barra = L.barra([{ rotulo: 'Estado', param: 'caso', itens: CASOS, padrao: 'magro' }], 'Padrão: <b>Magro</b>, o caso real de hoje. Os três “simulação” mostram a tela em 12/05/2027. O vídeo de Lançamentos pode ser escolhido na própria tela; o dia da linha do tempo, com o mouse ou as setas.');
  barra.aberta = true;
  var corpo = A.migalha([['Canais', '#'], [c.nome, '#']]) + faixas() + cabecalho() + nav() + L.novo(direcao(), 'novo') + L.novo(lancamentos(), 'novo') + L.novo(tempo(), 'novo') + L.novo(ritmo(), 'novo') + L.novo(criador(), 'novo');
  A.moldura({ titulo: 'Página do canal de concorrente: ' + c.nome, barra: barra, corpo: corpo, fora: pe() });
  var tpl = document.createElement('div'); tpl.innerHTML = infos.join(''); document.body.appendChild(tpl);
  A.ligarInfos();
  function tudo(){ desenharLanc(); desenhar72(); desenharTempo(); }
  tudo();
  document.querySelectorAll('.pc-vb').forEach(function(b){ b.addEventListener('click', function(){
    ESC_V = +b.getAttribute('data-v');
    document.querySelectorAll('.pc-vb').forEach(function(x){ var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
    document.getElementById('lanFr').innerHTML = '<span>' + fraseLanc() + '</span>'; desenharLanc();
  }); });
  var t0; window.addEventListener('resize', function(){ clearTimeout(t0); t0 = setTimeout(tudo, 120); });
  var h1 = document.querySelector('.pc-cab h1'); if (h1) h1.id = 'h1';
})();

/* Cartão "Leitura da forja" — compartilhado pela aba Leitura do canal e pela seção Leitura do vídeo.
   Spec: §7.1 (cartão), §7.2 (situações), §11 linhas 9 e 14. Só desenha; todo número sai de dados.js.
   TODO TEXTO DE LEITURA DAQUI É ESCRITO PARA O MOCKUP (a forja nunca produziu uma leitura real) e vai sempre marcado "exemplo".
   Escopo honesto: de concorrente só views públicas, títulos, thumbnails, datas e trocas. Nada de CTR, retenção, impressões, curtidas ou comentários. */
(function(){
  'use strict';
  var C = window.CANAL, F = C.fmt, NOW = C.NOW, MIN = 6e4;
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function hhmm(ms){ return F.dataHora(ms).slice(-5); }
  function ico(d){ return '<svg class="i" viewBox="0 0 16 16" aria-hidden="true">' + d + '</svg>'; }
  var IC = {
    clock: ico('<circle cx="8" cy="8" r="6"/><path d="M8 4.8V8l2.2 1.4"/>'),
    clockw: ico('<circle cx="8" cy="7.2" r="5.2"/><path d="M8 4.4v3l2 1.2M8 13.6v.2"/>'),
    ok: ico('<circle cx="8" cy="8" r="6"/><path d="M5.2 8.2l1.9 1.9 3.7-3.9"/>'),
    warn: ico('<path d="M8 2.2l6.2 11H1.8zM8 6.5v3.2M8 11.6v.2"/>'),
    stale: ico('<path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5V5.2h-2.7M8 5.2V8l1.8 1.2"/>'),
    info: ico('<circle cx="8" cy="8" r="6"/><path d="M8 7.2v3.6M8 5.1v.2"/>')
  };

  /* ---------------------------------------------------------------- as situações (spec 7.2) */
  var ESTADOS = [
    ['nunca', 'Nunca pedida'], ['fila', 'Pedida: na fila'], ['pronta', 'Pronta'], ['desatualizada', 'Pronta, desatualizada'], ['falhou', 'Falhou']
  ];
  var VARIANTES = [
    ['trabalhando', 'Escrevendo'], ['retry', 'Nova tentativa'], ['liberado', 'Liberado sozinho'], ['atraso', 'Com atraso'], ['semmaquina', 'Forja desligada'],
    ['limite', 'Pronta, limite do dia'], ['precisa', 'Precisa de você (dado velho)'], ['travou', 'Falhou: travou 3 vezes'], ['semevid', 'Falhou: sem evidências'], ['hoje', 'Canal: como é hoje (sem 7.3)']
  ];
  var VALIDOS = ESTADOS.concat(VARIANTES).map(function(x){ return x[0]; });
  var EM_ANDAMENTO = ['fila', 'trabalhando', 'retry', 'liberado', 'atraso', 'semmaquina'];

  /* ---------------------------------------------------------------- estado e simulação do botão */
  var est = 'nunca', cfg = { onChange: function(){}, say: function(){}, toast: function(){} }, mounts = [], timers = [], pausado = false, pendente = null, simulando = false, ajuda = null, emTreino = false;
  function limpaTimers(){ timers.forEach(clearTimeout); timers = []; }
  function set(e, o){
    o = o || {};
    if (VALIDOS.indexOf(e) < 0) e = 'nunca';
    est = e; limpaTimers(); pendente = null; if (!o.mantemSim) simulando = false;
    if (!o.silencioso) cfg.onChange(e);
    refresh(o.foco);
  }
  function pedir(){
    simulando = true; set('fila', { mantemSim: true, foco: true });
    cfg.say('Pedido enviado. Aguardando: na fila.');
    agendar('trabalhando', 2200, 'Aguardando: a forja está escrevendo.');
  }
  function agendar(prox, ms, fala){
    timers.push(setTimeout(function(){
      if (pausado){ pendente = { prox: prox, fala: fala }; return; }
      avancar(prox, fala);
    }, ms));
  }
  function avancar(prox, fala){
    est = prox; cfg.onChange(prox); cfg.say(fala); refresh();
    if (prox === 'trabalhando') agendar('pronta', 2800, 'Pronta: leitura publicada.');
    else if (prox === 'pronta'){ simulando = false; refresh(); }
  }

  /* ---------------------------------------------------------------- evidências: [[chave]] no texto vira número em link, na ordem em que aparece */
  function montar(txt, evid, href){
    var ordem = [];
    var html = txt.replace(/\[\[(\w+)\]\]/g, function(_, k){
      var e = evid[k]; if (!e) return '';
      var n = -1; ordem.forEach(function(o, i){ if (evid[o] === e) n = i; }); if (n < 0){ ordem.push(k); n = ordem.length - 1; }
      return '<a class="fn" href="' + esc(href(e.video, e.troca, e.sec)) + '" data-video="' + e.video + '"' + (e.troca ? ' data-troca="' + e.troca + '"' : '') + ' data-go aria-label="Evidência ' + (n + 1) + ': ' + esc(e.rotulo) + '"><sup>' + (n + 1) + '</sup></a>';
    });
    return { html: html, ordem: ordem };
  }

  /* ---------------------------------------------------------------- texto da leitura do CANAL (exemplo) */
  function viewsEm(v, corte){
    if (corte === Infinity || !v.serie || (v.chk != null && corte >= v.chk)) return v.views;
    var dia = new Date(corte - 3 * 36e5).toISOString().slice(0, 10), x = null;
    v.serie.forEach(function(p){ if (p[0] <= dia) x = p[1]; });
    return x == null ? v.views : x;
  }
  function janelaMs(t){
    var m = t.janela && t.janela.match(/(\d\d)h e (?:\d\d\/\d\d )?(\d\d)h/); if (!m) return 0;
    return /h e \d\d\/\d\d /.test(t.janela) ? 24 * 36e5 : (+m[2] - +m[1]) * 36e5;
  }
  function trocaRotulo(t){ return (t.campo === 'titulo' ? 'Título trocado' : 'Thumbnail trocada') + ' em ' + F.data(t.ms) + ' em “' + C.porId(t.video).t + '”'; }
  function notaTroca(t){
    return t.campo === 'titulo' ? 'Título trocado em ' + F.data(t.ms) + ' (' + t.janela + ').' : 'Thumbnail trocada em ' + F.dataHora(t.ms) + '; a imagem anterior não foi arquivada.';
  }
  function semVariacao(t, corte){
    var idade = (Math.min(corte, NOW) - t.ms) / 864e5;
    return idade < 7 ? 'aguardando' : 'sem-serie';
  }
  /* views/dia nos dias de registro ANTES da troca. Só existe quando a série tem pelo menos 2 registros antes dela. */
  function antes(v, ms){
    if (!v.serie) return null;
    var pts = v.serie.filter(function(p){ return Date.parse(p[0] + 'T15:00:00Z') <= ms; });
    if (pts.length < 2) return null;
    var d = pts.length - 1, ganhas = pts[pts.length - 1][1] - pts[0][1];
    return { vpd: ganhas / d, dias: d, ate: F.data(Date.parse(pts[pts.length - 1][0] + 'T15:00:00Z')) };
  }
  function prontoCanal(T, corte){
    var m = 0; T.forEach(function(t){ if (semVariacao(t, corte) !== 'aguardando') return; var c = window.HM && window.HM.video(t.video).changes.filter(function(x){ return x.at === t.ms; })[0]; var r = c ? window.HM.effect(c.id).readyOn : t.ms + 7 * 864e5; if (r > m) m = r; });
    return m || corte;
  }
  function leituraCanal(corte){
    var V = C.videos, T = C.trocas.filter(function(t){ return t.ms <= corte; }), B = C.base;
    var longos = V.filter(function(v){ return v.fmt === 'long' && v.views != null && !v.pinAntigo; }).sort(function(a, b){ return viewsEm(b, corte) - viewsEm(a, corte); });
    var shorts = V.filter(function(v){ return v.fmt === 'short' && v.views != null; }).sort(function(a, b){ return b.views - a.views; });
    var top = longos[0], tp = shorts[0], med = B.long.med;
    var nTit = T.filter(function(t){ return t.campo === 'titulo'; }).length, nTh = T.length - nTit;
    var porVideo = {}; T.forEach(function(t){ (porVideo[t.video] = porVideo[t.video] || []).push(t); });
    var ids = Object.keys(porVideo), rep = ids.filter(function(i){ return porVideo[i].length > 1; })[0];
    var tTop = (porVideo[top.id] || []).filter(function(t){ return t.campo === 'titulo'; })[0];
    var agu = T.filter(function(t){ return semVariacao(t, corte) === 'aguardando'; }).length;
    var h = C.cabecalho, ev = {};
    ev.top = { video: top.id, sec: 'resumo', rotulo: top.t, nota: F.num(viewsEm(top, corte)) + ' views; a mediana dos longos do canal é ' + F.num(med) + '.' };
    ev.short = { video: tp.id, sec: 'resumo', rotulo: tp.t, nota: 'Short mais visto: ' + F.num(tp.views) + ' views.' };
    if (rep){
      porVideo[rep].forEach(function(t, i){ ev['rep' + i] = { video: t.video, troca: t.ms, rotulo: trocaRotulo(t), nota: notaTroca(t) }; });
    }
    if (tTop) ev.trtop = { video: tTop.video, troca: tTop.ms, rotulo: trocaRotulo(tTop), nota: notaTroca(tTop) + ' Antes: “' + tTop.de + '”.' };
    var recente = T[0];
    if (recente) ev.recente = { video: recente.video, troca: recente.ms, rotulo: trocaRotulo(recente), nota: 'Troca mais recente do canal. ' + notaTroca(recente) };
    Object.keys(ev).forEach(function(k1){ Object.keys(ev).forEach(function(k2){ if (k1 !== k2 && ev[k1] !== ev[k2] && ev[k1].troca && ev[k1].troca === ev[k2].troca && ev[k1].video === ev[k2].video && k2 === 'recente') ev[k2] = ev[k1]; }); });
    var itens = [];
    var comAntes = T.filter(function(t){ return antes(C.porId(t.video), t.ms); }).length, ult = T.length ? Math.max.apply(null, T.map(function(t){ return t.ms; })) : null;
    if (T.length) itens.push('O que fazer: esperar 7 dias depois de cada troca antes de tirar conclusão' + (ult ? '; a leitura da mais recente fica possível em ' + F.data(prontoCanal(T, corte)) : '') + '. Nenhuma das ' + T.length + ' trocas tem variação de views medida: a contagem diária começa em 03/10 e a comparação pede 7 dias depois da troca. ' + F.plural(agu, 'troca ainda aguarda', 'trocas ainda aguardam') + ' os 7 dias.' + (recente ? '[[recente]]' : ''));
    if (T.length) itens.push('Já dá para olhar o que veio antes: ' + F.plural(comAntes, 'troca tem', 'trocas têm') + ' registro diário de views antes da própria troca (' + (T.length - comAntes) + ' não; a contagem diária começa em 03/10). É o desempenho anterior, sem concluir nada sobre a troca.');
    itens.push('Os Shorts passam dos longos em views: a mediana dos Shorts é ' + F.num(B.short.med) + ' e a dos longos é ' + F.num(B.long.med) + '. O Short mais visto tem ' + F.num(tp.views) + ' views.[[short]]');
    itens.push(F.plural(T.length, 'troca', 'trocas') + ' em 30 dias, ' + F.plural(nTit, 'de título', 'de título') + ' e ' + F.plural(nTh, 'de thumbnail', 'de thumbnail') + ', em ' + F.plural(ids.length, 'vídeo', 'vídeos') + '.' +
      (rep ? ' “' + esc(C.porId(rep).t) + '” trocou ' + porVideo[rep].length + ' vezes.[[rep0]][[rep1]]' : ''));
    if (tTop) itens.push('O longo mais visto trocou de título em ' + F.data(tTop.ms) + ', de “' + esc(tTop.de) + '” para o título de hoje.[[trtop]] É o que os dados mostram; não prova causa.');
    itens.push('Ritmo baixo: ' + F.dec(h.longosSem, 1) + ' longo e ' + F.dec(h.shortsSem, 1) + ' Short por semana nos últimos 90 dias. Só ' + V.filter(function(v){ return v.serie || v.viewsMotivo; }).length + ' dos ' + V.length + ' vídeos são acompanhados com contagem diária; para os outros a leitura não diz nada sobre views por dia.');
    var lead = V.length + ' vídeos guardados, ' + V.filter(function(v){ return v.fmt === 'long'; }).length + ' longos e ' + V.filter(function(v){ return v.fmt === 'short'; }).length + ' Shorts. O longo mais visto, “' + esc(top.t) + '”,[[top]] tem ' + F.num(viewsEm(top, corte)) + ' views, contra a mediana de ' + F.num(med) + ' dos longos do canal.';
    return { titulo: C.canal.nome + ': um longo muito acima do resto e trocas ainda sem efeito medido', lead: lead, itens: itens, evid: ev, nVid: V.length, nTrocas: T.length };
  }

  /* ---------------------------------------------------------------- texto da leitura do VÍDEO (exemplo, montado dos dados do vídeo) */
  function leituraVideo(v, corte){
    var T = C.trocas.filter(function(t){ return t.video === v.id && t.ms <= corte; }).sort(function(a, b){ return a.ms - b.ms; });
    var b = C.base[v.fmt], nome = v.fmt === 'short' ? 'os Shorts' : 'os longos', ev = {}, itens = [];
    var mesmos = C.videos.filter(function(x){ return x.fmt === v.fmt && x.views != null && !x.pinAntigo && x.id !== v.id; }).sort(function(a, c){ return c.views - a.views; });
    var comp = mesmos[0];
    ev.self = { video: v.id, sec: 'resumo', rotulo: v.t, nota: F.num(viewsEm(v, corte)) + ' views' + (v.chk ? ', contagem de ' + F.dataHora(v.chk) + '.' : '.') };
    if (comp) ev.comp = { video: comp.id, sec: 'resumo', rotulo: comp.t, nota: 'O ' + (v.fmt === 'short' ? 'Short' : 'longo') + ' mais visto do canal tem ' + F.num(comp.views) + ' views.' };
    ev.serie = { video: v.id, sec: 'linha-do-tempo', rotulo: 'Linha do tempo de ' + v.t, nota: 'Contagem diária de 03/10 a 07/10.' };
    var hm = window.HM ? window.HM.mult(v.id) : null, vw = viewsEm(v, corte), mu = hm && hm.value != null ? hm.value * vw / v.views : (hm ? null : (v.mult != null ? vw / b.med : null)), nv = mu == null ? null : mu >= 10 ? 'topo' : mu >= 5 ? 'muito alto' : mu >= 2 ? 'alto' : null;
    var dia = corte === Infinity ? '9999' : new Date(corte - 3 * 36e5).toISOString().slice(0, 10), se = v.serie ? v.serie.filter(function(x){ return x[0] <= dia; }) : null;
    var lead, mt = mu != null ? F.mult(mu) + (nv ? ' (' + nv + ')' : '') : null;
    if (v.pinAntigo) lead = F.num(vw) + ' views, contagem de ' + F.data(v.chk, true) + '. Vídeo fixado antigo: sem views por dia nem comparação com o canal.';
    else if (v.fmt === 'nc') lead = F.num(vw) + ' views. O formato do vídeo não está confirmado, então a leitura não o compara com o resto do canal.';
    else if (mu != null) lead = F.num(vw) + ' views, ' + mt + ' contra a mediana dos vídeos ' + (v.fmt === 'short' ? 'Shorts ' : '') + 'do canal ' + (hm && hm.band ? 'da faixa de idade ' + hm.band + ' (' + F.num(hm.med) + ' views em ' + hm.n + ' vídeos)' : '(' + F.num(b.med) + ')') + '.[[self]]';
    else lead = F.num(vw) + ' views.[[self]]';
    var semMedida = T.filter(function(t){ return semVariacao(t, corte) === 'aguardando'; });
    if (semMedida.length){ var pronto = Math.max.apply(null, semMedida.map(function(t){ var c = window.HM && window.HM.video(v.id).changes.filter(function(x){ return x.at === t.ms; })[0]; return c ? window.HM.effect(c.id).readyOn : t.ms + 7 * 864e5; })); itens.push('O que fazer: esperar 7 dias depois da troca antes de tirar conclusão; a leitura da mais recente fica possível em ' + F.data(pronto) + '.'); }
    else if (T.length) itens.push('O que fazer: nada a esperar neste vídeo, mas nenhuma troca tem variação medida: a contagem diária começa em 03/10, depois delas.');
    if (mu != null && comp && vw < comp.views) itens.push('O ' + (v.fmt === 'short' ? 'Short' : 'longo') + ' mais visto do canal tem ' + F.num(comp.views) + ' views; este fica em ' + F.num(vw) + '.[[comp]]');
    else if (mu != null && comp) itens.push('É o ' + (v.fmt === 'short' ? 'Short' : 'longo') + ' mais visto do canal; o segundo tem ' + F.num(comp.views) + ' views.[[comp]]');
    if (v.vpd != null && se && se.length >= 2){
      var d = se[se.length - 1][1] - se[0][1], nd = se.length - 1, ate = F.data(Date.parse(se[se.length - 1][0] + 'T15:00:00Z'));
      itens.push(d === 0 ? 'Nos ' + nd + ' dias com contagem diária (03/10 a ' + ate + ') não ganhou views.[[serie]]' : 'Nos ' + nd + ' dias com contagem diária (03/10 a ' + ate + ') ganhou ' + F.num(d) + ' views, ' + F.taxa(d / nd) + ' por dia.[[serie]]');
    } else if (v.viewsMotivo == null && !v.serie) itens.push('Sem contagem diária: o vídeo está fora dos ' + C.canal.limite + ' acompanhados, então a leitura não diz nada sobre views por dia.');
    T.forEach(function(t, i){
      ev['t' + i] = { video: v.id, troca: t.ms, rotulo: trocaRotulo(t), nota: notaTroca(t) + (t.campo === 'titulo' ? ' Antes: “' + t.de + '”.' : '') };
      var st = semVariacao(t, corte), falta = Math.max(1, Math.ceil(7 - (Math.min(corte, NOW) - t.ms) / 864e5));
      var frase = t.campo === 'titulo'
        ? 'Título trocado em ' + F.data(t.ms) + ' (' + t.janela + '), de “' + esc(t.de) + '” para o título de hoje.'
        : 'Thumbnail trocada em ' + F.dataHora(t.ms) + '. A imagem anterior não foi arquivada, então a leitura não compara as duas.';
      frase += st === 'aguardando' ? ' Ainda sem variação medida: faltam ' + F.plural(falta, 'dia', 'dias') + ' para os 7 dias.' : ' Sem variação medida: a contagem diária começa em 03/10, depois da troca.';
      var an = antes(v, t.ms); frase += an ? ' Antes da troca, o vídeo ganhava ' + F.taxa(an.vpd) + ' views por dia (média de ' + F.plural(an.dias, 'dia', 'dias') + ' de registro, até ' + an.ate + ').' : ' Antes da troca não há registro diário para mostrar o desempenho anterior.';
      itens.push(frase + '[[t' + i + ']]');
    });
    if (T.length) itens.push('Isso descreve o que os dados mostram; não prova causa.');
    else itens.push('Nenhuma troca de título ou thumbnail nos últimos 30 dias.');
    var curto = v.t.length > 70 ? v.t.slice(0, 67) + '…' : v.t;
    return { titulo: curto + ': ' + (mu != null ? (nv ? 'acima do normal do canal' : 'dentro do normal do canal') : 'sem comparação com o canal') + (T.length ? ', com ' + F.plural(T.length, 'troca', 'trocas') : ''), lead: lead, itens: itens, evid: ev, nVid: 1, nTrocas: T.length };
  }

  /* ---------------------------------------------------------------- o cartão */
  var PRONTAS = { pronta: { gerada: Date.parse('2026-10-07T23:18:00Z'), dados: Date.parse('2026-10-07T21:03:00Z') }, limite: null, desatualizada: { gerada: Date.parse('2026-10-05T17:10:00Z'), dados: Date.parse('2026-10-05T12:00:00Z') } };
  PRONTAS.limite = PRONTAS.pronta;
  var EXPLICA = 'A forja é um computador nosso que lê estes números e escreve uma leitura com as evidências. Não muda nada no canal. Leva de 10 a 25 minutos; pode sair desta página.';

  function situacao(e, ctx, lbl){
    var alvo = ctx.escopo === 'canal' ? 'canal' : 'vídeo', desde = hhmm(NOW - 4 * MIN);
    switch (e){
      case 'fila': return { k: 'wait', ic: IC.clock, t: 'Aguardando: na fila desde ' + desde + '.', cancelar: true, sub: 'atualizado há 1 min' };
      case 'trabalhando': return { k: 'wait', ic: IC.clock, t: 'Aguardando: a forja está escrevendo desde ' + hhmm(NOW - 3 * MIN) + '. Leva de 10 a 25 minutos.', sub: 'atualizado há 1 min' };
      case 'retry': return { k: 'wait', ic: IC.clock, t: 'Aguardando: o texto citava números que não batem com os dados. A forja tenta de novo às ' + hhmm(NOW + 15 * MIN) + '.', sub: 'atualizado há 1 min' };
      case 'liberado': return { k: 'wait', ic: IC.clock, t: 'Aguardando: o pedido travou e voltou para a fila sozinho, às ' + hhmm(NOW - 10 * MIN) + '.', sub: 'atualizado há 1 min' };
      case 'atraso': return { k: 'late', ic: IC.clockw, t: 'Aguardando, com atraso: esperando há 40 min, mais que o normal. Se passar de ' + hhmm(NOW + 25 * MIN) + ', a tela avisa aqui.', cancelar: true, sub: 'atualizado há 1 min' };
      case 'semmaquina': return { k: 'late', ic: IC.clockw, t: 'Aguardando, com atraso: a forja está desligada ou sem internet desde ' + hhmm(NOW - 95 * MIN) + '. O pedido fica guardado e roda quando ela voltar.', cancelar: true, sub: 'atualizado há 1 min' };
      case 'pronta': case 'limite': return { k: 'ok', ic: IC.ok, t: 'Pronta: leitura publicada às ' + hhmm(PRONTAS.pronta.gerada) + '.' };
      case 'desatualizada': return { k: 'late', ic: IC.stale, t: 'Pronta, mas desatualizada: ' + lbl.desde };
      case 'precisa': return { k: 'bad', ic: IC.warn, t: 'Precisa de você: os dados deste ' + alvo + ' são de 02/10, antigos demais para ler.', sync: true };
      case 'falhou': return { k: 'bad', ic: IC.warn, t: 'Não deu: o texto citava números que não batem com os dados, em todas as tentativas. Pode pedir de novo.', de: true };
      case 'travou': return { k: 'bad', ic: IC.warn, t: 'Não deu: o pedido travou 3 vezes. Pode pedir de novo.', de: true };
      case 'semevid': return { k: 'bad', ic: IC.warn, t: 'Não deu: a leitura saiu sem evidências. Pode pedir de novo.', de: true };
    }
    return null;
  }

  function card(ctx){
    var e = est, canal = ctx.escopo === 'canal', alvo = canal ? 'canal' : 'vídeo';
    if (e === 'hoje' && !canal) e = 'nunca';
    var ehLeitura = e === 'pronta' || e === 'limite' || e === 'desatualizada';
    /* vídeo sem views não tem o que ler: o site recusa o pedido */
    if (!canal && ctx.v && ctx.v.views == null && ehLeitura){ e = 'precisa'; ehLeitura = false; }
    var P = PRONTAS[e], corte = P ? P.dados : Infinity, L = null;
    if (ehLeitura) L = canal ? leituraCanal(corte) : leituraVideo(ctx.v, corte);
    /* "do site": o que mudou depois de a leitura ser escrita */
    var apos = ehLeitura ? C.trocas.filter(function(t){ return t.ms > P.dados && (canal || t.video === ctx.v.id); }) : [];
    var lbl = { desde: apos.length ? 'depois que ela foi escrita, ' + (apos.length === 1 ? 'saiu 1 troca' : 'saíram ' + apos.length + ' trocas') + '.' : 'depois que ela foi escrita, saiu algo novo.' };
    var sit = situacao(e, ctx, lbl);
    var rotBtn, btnOff = false, sub = '';
    if (e === 'nunca'){ rotBtn = 'Pedir leitura ' + (canal ? 'deste canal' : 'deste vídeo') + ' à forja'; sub = 'Ainda não há leitura ' + (canal ? 'deste canal' : 'deste vídeo') + '. Ninguém pediu uma até hoje.'; }
    else if (EM_ANDAMENTO.indexOf(e) >= 0){ rotBtn = 'Pedir leitura ' + (canal ? 'deste canal' : 'deste vídeo') + ' à forja'; btnOff = true; sub = 'Há um pedido de ' + F.dataHora(NOW - 4 * MIN) + ' ainda em andamento.'; }
    else if (e === 'limite'){ rotBtn = 'Pedir nova leitura ' + (canal ? 'deste canal' : 'deste vídeo') + ' à forja'; btnOff = true; sub = 'Já houve uma leitura ' + (canal ? 'deste canal' : 'deste vídeo') + ' hoje. Libera amanhã às 00:00.'; }
    else if (e === 'precisa'){ rotBtn = 'Pedir leitura ' + (canal ? 'deste canal' : 'deste vídeo') + ' à forja'; btnOff = true; sub = 'Sincronize o ' + alvo + ' primeiro. Depois, pode pedir de novo.'; }
    else { rotBtn = (e === 'falhou' || e === 'travou' || e === 'semevid') ? 'Pedir de novo' : 'Pedir nova leitura ' + (canal ? 'deste canal' : 'deste vídeo') + ' à forja'; }
    var abertoAjuda = ajuda == null ? !ehLeitura : ajuda;

    var h = '<section class="forja fj" role="region" aria-labelledby="fjH" id="fjCard">' +
      '<div class="fj-top"><h3 id="fjH">Leitura da forja</h3><button type="button" class="lk" data-fj="ajuda" aria-expanded="' + abertoAjuda + '" aria-controls="fjOq">O que é a forja?</button></div>' +
      '<p class="what" id="fjOq"' + (abertoAjuda ? '' : ' hidden') + '>' + EXPLICA + '</p>';
    if (sit){
      h += '<div class="fj-sit ' + sit.k + '" id="fjSit" tabindex="-1">' + sit.ic + '<p>' + esc(sit.t) + '</p>' +
        (sit.sub || sit.cancelar ? '<div class="fj-acts">' + (sit.sub ? '<span class="fj-upd">' + sit.sub + (pausado ? ' (atualização pausada)' : '') + '</span>' : '') +
          (sit.cancelar ? '<button type="button" class="btn" data-fj="cancelar">Cancelar pedido</button>' : '') +
          (sit.sub ? '<button type="button" class="btn ghost" data-fj="pausar" aria-pressed="' + pausado + '">' + (pausado ? 'Retomar atualização automática' : 'Pausar atualização automática') + '</button>' : '') + '</div>' : '') +
        (sit.sync ? '<div class="fj-acts"><button type="button" class="btn" data-fj="sync">Sincronizar este ' + alvo + '</button></div>' : '') + '</div>';
      if (simulando && EM_ANDAMENTO.indexOf(e) >= 0) h += '<p class="fj-sim">Simulação do mockup: a situação avança sozinha em poucos segundos. Nada é enviado à forja.</p>';
    }
    if (e === 'hoje'){
      h += '<div class="ask"><button type="button" class="btn forja-solid" aria-disabled="true" aria-describedby="fjPq">Pedir leitura deste canal à forja</button><p id="fjPq">Leitura por canal ainda não existe. Por enquanto, a leitura do nicho Viagem está logo abaixo.</p></div><hr>' +
        '<div class="row"><h4 class="fj-nicho">Leitura do nicho Viagem (não é só deste canal)</h4><span class="ex">exemplo</span></div>' +
        '<p class="fj-ex">Exemplo do mockup: o texto abaixo foi escrito por uma pessoa, não pela forja. É o que a aba mostra hoje, até existir o tipo <code>leitura-canal</code> (§7.3).</p>' +
        '<div class="row"><span class="stamp">forja · Gemma 12B · em treino · gerada 05/10 14:10 (SP)</span></div>' +
        '<p class="site">Leu os vídeos e as trocas do nicho Viagem, dados de 05/10 09:00</p>' +
        '<p class="read" lang="pt-BR">Nas trocas de Viagem dos últimos 30 dias, o que mais aparece é título reescrito para a pergunta que o vídeo responde. Nenhuma das trocas tem variação de views medida ainda; isso não prova causa.</p>';
      return h + '</section>';
    }
    if (ehLeitura){
      var M = montar([L.lead].concat(L.itens).join('\u0001'), L.evid, ctx.href), partes = M.html.split('\u0001');
      var leuTxt = canal ? 'Leu ' + F.plural(L.nVid, 'vídeo', 'vídeos') + ' e ' + F.plural(L.nTrocas, 'troca', 'trocas') + ', dados de ' + F.dataHora(P.dados)
        : 'Leu este vídeo e ' + F.plural(L.nTrocas, 'troca', 'trocas') + ', dados de ' + F.dataHora(P.dados);
      h += '<div class="fj-ex" role="note"><span class="ex">exemplo</span> Texto escrito para o mockup por uma pessoa, não pela forja. A forja ainda não produziu nenhuma leitura real. Os números vêm dos dados desta tela e as evidências levam a vídeos e trocas que existem nela.</div>' +
        '<div class="row"><span class="stamp">forja · Gemma 12B · em treino · gerada ' + F.dataHora(P.gerada) + ' (SP)</span>' +
        '<button type="button" class="ibtn" data-fj="treino" aria-expanded="' + emTreino + '" aria-controls="fjTr" aria-label="Sobre o selo em treino">' + IC.info + '</button></div>' +
        '<p class="what" id="fjTr"' + (emTreino ? '' : ' hidden') + '>O modelo ainda não é especialista neste assunto. Leia como rascunho e confira as evidências.</p>' +
        '<p class="site">' + leuTxt + '</p>' +
        '<div lang="pt-BR" class="read-box"><h4 class="read-t">' + esc(L.titulo) + '</h4><p class="read">' + partes[0] + '</p>' +
        '<ul class="read-l">' + partes.slice(1).map(function(p){ return '<li>' + p + '</li>'; }).join('') + '</ul></div>' +
        '<div class="evid"><h4>Evidências</h4><ol>' + M.ordem.map(function(k){
          var x = L.evid[k];
          return '<li><a href="' + esc(ctx.href(x.video, x.troca, x.sec)) + '" data-video="' + x.video + '"' + (x.troca ? ' data-troca="' + x.troca + '"' : '') + ' data-go>' + esc(x.rotulo) + '</a><span>' + esc(x.nota) + '</span></li>';
        }).join('') + '</ol></div>';
      var vidNovos = 0;
      h += '<p class="site do-site"><b>Do site:</b> desde então, ' + (vidNovos ? vidNovos + ' vídeos novos e ' : 'nenhum vídeo novo e ') + (apos.length ? (apos.length === 1 ? '1 troca' : apos.length + ' trocas') + '.' : 'nenhuma troca.') +
        (apos.length && canal ? ' <a class="lk" href="' + esc(ctx.hrefTrocas()) + '" data-tab="trocas">Ver ' + (apos.length === 1 ? 'a troca' : 'as ' + apos.length + ' trocas') + '</a>' : '') +
        (apos.length && !canal ? ' <a class="lk" href="#compare">Ver em Antes e depois</a>' : '') + '</p>';
    }
    h += '<div class="ask"><button type="button" class="btn ' + (btnOff ? '' : '') + 'forja-solid" data-fj="pedir"' + (btnOff ? ' aria-disabled="true" aria-describedby="fjPq"' : '') + '>' + rotBtn + '</button>' +
      (sub ? '<p id="fjPq">' + esc(sub) + '</p>' : '') + '</div></section>';
    return h;
  }

  function refresh(foco){
    mounts.forEach(function(m){
      var ativo = document.activeElement, dentro = ativo && m.el.contains(ativo), qual = ativo && ativo.dataset ? ativo.dataset.fj : null;
      m.el.innerHTML = card(m.ctx());
      if (foco || (dentro && !m.el.contains(document.activeElement))){
        var b = qual && m.el.querySelector('[data-fj="' + qual + '"]:not([aria-disabled])');
        var s = m.el.querySelector('#fjSit');
        (foco && s ? s : b || s || m.el.querySelector('button')).focus({ preventScroll: true });
      }
    });
  }

  document.addEventListener('click', function(ev){
    var b = ev.target.closest('[data-fj]'); if (!b) return;
    var k = b.dataset.fj;
    if (b.getAttribute('aria-disabled') === 'true'){ ev.preventDefault(); return; }
    if (k === 'pedir'){ pedir(); }
    else if (k === 'cancelar'){ set('nunca', { foco: false }); cfg.say('Pedido cancelado.'); cfg.toast('Pedido cancelado (simulação).'); var bt = document.querySelector('[data-fj="pedir"]'); if (bt) bt.focus({ preventScroll: true }); }
    else if (k === 'pausar'){ pausado = !pausado; refresh(); var pb = document.querySelector('[data-fj="pausar"]'); if (pb) pb.focus({ preventScroll: true }); cfg.say(pausado ? 'Atualização automática pausada.' : 'Atualização automática retomada.'); if (!pausado && pendente){ var p = pendente; pendente = null; avancar(p.prox, p.fala); } }
    else if (k === 'sync'){ cfg.toast('Sincronização iniciada (simulação).'); }
    else if (k === 'ajuda'){ var ab = b.getAttribute('aria-expanded') !== 'true'; ajuda = ab; b.setAttribute('aria-expanded', ab); document.getElementById('fjOq').hidden = !ab; }
    else if (k === 'treino'){ emTreino = !emTreino; b.setAttribute('aria-expanded', emTreino); document.getElementById('fjTr').hidden = !emTreino; }
  });

  window.FORJA = {
    ESTADOS: ESTADOS, VARIANTES: VARIANTES, VALIDOS: VALIDOS,
    init: function(o){ Object.assign(cfg, o); },
    estado: function(){ return est; },
    set: set,
    simulando: function(){ return simulando; },
    pedir: pedir,
    /* ctx: função que devolve { escopo: 'canal'|'video', v, href(videoId, trocaMs, secao), hrefTrocas() } */
    montar: function(el, ctx){ mounts = mounts.filter(function(m){ return m.el !== el; }); mounts.push({ el: el, ctx: ctx }); el.innerHTML = card(ctx()); },
    refresh: refresh,
    trocaRotulo: trocaRotulo, janelaMs: janelaMs, semVariacao: semVariacao
  };
})();

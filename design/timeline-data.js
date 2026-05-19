// Timeline track definitions + sample beat data
// Colors match the DaVinci Resolve track map

window.TL_VIDEO = {
  title: 'Morei 4 Anos no Canadá, Voltei pro Brasil — Agora Vou pra Ásia',
  channel: '@thiagofigueiredo',
  language: 'PT',
  format: 'Storytelling + Framework Prático',
  duration: '14–17 min',
  angles: 'A1 (Personal Story) + A2 (Contrarian) + A5 (Behind the Scenes)',
  framework: 'McKee (Arco Dramático)',
  vvs: '80/80 (SQ5)',
  hook: 'Todo brasileiro quer sair do Brasil. Eu fui pro Canadá, fiquei 4 anos, e VOLTEI. Agora vou pra Ásia.',
  synopsis: 'Trailer bilateral (PT+EN). Canal: bilateral. Storytelling McKee 7 beats. Ângulos: A1+A2+A5. Duração: 14-17 min PT / 12-16 min EN. Arc: 5-trajetória-canadá (trailer). Cross: C. Gravado Ubatuba 2026-04-23. Falta segundo home (~50s PT + EN).',
  version: 1,
  recorded: '2026-04-23',
  location: 'Ubatuba',
};

window.TL_TRACKS = {
  video: [
    { id: 'V7', name: 'Overlays + End Screen', color: '#A3CB38', fn: 'End screen, cards, transições visuais, vignettes' },
    { id: 'V6', name: 'Subtitles',             color: '#F1C40F', fn: 'Captions estilizados (Text+ ou Fusion)' },
    { id: 'V5', name: 'Graphics + QR',         color: '#E84393', fn: 'QR codes, subscribe CTA, logos, infográficos' },
    { id: 'V4', name: 'Lower Thirds',          color: '#9B59B6', fn: 'Nome, localização, chapter titles' },
    { id: 'V3', name: 'B-Roll',                color: '#1ABC9C', fn: 'Cutaways, insert shots' },
    { id: 'V2', name: 'Background Layer',      color: '#A0845C', fn: 'Conteúdo por trás da pessoa (Fusion Magic Mask)' },
    { id: 'V1', name: 'Main Footage',          color: '#C4A882', fn: 'Talking head, A-roll principal' },
  ],
  audio: [
    { id: 'A1', name: 'Voice',            color: '#27AE60', fn: 'Narração, talking head' },
    { id: 'A2', name: 'Music',            color: '#3498DB', fn: 'Bed musical (ducked sob voz)' },
    { id: 'A3', name: 'SFX Punctuation',  color: '#E67E22', fn: 'Impactos, bass drops, risers' },
    { id: 'A4', name: 'SFX Textures',     color: '#F0B27A', fn: 'Whooshes, shimmers, transições' },
    { id: 'A5', name: 'Ambience',         color: '#7D8B5E', fn: 'Room tone, ambience' },
    { id: 'A6', name: 'Sound Design',     color: '#8E44AD', fn: 'Branded sounds, notificações, stingers' },
  ],
};

window.TL_BEATS = [
  {
    idx: 0, label: 'Beat 0', name: 'Hook', duration: 24, absStart: 0,
    status: 'PENDING', difficulty: 'EASY',
    script: [
      { type:'note', tag:'VISUAL', tagColor:'#1ABC9C', text:'3s — montage rápida: foto no Canadá (neve/cidade) → foto no Brasil → foto no Sudeste Asiático. Corta pra talking head. Lean alternative: abrir direto em talking head' },
      { type:'note', tag:'DIRECTION', tagColor:'#E67E22', text:'calmo, próximo, sem drama. Conversando com um amigo, não palestrando' },
      { type:'line', text:'Eu morei quatro anos no Canadá. Emprego bom. Salário em dólar. Vida estável.', accent:'#F1C40F' },
      { type:'pause', duration: 0.5 },
      { type:'line', text:'Decidi voltar pro Brasil.', accent:'#c8c4bc' },
      { type:'pause', duration: 0.5 },
      { type:'line', text:'E agora tô me preparando pra me mudar pra Ásia.', accent:'#c8c4bc' },
      { type:'line', text:'Cada uma dessas decisões foi proposital. E nesse vídeo eu vou te contar por quê — e te mostrar exatamente o plano que eu tô seguindo pra fazer isso acontecer.', accent:'#E84393' },
      { type:'ref', text:'Reference — não falado: promessa dupla + por que cada decisão + plano pra Ásia. Credencial implícita em "quatro anos no Canadá".' },
    ],
    clips: {
      V1: [{ s:0, e:24, label:'DJI_20001180_0067_D.MP4' }],
      V3: [
        { s:0, e:3, label:'Fotos Canadá (Ken Burns)' },
        { s:3, e:6, label:'Fotos Brasil (Ken Burns)' },
        { s:6, e:9, label:'Fotos Ásia (Ken Burns)' },
      ],
      V6: [{ s:0, e:24, label:'Subtitle Track — 42 clips' }],
      A1: [{ s:0, e:24, label:'DJI_20001180_0067.wav' }],
      A2: [{ s:0, e:24, label:'Ocean Depth — v5 smooth duck.wav' }],
      A3: [
        { s:5, e:7, label:'Impact Live — Bass Drop' },
        { s:11, e:13, label:'Riser Sutil 2s' },
        { s:17, e:19, label:'Bass Drop — Deep Low' },
      ],
      A4: [
        { s:3, e:5, label:'Whoosh transition' },
        { s:6, e:8, label:'Shimmer Light' },
      ],
    },
  },
  {
    idx: 1, label: 'Beat 1', name: 'O Capítulo Canadá', duration: 93, absStart: 24,
    status: 'PENDING', difficulty: 'MEDIUM',
    script: [
      { type:'note', tag:'VISUAL', tagColor:'#1ABC9C', text:'B-roll: fotos Canadá, Ken Burns. Speed 103-105% talking head, 150% b-roll.' },
      { type:'note', tag:'DIRECTION', tagColor:'#E67E22', text:'Nostálgico no início, depois pragmático. Ritmo conversacional.' },
      { type:'line', text:'Em agosto de 2017, eu desembarquei em Toronto com duas malas e um visto de estudante.', accent:'#F1C40F' },
      { type:'line', text:'Eu não sabia ninguém. Não tinha emprego. Meu inglês era ok, mas longe de fluente.', accent:'#c8c4bc' },
      { type:'pause', duration: 0.3 },
      { type:'line', text:'Mas eu tinha um plano: estudar, conseguir um emprego na área de tech, e construir uma vida lá fora.', accent:'#c8c4bc' },
      { type:'line', text:'E em quatro anos... eu consegui tudo isso. Eu era dev em uma startup, ganhando bem, morando num apartamento legal em downtown Toronto.', accent:'#3498DB' },
      { type:'pause', duration: 0.5 },
      { type:'line', text:'Mas tinha algo que não encaixava. Eu tava confortável — e conforto, pra mim, é o sinal mais perigoso de que você parou de crescer.', accent:'#E84393' },
      { type:'ref', text:'Reference — backstory com grind real. Empatia → respeito. Setup para a decisão contrarian do Beat 2.' },
    ],
    clips: {
      V1: [
        { s:0, e:18, label:'DJI_20001180_0068_D.MP4' },
        { s:18, e:35, label:'DJI_20001180_0069_D.MP4' },
        { s:35, e:58, label:'DJI_20001180_0070_D.MP4' },
        { s:58, e:78, label:'DJI_20001180_0071_D.MP4' },
        { s:78, e:93, label:'DJI_20001180_0072_D.MP4' },
      ],
      V2: [{ s:0, e:93, label:'Background Layer — Magic Mask' }],
      V3: [
        { s:3, e:10, label:'B-roll: Toronto skyline' },
        { s:22, e:30, label:'B-roll: Winter campus' },
        { s:45, e:52, label:'B-roll: Apartment interior' },
        { s:68, e:75, label:'B-roll: Downtown walk' },
      ],
      V4: [
        { s:5, e:9, label:'LT: "Agosto 2017 · Canadá"' },
        { s:40, e:44, label:'LT: "Toronto, ON"' },
      ],
      V6: [{ s:0, e:93, label:'Subtitle Track — 186 clips' }],
      A1: [
        { s:0, e:18, label:'DJI_20001180_0068.wav' },
        { s:18, e:35, label:'DJI_20001180_0069.wav' },
        { s:35, e:58, label:'DJI_20001180_0070.wav' },
        { s:58, e:78, label:'DJI_20001180_0071.wav' },
        { s:78, e:93, label:'DJI_20001180_0072.wav' },
      ],
      A2: [{ s:0, e:93, label:'Ocean Depth (continues)' }],
      A3: [
        { s:15, e:17, label:'Subtle Impact' },
        { s:38, e:40, label:'Riser transition' },
        { s:65, e:67, label:'Bass punch' },
      ],
      A4: [
        { s:2, e:4, label:'Room tone transition' },
        { s:20, e:22, label:'Shimmer' },
        { s:50, e:52, label:'Whoosh' },
      ],
      A5: [{ s:0, e:93, label:'Calm City — Livingroom Room Tone.wav' }],
    },
  },
  {
    idx: 2, label: 'Beat 2', name: 'A Decisão Contrarian', duration: 94, absStart: 117,
    status: 'PENDING', difficulty: 'MEDIUM',
    script: [
      { type:'note', tag:'VISUAL', tagColor:'#1ABC9C', text:'Mix talking head + B-roll coding, LinkedIn. Lower third: "Março 2019 · Primeiro emprego dev".' },
      { type:'note', tag:'DIRECTION', tagColor:'#E67E22', text:'Intensidade sobe. Convicção, não arrogância. Olho na câmera nos pontos-chave.' },
      { type:'line', text:'A maioria das pessoas no meu lugar teria ficado. Emprego estável, visto garantido, vida resolvida.', accent:'#c8c4bc' },
      { type:'pause', duration: 0.5 },
      { type:'line', text:'Eu pedi demissão.', accent:'#F1C40F' },
      { type:'pause', duration: 1.0 },
      { type:'line', text:'Não porque o Canadá era ruim. Mas porque o Brasil tinha uma oportunidade que o Canadá não podia me dar: escala com custo baixo.', accent:'#3498DB' },
      { type:'line', text:'No Canadá eu era um dev numa startup. No Brasil eu podia ser o cara que MONTA a startup.', accent:'#E84393' },
      { type:'pause', duration: 0.3 },
      { type:'line', text:'E tudo que eu aprendi lá fora — produto, tech, inglês, mentalidade — virava vantagem competitiva aqui.', accent:'#c8c4bc' },
      { type:'ref', text:'Reference — Progressive complication → tensão → conexão → insight. Decisão contrarian como diferencial.' },
    ],
    clips: {
      V1: [
        { s:0, e:22, label:'DJI_20001180_0073_D.MP4' },
        { s:22, e:50, label:'DJI_20001180_0074_D.MP4' },
        { s:50, e:72, label:'DJI_20001180_0075_D.MP4' },
        { s:72, e:94, label:'DJI_20001180_0076_D.MP4' },
      ],
      V3: [
        { s:8, e:16, label:'B-roll: Coding at desk' },
        { s:34, e:40, label:'B-roll: Job interview prep' },
        { s:60, e:68, label:'B-roll: LinkedIn screenshot' },
      ],
      V4: [{ s:30, e:34, label:'LT: "Março 2019 · Primeiro emprego dev"' }],
      V5: [{ s:42, e:48, label:'Text overlay: "Visto de estudante · 20h/semana"' }],
      V6: [{ s:0, e:94, label:'Subtitle Track — 178 clips' }],
      V7: [{ s:90, e:94, label:'Transition: Cross dissolve' }],
      A1: [
        { s:0, e:22, label:'DJI_20001180_0073.wav' },
        { s:22, e:50, label:'DJI_20001180_0074.wav' },
        { s:50, e:72, label:'DJI_20001180_0075.wav' },
        { s:72, e:94, label:'DJI_20001180_0076.wav' },
      ],
      A2: [{ s:0, e:94, label:'Ocean Depth (continues)' }],
      A3: [
        { s:20, e:23, label:'Tension Build 3s' },
        { s:48, e:50, label:'SFX Keyboard Type' },
        { s:85, e:88, label:'Achievement ding' },
      ],
      A4: [
        { s:28, e:31, label:'Shimmer transition' },
        { s:55, e:58, label:'Whoosh reveal' },
      ],
      A5: [
        { s:0, e:50, label:'Office ambient.wav' },
        { s:50, e:94, label:'Outdoor city.wav' },
      ],
      A6: [{ s:85, e:90, label:'Victory stinger — branded' }],
    },
  },
  {
    idx: 3, label: 'Beat 3', name: 'Construindo no Brasil', duration: 89, absStart: 211,
    status: 'PENDING', difficulty: 'MEDIUM',
    script: [
      { type:'note', tag:'VISUAL', tagColor:'#1ABC9C', text:'B-roll São Paulo skyline, co-working, beach. Subscribe CTA nos últimos 15s.' },
      { type:'note', tag:'DIRECTION', tagColor:'#E67E22', text:'Energia alta, ritmo acelerado. Mostrar resultados, não só falar.' },
      { type:'line', text:'Voltei pro Brasil em março de 2022. Primeiro mês: zero receita. Segundo mês: um freelance. Terceiro mês: dois clientes.', accent:'#F1C40F' },
      { type:'line', text:'Em um ano eu tinha uma empresa, uma equipe pequena, e projetos que no Canadá eu levaria cinco anos pra conseguir.', accent:'#c8c4bc' },
      { type:'pause', duration: 0.5 },
      { type:'line', text:'Mas aí eu olhei pro mapa e pensei: por que parar aqui?', accent:'#3498DB' },
      { type:'line', text:'Se o modelo funciona remoto, se o time é distribuído, se o cliente é global — por que eu preciso estar num lugar só?', accent:'#c8c4bc' },
      { type:'pause', duration: 0.3 },
      { type:'line', text:'É por isso que o próximo capítulo é a Ásia. Não é férias. É o terceiro movimento de uma estratégia que começou em 2017.', accent:'#E84393' },
      { type:'ref', text:'Reference — resolução do arco. Callback pro hook. Setup para próximo vídeo (série).' },
    ],
    clips: {
      V1: [
        { s:0, e:25, label:'DJI_20001180_0077_D.MP4' },
        { s:25, e:52, label:'DJI_20001180_0078_D.MP4' },
        { s:52, e:89, label:'DJI_20001180_0079_D.MP4' },
      ],
      V3: [
        { s:5, e:12, label:'B-roll: São Paulo skyline' },
        { s:30, e:38, label:'B-roll: Co-working space' },
        { s:58, e:65, label:'B-roll: Beach sunset' },
      ],
      V4: [
        { s:2, e:6, label:'LT: "São Paulo, Brasil"' },
        { s:55, e:59, label:'LT: "Florianópolis"' },
      ],
      V5: [{ s:75, e:89, label:'Subscribe CTA + QR code' }],
      V6: [{ s:0, e:89, label:'Subtitle Track — 168 clips' }],
      V7: [{ s:80, e:89, label:'End Screen — Cards + Subscribe' }],
      A1: [
        { s:0, e:25, label:'DJI_20001180_0077.wav' },
        { s:25, e:52, label:'DJI_20001180_0078.wav' },
        { s:52, e:89, label:'DJI_20001180_0079.wav' },
      ],
      A2: [{ s:0, e:89, label:'New Dawn — uptempo mix.wav' }],
      A3: [
        { s:10, e:12, label:'Impact transition' },
        { s:42, e:44, label:'Bass accent' },
        { s:78, e:80, label:'Final drop' },
      ],
      A4: [
        { s:8, e:11, label:'Whoosh to Brazil' },
        { s:35, e:37, label:'Shimmer soft' },
        { s:72, e:75, label:'Transition sweep' },
      ],
      A5: [
        { s:0, e:45, label:'Urban Brazil ambient.wav' },
        { s:45, e:89, label:'Beach waves ambient.wav' },
      ],
      A6: [{ s:82, e:89, label:'Branded outro stinger' }],
    },
  },
];

// ── Asset resolver data per beat ───────────────────
window.TL_ASSETS = {
  0: {
    music: [
      { id:'ocean-depth', name:'Ocean Depth', artist:'Veaceslav Draganov', genre:'cinematic', bpm:95, dur:'3:32', match:91, local:true, selected:true,
        tags:['cinematic','ambient','mysterious','dark pads'], note:'Entrada: 00:00, fade in 2s, -22dB under voice → Continua no Beat 1, sem break.' },
      { id:'a-new-dawn', name:'A New Dawn', artist:'Letra', genre:'cinematic', bpm:100, dur:'3:10', match:47, local:true, selected:false,
        tags:['cinematic','hopeful'] },
      { id:'leaves-changing', name:'The Leaves Are Changing', artist:'Miles Kredich', genre:'cinematic', bpm:85, dur:'4:16', match:38, local:true, selected:false,
        tags:['acoustic','gentle','nature'] },
    ],
    sfx: [
      { tc:'00:06', type:'IMPACT', typeColor:'#E84393', desc:'Impact leve — marca entrada do talking head',
        file:{ name:'Alex Cummings - Extreme Force - Cinematic Bass Drop Impact.wav', local:true, match:92 },
        tags:['low impact hit','cinematic impact soft','subtle boom'], altCount:5 },
      { tc:'00:11', type:'RISER', typeColor:'#9B59B6', desc:'Riser sutil 2s — build tensão',
        file:{ name:'Ni Sound - Trailer Ready - Short Riser.wav', local:true, match:72 },
        tags:['cinematic riser short','tension build 2s','subtle riser'], altCount:5 },
      { tc:'00:17', type:'DROP', typeColor:'#E67E22', desc:'Bass drop — marca fim do hook',
        file:{ name:'Artist Original - Deep Impact - Deep Low Impact.wav', local:true, match:92 },
        tags:['bass drop cinematic','sub impact hit','deep bass drop'], altCount:5 },
    ],
    visual: [
      { tc:'00:00', desc:'Fotos Canadá (Ken Burns)', status:'pending', search:['canada winter city','toronto snow skyline'] },
      { tc:'00:03', desc:'Fotos Brasil (Ken Burns)', status:'pending', search:['brazil tropical','rio sunshine'] },
      { tc:'00:06', desc:'Fotos Ásia (Ken Burns)', status:'pending', search:['asia travel','southeast asia market'] },
    ],
  },
  1: {
    music: [
      { id:'ocean-depth-cont', name:'Ocean Depth (continues)', artist:'Veaceslav Draganov', genre:'cinematic', bpm:95, dur:'3:32', match:91, local:true, selected:true, confirmed:true,
        tags:['cinematic','ambient'], note:'Continua do Beat 0. Sem corte.' },
    ],
    sfx: [
      { tc:'00:39', type:'IMPACT', typeColor:'#E84393', desc:'Subtle Impact — transição visual',
        file:{ name:'Cinematic Sub Hit - Warm.wav', local:true, match:78 },
        tags:['subtle impact','warm hit','transition'], altCount:3 },
      { tc:'01:02', type:'RISER', typeColor:'#9B59B6', desc:'Riser transition — mudança de tom',
        file:{ name:'Atmospheric Riser - Soft Build.wav', local:true, match:68 },
        tags:['soft riser','atmospheric build','gentle tension'], altCount:4 },
      { tc:'01:29', type:'IMPACT', typeColor:'#E84393', desc:'Bass punch — fecha capítulo',
        file:null, tags:['bass punch','chapter end','cinematic close'], altCount:6 },
    ],
    visual: [
      { tc:'00:03', desc:'B-roll: Toronto skyline', status:'resolved', file:'toronto_skyline_4k.mp4' },
      { tc:'00:22', desc:'B-roll: Winter campus', status:'pending', search:['university winter','campus snow'] },
      { tc:'00:45', desc:'B-roll: Apartment interior', status:'pending', search:['apartment downtown','modern living room'] },
      { tc:'01:08', desc:'B-roll: Downtown walk', status:'resolved', file:'downtown_walk_handheld.mp4' },
    ],
    ambience: [
      { name:'Calm City - Livingroom Room Tone.wav', local:true, match:88, tags:['room tone transition','ambience shift','interior room tone'] },
    ],
  },
  2: {
    music: [
      { id:'ocean-depth-cont2', name:'Ocean Depth (continues)', artist:'Veaceslav Draganov', genre:'cinematic', bpm:95, dur:'3:32', match:91, local:true, selected:true, confirmed:true,
        tags:['cinematic'], note:'Continua.' },
    ],
    sfx: [
      { tc:'00:20', type:'RISER', typeColor:'#9B59B6', desc:'Tension Build 3s',
        file:{ name:'Cinematic Tension Builder - Long.wav', local:true, match:82 },
        tags:['tension build','cinematic riser','dramatic'], altCount:4 },
      { tc:'00:48', type:'FOLEY', typeColor:'#F0B27A', desc:'SFX Keyboard Type',
        file:{ name:'Audio Falcon - Office Electronics - Gentle Keyboard Typing.wav', local:true, match:80 },
        tags:['office keyboard type','computer typing','keyboard clicks'], altCount:5 },
      { tc:'01:25', type:'FOLEY', typeColor:'#F0B27A', desc:'Achievement ding',
        file:{ name:'Delightful Animation - Victory Chime.wav', local:true, match:64 },
        tags:['success chime','achievement sound','level up ding'], altCount:5 },
    ],
    visual: [
      { tc:'00:08', desc:'B-roll: Coding at desk', status:'pending', search:['developer coding','laptop desk night'] },
      { tc:'00:34', desc:'B-roll: Job interview prep', status:'pending', search:['interview preparation','resume desk'] },
      { tc:'01:00', desc:'B-roll: LinkedIn screenshot', status:'resolved', file:'linkedin_profile_cap.png' },
    ],
    soundDesign: [
      { tc:'01:25', name:'Victory stinger — branded', status:'pending', tags:['branded stinger','victory sound'] },
    ],
  },
  3: {
    music: [
      { id:'new-dawn-up', name:'New Dawn — uptempo mix', artist:'Letra', genre:'cinematic', bpm:120, dur:'3:10', match:74, local:false, selected:true,
        tags:['cinematic','uptempo','hopeful','energetic'], note:'Nova seção. Transição de mood.' },
      { id:'cape-good-hope', name:'Cape of Good Hope', artist:'Tristan Barton', genre:'cinematic', bpm:105, dur:'5:12', match:68, local:false, selected:false,
        tags:['cinematic','adventurous','orchestral'] },
    ],
    sfx: [
      { tc:'00:10', type:'IMPACT', typeColor:'#E84393', desc:'Impact transition — entrada Brasil',
        file:{ name:'Swoosh Impact - Heavy Cinematic.wav', local:true, match:85 },
        tags:['impact transition','heavy swoosh','scene change'], altCount:4 },
      { tc:'00:42', type:'IMPACT', typeColor:'#E84393', desc:'Bass accent — destaque',
        file:{ name:'Sub Bass Accent - Short.wav', local:true, match:76 },
        tags:['bass accent','sub hit','short impact'], altCount:3 },
      { tc:'01:18', type:'DROP', typeColor:'#E67E22', desc:'Final drop — encerramento',
        file:null, tags:['final drop','cinematic ending','bass resolve'], altCount:7 },
    ],
    visual: [
      { tc:'00:05', desc:'B-roll: São Paulo skyline', status:'pending', search:['sao paulo aerial','brazil city skyline'] },
      { tc:'00:30', desc:'B-roll: Co-working space', status:'pending', search:['coworking modern','startup office'] },
      { tc:'00:58', desc:'B-roll: Beach sunset', status:'resolved', file:'floripa_sunset_drone.mp4' },
    ],
    soundDesign: [
      { tc:'01:22', name:'Branded outro stinger', status:'pending', tags:['branded outro','channel stinger','end sound'] },
    ],
  },
};

// ── Cross-Reference data ───────────────────────────
window.TL_CROSSREF = {
  summary: 'SRT PT: 177 entries, 8/11 fala pura. Duração final estimada 12-14 min com b-roll e pausas. Storytelling fluido sem gaps.',
  beats: [
    { name:'Beat 0: Hook', srt:'0:00 – 0:24', dur:'24s', estRot:'~35s', status:'RECORDED', statusColor:'#27AE60', note:'signed' },
    { name:'Beat 1: O Capítulo Canadá', srt:'0:24 – 1:57', dur:'1m33s', estRot:'~4min', status:'RECORDED', statusColor:'#27AE60', note:'compressed' },
    { name:'Beat 2: A Decisão Contrarian', srt:'1:57 – 3:31', dur:'1m34s', estRot:'~2min', status:'RECORDED', statusColor:'#27AE60', note:'close to plan + cross-promo EN' },
    { name:'Beat 3: Construindo no Brasil', srt:'3:31 – 5:00', dur:'1m29s', estRot:'~3min', status:'RECORDED', statusColor:'#27AE60', note:'close to plan' },
  ],
  divergences: [
    'Beat 2 repete frase do EN em 2:10 (eu me comparei com quem eu era ontem) — manter, funciona bilateral',
    'Cross-promo EN está em 3:23-3:31 — manter pra estratégia bilateral',
    'Momentos emocionais identificados: 10 pontos marcados NUNCA acelerar',
  ],
};

// ── Speed Ramps data ───────────────────────────────
window.TL_SPEEDRAMPS = {
  summary: 'Duração final: ~12-14 min (com b-roll, pausas, end screen). Estilo: Cinematográfico.',
  base: 'Base: 103-105% narrativa, 100% emocional, 95-100% filosofia, 150-200% b-roll',
  sections: [
    { name:'Hook (talking head)', srt:'0:00–0:24', vel:'100%', velColor:'#27AE60', racional:'Primeira impressão, ritmo natural' },
    { name:'Beat 1 storytelling', srt:'0:24–1:57', vel:'103-105%', velColor:'#3498DB', racional:'Trecho longo narrativa, micro-aceleração imperceptível' },
    { name:'B-roll Canadá (inserts)', srt:'intercalado', vel:'150-200%', velColor:'#E67E22', racional:'B-roll sem fala pode comprimir' },
    { name:'Beat 2 contrarian', srt:'1:57–3:31', vel:'100%', velColor:'#27AE60', racional:'Momentos emocionais, manter natural' },
    { name:'Cross-promo EN', srt:'3:23–3:31', vel:'100%', velColor:'#27AE60', racional:'CTA precisa ser claro' },
    { name:'Beat 3 Brasil', srt:'3:31–5:00', vel:'103-105%', velColor:'#3498DB', racional:'Energia alta, ritmo acelerado' },
    { name:'B-roll Ásia (inserts)', srt:'intercalado', vel:'130-155%', velColor:'#E67E22', racional:'Visual carry, pode comprimir' },
    { name:'Desafio/emotion', srt:'4:25–4:50', vel:'100%', velColor:'#27AE60', racional:'Momento emocional — NUNCA acelerar' },
    { name:'End screen + CTAs', srt:'4:50–5:00', vel:'100%', velColor:'#27AE60', racional:'Clareza dos CTAs essencial' },
  ],
};

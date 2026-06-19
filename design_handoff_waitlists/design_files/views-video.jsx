/* ============================================================
   VIDEO MODULE (was "Pipeline").
   Hub → Editor (Ideia · Roteiro) → Gravação (paper sheet).
   Mirrors the blog editor's Ideia/Conteúdo split: the spoken
   line is the hero; direction/visual/editor notes recede.
   Shared helpers are exposed on window for the record sheet.
   ============================================================ */

const VID = window.VIDEO_DATA;
if (window.ICONS && !window.ICONS.lock) window.ICONS.lock = <><path d="M7 11V7a5 5 0 0 1 10 0v4" /><rect x="4" y="11" width="16" height="10" rx="2" /></>;

/* ---------- helpers ---------- */
function vidFmt(sec) {
  if (sec == null) return "—";
  if (sec < 60) return sec + "s";
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return s ? m + "m" + String(s).padStart(2, "0") : m + "m";
}
function escHtml(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
/* **word** → emphasized span (one calm "hit word" accent) */
function emphHtml(text) {
  return escHtml(text).replace(/\*\*(.+?)\*\*/g, '<b class="emph">$1</b>');
}
function beatRead(beat) {
  const words = (beat.script || []).filter(s => s.t === "line")
    .reduce((n, s) => n + s.text.replace(/\*\*/g, "").split(/\s+/).filter(Boolean).length, 0);
  const pauses = (beat.script || []).filter(s => s.t === "pause").reduce((n, s) => n + (s.s || 0), 0);
  return Math.ceil(words / 2.1 + pauses);
}
function vidTotals(beats) {
  return (beats || []).reduce((a, b) => ({ dur: a.dur + (b.dur || 0), read: a.read + beatRead(b) }), { dur: 0, read: 0 });
}
function blankVersion(lang) {
  return { title: "", direction: "", siblings: [], logline: "", pillar: "viagem", angles: "", framework: "", duration: "", location: "", recorded: "—", beats: [], fresh: true };
}
Object.assign(window, { vidFmt, emphHtml, beatRead, vidTotals });

/* reliable scroll — the webview throttles both native smooth-scroll and rAF
   inconsistently, so jump instantly (clamped). Snappy and always lands. */
function smoothScrollTo(sc, top) {
  if (!sc) return;
  const max = sc.scrollHeight - sc.clientHeight;
  sc.scrollTop = Math.max(0, Math.min(top, max));
}
window.smoothScrollTo = smoothScrollTo;

/* ---------- Cowork: call the AI to change/extend the current stage ---------- */
const CW_PROMPTS = {
  ideia: ["Gerar 3 novas direções", "Qual é o gancho mais forte?", "Sugerir ângulos (A1–A5)"],
  roteiro: ["Encurtar mantendo os beats", "Reforçar o hook", "Sugerir b-roll por beat", "Marcar palavras de ênfase"],
  pos: ["Gerar instruções de edição", "B-roll que ainda falta", "Revisar CTAs/QR por idioma"],
  publicacao: ["Gerar 4 títulos testáveis", "Brief das 4 thumbnails", "Sugerir distribuição"],
  // blog editor stages
  b_ideia: ["Gerar 3 ângulos pro tema", "Qual é o gancho mais forte?", "Reescrever a sinopse"],
  b_conteudo: ["Rascunhar a partir da sinopse", "Sugerir uma estrutura", "Reforçar a abertura"],
  b_imagens: ["Sugerir prompts de imagem", "Ideias de capa"],
  b_seo: ["Sugerir meta title + description", "Palavras-chave do tema"],
  b_publicacao: ["Resumo pra redes", "Sugerir horário de publicação"],
};
function CoworkButton({ stage, label = "Cowork", compact, prompts: promptsProp, subtitle, placeholder }) {
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState("");
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (popRef.current && !popRef.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target)) setOpen(false); };
    const k = (e) => { if (e.key === "Escape") setOpen(false); };
    const reposition = () => { if (btnRef.current) { const r = btnRef.current.getBoundingClientRect(); setPos({ top: r.bottom + 9, right: Math.max(12, window.innerWidth - r.right) }); } };
    reposition();
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    window.addEventListener("resize", reposition); window.addEventListener("scroll", reposition, true);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); window.removeEventListener("resize", reposition); window.removeEventListener("scroll", reposition, true); };
  }, [open]);
  const prompts = promptsProp || CW_PROMPTS[stage] || [];
  const send = (t) => { const m = (t || txt).trim(); if (!m) return; pushToast({ kind: "info", icon: "sparkles", title: "Pedido enviado ao Cowork", msg: m.slice(0, 64) }); setTxt(""); setOpen(false); };
  const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send(); };
  const pop = open && pos ? ReactDOM.createPortal(
    <div className="cw-pop" ref={popRef} style={{ position: "fixed", top: pos.top, right: pos.right }}>
      <div className="cw-head"><span className="cw-ico"><Icon name="sparkles" size={13} /></span> Pedir ao Cowork</div>
      <div className="cw-sub">{subtitle || "Ele edita ideia, roteiro, pós e publicação — peça uma alteração ou variação."}</div>
      {prompts.length > 0 && <div className="cw-quick">{prompts.map((p, i) => <button key={i} className="cw-chip" onClick={() => send(p)}>{p}</button>)}</div>}
      <textarea className="cw-input" value={txt} onChange={e => setTxt(e.target.value)} onKeyDown={onKey} placeholder={placeholder || "Ex.: deixe o hook mais curto e provocativo…"} rows={3} autoFocus />
      <div className="cw-foot"><span className="cw-kbd">⌘ + ↵</span><button className="cw-send" onClick={() => send()} disabled={!txt.trim()}><Icon name="arrowright" size={13} /> Enviar pro Cowork</button></div>
    </div>, document.body) : null;
  return (
    <div className="cw-wrap">
      <button ref={btnRef} className={"cw-btn" + (compact ? " compact" : "") + (open ? " on" : "")} onClick={() => setOpen(o => !o)} title="Pedir ao Cowork">
        <Icon name="sparkles" size={14} /> {label}
      </button>
      {pop}
    </div>
  );
}

/* contentEditable field that commits on blur (Pós is fully editable) */
function EF({ value, onChange, tag = "b", className = "", ph }) {
  const Tag = tag;
  return <Tag className={("efx " + className).trim()} contentEditable suppressContentEditableWarning spellCheck={false}
    data-empty={!String(value || "").trim()} data-ph={ph}
    onBlur={e => onChange(e.currentTarget.textContent)}>{value}</Tag>;
}

const pillarById = (id) => VID.pillars.find(p => p.id === id) || VID.pillars[0];
const stageById = (id) => VID.stages.find(s => s.id === id) || VID.stages[0];

/* ============================================================
   HUB
   ============================================================ */
function VideoCard({ video, onOpen }) {
  const v = video.versions[video.primary];
  const pillar = pillarById(video.pillar);
  const langs = ["pt", "en"].filter(l => video.versions[l]);
  const t = vidTotals(v.beats);
  return (
    <button className="vcard" onClick={() => onOpen(video)}>
      <div className="vcard-top">
        <span className="vcard-code">{video.code}</span>
        <span className="vpill" style={{ "--pc": pillar.color }}><span className="vp-dot" /> {pillar.label}</span>
        <span className="vcard-langs">{langs.map(l => VID.channels[l].flag).join(" ")}</span>
      </div>
      <div className="vcard-title">{v.title || "Sem título"}</div>
      <div className="vcard-foot">
        <span className="vf-dur">{v.duration || "—"}</span>
        {v.beats.length > 0
          ? <span className="vf-beats"><Icon name="layers" size={12} /> {v.beats.length} beats · {vidFmt(t.dur)}</span>
          : <span className="vf-beats dim">{video.stage === "ideia" ? "direção" : "sem roteiro"}</span>}
      </div>
    </button>
  );
}

function VideoView({ theme }) {
  const [open, setOpen] = useState(null);
  const [pillar, setPillar] = useState("all");
  const [videos, setVideos] = useState(VID.videos);

  if (open) return <window.VideoEditor video={open} theme={theme} onBack={() => setOpen(null)} />;

  const shown = pillar === "all" ? videos : videos.filter(v => v.pillar === pillar);
  const count = (s) => videos.filter(v => v.stage === s).length;
  const stats = [
    { v: String(videos.length), l: "Total", c: "var(--text)" },
    { v: String(count("roteiro")), l: "Em roteiro", c: "var(--c-pipeline)" },
    { v: String(count("gravacao")), l: "Prontos p/ gravar", c: "var(--warn)" },
    { v: String(count("publicado")), l: "Publicados", c: "var(--c-links)" },
  ];

  return (
    <div className="fade-in">
      <div className="mod-head">
        <span className="mod-title">Vídeos</span>
        <span className="mod-live"><i /> Canal {VID.channels.pt.name} · {VID.channels.en.name}</span>
        <div className="grow" style={{ flex: 1 }} />
        <button className="btn primary" onClick={() => pushToast({ kind: "info", icon: "video", title: "Novo Vídeo", msg: "Começa como uma ideia — uma direção pra destrinchar depois." })}>
          <Icon name="plus" size={15} /> Novo Vídeo
        </button>
      </div>

      <div className="vhub-grid">
        {stats.map((s, i) => <div key={i} className="bstat" style={{ "--bc": s.c }}><div className="bv">{s.v}</div><div className="bl">{s.l}</div></div>)}
      </div>

      <div className="cat-rail">
        <button className={"cat-chip" + (pillar === "all" ? " on" : "")} onClick={() => setPillar("all")}>
          Todos <span className="ccount">{videos.length}</span>
        </button>
        {VID.pillars.map(p => {
          const c = videos.filter(v => v.pillar === p.id).length;
          return (
            <button key={p.id} className={"cat-chip" + (pillar === p.id ? " on" : "")} onClick={() => setPillar(p.id)}>
              <span className="cdot" style={{ background: p.color }} /> {p.label}
              {c > 0 && <span className="ccount">{c}</span>}
            </button>
          );
        })}
      </div>

      <div className="vkanban">
        {VID.stages.map(st => {
          const items = shown.filter(v => v.stage === st.id);
          return (
            <div key={st.id} className="vcol">
              <div className="vcol-head" style={{ "--kc": st.color }}>
                <span className="vdot" /><span className="vcol-name">{st.label}</span>
                <span className="vcol-count">{items.length}</span>
              </div>
              <div className="vcol-body">
                {items.length === 0
                  ? <div className="kcol-empty" style={{ padding: "14px 8px", fontSize: 12 }}>Vazio</div>
                  : items.map(v => <VideoCard key={v.code} video={v} onOpen={setOpen} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   LANGUAGE TOGGLE (a video can be PT, EN, or both)
   ============================================================ */
function VidLang({ versions, active, onSwitch, onAdd }) {
  const existing = ["pt", "en"].filter(l => versions[l]);
  const missing = ["pt", "en"].find(l => !versions[l]);
  if (existing.length === 1) {
    return (
      <div className="lang-toggle single" role="group">
        <span className="lang-current">{VID.channels[existing[0]].flag} {VID.channels[existing[0]].label}</span>
        {missing && (
          <button className="ver-add" onClick={() => onAdd(missing)} title={"Adicionar versão " + VID.channels[missing].label}>
            <Icon name="plus" size={12} /> {VID.channels[missing].label}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="lang-toggle" role="group">
      {["pt", "en"].map(l => (
        <button key={l} className={"lang-opt" + (active === l ? " on" : "")} onClick={() => onSwitch(l)}>
          {VID.channels[l].flag} {VID.channels[l].label}
        </button>
      ))}
    </div>
  );
}

/* ============================================================
   IDEIA — a direction/seed (often Cowork-generated). Light.
   ============================================================ */
function IdeiaStage({ cur, lang, patch, goRoteiro }) {
  const pillar = pillarById(cur.pillar);
  const [gen, setGen] = useState(false);
  const onTitle = (e) => patch({ title: e.currentTarget.textContent || "" });
  const onSeed = (e) => patch({ direction: e.currentTarget.textContent || "" });
  const SEED_POOL = [
    "Comece pela cena mais longe de casa e volte no tempo",
    "Abra com o número que dói — o contraste de preço Brasil × lá",
    "Conte pela perda: o que você deixou pra trás pra ir",
    "Enquadre como carta pra quem tem medo de sair do Brasil",
    "Mostre o plano em 3 atos antes de contar a história",
  ];
  const genMore = () => {
    setGen(true);
    setTimeout(() => {
      const have = new Set(cur.siblings || []);
      const next = SEED_POOL.filter(s => !have.has(s)).slice(0, 2);
      patch({ siblings: [...(cur.siblings || []), ...next] });
      setGen(false);
      pushToast({ kind: "info", icon: "sparkles", title: "Cowork gerou direções", msg: next.length ? next.length + " novas pra escolher" : "acabaram as sugestões" });
    }, 850);
  };
  return (
    <div className="vi-canvas fade-in">
      <div className="vi-kicker"><Icon name="sparkles" size={13} /> Direção · {VID.channels[lang].label}</div>
      <h1 className="vi-title" contentEditable suppressContentEditableWarning spellCheck={false}
        data-empty={!(cur.title || "").trim()} data-ph="Título de trabalho do vídeo…"
        onInput={onTitle} onBlur={onTitle}>{cur.title}</h1>

      <div className="vi-seed">
        <div className="vi-seed-head">
          <span className="vi-seed-ico"><Icon name="sparkles" size={14} /></span>
          <span className="vi-seed-name">A direção</span> <span className="vi-seed-sub">o ângulo que o roteiro vai desenvolver — ainda solto, de propósito</span>
        </div>
        <div className="vi-seed-text" contentEditable suppressContentEditableWarning spellCheck={false}
          data-empty={!(cur.direction || "").trim()} data-ph="Qual é a opinião ou a coisa que você quer discutir? Em 2–3 frases."
          onInput={onSeed} onBlur={onSeed}>{cur.direction}</div>
      </div>

      <div className="vi-alts">
        <div className="vi-alts-label">
          <span className="row gap-6"><Icon name="sparkles" size={12} /> Outras direções do Cowork</span>
          <button className="vi-alts-gen" onClick={genMore} disabled={gen}>
            {gen ? <><span className="cw-spin" /> gerando…</> : <><Icon name="sparkles" size={12} /> Gerar mais</>}
          </button>
        </div>
        {(cur.siblings || []).map((s, i) => (
          <button key={i} className="vi-alt" onClick={() => pushToast({ kind: "info", icon: "refresh", title: "Direção trocada", msg: s })}>
            <span className="va-n">{i + 1}</span>
            <span className="va-t">{s}</span>
            <span className="va-go"><Icon name="arrowright" size={14} /></span>
          </button>
        ))}
        {(!cur.siblings || cur.siblings.length === 0) && !gen && (
          <div className="vi-alts-empty">Sem alternativas ainda — peça ao Cowork pra gerar algumas.</div>
        )}
      </div>

      <div className="vi-meta">
        <span className="vi-chip"><span className="cdot" style={{ background: pillar.color }} /> {pillar.label}</span>
        {cur.angles && <span className="vi-chip"><span className="vc-k">Ângulos</span> {cur.angles}</span>}
        {cur.framework && <span className="vi-chip"><span className="vc-k">Framework</span> {cur.framework}</span>}
        {cur.duration && <span className="vi-chip"><span className="vc-k">Duração</span> {cur.duration}</span>}
      </div>

      <button className="vi-next" onClick={goRoteiro}>
        {cur.beats && cur.beats.length ? "Abrir o roteiro" : "Gerar o roteiro"} <Icon name="arrowright" size={15} />
      </button>
    </div>
  );
}

/* ============================================================
   ROTEIRO — the script you read. The spoken line is the star.
   ============================================================ */
function ScriptLine({ html, isKey, spoken, current, dataK, onToggle }) {
  return (
    <div className={"rb-line" + (isKey ? " key" : "") + (spoken ? " spoken" : "") + (current ? " current" : "")} data-k={dataK}>
      <button className="rb-mark" onClick={onToggle} title={spoken ? "Desmarcar" : "Marcar como falada"} aria-pressed={spoken}>
        <span className="rb-mark-dot">{spoken && <Icon name="check" size={11} />}</span>
      </button>
      <div className="rb-line-tx" contentEditable suppressContentEditableWarning spellCheck={false} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function RoteiroBeat({ beat, idx, notes, spoken, toggle, cursorKey }) {
  const lineIdx = (beat.script || []).map((it, i) => (it.t === "line" ? i : -1)).filter(i => i >= 0);
  const total = lineIdx.length;
  const done = lineIdx.filter(i => spoken.has(idx + "-" + i)).length;
  const full = total > 0 && done === total;
  return (
    <div className="rot-beat" id={"rb-" + idx}>
      <div className="rb-head">
        <span className="rb-num">#{idx + 1}</span>
        <span className="rb-name">{beat.name}</span>
        <span className="grow" />
        <span className={"rb-prog" + (full ? " full" : "")}>{done}/{total} faladas</span>
        <span className="rb-info">~{beatRead(beat)}s de fala</span>
      </div>
      <div className="rb-progbar"><span className={full ? "full" : ""} style={{ width: (total ? done / total * 100 : 0) + "%" }} /></div>
      {beat.tone && <div className="rb-tone"><Icon name="eye" size={14} /> {beat.tone}</div>}
      {(beat.script || []).map((it, i) => {
        if (it.t === "line") return <ScriptLine key={i} html={emphHtml(it.text)} isKey={it.key} spoken={spoken.has(idx + "-" + i)} current={cursorKey === idx + "-" + i} dataK={idx + "-" + i} onToggle={() => toggle(idx + "-" + i)} />;
        if (it.t === "pause") return <div key={i} className="rb-pause"><span className="rb-breath">respira <span className="rb-dur">{String(it.s).replace(".", ",")}s</span></span></div>;
        if (!notes) return null;
        if (it.t === "vis") return <div key={i} className="rb-note vis"><span className="rn-tag">Visual</span><span className="rn-tx">{it.text}</span></div>;
        if (it.t === "ed") return <div key={i} className="rb-note ed"><span className="rn-tag">Editor</span><span className="rn-tx">{it.text}</span></div>;
        return null;
      })}
    </div>
  );
}

function RoteiroStage({ cur, lang, notes, setNotes, patch, goIdeia }) {
  const t = vidTotals(cur.beats);
  const [spoken, setSpoken] = useState(() => new Set());
  const [cursor, setCursor] = useState(0);
  const [gen, setGen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const toggle = (k) => setSpoken(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const lineKeys = useMemo(() => { const ks = []; (cur.beats || []).forEach((b, bi) => (b.script || []).forEach((it, i) => { if (it.t === "line") ks.push(bi + "-" + i); })); return ks; }, [cur.beats]);
  const lineSecs = useMemo(() => { const arr = []; (cur.beats || []).forEach(b => (b.script || []).forEach(it => { if (it.t === "line") { const w = it.text.replace(/\*\*/g, "").split(/\s+/).filter(Boolean).length; arr.push(Math.max(1, Math.round(w / 2.1))); } })); return arr; }, [cur.beats]);
  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      if (el && (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "BUTTON")) return;
      if (e.key === "ArrowDown" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setCursor(c => { const k = lineKeys[c]; if (k) setSpoken(s => { const n = new Set(s); n.add(k); return n; }); return Math.min(c + 1, Math.max(0, lineKeys.length - 1)); });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor(c => { const nc = Math.max(c - 1, 0); const k = lineKeys[nc]; if (k) setSpoken(s => { const n = new Set(s); n.delete(k); return n; }); return nc; });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lineKeys.length]);
  useEffect(() => {
    const k = lineKeys[cursor]; if (!k) return;
    const el = document.querySelector('.rb-line[data-k="' + k + '"]');
    const sc = document.querySelector(".content");
    if (el && sc) { const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - sc.clientHeight * 0.35; smoothScrollTo(sc, top); }
  }, [cursor]);
  const genScript = () => {
    setGen(true);
    setTimeout(() => {
      const draft = [
        { name: "Hook", dur: 22, tone: "Calmo e direto. Olho na câmera. É um primeiro rascunho — reescreva com a sua voz.",
          script: [
            { t: "line", text: "Tem uma coisa que quase ninguém te conta sobre isso.", key: true },
            { t: "pause", s: 0.5 },
            { t: "line", text: "E nesse vídeo eu vou te mostrar exatamente o **porquê**." },
            { t: "ed", text: "Rascunho gerado a partir da direção: «" + (cur.direction || "").trim() + "». Reescreva o hook com o gancho real." },
          ] },
        { name: "Contexto", dur: 70, tone: "Conversacional. Constrói a base antes da virada.",
          script: [
            { t: "line", text: "Primeiro, deixa eu te situar onde isso começa." },
            { t: "line", text: "[ desenvolva o contexto da direção aqui ]" },
            { t: "vis", text: "B-roll do tema / lugar / tela — a cena é a estrela, nunca borrada." },
          ] },
        { name: "A Virada", dur: 80, tone: "Intensidade sobe. Convicção, sem arrogância.",
          script: [
            { t: "line", text: "Só que tem um detalhe que muda tudo.", key: true },
            { t: "pause", s: 0.8 },
            { t: "line", text: "[ o insight contraintuitivo — o número/contraste que dói ]" },
          ] },
        { name: "Resolução", dur: 50, tone: "Fecha o arco. Callback pro hook + gancho pro próximo.",
          script: [
            { t: "line", text: "E é por isso que isso importa pra **você**." },
            { t: "ed", text: "Amarre no hook. CTA + próximo vídeo da série." },
          ] },
      ];
      patch && patch({ beats: draft });
      setGen(false);
      pushToast({ kind: "info", icon: "sparkles", title: "Cowork rascunhou o roteiro", msg: "4 beats a partir da direção — agora é destrinchar." });
    }, 1100);
  };
  if (!cur.beats || cur.beats.length === 0) {
    const hasDir = !!(cur.direction || "").trim();
    return (
      <div className="rot-gen fade-in">
        <div className="rg-kick"><Icon name="edit" size={13} /> Roteiro · {VID.channels[lang].label}</div>
        <h1 className="rg-title">{cur.title || "Sem título"}</h1>
        <div className="rg-seedcard">
          <div className="rg-seed-h"><span className="rg-seed-ico"><Icon name="sparkles" size={13} /></span> <span className="rg-seed-name">A direção</span> <a className="rg-seed-edit" onClick={goIdeia}>editar</a></div>
          <div className="rg-seed-tx">{hasDir ? cur.direction : "Esse vídeo ainda não tem uma direção. Defina o ângulo na etapa Ideia antes de gerar o roteiro."}</div>
        </div>
        <div className="rg-actions">
          <button className="rg-gen" onClick={genScript} disabled={gen || !hasDir}>
            {gen ? <><span className="cw-spin" /> Gerando roteiro…</> : <><Icon name="sparkles" size={16} /> Gerar roteiro com Cowork</>}
          </button>
          <button className="rg-blank" onClick={() => patch && patch({ beats: [{ name: "Beat 1", dur: 30, tone: "", script: [{ t: "line", text: "" }] }] })} disabled={gen}>
            <Icon name="plus" size={14} /> Começar do zero
          </button>
        </div>
        <div className="rg-hint">O Cowork rascunha 4 beats a partir da direção — você destrincha até virar a sua fala.</div>
      </div>
    );
  }
  const totalLines = lineKeys.length;
  const cursorKey = lineKeys[cursor];
  const fmtClock = (s) => { const m = Math.floor(s / 60), ss = Math.round(s % 60); return m + ":" + String(ss).padStart(2, "0"); };
  const totalSecs = lineSecs.reduce((a, b) => a + b, 0);
  const elapsedSecs = lineSecs.slice(0, cursor).reduce((a, b) => a + b, 0);
  const readPct = totalSecs ? Math.round(elapsedSecs / totalSecs * 100) : 0;
  const jumpTo = (i) => {
    const el = document.getElementById("rb-" + i);
    const sc = document.querySelector(".content");
    if (el && sc) { const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 64; smoothScrollTo(sc, top); }
  };
  return (
    <div className="rot-doc fade-in">
      <div className="rot-sum">
        <span className="rs-k"><Icon name="layers" size={13} /> <b>{cur.beats.length}</b> beats</span>
        <span className="msep">·</span>
        <span className="rs-k"><Icon name="clock" size={13} /> alvo <b>{cur.duration || "—"}</b></span>
        <span className="msep">·</span>
        <span className="rs-k rot-clock"><Icon name="play" size={12} /> <b>{fmtClock(elapsedSecs)}</b> / {fmtClock(totalSecs)}</span>
        <span className="grow" />
        {confirmReset ? (
          <span className="rot-reset-confirm">
            <span className="rrc-q">Apagar o roteiro?</span>
            <button className="rrc-yes" onClick={() => { setConfirmReset(false); setSpoken(new Set()); setCursor(0); patch && patch({ beats: [] }); pushToast({ kind: "info", icon: "refresh", title: "Roteiro limpo", msg: "Volte a gerar com o Cowork ou comece do zero." }); }}>apagar</button>
            <button className="rrc-no" onClick={() => setConfirmReset(false)}>cancelar</button>
          </span>
        ) : (
          <button className="rot-reset" onClick={() => setConfirmReset(true)} title="Apagar e voltar a gerar"><Icon name="refresh" size={12} /> Recomeçar</button>
        )}
        {spoken.size > 0 && <button className="rot-clear" onClick={() => setSpoken(new Set())}><Icon name="refresh" size={12} /> limpar</button>}
        <span className="rot-spoken" title="Falas marcadas durante a leitura"><Icon name="checkcheck" size={13} /> {spoken.size}/{totalLines}</span>
        <button className={"rot-notetgl" + (notes ? " on" : "")} onClick={() => setNotes(n => !n)}>
          <Icon name={notes ? "eye" : "belloff"} size={13} /> Notas do editor
        </button>
      </div>
      <div className="rot-readbar"><span style={{ width: readPct + "%" }} /></div>
      <h1 className="rot-title">{cur.title || "Sem título"}</h1>
      <div className="rot-hint"><span className="rk">espaço</span> próxima fala <span className="rsep">·</span> <span className="rk">↑</span> voltar <span className="rsep">·</span> clique numa linha pra editar</div>
      {cur.beats.length > 1 && (
        <div className="rot-rail">
          {cur.beats.map((b, i) => {
            const li = (b.script || []).filter(s => s.t === "line");
            const dn = li.filter((s, j) => { let k = 0, idx2 = -1; (b.script || []).forEach((it, ii) => { if (it.t === "line") { if (k === j) idx2 = ii; k++; } }); return spoken.has(i + "-" + idx2); }).length;
            const fullB = li.length > 0 && dn === li.length;
            return (
              <button key={i} className={"rrl-chip" + (fullB ? " done" : "")} onClick={() => jumpTo(i)} title={b.name}>
                <span className="rrl-n">{i + 1}</span><span className="rrl-nm">{b.name}</span>
              </button>
            );
          })}
        </div>
      )}
      {cur.beats.map((b, i) => <RoteiroBeat key={i} beat={b} idx={i} notes={notes} spoken={spoken} toggle={toggle} cursorKey={cursorKey} />)}
    </div>
  );
}

/* ============================================================
   PÓS-PRODUÇÃO — the brief you hand the editor (b-roll, style,
   CTAs). Momentos-chave & b-roll are pulled from the roteiro.
   ============================================================ */
function keyLineText(beat) {
  const k = (beat.script || []).find(s => s.t === "line" && s.key) || (beat.script || []).find(s => s.t === "line");
  return k ? k.text.replace(/\*\*/g, "") : "";
}
function visNotes(beat) { return (beat.script || []).filter(s => s.t === "vis").map(s => s.text); }

function PPCard({ icon, title, sub, children }) {
  return (
    <section className="pp-card">
      <div className="pp-head"><span className="pp-ico"><Icon name={icon} size={14} /></span><span className="pp-title">{title}</span>{sub && <span className="pp-sub">{sub}</span>}</div>
      <div className="pp-body">{children}</div>
    </section>
  );
}

function PosStage({ cur, lang, versions, onExport, goRoteiro }) {
  const [D, setD] = useState(VID.editorDefaults);
  const setF = (k, v) => setD(d => ({ ...d, [k]: v }));
  const setStyleV = (i, v) => setD(d => ({ ...d, style: d.style.map((s, j) => j === i ? { ...s, v } : s) }));
  const beats = cur.beats || [];
  const langs = ["pt", "en"].filter(l => versions[l]).map(l => VID.channels[l].label).join(" + ");
  return (
    <div className="pp-doc fade-in">
      <div className="pp-bar">
        <div>
          <div className="pp-kick"><Icon name="sparkles" size={12} /> Pós-produção · brief pro editor</div>
          <div className="pp-editor"><Icon name="edit" size={11} /> tudo editável · ajuste por vídeo</div>
        </div>
        <div className="grow" />
        <button className="btn" onClick={onExport}><Icon name="rss" size={14} /> Exportar pro editor</button>
      </div>

      <div className="pp-grid">
        <PPCard icon="checkcheck" title="Entrega" sub="o combinado · clique para editar">
          <div className="pp-fields">
            <div className="pp-f"><span>Editor</span><EF value={D.editor} onChange={v => setF("editor", v)} ph="Nome do editor" /></div>
            <div className="pp-f"><span>Prazo</span><EF value={D.deadline} onChange={v => setF("deadline", v)} ph="Prazo" /></div>
            <div className="pp-f"><span>Revisão</span><EF value={D.turnaround} onChange={v => setF("turnaround", v)} ph="Turnaround" /></div>
            <div className="pp-f"><span>Versões</span><b>{langs}</b></div>
            <div className="pp-f wide"><span>Drive</span><EF value={D.drive} onChange={v => setF("drive", v)} ph="Pasta no Drive" /></div>
          </div>
          <div className="pp-energy"><Icon name="eye" size={13} /> <span><b>Energia:</b> <EF tag="span" className="ef-inline" value={D.energy} onChange={v => setF("energy", v)} ph="Energia/tom" /> <i>Ref: {D.references.join(" · ")}</i></span></div>
        </PPCard>

        {beats.length > 0 ? (
          <>
            <PPCard icon="target" title="Momentos-chave" sub="frase-âncora + cue visual, por beat">
              <div className="pp-moments">
                {beats.map((b, i) => (
                  <div key={i} className="pp-moment">
                    <span className="pp-mnum">#{i + 1}</span>
                    <div className="pp-mbody">
                      <div className="pp-mline">“{keyLineText(b)}”</div>
                      {visNotes(b)[0] && <div className="pp-mcue"><Icon name="media" size={12} /> {visNotes(b)[0]}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </PPCard>

            <PPCard icon="media" title="B-roll por beat" sub="o que cobrir em cada trecho">
              <div className="pp-broll">
                {beats.map((b, i) => {
                  const vs = visNotes(b);
                  if (!vs.length) return null;
                  return (
                    <div key={i} className="pp-broll-row">
                      <span className="pp-bname">#{i + 1} · {b.name}</span>
                      <ul>{vs.map((v, j) => <li key={j}>{v}</li>)}</ul>
                    </div>
                  );
                })}
              </div>
            </PPCard>
          </>
        ) : (
          <PPCard icon="target" title="Momentos-chave & b-roll">
            <div className="pp-empty">Saem do roteiro. <a className="pp-link" onClick={goRoteiro}>Destrinche o roteiro</a> e eles aparecem aqui automaticamente.</div>
          </PPCard>
        )}

        <PPCard icon="sliders" title="Estilo & ritmo" sub="o jeito do canal — editável">
          <div className="pp-style">
            {D.style.map((s, i) => (
              <div key={i} className="pp-srow"><span className="pp-sk">{s.k}</span><EF tag="span" className="pp-sv" value={s.v} onChange={v => setStyleV(i, v)} /></div>
            ))}
          </div>
        </PPCard>

        <PPCard icon="link" title="CTAs & QR" sub="atenção: muda por idioma">
          <div className="pp-cta-note"><Icon name="warn" size={13} /> {D.ctas.note}</div>
          <div className="pp-cta-table">
            <div className="pp-cta-h"><span /><span className={lang === "pt" ? "on" : ""}>🇧🇷 PT</span><span className={lang === "en" ? "on" : ""}>🇺🇸 EN</span></div>
            {D.ctas.rows.map((r, i) => (
              <div key={i} className="pp-cta-row">
                <span className="pp-ck">{r.k}</span>
                <span className={lang === "pt" ? "on" : ""}>{r.pt}</span>
                <span className={lang === "en" ? "on" : ""}>{r.en}</span>
              </div>
            ))}
          </div>
          <div className="pp-cta-disp"><Icon name="info" size={12} /> {D.ctas.display}</div>
        </PPCard>
      </div>
    </div>
  );
}

/* ============================================================
   PUBLICAÇÃO — every video ships with a 4-up A/B (thumb + title).
   ============================================================ */
const AB_COLORS = { A: "#8A8F98", B: "#E8823C", C: "#3FA9C0", D: "#A77CE8" };

function defaultAB(cur) {
  return { leader: "A", variants: [
    { id: "A", tag: "original", title: cur.title || "", thumb: "thumb principal" },
    { id: "B", title: "", thumb: "variação de gancho" },
    { id: "C", title: "", thumb: "variação de cena" },
    { id: "D", title: "", thumb: "variação de rosto" },
  ] };
}

function VidPublicacaoStage({ cur, lang, video }) {
  const ab = cur.ab || defaultAB(cur);
  const [variants, setVariants] = useState(ab.variants);
  const [leader, setLeader] = useState(ab.leader);
  const [genT, setGenT] = useState(false);
  const setV = (id, key, val) => setVariants(vs => vs.map(v => v.id === id ? { ...v, [key]: val } : v));
  const TITLE_POOL = [
    "O Preço de Largar Tudo (em Números Reais)",
    "3 Movimentos, 1 Estratégia — o Plano Completo",
    "Por Que Ninguém Faz o Que Eu Fiz",
    "A Conta Que Mudou Minha Decisão",
  ];
  const genTitles = () => {
    setGenT(true);
    setTimeout(() => {
      let p = 0; let filled = 0;
      setVariants(vs => vs.map((v, i) => {
        if (i === 0 || (v.title || "").trim()) return v;
        filled++; return { ...v, title: TITLE_POOL[p++] || "" };
      }));
      setGenT(false);
      pushToast({ kind: "info", icon: "sparkles", title: "Cowork sugeriu títulos", msg: filled ? filled + " preenchidos — ajuste à vontade" : "todos já têm título" });
    }, 850);
  };
  const published = video.stage === "publicado";
  return (
    <div className="pub-doc fade-in">
      <div className="pub-bar">
        <div>
          <div className="pp-kick"><Icon name="trending" size={12} /> Publicação · teste A/B na estreia</div>
          <div className="pp-editor">{VID.channels[lang].name} · 4 variações no YouTube Test &amp; Compare</div>
        </div>
        <div className="grow" />
        {published
          ? <span className="ed-status live"><span className="es-dot" /> No ar · teste rodando</span>
          : <button className="btn primary" onClick={() => pushToast({ kind: "success", icon: "rss", title: "Publicar + iniciar teste", msg: "4 variações entram em rotação automática." })}><Icon name="rss" size={14} /> Publicar + iniciar teste</button>}
      </div>

      <div className="pub-note"><Icon name="info" size={14} /> <span>As <b>thumbnails você desenvolve no Claude Design</b> — aqui ficam o <b>brief</b> e o <b>título</b> de cada variação. O canal sempre estreia com 4 (mesma DNA, ganchos diferentes); o público escolhe pela retenção.</span></div>

      <div className="pub-gen-row">
        <span className="pp-kick"><Icon name="layers" size={12} /> 4 variações</span>
        <span className="grow" />
        {published
          ? <span className="pub-locknote"><Icon name="lock" size={12} /> no ar — títulos travados</span>
          : <button className="cw-btn compact" onClick={genTitles} disabled={genT}>
              {genT ? <><span className="cw-spin" /> gerando…</> : <><Icon name="sparkles" size={13} /> Sugerir títulos com Cowork</>}
            </button>}
      </div>

      <div className={"ab-grid" + (published ? " locked" : "")}>
        {variants.map(v => (
          <div key={v.id} className={"ab-card" + (leader === v.id ? " leader" : "")} style={{ "--vc": AB_COLORS[v.id] }}>
            <div className="ab-thumb">
              <span className="ab-badge">{v.id}</span>
              <div className="ab-thumb-ph"><Icon name="media" size={19} /><span className="ab-thumb-tx">1280×720</span></div>
              {!published && <button className="ab-thumb-set" onClick={() => pushToast({ kind: "info", icon: "sparkles", title: "Abrir no Claude Design", msg: "Desenvolver a thumb " + v.id + " a partir do brief." })}><Icon name="sparkles" size={12} /> Claude Design</button>}
              {v.tag && <span className="ab-tag">{v.tag}</span>}
              {published
                ? (leader === v.id && <span className="ab-winner"><Icon name="trophy" size={11} /> liderando</span>)
                : <button className={"ab-lead-btn" + (leader === v.id ? " on" : "")} title={leader === v.id ? "Variação líder" : "Marcar como líder"} onClick={() => setLeader(v.id)}><Icon name="trophy" size={11} /> {leader === v.id ? "líder" : "líder?"}</button>}
            </div>
            <div className="ab-fields">
              <label className="ab-lbl">Título {v.id}</label>
              <div className="ab-title efx" contentEditable={!published} suppressContentEditableWarning spellCheck={false}
                data-empty={!(v.title || "").trim()} data-ph={"Título da variação " + v.id + "…"}
                onBlur={e => setV(v.id, "title", e.currentTarget.textContent)}>{v.title}</div>
              <label className="ab-lbl">Brief da thumb <span className="ab-lbl-sub">o que ela comunica</span></label>
              <div className="ab-brief efx" contentEditable={!published} suppressContentEditableWarning spellCheck={false}
                data-empty={!(v.thumb || "").trim()} data-ph="Ex.: rosto + bandeiras, rim-light laranja, olhar pro preço…"
                onBlur={e => setV(v.id, "thumb", e.currentTarget.textContent)}>{v.thumb}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="pub-foot">
        <span className="pp-kick"><Icon name="posts" size={12} /> Distribuição no dia</span>
        <div className="pub-dist">
          {[["Instagram", "#d6336c"], ["Bluesky", "#1185fe"], ["Comunidade YT", "#ef4444"], ["Newsletter", "#a855f7"]].map(([n, c]) => (
            <button key={n} className="pub-chan" onClick={() => pushToast({ kind: "info", icon: "posts", title: n, msg: "Agendar junto com a estreia." })}><span className="pc-dot" style={{ background: c }} /> {n}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   EDITOR SHELL
   ============================================================ */
const VIDEO_STAGES = [
  { id: "ideia", label: "Ideia", ic: "sparkles" },
  { id: "roteiro", label: "Roteiro", ic: "edit" },
  { id: "pos", label: "Pós", ic: "sliders" },
  { id: "publicacao", label: "Publicação", ic: "rss" },
];
const STAGE_IDX = { ideia: 0, roteiro: 1, pos: 2, publicacao: 3 };
const REACHED_BY = { ideia: 0, roteiro: 1, gravacao: 2, publicado: 3 };
const OPEN_AT = { ideia: "ideia", roteiro: "roteiro", gravacao: "pos", publicado: "publicacao" };
/* Pós & Publicação only open once the video is gravado (reached ≥ 2) */
const STAGE_GATE = { ideia: 0, roteiro: 0, pos: 2, publicacao: 2 };

function LockedStage({ stageId, onAdvance }) {
  const M = {
    pos: { ic: "sliders", title: "A pós entra depois de gravar", sub: "O brief pro editor — b-roll, estilo, CTAs — abre quando o vídeo é gravado. Por enquanto, o roteiro é o foco." },
    publicacao: { ic: "rss", title: "A publicação abre quando o vídeo estiver pronto", sub: "Os 4 testes A/B (thumbnail + título) entram quando o vídeo é gravado e editado." },
  }[stageId];
  return (
    <div className="locked-stage fade-in">
      <div className="ls-ico"><Icon name="lock" size={22} /><span className="ls-badge"><Icon name={M.ic} size={12} /></span></div>
      <h3 className="ls-title">{M.title}</h3>
      <p className="ls-sub">{M.sub}</p>
      <button className="btn primary" onClick={onAdvance}><Icon name="checkcheck" size={15} /> Marcar como gravado</button>
      <div className="ls-hint">Libera Pós e Publicação.</div>
    </div>
  );
}

function VideoEditor({ video, theme, onBack }) {
  const [versions, setVersions] = useState(video.versions);
  const [activeLang, setActiveLang] = useState(video.primary);
  const [stage, setStage] = useState(OPEN_AT[video.stage] || "roteiro");
  const [progress, setProgress] = useState(REACHED_BY[video.stage] ?? 0);
  const ro = video.stage === "publicado";
  const isLocked = (id) => STAGE_GATE[id] > progress;
  const advance = (to) => { setProgress(p => Math.max(p, to)); pushToast({ kind: "success", icon: "checkcheck", title: "Vídeo marcado como gravado", msg: "Pós e Publicação liberadas." }); };
  const [focus, setFocus] = useState(false);
  const [notes, setNotes] = useState(false);
  const [recording, setRecording] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const cur = versions[activeLang];
  const st = stageById(video.stage);

  const patch = (obj) => setVersions(vs => ({ ...vs, [activeLang]: { ...vs[activeLang], ...obj } }));
  const switchLang = (l) => { if (versions[l]) setActiveLang(l); };
  const addLang = (l) => {
    setVersions(vs => ({ ...vs, [l]: blankVersion(l) }));
    setActiveLang(l);
    pushToast({ kind: "info", icon: "plus", title: "Versão " + VID.channels[l].label + " criada", msg: "Roteiro próprio — escreva do zero, não é tradução." });
  };

  return (
    <div className={"fade-in vid-ed" + (ro ? " vid-ro" : "")}>
      <div className="ed-bar">
        <div className="ed-bc">
          <a className="eb-back" onClick={onBack}><Icon name="chevronl" size={15} /> Voltar</a>
          <span className="msep">/</span>
          <a className="eb-back" onClick={onBack} style={{ gap: 0 }}>Vídeos</a>
          <span className="msep">/</span>
          <span className="eb-code">{video.code}</span>
        </div>
        <div className="grow" />
        <VidLang versions={versions} active={activeLang} onSwitch={switchLang} onAdd={addLang} />
        <span className="ed-status draft"><span className="es-dot" style={{ background: st.color }} />{st.label}</span>
        <button className={"ed-iconbtn" + (focus ? " on" : "")} title="Modo foco (Esc)" onClick={() => setFocus(f => !f)}><Icon name="eye" size={16} /></button>
        <CoworkButton stage={stage} />
        <button className="ed-recbtn" onClick={() => setRecording(true)}><Icon name="play" size={14} /> Modo Gravação</button>
      </div>

      {!focus && (
        <div className="ed-stages vid-stages">
          {VIDEO_STAGES.map(s => {
            const tl = isLocked(s.id);
            const done = !tl && STAGE_IDX[s.id] < progress && s.id !== stage;
            return (
              <button key={s.id} className={"ed-stage" + (s.id === stage ? " on" : "") + (tl ? " locked" : "") + (done ? " done" : "")} onClick={() => setStage(s.id)}>
                <Icon name={tl ? "lock" : s.ic} size={14} /><span className="esl">{s.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {ro && !focus && (
        <div className="vid-robanner"><Icon name="checkcircle" size={15} /> <span><b>Publicado · no ar.</b> Edições limitadas — para mudar algo, peça ao <b>Cowork</b> ou despublique.</span></div>
      )}

      {stage === "ideia" && <IdeiaStage cur={cur} lang={activeLang} patch={patch} goRoteiro={() => setStage("roteiro")} />}
      {stage === "roteiro" && <RoteiroStage cur={cur} lang={activeLang} notes={notes} setNotes={setNotes} patch={patch} goIdeia={() => setStage("ideia")} />}
      {stage === "pos" && (isLocked("pos") ? <LockedStage stageId="pos" onAdvance={() => advance(2)} /> : <PosStage cur={cur} lang={activeLang} versions={versions} onExport={() => setHandoff(true)} goRoteiro={() => setStage("roteiro")} />)}
      {stage === "publicacao" && (isLocked("publicacao") ? <LockedStage stageId="publicacao" onAdvance={() => advance(2)} /> : <VidPublicacaoStage cur={cur} lang={activeLang} video={video} />)}

      {focus && (
        <button className="focus-exit" onClick={() => setFocus(false)}>
          <Icon name="eye" size={14} /> <b>Modo foco</b> — clique para sair · <span className="mono">esc</span>
        </button>
      )}

      {recording && <window.RecordingSheet video={video} versions={versions} lang={activeLang} onClose={() => setRecording(false)} />}
      {handoff && <window.HandoffSheet video={video} versions={versions} lang={activeLang} onClose={() => setHandoff(false)} />}
    </div>
  );
}

Object.assign(window, { VideoView, VideoEditor, keyLineText, visNotes, CoworkButton });

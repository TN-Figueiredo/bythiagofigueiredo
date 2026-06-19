/* ============================================================
   GRAVAÇÃO — the recording sheet. A paper page you print and
   mark by hand. The spoken line is huge with generous leading;
   editor notes (visual cues, b-roll, refs) live behind a toggle
   so they never compete with what you say out loud.
   Portaled to <body> so print can hide the whole app.
   ============================================================ */

function RecLine({ item, showEd }) {
  if (item.t === "line") {
    return <div className={"rs-line" + (item.key ? " key" : "")}><span className="rs-tick" aria-hidden="true" /><span className="rs-line-tx" dangerouslySetInnerHTML={{ __html: window.emphHtml(item.text) }} /></div>;
  }
  if (item.t === "pause") {
    return <div className="rs-pause"><span className="rs-breath">respira <span className="rs-dur">{String(item.s).replace(".", ",")}s</span></span></div>;
  }
  if (!showEd) return null;
  if (item.t === "vis") return <div className="rs-note"><span className="rsn-tag">Visual</span><span>{item.text}</span></div>;
  if (item.t === "ed") return <div className="rs-note"><span className="rsn-tag">Editor</span><span>{item.text}</span></div>;
  return null;
}

function RecBeat({ beat, idx, showEd }) {
  return (
    <div className="rs-beat">
      <div className="rs-beat-head">
        <span className="rs-beat-num">#{idx + 1}</span>
        <span className="rs-beat-name">{beat.name}</span>
        <span className="rs-beat-info">~{window.beatRead(beat)}s de fala</span>
      </div>
      {beat.tone && <div className="rs-tone"><span className="rst-k">Direção</span><span>{beat.tone}</span></div>}
      {(beat.script || []).map((it, i) => <RecLine key={i} item={it} showEd={showEd} />)}
    </div>
  );
}

function RecordingSheet({ video, versions, lang, onClose }) {
  const VD = window.VIDEO_DATA;
  const [showEd, setShowEd] = useState(false);
  const [scale, setScale] = useState(1);
  const [density, setDensity] = useState("conf"); // 'comp' | 'conf'
  const [curLang, setCurLang] = useState(lang);
  const cur = versions[curLang] || versions[lang];
  const bothLangs = ["pt", "en"].filter(l => versions[l]);
  const pillar = VD.pillars.find(p => p.id === cur.pillar) || VD.pillars[0];
  const t = window.vidTotals(cur.beats);

  useEffect(() => {
    document.body.classList.add("recording");
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => { document.body.classList.remove("recording"); window.removeEventListener("keydown", h); };
  }, []);

  const bump = (d) => setScale(s => Math.min(1.4, Math.max(0.85, +(s + d).toFixed(2))));

  const overlay = (
    <div className={"rec-overlay dens-" + density} style={{ "--rs-scale": scale }}>
      <div className="rec-bar">
        <button className="rb-back" onClick={onClose}><Icon name="chevronl" size={15} /> Fechar</button>
        <span className="rb-title">{cur.title || "Sem título"}</span>
        <span className="rb-spacer" />

        {bothLangs.length > 1 && (
          <div className="rec-seg">
            {bothLangs.map(l => (
              <button key={l} className={curLang === l ? "on" : ""} onClick={() => setCurLang(l)}>{VD.channels[l].flag} {VD.channels[l].label}</button>
            ))}
          </div>
        )}

        <label className="rb-toggle" onClick={() => setShowEd(s => !s)}>
          <span className={"tg" + (showEd ? " on" : "")} /> Notas do editor
        </label>

        <div className="rec-seg" title="Densidade da folha">
          <button className={density === "comp" ? "on" : ""} onClick={() => setDensity("comp")}>Compacto</button>
          <button className={density === "conf" ? "on" : ""} onClick={() => setDensity("conf")}>Confortável</button>
        </div>

        <div className="rec-ctl">
          <span className="rec-ctl-lbl">Texto</span>
          <button onClick={() => bump(-0.05)} title="Menor">A−</button>
          <button onClick={() => bump(0.05)} title="Maior" style={{ fontSize: 16 }}>A+</button>
        </div>

        <button className="rb-print" onClick={() => window.print()}><Icon name="rss" size={14} /> Imprimir</button>
      </div>

      {cur.beats && cur.beats.length > 0 ? (
        <div className="rec-sheet">
          <div className="rsh-kick">Roteiro de Gravação · {VD.channels[curLang].label} · {video.code}</div>
          <h1 className="rsh-title">{cur.title}</h1>
          <div className="rsh-meta">
            <span><b>Canal</b>{VD.channels[curLang].name}</span>
            <span><b>Pilar</b>{pillar.label}</span>
            <span><b>Duração</b>{cur.duration || "—"}</span>
            <span><b>Fala</b>~{window.vidFmt(t.read)}</span>
            <span><b>Beats</b>{cur.beats.length}</span>
            {cur.location && <span><b>Local</b>{cur.location}</span>}
          </div>

          {cur.beats.map((b, i) => <RecBeat key={i} beat={b} idx={i} showEd={showEd} />)}

          <div className="rsh-foot">
            <span>tf — Thiago Figueiredo · {VD.channels[curLang].name}</span>
            <span>{showEd ? "com notas do editor" : "só a fala"} · marque à mão antes de gravar</span>
          </div>
        </div>
      ) : (
        <div className="rec-empty">
          <Icon name="edit" size={34} />
          <h3>Esse vídeo ainda não tem roteiro</h3>
          <p>É só uma direção por enquanto. Volte pra etapa <b>Ideia</b>, destrinche em beats, e o modo de gravação fica pronto pra imprimir.</p>
        </div>
      )}
    </div>
  );

  return ReactDOM.createPortal(overlay, document.body);
}

Object.assign(window, { RecordingSheet });

/* ============================================================
   HANDOFF — the editor brief as a printable paper sheet.
   Same paper system as the recording sheet; content is the
   post-production instructions (deliverables, b-roll, style, CTAs).
   ============================================================ */
function HandoffSheet({ video, versions, lang, onClose }) {
  const VD = window.VIDEO_DATA;
  const D = VD.editorDefaults;
  const [curLang, setCurLang] = useState(lang);
  const cur = versions[curLang] || versions[lang];
  const beats = cur.beats || [];
  const langs = ["pt", "en"].filter(l => versions[l]).map(l => VD.channels[l].label).join(" + ");
  const bothLangs = ["pt", "en"].filter(l => versions[l]);

  useEffect(() => {
    document.body.classList.add("recording");
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => { document.body.classList.remove("recording"); window.removeEventListener("keydown", h); };
  }, []);

  const overlay = (
    <div className="rec-overlay">
      <div className="rec-bar">
        <button className="rb-back" onClick={onClose}><Icon name="chevronl" size={15} /> Fechar</button>
        <span className="rb-title">Brief pro editor · {cur.title || "Sem título"}</span>
        <span className="rb-spacer" />
        {bothLangs.length > 1 && (
          <div className="rec-seg">
            {bothLangs.map(l => <button key={l} className={curLang === l ? "on" : ""} onClick={() => setCurLang(l)}>{VD.channels[l].flag} {VD.channels[l].label}</button>)}
          </div>
        )}
        <button className="rb-print" onClick={() => window.print()}><Icon name="rss" size={14} /> Imprimir</button>
      </div>

      <div className="rec-sheet hs">
        <div className="rsh-kick">Instruções de edição · {VD.channels[curLang].label} · {video.code}</div>
        <h1 className="rsh-title">{cur.title}</h1>
        <div className="rsh-meta">
          <span><b>Editor</b>{D.editor}</span>
          <span><b>Prazo</b>{D.deadline}</span>
          <span><b>Revisão</b>{D.turnaround}</span>
          <span><b>Versões</b>{langs}</span>
        </div>

        <div className="hs-sec">
          <h2 className="hs-h">Visão geral</h2>
          <p className="hs-p">{D.energy}</p>
          <p className="hs-p"><b>Referência de energia:</b> {D.references.join(" · ")}. <b>Drive:</b> {D.drive}.</p>
        </div>

        {beats.length > 0 && (
          <div className="hs-sec">
            <h2 className="hs-h">Momentos-chave & b-roll</h2>
            {beats.map((b, i) => {
              const vs = window.visNotes(b);
              return (
                <div key={i} className="hs-beat">
                  <div className="hs-beat-h"><span className="hs-bn">#{i + 1}</span> {b.name} <span className="hs-bdur">{window.vidFmt(b.dur)}</span></div>
                  <div className="hs-anchor">“{window.keyLineText(b)}”</div>
                  {vs.map((v, j) => <div key={j} className="hs-cue"><span className="hs-cue-k">B-roll</span> {v}</div>)}
                </div>
              );
            })}
          </div>
        )}

        <div className="hs-sec">
          <h2 className="hs-h">Estilo & ritmo</h2>
          {D.style.map((s, i) => (
            <div key={i} className="hs-style"><span className="hs-sk">{s.k}</span><span className="hs-sv">{s.v}</span></div>
          ))}
        </div>

        <div className="hs-sec">
          <h2 className="hs-h">CTAs & QR <span className="hs-warn">⚠ muda por idioma</span></h2>
          <p className="hs-p"><b>{D.ctas.note}</b></p>
          <table className="hs-table">
            <thead><tr><th></th><th>🇧🇷 PT</th><th>🇺🇸 EN</th></tr></thead>
            <tbody>
              {D.ctas.rows.map((r, i) => (
                <tr key={i} className={curLang === "pt" ? "hl-pt" : "hl-en"}><td className="hs-ck">{r.k}</td><td>{r.pt}</td><td>{r.en}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="hs-p hs-dim">{D.ctas.display}</p>
        </div>

        <div className="rsh-foot">
          <span>tf — Thiago Figueiredo · brief pro editor</span>
          <span>{VD.channels[curLang].name}</span>
        </div>
      </div>
    </div>
  );
  return ReactDOM.createPortal(overlay, document.body);
}

Object.assign(window, { HandoffSheet });

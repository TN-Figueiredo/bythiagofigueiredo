/* ============================================================
   social/canvas.jsx — editor de canvas REAPROVEITÁVEL (Story-first)
   Mesmo editor usado em Links/Newsletter/etc. Aqui no contexto de Posts.
   ============================================================ */

/* default design: Blog → Story (template automático) */
function defaultStoryDesign() {
  return {
    bg: "#F7F1E8",
    bgKind: "solid",
    elements: [
      { id: "frame", type: "frame", label: "Moldura editorial", color: "#1F1B17", locked: false },
      { id: "kicker", type: "text", label: "Kicker", text: "NO BLOG", font: "mono", size: 26, color: "#9a6b3f", x: 50, y: 13, align: "center", boxed: true },
      { id: "title", type: "text", label: "Título", text: "Aprendi inglês\nbrigando online", font: "serif", size: 78, color: "#1F1B17", x: 50, y: 28, align: "center", weight: 700 },
      { id: "image", type: "image", label: "Capa do post", x: 50, y: 56, w: 70, h: 26 },
      { id: "sticker", type: "sticker", label: "Sticker de link", text: "LER O POST", x: 50, y: 80 },
      { id: "logo", type: "logo", label: "Carimbo TF", x: 50, y: 92 },
    ],
  };
}

const FONT_OPTS = [
  { id: "serif", label: "Fraunces", css: "Fraunces, serif" },
  { id: "sans", label: "Inter", css: "Inter, sans-serif" },
  { id: "mono", label: "JetBrains", css: "JetBrains Mono, monospace" },
];
const SWATCHES = ["#1F1B17", "#F7F1E8", "#F2683C", "#9a6b3f", "#46B17E", "#5B7FD6"];

function fontCss(f) { return (FONT_OPTS.find((x) => x.id === f) || FONT_OPTS[1]).css; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/* ---------- the artboard (drag + resize quando editable) ---------- */
function Artboard({ design, ratio, selId, onSel, scale, flat, editable, onUpdate }) {
  const w = ratio.w / ratio.h > 1 ? Math.round(scale) : Math.round(scale * ratio.w / ratio.h);
  const h = ratio.w / ratio.h > 1 ? Math.round(scale * ratio.h / ratio.w) : Math.round(scale);
  const ref = w;
  const artRef = useRef(null);
  const isVideo = design.bgKind === "video";

  const pick = (e, el) => { if (onSel) { e.stopPropagation(); onSel(el.id); } };
  const startDrag = (e, el) => {
    if (!editable || !onUpdate || el.locked) return;
    e.preventDefault(); e.stopPropagation(); onSel && onSel(el.id);
    const rect = artRef.current.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY, ox = el.x, oy = el.y;
    let moved = false;
    const move = (ev) => { moved = true; const dx = (ev.clientX - sx) / rect.width * 100, dy = (ev.clientY - sy) / rect.height * 100; onUpdate(el.id, { x: clamp(ox + dx, 1, 99), y: clamp(oy + dy, 1, 99) }); };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const startResize = (e, el) => {
    if (!editable || !onUpdate) return;
    e.preventDefault(); e.stopPropagation();
    const rect = artRef.current.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const o = { size: el.size, w: el.w, h: el.h, scale: el.scale || 1 };
    const move = (ev) => {
      const dxp = (ev.clientX - sx) / rect.width * 100, dyp = (ev.clientY - sy) / rect.height * 100;
      if (el.type === "text") onUpdate(el.id, { size: clamp(Math.round(o.size + dxp * 2.4), 12, 240) });
      else if (el.type === "image" || el.type === "gif") onUpdate(el.id, { w: clamp(o.w + dxp, 10, 98), h: clamp(o.h + dyp, 6, 98) });
      else onUpdate(el.id, { scale: clamp(+(o.scale + dxp / 45).toFixed(2), 0.5, 3) });
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const Handle = ({ el }) => editable && selId === el.id ? (
    <div onPointerDown={(e) => startResize(e, el)} style={{ position: "absolute", right: -7, bottom: -7, width: 14, height: 14, borderRadius: 4, background: "var(--accent)", border: "2px solid #15120d", cursor: "nwse-resize", zIndex: 5 }} />
  ) : null;

  return (
    <div ref={artRef} style={{ position: "relative", width: w, height: h, background: isVideo ? "#0b0b0d" : design.bgKind === "gradient" ? "linear-gradient(155deg,#F7F1E8,#EDE3D2)" : design.bg, borderRadius: flat ? 0 : 6, overflow: "hidden", boxShadow: flat ? "none" : "0 30px 70px -24px rgba(0,0,0,0.7)", outline: selId === "bg" ? "2px solid var(--accent)" : "none", touchAction: editable ? "none" : "auto" }}
      onClick={(e) => { if (e.target === e.currentTarget && onSel) onSel("bg"); }}>
      {/* video background layer */}
      {isVideo && (
        <div onClick={(e) => { if (onSel) { e.stopPropagation(); onSel("bg"); } }} style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,#2a3340,#0f1820)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(122deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 9px)" }} />
          <div style={{ width: ref * 0.13, height: ref * 0.13, borderRadius: 99, background: "rgba(0,0,0,0.45)", border: "2px solid rgba(255,255,255,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="play" size={ref * 0.06} fill="#fff" style={{ color: "#fff", marginLeft: ref * 0.012 }} /></div>
          <span className="mono" style={{ position: "absolute", left: 8, top: 8, fontSize: ref * 0.026, color: "#fff", background: "rgba(0,0,0,0.55)", padding: "2px 7px", borderRadius: 5, display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="video" size={ref * 0.026} /> vídeo editado · 0:38</span>
        </div>
      )}
      {design.elements.map((el) => {
        const sel = selId === el.id;
        const cur = editable && !el.locked ? "move" : (onSel ? "pointer" : "default");
        if (el.type === "frame")
          return <div key={el.id} onClick={(e) => pick(e, el)} style={{ position: "absolute", inset: "5%", border: `1px solid ${el.color}40`, borderRadius: 4, cursor: onSel ? "pointer" : "default", outline: sel ? "2px solid var(--accent)" : "none", pointerEvents: editable ? "none" : "auto" }} />;
        const baseScale = el.scale || 1;
        const common = { position: "absolute", left: `${el.x}%`, top: `${el.y}%`, transform: `translate(-50%,-50%) scale(${baseScale})`, cursor: cur, outline: sel ? "2px solid var(--accent)" : "none", outlineOffset: 3, borderRadius: 4, touchAction: editable ? "none" : "auto" };
        const handlers = editable ? { onPointerDown: (e) => startDrag(e, el) } : { onClick: (e) => pick(e, el) };
        if (el.type === "text")
          return (
            <div key={el.id} {...handlers} style={{ ...common, width: "84%", textAlign: el.align }}>
              {el.boxed ? (
                <span style={{ fontFamily: fontCss(el.font), fontSize: ref * (el.size / 1080), letterSpacing: "0.22em", color: el.color, border: `1px solid ${el.color}80`, padding: "5px 11px", borderRadius: 3, display: "inline-block" }}>{el.text}</span>
              ) : (
                <div style={{ fontFamily: fontCss(el.font), fontSize: ref * (el.size / 1080), fontWeight: el.weight || 400, color: el.color, lineHeight: 1.02, whiteSpace: "pre-line", letterSpacing: "-0.01em" }}>{el.text}</div>
              )}
              <Handle el={el} />
            </div>
          );
        if (el.type === "image")
          return (
            <div key={el.id} {...handlers} style={{ ...common, width: `${el.w}%`, height: `${el.h}%`, background: "linear-gradient(135deg,#3a2456,#160c24)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <div style={{ position: "absolute", left: "10%", bottom: "-10%", width: "50%", height: "95%", background: "radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.16), transparent 65%)" }} />
              <Icon name="image" size={ref * 0.07} style={{ color: "rgba(255,255,255,0.5)" }} />
              <Handle el={el} />
            </div>
          );
        if (el.type === "gif")
          return (
            <div key={el.id} {...handlers} style={{ ...common, width: `${el.w}%`, height: `${el.h}%`, background: "rgba(0,0,0,0.25)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "1px dashed rgba(255,255,255,0.4)" }}>
              <span style={{ fontSize: ref * 0.09 }}>{el.emoji || "✨"}</span>
              <span className="mono" style={{ position: "absolute", left: 4, top: 4, fontSize: ref * 0.022, color: "#fff", background: "rgba(0,0,0,0.5)", padding: "1px 5px", borderRadius: 4 }}>GIF</span>
              <Handle el={el} />
            </div>
          );
        if (el.type === "sticker")
          return (
            <div key={el.id} {...handlers} style={{ ...common }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", color: "#111", fontSize: ref * 0.032, fontWeight: 700, padding: "7px 14px", borderRadius: 9, boxShadow: "0 4px 14px rgba(0,0,0,0.25)" }}>
                <Icon name="links" size={ref * 0.03} /> {el.text}
              </span>
              <Handle el={el} />
            </div>
          );
        if (el.type === "logo")
          return (
            <div key={el.id} {...handlers} style={{ ...common }}>
              <div style={{ width: ref * 0.1, height: ref * 0.1, borderRadius: "50%", border: `1.5px solid #E0651E`, display: "flex", alignItems: "center", justifyContent: "center", color: isVideo ? "#fff" : "#1F1B17", fontFamily: "Fraunces, serif", fontWeight: 700, fontSize: ref * 0.04 }}>TF</div>
              <Handle el={el} />
            </div>
          );
        return null;
      })}
    </div>
  );
}

/* ---------- left rail: ratio, add, background, layers ---------- */
function LeftRail({ design, setDesign, ratio, setRatio, selId, onSel, onAdd }) {
  const RAT = window.SOCIAL.RATIOS;
  return (
    <div style={{ width: 248, flexShrink: 0, borderRight: "1px solid var(--line)", background: "var(--bg-side)", overflowY: "auto", padding: "16px 14px" }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Formato</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
        {RAT.map((r) => {
          const on = ratio.id === r.id;
          return (
            <button key={r.id} onClick={() => setRatio(r)} style={{ padding: "9px 4px", borderRadius: 8, border: "1px solid " + (on ? "var(--accent)" : "var(--line-strong)"), background: on ? "var(--accent-soft)" : "var(--surface-2)", color: on ? "var(--accent)" : "var(--ink-dim)", textAlign: "center" }}>
              <div style={{ fontSize: 11.5, fontWeight: 600 }}>{r.label}</div>
              <div className="mono" style={{ fontSize: 8.5, marginTop: 2, opacity: 0.8 }}>{r.px}</div>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18 }}>
        <Icon name="info" size={12} style={{ color: "var(--ink-faint)" }} />
        <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>{ratio.hint}</span>
      </div>

      <div className="eyebrow" style={{ marginBottom: 10 }}>Adicionar</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 18 }}>
        {[{ i: "text", l: "Texto" }, { i: "image", l: "Imagem" }, { i: "gif", l: "GIF" }, { i: "sticker", l: "Sticker" }, { i: "qr", l: "QR" }, { i: "type", l: "Carimbo" }, { i: "poll", l: "Enquete" }].map((a) => (
          <button key={a.i} onClick={() => onAdd(a.i)} style={{ padding: "11px 4px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--ink)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--line-strong)"} onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--line)"}>
            <Icon name={a.i === "gif" ? "sticker" : a.i} size={18} style={{ color: "var(--ink-dim)" }} />
            <span style={{ fontSize: 10.5 }}>{a.l}</span>
          </button>
        ))}
      </div>

      <div className="eyebrow" style={{ marginBottom: 10 }}>Fundo</div>
      <Seg size="sm" value={design.bgKind} onChange={(v) => setDesign({ ...design, bgKind: v })} options={[{ id: "solid", label: "Sólido" }, { id: "image", label: "Imagem" }, { id: "video", label: "Vídeo" }, { id: "gradient", label: "Degradê" }]} />
      {design.bgKind === "solid" && (
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {SWATCHES.map((c) => (
            <button key={c} onClick={() => setDesign({ ...design, bg: c })} style={{ width: 26, height: 26, borderRadius: 7, background: c, border: design.bg === c ? "2px solid var(--accent)" : "1px solid var(--line-strong)" }} />
          ))}
        </div>
      )}
      {design.bgKind === "video" && (
        <div style={{ marginTop: 10, padding: "11px 12px", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 9, display: "flex", gap: 8 }}>
          <Icon name="video" size={14} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 11, color: "var(--ink-dim)", lineHeight: 1.5 }}>Vídeo editado como fundo. Empilhe texto, sticker e <b style={{ color: "var(--ink)" }}>GIF</b> por cima.</span>
        </div>
      )}

      <div className="eyebrow" style={{ margin: "20px 0 10px", display: "flex", justifyContent: "space-between" }}><span>Camadas</span><span>{design.elements.length}</span></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {[...design.elements].reverse().map((el) => {
          const on = selId === el.id;
          return (
            <button key={el.id} onClick={() => onSel(el.id)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 9px", borderRadius: 7, border: "none", background: on ? "var(--accent-soft)" : "transparent", color: on ? "var(--accent)" : "var(--ink-dim)", textAlign: "left", fontSize: 12.5 }}>
              <Icon name={el.type === "text" ? "type" : el.type === "logo" ? "type" : el.type === "frame" ? "template" : el.type === "gif" ? "sticker" : el.type} size={14} />
              <span style={{ flex: 1 }}>{el.label}</span>
              <Icon name="eye" size={13} style={{ opacity: 0.5 }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- right rail: properties ---------- */
function RightRail({ design, setDesign, selId }) {
  const el = design.elements.find((e) => e.id === selId);
  const isBg = selId === "bg";
  const update = (patch) => setDesign({ ...design, elements: design.elements.map((e) => e.id === selId ? { ...e, ...patch } : e) });
  if (!el && !isBg)
    return (
      <div style={{ width: 248, flexShrink: 0, borderLeft: "1px solid var(--line)", background: "var(--bg-side)", padding: "20px 16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 10 }}>
        <Icon name="move" size={26} style={{ color: "var(--ink-faint)" }} />
        <div style={{ fontSize: 12.5, color: "var(--ink-faint)", maxWidth: 160, lineHeight: 1.5 }}>Selecione um elemento no canvas pra editar as propriedades.</div>
      </div>
    );
  return (
    <div style={{ width: 248, flexShrink: 0, borderLeft: "1px solid var(--line)", background: "var(--bg-side)", overflowY: "auto", padding: "16px 16px" }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>{isBg ? "Fundo" : el.label}</div>
      {isBg && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SWATCHES.map((c) => <button key={c} onClick={() => setDesign({ ...design, bg: c, bgKind: "solid" })} style={{ width: 28, height: 28, borderRadius: 7, background: c, border: design.bg === c ? "2px solid var(--accent)" : "1px solid var(--line-strong)" }} />)}
        </div>
      )}
      {el && el.type === "text" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11.5, color: "var(--ink-dim)", marginBottom: 6 }}>Conteúdo</div>
            <textarea value={el.text} onChange={(e) => update({ text: e.target.value })} style={{ width: "100%", minHeight: 60, background: "var(--surface)", border: "1px solid var(--line-strong)", borderRadius: 8, padding: "9px 11px", color: "var(--ink)", fontSize: 13, resize: "vertical", lineHeight: 1.4 }} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: "var(--ink-dim)", marginBottom: 6 }}>Fonte</div>
            <Seg size="sm" value={el.font} onChange={(v) => update({ font: v })} options={FONT_OPTS.map((f) => ({ id: f.id, label: f.label.slice(0, 4) }))} />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 11.5, color: "var(--ink-dim)" }}>Tamanho</span><span className="mono" style={{ fontSize: 11 }}>{el.size}px</span></div>
            <input type="range" min={18} max={140} value={el.size} onChange={(e) => update({ size: +e.target.value })} style={{ width: "100%" }} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: "var(--ink-dim)", marginBottom: 6 }}>Cor</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {SWATCHES.map((c) => <button key={c} onClick={() => update({ color: c })} style={{ width: 26, height: 26, borderRadius: 7, background: c, border: el.color === c ? "2px solid var(--accent)" : "1px solid var(--line-strong)" }} />)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: "var(--ink-dim)", marginBottom: 6 }}>Alinhamento</div>
            <Seg size="sm" value={el.align} onChange={(v) => update({ align: v })} options={[{ id: "left", label: "←" }, { id: "center", label: "↔" }, { id: "right", label: "→" }]} />
          </div>
        </div>
      )}
      {el && el.type === "image" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ position: "relative" }}>
            <image-slot id={`canvas-${el.id}`} class="yt-slot" style={{ display: "block", width: "100%", aspectRatio: "1/1", borderRadius: "10px", border: "1.5px dashed var(--line-strong)", background: "var(--surface)" }} shape="rounded" radius="10" placeholder=" "></image-slot>
            <div className="slot-cap"><Icon name="image" size={22} style={{ color: "var(--ink-faint)" }} /><span className="cap-main">Trocar imagem</span><span className="cap-sub">arraste ou clique</span></div>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink-dim)", lineHeight: 1.5 }}>Puxada do og:image do post. Solte a sua pra trocar.</div>
        </div>
      )}
      {el && el.type === "sticker" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11.5, color: "var(--ink-dim)", marginBottom: 6 }}>Texto do botão</div>
            <input value={el.text} onChange={(e) => update({ text: e.target.value })} style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--line-strong)", borderRadius: 8, padding: "9px 11px", color: "var(--ink)", fontSize: 13 }} />
          </div>
          <div style={{ display: "flex", gap: 8, padding: "10px 12px", background: "var(--accent-soft)", borderRadius: 8 }}>
            <Icon name="links" size={14} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 11.5, color: "var(--ink-dim)", lineHeight: 1.5 }}>Link rastreado <span className="mono" style={{ color: "var(--accent)" }}>tf.co/x5q</span> — gerado no publish.</span>
          </div>
        </div>
      )}
      {el && el.type === "gif" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11.5, color: "var(--ink-dim)", marginBottom: 6 }}>GIF / figurinha</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["✨", "🔥", "👀", "🎬", "📍", "🇹🇭", "💬", "⬆️"].map((g) => (
                <button key={g} onClick={() => update({ emoji: g })} style={{ width: 34, height: 34, fontSize: 18, borderRadius: 8, background: el.emoji === g ? "var(--accent-soft)" : "var(--surface)", border: el.emoji === g ? "1.5px solid var(--accent)" : "1px solid var(--line-strong)" }}>{g}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8 }}>
            <Icon name="info" size={14} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 11.5, color: "var(--ink-dim)", lineHeight: 1.5 }}>Busque por GIF (GIPHY) ou solte o seu. Fica animado por cima do vídeo/foto.</span>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 11.5, color: "var(--ink-dim)" }}>Tamanho</span><span className="mono" style={{ fontSize: 11 }}>{Math.round((el.scale || 1) * 100)}%</span></div>
            <input type="range" min={50} max={300} value={Math.round((el.scale || 1) * 100)} onChange={(e) => update({ scale: +e.target.value / 100 })} style={{ width: "100%" }} />
          </div>
        </div>
      )}
      {el && (el.type === "logo" || el.type === "frame") && (
        <div style={{ fontSize: 12, color: "var(--ink-dim)", lineHeight: 1.6 }}>Elemento de marca, herdado do template. Pode ocultar pela camada se quiser.</div>
      )}
      {el && el.type !== "frame" && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)", display: "flex", gap: 7, alignItems: "center", fontSize: 11, color: "var(--ink-faint)" }}>
          <Icon name="move" size={13} /> Arraste no canvas pra mover · alça laranja pra redimensionar
        </div>
      )}
    </div>
  );
}

/* ============================================================
   CanvasEditor — shell
   ============================================================ */
function CanvasEditor({ onClose, onUse, title = "Blog → Story", crumb = ["Posts", "Story"], initial, templates, crumbItems }) {
  const RAT = window.SOCIAL.RATIOS;
  const [design, setDesign] = useState(initial || defaultStoryDesign());
  const [ratio, setRatio] = useState(RAT[0]);
  const [selId, setSel] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [showTemplates, setShowTemplates] = useState(false);
  const [frames, setFrames] = useState([{ id: "f1" }]);
  const [activeFrame, setActiveFrame] = useState(0);

  const baseScale = ratio.w / ratio.h > 1 ? 720 : 560; // px on long edge
  const scale = baseScale * (zoom / 100);

  const onAdd = (kind) => {
    const id = kind + "_" + Math.random().toString(36).slice(2, 6);
    const base = { id, x: 50, y: 50 };
    let el;
    if (kind === "text") el = { ...base, type: "text", label: "Novo texto", text: "Texto", font: "serif", size: 56, color: "#1F1B17", align: "center", weight: 600 };
    else if (kind === "image") el = { ...base, type: "image", label: "Imagem", w: 60, h: 24 };
    else if (kind === "gif") el = { ...base, type: "gif", label: "GIF", w: 24, h: 24, emoji: "✨", scale: 1 };
    else if (kind === "sticker") el = { ...base, type: "sticker", label: "Sticker de link", text: "LER MAIS", scale: 1 };
    else if (kind === "qr") el = { ...base, type: "image", label: "QR Code", w: 40, h: 22 };
    else el = { ...base, type: "logo", label: "Carimbo TF", scale: 1 };
    setDesign({ ...design, elements: [...design.elements, el] });
    setSel(id);
  };
  const onUpdate = (id, patch) => setDesign((d) => ({ ...d, elements: d.elements.map((e) => e.id === id ? { ...e, ...patch } : e) }));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* top toolbar */}
      <div style={{ height: 52, flexShrink: 0, borderBottom: "1px solid var(--line)", background: "var(--bg-side)", display: "flex", alignItems: "center", padding: "0 16px", gap: 14 }}>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--ink-dim)", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><Icon name="chevronLeft" size={18} /> Voltar</button>
        <div style={{ width: 1, height: 22, background: "var(--line)" }} />
        <Breadcrumb items={crumbItems || [{ label: "Posts", icon: "posts", onClick: onClose }, { label: "Story" }, { label: title }]} />
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 18 }}>
          <button onClick={() => setZoom(Math.max(40, zoom - 10))} style={iconBtn}><Icon name="zoomOut" size={16} /></button>
          <span className="mono" style={{ fontSize: 12, width: 42, textAlign: "center", color: "var(--ink-dim)" }}>{zoom}%</span>
          <button onClick={() => setZoom(Math.min(160, zoom + 10))} style={iconBtn}><Icon name="zoomIn" size={16} /></button>
          <button onClick={() => setZoom(100)} style={iconBtn}><Icon name="grid" size={15} /></button>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <Btn kind="ghost" size="sm" icon="template" onClick={() => setShowTemplates(true)}>Templates</Btn>
          <Btn kind="soft" size="sm" icon="download" onClick={() => window.__socialToast && window.__socialToast("Arte exportada · PNG 1080×1920")}>Exportar</Btn>
          {onUse && <Btn kind="primary" size="sm" icon="check" onClick={() => onUse(design, ratio)}>Usar no post</Btn>}
        </div>
      </div>
      {/* body */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <LeftRail design={design} setDesign={setDesign} ratio={ratio} setRatio={setRatio} selId={selId} onSel={setSel} onAdd={onAdd} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "repeating-conic-gradient(#121009 0% 25%, #0e0c08 0% 50%) 50% / 22px 22px" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", padding: 40 }} onClick={() => setSel(null)}>
            <div onClick={(e) => e.stopPropagation()}>
              <Artboard design={design} ratio={ratio} selId={selId} onSel={setSel} scale={scale} editable onUpdate={onUpdate} />
            </div>
          </div>
          {ratio.id === "story" && (
            <div style={{ flexShrink: 0, borderTop: "1px solid var(--line)", background: "var(--bg-side)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <span className="eyebrow" style={{ marginRight: 4 }}>Frames do Story</span>
              {frames.map((f, i) => (
                <button key={f.id} onClick={() => setActiveFrame(i)} style={{ position: "relative", width: 34, height: 60, borderRadius: 6, overflow: "hidden", border: "1.5px solid " + (activeFrame === i ? "var(--accent)" : "var(--line-strong)"), background: i === 0 ? (design.bgKind === "gradient" ? "linear-gradient(155deg,#F7F1E8,#EDE3D2)" : design.bg) : "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {i === 0 ? <span className="serif" style={{ fontSize: 10, fontWeight: 700, color: "#1F1B17" }}>TF</span> : <Icon name="image" size={13} style={{ color: "var(--ink-faint)" }} />}
                  <span className="mono" style={{ position: "absolute", bottom: 1, right: 2, fontSize: 7, color: activeFrame === i ? "var(--accent)" : "var(--ink-faint)" }}>{i + 1}</span>
                </button>
              ))}
              <button onClick={() => { setFrames([...frames, { id: "f" + (frames.length + 1) }]); setActiveFrame(frames.length); }} style={{ width: 34, height: 60, borderRadius: 6, border: "1.5px dashed var(--line-strong)", background: "transparent", color: "var(--ink-faint)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="plus" size={16} /></button>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-faint)", display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="info" size={12} /> Stories em sequência publicam um atrás do outro</span>
            </div>
          )}
        </div>
        <RightRail design={design} setDesign={setDesign} selId={selId} />
      </div>
      {showTemplates && <TemplatePicker templates={templates} onClose={() => setShowTemplates(false)} onPick={() => { setShowTemplates(false); window.__socialToast && window.__socialToast("Template aplicado ao canvas"); }} />}
    </div>
  );
}
const iconBtn = { background: "transparent", border: "none", color: "var(--ink-dim)", width: 30, height: 30, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" };

/* ---------- template picker ---------- */
function TemplatePicker({ onClose, onPick, templates }) {
  const T = templates || window.SOCIAL.TEMPLATES;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 130, background: "rgba(6,5,4,0.72)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 30 }}>
      <div onClick={(e) => e.stopPropagation()} className="fade-up" style={{ width: "min(820px,100%)", maxHeight: "82vh", overflow: "auto", background: "var(--surface)", border: "1px solid var(--line-strong)", borderRadius: 16, boxShadow: "var(--shadow)", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 className="serif" style={{ margin: 0, fontSize: 21, fontWeight: 600 }}>Templates</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--ink-dim)" }}><Icon name="close" size={20} /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {T.map((t) => (
            <button key={t.id} onClick={() => onPick(t)} style={{ textAlign: "left", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", background: "var(--surface-2)", padding: 0 }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent)"} onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--line)"}>
              <div style={{ aspectRatio: t.ratio === "Story" ? "9/16" : t.ratio === "Feed" ? "4/5" : "1/1", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {t.paper && <div style={{ position: "relative", width: "78%", height: "82%", border: "1px solid rgba(31,27,23,0.3)", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center" }}><span className="serif" style={{ color: "#1F1B17", fontSize: 13, fontWeight: 700 }}>TF</span></div>}
              </div>
              <div style={{ padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</span>
                  {t.tag && <Badge tone="cowork" style={{ marginLeft: "auto" }}>{t.tag}</Badge>}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-dim)", marginTop: 3, lineHeight: 1.4 }}>{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CanvasEditor, Artboard, TemplatePicker, defaultStoryDesign });

/* ============================================================
   links/charts.jsx — mini gráficos (SVG/CSS leves)
   ============================================================ */

function Spark({ data, color = "var(--accent)", w = 90, h = 28, fill = true }) {
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const rng = max - min || 1;
  const pts = data.map((v, i) => [i / (data.length - 1) * w, h - ((v - min) / rng) * (h - 3) - 2]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = d + ` L${w} ${h} L0 ${h} Z`;
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      {fill && <path d={area} fill={color} opacity="0.12" />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.4" fill={color} />
    </svg>
  );
}

function Delta({ cur, prev, suffix = "%", invert }) {
  if (prev == null) return null;
  const pct = prev === 0 ? 100 : Math.round(((cur - prev) / prev) * 100);
  const up = pct >= 0;
  const good = invert ? !up : up;
  return (
    <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: good ? "var(--green)" : "var(--red)" }}>
      <Icon name={up ? "trendingUp" : "trendingDown"} size={12} />{up ? "+" : ""}{pct}{suffix}
    </span>
  );
}

function StatTile({ label, value, sub, icon, iconTint, delta, spark, sparkColor }) {
  return (
    <Card pad={16} style={{ minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        {icon && <span style={{ width: 30, height: 30, borderRadius: 8, background: (iconTint || "var(--accent)") + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={icon} size={16} style={{ color: iconTint || "var(--accent)" }} /></span>}
        <span className="eyebrow" style={{ flex: 1 }}>{label}</span>
        {delta}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 4 }}>{sub}</div>}
        </div>
        {spark && <Spark data={spark} color={sparkColor || "var(--accent)"} w={84} h={30} />}
      </div>
    </Card>
  );
}

/* vertical bars com comparação opcional */
function BarChart({ data, prev, labels, height = 150, color = "var(--accent)" }) {
  const max = Math.max(...data, ...(prev || [1]), 1);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: data.length > 16 ? 2 : 6, height, padding: "0 2px" }}>
        {data.map((v, i) => (
          <div key={i} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 3, position: "relative", minWidth: 0 }} title={`${v}`}>
            {prev && <div style={{ position: "absolute", bottom: 0, width: "60%", height: `${(prev[i] / max) * 100}%`, background: "var(--line-strong)", borderRadius: 3 }} />}
            <div style={{ width: prev ? "78%" : "70%", height: `${(v / max) * 100}%`, minHeight: v ? 3 : 0, background: color, borderRadius: 4, transition: "height .5s", zIndex: 1 }} />
          </div>
        ))}
      </div>
      {labels && <div style={{ display: "flex", gap: 6, marginTop: 8 }}>{labels.map((l, i) => <span key={i} style={{ flex: 1, textAlign: "center", fontSize: 10, color: "var(--ink-faint)" }}>{l}</span>)}</div>}
    </div>
  );
}

/* donut */
function Donut({ segments, size = 120, thickness = 16, centerLabel, centerSub }) {
  const total = segments.reduce((s, x) => s + x.v, 0) || 1;
  const r = (size - thickness) / 2, c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {segments.map((s, i) => {
            const len = (s.v / total) * c;
            const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} />;
            off += len; return el;
          })}
        </svg>
        {centerLabel && <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}><span className="mono" style={{ fontSize: 17, fontWeight: 700, lineHeight: 1 }}>{centerLabel}</span>{centerSub && <span className="eyebrow" style={{ fontSize: 8, marginTop: 3 }}>{centerSub}</span>}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {segments.map((s) => (
          <div key={s.k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />
            <span style={{ color: "var(--ink)", flex: 1 }}>{s.k}</span>
            <span className="mono" style={{ color: "var(--ink-dim)" }}>{s.v}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* barras horizontais (browser/os/referrer/country) */
function HBars({ rows, color = "var(--accent)", suffix = "%" }) {
  const max = Math.max(...rows.map((r) => r.v), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((r) => (
        <div key={r.k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 96, fontSize: 12.5, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0 }}>{r.k}</span>
          <div style={{ flex: 1, height: 8, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: `${(r.v / max) * 100}%`, height: "100%", background: color, borderRadius: 99, transition: "width .5s" }} />
          </div>
          <span className="mono" style={{ width: 38, textAlign: "right", fontSize: 11.5, color: "var(--ink-dim)" }}>{r.v}{suffix}</span>
        </div>
      ))}
    </div>
  );
}

/* heatmap 7×24 */
function Heatmap({ grid }) {
  const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const shades = ["var(--surface-2)", "rgba(242,104,60,0.25)", "rgba(242,104,60,0.45)", "rgba(242,104,60,0.7)", "var(--accent)"];
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {grid.map((row, d) => (
          <div key={d} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="mono" style={{ width: 26, fontSize: 9.5, color: "var(--ink-faint)" }}>{days[d]}</span>
            <div style={{ display: "flex", gap: 2, flex: 1 }}>
              {row.map((v, h) => <div key={h} title={`${days[d]} ${h}h`} style={{ flex: 1, aspectRatio: "1", borderRadius: 2, background: shades[v] }} />)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingLeft: 32 }}>
        {["0h", "6h", "12h", "18h", "23h"].map((t) => <span key={t} className="mono" style={{ fontSize: 9, color: "var(--ink-faint)" }}>{t}</span>)}
      </div>
    </div>
  );
}

/* lista de países com flag + cidades */
const FLAG = { BR: "🇧🇷", PT: "🇵🇹", US: "🇺🇸", ES: "🇪🇸", Outros: "🌎" };
function CountryList({ countries }) {
  const max = Math.max(...countries.map((c) => c.v), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {countries.map((c) => (
        <div key={c.code}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5 }}>
            <span style={{ fontSize: 15 }}>{FLAG[c.code] || "🌎"}</span>
            <span style={{ fontSize: 12.5, color: "var(--ink)", flex: 1 }}>{c.name}</span>
            <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-dim)" }}>{c.v}%</span>
          </div>
          <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: `${(c.v / max) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: 99 }} />
          </div>
          {c.cities && c.cities.length > 0 && <div style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 4, paddingLeft: 24 }}>{c.cities.join(" · ")}</div>}
        </div>
      ))}
    </div>
  );
}

/* painel de gráfico padrão */
function Panel({ title, icon, right, children, style }) {
  return (
    <Card pad={18} style={style}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        {icon && <Icon name={icon} size={15} style={{ color: "var(--accent)" }} />}
        <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>{title}</span>
        {right}
      </div>
      {children}
    </Card>
  );
}

Object.assign(window, { Spark, Delta, StatTile, BarChart, Donut, HBars, Heatmap, CountryList, Panel, FLAG });

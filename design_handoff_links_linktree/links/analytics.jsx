/* ============================================================
   links/analytics.jsx — analytics rico (seção + por link)
   ============================================================ */

function RangeTabs({ value, onChange }) {
  const opts = [{ id: "7d", l: "7 dias" }, { id: "30d", l: "30 dias" }, { id: "90d", l: "90 dias" }, { id: "1y", l: "1 ano" }];
  return (
    <div style={{ display: "inline-flex", background: "var(--surface-2)", borderRadius: 9, padding: 3, gap: 2 }}>
      {opts.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} style={{ padding: "6px 13px", borderRadius: 7, border: "none", fontSize: 12.5, fontWeight: 600, background: value === o.id ? "var(--accent)" : "transparent", color: value === o.id ? "#1A120C" : "var(--ink-dim)" }}>{o.l}</button>
      ))}
    </div>
  );
}

function InsightsPanel({ insights }) {
  const tones = { up: "var(--green)", accent: "var(--accent)", amber: "var(--amber)", red: "var(--red)" };
  return (
    <Panel title="Insights" icon="sparkles" right={<Badge tone="cowork" icon="sparkles">auto</Badge>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {insights.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, background: tones[it.tone] + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}><Icon name={it.icon} size={14} style={{ color: tones[it.tone] }} /></span>
            <span style={{ fontSize: 12.5, color: "var(--ink-dim)", lineHeight: 1.5 }}>{it.text}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SourceBars({ bySource }) {
  const D = window.LINKS_DATA;
  const max = Math.max(...bySource.map((s) => s.clicks), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {bySource.map((s) => {
        const src = D.srcById(s.id) || { label: s.id, color: "var(--accent)" };
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: src.color, flexShrink: 0 }} />
            <span style={{ width: 96, fontSize: 12.5, color: "var(--ink)", flexShrink: 0 }}>{src.label}</span>
            <div style={{ flex: 1, height: 8, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${(s.clicks / max) * 100}%`, height: "100%", background: src.color, borderRadius: 99 }} />
            </div>
            <span className="mono" style={{ width: 64, textAlign: "right", fontSize: 11.5, color: "var(--ink-dim)" }}>{s.clicks.toLocaleString("pt-BR")}</span>
          </div>
        );
      })}
    </div>
  );
}

function TopLinksTable({ links, onOpen }) {
  const max = Math.max(...links.map((l) => l.last30), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {links.map((l, i) => (
        <button key={l.id} onClick={() => onOpen && onOpen(l)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 6px", borderBottom: i < links.length - 1 ? "1px solid var(--line)" : "none", background: "transparent", border: "none", borderRadius: 8, textAlign: "left", cursor: "pointer" }}
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
          <span className="mono" style={{ fontSize: 12, color: "var(--ink-faint)", width: 16 }}>{i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.title}</div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>{l.slug}</div>
          </div>
          <div style={{ width: 120, height: 6, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: `${(l.last30 / max) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: 99 }} />
          </div>
          <span className="mono" style={{ width: 56, textAlign: "right", fontSize: 12.5, fontWeight: 600 }}>{l.last30}</span>
        </button>
      ))}
    </div>
  );
}

/* "potencial" — analytics a implementar (handoff p/ Claude Code) */
function PotentialPanel() {
  const items = [
    { icon: "target", t: "Metas & conversão", d: "Marcar destinos como meta e medir conversão por link/origem." },
    { icon: "link2", t: "Atribuição UTM", d: "Quebrar por source / medium / campaign automaticamente." },
    { icon: "subscribers", t: "Novos vs. recorrentes", d: "Separar visitantes novos de quem já clicou antes." },
    { icon: "globe", t: "Mapa geográfico", d: "Mapa-múndi com cidades e calor por região." },
    { icon: "bolt", t: "Filtro de bots", d: "Excluir tráfego automatizado das métricas." },
    { icon: "analytics", t: "Funil QR → página → ação", d: "Acompanhar do scan até a conversão final." },
  ];
  return (
    <Panel title="Potencial — a implementar" icon="beaker" right={<Badge tone="neutral">roadmap</Badge>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {items.map((it) => (
          <div key={it.t} style={{ display: "flex", gap: 10, padding: "11px 12px", border: "1px dashed var(--line-strong)", borderRadius: 10 }}>
            <Icon name={it.icon} size={16} style={{ color: "var(--ink-faint)", flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{it.t}</div>
              <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 2, lineHeight: 1.45 }}>{it.d}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ---------- Section analytics ---------- */
function AnalyticsView({ onOpenLink }) {
  const A = window.LINKS_DATA.analytics;
  const [range, setRange] = useState("30d");
  const dayLabels = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <span style={{ fontSize: 12.5, color: "var(--ink-dim)" }}>Comparando com período anterior · <span className="mono">29 abr → 29 mai</span></span>
        <div style={{ display: "flex", gap: 10 }}>
          <RangeTabs value={range} onChange={setRange} />
          <Btn kind="ghost" size="sm" icon="download" onClick={() => window.__linksToast && window.__linksToast("Exportando CSV…")}>CSV</Btn>
        </div>
      </div>

      {/* stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <StatTile label="Cliques" value={A.totalClicks.toLocaleString("pt-BR")} icon="links" delta={<Delta cur={A.totalClicks} prev={A.prevClicks} />} spark={A.byDay} />
        <StatTile label="Visitantes únicos" value={A.unique.toLocaleString("pt-BR")} icon="subscribers" iconTint="#3FA9C0" delta={<Delta cur={A.unique} prev={A.prevUnique} />} spark={A.byDay} sparkColor="#3FA9C0" />
        <StatTile label="Engajamento (CTR)" value={A.ctr + "%"} icon="target" iconTint="#46B17E" delta={<Delta cur={A.ctr} prev={A.prevCtr} />} sub="cliques / pageviews" />
        <StatTile label="Via QR / impresso" value={A.qrShare + "%"} icon="qr" iconTint="#E0A23C" sub="do total de cliques" spark={A.byDay.map((v) => v * 0.4)} sparkColor="#E0A23C" />
      </div>

      {/* clicks over time + insights */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14, alignItems: "start" }}>
        <Panel title="Cliques por dia" icon="analytics" right={<div style={{ display: "flex", gap: 14, fontSize: 11 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--ink-dim)" }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--accent)" }} />atual</span><span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--ink-dim)" }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--line-strong)" }} />anterior</span></div>}>
          <BarChart data={A.byDay} prev={A.byDayPrev} height={170} />
        </Panel>
        <InsightsPanel insights={A.insights} />
      </div>

      {/* source + device */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
        <Panel title="Por origem" icon="filter"><SourceBars bySource={A.bySource} /></Panel>
        <Panel title="Dispositivo" icon="media"><Donut segments={A.devices} centerLabel="100%" centerSub="sessões" /></Panel>
      </div>

      {/* browser / os / referrer */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, alignItems: "start" }}>
        <Panel title="Navegador" icon="globe"><HBars rows={A.browsers} color="#3FA9C0" /></Panel>
        <Panel title="Sistema" icon="settings"><HBars rows={A.os} color="#A77CE8" /></Panel>
        <Panel title="Referrer" icon="external"><HBars rows={A.referrers} color="#46B17E" /></Panel>
      </div>

      {/* countries + heatmap */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 14, alignItems: "start" }}>
        <Panel title="Países" icon="pin"><CountryList countries={A.countries} /></Panel>
        <Panel title="Horários de pico" icon="clock" right={<span style={{ fontSize: 11, color: "var(--ink-faint)" }}>cliques por dia × hora</span>}><Heatmap grid={A.heatmap} /></Panel>
      </div>

      {/* top links */}
      <Panel title="Top links · 30 dias" icon="trophy" right={<Btn kind="quiet" size="sm" iconRight="arrowRight" onClick={() => onOpenLink && onOpenLink(null)}>Ver todos</Btn>}>
        <TopLinksTable links={window.LINKS_DATA.analytics.topLinks} onOpen={onOpenLink} />
      </Panel>

      <PotentialPanel />
    </div>
  );
}

/* ---------- Per-link analytics (compacto, reusa peças) ---------- */
function LinkAnalytics({ link }) {
  const A = window.LINKS_DATA.analytics;
  const [range, setRange] = useState("30d");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <span style={{ fontSize: 12.5, color: "var(--ink-dim)" }}>Desempenho de <b style={{ color: "var(--ink)" }}>{link.title}</b></span>
        <RangeTabs value={range} onChange={setRange} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 14 }}>
        <StatTile label="Cliques" value={link.clicks.toLocaleString("pt-BR")} icon="links" spark={link.spark} />
        <StatTile label="Últimos 30d" value={link.last30} icon="analytics" iconTint="#46B17E" spark={link.spark} sparkColor="#46B17E" />
        <StatTile label="Únicos" value={link.unique.toLocaleString("pt-BR")} icon="subscribers" iconTint="#3FA9C0" />
        <StatTile label="QR scans" value={link.scans.toLocaleString("pt-BR")} icon="qr" iconTint="#E0A23C" sub={`${Math.round(link.scans / Math.max(link.clicks, 1) * 100)}% via QR`} />
      </div>
      <Panel title="Cliques por dia" icon="analytics"><BarChart data={link.spark.concat(link.spark.slice(0, 16))} height={150} /></Panel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
        <Panel title="Dispositivo" icon="media"><Donut segments={A.devices} /></Panel>
        <Panel title="Países" icon="pin"><CountryList countries={A.countries.slice(0, 4)} /></Panel>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 14, alignItems: "start" }}>
        <Panel title="Referrer" icon="external"><HBars rows={A.referrers} color="#46B17E" /></Panel>
        <Panel title="Horários de pico" icon="clock"><Heatmap grid={A.heatmap} /></Panel>
      </div>
    </div>
  );
}

Object.assign(window, { AnalyticsView, LinkAnalytics, RangeTabs, InsightsPanel });

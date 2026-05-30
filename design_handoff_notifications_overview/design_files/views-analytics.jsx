/* ============================================================
   ANALYTICS + SCHEDULE
   ============================================================ */
const AN = window.DATA.analytics;

function KpiCard({ label, icon, val, delta, up, abs, spark, color = "var(--accent)" }) {
  return (
    <Card className="stat">
      <div className="stat-label"><Icon name={icon} size={13} /> {label}</div>
      <div className="stat-val">{val}</div>
      <div className="stat-foot">
        <span className={"delta " + (delta == null ? "flat" : up ? "up" : "down")}>
          {delta != null && <Icon name={up ? "arrowup" : "arrowdown"} size={12} />}
          {delta == null ? "—" : (abs ? "+" + delta : delta + "%")}
        </span>
        <span className="dim fs11">vs anterior</span>
      </div>
      {spark && <Sparkline data={spark} color={color} h={30} w={210} />}
    </Card>
  );
}

function HBar({ label, pct, color = "var(--accent)", flag, val }) {
  return (
    <div className="hbar-row">
      <span className="hbar-label">{flag && <span>{flag}</span>}{label}</span>
      <span className="hbar-track"><span style={{ width: pct + "%", background: color }} /></span>
      <span className="hbar-val">{val != null ? val : pct + "%"}</span>
    </div>
  );
}

/* line chart: current vs previous */
function LineChart({ cur, prev, h = 200, labels }) {
  const w = 920;
  const all = [...cur, ...prev];
  const max = Math.max(...all, 1);
  const mk = (data) => data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 24 - (v / max) * (h - 44);
    return [x, y];
  });
  const path = (pts) => pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const cp = mk(cur), pp = mk(prev);
  const avg = Math.round(cur.reduce((a, b) => a + b, 0) / cur.length);
  const ay = h - 24 - (avg / max) * (h - 44);
  const id = "lc" + Math.random().toString(36).slice(2, 6);
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: h }} preserveAspectRatio="none">
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" /><stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient></defs>
        {[0, 0.5, 1].map(f => <line key={f} x1="0" x2={w} y1={24 + f * (h - 48)} y2={24 + f * (h - 48)} stroke="var(--border-soft)" strokeDasharray="3 5" />)}
        <line x1="0" x2={w} y1={ay} y2={ay} stroke="var(--text-faint)" strokeWidth="1" strokeDasharray="2 4" />
        <path d={path(cp) + ` L${w} ${h-24} L0 ${h-24} Z`} fill={`url(#${id})`} />
        <path d={path(pp)} fill="none" stroke="var(--text-faint)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <path d={path(cp)} fill="none" stroke="var(--accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div className="row between dim fs11" style={{ marginTop: 6 }}>
        {labels.map((l, i) => <span key={i}>{l}</span>)}
      </div>
      <div className="row gap-16 fs12 mt-8">
        <span className="row gap-6"><span className="legend-dot" style={{ background: "var(--accent)" }} /> Atual</span>
        <span className="row gap-6"><span style={{ width: 14, height: 2, background: "var(--text-faint)", display: "inline-block" }} /> Período anterior</span>
        <span className="row gap-6"><span style={{ width: 14, height: 0, borderTop: "1px dashed var(--text-faint)", display: "inline-block" }} /> Média {avg}</span>
      </div>
    </div>
  );
}

function Funnel({ steps }) {
  return (
    <div className="funnel">
      {steps.map((s, i) => {
        const drop = i > 0 ? (1 - s.v / steps[i-1].v) * 100 : null;
        return (
          <React.Fragment key={i}>
            {i > 0 && <div className="funnel-arrow"><Icon name="chevronr" size={18} /></div>}
            <div className="funnel-step" style={{ "--fc": s.color }}>
              <div className="fv tnum">{s.v.toLocaleString("pt-BR")}</div>
              <div className="fl">{s.label}</div>
              {drop != null && <div className="fdrop" style={{ color: drop > 80 ? "var(--danger)" : "var(--text-dim)" }}>−{drop.toFixed(0)}% do passo anterior</div>}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

const TABS = [["overview","Overview"],["youtube","YouTube"],["content","Conteúdo"],["links","Links"],["audience","Audiência"],["fans","Fãs"],["revenue","Receita"]];

function AnalyticsView({ state }) {
  if (state === "loading") return <SkelAnalytics />;
  if (state === "empty") return <EmptyAnalytics />;
  const [tab, setTab] = useState("overview");
  const k = AN.kpis;
  const dayLabels = ["29/4","5/5","11/5","17/5","23/5","29/5"];

  return (
    <div className="fade-in">
      <div className="tabs">
        {TABS.map(([id, l]) => <button key={id} className={"tab" + (tab === id ? " on" : "")} onClick={() => setTab(id)}>{l}</button>)}
      </div>

      {tab === "overview" && (
        <div className="col gap-16">
          <div className="grid g-cols-3" style={{ gridTemplateColumns: "repeat(6,1fr)" }}>
            <KpiCard label="Views" icon="eye" val={k.views.v} delta={k.views.delta} up={k.views.up} spark={k.views.spark} color="var(--c-pipeline)" />
            <KpiCard label="Visitantes" icon="user" val={k.unique.v} delta={k.unique.delta} up={k.unique.up} spark={k.unique.spark} color="var(--c-pipeline)" />
            <KpiCard label="Leituras" icon="blog" val={k.reads.v} delta={k.reads.delta} up={k.reads.up} spark={k.reads.spark} color="var(--c-newsletter)" />
            <KpiCard label="Inscritos" icon="mail" val={k.subs.v} delta={k.subs.delta} up abs spark={k.subs.spark} color="var(--c-links)" />
            <KpiCard label="Abertura" icon="checkcircle" val={k.open.v} delta={k.open.delta} up spark={k.open.spark} color="var(--c-social)" />
            <KpiCard label="Cliques" icon="click" val={k.clicks.v} delta={k.clicks.delta} up={k.clicks.up} spark={k.clicks.spark} color="var(--accent)" />
          </div>
          <Card><CardHead icon="filter" title="Funil de conteúdo" />
            <div className="card-pad"><Funnel steps={AN.funnel} /></div>
          </Card>
          <div className="grid g-cols-2">
            <Card><CardHead icon="trending" title="Cliques ao longo do tempo" />
              <div className="card-pad"><LineChart cur={AN.clicksOverTime} prev={AN.clicksPrev} labels={dayLabels} /></div>
            </Card>
            <Card><CardHead icon="rss" title="Fontes de tráfego" />
              <div className="card-pad">{AN.sources.map((s, i) => <HBar key={i} label={s.s} pct={s.pct} color={s.color} />)}</div>
            </Card>
          </div>
          <Card className="card-pad row gap-12" style={{ borderColor: "color-mix(in srgb,var(--danger) 28%, transparent)", background: "var(--danger-s)" }}>
            <Icon name="warn" size={18} style={{ color: "var(--danger)" }} />
            <div><div className="fw6 fs13">Maior vazamento do funil</div><div className="dim fs12 mt-4">Queda de 82% entre “Leram 50%+” → “Clicaram link”. Adicione CTAs mais cedo no conteúdo.</div></div>
          </Card>
        </div>
      )}

      {tab === "youtube" && (() => { const y = AN.youtube; return (
        <div className="col gap-16">
          <div className="grid" style={{ gridTemplateColumns: "auto 1fr 1fr 1fr 1fr", gap: 16, alignItems: "stretch" }}>
            <Card className="card-pad" style={{ display: "grid", placeItems: "center" }}>
              <Ring value={y.health} size={88} sw={9} color={y.health > 70 ? "var(--ok)" : "var(--warn)"} label={y.health} sub="Saúde" />
            </Card>
            <KpiCard label="Views (30d)" icon="eye" val={y.views30} delta={y.viewsDelta} up spark={y.spark} color="var(--c-youtube)" />
            <KpiCard label="Inscritos" icon="user" val={y.subs} delta={null} />
            <KpiCard label="CTR" icon="click" val={y.ctr} delta={y.ctrDelta} up abs />
            <KpiCard label="Retenção" icon="play" val={y.retention} delta={y.retDelta} up abs />
          </div>
          <Card><CardHead icon="youtube" title="Vídeos por performance" right={<span className="dim fs12" style={{ marginLeft: "auto" }}>grade VVS</span>} />
            <table className="data">
              <thead><tr><th>Vídeo</th><th className="num">Views</th><th className="num">CTR</th><th className="num">Retenção</th><th className="num">Grade</th></tr></thead>
              <tbody>{y.topVideos.map((v, i) => (
                <tr key={i}><td className="fw5">{v.title}</td><td className="num">{v.views}</td><td className="num">{v.ctr}</td><td className="num">{v.ret}</td>
                  <td className="num"><span className={"grade " + v.grade}>{v.grade}</span></td></tr>
              ))}</tbody>
            </table>
          </Card>
          <div className="grid g-cols-2">
            <Card className="card-pad"><div className="row gap-8" style={{ marginBottom: 12 }}><Icon name="flask" size={15} style={{ color: "var(--c-youtube)" }} /><span className="card-title">A/B Lab — em andamento</span></div>
              <div className="col gap-8">
                <div className="row between fs13"><span>“Vou Morar na Tailândia” — thumbnail</span><Badge kind="warn">rodando · 2d</Badge></div>
                <div className="bar"><span style={{ width: "62%", background: "var(--c-youtube)" }} /></div>
                <div className="dim fs12">Variante B liderando com +14% CTR · confiança 78%</div>
              </div>
            </Card>
            <Card className="card-pad"><div className="row gap-8" style={{ marginBottom: 12 }}><Icon name="trophy" size={15} style={{ color: "var(--ok)" }} /><span className="card-title">Último vencedor</span></div>
              <div className="fw6 fs13">“Morei 4 Anos no Canadá” → Variante B</div>
              <div className="dim fs12 mt-8">+18% CTR · aplicado automaticamente há 4h.</div>
            </Card>
          </div>
        </div>
      ); })()}

      {tab === "content" && (
        <div className="col gap-16">
          <div className="grid g-cols-4">
            <KpiCard label="Posts publicados" icon="blog" val="8" delta={2} up abs />
            <KpiCard label="Profund. de leitura" icon="eye" val="54%" delta={4} up />
            <KpiCard label="Tempo médio" icon="clock" val="3:58" delta={6} up />
            <KpiCard label="Leituras completas" icon="checkcircle" val="612" delta={18} up />
          </div>
          <div className="grid g-cols-2">
            <Card><CardHead icon="filter" title="Distribuição de profundidade de leitura" />
              <div className="card-pad">{AN.readDepth.map((r, i) => <HBar key={i} label={r.range} pct={r.pct} color={["var(--c-system)","var(--c-social)","var(--c-pipeline)","var(--c-links)"][i]} />)}
                <div className="dim fs12 mt-8" style={{ lineHeight: 1.45 }}><Icon name="info" size={13} style={{ verticalAlign: "-2px" }} /> 50% dos leitores passam da metade — acima da média do nicho (38%).</div>
              </div>
            </Card>
            <Card><CardHead icon="trending" title="Engajamento ao longo do tempo" />
              <div className="card-pad"><Sparkline data={AN.engage} color="var(--c-newsletter)" h={150} w={420} />
                <div className="row between fs11 dim" style={{ marginTop: 4 }}>{["29/4","8/5","17/5","26/5"].map(l => <span key={l}>{l}</span>)}</div>
              </div>
            </Card>
          </div>
          <Card><CardHead icon="blog" title="Top posts" right={<div className="search-box" style={{ marginLeft: "auto", minWidth: 200, height: 32 }}><Icon name="search" size={14} /><input placeholder="Buscar posts…" /></div>} />
            <table className="data">
              <thead><tr><th>Post</th><th>Status</th><th className="num">Views</th><th className="num">Únicos</th><th className="num">Profund.</th><th className="num">Tempo</th><th className="num">100%</th></tr></thead>
              <tbody>{AN.topPosts.map((p, i) => (
                <tr key={i}><td className="fw5" style={{ maxWidth: 360 }}>{p.title}</td>
                  <td><Badge kind={p.status === "published" ? "links" : null}>{p.status === "published" ? "publicado" : "rascunho"}</Badge></td>
                  <td className="num">{p.views.toLocaleString("pt-BR")}</td><td className="num">{p.unique.toLocaleString("pt-BR")}</td>
                  <td className="num">{p.depth}%</td><td className="num">{p.time}</td><td className="num">{p.reads}</td></tr>
              ))}</tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === "links" && (() => { const L = AN.links; return (
        <div className="col gap-16">
          <div className="grid g-cols-4">
            <KpiCard label="Cliques totais" icon="click" val={L.total} delta={9} up />
            <KpiCard label="Cliques únicos" icon="user" val={L.unique} delta={7} up />
            <KpiCard label="Conversão" icon="target" val={L.conv} delta={0.3} up abs />
            <KpiCard label="Links ativos" icon="link" val={L.active} delta={null} />
          </div>
          <Card><CardHead icon="link" title="Links com melhor desempenho" />
            <table className="data">
              <thead><tr><th>Link</th><th>Fonte</th><th className="num">Cliques</th><th className="num">Únicos</th><th>País</th><th>Dispositivo</th></tr></thead>
              <tbody>{L.top.map((l, i) => (
                <tr key={i}><td className="mono fw5" style={{ color: "var(--accent-text)" }}>{l.url}</td><td className="muted">{l.src}</td>
                  <td className="num">{l.clicks}</td><td className="num">{l.unique}</td><td>{l.country}</td><td>{l.device}</td></tr>
              ))}</tbody>
            </table>
          </Card>
          <div className="grid g-cols-2">
            <Card><CardHead icon="target" title="Atribuição por campanha (UTM)" />
              <div className="card-pad col gap-8">{L.utm.map((u, i) => (
                <div key={i} className="row gap-12" style={{ alignItems: "center" }}>
                  <span className="mono fs12" style={{ width: 130, color: "var(--text-muted)" }}>{u.camp}</span>
                  <span className="hbar-track"><span style={{ width: (u.clicks / L.utm[0].clicks * 100) + "%", background: u.color }} /></span>
                  <span className="fs12 fw6 tnum" style={{ width: 42, textAlign: "right" }}>{u.clicks}</span>
                  <Badge kind="links">{u.conv} conv</Badge>
                </div>
              ))}</div>
            </Card>
            <Card><CardHead icon="globe" title="Principais domínios de origem" />
              <div className="card-pad">{L.referrers.map((r, i) => <HBar key={i} label={r.dom} pct={r.pct} color="var(--c-pipeline)" val={r.clicks} />)}</div>
            </Card>
          </div>
        </div>
      ); })()}

      {tab === "audience" && (
        <div className="col gap-16">
          <div className="grid g-cols-2">
            <Card><CardHead icon="globe" title="Países" />
              <div className="card-pad">{AN.countries.map((c, i) => <HBar key={i} label={c.c} flag={c.code} pct={c.pct} color="var(--c-pipeline)" />)}</div>
            </Card>
            <Card><CardHead icon="phone" title="Dispositivos" />
              <div className="card-pad">{AN.devices.map((d, i) => <HBar key={i} label={d.d} pct={d.pct} color="var(--c-newsletter)" />)}</div>
            </Card>
          </div>
          <Card><CardHead icon="layers" title="Funil cross-system: YouTube → Blog → Newsletter" />
            <div className="card-pad">{AN.crossFunnel.map((s, i) => {
              const max = AN.crossFunnel[0].v;
              return <HBar key={i} label={s.label} pct={Math.max(2, (s.v / max) * 100)} color={s.color} val={s.v.toLocaleString("pt-BR")} />;
            })}</div>
          </Card>
        </div>
      )}

      {tab === "fans" && (
        <Card><CardHead icon="sparkles" title="Top fãs" right={<span className="dim fs12" style={{ marginLeft: "auto" }}>por interações em polls e comentários</span>} />
          <table className="data">
            <thead><tr><th>Fã</th><th className="num">Interações</th><th>Última</th><th>Selo</th></tr></thead>
            <tbody>{AN.fans.map((f, i) => (
              <tr key={i}><td className="fw5 row gap-8"><span className="avatar" style={{ width: 26, height: 26, fontSize: 10 }}>{f.name.slice(1, 3).toUpperCase()}</span>{f.name}</td>
                <td className="num">{f.interactions}</td><td className="muted">{f.last}</td>
                <td>{f.badge && <Badge kind={i === 0 ? "social" : null}>{f.badge}</Badge>}</td></tr>
            ))}</tbody>
          </table>
        </Card>
      )}

      {tab === "revenue" && (() => { const R = AN.revenue; return (
        <div className="col gap-16">
          <div className="grid" style={{ gridTemplateColumns: "1fr 2fr" }}>
            <Card className="stat">
              <div className="stat-label"><Icon name="dollar" size={13} /> Receita (30d)</div>
              <div className="stat-val">{R.total}</div>
              <div className="stat-foot"><span className="delta up"><Icon name="arrowup" size={12} />{R.delta}%</span><span className="dim fs11">vs anterior</span></div>
              <Sparkline data={R.spark} color="var(--c-youtube)" h={36} w={260} />
            </Card>
            <Card><CardHead icon="layers" title="Por fonte" />
              <div className="card-pad">{R.streams.map((s, i) => <HBar key={i} label={s.s} pct={s.pct} color={s.color} val={s.v} />)}</div>
            </Card>
          </div>
        </div>
      ); })()}
    </div>
  );
}

/* ============================================================
   SCHEDULE
   ============================================================ */
const EV = { blog: { c: "var(--c-pipeline)", s: "var(--c-pipeline-s)", ic: "blog" }, newsletter: { c: "var(--c-newsletter)", s: "var(--c-newsletter-s)", ic: "mail" }, video: { c: "var(--c-youtube)", s: "var(--c-youtube-s)", ic: "video" } };

function ScheduleView({ state, go }) {
  const S = window.DATA.schedule;
  const [openBacklog, setOpenBacklog] = useState(true);
  if (state === "loading") return <SkelSchedule />;
  if (state === "empty") return <EmptySchedule go={go} />;
  // May 2026 starts Friday(=5). Grid Mon-first. Prev days: Mon..Thu of prev week => 27,28,29,30.
  const dow = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const cells = [];
  const lead = [27, 28, 29, 30];
  lead.forEach(n => cells.push({ n, dimmed: true }));
  for (let d = 1; d <= 31; d++) cells.push({ n: d, today: d === 29 });
  const trail = [1, 2, 3, 4]; // jun
  trail.forEach(n => cells.push({ n, dimmed: true }));

  return (
    <div className="fade-in">
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="row gap-8">
          <button className="icon-btn"><Icon name="chevronl" size={16} /></button>
          <button className="btn sm">Hoje</button>
          <button className="icon-btn"><Icon name="chevronr" size={16} /></button>
          <span className="fw6" style={{ fontSize: 16, marginLeft: 6 }}>Maio 2026</span>
        </div>
        <div className="row gap-16 fs12">
          {Object.entries(EV).map(([k, v]) => <span key={k} className="row gap-6"><span className="legend-dot" style={{ background: v.c }} />{k === "blog" ? "Blog" : k === "newsletter" ? "Newsletter" : "Vídeo"}</span>)}
        </div>
      </div>

      <div className="grid g-cols-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Publicado no mês" icon="checkcircle" val={String(S.published)} delta={3} up abs />
        <KpiCard label="Agendado à frente" icon="calendar" val={String(S.scheduled)} delta={null} />
        <KpiCard label="Saúde da cadência" icon="gauge" val={S.cadence + "%"} delta={5} up />
        <KpiCard label="Atrasados" icon="warn" val={String(S.overdue)} delta={null} />
      </div>

      <div className="cal">
        {dow.map(d => <div key={d} className="cal-dow">{d}</div>)}
        {cells.map((c, i) => {
          const evs = !c.dimmed && S.events[c.n] ? S.events[c.n] : [];
          return (
            <div key={i} className={"cal-cell" + (c.dimmed ? " dim" : "") + (c.today ? " today" : "")}>
              <div className="cal-num">{c.n}</div>
              {evs.map((e, j) => { const m = EV[e.type]; return (
                <div key={j} className={"cal-ev" + (e.scheduled ? " sched" : "")} style={{ "--ec": m.c, "--es": m.s, "--ect": m.c }} title={e.title}>
                  <Icon name={m.ic} size={11} /><span className="truncate">{e.title}</span>
                </div>
              ); })}
              {!c.dimmed && evs.length === 0 && [9,17,24,31,3].includes(c.n) && <div className="cal-slot"><Icon name="plus" size={10} /> slot livre</div>}
            </div>
          );
        })}
      </div>

      <Card className="mt-16">
        <button className="card-head" style={{ width: "100%" }} onClick={() => setOpenBacklog(o => !o)}>
          <Icon name="archive" size={16} /><span className="card-title">Backlog</span>
          <span className="pill gray" style={{ marginLeft: 6 }}>{S.backlog.length}</span>
          <div className="grow" />
          <Icon name="chevrond" size={16} style={{ transform: openBacklog ? "rotate(180deg)" : "none", transition: ".2s", color: "var(--text-dim)" }} />
        </button>
        {openBacklog && <div className="card-pad col gap-8 fade-in">
          {S.backlog.map((b, i) => { const m = EV[b.type]; return (
            <div key={i} className="row gap-12" style={{ padding: "9px 12px", border: "1px solid var(--border-soft)", borderRadius: 10, background: "var(--surface-2)" }}>
              <span className="attn-ico" style={{ background: m.s, color: m.c, width: 28, height: 28 }}><Icon name={m.ic} size={14} /></span>
              <div className="grow"><div className="fw5 fs13">{b.title}</div><div className="dim fs11 mt-4">{b.playlist}</div></div>
              <button className="btn sm"><Icon name="calendar" size={13} /> Agendar</button>
            </div>
          ); })}
        </div>}
      </Card>
    </div>
  );
}

Object.assign(window, { AnalyticsView, ScheduleView });

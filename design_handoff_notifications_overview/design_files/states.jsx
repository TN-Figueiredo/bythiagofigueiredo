/* ============================================================
   STATE LAYERS — loading skeletons + designed empty states
   ============================================================ */

function SkelCard({ h }) { return <div className="card" style={{ height: h }} />; }
const sk = (h, w, r) => <Skel h={h} w={w} r={r} />;

function SkelStat() {
  return <Card className="stat">{sk(11, "55%", 5)}<div style={{ height: 11 }} />{sk(28, "70%", 6)}<div style={{ height: 11 }} />{sk(28, "100%", 8)}</Card>;
}

function SkelDashboard() {
  return (
    <div>
      <div className="qa-grid" style={{ marginBottom: 18 }}>{[0,1,2,3].map(i => <Skel key={i} h={68} r={13} />)}</div>
      <div className="grid" style={{ gridTemplateColumns: "1.55fr 1fr" }}>
        <div className="col gap-16"><Skel h={236} r={14} /><Skel h={170} r={14} /></div>
        <div className="col gap-16"><Skel h={196} r={14} /><Skel h={206} r={14} /></div>
      </div>
      <Skel h={150} r={14} style={{ marginTop: 16 }} />
    </div>
  );
}

function SkelAnalytics() {
  return (
    <div>
      <div className="row gap-16" style={{ marginBottom: 22 }}>{[60,72,66,64,72,58].map((w, i) => <Skel key={i} h={16} w={w} r={5} />)}</div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(6,1fr)", marginBottom: 16 }}>{[0,1,2,3,4,5].map(i => <SkelStat key={i} />)}</div>
      <Skel h={140} r={14} style={{ marginBottom: 16 }} />
      <div className="grid g-cols-2"><Skel h={280} r={14} /><Skel h={280} r={14} /></div>
    </div>
  );
}

function SkelSchedule() {
  return (
    <div>
      <div className="row between" style={{ marginBottom: 16 }}><Skel h={36} w={220} r={9} /><Skel h={16} w={200} r={5} /></div>
      <div className="grid g-cols-4" style={{ marginBottom: 16 }}>{[0,1,2,3].map(i => <SkelStat key={i} />)}</div>
      <Skel h={460} r={14} />
    </div>
  );
}

function SkelInbox() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="row between" style={{ marginBottom: 18 }}><Skel h={28} w={280} r={6} /><Skel h={36} w={260} r={9} /></div>
      <div className="row gap-8" style={{ marginBottom: 14 }}>{[70,90,80,84,60].map((w, i) => <Skel key={i} h={30} w={w} r={8} />)}</div>
      <Card>{[0,1,2,3,4].map(i => (
        <div key={i} className="row gap-12" style={{ padding: "16px 18px", borderBottom: "1px solid var(--border-soft)" }}>
          <Skel h={20} w={20} r={5} /><Skel h={32} w={32} r={9} /><div className="grow col gap-8"><Skel h={13} w="40%" r={4} /><Skel h={12} w="75%" r={4} /></div>
        </div>
      ))}</Card>
    </div>
  );
}

/* ---------- EMPTIES ---------- */
function EmptyDashboard({ go }) {
  return <div style={{ paddingTop: 40 }}><EmptyState icon="sparkles" title="Tudo pronto para começar"
    sub="Quando você criar e publicar conteúdo, seu painel mostra o que precisa de atenção, o foco do dia e a performance — tudo aqui."
    action={<button className="btn primary mt-8" onClick={() => go && go("upnext")}><Icon name="plus" size={15} /> Criar primeiro item</button>} /></div>;
}
function EmptyAnalytics() {
  return <div style={{ paddingTop: 40 }}><EmptyState icon="trending" title="Sem dados neste período"
    sub="Ainda não há eventos suficientes para o intervalo selecionado. Tente um período maior ou volte após as primeiras publicações." 
    action={<div className="row gap-8 mt-8"><span className="chip">7 dias</span><span className="chip on">30 dias</span><span className="chip">90 dias</span></div>} /></div>;
}
function EmptySchedule({ go }) {
  return <div style={{ paddingTop: 40 }}><EmptyState icon="calendar" title="Nada agendado ainda"
    sub="Agende posts, vídeos e edições para visualizar sua cadência e manter o ritmo de publicação."
    action={<button className="btn primary mt-8" onClick={() => go && go("upnext")}><Icon name="plus" size={15} /> Agendar conteúdo</button>} /></div>;
}
function EmptyInbox() {
  return <div style={{ paddingTop: 30 }}><EmptyState icon="checkcheck" title={<>Você está em dia <span aria-hidden="true">🎉</span></>}
    sub="Nenhuma notificação pendente. Avisos sobre pipeline, YouTube, newsletter e mais aparecem aqui." /></div>;
}

Object.assign(window, { SkelDashboard, SkelAnalytics, SkelSchedule, SkelInbox, EmptyDashboard, EmptyAnalytics, EmptySchedule, EmptyInbox });

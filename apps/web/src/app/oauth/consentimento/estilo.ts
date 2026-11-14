// Tokens do mockup M1 r2 (hex e rgba; nunca color-mix). Escopo `.c1c`; escuro por `prefers-color-scheme`.
export const ESTILO = `
.c1c{--bg:#F7F1E8;--surface:#FBF6EC;--text:#1F1B17;--muted:#6A5F48;--line:#CEBFA0;--accent:#B94210;--on-accent:#FFFFFF;--accent-soft:rgba(185,66,16,.10);--green:#15803D;--green-soft:rgba(21,128,61,.12);--amber:#92400E;--amber-border:#B45309;--amber-soft:rgba(245,158,11,.18);--red:#B91C1C;--red-soft:rgba(185,28,28,.10);--neutral-soft:rgba(128,128,128,.14);--shadow:0 1px 2px rgba(31,27,23,.08),0 8px 24px rgba(31,27,23,.07)}
@media (prefers-color-scheme:dark){.c1c{--bg:#1A1714;--surface:#221E1A;--text:#F5EFE6;--muted:#958A75;--line:#332D25;--accent:#FF8240;--on-accent:#1A140C;--accent-soft:rgba(255,130,64,.13);--green:#22C55E;--green-soft:rgba(34,197,94,.13);--amber:#F59E0B;--amber-soft:rgba(245,158,11,.14);--red:#EF4444;--red-soft:rgba(239,68,68,.13);--shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35)}}
.c1c{min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:var(--bg);color:var(--text);font:14px/20px Inter,ui-sans-serif,system-ui,sans-serif}
.c1c *{box-sizing:border-box}
.c1c :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.c1c .card{width:100%;max-width:480px;background:var(--surface);border:1px solid var(--line);border-radius:8px;box-shadow:var(--shadow);padding:24px}
.c1c .tone{--t:var(--muted);--ts:var(--neutral-soft)}
.c1c .tone-accent{--t:var(--accent);--ts:var(--accent-soft)}
.c1c .tone-green{--t:var(--green);--ts:var(--green-soft)}
.c1c .tone-amber{--t:var(--amber);--ts:var(--amber-soft)}
.c1c .tone-red{--t:var(--red);--ts:var(--red-soft)}
.c1c .brand{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:13px;margin-bottom:12px}
.c1c .brand b{width:22px;height:22px;border-radius:6px;background:var(--accent);color:var(--on-accent);display:grid;place-items:center;font-size:12px}
.c1c .hd{display:flex;align-items:center;gap:12px;margin:0 0 8px}
.c1c .hd h1{margin:0;flex:1;min-width:0}
.c1c .badge{width:36px;height:36px;flex:none;border-radius:50%;background:var(--ts);color:var(--t);display:grid;place-items:center;font-weight:700}
.c1c h1{font-size:22px;line-height:28px;font-weight:700;letter-spacing:-.015em;overflow-wrap:anywhere}
.c1c h1:focus{outline:none}
.c1c h2{font-size:13px;line-height:18px;font-weight:600;margin:0 0 6px}
.c1c p{margin:0}
.c1c .lead{font-size:17px;line-height:24px;font-weight:600;margin-top:4px}
.c1c .who{color:var(--muted);margin-top:8px;overflow-wrap:anywhere}
.c1c .who b{color:var(--text);font-weight:600}
.c1c .when{display:flex;gap:8px;color:var(--muted);font-size:13px;margin-top:4px}
.c1c .when.late{color:var(--amber);font-weight:600}
.c1c .lists{margin-top:20px;display:grid;gap:16px}
.c1c ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.c1c .lists li{display:flex;gap:8px}
.c1c .risk{margin-top:20px;padding-top:12px;border-top:1px solid var(--line);font-size:13px;line-height:18px;color:var(--muted)}
.c1c .alert{margin-top:20px;padding:12px;border-radius:6px;border:1px solid var(--amber-border);background:var(--amber-soft)}
.c1c .lists .ok{color:var(--green)}
.c1c .lists .no{color:var(--muted)}
.c1c .lists li svg,.c1c .risk svg{flex:none;margin-top:2px}
.c1c .risk li{display:flex;gap:8px}
.c1c .alert{display:flex;gap:10px;align-items:flex-start}
.c1c .alert svg{flex:none;color:var(--amber)}
.c1c .who svg,.c1c .when svg{flex:none;vertical-align:-3px;margin-right:4px}
.c1c .when svg{margin-top:2px}
.c1c .sair-link{display:inline-flex;align-items:center;min-height:44px;margin-left:0;padding:0 4px;background:transparent;border:0;color:var(--text);font:400 14px/20px Inter,ui-sans-serif,system-ui,sans-serif;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.c1c .alert strong{display:block;font-weight:600}
.c1c .alert span{display:block;margin-top:2px;font-size:13px;line-height:18px}
.c1c .note{margin-top:12px;font-size:13px;line-height:18px}
.c1c .btns{display:grid;gap:12px;margin-top:16px}
.c1c .btn{height:48px;border-radius:6px;font:600 14px/20px Inter,sans-serif;display:flex;align-items:center;justify-content:center;padding:0 16px;cursor:pointer;text-decoration:none;transition:background-color .12s}
.c1c .btn.go{background:var(--accent);color:var(--on-accent);border:2px solid var(--accent)}
.c1c .btn.no{background:transparent;color:var(--text);border:2px solid var(--text)}
.c1c .btn:not([disabled]):hover{background:var(--accent-soft);color:var(--text)}
.c1c .btn.go:not([disabled]):hover{background:var(--accent);filter:brightness(1.08);color:var(--on-accent)}
.c1c .btn[disabled]{opacity:.65;cursor:not-allowed}
.c1c form.sair{margin:0}
.c1c .fine{margin-top:16px;font-size:13px;line-height:18px;color:var(--muted)}
.c1c code{font:12px/16px ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--ts);padding:2px 6px;border-radius:4px}
.c1c .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (min-width:521px){.c1c .btns.pair{grid-template-columns:1fr 1fr}}
@media (max-width:520px){.c1c{padding:0;display:block}.c1c .card{border-left:0;border-right:0;border-radius:0;box-shadow:none;padding:20px 16px;max-width:none}}
@media (prefers-reduced-motion:reduce){.c1c .btn{transition:none}}
`

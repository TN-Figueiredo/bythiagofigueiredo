/*
 * Email Design System — Thiago Figueiredo
 * Preview components for all transactional email templates.
 * Uses table-based HTML matching real email output.
 */

// ─── Tokens ───────────────────────────────────────────────

const ET = {
  bg: '#F7F1E8',
  card: '#FBF6EC',
  ink: '#1F1B17',
  accent: '#FF8240',
  accentDeep: '#E0651E',
  muted: '#6A5F48',
  faint: '#9C9178',
  line: '#E8DCC8',
  lineFaint: '#F0E8D8',
  display: "'Fraunces', Georgia, 'Times New Roman', serif",
  body: "'Source Serif 4', Georgia, 'Times New Roman', serif",
  ui: "'Inter', Arial, Helvetica, sans-serif",
  mono: "'JetBrains Mono', 'Courier New', Courier, monospace",
};

// ─── Shared Email Building Blocks ─────────────────────────

const EmailWrapper = ({ children, preheader }) => (
  <table width="100%" cellPadding="0" cellSpacing="0" border="0"
    style={{ backgroundColor: ET.bg, margin: 0, padding: 0, width: '100%' }}>
    <tbody>
      {preheader && (
        <tr>
          <td style={{ display: 'none', fontSize: 1, lineHeight: 1, maxHeight: 0, maxWidth: 0, opacity: 0, overflow: 'hidden' }}>
            {preheader}
          </td>
        </tr>
      )}
      <tr>
        <td align="center" style={{ padding: '40px 16px' }}>
          <table cellPadding="0" cellSpacing="0" border="0"
            style={{ maxWidth: 600, width: '100%', backgroundColor: ET.card, borderCollapse: 'collapse', boxShadow: '0 1px 12px rgba(31, 27, 23, 0.07)' }}>
            <tbody>
              {/* Brand accent stripe */}
              <tr>
                <td style={{ height: 4, backgroundColor: ET.accent, fontSize: 1, lineHeight: '1px' }}>&nbsp;</td>
              </tr>
              {children}
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>
);

const EmailMonogram = () => (
  <tr>
    <td align="center" style={{ padding: '40px 40px 28px' }}>
      <table cellPadding="0" cellSpacing="0" border="0">
        <tbody>
          <tr>
            <td style={{
              fontFamily: ET.body,
              fontSize: 44,
              fontWeight: 500,
              color: ET.ink,
              letterSpacing: -4,
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}>
              T<span style={{ fontStyle: 'italic', color: ET.accent }}>F</span><span style={{ fontSize: 8, color: ET.ink, verticalAlign: 'middle', marginLeft: 2 }}>&#9679;</span>
            </td>
          </tr>
        </tbody>
      </table>
    </td>
  </tr>
);

const EmailDivider = ({ pad = '0 48px' }) => (
  <tr>
    <td style={{ padding: pad }}>
      <table width="100%" cellPadding="0" cellSpacing="0" border="0">
        <tbody>
          <tr>
            <td style={{ borderTop: `1px solid ${ET.line}`, fontSize: 1, lineHeight: 1, height: 1 }}>&nbsp;</td>
          </tr>
        </tbody>
      </table>
    </td>
  </tr>
);

const EmailButton = ({ children, href = '{{action_url}}', align = 'left' }) => (
  <table cellPadding="0" cellSpacing="0" border="0" style={{ margin: align === 'center' ? '0 auto' : 0 }}>
    <tbody>
      <tr>
        <td align="center" style={{
          backgroundColor: ET.accent,
          padding: '15px 40px',
          borderRadius: 4,
          msoLineHeightRule: 'exactly',
        }}>
          <a href={href} style={{
            color: ET.ink,
            fontFamily: ET.ui,
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-block',
            letterSpacing: '0.01em',
          }}>
            {children}
          </a>
        </td>
      </tr>
    </tbody>
  </table>
);

const EmailEndMark = () => (
  <tr>
    <td align="center" style={{ padding: '32px 48px 0' }}>
      <table cellPadding="0" cellSpacing="0" border="0" style={{ width: 180 }}>
        <tbody>
          <tr>
            <td style={{ borderTop: `1px solid ${ET.line}`, width: '42%', verticalAlign: 'middle' }}></td>
            <td align="center" style={{ color: ET.accent, fontFamily: ET.body, fontSize: 18, verticalAlign: 'middle', padding: '0 14px', whiteSpace: 'nowrap', lineHeight: 1 }}>
              ❦
            </td>
            <td style={{ borderTop: `1px solid ${ET.line}`, width: '42%', verticalAlign: 'middle' }}></td>
          </tr>
        </tbody>
      </table>
    </td>
  </tr>
);

const EmailFooter = ({ showPrefs = true }) => (
  <>
    <EmailEndMark />
    <tr>
      <td align="center" style={{ padding: '20px 48px 40px' }}>
        <p style={{
          fontFamily: ET.body,
          fontSize: 14,
          color: ET.muted,
          margin: '0 0 2px',
          lineHeight: 1.4,
        }}>
          <span style={{ fontStyle: 'italic', fontWeight: 300, opacity: 0.7 }}>tf</span>
          {' '}
          <span style={{ color: ET.accent }}>❦</span>
          {' '}
          <span style={{ fontWeight: 500 }}>Thiago Figueiredo</span>
        </p>
        <p style={{
          fontFamily: ET.ui,
          fontSize: 12,
          color: ET.faint,
          margin: '0 0 20px',
          letterSpacing: '0.02em',
        }}>
          bythiagofigueiredo.com
        </p>
        <p style={{
          fontFamily: ET.ui,
          fontSize: 11,
          color: ET.faint,
          margin: 0,
          lineHeight: 1.6,
        }}>
          <a href="{{unsubscribe_url}}" style={{ color: ET.faint, textDecoration: 'underline' }}>Cancelar inscrição</a>
          {showPrefs && (
            <>
              <span style={{ padding: '0 6px', opacity: 0.5 }}>·</span>
              <a href="{{preferences_url}}" style={{ color: ET.faint, textDecoration: 'underline' }}>Preferências</a>
            </>
          )}
        </p>
      </td>
    </tr>
  </>
);

// ─── Newsletter List (multi-subscribe) ────────────────────

const demoNewsletters = [
  { name: 'Diário do bythiago', tagline: 'resumo da semana · sextas', color: '#FF8240' },
  { name: 'Código em português', tagline: 'decisões de stack, bugs reais · mensal', color: '#1F5F8B' },
];

const SubscribedNewsletters = ({ items = demoNewsletters }) => (
  <table width="100%" cellPadding="0" cellSpacing="0" border="0" style={{ margin: '20px 0 4px' }}>
    <tbody>
      {items.map((nl, i) => (
        <React.Fragment key={nl.name}>
          {i > 0 && <tr><td style={{ height: 10 }}></td></tr>}
          <tr>
            <td style={{
              borderLeft: `3px solid ${nl.color}`,
              padding: '10px 0 10px 16px',
            }}>
              <p style={{
                fontFamily: ET.display,
                fontSize: 16,
                fontWeight: 500,
                color: ET.ink,
                margin: '0 0 2px',
                lineHeight: 1.3,
                letterSpacing: '-0.01em',
              }}>
                {nl.name}
              </p>
              <p style={{
                fontFamily: ET.ui,
                fontSize: 12,
                color: ET.faint,
                margin: 0,
                letterSpacing: '0.02em',
              }}>
                {nl.tagline}
              </p>
            </td>
          </tr>
        </React.Fragment>
      ))}
    </tbody>
  </table>
);

// ─── 01 · Confirmação de Inscrição ───────────────────────

const ConfirmEmail = () => (
  <EmailWrapper preheader="Confirme sua inscrição para começar a receber a newsletter.">
    <EmailMonogram />
    <EmailDivider />
    <tr>
      <td style={{ padding: '40px 48px 44px' }}>
        <h1 style={{
          fontFamily: ET.display,
          fontSize: 30,
          fontWeight: 500,
          color: ET.ink,
          margin: '0 0 20px',
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
        }}>
          Confirme sua inscrição
        </h1>
        <p style={{
          fontFamily: ET.body,
          fontSize: 17,
          color: ET.ink,
          lineHeight: 1.65,
          margin: '0 0 4px',
        }}>
          Você escolheu receber 2 newsletters:
        </p>

        <SubscribedNewsletters />

        <p style={{
          fontFamily: ET.body,
          fontSize: 17,
          color: ET.ink,
          lineHeight: 1.65,
          margin: '16px 0 32px',
        }}>
          Clique no botão abaixo para confirmar e começar a receber.
        </p>

        <EmailButton href="{{confirm_url}}">Confirmar Inscrição</EmailButton>

        <p style={{
          fontFamily: ET.ui,
          fontSize: 13,
          color: ET.faint,
          lineHeight: 1.5,
          margin: '28px 0 0',
        }}>
          Se não foi você, pode ignorar este email com segurança.
        </p>
      </td>
    </tr>
    <EmailDivider />
    <EmailFooter showPrefs={false} />
  </EmailWrapper>
);

// ─── 02 · Boas-vindas ────────────────────────────────────

const WelcomeEmail = () => (
  <EmailWrapper preheader="Sua inscrição foi confirmada. Bem-vindo ao Diário de Bordo.">
    <EmailMonogram />
    <EmailDivider />
    <tr>
      <td style={{ padding: '40px 48px 12px' }}>
        <h1 style={{
          fontFamily: ET.display,
          fontSize: 30,
          fontWeight: 500,
          color: ET.ink,
          margin: '0 0 20px',
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
        }}>
          Bem-vindo às newsletters
        </h1>
        <p style={{
          fontFamily: ET.body,
          fontSize: 17,
          color: ET.ink,
          lineHeight: 1.65,
          margin: '0 0 4px',
        }}>
          Sua inscrição foi confirmada para:
        </p>

        <SubscribedNewsletters />

        <p style={{
          fontFamily: ET.body,
          fontSize: 17,
          color: ET.ink,
          lineHeight: 1.65,
          margin: '16px 0 28px',
        }}>
          A partir de agora, cada edição vai direto para o seu email — sem algoritmo.
        </p>
      </td>
    </tr>

    {/* Latest article card */}
    <tr>
      <td style={{ padding: '0 48px 36px' }}>
        <table width="100%" cellPadding="0" cellSpacing="0" border="0" style={{
          backgroundColor: '#FFFFFF',
          borderCollapse: 'collapse',
          border: `1px solid ${ET.line}`,
        }}>
          <tbody>
            <tr>
              <td style={{ padding: '24px 28px' }}>
                <p style={{
                  fontFamily: ET.mono,
                  fontSize: 10,
                  color: ET.faint,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  margin: '0 0 8px',
                  fontWeight: 500,
                }}>
                  Último artigo
                </p>
                <h2 style={{
                  fontFamily: ET.display,
                  fontSize: 20,
                  fontWeight: 500,
                  color: ET.ink,
                  margin: '0 0 8px',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.3,
                }}>
                  Por que eu deixei de usar frameworks
                </h2>
                <p style={{
                  fontFamily: ET.body,
                  fontSize: 14,
                  color: ET.muted,
                  lineHeight: 1.55,
                  margin: '0 0 16px',
                }}>
                  Três anos, quatro reescritas e uma conclusão que deveria ter sido óbvia desde o início…
                </p>
                <a href="{{latest_post_url}}" style={{
                  fontFamily: ET.ui,
                  fontSize: 13,
                  fontWeight: 600,
                  color: ET.accent,
                  textDecoration: 'none',
                }}>
                  Ler artigo →
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>

    <tr>
      <td style={{ padding: '0 48px 40px' }}>
        <p style={{
          fontFamily: ET.body,
          fontSize: 16,
          color: ET.muted,
          lineHeight: 1.6,
          margin: '0 0 4px',
        }}>
          Obrigado por estar aqui.
        </p>
        <p style={{
          fontFamily: ET.body,
          fontSize: 16,
          color: ET.muted,
          lineHeight: 1.6,
          margin: 0,
        }}>
          — Thiago
        </p>
      </td>
    </tr>
    <EmailDivider />
    <EmailFooter />
  </EmailWrapper>
);

// ─── 03 · Newsletter Issue ───────────────────────────────

const NewsletterEmail = () => (
  <EmailWrapper preheader="Diário de Bordo #042 — O custo invisível de não decidir">
    <EmailMonogram />

    {/* Issue header */}
    <tr>
      <td align="center" style={{ padding: '0 48px 8px' }}>
        <p style={{
          fontFamily: ET.mono,
          fontSize: 11,
          color: ET.faint,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          margin: 0,
          fontWeight: 500,
        }}>
          Diário de Bordo · #042
        </p>
      </td>
    </tr>
    <tr>
      <td align="center" style={{ padding: '0 48px 4px' }}>
        <p style={{
          fontFamily: ET.ui,
          fontSize: 12,
          color: ET.faint,
          margin: 0,
          letterSpacing: '0.02em',
        }}>
          20 de maio, 2026
        </p>
      </td>
    </tr>

    <EmailDivider pad="16px 48px 0" />

    {/* Article body */}
    <tr>
      <td style={{ padding: '36px 48px 0' }}>
        <h1 style={{
          fontFamily: ET.display,
          fontSize: 32,
          fontWeight: 500,
          color: ET.ink,
          margin: '0 0 24px',
          letterSpacing: '-0.02em',
          lineHeight: 1.25,
        }}>
          O custo invisível de não decidir
        </h1>

        {/* Drop cap paragraph */}
        <p style={{
          fontFamily: ET.body,
          fontSize: 17,
          color: ET.ink,
          lineHeight: 1.7,
          margin: '0 0 20px',
        }}>
          <span style={{
            fontFamily: ET.display,
            fontSize: 52,
            fontWeight: 600,
            color: ET.accent,
            float: 'left',
            lineHeight: 0.82,
            marginRight: 8,
            marginTop: 4,
          }}>T</span>
          oda decisão adiada é uma decisão tomada — a de manter o estado atual. E o estado atual tem custo: energia mental, oportunidades que expiram, a erosão lenta da clareza.
        </p>

        <p style={{
          fontFamily: ET.body,
          fontSize: 17,
          color: ET.ink,
          lineHeight: 1.7,
          margin: '0 0 20px',
        }}>
          Isso não é um argumento pela pressa. É o oposto. É reconhecer que ponderar sem prazo não é prudência — é paralisia com roupagem de sabedoria.
        </p>

        {/* Subheading */}
        <h2 style={{
          fontFamily: ET.display,
          fontSize: 22,
          fontWeight: 500,
          color: ET.ink,
          margin: '36px 0 16px',
          letterSpacing: '-0.01em',
          lineHeight: 1.3,
        }}>
          A ilusão da opção aberta
        </h2>

        <p style={{
          fontFamily: ET.body,
          fontSize: 17,
          color: ET.ink,
          lineHeight: 1.7,
          margin: '0 0 20px',
        }}>
          Quando mantemos todas as portas abertas, nenhuma delas nos leva a algum lugar. É o paradoxo da flexibilidade: quanto mais opções preservamos, menos progresso fazemos.
        </p>

        {/* Pull quote */}
        <table width="100%" cellPadding="0" cellSpacing="0" border="0" style={{ margin: '32px 0' }}>
          <tbody>
            <tr>
              <td style={{
                borderLeft: `3px solid ${ET.accent}`,
                paddingLeft: 20,
                paddingTop: 4,
                paddingBottom: 4,
              }}>
                <p style={{
                  fontFamily: ET.display,
                  fontSize: 19,
                  fontStyle: 'italic',
                  color: ET.ink,
                  lineHeight: 1.55,
                  margin: 0,
                }}>
                  A decisão perfeita não existe. Existe a decisão tomada a tempo.
                </p>
              </td>
            </tr>
          </tbody>
        </table>

        <p style={{
          fontFamily: ET.body,
          fontSize: 17,
          color: ET.ink,
          lineHeight: 1.7,
          margin: '0 0 20px',
        }}>
          Três regras que uso quando percebo que estou adiando: se a decisão é reversível, decida agora. Se não é reversível, defina um prazo. Se o prazo passou, decida com o que tem.
        </p>

        {/* Inline link example */}
        <p style={{
          fontFamily: ET.body,
          fontSize: 17,
          color: ET.ink,
          lineHeight: 1.7,
          margin: '0 0 20px',
        }}>
          Escrevi sobre isso mais a fundo em{' '}
          <a href="#" style={{ color: ET.accent, textDecoration: 'underline', textUnderlineOffset: 2 }}>
            O que aprendi deletando 40 projetos
          </a>.
        </p>
      </td>
    </tr>

    {/* Sign-off */}
    <tr>
      <td style={{ padding: '16px 48px 40px' }}>
        <p style={{
          fontFamily: ET.body,
          fontSize: 16,
          color: ET.muted,
          lineHeight: 1.6,
          margin: 0,
        }}>
          Até a próxima,<br />
          — Thiago
        </p>
      </td>
    </tr>

    <EmailDivider />
    <EmailFooter />
  </EmailWrapper>
);

// ─── Preview UI ──────────────────────────────────────────

const previewPageStyles = {
  page: {
    background: '#1A1714',
    minHeight: '100vh',
    padding: '56px 24px 80px',
    fontFamily: ET.ui,
  },
  header: {
    textAlign: 'center',
    marginBottom: 56,
  },
  title: {
    fontFamily: ET.display,
    fontSize: 32,
    fontWeight: 500,
    color: '#EFE6D2',
    letterSpacing: '-0.025em',
    margin: '0 0 8px',
    lineHeight: 1.2,
  },
  subtitle: {
    fontFamily: ET.body,
    fontSize: 15,
    color: '#958A75',
    margin: 0,
  },
  section: {
    maxWidth: 680,
    margin: '0 auto 80px',
  },
  label: {
    fontFamily: ET.mono,
    fontSize: 11,
    fontWeight: 600,
    color: '#EFE6D2',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    margin: '0 0 4px',
  },
  desc: {
    fontFamily: ET.ui,
    fontSize: 13,
    color: '#6B634F',
    margin: '0 0 24px',
    lineHeight: 1.5,
  },
  frame: {
    borderRadius: 8,
    overflow: 'hidden',
    boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
  },
};

const TemplatePreview = ({ number, title, desc, children }) => {
  const [viewport, setViewport] = React.useState('desktop'); // desktop | mobile

  return (
    <div style={previewPageStyles.section}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <p style={previewPageStyles.label}>{number} · {title}</p>
          <p style={{ ...previewPageStyles.desc, margin: 0 }}>{desc}</p>
        </div>
        <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: 3, flexShrink: 0 }}>
          {['desktop', 'mobile'].map(v => {
            const isActive = viewport === v;
            return (
              <button key={v} onClick={() => setViewport(v)} style={{
                fontFamily: ET.mono, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '6px 14px', borderRadius: 4, border: 'none', cursor: 'pointer',
                background: isActive ? ET.accent : 'transparent',
                color: isActive ? ET.ink : '#6B634F',
                fontWeight: isActive ? 700 : 400,
              }}>
                {v === 'desktop' ? '⬜ 600px' : '📱 375px'}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{
        ...previewPageStyles.frame,
        ...(viewport === 'mobile' ? { zoom: 375 / 680, margin: '0 auto' } : { margin: 0 }),
      }}>
        {children}
      </div>
    </div>
  );
};

// ─── Token Reference ─────────────────────────────────────

const TokenReference = () => {
  const colors = [
    { name: 'Background', hex: ET.bg },
    { name: 'Card', hex: ET.card },
    { name: 'Ink', hex: ET.ink },
    { name: 'Accent', hex: ET.accent },
    { name: 'Muted', hex: ET.muted },
    { name: 'Line', hex: ET.line },
  ];
  const fonts = [
    { name: 'Display', family: 'Fraunces', fallback: 'Georgia', sample: 'Confirme sua inscrição', weight: 500, size: 24, style: {} },
    { name: 'Body', family: 'Source Serif 4', fallback: 'Georgia', sample: 'Reflexões sobre tecnologia e criação.', weight: 400, size: 17, style: {} },
    { name: 'UI', family: 'Inter', fallback: 'Arial', sample: 'Cancelar inscrição · Preferências', weight: 400, size: 13, style: {} },
    { name: 'Mono', family: 'JetBrains Mono', fallback: 'Courier', sample: 'DIÁRIO DE BORDO · #042', weight: 500, size: 11, style: { letterSpacing: '0.12em', textTransform: 'uppercase' } },
  ];

  return (
    <div style={{ ...previewPageStyles.section, marginBottom: 80 }}>
      <p style={{ ...previewPageStyles.label, marginBottom: 24 }}>Design Tokens</p>

      {/* Colors */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontFamily: ET.ui, fontSize: 12, color: '#6B634F', margin: '0 0 12px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Cores
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {colors.map(c => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', padding: '8px 14px 8px 8px', borderRadius: 6 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 4,
                backgroundColor: c.hex,
                border: c.hex === '#FFFFFF' ? '1px solid rgba(255,255,255,0.15)' : 'none',
                flexShrink: 0,
              }} />
              <div>
                <div style={{ fontFamily: ET.ui, fontSize: 12, color: '#EFE6D2', fontWeight: 500 }}>{c.name}</div>
                <div style={{ fontFamily: ET.mono, fontSize: 10, color: '#6B634F' }}>{c.hex}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Typography */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontFamily: ET.ui, fontSize: 12, color: '#6B634F', margin: '0 0 16px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Tipografia
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {fonts.map(f => (
            <div key={f.name} style={{ display: 'flex', gap: 20, alignItems: 'baseline', background: 'rgba(255,255,255,0.03)', padding: '14px 18px', borderRadius: 6 }}>
              <div style={{ width: 60, flexShrink: 0 }}>
                <div style={{ fontFamily: ET.mono, fontSize: 10, color: '#6B634F', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{f.name}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: `'${f.family}', ${f.fallback}, serif`,
                  fontSize: f.size,
                  fontWeight: f.weight,
                  color: '#EFE6D2',
                  lineHeight: 1.4,
                  ...f.style,
                }}>
                  {f.sample}
                </div>
                <div style={{ fontFamily: ET.mono, fontSize: 10, color: '#6B634F', marginTop: 4 }}>
                  {f.family} → {f.fallback}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Spacing */}
      <div>
        <p style={{ fontFamily: ET.ui, fontSize: 12, color: '#6B634F', margin: '0 0 12px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Espaçamento
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {[
            { label: 'Card padding', value: '48px' },
            { label: 'Header top', value: '40px' },
            { label: 'Section gap', value: '32–40px' },
            { label: 'Text gap', value: '20px' },
            { label: 'Button pad', value: '15px 40px' },
            { label: 'Mobile pad', value: '24px' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 14px', borderRadius: 6, display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: ET.mono, fontSize: 10, color: '#6B634F' }}>{s.label}</span>
              <span style={{ fontFamily: ET.mono, fontSize: 12, color: '#EFE6D2', fontWeight: 600 }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Component Specimens ─────────────────────────────────

const Specimen = ({ label, bg = 'transparent', children }) => (
  <div style={{ flex: '1 1 280px' }}>
    <p style={{ fontFamily: ET.mono, fontSize: 10, color: '#6B634F', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px', fontWeight: 500 }}>{label}</p>
    <div style={{
      background: bg,
      borderRadius: 6,
      padding: '24px 28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1px solid rgba(255,255,255,0.04)',
    }}>
      {children}
    </div>
  </div>
);

const ComponentSpecimens = () => (
  <div style={{ ...previewPageStyles.section, marginBottom: 96 }}>
    <p style={{ ...previewPageStyles.label, marginBottom: 8 }}>Componentes</p>
    <p style={{ fontFamily: ET.ui, fontSize: 13, color: '#6B634F', margin: '0 0 28px', lineHeight: 1.5 }}>
      Building blocks reutilizáveis em todos os emails.
    </p>

    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 20 }}>
      <Specimen label="Accent stripe" bg="rgba(255,255,255,0.03)">
        <div style={{ width: '100%', height: 4, backgroundColor: ET.accent, borderRadius: 1 }}></div>
      </Specimen>
      <Specimen label="Monograma TF" bg={ET.bg}>
        <span style={{ fontFamily: ET.body, fontSize: 44, fontWeight: 500, color: ET.ink, letterSpacing: -4, lineHeight: 1, whiteSpace: 'nowrap' }}>
          T<span style={{ fontStyle: 'italic', color: ET.accent }}>F</span><span style={{ fontSize: 8, color: ET.ink, verticalAlign: 'middle', marginLeft: 2 }}>&#9679;</span>
        </span>
      </Specimen>
      <Specimen label="Botão CTA" bg={ET.bg}>
        <div style={{ backgroundColor: ET.accent, padding: '15px 40px', borderRadius: 4, fontFamily: ET.ui, fontSize: 15, fontWeight: 600, color: ET.ink, letterSpacing: '0.01em' }}>
          Confirmar Inscrição
        </div>
      </Specimen>
    </div>

    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 20 }}>
      <Specimen label="Divisor" bg={ET.card}>
        <div style={{ width: '100%', height: 1, backgroundColor: ET.line }}></div>
      </Specimen>
      <Specimen label="End-mark" bg={ET.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 1, backgroundColor: ET.line }}></div>
          <span style={{ color: ET.accent, fontFamily: ET.body, fontSize: 18, lineHeight: 1 }}>❦</span>
          <div style={{ width: 40, height: 1, backgroundColor: ET.line }}></div>
        </div>
      </Specimen>
      <Specimen label="Assinatura" bg={ET.card}>
        <p style={{ fontFamily: ET.body, fontSize: 14, color: ET.muted, margin: 0, textAlign: 'center', lineHeight: 1.4 }}>
          <span style={{ fontStyle: 'italic', fontWeight: 300, opacity: 0.7 }}>tf</span>
          {' '}<span style={{ color: ET.accent }}>❦</span>{' '}
          <span style={{ fontWeight: 500 }}>Thiago Figueiredo</span>
        </p>
      </Specimen>
    </div>

    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
      <Specimen label="Pull quote" bg={ET.card}>
        <div style={{ borderLeft: `3px solid ${ET.accent}`, paddingLeft: 20 }}>
          <p style={{ fontFamily: ET.display, fontSize: 17, fontStyle: 'italic', color: ET.ink, lineHeight: 1.55, margin: 0 }}>
            A decisão perfeita não existe. Existe a decisão tomada a tempo.
          </p>
        </div>
      </Specimen>
      <Specimen label="Drop cap" bg={ET.card}>
        <p style={{ fontFamily: ET.body, fontSize: 15, color: ET.ink, lineHeight: 1.6, margin: 0 }}>
          <span style={{ fontFamily: ET.display, fontSize: 44, fontWeight: 600, color: ET.accent, float: 'left', lineHeight: 0.82, marginRight: 6, marginTop: 3 }}>T</span>
          oda decisão adiada é uma decisão tomada.
        </p>
      </Specimen>
    </div>

    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 20 }}>
      <Specimen label="Newsletter list" bg={ET.card}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ borderLeft: `3px solid ${ET.accent}`, padding: '8px 0 8px 14px' }}>
            <p style={{ fontFamily: ET.display, fontSize: 14, fontWeight: 500, color: ET.ink, margin: '0 0 1px', lineHeight: 1.3 }}>Diário do bythiago</p>
            <p style={{ fontFamily: ET.ui, fontSize: 10, color: ET.faint, margin: 0 }}>resumo da semana · sextas</p>
          </div>
          <div style={{ borderLeft: '3px solid #1F5F8B', padding: '8px 0 8px 14px' }}>
            <p style={{ fontFamily: ET.display, fontSize: 14, fontWeight: 500, color: ET.ink, margin: '0 0 1px', lineHeight: 1.3 }}>Código em português</p>
            <p style={{ fontFamily: ET.ui, fontSize: 10, color: ET.faint, margin: 0 }}>decisões de stack · mensal</p>
          </div>
        </div>
      </Specimen>
    </div>
  </div>
);

// ─── App ─────────────────────────────────────────────────

const EmailTemplatesApp = () => (
  <div style={previewPageStyles.page}>
    <header style={previewPageStyles.header}>
      <div style={{
        fontFamily: ET.body, fontSize: 48, fontWeight: 500, color: '#EFE6D2',
        letterSpacing: -5, lineHeight: 1, marginBottom: 20, whiteSpace: 'nowrap',
      }}>
        T<span style={{ fontStyle: 'italic', color: ET.accent }}>F</span><span style={{ fontSize: 8, color: '#EFE6D2', verticalAlign: 'middle', marginLeft: 3 }}>&#9679;</span>
      </div>
      <h1 style={previewPageStyles.title}>Email Design System</h1>
      <p style={previewPageStyles.subtitle}>
        <span style={{ fontStyle: 'italic', fontWeight: 300, opacity: 0.7 }}>by</span>
        {' '}Thiago Figueiredo
      </p>
      <div style={{ width: 40, height: 1, backgroundColor: ET.accent, margin: '24px auto 0', opacity: 0.5 }}></div>
      <p style={{ fontFamily: ET.body, fontSize: 15, color: '#7A6F5C', margin: '24px auto 0', maxWidth: 440, lineHeight: 1.65, textAlign: 'center' }}>
        Sistema visual para emails transacionais e edições da newsletter. Cada componente segue o mesmo DNA da marca — tipografia editorial, paleta quente, laranja cirúrgico.
      </p>
    </header>

    <TokenReference />
    <ComponentSpecimens />

    <TemplatePreview
      number="01"
      title="Confirmação de Inscrição"
      desc="Double opt-in · enviado quando alguém se inscreve na newsletter. Contém botão de confirmação e texto mínimo."
    >
      <ConfirmEmail />
    </TemplatePreview>

    <TemplatePreview
      number="02"
      title="Boas-vindas"
      desc="Enviado após a confirmação. Apresenta a newsletter e linka para o último artigo publicado."
    >
      <WelcomeEmail />
    </TemplatePreview>

    <TemplatePreview
      number="03"
      title="Newsletter Issue"
      desc="Wrapper para cada edição da newsletter. Demonstra: drop cap, subtítulos, pull quote, links inline, assinatura."
    >
      <NewsletterEmail />
    </TemplatePreview>

    {/* Usage Guide */}
    <div style={{ ...previewPageStyles.section, marginBottom: 0 }}>
      <p style={{ ...previewPageStyles.label, marginBottom: 8 }}>Como Usar</p>
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '28px 32px', border: '1px solid rgba(255,255,255,0.04)' }}>
        <ol style={{ fontFamily: ET.body, fontSize: 14, color: '#958A75', lineHeight: 1.8, margin: 0, paddingLeft: 20 }}>
          <li style={{ marginBottom: 8 }}>Copie o HTML do template em <span style={{ fontFamily: ET.mono, fontSize: 12, color: '#EFE6D2' }}>emails/</span> — cada arquivo é autossuficiente.</li>
          <li style={{ marginBottom: 8 }}>Substitua os <span style={{ fontFamily: ET.mono, fontSize: 12, color: ET.accent }}>{'{{placeholders}}'}</span> pelas variáveis do seu serviço de email (Buttondown, ConvertKit, etc).</li>
          <li style={{ marginBottom: 8 }}>Google Fonts carregam via <span style={{ fontFamily: ET.mono, fontSize: 12, color: '#EFE6D2' }}>@import</span> como progressive enhancement — clientes que não suportam caem para Georgia/Arial.</li>
          <li style={{ marginBottom: 8 }}>A faixa laranja no topo (4px) é a assinatura visual — não remova.</li>
          <li style={{ marginBottom: 8 }}>O template de newsletter inclui building blocks comentados (drop cap, pull quote, subtítulo, botão) — descomente conforme necessário.</li>
          <li>Emails são <strong style={{ color: '#EFE6D2' }}>sempre light mode</strong> — dark mode é tratado automaticamente pelos clientes de email. A página de confirmação (<span style={{ fontFamily: ET.mono, fontSize: 12, color: '#EFE6D2' }}>Subscription Confirmed.html</span>) segue <span style={{ fontFamily: ET.mono, fontSize: 12, color: '#EFE6D2' }}>prefers-color-scheme</span> do sistema.</li>
        </ol>
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontFamily: ET.mono, fontSize: 10, color: '#6B634F', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px' }}>Arquivos</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { file: 'emails/confirm.html', desc: 'Email · confirmação de inscrição (double opt-in)' },
              { file: 'emails/welcome.html', desc: 'Email · boas-vindas após confirmação' },
              { file: 'emails/newsletter.html', desc: 'Email · wrapper para edições da newsletter' },
              { file: 'Subscription Confirmed.html', desc: 'Página · confirmação de inscrição (light/dark)' },
              { file: 'Unsubscribe.html', desc: 'Página · cancelamento de inscrição (light/dark)' },
            ].map(f => (
              <div key={f.file} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <span style={{ fontFamily: ET.mono, fontSize: 12, color: '#EFE6D2', flexShrink: 0 }}>{f.file}</span>
                <span style={{ fontFamily: ET.ui, fontSize: 12, color: '#6B634F' }}>{f.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

Object.assign(window, {
  EmailTemplatesApp,
  ET,
  EmailWrapper, EmailMonogram, EmailDivider, EmailButton, EmailEndMark, EmailFooter,
  ConfirmEmail, WelcomeEmail, NewsletterEmail,
});
